
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { rateLimit } = require("express-rate-limit");
const session = require("express-session");
const { csrfSync } = require("csrf-sync");
const PgSession = require("connect-pg-simple")(session);

const pool = require("./db");
const logger = require("./logger");
const companiesRoutes = require("./routes/companies");
const internshipsRoutes = require("./routes/internships");
const authRoutes = require("./routes/auth");
const applicationsRoutes = require("./routes/applications");

const {
  requireAuth,
  requireRole,
} = require("./middleware/authMiddleware");

const app = express();
const PORT = process.env.PORT || 5000;

// Validate session secret
if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET is missing from .env");
}

// Middleware
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json({ limit: "100kb" }));

// Verify Origin for unsafe requests
app.use((req, res, next) => {
  const safeMethods = ["GET", "HEAD", "OPTIONS"];

  if (safeMethods.includes(req.method)) {
    return next();
  }

  const allowedOrigin = "http://localhost:5173";
  const origin = req.get("Origin");

  if (origin !== allowedOrigin) {
    return res.status(403).json({
      success: false,
      message: "Request blocked: invalid origin.",
    });
  }

  next();
});

// Login rate limiter
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message:
      "Too many login attempts. Please try again in 15 minutes.",
  },
});

app.use("/api/auth/login", loginLimiter);

// Session configuration
app.use(
  session({
    store: new PgSession({
      pool: pool,
      tableName: "user_sessions",
      createTableIfMissing: true,
    }),
    name: "cotrain.sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24,
    },
  })
);

// CSRF protection
const {
  csrfSynchronisedProtection,
  generateToken,
} = csrfSync({
  getTokenFromRequest: (req) =>
    req.headers["x-csrf-token"],
});

// Provide CSRF token
app.get("/api/csrf-token", (req, res) => {
  return res.json({
    success: true,
    csrfToken: generateToken(req),
  });
});

// Enforce CSRF protection
app.use(csrfSynchronisedProtection);

// Home route
app.get("/", (req, res) => {
  return res.json({
    message:
      "Welcome to Cooperative Training Platform API",
    status: "success",
    version: "1.0.0",
  });
});

// API routes
app.use("/api/companies", companiesRoutes);
app.use("/api/internships", internshipsRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/applications", applicationsRoutes);

// Test company access
app.get(
  "/api/company/test",
  requireAuth,
  requireRole("company"),
  (req, res) => {
    return res.status(200).json({
      success: true,
      message: "Company access granted.",
      user: {
        id: req.user.id,
        full_name: req.user.full_name,
        role: req.user.role,
      },
    });
  }
);

// Get current company profile
app.get(
  "/api/company/me",
  requireAuth,
  requireRole("company"),
  async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT
           id,
           user_id,
           company_name,
           industry,
           location,
           description,
           website
         FROM companies
         WHERE user_id = $1`,
        [req.user.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Company profile not found.",
        });
      }

      return res.status(200).json({
        success: true,
        company: result.rows[0],
      });
    } catch (error) {
      console.error("Company profile error:", error);

      return res.status(500).json({
        success: false,
        message: "Internal server error.",
      });
    }
  }
);

// Get internships belonging to the company
app.get(
  "/api/company/internships",
  requireAuth,
  requireRole("company"),
  async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT
           i.id,
           i.company_id,
           i.title,
           i.description,
           i.location,
           i.status,
           i.created_at
         FROM internships i
         JOIN companies c
           ON i.company_id = c.id
         WHERE c.user_id = $1
         ORDER BY i.created_at DESC, i.id DESC`,
        [req.user.id]
      );

      return res.status(200).json({
        success: true,
        internships: result.rows,
      });
    } catch (error) {
      console.error(
        "Company internships error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Internal server error.",
      });
    }
  }
);

// Create internship
app.post(
  "/api/company/internships",
  requireAuth,
  requireRole("company"),
  async (req, res) => {
    try {
      const {
        title,
        description,
        location,
      } = req.body || {};

      if (
        typeof title !== "string" ||
        !title.trim() ||
        title.trim().length > 200
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Title is required and must be 200 characters or less.",
        });
      }

      if (
        description != null &&
        typeof description !== "string"
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid description.",
        });
      }

      if (
        location != null &&
        (typeof location !== "string" ||
          location.length > 200)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid location.",
        });
      }

      const companyResult = await pool.query(
        "SELECT id FROM companies WHERE user_id = $1",
        [req.user.id]
      );

      if (companyResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Company profile not found.",
        });
      }

      const companyId = companyResult.rows[0].id;

      const result = await pool.query(
        `INSERT INTO internships
           (company_id, title, description, location, status)
         VALUES ($1, $2, $3, $4, 'open')
         RETURNING
           id,
           company_id,
           title,
           description,
           location,
           status,
           created_at`,
        [
          companyId,
          title.trim(),
          description?.trim() || null,
          location?.trim() || null,
        ]
      );

      return res.status(201).json({
        success: true,
        message: "Internship created successfully.",
        internship: result.rows[0],
      });
    } catch (error) {
      console.error(
        "Create internship error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Internal server error.",
      });
    }
  }
);

