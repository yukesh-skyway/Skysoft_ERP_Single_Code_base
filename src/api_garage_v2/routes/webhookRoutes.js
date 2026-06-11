/**
 * Webhook Routes
 * 
 * All routes require Bearer token authentication via webhookAuth middleware
 * Routes are mounted at /api_garage/public/* in the main server
 */

const express = require('express');
const router = express.Router();

let webhookAuth;
let webhookController;

try {
  webhookAuth = require('../middleware/webhookAuth');
} catch (error) {
  console.error('❌ Error loading webhookAuth:', error.message);
  throw error;
}

try {
  webhookController = require('../controllers/webhookController');
} catch (error) {
  console.error('❌ Error loading webhookController:', error.message);
  throw error;
}

// Verify middleware is loaded
if (!webhookAuth || typeof webhookAuth.validateBearerToken !== 'function') {
  throw new Error(`webhookAuth.validateBearerToken is not a function (got ${typeof webhookAuth?.validateBearerToken})`);
}

// Apply Bearer token authentication to all routes
router.use(webhookAuth.validateBearerToken);

/**
 * List repair orders with filtering and pagination
 * POST /api_garage/public/roDetails/list
 * 
 * Required scope: rodetail:list
 * 
 * Body:
 * {
 *   "pageno": 1,
 *   "per_page": 20,
 *   "keyword": "12345",
 *   "vehicle": "V001",
 *   "status": "open",
 *   "vendor": "42",
 *   "created_on_start": "2025-01-01",
 *   "created_on_end": "2025-01-31"
 * }
 */
router.post('/roDetails/list', webhookController.list);

/**
 * Get RO details
 * GET /api_garage/public/roDetails/details?roid=1960
 * 
 * Required scope: rodetail:read
 */
router.get('/roDetails/details', webhookController.details);

/**
 * Get latest KM reading for a vehicle
 * GET /api_garage_v2/vehicleLatestkm?vehicleName=9611
 * 
 * Required scope: vehicle:read
 */
router.get('/vehicleLatestkm', webhookController.vehicleLatestkm);

/**
 * Update vehicle defect (current version)
 * POST /api_garage/public/updateVehicleDefect_v2
 * 
 * Required scope: defects:update
 * 
 * Body:
 * {
 *   "roid": 2028,
 *   "defectid": 6446,
 *   "work_order_number": "WO-2025-104",
 *   "work_order_status": "Completed",
 *   "invoice_number": "INV-123",
 *   "current_kms": 45000,
 *   "service_completion_date": "2025-01-15T14:30:00Z",
 *   "invoice_amount": 1500.00,
 *   "invoice_url": "https://...",
 *   "defects_details": {
 *     "defect_id": 6446,
 *     "external_ro_id": 2028,
 *     "status": "Completed",
 *     "labor_cost": 160,
 *     "parts_cost": 936,
 *     "total_cost": 1096
 *   },
 *   "repair_items": [...]
 * }
 */
router.post('/updateVehicleDefect_v2', webhookController.updateVehicleDefect_v2);



/**
 * Update entire RO
 * POST /api_garage/public/updateRO
 * 
 * Required scope: ro:update
 * 
 * Body:
 * {
 *   "external_ro_id": 1960,
 *   "work_order_number": "WO-2025-104",
 *   "work_order_status": "Completed",
 *   "invoice_number": "INV-123",
 *   "invoice_amount": 1500.00,
 *   "invoice_url": "https://...",
 *   "current_kms": 45000,
 *   "service_completion_date": "2025-01-15T14:30:00Z"
 * }
 */
router.post('/updateRO', webhookController.updateRO);
router.post('/createROFromGarage', webhookController.createROFromGarage);

/**
 * Create or update a bus visit
 * POST /api_garage/public/busVisit
 *
 * Required scope: busvisit:write
 *
 * Body:
 * {
 *   "visit_id": 412,
 *   "vehicle": 8687,
 *   "customer": "Skyway Coach Lines",
 *   "status": "In_Progress",
 *   "arrived_at": "2026-05-22T08:30:00.000Z",
 *   "departed_at": "2026-05-22T17:45:00.000Z",
 *   "notes": "Scheduled 10k miles preventative maintenance and brake diagnostic."
 * }
 */
router.post('/busVisit', webhookController.busVisit);

module.exports = router;