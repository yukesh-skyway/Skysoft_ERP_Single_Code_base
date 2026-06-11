/**
 * Vehicle Routes - Simplified for Updates Only
 * RESTful API endpoints for vehicle status and kilometer updates
 * Works with existing table structure (14 fields)
 * 
 * @author Skysoft Fleet Management Team
 * @version 1.0.0
 * @date 2025-12-16
 */

const express = require('express');
const router = express.Router();
const vehicleService = require('../../services/vehicle_maintenance/vehicleService');
const MotiveService = require('../../services/vehicle_maintenance/motiveService');
const { addMetadata } = require('../../middleware/requestMetadata');

/**
 * @route   GET /api/vehicles
 * @desc    Get all vehicles with optional filtering
 * @query   status, vehicle_type, has_wheelchair, vehicle_configuration, search, orderBy, orderDir, limit, offset
 * @access  Public
 */
router.get('/', addMetadata, async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      vehicle_type: req.query.vehicle_type,
      has_wheelchair: req.query.has_wheelchair,
      vehicle_configuration: req.query.vehicle_configuration,
      search: req.query.search,
      orderBy: req.query.orderBy,
      orderDir: req.query.orderDir,
      limit: req.query.limit,
      offset: req.query.offset
    };

    const vehicles = await vehicleService.getAllVehicles(filters);

    res.status(200).json({
      success: true,
      data: vehicles,
      count: vehicles.length,
      metadata: req.metadata
    });
  } catch (error) {
    console.error('Error in GET /api/vehicles:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      metadata: req.metadata
    });
  }
});

/**
 * @route   GET /api/vehicles/statistics
 * @desc    Get vehicle statistics
 * @access  Public
 */
router.get('/statistics', addMetadata, async (req, res) => {
  try {
    const statistics = await vehicleService.getVehicleStatistics();

    res.status(200).json({
      success: true,
      data: statistics,
      metadata: req.metadata
    });
  } catch (error) {
    console.error('Error in GET /api/vehicles/statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      metadata: req.metadata
    });
  }
});

/**
 * @route   GET /api/vehicles/nickname/:nickname
 * @desc    Get vehicle by nickname
 * @param   nickname - Vehicle nickname (e.g., "9608")
 * @access  Public
 */
router.get('/nickname/:nickname', addMetadata, async (req, res) => {
  try {
    const nickname = req.params.nickname;

    const vehicle = await vehicleService.getVehicleByNickname(nickname);

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle not found',
        metadata: req.metadata
      });
    }

    res.status(200).json({
      success: true,
      data: vehicle,
      metadata: req.metadata
    });
  } catch (error) {
    console.error('Error in GET /api/vehicles/nickname/:nickname:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      metadata: req.metadata
    });
  }
});

/**
 * @route   GET /api/vehicles/:id/current-km
 * @desc    Get current kilometer reading from Motive API
 * @param   id - Vehicle ID
 * @access  Public
 */
router.get('/:id/current-km', addMetadata, async (req, res) => {
  try {
    const vehicleId = parseInt(req.params.id);

    if (isNaN(vehicleId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid vehicle ID',
        metadata: req.metadata
      });
    }

    // Get vehicle from database
    const vehicle = await vehicleService.getVehicleById(vehicleId);

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle not found',
        metadata: req.metadata
      });
    }

    // Initialize Motive service
    const motiveService = new MotiveService();

    // Determine unit number from vehicle data
    // Use vehicle_nickname as PRIMARY identifier (matches Motive's vehicle number)
    const unitNumber = vehicle.vehicle_nickname || vehicle.vehicle_number || vehicle.asset_id;

    if (!unitNumber) {
      return res.status(400).json({
        success: false,
        error: 'Vehicle unit number not found',
        message: 'Cannot fetch odometer without a unit number',
        kilometers: 0,
        metadata: req.metadata
      });
    }

    // Fetch current odometer from Motive API
    const result = await motiveService.getVehicleOdometerByUnit(unitNumber);

    if (!result.success) {
      return res.status(200).json({
        success: false,
        message: result.message || 'Unable to fetch odometer from Motive',
        kilometers: 0,
        metadata: req.metadata
      });
    }

    res.status(200).json({
      success: true,
      kilometers: result.kilometers,
      source: result.source,
      vehicle: {
        id: vehicle.id,
        nickname: vehicle.vehicle_nickname,
        unit_number: unitNumber
      },
      metadata: req.metadata
    });

  } catch (error) {
    console.error('Error in GET /api/vehicles/:id/current-km:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      kilometers: 0,
      metadata: req.metadata
    });
  }
});

