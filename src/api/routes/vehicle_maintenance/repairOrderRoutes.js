/**
 * Repair Orders Routes
 * Handles all endpoints related to repair purchase orders
 */

const express = require('express');
const router = express.Router();
const repairOrderService = require('../../services/vehicle_maintenance/repairOrderService');
const garageWebhook = require('../../services/vehicle_maintenance/garageWebhookService');
const upload = require('../../middleware/upload'); // 🔥 Multer file upload middleware
const path = require('path'); // 🔥 Path module for file handling
const { addMetadata } = require('../../middleware/requestMetadata');
const {
  logRepairOrderCreated,
  logRepairOrderUpdated,
  logRepairOrderCompleted,
  logRepairOrderStatusUpdate,
  logRepairOrderCancelled,
  logRepairOrderDeleted
} = require('../../services/vehicle_maintenance/auditLogService');

/**
 * GET /api/repair-orders/dashboard/statistics
 * Get dashboard statistics for repair orders and defects
 * IMPORTANT: This must be defined BEFORE the /:id route to avoid route matching conflicts
 */
router.get('/dashboard/statistics', async (req, res) => {
  try {
    const timeRange = req.query.timeRange || 'this-month';
    const db = require('../../db/connection');
    
    // Calculate date filters based on time range
    let dateFilter = '';
    const now = new Date();
    
    switch (timeRange) {
      case 'today':
        dateFilter = `AND DATE(rpo.created_on) = CURDATE()`;
        break;
      case 'this-week':
        dateFilter = `AND YEARWEEK(rpo.created_on, 1) = YEARWEEK(CURDATE(), 1)`;
        break;
      case 'this-month':
        dateFilter = `AND YEAR(rpo.created_on) = YEAR(CURDATE()) AND MONTH(rpo.created_on) = MONTH(CURDATE())`;
        break;
      case 'this-quarter':
        dateFilter = `AND YEAR(rpo.created_on) = YEAR(CURDATE()) AND QUARTER(rpo.created_on) = QUARTER(CURDATE())`;
        break;
      case 'this-year':
        dateFilter = `AND YEAR(rpo.created_on) = YEAR(CURDATE())`;
        break;
      default:
        dateFilter = `AND YEAR(rpo.created_on) = YEAR(CURDATE()) AND MONTH(rpo.created_on) = MONTH(CURDATE())`;
    }
    
    // Get RO statistics
    const [roStats] = await db.query(`
      SELECT 
        COUNT(*) as totalROs,
        SUM(CASE WHEN rpo.status = 1 THEN 1 ELSE 0 END) as openROs,
        SUM(CASE WHEN rpo.status = 2 THEN 1 ELSE 0 END) as inProgressROs,
        SUM(CASE WHEN rpo.status = 3 THEN 1 ELSE 0 END) as completedROs,
        SUM(CASE WHEN rpo.status = 4 THEN 1 ELSE 0 END) as cancelledROs,
        COALESCE(SUM(CASE WHEN rpo.invoice_amount IS NOT NULL THEN rpo.invoice_amount ELSE rpo.estimated_repair_amount END), 0) as totalCost,
        COALESCE(AVG(CASE 
          WHEN rpo.status = 3 AND rpo.service_completed_date IS NOT NULL AND rpo.created_on IS NOT NULL
          THEN DATEDIFF(rpo.service_completed_date, rpo.created_on) 
          ELSE NULL 
        END), 0) as averageCompletionTime
      FROM repair_purchase_orders rpo
      WHERE rpo.status != 0 ${dateFilter}
    `);

    // Get defect statistics
    const [defectStats] = await db.query(`
      SELECT 
        COUNT(*) as totalDefects,
        SUM(CASE WHEN vd.defect_status = 'Open' THEN 1 ELSE 0 END) as openDefects,
        SUM(CASE WHEN vd.defect_status = 'Reopened' THEN 1 ELSE 0 END) as reopenedDefects,
        SUM(CASE WHEN vd.defect_status = 'In_Progress' THEN 1 ELSE 0 END) as inProgressDefects,
        SUM(CASE WHEN vd.defect_status = 'Completed' THEN 1 ELSE 0 END) as completedDefects
      FROM vehicle_defects vd
      WHERE vd.is_duplicate = 'n'
    `);

    // Get recent repair orders (last 10)
    const [recentROs] = await db.query(`
      SELECT 
        rpo.id,
        rpo.ro_date,
        rpo.status,
        CASE WHEN rpo.invoice_amount IS NOT NULL THEN rpo.invoice_amount ELSE rpo.estimated_repair_amount END as totalCost,
        rpo.created_on,
        v.vehicle_nickname,
        ven.vendor_name,
        CASE rpo.status
          WHEN 1 THEN 'Open'
          WHEN 2 THEN 'In Progress'
          WHEN 3 THEN 'Completed'
          WHEN 4 THEN 'Cancelled'
          ELSE 'Unknown'
        END as statusText
      FROM repair_purchase_orders rpo
      LEFT JOIN vehicles v ON rpo.vehicle = v.id
      LEFT JOIN vendors ven ON rpo.vendor = ven.id
      WHERE rpo.status != 0 ${dateFilter}
      ORDER BY rpo.created_on DESC
      LIMIT 10
    `);

    // Calculate previous period for trend comparison
    const [previousStats] = await db.query(`
      SELECT COUNT(*) as previousTotal
      FROM repair_purchase_orders rpo
      WHERE rpo.status != 0
        AND rpo.created_on < (
          CASE 
            WHEN '${timeRange}' = 'today' THEN DATE_SUB(CURDATE(), INTERVAL 1 DAY)
            WHEN '${timeRange}' = 'this-week' THEN DATE_SUB(CURDATE(), INTERVAL 1 WEEK)
            WHEN '${timeRange}' = 'this-month' THEN DATE_SUB(CURDATE(), INTERVAL 1 MONTH)
            WHEN '${timeRange}' = 'this-quarter' THEN DATE_SUB(CURDATE(), INTERVAL 3 MONTH)
            WHEN '${timeRange}' = 'this-year' THEN DATE_SUB(CURDATE(), INTERVAL 1 YEAR)
            ELSE DATE_SUB(CURDATE(), INTERVAL 1 MONTH)
          END
        )
        AND rpo.created_on >= (
          CASE 
            WHEN '${timeRange}' = 'today' THEN DATE_SUB(CURDATE(), INTERVAL 2 DAY)
            WHEN '${timeRange}' = 'this-week' THEN DATE_SUB(CURDATE(), INTERVAL 2 WEEK)
            WHEN '${timeRange}' = 'this-month' THEN DATE_SUB(CURDATE(), INTERVAL 2 MONTH)
            WHEN '${timeRange}' = 'this-quarter' THEN DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
            WHEN '${timeRange}' = 'this-year' THEN DATE_SUB(CURDATE(), INTERVAL 2 YEAR)
            ELSE DATE_SUB(CURDATE(), INTERVAL 2 MONTH)
          END
        )
    `);

    // Calculate trend percentage
    const currentTotal = roStats[0].totalROs || 0;
    const previousTotal = previousStats[0].previousTotal || 0;
    let trendPercentage = 0;
    
    if (previousTotal > 0) {
      trendPercentage = ((currentTotal - previousTotal) / previousTotal) * 100;
    } else if (currentTotal > 0) {
      trendPercentage = 100;
    }

    res.json({
      success: true,
      data: {
        stats: {
          totalROs: roStats[0].totalROs || 0,
          openROs: roStats[0].openROs || 0,
          inProgressROs: roStats[0].inProgressROs || 0,
          completedROs: roStats[0].completedROs || 0,
          cancelledROs: roStats[0].cancelledROs || 0,
          totalDefects: defectStats[0].totalDefects || 0,
          openDefects: defectStats[0].openDefects || 0,
          reopenedDefects: defectStats[0].reopenedDefects || 0,
          inProgressDefects: defectStats[0].inProgressDefects || 0,
          completedDefects: defectStats[0].completedDefects || 0,
          totalCost: parseFloat(roStats[0].totalCost || 0),
          averageCompletionTime: parseFloat(roStats[0].averageCompletionTime || 0).toFixed(1),
          trendPercentage: trendPercentage.toFixed(1)
        },
        recentROs: recentROs.map(ro => ({
          id: ro.id,
          vehicle: ro.vehicle_nickname || 'N/A',
          vendor: ro.vendor_name || 'N/A',
          status: ro.statusText,
          statusCode: ro.status,
          totalCost: parseFloat(ro.totalCost || 0),
          createdDate: ro.ro_date || ro.created_on,
          priority: 'Medium' // Can be enhanced later if priority field is added
        }))
      }
    });
  } catch (error) {
    console.error('Route error in GET /api/repair-orders/dashboard/statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics',
      error: error.message
    });
  }
});

