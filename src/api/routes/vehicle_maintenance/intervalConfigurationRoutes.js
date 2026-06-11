/**
 * Interval Configuration Routes
 * RESTful API endpoints for scheduled_configuration_settings
 * 
 * @author Skysoft Fleet Management Team
 * @version 1.0.0
 * @date 2025-12-16
 */

const express = require('express');
const router = express.Router();
const intervalConfigService = require('../../services/vehicle_maintenance/intervalConfigurationService');
const { addMetadata } = require('../../middleware/requestMetadata');
const {
  logIntervalConfigCreated,
  logIntervalConfigUpdated,
  logIntervalConfigDeleted,
  logIntervalConfigStatusUpdate,
  logIntervalConfigBulkStatusUpdate
} = require('../../services/vehicle_maintenance/auditLogService');

/**
 * @route   GET /api/interval-configurations
 * @desc    Get all interval configuration settings with optional filtering
 * @query   status, setting_type, search, orderBy, orderDir, limit, offset
 * @access  Public
 */
router.get('/', addMetadata, async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      setting_type: req.query.setting_type,
      search: req.query.search,
      orderBy: req.query.orderBy,
      orderDir: req.query.orderDir,
      limit: req.query.limit,
      offset: req.query.offset
    };

    const settings = await intervalConfigService.getAllSettings(filters);

    res.status(200).json({
      success: true,
      data: settings,
      count: settings.length,
      metadata: req.metadata
    });
  } catch (error) {
    console.error('Error in GET /api/interval-configurations:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      metadata: req.metadata
    });
  }
});

/**
 * @route   GET /api/interval-configurations/statistics
 * @desc    Get interval configuration statistics
 * @access  Public
 */
router.get('/statistics', addMetadata, async (req, res) => {
  try {
    const statistics = await intervalConfigService.getStatistics();

    res.status(200).json({
      success: true,
      data: statistics,
      metadata: req.metadata
    });
  } catch (error) {
    console.error('Error in GET /api/interval-configurations/statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      metadata: req.metadata
    });
  }
});

/**
 * @route   GET /api/interval-configurations/name/:name
 * @desc    Get setting by name
 * @param   name - Setting name
 * @access  Public
 */
router.get('/name/:name', addMetadata, async (req, res) => {
  try {
    const name = req.params.name;

    const setting = await intervalConfigService.getSettingByName(name);

    if (!setting) {
      return res.status(404).json({
        success: false,
        error: 'Setting not found',
        metadata: req.metadata
      });
    }

    res.status(200).json({
      success: true,
      data: setting,
      metadata: req.metadata
    });
  } catch (error) {
    console.error('Error in GET /api/interval-configurations/name/:name:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      metadata: req.metadata
    });
  }
});

/**
 * @route   GET /api/interval-configurations/:id
 * @desc    Get setting by ID
 * @param   id - Setting ID
 * @access  Public
 */
router.get('/:id', addMetadata, async (req, res) => {
  try {
    const settingId = parseInt(req.params.id);

    if (isNaN(settingId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid setting ID',
        metadata: req.metadata
      });
    }

    const setting = await intervalConfigService.getSettingById(settingId);

    if (!setting) {
      return res.status(404).json({
        success: false,
        error: 'Setting not found',
        metadata: req.metadata
      });
    }

    res.status(200).json({
      success: true,
      data: setting,
      metadata: req.metadata
    });
  } catch (error) {
    console.error('Error in GET /api/interval-configurations/:id:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      metadata: req.metadata
    });
  }
});

/**
 * @route   POST /api/interval-configurations
 * @desc    Create new interval configuration setting
 * @body    { setting_name, setting_type, maintenance_type, added_by, status }
 * @access  Public
 */
router.post('/', addMetadata, async (req, res) => {
  try {
    const settingData = req.body;

    if (!settingData || Object.keys(settingData).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Request body is required',
        metadata: req.metadata
      });
    }

    const result = await intervalConfigService.createSetting(settingData);

    if (!result.success) {
      return res.status(result.statusCode || 400).json({
        success: false,
        error: result.error,
        details: result.details,
        metadata: req.metadata
      });
    }

    // Log activity
    await logIntervalConfigCreated(result.data, req.metadata);

    res.status(result.statusCode || 201).json({
      success: true,
      data: result.data,
      message: result.message,
      metadata: req.metadata
    });
  } catch (error) {
    console.error('Error in POST /api/interval-configurations:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      metadata: req.metadata
    });
  }
});

/**
 * @route   PATCH /api/interval-configurations/:id
 * @desc    Update interval configuration setting
 * @param   id - Setting ID
 * @body    { setting_name, setting_type, maintenance_type, status }
 * @access  Public
 */