/**
 * @route   POST /api/vehicles/:id/sync-km
 * @desc    Sync current kilometer reading from Motive API and update database
 * @param   id - Vehicle ID
 * @access  Public
 * @requirements Vehicle must be active (status = 1)
 */
router.post('/:id/sync-km', addMetadata, async (req, res) => {
  try {
    const vehicleId = parseInt(req.params.id);

    if (isNaN(vehicleId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid vehicle ID',
        metadata: req.metadata
      });
    }

    // Get vehicle from database
    const vehicle = await vehicleService.getVehicleById(vehicleId);

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle not found',
        metadata: req.metadata
      });
    }

    // Check if vehicle is active (status = 1)
    if (vehicle.status !== 1) {
      return res.status(400).json({
        success: false,
        error: 'Vehicle must be active to sync kilometers',
        message: 'Only active vehicles can sync odometer data from Motive',
        vehicleStatus: vehicle.status,
        metadata: req.metadata
      });
    }

    // Initialize Motive service
    const motiveService = new MotiveService();

    // Determine unit number from vehicle data
    // Use vehicle_nickname as PRIMARY identifier (matches Motive's vehicle number)
    const unitNumber = vehicle.vehicle_nickname || vehicle.vehicle_number || vehicle.asset_id;

    if (!unitNumber) {
      return res.status(400).json({
        success: false,
        error: 'Vehicle unit number not found',
        message: 'Cannot fetch odometer without a unit number',
        metadata: req.metadata
      });
    }

    // Fetch current odometer from Motive API
    const result = await motiveService.getVehicleOdometerByUnit(unitNumber);

    if (!result.success) {
      return res.status(200).json({
        success: false,
        error: 'Failed to fetch odometer from Motive',
        message: result.message || 'Unable to fetch odometer from Motive',
        metadata: req.metadata
      });
    }

    // Update current_km in database
    const updateResult = await vehicleService.updateVehicleKilometers(vehicleId, {
      current_km: result.kilometers
    }, req.metadata);

    if (!updateResult.success) {
      return res.status(400).json({
        success: false,
        error: updateResult.error || 'Failed to update kilometers',
        metadata: req.metadata
      });
    }

    res.status(200).json({
      success: true,
      message: 'Kilometers synced successfully',
      data: {
        vehicle_id: vehicleId,
        nickname: vehicle.vehicle_nickname,
        unit_number: unitNumber,
        previous_km: vehicle.current_km,
        new_km: result.kilometers,
        source: result.source,
        updated_at: new Date().toISOString()
      },
      metadata: req.metadata
    });

  } catch (error) {
    console.error('Error in POST /api/vehicles/:id/sync-km:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      metadata: req.metadata
    });
  }
});

/**
 * @route   GET /api/vehicles/:id
 * @desc    Get vehicle by ID
 * @param   id - Vehicle ID
 * @access  Public
 */
router.get('/:id', addMetadata, async (req, res) => {
  try {
    const vehicleId = parseInt(req.params.id);

    if (isNaN(vehicleId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid vehicle ID',
        metadata: req.metadata
      });
    }

    const vehicle = await vehicleService.getVehicleById(vehicleId);

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle not found',
        metadata: req.metadata
      });
    }

    res.status(200).json({
      success: true,
      data: vehicle,
      metadata: req.metadata
    });
  } catch (error) {
    console.error('Error in GET /api/vehicles/:id:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      metadata: req.metadata
    });
  }
});

/**
 * @route   PATCH /api/vehicles/:id/status
 * @desc    Update vehicle status and comments
 * @param   id - Vehicle ID
 * @body    { status: 1|0|-1, vehicle_comments: "notes" }
 * @access  Public
 */