/**
 * GET /api/repair-orders/maintenance-history
 * Get all completed scheduled maintenance records
 * Filters: Completed and Repair_Not_Required from repair_purchase_order_repairs
 * IMPORTANT: This must be defined BEFORE the /:id route to avoid route matching conflicts
 */
router.get('/maintenance-history', async (req, res) => {
  try {
    const db = require('../../db/connection');
    
    console.log('🔍 [Maintenance History] Fetching all completed scheduled maintenance records...');
    
    // DEBUG: Check what data exists in repair_purchase_order_repairs
    const [debugData] = await db.query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT rpor.item_type) as distinct_item_types,
        GROUP_CONCAT(DISTINCT rpor.item_type) as item_types,
        GROUP_CONCAT(DISTINCT rpor.rpor_status) as rpor_statuses,
        COUNT(DISTINCT rpo.status) as distinct_rpo_statuses,
        GROUP_CONCAT(DISTINCT rpo.status) as rpo_statuses
      FROM repair_purchase_order_repairs rpor
      INNER JOIN repair_purchase_orders rpo ON rpor.repair_purchase_order = rpo.id
    `);
    
    console.log('📊 [DEBUG] Database content:', debugData[0]);
    
    // DEBUG: Check specifically for SCHEDULED_MAINTENANCE items with Completed/Repair_Not_Required
    const [debugSM] = await db.query(`
      SELECT 
        COUNT(*) as sm_total,
        COUNT(CASE WHEN rpor.rpor_status IN ('Completed', 'Repair_Not_Required') THEN 1 END) as sm_completed,
        GROUP_CONCAT(DISTINCT rpor.rpor_status) as sm_statuses,
        GROUP_CONCAT(DISTINCT rpo.status) as sm_rpo_statuses,
        COUNT(CASE WHEN scs.id IS NULL THEN 1 END) as missing_scs_join
      FROM repair_purchase_order_repairs rpor
      INNER JOIN repair_purchase_orders rpo ON rpor.repair_purchase_order = rpo.id
      LEFT JOIN scheduled_configuration_settings scs ON rpor.scheduled_maintenance_setting_id = scs.id
      WHERE rpor.item_type = 'SCHEDULED_MAINTENANCE'
      AND rpo.status != 0
    `);
    
    console.log('📊 [DEBUG] Scheduled Maintenance breakdown:', debugSM[0]);
    
    // Query to get ALL completed scheduled maintenance from repair_purchase_order_repairs
    const query = `
      SELECT 
        rpor.id,
        v.id as vehicle_id,
        v.vehicle_nickname,
        COALESCE(vt.vehicle_type, 'Unknown') as vehicle_type,
        scs.id as scheduled_maintenance_id,
        scs.setting_name as scheduled_maintenance_name,
        scs.id as scheduled_maintenance_setting_id,
        
        -- RO Information
        rpo.id as ro_id,
        rpo.id as ro_number,
        CASE rpo.status
          WHEN 1 THEN 'Pending'
          WHEN 2 THEN 'In Progress'
          WHEN 3 THEN 'Completed'
          WHEN 4 THEN 'Cancelled'
          WHEN 5 THEN 'Paused'
          WHEN 6 THEN 'Approved'
          ELSE 'Unknown'
        END as ro_status,
        rpo.service_completed_date as ro_completed_date,
        
        -- Maintenance Status from repair_purchase_order_repairs
        rpor.rpor_status,
        
        -- Service Details
        COALESCE(rpor.service_completion_date, rpo.service_completed_date) as service_completion_date,
        rpor.current_kms as kms_at_completion,
        rpor.invoice_amount,
        ven.vendor_name,
        
        -- Current Tracking from vehicle_scheduled_maintenance
        vsm.last_maintenance_date,
        vsm.last_replaced_km,
        COALESCE(v.current_km, 0) as current_vehicle_km,
        
        -- Next Due Information (calculated, only populated if rpor_status = 'Completed')
        CASE 
          WHEN rpor.rpor_status = 'Completed' AND cs.kms > 0 THEN vsm.last_replaced_km + cs.kms
          ELSE NULL 
        END as next_due_km,
        CASE 
          WHEN rpor.rpor_status = 'Completed' AND cs.days > 0 THEN DATE_ADD(vsm.last_maintenance_date, INTERVAL cs.days DAY)
          ELSE NULL 
        END as next_due_date,
        cs.kms as km_interval,
        cs.days as days_interval,
        
        -- Current Assignment (is this maintenance item assigned to an active RO?)
        current_ro_agg.current_ro_id as current_ro_assignment,
        current_ro_agg.current_ro_number
        
      FROM 
        repair_purchase_order_repairs rpor
        
        -- Join to get RO details
        INNER JOIN repair_purchase_orders rpo ON rpor.repair_purchase_order = rpo.id
        
        -- Join to get vehicle details
        INNER JOIN vehicles v ON rpo.vehicle = v.id
        LEFT JOIN vehicletypes vt ON v.vehicle_type = vt.id
        
        -- Join to get scheduled maintenance details
        LEFT JOIN scheduled_configuration_settings scs ON rpor.scheduled_maintenance_setting_id = scs.id
        
        -- Join to get current tracking information (intervals are in configuration_settings)
        LEFT JOIN configuration_settings cs ON cs.setting = scs.id AND cs.configuration = v.vehicle_configuration
        
        -- Join to get vendor
        LEFT JOIN vendors ven ON rpo.vendor = ven.id
        
        -- Join to get vehicle_scheduled_maintenance (tracking data)
        LEFT JOIN vehicle_scheduled_maintenance vsm ON vsm.vehicle = v.id AND vsm.scheduled_maintenance = scs.id
        
        -- Subquery to find if this maintenance item is currently assigned to an active RO
        LEFT JOIN (
          SELECT 
            rpor2.scheduled_maintenance_setting_id,
            rpo2.vehicle,
            rpo2.id as current_ro_id,
            rpo2.id as current_ro_number
          FROM 
            repair_purchase_order_repairs rpor2
            INNER JOIN repair_purchase_orders rpo2 ON rpor2.repair_purchase_order = rpo2.id
          WHERE 
            rpor2.rpor_status IN ('Pending', 'In_Progress', 'Paused')
            AND rpo2.status IN (1, 2, 5, 6)
            AND rpor2.scheduled_maintenance_setting_id IS NOT NULL
        ) current_ro_agg ON current_ro_agg.scheduled_maintenance_setting_id = rpor.scheduled_maintenance_setting_id 
                        AND current_ro_agg.vehicle = v.id
        
      WHERE 
        -- Only include scheduled maintenance items (not defects)
        rpor.item_type = 'SCHEDULED_MAINTENANCE'
        
        -- Only include completed or repair-not-required items
        AND rpor.rpor_status IN ('Completed', 'Repair_Not_Required')
        
        -- Exclude soft-deleted ROs
        AND rpo.status != 0
        
      ORDER BY 
        COALESCE(rpor.service_completion_date, rpo.service_completed_date) DESC,
        v.vehicle_number ASC,
        scs.setting_name ASC
    `;
    
    console.log('📝 [Maintenance History] Executing query...');
    const [rows] = await db.query(query);
    
    console.log(`✅ [Maintenance History] Found ${rows.length} completed maintenance records`);
    
    res.json({
      success: true,
      data: rows,
      count: rows.length
    });
    
  } catch (error) {
    console.error('❌ Route error in GET /api/repair-orders/maintenance-history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch maintenance history',
      error: error.message
    });
  }
});

/**
 * GET /api/repair-orders/check-scheduled-maintenance-active/:settingId
 * Check if a scheduled maintenance setting is currently assigned to an active RO
 * Used by Service History to prevent manual updates when item is in an active RO
 * Query params:
 *   vehicle_id (required): The vehicle ID to check
 */
router.get('/check-scheduled-maintenance-active/:settingId', async (req, res) => {
  try {
    const settingId = parseInt(req.params.settingId);
    const vehicleId = parseInt(req.query.vehicle_id);
    
    if (!vehicleId) {
      return res.status(400).json({
        success: false,
        message: 'vehicle_id query parameter is required'
      });
    }
    
    const db = require('../../db/connection');
    
    // Check if this setting is in ANY active RO (status 1 or 2) with non-completed status
    const [activeRO] = await db.query(`
      SELECT 
        rpo.id as ro_id,
        rpo.status as ro_status,
        rpor.rpor_status as rpor_status,
        CASE 
          WHEN rpo.status = 1 THEN 'Active'
          WHEN rpo.status = 2 THEN 'In Progress'
          ELSE 'Unknown'
        END as ro_status_text
      FROM repair_purchase_order_repairs rpor 
      INNER JOIN repair_purchase_orders rpo ON rpo.id = rpor.repair_purchase_order 
      WHERE rpo.vehicle = ? 
      AND rpor.item_type = 'SCHEDULED_MAINTENANCE' 
      AND rpor.scheduled_maintenance_setting_id = ? 
      AND rpor.rpor_status NOT IN ('Completed', 'Repair_Not_Needed')
      AND rpo.status != 0
      AND rpo.status != 4
      ORDER BY rpo.created_on DESC
      LIMIT 1
    `, [vehicleId, settingId]);
    
    const isAssigned = activeRO.length > 0;
    
    res.json({
      success: true,
      isAssigned: isAssigned,
      data: isAssigned ? {
        roId: activeRO[0].ro_id,
        roStatus: activeRO[0].ro_status,
        roStatusText: activeRO[0].ro_status_text,
        rporStatus: activeRO[0].rpor_status
      } : null
    });
  } catch (error) {
    console.error('Route error in GET /api/repair-orders/check-scheduled-maintenance-active:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check scheduled maintenance status',
      error: error.message
    });
  }
});

/**
 * GET /api/repair-orders
 * Get all repair orders with filtering, pagination, and sorting
 */
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sortColumn = req.query.sortColumn || 'created_on';
    const sortOrder = req.query.sortOrder || 'DESC';
    
    const filters = {
      txtKey: req.query.txtKey,
      txtStatus: req.query.txtStatus,
      txtVehicle: req.query.txtVehicle,
      txtVendor: req.query.txtVendor,
      txtStarting: req.query.txtStarting,
      txtEnds: req.query.txtEnds,
      readyToComplete: req.query.readyToComplete  // ✅ Add Ready to Complete filter
    };

    const result = await repairOrderService.getRepairOrders({
      page,
      limit,
      sortColumn,
      sortOrder,
      filters
    });

    res.json({
      success: true,
      data: result.data,
      total: result.total,
      statistics: result.statistics,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit)
    });
  } catch (error) {
    console.error('Route error in GET /api/repair-orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch repair orders',
      error: error.message
    });
  }
});

/**
 * GET /api/repair-orders/defects/:vehicleId
 * Get vehicle defects for creating a repair order
 */
router.get('/defects/:vehicleId', async (req, res) => {
  try {
    const vehicleId = parseInt(req.params.vehicleId);
    const preselectedDefectIds = req.query.txtDefects || '';
    const roId = req.query.ro_id ? parseInt(req.query.ro_id) : null; // For edit mode
    const sourceFilter = req.query.source_filter || null; // NEW: Filter by defect_source
    
    const defects = await repairOrderService.getVehicleDefects(vehicleId, preselectedDefectIds, roId, sourceFilter);
    
    res.json({
      success: true,
      data: defects
    });
  } catch (error) {
    console.error('Route error in GET /api/repair-orders/defects:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch defects',
      error: error.message
    });
  }
});

/**
 * GET /api/repair-orders/matrix-data
 * Get maintenance matrix data (columns + vehicles with maintenance items)
 * Query params:
 *   vehicleType (optional): Filter by vehicle type
 *   vehicleIds (optional): Comma-separated vehicle IDs
 */
router.get('/matrix-data', async (req, res) => {
  try {
    const filters = {};
    
    if (req.query.vehicleType) {
      filters.vehicleType = req.query.vehicleType;
    }
    
    if (req.query.vehicleIds) {
      filters.vehicleIds = req.query.vehicleIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
    }
    
    const matrixData = await repairOrderService.getMaintenanceMatrixData(filters);
    
    res.json({
      success: true,
      data: matrixData
    });
  } catch (error) {
    console.error('Route error in GET /api/repair-orders/matrix-data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch maintenance matrix data',
      error: error.message
    });
  }
});

/**
 * GET /api/repair-orders/scheduled-maintenance-all
 * Get scheduled maintenance for ALL vehicles
 * IMPORTANT: This must be defined BEFORE /scheduled-maintenance/:vehicleId to avoid route matching conflicts
 */
router.get('/scheduled-maintenance-all', async (req, res) => {
  try {
    const allVehiclesData = await repairOrderService.getAllVehiclesScheduledMaintenance();
    
    res.json({
      success: true,
      data: allVehiclesData
    });
  } catch (error) {
    console.error('Route error in GET /api/repair-orders/scheduled-maintenance-all:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch all vehicles scheduled maintenance',
      error: error.message
    });
  }
});

/**
 * GET /api/repair-orders/scheduled-maintenance/:vehicleId
 * Get scheduled maintenance for a vehicle
 * Query params:
 *   ro_id (optional): If provided, returns items IN this RO (with rpor_status) + available items
 */
router.get('/scheduled-maintenance/:vehicleId', async (req, res) => {
  try {
    const vehicleId = parseInt(req.params.vehicleId);
    const roId = req.query.ro_id ? parseInt(req.query.ro_id) : null;
    
    const items = await repairOrderService.getVehicleScheduledMaintenance(vehicleId, roId);
    
    res.json({
      success: true,
      data: items
    });
  } catch (error) {
    console.error('Route error in GET /api/repair-orders/scheduled-maintenance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch scheduled maintenance',
      error: error.message
    });
  }
});

/**
 * GET /api/repair-orders/payment-methods
 * Get all payment methods
 */
router.get('/payment-methods', async (req, res) => {
  try {
    const db = require('../../db/connection');
    const [paymentMethods] = await db.query(
      'SELECT id, payment_method FROM payment_methods WHERE status = 1 ORDER BY payment_method ASC'
    );
    
    res.json({
      success: true,
      data: paymentMethods
    });
  } catch (error) {
    console.error('Route error in GET /api/repair-orders/payment-methods:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment methods',
      error: error.message
    });
  }
});

/**
 * POST /api/repair-orders/create
 * Create a repair order with defects and scheduled maintenance
 */
router.post('/create', addMetadata, async (req, res) => {
  try {
    const roData = req.body;
    const metadata = {
      userId: req.user?.id || 1,
      ipAddress: req.metadata?.ipAddress,
      browser: req.metadata?.browser,
      userAgent: req.metadata?.userAgent
    };
    
    const result = await repairOrderService.createRepairOrderWithItems(roData, metadata);
    
    // ✅ Log the RO creation
    try {
      const db = require('../../db/connection');
      const [createdRO] = await db.query(`
        SELECT rpo.*, v.vehicle_nickname, v.vehicle_number, vn.vendor_name
        FROM repair_purchase_orders rpo
        LEFT JOIN vehicles v ON rpo.vehicle = v.id
        LEFT JOIN vendors vn ON rpo.vendor = vn.id
        WHERE rpo.id = ?
      `, [result.ro_id]);

      if (createdRO.length > 0) {
        const roWithCounts = {
          ...createdRO[0],
          defect_count: result.defects_assigned || 0,
          maintenance_count: result.sm_assigned || 0,
          defect_ids: result.defects_ids || [],
          maintenance_ids: result.sm_ids || []
        };
        console.log('🔍 [AUDIT LOG] Calling logRepairOrderCreated with:', {
          roId: roWithCounts.id,
          vehicle: roWithCounts.vehicle,
          vendor: roWithCounts.vendor,
          defectCount: roWithCounts.defect_count,
          maintenanceCount: roWithCounts.maintenance_count,
          defectIds: roWithCounts.defect_ids,
          maintenanceIds: roWithCounts.maintenance_ids,
          metadata
        });
        const logResult = await logRepairOrderCreated(roWithCounts, metadata);
        console.log('✅ [AUDIT LOG] logRepairOrderCreated result:', logResult);
      } else {
        console.error('❌ [AUDIT LOG] No RO data found for ID:', result.ro_id);
      }
    } catch (logError) {
      console.error('❌ Error logging RO creation:', logError);
      console.error('❌ Error stack:', logError.stack);
    }
    
    // ✅ Send webhook notification to Garage App
    // Match PHP: Pass status '0' for newly created ROs (even though DB has status 1)
let garageWebhookTriggered = false;

if (result.ro_id) {
  const db = require('../../db/connection');
  const [vendorData] = await db.query(
    `SELECT garage_url FROM vendors WHERE id = ?`,
    [roData.txtVendor]
  );
  if (vendorData[0]?.garage_url && vendorData[0].garage_url.trim() !== '') {
    garageWebhookTriggered = true;
    garageWebhook.notifyROCreated(result.ro_id, 1, metadata.userId)
      .catch(err => console.error('Garage webhook failed (non-blocking):', err));
  } else {
    console.log('⚠️ Skipping garage webhook — no garage_url for vendor');
  }
}

res.json({
  success: true,
  message: 'Repair Order created successfully',
  garage_webhook_triggered: garageWebhookTriggered,
  ...result
});
  } catch (error) {
    console.error('Route error in POST /api/repair-orders/create:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create repair order',
      error: error.message
    });
  }
});

/**
 * GET /api/repair-orders/:id/details
 * Get full repair order details including repairs, scheduled maintenance, and logs
 * IMPORTANT: This must be defined BEFORE the /:id route to avoid route matching conflicts
 */
router.get('/:id/details', async (req, res) => {
  try {
    const roId = parseInt(req.params.id);
    const details = await repairOrderService.getRepairOrderDetails(roId);

    if (!details) {
      return res.status(404).json({
        success: false,
        message: 'Repair order not found'
      });
    }

    res.json({
      success: true,
      data: details
    });
  } catch (error) {
    console.error('Route error in GET /api/repair-orders/:id/details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch repair order details',
      error: error.message
    });
  }
});

/**
 * GET /api/repair-orders/:id/edit
 * Get repair order data for editing (includes defect and scheduled maintenance IDs)
 * IMPORTANT: This must be defined BEFORE the /:id route to avoid route matching conflicts
 */
router.get('/:id/edit', async (req, res) => {
  try {
    const roId = parseInt(req.params.id);
    const editData = await repairOrderService.getRepairOrderForEdit(roId);

    if (!editData) {
      return res.status(404).json({
        success: false,
        message: 'Repair order not found'
      });
    }

    res.json({
      success: true,
      data: editData
    });
  } catch (error) {
    console.error('Route error in GET /api/repair-orders/:id/edit:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch repair order for editing',
      error: error.message
    });
  }
});

/**
 * GET /api/repair-orders/:id/attachments
 * Get all attachments for a repair order
 * ✅ NEW: Returns list of uploaded invoice files
 * IMPORTANT: This must be defined BEFORE the /:id route to avoid route matching conflicts
 */
router.get('/:id/attachments', async (req, res) => {
  try {
    const roId = parseInt(req.params.id);
    const db = require('../../db/connection');
    
    // ✅ Check if ro_attachments table exists, create if not
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS ro_attachments (
          id INT(11) NOT NULL AUTO_INCREMENT,
          ro_id INT(11) NOT NULL,
          original_filename VARCHAR(255) NOT NULL COMMENT 'Original filename WITHOUT extension',
          stored_filename VARCHAR(255) NOT NULL COMMENT 'Stored filename WITH extension (timestamp-based)',
          upload_timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          status TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1=active, 0=deleted',
          PRIMARY KEY (id),
          KEY idx_ro_id (ro_id),
          KEY idx_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Stores invoice file attachments for repair orders';
      `);
      console.log('✅ ro_attachments table checked/created successfully');
    } catch (createError) {
      // Table might already exist - that's OK, just log it
      console.log('📋 Table creation note:', createError.message);
    }
    
    const [attachments] = await db.query(
      `SELECT id, ro_id, original_filename, stored_filename, upload_timestamp, status
       FROM ro_attachments
       WHERE ro_id = ? AND status = 1
       ORDER BY upload_timestamp DESC`,
      [roId]
    );
    
    console.log(`📎 Found ${attachments.length} attachment(s) for RO #${roId}`);
    
    res.json({
      success: true,
      data: attachments
    });
    
  } catch (error) {
    console.error('Route error in GET /api/repair-orders/:id/attachments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch attachments',
      error: error.message
    });
  }
});

