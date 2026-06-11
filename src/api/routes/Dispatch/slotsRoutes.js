'use strict';

const express = require('express');
const router  = express.Router();
const service = require('../../services/Dispatch/slotsService');
const { addMetadata } = require('../../middleware/requestMetadata');

// ─── GET /api/dispatch/slots ──────────────────────────────────────────────────
// All active slots with vehicle type / collection names
router.get('/', async (req, res) => {
  try {
    const slots = await service.getAllSlots();
    res.json({ success: true, data: slots });
  } catch (err) {
    console.error('[slots] GET /:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch slots' });
  }
});

// ─── GET /api/dispatch/slots/vehicle-types ────────────────────────────────────
// Dropdown data for slot creation form
router.get('/vehicle-types', async (req, res) => {
  try {
    const types = await service.getVehicleTypes();
    res.json({ success: true, data: types });
  } catch (err) {
    console.error('[slots] GET /vehicle-types:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch vehicle types' });
  }
});

// ─── GET /api/dispatch/slots/bookings?start=YYYY-MM-DD&end=YYYY-MM-DD ─────────
// Slots + their bookings for a date range — used by the Dispatch Chart
router.get('/bookings', async (req, res) => {
  try {
    const { start, end } = req.query;

    if (!start || !end) {
      return res.status(400).json({
        success: false,
        message: 'start and end query params are required (YYYY-MM-DD)',
      });
    }

    // Basic date validation
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(start) || !dateRegex.test(end)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format — use YYYY-MM-DD',
      });
    }

    const data = await service.getSlotsWithBookings(start, end);
    res.json({ success: true, data });
  } catch (err) {
    console.error('[slots] GET /bookings:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch slot bookings' });
  }
});

// ─── GET /api/dispatch/slots/:id ──────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const slot = await service.getSlotById(req.params.id);
    if (!slot) {
      return res.status(404).json({ success: false, message: 'Slot not found' });
    }
    res.json({ success: true, data: slot });
  } catch (err) {
    console.error('[slots] GET /:id:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch slot' });
  }
});

// ─── GET /api/dispatch/slots/:id/configuration ────────────────────────────────
router.get('/:id/configuration', async (req, res) => {
  try {
    const config = await service.getSlotConfiguration(req.params.id);
    res.json({ success: true, data: config });
  } catch (err) {
    console.error('[slots] GET /:id/configuration:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch slot configuration' });
  }
});

// ─── POST /api/dispatch/slots ─────────────────────────────────────────────────
router.post('/', addMetadata, async (req, res) => {
  try {
    const { slot_name, slot_type } = req.body;

    if (!slot_name || !slot_type) {
      return res.status(400).json({
        success: false,
        message: 'slot_name and slot_type are required',
      });
    }

    if (!['INTERNAL', 'OUTSOURCE'].includes(slot_type)) {
      return res.status(400).json({
        success: false,
        message: 'slot_type must be INTERNAL or OUTSOURCE',
      });
    }

    const slot = await service.createSlot(req.body);
    res.status(201).json({ success: true, data: slot });
  } catch (err) {
    console.error('[slots] POST /:', err);
    res.status(500).json({ success: false, message: 'Failed to create slot' });
  }
});

// ─── PATCH /api/dispatch/slots/:id ────────────────────────────────────────────
router.patch('/:id', addMetadata, async (req, res) => {
  try {
    const slot = await service.getSlotById(req.params.id);
    if (!slot) {
      return res.status(404).json({ success: false, message: 'Slot not found' });
    }

    const updated = await service.updateSlot(req.params.id, {
      ...req.body,
      updated_by: req.metadata?.userId ?? null,
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('[slots] PATCH /:id:', err);
    res.status(500).json({ success: false, message: 'Failed to update slot' });
  }
});

// ─── DELETE /api/dispatch/slots/:id ───────────────────────────────────────────
// Soft delete — sets status = 0
router.delete('/:id', addMetadata, async (req, res) => {
  try {
    const slot = await service.getSlotById(req.params.id);
    if (!slot) {
      return res.status(404).json({ success: false, message: 'Slot not found' });
    }
    await service.deactivateSlot(req.params.id);
    res.json({ success: true, message: 'Slot deactivated' });
  } catch (err) {
    console.error('[slots] DELETE /:id:', err);
    res.status(500).json({ success: false, message: 'Failed to deactivate slot' });
  }
});

module.exports = router;