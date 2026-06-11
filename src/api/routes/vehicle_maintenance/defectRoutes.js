/**
 * Defect Routes
 * RESTful API endpoints for vehicle repair defects management
 */

const express = require('express');
const router = express.Router();
const db = require('../../db/connection');
const motiveDefectService = require('../../services/vehicle_maintenance/motiveDefectService');
const { addMetadata } = require('../../middleware/requestMetadata');
//const { requireAuth } = require('../../middleware/phpSession');

// Apply to ALL routes in this file at once
//router.use(requireAuth);
const {
  logDefectCreated,
  logDefectUpdated,
  logDefectStatusUpdate,
  logDefectManagerStatusUpdate,
  logDefectApproved,
  logDefectsMerged,
  logDefectsUnmerged,
  logDefectsRepairNotNeeded,
  logDefectsCancelled,
  logDefectsBulkUpdated,
  logDefectInspectionStatusUpdate
} = require('../../services/vehicle_maintenance/auditLogService');

/**
 * GET /api/defects
 * Get all defects with filters, pagination, and sorting
 * Matches PHP: manage-defects.php
 */


// ✅ ADD THIS LINE — must be BEFORE any route definitions
//router.use(requireAuth);
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      per_page = 10,
      sort = 'issue_date',
      order = 'DESC',
      search = '',
      repair_category = '',
      reported_by = '',
      vehicle = '',
      defect_source = [],
      defect_status = [],
      manager_status = [],
      issue_type = [],
      date_from = '',
      date_to = ''
    } = req.query;

    const limit = parseInt(per_page);
    const offset = (parseInt(page) - 1) * limit;

    // Build WHERE clause
    let whereConditions = ['vrl.id IS NOT NULL'];
    const queryParams = [];

    // ✅ NEW: Search includes secondary merged records - if secondary matches, show primary
    let secondaryMatchesCTE = '';
    
    // Search filter (searches across multiple fields)
    if (search) {
      const searchTerm = `%${search}%`;
      
      // Build CTE to find merged_records_id where secondary records match search
      secondaryMatchesCTE = `
        WITH secondary_search_matches AS (
          SELECT DISTINCT vrl_sec.merged_records_id
          FROM vehicle_repair_logs vrl_sec
          LEFT JOIN vehicles v_sec ON vrl_sec.vehicle = v_sec.id
          LEFT JOIN repair_code_categories rcc_sec ON vrl_sec.repair_code_category = rcc_sec.id
          WHERE vrl_sec.is_duplicate = 'y'
            AND vrl_sec.merged_records_id IS NOT NULL
            AND (
              vrl_sec.id LIKE ? OR
              vrl_sec.repair_desc LIKE ? OR
              vrl_sec.notes LIKE ? OR
              v_sec.vehicle_nickname LIKE ? OR
              rcc_sec.repair_code_category LIKE ?
            )
        )
      `;
      
      // Add search condition - matches primary OR primary has matching secondary
      whereConditions.push(`(
        (
          vrl.id LIKE ? OR
          vrl.repair_desc LIKE ? OR
          vrl.notes LIKE ? OR
          v.vehicle_nickname LIKE ? OR
          rcc.repair_code_category LIKE ?
        )
        OR
        (
          vrl.merged_records_id IN (SELECT merged_records_id FROM secondary_search_matches)
        )
      )`);
      
      // Push parameters: 5 for secondary CTE, 5 for primary search
      queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
      queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
      
      console.log('🔍 [DEFECTS] Search active - including secondary merged records');
    }

    // Repair category filter (array)
    if (Array.isArray(repair_category) && repair_category.length > 0) {
      const placeholders = repair_category.map(() => '?').join(',');
      whereConditions.push(`vrl.repair_code_category IN (${placeholders})`);
      queryParams.push(...repair_category);
    } else if (repair_category && !Array.isArray(repair_category)) {
      whereConditions.push('vrl.repair_code_category = ?');
      queryParams.push(repair_category);
    }

    // Reported by filter (array)
    if (Array.isArray(reported_by) && reported_by.length > 0) {
      const placeholders = reported_by.map(() => '?').join(',');
      whereConditions.push(`vrl.reported_by IN (${placeholders})`);
      queryParams.push(...reported_by);
    } else if (reported_by && !Array.isArray(reported_by)) {
      whereConditions.push('vrl.reported_by = ?');
      queryParams.push(reported_by);
    }

    // Vehicle filter (array)
    if (Array.isArray(vehicle) && vehicle.length > 0) {
      const placeholders = vehicle.map(() => '?').join(',');
      whereConditions.push(`vrl.vehicle IN (${placeholders})`);
      queryParams.push(...vehicle);
    } else if (vehicle && !Array.isArray(vehicle)) {
      whereConditions.push('vrl.vehicle = ?');
      queryParams.push(vehicle);
    }

    // Defect source filter (array)
    if (Array.isArray(defect_source) && defect_source.length > 0) {
      const placeholders = defect_source.map(() => '?').join(',');
      whereConditions.push(`vrl.defect_source IN (${placeholders})`);
      queryParams.push(...defect_source);
    } else if (defect_source && !Array.isArray(defect_source)) {
      whereConditions.push('vrl.defect_source = ?');
      queryParams.push(defect_source);
    }

    // Defect status filter (array)
    if (Array.isArray(defect_status) && defect_status.length > 0) {
      const placeholders = defect_status.map(() => '?').join(',');
      whereConditions.push(`vrl.defect_status IN (${placeholders})`);
      queryParams.push(...defect_status);
    } else if (defect_status && !Array.isArray(defect_status)) {
      whereConditions.push('vrl.defect_status = ?');
      queryParams.push(defect_status);
    }

    // Manager status filter (array)
    if (Array.isArray(manager_status) && manager_status.length > 0) {
      const placeholders = manager_status.map(() => '?').join(',');
      whereConditions.push(`vrl.manager_status IN (${placeholders})`);
      queryParams.push(...manager_status);
    } else if (manager_status && !Array.isArray(manager_status)) {
      whereConditions.push('vrl.manager_status = ?');
      queryParams.push(manager_status);
    }

    // Issue type filter (array)
    if (Array.isArray(issue_type) && issue_type.length > 0) {
      const placeholders = issue_type.map(() => '?').join(',');
      whereConditions.push(`vrl.issue_type IN (${placeholders})`);
      queryParams.push(...issue_type);
    } else if (issue_type && !Array.isArray(issue_type)) {
      whereConditions.push('vrl.issue_type = ?');
      queryParams.push(issue_type);
    }

    // Date range filter (using DATE() to ignore time component)
    if (date_from && date_to) {
      whereConditions.push('DATE(vrl.issue_date) BETWEEN ? AND ?');
      queryParams.push(date_from, date_to);
    } else if (date_from) {
      whereConditions.push('DATE(vrl.issue_date) >= ?');
      queryParams.push(date_from);
    } else if (date_to) {
      whereConditions.push('DATE(vrl.issue_date) <= ?');
      queryParams.push(date_to);
    }

    const whereClause = whereConditions.join(' AND ');

    // Valid sort columns
    const validSortColumns = [
      'id', 'issue_date', 'vehicle_nickname', 'category_name', 'repair_desc',
      'defect_status', 'manager_status', 'defect_source', 'logged_on', 'fullname'
    ];

    const orderColumn = validSortColumns.includes(sort) ? sort : 'issue_date';
    const orderDirection = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    // ✅ Build ORDER BY clause with priority-based sorting for defect_status
    let orderByClause;
    if (sort === 'defect_status') {
      // Priority-based status sorting (workflow order: Reopened → Open → In Progress → Repair Started → ... → Ro_Cancelled)
      // Secondary sort: issue_date DESC (newest first within each status)
      orderByClause = `
        CASE vrl.defect_status
          WHEN 'Reopened' THEN 1
          WHEN 'Open' THEN 2
          WHEN 'In_Progress' THEN 3
          WHEN 'Repair_Started' THEN 3.5
          WHEN 'Repair Started' THEN 3.5
          WHEN 'Pending' THEN 4
          WHEN 'Paused' THEN 5
          WHEN 'Completed' THEN 6
          WHEN 'Repair_Not_Required' THEN 7
          WHEN 'Rejected' THEN 8
          WHEN 'Ro_Cancelled' THEN 9
          WHEN 'RO_Cancelled' THEN 9
          ELSE 999
        END ${orderDirection}, vrl.issue_date DESC
      `;
    } else {
      // Standard alphabetical sorting for other columns
      orderByClause = `${orderColumn} ${orderDirection}`;
    }

    // Get status summary (counts for each status)
    const statusSummaryQuery = `
      ${secondaryMatchesCTE}
      SELECT 
        vrl.defect_status,
        COUNT(*) as count
      FROM vehicle_repair_logs vrl
      LEFT JOIN vehicles v ON vrl.vehicle = v.id
      LEFT JOIN repair_code_categories rcc ON vrl.repair_code_category = rcc.id
      LEFT JOIN users u ON vrl.reported_by = u.id
      WHERE ${whereClause}
      GROUP BY vrl.defect_status
    `;

    const [statusSummaryResults] = await db.query(statusSummaryQuery, queryParams);
    const statusSummary = {};
    let totalSummary = 0;

    statusSummaryResults.forEach(row => {
      statusSummary[row.defect_status] = row.count;
      totalSummary += row.count;
    });

    // ✅ DEBUG: Log status summary to verify what's in the database
    console.log('📊 [DEFECTS] Status Summary:', statusSummary);

    // Count total records
    const countQuery = `
      ${secondaryMatchesCTE}
      SELECT COUNT(*) as total
      FROM vehicle_repair_logs vrl
      LEFT JOIN vehicles v ON vrl.vehicle = v.id
      LEFT JOIN repair_code_categories rcc ON vrl.repair_code_category = rcc.id
      LEFT JOIN users u ON vrl.reported_by = u.id
      WHERE ${whereClause}
    `;

    const [countResult] = await db.query(countQuery, queryParams);
    const totalRecords = countResult[0]?.total || 0;
    const totalPages = Math.ceil(totalRecords / limit);

    // Main query for defects
    const mainQuery = `
      ${secondaryMatchesCTE}
      SELECT 
        vrl.*,
        vrl.id as id,
        v.vehicle_nickname,
        rcc.id as repair_code_category,
        rcc.repair_code_category as category_name,
        u.id as reported_by,
        u.fullname,
        u.middlename,
        u.nickname,
        u.lastname,
        mech.id as mechanic,
        mech.fullname as mechanicf,
        mech.middlename as mechanicm,
        mech.nickname as mechanicn,
        mech.lastname as mechanicl,
        mgr.id as manager_id,
        mgr.fullname as mgrf,
        mgr.middlename as mgrm,
        mgr.nickname as mgrn,
        mgr.lastname as mgrl,
        COALESCE(merge_counts.merged_count, 0) as merged_count,
           vrl.disengage_reason,
    vrl.disengage_notes,
    vrl.disengaged_at,
    rpor.work_order_number,
        CASE 
          WHEN vrl.is_duplicate = 'y' AND vrl.merged_records_id IS NOT NULL THEN
            (SELECT id FROM vehicle_repair_logs vrl2 
             WHERE vrl2.merged_records_id = vrl.merged_records_id 
             AND vrl2.is_duplicate = 'n' 
             LIMIT 1)
          ELSE NULL
        END as primary_defect_id,
        sa.triggered_by as system_triggered_by
      FROM vehicle_repair_logs vrl
      LEFT JOIN vehicles v ON vrl.vehicle = v.id
      LEFT JOIN repair_code_categories rcc ON vrl.repair_code_category = rcc.id
      LEFT JOIN users u ON vrl.reported_by = u.id
      LEFT JOIN users mech ON vrl.mechanic = mech.id
      LEFT JOIN users mgr ON vrl.manager_id = mgr.id
      LEFT JOIN repair_purchase_order_repairs rpor ON rpor.repair_log_id = vrl.id
      LEFT JOIN system_activities sa ON sa.source_record_id = vrl.id 
        AND sa.source_table = 'vehicle_repair_logs' 
        AND sa.activity_type = 'Scheduled Maintenance Defect Creation'
      LEFT JOIN (
        SELECT merged_records_id, COUNT(*) as merged_count
        FROM vehicle_repair_logs 
        WHERE is_duplicate = 'y'
        GROUP BY merged_records_id
      ) merge_counts ON merge_counts.merged_records_id = vrl.merged_records_id
      WHERE ${whereClause}
      ORDER BY ${orderByClause}
      LIMIT ? OFFSET ?
    `;

    const mainQueryParams = [...queryParams, limit, offset];
    const [defects] = await db.query(mainQuery, mainQueryParams);

    res.json({
      success: true,
      data: defects,
      total_records: totalRecords,
      total_pages: totalPages,
      current_page: parseInt(page),
      per_page: limit,
      status_summary: statusSummary,
      total_summary: totalSummary
    });

  } catch (error) {
    console.error('Error fetching defects:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch defects',
      error: error.message
    });
  }
});

