
const express = require("express");
const router = express.Router();
const pool = require("../db");

// ==========================================
// Validation helpers
// ==========================================

// Maximum value for PostgreSQL INTEGER
const MAX_ID = 2147483647;

function isValidCompanyId(value) {
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
// GET ALL COMPANIES
// ==========================================

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        id,
        company_name,
        industry,
        location,
        description,
        website
      FROM companies
      ORDER BY id ASC
      `
    );

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      companies: result.rows,
    });

  } catch (error) {
    console.error(
      "Error fetching companies:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch companies.",
    });
  }
});

// ==========================================
// GET COMPANY BY ID
// ==========================================

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Validate company ID
    if (!isValidCompanyId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid company ID.",
      });
    }

    const companyId = Number(id);

    const result = await pool.query(
      `
      SELECT
        id,
        company_name,
        industry,
        location,
        description,
        website
      FROM companies
      WHERE id = $1
      `,
      [companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Company not found.",
      });
    }

    return res.status(200).json({
      success: true,
      company: result.rows[0],
    });

  } catch (error) {
    console.error(
      "Error fetching company:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch company.",
    });
  }
});

module.exports = router;