router.patch('/:id', addMetadata, async (req, res) => {
  try {
    const settingId = parseInt(req.params.id);
    const updateData = req.body;

    if (isNaN(settingId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid setting ID',
        metadata: req.metadata
      });
    }

    if (!updateData || Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Request body is required',
        metadata: req.metadata
      });
    }

    // Get old data before updating
    const oldSetting = await intervalConfigService.getSettingById(settingId);

    const result = await intervalConfigService.updateSetting(settingId, updateData);

    if (!result.success) {
      return res.status(result.statusCode || 400).json({
        success: false,
        error: result.error,
        details: result.details,
        metadata: req.metadata
      });
    }

    // Log activity with old and new data
    if (oldSetting) {
      await logIntervalConfigUpdated(oldSetting, result.data, req.metadata);
    }

    res.status(result.statusCode || 200).json({
      success: true,
      data: result.data,
      message: result.message,
      metadata: req.metadata
    });
  } catch (error) {
    console.error('Error in PATCH /api/interval-configurations/:id:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      metadata: req.metadata
    });
  }
});

/**
 * @route   PATCH /api/interval-configurations/:id/status
 * @desc    Update setting status (activate/deactivate)
 * @param   id - Setting ID
 * @body    { status: 1 | 2 }
 * @access  Public
 */
router.patch('/:id/status', addMetadata, async (req, res) => {
  try {
    const settingId = parseInt(req.params.id);
    const { status } = req.body;

    if (isNaN(settingId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid setting ID',
        metadata: req.metadata
      });
    }

    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Status is required',
        metadata: req.metadata
      });
    }

    // Get old data before updating
    const oldSetting = await intervalConfigService.getSettingById(settingId);

    const result = await intervalConfigService.updateSettingStatus(settingId, status);

    if (!result.success) {
      return res.status(result.statusCode || 400).json({
        success: false,
        error: result.error,
        metadata: req.metadata
      });
    }

    // Log activity with old and new data
    if (oldSetting) {
      await logIntervalConfigStatusUpdate(oldSetting, result.data, req.metadata);
    }

    res.status(result.statusCode || 200).json({
      success: true,
      data: result.data,
      message: result.message,
      metadata: req.metadata
    });
  } catch (error) {
    console.error('Error in PATCH /api/interval-configurations/:id/status:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      metadata: req.metadata
    });
  }
});

/**
 * @route   PUT /api/interval-configurations/:id
 * @desc    Full update for setting (alias for PATCH)
 * @param   id - Setting ID
 * @body    Setting fields to update
 * @access  Public
 */
router.put('/:id', addMetadata, async (req, res) => {
  try {
    const settingId = parseInt(req.params.id);
    const updateData = req.body;

    if (isNaN(settingId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid setting ID',
        metadata: req.metadata
      });
    }

    if (!updateData || Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Request body is required',
        metadata: req.metadata
      });
    }

    // Get old data before updating
    const oldSetting = await intervalConfigService.getSettingById(settingId);

    const result = await intervalConfigService.updateSetting(settingId, updateData);

    if (!result.success) {
      return res.status(result.statusCode || 400).json({
        success: false,
        error: result.error,
        details: result.details,
        metadata: req.metadata
      });
    }

    // Log activity with old and new data
    if (oldSetting) {
      await logIntervalConfigUpdated(oldSetting, result.data, req.metadata);
    }

    res.status(result.statusCode || 200).json({
      success: true,
      data: result.data,
      message: result.message,
      metadata: req.metadata
    });
  } catch (error) {
    console.error('Error in PUT /api/interval-configurations/:id:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      metadata: req.metadata
    });
  }
});

/**
 * @route   DELETE /api/interval-configurations/:id
 * @desc    Delete interval configuration setting
 * @param   id - Setting ID
 * @access  Public
 */
router.delete('/:id', addMetadata, async (req, res) => {
  try {
    const settingId = parseInt(req.params.id);

    if (isNaN(settingId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid setting ID',
        metadata: req.metadata
      });
    }

    const result = await intervalConfigService.deleteSetting(settingId);

    if (!result.success) {
      return res.status(result.statusCode || 400).json({
        success: false,
        error: result.error,
        details: result.details,
        metadata: req.metadata
      });
    }

    // Log activity (result.data contains the deleted setting)
    await logIntervalConfigDeleted(result.data, req.metadata);

    res.status(result.statusCode || 200).json({
      success: true,
      message: result.message,
      data: result.data,
      metadata: req.metadata
    });
  } catch (error) {
    console.error('Error in DELETE /api/interval-configurations/:id:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      metadata: req.metadata
    });
  }
});

module.exports = router;
