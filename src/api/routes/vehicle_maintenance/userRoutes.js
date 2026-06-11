/**
 * User Routes
 * Handles all endpoints related to users
 */

const express = require('express');
const router = express.Router();
const userService = require('../../services/vehicle_maintenance/userService');

/**
 * GET /api/users
 * Get all users with optional filters
 */
router.get('/', async (req, res) => {
  try {
    const { role, status } = req.query;
    
    const users = await userService.getUsers({ role, status });
    
    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Route error in GET /api/users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message
    });
  }
});

/**
 * GET /api/users/:id
 * Get a single user by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    const user = await userService.getUserById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Route error in GET /api/users/:id:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user',
      error: error.message
    });
  }
});

module.exports = router;