/**
 * POST /api/defects
 * Create new defect(s) for a vehicle
 * Matches PHP: create_defect action in ajax-manage-defect.php
 * 
 * Request body:
 * {
 *   vehicle_id: number (required),
 *   defects: [
 *     {
 *       category: number (required - repair_code_category ID),
 *       desc: string (required - repair_desc),
 *       notes: string (optional)
 *     }
 *   ],
 *   reported_by: number (optional - defaults to user ID if available)
 * }
 */
router.post('/', async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // ✅ Support both single vehicle (vehicle_id) and multi-vehicle (vehicle_ids)
    let { vehicle_id, vehicle_ids, defects } = req.body;
    
    // Normalize to array format
    if (vehicle_ids && Array.isArray(vehicle_ids)) {
      // Multi-vehicle mode
      vehicle_ids = vehicle_ids.map(id => parseInt(id));
    } else if (vehicle_id) {
      // Single vehicle mode (backward compatible)
      vehicle_ids = [parseInt(vehicle_id)];
    } else {
      // No vehicles provided
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        success: false,
        message: 'vehicle_id or vehicle_ids is required',
        errors: ['At least one vehicle must be selected']
      });
    }
    
    // Get user ID from req.user (PHP session)
   const userId = req.user.id;

    // ✅ VALIDATION 1: Verify defects array
    if (!Array.isArray(defects) || defects.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        success: false,
        message: 'At least one defect is required',
        errors: ['defects array cannot be empty']
      });
    }

    // ✅ VALIDATION 2: Verify all vehicles exist
    const [vehicleCheck] = await connection.query(
      `SELECT id FROM vehicles WHERE id IN (${vehicle_ids.map(() => '?').join(',')})`,
      vehicle_ids
    );

    if (vehicleCheck.length !== vehicle_ids.length) {
      const foundIds = vehicleCheck.map(v => v.id);
      const missingIds = vehicle_ids.filter(id => !foundIds.includes(id));
      await connection.rollback();
      connection.release();
      return res.status(404).json({
        success: false,
        message: 'One or more vehicles not found',
        errors: [`Vehicle IDs not found: ${missingIds.join(', ')}`]
      });
    }

    // ✅ VALIDATION 3: Validate each defect and collect errors
    const errors = [];
    const validDefects = [];

    for (let i = 0; i < defects.length; i++) {
      const defect = defects[i];
      const defectNum = i + 1;

      // Check required fields
      if (!defect.category || defect.category === '' || defect.category === '0') {
        errors.push(`Defect #${defectNum}: Repair category is required`);
      }

      if (!defect.desc || defect.desc.trim() === '') {
        errors.push(`Defect #${defectNum}: Repair description is required`);
      }

      // If category is provided, verify it exists and is skysoft type
      if (defect.category) {
        const [categoryCheck] = await connection.query(
          `SELECT id, repair_category_type 
           FROM repair_code_categories 
           WHERE id = ? AND status = 1 
           LIMIT 1`,
          [defect.category]
        );

        if (categoryCheck.length === 0) {
          errors.push(`Defect #${defectNum}: Invalid repair category`);
        } else if (categoryCheck[0].repair_category_type !== 'skysoft') {
          errors.push(`Defect #${defectNum}: Only SkySoft repair categories are allowed for manual defect creation`);
        }
      }

      // If all validations pass for this defect, add to valid list
      if (defect.category && defect.desc && defect.desc.trim() !== '') {
        validDefects.push({
          category: parseInt(defect.category),
          desc: defect.desc.trim(),
          notes: defect.notes ? defect.notes.trim() : ''
        });
      }
    }

    // If there are validation errors, return them
    if (errors.length > 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors
      });
    }

    // ✅ ALL VALIDATIONS PASSED - Insert defects for EACH vehicle
    const insertedIds = [];
    const duplicates = [];
    const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

    // Loop through each vehicle
    for (const vehicleId of vehicle_ids) {
      // Get vehicle nickname for better error messages
      const [vehicleInfo] = await connection.query(
        'SELECT vehicle_nickname, vehicle_number FROM vehicles WHERE id = ? LIMIT 1',
        [vehicleId]
      );
      const vehicleName = vehicleInfo[0]?.vehicle_nickname || vehicleInfo[0]?.vehicle_number || `ID ${vehicleId}`;

      // Loop through each defect
      for (const defect of validDefects) {
        // ✅ DUPLICATE CHECK: Same vehicle + same notes + same date
        const [duplicateCheck] = await connection.query(`
          SELECT id, notes, issue_date 
          FROM vehicle_repair_logs 
          WHERE vehicle = ? 
            AND notes = ? 
            AND DATE(issue_date) = ?
          LIMIT 1
        `, [vehicleId, defect.notes, currentDate]);

        if (duplicateCheck.length > 0) {
          // Duplicate found - record it but don't insert
          duplicates.push({
            vehicle: vehicleName,
            notes: defect.notes,
            date: currentDate,
            existingDefectId: duplicateCheck[0].id
          });
          continue; // Skip this defect
        }

        // No duplicate - proceed with insert
        const insertQuery = `
          INSERT INTO vehicle_repair_logs (
            vehicle,
            repair_code_category,
            repair_desc,
            notes,
            reported_by,
            logged_by,
            issue_date,
            defect_source,
            defect_status,
            logged_on
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'skysoft', 'Open', NOW())
        `;

        const [result] = await connection.query(insertQuery, [
          vehicleId,
          defect.category,
          defect.desc,
          defect.notes,
          userId,
          userId,
          currentDate
        ]);

        insertedIds.push(result.insertId);
      }
    }

    // ✅ If ALL defects were duplicates, return error
    if (insertedIds.length === 0 && duplicates.length > 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        success: false,
        message: 'All defects are duplicates',
        errors: duplicates.map(d => 
          `Duplicate defect for vehicle "${d.vehicle}": "${d.notes}" on ${d.date} (Existing Defect #${d.existingDefectId})`
        ),
        duplicates: duplicates
      });
    }

    // ✅ Log the defect creation activity
    try {
      // Fetch created defects with vehicle info for logging
      if (insertedIds.length > 0) {
        const [createdDefects] = await connection.query(`
          SELECT vrl.*, v.vehicle_nickname, v.vehicle_number, rcc.repair_code_category as category_name
          FROM vehicle_repair_logs vrl
          LEFT JOIN vehicles v ON vrl.vehicle = v.id
          LEFT JOIN repair_code_categories rcc ON vrl.repair_code_category = rcc.id
          WHERE vrl.id IN (${insertedIds.map(() => '?').join(',')})
        `, insertedIds);

        const metadata = req.metadata || {
          ipAddress: req.ip,
          browser: req.headers['user-agent'],
          userId: userId
        };

        // Log each defect creation
        for (const defect of createdDefects) {
          await logDefectCreated(defect, metadata);
        }
      }
    } catch (logError) {
      console.error('❌ Error logging defect creation:', logError);
      // Don't fail the request if logging fails
    }

    await connection.commit();
    connection.release();

    // Build success message with duplicate info
    let message = `Successfully created ${insertedIds.length} defect(s)`;
    if (duplicates.length > 0) {
      message += `, skipped ${duplicates.length} duplicate(s)`;
    }

    const response = {
      success: true,
      message: message,
      inserted_ids: insertedIds,
      count: insertedIds.length,
      vehicles_count: vehicle_ids.length
    };

    // Include duplicate info if any were skipped
    if (duplicates.length > 0) {
      response.duplicates_skipped = duplicates.length;
      response.duplicate_details = duplicates.map(d => 
        `Vehicle "${d.vehicle}": "${d.notes}" on ${d.date} (Defect #${d.existingDefectId})`
      );
    }

    res.json(response);

  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('Error creating defects:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create defects',
      error: error.message,
      errors: ['Internal server error occurred']
    });
  }
});

