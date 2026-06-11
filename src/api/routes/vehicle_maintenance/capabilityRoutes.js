const express = require('express');
const router = express.Router();
const capabilityService = require('../../services/vehicle_maintenance/capabilityService');

// Get user's capabilities
router.get('/user', async (req, res) => {
  try {
    const userId = req.user?.id; 
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const capabilities = await capabilityService.getUserCapabilities(userId);
    const userInfo = await capabilityService.getUserRoleInfo(userId);
    
    res.json({
      success: true,
      capabilities,
      isAdmin: userInfo.isAdmin,
      userRoles: userInfo.userRoles
    });
  } catch (error) {
    console.error('Error fetching user capabilities:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get capabilities for a specific role
router.get('/role/:roleId', async (req, res) => {
  try {
    const { roleId } = req.params;
    
    const capabilities = await capabilityService.getRoleCapabilities(roleId);
    
    res.json({
      success: true,
      capabilities
    });
  } catch (error) {
    console.error('Error fetching role capabilities:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update capabilities for a role
router.put('/role/:roleId', async (req, res) => {
  try {
    const { roleId } = req.params;
    const { capabilities } = req.body;
    
    await capabilityService.updateRoleCapabilities(roleId, capabilities);
    
    res.json({
      success: true,
      message: 'Capabilities updated successfully'
    });
  } catch (error) {
    console.error('Error updating role capabilities:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
