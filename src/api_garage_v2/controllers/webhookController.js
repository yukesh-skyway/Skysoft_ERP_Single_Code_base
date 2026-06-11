/**
 * Webhook Controller
 * Converted from PHP src/Controllers/roDetailsController.php
 * 
 * Handles webhook requests from external garage management systems
 * 
 * Endpoints:
 * - POST /roDetails/list - List repair orders with filtering
 * - GET /roDetails/details - Get RO details
 * - POST /updateVehicleDefect - Update defect status (legacy)
 * - POST /updateVehicleDefect_v2 - Update defect status (current)
 * - POST /updateRO - Update entire RO
 */

const db = require('../db/connection');
const { logWebhookActivity, logDefectUpdate, logROUpdate, logMotiveSync } = require('../utils/webhookLogger');
const { mapGarageToSkySoft, mapSkySoftToMotive } = require('../utils/statusMapper');
const { pushToMotive, isMotiveEnabled } = require('../utils/motiveApi');
const { formatUtcToMysql, formatPhpLogTime } = require('../utils/reuseUtils');
const vrlCreationService = require('./Vrlcreationservice');
 const { handleQuickJobROCreation } = require('./handleQuickJobROCreation');
 const { updateVehicleBusVisitStatus } = require('./busVisitService');
/**
 * Format date to match PHP format
 * DATETIME: YYYY-MM-DD HH:MM:SS (2026-03-17 09:46:18)
 * DATE: YYYY-MM-DD (2026-03-09)
 */
