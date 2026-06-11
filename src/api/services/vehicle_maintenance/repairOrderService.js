/**
 * Repair Order Service
 * Business logic for repair purchase orders
 */

const db = require('../../db/connection');
const defectService = require('./defectService');
const garageWebhookService = require('./garageWebhookService');
/**
 * Get all repair orders with filters, pagination, and sorting
 */
async function getRepairOrders({ page = 1, limit = 10, sortColumn = 'created_on', sortOrder = 'DESC', filters = {} }) {
  try {
    const offset = (page - 1) * limit;
    
    // ✅ DEBUG: Log filter parameters
    console.log('🔍 getRepairOrders filters:', filters);
    
    // Build WHERE clause based on filters
    let whereConditions = ['rpo.id != 0'];
    const queryParams = [];

    // Key search filter (searches across multiple fields)
    if (filters.txtKey) {
      whereConditions.push(`(
        CAST(rpo.id AS CHAR) LIKE ? OR 
        rpo.work_order_number LIKE ? OR 
        rpo.invoice_number LIKE ? OR 
        rpo.payment_notes LIKE ? OR 
        rpo.repair_notes LIKE ? OR
        v.vehicle_nickname LIKE ? OR
        ve.vendor_name LIKE ?
      )`);
      const searchTerm = `%${filters.txtKey}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    // Status filter
    if (filters.txtStatus) {
      whereConditions.push('rpo.status = ?');
      queryParams.push(filters.txtStatus);
    }

    // ✅ Ready to Complete filter - Active ROs where all defects are resolved
    if (filters.readyToComplete === 'true') {
      whereConditions.push('defect_stats.total_defects > 0 AND defect_stats.total_defects = (defect_stats.completed_defects + defect_stats.rejected_defects)');
    }

    // Vehicle filter
    if (filters.txtVehicle) {
      whereConditions.push('rpo.vehicle = ?');
      queryParams.push(filters.txtVehicle);
    }

    // Vendor filter
    if (filters.txtVendor) {
      whereConditions.push('rpo.vendor = ?');
      queryParams.push(filters.txtVendor);
    }

    // Date range filter
    if (filters.txtStarting && filters.txtEnds) {
      whereConditions.push('rpo.created_on BETWEEN ? AND ?');
      queryParams.push(
        `${filters.txtStarting} 00:00:01`,
        `${filters.txtEnds} 23:59:59`
      );
    }

    const whereClause = whereConditions.join(' AND ');
    
    // ✅ DEBUG: Log WHERE clause
    console.log('🔍 WHERE clause:', whereClause);
    console.log('🔍 Query params:', queryParams);

    // Valid sort columns to prevent SQL injection
    const validSortColumns = [
      'ro_source_type', 'created_on', 'rpoid', 'status', 'vehicle_nickname',
      'kms_before_service', 'estimated_repair_amount', 'invoice_amount',
      'vendor_name', 'invoice_number', 'work_order_number', 'service_completed_date',
      'requested_by_name', 'payment_method_name', 'repair_notes'
    ];

    const orderColumn = validSortColumns.includes(sortColumn) ? sortColumn : 'created_on';
    const orderDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Count query for total records
    const countQuery = `
      SELECT COUNT(rpo.id) as total_value
      FROM repair_purchase_orders rpo
      LEFT JOIN payment_methods pm ON rpo.payment_method = pm.id
      LEFT JOIN vehicles v ON v.id = rpo.vehicle
      LEFT JOIN vendors ve ON ve.id = rpo.vendor
      LEFT JOIN users u1 ON u1.id = rpo.requested_by
      LEFT JOIN users u2 ON u2.id = rpo.verification_handled_by
      -- ✅ Join defect statistics for "Ready to Complete" filtering
      LEFT JOIN (
        SELECT
          repair_purchase_order,
          COUNT(*) AS total_defects,
        SUM(CASE WHEN LOWER(rpor_status) IN ('completed', 'sr_completed_fixed') THEN 1 ELSE 0 END) AS completed_defects,
          SUM(CASE WHEN LOWER(rpor_status) = 'rejected' THEN 1 ELSE 0 END) AS rejected_defects
        FROM repair_purchase_order_repairs
        GROUP BY repair_purchase_order
      ) defect_stats ON defect_stats.repair_purchase_order = rpo.id
      LEFT JOIN (
        SELECT
          ro_id_created,
          COUNT(*) AS md_count,
          MIN(id) AS sample_md_id,
          MIN(defect_description) AS sample_defect_desc,
          MIN(motive_record_id) AS motive_id
        FROM motive_defects
        WHERE ro_id_created IS NOT NULL
        GROUP BY ro_id_created
      ) mdx ON mdx.ro_id_created = rpo.id
      WHERE ${whereClause}
    `;

    const [countResult] = await db.query(countQuery, queryParams);
    const totalRecords = countResult[0]?.total_value || 0;

    // Get statistics for all statuses (using same filters)
    const statsQuery = `
      SELECT
        SUM(CASE WHEN rpo.status = 1 THEN 1 ELSE 0 END) as activeCount,
        SUM(CASE WHEN rpo.status = 2 THEN 1 ELSE 0 END) as finishedCount,
        SUM(CASE WHEN rpo.status = 3 THEN 1 ELSE 0 END) as canceledCount,
        -- ✅ Count Active ROs where ALL defects are resolved (Completed or Rejected)
        SUM(
          CASE 
            WHEN rpo.status = 1 
              AND defect_stats.total_defects > 0 
              AND defect_stats.total_defects = (defect_stats.completed_defects + defect_stats.rejected_defects)
            THEN 1 
            ELSE 0 
          END
        ) as readyToCompleteCount
      FROM repair_purchase_orders rpo
      LEFT JOIN payment_methods pm ON rpo.payment_method = pm.id
      LEFT JOIN vehicles v ON v.id = rpo.vehicle
      LEFT JOIN vendors ve ON ve.id = rpo.vendor
      LEFT JOIN users u1 ON u1.id = rpo.requested_by
      LEFT JOIN users u2 ON u2.id = rpo.verification_handled_by
      -- ✅ Join defect statistics to calculate "Ready to Complete"
      LEFT JOIN (
        SELECT
          repair_purchase_order,
          COUNT(*) AS total_defects,
          SUM(CASE WHEN LOWER(rpor_status) IN ('completed', 'sr_completed_fixed') THEN 1 ELSE 0 END) AS completed_defects,
          SUM(CASE WHEN LOWER(rpor_status) = 'rejected' THEN 1 ELSE 0 END) AS rejected_defects
        FROM repair_purchase_order_repairs
        GROUP BY repair_purchase_order
      ) defect_stats ON defect_stats.repair_purchase_order = rpo.id
      LEFT JOIN (
        SELECT
          ro_id_created,
          COUNT(*) AS md_count,
          MIN(id) AS sample_md_id,
          MIN(defect_description) AS sample_defect_desc,
          MIN(motive_record_id) AS motive_id
        FROM motive_defects
        WHERE ro_id_created IS NOT NULL
        GROUP BY ro_id_created
      ) mdx ON mdx.ro_id_created = rpo.id
      WHERE ${whereClause}
    `;

    const [statsResult] = await db.query(statsQuery, queryParams);
    const statistics = {
      activeCount: statsResult[0]?.activeCount || 0,
      finishedCount: statsResult[0]?.finishedCount || 0,
      canceledCount: statsResult[0]?.canceledCount || 0,
      readyToCompleteCount: statsResult[0]?.readyToCompleteCount || 0
    };

    // Main query for repair orders
    const mainQuery = `
      SELECT
        rpo.*,
        v.vehicle_nickname,
        rpo.status AS rpostatus,
        ve.vendor_name,
        rpo.id AS rpoid,
        u1.fullname AS requested_by_name,
        pm.payment_method AS payment_method_name,
        CASE 
          WHEN mdx.ro_id_created IS NOT NULL THEN 'Motive Defect' 
          ELSE 'Skysoft' 
        END AS ro_source_type,
        COALESCE(mdx.md_count, 0) AS motive_defect_count,
        mdx.sample_md_id AS motive_defect_id_any,
        mdx.sample_defect_desc AS motive_defect_desc_any,
        mdx.motive_id AS motive_defect_id,
        -- ✅ Defect/Repair counts for completion status badges
        COALESCE(defect_stats.total_defects, 0) AS total_defects,
        COALESCE(defect_stats.completed_defects, 0) AS completed_defects,
        COALESCE(defect_stats.rejected_defects, 0) AS rejected_defects
      FROM repair_purchase_orders rpo
      LEFT JOIN payment_methods pm ON rpo.payment_method = pm.id
      LEFT JOIN vehicles v ON v.id = rpo.vehicle
      LEFT JOIN vendors ve ON ve.id = rpo.vendor
      LEFT JOIN users u1 ON u1.id = rpo.requested_by
      LEFT JOIN users u2 ON u2.id = rpo.verification_handled_by
      LEFT JOIN (
        SELECT
          ro_id_created,
          COUNT(*) AS md_count,
          MIN(id) AS sample_md_id,
          MIN(defect_description) AS sample_defect_desc,
          MIN(motive_record_id) AS motive_id
        FROM motive_defects
        WHERE ro_id_created IS NOT NULL
        GROUP BY ro_id_created
      ) mdx ON mdx.ro_id_created = rpo.id
      -- ✅ Join to count defect/repair statuses from repair_purchase_order_repairs
      -- Groups by RO ID and counts Completed/Rejected (case-insensitive)
      LEFT JOIN (
        SELECT
          repair_purchase_order,
          COUNT(*) AS total_defects,
         SUM(CASE WHEN LOWER(rpor_status) IN ('completed', 'sr_completed_fixed') THEN 1 ELSE 0 END) AS completed_defects,
          SUM(CASE WHEN LOWER(rpor_status) = 'rejected' THEN 1 ELSE 0 END) AS rejected_defects
        FROM repair_purchase_order_repairs
        GROUP BY repair_purchase_order
      ) defect_stats ON defect_stats.repair_purchase_order = rpo.id
      WHERE ${whereClause}
      ORDER BY ${orderColumn} ${orderDirection}
      LIMIT ? OFFSET ?
    `;

    const mainQueryParams = [...queryParams, limit, offset];
    const [repairOrders] = await db.query(mainQuery, mainQueryParams);

    return {
      data: repairOrders,
      total: totalRecords,
      statistics: statistics
    };
  } catch (error) {
    console.error('Service error in getRepairOrders:', error);
    throw error;
  }
}

/**
 * Get a single repair order by ID
 */
async function getRepairOrderById(id) {
  try {
    const query = `
      SELECT
        rpo.*,
        v.vehicle_nickname,
        rpo.status AS rpostatus,
        ve.vendor_name,
        ve.garage_url AS vendor_garage_url,
        rpo.id AS rpoid,
        u1.fullname AS requested_by_name,
        pm.payment_method AS payment_method_name,
        CASE 
          WHEN mdx.ro_id_created IS NOT NULL THEN 'Motive Defect' 
          ELSE 'Skysoft' 
        END AS ro_source_type,
        COALESCE(mdx.md_count, 0) AS motive_defect_count,
        mdx.sample_md_id AS motive_defect_id_any,
        mdx.sample_defect_desc AS motive_defect_desc_any,
        mdx.motive_id AS motive_defect_id
      FROM repair_purchase_orders rpo
      LEFT JOIN payment_methods pm ON rpo.payment_method = pm.id
      LEFT JOIN vehicles v ON v.id = rpo.vehicle
      LEFT JOIN vendors ve ON ve.id = rpo.vendor
      LEFT JOIN users u1 ON u1.id = rpo.requested_by
      LEFT JOIN users u2 ON u2.id = rpo.verification_handled_by
      LEFT JOIN (
        SELECT
          ro_id_created,
          COUNT(*) AS md_count,
          MIN(id) AS sample_md_id,
          MIN(defect_description) AS sample_defect_desc,
          MIN(motive_record_id) AS motive_id
        FROM motive_defects
        WHERE ro_id_created IS NOT NULL
        GROUP BY ro_id_created
      ) mdx ON mdx.ro_id_created = rpo.id
      WHERE rpo.id = ?
      LIMIT 1
    `;

    const [results] = await db.query(query, [id]);
    return results[0] || null;
  } catch (error) {
    console.error('Service error in getRepairOrderById:', error);
    throw error;
  }
}

/**
 * Helper function to log repair order actions
 * Links log to RO via: vm_logs.ro_id = repair_purchase_orders.id
 */
async function logRepairOrderAction(roId, userId, action) {
  try {
    // Default to system user (ID 1) if no userId provided
    const logUserId = userId || 1;
    
    console.log(`📝 Creating log for RO ${roId}: "${action}" by user ${logUserId}`);
    
    const query = `
      INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) 
      VALUES (?, ?, ?, NOW())
    `;
    const [result] = await db.query(query, [roId, logUserId, action]);
    console.log(`✅ Log created successfully - vm_logs.id=${result.insertId}, vm_logs.ro_id=${roId}`);
  } catch (error) {
    // Don't throw error for logging failures, just log it
    console.error('❌ Failed to log repair order action:', error);
    console.error('Error details:', error.message);
    console.error('Attempted values: ro_id=%s, user_id=%s, action=%s', roId, userId, action);
  }
}

/**
 * Get repair order details with repairs, scheduled maintenance, and logs
 */
async function getRepairOrderDetails(id) {
  try {
    // Get main RO details
    const roData = await getRepairOrderById(id);
    if (!roData) {
      return null;
    }

    // Get vendor contact info
    const vendorQuery = `
      SELECT vendor_email, vendor_phone 
      FROM vendors 
      WHERE id = ?
      LIMIT 1
    `;
    const [vendorResults] = await db.query(vendorQuery, [roData.vendor]);
    const vendorInfo = vendorResults[0] || {};

    // Get repairs and scheduled maintenance summary
    const summaryQuery = `
      SELECT
        r.repair_purchase_order AS ro_id,
        COALESCE(SUM(r.labor_cost), 0) AS total_labor_cost,
        COALESCE(SUM(r.parts_cost), 0) AS total_parts_cost,
        COALESCE(SUM(r.total_cost), 0) AS total_cost_sum,
        COUNT(*) AS item_count,
        SUM(CASE WHEN r.rpor_status = 'Open' THEN 1 ELSE 0 END) AS status_open_count,
        SUM(CASE WHEN r.rpor_status = 'Pending' THEN 1 ELSE 0 END) AS status_pending_count,
        SUM(CASE WHEN r.rpor_status = 'In_Progress' THEN 1 ELSE 0 END) AS status_in_progress_count,
        SUM(CASE WHEN r.rpor_status = 'Completed' THEN 1 ELSE 0 END) AS status_completed_count,
        SUM(CASE WHEN r.rpor_status = 'Rejected' THEN 1 ELSE 0 END) AS status_rejected_count,
        SUM(CASE WHEN r.rpor_status = 'Paused' THEN 1 ELSE 0 END) AS status_paused_count,
        SUM(CASE WHEN r.rpor_status = 'Reopened' THEN 1 ELSE 0 END) AS status_reopened_count,
        SUM(CASE WHEN r.rpor_status = 'Repair_Not_Required' THEN 1 ELSE 0 END) AS status_repair_not_required_count,
        SUM(CASE WHEN r.rpor_status = 'RO_Cancelled' THEN 1 ELSE 0 END) AS status_ro_cancelled_count
      FROM repair_purchase_order_repairs AS r
      WHERE r.repair_purchase_order = ?
      GROUP BY r.repair_purchase_order
    `;
    const [summaryResults] = await db.query(summaryQuery, [id]);
    const summary = summaryResults[0] || {
      item_count: 0,
      total_labor_cost: 0,
      total_parts_cost: 0,
      total_cost_sum: 0,
      status_open_count: 0,
      status_pending_count: 0,
      status_in_progress_count: 0,
      status_completed_count: 0,
      status_rejected_count: 0,
      status_paused_count: 0,
      status_reopened_count: 0,
      status_repair_not_required_count: 0,
      status_ro_cancelled_count: 0
    };

    // Get vehicle repairs (defects)
    const repairsQuery = `
      SELECT
        rpor.*,
        scs.setting_name,
        rcc.repair_code_category,
        vrl.id AS vrlid,
        vrl.repair_desc,
        vrl.defect_source,
        vrl.defect_status AS live_defect_status,
        vrl.issue_type,
        vrl.is_duplicate,
        vrl.notes,
        vrl.manager_status,
        vrl.manager_name,
        vrl.manager_update_date,
        vrl.merged_records_id,
        vrl.motive_def_unique_id,
        vrl.motive_driver_signed,
        vrl.motive_driver_signed_date,
        vrl.motive_driver_inspection_status,
        rpor.rpor_status AS rpor_status,
        rpor.repair_purchase_order,
        rpor.repair_log_id,
            vrl.vehicle,
    vrl.external_garage_defect_id,
    vrl.logged_by,
    vrl.reported_by,
    vrl.logged_on,
    vrl.issue_date,
    vrl.linked_to_ro_items,
 
        u.nickname,
        u.fullname,
        u.middlename,
        u.lastname,
        u.id as manager_id,
        COALESCE(merge_counts.merged_count, 0) as merged_count,
        CASE 
          WHEN vrl.is_duplicate = 'y' AND vrl.merged_records_id IS NOT NULL THEN
            (SELECT id FROM vehicle_repair_logs vrl2 
             WHERE vrl2.merged_records_id = vrl.merged_records_id 
             AND vrl2.is_duplicate = 'n' 
             LIMIT 1)
          ELSE NULL
        END as primary_defect_id
      FROM repair_purchase_order_repairs rpor
      LEFT JOIN vehicle_repair_logs vrl ON rpor.repair_log_id = vrl.id
      LEFT JOIN repair_code_categories rcc ON rcc.id = vrl.repair_code_category
      LEFT JOIN scheduled_configuration_settings scs ON scs.id = rpor.scheduled_maintenance_setting_id
      LEFT JOIN users u ON u.id = vrl.manager_id
      LEFT JOIN (
        SELECT merged_records_id, COUNT(*) as merged_count
        FROM vehicle_repair_logs 
        WHERE is_duplicate = 'y'
        GROUP BY merged_records_id
      ) merge_counts ON merge_counts.merged_records_id = vrl.merged_records_id
      WHERE rpor.item_type = 'REPAIR' AND rpor.repair_purchase_order = ?
      ORDER BY rpor.id ASC
    `;
    const [repairs] = await db.query(repairsQuery, [id]);

    // Get scheduled maintenance items
    const smQuery = `
      SELECT 
  rpor.*, 
  scs.setting_name, 
  rcc.repair_code_category, 
  vrl.repair_desc, 
  vrl.issue_type, 
  vrl.id AS vrlid, 
  rpor.rpor_status as rpor_status,
  vrl.manager_status,
  vrl.manager_name,
  vrl.manager_id,
  vrl.manager_update_date
FROM repair_purchase_order_repairs rpor
LEFT JOIN vehicle_repair_logs vrl ON rpor.repair_log_id = vrl.id
LEFT JOIN repair_code_categories rcc ON rcc.id = vrl.repair_code_category
LEFT JOIN scheduled_configuration_settings scs ON scs.id = rpor.scheduled_maintenance_setting_id
WHERE rpor.item_type = 'SCHEDULED_MAINTENANCE' AND rpor.repair_purchase_order = ?
ORDER BY rpor.id ASC
    `;
    const [scheduledMaintenance] = await db.query(smQuery, [id]);

    // Get activity logs - NO LIMIT, fetch ALL logs for this RO
    const logsQuery = `
      SELECT 
        vml.*,
        u.fullname,
        u.nickname
      FROM vm_logs vml
      LEFT JOIN users u ON vml.user_id = u.id
      WHERE vml.ro_id = ?
      ORDER BY vml.log_time DESC
    `;
    
    console.log(`🔍 [RO Details] Executing logs query for RO ${id}...`);
    console.log(`📝 [RO Details] Query: ${logsQuery.replace(/\s+/g, ' ').trim()}`);
    console.log(`📝 [RO Details] Params: [${id}]`);
    
    const [logs] = await db.query(logsQuery, [id]);
    
    console.log(`✅ [RO Details] Fetched ALL ${logs.length} activity logs for RO ${id} (no limit applied)`);
    if (logs.length > 0) {
      console.log('[RO Details] First log (newest):', {
        id: logs[0].id,
        log_data: logs[0].log_data,
        log_time: logs[0].log_time,
        user: logs[0].fullname
      });
      console.log('[RO Details] Last log (oldest):', {
        id: logs[logs.length - 1].id,
        log_data: logs[logs.length - 1].log_data,
        log_time: logs[logs.length - 1].log_time,
        user: logs[logs.length - 1].fullname
      });
    } else {
      console.log('⚠️ [RO Details] No logs found in vm_logs for ro_id=' + id);
    }

    // Get attached invoices
    const attachmentsQuery = `
      SELECT * 
      FROM ro_attachments 
      WHERE ro_id = ?
    `;
    const [attachments] = await db.query(attachmentsQuery, [id]);
// Get Garage repair items for all rpor items
const rporIds = [
  ...repairs.map(r => r.id),
  ...scheduledMaintenance.map(r => r.id)
];

let repairItemsMap = {};  // Now: { ro_repair_or_sm_id: GarageRepairItem[] }

if (rporIds.length > 0) {
  const placeholders = rporIds.map(() => '?').join(',');

  // ✅ STEP 1: Query repair_items WITHOUT mechanic_assignments (separate queries)
  const repairItemsQuery = `
    SELECT
      ri.id                       AS ri_id,
      ri.ro_repair_or_sm_id,
      ri.garage_repair_id,
      ri.name                     AS ri_name,
      ri.description              AS ri_description,
      ri.estimated_hours,
      ri.labor_cost,
      ri.total_estimated_cost,
      ri.total_actual_hours,
      ri.status                   AS ri_status,
      ri.defect_status            AS ri_defect_status,
      ri.required_parts,
      ri.created_at               AS ri_created_at
    FROM repair_items ri
    WHERE ri.ro_repair_or_sm_id IN (${placeholders})
    ORDER BY ri.id ASC
  `;
  const [repairItems] = await db.query(repairItemsQuery, rporIds);

  // ✅ STEP 2: Get ALL mechanic_assignments for these repair_items
  const repairItemIds = [...new Set(repairItems.map(r => r.ri_id).filter(Boolean))];
  let mechanicMap = {};   // { repair_item_id: MechanicAssignment[] }
  let notesMap = {};      // { repair_item_id: Note[] }

  if (repairItemIds.length > 0) {
    const riPlaceholders = repairItemIds.map(() => '?').join(',');

    // Query all mechanic assignments
    const [mechanics] = await db.query(`
      SELECT
        ma.id                       AS ma_id,
        ma.repair_item_id,
        ma.mechanic_name,
        ma.bay_number,
        ma.status                   AS ma_status,
        ma.approval_status,
        ma.approved_by,
        ma.approved_at,
        ma.scheduled_start,
        ma.scheduled_end,
        ma.actual_start_datetime,
        ma.actual_end_datetime,
        ma.mechanic_challenge_notes,
        ma.invoice_notes,
        ma.invoice_hours,
        ma.actual_hours,
        ma.duration
      FROM mechanic_assignments ma
      WHERE ma.repair_item_id IN (${riPlaceholders})
      ORDER BY ma.id ASC
    `, repairItemIds);

    // Group mechanic assignments by repair_item_id
    mechanics.forEach(ma => {
      if (!mechanicMap[ma.repair_item_id]) mechanicMap[ma.repair_item_id] = [];
      mechanicMap[ma.repair_item_id].push(ma);
    });

    // ✅ STEP 3: Query all notes
    const [notes] = await db.query(`
      SELECT * FROM repair_item_notes
      WHERE repair_item_id IN (${riPlaceholders})
      ORDER BY created_at ASC
    `, repairItemIds);

    notes.forEach(note => {
      if (!notesMap[note.repair_item_id]) notesMap[note.repair_item_id] = [];
      notesMap[note.repair_item_id].push(note);
    });
  }

  // ✅ STEP 4: Build the map as ARRAYS (not single objects)
  repairItems.forEach(item => {
    if (!repairItemsMap[item.ro_repair_or_sm_id]) {
      repairItemsMap[item.ro_repair_or_sm_id] = [];
    }
    repairItemsMap[item.ro_repair_or_sm_id].push({
      ...item,
      mechanic_assignments: mechanicMap[item.ri_id] || [],
      notes: notesMap[item.ri_id] || []
    });
  });
}
// ✅ FIXED: Calculate invoice_amount from UNIQUE invoice numbers
const invoiceMap = new Map();

// Add repairs (group by unique invoice_number)
repairs.forEach(repair => {
  if (repair.invoice_number && repair.invoice_amount) {
    const invNum = repair.invoice_number;
    const amount = parseFloat(repair.invoice_amount);
    if (!invoiceMap.has(invNum)) {
      invoiceMap.set(invNum, amount);
      console.log(`  ➕ Adding UNIQUE repair invoice: ${invNum} = $${amount}`);
    }
  }
});

// Add scheduled maintenance (group by unique invoice_number)
scheduledMaintenance.forEach(sm => {
  if (sm.invoice_number && sm.invoice_amount) {
    const invNum = sm.invoice_number;
    const amount = parseFloat(sm.invoice_amount);
    if (!invoiceMap.has(invNum)) {
      invoiceMap.set(invNum, amount);
      console.log(`  ➕ Adding UNIQUE SM invoice: ${invNum} = $${amount}`);
    }
  }
});

// Calculate grand total
const calculatedInvoiceAmount = Array.from(invoiceMap.values()).reduce((sum, amount) => sum + amount, 0);

console.log(`🔍 Calculated Invoice Amount: ${calculatedInvoiceAmount} (unique invoices: ${Array.from(invoiceMap.keys()).join(',')})`);

return {
  ...roData,
  invoice_amount: calculatedInvoiceAmount,  // ✅ OVERRIDE with calculated value
  vendor_email: vendorInfo.vendor_email,
  vendor_phone: vendorInfo.vendor_phone,
  summary,
  repairs: repairs.map(r => ({ ...r, garage_repair_items: repairItemsMap[r.id] || [] })),
  scheduledMaintenance: scheduledMaintenance.map(r => ({ ...r, garage_repair_items: repairItemsMap[r.id] || [] })),
  logs: logs || [],
  attachments: attachments || []
};
  } catch (error) {
    console.error('Service error in getRepairOrderDetails:', error);
    throw error;
  }
}

/**
 * Create a new repair order
 */
async function createRepairOrder(roData, metadata) {
  try {
    const {
      vehicle,
      vendor,
      estimated_repair_amount = 0,
      invoice_amount = 0,
      kms_before_service = 0,
      work_order_number = '',
      invoice_number = '',
      repair_notes = '',
      payment_method = null,
      service_completed_date = null,
      requested_by = metadata?.userId || null,
      status = 1 // Default to Active
    } = roData;

    const query = `
      INSERT INTO repair_purchase_orders (
        vehicle,
        vendor,
        estimated_repair_amount,
        invoice_amount,
        kms_before_service,
        work_order_number,
        invoice_number,
        repair_notes,
        payment_method,
        service_completed_date,
        requested_by,
        status,
        created_on
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    const [result] = await db.query(query, [
      vehicle,
      vendor,
      estimated_repair_amount,
      invoice_amount,
      kms_before_service,
      work_order_number,
      invoice_number,
      repair_notes,
      payment_method,
      service_completed_date,
      requested_by,
      status
    ]);

    // Log the creation
    if (result.insertId) {
      await logRepairOrderAction(result.insertId, metadata?.userId, 'RO Created');
    }

    return {
      id: result.insertId,
      ...roData
    };
  } catch (error) {
    console.error('Service error in createRepairOrder:', error);
    throw error;
  }
}

/**
 * Get repair order data for editing
 * Returns RO details with associated defect IDs and scheduled maintenance IDs
 */
async function getRepairOrderForEdit(roId) {
  try {
    // Get basic RO details
const [roRows] = await db.query(
  `SELECT 
    rpo.id as rpoid,
    rpo.vehicle as vehicle_id,
    rpo.requested_by as requested_by_uid,
    rpo.kms_before_service,
    rpo.vendor as vendor_id,
    rpo.estimated_repair_amount,
    rpo.repair_notes,
    rpo.work_order_number,
    rpo.status as rpostatus,
    EXISTS(
      SELECT 1 FROM repair_purchase_order_repairs rpor
      WHERE rpor.repair_purchase_order = rpo.id
      AND rpor.work_order_number IS NOT NULL
      AND rpor.work_order_number != ''
    ) as has_rpor_work_order
  FROM repair_purchase_orders rpo
  WHERE rpo.id = ?`,
  [roId]
);

    if (roRows.length === 0) {
      return null;
    }

    const roData = roRows[0];

    // Get associated defect IDs (both regular AND maintenance defects)
    // ⭐ NEW LOGIC: All defects (including maintenance) are now in vehicle_repair_logs with repair_log_id
    // We differentiate by item_type but both use repair_log_id
    const [defects] = await db.query(
      `SELECT repair_log_id as vrlid 
       FROM repair_purchase_order_repairs 
       WHERE repair_purchase_order = ? AND item_type = 'REPAIR' AND repair_log_id IS NOT NULL`,
      [roId]
    );

    // Get maintenance defects (item_type = 'SCHEDULED_MAINTENANCE')
    // ⭐ CRITICAL FIX: Maintenance defects now use repair_log_id (not scheduled_maintenance_setting_id)
    const [maintenanceDefects] = await db.query(
      `SELECT repair_log_id as vrlid 
       FROM repair_purchase_order_repairs 
       WHERE repair_purchase_order = ? AND item_type = 'SCHEDULED_MAINTENANCE' AND repair_log_id IS NOT NULL`,
      [roId]
    );

    // ⭐ OLD SYSTEM: Get legacy scheduled maintenance items (if any exist with NULL repair_log_id)
    // These are from the old system where SM items were stored without repair_log_id
    const [legacyScheduledItems] = await db.query(
      `SELECT scheduled_maintenance_setting_id as scsid 
       FROM repair_purchase_order_repairs 
       WHERE repair_purchase_order = ? AND item_type = 'SCHEDULED_MAINTENANCE' AND repair_log_id IS NULL`,
      [roId]
    );

    console.log(`📊 getRepairOrderForEdit - RO ${roId}:`, {
      regularDefects: defects.length,
      maintenanceDefects: maintenanceDefects.length,
      legacyItems: legacyScheduledItems.length,
      regularDefectIds: defects.map(d => d.vrlid),
      maintenanceDefectIds: maintenanceDefects.map(d => d.vrlid),
      legacyItemIds: legacyScheduledItems.map(s => s.scsid)
    });

return {
  ...roData,
  vendor_locked: !!(
    (roData.work_order_number && roData.work_order_number.trim() !== '') ||
    roData.has_rpor_work_order
  ),
  defect_ids: defects.map(d => d.vrlid),
  scheduled_item_ids: [
    ...maintenanceDefects.map(d => d.vrlid),
    ...legacyScheduledItems.map(s => s.scsid)
  ]
};
  } catch (error) {
    console.error('Service error in getRepairOrderForEdit:', error);
    throw error;
  }
}

/**
 * Update an existing repair order
 * FOLLOWS EXACT PHP LOGIC FROM edit-repair-purchase-order.php
 */
async function updateRepairOrder(id, roData, metadata) {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const roId = id;
    const {
      txtVehicle,
      txtRequestedBy,
      txtBusKms,
      txtVendor,
      txtEstimatedAmount,
      txtNotes,
      vrls = [],
      scheduled_maintenance_items = []
    } = roData;
    
    // Validation
    if (!txtVehicle || !txtRequestedBy || !txtBusKms || !txtVendor || !txtEstimatedAmount) {
      await connection.rollback();
      connection.release();
      throw new Error('Missing required RO details');
    }
    
    // Check if RO exists and is in Active status
    const [roCheck] = await connection.query(
      'SELECT status FROM repair_purchase_orders WHERE id = ? AND status = 1',
      [roId]
    );
    
    if (roCheck.length === 0) {
      await connection.rollback();
      connection.release();
      throw new Error('Repair Order not found or not active');
    }
    
    // 1. SEPARATE INCOMING vrls INTO REGULAR DEFECTS AND SM DEFECTS
    // Frontend sends ALL defects (both types) in vrls array
    // Backend categorizes by defect_source: 'maintenance' vs others
    const incomingVrlIds = vrls.map(id => parseInt(id));
    
    let newRegularDefectIds = [];
    let newSMDefectIds = [];
    
    if (incomingVrlIds.length > 0) {
      const placeholders = incomingVrlIds.map(() => '?').join(',');
      const [vrlDetails] = await connection.query(
        `SELECT id, defect_source FROM vehicle_repair_logs WHERE id IN (${placeholders})`,
        incomingVrlIds
      );
      
      // Separate based on defect_source
      vrlDetails.forEach(vrl => {
        if (vrl.defect_source === 'maintenance') {
          newSMDefectIds.push(vrl.id);
        } else {
          newRegularDefectIds.push(vrl.id);
        }
      });
    }
    
    // 2. GET CURRENT ITEMS FROM DATABASE
    // Current regular defects in RO
    const [currentDefectsRaw] = await connection.query(
      `SELECT repair_log_id FROM repair_purchase_order_repairs 
       WHERE repair_purchase_order = ? AND item_type = 'REPAIR'`,
      [roId]
    );
    const currentDefectIds = currentDefectsRaw.map(row => row.repair_log_id);
    
    // Current SM defects in RO (same structure as regular defects, just item_type differs)
    const [currentSMDefectsRaw] = await connection.query(
      `SELECT repair_log_id FROM repair_purchase_order_repairs 
       WHERE repair_purchase_order = ? AND item_type = 'SCHEDULED_MAINTENANCE'`,
      [roId]
    );
    const currentSMDefectIds = currentSMDefectsRaw.map(row => row.repair_log_id);
    
    console.log('📊 Current vs New Items:', {
      current: { regularDefects: currentDefectIds.length, smDefects: currentSMDefectIds.length },
      incoming: { regularDefects: newRegularDefectIds.length, smDefects: newSMDefectIds.length }
    });
    
    // 3. CALCULATE CHANGES (SAME LOGIC FOR BOTH TYPES)
    // Regular defects: add/remove logic
    const defectsToAdd = newRegularDefectIds.filter(id => !currentDefectIds.includes(id));
    const defectsToRemove = currentDefectIds.filter(id => !newRegularDefectIds.includes(id));
    
    // SM defects: SAME add/remove logic (mirrors regular defects exactly)
    const smDefectsToAdd = newSMDefectIds.filter(id => !currentSMDefectIds.includes(id));
    const smDefectsToRemove = currentSMDefectIds.filter(id => !newSMDefectIds.includes(id));
    
    console.log('🔄 Edit RO Changes:', {
      regular: { toAdd: defectsToAdd, toRemove: defectsToRemove },
      sm: { toAdd: smDefectsToAdd, toRemove: smDefectsToRemove }
    });
    
    const successfullyAddedDefects = [];
    const existingDefectRemoved = [];
    const successfullyAddedSms = [];
    const existingSmsRemoved = [];
    
    // Update RO basic details (PHP: update repair_purchase_orders)
    const loggedUser = metadata?.userId || 1;
    await connection.query(
      `UPDATE repair_purchase_orders 
       SET repair_notes = ?, 
           vehicle = ?, 
           requested_by = ?, 
           vendor = ?, 
           kms_before_service = ?, 
           estimated_repair_amount = ?, 
           created_by = ?, 
           created_on = CURRENT_TIMESTAMP(), 
           status = 1 
       WHERE id = ? AND status = 1 
       LIMIT 1`,
      [txtNotes || '', txtVehicle, txtRequestedBy, txtVendor, txtBusKms, txtEstimatedAmount, loggedUser, roId]
    );
    
    // === ADD NEW DEFECTS ===
    for (const defectId of defectsToAdd) {
      // Get defect details
      const [defectDetailsRaw] = await connection.query(
        'SELECT * FROM vehicle_repair_logs WHERE id = ? LIMIT 1',
        [defectId]
      );
      
      if (defectDetailsRaw.length === 0) continue;
      
      const defectDetails = defectDetailsRaw[0];
      
      // ⭐ Determine item_type and scheduled_maintenance_setting_id based on defect_source
      const isMaintenanceDefect = defectDetails.defect_source === 'maintenance';
      const itemType = isMaintenanceDefect ? 'SCHEDULED_MAINTENANCE' : 'REPAIR';
      const scheduledMaintenanceSettingId = defectDetails.schedule_maintenance_id || null;
      
      // Insert into repair_purchase_order_repairs (PHP: INSERT INTO repair_purchase_order_repairs)
      const [rporResult] = await connection.query(
        `INSERT INTO repair_purchase_order_repairs (
          item_type, repair_purchase_order, repair_log_id, 
          repair_notes, rpor_status, scheduled_maintenance_setting_id
        ) VALUES (?, ?, ?, ?, 'Open', ?)`,
        [itemType, roId, defectId, defectDetails.notes || '', scheduledMaintenanceSettingId]
      );
      
      const rporId = rporResult.insertId;
      
      // Update defect status to In_Progress (matching Create RO logic - including entire merged group)
      const defectIdsToUpdate = [defectId]; // Start with the selected defect
      
      // Check if this defect is part of a merged group
      if (defectDetails.merged_records_id) {
        // Get ALL defects in the same merged group
        const [mergedGroup] = await connection.query(
          'SELECT id FROM vehicle_repair_logs WHERE merged_records_id = ?',
          [defectDetails.merged_records_id]
        );
        const groupIds = mergedGroup.map(row => row.id);
        defectIdsToUpdate.push(...groupIds.filter(id => id !== defectId));
      }
      
      // Update all relevant defects to Open (matches PHP Edit RO logic)
      if (defectIdsToUpdate.length > 0) {
        for (const vrlId of defectIdsToUpdate) {
          await connection.query(
            `UPDATE vehicle_repair_logs 
             SET defect_status = 'Open',
                 related_repair_purchase_order = ?,
                 linked_to_roid = ?,
                 linked_to_ro_items = ?
             WHERE id = ?
             LIMIT 1`,
            [roId, roId, rporId, vrlId]
          );
        }
        
        successfullyAddedDefects.push(defectId); // Track only the originally assigned defect
      }
    }
    
    // === REMOVE DELETED DEFECTS ===
    if (defectsToRemove.length > 0) {
      // 1. First, get all defect IDs that need status restoration (including merged groups)
      const defectsToRestore = [];
      
      for (const defectId of defectsToRemove) {
        // Add the defect itself
        defectsToRestore.push(defectId);
        
        // Check if it's part of a merged group
        const [defectDetailsRaw] = await connection.query(
          'SELECT merged_records_id FROM vehicle_repair_logs WHERE id = ? LIMIT 1',
          [defectId]
        );
        
        if (defectDetailsRaw.length > 0 && defectDetailsRaw[0].merged_records_id) {
          // Get all defects in the same merged group
          const [mergedGroup] = await connection.query(
            'SELECT id FROM vehicle_repair_logs WHERE merged_records_id = ?',
            [defectDetailsRaw[0].merged_records_id]
          );
          const groupIds = mergedGroup.map(row => row.id);
          defectsToRestore.push(...groupIds.filter(id => !defectsToRestore.includes(id)));
        }
      }

      // WEBHOOK CALL DEFECT REMOVE
      // ⭐ 3. TRIGGER WEBHOOKS (BEFORE updating vehicle_repair_logs)
const [removedDefectDetails] = await connection.query(
  `SELECT 
    vrl.id,
    vrl.external_garage_defect_id,
    vrl.related_repair_purchase_order,
    rpo.status as ro_status
   FROM vehicle_repair_logs vrl
   LEFT JOIN repair_purchase_orders rpo ON rpo.id = vrl.related_repair_purchase_order
   WHERE vrl.id IN (${defectsToRemove.map(() => '?').join(',')})`,
  defectsToRemove
);

console.log(`🔔 Triggering ${removedDefectDetails.length} removal webhooks...`);
const garageWebhookService = require('./garageWebhookService');

for (const defect of removedDefectDetails) {
  try {
    await garageWebhookService.notifyDefectRemoved(
      defect.id,                              // VRL ID
      defect.external_garage_defect_id,       // Garage defect ID
      roId,                                    // RO ID
      defect.related_repair_purchase_order,   // RPOR ID
      defect.ro_status                    // RO Status ⭐ Now has value
    );
    console.log(`✅ Removal webhook sent for VRL ${defect.id}`);
  } catch (webhookError) {
    console.error(`❌ Webhook failed for VRL ${defect.id}:`, webhookError.message);
  }
}

      // WEBHOOK CALL DEFECT REMOVE END
      // Remove duplicates
      const uniqueDefectsToRestore = [...new Set(defectsToRestore)];
      
      // 2. FIRST: Restore ALL relevant defects to Open status
      // CRITICAL: Must update vehicle_repair_logs BEFORE deleting from repair_purchase_order_repairs
      // to avoid foreign key constraint error (fk_ro_repairitem)
      // PHP keeps motive_defect_status unchanged and sets previous_ro_id
      if (uniqueDefectsToRestore.length > 0) {
        for (const vrlId of uniqueDefectsToRestore) {
          await connection.query(
            `UPDATE vehicle_repair_logs 
             SET defect_status = 'Open',
                 related_repair_purchase_order = NULL,
                 linked_to_roid = NULL,
                 linked_to_ro_items = NULL,
                 previous_ro_id = ?
             WHERE id = ?
             LIMIT 1`,
            [roId, vrlId]
          );
        }
      }
      
      // 3. THEN: Delete the RO repair items (after linked_to_ro_items is NULL)
      const placeholders = defectsToRemove.map(() => '?').join(',');
      await connection.query(
        `DELETE FROM repair_purchase_order_repairs 
         WHERE repair_purchase_order = ? AND repair_log_id IN (${placeholders}) AND item_type = 'REPAIR'`,
        [roId, ...defectsToRemove]
      );


      
      existingDefectRemoved.push(...defectsToRemove);
    }
    
    // === ADD NEW SM DEFECTS (mirrors regular defects logic) ===
    for (const smDefectId of smDefectsToAdd) {
      // Get SM defect details
      const [smDefectDetailsRaw] = await connection.query(
        'SELECT * FROM vehicle_repair_logs WHERE id = ? LIMIT 1',
        [smDefectId]
      );
      
      if (smDefectDetailsRaw.length === 0) continue;
      
      const smDefectDetails = smDefectDetailsRaw[0];
      
      // Determine scheduled_maintenance_setting_id
      const scheduledMaintenanceSettingId = smDefectDetails.schedule_maintenance_id || null;
      
      // Insert into repair_purchase_order_repairs (item_type = 'SCHEDULED_MAINTENANCE')
      const [rporResult] = await connection.query(
        `INSERT INTO repair_purchase_order_repairs (
          item_type, repair_purchase_order, repair_log_id, 
          repair_notes, rpor_status, scheduled_maintenance_setting_id
        ) VALUES ('SCHEDULED_MAINTENANCE', ?, ?, ?, 'Open', ?)`,
        [roId, smDefectId, smDefectDetails.notes || '', scheduledMaintenanceSettingId]
      );
      
      const rporId = rporResult.insertId;
      
      // Update SM defect status to Open (matching regular defects logic)
      const smDefectIdsToUpdate = [smDefectId];
      
      // Check if this SM defect is part of a merged group
      if (smDefectDetails.merged_records_id) {
        const [mergedGroup] = await connection.query(
          'SELECT id FROM vehicle_repair_logs WHERE merged_records_id = ?',
          [smDefectDetails.merged_records_id]
        );
        const groupIds = mergedGroup.map(row => row.id);
        smDefectIdsToUpdate.push(...groupIds.filter(id => id !== smDefectId));
      }
      
      // Update all relevant SM defects to Open
      if (smDefectIdsToUpdate.length > 0) {
        for (const vrlId of smDefectIdsToUpdate) {
          await connection.query(
            `UPDATE vehicle_repair_logs 
             SET defect_status = 'Open',
                 related_repair_purchase_order = ?,
                 linked_to_roid = ?,
                 linked_to_ro_items = ?
             WHERE id = ?
             LIMIT 1`,
            [roId, roId, rporId, vrlId]
          );
        }
        
        successfullyAddedSms.push(smDefectId);
      }
    }
    
    // === REMOVE DELETED SM DEFECTS (mirrors regular defects logic) ===
    if (smDefectsToRemove.length > 0) {
      // Get all SM defect IDs that need status restoration (including merged groups)
      const smDefectsToRestore = [];
      
      for (const smDefectId of smDefectsToRemove) {
        smDefectsToRestore.push(smDefectId);
        
        // Check if part of a merged group
        const [smDefectDetailsRaw] = await connection.query(
          'SELECT merged_records_id FROM vehicle_repair_logs WHERE id = ? LIMIT 1',
          [smDefectId]
        );
        
        if (smDefectDetailsRaw.length > 0 && smDefectDetailsRaw[0].merged_records_id) {
          const [mergedGroup] = await connection.query(
            'SELECT id FROM vehicle_repair_logs WHERE merged_records_id = ?',
            [smDefectDetailsRaw[0].merged_records_id]
          );
          const groupIds = mergedGroup.map(row => row.id);
          smDefectsToRestore.push(...groupIds.filter(id => !smDefectsToRestore.includes(id)));
        }
      }
      
      // Remove duplicates
      const uniqueSMDefectsToRestore = [...new Set(smDefectsToRestore)];
      
      // Restore ALL relevant SM defects to Open status
      if (uniqueSMDefectsToRestore.length > 0) {
        for (const vrlId of uniqueSMDefectsToRestore) {
          await connection.query(
            `UPDATE vehicle_repair_logs 
             SET defect_status = 'Open',
                 related_repair_purchase_order = NULL,
                 linked_to_roid = NULL,
                 linked_to_ro_items = NULL,
                 previous_ro_id = ?
             WHERE id = ?
             LIMIT 1`,
            [roId, vrlId]
          );
        }
      }
      
      // Delete the RO repair items
      const placeholders = smDefectsToRemove.map(() => '?').join(',');
      await connection.query(
        `DELETE FROM repair_purchase_order_repairs 
         WHERE repair_purchase_order = ? AND repair_log_id IN (${placeholders}) AND item_type = 'SCHEDULED_MAINTENANCE'`,
        [roId, ...smDefectsToRemove]
      );
      
      existingSmsRemoved.push(...smDefectsToRemove);
    }
    

    
    // Build success message (PHP: $successMsg)
    let successMsg = '';
    if (successfullyAddedDefects.length > 0) {
      successMsg += `Added New defects ${successfullyAddedDefects.join(',')}, `;
    }
    if (existingDefectRemoved.length > 0) {
      successMsg += `Removed defects ${existingDefectRemoved.join(',')}, `;
    }
    if (successfullyAddedSms.length > 0) {
      successMsg += `Added New Scheduled Maintenance ${successfullyAddedSms.join(',')}, `;
    }
    if (existingSmsRemoved.length > 0) {
      successMsg += `Removed Scheduled Maintenance ${existingSmsRemoved.join(',')}, `;
    }
    successMsg = `Updated RO ${roId}; ${successMsg}`;
    
    // ✅ Handle file upload if present (matching PHP Update RO logic)
    if (roData.uploadedFile) {
      await connection.query(
        `INSERT INTO ro_attachments (ro_id, original_filename, stored_filename, upload_timestamp, status)
         VALUES (?, ?, ?, NOW(), 1)`,
        [roId, roData.uploadedFile.originalName, roData.uploadedFile.storedName]
      );
      console.log(`✅ File uploaded: ${roData.uploadedFile.storedName} for RO${roId}`);
      successMsg += ` File attached: ${roData.uploadedFile.originalName}`;
    }
    
    // Create activity log
    await connection.query(
      'INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())',
      [roId, loggedUser, successMsg]
    );
    
    await connection.commit();
    connection.release();
    
    console.log(`✅ ${successMsg}`);
    
    return {
      ro_id: roId,
      message: successMsg,
      defects_added: successfullyAddedDefects.length,
      defects_removed: existingDefectRemoved.length,
      sm_added: successfullyAddedSms.length,
      sm_removed: existingSmsRemoved.length,
      // Track actual IDs for audit logging
      defectChanges: {
        defectsAdded: successfullyAddedDefects,
        defectsRemoved: existingDefectRemoved,
        smAdded: successfullyAddedSms,
        smRemoved: existingSmsRemoved
      }
    };
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('Service error in updateRepairOrder:', error);
    throw error;
  }
}

