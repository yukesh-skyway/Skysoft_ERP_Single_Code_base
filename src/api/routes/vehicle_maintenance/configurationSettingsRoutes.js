/**
 * Configuration Settings Routes
 * API endpoints for configuration_settings table
 * Skysoft Fleet Maintenance Module
 */

const express = require('express');
const router = express.Router();
const configurationSettingsService = require('../../services/vehicle_maintenance/configurationSettingsService');

/**
 * @route   GET /api/configuration-settings/:configurationId
 * @desc    Get all settings for a specific configuration
 * @access  Public
 */
router.get('/:configurationId', async (req, res) => {
  try {
    const { configurationId } = req.params;
    const result = await configurationSettingsService.getConfigurationSettings(configurationId);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('❌ Error in GET /configuration-settings/:configurationId:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * @route   POST /api/configuration-settings
 * @desc    Create a new configuration setting
 * @access  Public
 */
router.post('/', async (req, res) => {
  try {
    const settingData = req.body;
    const metadata = req.metadata || {
      userId: 1,
      userName: 'System',
      userRole: 'Admin',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    };

    const result = await configurationSettingsService.createConfigurationSetting(settingData, metadata);
    
    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('❌ Error in POST /configuration-settings:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * @route   PUT /api/configuration-settings/:id
 * @desc    Update a configuration setting
 * @access  Public
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const settingData = req.body;
    const metadata = req.metadata || {
      userId: 1,
      userName: 'System',
      userRole: 'Admin',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    };

    const result = await configurationSettingsService.updateConfigurationSetting(
      parseInt(id),
      settingData,
      metadata
    );
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('❌ Error in PUT /configuration-settings/:id:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * @route   DELETE /api/configuration-settings/:id
 * @desc    Delete a configuration setting
 * @access  Public
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const metadata = req.metadata || {
      userId: 1,
      userName: 'System',
      userRole: 'Admin',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    };

    const result = await configurationSettingsService.deleteConfigurationSetting(
      parseInt(id),
      metadata
    );
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('❌ Error in DELETE /configuration-settings/:id:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * @route   PATCH /api/configuration-settings/:id/toggle-status
 * @desc    Toggle configuration setting status
 * @access  Public
 */
router.patch('/:id/toggle-status', async (req, res) => {
  try {
    const { id } = req.params;
    const metadata = req.metadata || {
      userId: 1,
      userName: 'System',
      userRole: 'Admin',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    };

    const result = await configurationSettingsService.toggleSettingStatus(
      parseInt(id),
      metadata
    );
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('❌ Error in PATCH /configuration-settings/:id/toggle-status:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;