/**
 * GET /api/repair-orders/:id
 * Get a single repair order by ID
 * IMPORTANT: This must be defined AFTER specific routes like /:id/details, /:id/edit, and /:id/attachments
 */
router.get('/:id', async (req, res) => {
  try {
    const roId = parseInt(req.params.id);
    const repairOrder = await repairOrderService.getRepairOrderById(roId);

    if (!repairOrder) {
      return res.status(404).json({
        success: false,
        message: 'Repair order not found'
      });
    }

    res.json({
      success: true,
      data: repairOrder
    });
  } catch (error) {
    console.error('Route error in GET /api/repair-orders/:id:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch repair order',
      error: error.message
    });
  }
});

/**
 * PUT /api/repair-orders/:id
 * Update a repair order
 * ✅ NOW SUPPORTS TWO MODES:
 *    1. Edit RO (change vehicle, vendor, add/remove defects) - calls updateRepairOrder()
 *    2. Complete RO (add invoice, KMs, etc.) - calls updateRepairOrderCompletionDetails()
 * ✅ SUPPORTS FILE UPLOAD via multer middleware
 */
router.put('/:id', addMetadata, upload.single('attached_invoice'), async (req, res) => {
  try {
    const roId = parseInt(req.params.id);
    
    const metadata = {
      userId: req.user?.id || 1,
      ipAddress: req.metadata?.ipAddress,
      browser: req.metadata?.browser,
      userAgent: req.metadata?.userAgent
    };

    // Get old RO data for logging
    const db = require('../../db/connection');
    const [oldROData] = await db.query(`
      SELECT rpo.*, v.vehicle_nickname, v.vehicle_number, vn.vendor_name
      FROM repair_purchase_orders rpo
      LEFT JOIN vehicles v ON rpo.vehicle = v.id
      LEFT JOIN vendors vn ON rpo.vendor = vn.id
      WHERE rpo.id = ?
    `, [roId]);

    const oldRO = oldROData.length > 0 ? oldROData[0] : null;

    // 🔍 Detect which type of update this is:
    // Edit RO modal sends: txtVehicle, txtRequestedBy, txtBusKms, txtVendor, vrls, scheduled_maintenance_items
    // Complete RO modal sends: txtKms, txtInvoiceAmount, defects, scheduled_maintenance
    const isEditMode = req.body.txtVehicle !== undefined;
    
    console.log(`📝 [PUT /:id] Updating RO #${roId}... Mode: ${isEditMode ? 'EDIT' : 'COMPLETE'}`);
    console.log(`📝 [PUT /:id] Body keys:`, Object.keys(req.body));

    let updatedRO;

    if (isEditMode) {
      // ✅ EDIT MODE: Update RO basic details and defects list
      console.log(`🔧 [EDIT MODE] Calling updateRepairOrder()...`);
      
      updatedRO = await repairOrderService.updateRepairOrder(roId, req.body, metadata);
      
      console.log(`✅ [EDIT MODE] RO #${roId} updated successfully`);
    } else {
      // ✅ COMPLETE MODE: Update completion details (invoice, KMs, etc.)
      console.log(`✅ [COMPLETE MODE] Calling updateRepairOrderCompletionDetails()...`);
      
      const roData = {
        kms_after_service: req.body.txtKms ? parseFloat(req.body.txtKms) : (req.body.kms_after_service ? parseFloat(req.body.kms_after_service) : null),
        invoice_amount: req.body.txtInvoiceAmount ? parseFloat(req.body.txtInvoiceAmount) : (req.body.invoice_amount ? parseFloat(req.body.invoice_amount) : null),
        work_order_number: req.body.txtWorkOrderNumber || req.body.work_order_number || '',
        invoice_number: req.body.txtInvoiceNumber || req.body.invoice_number || '',
        service_completed_date: req.body.txtServiceCompletedDate || req.body.service_completed_date || null,
        payment_method: req.body.txtPaymentMethod ? parseInt(req.body.txtPaymentMethod) : (req.body.payment_method ? parseInt(req.body.payment_method) : null),
        payment_notes: req.body.txtPaymentNotes || req.body.payment_notes || '',
        repair_notes: req.body.txtRepairNotes || req.body.repair_notes || '',
        defects: req.body.defects ? (typeof req.body.defects === 'string' ? JSON.parse(req.body.defects) : req.body.defects) : [],
        scheduled_maintenance: req.body.scheduled_maintenance ? (typeof req.body.scheduled_maintenance === 'string' ? JSON.parse(req.body.scheduled_maintenance) : req.body.scheduled_maintenance) : []
      };
      
      // ✅ Add file info if uploaded
      if (req.file) {
        roData.uploadedFile = {
          originalName: req.file.originalname.replace(path.extname(req.file.originalname), ''),
          storedName: req.file.filename,
          filePath: req.file.path,
          size: req.file.size,
          mimetype: req.file.mimetype
        };
        console.log(`📎 File attached to RO update: ${req.file.filename}`);
      }

      updatedRO = await repairOrderService.updateRepairOrderCompletionDetails(roId, roData, metadata);
      
      console.log(`✅ [COMPLETE MODE] RO #${roId} updated successfully`);
    }

    if (!updatedRO) {
      return res.status(404).json({
        success: false,
        message: 'Repair order not found or no changes made'
      });
    }

    // ✅ Log the RO update/completion
    try {
      const [newROData] = await db.query(`
        SELECT rpo.*, v.vehicle_nickname, v.vehicle_number, vn.vendor_name
        FROM repair_purchase_orders rpo
        LEFT JOIN vehicles v ON rpo.vehicle = v.id
        LEFT JOIN vendors vn ON rpo.vendor = vn.id
        WHERE rpo.id = ?
      `, [roId]);

      if (newROData.length > 0 && oldRO) {
        const newRO = newROData[0];
        console.log('🔍 [AUDIT LOG] Mode:', isEditMode ? 'EDIT' : 'COMPLETE');
        console.log('🔍 [AUDIT LOG] Old RO ID:', oldRO.id, 'New RO ID:', newRO.id);
        console.log('🔍 [AUDIT LOG] Metadata:', metadata);
        
        if (isEditMode) {
          // Pass defect changes to audit log with just IDs (matching Create RO format)
          let defectChanges = null;
          
          if (updatedRO.defectChanges) {
            defectChanges = { ...updatedRO.defectChanges };
            // Keep just the IDs for clean logging (matching Create RO format)
          }
          
          console.log('🔍 [AUDIT LOG] Defect changes:', defectChanges);
          const logResult = await logRepairOrderUpdated(oldRO, newRO, metadata, defectChanges);
          console.log('✅ [AUDIT LOG] logRepairOrderUpdated result:', logResult);
        } else {
          const logResult = await logRepairOrderCompleted(newRO, metadata);
          console.log('✅ [AUDIT LOG] logRepairOrderCompleted result:', logResult);
        }
      } else {
        console.error('❌ [AUDIT LOG] Missing data - newROData length:', newROData.length, 'oldRO:', !!oldRO);
      }
    } catch (logError) {
      console.error('❌ Error logging RO update:', logError);
      console.error('❌ Error stack:', logError.stack);
    }

    // ✅ Send webhook notification to Garage App
    // Match PHP: Pass status '0' for RO updates (hardcoded, same as CREATE)
    // REPLACE:
let garageWebhookTriggered = false;

const [vendorInfo] = await db.query(
  `SELECT v.garage_url FROM repair_purchase_orders rpo 
   JOIN vendors v ON rpo.vendor = v.id 
   WHERE rpo.id = ?`,
  [roId]
);
if (vendorInfo[0]?.garage_url && vendorInfo[0].garage_url.trim() !== '') {
  garageWebhookTriggered = true;
  garageWebhook.notifyROUpdated(roId, oldRO?.status || 1, metadata.userId)
    .catch(err => console.error('Garage webhook failed (non-blocking):', err));
} else {
  console.log('⚠️ Skipping garage webhook update — no garage_url for vendor');
}

res.json({
  success: true,
  message: updatedRO.message || 'Repair order updated successfully',
  garage_webhook_triggered: garageWebhookTriggered,
  ro_id: updatedRO.ro_id
});
  } catch (error) {
    console.error('❌ Route error in PUT /api/repair-orders/:id:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update repair order',
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * PUT /api/repair-orders/:id/status
 * Update repair order status (Mark as Complete)
 * Changes status from Active (1) to Finished (2)
 * Validates all items are completed and updates effective_date for scheduled maintenance
 */
router.put('/:id/status', async (req, res) => {
  try {
    const roId = parseInt(req.params.id);
    const statusData = req.body;
    const metadata = {
      userId: req.user?.id || 1,
      ipAddress: req.metadata?.ipAddress,
      userAgent: req.metadata?.userAgent
    };

    const result = await repairOrderService.updateRepairOrderStatus(roId, statusData, metadata);

    res.json({
      success: true,
      message: 'Repair order status updated successfully',
      data: result
    });
  } catch (error) {
    console.error('Route error in PUT /api/repair-orders/:id/status:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update repair order status',
      error: error.message
    });
  }
});

/**
 * POST /api/repair-orders/:id/complete
 * Complete/Update an In Progress repair order (status = 2)
 * This is for updating RO after vendor completes the work
 */
router.post('/:id/complete', async (req, res) => {
  try {
    const roId = parseInt(req.params.id);
    const completionData = req.body;
    const metadata = {
      userId: req.user?.id || 1,
      ipAddress: req.metadata?.ipAddress,
      userAgent: req.metadata?.userAgent
    };

    const result = await repairOrderService.completeRepairOrder(roId, completionData, metadata);

    res.json({
      success: true,
      message: 'Repair order completion data updated successfully',
      data: result
    });
  } catch (error) {
    console.error('Route error in POST /api/repair-orders/:id/complete:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update repair order completion data',
      error: error.message
    });
  }
});

/**
 * POST /api/repair-orders/:id/complete-full
 * Complete Repair Order - Full PHP Logic with File Upload
 * Matches completerepairpurchaseorder.php exactly
 * Changes status from Active (1) to Finished (2)
 * Updates all completion fields, processes defects and scheduled maintenance
 * 🔥 Supports file upload for invoice attachment (matching PHP)
 */
router.post('/:id/complete-full', upload.single('attached_invoice'), async (req, res) => {
  try {
    const roId = parseInt(req.params.id);
    const completionData = req.body;
    const metadata = {
      userId: req.user?.id || 1,
      ipAddress: req.metadata?.ipAddress,
      userAgent: req.metadata?.userAgent
    };
    
    console.log('📥 Complete RO Request:', { roId, hasFile: !!req.file });
    
    // 🔥 Add uploaded file information if file was uploaded
    if (req.file) {
      console.log('📎 File uploaded:', {
        originalName: req.file.originalname,
        storedName: req.file.filename,
        size: req.file.size,
        path: req.file.path
      });
      
      completionData.uploadedFile = {
        originalName: req.file.originalname.replace(path.extname(req.file.originalname), ''), // Remove extension (matching PHP)
        storedName: req.file.filename,
        filePath: req.file.path,
        size: req.file.size,
        mimetype: req.file.mimetype
      };
    } else {
      console.log('ℹ️ No file uploaded with this request');
    }

    const result = await repairOrderService.completeRepairOrderFull(roId, completionData, metadata);

    res.json({
      success: true,
      message: 'Repair order completed successfully',
      data: result
    });
  } catch (error) {
    console.error('Route error in POST /api/repair-orders/:id/complete-full:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to complete repair order',
      error: error.message
    });
  }
});

/**
 * POST /api/repair-orders/:id/cancel
 * Cancel a repair order and reactivate associated defects
 * Only allows canceling Active ROs (status = 1) where items are Open or In_Progress
 */
router.post('/:id/cancel', addMetadata, async (req, res) => {
  try {
    const roId = parseInt(req.params.id);
    const metadata = {
      userId: req.user?.id || 1,
      ipAddress: req.metadata?.ipAddress,
      browser: req.metadata?.browser,
      userAgent: req.metadata?.userAgent
    };

    // Get RO data for logging before cancellation
    const db = require('../../db/connection');
    const [roData] = await db.query(`
      SELECT rpo.*, v.vehicle_nickname, v.vehicle_number, vn.vendor_name
      FROM repair_purchase_orders rpo
      LEFT JOIN vehicles v ON rpo.vehicle = v.id
      LEFT JOIN vendors vn ON rpo.vendor = vn.id
      WHERE rpo.id = ?
    `, [roId]);

    const result = await repairOrderService.cancelRepairOrder(roId, metadata);

    // ✅ Log the RO cancellation
    try {
      if (roData.length > 0) {
        console.log('🔍 [AUDIT LOG] Calling logRepairOrderCancelled for RO:', roData[0].id);
        console.log('🔍 [AUDIT LOG] Metadata:', metadata);
        const logResult = await logRepairOrderCancelled(roData[0], metadata);
        console.log('✅ [AUDIT LOG] logRepairOrderCancelled result:', logResult);
      } else {
        console.error('❌ [AUDIT LOG] No RO data found for cancellation');
      }
    } catch (logError) {
      console.error('❌ Error logging RO cancellation:', logError);
      console.error('❌ Error stack:', logError.stack);
    }

    res.json({
      success: true,
      message: 'Repair order cancelled successfully',
      data: result
    });
  } catch (error) {
    console.error('Route error in POST /api/repair-orders/:id/cancel:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel repair order',
      error: error.message
    });
  }
});