/**
 * Cancel a repair order and update associated defects to RO_Cancelled status
 */
async function cancelRepairOrder(rpoid, metadata) {
  try {

      // ⭐ ADD THIS BLOCK - Validate no defects are in progress
    const [activeDefects] = await db.query(
      `SELECT rpor.id, rpor.rpor_status, vrl.repair_desc
       FROM repair_purchase_order_repairs rpor
       LEFT JOIN vehicle_repair_logs vrl ON rpor.repair_log_id = vrl.id
       WHERE rpor.repair_purchase_order = ?
       AND rpor.rpor_status IN ('SR_STARTED', 'In_Progress', 'Repair_Started', 'Completed')`,
      [rpoid]
    );

    if (activeDefects.length > 0) {
      const details = activeDefects.map(d => `${d.repair_desc || '#' + d.id} (${d.rpor_status})`).join(', ');
      throw new Error(`Cannot cancel RO: ${activeDefects.length} item(s) have work in progress — ${details}`);
    }
    // ⭐ END VALIDATION BLOCK

       // ⭐ NEW: Trigger RO cancellation webhook -- Webhook call or Trigger  for RO Cancelled
    const loggedUser = metadata?.userId || 1;
    const garageWebhookService = require('./garageWebhookService');
    
    console.log(`🔔 Triggering RO cancellation webhook for RO ${rpoid}...`);
    try {
      await garageWebhookService.notifyROCancelled(rpoid, loggedUser);
      console.log(`✅ RO cancellation webhook sent for RO ${rpoid}`);
    } catch (webhookError) {
      console.error(`❌ RO cancellation webhook failed for RO ${rpoid}:`, webhookError.message);
      // Don't throw - continue with cancellation
    }
      // ⭐ NEW: Trigger RO cancellation webhook -- Webhook call or Trigger  for RO Cancelled
    // First, get all repair logs associated with this RO (BOTH regular AND SM)
    const getRepairsQuery = `
      SELECT * 
      FROM repair_purchase_order_repairs 
      WHERE repair_purchase_order = ? 
      AND repair_log_id IS NOT NULL`;
    
    const [repairs] = await db.query(getRepairsQuery, [rpoid]);

    // Track total defects updated (including merged groups)
    let totalDefectsUpdated = 0;

    // Update defects to RO_Cancelled status and unlink from this RO
    if (repairs.length > 0) {
      for (const repair of repairs) {
        // Get the defect to check if it's part of a merged group
        const [defectDetails] = await db.query(
          'SELECT merged_records_id FROM vehicle_repair_logs WHERE id = ? LIMIT 1',
          [repair.repair_log_id]
        );
        
        const defectIdsToUpdate = [repair.repair_log_id];
        
        // If part of a merged group, update all defects in the group
        if (defectDetails.length > 0 && defectDetails[0].merged_records_id) {
          const [mergedGroup] = await db.query(
            'SELECT id FROM vehicle_repair_logs WHERE merged_records_id = ?',
            [defectDetails[0].merged_records_id]
          );
          mergedGroup.forEach(item => {
            if (!defectIdsToUpdate.includes(item.id)) {
              defectIdsToUpdate.push(item.id);
            }
          });
        }
        
        // Update all defects in the group to RO_Cancelled status
        for (const defectId of defectIdsToUpdate) {
          await db.query(
            `UPDATE vehicle_repair_logs 
             SET defect_status = 'RO_Cancelled',
                 motive_defect_status = 'cancelled',
                 linked_to_roid = NULL,
                 linked_to_ro_items = NULL,
                 related_repair_purchase_order = NULL
             WHERE id = ? 
             LIMIT 1`,
            [defectId]
          );
          totalDefectsUpdated++;
        }
      }
    }

    // Update the repair order status to canceled (3)
    const updateROQuery = `
      UPDATE repair_purchase_orders 
      SET status = 3 
      WHERE id = ?
      LIMIT 1
    `;
    await db.query(updateROQuery, [rpoid]);

    // Update repair order repairs status to canceled
    const updateRepairsQuery = `
      UPDATE repair_purchase_order_repairs 
      SET rpor_status = 'RO_Cancelled' 
      WHERE repair_purchase_order = ?
    `;
    await db.query(updateRepairsQuery, [rpoid]);

    // Log the cancellation
    await logRepairOrderAction(rpoid, metadata?.userId, 'RO Canceled');

    return {
      rpoid,
      repairsReactivated: repairs.length,
      totalDefectsUpdated: totalDefectsUpdated
    };
  } catch (error) {
    console.error('Service error in cancelRepairOrder:', error);
    throw error;
  }
}

