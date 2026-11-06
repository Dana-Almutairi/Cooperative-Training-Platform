
const express = require("express");
const pool = require("../db");

const {
  requireAuth,
  requireRole,
} = require("../middleware/authMiddleware");

const router = express.Router();

// ==========================================
// Validation helpers
// ==========================================

const MAX_ID = 2147483647;

function isValidId(value) {
  return (
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= MAX_ID
  );
}

function isValidIdParam(value) {
  if (
    typeof value !== "string" ||
    !/^[1-9]\d*$/.test(value)
  ) {
    return false;
  }

  return isValidId(Number(value));
}

const ALLOWED_STATUSES = [
  "accepted",
  "rejected",
  "completed",
];

// ==========================================
// GET: Student's own applications
// ==========================================

router.get(
  "/my",
  requireAuth,
  requireRole("student"),
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        SELECT
          a.id,
          a.student_id,
          a.internship_id,
          a.status,
          a.applied_at,
          i.title AS internship_title,
          i.location AS internship_location,
          i.status AS internship_status,
          c.id AS company_id,
          c.company_name
        FROM applications a
        JOIN internships i
          ON a.internship_id = i.id
        JOIN companies c
          ON i.company_id = c.id
        WHERE a.student_id = $1
        ORDER BY
          a.applied_at DESC,
          a.id DESC
        `,
        [req.user.id]
      );

      return res.status(200).json({
        success: true,
        count: result.rows.length,
        applications: result.rows,
      });
    } catch (error) {
      console.error(
        "Get student applications error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Failed to fetch applications.",
      });
    }
  }
);

// ==========================================
// GET: Company's internship applications
// ==========================================

router.get(
  "/company",
  requireAuth,
  requireRole("company"),
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        SELECT
          a.id,
          a.student_id,
          a.internship_id,
          a.status,
          a.applied_at,
          u.full_name AS student_name,
          i.title AS internship_title,
          c.company_name
        FROM applications a
        JOIN users u
          ON a.student_id = u.id
        JOIN internships i
          ON a.internship_id = i.id
        JOIN companies c
          ON i.company_id = c.id
        WHERE c.user_id = $1
        ORDER BY
          a.applied_at DESC,
          a.id DESC
        `,
        [req.user.id]
      );

      return res.status(200).json({
        success: true,
        count: result.rows.length,
        applications: result.rows,
      });
    } catch (error) {
      console.error(
        "Get company applications error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to fetch company applications.",
      });
    }
  }
);

// ==========================================
// POST: Student applies for an internship
// ==========================================

router.post(
  "/",
  requireAuth,
  requireRole("student"),
  async (req, res) => {
    try {
      const { internship_id } = req.body ?? {};

      // Validate internship ID
      if (!isValidId(internship_id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid internship ID.",
        });
      }

      const result = await pool.query(
        `
        INSERT INTO applications
          (student_id, internship_id, status)
        SELECT $1, i.id, 'pending'
        FROM internships i
        WHERE i.id = $2
          AND i.status = 'open'
        ON CONFLICT (student_id, internship_id)
        DO NOTHING
        RETURNING
          id,
          student_id,
          internship_id,
          status,
          applied_at
        `,
        [req.user.id, internship_id]
      );

      if (result.rows.length > 0) {
        return res.status(201).json({
          success: true,
          message:
            "Application submitted successfully.",
          application: result.rows[0],
        });
      }

      const internshipResult = await pool.query(
        `
        SELECT status
        FROM internships
        WHERE id = $1
        `,
        [internship_id]
      );

      if (internshipResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Internship not found.",
        });
      }

      if (
        internshipResult.rows[0].status !== "open"
      ) {
        return res.status(409).json({
          success: false,
          message: "This internship is closed.",
        });
      }

      return res.status(409).json({
        success: false,
        message:
          "You have already applied for this internship.",
      });
    } catch (error) {
      console.error(
        "Apply for internship error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Internal server error.",
      });
    }
  }
);

// ==========================================
// PATCH: Company updates application status
// ==========================================

router.patch(
  "/:id/status",
  requireAuth,
  requireRole("company"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body ?? {};

      // Validate application ID
      if (!isValidIdParam(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid application ID.",
        });
      }

      const applicationId = Number(id);

      // Validate requested status
      if (!ALLOWED_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message:
            "Status must be accepted, rejected, or completed.",
        });
      }

      // Allowed transitions:
      // pending -> accepted
      // pending -> rejected
      // accepted -> completed
      //
      // Only the owning company can update.
      // The current status is checked inside
      // the UPDATE to prevent invalid transitions.

      const result = await pool.query(
        `
        UPDATE applications AS a
        SET status = $1
        FROM internships AS i
        JOIN companies AS c
          ON i.company_id = c.id
        WHERE a.id = $2
          AND a.internship_id = i.id
          AND c.user_id = $3
          AND (
            (
              a.status = 'pending'
              AND $1 IN ('accepted', 'rejected')
            )
            OR
            (
              a.status = 'accepted'
              AND $1 = 'completed'
            )
          )
        RETURNING
          a.id,
          a.student_id,
          a.internship_id,
          a.status,
          a.applied_at
        `,
        [status, applicationId, req.user.id]
      );

      if (result.rows.length > 0) {
        const messages = {
          accepted:
            "Application accepted successfully.",
          rejected:
            "Application rejected successfully.",
          completed:
            "Training marked as completed successfully.",
        };

        return res.status(200).json({
          success: true,
          message: messages[status],
          application: result.rows[0],
        });
      }

      // Check ownership and current status
      const checkResult = await pool.query(
        `
        SELECT a.status
        FROM applications a
        JOIN internships i
          ON a.internship_id = i.id
        JOIN companies c
          ON i.company_id = c.id
        WHERE a.id = $1
          AND c.user_id = $2
        `,
        [applicationId, req.user.id]
      );

      if (checkResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Application not found.",
        });
      }

      return res.status(409).json({
        success: false,
        message:
          "Invalid application status transition.",
        currentStatus: checkResult.rows[0].status,
      });
    } catch (error) {
      console.error(
        "Update application status error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to update application status.",
      });
    }
  }
);

module.exports = router;