/**
 * GET /api/defects/dashboard-stats
 * Get comprehensive defect dashboard statistics
 * Returns summary metrics and detailed breakdowns for dashboard display
 * ⚠️ MUST be defined BEFORE /:id route to avoid path conflicts
 * 
 * ⚠️ DEPRECATED: This endpoint is maintained for backward compatibility only.
 * NEW CODE SHOULD USE: /api/defect-dashboard/stats instead
 * 
 * See dedicated dashboard routes at: /api/routes/defectDashboardRoutes.js
 * See dashboard service at: /api/services/defectDashboardService.js
 * See documentation at: /api/docs/DEFECT_DASHBOARD_API.md
 */
router.get('/dashboard-stats', async (req, res) => {
  console.log('⚠️ [DEPRECATED] /defects/dashboard-stats endpoint called - use /defect-dashboard/stats instead');
  console.log('📊 [DASHBOARD-STATS] Endpoint hit - fetching defect statistics...');
  
  try {
    // ============================================
    // 1. SUMMARY STATISTICS
    // ============================================
    
    console.log('📊 [DASHBOARD-STATS] Step 1: Fetching summary statistics...');
    
    // Total open defects (NOT completed/cancelled/repair not required)
    const [openDefectsCount] = await db.query(`
      SELECT COUNT(*) as count
      FROM vehicle_repair_logs
      WHERE defect_status NOT IN ('Completed', 'Repair_Not_Required', 'Ro_Cancelled', 'RO_Cancelled')
    `);

    // Defects assigned to RO
    const [assignedToROCount] = await db.query(`
      SELECT COUNT(*) as count
      FROM vehicle_repair_logs
      WHERE linked_to_roid IS NOT NULL
        AND defect_status NOT IN ('Completed', 'Repair_Not_Required', 'Ro_Cancelled', 'RO_Cancelled')
    `);

    // Defects without RO assignment
    const [withoutROCount] = await db.query(`
      SELECT COUNT(*) as count
      FROM vehicle_repair_logs
      WHERE linked_to_roid IS NULL
        AND defect_status NOT IN ('Completed', 'Repair_Not_Required', 'Ro_Cancelled', 'RO_Cancelled')
    `);

    // SM defects pending (open state without RO)
    const [smPendingCount] = await db.query(`
      SELECT COUNT(*) as count
      FROM vehicle_repair_logs
      WHERE schedule_maintenance_id IS NOT NULL
        AND defect_status IN ('Open', 'In_Progress', 'Scheduled')
        AND linked_to_roid IS NULL
    `);

    // By source breakdown
    const [bySource] = await db.query(`
      SELECT 
        defect_source,
        COUNT(*) as count
      FROM vehicle_repair_logs
      WHERE defect_status NOT IN ('Completed', 'Repair_Not_Required', 'Ro_Cancelled', 'RO_Cancelled')
      GROUP BY defect_source
    `);

    // By status breakdown
    const [byStatus] = await db.query(`
      SELECT 
        defect_status,
        COUNT(*) as count
      FROM vehicle_repair_logs
      WHERE defect_status NOT IN ('Completed', 'Repair_Not_Required', 'Ro_Cancelled', 'RO_Cancelled')
      GROUP BY defect_status
      ORDER BY 
        CASE defect_status
          WHEN 'Reopened' THEN 1
          WHEN 'Open' THEN 2
          WHEN 'In_Progress' THEN 3
          WHEN 'Repair_Started' THEN 4
          WHEN 'Pending_Review' THEN 5
          WHEN 'Pending' THEN 6
          WHEN 'Paused' THEN 7
          ELSE 999
        END
    `);

    console.log('📊 [DASHBOARD-STATS] Step 2: Fetching defects without RO assignment...');
    
    // ============================================
    // 2. DEFECTS WITHOUT RO ASSIGNMENT
    // ============================================
    const [defectsWithoutRO] = await db.query(`
      SELECT 
        vrl.id,
        vrl.repair_desc,
        vrl.notes,
        vrl.defect_status,
        vrl.defect_source,
        vrl.issue_date,
        vrl.priority,
        vrl.schedule_maintenance_id,
        v.id as vehicle_id,
        v.vehicle_nickname,
        v.vehicle_number,
        v.unit_number,
        rcc.repair_code_category as category_name,
        DATEDIFF(NOW(), vrl.issue_date) as days_open,
        CASE WHEN vrl.merged_records_id IS NOT NULL AND vrl.is_duplicate = 'n' THEN
          (SELECT COUNT(*) FROM vehicle_repair_logs WHERE merged_records_id = vrl.merged_records_id AND is_duplicate = 'y')
        ELSE 0 END as merged_count
      FROM vehicle_repair_logs vrl
      LEFT JOIN vehicles v ON vrl.vehicle = v.id
      LEFT JOIN repair_code_categories rcc ON vrl.repair_code_category = rcc.id
      WHERE vrl.linked_to_roid IS NULL
        AND vrl.defect_status NOT IN ('Completed', 'Repair_Not_Required', 'Ro_Cancelled', 'RO_Cancelled')
      ORDER BY vrl.issue_date DESC
      LIMIT 100
    `);

    console.log('📊 [DASHBOARD-STATS] Step 3: Fetching SM defects in open state...');
    
    // ============================================
    // 3. SM DEFECTS IN OPEN STATE
    // ============================================
    const [smDefectsOpen] = await db.query(`
      SELECT 
        vrl.id,
        vrl.repair_desc,
        vrl.notes,
        vrl.defect_status,
        vrl.issue_date,
        vrl.schedule_maintenance_id,
        v.id as vehicle_id,
        v.vehicle_nickname,
        v.vehicle_number,
        v.unit_number,
        v.current_km,
        sms.name as sm_schedule_name,
        vsm.next_due_date,
        vsm.next_due_km,
        vsm.last_maintenance_date,
        vsm.last_replaced_km,
        DATEDIFF(vsm.next_due_date, NOW()) as days_until_due,
        CASE 
          WHEN vsm.next_due_km IS NOT NULL AND v.current_km IS NOT NULL 
          THEN (vsm.next_due_km - v.current_km)
          ELSE NULL
        END as km_until_due
      FROM vehicle_repair_logs vrl
      JOIN vehicles v ON vrl.vehicle = v.id
      LEFT JOIN vehicle_scheduled_maintenance vsm ON vrl.schedule_maintenance_id = vsm.scheduled_maintenance AND vsm.vehicle = v.id
      LEFT JOIN scheduled_maintenance_settings sms ON vrl.schedule_maintenance_id = sms.id
      WHERE vrl.schedule_maintenance_id IS NOT NULL
        AND vrl.defect_status IN ('Open', 'In_Progress', 'Scheduled')
        AND vrl.linked_to_roid IS NULL
      ORDER BY 
        CASE 
          WHEN vsm.next_due_date < NOW() THEN 1
          ELSE 2
        END,
        vsm.next_due_date ASC
      LIMIT 50
    `);

    console.log('📊 [DASHBOARD-STATS] Step 4: Fetching defects grouped by RO...');
    
    // ============================================
    // 4. DEFECTS GROUPED BY RO
    // ============================================
    const [defectsByRO] = await db.query(`
      SELECT 
        rpo.id as ro_id,
        rpo.ro_number,
        rpo.ro_status,
        rpo.created_date,
        COUNT(DISTINCT vrl.id) as defect_count,
        SUM(CASE WHEN vrl.defect_status = 'Completed' THEN 1 ELSE 0 END) as completed_count,
        SUM(CASE WHEN vrl.defect_status = 'In_Progress' THEN 1 ELSE 0 END) as in_progress_count,
        GROUP_CONCAT(DISTINCT vrl.defect_status ORDER BY vrl.defect_status) as defect_statuses,
        v.vehicle_nickname,
        v.unit_number
      FROM vehicle_repair_logs vrl
      JOIN repair_purchase_orders rpo ON vrl.linked_to_roid = rpo.id
      LEFT JOIN vehicles v ON rpo.vehicle = v.id
      WHERE vrl.linked_to_roid IS NOT NULL
        AND rpo.ro_status NOT IN ('Completed', 'Cancelled')
      GROUP BY rpo.id, rpo.ro_number, rpo.ro_status, rpo.created_date, v.vehicle_nickname, v.unit_number
      ORDER BY rpo.created_date DESC
      LIMIT 50
    `);

    console.log('📊 [DASHBOARD-STATS] Step 5: Building response...');
    
    // ============================================
    // 5. BUILD RESPONSE
    // ============================================
    
    // Format source breakdown
    const sourceBreakdown = {};
    bySource.forEach(row => {
      sourceBreakdown[row.defect_source || 'unknown'] = row.count;
    });

    // Format status breakdown
    const statusBreakdown = {};
    byStatus.forEach(row => {
      statusBreakdown[row.defect_status] = row.count;
    });

    console.log('✅ [DASHBOARD-STATS] Successfully fetched all statistics');
    console.log('📊 [DASHBOARD-STATS] Summary:', {
      totalOpen: openDefectsCount[0]?.count || 0,
      assignedToRO: assignedToROCount[0]?.count || 0,
      withoutRO: withoutROCount[0]?.count || 0,
      smPending: smPendingCount[0]?.count || 0
    });

    res.json({
      success: true,
      summary: {
        totalOpen: openDefectsCount[0]?.count || 0,
        assignedToRO: assignedToROCount[0]?.count || 0,
        withoutRO: withoutROCount[0]?.count || 0,
        smPending: smPendingCount[0]?.count || 0,
        bySource: sourceBreakdown,
        byStatus: statusBreakdown
      },
      defectsWithoutRO: defectsWithoutRO,
      smDefectsOpen: smDefectsOpen,
      defectsByRO: defectsByRO.map(ro => ({
        ...ro,
        progress_percentage: ro.defect_count > 0 
          ? Math.round((ro.completed_count / ro.defect_count) * 100)
          : 0
      }))
    });

  } catch (error) {
    console.error('❌ [DASHBOARD-STATS] Error fetching defect dashboard stats:', error);
    console.error('❌ [DASHBOARD-STATS] Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics',
      error: error.message,
      details: error.stack
    });
  }
});

