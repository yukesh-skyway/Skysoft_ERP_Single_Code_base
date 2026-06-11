/**
 * Event Handler: Mechanic_Assignment_Added / Mechanic_Assignment_Removed
 *
 * Triggered by:
 *   POST /updateVehicleDefect_v2
 *   event_type = 'Mechanic_Assignment_Added' | 'Mechanic_Assignment_Removed'
 *
 * Logic:
 *   For each repair_item in payload:
 *     1. Get roRepairOrSmId from repair_purchase_order_repairs (defect_id first, sm_id fallback)
 *     2. Lookup our internal repair_items.id via garage_repair_id + ro_repair_or_sm_id
 *
 *   Mechanic_Assignment_Added:
 *     3. Get existing garage_assignment_ids from DB
 *     4. Delete assignments NOT present in incoming payload
 *     5. Upsert each incoming assignment by garage_assignment_id
 *
 *   Mechanic_Assignment_Removed:
 *     3. Delete EXACTLY the assignments in the incoming payload by garage_assignment_id
 */

const db = require('../../db/connection');
const { formatUtcToMysql } = require('../../utils/reuseUtils');
const { logWebhookActivity } = require('../../utils/webhookLogger');

module.exports = async function handleMechanicAssignment(req, res) {
  const userId      = req.apiToken.userId;
  const payload     = req.body;

  const roId        = payload.roid         || null;
  const eventType   = payload.event_type   || null;
  const repairItems = payload.repair_items || [];

  // ── Basic validation ──────────────────────────────────────────────────────
  if (!roId) {
    return res.status(400).json({ success: false, status: 'NOOK', error: 'Missing roid' });
  }

  if (!repairItems.length) {
    return res.status(400).json({ success: false, status: 'NOOK', error: 'Missing repair_items' });
  }

  // ── Check RO exists ───────────────────────────────────────────────────────
  const [roResults] = await db.query(
    'SELECT id FROM repair_purchase_orders WHERE id = ?',
    [roId]
  );

  if (!roResults || roResults.length === 0) {
    await db.query(
      `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
      [roId, userId, `Mechanic Assignment Event [${eventType}] - RO not found for roid: ${roId}`]
    );
    return res.status(404).json({ success: false, status: 'NOOK', error: `RO not found: ${roId}` });
  }

  const results = [];
  const errors  = [];

  try {
    for (const item of repairItems) {
      const garageRepairId = item.repair_item_id || null;
      const defectId       = item.defect_id      || null;
      const smId           = item.sm_id          || null;

      if (!garageRepairId) {
        errors.push(`Skipping repair item — missing repair_item_id`);
        continue;
      }

      // ── Step 1: Get roRepairOrSmId ────────────────────────────────────────
      let roRepairOrSmId = null;

      if (defectId) {
        const [r] = await db.query(
          `SELECT id FROM repair_purchase_order_repairs 
           WHERE repair_purchase_order = ? AND repair_log_id = ? LIMIT 1`,
          [roId, defectId]
        );
        if (r && r.length > 0) roRepairOrSmId = r[0].id;
      } else if (smId) {
        const [r] = await db.query(
          `SELECT id FROM repair_purchase_order_repairs 
           WHERE repair_purchase_order = ? AND scheduled_maintenance_setting_id = ? LIMIT 1`,
          [roId, smId]
        );
        if (r && r.length > 0) roRepairOrSmId = r[0].id;
      }

      if (!roRepairOrSmId) {
        const msg = `rpor record not found for defect_id=${defectId} sm_id=${smId} roid=${roId}`;
        errors.push(msg);
        await db.query(
          `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
          [roId, userId, `Mechanic Assignment Event [${eventType}] - ${msg}`]
        );
        continue;
      }

      // ── Step 2: Lookup internal repair_items.id ───────────────────────────
      const [riRows] = await db.query(
        `SELECT id FROM repair_items 
         WHERE garage_repair_id = ? AND ro_repair_or_sm_id = ? LIMIT 1`,
        [garageRepairId, roRepairOrSmId]
      );

      if (!riRows || riRows.length === 0) {
        const msg = `repair_items record not found for garage_repair_id=${garageRepairId} ro_repair_or_sm_id=${roRepairOrSmId}`;
        errors.push(msg);
        await db.query(
          `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
          [roId, userId, `Mechanic Assignment Event [${eventType}] - ${msg}`]
        );
        continue;
      }

      const internalRepairItemId = riRows[0].id;
      const incomingAssignments  = item.mechanic_assignments || [];
      const incomingGarageIds    = incomingAssignments.map(a => a.assignment_id).filter(Boolean);

      // ── REMOVED PATH: Delete exactly the assignments sent in payload ───────
      if (eventType === 'Mechanic_Assignment_Removed') {
        if (incomingGarageIds.length > 0) {
          const placeholders = incomingGarageIds.map(() => '?').join(',');
          const [deleteResult] = await db.query(
            `DELETE FROM mechanic_assignments 
             WHERE repair_item_id = ? AND garage_assignment_id IN (${placeholders})`,
            [internalRepairItemId, ...incomingGarageIds]
          );

          await db.query(
            `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
            [roId, userId,
              `Mechanic Assignment Event [Mechanic_Assignment_Removed] - DELETED ${deleteResult.affectedRows} assignment(s) ` +
              `repair_item_id=${internalRepairItemId} garage_assignment_ids: [${incomingGarageIds.join(',')}]`
            ]
          );

          results.push({ action: 'deleted', garage_assignment_ids: incomingGarageIds, repair_item_id: internalRepairItemId });
        } else {
          await db.query(
            `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
            [roId, userId,
              `Mechanic Assignment Event [Mechanic_Assignment_Removed] - No assignment_ids in payload for repair_item_id=${internalRepairItemId}`
            ]
          );
        }
        continue; // ← skip upsert, move to next repair item
      }

      // ── ADDED PATH: Sync — delete missing, upsert incoming ────────────────
      const [existingRows] = await db.query(
        `SELECT id, garage_assignment_id FROM mechanic_assignments WHERE repair_item_id = ?`,
        [internalRepairItemId]
      );

      const existingGarageIds = existingRows.map(r => r.garage_assignment_id).filter(Boolean);
      const toDelete = existingGarageIds.filter(id => !incomingGarageIds.includes(id));

      if (toDelete.length > 0) {
        const placeholders = toDelete.map(() => '?').join(',');
        const [deleteResult] = await db.query(
          `DELETE FROM mechanic_assignments 
           WHERE repair_item_id = ? AND garage_assignment_id IN (${placeholders})`,
          [internalRepairItemId, ...toDelete]
        );

        await db.query(
          `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
          [roId, userId,
            `Mechanic Assignment Event [${eventType}] - DELETED ${deleteResult.affectedRows} assignment(s) ` +
            `repair_item_id=${internalRepairItemId} removed garage_assignment_ids: [${toDelete.join(',')}]`
          ]
        );
      }

      // ── ADDED: Upsert each incoming assignment ────────────────────────────
      for (const assignment of incomingAssignments) {
        const garageAssignmentId     = assignment.assignment_id           || null;
        const garageMechanicId       = assignment.mechanic_id             || null;
        const mechanicName           = assignment.mechanic_name           || null;
        const bayNumber              = assignment.bay_number              || null;
        const status                 = assignment.status                  || 'Assigned';
        const approvalStatus         = assignment.approval_status         || 'Not_Submitted';
        const scheduledStart         = assignment.scheduled_start
                                        ? formatUtcToMysql(assignment.scheduled_start)
                                        : null;
        const scheduledEnd           = assignment.scheduled_end
                                        ? formatUtcToMysql(assignment.scheduled_end)
                                        : null;
        const actualStart            = assignment.actual_start_datetime
                                        ? formatUtcToMysql(assignment.actual_start_datetime)
                                        : null;
        const actualEnd              = assignment.actual_end_datetime
                                        ? formatUtcToMysql(assignment.actual_end_datetime)
                                        : null;
        const mechanicChallengeNotes = assignment.mechanic_challenge_notes || null;
        const invoiceNotes           = assignment.invoice_notes            || null;
        const invoiceHours           = assignment.invoice_hours            || 0;
        const actualHours            = assignment.actual_hours             || 0;
        const duration               = assignment.duration                 || 0;

        if (!garageAssignmentId) {
          errors.push(`Skipping assignment — missing assignment_id in repair_item ${garageRepairId}`);
          continue;
        }

        // Check if this assignment already exists in DB
        const [existingAssignment] = await db.query(
          `SELECT id FROM mechanic_assignments 
           WHERE repair_item_id = ? AND garage_assignment_id = ? LIMIT 1`,
          [internalRepairItemId, garageAssignmentId]
        );

        if (existingAssignment && existingAssignment.length > 0) {
          // UPDATE
          await db.query(
            `UPDATE mechanic_assignments SET
               garage_mechanic_id        = ?,
               mechanic_name             = ?,
               bay_number                = ?,
               status                    = ?,
               approval_status           = ?,
               scheduled_start           = ?,
               scheduled_end             = ?,
               actual_start_datetime     = ?,
               actual_end_datetime       = ?,
               mechanic_challenge_notes  = ?,
               invoice_notes             = ?,
               invoice_hours             = ?,
               actual_hours              = ?,
               duration                  = ?
             WHERE id = ?`,
            [
              garageMechanicId, mechanicName, bayNumber,
              status, approvalStatus,
              scheduledStart, scheduledEnd,
              actualStart, actualEnd,
              mechanicChallengeNotes, invoiceNotes,
              invoiceHours, actualHours, duration,
              existingAssignment[0].id
            ]
          );

          await db.query(
            `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
            [roId, userId,
              `Mechanic Assignment Event [${eventType}] - UPDATED garage_assignment_id=${garageAssignmentId} ` +
              `mechanic=${mechanicName} repair_item_id=${internalRepairItemId}`
            ]
          );

          results.push({ action: 'updated', garage_assignment_id: garageAssignmentId, mechanic: mechanicName });

        } else {
          // INSERT
          await db.query(
            `INSERT INTO mechanic_assignments 
             (repair_item_id, garage_assignment_id, garage_mechanic_id,
              mechanic_name, bay_number, status, approval_status,
              scheduled_start, scheduled_end,
              actual_start_datetime, actual_end_datetime,
              mechanic_challenge_notes, invoice_notes,
              invoice_hours, actual_hours, duration, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
              internalRepairItemId, garageAssignmentId, garageMechanicId,
              mechanicName, bayNumber, status, approvalStatus,
              scheduledStart, scheduledEnd,
              actualStart, actualEnd,
              mechanicChallengeNotes, invoiceNotes,
              invoiceHours, actualHours, duration
            ]
          );

          await db.query(
            `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
            [roId, userId,
              `Mechanic Assignment Event [${eventType}] - INSERTED garage_assignment_id=${garageAssignmentId} ` +
              `mechanic=${mechanicName} repair_item_id=${internalRepairItemId}`
            ]
          );

          results.push({ action: 'inserted', garage_assignment_id: garageAssignmentId, mechanic: mechanicName });
        }
      }

      // ── Final log per repair item ─────────────────────────────────────────
      await db.query(
        `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
        [roId, userId,
          `Mechanic Assignment Event [${eventType}] - SYNC COMPLETE ` +
          `garage_repair_id=${garageRepairId} internal_repair_item_id=${internalRepairItemId} ` +
          `deleted=[${toDelete.join(',')}] incoming=[${incomingGarageIds.join(',')}]`
        ]
      );
    }

    await logWebhookActivity(req, `Garage Module API - ${eventType} processed for RO ${roId}`, {
      rawLog: payload
    });

    return res.json({
      success: true,
      status: 'OK',
      event_type: eventType,
      results,
      ...(errors.length > 0 && { errors })
    });

  } catch (error) {
    console.error(`❌ Error in handleMechanicAssignment [${eventType}]:`, error);
    await db.query(
      `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
      [roId, userId, `Mechanic Assignment Event [${eventType}] - ERROR: ${error.message}`]
    ).catch(() => {});

    return res.status(500).json({
      success: false,
      status: 'NOOK',
      error: error.message
    });
  }
};