// Update internship
app.put(
  "/api/company/internships/:id",
  requireAuth,
  requireRole("company"),
  async (req, res) => {
    try {
      const internshipId = Number(req.params.id);

      const {
        title,
        description,
        location,
        status,
      } = req.body || {};

      if (
        !Number.isSafeInteger(internshipId) ||
        internshipId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid internship ID.",
        });
      }

      if (
        typeof title !== "string" ||
        !title.trim() ||
        title.trim().length > 200
      ) {
        return res.status(400).json({
          success: false,
          message: "Valid title is required.",
        });
      }

      if (
        description != null &&
        typeof description !== "string"
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid description.",
        });
      }

      if (
        location != null &&
        (typeof location !== "string" ||
          location.length > 200)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid location.",
        });
      }

      if (!["open", "closed"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status.",
        });
      }

      const result = await pool.query(
        `UPDATE internships AS i
         SET
           title = $1,
           description = $2,
           location = $3,
           status = $4
         FROM companies AS c
         WHERE i.id = $5
           AND i.company_id = c.id
           AND c.user_id = $6
         RETURNING
           i.id,
           i.company_id,
           i.title,
           i.description,
           i.location,
           i.status,
           i.created_at`,
        [
          title.trim(),
          description?.trim() || null,
          location?.trim() || null,
          status,
          internshipId,
          req.user.id,
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Internship not found.",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Internship updated successfully.",
        internship: result.rows[0],
      });
    } catch (error) {
      console.error(
        "Update internship error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Internal server error.",
      });
    }
  }
);

// Delete internship
app.delete(
  "/api/company/internships/:id",
  requireAuth,
  requireRole("company"),
  async (req, res) => {
    try {
      const internshipId = Number(req.params.id);

      if (
        !Number.isSafeInteger(internshipId) ||
        internshipId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid internship ID.",
        });
      }

      const result = await pool.query(
        `DELETE FROM internships AS i
         USING companies AS c
         WHERE i.id = $1
           AND i.company_id = c.id
           AND c.user_id = $2
         RETURNING i.id`,
        [internshipId, req.user.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Internship not found.",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Internship deleted successfully.",
      });
    } catch (error) {
      console.error(
        "Delete internship error:",
        error
      );

      if (error.code === "23503") {
        return res.status(409).json({
          success: false,
          message:
            "This internship has related records. Close it instead of deleting it.",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Internal server error.",
      });
    }
  }
);