/**
 * Delete (soft delete) a repair order
 */
async function deleteRepairOrder(id, metadata) {
  try {
    const query = `
      UPDATE repair_purchase_orders 
      SET status = 3 
      WHERE id = ? 
      LIMIT 1
    `;

    const [result] = await db.query(query, [id]);

    if (result.affectedRows === 0) {
      return null;
    }

    // Log the deletion
    await logRepairOrderAction(id, metadata?.userId, 'RO Deleted');

    return { id };
  } catch (error) {
    console.error('Service error in deleteRepairOrder:', error);
    throw error;
  }
}

/**
 * Complete/Update an In Progress repair order (status = 2)
 * This is for updating RO after vendor completes the work
 */
async function completeRepairOrder(id, completionData, metadata) {
  try {
    const {
      kms_after_service,
      invoice_amount,
      work_order_number,
      invoice_number,
      service_completed_date,
      payment_method,
      payment_notes,
      repair_notes
    } = completionData;

    // First check if RO exists and is In Progress (status = 2)
    const checkQuery = `
      SELECT id, status 
      FROM repair_purchase_orders 
      WHERE id = ? 
      LIMIT 1
    `;
    const [roCheck] = await db.query(checkQuery, [id]);
    
    if (roCheck.length === 0) {
      throw new Error('Repair Order not found');
    }
    
    if (roCheck[0].status !== 2) {
      throw new Error('Only In Progress repair orders can be completed');
    }

    // Update the repair order with completion details
    const updateQuery = `
      UPDATE repair_purchase_orders 
      SET kms_after_service = ?,
          invoice_amount = ?,
          work_order_number = ?,
          invoice_number = ?,
          service_completed_date = ?,
          payment_method = ?,
          payment_notes = ?,
          repair_notes = ?
      WHERE id = ? AND status = 2
      LIMIT 1
    `;

    await db.query(updateQuery, [
      kms_after_service,
      invoice_amount,
      work_order_number,
      invoice_number,
      service_completed_date,
      payment_method,
      payment_notes || '',
      repair_notes || '',
      id
    ]);

    // Log the update
    await logRepairOrderAction(id, metadata?.userId, 'RO updated after completion');

    console.log(`✅ Completed RO ${id} with invoice amount: ${invoice_amount}`);

    return {
      success: true,
      ro_id: id
    };
  } catch (error) {
    console.error('Service error in completeRepairOrder:', error);
    throw error;
  }
}