/**
 * DELETE /api/repair-orders/:id
 * Delete (soft delete) a repair order
 */
router.delete('/:id', addMetadata, async (req, res) => {
  try {
    const roId = parseInt(req.params.id);
    const metadata = {
      userId: req.user?.id || 1,
      ipAddress: req.metadata?.ipAddress,
      browser: req.metadata?.browser,
      userAgent: req.metadata?.userAgent
    };

    // Get RO data for logging before deletion
    const db = require('../../db/connection');
    const [roData] = await db.query(`
      SELECT rpo.*, v.vehicle_nickname, v.vehicle_number, vn.vendor_name
      FROM repair_purchase_orders rpo
      LEFT JOIN vehicles v ON rpo.vehicle = v.id
      LEFT JOIN vendors vn ON rpo.vendor = vn.id
      WHERE rpo.id = ?
    `, [roId]);

    const result = await repairOrderService.deleteRepairOrder(roId, metadata);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Repair order not found'
      });
    }

    // ✅ Log the RO deletion
    try {
      if (roData.length > 0) {
        console.log('🔍 [AUDIT LOG] Calling logRepairOrderDeleted for RO:', roData[0].id);
        console.log('🔍 [AUDIT LOG] Metadata:', metadata);
        const logResult = await logRepairOrderDeleted(roData[0], metadata);
        console.log('✅ [AUDIT LOG] logRepairOrderDeleted result:', logResult);
      } else {
        console.error('❌ [AUDIT LOG] No RO data found for deletion');
      }
    } catch (logError) {
      console.error('❌ Error logging RO deletion:', logError);
      console.error('❌ Error stack:', logError.stack);
    }

    res.json({
      success: true,
      message: 'Repair order deleted successfully',
      data: result
    });
  } catch (error) {
    console.error('Route error in DELETE /api/repair-orders/:id:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete repair order',
      error: error.message
    });
  }
});
/**
 * PATCH — Two routes updated in repairOrderRoutes.js
 * 
 * 1. POST /:id/approve-defect
 *    — Now reads repair_fixed_on, service_completion_date, current_kms from req.body
 *    — Passes them to service layer
 *
 * 2. POST /:id/approve-defects-bulk
 *    — Each item in the array now carries repair_fixed_on, service_completion_date, current_kms
 *    — Passes them through to bulkApproveDefects()
 *
 * REPLACE the two route blocks below in repairOrderRoutes.js
 */

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE 1 — POST /api/repair-orders/:id/approve-defect
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/approve-defect', async (req, res) => {
  try {
    const roId = parseInt(req.params.id);
    const {
      rpor_id,
      vrl_id,
      status,
      // ✅ NEW: per-defect completion fields from the modal table rows
      repair_fixed_on,        // → vrl.repair_fixed_on
      service_completion_date, // → rpor.service_completion_date
      current_kms,            // → rpor.current_kms
    } = req.body;

    const userId   = req.user?.id   || 1;
    const userName = req.user?.username || req.user?.name || 'Unknown';

    if (!rpor_id || !status) {
      return res.status(400).json({ success: false, message: 'rpor_id and status are required' });
    }

    const db = require('../../db/connection');
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      // 1. Capture current status for change-detection
      const [currentData] = await connection.query(
        `SELECT rpor_status FROM repair_purchase_order_repairs WHERE id = ?`,
        [rpor_id]
      );
      const oldStatus          = currentData[0]?.rpor_status;
      const isCompletingDefect = (status === 'Completed' || status === 'Repair_Not_Required');
      const wasAlreadyCompleted = (oldStatus === 'Completed' || oldStatus === 'Repair_Not_Required');

      // 2. Update rpor row — status + optional date/kms
      await connection.query(
        `UPDATE repair_purchase_order_repairs 
         SET rpor_status            = ?,
             service_completion_date = COALESCE(?, service_completion_date),
             current_kms            = COALESCE(?, current_kms)
         WHERE id = ? AND repair_purchase_order = ?`,
        [status, service_completion_date || null, current_kms || null, rpor_id, roId]
      );

      let motiveSyncResult = null;

      // 3. Update vrl row if provided
      if (vrl_id) {
        const [managerCheck] = await connection.query(
          `SELECT manager_status FROM vehicle_repair_logs WHERE id = ?`,
          [vrl_id]
        );

        if (managerCheck[0]?.manager_status === 'Approved') {
          throw new Error('This defect has already been approved by a manager');
        }

        // ✅ Also writes repair_fixed_on (vrl-side date field)
        await connection.query(
          `UPDATE vehicle_repair_logs 
           SET defect_status      = ?,
               repair_fixed_on    = COALESCE(?, repair_fixed_on),
               manager_status     = 'Approved',
               manager_id         = ?,
               manager_name       = ?,
               manager_update_date = NOW()
           WHERE id = ?`,
          [status, repair_fixed_on || null, userId, userName, vrl_id]
        );

        await connection.commit();

        // 4. Motive sync (only on first completion)
        if (isCompletingDefect && !wasAlreadyCompleted) {
          try {
            const MotiveDefectService = require('../../services/vehicle_maintenance/motiveDefectService');
            console.log(`🔄 Syncing defect ${vrl_id} to Motive...`);
            motiveSyncResult = await MotiveDefectService.pushToMotive(vrl_id);
            if (motiveSyncResult.success === 'OK') {
              console.log(`✅ Motive sync successful: ${motiveSyncResult.message}`);
            } else {
              console.warn(`⚠️ Motive sync warning: ${motiveSyncResult.message}`);
            }
          } catch (motiveError) {
            console.error(`❌ Motive sync failed for defect ${vrl_id}:`, motiveError.message);
            motiveSyncResult = {
              success: 'NOOK',
              message: 'Motive sync failed but defect was approved',
              error: motiveError.message
            };
          }
        }
      } else {
        await connection.commit();
      }

      // 5. Activity log
      await connection.query(
        `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
        [
          roId, userId,
          `Defect ${rpor_id} approved as ${status} by manager ${userName} (ID: ${userId})` +
          (service_completion_date ? ` | Date: ${service_completion_date}` : '') +
          (current_kms             ? ` | KMs: ${current_kms}`             : '')
        ]
      );

      connection.release();

      res.json({
        success: true,
        message: `Defect approved as ${status.replace(/_/g, ' ')}`,
        manager_id: userId,
        manager_name: userName,
        manager_status: 'Approved',
        manager_update_date: new Date().toISOString(),
        motive_sync: motiveSyncResult || null
      });

    } catch (err) {
      await connection.rollback();
      connection.release();
      throw err;
    }
  } catch (error) {
    console.error('Route error in POST /api/repair-orders/:id/approve-defect:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// ROUTE 2 — POST /api/repair-orders/:id/approve-defects-bulk
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/approve-defects-bulk', async (req, res) => {
  try {
    const roId    = parseInt(req.params.id);
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'items array is required'
      });
    }

    // ✅ Each item now carries repair_fixed_on, service_completion_date, current_kms
    const result = await repairOrderService.bulkApproveDefects(roId, items, {
      userId: req.user?.id || 1
    });

    res.json({
      success: true,
      message: `${items.length} defect(s) saved successfully`,
      data: result
    });

  } catch (error) {
    console.error('Route error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});
// ─────────────────────────────────────────────────────────────────────────────
// ROUTE 3 — POST /api/repair-orders/:id/approve-scheduled-maintenance
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/approve-scheduled-maintenance', async (req, res) => {
  try {
    const roId = parseInt(req.params.id);
    const {
      rpor_id,
      vrl_id,
      status,
      scheduled_maintenance_setting_id,
      vehicle_id,
      service_completion_date,
      current_kms,
      setting_name,
      ro_number,
      vendor_name
    } = req.body;

    const userId   = req.user?.id   || 1;
    const userName = req.user?.username || req.user?.name || 'Unknown';

    console.log('📥 Received SM approval request:', {
      rpor_id,
      vrl_id,
      status,
      scheduled_maintenance_setting_id,
      vehicle_id,
      service_completion_date,
      current_kms,
      setting_name,
      roId
    });

    if (!rpor_id || !status || !scheduled_maintenance_setting_id || !vehicle_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'rpor_id, status, scheduled_maintenance_setting_id, and vehicle_id are required' 
      });
    }

    const db = require('../../db/connection');
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      // ── STEP 1: Capture current status ──────────────────────────────────
      const [currentData] = await connection.query(
        `SELECT rpor_status FROM repair_purchase_order_repairs WHERE id = ?`,
        [rpor_id]
      );
      const oldStatus = currentData[0]?.rpor_status;
      const isCompletingSM = (status === 'Completed' || status === 'Repair_Not_Required');

      console.log('📊 Status check:', { oldStatus, isCompletingSM });

      await connection.query(
        `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
        [roId, userId, `[SM Approve] START | rpor_id:${rpor_id} vrl_id:${vrl_id} status:${status} oldStatus:${oldStatus} isCompletingSM:${isCompletingSM} date:${service_completion_date} kms:${current_kms}`]
      );

      // ── STEP 2: Update rpor row ──────────────────────────────────────────
      await connection.query(
        `UPDATE repair_purchase_order_repairs 
         SET rpor_status = ?,
             service_completion_date = COALESCE(?, service_completion_date),
             current_kms = COALESCE(?, current_kms)
         WHERE id = ? AND repair_purchase_order = ?`,
        [status, service_completion_date || null, current_kms || null, rpor_id, roId]
      );

      await connection.query(
        `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
        [roId, userId, `[SM Approve] STEP2 DONE | rpor updated | rpor_id:${rpor_id} status:${status}`]
      );

      // ── STEP 3: Update vehicle_scheduled_maintenance ─────────────────────
      if (isCompletingSM && service_completion_date) {

        await connection.query(
          `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
          [roId, userId, `[SM Approve] STEP3 ENTER VSM block | vehicle_id:${vehicle_id} sm_id:${scheduled_maintenance_setting_id} date:${service_completion_date} kms:${current_kms}`]
        );

        console.log('🔄 Updating vehicle_scheduled_maintenance for:', {
          vehicle_id,
          scheduled_maintenance_setting_id,
          service_completion_date,
          current_kms
        });

        // Check if record exists
        const [existingRecord] = await connection.query(
          `SELECT id FROM vehicle_scheduled_maintenance 
           WHERE vehicle = ? AND scheduled_maintenance = ?`,
          [vehicle_id, scheduled_maintenance_setting_id]
        );

        await connection.query(
          `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
          [roId, userId, `[SM Approve] STEP3 VSM record check | found:${existingRecord.length > 0} | vehicle:${vehicle_id} sm:${scheduled_maintenance_setting_id}`]
        );

        if (existingRecord.length > 0) {
          // Update existing record
          await connection.query(
            `UPDATE vehicle_scheduled_maintenance 
             SET last_maintenance_date = COALESCE(?, last_maintenance_date),
                 last_replaced_km = COALESCE(?, last_replaced_km),
                 effective_date = COALESCE(?, effective_date)
             WHERE vehicle = ? AND scheduled_maintenance = ?`,
            [
              service_completion_date,
              current_kms || null,
              service_completion_date,
              vehicle_id,
              scheduled_maintenance_setting_id
            ]
          );

          console.log('✅ Updated existing vehicle_scheduled_maintenance record');
          await connection.query(
            `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
            [roId, userId, `[SM Approve] STEP3 VSM UPDATED | vehicle:${vehicle_id} sm:${scheduled_maintenance_setting_id} date:${service_completion_date} kms:${current_kms}`]
          );

        } else {
          // No record found — skip, do not insert
          console.log('⚠️ No VSM record found to update for vehicle:', vehicle_id, 'sm:', scheduled_maintenance_setting_id);
          await connection.query(
            `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
            [roId, userId, `[SM Approve] STEP3 VSM NOT FOUND | no record for vehicle:${vehicle_id} sm:${scheduled_maintenance_setting_id} — skipping`]
          );
        }

      } else {
        console.log('⚠️ Skipping VSM update:', { isCompletingSM, hasDate: !!service_completion_date });
        await connection.query(
          `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
          [roId, userId, `[SM Approve] STEP3 SKIPPED VSM | isCompletingSM:${isCompletingSM} hasDate:${!!service_completion_date}`]
        );
      }

      // ── STEP 4: Update VRL row if provided (skip if already approved) ────
      if (vrl_id) {
        const [managerCheck] = await connection.query(
          `SELECT manager_status FROM vehicle_repair_logs WHERE id = ?`,
          [vrl_id]
        );

        if (managerCheck[0]?.manager_status === 'Approved') {
          console.log('⚠️ VRL already approved, skipping VRL update');
          await connection.query(
            `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
            [roId, userId, `[SM Approve] STEP4 VRL SKIPPED | already approved | vrl_id:${vrl_id}`]
          );
        } else {
          await connection.query(
            `UPDATE vehicle_repair_logs 
             SET defect_status = ?,
                 repair_fixed_on = COALESCE(?, repair_fixed_on),
                 manager_status = 'Approved',
                 manager_id = ?,
                 manager_name = ?,
                 manager_update_date = NOW()
             WHERE id = ?`,
            [status, service_completion_date || null, userId, userName, vrl_id]
          );
          console.log('✅ Updated VRL record');
          await connection.query(
            `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
            [roId, userId, `[SM Approve] STEP4 VRL UPDATED | vrl_id:${vrl_id} manager:${userName}(${userId})`]
          );
        }
      } else {
        await connection.query(
          `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
          [roId, userId, `[SM Approve] STEP4 VRL SKIPPED | no vrl_id provided`]
        );
      }

      await connection.commit();

      // ── STEP 5: Activity log ─────────────────────────────────────────────
      await connection.query(
        `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
        [
          roId, userId,
          `[SM Approve] COMPLETE | "${setting_name || scheduled_maintenance_setting_id}" approved as ${status} by ${userName} (ID:${userId})` +
          ` | Vehicle:${vehicle_id}` +
          (service_completion_date ? ` | Date:${service_completion_date}` : '') +
          (current_kms ? ` | KMs:${current_kms}` : '')
        ]
      );

      connection.release();

      res.json({
        success: true,
        message: `Scheduled maintenance "${setting_name || scheduled_maintenance_setting_id}" approved as ${status.replace(/_/g, ' ')}`,
        manager_id: userId,
        manager_name: userName,
        manager_status: 'Approved',
        manager_update_date: new Date().toISOString(),
        vehicle_maintenance_updated: isCompletingSM && !!service_completion_date
      });

    } catch (err) {
      await connection.rollback();
      connection.release();
      console.error('❌ Transaction error:', err);

      // Log the error
      try {
        const db = require('../../db/connection');
        const errConn = await db.getConnection();
        await errConn.query(
          `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
          [roId, userId, `[SM Approve] ❌ TRANSACTION ERROR | ${err.message}`]
        );
        errConn.release();
      } catch (_) {}

      throw err;
    }
  } catch (error) {
    console.error('Route error in POST /api/repair-orders/:id/approve-scheduled-maintenance:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});
/**
 * GET /api/repair-orders/:id/live-km
 * Get live odometer reading from Motive for the vehicle
 */
router.get('/:id/live-km', async (req, res) => {
  try {
    const roId = parseInt(req.params.id);
    
    // Get vehicle unit number from the RO
    const db = require('../../db/connection');
    const [roData] = await db.query(`
      SELECT v.vehicle_nickname, v.vehicle_number, v.id as vehicle_id
      FROM repair_purchase_orders rpo
      JOIN vehicles v ON rpo.vehicle = v.id
      WHERE rpo.id = ?
    `, [roId]);
    
    if (!roData || roData.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Repair order or vehicle not found'
      });
    }
    
    const vehicle = roData[0];
    const unitNumber = vehicle.vehicle_nickname || vehicle.vehicle_number;
    
    if (!unitNumber) {
      return res.status(400).json({
        success: false,
        message: 'Vehicle unit number not found'
      });
    }
    
    // Call Motive service to get live odometer
    const MotiveService = require('../../services/vehicle_maintenance/motiveService');
    const motiveService = new MotiveService();
    
    const result = await motiveService.getVehicleOdometerByUnit(unitNumber);
    
    res.json({
      success: result.success,
      data: {
        kilometers: result.kilometers,
        unit_number: unitNumber,
        source: result.source,
        raw: result.raw
      },
      message: result.message
    });
    
  } catch (error) {
    console.error('Route error in GET /api/repair-orders/:id/live-km:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch live KM from Motive',
      error: error.message
    });
  }
});

/**
 * GET /api/repair-orders/:id/defect-mechanic-check/:vrlId
 * Check if a defect has mechanics assigned with actual hours across ALL repair items
 * One defect → multiple repair items → multiple mechanic assignments each
 */
router.get('/:id/defect-mechanic-check/:vrlId', async (req, res) => {
  try {
    const roId  = parseInt(req.params.id);
    const vrlId = parseInt(req.params.vrlId);

    if (!roId || !vrlId) {
      return res.status(400).json({
        success: false,
        message: 'roId and vrlId are required'
      });
    }

    const db = require('../../db/connection');

    const [rows] = await db.query(`
      SELECT
        ri.id           AS repair_item_id,
        ri.item_name    AS repair_item_name,
        ma.id           AS assignment_id,
        ma.mechanic_name,
        ma.actual_hours,
        rpor.id         AS rpor_id,
        rpor.rpor_status
      FROM vehicle_repair_logs vrl

        INNER JOIN repair_purchase_order_repairs rpor
          ON rpor.repair_log_id = vrl.id
          AND rpor.repair_purchase_order = ?

        INNER JOIN repair_items ri
          ON ri.ro_repair_or_sm_id = rpor.id

        INNER JOIN mechanic_assignments ma
          ON ma.repair_item_id = ri.id

      WHERE vrl.id = ?
        AND ma.actual_hours IS NOT NULL
        AND ma.actual_hours > 0

      ORDER BY ri.id ASC, ma.actual_hours DESC
    `, [roId, vrlId]);

    if (rows.length === 0) {
      return res.json({
        success: true,
        hasHours: false,
        data: null,
        summary: null
      });
    }

    // Group by repair_item so frontend gets a structured breakdown
    const groupedByItem = {};
    let totalHours = 0;

    rows.forEach(row => {
      if (!groupedByItem[row.repair_item_id]) {
        groupedByItem[row.repair_item_id] = {
          repair_item_id:   row.repair_item_id,
          repair_item_name: row.repair_item_name || `Repair Item #${row.repair_item_id}`,
          mechanics:        []
        };
      }
      groupedByItem[row.repair_item_id].mechanics.push({
        assignment_id: row.assignment_id,
        mechanic_name: row.mechanic_name,
        actual_hours:  parseFloat(row.actual_hours)
      });
      totalHours += parseFloat(row.actual_hours);
    });

    return res.json({
      success:  true,
      hasHours: true,
      summary: {
        total_repair_items: Object.keys(groupedByItem).length,
        total_assignments:  rows.length,
        total_hours:        parseFloat(totalHours.toFixed(2))
      },
      data: Object.values(groupedByItem)
    });

  } catch (error) {
    console.error('Route error in GET /api/repair-orders/:id/defect-mechanic-check/:vrlId:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check mechanic assignment',
      error: error.message
    });
  }
});
module.exports = router;
