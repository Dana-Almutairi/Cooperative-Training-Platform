
const express = require("express");
const bcrypt = require("bcrypt");
const pool = require("../db");

const router = express.Router();

// ==========================================
// Validation helpers
// ==========================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MAX_EMAIL_LENGTH = 254;
const MAX_NAME_LENGTH = 100;
const MAX_PASSWORD_BYTES = 72;
const MIN_PASSWORD_LENGTH = 12;

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function isValidEmail(email) {
  return (
    typeof email === "string" &&
    email.length > 0 &&
    email.length <= MAX_EMAIL_LENGTH &&
    EMAIL_REGEX.test(email)
  );
}

function isValidPassword(password) {
  return (
    typeof password === "string" &&
    password.length >= MIN_PASSWORD_LENGTH &&
    Buffer.byteLength(password, "utf8") <=
      MAX_PASSWORD_BYTES
  );
}

// ==========================================
// Register a new student or company
// ==========================================

router.post("/register", async (req, res) => {
  let client;

  try {
    const {
      full_name,
      email,
      password,
      role,
    } = req.body ?? {};

    // Validate required field types
    if (
      typeof full_name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      typeof role !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "All registration fields are required.",
      });
    }

    // Normalize input
    const cleanName = full_name.trim();
    const cleanEmail = normalizeEmail(email);

    // Validate full name
    if (
      cleanName.length < 2 ||
      cleanName.length > MAX_NAME_LENGTH
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Full name must be between 2 and 100 characters.",
      });
    }

    // Validate email
    if (!isValidEmail(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message:
          "Please enter a valid email address.",
      });
    }

    // Validate password
    if (!isValidPassword(password)) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 12 characters and at most 72 bytes.",
      });
    }

    // Prevent public admin registration
    if (!["student", "company"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid account role.",
      });
    }

    // Hash password before saving
    const passwordHash = await bcrypt.hash(
      password,
      12
    );

    // Start database transaction
    client = await pool.connect();

    await client.query("BEGIN");

    // Create user account
    const userResult = await client.query(
      `
      INSERT INTO users (
        full_name,
        email,
        password_hash,
        role
      )
      VALUES ($1, $2, $3, $4)
      RETURNING
        id,
        full_name,
        email,
        role,
        created_at
      `,
      [
        cleanName,
        cleanEmail,
        passwordHash,
        role,
      ]
    );

    const user = userResult.rows[0];

    // Automatically create company profile
    if (role === "company") {
      await client.query(
        `
        INSERT INTO companies (
          user_id,
          company_name,
          industry,
          location,
          description,
          website
        )
        VALUES ($1, $2, NULL, NULL, NULL, NULL)
        `,
        [user.id, cleanName]
      );
    }

    // Commit both inserts
    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: "Account created successfully.",
      user,
    });

  } catch (error) {
    // Roll back transaction if necessary
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error(
          "Registration rollback error:",
          rollbackError
        );
      }
    }

    // Handle duplicate email
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message:
          "An account with this email already exists.",
      });
    }

    console.error("Registration error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });

  } finally {
    if (client) {
      client.release();
    }
  }
});

// ==========================================
// Login an existing user
// ==========================================

router.post("/login", async (req, res) => {
  try {
    const {
      email,
      password,
    } = req.body ?? {};

    // Validate input types
    if (
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Email and password are required.",
      });
    }

    const cleanEmail = normalizeEmail(email);

    // Validate login input
    if (
      !isValidEmail(cleanEmail) ||
      password.length === 0 ||
      Buffer.byteLength(password, "utf8") >
        MAX_PASSWORD_BYTES
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid email or password.",
      });
    }

    // Find user by email
    const result = await pool.query(
      `
      SELECT
        id,
        full_name,
        email,
        password_hash,
        role
      FROM users
      WHERE email = $1
      `,
      [cleanEmail]
    );

    const user = result.rows[0];

    // Verify password
    const isPasswordValid = user
      ? await bcrypt.compare(
          password,
          user.password_hash
        )
      : false;

    if (!user || !isPasswordValid) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid email or password.",
      });
    }

    // Regenerate session to prevent fixation
    req.session.regenerate((error) => {
      if (error) {
        console.error(
          "Session regeneration error:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "Could not create login session.",
        });
      }

      // Store essential user information
      req.session.userId = user.id;

      // Save session before responding
      req.session.save((saveError) => {
        if (saveError) {
          console.error(
            "Session save error:",
            saveError
          );

          return res.status(500).json({
            success: false,
            message:
              "Could not save login session.",
          });
        }

        return res.status(200).json({
          success: true,
          message: "Login successful.",
          user: {
            id: user.id,
            full_name: user.full_name,
            email: user.email,
            role: user.role,
          },
        });
      });
    });

  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
});

// ==========================================
// Get currently logged-in user
// ==========================================

router.get("/me", async (req, res) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated.",
      });
    }

    const result = await pool.query(
      `
      SELECT
        id,
        full_name,
        email,
        role
      FROM users
      WHERE id = $1
      `,
      [req.session.userId]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated.",
      });
    }

    return res.status(200).json({
      success: true,
      user,
    });

  } catch (error) {
    console.error(
      "Get current user error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
});

// ==========================================
// Logout current user
// ==========================================

router.post("/logout", (req, res) => {
  if (!req.session?.userId) {
    return res.status(401).json({
      success: false,
      message: "Not authenticated.",
    });
  }

  req.session.destroy((error) => {
    if (error) {
      console.error("Logout error:", error);

      return res.status(500).json({
        success: false,
        message: "Could not log out.",
      });
    }

    res.clearCookie("cotrain.sid", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure:
        process.env.NODE_ENV === "production",
    });

    return res.status(200).json({
      success: true,
      message: "Logout successful.",
    });
  });
});

module.exports = router;