/**
 * GET /api/defects/:id
 * Get a single defect by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        vrl.*,
        v.vehicle_nickname,
        rcc.repair_code_category as category_name,
        u.fullname,
        u.middlename,
        u.nickname,
        u.lastname,
        mech.fullname as mechanicf,
        mech.middlename as mechanicm,
        mech.nickname as mechanicn,
        mech.lastname as mechanicl,
        mgr.fullname as mgrf,
        mgr.middlename as mgrm,
        mgr.nickname as mgrn,
        mgr.lastname as mgrl,
        COALESCE(merge_counts.merged_count, 0) as merged_count,
           vrl.disengage_reason,
    vrl.disengage_notes,
    vrl.disengaged_at,
        CASE 
          WHEN vrl.is_duplicate = 'y' AND vrl.merged_records_id IS NOT NULL THEN
            (SELECT id FROM vehicle_repair_logs vrl2 
             WHERE vrl2.merged_records_id = vrl.merged_records_id 
             AND vrl2.is_duplicate = 'n' 
             LIMIT 1)
          ELSE NULL
        END as primary_defect_id
      FROM vehicle_repair_logs vrl
      LEFT JOIN vehicles v ON vrl.vehicle = v.id
      LEFT JOIN repair_code_categories rcc ON vrl.repair_code_category = rcc.id
      LEFT JOIN users u ON vrl.reported_by = u.id
      LEFT JOIN users mech ON vrl.mechanic = mech.id
      LEFT JOIN users mgr ON vrl.manager_id = mgr.id
      LEFT JOIN (
        SELECT merged_records_id, COUNT(*) as merged_count
        FROM vehicle_repair_logs 
        WHERE is_duplicate = 'y'
        GROUP BY merged_records_id
      ) merge_counts ON merge_counts.merged_records_id = vrl.merged_records_id
      WHERE vrl.id = ?
      LIMIT 1
    `;

    const [results] = await db.query(query, [id]);

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Defect not found'
      });
    }

    res.json({
      success: true,
      data: results[0]
    });

  } catch (error) {
    console.error('Error fetching defect:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch defect',
      error: error.message
    });
  }
});

/**
 * PUT /api/defects/:id/status
 * Update defect status
 * Matches PHP: update defect_status field
 */
router.put('/:id/status', addMetadata, async (req, res) => {
  try {
    const { id } = req.params;
    const { defect_status } = req.body;
    const userId = req.user?.id || 1;

    if (!defect_status) {
      return res.status(400).json({
        success: false,
        message: 'defect_status is required'
      });
    }

    // Valid statuses
    const validStatuses = [
      'Open', 'Pending', 'In_Progress', 'Completed', 'Rejected', 
      'Paused', 'Reopened', 'Repair_Not_Required', 'RO_Cancelled'
    ];

    if (!validStatuses.includes(defect_status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid defect status'
      });
    }

    // Get defect details first with vehicle info for logging
    const [defectDetails] = await db.query(`
      SELECT vrl.*, v.vehicle_nickname, v.vehicle_number
      FROM vehicle_repair_logs vrl
      LEFT JOIN vehicles v ON vrl.vehicle = v.id
      WHERE vrl.id = ? LIMIT 1
    `, [id]);

    if (defectDetails.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Defect not found'
      });
    }

    const oldDefect = defectDetails[0];
    const defectIdsToUpdate = [id];

    // If this defect is part of a merged group, update all defects in the group
    if (oldDefect.merged_records_id) {
      const [mergedGroup] = await db.query(
        'SELECT id FROM vehicle_repair_logs WHERE merged_records_id = ?',
        [oldDefect.merged_records_id]
      );
      mergedGroup.forEach(item => defectIdsToUpdate.push(item.id));
    }

    // Update all defects in the group
    for (const defectId of defectIdsToUpdate) {
      await db.query(
        'UPDATE vehicle_repair_logs SET defect_status = ? WHERE id = ? LIMIT 1',
        [defect_status, defectId]
      );
    }

    // ✅ Log the status update
    try {
      const newDefect = { ...oldDefect, defect_status };
      await logDefectStatusUpdate(oldDefect, newDefect, req.metadata);
    } catch (logError) {
      console.error('❌ Error logging defect status update:', logError);
    }

    res.json({
      success: true,
      message: 'Defect status updated successfully',
      updated_count: defectIdsToUpdate.length
    });

  } catch (error) {
    console.error('Error updating defect status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update defect status',
      error: error.message
    });
  }
});

/**
 * PUT /api/defects/:id/manager-status
 * Update manager approval status
 * Matches PHP: update manager_status field
 */
router.put('/:id/manager-status', addMetadata, async (req, res) => {
  try {
    const { id } = req.params;
    const { manager_status, manager_id, manager_name } = req.body;

    if (!manager_status) {
      return res.status(400).json({
        success: false,
        message: 'manager_status is required'
      });
    }

    // Valid manager statuses
    const validStatuses = [
      'Pending_Review', 'Approved', 'Not_Submitted', 'Rejected', 'Reopened', 'On_Hold'
    ];

    if (!validStatuses.includes(manager_status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid manager status'
      });
    }

    // Get old defect data with vehicle info for logging
    const [oldDefectData] = await db.query(`
      SELECT vrl.*, v.vehicle_nickname, v.vehicle_number
      FROM vehicle_repair_logs vrl
      LEFT JOIN vehicles v ON vrl.vehicle = v.id
      WHERE vrl.id = ? LIMIT 1
    `, [id]);

    if (oldDefectData.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Defect not found'
      });
    }

    const oldDefect = oldDefectData[0];

    const updateData = {
      manager_status,
      manager_update_date: new Date().toISOString().split('T')[0]
    };

    if (manager_id) updateData.manager_id = manager_id;
    if (manager_name) updateData.manager_name = manager_name;

    const query = `
      UPDATE vehicle_repair_logs 
      SET manager_status = ?,
          manager_update_date = ?,
          manager_id = COALESCE(?, manager_id),
          manager_name = COALESCE(?, manager_name)
      WHERE id = ?
      LIMIT 1
    `;

    await db.query(query, [
      updateData.manager_status,
      updateData.manager_update_date,
      manager_id || null,
      manager_name || null,
      id
    ]);

    // ✅ Log the manager status update
    try {
      const newDefect = { 
        ...oldDefect, 
        manager_status,
        manager_id: manager_id || oldDefect.manager_id,
        manager_name: manager_name || oldDefect.manager_name
      };
      await logDefectManagerStatusUpdate(oldDefect, newDefect, req.metadata);
    } catch (logError) {
      console.error('❌ Error logging manager status update:', logError);
    }

    res.json({
      success: true,
      message: 'Manager status updated successfully'
    });

  } catch (error) {
    console.error('Error updating manager status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update manager status',
      error: error.message
    });
  }
});

/**
 * POST /api/defects/:id/approve
 * Approve a defect (set manager_status to 'Approved')
 * Matches PHP: approve defect functionality
 */
router.post('/:id/approve', addMetadata, async (req, res) => {
  try {
    const { id } = req.params;
    const { manager_id, manager_name } = req.body;

    // Get defect details with vehicle info for logging
    const [defectCheck] = await db.query(`
      SELECT vrl.*, v.vehicle_nickname, v.vehicle_number
      FROM vehicle_repair_logs vrl
      LEFT JOIN vehicles v ON vrl.vehicle = v.id
      WHERE vrl.id = ? LIMIT 1
    `, [id]);

    if (defectCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Defect not found'
      });
    }

    const oldDefect = defectCheck[0];

    if (oldDefect.manager_status === 'Approved') {
      return res.status(400).json({
        success: false,
        message: 'Defect is already approved'
      });
    }

    const query = `
      UPDATE vehicle_repair_logs 
      SET manager_status = 'Approved',
          manager_update_date = ?,
          manager_id = ?,
          manager_name = ?
      WHERE id = ?
      LIMIT 1
    `;

    await db.query(query, [
      new Date().toISOString().split('T')[0],
      manager_id || null,
      manager_name || null,
      id
    ]);

    // ✅ Log the approval
    try {
      const approvedDefect = {
        ...oldDefect,
        manager_id,
        manager_name,
        old_defect_status: oldDefect.defect_status,
        defect_status: oldDefect.defect_status
      };
      await logDefectApproved(approvedDefect, req.metadata);
    } catch (logError) {
      console.error('❌ Error logging defect approval:', logError);
    }

    res.json({
      success: true,
      message: 'Defect approved successfully'
    });

  } catch (error) {
    console.error('Error approving defect:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve defect',
      error: error.message
    });
  }
});

/**
 * GET /api/defects/:id/edit
 * Get defect details for editing
 */