function formatDateForPHP(date, dateOnly = false) {
  if (!date) return null;
  
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  
  if (dateOnly) {
    return `${year}-${month}-${day}`;
  }
  
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * List repair orders with filtering and pagination
 * 
 * POST /roDetails/list
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
async function list(req, res) {
  try {
    const userId = req.apiToken.userId;
    const {
      pageno = 1,
      per_page = 20,
      keyword = '',
      vehicle = '',
      status = '',
      vendor = '',
      created_on_start = '',
      created_on_end = ''
    } = req.body;

    // Build WHERE clauses
    const whereClauses = [];
    const queryParams = [];

    whereClauses.push('rpo.id != ?');
    queryParams.push(0);

    if (status) {
      whereClauses.push('rpo.status = ?');
      queryParams.push(status);
    }

    if (vehicle) {
      whereClauses.push('rpo.vehicle = ?');
      queryParams.push(vehicle);
    }

    if (vendor) {
      whereClauses.push('rpo.vendor = ?');
      queryParams.push(vendor);
    }

    if (created_on_start) {
      whereClauses.push('rpo.created_on >= ?');
      queryParams.push(`${created_on_start} 00:00:00`);
    }

    if (created_on_end) {
      whereClauses.push('rpo.created_on <= ?');
      queryParams.push(`${created_on_end} 23:59:59`);
    }

    if (keyword) {
      whereClauses.push(`(
        rpo.id LIKE ? OR 
        rpo.work_order_number LIKE ? OR 
        rpo.invoice_number LIKE ? OR 
        rpo.payment_notes LIKE ? OR 
        rpo.repair_notes LIKE ?
      )`);
      const likeKeyword = `%${keyword}%`;
      queryParams.push(likeKeyword, likeKeyword, likeKeyword, likeKeyword, likeKeyword);
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Count total records
    const countQuery = `
      SELECT COUNT(*) as total
      FROM repair_purchase_orders rpo
      ${whereClause}
    `;

    const [countResult] = await db.query(countQuery, queryParams);
    const totalRecordCount = countResult[0].total;
    const totalPages = Math.ceil(totalRecordCount / per_page);

    // Calculate offset
    const offset = (pageno - 1) * per_page;

    // Fetch paginated data
    const dataQuery = `
      SELECT 
        rpo.*,
        v.vehicle_nickname,
        rpo.status as rpostatus,
        ve.vendor_name,
        rpo.id as rpoid,
        u1.fullname as requested_by_name,
        pm.payment_method as payment_method_name
      FROM repair_purchase_orders rpo
      LEFT JOIN payment_methods pm ON rpo.payment_method = pm.id
      LEFT JOIN vehicles v ON v.id = rpo.vehicle
      LEFT JOIN vendors ve ON ve.id = rpo.vendor
      LEFT JOIN users u1 ON u1.id = rpo.requested_by
      LEFT JOIN users u2 ON u2.id = rpo.verification_handled_by
      ${whereClause}
      ORDER BY rpo.created_on DESC
      LIMIT ? OFFSET ?
    `;

    const [rolist] = await db.query(dataQuery, [...queryParams, per_page, offset]);

    // ✅ Format dates to match PHP format
    const formattedRows = rolist.map(row => {
      const formatted = { ...row };
      
      // Format created_on (DATETIME) → "2026-03-17 09:46:18"
      if (formatted.created_on) {
        formatted.created_on = formatDateForPHP(formatted.created_on, false);
      }
      
      // Format service_completed_date (DATE) → "2026-03-09"
      if (formatted.service_completed_date) {
        formatted.service_completed_date = formatDateForPHP(formatted.service_completed_date, true);
      }
      
      // Format verified_time (DATETIME) → "2026-03-17 09:46:18"
      if (formatted.verified_time) {
        formatted.verified_time = formatDateForPHP(formatted.verified_time, false);
      }
      
      return formatted;
    });

    // Log activity
    await logWebhookActivity(req, `List RO - Page ${pageno}`, {
      additionalData: { totalRecords: totalRecordCount, filters: req.body }
    });

    // ✅ Match PHP response format exactly
    return res.json({
      page: parseInt(pageno),
      per_page: parseInt(per_page),
      filters: {
        keyword: keyword,
        vehicle: vehicle,
        status: status,
        vendor: vendor,
        created_on_start: created_on_start,
        created_on_end: created_on_end
      },
      data: {
        user_id: userId,
        rows: formattedRows,
        total: String(totalRecordCount),
        total_pages: totalPages
      },
      status: 'OK'
    });
  } catch (error) {
    console.error('❌ Error in list():', error);
    return res.status(500).json({
      success: false,
      status: 'NOOK',
      error: error.message
    });
  }
}

/**
 * Get RO details
 * 
 * GET /roDetails/details?roid=1960
 */
async function details(req, res) {
  try {
    const userId = req.apiToken.userId;
    const { roid } = req.query;

    if (!roid) {
      return res.status(400).json({
        success: false,
        status: 'NOOK',
        error: 'Missing roid parameter'
      });
    }

    // Get RO details
    const roQuery = `
      SELECT 
        rpo.*,
        vt.vehicle_type,
        v.vehicle_nickname,
        ve.vendor_phone,
        rpo.status as rpostatus,
        rpo.id as rpoid,
        u1.fullname as requested_by_name,
        ve.vendor_name,
        ve.vendor_email,
        pm.payment_method
      FROM repair_purchase_orders rpo
      LEFT JOIN vehicles v ON v.id = rpo.vehicle
      LEFT JOIN vehicletypes vt ON vt.id = v.vehicle_type
      LEFT JOIN users u1 ON u1.id = rpo.requested_by
      LEFT JOIN vendors ve ON ve.id = rpo.vendor
      LEFT JOIN payment_methods pm ON pm.id = rpo.payment_method
      WHERE rpo.id = ?
    `;

    const [roResults] = await db.query(roQuery, [roid]);

    if (!roResults || roResults.length === 0) {
      return res.status(404).json({
        success: false,
        status: 'NOOK',
        error: 'RO not found'
      });
    }

    const rodetails = roResults[0];

    // Get RO attachments
    const [roAttachments] = await db.query(
      'SELECT * FROM ro_attachments WHERE ro_id = ?',
      [roid]
    );

    const attachments = roAttachments.map(att => ({
      filename: att.filename_original,
      file_url: `${process.env.BASE_URL || ''}/${roid}/${att.filename}`
    }));

    // Get repairs details (includes both repairs and scheduled maintenance)
    const repairsQuery = `
      SELECT 
        rpor.*,
        scs.setting_name,
        rcc.repair_code_category,
        vrl.repair_desc,
        vrl.defect_status,
        vrl.issue_type,
        vrl.motive_record_id,
        vrl.motive_defect_id,
        vrl.motive_defect_status,
        vrl.defect_source,
        vrl.notes,
        rpor.rpor_status
      FROM repair_purchase_order_repairs rpor
      LEFT JOIN vehicle_repair_logs vrl ON rpor.repair_log_id = vrl.id
      LEFT JOIN repair_code_categories rcc ON rcc.id = vrl.repair_code_category
      LEFT JOIN scheduled_configuration_settings scs ON scs.id = rpor.scheduled_maintenance_setting_id
      WHERE rpor.repair_purchase_order = ?
    `;

    const [roRepairs] = await db.query(repairsQuery, [roid]);

    const roRepairsList = roRepairs.map(repair => ({
      repair_id: repair.id,
      ...(repair.item_type === 'SCHEDULED_MAINTENANCE' && {
        sm_id: repair.scheduled_maintenance_setting_id,
        setting_name: repair.setting_name
      }),
      defect_id: repair.repair_log_id,
      item_type: repair.item_type,
      repair_code_category: repair.repair_code_category,
      repair_desc: repair.repair_desc,
      defect_source: repair.defect_source,
      issue_type: repair.issue_type,
      defect_status: repair.defect_status,
      motive_record_id: repair.motive_record_id,
      motive_defect_id: repair.motive_defect_id,
      motive_defect_status: repair.motive_defect_status,
      motive_def_unique_id: repair.motive_def_unique_id || null,
      motive_defect_trigger: repair.motive_defect_trigger || null,
      motive_vehicle_id: repair.motive_vehicle_id || null,
      is_duplicate: repair.is_duplicate || null,
      merged_records_id: repair.merged_records_id || null,
      re_open_count: repair.re_open_count || null,
      previous_ro_id: repair.previous_ro_id || null,
      notes: repair.notes || ''
    }));

    // Get maintenance logs
    const logsQuery = `
      SELECT 
        vml.*,
        u.id as user_id,
        u.fullname,
        u.middlename,
        u.lastname,
        u.nickname
      FROM vm_logs vml
      LEFT JOIN users u ON vml.user_id = u.id
      WHERE vml.ro_id = ?
      ORDER BY vml.log_time ASC
    `;

    const [roMaintainLog] = await db.query(logsQuery, [roid]);

    const roMaintainLogList = roMaintainLog.map(log => {
      let loggedUser = '';
      if (log.nickname) loggedUser += `(${log.nickname}) `;
      if (log.fullname) loggedUser += log.fullname;
      if (log.middlename) loggedUser += ` ${log.middlename}`;
      if (log.lastname) loggedUser += ` ${log.lastname}`;

      return {
        log_time: formatPhpLogTime(log.log_time), // 🔴 CRITICAL FIX: Use PHP format "Mar 17, 26 - 3:45 PM"
        log_data: log.log_data,
        log_by: loggedUser.trim()
      };
    });

    // Log activity
    await logWebhookActivity(req, `Get RO Details - RO #${roid}`);

    return res.json({
      success: true,
      status: 'OK',
      user_id: userId,
      rodetails: {
        status: 'OK',
        data: {
          rodetails,
          ro_attachments: attachments,
          ro_repairs: roRepairsList,
          ro_maintainance_logs: roMaintainLogList
        }
      }
    });
  } catch (error) {
    console.error('❌ Error in details():', error);
    return res.status(500).json({
      success: false,
      status: 'NOOK',
      error: error.message
    });
  }
}

/**
 * Update Vehicle Defect (v2 - Current Version)
 * 
 * POST /updateVehicleDefect_v2
 * 
 * Handles updates for both regular defects and scheduled maintenance
 * Supports merge group handling for defects
 */
async function updateVehicleDefect_v2(req, res) {
  try {

    
    const userId = req.apiToken.userId;
    const postJsonData = req.body;
const rawLog = { ...postJsonData }; // ← snapshot immediately, top of function
    if (!postJsonData || Object.keys(postJsonData).length === 0) {
      return res.status(400).json({
        success: false,
        status: 'NOOK',
        error: 'Missing required fields'
      });
    }

    ///////////// Yukesh Event type : Repair_Item_Add / Repair_Item_Remove
///////////// Yukesh Event type : Repair_Item_Add / Repair_Item_Remove
const event_type = postJsonData.event_type || null;
const ro_id = postJsonData.roid || null;

    // ← LOG HERE: all variables declared, before any early returns
    await logWebhookActivity(req, `Garage Module API - Incoming request RO ${ro_id} event: ${event_type || 'unknown'}`, {
      rawLog
    });
if (event_type === 'Repair_Item_Add' || event_type === 'Repair_Item_Remove' || event_type === 'Perform_Repair_Work_Remove'|| event_type === 'Perform_Repair_Work_Add') {
  return require('./events/handleRepairItem')(req, res);
}
if (event_type === 'Mechanic_Assignment_Added' || event_type === 'Mechanic_Assignment_Removed') {
  return require('./events/handleMechanicAssignment')(req, res);
}
if (event_type === 'Defect_Remove') {
  return require('./events/handleDefectRemove')(req, res);
}

    
    const defect_id = postJsonData.defectid || null;
    const sm_id = postJsonData.sm_id || null;

    // Validate required fields
    if (!ro_id) {
      return res.status(400).json({
        success: false,
        status: 'NOOK',
        error: 'Missing RO ID or Defect/SM Ids'
      });
    }

    // Check if RO exists
    const [roResults] = await db.query(
      'SELECT * FROM repair_purchase_orders WHERE id = ?',
      [ro_id]
    );

    if (!roResults || roResults.length === 0) {
      await db.query(
        `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
        [ro_id, userId, `Garage Update defect API Call - RO ID: ${ro_id} - Missing RO Id`]
      );

      return res.status(404).json({
        success: false,
        status: 'NOOK',
        error: 'Missing RO Id'
      });
    }




// All other events (or no event_type) fall through to existing v2 logic below
// OLD v2 logic below is now completely unreachable — can be cleaned up later

    // Extract update data
    const workOrderNumber = postJsonData.work_order_number || null;
    const workOrderStatus = postJsonData.work_order_status || null;
    const invoiceNumber = postJsonData.invoice_number || null;
    const currentKms = postJsonData.current_kms || null;
    const serviceCompletionDate = postJsonData.service_completion_date || null;
    const invoiceAmount = postJsonData.invoice_amount || null;
    const invoiceUrl = postJsonData.invoice_url || null;

    const defects = [postJsonData.defects_details || {}];

    // ADD THIS:
// Extract additional defects from nested work_orders
if (postJsonData.repair_items && Array.isArray(postJsonData.repair_items)) {
  for (const repairItem of postJsonData.repair_items) {
    if (repairItem.work_orders && repairItem.work_orders.defects && Array.isArray(repairItem.work_orders.defects)) {
      for (const nestedDefect of repairItem.work_orders.defects) {
        // Only add if not already in defects array
        if (!defects.some(d => d.defect_id === nestedDefect.defect_id)) {
          defects.push(nestedDefect);
          console.log(`✅ Added nested defect: ${nestedDefect.defect_id} (external: ${nestedDefect.external_defect_id})`);
        }
      }
    }
  }
}

console.log(`\n📊 Processing ${defects.length} total defects...`);

// ═════════════════════════════════════════════════════════════════════════════════
    // 🔴 STEP 1: VRL CREATION - Handle NEW Garage defects (external_defect_id is null)
    // Defect_Add event → uses garage_finding_id from defects_details
    // Other events    → uses existing external_defect_id null check
    // ═════════════════════════════════════════════════════════════════════════════════
    
    const newDefects = defects.filter(d => !d.external_defect_id || d.external_defect_id === null);
    const existingDefects = defects.filter(d => d.external_defect_id && d.external_defect_id > 0);

    const roVehicleId = roResults[0].vehicle || null;

const vrlCreationResults = {
  created: [],
  skipped: [],
  failed: []
};

    const defectsToProcess = event_type === 'Defect_Add' ||
  event_type === 'Repair_item_add_Supplementary'
      ? [postJsonData.defects_details || {}]
      : newDefects;

if (
  event_type === 'Defect_Add' ||
  event_type === 'Repair_item_add_Supplementary' ||
  newDefects.length > 0
) {
  for (const newDefect of defectsToProcess) {
    try {
      newDefect.work_order_number = workOrderNumber;
      newDefect.repair_items_payload = postJsonData.repair_items || []; // ← fix here
const vrlResult = await vrlCreationService.createVRLFromGarageDefect(
  newDefect, ro_id, roVehicleId, req
);

if (vrlResult.skipped && vrlResult.reason === 'duplicate') {
  vrlCreationResults.skipped.push(vrlResult);
  console.log(`⏭️ Skipped duplicate VRL for defect ${vrlResult.external_garage_defect_id} (existing VRL ID: ${vrlResult.existing_vrl_id})`);
} else {
  vrlCreationResults.created.push(vrlResult);
  console.log(`✅ VRL Created: ID ${vrlResult.vrl_id}`);
}
    } catch (error) {
      vrlCreationResults.failed.push({
        external_defect_id: newDefect.external_defect_id || newDefect.garage_finding_id,
        error: error.message
      });
      
      await db.query(
        `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
        [ro_id, userId, `VRL Creation Error: ${error.message}`]
      );
    }
  }

  if (event_type === 'Defect_Add' || event_type === 'Repair_item_add_Supplementary') {
    return res.json({
      success: true,
      status: 'OK',
      event_type: event_type,
      vrl_creation: vrlCreationResults
    });
  }
}

    // ═════════════════════════════════════════════════════════════════════════════════
    // Group defects by RO (separate defects vs SM)
    const defectsByRO = {};
    const smsByRO = {};

for (const defect of existingDefects) {  // ← only existing defects
  const roId    = defect.external_ro_id || ro_id || null;
  if (!roId) continue;

  const defectId = defect.defect_id || null;
  const smId     = defect.sm_id     || null;

  if (defectId && !isNaN(defectId) && defectId > 0) {
    if (!defectsByRO[roId]) defectsByRO[roId] = [];
    defectsByRO[roId].push(defect);

    // ← If sm_id also present, ALSO add to smsByRO so VSM gets updated
    if (smId && !isNaN(smId) && smId > 0) {
      if (!smsByRO[roId]) smsByRO[roId] = [];
      smsByRO[roId].push(defect);
    }

  } else if (smId && !isNaN(smId) && smId > 0) {
    if (!smsByRO[roId]) smsByRO[roId] = [];
    smsByRO[roId].push(defect);
  }
}


    // Process each RO
    const allROs = [...new Set([
      ...Object.keys(defectsByRO),
      ...Object.keys(smsByRO)

    ])];

    const defectsProcessed = {};
    const combinedError = [];
// ─── Capture BEFORE state for audit log ───────────────────────────────────────
const oldValue = {};
for (const roId of allROs) {
  const defectIds = (defectsByRO[roId] || []).map(d => d.defect_id);
  const smIds     = (smsByRO[roId]     || []).map(s => s.sm_id);

  const rows = [];
  if (defectIds.length > 0) {
    const [r] = await db.query(
      `SELECT repair_log_id, scheduled_maintenance_setting_id,
              rpor_status, invoice_status, labor_cost, parts_cost,
              total_cost, current_kms,service_completion_date, work_order_number,
              work_order_status, invoice_number, invoice_amount
       FROM repair_purchase_order_repairs
       WHERE repair_purchase_order = ? AND repair_log_id IN (${defectIds.map(() => '?').join(',')})`,
      [roId, ...defectIds]
    );
    rows.push(...r);
  }
  if (smIds.length > 0) {
    const [r] = await db.query(
      `SELECT repair_log_id, scheduled_maintenance_setting_id,
              rpor_status, invoice_status, labor_cost, parts_cost,
              total_cost, current_kms,service_completion_date, work_order_number,
              work_order_status, invoice_number, invoice_amount
       FROM repair_purchase_order_repairs
       WHERE repair_purchase_order = ? AND scheduled_maintenance_setting_id IN (${smIds.map(() => '?').join(',')})`,
      [roId, ...smIds]
    );
    rows.push(...r);
  }
  if (rows.length > 0) oldValue[roId] = rows;
}
// ──────────────────────────────────────────────────────────────────────────────
    for (const roId of allROs) {
      // Process defects
      if (defectsByRO[roId]) {
        for (const defect of defectsByRO[roId]) {
          // Check if defect belongs to this RO
          const [defectCheck] = await db.query(
            'SELECT * FROM repair_purchase_order_repairs WHERE repair_purchase_order = ? AND repair_log_id = ?',
            [roId, defect.defect_id]
          );

          if (!defectCheck || defectCheck.length === 0) {
            const errorMsg = `Skipping - Invalid Defect Id and RO id combination. Defect ${defect.defect_id} is not assigned to RO ${roId}`;
            combinedError.push(errorMsg);

            await db.query(
              `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
              [ro_id, userId, `Garage Update defect API Call - RO ID: ${ro_id} ${errorMsg}`]
            );
            continue;
          }

          if (!defectsProcessed[roId]) defectsProcessed[roId] = { defects: [], sm: [] };
          defectsProcessed[roId].defects.push(defect.defect_id);

          // Process single defect
        // Inject top-level payload fields into defect object if missing
// so VSM block inside processSingleDefectV2 has access to them
if (!defect.current_kms && currentKms)                     defect.current_kms = currentKms;
if (!defect.completion_date && postJsonData.completion_date) defect.completion_date = postJsonData.completion_date;
if (!defect.service_completion_date && serviceCompletionDate) defect.service_completion_date = serviceCompletionDate;

await processSingleDefectV2(defect, roId, userId);

          // Update repair purchase order repairs with additional data
          const repairPORData = {};
          if (workOrderNumber) repairPORData.work_order_number = workOrderNumber;
          if (workOrderStatus) repairPORData.work_order_status = workOrderStatus;
          if (invoiceNumber) repairPORData.invoice_number = invoiceNumber;
          if (currentKms) repairPORData.current_kms = currentKms;
          if (serviceCompletionDate) {
          repairPORData.service_completion_date = formatUtcToMysql(serviceCompletionDate, null, true);
          }
          if (invoiceAmount) repairPORData.invoice_amount = invoiceAmount;
          if (invoiceUrl) repairPORData.invoice_url = invoiceUrl;

          if (Object.keys(repairPORData).length > 0) {
            const updateFields = Object.keys(repairPORData).map(k => `${k} = ?`).join(', ');
            const updateValues = Object.values(repairPORData);

            await db.query(
              `UPDATE repair_purchase_order_repairs SET ${updateFields} WHERE repair_purchase_order = ? AND repair_log_id = ?`,
              [...updateValues, roId, defect.defect_id]
            );

            await db.query(
              `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
              [ro_id, userId, `Garage Update defect API Call - RO ID: ${ro_id} - Updated WO, Invoice and other details for Defect ${defect.defect_id}`]
            );
          }
        }
      }

      // Process Scheduled Maintenance
      if (smsByRO[roId]) {
        for (const sm of smsByRO[roId]) {
          // Check if SM belongs to this RO
          const [smCheck] = await db.query(
            'SELECT * FROM repair_purchase_order_repairs WHERE repair_purchase_order = ? AND scheduled_maintenance_setting_id = ?',
            [roId, sm.sm_id]
          );

          if (!smCheck || smCheck.length === 0) {
            const errorMsg = `Skipping - Invalid SM Id and RO id combination. SM ${sm.sm_id} is not assigned to RO ${roId}`;
            combinedError.push(errorMsg);

            await db.query(
              `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
              [ro_id, userId, `Garage Update defect API Call - RO ID: ${ro_id} ${errorMsg}`]
            );
            continue;
          }

          if (!defectsProcessed[roId]) defectsProcessed[roId] = { defects: [], sm: [] };
          defectsProcessed[roId].sm.push(`${sm.name} - ${sm.sm_id}`);

          // Process single SM
          // Inject top-level fields into sm object if missing
if (!sm.current_kms && currentKms)                       sm.current_kms = currentKms;
if (!sm.completion_date && postJsonData.completion_date)   sm.completion_date = postJsonData.completion_date;
if (!sm.service_completion_date && serviceCompletionDate)  sm.service_completion_date = serviceCompletionDate;
          await processSingleSM(sm, roId, userId);

          // Update repair purchase order repairs with additional data
          const repairPORData = {};
          if (workOrderNumber) repairPORData.work_order_number = workOrderNumber;
          if (workOrderStatus) repairPORData.work_order_status = workOrderStatus;
          if (invoiceNumber) repairPORData.invoice_number = invoiceNumber;
          if (currentKms) repairPORData.current_kms = currentKms;
          if (serviceCompletionDate) {
      // In updateVehicleDefect_v2 — SM block  
repairPORData.service_completion_date = formatUtcToMysql(serviceCompletionDate, null, true);
          }
          if (invoiceAmount) repairPORData.invoice_amount = invoiceAmount;
          if (invoiceUrl) repairPORData.invoice_url = invoiceUrl;

          if (Object.keys(repairPORData).length > 0) {
            const updateFields = Object.keys(repairPORData).map(k => `${k} = ?`).join(', ');
            const updateValues = Object.values(repairPORData);

            await db.query(
              `UPDATE repair_purchase_order_repairs SET ${updateFields} WHERE repair_purchase_order = ? AND scheduled_maintenance_setting_id = ?`,
              [...updateValues, roId, sm.sm_id]
            );

            await db.query(
              `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
              [ro_id, userId, `Garage Update defect API Call - RO ID: ${ro_id} - Updated WO, Invoice and other details for SM ${sm.name} - ${sm.sm_id}`]
            );
          }
        }
      }


    }

    // Check and update RO status if all defects/SMs are completed
    await checkAndUpdateRODetails(ro_id, postJsonData, db, userId);

// ─── Capture AFTER state for audit log ────────────────────────────────────────
const newValue = {};
for (const roId of allROs) {
  const defectIds = (defectsByRO[roId] || []).map(d => d.defect_id);
  const smIds     = (smsByRO[roId]     || []).map(s => s.sm_id);

  const rows = [];
  if (defectIds.length > 0) {
    const [r] = await db.query(
      `SELECT repair_log_id, scheduled_maintenance_setting_id,
              rpor_status, invoice_status, labor_cost, parts_cost,
              total_cost, current_kms,service_completion_date, work_order_number,
              work_order_status, invoice_number, invoice_amount
       FROM repair_purchase_order_repairs
       WHERE repair_purchase_order = ? AND repair_log_id IN (${defectIds.map(() => '?').join(',')})`,
      [roId, ...defectIds]
    );
    rows.push(...r);
  }
  if (smIds.length > 0) {
    const [r] = await db.query(
      `SELECT repair_log_id, scheduled_maintenance_setting_id,
              rpor_status, invoice_status, labor_cost, parts_cost,
              total_cost, current_kms,service_completion_date, work_order_number,
              work_order_status, invoice_number, invoice_amount
       FROM repair_purchase_order_repairs
       WHERE repair_purchase_order = ? AND scheduled_maintenance_setting_id IN (${smIds.map(() => '?').join(',')})`,
      [roId, ...smIds]
    );
    rows.push(...r);
  }
  if (rows.length > 0) newValue[roId] = rows;
}
// ──────────────────────────────────────────────────────────────────────────────

    // Build response message
    let processedSMDefectMsg = '';
    if (allROs.length > 0 && Object.keys(defectsProcessed).length > 0) {
      processedSMDefectMsg = `RO ${ro_id} and their defects/SMs ${JSON.stringify(defectsProcessed)} updated successfully`;
    } else {
      processedSMDefectMsg = `RO ${ro_id} and NO defects/SMs were updated`;
    }

    if (combinedError.length > 0) {
      processedSMDefectMsg += '\n' + combinedError.join('\n');
    }
console.log('🔍 postJsonData keys:', postJsonData ? Object.keys(postJsonData) : 'NULL');

    // Log to activity log
    await logWebhookActivity(req, `Garage Module API - ${processedSMDefectMsg}`, {
      oldValue,
      newValue,
      rawLog
    });

    return res.json({
      success: true,
      status: 'OK',
      message: processedSMDefectMsg,
      vrl_creation: vrlCreationResults  // ← ADD THIS LINE
    });
  } catch (error) {
    console.error('❌ Error in updateVehicleDefect_v2():', error);
    return res.status(500).json({
      success: false,
      status: 'NOOK',
      message: error.message
    });
  }
}




