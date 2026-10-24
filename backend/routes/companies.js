const express = require("express");
const router = express.Router();
const pool = require("../db");

// GET ALL COMPANIES
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        id,
        company_name,
        industry,
        location,
        description,
        website
       FROM companies
       ORDER BY id ASC`
    );

    res.status(200).json({
      success: true,
      count: result.rows.length,
      companies: result.rows
    });

  } catch (error) {
    console.error("Error fetching companies:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch companies"
    });
  }
});

// GET COMPANY BY ID
router.get("/:id", async (req, res) => {
  try {
    const companyId = Number(req.params.id);

    if (!Number.isSafeInteger(companyId) || companyId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid company ID"
      });
    }

    const result = await pool.query(
      `SELECT
        id,
        company_name,
        industry,
        location,
        description,
        website
       FROM companies
       WHERE id = $1`,
      [companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Company not found"
      });
    }

    res.status(200).json({
      success: true,
      company: result.rows[0]
    });

  } catch (error) {
    console.error("Error fetching company:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch company"
    });
  }
});

module.exports = router;