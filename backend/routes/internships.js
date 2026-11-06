
const express = require("express");
const router = express.Router();
const pool = require("../db");

// ==========================================
// Validation helpers
// ==========================================

// PostgreSQL INTEGER maximum value
const MAX_ID = 2147483647;

function isValidInternshipId(value) {
  if (
    typeof value !== "string" ||
    !/^[1-9]\d*$/.test(value)
  ) {
    return false;
  }

  const id = Number(value);

  return (
    Number.isSafeInteger(id) &&
    id > 0 &&
    id <= MAX_ID
  );
}

// ==========================================
// GET all internships
// ==========================================

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        i.id,
        i.company_id,
        i.title,
        i.description,
        i.location,
        i.status,
        i.created_at,
        c.company_name
      FROM internships AS i
      JOIN companies AS c
        ON i.company_id = c.id
      ORDER BY i.id ASC
    `);

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      internships: result.rows,
    });

  } catch (error) {
    console.error(
      "Error fetching internships:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch internships.",
    });
  }
});

// ==========================================
// GET internship by ID
// ==========================================

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Validate internship ID
    if (!isValidInternshipId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid internship ID.",
      });
    }

    const internshipId = Number(id);

    const result = await pool.query(
      `
      SELECT
        i.id,
        i.company_id,
        i.title,
        i.description,
        i.location,
        i.status,
        i.created_at,
        c.company_name
      FROM internships AS i
      JOIN companies AS c
        ON i.company_id = c.id
      WHERE i.id = $1
      `,
      [internshipId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Internship not found.",
      });
    }

    return res.status(200).json({
      success: true,
      internship: result.rows[0],
    });

  } catch (error) {
    console.error(
      "Error fetching internship:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch internship.",
    });
  }
});

module.exports = router;