router.patch('/:id/status', addMetadata, async (req, res) => {
  try {
    const vehicleId = parseInt(req.params.id);
    const updateData = req.body;

    if (isNaN(vehicleId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid vehicle ID',
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

    const result = await vehicleService.updateVehicleStatus(vehicleId, updateData, req.metadata);

    if (!result.success) {
      return res.status(result.statusCode || 400).json({
        success: false,
        error: result.error,
        metadata: req.metadata
      });
    }

    res.status(result.statusCode || 200).json({
      success: true,
      data: result.data,
      message: result.message,
      metadata: req.metadata
    });
  } catch (error) {
    console.error('Error in PATCH /api/vehicles/:id/status:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      metadata: req.metadata
    });
  }
});

/**
 * @route   PATCH /api/vehicles/:id/kilometers
 * @desc    Update vehicle kilometer reading
 * @param   id - Vehicle ID
 * @body    { current_km: 125000, km_sync_status: "synced", km_notes: "optional notes" }
 * @access  Public
 */
router.patch('/:id/kilometers', addMetadata, async (req, res) => {
  try {
    const vehicleId = parseInt(req.params.id);
    const kmData = req.body;

    if (isNaN(vehicleId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid vehicle ID',
        metadata: req.metadata
      });
    }

    if (!kmData || (!kmData.current_km && !kmData.km_sync_status)) {
      return res.status(400).json({
        success: false,
        error: 'Either current_km or km_sync_status is required',
        metadata: req.metadata
      });
    }

    // Pass metadata to service layer for logging
    const result = await vehicleService.updateVehicleKilometers(
      vehicleId, 
      kmData, 
      req.metadata
    );

    if (!result.success) {
      return res.status(result.statusCode || 400).json({
        success: false,
        error: result.error,
        metadata: req.metadata
      });
    }

    res.status(result.statusCode || 200).json({
      success: true,
      data: result.data,
      message: result.message,
      metadata: req.metadata
    });
  } catch (error) {
    console.error('Error in PATCH /api/vehicles/:id/kilometers:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      metadata: req.metadata
    });
  }
});

/**
 * @route   PATCH /api/vehicles/:id
 * @desc    General update for any vehicle field (existing fields only)
 * @param   id - Vehicle ID
 * @body    Any existing vehicle fields
 * @access  Public
 */
router.patch('/:id', addMetadata, async (req, res) => {
  try {
    const vehicleId = parseInt(req.params.id);
    const updateData = req.body;

    if (isNaN(vehicleId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid vehicle ID',
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

    const result = await vehicleService.updateVehicle(vehicleId, updateData);

    if (!result.success) {
      return res.status(result.statusCode || 400).json({
        success: false,
        error: result.error,
        details: result.details,
        metadata: req.metadata
      });
    }

    res.status(result.statusCode || 200).json({
      success: true,
      data: result.data,
      message: result.message,
      metadata: req.metadata
    });
  } catch (error) {
    console.error('Error in PATCH /api/vehicles/:id:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      metadata: req.metadata
    });
  }
});

/**
 * @route   PUT /api/vehicles/:id
 * @desc    Full update for vehicle (alias for PATCH)
 * @param   id - Vehicle ID
 * @body    Vehicle fields to update
 * @access  Public
 */
router.put('/:id', addMetadata, async (req, res) => {
  try {
    const vehicleId = parseInt(req.params.id);
    const updateData = req.body;

    if (isNaN(vehicleId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid vehicle ID',
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

    const result = await vehicleService.updateVehicle(vehicleId, updateData);

    if (!result.success) {
      return res.status(result.statusCode || 400).json({
        success: false,
        error: result.error,
        details: result.details,
        metadata: req.metadata
      });
    }

    res.status(result.statusCode || 200).json({
      success: true,
      data: result.data,
      message: result.message,
      metadata: req.metadata
    });
  } catch (error) {
    console.error('Error in PUT /api/vehicles/:id:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      metadata: req.metadata
    });
  }
});

module.exports = router;