/**
 * Update RO (Full RO update)
 * POST /updateRO
 * 
 * 🔴 CRITICAL FIX: Now processes defects, SMs, and repair items (not just RO fields)
 * 🔴 FIX #3: Wrapped entire operation in DB transaction with rollback on failure
 * 
 * Body:
 * {\n *   \"external_ro_id\": 1960,
 *   \"work_order_number\": \"WO-2025-104\",
 *   \"work_order_status\": \"Completed\",
 *   \"invoice_number\": \"INV-123\",
 *   \"invoice_amount\": 1500.00,
 *   \"invoice_url\": \"https://...\",
 *   \"current_kms\": 45000,
 *   \"service_completion_date\": \"2025-01-15T14:30:00Z\",
 *   \"defects\": [...],  // Array of defects to update
 *   \"sms\": [...],      // Array of scheduled maintenance items to update
 *   \"repair_items\": [...] // Array of repair items (parts/labor)
 * }\n */
async function updateRO(req, res) {
  // 🔴 FIX #3: Get connection and start transaction
  const conn = await db.getConnection();
  
  try {
    await conn.beginTransaction();
    
    const userId = req.apiToken.userId;
    const postJsonData = req.body;

    if (!postJsonData || Object.keys(postJsonData).length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({
        success: false,
        status: 'NOOK',
        error: 'Missing required fields'
      });
    }

    const external_ro_id = postJsonData.external_ro_id || null;

    if (!external_ro_id) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({
        success: false,
        status: 'NOOK',
        error: 'Missing external_ro_id'
      });
    }

    // Check if RO exists
    const [roResults] = await conn.query(
      'SELECT * FROM repair_purchase_orders WHERE id = ?',
      [external_ro_id]
    );

    if (!roResults || roResults.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({
        success: false,
        status: 'NOOK',
        error: `RO with ID ${external_ro_id} not found`
      });
    }

    // Build update data for repair_purchase_orders table
    const updateData = {};
    if (postJsonData.work_order_number) updateData.work_order_number = postJsonData.work_order_number;
    if (postJsonData.work_order_status) updateData.work_order_status = postJsonData.work_order_status;
    if (postJsonData.invoice_number) updateData.invoice_number = postJsonData.invoice_number;
    if (postJsonData.invoice_amount) updateData.invoice_amount = postJsonData.invoice_amount;
    if (postJsonData.invoice_url) updateData.invoice_url = postJsonData.invoice_url;
    if (postJsonData.current_kms) updateData.current_kms = postJsonData.current_kms;
    if (postJsonData.service_completion_date) {
      updateData.service_completion_date = formatUtcToMysql(postJsonData.service_completion_date, null, true);
    }

    // Update repair_purchase_orders if there are fields to update
    if (Object.keys(updateData).length > 0) {
      const updateFields = Object.keys(updateData).map(k => `${k} = ?`).join(', ');
      const updateValues = Object.values(updateData);

      await conn.query(
        `UPDATE repair_purchase_orders SET ${updateFields} WHERE id = ?`,
        [...updateValues, external_ro_id]
      );

      await conn.query(
        `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
        [external_ro_id, userId, `Garage Module API - Updated RO ${external_ro_id} basic fields: ${Object.keys(updateData).join(', ')}`]
      );
    }

    // 🔴 CRITICAL FIX: Process defects array
    const defects = postJsonData.defects || [];
    const defectsProcessed = [];
    
    for (const defect of defects) {
      try {
        if (defect.defect_id) {
          await processSingleDefectV2(defect, external_ro_id, userId, conn);
          defectsProcessed.push(defect.defect_id);
        }
      } catch (error) {
        console.error(`❌ Error processing defect ${defect.defect_id}:`, error);
        await conn.query(
          `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
          [external_ro_id, userId, `Garage Module API - ERROR processing defect ${defect.defect_id}: ${error.message}`]
        );
      }
    }

    // 🔴 CRITICAL FIX: Process scheduled maintenance array
    const sms = postJsonData.sms || [];
    const smsProcessed = [];
    
    for (const sm of sms) {
      try {
        if (sm.sm_id) {
          await processSingleSM(sm, external_ro_id, userId, conn);
          smsProcessed.push(`${sm.name || 'SM'}-${sm.sm_id}`);
        }
      } catch (error) {
        console.error(`❌ Error processing SM ${sm.sm_id}:`, error);
        await conn.query(
          `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
          [external_ro_id, userId, `Garage Module API - ERROR processing SM ${sm.sm_id}: ${error.message}`]
        );
      }
    }

    // 🔴 CRITICAL FIX: Process repair items array
    const repairItems = postJsonData.repair_items || [];
    const repairItemsProcessed = [];
    
    for (const item of repairItems) {
      try {
        const itemId = await processSingleRepairItem(item, external_ro_id, userId, conn);
        repairItemsProcessed.push(itemId);
      } catch (error) {
        console.error(`❌ Error processing repair item:`, error);
        await conn.query(
          `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
          [external_ro_id, userId, `Garage Module API - ERROR processing repair item: ${error.message}`]
        );
      }
    }

    // 🔴 CRITICAL FIX: Call checkAndUpdateRODetails to handle status/invoice updates
    
    await checkAndUpdateRODetails(external_ro_id, postJsonData, conn, userId);

    // Log comprehensive update
    await logROUpdate(req, external_ro_id, {
      old: roResults[0],
      new: updateData,
      type: 'full',
      itemsUpdated: Object.keys(updateData).length,
      defectsProcessed: defectsProcessed.length,
      smsProcessed: smsProcessed.length,
      repairItemsProcessed: repairItemsProcessed.length
    });

    // 🔴 FIX #3: Commit transaction
    await conn.commit();
    conn.release();

    return res.json({
      success: true,
      status: 'OK',
      message: `RO ${external_ro_id} updated successfully`,
      summary: {
        ro_fields_updated: Object.keys(updateData).length,
        defects_processed: defectsProcessed.length,
        sms_processed: smsProcessed.length,
        repair_items_processed: repairItemsProcessed.length
      }
    });
  } catch (error) {
    console.error('❌ Error in updateRO():', error);
    // 🔴 FIX #3: Rollback transaction on error
    await conn.rollback();
    conn.release();
    return res.status(500).json({
      success: false,
      status: 'NOOK',
      error: error.message
    });
  }
}