router.get('/:id/edit', async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        vrl.id,
        vrl.vehicle,
        vrl.repair_code_category,
        vrl.repair_desc,
        vrl.notes,
        vrl.defect_status,
        vrl.mechanic,
        vrl.estimate,
        vrl.repair_date,
        vrl.issue_type,
        vrl.defect_source,
          vrl.disengage_reason,
    vrl.disengage_notes,
    vrl.disengaged_at,
        v.vehicle_nickname,
        rcc.repair_code_category as category_name
      FROM vehicle_repair_logs vrl
      LEFT JOIN vehicles v ON vrl.vehicle = v.id
      LEFT JOIN repair_code_categories rcc ON vrl.repair_code_category = rcc.id
      WHERE vrl.id = ?
      LIMIT 1
    `;

    const [results] = await db.query(query, [id]);

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Defect not found'
      });
    }

    res.json({
      success: true,
      data: results[0]
    });

  } catch (error) {
    console.error('Error fetching defect for edit:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch defect',
      error: error.message
    });
  }
});

/**
 * PUT /api/defects/:id/save
 * Update defect details
 * Matches PHP: update defect fields
 */
router.put('/:id/save', addMetadata, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      repair_code_category,
      repair_desc,
      notes,
      defect_status,
      mechanic,
      estimate,
      repair_date,
      priority,
      scheduled_repair
    } = req.body;

    console.log('🔧 PUT /api/defects/:id/save - Defect ID:', id);
    console.log('📝 Request body:', req.body);

    // Get old defect data with vehicle info and category name for logging
    const [oldDefectData] = await db.query(`
      SELECT vrl.*, v.vehicle_nickname, v.vehicle_number, rcc.repair_code_category as category_name
      FROM vehicle_repair_logs vrl
      LEFT JOIN vehicles v ON vrl.vehicle = v.id
      LEFT JOIN repair_code_categories rcc ON vrl.repair_code_category = rcc.id
      WHERE vrl.id = ? LIMIT 1
    `, [id]);

    if (oldDefectData.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Defect not found'
      });
    }

    const oldDefect = oldDefectData[0];

    // Build update query dynamically based on provided fields
    const updates = [];
    const params = [];

    if (repair_code_category !== undefined) {
      updates.push('repair_code_category = ?');
      params.push(repair_code_category);
    }
    if (repair_desc !== undefined) {
      updates.push('repair_desc = ?');
      params.push(repair_desc);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      params.push(notes);
    }
    if (defect_status !== undefined) {
      updates.push('defect_status = ?');
      params.push(defect_status);
    }
    if (mechanic !== undefined) {
      updates.push('mechanic = ?');
      params.push(mechanic || null);
    }
    if (estimate !== undefined) {
      updates.push('estimate = ?');
      params.push(estimate || null);
    }
    if (repair_date !== undefined) {
      updates.push('repair_date = ?');
      params.push(repair_date || null);
    }
    if (priority !== undefined) {
      updates.push('priority = ?');
      params.push(priority || null);
    }
    if (scheduled_repair !== undefined) {
      updates.push('scheduled_repair = ?');
      params.push(scheduled_repair || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    params.push(id);

    const query = `
      UPDATE vehicle_repair_logs 
      SET ${updates.join(', ')}
      WHERE id = ?
      LIMIT 1
    `;

    const [result] = await db.query(query, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Defect not found'
      });
    }

    // ✅ Log the defect update
    try {
      const newDefect = { ...oldDefect, ...req.body };
      
      // If category changed, fetch the new category name
      if (repair_code_category !== undefined && repair_code_category !== oldDefect.repair_code_category) {
        const [newCategoryData] = await db.query(
          'SELECT repair_code_category FROM repair_code_categories WHERE id = ? LIMIT 1',
          [repair_code_category]
        );
        if (newCategoryData.length > 0) {
          newDefect.category_name = newCategoryData[0].repair_code_category;
        }
      }
      // If category didn't change, preserve the old category_name
      else if (repair_code_category === undefined || repair_code_category === oldDefect.repair_code_category) {
        newDefect.category_name = oldDefect.category_name;
      }
      
      await logDefectUpdated(oldDefect, newDefect, req.metadata);
    } catch (logError) {
      console.error('❌ Error logging defect update:', logError);
    }

    res.json({
      success: true,
      message: 'Defect updated successfully'
    });

  } catch (error) {
    console.error('Error updating defect:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update defect',
      error: error.message
    });
  }
});

/**
 * POST /api/defects/merge
 * Merge multiple defects into a primary defect
 * Matches PHP: merge defects functionality with validation
 */
router.post('/merge', async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const { primary_defect_id, secondary_defect_ids } = req.body;

    // ✅ VALIDATION 1: Check required fields
    if (!primary_defect_id || !Array.isArray(secondary_defect_ids) || secondary_defect_ids.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        success: false,
        message: 'primary_defect_id and secondary_defect_ids array are required'
      });
    }

    // ✅ VALIDATION 2: Ensure primary is not in secondary list
    if (secondary_defect_ids.includes(primary_defect_id)) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        success: false,
        message: 'Primary defect cannot be in the secondary defects list'
      });
    }

    // ✅ VALIDATION 3: Check all defects exist
    const allDefectIds = [primary_defect_id, ...secondary_defect_ids];
    const placeholders = allDefectIds.map(() => '?').join(',');
    
    const [existingDefects] = await connection.query(
      `SELECT id, vehicle, is_duplicate, merged_records_id 
       FROM vehicle_repair_logs 
       WHERE id IN (${placeholders})`,
      allDefectIds
    );

    if (existingDefects.length !== allDefectIds.length) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({
        success: false,
        message: 'One or more defects not found'
      });
    }

    // ✅ VALIDATION 4: Check all defects belong to same vehicle
    const vehicleIds = new Set(existingDefects.map(d => d.vehicle));
    if (vehicleIds.size > 1) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        success: false,
        message: 'All defects must belong to the same vehicle to merge',
        vehicles: Array.from(vehicleIds)
      });
    }

    // ✅ VALIDATION 5: Simplified merge validation - let user choose primary freely
    const alreadyMerged = existingDefects.filter(d => d.merged_records_id && d.merged_records_id.trim() !== '');
    const newDefects = existingDefects.filter(d => !d.merged_records_id || d.merged_records_id.trim() === '');
    
    let mergeId;
    let isAddingToExistingGroup = false;
    
    if (alreadyMerged.length > 0) {
      // Some defects are already merged
      
      // Check if ALL selected defects are already merged (nothing to do)
      if (newDefects.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          success: false,
          message: 'All selected defects are already merged. Please select at least one new defect to add to the merge group.'
        });
      }
      
      // Check if defects are from DIFFERENT merge groups
      const mergeGroups = new Set(alreadyMerged.map(d => d.merged_records_id));
      if (mergeGroups.size > 1) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          success: false,
          message: 'Cannot merge defects from different merge groups. Please select defects from only one existing merge group.'
        });
      }
      
      // Use existing merge ID (reuse or update)
      mergeId = alreadyMerged[0].merged_records_id;
      isAddingToExistingGroup = true;
      
      // ✅ NO RESTRICTION: Let user choose any primary (existing or new)
      // If they choose a different primary, it will be updated in the database
    } else {
      // No defects are merged - create new merge group
      mergeId = `MRG_${Date.now()}_${primary_defect_id}`;
    }

    // ✅ VALIDATION 6: Verify primary defect is in the list
    const primaryExists = existingDefects.find(d => d.id === primary_defect_id);
    if (!primaryExists) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({
        success: false,
        message: 'Primary defect not found'
      });
    }

    // ✅ ALL VALIDATIONS PASSED - Proceed with merge
    
    // If adding to existing group and primary changed, demote old primary
    if (isAddingToExistingGroup) {
      const oldPrimary = alreadyMerged.find(d => d.is_duplicate === 'n');
      if (oldPrimary && oldPrimary.id !== primary_defect_id) {
        // Demote old primary to secondary
        await connection.query(
          `UPDATE vehicle_repair_logs 
           SET is_duplicate = 'y' 
           WHERE id = ? 
           LIMIT 1`,
          [oldPrimary.id]
        );
      }
    }
    
    // Update primary defect (set merge ID and mark as primary)
    await connection.query(
      `UPDATE vehicle_repair_logs 
       SET merged_records_id = ?, is_duplicate = 'n' 
       WHERE id = ? 
       LIMIT 1`,
      [mergeId, primary_defect_id]
    );

    // Update secondary defects (set merge ID and mark as secondary)
    for (const secondaryId of secondary_defect_ids) {
      await connection.query(
        `UPDATE vehicle_repair_logs 
         SET merged_records_id = ?, is_duplicate = 'y' 
         WHERE id = ? 
         LIMIT 1`,
        [mergeId, secondaryId]
      );
    }

    // ✅ Log the merge operation
    try {
      const [mergedDefectsInfo] = await connection.query(`
        SELECT vrl.*, v.vehicle_nickname, v.vehicle_number
        FROM vehicle_repair_logs vrl
        LEFT JOIN vehicles v ON vrl.vehicle = v.id
        WHERE vrl.id IN (${allDefectIds.map(() => '?').join(',')})
      `, allDefectIds);

      const metadata = req.metadata || {
        ipAddress: req.ip,
        browser: req.headers['user-agent'],
        userId: req.user?.id || 1
      };

      await logDefectsMerged(mergedDefectsInfo, primary_defect_id, metadata);
    } catch (logError) {
      console.error('❌ Error logging defect merge:', logError);
    }

    await connection.commit();
    connection.release();

    res.json({
      success: true,
      message: isAddingToExistingGroup 
        ? `Successfully added ${secondary_defect_ids.length} defect(s) to existing merge group`
        : `Successfully merged ${allDefectIds.length} defects into new merge group`,
      merge_id: mergeId,
      primary_defect_id,
      secondary_count: secondary_defect_ids.length,
      total_defects_in_group: allDefectIds.length,
      is_adding_to_existing: isAddingToExistingGroup
    });

  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('Error merging defects:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to merge defects',
      error: error.message
    });
  }
});

/**
 * POST /api/defects/unmerge
 * Unmerge defects - remove from merged group
 * Can unmerge specific defects or entire group
 */
router.post('/unmerge', async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const { defect_ids, unmerge_all = false } = req.body;

    // ✅ VALIDATION 1: Check required fields
    if (!Array.isArray(defect_ids) || defect_ids.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        success: false,
        message: 'defect_ids array is required'
      });
    }

    // ✅ VALIDATION 2: Get defects and verify they exist
    const placeholders = defect_ids.map(() => '?').join(',');
    const [defects] = await connection.query(
      `SELECT id, merged_records_id, is_duplicate 
       FROM vehicle_repair_logs 
       WHERE id IN (${placeholders})`,
      defect_ids
    );

    if (defects.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({
        success: false,
        message: 'No defects found'
      });
    }

    // ✅ VALIDATION 3: Check if defects are actually merged
    const notMerged = defects.filter(d => !d.merged_records_id || d.merged_records_id === null);
    if (notMerged.length === defects.length) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        success: false,
        message: 'Selected defects are not part of any merged group'
      });
    }

    // ✅ VALIDATION 4: Get all merge group IDs involved
    const mergeGroupIds = [...new Set(defects.filter(d => d.merged_records_id).map(d => d.merged_records_id))];
    
    if (mergeGroupIds.length > 1) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        success: false,
        message: 'Cannot unmerge defects from multiple merge groups at once',
        merge_groups: mergeGroupIds
      });
    }

    const mergeGroupId = mergeGroupIds[0];

    // ✅ Get all defects in the merge group
    const [allDefectsInGroup] = await connection.query(
      `SELECT id, is_duplicate 
       FROM vehicle_repair_logs 
       WHERE merged_records_id = ?`,
      [mergeGroupId]
    );

    let defectsToUnmerge = [];
    let primaryDefect = allDefectsInGroup.find(d => d.is_duplicate === 'n');

    if (unmerge_all) {
      // ✅ UNMERGE ALL: Remove all defects from merge group
      defectsToUnmerge = allDefectsInGroup.map(d => d.id);
    } else {
      // ✅ PARTIAL UNMERGE: Remove only specified defects
      defectsToUnmerge = defect_ids;

      // ✅ VALIDATION 5: Check if unmerging would leave only 1 defect
      const remainingDefects = allDefectsInGroup.filter(d => !defect_ids.includes(d.id));
      
      if (remainingDefects.length === 1) {
        // If only 1 defect remains, auto-unmerge it too (can't have group of 1)
        defectsToUnmerge = allDefectsInGroup.map(d => d.id);
      } else if (remainingDefects.length > 1) {
        // ✅ VALIDATION 6: Check if primary is being unmerged
        if (defect_ids.includes(primaryDefect?.id)) {
          // Primary is being removed - need to promote a secondary to primary
          const newPrimary = remainingDefects[0];
          
          await connection.query(
            `UPDATE vehicle_repair_logs 
             SET is_duplicate = 'n' 
             WHERE id = ? 
             LIMIT 1`,
            [newPrimary.id]
          );
        }
      }
    }

    // ✅ Perform unmerge - clear merged_records_id and is_duplicate
    const unmerge_placeholders = defectsToUnmerge.map(() => '?').join(',');
    await connection.query(
      `UPDATE vehicle_repair_logs 
       SET merged_records_id = NULL, is_duplicate = 'n' 
       WHERE id IN (${unmerge_placeholders})`,
      defectsToUnmerge
    );

    // ✅ Log the unmerge operation
    try {
      const [unmergedDefectsInfo] = await connection.query(`
        SELECT vrl.*, v.vehicle_nickname, v.vehicle_number
        FROM vehicle_repair_logs vrl
        LEFT JOIN vehicles v ON vrl.vehicle = v.id
        WHERE vrl.id IN (${unmerge_placeholders})
      `, defectsToUnmerge);

      const metadata = req.metadata || {
        ipAddress: req.ip,
        browser: req.headers['user-agent'],
        userId: req.user?.id || 1
      };

      await logDefectsUnmerged(unmergedDefectsInfo, primaryDefect?.id || null, metadata);
    } catch (logError) {
      console.error('❌ Error logging defect unmerge:', logError);
    }

    await connection.commit();
    connection.release();

    res.json({
      success: true,
      message: 'Defects unmerged successfully',
      unmerged_count: defectsToUnmerge.length,
      merge_group_id: mergeGroupId,
      remaining_in_group: allDefectsInGroup.length - defectsToUnmerge.length
    });

  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('Error unmerging defects:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unmerge defects',
      error: error.message
    });
  }
});

/**
 * GET /api/defects/merged-group/:merge_id
 * Get all defects in a merged group
 */
router.get('/merged-group/:merge_id', async (req, res) => {
  try {
    const { merge_id } = req.params;

    if (!merge_id) {
      return res.status(400).json({
        success: false,
        message: 'merge_id is required'
      });
    }

    const query = `
      SELECT 
        vrl.*,
        v.vehicle_nickname,
        rcc.repair_code_category as category_name,
        u.fullname,
        u.middlename,
        u.nickname,
        u.lastname
      FROM vehicle_repair_logs vrl
      LEFT JOIN vehicles v ON vrl.vehicle = v.id
      LEFT JOIN repair_code_categories rcc ON vrl.repair_code_category = rcc.id
      LEFT JOIN users u ON vrl.reported_by = u.id
      WHERE vrl.merged_records_id = ?
      ORDER BY 
        CASE WHEN vrl.is_duplicate = 'n' THEN 0 ELSE 1 END,
        vrl.id ASC
    `;

    const [defects] = await db.query(query, [merge_id]);

    if (defects.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No defects found in this merge group'
      });
    }

    const primaryDefect = defects.find(d => d.is_duplicate === 'n');
    const secondaryDefects = defects.filter(d => d.is_duplicate === 'y');

    res.json({
      success: true,
      merge_group_id: merge_id,
      total_count: defects.length,
      primary_defect: primaryDefect || null,
      secondary_defects: secondaryDefects,
      all_defects: defects
    });

  } catch (error) {
    console.error('Error fetching merged group:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch merged group',
      error: error.message
    });
  }
});

/**
 * POST /api/defects/validate-ro-vehicle
 * Validate if selected defects belong to the same vehicle for RO creation
 * Matches PHP: validation logic
 */
router.post('/validate-ro-vehicle', async (req, res) => {
  try {
    const { defect_ids } = req.body;

    if (!Array.isArray(defect_ids) || defect_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'defect_ids array is required'
      });
    }

    const placeholders = defect_ids.map(() => '?').join(',');
    const query = `
      SELECT DISTINCT vehicle 
      FROM vehicle_repair_logs 
      WHERE id IN (${placeholders})
    `;

    const [results] = await db.query(query, defect_ids);

    if (results.length > 1) {
      return res.json({
        success: false,
        message: 'Selected defects must belong to the same vehicle',
        vehicles: results.map(r => r.vehicle)
      });
    }

    res.json({
      success: true,
      vehicle_id: results[0]?.vehicle,
      defect_count: defect_ids.length
    });

  } catch (error) {
    console.error('Error validating RO vehicle:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate',
      error: error.message
    });
  }
});

/**
 * POST /api/defects/inspection-status
 * Update Motive inspection status
 * Matches PHP: Motive integration
 */
router.post('/inspection-status', addMetadata, async (req, res) => {
  try {
    const { defect_id, inspection_status, driver_signed, driver_signed_date } = req.body;

    if (!defect_id || !inspection_status) {
      return res.status(400).json({
        success: false,
        message: 'defect_id and inspection_status are required'
      });
    }

    // Get old defect data for logging
    const [oldDefectData] = await db.query(`
      SELECT vrl.*, v.vehicle_nickname, v.vehicle_number
      FROM vehicle_repair_logs vrl
      LEFT JOIN vehicles v ON vrl.vehicle = v.id
      WHERE vrl.id = ? LIMIT 1
    `, [defect_id]);

    const query = `
      UPDATE vehicle_repair_logs 
      SET motive_driver_inspection_status = ?,
          motive_driver_signed = ?,
          motive_driver_signed_date = ?
      WHERE id = ?
      LIMIT 1
    `;

    await db.query(query, [
      inspection_status,
      driver_signed || null,
      driver_signed_date || null,
      defect_id
    ]);

    // ✅ Log the inspection status update
    try {
      if (oldDefectData.length > 0) {
        const updatedDefect = {
          ...oldDefectData[0],
          inspection_status,
          driver_signed,
          driver_signed_date,
          old_inspection_status: oldDefectData[0].motive_driver_inspection_status
        };
        await logDefectInspectionStatusUpdate(updatedDefect, req.metadata);
      }
    } catch (logError) {
      console.error('❌ Error logging inspection status update:', logError);
    }

    res.json({
      success: true,
      message: 'Inspection status updated successfully'
    });

  } catch (error) {
    console.error('Error updating inspection status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update inspection status',
      error: error.message
    });
  }
});

/**
 * POST /api/defects/repair-not-needed
 * Bulk mark defects as "Repair Not Needed"
 * Matches PHP: repair_not_needed action
 */
router.post('/repair-not-needed', async (req, res) => {
  const { ids } = req.body;
  const userId = req.user?.id || 1;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No defects selected'
    });
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const processedIds = [];

    for (const id of ids) {
      const defectId = parseInt(id);

      // Get defect details
      const [defects] = await connection.query(
        'SELECT id, merged_records_id, is_duplicate FROM vehicle_repair_logs WHERE id = ?',
        [defectId]
      );

      if (defects.length === 0) continue;

      const defect = defects[0];
      let idsToUpdate = [];

      // Check if merged group
      if (defect.merged_records_id && defect.is_duplicate === 'n') {
        // Primary defect → update entire group
        const [mergedGroup] = await connection.query(
          'SELECT id FROM vehicle_repair_logs WHERE merged_records_id = ?',
          [defect.merged_records_id]
        );
        idsToUpdate = mergedGroup.map(d => d.id);
      } else {
        // Standalone or secondary defect
        idsToUpdate = [defectId];
      }

      if (idsToUpdate.length > 0) {
        // Update vehicle_repair_logs
        const placeholders = idsToUpdate.map(() => '?').join(',');
        await connection.query(
          `UPDATE vehicle_repair_logs 
           SET last_action_on = NOW(), 
               last_action_by = ?, 
               motive_defect_status = 'no_repair_needed',
               defect_status = 'Repair_Not_Required'
           WHERE id IN (${placeholders})`,
          [userId, ...idsToUpdate]
        );

        // Update repair_purchase_order_repairs
        await connection.query(
          `UPDATE repair_purchase_order_repairs 
           SET rpor_status = 'Repair_Not_Required'
           WHERE repair_log_id IN (${placeholders})`,
          idsToUpdate
        );

        processedIds.push(...idsToUpdate);
      }
    }

    // ✅ Log the repair not needed action
    try {
      const uniqueIds = [...new Set(processedIds)];
      if (uniqueIds.length > 0) {
        const [defectsInfo] = await connection.query(`
          SELECT vrl.*, v.vehicle_nickname, v.vehicle_number
          FROM vehicle_repair_logs vrl
          LEFT JOIN vehicles v ON vrl.vehicle = v.id
          WHERE vrl.id IN (${uniqueIds.map(() => '?').join(',')})
        `, uniqueIds);

        const metadata = req.metadata || {
          ipAddress: req.ip,
          browser: req.headers['user-agent'],
          userId: userId
        };

        await logDefectsRepairNotNeeded(defectsInfo, metadata);
      }
    } catch (logError) {
      console.error('❌ Error logging repair not needed:', logError);
    }

    await connection.commit();

    const uniqueIds = [...new Set(processedIds)];

    res.json({
      success: true,
      message: `Successfully marked ${uniqueIds.length} defect(s) as "Repair Not Needed"`,
      count: uniqueIds.length,
      ids: uniqueIds
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error in repair-not-needed:', error);
    res.status(500).json({
      success: false,
      message: 'Bulk status update to "Repair_Not_Required" failed',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

/**
 * POST /api/defects/cancel-checked
 * Bulk mark defects as "Rejected/Cancelled"
 * Matches PHP: cancel_checked action
 */
router.post('/cancel-checked', async (req, res) => {
  const { ids } = req.body;
  const userId = req.user?.id || 1;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No defects selected'
    });
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const processedIds = [];

    for (const id of ids) {
      const defectId = parseInt(id);

      // Get defect details
      const [defects] = await connection.query(
        'SELECT id, merged_records_id, is_duplicate FROM vehicle_repair_logs WHERE id = ?',
        [defectId]
      );

      if (defects.length === 0) continue;

      const defect = defects[0];
      let idsToUpdate = [];

      // Check if merged group
      if (defect.merged_records_id && defect.is_duplicate === 'n') {
        // Primary defect → update entire group
        const [mergedGroup] = await connection.query(
          'SELECT id FROM vehicle_repair_logs WHERE merged_records_id = ?',
          [defect.merged_records_id]
        );
        idsToUpdate = mergedGroup.map(d => d.id);
      } else {
        // Standalone or secondary defect
        idsToUpdate = [defectId];
      }

      if (idsToUpdate.length > 0) {
        // Update vehicle_repair_logs
        const placeholders = idsToUpdate.map(() => '?').join(',');
        await connection.query(
          `UPDATE vehicle_repair_logs 
           SET last_action_on = NOW(), 
               last_action_by = ?, 
               motive_defect_status = 'no_repair_needed',
               defect_status = 'Rejected'
           WHERE id IN (${placeholders})`,
          [userId, ...idsToUpdate]
        );

        // Update repair_purchase_order_repairs
        await connection.query(
          `UPDATE repair_purchase_order_repairs 
           SET rpor_status = 'Rejected'
           WHERE repair_log_id IN (${placeholders})`,
          idsToUpdate
        );

        processedIds.push(...idsToUpdate);
      }
    }

    // ✅ Log the cancel/reject action
    try {
      const uniqueIds = [...new Set(processedIds)];
      if (uniqueIds.length > 0) {
        const [defectsInfo] = await connection.query(`
          SELECT vrl.*, v.vehicle_nickname, v.vehicle_number
          FROM vehicle_repair_logs vrl
          LEFT JOIN vehicles v ON vrl.vehicle = v.id
          WHERE vrl.id IN (${uniqueIds.map(() => '?').join(',')})
        `, uniqueIds);

        const metadata = req.metadata || {
          ipAddress: req.ip,
          browser: req.headers['user-agent'],
          userId: userId
        };

        await logDefectsCancelled(defectsInfo, metadata);
      }
    } catch (logError) {
      console.error('❌ Error logging defect cancellation:', logError);
    }

    await connection.commit();

    const uniqueIds = [...new Set(processedIds)];

    res.json({
      success: true,
      message: `Successfully marked ${uniqueIds.length} defect(s) as "Rejected/Cancelled"`,
      count: uniqueIds.length,
      ids: uniqueIds
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error in cancel-checked:', error);
    res.status(500).json({
      success: false,
      message: 'Bulk status update to "Rejected" failed',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

/**
 * POST /api/defects/:id/approve-manager
 * Manager approval endpoint - approves defect and syncs with Motive if applicable
 * Matches PHP: approve_defect action with full Motive integration
 */
router.post('/:id/approve-manager', addMetadata, async (req, res) => {
  const defectId = parseInt(req.params.id);
  const { manager_status } = req.body;
  const userId = req.user?.id || 1;
  const userName = req.user?.fullname || 'System';

  console.log('🔍 [APPROVE-MANAGER] Starting approval process...');
  console.log('   Defect ID:', defectId);
  console.log('   Manager Status:', manager_status);
  console.log('   User:', userName, '(ID:', userId, ')');

  if (!defectId) {
    return res.status(400).json({
      success: false,
      message: 'Invalid defect ID'
    });
  }

  if (!manager_status) {
    return res.status(400).json({
      success: false,
      message: 'Manager Approval Status is required'
    });
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Fetch defect details
    const [defects] = await connection.query(
      `SELECT id, defect_source, motive_defect_id, merged_records_id, is_duplicate,
              linked_to_ro_items, defect_status, motive_record_id, repair_desc,
              mechanic, mechanic_notes, repair_date, motive_defect_status,
              motive_inspection_isodate, logged_on
       FROM vehicle_repair_logs 
       WHERE id = ?`,
      [defectId]
    );

    if (defects.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Defect not found'
      });
    }

    const defect = defects[0];
    console.log('📋 [APPROVE-MANAGER] Defect Details:');
    console.log('   Defect Source:', defect.defect_source);
    console.log('   Defect Status:', defect.defect_status);
    console.log('   Motive Defect ID:', defect.motive_defect_id);
    console.log('   Motive Record ID:', defect.motive_record_id);
    console.log('   Merged Records ID:', defect.merged_records_id);

    // 2. Validate status (only Completed or Repair_Not_Required can be approved)
    if (!['Completed', 'Repair_Not_Required'].includes(defect.defect_status)) {
      await connection.rollback();
      console.log('❌ [APPROVE-MANAGER] Invalid status for approval:', defect.defect_status);
      return res.status(400).json({
        success: false,
        message: 'Only defects with status "Completed" or "Repair_Not_Required" can be approved'
      });
    }

    // 3. Get all defects in group (merged or standalone)
    let defectIds = [];
    let defectRoItems = [];

    if (defect.merged_records_id) {
      const [mergedGroup] = await connection.query(
        `SELECT id, linked_to_ro_items 
         FROM vehicle_repair_logs 
         WHERE merged_records_id = ?`,
        [defect.merged_records_id]
      );
      defectIds = mergedGroup.map(d => d.id);
      defectRoItems = mergedGroup.map(d => d.linked_to_ro_items).filter(Boolean);
    } else {
      defectIds = [defectId];
      if (defect.linked_to_ro_items) {
        defectRoItems = [defect.linked_to_ro_items];
      }
    }

    // 4. Determine Motive status
    const motiveDefectStatus = defect.defect_status === 'Completed' 
      ? 'repaired' 
      : 'no_repair_needed';

    // 5. Update LOCAL DATABASE
    const placeholders = defectIds.map(() => '?').join(',');
    await connection.query(
      `UPDATE vehicle_repair_logs 
       SET motive_defect_status = ?,
           defect_status = ?,
           manager_status = ?,
           manager_id = ?,
           manager_name = ?,
           manager_update_date = NOW()
       WHERE id IN (${placeholders})`,
      [motiveDefectStatus, defect.defect_status, manager_status, userId, `${userName}-skysoft`, ...defectIds]
    );

    // 6. Update RO items if applicable
    const uniqueRoItems = [...new Set(defectRoItems.filter(Boolean))];
    if (uniqueRoItems.length > 0) {
      const roPlaceholders = uniqueRoItems.map(() => '?').join(',');
      await connection.query(
        `UPDATE repair_purchase_order_repairs 
         SET rpor_status = ?
         WHERE id IN (${roPlaceholders})`,
        [defect.defect_status, ...uniqueRoItems]
      );
    }

    await connection.commit();
    console.log('✅ [APPROVE-MANAGER] Local database updated successfully');

    // 7. Sync with Motive API (if Motive defect)
    let motiveMessage = null;
    if (defect.defect_source === 'motive') {
      console.log('🚀 [APPROVE-MANAGER] This is a MOTIVE defect - initiating API sync...');
      console.log('   Calling motiveDefectService.pushToMotive(', defectId, ')');
      motiveMessage = await motiveDefectService.pushToMotive(defectId);
      console.log('📡 [APPROVE-MANAGER] Motive API response:', JSON.stringify(motiveMessage, null, 2));
    } else {
      console.log('ℹ️ [APPROVE-MANAGER] Not a Motive defect (source:', defect.defect_source, ') - skipping API sync');
    }

    // ✅ Log the manager approval
    try {
      const [approvedDefectData] = await connection.query(`
        SELECT vrl.*, v.vehicle_nickname, v.vehicle_number
        FROM vehicle_repair_logs vrl
        LEFT JOIN vehicles v ON vrl.vehicle = v.id
        WHERE vrl.id = ? LIMIT 1
      `, [defectId]);

      if (approvedDefectData.length > 0) {
        const approvedDefect = {
          ...approvedDefectData[0],
          manager_id: userId,
          manager_name: userName
        };
        await logDefectApproved(approvedDefect, req.metadata);
      }
    } catch (logError) {
      console.error('❌ Error logging defect approval:', logError);
    }

    // 8. Final response
    if (motiveMessage && motiveMessage.success === 'NOOK') {
      console.log('❌ [APPROVE-MANAGER] Motive sync FAILED');
      return res.status(207).json({ // 207 Multi-Status (partial success)
        success: false,
        message: `Local update succeeded, but Motive sync failed: ${motiveMessage.detail}`,
        local_update: true,
        motive_sync: false,
        motive_error: motiveMessage.detail
      });
    } else if (motiveMessage && motiveMessage.success === 'OK') {
      console.log('✅ [APPROVE-MANAGER] Motive sync SUCCESSFUL');
      return res.json({
        success: true,
        message: `Defect(s) approved successfully. ${motiveMessage.message}`,
        local_update: true,
        motive_sync: true,
        defect_ids_synced: motiveMessage.defect_ids_synced
      });
    } else {
      console.log('ℹ️ [APPROVE-MANAGER] Completed without Motive sync');
      return res.json({
        success: true,
        message: 'Defect(s) approved successfully.',
        local_update: true,
        motive_sync: false
      });
    }

  } catch (error) {
    await connection.rollback();
    console.error('❌ [APPROVE-MANAGER] Error in approve defect:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during approval',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

/**
 * POST /api/defects/bulk-repair-not-required
 * Bulk mark defects as Repair Not Required with automatic approval and Motive sync
 * ✅ NEW: Streamlined approval process - no manager_status required beforehand
 */
router.post('/bulk-repair-not-required', addMetadata, async (req, res) => {
  const { defect_ids, manager_id, manager_name } = req.body;
  
  // ✅ Use provided manager info from frontend (fetched via getCurrentUser)
  const userId = manager_id || req.user?.id || 1;
  const userName = manager_name || req.user?.username || 'System';

  console.log('🔍 [BULK-REPAIR-NOT-REQUIRED] Starting process...');
  console.log('   Defect IDs:', defect_ids);
  console.log('   Manager ID (provided):', manager_id);
  console.log('   Manager Name (provided):', manager_name);
  console.log('   User ID (final):', userId);
  console.log('   Manager (final):', userName);

  if (!defect_ids || !Array.isArray(defect_ids) || defect_ids.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Invalid defect IDs - array required'
    });
  }

  // ✅ Validate manager info is provided
  if (!manager_id || !manager_name) {
    return res.status(400).json({
      success: false,
      message: 'Manager ID and name are required'
    });
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Fetch all selected defects with RO link validation
    const placeholders = defect_ids.map(() => '?').join(',');
    const [defects] = await connection.query(
      `SELECT id, defect_source, motive_defect_id, merged_records_id, 
              linked_to_ro_items, related_repair_purchase_order, defect_status,
              motive_record_id, is_duplicate
       FROM vehicle_repair_logs 
       WHERE id IN (${placeholders})`,
      defect_ids
    );

    if (defects.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'No defects found'
      });
    }

    console.log('📋 [BULK-REPAIR-NOT-REQUIRED] Found', defects.length, 'defects');

    // 2. VALIDATION: Check RO links (both columns must be NULL/empty)
    const defectsWithRoLinks = defects.filter(d => 
      (d.linked_to_ro_items && typeof d.linked_to_ro_items === 'string' && d.linked_to_ro_items.trim() !== '') || 
      (d.related_repair_purchase_order !== null && d.related_repair_purchase_order !== undefined)
    );

    if (defectsWithRoLinks.length > 0) {
      await connection.rollback();
      const linkedIds = defectsWithRoLinks.map(d => d.id).join(', ');
      console.log('❌ [BULK-REPAIR-NOT-REQUIRED] Defects linked to RO:', linkedIds);
      return res.status(400).json({
        success: false,
        message: `Cannot mark as Repair Not Required. Defects linked to RO: ${linkedIds}`
      });
    }

    // 3. VALIDATION: Check Motive defects have motive_defect_id
    const motiveDefectsWithoutId = defects.filter(d => 
      d.defect_source === 'motive' && (!d.motive_defect_id || (typeof d.motive_defect_id === 'string' && d.motive_defect_id.trim() === ''))
    );

    if (motiveDefectsWithoutId.length > 0) {
      await connection.rollback();
      const invalidIds = motiveDefectsWithoutId.map(d => d.id).join(', ');
      console.log('❌ [BULK-REPAIR-NOT-REQUIRED] Motive defects missing Motive ID:', invalidIds);
      return res.status(400).json({
        success: false,
        message: `Motive defects missing Motive ID: ${invalidIds}`
      });
    }

    // 4. Collect all defects to update (including merged groups)
    const allDefectIdsToUpdate = new Set();
    const motiveDefectsToSync = [];
    const processedMergeIds = new Set(); // ✅ Track processed merge groups to avoid duplicates

    for (const defect of defects) {
      if (defect.merged_records_id) {
        // ✅ Skip if we've already processed this merge group
        if (processedMergeIds.has(defect.merged_records_id)) {
          console.log(`⏭️ [BULK-REPAIR-NOT-REQUIRED] Skipping defect ${defect.id} - merge group ${defect.merged_records_id} already processed`);
          continue;
        }
        
        // Mark this merge group as processed
        processedMergeIds.add(defect.merged_records_id);
        
        // Get all defects in the merged group
        const [mergedGroup] = await connection.query(
          `SELECT id, defect_source, motive_defect_id, is_duplicate 
           FROM vehicle_repair_logs 
           WHERE merged_records_id = ?`,
          [defect.merged_records_id]
        );
        
        // Find the primary defect (is_duplicate = 'n')
        const primaryDefect = mergedGroup.find(d => d.is_duplicate === 'n');
        
        mergedGroup.forEach(d => {
          allDefectIdsToUpdate.add(d.id);
        });
        
        // ✅ Only add PRIMARY defect for Motive sync (it will handle all defects in the group)
        if (primaryDefect && primaryDefect.defect_source === 'motive' && primaryDefect.motive_defect_id) {
          motiveDefectsToSync.push(primaryDefect.id);
          console.log(`✅ [BULK-REPAIR-NOT-REQUIRED] Added primary defect ${primaryDefect.id} from merge group ${defect.merged_records_id} for Motive sync`);
        }
      } else {
        allDefectIdsToUpdate.add(defect.id);
        if (defect.defect_source === 'motive' && defect.motive_defect_id) {
          motiveDefectsToSync.push(defect.id);
        }
      }
    }

    const finalDefectIds = Array.from(allDefectIdsToUpdate);
    console.log('📊 [BULK-REPAIR-NOT-REQUIRED] Total defects to update:', finalDefectIds.length);
    console.log('📡 [BULK-REPAIR-NOT-REQUIRED] Motive defects to sync (deduplicated):', motiveDefectsToSync.length);

    // 5. Update all defects in one query
    const updatePlaceholders = finalDefectIds.map(() => '?').join(',');
    await connection.query(
      `UPDATE vehicle_repair_logs 
       SET defect_status = 'Repair_Not_Required',
           manager_status = 'Approved',
           motive_defect_status = 'no_repair_needed',
           manager_id = ?,
           manager_name = ?,
           manager_update_date = NOW()
       WHERE id IN (${updatePlaceholders})`,
      [userId, userName, ...finalDefectIds]
    );

    await connection.commit();
    console.log('✅ [BULK-REPAIR-NOT-REQUIRED] Local database updated successfully');

    // ✅ Log the bulk repair not required action
    try {
      const finalDefectIds = Array.from(allDefectIdsToUpdate);
      if (finalDefectIds.length > 0) {
        const [defectsInfo] = await connection.query(`
          SELECT vrl.*, v.vehicle_nickname, v.vehicle_number
          FROM vehicle_repair_logs vrl
          LEFT JOIN vehicles v ON vrl.vehicle = v.id
          WHERE vrl.id IN (${finalDefectIds.map(() => '?').join(',')})
        `, finalDefectIds);

        const metadata = req.metadata || {
          ipAddress: req.ip,
          browser: req.headers['user-agent'],
          userId: userId
        };

        await logDefectsRepairNotNeeded(defectsInfo, metadata);
      }
    } catch (logError) {
      console.error('❌ Error logging bulk repair not required:', logError);
    }

    // 6. Sync with Motive API for applicable defects
    let motiveSuccessCount = 0;
    let motiveFailCount = 0;

    for (const defectId of motiveDefectsToSync) {
      try {
        console.log('🚀 [BULK-REPAIR-NOT-REQUIRED] Syncing Motive defect ID:', defectId);
        const motiveResult = await motiveDefectService.pushToMotive(defectId);
        
        if (motiveResult && motiveResult.success === 'OK') {
          motiveSuccessCount++;
          console.log('✅ [BULK-REPAIR-NOT-REQUIRED] Motive sync success for defect:', defectId);
        } else {
          motiveFailCount++;
          console.log('❌ [BULK-REPAIR-NOT-REQUIRED] Motive sync failed for defect:', defectId, motiveResult);
        }
      } catch (error) {
        motiveFailCount++;
        console.error('❌ [BULK-REPAIR-NOT-REQUIRED] Motive sync error for defect:', defectId, error);
      }
    }

    console.log('🏁 [BULK-REPAIR-NOT-REQUIRED] Completed:', {
      updated: finalDefectIds.length,
      motive_synced: motiveSuccessCount,
      motive_failed: motiveFailCount
    });

    // 7. Return response
    return res.json({
      success: true,
      message: `Successfully marked ${finalDefectIds.length} defect(s) as Repair Not Required`,
      updated_count: finalDefectIds.length,
      motive_synced: motiveSuccessCount,
      motive_failed: motiveFailCount
    });

  } catch (error) {
    await connection.rollback();
    console.error('❌ [BULK-REPAIR-NOT-REQUIRED] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during bulk update',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

/**
 * POST /api/defects/save-checked
 * Bulk update defect statuses
 * Matches PHP: save_checked action
 */
router.post('/save-checked', addMetadata, async (req, res) => {
  const { updates } = req.body;
  const userId = req.user?.id || 1;

  if (!updates || !Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Invalid data - updates array required'
    });
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const processedIds = [];

    for (const item of updates) {
      const defectId = parseInt(item.id);
      const statusDef = item.statusDef;

      if (!statusDef) {
        throw new Error(`Missing Status for ID ${defectId}`);
      }

      // Get defect details
      const [defects] = await connection.query(
        `SELECT id, merged_records_id, is_duplicate, defect_status, motive_defect_status
         FROM vehicle_repair_logs 
         WHERE id = ?`,
        [defectId]
      );

      if (defects.length === 0) {
        throw new Error(`Missing defect for ID ${defectId}`);
      }

      const defect = defects[0];

      // Determine status values
      const motiveDefectStatus = statusDef === 'Completed' 
        ? 'repaired' 
        : (statusDef === 'Repair_Not_Required' ? 'no_repair_needed' : defect.motive_defect_status);

      // Check if merged group
      let idsToUpdate = [];

      if (defect.merged_records_id && defect.is_duplicate === 'n') {
        // Primary defect → update entire group
        const [mergedGroup] = await connection.query(
          'SELECT id FROM vehicle_repair_logs WHERE merged_records_id = ?',
          [defect.merged_records_id]
        );
        idsToUpdate = mergedGroup.map(d => d.id);
      } else {
        // Standalone or secondary defect
        idsToUpdate = [defectId];
      }

      // Update all relevant defects
      const placeholders = idsToUpdate.map(() => '?').join(',');
      await connection.query(
        `UPDATE vehicle_repair_logs 
         SET last_action_on = NOW(), 
             last_action_by = ?, 
             motive_defect_status = ?, 
             defect_status = ?
         WHERE id IN (${placeholders})`,
        [userId, motiveDefectStatus, statusDef, ...idsToUpdate]
      );

      // Update RO items
      await connection.query(
        `UPDATE repair_purchase_order_repairs 
         SET rpor_status = ?
         WHERE repair_log_id IN (${placeholders})`,
        [statusDef, ...idsToUpdate]
      );

      processedIds.push(...idsToUpdate);
    }

    // ✅ Log the bulk update
    try {
      const uniqueIds = [...new Set(processedIds)];
      if (uniqueIds.length > 0 && updates.length > 0) {
        await logDefectsBulkUpdated(updates, req.metadata);
      }
    } catch (logError) {
      console.error('❌ Error logging bulk defect update:', logError);
    }

    await connection.commit();

    const uniqueIds = [...new Set(processedIds)];

    res.json({
      success: true,
      message: 'Bulk save completed',
      ids: uniqueIds
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error in save-checked:', error);
    res.status(500).json({
      success: false,
      message: `Bulk save failed: ${error.message}`,
      error: error.message
    });
  } finally {
    connection.release();
  }
});

module.exports = router;
