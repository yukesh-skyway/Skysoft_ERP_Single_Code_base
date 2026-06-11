/**
 * Defect Service
 * Business logic for vehicle repair defects with last completed repair details
 * MATCHES PHP: create-repair-purchase-order.php getVehicleRepairs() logic
 */

const db = require('../../db/connection');

/**
 * Get all defects for a vehicle with last completed repair details
 * EXACTLY MATCHES PHP getVehicleRepairs() logic:
 * - Status: 'Open', 'Reopened', 'RO_Cancelled'
 * - Excludes defects already linked to RO: linked_to_roid IS NULL
 * - Excludes defects with related_repair_purchase_order
 * - Excludes duplicates: (is_duplicate = 'n' OR is_duplicate IS NULL)
 * - Special handling for preselected defects (txtDefects parameter)
 * - NEW: Optional defect_source filtering
 * 
 * @param {number} vehicleId - Vehicle ID
 * @param {object} options - Query options
 * @param {string} options.txtDefects - Comma-separated defect IDs to preselect
 * @param {number} options.ro_id - Repair Order ID (for edit mode - NOT USED in create mode)
 * @param {string} options.source_filter - Filter by defect_source ('maintenance', 'exclude_maintenance', or null for all)
 * @returns {Promise<Array>} Array of defects with last completed details
 */
async function getDefectsWithLastCompleted(vehicleId, options = {}) {
  try {
    const { txtDefects, ro_id, source_filter } = options;

    // Build preselected defects clause (matches PHP logic)
    let preselectedClause = '';
    const params = [vehicleId];
    
    if (txtDefects && txtDefects.trim() !== '') {
      // Allow preselected defects to show even if RO_Cancelled
      preselectedClause = ` OR (vrl.id IN (${txtDefects}) AND vrl.defect_status IN ('Open','Reopened','RO_Cancelled'))`;
    }

    // Build defect_source filter clause
    let sourceFilterClause = '';
    if (source_filter === 'maintenance') {
      sourceFilterClause = " AND vrl.defect_source = 'maintenance'";
    } else if (source_filter === 'exclude_maintenance') {
      sourceFilterClause = " AND (vrl.defect_source != 'maintenance' OR vrl.defect_source IS NULL)";
    }

    // ⭐ Build RO filter clause for EDIT mode
    // In EDIT mode, also include defects already linked to THIS specific RO
    // CRITICAL: source_filter must be applied to BOTH unlinked AND linked defects
    let roFilterClause = `AND vrl.linked_to_roid IS NULL AND (vrl.related_repair_purchase_order IS NULL OR vrl.related_repair_purchase_order = 0)${sourceFilterClause}`;
    let rpor_join = '';
    let rpor_select = 'NULL as rpor_status, NULL as repair_purchase_order';
    
    if (ro_id) {
      // In EDIT mode: Show defects NOT in any RO OR defects in THIS specific RO
      // ⭐ CRITICAL: Apply source_filter to BOTH conditions to prevent maintenance defects in Section 1
      roFilterClause = `AND (
        (vrl.linked_to_roid IS NULL AND (vrl.related_repair_purchase_order IS NULL OR vrl.related_repair_purchase_order = 0)${sourceFilterClause})
        OR (vrl.linked_to_roid = ${ro_id}${sourceFilterClause})
      )`;
      
      // Add LEFT JOIN to get rpor_status for defects in THIS RO
      rpor_join = `LEFT JOIN repair_purchase_order_repairs rpor 
        ON rpor.repair_log_id = vrl.id 
        AND rpor.repair_purchase_order = ${ro_id} 
        AND rpor.item_type = 'REPAIR'`;
      
      // Select rpor fields
      rpor_select = 'rpor.rpor_status, rpor.repair_purchase_order';
    }

    // SQL Query - EXACTLY matches PHP create-repair-purchase-order.php
    const query = `
      SELECT 
        vrl.id,
        vrl.id as vrlid,
        vrl.repair_code_category,
        rcc.repair_code_category as repair_code_category_name,
        vrl.repair_desc,
        vrl.issue_type,
        vrl.defect_source,
        vrl.defect_status,
        vrl.notes,
        vrl.is_duplicate,
        vrl.merged_records_id,
        vrl.motive_def_unique_id,
        vrl.logged_on,
        vrl.linked_to_roid as ro_id,
        vrl.previous_ro_id,    vrl.disengage_reason,
    vrl.disengage_notes,
    vrl.disengaged_at,
        
        -- ⭐ NEW: Get rpor_status for defects already in THIS RO (EDIT mode only)
        ${rpor_select},
        
        -- Get the most recent completed repair mechanic notes for this category on this vehicle
        (
          SELECT mechanic_notes
          FROM vehicle_repair_logs vrl_last
          WHERE vrl_last.repair_code_category = vrl.repair_code_category
            AND vrl_last.vehicle = vrl.vehicle
            AND vrl_last.defect_status = 'Completed'
            AND vrl_last.mechanic_notes IS NOT NULL
            AND vrl_last.mechanic_notes != ''
          ORDER BY vrl_last.repair_completion_date DESC
          LIMIT 1
        ) as last_mechanic_notes,
        
        -- Get the most recent completed repair date for this category on this vehicle
        (
          SELECT repair_completion_date
          FROM vehicle_repair_logs vrl_last
          WHERE vrl_last.repair_code_category = vrl.repair_code_category
            AND vrl_last.vehicle = vrl.vehicle
            AND vrl_last.defect_status = 'Completed'
            AND vrl_last.mechanic_notes IS NOT NULL
            AND vrl_last.mechanic_notes != ''
          ORDER BY vrl_last.repair_completion_date DESC
          LIMIT 1
        ) as last_completion_date,
        
        -- Get the most recent completed repair mechanic name (stored directly in mechanic field)
        (
          SELECT mechanic
          FROM vehicle_repair_logs vrl_last
          WHERE vrl_last.repair_code_category = vrl.repair_code_category
            AND vrl_last.vehicle = vrl.vehicle
            AND vrl_last.defect_status = 'Completed'
            AND vrl_last.mechanic_notes IS NOT NULL
            AND vrl_last.mechanic_notes != ''
          ORDER BY vrl_last.repair_completion_date DESC
          LIMIT 1
        ) as last_mechanic_name,
        
        -- Count merged defects (using merged_records_id as the primary reference)
        (
          SELECT COUNT(*) 
          FROM vehicle_repair_logs vrl_merged 
          WHERE vrl_merged.merged_records_id = vrl.merged_records_id 
          AND vrl_merged.is_duplicate = 'y'
          AND vrl.merged_records_id IS NOT NULL
        ) as merged_count,
        
        -- Get primary defect ID for secondary (duplicate) defects
        CASE 
          WHEN vrl.is_duplicate = 'y' AND vrl.merged_records_id IS NOT NULL THEN
            (SELECT id FROM vehicle_repair_logs vrl2 
             WHERE vrl2.merged_records_id = vrl.merged_records_id 
             AND vrl2.is_duplicate = 'n' 
             LIMIT 1)
          ELSE NULL
        END as primary_defect_id
        
      FROM vehicle_repair_logs vrl
      LEFT JOIN repair_code_categories rcc ON rcc.id = vrl.repair_code_category
      LEFT JOIN (
        SELECT 
          merged_records_id,
          COUNT(*) as merged_count
        FROM vehicle_repair_logs 
        WHERE is_duplicate = 'y'
        GROUP BY merged_records_id
      ) merge_counts ON merge_counts.merged_records_id = vrl.merged_records_id
      ${rpor_join}
      
      WHERE vrl.vehicle = ?
        AND (vrl.defect_status IN ('Open','Reopened','RO_Cancelled')${preselectedClause})
        AND (vrl.is_duplicate = 'n' OR vrl.is_duplicate IS NULL)
        ${roFilterClause}
      
      ORDER BY rcc.repair_code_category ASC
    `;

    console.log('🔍 Fetching defects for vehicle:', vehicleId, {
      txtDefects,
      ro_id,
      source_filter,
      hasPreselected: !!preselectedClause
    });

    // Execute query using existing db connection
    const [rows] = await db.execute(query, params);

    // Format dates to YYYY-MM-DD
    const defects = rows.map(defect => {
      if (defect.last_completion_date) {
        const date = new Date(defect.last_completion_date);
        defect.last_completion_date = date.toISOString().split('T')[0];
      }
      
      // Trim mechanic name if it exists
      if (defect.last_mechanic_name) {
        defect.last_mechanic_name = defect.last_mechanic_name.trim();
      }
      
      return defect;
    });

    console.log(`✅ Found ${defects.length} defects (matching PHP logic)`);

    return defects;

  } catch (error) {
    console.error('Error in getDefectsWithLastCompleted:', error);
    throw error;
  }
}