// ============================================================================
// HELPER FUNCTIONS (Private)
// ============================================================================

/**
 * Process single defect update (v2)
 * Handles merge group logic and status mapping
 * 
 * @param {Object} defect - Defect data object
 * @param {number} externalRoId - External RO ID
 * @param {number} userId - User ID performing the update
 * @param {Object} dbConn - Database connection (defaults to global pool, pass transaction conn for rollback support)
 */
/**
 * Process single defect update (v2) - WITH SMART DISENGAGEMENT
 * 
 * ✅ NEW LOGIC: When disengagement triggered:
 * 1. Count remaining active rpor records in this RO
 * 2. If ONLY 1 rpor (this one) → Trigger CANCEL RO process
 * 3. If MORE than 1 rpor → Trigger HARD DELETE (just this defect)
 * 
 * This ensures:
 * - Single-defect ROs get fully cancelled when last item disengages
 * - Multi-defect ROs stay active, just remove the disengaged item
 */

async function processSingleDefectV2(defect, externalRoId, userId, dbConn = db) {
  const defectId = defect.defect_id || null;
  const defectStatus = defect.status || null;

  if (!defectId || isNaN(defectId) || defectId <= 0) {
    throw new Error(`Invalid defect_id: ${defectId}`);
  }

  // Check if defect exists in RO
  const [checkResult] = await dbConn.query(
    'SELECT id FROM repair_purchase_order_repairs WHERE repair_purchase_order = ? AND repair_log_id = ?',
    [externalRoId, defectId]
  );

  if (!checkResult || checkResult.length === 0) {
    throw new Error(`Defect and RO combination not found: RO: ${externalRoId}, Defect: ${defectId}`);
  }

  // Get merge group for this defect
  const [mergeResult] = await dbConn.query(
    'SELECT merged_records_id, defect_source FROM vehicle_repair_logs WHERE id = ?',
    [defectId]
  );

  const mergeGroup = mergeResult[0]?.merged_records_id || null;
  const defectSource = mergeResult[0]?.defect_source || null;

  // Get all defects in merge group
  let defectsIdsToUpdate = [defectId];
  if (mergeGroup !== null && mergeGroup !== '') {
    const [mergedDefects] = await dbConn.query(
      'SELECT id FROM vehicle_repair_logs WHERE merged_records_id = ?',
      [mergeGroup]
    );
    defectsIdsToUpdate = mergedDefects.map(d => d.id);
  }

  // Extract disengagement fields EARLY (used in both normal and Disengaged paths)
  const disengageReason = defect.disengage_reason || null;
  const disengageNotes = defect.disengage_notes || null;
  const disengagedAt = defect.disengaged_at 
    ? formatUtcToMysql(defect.disengaged_at) 
    : formatUtcToMysql();  // ✅ Auto-generate NOW() if missing

  // ═══════════════════════════════════════════════════════════════════════════════
  // SPECIAL PATH: Status = 'Disengaged', 'SR_DISENGAGED', 'SR_CANCELLED' OR disengage_reason present
  // 
  // Triggered by:
  // 1. Perform Repair Tab: status = " " (space/empty), disengage_reason present
  // 2. Service Request Tab: status = "SR_DISENGAGED", disengage_reason present
  // 3. Service Request Tab: status = "SR_CANCELLED", disengage_reason present
  // ═══════════════════════════════════════════════════════════════════════════════
  if (defectStatus === 'Disengaged' || 
      defectStatus === 'SR_DISENGAGED' || 
      defectStatus === 'SR_CANCELLED' ||
      disengageReason) {  // ← KEY: If disengage_reason exists, it's disengaged
    
    // 🔴 SMART DECISION: Count remaining rpor records in this RO
    const [rporCountResult] = await dbConn.query(
      'SELECT COUNT(*) as total FROM repair_purchase_order_repairs WHERE repair_purchase_order = ?',
      [externalRoId]
    );
    
    const totalRporCount = rporCountResult[0]?.total || 0;
    
    // 🔴 If ONLY 1 rpor record (this defect) → CANCEL ENTIRE RO
    if (totalRporCount === 1) {
      
      await dbConn.query(
        `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
        [externalRoId, userId, `Garage Module API - DISENGAGED: Last item in RO, triggering FULL CANCEL RO process - Reason: [${disengageReason}]`]
      );

      // ═══════════════════════════════════════════════════════════════════════════════
      // CANCEL RO PROCESS
      // ═══════════════════════════════════════════════════════════════════════════════

      // Step 1: Get all repair logs in this RO (will be all defects linked to it)
      const [allRepairs] = await dbConn.query(
        `SELECT * FROM repair_purchase_order_repairs WHERE repair_purchase_order = ? AND repair_log_id IS NOT NULL`,
        [externalRoId]
      );

      let totalDefectsUpdated = 0;

      // Step 2: Update ALL defects in this RO to RO_Cancelled
      if (allRepairs.length > 0) {
        for (const repair of allRepairs) {
          // Get the defect to check if it's part of a merged group
          const [defectDetails] = await dbConn.query(
            'SELECT merged_records_id FROM vehicle_repair_logs WHERE id = ? LIMIT 1',
            [repair.repair_log_id]
          );
          
          const defectIdsToUpdateInGroup = [repair.repair_log_id];
          
          // If part of a merged group, update all defects in the group
          if (defectDetails.length > 0 && defectDetails[0].merged_records_id) {
            const [mergedGroup] = await dbConn.query(
              'SELECT id FROM vehicle_repair_logs WHERE merged_records_id = ?',
              [defectDetails[0].merged_records_id]
            );
            mergedGroup.forEach(item => {
              if (!defectIdsToUpdateInGroup.includes(item.id)) {
                defectIdsToUpdateInGroup.push(item.id);
              }
            });
          }
          
          // Update all defects in the group to RO_Cancelled status
          for (const dId of defectIdsToUpdateInGroup) {
            await dbConn.query(
              `UPDATE vehicle_repair_logs 
               SET defect_status = 'RO_Cancelled',
                   motive_defect_status = 'cancelled',
                   linked_to_roid = NULL,
                   linked_to_ro_items = NULL,
                   related_repair_purchase_order = NULL,
                   disengage_reason = ?,
                   disengage_notes = ?,
                   disengaged_at = ?
               WHERE id = ? 
               LIMIT 1`,
              [disengageReason, disengageNotes, disengagedAt, dId]
            );
            totalDefectsUpdated++;
          }
        }
      }

      // Step 3: Update RO status to Cancelled (3)
      await dbConn.query(
        `UPDATE repair_purchase_orders SET status = 3 WHERE id = ? LIMIT 1`,
        [externalRoId]
      );

      // Step 4: Update all rpor records to RO_Cancelled status
      await dbConn.query(
        `UPDATE repair_purchase_order_repairs SET rpor_status = 'RO_Cancelled' WHERE repair_purchase_order = ?`,
        [externalRoId]
      );

      // Step 5: Log the cancellation
      await dbConn.query(
        `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
        [externalRoId, userId, `Garage Module API - CANCEL RO COMPLETE: RO #${externalRoId} cancelled. Total defects released: ${totalDefectsUpdated}. All defects reset to RO_Cancelled status.`]
      );

      return; // ← EXIT - Cancel RO complete
    }
    
    // 🟡 If MORE than 1 rpor record → HARD DELETE (just this defect, keep RO active)
    else {
      
      await dbConn.query(
        `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
        [externalRoId, userId, `Garage Module API - DISENGAGED: RO has ${totalRporCount} items, removing only this defect (#${defectId}) - Reason: [${disengageReason}]`]
      );

      // ═══════════════════════════════════════════════════════════════════════════════
      // HARD DELETE PROCESS (Single Defect)
      // ═══════════════════════════════════════════════════════════════════════════════

      // 🔴 STEP 0: Get all rpor IDs for defects to remove
      let rporIds = [];
      let rporIdsStr = '';
      
      if (defectsIdsToUpdate.length > 0) {
        const placeholders = defectsIdsToUpdate.map(() => '?').join(',');
        const [rporRecords] = await dbConn.query(
          `SELECT id FROM repair_purchase_order_repairs WHERE repair_purchase_order = ? AND repair_log_id IN (${placeholders})`,
          [externalRoId, ...defectsIdsToUpdate]
        );
        
        rporIds = rporRecords.map(r => r.id);
        rporIdsStr = rporIds.length > 0 ? rporIds.join(',') : '';
      }

      // 🔴 STEP 1: Get all repair_item IDs linked to these rpor records
      let repairItemIds = [];
      let repairItemIdsStr = '';
      
      if (rporIds.length > 0 && rporIdsStr) {
        const [repairItems] = await dbConn.query(
          `SELECT id FROM repair_items WHERE ro_repair_or_sm_id IN (${rporIdsStr})`
        );
        repairItemIds = repairItems.map(r => r.id);
        repairItemIdsStr = repairItemIds.length > 0 ? repairItemIds.join(',') : '';
      }

      // 🔴 STEP 2: DELETE mechanic_assignments (CASCADE)
      if (repairItemIds.length > 0 && repairItemIdsStr) {
        const [deleteResult] = await dbConn.query(
          `DELETE FROM mechanic_assignments WHERE repair_item_id IN (${repairItemIdsStr})`
        );
        const deletedCount = deleteResult?.affectedRows || 0;
        
        await dbConn.query(
          `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
          [externalRoId, userId, `Garage Module API - DISENGAGED DELETE STEP 1: DELETED ${deletedCount} mechanic_assignments records`]
        );
      }

      // 🔴 STEP 3: DELETE repair_item_notes (CASCADE)
      if (repairItemIds.length > 0 && repairItemIdsStr) {
        const [deleteResult] = await dbConn.query(
          `DELETE FROM repair_item_notes WHERE repair_item_id IN (${repairItemIdsStr})`
        );
        const deletedCount = deleteResult?.affectedRows || 0;
        
        await dbConn.query(
          `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
          [externalRoId, userId, `Garage Module API - DISENGAGED DELETE STEP 2: DELETED ${deletedCount} repair_item_notes records`]
        );
      }

      // 🔴 STEP 4: DELETE repair_items (CASCADE)
      if (rporIds.length > 0 && rporIdsStr) {
        const [deleteResult] = await dbConn.query(
          `DELETE FROM repair_items WHERE ro_repair_or_sm_id IN (${rporIdsStr})`
        );
        const deletedCount = deleteResult?.affectedRows || 0;
        
        await dbConn.query(
          `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
          [externalRoId, userId, `Garage Module API - DISENGAGED DELETE STEP 3: DELETED ${deletedCount} repair_items records`]
        );
      }

      // 🔴 STEP 5: DELETE repair_purchase_order_repairs (CASCADE)
      if (rporIds.length > 0 && rporIdsStr) {
        const [deleteResult] = await dbConn.query(
          `DELETE FROM repair_purchase_order_repairs WHERE id IN (${rporIdsStr})`
        );
        const deletedCount = deleteResult?.affectedRows || 0;
        
        await dbConn.query(
          `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
          [externalRoId, userId, `Garage Module API - DISENGAGED DELETE STEP 4: DELETED ${deletedCount} repair_purchase_order_repairs records`]
        );
      }

      // 🔴 STEP 6: Update vehicle_repair_logs: Reset to Open + Clear RO Links + Save Disengagement Audit Trail
      const vrpData = {
        defect_status: 'Open',
        related_repair_purchase_order: null,
        linked_to_roid: null,
        linked_to_ro_items: null,
        motive_defect_status: 'Open',
        manager_status: 'Not_Submitted',
        disengage_reason: disengageReason,
        disengage_notes: disengageNotes,
        disengaged_at: disengagedAt,
        last_action_on: formatUtcToMysql(),
        last_action_by: userId
      };

      const vrpUpdateFields = Object.keys(vrpData).map(k => `${k} = ?`).join(', ');
      const vrpUpdateValues = Object.values(vrpData);

      await dbConn.query(
        `UPDATE vehicle_repair_logs SET ${vrpUpdateFields} WHERE id IN (${defectsIdsToUpdate.map(() => '?').join(',')})`,
        [...vrpUpdateValues, ...defectsIdsToUpdate]
      );

      // 🔴 LOG: vehicle_repair_logs reset to Open + cleared RO links
      await dbConn.query(
        `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
        [externalRoId, userId, `Garage Module API - DISENGAGED DELETE STEP 5: Reset vehicle_repair_logs defects ${defectsIdsToUpdate.join(',')} to Status: Open, Cleared: related_repair_purchase_order, linked_to_roid, linked_to_ro_items`]
      );

      // 🔴 LOG: Disengagement audit trail saved
      await dbConn.query(
        `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
        [externalRoId, userId, `Garage Module API - DISENGAGED DELETE STEP 6: Audit trail saved - Reason: [${disengageReason}], Notes: [${disengageNotes}], Disengaged At: ${disengagedAt}`]
      );

      // 🔴 LOG: Ready for re-assignment
      await dbConn.query(
        `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
        [externalRoId, userId, `Garage Module API - DISENGAGED COMPLETE: Defects ${defectsIdsToUpdate.join(',')} from RO ${externalRoId} have been REMOVED from rpor/repair_items/mechanic_assignments/notes and are now Ready for re-assignment to new/existing RO. RO remains ACTIVE with remaining items.`]
      );

      // 🔴 LOG: Per-defect breakdown
      for (const dId of defectsIdsToUpdate) {
        await dbConn.query(
          `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
          [externalRoId, userId, `Garage Module API - DISENGAGED DEFECT #${dId}: All repair data (rpor, repair_items, mechanic_assignments, notes) DELETED. Defect reset to Open for re-assignment.`]
        );
      }

      return; // ← EXIT - Hard delete complete
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // NORMAL PATH: All other statuses → Status mapping with VSM/Motive logic
  // ═══════════════════════════════════════════════════════════════════════════════

  // [REST OF NORMAL PATH CODE REMAINS THE SAME...]
  
  let skySoftDefectStatus = 'Open';
  let managerStatus = 'Not_Submitted';

  const statusMap = {
    'Open': { skysoft: 'In_Progress', manager: 'Not_Submitted' },
    'Scheduled': { skysoft: 'In_Progress', manager: 'Not_Submitted' },
    'In_Progress': { skysoft: 'Repair_Started', manager: 'Not_Submitted' },
    'SR_STARTED': { skysoft: 'Repair_Started', manager: 'Not_Submitted' },
    'SR_LINKED': { skysoft: 'In_Progress', manager: 'Not_Submitted' },
    'Cancelled': { skysoft: 'Ro_Cancelled', manager: 'Not_Submitted' },
    'Approved': { skysoft: 'Completed', manager: 'Pending_Review' },
    'Completed': { skysoft: 'Completed', manager: 'Approved' },
    'Paused': { skysoft: 'Paused', manager: 'On_Hold' },
    'Rejected': { skysoft: 'Rejected', manager: 'Rejected' },
    'Repair_Not_Required': { skysoft: 'Repair_Not_Required', manager: 'Approved' }
  };

  if (statusMap[defectStatus]) {
    skySoftDefectStatus = statusMap[defectStatus].skysoft;
    managerStatus = statusMap[defectStatus].manager;
  } else {
    skySoftDefectStatus = defectStatus;
  }

  const rporData = { rpor_status: skySoftDefectStatus };
  if (defect.invoice_status) rporData.invoice_status = defect.invoice_status;
  if (defect.labor_cost) rporData.labor_cost = defect.labor_cost;
  if (defect.parts_cost) rporData.parts_cost = defect.parts_cost;
  if (defect.total_cost) rporData.total_cost = defect.total_cost;
  if (defect.current_kms) rporData.current_kms = defect.current_kms;

  const rporUpdateFields = Object.keys(rporData).map(k => `${k} = ?`).join(', ');
  const rporUpdateValues = Object.values(rporData);

  await dbConn.query(
    `UPDATE repair_purchase_order_repairs SET ${rporUpdateFields} WHERE repair_purchase_order = ? AND repair_log_id IN (${defectsIdsToUpdate.map(() => '?').join(',')})`,
    [...rporUpdateValues, externalRoId, ...defectsIdsToUpdate]
  );

  const motiveStatus = mapSkySoftToMotive(skySoftDefectStatus);

  const vrpData = {
    defect_status: skySoftDefectStatus,
    motive_defect_status: motiveStatus,
    manager_status: managerStatus,
    last_action_on: formatUtcToMysql(),
    last_action_by: userId
  };

  if (defect.invoice_status) vrpData.invoice_status = defect.invoice_status;
  if (defect.labor_cost) vrpData.labor_cost = defect.labor_cost;
  if (defect.parts_cost) vrpData.parts_cost = defect.parts_cost;
  if (defect.total_cost) vrpData.total_cost = defect.total_cost;

  if (defect.approved_by && defect.approved_by.trim() !== '') {
    vrpData.manager_name = `${defect.approved_by}- Garage`;
    vrpData.manager_update_date = formatUtcToMysql();
  }

  const vrpUpdateFields = Object.keys(vrpData).map(k => `${k} = ?`).join(', ');
  const vrpUpdateValues = Object.values(vrpData);

  await dbConn.query(
    `UPDATE vehicle_repair_logs SET ${vrpUpdateFields} WHERE id IN (${defectsIdsToUpdate.map(() => '?').join(',')})`,
    [...vrpUpdateValues, ...defectsIdsToUpdate]
  );

  await dbConn.query(
    `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
    [externalRoId, userId, `Garage Module API - RO ID: ${externalRoId} with all their defects ${defectsIdsToUpdate.join(',')} updated successfully`]
  );

  const smIdFromDefect = defect.sm_id || null;

  if (['Completed', 'Repair_Not_Required'].includes(skySoftDefectStatus) &&
      smIdFromDefect && smIdFromDefect > 0) {

    const [rporRow] = await dbConn.query(
      `SELECT rpor.scheduled_maintenance_setting_id,
              rpor.current_kms,
              rpor.service_completion_date,
              rpo.vehicle
       FROM repair_purchase_order_repairs rpor
       INNER JOIN repair_purchase_orders rpo ON rpo.id = rpor.repair_purchase_order
       WHERE rpor.repair_purchase_order = ?
         AND rpor.repair_log_id = ?
       LIMIT 1`,
      [externalRoId, smIdFromDefect]
    );

    if (rporRow && rporRow.length > 0) {
      const scheduledMaintenanceSettingId = rporRow[0].scheduled_maintenance_setting_id;
      const vehicleId = rporRow[0].vehicle;

      if (scheduledMaintenanceSettingId && scheduledMaintenanceSettingId > 0) {

        const lastReplacedKm = defect.current_kms
          || rporRow[0].current_kms
          || 0;

        let maintenanceDate = null;
        if (defect.completion_date) {
          maintenanceDate = formatUtcToMysql(defect.completion_date, null, true);
        } else if (rporRow[0].service_completion_date) {
          maintenanceDate = formatUtcToMysql(rporRow[0].service_completion_date, null, true);
        } else {
          maintenanceDate = new Date().toISOString().slice(0, 10);
        }

        await dbConn.query(
          `UPDATE vehicle_scheduled_maintenance
           SET last_replaced_km      = ?,
               last_maintenance_date = ?,
               effective_date        = ?
           WHERE vehicle = ?
             AND scheduled_maintenance = ?`,
          [lastReplacedKm, maintenanceDate, maintenanceDate,
           vehicleId, scheduledMaintenanceSettingId]
        );

        await dbConn.query(
          `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
          [externalRoId, userId,
            `Garage Module API - Updated VSM vehicle=${vehicleId} ` +
            `setting_id=${scheduledMaintenanceSettingId} ` +
            `km=${lastReplacedKm} date=${maintenanceDate}`
          ]
        );
      }
    }
  }

  if (defectSource === 'motive' && ['Completed', 'Repair_Not_Required'].includes(skySoftDefectStatus)) {
    if (isMotiveEnabled()) {
      const motiveResponse = await pushToMotive(defectId);
      await dbConn.query(
        `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
        [externalRoId, userId, `Motive API Sync - ${motiveResponse.message || 'Complete'} - ${JSON.stringify(motiveResponse)}`]
      );
    }
  }
}



/**
 * Process single Scheduled Maintenance update
 * 
 * @param {Object} sm - Scheduled maintenance data object
 * @param {number} externalRoId - External RO ID
 * @param {number} userId - User ID performing the update
 * @param {Object} dbConn - Database connection (defaults to global pool, pass transaction conn for rollback support)
 */
async function processSingleSM(sm, externalRoId, userId, dbConn = db) {
  const smId = sm.sm_id || null;
  const smStatus = sm.status || null;

  if (!smId || isNaN(smId) || smId <= 0) {
    throw new Error(`Invalid sm_id: ${smId}`);
  }

  // Map status
  let skySoftStatus = 'Open';
  let managerStatus = 'Not_Submitted';

  const statusMap = {
    'Open': { skysoft: 'In_Progress', manager: 'Not_Submitted' },
    'Scheduled': { skysoft: 'In_Progress', manager: 'Not_Submitted' },
    'In_Progress': { skysoft: 'Repair_Started', manager: 'Not_Submitted' },
    'Cancelled': { skysoft: 'Ro_Cancelled', manager: 'Not_Submitted' },
    'Approved': { skysoft: 'Completed', manager: 'Pending_Review' },
    'Completed': { skysoft: 'Completed', manager: 'Approved' },
    'Paused': { skysoft: 'Paused', manager: 'On_Hold' },
    'Rejected': { skysoft: 'Rejected', manager: 'Rejected' },
    'Repair_Not_Required': { skysoft: 'Repair_Not_Required', manager: 'Approved' }
  };

  if (statusMap[smStatus]) {
    skySoftStatus = statusMap[smStatus].skysoft;
    managerStatus = statusMap[smStatus].manager;
  } else {
    skySoftStatus = smStatus;
  }

  // Update repair_purchase_order_repairs
  const rporData = { rpor_status: skySoftStatus };
  if (sm.invoice_status) rporData.invoice_status = sm.invoice_status;
  if (sm.labor_cost) rporData.labor_cost = sm.labor_cost;
  if (sm.parts_cost) rporData.parts_cost = sm.parts_cost;
  if (sm.total_cost) rporData.total_cost = sm.total_cost;
  if (sm.current_kms) rporData.current_kms = sm.current_kms; // 🔴 FIX 3: PHP saves current_kms to rpor

  const rporUpdateFields = Object.keys(rporData).map(k => `${k} = ?`).join(', ');
  const rporUpdateValues = Object.values(rporData);

  await dbConn.query(
    `UPDATE repair_purchase_order_repairs SET ${rporUpdateFields} WHERE repair_purchase_order = ? AND scheduled_maintenance_setting_id = ?`,
    [...rporUpdateValues, externalRoId, smId]
  );

  // 🔴 CRITICAL FIX: Update vehicle_scheduled_maintenance when SM reaches Completed or Repair_Not_Required
  if (skySoftStatus === 'Completed' || skySoftStatus === 'Repair_Not_Required') {
    // 🔴 FIX #3: Read current_kms from repair_purchase_order_repairs (rpor), not repair_purchase_orders (rpo)
    const [rpDetails] = await dbConn.query(
      `SELECT rpor.current_kms, rpo.vehicle FROM repair_purchase_order_repairs rpor
       INNER JOIN repair_purchase_orders rpo ON rpo.id = rpor.repair_purchase_order
       WHERE rpor.repair_purchase_order = ? AND rpor.item_type = 'SCHEDULED_MAINTENANCE'
       AND rpor.scheduled_maintenance_setting_id = ?`,
      [externalRoId, smId]
    );

    if (rpDetails && rpDetails.length > 0) {
      const vehicleId = rpDetails[0].vehicle;
      const currentKms = sm.current_kms || rpDetails[0].current_kms || 0;
      
      // 🔴 BUG FIX #6: Use sm.completion_date if provided, else service_completion_date from DB, else current date (PHP lines 1750-1759)
      let completionDate = null;
      
      if (sm.completion_date) {
     // completion_date in processSingleSM
completionDate = formatUtcToMysql(sm.completion_date, null, true);
      } else {
        // Get service_completion_date from repair_purchase_order_repairs
        const [rporResult] = await dbConn.query(
          'SELECT service_completion_date FROM repair_purchase_order_repairs WHERE repair_purchase_order = ? AND scheduled_maintenance_setting_id = ?',
          [externalRoId, smId]
        );
        
        if (rporResult && rporResult.length > 0 && rporResult[0].service_completion_date) {
         // service_completion_date from DB result
completionDate = formatUtcToMysql(rporResult[0].service_completion_date, null, true);
        } else {
          completionDate = new Date().toISOString().slice(0, 10);  // Fallback to today
        }
      }

      // Update vehicle_scheduled_maintenance table
      // 🔴 FIX: Use correct column names - 'vehicle' and 'scheduled_maintenance' (not vehicle_id and setting_id)
      await dbConn.query(
        `UPDATE vehicle_scheduled_maintenance \n         SET last_replaced_km = ?, \n             last_maintenance_date = ?, \n             effective_date = ?\n         WHERE vehicle = ? AND scheduled_maintenance = ?`,
        [currentKms, completionDate, completionDate, vehicleId, smId]
      );

      // Log the vehicle_scheduled_maintenance update
      await dbConn.query(
        `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
        [externalRoId, userId, `Garage Module API - Updated vehicle_scheduled_maintenance for Vehicle ${vehicleId}, SM ${sm.name} - ${smId}: last_replaced_km=${currentKms}, last_maintenance_date=${completionDate}`]
      );
    }
  }

  // Log to vm_logs
  await dbConn.query(
    `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
    [externalRoId, userId, `Garage Module API - RO ID: ${externalRoId} SM ${sm.name} - ${smId} updated successfully`]
  );
}

/**
 * Process single repair item
 * 🔴 COMPLETELY REWRITTEN to match actual database schema
 * Based on DESCRIBE output: repair_items, mechanic_assignments, repair_item_notes
 * 
 * @param {Object} item - Repair item data from garage
 * @param {number} externalRoId - External RO ID
 * @param {number} userId - User ID performing the update
 * @param {Object} dbConn - Database connection (defaults to global pool, pass transaction conn for rollback support)
 */
async function processSingleRepairItem(item, externalRoId, userId, dbConn = db) {
  const defectId = item.defect_id || null;
  const smId = item.sm_id || null;
  
  // Validate required fields
  if (!defectId && !smId) {
    throw new Error('Repair item must have either defect_id or sm_id');
  }

  try {
    // 🔴 CRITICAL: Get the ro_repair_or_sm_id from repair_purchase_order_repairs
    // This is NOT the same as externalRoId - it's the rpor.id!
    let roRepairOrSmId = null;
    
    if (defectId) {
      const [rporResult] = await dbConn.query(
        'SELECT id FROM repair_purchase_order_repairs WHERE repair_purchase_order = ? AND repair_log_id = ?',
        [externalRoId, defectId]
      );
      if (rporResult && rporResult.length > 0) {
        roRepairOrSmId = rporResult[0].id;
      }
    } else if (smId) {
      const [rporResult] = await dbConn.query(
        'SELECT id FROM repair_purchase_order_repairs WHERE repair_purchase_order = ? AND scheduled_maintenance_setting_id = ?',
        [externalRoId, smId]
      );
      if (rporResult && rporResult.length > 0) {
        roRepairOrSmId = rporResult[0].id;
      }
    }
    
    if (!roRepairOrSmId) {
      throw new Error(`Could not find repair_purchase_order_repairs record for defect_id=${defectId} or sm_id=${smId} in RO ${externalRoId}`);
    }

    // Extract repair item fields from garage payload matching actual schema
    const garageRepairId = item.repair_item_id || item.garage_repair_id || item.garage_repair_item_id || 0; // 🔴 BUG FIX #4: Add repair_item_id as first fallback (PHP line 1852)
    const name = item.repair_name || item.name || item.item_name || item.description || 'Repair Item'; // 🔴 FIX #4: repair_name first priority (PHP uses $item['repair_name'])
    const description = item.description || item.details || '';
    const estimatedHours = item.estimated_hours || 0;
    const laborCost = item.labor_cost || item.cost || 0;
    const totalEstimatedCost = item.total_estimated_cost || item.total_cost || laborCost;
    const totalActualHours = item.total_actual_hours || item.actual_hours || 0;
    const status = item.status || 'Pending';
    const defectStatus = item.defect_status || 'Open';
    const requiredParts = item.required_parts || item.parts || '';
    const notes = item.notes || [];
  

    // 1. Insert or update repair_items table with ACTUAL schema
    let repairItemId = null;
    
    if (garageRepairId && garageRepairId > 0) {
      // Check if repair item already exists
      const [existingItem] = await dbConn.query(
        'SELECT id FROM repair_items WHERE garage_repair_id = ? AND ro_repair_or_sm_id = ?',
        [garageRepairId, roRepairOrSmId]
      );

      if (existingItem && existingItem.length > 0) {
        repairItemId = existingItem[0].id;
        
        // Update existing repair item with ALL actual columns
        await dbConn.query(
          `UPDATE repair_items 
           SET name = ?, 
               description = ?, 
               estimated_hours = ?, 
               labor_cost = ?, 
               total_estimated_cost = ?,
               total_actual_hours = ?,
               status = ?,
               defect_status = ?,
               required_parts = ?
           WHERE id = ?`,
          [name, description, estimatedHours, laborCost, totalEstimatedCost, totalActualHours, status, defectStatus, requiredParts, repairItemId]
        );
      } else {
        // Insert new repair item with ACTUAL schema
        const [insertResult] = await dbConn.query(
          `INSERT INTO repair_items 
           (garage_repair_id, ro_repair_or_sm_id, name, description, estimated_hours, labor_cost, total_estimated_cost, total_actual_hours, status, defect_status, required_parts, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [garageRepairId, roRepairOrSmId, name, description, estimatedHours, laborCost, totalEstimatedCost, totalActualHours, status, defectStatus, requiredParts]
        );
        repairItemId = insertResult.insertId;
      }
    } else {
      // No garage_repair_id - insert with 0
      const [insertResult] = await dbConn.query(
        `INSERT INTO repair_items 
         (garage_repair_id, ro_repair_or_sm_id, name, description, estimated_hours, labor_cost, total_estimated_cost, total_actual_hours, status, defect_status, required_parts, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [0, roRepairOrSmId, name, description, estimatedHours, laborCost, totalEstimatedCost, totalActualHours, status, defectStatus, requiredParts]
      );
      repairItemId = insertResult.insertId;
    }
// ── allMechanicNotes: populated by repair_item_notes (mechanics handled separately via event)
const allMechanicNotes = [];

    // 3. Process repair item notes with ACTUAL schema (note, not note_text!)
    if (notes && notes.length > 0) {
      for (const note of notes) {
        // 🔴 FIX #5: Garage sends note_id (not garage_note_id), created_by from payload, created_at from payload
        const garageNoteId = note.note_id || note.garage_note_id || 0; // PHP reads note_id first
        const mechanicName = note.mechanicName || null;
        const createdBy = note.created_by || null; // from payload, not userId
        const createdAt = note.created_at ? formatUtcToMysql(note.created_at) : formatUtcToMysql(); // from payload, not NOW()
        
        // Check if note already exists for this repair item and garage_note_id
        const [existingNote] = await dbConn.query(
          'SELECT id FROM repair_item_notes WHERE repair_item_id = ? AND garage_note_id = ?',
          [repairItemId, garageNoteId]
        );

        if (existingNote && existingNote.length > 0) {
          // Update existing note with ACTUAL columns
          await dbConn.query(
            `UPDATE repair_item_notes 
             SET note = ?, 
                 mechanicName = ?,
                 created_by = ?,
                 created_at = ?
             WHERE id = ?`,
            [note.note, mechanicName, createdBy, createdAt, existingNote[0].id]
          );
        } else {
          // Insert new note with ACTUAL columns
          await dbConn.query(
            `INSERT INTO repair_item_notes 
             (repair_item_id, garage_note_id, note, mechanicName, created_by, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [repairItemId, garageNoteId, note.note, mechanicName, createdBy, createdAt]
          );
        }
        
        // ⚠️ GAP 2 FIX: PHP appends notes array entries to allMechanicNotes too
        allMechanicNotes.push(`${createdAt} - ${createdBy}: ${note.note}`);
      }
    }

    // 🔴 FIX 2: Update ALL merged defects (not just single defectId) - combine mechanic_notes + linked_to_roid into one UPDATE
    if (defectId) {
      const [mergeResult] = await dbConn.query(
        'SELECT merged_records_id FROM vehicle_repair_logs WHERE id = ?',
        [defectId]
      );
      
      const mergeGroup = mergeResult[0]?.merged_records_id || null;
      
      let defectsIdsToUpdate = [defectId];
      if (mergeGroup !== null && mergeGroup !== '') {
        const [mergedDefects] = await dbConn.query(
          'SELECT id FROM vehicle_repair_logs WHERE merged_records_id = ?',
          [mergeGroup]
        );
        defectsIdsToUpdate = mergedDefects.map(d => d.id);
      }
      
      // Update ALL merged defects with mechanic_notes + linked_to_roid + related fields
      if (allMechanicNotes.length > 0) {
        // With mechanic notes
        await dbConn.query(
          `UPDATE vehicle_repair_logs 
           SET mechanic_notes = CONCAT(
                 COALESCE(mechanic_notes, ''),
                 IF(COALESCE(mechanic_notes, '') = '', '', '\\n'),
                 ?
               ),
               linked_to_roid = ?,
               related_repair_purchase_order = ?,
               last_action_on = ?,
               last_action_by = ?
           WHERE id IN (${defectsIdsToUpdate.map(() => '?').join(',')})`,
          [allMechanicNotes.join('\\n---\\n'), externalRoId, externalRoId, formatUtcToMysql(), userId, ...defectsIdsToUpdate]
        );
      } else {
        // Without mechanic notes - just update linked_to_roid fields
        await dbConn.query(
          `UPDATE vehicle_repair_logs 
           SET linked_to_roid = ?,
               related_repair_purchase_order = ?,
               last_action_on = ?,
               last_action_by = ?
           WHERE id IN (${defectsIdsToUpdate.map(() => '?').join(',')})`,
          [externalRoId, externalRoId, formatUtcToMysql(), userId, ...defectsIdsToUpdate]
        );
      }
    }

    // Log successful processing
    await dbConn.query(
      `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
      [externalRoId, userId, `Garage Module API - RO ID: ${externalRoId} repair item ${repairItemId} (${name}) processed: est_hours=${estimatedHours}, labor_cost=$${laborCost}`]
    );

    return repairItemId;
  } catch (error) {
    console.error('❌ Error in processSingleRepairItem():', error);
    await dbConn.query(
      `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
      [externalRoId, userId, `Garage Module API - ERROR processing repair item: ${error.message}`]
    );
    throw error;
  }
}