/**
 * Create initial log entries for ROs that don't have any logs
 * Useful for backfilling existing data
 */
async function createInitialLogsForRO(roId) {
  try {
    // Check if RO exists
    const roData = await getRepairOrderById(roId);
    if (!roData) {
      throw new Error(`RO ${roId} not found`);
    }

    // Check if logs already exist
    const [existingLogs] = await db.query(
      'SELECT COUNT(*) as count FROM vm_logs WHERE ro_id = ?',
      [roId]
    );

    if (existingLogs[0].count > 0) {
      console.log(`RO ${roId} already has ${existingLogs[0].count} logs`);
      return { roId, logsCreated: 0, message: 'Logs already exist' };
    }

    // Create initial log based on RO creation date
    const userId = roData.requested_by || 1;
    const createdDate = roData.created_on;
    
    const query = `
      INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) 
      VALUES (?, ?, ?, ?)
    `;
    
    await db.query(query, [
      roId,
      userId,
      `RO Created - Vehicle: ${roData.vehicle_nickname}, Vendor: ${roData.vendor_name}`,
      createdDate
    ]);

    // If RO is finished, create a completion log
    if (roData.rpostatus === 2 && roData.service_completed_date) {
      await db.query(query, [
        roId,
        userId,
        `RO Completed - Invoice Amount: $${roData.invoice_amount || 0}`,
        roData.service_completed_date
      ]);
    }

    // If RO is cancelled
    if (roData.rpostatus === 3) {
      await db.query(query, [
        roId,
        userId,
        'RO Cancelled',
        roData.created_on
      ]);
    }

    console.log(`Created initial logs for RO ${roId}`);
    return { roId, logsCreated: roData.rpostatus === 2 ? 2 : 1, message: 'Initial logs created' };
  } catch (error) {
    console.error(`Error creating initial logs for RO ${roId}:`, error);
    throw error;
  }
}

/**
 * Backfill logs for all ROs that don't have any
 */
async function backfillAllROLogs() {
  try {
    // Get all ROs without logs
    const query = `
      SELECT rpo.id
      FROM repair_purchase_orders rpo
      LEFT JOIN vm_logs vml ON vml.ro_id = rpo.id
      WHERE vml.id IS NULL
      GROUP BY rpo.id
    `;
    
    const [rosWithoutLogs] = await db.query(query);
    
    console.log(`Found ${rosWithoutLogs.length} ROs without logs`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const ro of rosWithoutLogs) {
      try {
        await createInitialLogsForRO(ro.id);
        successCount++;
      } catch (error) {
        console.error(`Failed to create logs for RO ${ro.id}:`, error);
        errorCount++;
      }
    }
    
    return {
      total: rosWithoutLogs.length,
      success: successCount,
      errors: errorCount
    };
  } catch (error) {
    console.error('Error in backfillAllROLogs:', error);
    throw error;
  }
}

/**
 * Get vehicle defects for creating a Repair Order
 * Matches PHP: getVehicleRepairs()
 * NOW INCLUDES: Last completed repair details (mechanic_notes, completion date, mechanic name)
 * @param {number} vehicleId - Vehicle ID
 * @param {string} preselectedDefectIds - Comma-separated defect IDs from URL
 * @param {number|null} roId - Repair Order ID (for edit mode)
 * @param {string|null} sourceFilter - Filter defects by defect_source ('maintenance', 'exclude_maintenance', or null for all)
 */
async function getVehicleDefects(vehicleId, preselectedDefectIds = '', roId = null, sourceFilter = null) {
  try {
    // Use the defectService to get defects with last completed repair details
    const defects = await defectService.getDefectsWithLastCompleted(vehicleId, {
      txtDefects: preselectedDefectIds,
      ro_id: roId,
      source_filter: sourceFilter  // Pass filter to defectService
    });
    
    console.log(`✅ Found ${defects.length} defects for vehicle ${vehicleId} with last completed repair history (source_filter: ${sourceFilter || 'none'})`);
    
    // Map fields to match existing structure (vrlid instead of just id)
    const mappedDefects = defects.map(defect => ({
      ...defect,
      vrlid: defect.vrlid || defect.id,
      // Last completed repair fields are already included from defectService
      // last_mechanic_notes
      // last_completion_date
      // last_mechanic_name
    }));
    
    // If in edit mode with roId, need to get RO defects separately (already in RO)
    if (roId) {
      // ⭐ Build item_type filter based on sourceFilter
      let itemTypeFilter = '';
      if (sourceFilter === 'maintenance') {
        // Fetch ONLY maintenance defects
        itemTypeFilter = "AND rpor.item_type = 'SCHEDULED_MAINTENANCE' AND rpor.repair_log_id IS NOT NULL";
      } else if (sourceFilter === 'exclude_maintenance') {
        // Fetch ONLY regular defects (exclude maintenance)
        itemTypeFilter = "AND rpor.item_type = 'REPAIR'";
      } else {
        // Fetch BOTH types (but only those with repair_log_id)
        itemTypeFilter = "AND rpor.repair_log_id IS NOT NULL";
      }
      
      const roDefectsQuery = `
        SELECT
          rcc.*,
          vrl.*,
          rpor.rpor_status,
          rpor.repair_purchase_order,
          rcc.repair_code_category,
          vrl.id AS vrlid,
          vrl.previous_ro_id,
          COALESCE(merge_counts.merged_count, 0) as merged_count,
          CASE 
            WHEN vrl.is_duplicate = 'y' AND vrl.merged_records_id IS NOT NULL THEN
              (SELECT id FROM vehicle_repair_logs vrl2 
               WHERE vrl2.merged_records_id = vrl.merged_records_id 
               AND vrl2.is_duplicate = 'n' 
               LIMIT 1)
            ELSE NULL
          END as primary_defect_id
        FROM repair_purchase_order_repairs rpor
        LEFT JOIN vehicle_repair_logs vrl ON rpor.repair_log_id = vrl.id
        LEFT JOIN repair_code_categories rcc ON rcc.id = vrl.repair_code_category
        LEFT JOIN (\n          SELECT \n            merged_records_id,\n            COUNT(*) as merged_count\n          FROM vehicle_repair_logs \n          WHERE is_duplicate = 'y'\n          GROUP BY merged_records_id\n        ) merge_counts ON merge_counts.merged_records_id = vrl.merged_records_id  
        WHERE vrl.vehicle = ?
        AND rpor.repair_purchase_order = ?
        ${itemTypeFilter}
        AND (vrl.is_duplicate = 'n' OR vrl.is_duplicate IS NULL)
        ORDER BY rcc.repair_code_category ASC
      `;
      
      console.log(`🔍 [DEBUG] Executing RO defects query for RO ${roId}:`, {
        vehicleId,
        roId,
        sourceFilter,
        itemTypeFilter,
        query: roDefectsQuery.substring(0, 200) + '...'
      });
      
      const [roDefects] = await db.query(roDefectsQuery, [vehicleId, roId]);
      
      console.log(`✅ Found ${roDefects.length} defects already in RO ${roId} (sourceFilter: ${sourceFilter || 'none'})`, {
        defectIds: roDefects.map(d => d.vrlid),
        defects: roDefects.map(d => ({
          vrlid: d.vrlid,
          repair_desc: d.repair_desc,
          defect_source: d.defect_source,
          rpor_status: d.rpor_status
        }))
      });
      
      // Merge: RO defects first, then available defects (avoiding duplicates)
      const roDefectIds = new Set(roDefects.map(d => d.vrlid));
      const availableDefects = mappedDefects.filter(d => !roDefectIds.has(d.vrlid));
      
      return [...roDefects, ...availableDefects];
    }
    
    return mappedDefects;
  } catch (error) {
    console.error('Service error in getVehicleDefects:', error);
    throw error;
  }
}

/**
 * Get scheduled maintenance for a vehicle
 * Matches PHP: getVehicleScheduledMaintenance()
 * In EDIT mode (roId provided): Returns items IN this RO (with rpor_status) + available items
 * NOW INCLUDES: Status calculation (OVERDUE, DUE_SOON, GOOD) based on current_km and last_replaced_km
 */