/**
 * Get last completed repair details for a specific category on a vehicle
 * 
 * @param {number} vehicleId - Vehicle ID
 * @param {string} repairCategory - Repair code category
 * @returns {Promise<object|null>} Last completed repair details or null
 */
async function getLastCompletedRepair(vehicleId, repairCategory) {
  try {
    const query = `
      SELECT 
        vrl.mechanic_notes as last_mechanic_notes,
        vrl.repair_completion_date as last_completion_date,
        vrl.mechanic as last_mechanic_name
      FROM vehicle_repair_logs vrl
      WHERE vrl.vehicle = ?
        AND vrl.repair_code_category = ?
        AND vrl.defect_status = 'Completed'
        AND vrl.mechanic_notes IS NOT NULL
        AND vrl.mechanic_notes != ''
      ORDER BY vrl.repair_completion_date DESC
      LIMIT 1
    `;

    const [rows] = await db.execute(query, [vehicleId, repairCategory]);

    if (rows.length === 0) {
      return null;
    }

    const result = rows[0];
    
    // Format date
    if (result.last_completion_date) {
      result.last_completion_date = new Date(result.last_completion_date)
        .toISOString()
        .split('T')[0];
    }
    
    // Trim mechanic name
    if (result.last_mechanic_name) {
      result.last_mechanic_name = result.last_mechanic_name.trim();
    }

    return result;

  } catch (error) {
    console.error('Error in getLastCompletedRepair:', error);
    throw error;
  }
}

module.exports = {
  getDefectsWithLastCompleted,
  getLastCompletedRepair
};
