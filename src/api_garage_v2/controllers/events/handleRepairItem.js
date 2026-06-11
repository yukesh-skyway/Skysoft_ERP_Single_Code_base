// events/handleRepairItem.js
const db = require('../../db/connection');
const { logWebhookActivity } = require('../../utils/webhookLogger');

module.exports = async function handleRepairItem(req, res) {
  const userId = req.apiToken.userId;
  const {
    roid,
    event_type,
    repair_items,
    work_order_number,
    current_kms
  } = req.body;

  // ── Validate ──────────────────────────────────────────────────────────────
  if (!roid || !repair_items || repair_items.length === 0) {
    return res.status(400).json({ success: false, error: 'Missing roid or repair_items' });
  }

  // ── Check RO exists ───────────────────────────────────────────────────────
  const [roResults] = await db.query(
    'SELECT id FROM repair_purchase_orders WHERE id = ?',
    [roid]
  );
  if (!roResults || roResults.length === 0) {
    await db.query(
      `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
      [roid, userId, `handleRepairItem - RO not found for roid: ${roid}`]
    );
    return res.status(404).json({ success: false, error: `RO not found for roid: ${roid}` });
  }

  try {
    for (const item of repair_items) {
      const { repair_item_id, defect_id, sm_id } = item;

      // ── Step 1: Find RPOR id ───────────────────────────────────────────────
      let roRepairOrSmId = null;
      let rporId         = null;

      if (defect_id) {
        const [r] = await db.query(
          'SELECT id FROM repair_purchase_order_repairs WHERE repair_purchase_order = ? AND repair_log_id = ?',
          [roid, defect_id]
        );
        if (r && r.length > 0) {
          roRepairOrSmId = r[0].id;
          rporId         = r[0].id;
        }
      } else if (sm_id) {
        const [r] = await db.query(
          'SELECT id FROM repair_purchase_order_repairs WHERE repair_purchase_order = ? AND scheduled_maintenance_setting_id = ?',
          [roid, sm_id]
        );
        if (r && r.length > 0) {
          roRepairOrSmId = r[0].id;
          rporId         = r[0].id;
        }
      }

      if (!roRepairOrSmId) {
        await db.query(
          `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
          [roid, userId, `handleRepairItem [${event_type}] - RPOR not found for defect_id=${defect_id} sm_id=${sm_id} roid=${roid}`]
        );
        continue;
      }

      // ── Repair_Item_Add ────────────────────────────────────────────────────
      if (event_type === 'Repair_Item_Add') {

        const name               = item.repair_name || item.name || item.description || 'Repair Item';
        const description        = item.description || '';
        const estimatedHours     = item.estimated_hours || 0;
        const laborCost          = item.labor_cost || 0;
        const totalEstimatedCost = item.total_estimated_cost || laborCost;
        const totalActualHours   = item.total_actual_hours || 0;
        const status             = item.status || 'Pending';
        const defectStatus       = item.defect_status || 'Open';
        const requiredParts      = item.required_parts || '';
        const garageRepairId     = repair_item_id || 0;

        // ── Upsert repair_item ───────────────────────────────────────────────
        const [existing] = await db.query(
          'SELECT id FROM repair_items WHERE garage_repair_id = ? AND ro_repair_or_sm_id = ?',
          [garageRepairId, roRepairOrSmId]
        );

        if (existing && existing.length > 0) {
          await db.query(
            `UPDATE repair_items 
             SET name = ?, description = ?, estimated_hours = ?, labor_cost = ?,
                 total_estimated_cost = ?, total_actual_hours = ?, status = ?,
                 defect_status = ?, required_parts = ?
             WHERE id = ?`,
            [name, description, estimatedHours, laborCost, totalEstimatedCost,
             totalActualHours, status, defectStatus, requiredParts, existing[0].id]
          );
          await db.query(
            `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
            [roid, userId, `Repair_Item_Add - Updated repair_item id=${existing[0].id} (garage_repair_id=${garageRepairId}) for RO ${roid}`]
          );
        } else {
          const [insertResult] = await db.query(
            `INSERT INTO repair_items 
             (garage_repair_id, ro_repair_or_sm_id, name, description, estimated_hours,
              labor_cost, total_estimated_cost, total_actual_hours, status, defect_status,
              required_parts, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [garageRepairId, roRepairOrSmId, name, description, estimatedHours,
             laborCost, totalEstimatedCost, totalActualHours, status, defectStatus, requiredParts]
          );
          await db.query(
            `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
            [roid, userId, `Repair_Item_Add - Inserted repair_item id=${insertResult.insertId} (garage_repair_id=${garageRepairId}) for RO ${roid}`]
          );
        }

        // ── Update RPOR: work_order_number, current_kms, rpor_status ─────────
        await db.query(
          `UPDATE repair_purchase_order_repairs
              SET work_order_number = ?,
                  current_kms       = ?,
                  rpor_status       = 'In_Progress'
            WHERE id = ?`,
          [work_order_number || null, current_kms || null, rporId]
        );
        await db.query(
          `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
          [roid, userId, `Repair_Item_Add - Updated RPOR id=${rporId}: work_order_number=${work_order_number} current_kms=${current_kms} rpor_status=In_Progress`]
        );

        // ── Update VRL: defect_status = In_Progress ───────────────────────────
        // VRL is linked via repair_log_id on RPOR (only applies when defect_id present)
        if (defect_id) {
          await db.query(
            `UPDATE vehicle_repair_logs
                SET defect_status = 'In_Progress'
              WHERE id = ?`,
            [defect_id]
          );
          await db.query(
            `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
            [roid, userId, `Repair_Item_Add - Updated VRL id=${defect_id} defect_status=In_Progress`]
          );
        }

      // ── Repair_Item_Remove ─────────────────────────────────────────────────
      } else if (event_type === 'Repair_Item_Remove') {

        const garageRepairId = repair_item_id || 0;

        const [existing] = await db.query(
          'SELECT id FROM repair_items WHERE garage_repair_id = ? AND ro_repair_or_sm_id = ?',
          [garageRepairId, roRepairOrSmId]
        );

        if (!existing || existing.length === 0) {
          await db.query(
            `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
            [roid, userId, `Repair_Item_Remove - repair_item not found garage_repair_id=${garageRepairId} roRepairOrSmId=${roRepairOrSmId}`]
          );
          continue;
        }

        const repairItemId = existing[0].id;

        await db.query('DELETE FROM mechanic_assignments WHERE repair_item_id = ?', [repairItemId]);
        await db.query('DELETE FROM repair_item_notes WHERE repair_item_id = ?', [repairItemId]);
        await db.query('DELETE FROM repair_items WHERE id = ?', [repairItemId]);

        await db.query(
          `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
          [roid, userId, `Repair_Item_Remove - Deleted repair_item id=${repairItemId} (garage_repair_id=${garageRepairId}) and all child records for RO ${roid}`]
        );
      }
    }

    await logWebhookActivity(req, `Garage Module API - ${event_type} processed for RO ${roid}`, {
      rawLog: req.body
    });

    return res.status(200).json({ success: true, status: 'OK', event: event_type, roid });

  } catch (error) {
    console.error(`❌ Error in handleRepairItem [${event_type}]:`, error);
    await db.query(
      `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
      [roid, userId, `handleRepairItem ERROR [${event_type}]: ${error.message}`]
    );
    return res.status(500).json({ success: false, error: error.message });
  }
};