async function getVehicleScheduledMaintenance(vehicleId, roId = null) {
  try {
    // Get vehicle configuration AND current_km AND configuration name
    const [vehicleData] = await db.query(
      `SELECT v.vehicle_configuration, v.current_km, sc.configuration_name 
       FROM vehicles v
       LEFT JOIN scheduled_configurations sc ON sc.id = v.vehicle_configuration
       WHERE v.id = ? LIMIT 1`,
      [vehicleId]
    );
    
    console.log(`🔍 [DEBUG] Vehicle ${vehicleId} data:`, vehicleData[0]);
    
    if (!vehicleData.length || !vehicleData[0].vehicle_configuration) {
      console.log(`❌ [DEBUG] Vehicle ${vehicleId} has NO vehicle_configuration set!`);
      return { configurationName: null, items: [] };
    }
    
    const vehicleConfig = vehicleData[0].vehicle_configuration;
    const currentKm = parseFloat(vehicleData[0].current_km || 0);
    const configurationName = vehicleData[0].configuration_name || 'Unknown Configuration';
    
    console.log(`📊 Vehicle ${vehicleId} - Config: ${configurationName} (${vehicleConfig}), Current KM: ${currentKm}`);
    
    // NEW APPROACH: Query ACTIVE vehicle_scheduled_maintenance records first (like Fleet Management)
    // This ensures we only show settings that are actively assigned to this vehicle with status=1
    const settingsQuery = `
      SELECT 
        vsm.id as vsm_id,
        vsm.last_maintenance_date,
        vsm.last_replaced_km,
        vsm.status as vsm_status,
        scs.id as scsid, 
        scs.setting_name, 
        scs.setting_type,
        scs.status as scs_status,
        cs.kms, 
        cs.kms_to_alert, 
        cs.days, 
        cs.days_to_alert,
        cs.time_unit,
        cs.interval_type,
        cs.status as cs_status
      FROM vehicle_scheduled_maintenance vsm
      INNER JOIN scheduled_configuration_settings scs ON scs.id = vsm.scheduled_maintenance AND scs.status = 1
      INNER JOIN configuration_settings cs ON cs.setting = scs.id AND cs.configuration = ? AND cs.status = 1
      WHERE vsm.vehicle = ?
      AND vsm.status = 1
    `;
    
    console.log(`🔍 [SQL DEBUG] Executing query with params:`, { vehicleConfig, vehicleId });
    console.log(`🔍 [SQL DEBUG] Full query:`, settingsQuery.replace(/\?/g, (match, offset, string) => {
      const index = string.substring(0, offset).split('?').length - 1;
      return index === 0 ? vehicleConfig : vehicleId;
    }));
    
    const [settings] = await db.query(settingsQuery, [vehicleConfig, vehicleId]);
    
    console.log(`📋 Found ${settings.length} ACTIVE scheduled maintenance settings for vehicle ${vehicleId}`);
    
    if (settings.length > 0) {
      console.log(`🔍 [SQL DEBUG] First setting returned:`, JSON.stringify(settings[0], null, 2));
    }
    
    // 🔍 DEBUG: If no settings found, check why
    if (settings.length === 0) {
      console.log(`⚠️ [DEBUG] No settings found. Checking each table separately...`);
      
      // Check vehicle_scheduled_maintenance
      const [vsmCheck] = await db.query(
        `SELECT COUNT(*) as count FROM vehicle_scheduled_maintenance WHERE vehicle = ?`,
        [vehicleId]
      );
      console.log(`  📊 vehicle_scheduled_maintenance: ${vsmCheck[0].count} total records for vehicle ${vehicleId}`);
      
      const [vsmActiveCheck] = await db.query(
        `SELECT COUNT(*) as count FROM vehicle_scheduled_maintenance WHERE vehicle = ? AND status = 1`,
        [vehicleId]
      );
      console.log(`  ✅ vehicle_scheduled_maintenance: ${vsmActiveCheck[0].count} ACTIVE records (status=1)`);
      
      // Check configuration_settings
      const [csCheck] = await db.query(
        `SELECT COUNT(*) as count FROM configuration_settings WHERE configuration = ?`,
        [vehicleConfig]
      );
      console.log(`  📊 configuration_settings: ${csCheck[0].count} total records for config ${vehicleConfig}`);
      
      const [csActiveCheck] = await db.query(
        `SELECT COUNT(*) as count FROM configuration_settings WHERE configuration = ? AND status = 1`,
        [vehicleConfig]
      );
      console.log(`  ✅ configuration_settings: ${csActiveCheck[0].count} ACTIVE records (status=1)`);
      
      // Check if the JOIN is working
      const [joinCheck] = await db.query(`
        SELECT 
          vsm.id, 
          vsm.scheduled_maintenance,
          scs.id as scs_id,
          scs.setting_name,
          cs.id as cs_id,
          cs.configuration
        FROM vehicle_scheduled_maintenance vsm
        LEFT JOIN scheduled_configuration_settings scs ON scs.id = vsm.scheduled_maintenance
        LEFT JOIN configuration_settings cs ON cs.setting = scs.id
        WHERE vsm.vehicle = ? AND vsm.status = 1
        LIMIT 5
      `, [vehicleId]);
      console.log(`  🔍 JOIN Test (first 5 rows):`, JSON.stringify(joinCheck, null, 2));
      
      // Check what configuration values exist
      const [configCheck] = await db.query(`
        SELECT DISTINCT cs.configuration, COUNT(*) as count
        FROM vehicle_scheduled_maintenance vsm
        INNER JOIN scheduled_configuration_settings scs ON scs.id = vsm.scheduled_maintenance
        INNER JOIN configuration_settings cs ON cs.setting = scs.id
        WHERE vsm.vehicle = ?
        GROUP BY cs.configuration
      `, [vehicleId]);
      console.log(`  🔍 Configurations found for vehicle ${vehicleId}:`, JSON.stringify(configCheck, null, 2));
      console.log(`  ⚠️ Expected configuration: ${vehicleConfig}`);
    }
    
    const eligibleItems = [];
    
    for (const setting of settings) {
      try {
        console.log(`\n🔧 Processing setting: ${setting.setting_name} (ID: ${setting.scsid}, Type: ${setting.interval_type})`);
        console.log(`   Last maintenance: ${setting.last_maintenance_date}, Last KM: ${setting.last_replaced_km}`);
        
        // ⭐ NEW: Check if this setting is already in an active RO (excluding the RO being edited)
        // Returns duplicate info: RO number, RO ID, and status
        let smCheckQuery;
        let smCheckParams;
      
      if (roId) {
        // EDIT MODE: Check for items in OTHER active ROs (items in THIS RO will be fetched separately later)
        smCheckQuery = `
          SELECT 
            rpo.id as ro_id,
            rpo.id as ro_number,
            rpor.rpor_status as rpor_status
          FROM repair_purchase_order_repairs rpor 
          INNER JOIN repair_purchase_orders rpo ON rpo.id = rpor.repair_purchase_order 
          WHERE rpo.vehicle = ? 
          AND rpor.item_type = 'SCHEDULED_MAINTENANCE' 
          AND rpor.scheduled_maintenance_setting_id = ? 
          AND rpor.rpor_status NOT IN ('Completed', 'Repair_Not_Needed')
          AND rpo.status != 0
          AND rpo.status != 4
          AND rpor.repair_purchase_order != ?
          ORDER BY rpo.created_on DESC
          LIMIT 1
        `;
        smCheckParams = [vehicleId, setting.scsid, roId];
      } else {
        // CREATE MODE: Check for items in ANY active ROs
        smCheckQuery = `
          SELECT 
            rpo.id as ro_id,
            rpo.id as ro_number,
            rpor.rpor_status as rpor_status
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
        `;
        smCheckParams = [vehicleId, setting.scsid];
      }
      
      const [existingRO] = await db.query(smCheckQuery, smCheckParams);
      
      // ⭐ Store duplicate information if found
      const isDuplicate = existingRO.length > 0;
      const existingRONumber = isDuplicate ? existingRO[0].ro_number : null;
      const existingROId = isDuplicate ? existingRO[0].ro_id : null;
      const existingROStatus = isDuplicate ? existingRO[0].rpor_status : null;
      
      // Data is already available from the main query
      const lastMaintenanceDate = setting.last_maintenance_date;
      const lastReplacedKm = parseFloat(setting.last_replaced_km || 0);
      
      console.log(`   Calculating status...`);
      console.log(`   - Current KM: ${currentKm}, Last KM: ${lastReplacedKm}`);
      console.log(`   - Last date: ${lastMaintenanceDate}`);
      
      // Initialize variables
      let actualKmsSinceService = 0;
      let actualDaysSinceService = 0;
      let durationInDays = 0;
      let alertInDays = 0;
      const timeUnit = setting.time_unit || 'DAYS';
      
      // Calculate actual values based on interval_type
      if (setting.interval_type === 'KMS' || setting.interval_type === 'BOTH') {
        actualKmsSinceService = currentKm - lastReplacedKm;
        console.log(`   - KM since service: ${actualKmsSinceService}`);
      }
      
      if (setting.interval_type === 'DURATION' || setting.interval_type === 'BOTH') {
        if (lastMaintenanceDate) {
          const today = new Date();
          const lastDate = new Date(lastMaintenanceDate);
          actualDaysSinceService = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
          console.log(`   - Days since service: ${actualDaysSinceService}`);
        } else {
          console.log(`   ⚠️ No last_maintenance_date - defaulting to 0 days`);
          actualDaysSinceService = 0;
        }
        
        // Convert duration to days based on time_unit
        durationInDays = setting.days || 0;
        alertInDays = setting.days_to_alert || 0;
        
        switch (timeUnit.toUpperCase()) {
          case 'WEEKS':
            durationInDays = setting.days * 7;
            alertInDays = setting.days_to_alert * 7;
            break;
          case 'MONTHS':
            durationInDays = setting.days * 30;
            alertInDays = setting.days_to_alert * 30;
            break;
          case 'YEARS':
            durationInDays = setting.days * 365;
            alertInDays = setting.days_to_alert * 365;
            break;
          // Default: DAYS - no conversion needed
        }
        console.log(`   - Duration threshold: ${durationInDays} days (${setting.days} ${timeUnit})`);
      }
      
      // Determine status
      let status = 'GOOD';
      let statusColor = 'green';
      let primaryReason = null;
      
      // For BOTH interval type, we need to check both KMS and Duration and take the most critical status
      let kmsStatus = 'GOOD';
      let durationStatus = 'GOOD';
      
      // Check KMS status (if applicable)
      if (setting.interval_type === 'KMS' || setting.interval_type === 'BOTH') {
        // Only check if KMS threshold is set (> 0)
        if (setting.kms && setting.kms > 0) {
          if (actualKmsSinceService >= setting.kms) {
            kmsStatus = 'OVERDUE';
            if (setting.interval_type === 'KMS') {
              status = 'OVERDUE';
              statusColor = 'red';
              primaryReason = 'KMS';
            }
          } else if (setting.kms_to_alert && actualKmsSinceService >= setting.kms_to_alert) {
            kmsStatus = 'DUE_SOON';
            if (setting.interval_type === 'KMS') {
              status = 'DUE_SOON';
              statusColor = 'yellow';
              primaryReason = 'KMS';
            }
          }
        }
      }
      
      // Check DURATION status (if applicable)
      if (setting.interval_type === 'DURATION' || setting.interval_type === 'BOTH') {
        // Only check if duration threshold is set (> 0)
        if (durationInDays && durationInDays > 0) {
          if (actualDaysSinceService >= durationInDays) {
            durationStatus = 'OVERDUE';
            if (setting.interval_type === 'DURATION') {
              status = 'OVERDUE';
              statusColor = 'red';
              primaryReason = 'DURATION';
            }
          } else if (alertInDays && actualDaysSinceService >= alertInDays) {
            durationStatus = 'DUE_SOON';
            if (setting.interval_type === 'DURATION') {
              status = 'DUE_SOON';
              statusColor = 'yellow';
              primaryReason = 'DURATION';
            }
          }
        }
      }
      
      // For BOTH interval type, determine the most critical status
      if (setting.interval_type === 'BOTH') {
        // Priority: OVERDUE > DUE_SOON > GOOD
        if (kmsStatus === 'OVERDUE' || durationStatus === 'OVERDUE') {
          status = 'OVERDUE';
          statusColor = 'red';
          // Set primary reason based on which one is overdue (or both)
          if (kmsStatus === 'OVERDUE' && durationStatus === 'OVERDUE') {
            primaryReason = 'BOTH (KMS & Duration)';
          } else if (kmsStatus === 'OVERDUE') {
            primaryReason = 'KMS';
          } else {
            primaryReason = 'DURATION';
          }
        } else if (kmsStatus === 'DUE_SOON' || durationStatus === 'DUE_SOON') {
          status = 'DUE_SOON';
          statusColor = 'yellow';
          // Set primary reason based on which one is due soon (or both)
          if (kmsStatus === 'DUE_SOON' && durationStatus === 'DUE_SOON') {
            primaryReason = 'BOTH (KMS & Duration)';
          } else if (kmsStatus === 'DUE_SOON') {
            primaryReason = 'KMS';
          } else {
            primaryReason = 'DURATION';
          }
        } else {
          status = 'GOOD';
          statusColor = 'green';
          primaryReason = null;
        }
      }
      
      // Format display values - ONLY show data for the applicable interval_type
      let tripActualRunKmsHtm = 'N/A';
      let daysFromEffectiveDateHtm = 'N/A';
      
      if (setting.interval_type === 'KMS' || setting.interval_type === 'BOTH') {
        // Only show if KMS threshold is set
        if (setting.kms && setting.kms > 0) {
          tripActualRunKmsHtm = `${actualKmsSinceService.toLocaleString()} / ${setting.kms.toLocaleString()} km`;
        }
      }
      
      if (setting.interval_type === 'DURATION' || setting.interval_type === 'BOTH') {
        // Only show if duration threshold is set
        if (durationInDays && durationInDays > 0) {
          daysFromEffectiveDateHtm = `${actualDaysSinceService} / ${durationInDays} days`;
        }
      }
      
      // Calculate next service date for DURATION-based intervals
      let nextServiceDate = null;
      if ((setting.interval_type === 'DURATION' || setting.interval_type === 'BOTH') && durationInDays > 0 && lastMaintenanceDate) {
        const lastDate = new Date(lastMaintenanceDate);
        const nextDate = new Date(lastDate);
        nextDate.setDate(nextDate.getDate() + durationInDays);
        // Format as YYYY-MM-DD
        nextServiceDate = nextDate.toISOString().split('T')[0];
      }
      
      console.log(`   🔍 DEBUG Status Check:`);
      console.log(`      - interval_type: ${setting.interval_type}`);
      console.log(`      - kms threshold: ${setting.kms}, kms_to_alert: ${setting.kms_to_alert}`);
      console.log(`      - days threshold: ${setting.days}, days_to_alert: ${setting.days_to_alert}`);
      console.log(`      - actualKmsSinceService: ${actualKmsSinceService}`);
      console.log(`      - actualDaysSinceService: ${actualDaysSinceService}`);
      console.log(`      - durationInDays: ${durationInDays}`);
      console.log(`      - Final Status: ${status}`);
      console.log(`  ${status === 'OVERDUE' ? '🔴' : status === 'DUE_SOON' ? '🟡' : '🟢'} ${setting.setting_name} [${setting.interval_type}] - Status: ${status}, KMs: ${tripActualRunKmsHtm}, Days: ${daysFromEffectiveDateHtm}${isDuplicate ? ` [⚠️ IN RO ${existingRONumber}]` : ''}`);
      
      // ⭐ ALWAYS add items (including duplicates) so frontend can show warnings
      // Note: Only add DUE_SOON and OVERDUE items (skip GOOD status)
      if (status === 'DUE_SOON' || status === 'OVERDUE') {
        console.log(`   ✅ Adding item to eligibleItems (Status: ${status})`);
        
        eligibleItems.push({
          scsid: setting.scsid,
          setting_name: setting.setting_name,
          setting_type: setting.interval_type,
          interval_type: setting.interval_type, // ✅ Add this for frontend compatibility
          kms: setting.kms,
          kms_to_alert: setting.kms_to_alert,
          days: setting.days,
          days_to_alert: setting.days_to_alert,
          time_unit: timeUnit,
          kms_html: setting.kms ? setting.kms.toLocaleString() : '',
          duration_html: setting.days ? `${setting.days} ${timeUnit}` : '',
          trip_actual_run_kms_htm: tripActualRunKmsHtm,
          days_from_effective_date_htm: daysFromEffectiveDateHtm,
          next_service_date: nextServiceDate,
          status: status,
          status_color: statusColor,
          primary_reason: primaryReason,
          last_maintenance_date: lastMaintenanceDate,
          last_replaced_km: lastReplacedKm,
          current_km: currentKm,
          actual_kms_since_service: actualKmsSinceService,
          actual_days_since_service: actualDaysSinceService,
          // ⭐ NEW: Duplicate detection fields
          existing_ro_number: existingRONumber,
          existing_ro_id: existingROId,
          existing_ro_status: existingROStatus,
          repair_purchase_order: existingROId // ✅ ADD THIS: Alias for frontend consistency
        });
        console.log(`   ✅ Added to eligibleItems: ${setting.setting_name} (Status: ${status}${isDuplicate ? `, IN RO ${existingRONumber}, repair_purchase_order=${existingROId}` : ''})`);
      } else {
        console.log(`   ⏭️  Skipping ${setting.setting_name} - Status: ${status} (not DUE_SOON or OVERDUE)`);
      }
      } catch (error) {
        console.error(`❌ ERROR processing setting ${setting.setting_name} (ID: ${setting.scsid}):`, error);
        console.error(`   Setting data:`, JSON.stringify(setting, null, 2));
        // Continue processing other settings instead of crashing
      }
    }
    
    console.log(`✅ Found ${eligibleItems.length} scheduled maintenance items for this configuration`);
    
    // In EDIT mode, also fetch items already in this RO
    if (roId) {
      console.log(`🔧 EDIT MODE: Fetching scheduled items already in RO ${roId}`);
      
      const roItemsQuery = `
        SELECT 
          scs.id as scsid, 
          scs.setting_name, 
          scs.setting_type,
          cs.kms, 
          cs.kms_to_alert, 
          cs.days, 
          cs.days_to_alert,
          cs.time_unit,
          cs.interval_type,
          rpor.rpor_status,
          rpor.repair_purchase_order
        FROM repair_purchase_order_repairs rpor
        LEFT JOIN scheduled_configuration_settings scs ON scs.id = rpor.scheduled_maintenance_setting_id
        LEFT JOIN configuration_settings cs ON cs.setting = scs.id AND cs.configuration = ?
        WHERE rpor.repair_purchase_order = ?
        AND rpor.item_type = 'SCHEDULED_MAINTENANCE'
      `;
      
      const [roItems] = await db.query(roItemsQuery, [vehicleConfig, roId]);
      
      // Process RO items to add calculated fields and status
      for (const item of roItems) {
        // Get maintenance data
        const [maintenanceData] = await db.query(
          'SELECT last_maintenance_date, last_replaced_km FROM vehicle_scheduled_maintenance WHERE vehicle = ? AND scheduled_maintenance = ? LIMIT 1',
          [vehicleId, item.scsid]
        );
        
        if (maintenanceData.length) {
          const lastMaintenanceDate = maintenanceData[0].last_maintenance_date;
          const lastReplacedKm = parseFloat(maintenanceData[0].last_replaced_km || 0);
          
          // Initialize variables
          let actualKmsSinceService = 0;
          let actualDaysSinceService = 0;
          let durationInDays = 0;
          let alertInDays = 0;
          const timeUnit = item.time_unit || 'DAYS';
          
          // Calculate actual values based on interval_type
          if (item.interval_type === 'KMS' || item.interval_type === 'BOTH') {
            actualKmsSinceService = currentKm - lastReplacedKm;
          }
          
          if (item.interval_type === 'DURATION' || item.interval_type === 'BOTH') {
            const today = new Date();
            const lastDate = new Date(lastMaintenanceDate);
            actualDaysSinceService = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
            
            // Convert duration to days
            durationInDays = item.days || 0;
            alertInDays = item.days_to_alert || 0;
            
            switch (timeUnit.toUpperCase()) {
              case 'WEEKS':
                durationInDays = item.days * 7;
                alertInDays = item.days_to_alert * 7;
                break;
              case 'MONTHS':
                durationInDays = item.days * 30;
                alertInDays = item.days_to_alert * 30;
                break;
              case 'YEARS':
                durationInDays = item.days * 365;
                alertInDays = item.days_to_alert * 365;
                break;
            }
          }
          
          // Determine status
          let status = 'GOOD';
          let statusColor = 'green';
          
          if (item.interval_type === 'KMS' || item.interval_type === 'BOTH') {
            // Only check if KMS threshold is set (> 0)
            if (item.kms && item.kms > 0) {
              if (actualKmsSinceService >= item.kms) {
                status = 'OVERDUE';
                statusColor = 'red';
              } else if (item.kms_to_alert && actualKmsSinceService >= item.kms_to_alert) {
                if (status !== 'OVERDUE') {
                  status = 'DUE_SOON';
                  statusColor = 'yellow';
                }
              }
            }
          }
          
          if (item.interval_type === 'DURATION' || item.interval_type === 'BOTH') {
            // Only check if duration threshold is set (> 0)
            if (durationInDays && durationInDays > 0) {
              if (actualDaysSinceService >= durationInDays) {
                status = 'OVERDUE';
                statusColor = 'red';
              } else if (alertInDays && actualDaysSinceService >= alertInDays) {
                if (status !== 'OVERDUE') {
                  status = 'DUE_SOON';
                  statusColor = 'yellow';
                }
              }
            }
          }
          
          // Format display values - ONLY show data for the applicable interval_type
          let tripActualRunKmsHtm = 'N/A';
          let daysFromEffectiveDateHtm = 'N/A';
          
          if (item.interval_type === 'KMS' || item.interval_type === 'BOTH') {
            // Only show if KMS threshold is set
            if (item.kms && item.kms > 0) {
              tripActualRunKmsHtm = `${actualKmsSinceService.toLocaleString()} / ${item.kms.toLocaleString()} km`;
            }
          }
          
          if (item.interval_type === 'DURATION' || item.interval_type === 'BOTH') {
            // Only show if duration threshold is set
            if (durationInDays && durationInDays > 0) {
              daysFromEffectiveDateHtm = `${actualDaysSinceService} / ${durationInDays} days`;
            }
          }
          
          // Calculate next service date for DURATION-based intervals
          let nextServiceDate = null;
          if ((item.interval_type === 'DURATION' || item.interval_type === 'BOTH') && durationInDays > 0 && lastMaintenanceDate) {
            const lastDate = new Date(lastMaintenanceDate);
            const nextDate = new Date(lastDate);
            nextDate.setDate(nextDate.getDate() + durationInDays);
            // Format as YYYY-MM-DD
            nextServiceDate = nextDate.toISOString().split('T')[0];
          }
          
          item.trip_actual_run_kms_htm = tripActualRunKmsHtm;
          item.days_from_effective_date_htm = daysFromEffectiveDateHtm;
          item.next_service_date = nextServiceDate;
          item.kms_html = item.kms ? item.kms.toLocaleString() : '';
          item.duration_html = item.days ? `${item.days} ${timeUnit}` : '';
          item.status = status;
          item.status_color = statusColor;
          item.last_maintenance_date = lastMaintenanceDate;
          item.last_replaced_km = lastReplacedKm;
        }
      }
      
      console.log(`✅ Found ${roItems.length} scheduled items already in RO ${roId}`);
      
      // Merge: RO items first, then available items (avoiding duplicates)
      const roItemIds = new Set(roItems.map(item => item.scsid));
      const availableItems = eligibleItems.filter(item => !roItemIds.has(item.scsid));
      
      return {
        configurationName: configurationName,
        items: [...roItems, ...availableItems]
      };
    }
    
    return {
      configurationName: configurationName,
      items: eligibleItems
    };
  } catch (error) {
    console.error('Service error in getVehicleScheduledMaintenance:', error);
    throw error;
  }
}

/**
 * Create Repair Order with defects and scheduled maintenance
 * Matches PHP: doSavePurchaseOrder
 */