/**
 * Check and update RO status if all defects/SMs are completed
 * 🔴 CRITICAL FIX: Now also updates invoice_paid_status and vehicle_status from payload (not just RO status)
 * 
 * @param {number} roId - RO ID
 * @param {Object} roDetails - RO details payload
 * @param {Object} dbConn - Database connection (defaults to global pool)
 * @param {number} userId - User ID performing the update (defaults to 1 for system)
 */
async function checkAndUpdateRODetails(roId, roDetails, dbConn = db, userId = 1) {
  // Build update data for repair_purchase_orders
  const roUpdateData = {};
  
  // 🔴 BUG FIX #1: Payload sends 'invoice_status', save to 'invoice_paid_status' (matches PHP line 2042-2044)
  if (roDetails.invoice_status) {
    roUpdateData.invoice_paid_status = roDetails.invoice_status;
  }
  
  // Update vehicle_status from payload
  if (roDetails.vehicle_status) {
    roUpdateData.vehicle_status = roDetails.vehicle_status;
  }

  // 🔴 FIX 1: PHP does NOT auto-set status=Completed — removed entire status check block
  // PHP only updates invoice_paid_status and vehicle_status (lines 2042-2048)

  // Apply all updates to repair_purchase_orders if there are any
  if (Object.keys(roUpdateData).length > 0) {
    const updateFields = Object.keys(roUpdateData).map(k => `${k} = ?`).join(', ');
    const updateValues = Object.values(roUpdateData);

    await dbConn.query(
      `UPDATE repair_purchase_orders SET ${updateFields} WHERE id = ?`,
      [...updateValues, roId]
    );

    await dbConn.query(
      `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
      [roId, userId, `Garage Module API - checkAndUpdateRODetails updated: ${Object.keys(roUpdateData).join(', ')}`]
    );
  }
}

/**
 * Get latest KM reading for a vehicle from Motive API
 * Converted from PHP: vehicleLatestkm()
 * 
 * GET /vehicleLatestkm?vehicleName=9611
 * 
 * Required scope: vehicle:read
 * 
 * Returns the latest odometer reading from Motive API
 */
async function vehicleLatestkm(req, res) {
  const { logFileMsg } = require('../utils/reuseUtils');
  const { fetchMotiveData, isMotiveEnabled } = require('../utils/motiveApi');
  
  const logDate = new Date().toISOString().split('T')[0];
  const logPath = `${process.env.MOTIVE_LOG_DIR || './logs/motive'}/motive_vehicle_km_log_${logDate}.txt`;
  
  try {
    const userId = req.apiToken.userId;
    const { vehicleName } = req.query;

    // Decode vehicle name if needed
    const decodedVehicleName = decodeURIComponent(vehicleName || '');

    if (!decodedVehicleName || decodedVehicleName.trim() === '') {
      await logFileMsg(logPath, `Vehicle Latest Km API Called - Vehicle Name was empty`);
      
      return res.json({
        data: {
          user_id: userId,
          vehicleKms: {
            status: 'NOOK',
            error: 'Vehicle Name is required Example 9622'
          }
        }
      });
    }

    await logFileMsg(logPath, `Vehicle Latest Km API Called for vehicle ${decodedVehicleName} by Garage Module`);

    // Get vehicle details from database
    const vehicleQuery = `
      SELECT 
        v.id,
        v.vehicle_nickname,
        v.motive_vehicle_id,
        vt.vehicle_type
      FROM vehicles v
      LEFT JOIN vehicletypes vt ON vt.id = v.vehicle_type
      WHERE v.vehicle_nickname = ?
      LIMIT 1
    `;

    const [vehicleResults] = await db.query(vehicleQuery, [decodedVehicleName]);

    if (!vehicleResults || vehicleResults.length === 0) {
      await logFileMsg(logPath, `Vehicle not found in database: ${decodedVehicleName}`);
      
      return res.json({
        data: {
          user_id: userId,
          vehicleKms: {
            status: 'NOOK',
            error: 'Vehicle not found'
          }
        }
      });
    }

    const vehicle = vehicleResults[0];
    let motiveVehicleId = vehicle.motive_vehicle_id;

    // If motive_vehicle_id is empty, try to get it from vehicle_repair_logs
    if (!motiveVehicleId || motiveVehicleId === '') {
      await logFileMsg(logPath, `Vehicle Motive ID was empty, checking vehicle_repair_logs for vehicle ${decodedVehicleName}`);
      
      const [defectResults] = await db.query(
        `SELECT motive_vehicle_id 
         FROM vehicle_repair_logs 
         WHERE vehicle = ? AND motive_vehicle_id IS NOT NULL 
         ORDER BY id DESC 
         LIMIT 1`,
        [vehicle.id]
      );

      if (defectResults && defectResults.length > 0) {
        motiveVehicleId = defectResults[0].motive_vehicle_id;
        await logFileMsg(logPath, `Vehicle Motive Id details was attempted from vehicle defect for vehicle ${decodedVehicleName}`);
      }
    }

    // Check if we have a Motive vehicle ID
    if (!motiveVehicleId || motiveVehicleId === '') {
      await logFileMsg(logPath, `Vehicle Motive ID was not found for the vehicle ${decodedVehicleName}`);
      
      return res.json({
        data: {
          user_id: userId,
          vehicleKms: {
            status: 'OK',
            data: {
              latestKm: null
            }
          }
        }
      });
    }

    // Check if Motive API is enabled
    if (!isMotiveEnabled()) {
      await logFileMsg(logPath, `Motive API call has not been activated in skysoft configuration`);
      
      return res.json({
        data: {
          user_id: userId,
          vehicleKms: {
            status: 'OK',
            data: {
              latestKm: null
            }
          }
        }
      });
    }

    // Call Motive API to get odometer reading
    const readingDate = new Date().toISOString().split('T')[0];
    
    await logFileMsg(logPath, `Fetching Motive data for vehicle ${decodedVehicleName} (ID: ${motiveVehicleId}) for date: ${readingDate}`);
    
    const motiveData = await fetchMotiveData('getV2MotiveVehicleOdometer', 'GET', {
      motive_vechicle_id: motiveVehicleId,
      reading_date: readingDate
    });

    let latestKm = null;

    // ✅ Parse new response structure: vehicles[0].vehicle.current_location.odometer
    if (motiveData && motiveData.vehicles && motiveData.vehicles.length > 0) {
      const vehicleData = motiveData.vehicles[0].vehicle;
      
      if (vehicleData && vehicleData.current_location && vehicleData.current_location.odometer > 0) {
        const odometerReading = parseFloat(vehicleData.current_location.odometer);
        
        // In Motive company settings it's currently set to km, so no conversion needed
        const kilometers = odometerReading;
        
        // Format to 2 decimal places as a string
        latestKm = kilometers.toFixed(2);
        
        await logFileMsg(logPath, `Motive API was called for vehicle ${decodedVehicleName} and motive returned latest Odometer reading as ${odometerReading} km at ${vehicleData.current_location.located_at}`);
      } else {
        await logFileMsg(logPath, `Motive API returned vehicle data but no odometer reading for vehicle ${decodedVehicleName}`);
      }
    } else {
      await logFileMsg(logPath, `Motive API returned no vehicle data for vehicle ${decodedVehicleName}`);
    }

    // Log activity
    await logWebhookActivity(req, `Vehicle Latest Km API Called for vehicle ${decodedVehicleName}`);

    return res.json({
      data: {
        user_id: userId,
        vehicleKms: {
          status: 'OK',
          data: {
            latestKm: latestKm
          }
        }
      }
    });

  } catch (error) {
    console.error('❌ Error in vehicleLatestkm():', error);
    await logFileMsg(logPath, `Error in vehicleLatestkm(): ${error.message}`);
    
    return res.json({
      data: {
        user_id: req.apiToken?.userId || null,
        vehicleKms: {
          status: 'NOOK',
          error: error.message
        }
      }
    });
  }
}
async function createROFromGarage(req, res) {
  const path = require('path');
  const fs   = require('fs').promises;
 
  // ── Keep the log file for observability ────────────────────────────────
  const logDate = new Date().toISOString().split('T')[0];
  const logDir  = path.join(__dirname, '../logs/quickjob');
  const logPath = path.join(logDir, `quickjob_workorder_${logDate}.txt`);
 
  try {
    await fs.mkdir(logDir, { recursive: true });
 
    const rawPayload = JSON.stringify(req.body, null, 2);
    const separator  = '='.repeat(60);
    const logEntry   = `
${separator}
QuickJob / WorkOrder
Received At: ${new Date().toISOString()}
${separator}
${rawPayload}
${separator}
 
`;
    await fs.appendFile(logPath, logEntry, 'utf8');
  } catch (logErr) {
    console.error('⚠️ Log file write failed:', logErr.message);
    // Non-fatal — continue to main handler
  }
 
  // ── Route to the full creation handler ─────────────────────────────────
  return handleQuickJobROCreation(req, res);
}



async function busVisit(req, res) {
  try {
    const userId = req.apiToken.userId;
    const payload = req.body;

    await logWebhookActivity(req, `Bus Visit API - Incoming payload`, {
      rawLog: { ...payload }
    });

    const result = await updateVehicleBusVisitStatus(payload, userId);

    return res.json({
      success: true,
      status: 'OK',
      message: result.action === 'skipped' ? result.reason : `Vehicle ${result.vehicle_id} status updated to "${result.new_status}"`,
      data: result
    });

  } catch (error) {
    console.error('❌ Error in busVisit():', error);
    return res.status(500).json({
      success: false,
      status: 'NOOK',
      error: error.message
    });
  }
}
module.exports = {
  list,
  details,
  updateVehicleDefect_v2,
  updateRO,
  vehicleLatestkm,
  createROFromGarage,
  busVisit
};