/**
 * Event Handler: Defect_Remove
 *
 * Triggered by:
 *   POST /updateVehicleDefect_v2
 *   event_type = 'Defect_Remove'
 *
 * Logic branches on defect_source from vehicle_repair_logs:
 *
 *   defect_source = 'garage'
 *   → HARD CASCADE DELETE:
 *      - mechanic_assignments       (via repair_items.id)
 *      - repair_item_notes          (via repair_items.id)
 *      - repair_items               (via rpor.id)
 *      - repair_purchase_order_repairs (via vrl.id)
 *      - vehicle_repair_logs        (via id)
 *
 *   defect_source = 'motive' | 'skysoft' | 'maintenance'
 *   → SOFT CLEAN:
 *      - RPOR: work_order_number = NULL, current_kms = NULL, rpor_status = 'Open'
 *      - Hard delete: mechanic_assignments, repair_item_notes, repair_items
 *      - VRL: defect_status = 'Open'
 */

const db = require('../../db/connection');
const { logWebhookActivity } = require('../../utils/webhookLogger');

module.exports = async function handleDefectRemove(req, res) {
  const userId         = req.apiToken.userId;
  const payload        = req.body;

  const roId           = payload.roid             || null;
  const eventType      = payload.event_type       || 'Defect_Remove';
  const defectsDetails = payload.defects_details  || null;

  // ── Basic validation ──────────────────────────────────────────────────────
  if (!roId) {
    return res.status(400).json({ success: false, status: 'NOOK', error: 'Missing roid' });
  }

  if (!defectsDetails) {
    return res.status(400).json({ success: false, status: 'NOOK', error: 'Missing defects_details' });
  }

  const skysoftDefectId = defectsDetails.defect_id || payload.defectid || null;

  if (!skysoftDefectId) {
    return res.status(400).json({ success: false, status: 'NOOK', error: 'Missing defect_id in defects_details' });
  }

  try {
    // ── Step 1: Check RO exists ───────────────────────────────────────────────
    const [roResults] = await db.query(
      'SELECT id FROM repair_purchase_orders WHERE id = ? LIMIT 1',
      [roId]
    );

    if (!roResults || roResults.length === 0) {
      await db.query(
        `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
        [roId, userId, `Defect_Remove - RO not found for roid: ${roId}`]
      );
      return res.status(404).json({ success: false, status: 'NOOK', error: `RO not found: ${roId}` });
    }

    // ── Step 2: Find VRL via external_garage_defect_id + grab defect_source ──
// CORRECT — lookup by VRL's own primary key
const [vrlRows] = await db.query(
  'SELECT id, defect_source FROM vehicle_repair_logs WHERE id = ? LIMIT 1',
  [skysoftDefectId]
);

    if (!vrlRows || vrlRows.length === 0) {
      await db.query(
        `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
        [roId, userId, `Defect_Remove - VRL not found for external_garage_defect_id=${skysoftDefectId}`]
      );
      return res.status(404).json({ success: false, status: 'NOOK', error: `VRL not found for defect_id: ${skysoftDefectId}` });
    }

    const vrlId       = vrlRows[0].id;
    const defectSource = vrlRows[0].defect_source;

    // ── Step 3: Find RPOR ─────────────────────────────────────────────────────
    const [rporRows] = await db.query(
      'SELECT id FROM repair_purchase_order_repairs WHERE repair_log_id = ? AND repair_purchase_order = ? LIMIT 1',
      [vrlId, roId]
    );

    if (!rporRows || rporRows.length === 0) {
      await db.query(
        `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
        [roId, userId, `Defect_Remove - RPOR not found for vrl_id=${vrlId} ro_id=${roId}`]
      );
      return res.status(404).json({ success: false, status: 'NOOK', error: `RPOR not found for vrl_id: ${vrlId}` });
    }

    const rporId = rporRows[0].id;

    await db.query(
      `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
      [roId, userId, `Defect_Remove - Found VRL: vrl_id=${vrlId} rpor_id=${rporId} defect_source=${defectSource} external_garage_defect_id=${skysoftDefectId}`]
    );

    // ── Step 4: Get repair_items linked to RPOR ───────────────────────────────
    const [repairItemRows] = await db.query(
      'SELECT id FROM repair_items WHERE ro_repair_or_sm_id = ?',
      [rporId]
    );

    const repairItemIds = repairItemRows.map(r => r.id);

    // ── Step 5: Delete mechanic_assignments + repair_item_notes + repair_items
    //           (shared by both branches)
    if (repairItemIds.length > 0) {
      const placeholders = repairItemIds.map(() => '?').join(',');

      const [delMA] = await db.query(
        `DELETE FROM mechanic_assignments WHERE repair_item_id IN (${placeholders})`,
        repairItemIds
      );
      await db.query(
        `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
        [roId, userId, `Defect_Remove - DELETED ${delMA.affectedRows} mechanic_assignments for repair_item_ids: [${repairItemIds.join(',')}]`]
      );

      const [delRIN] = await db.query(
        `DELETE FROM repair_item_notes WHERE repair_item_id IN (${placeholders})`,
        repairItemIds
      );
      await db.query(
        `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
        [roId, userId, `Defect_Remove - DELETED ${delRIN.affectedRows} repair_item_notes for repair_item_ids: [${repairItemIds.join(',')}]`]
      );
    }

    const [delRI] = await db.query(
      'DELETE FROM repair_items WHERE ro_repair_or_sm_id = ?',
      [rporId]
    );
    await db.query(
      `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
      [roId, userId, `Defect_Remove - DELETED ${delRI.affectedRows} repair_items for rpor_id=${rporId}`]
    );

    // ── Step 6: Branch on defect_source ───────────────────────────────────────
    if (defectSource === 'garage') {

      // ── HARD CASCADE: delete RPOR then VRL ─────────────────────────────────
      const [delRPOR] = await db.query(
        'DELETE FROM repair_purchase_order_repairs WHERE id = ?',
        [rporId]
      );
      await db.query(
        `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
        [roId, userId, `Defect_Remove [garage] - DELETED ${delRPOR.affectedRows} repair_purchase_order_repairs rpor_id=${rporId}`]
      );

      const [delVRL] = await db.query(
        'DELETE FROM vehicle_repair_logs WHERE id = ?',
        [vrlId]
      );
      await db.query(
        `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
        [roId, userId, `Defect_Remove [garage] - DELETED ${delVRL.affectedRows} vehicle_repair_logs vrl_id=${vrlId}`]
      );

      await db.query(
        `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
        [roId, userId, `Defect_Remove [garage] - HARD CASCADE DELETE COMPLETE: vrl_id=${vrlId} rpor_id=${rporId} external_garage_defect_id=${skysoftDefectId} RO=${roId}`]
      );

    } else {

      // ── SOFT CLEAN: null out RPOR fields, reset statuses ───────────────────
      await db.query(
        `UPDATE repair_purchase_order_repairs
            SET work_order_number = NULL,
                current_kms       = NULL,
                rpor_status       = 'Open'
          WHERE id = ?`,
        [rporId]
      );
      await db.query(
        `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
        [roId, userId, `Defect_Remove [${defectSource}] - RPOR soft-cleaned: work_order_number=NULL current_kms=NULL rpor_status=Open rpor_id=${rporId}`]
      );

      await db.query(
        `UPDATE vehicle_repair_logs
            SET defect_status = 'Open'
          WHERE id = ?`,
        [vrlId]
      );
      await db.query(
        `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
        [roId, userId, `Defect_Remove [${defectSource}] - VRL defect_status reset to Open: vrl_id=${vrlId}`]
      );

      await db.query(
        `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
        [roId, userId, `Defect_Remove [${defectSource}] - SOFT CLEAN COMPLETE: vrl_id=${vrlId} rpor_id=${rporId} external_garage_defect_id=${skysoftDefectId} RO=${roId}`]
      );
    }

    // ── Step 7: Webhook activity log ──────────────────────────────────────────
    await logWebhookActivity(req, `Garage Module API - Defect_Remove processed for RO ${roId}`, {
      rawLog: payload
    });

    return res.json({
      success:    true,
      status:     'OK',
      event_type: eventType,
      defect_source: defectSource,
      action:     defectSource === 'garage' ? 'hard_cascade_delete' : 'soft_clean',
      result: {
        vrl_id:                    vrlId,
        rpor_id:                   rporId,
        external_garage_defect_id: skysoftDefectId,
        repair_items_deleted:      delRI.affectedRows
      }
    });

  } catch (error) {
    console.error(`❌ Error in handleDefectRemove:`, error);
    await db.query(
      `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
      [roId, userId, `Defect_Remove - ERROR: ${error.message}`]
    ).catch(() => {});

    return res.status(500).json({
      success: false,
      status:  'NOOK',
      error:   error.message
    });
  }
};