async function createRepairOrderWithItems(roData, metadata) {
  const connection = await db.getConnection();
  
  try {
    // Start transaction
    await connection.beginTransaction();
    
    const {
      txtVehicle,
      txtRequestedBy,
      txtBusKms,
      txtVendor,
      txtEstimatedAmount,
      txtNotes,
      vrls = [],
      scheduled_maintenance_items = []
    } = roData;
    
    // Validate required fields
    if (!txtVehicle || !txtRequestedBy || !txtBusKms || !txtVendor || !txtEstimatedAmount) {
      throw new Error('Missing required fields');
    }
    
    const loggedUser = metadata?.userId || 1;
    
    // Create main repair order
    const insertROQuery = `
      INSERT INTO repair_purchase_orders (
        vehicle, 
        requested_by, 
        vendor, 
        kms_before_service, 
        kms_after_service, 
        estimated_repair_amount, 
        created_by, 
        created_on, 
        work_order_number, 
        invoice_number, 
        invoice_amount, 
        payment_method, 
        payment_notes, 
        attached_invoice_url, 
        repair_notes, 
        verification_handled_by, 
        status
      ) VALUES (?, ?, ?, ?, 0, ?, ?, NOW(), '', '', 0, '', '', '', ?, 0, 1)
    `;
    
    const [roResult] = await connection.query(insertROQuery, [
      txtVehicle,
      txtRequestedBy,
      txtVendor,
      txtBusKms,
      txtEstimatedAmount,
      loggedUser,
      txtNotes
    ]);
    
    const poNumber = roResult.insertId;
    
    if (!poNumber) {
      throw new Error('Failed to create repair order');
    }
    
    const defectsIdAssignedToRo = [];
    const smAssignedToRo = [];
    
    // Attach defects to RO
    if (vrls && vrls.length > 0) {
      for (const repair of vrls) {
        // Get defect details
        const [defectDetails] = await connection.query(
          'SELECT * FROM vehicle_repair_logs WHERE id = ? LIMIT 1',
          [repair]
        );
        
        if (!defectDetails.length) continue;
        
        const defect = defectDetails[0];
        
        // ⭐ Determine item_type and scheduled_maintenance_setting_id based on defect_source
        const isMaintenanceDefect = defect.defect_source === 'maintenance';
        const itemType = isMaintenanceDefect ? 'SCHEDULED_MAINTENANCE' : 'REPAIR';
        const scheduledMaintenanceSettingId = defect.schedule_maintenance_id || null;
        
        // Insert into repair_purchase_order_repairs
        // Set rpor_status to 'Open' when creating RO
        const insertDefectQuery = `
          INSERT INTO repair_purchase_order_repairs (
            item_type, 
            repair_purchase_order, 
            repair_log_id, 
            repair_notes, 
            rpor_status,
            scheduled_maintenance_setting_id
          ) VALUES (?, ?, ?, ?, 'Open', ?)
        `;
        
        const [rporResult] = await connection.query(insertDefectQuery, [
          itemType,
          poNumber,
          repair,
          defect.notes || '',
          scheduledMaintenanceSettingId
        ]);
        
        const rporId = rporResult.insertId;
        
        // Update defect status to 'Open' and link to RO (including merged group)
        // SYNC: Both rpor_status and defect_status are set to 'Open'
        const defectIdsToUpdate = [repair];
        
        // Check if defect is part of a merged group
        if (defect.merged_records_id) {
          const [mergedGroup] = await connection.query(
            'SELECT id FROM vehicle_repair_logs WHERE merged_records_id = ?',
            [defect.merged_records_id]
          );
          
          mergedGroup.forEach(item => defectIdsToUpdate.push(item.id));
        }
        
        // Update all defects in the group: Set status to 'Open' and link to RO
        for (const defectId of defectIdsToUpdate) {
          await connection.query(`
            UPDATE vehicle_repair_logs 
            SET defect_status = 'Open',
                related_repair_purchase_order = ?,
                linked_to_roid = ?,
                linked_to_ro_items = ?
            WHERE id = ?
            LIMIT 1
          `, [poNumber, poNumber, rporId, defectId]);
        }
        
        defectsIdAssignedToRo.push(repair);
      }
    }
    
    // Attach scheduled maintenance items
    // Set rpor_status to 'Open' when creating RO
    if (scheduled_maintenance_items && scheduled_maintenance_items.length > 0) {
      for (const maintenance of scheduled_maintenance_items) {
        const insertSMQuery = `
          INSERT INTO repair_purchase_order_repairs (
            item_type, 
            repair_purchase_order, 
            scheduled_maintenance_setting_id, 
            rpor_status
          ) VALUES ('SCHEDULED_MAINTENANCE', ?, ?, 'Open')
        `;
        
        const [smResult] = await connection.query(insertSMQuery, [poNumber, maintenance]);
        smAssignedToRo.push(maintenance);
      }
    }
    
    // Create activity log
    const logMessage = `RO ${poNumber} Created with defects id ${defectsIdAssignedToRo.join(',')} and scheduled maintenance id ${smAssignedToRo.join(',')}`;
    
    await connection.query(
      'INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())',
      [poNumber, loggedUser, logMessage]
    );
    
    // Commit transaction
    await connection.commit();
    connection.release();
    
    console.log(`✅ Created RO ${poNumber} with ${defectsIdAssignedToRo.length} defects and ${smAssignedToRo.length} SM items`);
    
    return {
      ro_id: poNumber,
      defects_assigned: defectsIdAssignedToRo.length,
      sm_assigned: smAssignedToRo.length,
      defects_ids: defectsIdAssignedToRo,
      sm_ids: smAssignedToRo
    };
    
  } catch (error) {
    // Rollback on error
    await connection.rollback();
    connection.release();
    console.error('❌ Error creating RO with items:', error);
    throw error;
  }
}

/**
 * Update Repair Order Status (Mark as Complete)
 * Changes status from Active (1) to Finished (2)
 * Validates all items are completed before allowing status change
 * Updates effective_date for scheduled maintenance items
 */
async function updateRepairOrderStatus(id, statusData, metadata) {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const roId = id;
    const { status, service_completed_date } = statusData;
    
    // Step 1: Get RO details with item counts and required fields
    const [roDetails] = await connection.query(
      `SELECT 
        rpo.id,
        rpo.status as current_status,
        rpo.vehicle,
        rpo.work_order_number,
        rpo.invoice_number,
        COUNT(rpor.id) as item_count,
        SUM(CASE WHEN rpor.rpor_status = 'Completed' THEN 1 ELSE 0 END) as status_completed_count,
        SUM(CASE WHEN rpor.rpor_status = 'Repair_Not_Required' THEN 1 ELSE 0 END) as status_repair_not_required_count,
        SUM(CASE WHEN rpor.rpor_status = 'Open' THEN 1 ELSE 0 END) as status_open_count,
        SUM(CASE WHEN rpor.rpor_status = 'In_Progress' THEN 1 ELSE 0 END) as status_in_progress_count
      FROM repair_purchase_orders rpo
      LEFT JOIN repair_purchase_order_repairs rpor ON rpo.id = rpor.repair_purchase_order
      WHERE rpo.id = ?
      GROUP BY rpo.id`,
      [roId]
    );
    
    if (roDetails.length === 0) {
      await connection.rollback();
      connection.release();
      throw new Error('Repair Order not found');
    }
    
    const ro = roDetails[0];
    
    // DEBUG: Log the validation data
    console.log('🔍 Backend RO Validation Debug:', {
      roId,
      current_status: ro.current_status,
      work_order_number: ro.work_order_number,
      invoice_number: ro.invoice_number,
      item_count: ro.item_count,
      status_completed_count: ro.status_completed_count,
      status_repair_not_required_count: ro.status_repair_not_required_count,
      status_open_count: ro.status_open_count,
      status_in_progress_count: ro.status_in_progress_count,
      totalCompleted: (ro.status_completed_count || 0) + (ro.status_repair_not_required_count || 0),
      totalItems: ro.item_count || 0
    });
    
    // Step 2: Validate status transition
    if (status === 2) {
      // Marking as complete - validate current status is Active
      if (ro.current_status !== 1) {
        await connection.rollback();
        connection.release();
        throw new Error('Only Active repair orders can be marked as complete');
      }
      
      // Validate all items are completed or not required
      const totalCompleted = Number(ro.status_completed_count || 0) + Number(ro.status_repair_not_required_count || 0);
      const totalItems = Number(ro.item_count || 0);
      
      console.log('🔍 Validation comparison:', { totalCompleted, totalItems, match: totalCompleted === totalItems });
      
      if (totalItems === 0) {
        await connection.rollback();
        connection.release();
        throw new Error('Cannot complete an empty repair order');
      }
      
// ✅ Check vendor garage_url before enforcing item completion
const [vendorRow] = await connection.query(
  'SELECT garage_url FROM vendors WHERE id = (SELECT vendor FROM repair_purchase_orders WHERE id = ?) LIMIT 1',
  [roId]
);
const hasGarageUrl = vendorRow[0]?.garage_url && vendorRow[0].garage_url.trim() !== '';

if (hasGarageUrl && totalCompleted !== totalItems) {
  await connection.rollback();
  connection.release();
  const openCount = Number(ro.status_open_count || 0);
  const inProgressCount = Number(ro.status_in_progress_count || 0);
  throw new Error(
    `Cannot complete RO. ${openCount} items are still Open and ${inProgressCount} items are In Progress. ` +
    `All items must be marked as Completed or Repair_Not_Required.`
  );
} else if (!hasGarageUrl) {
  console.log(`ℹ️ RO ${roId}: Vendor has no garage_url — skipping item completion validation`);
}
      
      // Validate Work Order Number is filled
      if (!ro.work_order_number || ro.work_order_number.trim() === '') {
        await connection.rollback();
        connection.release();
        throw new Error('Work Order Number is required to complete the repair order');
      }
      
      // Validate Invoice Number is filled
      if (!ro.invoice_number || ro.invoice_number.trim() === '') {
        await connection.rollback();
        connection.release();
        throw new Error('Invoice Number is required to complete the repair order');
      }
    }
    
    // Step 3: Update RO status
    const updateFields = ['status = ?'];
    const updateParams = [status];
    
    if (service_completed_date) {
      updateFields.push('service_completed_date = ?');
      updateParams.push(service_completed_date);
    }
    
    updateParams.push(roId);
    
    await connection.query(
      `UPDATE repair_purchase_orders 
       SET ${updateFields.join(', ')}
       WHERE id = ?`,
      updateParams
    );
    
    // Step 4: Update effective_date for completed scheduled maintenance items
    if (status === 2 && service_completed_date) {
      // Get all completed scheduled maintenance items in this RO
      const [smItems] = await connection.query(
        `SELECT DISTINCT rpor.scheduled_maintenance_setting_id
         FROM repair_purchase_order_repairs rpor
         WHERE rpor.repair_purchase_order = ?
           AND rpor.item_type = 'SCHEDULED_MAINTENANCE'
           AND rpor.rpor_status IN ('Completed', 'Repair_Not_Required')
           AND rpor.scheduled_maintenance_setting_id IS NOT NULL`,
        [roId]
      );
      
      // Update effective_date for each completed SM item
      for (const item of smItems) {
        await connection.query(
          `UPDATE vehicle_scheduled_maintenance
           SET effective_date = ?
           WHERE id = ?`,
          [service_completed_date, item.scheduled_maintenance_setting_id]
        );
        
        console.log(`✅ Updated effective_date for SM item ${item.scheduled_maintenance_setting_id} to ${service_completed_date}`);
      }
      
      console.log(`✅ Updated ${smItems.length} scheduled maintenance effective_date records`);
    }
    
    // Step 5: Log the action
    const actionText = status === 2 ? 'RO Marked as Complete' : 'RO Status Updated';
    await connection.query(
      `INSERT INTO vm_logs (ro_id, user_id, log_time, log_data) VALUES (?, ?, NOW(), ?)`,
      [
        roId,
        metadata?.userId || 1,
        actionText
      ]
    );
    
    await connection.commit();
    connection.release();
    
    console.log(`✅ RO ${roId} status updated to ${status}`);
    
    return {
      success: true,
      ro_id: roId,
      status: status,
      service_completed_date: service_completed_date || null
    };
    
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('Service error in updateRepairOrderStatus:', error);
    throw error;
  }
}

/**
 * Helper function to get defect statuses based on decision
 * Matches PHP getDefectStatuses() logic
 */
function getDefectStatuses(decision) {
  const statusMap = {
    'Completed': { skysoft: 'Completed', motive: 'resolved' },
    'Repair_Not_Required': { skysoft: 'Repair_Not_Required', motive: 'resolved' },
    'In_Progress': { skysoft: 'In_Progress', motive: 'in_progress' },
    'Pending': { skysoft: 'Pending', motive: 'pending' },
    'Open': { skysoft: 'Open', motive: 'pending' },
    'Rejected': { skysoft: 'Rejected', motive: 'resolved' },
    'Paused': { skysoft: 'Paused', motive: 'in_progress' },
    'Reopened': { skysoft: 'Reopened', motive: 'pending' }
  };
  
  return statusMap[decision] || { skysoft: decision, motive: 'pending' };
}

/**
 * Complete Repair Order - Full PHP Logic
 * Matches completerepairpurchaseorder.php exactly
 * Changes status from Active (1) to Finished (2)
 * Updates all completion fields, processes defects and scheduled maintenance
 */
