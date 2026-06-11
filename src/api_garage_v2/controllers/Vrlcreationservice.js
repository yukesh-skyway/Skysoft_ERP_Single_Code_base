/**
 * vrlCreationService.js
 * 
 * Service layer for creating Vehicle Repair Log (VRL) entries from Garage defects.
 * Handles new defects coming from Garage and inserts them into the vehicle_repair_logs
 * table with proper status, source tracking, duplicate validation, and bulk safety.
 * 
 * KEY MAPPINGS:
 *   - external_garage_defect_id               ← defect_id from the defects[] array (e.g. 294)
 *   - defect_status                    ← status from the defect object (dynamic, e.g. "Open", "In_Progress")
 *   - related_repair_purchase_order    ← roid from top-level Garage payload
 *   - repair_code_category             ← id from repair_code_categories WHERE repair_code_category = 'Garage'
 *   - logged_by / reported_by          ← id from users WHERE fullname = 'Garage Mechanics'
 *   - defect_source                    ← hardcoded 'garage'
 * 
 * DUPLICATE HANDLING:
 *   Before every insert, checks if external_garage_defect_id already exists in vehicle_repair_logs.
 *   If duplicate found → skips insert, returns { skipped: true } with existing VRL ID.
 * 
 * BULK SAFETY:
 *   Each defect is processed independently with its own try/catch.
 *   One defect failing does not prevent the rest from being inserted.
 */

const db = require('../../api/db/connection');
// ✅ CORRECT PATH
const auditLogService = require('../../api/services/vehicle_maintenance/auditLogService');
const garageWebhookService = require('../../api/services/vehicle_maintenance/garageWebhookService');
const vrlCreationLogger = require('../utils/vrlCreationLogger');
const { formatUtcToMysql } = require('../utils/reuseUtils');


function stripEmojis(str) {
  if (!str) return str;
  return str.replace(/[\u{1F000}-\u{1FFFF}|\u{2600}-\u{26FF}|\u{2700}-\u{27BF}|\u{FE00}-\u{FEFF}|\u{1F300}-\u{1F9FF}]/gu, '').trim();
}

// ════════════════════════════════════════════════════════════════
// CACHED STATIC LOOKUPS
// Resolved once on first use, reused for all subsequent calls.
// ════════════════════════════════════════════════════════════════

let _cachedGarageUserId = null;
let _cachedGarageCategoryId = null;

/**
 * Get the user ID for 'Garage Mechanics' from the users table.
 * Cached after first lookup.
 * 
 * Query: SELECT id FROM users WHERE fullname = 'Garage Mechanics'
 * 
 * @returns {Promise<number>} - User ID
 * @throws {Error} - If no matching user found
 */
async function getGarageMechanicsUserId() {
  if (_cachedGarageUserId !== null) return _cachedGarageUserId;

  try {
    const [rows] = await db.query(
      `SELECT id FROM users WHERE fullname = 'Garage Mechanics' LIMIT 1`
    );

    if (!rows || rows.length === 0) {
      throw new Error("Lookup failed: no user found with fullname = 'Garage Mechanics'");
    }

    _cachedGarageUserId = rows[0].id;
    console.log(`🔧 Cached Garage Mechanics user ID: ${_cachedGarageUserId}`);
    return _cachedGarageUserId;
  } catch (error) {
    console.error('❌ Error in getGarageMechanicsUserId():', error.message);
    throw error;
  }
}

/**
 * Get the repair_code_category ID for 'Garage' from the repair_code_categories table.
 * Cached after first lookup.
 * 
 * Query: SELECT id FROM repair_code_categories WHERE repair_code_category = 'Garage'
 * 
 * @returns {Promise<number>} - Category ID
 * @throws {Error} - If no matching category found
 */
async function getGarageCategoryId() {
  if (_cachedGarageCategoryId !== null) return _cachedGarageCategoryId;

  try {
    const [rows] = await db.query(
      `SELECT id FROM repair_code_categories WHERE repair_code_category = 'Garage' LIMIT 1`
    );

    if (!rows || rows.length === 0) {
      throw new Error("Lookup failed: no record in repair_code_categories WHERE repair_code_category = 'Garage'");
    }

    _cachedGarageCategoryId = rows[0].id;
    console.log(`🔧 Cached Garage category ID: ${_cachedGarageCategoryId}`);
    return _cachedGarageCategoryId;
  } catch (error) {
    console.error('❌ Error in getGarageCategoryId():', error.message);
    throw error;
  }
}

