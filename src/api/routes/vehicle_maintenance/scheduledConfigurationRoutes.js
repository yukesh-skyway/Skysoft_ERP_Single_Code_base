/**
 * Scheduled Configuration Routes
 * API endpoints for scheduled_configurations table management
 * Skysoft Fleet Maintenance Module
 */

const express = require('express');
const router = express.Router();
const scheduledConfigService = require('../../services/vehicle_maintenance/scheduledConfigurationService');
const { addMetadata } = require('../../middleware/requestMetadata');

/**
 * IMPORTANT: Specific routes must come before parameterized routes
 * Otherwise /bulk-delete will be caught by /:id
 */

/**
 * @route   POST /api/scheduled-configurations/bulk-delete
 * @desc    Bulk delete configurations
 * @body    { ids: [1, 2, 3] }
 * @access  Public
 */
router.post('/bulk-delete', async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'IDs array is required'
      });
    }

    const result = await scheduledConfigService.bulkDeleteConfigurations(ids, req.metadata);

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('❌ Error in POST /api/scheduled-configurations/bulk-delete:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete configurations',
      details: error.message
    });
  }
});

/**
 * @route   POST /api/scheduled-configurations/bulk-update-status
 * @desc    Bulk update configuration status
 * @body    { ids: [1, 2, 3], status: 1 }
 * @access  Public
 */
router.post('/bulk-update-status', async (req, res) => {
  try {
    const { ids, status } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'IDs array is required'
      });
    }

    if (![1, 2].includes(parseInt(status))) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status value. Must be 1 (Active) or 2 (Inactive)'
      });
    }

    const result = await scheduledConfigService.bulkUpdateStatus(ids, parseInt(status), req.metadata);

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('❌ Error in POST /api/scheduled-configurations/bulk-update-status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update configurations',
      details: error.message
    });
  }
});

/**
 * @route   GET /api/scheduled-configurations
 * @desc    Get all scheduled configurations with optional filters
 * @query   status - Filter by status (1=Active, 2=Inactive)
 * @query   search - Search by configuration name
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    console.log('📋 Fetching configurations with filters:', req.query);
    
    const filters = {};

    if (req.query.status) {
      filters.status = parseInt(req.query.status);
    }

    if (req.query.search) {
      filters.search = req.query.search;
    }

    // Check if we need to include settings
    if (req.query.include_settings === 'true') {
      const result = await scheduledConfigService.getAllConfigurationsWithSettings(filters);
      console.log('✅ Fetch with settings result:', { success: result.success, count: result.count || 0 });
      
      if (result.success) {
        res.status(200).json(result);
      } else {
        console.error('❌ Fetch failed:', result.error);
        res.status(500).json(result);
      }
      return;
    }

    const result = await scheduledConfigService.getAllConfigurations(filters);

    console.log('✅ Fetch result:', { success: result.success, count: result.count || 0 });

    if (result.success) {
      res.status(200).json(result);
    } else {
      console.error('❌ Fetch failed:', result.error);
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('❌ Error in GET /api/scheduled-configurations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch configurations',
      details: error.message
    });
  }
});

/**
 * @route   POST /api/scheduled-configurations
 * @desc    Create a new scheduled configuration
 * @body    { configuration_name, status }
 * @access  Public
 */
router.post('/', async (req, res) => {
  try {
    const { configuration_name, status } = req.body;

    console.log('📝 Creating configuration:', { configuration_name, status });

    if (!configuration_name || configuration_name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Configuration name is required'
      });
    }

    const result = await scheduledConfigService.createConfiguration({
      configuration_name: configuration_name.trim(),
      status: status || 1
    }, req.metadata);

    console.log('✅ Create result:', result);

    if (result.success) {
      res.status(201).json(result);
    } else {
      console.error('❌ Create failed:', result.error);
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('❌ Error in POST /api/scheduled-configurations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create configuration',
      details: error.message
    });
  }
});

/**
 * @route   POST /api/scheduled-configurations/:id/duplicate
 * @desc    Duplicate a scheduled configuration
 * @param   id - Configuration ID
 * @body    { new_name } (optional)
 * @access  Public
 */
router.post('/:id/duplicate', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid configuration ID'
      });
    }

    const { new_name } = req.body;

    const result = await scheduledConfigService.duplicateConfiguration(
      id,
      new_name || null,
      req.metadata
    );

    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('❌ Error in POST /api/scheduled-configurations/:id/duplicate:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to duplicate configuration',
      details: error.message
    });
  }
});

/**
 * @route   PATCH /api/scheduled-configurations/:id/toggle-status
 * @desc    Toggle configuration status (active/inactive)
 * @param   id - Configuration ID
 * @access  Public
 */
router.patch('/:id/toggle-status', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid configuration ID'
      });
    }

    const result = await scheduledConfigService.toggleConfigurationStatus(id, req.metadata);

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('❌ Error in PATCH /api/scheduled-configurations/:id/toggle-status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle status',
      details: error.message
    });
  }
});

/**
 * @route   GET /api/scheduled-configurations/:id
 * @desc    Get a single scheduled configuration by ID
 * @param   id - Configuration ID
 * @access  Public
 */
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid configuration ID'
      });
    }

    const result = await scheduledConfigService.getConfigurationById(id);

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('❌ Error in GET /api/scheduled-configurations/:id:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch configuration',
      details: error.message
    });
  }
});

/**
 * @route   PUT /api/scheduled-configurations/:id
 * @desc    Update a scheduled configuration
 * @param   id - Configuration ID
 * @body    { configuration_name, status }
 * @access  Public
 */
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid configuration ID'
      });
    }

    const { configuration_name, status } = req.body;

    const updates = {};
    if (configuration_name !== undefined) {
      updates.configuration_name = configuration_name.trim();
    }
    if (status !== undefined) {
      updates.status = parseInt(status);
    }

    const result = await scheduledConfigService.updateConfiguration(id, updates, req.metadata);

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('❌ Error in PUT /api/scheduled-configurations/:id:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update configuration',
      details: error.message
    });
  }
});

/**
 * @route   DELETE /api/scheduled-configurations/:id
 * @desc    Delete a scheduled configuration
 * @param   id - Configuration ID
 * @access  Public
 */
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid configuration ID'
      });
    }

    const result = await scheduledConfigService.deleteConfiguration(id, req.metadata);

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('❌ Error in DELETE /api/scheduled-configurations/:id:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete configuration',
      details: error.message
    });
  }
});

module.exports = router;
