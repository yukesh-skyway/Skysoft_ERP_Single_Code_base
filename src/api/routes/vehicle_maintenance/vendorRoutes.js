/**
 * Vendor Routes
 * Handles all endpoints related to vendors
 */

const express = require('express');
const router = express.Router();
const vendorService = require('../../services/vehicle_maintenance/vendorService');

/**
 * GET /api/vendors
 * Get all vendors with optional filters
 */
router.get('/', async (req, res) => {
  try {
    const { status, key } = req.query;
    const result = await vendorService.getAllVendors({ status, key });

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error fetching vendors:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch vendors',
      message: error.message
    });
  }
});

/**
 * GET /api/vendors/:id
 * Get a specific vendor by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await vendorService.getVendorById(id);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Vendor not found'
      });
    }

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error fetching vendor:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch vendor',
      message: error.message
    });
  }
});

/**
 * POST /api/vendors
 * Create a new vendor
 */
router.post('/', async (req, res) => {
  try {
    const vendorData = req.body;
    const metadata = req.metadata || {};
    const result = await vendorService.createVendor(vendorData, metadata);

    res.status(201).json({
      success: true,
      data: result,
      message: 'Vendor created successfully'
    });
  } catch (error) {
    console.error('Error creating vendor:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create vendor',
      message: error.message
    });
  }
});

/**
 * PUT /api/vendors/:id
 * Update an existing vendor
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const vendorData = req.body;
    const metadata = req.metadata || {};
    const result = await vendorService.updateVendor(id, vendorData, metadata);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Vendor not found'
      });
    }

    res.status(200).json({
      success: true,
      data: result,
      message: 'Vendor updated successfully'
    });
  } catch (error) {
    console.error('Error updating vendor:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update vendor',
      message: error.message
    });
  }
});

/**
 * DELETE /api/vendors/:id
 * Delete a vendor (soft delete - sets status to 0)
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const metadata = req.metadata || {};
    const result = await vendorService.deleteVendor(id, metadata);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Vendor not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Vendor deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting vendor:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete vendor',
      message: error.message
    });
  }
});

module.exports = router;