/**
 * Check if a VRL already exists for the given external_garage_defect_id.
 * Used to prevent duplicate inserts when Garage sends the same defect again.
 * 
 * @param {number|string} externalDefectId - The Garage defect_id
 * @returns {Promise<Object|null>} - Existing VRL record or null
 */
async function checkDuplicateVRL(externalDefectId) {
  try {
    const [rows] = await db.query(
      `SELECT id, vehicle, defect_status FROM vehicle_repair_logs WHERE external_garage_defect_id = ? LIMIT 1`,
      [externalDefectId]
    );
    return rows?.[0] || null;
  } catch (error) {
    console.error('❌ Error in checkDuplicateVRL():', error.message);
    throw error;
  }
}

/**
 * Create a new Vehicle Repair Log entry from a Garage defect
 * 
 * WHEN TO USE THIS:
 * - Defect comes from the defects[] array inside the Garage payload
 * - external_garage_defect_id is mapped from the defect's defect_id (e.g. 294)
 * - defect_status is taken directly from the defect's status field (e.g. "Open", "In_Progress")
 * 
 * DUPLICATE GUARD:
 * - Before inserting, checks if external_garage_defect_id already exists in VRL
 * - If duplicate found → returns { skipped: true } with existing record info
 * 
 * @param {Object} garageDefect - A single defect object from defects[] array in the payload
 * @param {number} ro_id - Repair Order ID (from top-level roid in payload)
 * @param {number} vehicle_id - Vehicle ID from the defect or RO context
 * @param {Object} req - Express request object (for metadata)
 * @returns {Promise<Object>} - Created VRL record or skip result
 * @throws {Error} - Validation or database errors
 */