async function completeRepairOrderFull(id, completionData, metadata) {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const roId = id;
    const {
      txtKms,
      txtInvoiceAmount,
      txtWorkOrderNumber,
      txtInvoiceNumber,
      txtServiceCompletedDate,
      txtPaymentMethod,
      txtPaymentNotes,
      txtRepairNotes,
      repairs = {},  // { rporid: 'status', ... }
      scs = {}       // { rporid: 'status', ... }
    } = completionData;
    
    const loggedUser = metadata?.userId || 1;
    const changeLog = [];
    
    // === 1. Get current RO details for validation ===
    const [ro_data] = await connection.query(
      'SELECT * FROM repair_purchase_orders WHERE id = ? AND status = 1 LIMIT 1',
      [roId]
    );
    
    if (!ro_data || ro_data.length === 0) {
      await connection.rollback();
      connection.release();
      throw new Error('RO not found or already completed/canceled');
    }
    
    const ro = ro_data[0];
    const current_vehicle = ro.vehicle;
    
    // === 1.5. Validate all defects are Completed or Repair_Not_Required ===
    const [defects] = await connection.query(
      `SELECT rpor.id, rpor.rpor_status, vrl.repair_desc 
       FROM repair_purchase_order_repairs AS rpor
       LEFT JOIN vehicle_repair_logs AS vrl ON rpor.repair_log_id = vrl.id
       WHERE rpor.repair_purchase_order = ?`,
      [roId]
    );
    
// === 1.5. Validate all defects are Completed or Repair_Not_Required ===
// ✅ SKIP validation if vendor has no garage_url (non-garage vendor)
const [vendorCheck] = await connection.query(
  'SELECT garage_url FROM vendors WHERE id = ? LIMIT 1',
  [ro.vendor]
);
const vendorGarageUrl = vendorCheck[0]?.garage_url;
const isGarageVendor = vendorGarageUrl && vendorGarageUrl.trim() !== '';

if (isGarageVendor) {
  const [defects] = await connection.query(
    `SELECT rpor.id, rpor.rpor_status, vrl.repair_desc 
     FROM repair_purchase_order_repairs AS rpor
     LEFT JOIN vehicle_repair_logs AS vrl ON rpor.repair_log_id = vrl.id
     WHERE rpor.repair_purchase_order = ?`,
    [roId]
  );

  if (defects && defects.length > 0) {
    const incompleteDefects = defects.filter(defect => {
      const status = defect.rpor_status;
      const newStatus = repairs[defect.id];
      const finalStatus = newStatus || status;
      return finalStatus !== 'Completed' && finalStatus !== 'Repair_Not_Required';
    });

    if (incompleteDefects.length > 0) {
      await connection.rollback();
      connection.release();
      const defectList = incompleteDefects.map(d => `#${d.id} (${d.rpor_status})`).join(', ');
      throw new Error(`Cannot complete RO: All defects must be marked as "Completed" or "Repair Not Required". Incomplete defects: ${defectList}`);
    }
  }
} else {
  console.log(`ℹ️ RO ${roId}: Vendor has no garage_url — skipping defect status validation`);
}
    
    // === 2. Update RO status to Completed (status = 2) ===
    const updateRO = `
      UPDATE repair_purchase_orders 
      SET status = 2, 
          kms_after_service = ?, 
          invoice_amount = ?, 
          work_order_number = ?, 
          invoice_number = ?, 
          service_completed_date = ?, 
          payment_method = ?, 
          payment_notes = ?, 
          repair_notes = ? 
      WHERE id = ? AND status = 1
    `;
    
    await connection.query(updateRO, [
      txtKms ? parseFloat(txtKms) : 0,  
      txtInvoiceAmount ? parseFloat(txtInvoiceAmount) : 0,
      txtWorkOrderNumber,
      txtInvoiceNumber,
      txtServiceCompletedDate,
      txtPaymentMethod,
      txtPaymentNotes || '',
      txtRepairNotes || '',
      roId
    ]);
    
    // === 2b. Update Vehicle's Current KM ===
    // CRITICAL: Update the vehicle's current_km with the latest odometer reading
    // This ensures the Maintenance Schedule calculations use real-time current KM values
    console.log(`🔧 Updating vehicle ${current_vehicle} current_km to ${txtKms}`);
if (txtKms && parseFloat(txtKms) > 0) {
  await connection.query(
    'UPDATE vehicles SET current_km = ? WHERE id = ? LIMIT 1',
    [parseFloat(txtKms), current_vehicle]
  );
}
    // === 3. Process Vehicle Repairs (with merged group logic) ===
    const completedDefectsByMotiveRecord = {};
    const allDefectUpdates = {};
    const processedGroups = {};
    
    for (const [rporid, decision] of Object.entries(repairs)) {
      // 1. Get the repair item
      const [rpor] = await connection.query(
        'SELECT repair_log_id FROM repair_purchase_order_repairs WHERE id = ? AND repair_purchase_order = ? LIMIT 1',
        [rporid, roId]
      );
      
      if (!rpor || rpor.length === 0) continue;
      
      const log_id = rpor[0].repair_log_id;
      if (!log_id) continue;
      
      // 2. Get the defect and its merged_records_id
      const [defect] = await connection.query(
        'SELECT id, merged_records_id, motive_record_id FROM vehicle_repair_logs WHERE id = ? LIMIT 1',
        [log_id]
      );
      
      if (!defect || defect.length === 0) continue;
      
      const defectData = defect[0];
      const mergedGroupId = defectData.merged_records_id;
      
      // Create a group key
      const groupKey = mergedGroupId || `single_${log_id}`;
      
      // Avoid reprocessing the same group
      if (processedGroups[groupKey]) continue;
      processedGroups[groupKey] = true;
      
      // 3. Get ALL defect IDs in this group
      let defectIds = [];
      let motiveRecordId = null;
      
      if (mergedGroupId) {
        // Grouped defect
        const [groupDefects] = await connection.query(
          'SELECT id, motive_record_id FROM vehicle_repair_logs WHERE merged_records_id = ?',
          [mergedGroupId]
        );
        defectIds = groupDefects.map(d => d.id);
        motiveRecordId = groupDefects[0]?.motive_record_id || null;
      } else {
        // Single defect
        defectIds = [log_id];
        motiveRecordId = defectData.motive_record_id || null;
      }
      
      // 4. Get ALL repair_purchase_order_repairs in THIS RO linked to these defects
      const placeholders = defectIds.map(() => '?').join(',');
      const [linkedRporRecords] = await connection.query(
        `SELECT id, repair_log_id FROM repair_purchase_order_repairs 
         WHERE repair_purchase_order = ? AND repair_log_id IN (${placeholders})`,
        [roId, ...defectIds]
      );
      
      if (!linkedRporRecords || linkedRporRecords.length === 0) continue;
      
      const rporIdsToUpdate = linkedRporRecords.map(r => r.id);
      
      // 5. Update ALL linked repair items to the new decision
      // ⚠️ DISABLED: Per-item completion details (rpor_status, service_completion_date, current_kms)
      // These fields are no longer updated in repair_purchase_order_repairs table
      // To re-enable: Uncomment the block below
      
      /* 🔒 DISABLED FEATURE - Uncomment to re-enable
      const rporPlaceholders = rporIdsToUpdate.map(() => '?').join(',');
      await connection.query(
        `UPDATE repair_purchase_order_repairs 
         SET rpor_status = ?, 
             work_order_number = ?,
             invoice_number = ?,
             invoice_amount = ?,
             service_completion_date = ?,
             current_kms = ?
         WHERE id IN (${rporPlaceholders})`,
        [decision, txtWorkOrderNumber, txtInvoiceNumber, txtInvoiceAmount, txtServiceCompletedDate, txtKms, ...rporIdsToUpdate]
      );
      */ // END DISABLED FEATURE
      
      // 6. Prepare defect status updates
      const statuses = getDefectStatuses(decision);
      const finishedDate = (decision === 'Completed') ? new Date(txtServiceCompletedDate).toISOString().slice(0, 19).replace('T', ' ') : null;
      
      for (const did of defectIds) {
        allDefectUpdates[did] = {
          skysoft: statuses.skysoft,
          motive: statuses.motive,
          finished_date: finishedDate
        };
      }
      
      // 7. For Completed: group defect IDs by motive_record_id
      if ((decision === 'Completed' || decision === 'Repair_Not_Required') && motiveRecordId) {
        if (!completedDefectsByMotiveRecord[motiveRecordId]) {
          completedDefectsByMotiveRecord[motiveRecordId] = [];
        }
        completedDefectsByMotiveRecord[motiveRecordId].push(...defectIds);
        // Deduplicate
        completedDefectsByMotiveRecord[motiveRecordId] = [...new Set(completedDefectsByMotiveRecord[motiveRecordId])];
      }
      
      // 8. Log changes
      for (const did of defectIds) {
        const [cur] = await connection.query(
          'SELECT defect_status, motive_defect_status FROM vehicle_repair_logs WHERE id = ?',
          [did]
        );
        const curSky = cur[0]?.defect_status || 'unknown';
        const curMot = cur[0]?.motive_defect_status || 'unknown';
        changeLog.push(`Defect ID ${did}: Skysoft ${curSky} → ${statuses.skysoft}, Motive ${curMot} → ${statuses.motive}`);
      }
    }
    
    // Bulk update defects
    for (const [defectId, data] of Object.entries(allDefectUpdates)) {
      await connection.query(`
        UPDATE vehicle_repair_logs SET
          defect_status = ?,
          motive_defect_status = ?,
          repair_fixed_on = ?,
          last_action_on = CURRENT_TIMESTAMP(),
          related_repair_purchase_order = ?,
          last_action_by = ?
        WHERE id = ?
      `, [
        data.skysoft,
        data.motive,
        data.finished_date,
        roId,
        loggedUser,
        defectId
      ]);
    }
    
    // === 4. Process Scheduled Maintenance ===
    // Auto-complete ALL scheduled maintenance items in the RO
    // Query all scheduled maintenance items from this RO
    const [allSMItems] = await connection.query(
      `SELECT id, scheduled_maintenance_setting_id, rpor_status, 
              service_completion_date, current_kms, item_type
       FROM repair_purchase_order_repairs 
       WHERE repair_purchase_order = ? 
       AND item_type = 'SCHEDULED_MAINTENANCE'`,
      [roId]
    );
    
    console.log(`🔍 Found ${allSMItems.length} scheduled maintenance items in RO ${roId}`);
    console.log(`🔍 RO Completion Values: txtServiceCompletedDate=${txtServiceCompletedDate}, txtKms=${txtKms}`);
    
    // Process each scheduled maintenance item
    for (const rpor_rec of allSMItems) {
      const rporid = rpor_rec.id;
      const scheduled_maintenance_setting_id = rpor_rec.scheduled_maintenance_setting_id;
      
      // Check if user provided explicit status override in scs
      const decision = scs[rporid] || 'Completed'; // Default to Completed if not specified
      
      // Extract per-item completion data
      // IMPORTANT: Always use RO-level values (txtServiceCompletedDate and txtKms) from the Complete RO form
      // These are the actual values when the RO was completed, NOT the old per-item values
      const itemServiceDate = txtServiceCompletedDate;
      const itemCurrentKms = txtKms;
      
      console.log(`🔍 Processing SM ${scheduled_maintenance_setting_id}: Using itemServiceDate=${itemServiceDate}, itemCurrentKms=${itemCurrentKms}`);
      
      // Get current status
      const [currentSM] = await connection.query(
        'SELECT status FROM vehicle_scheduled_maintenance WHERE id = ?',
        [scheduled_maintenance_setting_id]
      );
      const currentStatus = currentSM[0]?.status || 'unknown';
      
      if (decision === 'Completed') {
        // ⚠️ DISABLED: Update RO schedule maintenance item status
        // rpor_status, service_completion_date, current_kms are no longer updated
        // To re-enable: Uncomment the block below
        
        /* 🔒 DISABLED FEATURE - Uncomment to re-enable
        await connection.query(
          `UPDATE repair_purchase_order_repairs 
           SET rpor_status = ?,
               work_order_number = ?,
               invoice_number = ?,
               invoice_amount = ?,
               service_completion_date = ?,
               current_kms = ?
           WHERE id = ? LIMIT 1`,
          [decision, txtWorkOrderNumber, txtInvoiceNumber, txtInvoiceAmount, itemServiceDate, itemCurrentKms, rporid]
        );
        */ // END DISABLED FEATURE
        
        // ⚠️ TEMPORARILY DISABLED: Auto-update of vehicle_scheduled_maintenance KM and Date
        // This feature is turned off per user request and can be re-enabled later
        // To re-enable: Uncomment the block below
        
        /* 🔒 DISABLED FEATURE - Uncomment to re-enable
        // Update vehicle_scheduled_maintenance with per-item actual service date and odometer reading
        if (scheduled_maintenance_setting_id) {
          console.log(`🔧 UPDATING vehicle_scheduled_maintenance for SM ID ${scheduled_maintenance_setting_id}:`, {
            vehicle: current_vehicle,
            scheduled_maintenance: scheduled_maintenance_setting_id,
            last_maintenance_date: itemServiceDate,
            last_replaced_km: itemCurrentKms
          });
          
          const [updateResult] = await connection.query(`
            UPDATE vehicle_scheduled_maintenance 
            SET last_maintenance_date = ?, 
                effective_date = ?,
                last_replaced_km = ?
            WHERE vehicle = ? 
            AND scheduled_maintenance = ?
          `, [
            itemServiceDate,      // Use per-item service completion date
            itemServiceDate,      // Use same date for effective_date
            itemCurrentKms,       // Use per-item odometer reading
            current_vehicle, 
            scheduled_maintenance_setting_id
          ]);
          
          console.log(`✅ UPDATE Result:`, {
            affectedRows: updateResult.affectedRows,
            changedRows: updateResult.changedRows
          });
          
          if (updateResult.affectedRows === 0) {
            console.warn(`⚠️ WARNING: No rows updated! Vehicle ${current_vehicle} may not have SM ${scheduled_maintenance_setting_id} assigned.`);
          }
          
          changeLog.push(`Scheduled Maintenance ID ${scheduled_maintenance_setting_id}: ${currentStatus} → ${decision} (Date: ${itemServiceDate}, KM: ${itemCurrentKms})`);
        }
        */ // END DISABLED FEATURE
        
        // Log RO item status change only (without SM schedule update)
        changeLog.push(`RO Scheduled Maintenance ID ${rporid}: ${rpor_rec.rpor_status} → ${decision} (UPDATE DISABLED)`)
      } else {
        // ⚠️ DISABLED: Update RO schedule maintenance status
        // rpor_status, service_completion_date, current_kms are no longer updated
        // To re-enable: Uncomment the block below
        
        /* 🔒 DISABLED FEATURE - Uncomment to re-enable
        await connection.query(
          `UPDATE repair_purchase_order_repairs 
           SET rpor_status = ?,
               work_order_number = ?,
               invoice_number = ?,
               invoice_amount = ?,
               service_completion_date = ?,
               current_kms = ?
           WHERE id = ? LIMIT 1`,
          [decision, txtWorkOrderNumber, txtInvoiceNumber, txtInvoiceAmount, itemServiceDate, itemCurrentKms, rporid]
        );
        */ // END DISABLED FEATURE
        
        changeLog.push(`RO Scheduled Maintenance ID ${rporid}: ${rpor_rec.rpor_status} → ${decision} (UPDATE DISABLED)`);
      }
    }
    
    // === 5. Log the completion ===
    const logData = `RO ${roId} Completed. Changes:\n${changeLog.join('\n')}`;
    await connection.query(
      'INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, CURRENT_TIMESTAMP())',
      [roId, loggedUser, logData]
    );
    
    // === 6. Save invoice attachment to database (if uploaded) ===
    if (completionData.uploadedFile) {
      const { originalName, storedName } = completionData.uploadedFile;
      console.log('📎 Attempting to save invoice attachment...');
      console.log('   - RO ID:', roId);
      console.log('   - Original Name:', originalName);
      console.log('   - Stored Name:', storedName);
      
      try {
        await connection.query(
          'INSERT INTO ro_attachments VALUES (NULL, ?, ?, ?, NOW(), 1)',
          [roId, originalName, storedName]
        );
        console.log('✅ Invoice attachment saved to database');
      } catch (attachmentError) {
        console.error('❌ Failed to save invoice attachment to database:', attachmentError);
        // Don't fail the entire RO completion - continue
      }
    }
    
    // === COMMIT TRANSACTION ===
    await connection.commit();
    connection.release();
    
    console.log(`✅ Completed RO ${roId} - Full PHP Logic`);
    
    // Return detailed success message
    return {
      success: true,
      ro_id: roId,
      defects_updated: Object.keys(allDefectUpdates).length,
      sm_updated: allSMItems.length,
      change_log: changeLog,
      motive_records_to_sync: Object.keys(completedDefectsByMotiveRecord)
    };
    
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('Service error in completeRepairOrderFull:', error);
    throw error;
  }
}

/**
 * Get scheduled maintenance for ALL vehicles
 * Returns maintenance items with status calculation (GOOD, DUE_SOON, OVERDUE)
 * Same logic as getVehicleScheduledMaintenance but for all vehicles
 */
async function getAllVehiclesScheduledMaintenance() {
  try {
    console.log('📊 Fetching scheduled maintenance for ALL vehicles...');
    
    // Get all active vehicles with their configurations
    const [vehicles] = await db.query(`
      SELECT 
        v.id,
        v.vehicle_nickname,
        v.vehicle_number,
        v.vehicle_type as vehicle_type_id,
        COALESCE(vt.vehicle_type, 'Unknown') as vehicle_type_name,
        v.current_km,
        v.vehicle_configuration,
        sc.configuration_name
      FROM vehicles v
      LEFT JOIN scheduled_configurations sc ON sc.id = v.vehicle_configuration
      LEFT JOIN vehicletypes vt ON v.vehicle_type = vt.id
      WHERE v.status = 1
      AND v.vehicle_configuration IS NOT NULL
      ORDER BY v.vehicle_nickname
    `);
    
    console.log(`📋 Found ${vehicles.length} active vehicles with configurations`);
    
    const allMaintenanceItems = [];
    
    // For each vehicle, get their scheduled maintenance
    for (const vehicle of vehicles) {
      const vehicleId = vehicle.id;
      const vehicleConfig = vehicle.vehicle_configuration;
      const currentKm = parseFloat(vehicle.current_km || 0);
      
      // Get ACTIVE scheduled maintenance settings for this vehicle
      const [settings] = await db.query(`
        SELECT 
          vsm.id as vsm_id,
          vsm.last_maintenance_date,
          vsm.last_replaced_km,
          vsm.status as vsm_status,
          scs.id as scsid, 
          scs.setting_name, 
          scs.setting_type,
          scs.status as scs_status,
          cs.kms, 
          cs.kms_to_alert, 
          cs.days, 
          cs.days_to_alert,
          cs.time_unit,
          cs.interval_type,
          cs.maintenance_type,
          cs.status as cs_status
        FROM vehicle_scheduled_maintenance vsm
        LEFT JOIN scheduled_configuration_settings scs ON scs.id = vsm.scheduled_maintenance
        LEFT JOIN configuration_settings cs ON cs.setting = scs.id AND cs.configuration = ?
        WHERE vsm.vehicle = ?
        AND vsm.status = 1
        AND scs.status = 1
        AND cs.status = 1
      `, [vehicleConfig, vehicleId]);
      
      // Process each setting for this vehicle
      for (const setting of settings) {
        // Check if this setting is already in an active RO (show only for non-completed statuses)
        const [existingROData] = await db.query(`
          SELECT rpo.id as ro_id
          FROM repair_purchase_order_repairs rpor 
          LEFT JOIN repair_purchase_orders rpo ON rpo.id = rpor.repair_purchase_order 
          WHERE rpo.vehicle = ? 
          AND rpor.item_type = 'SCHEDULED_MAINTENANCE' 
          AND rpor.scheduled_maintenance_setting_id = ? 
          AND rpor.rpor_status IN ('Open', 'Pending', 'In_Progress', 'Paused')
          AND rpo.status = 1
          LIMIT 1
        `, [vehicleId, setting.scsid]);
        
        const assignedRO = existingROData.length > 0 ? existingROData[0] : null;
        
        const lastMaintenanceDate = setting.last_maintenance_date;
        const lastReplacedKm = parseFloat(setting.last_replaced_km || 0);
        
        // Initialize variables
        let actualKmsSinceService = 0;
        let actualDaysSinceService = 0;
        let durationInDays = 0;
        let alertInDays = 0;
        const timeUnit = setting.time_unit || 'DAYS';
        
        // Calculate actual values based on interval_type
        if (setting.interval_type === 'KMS' || setting.interval_type === 'BOTH') {
          actualKmsSinceService = currentKm - lastReplacedKm;
        }
        
        if (setting.interval_type === 'DURATION' || setting.interval_type === 'BOTH') {
          const today = new Date();
          const lastDate = new Date(lastMaintenanceDate);
          actualDaysSinceService = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
          
          // Convert duration to days based on time_unit
          durationInDays = setting.days || 0;
          alertInDays = setting.days_to_alert || 0;
          
          switch (timeUnit.toUpperCase()) {
            case 'WEEKS':
              durationInDays = setting.days * 7;
              alertInDays = setting.days_to_alert * 7;
              break;
            case 'MONTHS':
              durationInDays = setting.days * 30;
              alertInDays = setting.days_to_alert * 30;
              break;
            case 'YEARS':
              durationInDays = setting.days * 365;
              alertInDays = setting.days_to_alert * 365;
              break;
            // Default: DAYS - no conversion needed
          }
        }
        
        // Determine status
        let status = 'GOOD';
        let statusColor = 'green';
        let primaryReason = null;
        
        // For BOTH interval type, we need to check both KMS and Duration and take the most critical status
        let kmsStatus = 'GOOD';
        let durationStatus = 'GOOD';
        
        // Check KMS status (if applicable)
        if (setting.interval_type === 'KMS' || setting.interval_type === 'BOTH') {
          if (setting.kms && setting.kms > 0) {
            if (actualKmsSinceService >= setting.kms) {
              kmsStatus = 'OVERDUE';
              if (setting.interval_type === 'KMS') {
                status = 'OVERDUE';
                statusColor = 'red';
                primaryReason = 'KMS';
              }
            } else if (setting.kms_to_alert && actualKmsSinceService >= setting.kms_to_alert) {
              kmsStatus = 'DUE_SOON';
              if (setting.interval_type === 'KMS') {
                status = 'DUE_SOON';
                statusColor = 'yellow';
                primaryReason = 'KMS';
              }
            }
          }
        }
        
        // Check DURATION status (if applicable)
        if (setting.interval_type === 'DURATION' || setting.interval_type === 'BOTH') {
          if (durationInDays && durationInDays > 0) {
            if (actualDaysSinceService >= durationInDays) {
              durationStatus = 'OVERDUE';
              if (setting.interval_type === 'DURATION') {
                status = 'OVERDUE';
                statusColor = 'red';
                primaryReason = 'DURATION';
              }
            } else if (alertInDays && actualDaysSinceService >= alertInDays) {
              durationStatus = 'DUE_SOON';
              if (setting.interval_type === 'DURATION') {
                status = 'DUE_SOON';
                statusColor = 'yellow';
                primaryReason = 'DURATION';
              }
            }
          }
        }
        
        // For BOTH interval type, determine the most critical status
        if (setting.interval_type === 'BOTH') {
          // Priority: OVERDUE > DUE_SOON > GOOD
          if (kmsStatus === 'OVERDUE' || durationStatus === 'OVERDUE') {
            status = 'OVERDUE';
            statusColor = 'red';
            // Set primary reason based on which one is overdue (or both)
            if (kmsStatus === 'OVERDUE' && durationStatus === 'OVERDUE') {
              primaryReason = 'BOTH (KMS & Duration)';
            } else if (kmsStatus === 'OVERDUE') {
              primaryReason = 'KMS';
            } else {
              primaryReason = 'DURATION';
            }
          } else if (kmsStatus === 'DUE_SOON' || durationStatus === 'DUE_SOON') {
            status = 'DUE_SOON';
            statusColor = 'yellow';
            // Set primary reason based on which one is due soon (or both)
            if (kmsStatus === 'DUE_SOON' && durationStatus === 'DUE_SOON') {
              primaryReason = 'BOTH (KMS & Duration)';
            } else if (kmsStatus === 'DUE_SOON') {
              primaryReason = 'KMS';
            } else {
              primaryReason = 'DURATION';
            }
          } else {
            status = 'GOOD';
            statusColor = 'green';
            primaryReason = null;
          }
        }
        
        // Format display values
        let tripActualRunKmsHtm = 'N/A';
        let daysFromEffectiveDateHtm = 'N/A';
        
        if (setting.interval_type === 'KMS' || setting.interval_type === 'BOTH') {
          if (setting.kms && setting.kms > 0) {
            tripActualRunKmsHtm = `${actualKmsSinceService.toLocaleString()} / ${setting.kms.toLocaleString()} km`;
          }
        }
        
        if (setting.interval_type === 'DURATION' || setting.interval_type === 'BOTH') {
          if (durationInDays && durationInDays > 0) {
            daysFromEffectiveDateHtm = `${actualDaysSinceService} / ${durationInDays} days`;
          }
        }
        
        // Calculate next service date for DURATION-based intervals
        let nextServiceDate = null;
        if ((setting.interval_type === 'DURATION' || setting.interval_type === 'BOTH') && durationInDays > 0 && lastMaintenanceDate) {
          const lastDate = new Date(lastMaintenanceDate);
          const nextDate = new Date(lastDate);
          nextDate.setDate(nextDate.getDate() + durationInDays);
          // Format as YYYY-MM-DD
          nextServiceDate = nextDate.toISOString().split('T')[0];
        }
        
        // Add to results array
        allMaintenanceItems.push({
          id: `${vehicleId}_${setting.scsid}`,
          vehicle_id: vehicleId,
          vehicle_number: vehicle.vehicle_number,
          vehicle_nickname: vehicle.vehicle_nickname,
          vehicle_type_id: vehicle.vehicle_type_id,
          vehicle_type_name: vehicle.vehicle_type_name,
          configuration_name: vehicle.configuration_name,
          setting_name: setting.setting_name,
          setting_type: setting.interval_type,
          interval_type: setting.interval_type,
          maintenance_type: setting.maintenance_type, // ✅ Add maintenance type
          kms: setting.kms,
          kms_to_alert: setting.kms_to_alert,
          days: setting.days,
          days_to_alert: setting.days_to_alert,
          time_unit: timeUnit,
          current_km: currentKm,
          last_maintenance_date: lastMaintenanceDate,
          last_replaced_km: lastReplacedKm,
          actual_kms_since_service: actualKmsSinceService,
          actual_days_since_service: actualDaysSinceService,
          kms_html: setting.kms ? setting.kms.toLocaleString() : '',
          duration_html: setting.days ? `${setting.days} ${timeUnit}` : '',
          trip_actual_run_kms_htm: tripActualRunKmsHtm,
          days_from_effective_date_htm: daysFromEffectiveDateHtm,
          next_service_date: nextServiceDate,
          status: status,
          status_color: statusColor,
          primary_reason: primaryReason,
          assigned_ro_id: assignedRO ? assignedRO.ro_id : null,
          assigned_ro_number: assignedRO ? `RO${assignedRO.ro_id}` : null
        });
      }
    }
    
    console.log(`✅ Processed ${allMaintenanceItems.length} scheduled maintenance items across all vehicles`);
    
    return allMaintenanceItems;
    
  } catch (error) {
    console.error('Service error in getAllVehiclesScheduledMaintenance:', error);
    throw error;
  }
}