// Get reviews written by logged-in student
app.get(
  "/api/reviews/my",
  requireAuth,
  requireRole("student"),
  async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT
           r.id,
           r.student_id,
           r.company_id,
           r.rating,
           r.comment,
           r.created_at,
           c.company_name
         FROM reviews AS r
         JOIN companies AS c
           ON c.id = r.company_id
         WHERE r.student_id = $1
         ORDER BY r.created_at DESC NULLS LAST, r.id DESC`,
        [req.user.id]
      );

      return res.status(200).json({
        success: true,
        count: result.rows.length,
        reviews: result.rows,
      });
    } catch (error) {
      console.error(
        "Get my reviews error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Internal server error.",
      });
    }
  }
);

// Get company reviews
app.get(
  "/api/companies/:companyId/reviews",
  async (req, res) => {
    try {
      const companyId = Number(
        req.params.companyId
      );

      if (
        !Number.isSafeInteger(companyId) ||
        companyId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid company ID.",
        });
      }

      const result = await pool.query(
        `SELECT
           r.id,
           r.student_id,
           r.company_id,
           r.rating,
           r.comment,
           r.created_at,
           u.full_name AS student_name
         FROM reviews r
         JOIN users u ON u.id = r.student_id
         WHERE r.company_id = $1
         ORDER BY r.created_at DESC NULLS LAST, r.id DESC`,
        [companyId]
      );

      return res.json({
        success: true,
        reviews: result.rows,
      });
    } catch (error) {
      console.error(
        "Get reviews error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Internal server error.",
      });
    }
  }
);

// Create student review
app.post(
  "/api/companies/:companyId/reviews",
  requireAuth,
  requireRole("student"),
  async (req, res) => {
    try {
      const companyId = Number(
        req.params.companyId
      );

      const {
        rating,
        comment,
      } = req.body || {};

      if (
        !Number.isSafeInteger(companyId) ||
        companyId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid company ID.",
        });
      }

      if (
        !Number.isInteger(rating) ||
        rating < 1 ||
        rating > 5
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Rating must be between 1 and 5.",
        });
      }

      if (
        comment != null &&
        (typeof comment !== "string" ||
          comment.length > 2000)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid comment.",
        });
      }

      const companyResult = await pool.query(
        "SELECT id FROM companies WHERE id = $1",
        [companyId]
      );

      if (companyResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Company not found.",
        });
      }

      // Student must have completed training
      const eligibilityResult = await pool.query(
        `SELECT EXISTS (
           SELECT 1
           FROM applications AS a
           JOIN internships AS i
             ON i.id = a.internship_id
           WHERE a.student_id = $1
             AND i.company_id = $2
             AND a.status = 'completed'
         ) AS eligible`,
        [req.user.id, companyId]
      );

      if (!eligibilityResult.rows[0].eligible) {
        return res.status(403).json({
          success: false,
          message:
            "You can review this company only after completing an internship with it.",
        });
      }

      const result = await pool.query(
        `INSERT INTO reviews
           (student_id, company_id, rating, comment)
         VALUES ($1, $2, $3, $4)
         RETURNING
           id,
           student_id,
           company_id,
           rating,
           comment,
           created_at`,
        [
          req.user.id,
          companyId,
          rating,
          comment?.trim() || null,
        ]
      );

      return res.status(201).json({
        success: true,
        message:
          "Review submitted successfully.",
        review: result.rows[0],
      });
    } catch (error) {
      if (error.code === "23505") {
        return res.status(409).json({
          success: false,
          message:
            "You have already reviewed this company.",
        });
      }

      console.error(
        "Create review error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Internal server error.",
      });
    }
  }
);

// Update student's own review
app.put(
  "/api/reviews/:reviewId",
  requireAuth,
  requireRole("student"),
  async (req, res) => {
    try {
      const reviewId = Number(
        req.params.reviewId
      );

      const {
        rating,
        comment,
      } = req.body || {};

      if (
        !Number.isSafeInteger(reviewId) ||
        reviewId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid review ID.",
        });
      }

      if (
        !Number.isInteger(rating) ||
        rating < 1 ||
        rating > 5
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Rating must be between 1 and 5.",
        });
      }

      if (
        comment != null &&
        (typeof comment !== "string" ||
          comment.length > 2000)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid comment.",
        });
      }

      const result = await pool.query(
        `UPDATE reviews
         SET
           rating = $1,
           comment = $2
         WHERE id = $3
           AND student_id = $4
         RETURNING
           id,
           student_id,
           company_id,
           rating,
           comment,
           created_at`,
        [
          rating,
          comment?.trim() || null,
          reviewId,
          req.user.id,
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Review not found.",
        });
      }

      return res.status(200).json({
        success: true,
        message:
          "Review updated successfully.",
        review: result.rows[0],
      });
    } catch (error) {
      console.error(
        "Update review error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Internal server error.",
      });
    }
  }
);

// Delete student's own review
app.delete(
  "/api/reviews/:reviewId",
  requireAuth,
  requireRole("student"),
  async (req, res) => {
    try {
      const reviewId = Number(
        req.params.reviewId
      );

      if (
        !Number.isSafeInteger(reviewId) ||
        reviewId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid review ID.",
        });
      }

      const result = await pool.query(
        `DELETE FROM reviews
         WHERE id = $1
           AND student_id = $2
         RETURNING id`,
        [
          reviewId,
          req.user.id,
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Review not found.",
        });
      }

      return res.status(200).json({
        success: true,
        message:
          "Review deleted successfully.",
      });
    } catch (error) {
      console.error(
        "Delete review error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Internal server error.",
      });
    }
  }
);

// Admin statistics
app.get(
  "/api/admin/stats",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT
           (SELECT COUNT(*)::int FROM users)
             AS users,
           (SELECT COUNT(*)::int FROM companies)
             AS companies,
           (SELECT COUNT(*)::int FROM internships)
             AS internships,
           (SELECT COUNT(*)::int FROM reviews)
             AS reviews`
      );

      return res.json({
        success: true,
        stats: result.rows[0],
      });
    } catch (error) {
      console.error(
        "Admin stats error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Internal server error.",
      });
    }
  }
);

// Handle CSRF validation errors
app.use((err, req, res, next) => {
  if (
    err.code === "EBADCSRFTOKEN" ||
    err.message === "invalid csrf token"
  ) {
    return res.status(403).json({
      success: false,
      message:
        "Invalid or missing CSRF token.",
    });
  }

  next(err);
});

 // ==========================================
 // Handle unknown routes
 // ==========================================

 app.use((req, res) => {
   return res.status(404).json({
     success: false,
     message: "API endpoint not found.",
   });
 });

 // ==========================================
 // Global error handler
 // ==========================================
app.use((err, req, res, next) => {
  logger.error("Unhandled server error", {
    method: req.method,
    path: req.route?.path || "unknown",
    statusCode: 500,
    errorCode:
      typeof err.code === "string"
        ? err.code
        : "INTERNAL_ERROR",
  });

  return res.status(500).json({
    success: false,
    message: "Internal server error.",
  });
});


// Start server
app.listen(PORT, () => {
  console.log(
    `Server running on port ${PORT}`
  );
});