async function createVRLFromGarageDefect(garageDefect, ro_id, vehicle_id, req) {
  const startTime = Date.now();

  try {
    // ════════════════════════════════════════════════════════════════
    // STEP 1: VALIDATE INPUT
    // ════════════════════════════════════════════════════════════════

    if (!garageDefect || typeof garageDefect !== 'object') {
      throw new Error('Invalid defect object provided');
    }

    // ════════════════════════════════════════════════════════════════
    // RESOLVE VEHICLE ID: Either use provided vehicle_id OR lookup by unit_number
    // ════════════════════════════════════════════════════════════════
    
    let actualVehicleId = vehicle_id;
    
    if (!actualVehicleId) {
      // Try to extract unit_number from nested work_orders structure
      const unitNumber = garageDefect.unit_number || 
                         garageDefect.work_orders?.vehicles?.unit_number;
      
      if (unitNumber) {
        console.log(`🔍 Looking up vehicle by unit_number: ${unitNumber}`);
        const [vehicleRows] = await db.query(
          `SELECT id FROM vehicles WHERE vehicle_nickname = ? LIMIT 1`,
          [unitNumber]
        );
        
        if (vehicleRows && vehicleRows.length > 0) {
          actualVehicleId = vehicleRows[0].id;
          console.log(`✅ Found vehicle ID: ${actualVehicleId} for unit_number: ${unitNumber}`);
        } else {
          throw new Error(`Vehicle not found with unit_number: ${unitNumber}. Ensure the vehicle exists in the database with vehicle_nickname = "${unitNumber}".`);
        }
      } else {
        throw new Error('vehicle_id is required to create VRL. Could not resolve vehicle from payload.');
      }
    }

    // external_garage_defect_id comes from the defect's own defect_id (e.g. 294),
    // NOT from defect.external_garage_defect_id (which may be null for Garage-originated defects)
const externalDefectId = garageDefect.defect_id || garageDefect.garage_finding_id || null;

if (!externalDefectId) {
  throw new Error('defect_id or garage_finding_id is required to map as external_garage_defect_id');
}
    // defect_status is dynamic — taken from the defect's status field
   const defectStatus = garageDefect.garage_finding_id 
  ? 'In_Progress' 
  : (garageDefect.status || 'Open');;

    console.log(`\n📋 [VRL CREATE] Starting VRL creation for defect_id=${externalDefectId}, status=${defectStatus}, vehicle=${actualVehicleId}, ro=${ro_id}`);

    // ════════════════════════════════════════════════════════════════
    // STEP 2: DUPLICATE CHECK
    // ════════════════════════════════════════════════════════════════

    const existingVRL = await checkDuplicateVRL(externalDefectId);

    if (existingVRL) {
      console.log(
        `⏭️  VRL already exists for external_garage_defect_id ${externalDefectId} → ` +
        `VRL ID ${existingVRL.id} (status: ${existingVRL.defect_status}). Skipping insert.`
      );

      return {
        skipped: true,
        reason: 'duplicate',
        existing_vrl_id: existingVRL.id,
        existing_status: existingVRL.defect_status,
        external_garage_defect_id: externalDefectId,
        vehicle: actualVehicleId,
        ro_id: ro_id,
        duration_ms: Date.now() - startTime
      };
    }

    console.log(`✅ No duplicate found for defect_id=${externalDefectId}`);

    // ════════════════════════════════════════════════════════════════
    // STEP 3: RESOLVE STATIC LOOKUPS
    // ════════════════════════════════════════════════════════════════

    // Both cached after first call — no repeated DB hits
    const garageUserId = await getGarageMechanicsUserId();
    const garageCategoryId = await getGarageCategoryId();

    console.log(`🔧 Resolved: garageUserId=${garageUserId}, garageCategoryId=${garageCategoryId}`);

    // ════════════════════════════════════════════════════════════════
    // STEP 4: BUILD VRL RECORD
    // ════════════════════════════════════════════════════════════════

    const now = formatUtcToMysql();

    const vrlRecord = {
      vehicle: actualVehicleId,  // ✅ Use 'vehicle' column name, not 'vehicle_id'
      ro_id: ro_id || null,

      // Defect identification — defect_id from defects[] array
      external_garage_defect_id: externalDefectId,

      // Source — always 'garage' for Garage-originated defects
      defect_source: 'garage',

      // Status — dynamic from the defect's own status (e.g. "Open", "In_Progress")
      defect_status: defectStatus,

      // Map roid → related_repair_purchase_order
      related_repair_purchase_order: ro_id || null,

      // Category — static: repair_code_categories WHERE repair_code_category = 'Garage'
      repair_code_category: garageCategoryId,

      // User attribution — static: users WHERE fullname = 'Garage Mechanics'
      logged_by: garageUserId,
      reported_by: garageUserId,

      // Notes — mapped from the defect's description field
      notes: stripEmojis(garageDefect.description || ''),

      // Timestamp fields
      logged_on: now,
      issue_date: now,
      repair_desc: stripEmojis(garageDefect.name || garageDefect.description || 'Garage Defect'),
      linked_to_roid: ro_id || null
    };

    console.log(`📝 VRL Record built:`, JSON.stringify(vrlRecord, null, 2));

    // ════════════════════════════════════════════════════════════════
    // STEP 5: INSERT INTO DATABASE
    // ════════════════════════════════════════════════════════════════

    const query = `
      INSERT INTO vehicle_repair_logs (
        vehicle,
        external_garage_defect_id,
        defect_source,
        defect_status,
        related_repair_purchase_order,
        repair_code_category,
        logged_by,
        reported_by,
        notes,
        repair_desc,
        linked_to_roid,
        logged_on,
        issue_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    console.log(`🔄 Executing INSERT query for vehicle=${actualVehicleId}...`);

    const [result] = await db.query(
      query,
      [
        vrlRecord.vehicle,
        vrlRecord.external_garage_defect_id,
        vrlRecord.defect_source,
        vrlRecord.defect_status,
        vrlRecord.related_repair_purchase_order,
        vrlRecord.repair_code_category,
        vrlRecord.logged_by,
        vrlRecord.reported_by,
        vrlRecord.notes,
        vrlRecord.repair_desc,
        vrlRecord.linked_to_roid,
        vrlRecord.logged_on,
        vrlRecord.issue_date
      ]
    );

    if (!result || !result.insertId) {
      throw new Error('Failed to insert VRL record - no insertId returned');
    }

    const vrlId = result.insertId;
    console.log(`✅ VRL inserted with ID: ${vrlId}`);
      // ════════════════════════════════════════════════════════════════
    // STEP 5B: INSERT INTO repair_purchase_order_repairs
    // ════════════════════════════════════════════════════════════════

    console.log(`🔄 Inserting RPOR record for VRL ${vrlId}...`);

const rporQuery = `
  INSERT INTO repair_purchase_order_repairs (
    repair_purchase_order,
    repair_log_id,
    item_type,
    repair_notes,
    work_order_number,
    rpor_status
  ) VALUES (?, ?, ?, ?, ?, ?)
`;
const [rporResult] = await db.query(
  rporQuery,
  [
    ro_id,
    vrlId,
    'REPAIR',
    vrlRecord.notes,
    garageDefect.work_order_number || null,
    defectStatus
  ]
);
    if (!rporResult || !rporResult.insertId) {
      throw new Error('Failed to insert RPOR record - no insertId returned');
    }

    const rporId = rporResult.insertId;
    console.log(`✅ RPOR record inserted with ID: ${rporId}`);

    // ════════════════════════════════════════════════════════════════
    // STEP 5C: UPDATE VRL.linked_to_ro_item with newly created RPOR ID
    // ════════════════════════════════════════════════════════════════

    console.log(`🔄 Updating VRL ${vrlId} linked_to_ro_item = ${rporId}...`);

    await db.query(
      `UPDATE vehicle_repair_logs SET linked_to_ro_items = ? WHERE id = ?`,
      [rporId, vrlId]
    );

    console.log(`✅ VRL linked_to_ro_item updated to ${rporId}`);



    // ════════════════════════════════════════════════════════════════
// STEP 5D: INSERT repair_items + mechanic_assignments if present
// ════════════════════════════════════════════════════════════════

const repairItemsPayload = garageDefect.repair_items_payload || [];

if (repairItemsPayload.length > 0) {
  for (const item of repairItemsPayload) {
    try {
      const garageRepairId     = item.repair_item_id || item.work_order_repair_item_id || 0;
      const repairItemDetails  = item.repair_items || {};
     const name        = stripEmojis(item.repair_name || repairItemDetails.name || 'Repair Item');
const description = stripEmojis(repairItemDetails.description || item.description || '');
      const estimatedHours     = repairItemDetails.estimated_hours || item.estimated_hours || 0;
      const laborCost          = repairItemDetails.labor_cost || item.labor_cost || 0;
      const totalEstimatedCost = repairItemDetails.total_estimated_cost || item.total_estimated_cost || 0;
      const status             = item.status || 'Pending';
      const defectStatusRI     = item.defect_status || defectStatus;

      // Check if repair item already exists
      const [existingRI] = await db.query(
        'SELECT id FROM repair_items WHERE garage_repair_id = ? AND ro_repair_or_sm_id = ? LIMIT 1',
        [garageRepairId, rporId]
      );

      let repairItemId = null;

      if (existingRI && existingRI.length > 0) {
        repairItemId = existingRI[0].id;
        await db.query(
          `UPDATE repair_items SET name=?, description=?, estimated_hours=?, labor_cost=?,
           total_estimated_cost=?, status=?, defect_status=? WHERE id=?`,
          [name, description, estimatedHours, laborCost, totalEstimatedCost, status, defectStatusRI, repairItemId]
        );
      } else {
const [riInsert] = await db.query(
  `INSERT INTO repair_items 
   (garage_repair_id, ro_repair_or_sm_id, name, description, estimated_hours,
    labor_cost, total_estimated_cost, total_actual_hours, status, defect_status,
    required_parts, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
  [garageRepairId, rporId, name, description, estimatedHours,
   laborCost, totalEstimatedCost, 0, status, defectStatusRI, '']
);
        repairItemId = riInsert.insertId;
      }

      // ── mechanic_assignments ──────────────────────────────────
      const mechanics = item.mechanic_assignments || [];
      for (const assignment of mechanics) {
        const garageAssignmentId = assignment.assignment_id || null;
        if (!garageAssignmentId) continue;

        const [existingMA] = await db.query(
          'SELECT id FROM mechanic_assignments WHERE repair_item_id = ? AND garage_assignment_id = ? LIMIT 1',
          [repairItemId, garageAssignmentId]
        );

        const maData = [
          assignment.mechanic_id    || null,
          assignment.mechanic_name  || null,
          assignment.bay_number     || null,
          assignment.status         || 'Scheduled',
          assignment.approval_status || 'Not_Submitted',
(assignment.start_datetime || assignment.scheduled_start)
  ? formatUtcToMysql(assignment.start_datetime || assignment.scheduled_start) : null,
(assignment.end_datetime || assignment.scheduled_end)
  ? formatUtcToMysql(assignment.end_datetime || assignment.scheduled_end) : null,
          assignment.actual_start_datetime
            ? formatUtcToMysql(assignment.actual_start_datetime) : null,
          assignment.actual_end_datetime
            ? formatUtcToMysql(assignment.actual_end_datetime) : null,
          assignment.mechanic_challenge_notes || null,
          assignment.invoice_notes            || null,
          assignment.invoice_hours            || 0,
          assignment.actual_hours             || 0,
          assignment.duration                 || 0
        ];

        if (existingMA && existingMA.length > 0) {
          await db.query(
            `UPDATE mechanic_assignments SET
               garage_mechanic_id=?, mechanic_name=?, bay_number=?, status=?,
               approval_status=?, scheduled_start=?, scheduled_end=?,
               actual_start_datetime=?, actual_end_datetime=?,
               mechanic_challenge_notes=?, invoice_notes=?,
               invoice_hours=?, actual_hours=?, duration=?
             WHERE id=?`,
            [...maData, existingMA[0].id]
          );
        } else {
await db.query(
  `INSERT INTO mechanic_assignments
   (repair_item_id, garage_assignment_id, garage_mechanic_id,
    mechanic_name, bay_number, status, approval_status,
    approved_by, approved_at,
    scheduled_start, scheduled_end, actual_start_datetime, actual_end_datetime,
    mechanic_challenge_notes, invoice_notes, invoice_hours, actual_hours,
    duration, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
  [
    repairItemId, garageAssignmentId, assignment.mechanic_id || null,
    assignment.mechanic_name || null, assignment.bay_number || null,
    assignment.status || 'Scheduled', assignment.approval_status || 'Not_Submitted',
    null, null,  // approved_by, approved_at
    assignment.start_datetime ? formatUtcToMysql(assignment.start_datetime) : null,
    assignment.end_datetime ? formatUtcToMysql(assignment.end_datetime) : null,
    assignment.actual_start_datetime ? formatUtcToMysql(assignment.actual_start_datetime) : null,
    assignment.actual_end_datetime ? formatUtcToMysql(assignment.actual_end_datetime) : null,
    assignment.mechanic_challenge_notes || null,
    assignment.invoice_notes || null,
    assignment.invoice_hours || 0,
    assignment.actual_hours || 0,
    assignment.duration || 0
  ]
);
        }
      }

    } catch (riError) {
      console.warn(`⚠️ repair_item insert failed (non-critical): ${riError.message}`);
    }
  }
}
// ════════════════════════════════════════════════════════════════
    // TRIGGER GARAGE WEBHOOK (skysoft_defect.created)
    // ════════════════════════════════════════════════════════════════

    console.log(`📨 Triggering skysoft_defect.created webhook...`);

    try {
      const webhookPayload = {
        skysoft_defect_id: vrlId,
        external_garage_defect_id: externalDefectId,
        roid: ro_id,
        rpor_id: rporId,
        status: 0
      };

      const webhookResult = await garageWebhookService.notifyDefectCreated(
        vrlId,
        externalDefectId,
        ro_id,
        rporId,
        garageUserId
      );

      if (webhookResult.success) {
        console.log(`✅ Webhook notification sent successfully`);
      } else {
        console.warn(`⚠️  Webhook notification failed (non-critical):`, webhookResult.error);
      }

      // Log webhook to file and DB
      await vrlCreationLogger.logWebhookNotification(
        webhookPayload,
        webhookResult,
        ro_id,
        garageUserId
      );
    } catch (webhookError) {
      console.warn(`⚠️  Webhook error (non-critical):`, webhookError.message);
      await vrlCreationLogger.logVRLError(
        garageDefect,
        ro_id,
        garageUserId,
        webhookError,
        Date.now() - startTime
      );
    }
    // ════════════════════════════════════════════════════════════════
    // STEP 6: LOG THE CREATION (audit / user_activity)
    // ════════════════════════════════════════════════════════════════

    console.log(`🔔 Logging VRL creation to auditLogService...`);

    try {
      await auditLogService.logVRLCreated(
        vrlId,
        vehicle_id,
        ro_id,
        externalDefectId,
        'garage',
        null,         // no defect_title
        req,
        garageUserId  // Garage Mechanics user ID for user_activity table
      );
      console.log(`✅ Audit log recorded`);
    } catch (auditError) {
      console.warn(`⚠️  Audit log failed (non-critical):`, auditError.message);
      // Don't throw — audit failure should not fail the VRL creation
    }

    // ════════════════════════════════════════════════════════════════
    // STEP 7: RETURN SUCCESS
    // ════════════════════════════════════════════════════════════════

  // ════════════════════════════════════════════════════════════════
    // LOG SUCCESS TO FILE AND DB
    // ════════════════════════════════════════════════════════════════

    const successResult = {
      success: true,
      vrl_id: vrlId,
      vehicle: actualVehicleId,
      ro_id: ro_id,
      external_garage_defect_id: externalDefectId,
      defect_source: 'garage',
      defect_status: defectStatus,
      repair_code_category: garageCategoryId,
      logged_by: garageUserId,
      reported_by: garageUserId,
      logged_on: vrlRecord.logged_on,
      issue_date: vrlRecord.issue_date,
      duration_ms: Date.now() - startTime
    };

    await vrlCreationLogger.logVRLCreated(
      successResult,
      null,  // webhookResult already logged separately
      ro_id,
      garageUserId,
      Date.now() - startTime
    );

    console.log(
      `✅ VRL created COMPLETE: ID ${vrlId} | Vehicle ${actualVehicleId} | ` +
      `RO ${ro_id} | Defect ${externalDefectId} | ` +
      `Status ${defectStatus} | Category ${garageCategoryId} | User ${garageUserId}`
    );

    return successResult;

    

  } catch (error) {
    console.error(`\n❌ VRL Creation FAILED (defect_id: ${garageDefect?.defect_id}):`, error.message);
    console.error(`Stack:`, error.stack);

    if (req) {
      try {
        const userId = _cachedGarageUserId || null;
        await auditLogService.logVRLCreationError(
          vehicle_id,
          ro_id,
          garageDefect?.defect_id,
          error.message,
          req,
          userId  // Garage Mechanics user ID for user_activity table
        );
      } catch (auditError) {
        console.warn(`⚠️  Error audit log failed:`, auditError.message);
      }
    }

    throw error;
  }
}

/**
 * Batch create multiple VRL records from Garage defects
 * 
 * USE THIS when:
 * - Processing the defects[] array from a Garage payload
 * - A single payload may contain multiple defects, some new, some already existing
 * 
 * SAFETY:
 * - Each defect is processed independently with its own try/catch
 * - One defect failing (validation, DB error) does NOT prevent the rest from inserting
 * - Duplicates are detected per-defect and reported as "skipped" (not errors)
 * 
 * @param {Array} garageDefects - Array of defect objects from defects[] in payload
 * @param {number} ro_id - Repair Order ID (top-level roid)
 * @param {number} vehicle_id - Vehicle ID
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Summary of created, skipped, and failed VRLs
 */
async function createMultipleVRLsFromGarageDefects(garageDefects, ro_id, vehicle_id, req) {
  const results = {
    created: [],
    skipped: [],
    failed: [],
    summary: {
      total: garageDefects.length,
      succeeded: 0,
      skipped: 0,
      failed: 0,
      duration_ms: 0
    }
  };

  const startTime = Date.now();

  for (const defect of garageDefects) {
    try {
      const result = await createVRLFromGarageDefect(defect, ro_id, vehicle_id, req);

      if (result.skipped) {
        // Duplicate — already exists in VRL
        results.skipped.push(result);
        results.summary.skipped++;
      } else {
        // Successfully inserted
        results.created.push(result);
        results.summary.succeeded++;
      }
    } catch (error) {
      // Failed — validation or DB error for this specific defect
      results.failed.push({
        defect_id: defect.defect_id,
        error: error.message
      });
      results.summary.failed++;
    }
  }

  results.summary.duration_ms = Date.now() - startTime;

  console.log(
    `\n📊 Batch VRL Creation COMPLETE: ${results.summary.succeeded} created, ` +
    `${results.summary.skipped} skipped (duplicates), ` +
    `${results.summary.failed} failed`
  );

  return results;
}

/**
 * Get an existing VRL by external Garage defect ID
 * 
 * @param {number|string} externalDefectId - Garage defect_id
 * @returns {Promise<Object|null>} - VRL record or null if not found
 */
async function getVRLByExternalDefectId(externalDefectId) {
  try {
    const [rows] = await db.query(
      `SELECT * FROM vehicle_repair_logs WHERE external_garage_defect_id = ?`,
      [externalDefectId]
    );
    return rows?.[0] || null;
  } catch (error) {
    console.error('❌ Error in getVRLByExternalDefectId():', error.message);
    throw error;
  }
}

// ════════════════════════════════════════════════════════════════
// EXPORTS
// ════════════════════════════════════════════════════════════════

module.exports = {
  createVRLFromGarageDefect,
  createMultipleVRLsFromGarageDefects,
  getVRLByExternalDefectId,
  checkDuplicateVRL,
  getGarageMechanicsUserId,
  getGarageCategoryId
};
