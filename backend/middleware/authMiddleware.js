
const pool = require("../db");

// ==========================================
// Authentication Middleware
// ==========================================

async function requireAuth(req, res, next) {
  try {
    // Check if a session exists
    if (!req.session?.userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const userId = req.session.userId;

    // Validate the session user ID
    const isValidUserId =
      Number.isSafeInteger(userId) &&
      userId > 0 &&
      userId <= 2147483647;

    if (!isValidUserId) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication session.",
      });
    }

    // Fetch the current user from the database
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
      [userId]
    );

    const user = result.rows[0];

    // Reject deleted or nonexistent users
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    // Attach authenticated user to request
    req.user = user;

    return next();

  } catch (error) {
    console.error(
      "Authentication middleware error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
}

// ==========================================
// Authorization Middleware
// ==========================================

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    // Ensure authentication happened first
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    // Check whether the user's role is allowed
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied.",
      });
    }

    return next();
  };
}

module.exports = {
  requireAuth,
  requireRole,
};
