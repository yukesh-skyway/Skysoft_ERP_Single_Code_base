/**
 * Matrix View Routes
 * API endpoints for Vehicle Maintenance Matrix View management
 * Organization-level custom views
 * Skysoft Fleet Maintenance Module
 */

const express = require('express');
const router = express.Router();
const matrixViewService = require('../../services/vehicle_maintenance/matrixViewService');

/**
 * @route   GET /api/maintenance-matrix-views
 * @desc    Get all organization matrix views
 * @access  Authenticated
 */
router.get('/', async (req, res) => {
  try {
    console.log('📊 Fetching all matrix views...');
    
    const result = await matrixViewService.getAllMatrixViews();

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }

    console.log(`✅ Found ${result.count} matrix views`);

    return res.status(200).json({
      success: true,
      data: result.data,
      count: result.count
    });
  } catch (error) {
    console.error('❌ Error in GET /api/maintenance-matrix-views:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/maintenance-matrix-views/default
 * @desc    Get the default matrix view
 * @access  Authenticated
 */
router.get('/default', async (req, res) => {
  try {
    console.log('📊 Fetching default matrix view...');
    
    const result = await matrixViewService.getDefaultMatrixView();

    if (!result.success) {
      return res.status(404).json({
        success: false,
        error: result.error
      });
    }

    console.log(`✅ Found default view: ${result.data.config.viewName}`);

    return res.status(200).json({
      success: true,
      data: result.data
    });
  } catch (error) {
    console.error('❌ Error in GET /api/maintenance-matrix-views/default:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/maintenance-matrix-views/:name
 * @desc    Get a specific matrix view by name
 * @access  Authenticated
 */
router.get('/:name', async (req, res) => {
  try {
    const { name } = req.params;
    console.log(`📊 Fetching matrix view: ${name}`);
    
    const result = await matrixViewService.getMatrixViewByName(name);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        error: result.error
      });
    }

    console.log(`✅ Found view: ${result.data.config.viewName}`);

    return res.status(200).json({
      success: true,
      data: result.data
    });
  } catch (error) {
    console.error(`❌ Error in GET /api/maintenance-matrix-views/:name:`, error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/maintenance-matrix-views
 * @desc    Create a new matrix view
 * @access  Authenticated
 * @body    { viewName, vehicleOrder, columnOrder, filters, description, setAsDefault }
 */
router.post('/', async (req, res) => {
  try {
    const viewData = req.body;
    console.log(`💾 Creating new matrix view: ${viewData.viewName}`);
    
    const result = await matrixViewService.createMatrixView(viewData);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    console.log(`✅ Matrix view created: ${result.data.name}`);

    return res.status(201).json({
      success: true,
      message: result.message,
      data: result.data
    });
  } catch (error) {
    console.error('❌ Error in POST /api/maintenance-matrix-views:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * @route   PUT /api/maintenance-matrix-views/:name
 * @desc    Update an existing matrix view
 * @access  Authenticated
 * @body    { viewName, vehicleOrder, columnOrder, filters, description, setAsDefault }
 */
router.put('/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const viewData = req.body;
    console.log(`📝 Updating matrix view: ${name}`);
    
    const result = await matrixViewService.updateMatrixView(name, viewData);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        error: result.error
      });
    }

    console.log(`✅ Matrix view updated: ${name}`);

    return res.status(200).json({
      success: true,
      message: result.message,
      data: result.data
    });
  } catch (error) {
    console.error(`❌ Error in PUT /api/maintenance-matrix-views/:name:`, error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * @route   DELETE /api/maintenance-matrix-views/:name
 * @desc    Delete a matrix view (soft delete)
 * @access  Authenticated
 */
router.delete('/:name', async (req, res) => {
  try {
    const { name } = req.params;
    console.log(`🗑️  Deleting matrix view: ${name}`);
    
    const result = await matrixViewService.deleteMatrixView(name);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        error: result.error
      });
    }

    console.log(`✅ Matrix view deleted: ${name}`);

    return res.status(200).json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error(`❌ Error in DELETE /api/maintenance-matrix-views/:name:`, error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/maintenance-matrix-views/:name/set-default
 * @desc    Set a matrix view as the organization default
 * @access  Authenticated
 */
router.post('/:name/set-default', async (req, res) => {
  try {
    const { name } = req.params;
    console.log(`⭐ Setting default matrix view: ${name}`);
    
    const result = await matrixViewService.setDefaultMatrixView(name);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        error: result.error
      });
    }

    console.log(`✅ Default view set: ${name}`);

    return res.status(200).json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error(`❌ Error in POST /api/maintenance-matrix-views/:name/set-default:`, error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

module.exports = router;
