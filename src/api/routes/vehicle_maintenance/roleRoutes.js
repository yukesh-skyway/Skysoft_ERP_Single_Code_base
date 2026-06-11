const express = require('express');
const router = express.Router();
const pool = require('../../db/connection');

// Get all roles with user counts
router.get('/', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    try {
      // Pull from existing roles table structure
      // users.role maps to roles.id
      const [roles] = await connection.query(`
        SELECT 
          r.id,
          r.role_name,
          r.role_name as description,
          CAST(r.role_type AS UNSIGNED) as role_type,
          CAST(r.status AS UNSIGNED) as status,
          COUNT(DISTINCT u.id) as user_count
        FROM roles r
        LEFT JOIN users u ON FIND_IN_SET(r.id, u.role) > 0
        GROUP BY r.id, r.role_name, r.role_type, r.status
        ORDER BY r.role_name
      `);
      
      res.json({
        success: true,
        data: roles
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get all capabilities
router.get('/all-capabilities', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    try {
      // Get all capabilities from capabilities table
      const [capabilities] = await connection.query(`
        SELECT 
          id,
          capability,
          module
        FROM capabilities
        ORDER BY module, capability
      `);
      
      res.json({
        success: true,
        data: capabilities
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error fetching capabilities:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