/**
 * Get Maintenance Matrix Data
 * Returns data structured for the Fleet Maintenance Matrix view:
 * - Columns: Distinct maintenance service names from scheduled_configuration_settings
 * - Rows: All active vehicles
 * - Cells: Status and details for each vehicle × maintenance item combination
 */
async function getMaintenanceMatrixData(filters = {}) {
  try {
    console.log('📊 Fetching maintenance matrix data with filters:', filters);
    
    // 1. Get all unique maintenance items (columns) from master configuration
    const columnsQuery = `
      SELECT DISTINCT 
          scs.id,
          scs.setting_name
      FROM scheduled_configuration_settings scs
      INNER JOIN vehicle_scheduled_maintenance vsm 
          ON vsm.scheduled_maintenance = scs.id
      WHERE scs.status = 1
      ORDER BY scs.setting_name ASC
    `;
    const [columns] = await db.query(columnsQuery);
    console.log(`✅ Found ${columns.length} maintenance service types`);

    // 2. Build vehicle filter conditions
    let vehicleWhereConditions = ['v.status = ?'];
    const vehicleParams = ['Active'];
    
    if (filters.vehicleType && filters.vehicleType !== 'all') {
      vehicleWhereConditions.push('v.vehicle_type = ?');
      vehicleParams.push(filters.vehicleType);
    }
    
    if (filters.vehicleIds && Array.isArray(filters.vehicleIds) && filters.vehicleIds.length > 0) {
      const placeholders = filters.vehicleIds.map(() => '?').join(',');
      vehicleWhereConditions.push(`v.id IN (${placeholders})`);
      vehicleParams.push(...filters.vehicleIds);
    }
    
    const vehicleWhereClause = vehicleWhereConditions.join(' AND ');

    // 3. Get matrix data with proper joins
    const dataQuery = `
      SELECT 
          v.id as vehicle_id,
          v.vehicle_nickname,
          v.vehicle_number,
          v.vehicle_type,
          scs.id as config_id,
          scs.setting_name,
          cs.maintenance_type,
          vsm.id as vehicle_maintenance_id,
          vsm.interval_type,
          vsm.due_status,
          vsm.ro_id,
          vsm.ro_number,
          vsm.last_kms,
          vsm.interval_kms,
          vsm.current_kms,
          vsm.next_due_kms,
          vsm.kms_remaining,
          vsm.kms_overdue,
          vsm.last_date,
          vsm.interval_days,
          vsm.next_due_date,
          vsm.days_remaining,
          vsm.days_overdue,
          vsm.trip_actual_run_kms_htm,
          vsm.days_from_effective_date_htm
      FROM vehicles v
      CROSS JOIN scheduled_configuration_settings scs
      LEFT JOIN vehicle_scheduled_maintenance vsm ON (
          vsm.vehicle_id = v.id 
          AND vsm.scheduled_maintenance = scs.id
          AND vsm.status = 1
      )
      LEFT JOIN configuration_settings cs ON (
          cs.setting = scs.id 
          AND cs.status = 1
      )
      WHERE ${vehicleWhereClause}
        AND scs.status = 1
      ORDER BY v.vehicle_nickname, scs.setting_name
    `;
    
    const [rows] = await db.query(dataQuery, vehicleParams);
    console.log(`✅ Retrieved ${rows.length} matrix data rows`);

    // 4. Transform to matrix structure
    const vehiclesMap = new Map();
    
    rows.forEach(row => {
      if (!vehiclesMap.has(row.vehicle_id)) {
        vehiclesMap.set(row.vehicle_id, {
          vehicle_id: row.vehicle_id,
          vehicle_nickname: row.vehicle_nickname,
          vehicle_number: row.vehicle_number,
          vehicle_type: row.vehicle_type,
          maintenance_items: {}
        });
      }
      
      const vehicle = vehiclesMap.get(row.vehicle_id);
      
      if (row.setting_name) {
        // Only include if there's an actual maintenance record
        vehicle.maintenance_items[row.setting_name] = row.vehicle_maintenance_id ? {
          vehicle_maintenance_id: row.vehicle_maintenance_id,
          config_id: row.config_id,
          due_status: row.due_status,
          interval_type: row.interval_type,
          maintenance_type: row.maintenance_type, // ✅ Add maintenance type
          ro_id: row.ro_id,
          ro_number: row.ro_number,
          // Include KMS data only for KMS/BOTH types
          ...(row.interval_type === 'KMS' || row.interval_type === 'BOTH' ? {
            kms_remaining: row.kms_remaining,
            kms_overdue: row.kms_overdue,
            next_due_kms: row.next_due_kms,
            current_kms: row.current_kms,
            last_kms: row.last_kms,
            interval_kms: row.interval_kms,
            trip_actual_run_kms_htm: row.trip_actual_run_kms_htm
          } : {}),
          // Include Duration data only for DURATION/BOTH types
          ...(row.interval_type === 'DURATION' || row.interval_type === 'BOTH' ? {
            days_remaining: row.days_remaining,
            days_overdue: row.days_overdue,
            next_due_date: row.next_due_date,
            last_date: row.last_date,
            interval_days: row.interval_days,
            days_from_effective_date_htm: row.days_from_effective_date_htm
          } : {})
        } : null; // No maintenance record exists for this vehicle × service combination
      }
    });

    const vehicles = Array.from(vehiclesMap.values());

    const result = {
      columns: columns.map(c => ({ id: c.id, name: c.setting_name })),
      vehicles: vehicles,
      stats: {
        total_vehicles: vehicles.length,
        total_services: columns.length,
        total_cells: rows.length
      }
    };

    console.log('✅ Matrix data prepared:', result.stats);
    return result;
    
  } catch (error) {
    console.error('Service error in getMaintenanceMatrixData:', error);
    throw error;
  }
}

/**
 * Update Repair Order Completion Details
 * Updates invoice details, payment info, and service completion data
 * Can be called on Active or In Progress ROs
 * ✅ Supports file upload for invoice attachments
 */
async function updateRepairOrderCompletionDetails(id, roData, metadata) {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const roId = id;
    const {
      kms_after_service,
      invoice_amount,
      work_order_number,
      invoice_number,
      service_completed_date,
      payment_method,
      payment_notes,
      repair_notes,
      uploadedFile
    } = roData;
    
    console.log(`🔄 [Update RO Completion] Starting update for RO #${roId}...`);
    console.log(`🔄 [Update RO Completion] Received data:`, {
      kms_after_service,
      invoice_amount,
      work_order_number,
      invoice_number,
      service_completed_date,
      payment_method,
      payment_notes: payment_notes ? 'yes' : 'no',
      repair_notes: repair_notes ? 'yes' : 'no',
      hasFile: !!uploadedFile
    });
    
    // Check if RO exists
    const [roCheck] = await connection.query(
      'SELECT id, status FROM repair_purchase_orders WHERE id = ?',
      [roId]
    );
    
    if (roCheck.length === 0) {
      await connection.rollback();
      connection.release();
      throw new Error('Repair Order not found');
    }
    
    // Build update query dynamically based on provided fields
    const updates = [];
    const values = [];
    
    if (kms_after_service !== undefined && kms_after_service !== null) {
      updates.push('kms_after_service = ?');
      values.push(kms_after_service);
    }
    
    if (invoice_amount !== undefined && invoice_amount !== null) {
      updates.push('invoice_amount = ?');
      values.push(invoice_amount);
    }
    
    if (work_order_number !== undefined) {
      updates.push('work_order_number = ?');
      values.push(work_order_number || null);
    }
    
    if (invoice_number !== undefined) {
      updates.push('invoice_number = ?');
      values.push(invoice_number || null);
    }
    
    if (service_completed_date !== undefined) {
      updates.push('service_completed_date = ?');
      // Format date to YYYY-MM-DD (strip time if present)
      let formattedDate = service_completed_date;
      if (formattedDate && typeof formattedDate === 'string') {
        // Handle ISO format '2026-01-22T05:00:00.000Z' -> '2026-01-22'
        if (formattedDate.includes('T')) {
          formattedDate = formattedDate.split('T')[0];
        }
      }
      values.push(formattedDate || null);
    }
    
    if (payment_method !== undefined && payment_method !== null) {
      updates.push('payment_method = ?');
      values.push(payment_method);
    }
    
    if (payment_notes !== undefined) {
      updates.push('payment_notes = ?');
      values.push(payment_notes || '');
    }
    
    if (repair_notes !== undefined) {
      updates.push('repair_notes = ?');
      values.push(repair_notes || '');
    }
    

    
    // Only update if we have fields to update
    if (updates.length > 0) {
      values.push(roId);
      
      const updateQuery = `
        UPDATE repair_purchase_orders 
        SET ${updates.join(', ')}
        WHERE id = ?
      `;
      
      await connection.query(updateQuery, values);
      console.log(`✅ [Update RO Completion] Updated RO #${roId} with ${updates.length} field(s)`);
    }
    
    // ✅ Handle file upload if provided
    if (uploadedFile) {
      console.log(`📎 [Update RO Completion] Processing file upload for RO #${roId}...`);
      
      // Ensure ro_attachments table exists
      await connection.query(`
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
      
      // 🔥 EXACT SAME INSERT AS COMPLETE RO (use shorthand VALUES with all columns)
      try {
        await connection.query(
          'INSERT INTO ro_attachments VALUES (NULL, ?, ?, ?, NOW(), 1)',
          [roId, uploadedFile.originalName, uploadedFile.storedName]
        );
        console.log('✅ Invoice attachment saved to database');
      } catch (attachmentError) {
        console.error('❌ Failed to save invoice attachment to database:', attachmentError);
        // Don't fail the entire RO update - continue
      }
    }
    
    await connection.commit();
    connection.release();
    
    console.log(`✅ [Update RO Completion] Successfully updated RO #${roId}`);
    
    return {
      success: true,
      ro_id: roId,
      message: 'Repair Order completion details updated successfully'
    };
    
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('Service error in updateRepairOrderCompletionDetails:', error);
    throw error;
  }
}

/**
 * PATCH — bulkApproveDefects() in repairOrderService.js
 *
 * Changes:
 *  - Each item may now carry: repair_fixed_on, service_completion_date, current_kms
 *  - rpor UPDATE now writes service_completion_date + current_kms
 *  - vrl  UPDATE now writes repair_fixed_on
 *
 * REPLACE the existing bulkApproveDefects() function with this version.
 */

async function bulkApproveDefects(roId, items, metadata) {
  const db = require('../../db/connection');
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    let totalVrlUpdated = 0;
    const processedMergeGroups = new Set();

    for (const item of items) {
      const {
        rpor_id,
        vrl_id,
        status,
        // ✅ NEW: per-row completion fields
        repair_fixed_on,         // → vrl.repair_fixed_on
        service_completion_date, // → rpor.service_completion_date
        current_kms,             // → rpor.current_kms
      } = item;
// REPLACE:
if (!rpor_id) continue;

      // 1. Update rpor — status + optional date/kms
await connection.query(
  `UPDATE repair_purchase_order_repairs 
   SET rpor_status             = COALESCE(NULLIF(?, ''), rpor_status),
       service_completion_date = COALESCE(?, service_completion_date),
       current_kms             = COALESCE(?, current_kms)
   WHERE id = ? AND repair_purchase_order = ?`,
  [status || null, service_completion_date || null, current_kms || null, rpor_id, roId]
);

      if (!vrl_id) continue;

      // 2. Check for merged group
      const [vrlRows] = await connection.query(
        `SELECT id, merged_records_id FROM vehicle_repair_logs WHERE id = ? LIMIT 1`,
        [vrl_id]
      );

      if (vrlRows.length === 0) continue;

      const vrl           = vrlRows[0];
      const mergedGroupId = vrl.merged_records_id;

      if (mergedGroupId && !processedMergeGroups.has(mergedGroupId)) {
        // Handle merged group — update ALL members
        processedMergeGroups.add(mergedGroupId);

        const [mergedRows] = await connection.query(
          `SELECT id FROM vehicle_repair_logs WHERE merged_records_id = ?`,
          [mergedGroupId]
        );

        const mergedIds = mergedRows.map((r) => r.id);
        if (!mergedIds.includes(vrl_id)) mergedIds.push(vrl_id);

        if (mergedIds.length > 0) {
          const placeholders = mergedIds.map(() => '?').join(',');
          // ✅ Write defect_status + repair_fixed_on for the whole merged group
          await connection.query(
            `UPDATE vehicle_repair_logs 
             SET defect_status   = ?,
                 repair_fixed_on = COALESCE(?, repair_fixed_on)
             WHERE id IN (${placeholders})`,
            [status, repair_fixed_on || null, ...mergedIds]
          );
          totalVrlUpdated += mergedIds.length;
        }

      } else if (!mergedGroupId) {
        // Single defect — update just this one
        await connection.query(
          `UPDATE vehicle_repair_logs 
           SET defect_status   = ?,
               repair_fixed_on = COALESCE(?, repair_fixed_on)
           WHERE id = ?`,
          [status, repair_fixed_on || null, vrl_id]
        );
        totalVrlUpdated++;
      }
    }

    // Activity log
    await connection.query(
      `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) 
       VALUES (?, ?, ?, NOW())`,
      [
        roId,
        metadata.userId,
        `Bulk status save: ${items.length} defect(s) updated (${totalVrlUpdated} VRL records) — includes date/km updates`
      ]
    );

    await connection.commit();

    return {
      items_updated:  items.length,
      vrl_updated:    totalVrlUpdated
    };

  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}



module.exports = {
  getRepairOrders,
  getRepairOrderById,
  getRepairOrderDetails,
  createRepairOrder,
  updateRepairOrder,
  updateRepairOrderCompletionDetails,
  cancelRepairOrder,
  deleteRepairOrder,
  createInitialLogsForRO,
  backfillAllROLogs,
  getVehicleDefects,
  getVehicleScheduledMaintenance,
  getAllVehiclesScheduledMaintenance,
  getMaintenanceMatrixData,
  createRepairOrderWithItems,
  getRepairOrderForEdit,
  completeRepairOrder,
  updateRepairOrderStatus,
  completeRepairOrderFull,
  bulkApproveDefects
};
