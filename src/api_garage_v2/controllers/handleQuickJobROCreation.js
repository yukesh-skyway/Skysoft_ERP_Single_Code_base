const db = require('../db/connection');
const axios = require('axios');

function formatUtcToMysql(isoString) {
  if (!isoString) return null;
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 19).replace('T', ' ');
  } catch { return null; }
}

async function handleQuickJobROCreation(req, res) {
  const startTime = Date.now();
  const payload   = req.body;

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 1: VALIDATE
  // ─────────────────────────────────────────────────────────────────────────
  if (!payload) {
    return res.status(400).json({ success: false, status: 'NOOK', error: 'No payload received' });
  }

  const {
    work_order_number,
    work_order_status,
    current_kms,
    vehicle_unit_number,
    defects_details,
    event_type
  } = payload;

  if (!work_order_number)
    return res.status(400).json({ success: false, status: 'NOOK', error: 'work_order_number is required' });
  if (!defects_details)
    return res.status(400).json({ success: false, status: 'NOOK', error: 'defects_details is required' });

  // ── Determine event type ────────────────────────────────────────────────
  // quick_job               → defects_details is a single object, repair_items may be populated
  // Work_Order_Creation_Without_RO → defects_details is an array, repair_items is always []
  const isWorkOrderEvent = event_type === 'Work_Order_Creation_Without_RO';

  // ── Normalize defects_details into an array regardless of event type ────
  // quick_job sends a plain object → wrap it
  // Work_Order_Creation_Without_RO sends an array → use as-is
  const defectsArray = isWorkOrderEvent
    ? (Array.isArray(defects_details) ? defects_details : [defects_details])
    : [defects_details];

  if (defectsArray.length === 0)
    return res.status(400).json({ success: false, status: 'NOOK', error: 'defects_details array is empty' });

  // ── Resolve unit number (top-level wins, fallback to first defect) ──────
  const unitNumber = vehicle_unit_number || defectsArray[0]?.vehicle_unit_number || null;
  if (!unitNumber)
    return res.status(400).json({ success: false, status: 'NOOK', error: 'vehicle_unit_number is required' });

  // ── Validate every defect has a garage_finding_id ──────────────────────
  for (const defect of defectsArray) {
    if (!defect.garage_finding_id)
      return res.status(400).json({
        success: false,
        status: 'NOOK',
        error: `defects_details.garage_finding_id is required for defect: ${defect.name || 'unknown'}`
      });
  }

  const STATUS_MAP = {
    'REPAIR_STARTED': 'Repair_Started',
    'Repair_Started': 'Repair_Started',
    'REPAIR_DONE':    'Completed',
    'SR_LINKED':      'In_Progress',
    'Open':           'Open',
    'Pending':        'Pending'
  };

  const userId = req.apiToken?.userId || 295;

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 2: LOOKUP VEHICLE
  // ─────────────────────────────────────────────────────────────────────────
  const [vehicleRows] = await db.query(
    `SELECT id FROM vehicles WHERE vehicle_nickname = ? LIMIT 1`, [unitNumber]
  );
  if (!vehicleRows || vehicleRows.length === 0)
    return res.status(404).json({ success: false, status: 'NOOK', error: `Vehicle not found: ${unitNumber}` });
  const vehicleId = vehicleRows[0].id;

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 3: DUPLICATE CHECK
  //
  // For quick_job (single defect):
  //   If VRL already exists → return early with skipped response (original behaviour).
  //
  // For Work_Order_Creation_Without_RO (multiple defects):
  //   We check per-defect inside the loop (Step 6) so one duplicate doesn't
  //   abort the whole request. ALL non-duplicate defects still get processed.
  //
  //   However, we still need to guard against creating the RO twice if the
  //   entire batch was already processed. We do that by checking whether ALL
  //   defects in the array already have a VRL — if so, return early.
  // ─────────────────────────────────────────────────────────────────────────
  if (!isWorkOrderEvent) {
    // quick_job — single defect duplicate check (original logic)
    const garage_finding_id = defectsArray[0].garage_finding_id;
    const [existingVRL] = await db.query(
      `SELECT id, related_repair_purchase_order, status
       FROM vehicle_repair_logs
       WHERE external_garage_defect_id = ? AND vehicle = ? LIMIT 1`,
      [garage_finding_id, vehicleId]
    );
    if (existingVRL && existingVRL.length > 0) {
      console.log(`[QuickJob] Duplicate — VRL exists for garage_finding_id=${garage_finding_id}`);
      return res.json({
        success: true,
        status: 'OK',
        event_type: 'Defect_Add',
        skipped: true,
        reason: 'duplicate',
        existing_vrl_id: existingVRL[0].id,
        existing_ro_id: existingVRL[0].related_repair_purchase_order,
        existing_status: existingVRL[0].status,
        garage_finding_id,
        vehicle_id: vehicleId,
        duration_ms: Date.now() - startTime
      });
    }
  } else {
    // Work_Order_Creation_Without_RO — check if ALL defects are already processed
    const allFindingIds = defectsArray.map(d => d.garage_finding_id);
    const [existingVRLs] = await db.query(
      `SELECT external_garage_defect_id
       FROM vehicle_repair_logs
       WHERE external_garage_defect_id IN (?) AND vehicle = ?`,
      [allFindingIds, vehicleId]
    );
    const alreadyProcessedIds = new Set(
      (existingVRLs || []).map(r => r.external_garage_defect_id)
    );
    if (allFindingIds.every(id => alreadyProcessedIds.has(id))) {
      console.log(`[WorkOrder] All defects already processed for WO#=${work_order_number} — skipping`);
      return res.json({
        success: true,
        status: 'OK',
        event_type,
        skipped: true,
        reason: 'all_duplicates',
        vehicle_id: vehicleId,
        duration_ms: Date.now() - startTime
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 4: RESOLVE STATIC LOOKUPS
  // ─────────────────────────────────────────────────────────────────────────
  let garageUserId = null;
  const [garageUserRows] = await db.query(
    `SELECT id FROM users WHERE fullname = 'Garage Mechanics' LIMIT 1`
  );
  if (garageUserRows && garageUserRows.length > 0) garageUserId = garageUserRows[0].id;
  if (!garageUserId) {
    console.warn('[QuickJob] Garage Mechanics user not found, falling back to userId:', userId);
    garageUserId = userId;
  }

  let vendorId = null;
  const [vendorRows] = await db.query(
    `SELECT id FROM vendors WHERE vendor_name = 'SM Autocare Ltd' LIMIT 1`
  );
  if (vendorRows && vendorRows.length > 0) vendorId = vendorRows[0].id;
  if (!vendorId) console.warn('[QuickJob] SM Autocare Ltd vendor not found');

  // Accounts Payable — hardcoded id = 5
  const PAYMENT_METHOD_ACCOUNTS_PAYABLE = 5;

  let garageCatId = null;
  const [garageCatRows] = await db.query(
    `SELECT id FROM repair_code_categories WHERE repair_code_category = 'Garage' LIMIT 1`
  );
  if (garageCatRows && garageCatRows.length > 0) garageCatId = garageCatRows[0].id;

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 5: CREATE REPAIR ORDER  (created ONCE — shared by all defects)
  // ─────────────────────────────────────────────────────────────────────────
  const kmsBefore = parseFloat(current_kms) || 0;

  const [roResult] = await db.query(
    `INSERT INTO repair_purchase_orders (
       vehicle, requested_by, vendor, kms_before_service, created_by,
       work_order_number, invoice_number, invoice_amount, payment_method,
       payment_notes, attached_invoice_url, repair_notes,
       verification_handled_by, status, work_order_status
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      vehicleId, garageUserId, vendorId, kmsBefore, garageUserId,
      work_order_number, '', 0, PAYMENT_METHOD_ACCOUNTS_PAYABLE,
      '', '', 'Garage Quick Job Work Order Creation',
      garageUserId, 1, work_order_status || 'IN_PROGRESS'
    ]
  );

  const roId = roResult.insertId;
  if (!roId)
    return res.status(500).json({ success: false, status: 'NOOK', error: 'Failed to create Repair Order' });

  console.log(`[QuickJob] RO Created: ID=${roId} | WO#=${work_order_number} | vehicle=${vehicleId} | vendor=${vendorId} | event=${event_type}`);

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 6: LOOP DEFECTS — create VRL + RPOR for each defect
  //
  // Both event types go through this same loop.
  // quick_job      → defectsArray has exactly 1 item, same as before.
  // Work_Order_...  → defectsArray has N items, all linked to the same roId.
  //
  // Per-defect duplicates (Work_Order_... only) are skipped with `continue`
  // so the rest of the batch still gets processed.
  // ─────────────────────────────────────────────────────────────────────────
  const vrlResults = []; // collect outcome of each defect for the response

  for (const defect of defectsArray) {
    const garage_finding_id  = defect.garage_finding_id;
    const garageDefectName   = defect.name        || 'Untitled Defect';
    const garageDefectDesc   = defect.description || garageDefectName;
    const garageDefectStatus = defect.status      || 'REPAIR_STARTED';
    const defectStatus       = STATUS_MAP[garageDefectStatus] || 'In_Progress';

    // ── Per-defect duplicate guard (Work_Order_... only) ─────────────────
    // For quick_job this was already handled in Step 3 so we won't reach here
    // with a duplicate. For Work_Order_... we check here so one duplicate
    // doesn't abort the whole loop.
    if (isWorkOrderEvent) {
      const [existingVRL] = await db.query(
        `SELECT id FROM vehicle_repair_logs
         WHERE external_garage_defect_id = ? AND vehicle = ? LIMIT 1`,
        [garage_finding_id, vehicleId]
      );
      if (existingVRL && existingVRL.length > 0) {
        console.log(`[WorkOrder] Skipping duplicate defect garage_finding_id=${garage_finding_id}`);
        vrlResults.push({
          garage_finding_id,
          skipped: true,
          reason: 'duplicate',
          existing_vrl_id: existingVRL[0].id
        });
        continue;
      }
    }

    // ── CREATE VRL ────────────────────────────────────────────────────────
    const [vrlResult] = await db.query(
      `INSERT INTO vehicle_repair_logs (
         vehicle,
         repair_code_category,
         repair_desc,
         issue_date,
         reported_by,
         logged_by,
         related_repair_purchase_order,
         notes,
         defect_source,
         defect_status,
         linked_to_roid,
         linked_to_ro_items,
         external_garage_defect_id
       ) VALUES (?, ?, ?, CURDATE(), ?, ?, ?, ?, 'garage', ?, ?, NULL, ?)`,
      [
        vehicleId,
        garageCatId,
        garageDefectName,
        garageUserId,
        garageUserId,
        roId,
        garageDefectDesc,
        defectStatus,
        roId,
        garage_finding_id
      ]
    );

    const vrlId = vrlResult.insertId;
    if (!vrlId) {
      console.error(`[QuickJob] Failed to create VRL for garage_finding_id=${garage_finding_id}`);
      vrlResults.push({ garage_finding_id, error: 'Failed to create VRL' });
      continue;
    }

    console.log(`[QuickJob] VRL Created: ID=${vrlId} | garage_finding_id=${garage_finding_id} | ro_id=${roId}`);

    // ── CREATE RPOR ───────────────────────────────────────────────────────
    const [rporResult] = await db.query(
      `INSERT INTO repair_purchase_order_repairs (
         repair_purchase_order, repair_log_id, item_type,
         repair_notes, work_order_number, rpor_status
       ) VALUES (?, ?, ?, ?, ?, ?)`,
      [roId, vrlId, 'REPAIR', garageDefectDesc, work_order_number, defectStatus]
    );

    const rporId = rporResult.insertId;
    if (!rporId) {
      console.error(`[QuickJob] Failed to create RPOR for vrl_id=${vrlId}`);
      vrlResults.push({ garage_finding_id, vrl_id: vrlId, error: 'Failed to create RPOR' });
      continue;
    }

    console.log(`[QuickJob] RPOR Created: ID=${rporId} | vrl_id=${vrlId} | ro_id=${roId}`);

    // ── UPDATE VRL.linked_to_ro_items ─────────────────────────────────────
    await db.query(
      `UPDATE vehicle_repair_logs SET linked_to_ro_items = ? WHERE id = ?`,
      [rporId, vrlId]
    );

    vrlResults.push({
      garage_finding_id,
      vrl_id: vrlId,
      rpor_id: rporId,
      defect_status: defectStatus,
      skipped: false
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 7: PROCESS repair_items[]
  //
  // Only runs for quick_job. Work_Order_Creation_Without_RO always sends
  // repair_items: [] so this block is naturally skipped, but we also gate it
  // explicitly on event type for clarity and safety.
  // ─────────────────────────────────────────────────────────────────────────
  const repairItemsPayload = Array.isArray(payload.repair_items) ? payload.repair_items : [];
  const repairItemResults  = { created: [], failed: [] };

  // For quick_job the single VRL/RPOR is vrlResults[0]
  const primaryRporId = vrlResults[0]?.rpor_id || null;

  if (!isWorkOrderEvent && repairItemsPayload.length > 0 && primaryRporId) {
    console.log(`[QuickJob] Processing ${repairItemsPayload.length} repair item(s) | rporId=${primaryRporId}`);

    for (const item of repairItemsPayload) {
      try {
        const garageRepairId     = item.work_order_repair_item_id || item.repair_item_id || 0;
        const repairItemDetails  = item.repair_items || {};
        const riName             = item.repair_name || repairItemDetails.name || 'Repair Item';
        const riDescription      = repairItemDetails.description || riName;
        const estimatedHours     = parseFloat(repairItemDetails.estimated_hours    || 0);
        const laborCost          = parseFloat(repairItemDetails.labor_cost         || 0);
        const totalEstimatedCost = parseFloat(repairItemDetails.total_estimated_cost || 0);
        const riStatus           = item.status || 'Pending';

        // Use the primary defect status resolved earlier (single defect for quick_job)
        const primaryDefectStatus = vrlResults[0]?.defect_status || 'In_Progress';

        console.log(`[QuickJob] Repair item: garage_repair_id=${garageRepairId} | name=${riName} | rporId=${primaryRporId}`);

        // ── Idempotency check ──────────────────────────────────────────
        const [existingRI] = await db.query(
          `SELECT id FROM repair_items
           WHERE garage_repair_id = ? AND ro_repair_or_sm_id = ? LIMIT 1`,
          [garageRepairId, primaryRporId]
        );

        let repairItemId = null;

        if (existingRI && existingRI.length > 0) {
          repairItemId = existingRI[0].id;
          await db.query(
            `UPDATE repair_items SET
               name = ?, description = ?, estimated_hours = ?,
               labor_cost = ?, total_estimated_cost = ?,
               status = ?, defect_status = ?
             WHERE id = ?`,
            [riName, riDescription, estimatedHours, laborCost,
             totalEstimatedCost, riStatus, primaryDefectStatus, repairItemId]
          );
          console.log(`[QuickJob] Repair Item updated: ID=${repairItemId}`);
        } else {
          const [riInsert] = await db.query(
            `INSERT INTO repair_items (
               garage_repair_id, ro_repair_or_sm_id, name, description,
               estimated_hours, labor_cost, total_estimated_cost,
               total_actual_hours, status, defect_status, required_parts
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '')`,
            [garageRepairId, primaryRporId, riName, riDescription,
             estimatedHours, laborCost, totalEstimatedCost,
             0, riStatus, primaryDefectStatus]
          );
          repairItemId = riInsert.insertId;
          console.log(`[QuickJob] Repair Item Created: ID=${repairItemId} | garage_repair_id=${garageRepairId}`);
        }

        // ── repair_item_notes — only if invoice_notes present ──────────
        const assignments = item.mechanic_assignments || [];
        for (const assignment of assignments) {
          const invoiceNotes = assignment.invoice_notes || null;
          const garageNoteId = assignment.assignment_id || null;

          if (invoiceNotes && invoiceNotes.trim() !== '' && garageNoteId) {
            const [existingNote] = await db.query(
              `SELECT id FROM repair_item_notes
               WHERE repair_item_id = ? AND garage_note_id = ? LIMIT 1`,
              [repairItemId, garageNoteId]
            );
            if (!existingNote || existingNote.length === 0) {
              await db.query(
                `INSERT INTO repair_item_notes
                   (repair_item_id, garage_note_id, note, mechanicName, created_by)
                 VALUES (?, ?, ?, ?, ?)`,
                [
                  repairItemId,
                  garageNoteId,
                  invoiceNotes,
                  assignment.mechanic_name || null,
                  assignment.mechanic_name || null
                ]
              );
              console.log(`[QuickJob] Repair Item Note inserted for assignment_id=${garageNoteId}`);
            }
          }
        }

        // ── mechanic_assignments ───────────────────────────────────────
        if (assignments.length > 0) {
          for (const assignment of assignments) {
            const garageAssignmentId = assignment.assignment_id;
            if (!garageAssignmentId) continue;

            const mechanicId     = assignment.mechanic_id   || null;
            const mechanicName   = assignment.mechanic_name || null;
            const bayNumber      = assignment.bay_id !== undefined
                                     ? String(assignment.bay_id)
                                     : null;
            const startDt        = formatUtcToMysql(assignment.start_datetime        || assignment.actual_start_datetime);
            const endDt          = formatUtcToMysql(assignment.end_datetime          || assignment.actual_end_datetime);
            const actualStartDt  = formatUtcToMysql(assignment.actual_start_datetime || assignment.start_datetime);
            const actualEndDt    = formatUtcToMysql(assignment.actual_end_datetime   || assignment.end_datetime);
            const hours          = parseFloat(assignment.actual_hours || assignment.hours || 0);
            const assignStatus   = assignment.status          || 'Scheduled';
            const approvalStatus = assignment.approval_status || 'Not_Submitted';
            const invoiceNotes   = assignment.invoice_notes   || null;
            const challengeNotes = assignment.mechanic_challenge_notes || null;

            const [existingA] = await db.query(
              `SELECT id FROM mechanic_assignments
               WHERE garage_assignment_id = ? AND repair_item_id = ? LIMIT 1`,
              [garageAssignmentId, repairItemId]
            );

            if (existingA && existingA.length > 0) {
              await db.query(
                `UPDATE mechanic_assignments SET
                   garage_mechanic_id = ?, mechanic_name = ?, bay_number = ?,
                   status = ?, approval_status = ?,
                   scheduled_start = ?, scheduled_end = ?,
                   actual_start_datetime = ?, actual_end_datetime = ?,
                   mechanic_challenge_notes = ?, invoice_notes = ?,
                   actual_hours = ?
                 WHERE id = ?`,
                [mechanicId, mechanicName, bayNumber,
                 assignStatus, approvalStatus,
                 startDt, endDt, actualStartDt, actualEndDt,
                 challengeNotes, invoiceNotes,
                 hours, existingA[0].id]
              );
              console.log(`[QuickJob] Mechanic Assignment updated: garage_assignment_id=${garageAssignmentId}`);
            } else {
              await db.query(
                `INSERT INTO mechanic_assignments (
                   repair_item_id, garage_assignment_id, garage_mechanic_id,
                   mechanic_name, bay_number, status, approval_status,
                   approved_by, approved_at,
                   scheduled_start, scheduled_end,
                   actual_start_datetime, actual_end_datetime,
                   mechanic_challenge_notes, invoice_notes,
                   invoice_hours, actual_hours, duration
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  repairItemId, garageAssignmentId, mechanicId,
                  mechanicName, bayNumber, assignStatus, approvalStatus,
                  null, null,
                  startDt, endDt,
                  actualStartDt, actualEndDt,
                  challengeNotes, invoiceNotes,
                  hours, hours, 0
                ]
              );
              console.log(`[QuickJob] Mechanic Assignment Created: garage_assignment_id=${garageAssignmentId}`);
            }
          }
        }

        repairItemResults.created.push({
          garage_repair_id:        garageRepairId,
          internal_repair_item_id: repairItemId,
          repair_name:             riName,
          assignments_processed:   assignments.length
        });

      } catch (riError) {
        console.error(`[QuickJob] Repair Item FULL ERROR:`, riError);
        repairItemResults.failed.push({
          garage_repair_id: item.work_order_repair_item_id || item.repair_item_id,
          error: riError.message
        });
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 8: TRIGGER GARAGE WEBHOOK
  // ─────────────────────────────────────────────────────────────────────────
  const garageWebhookService = require('../../api/services/garageWebhookService');

  const primaryVrl = vrlResults.find(v => !v.skipped && !v.error);

  let webhookResult = null;
  try {
    if (isWorkOrderEvent) {
      // Build the full defects array — one entry per successfully created VRL
      const defectsPayload = vrlResults
        .filter(v => !v.skipped && !v.error)
        .map(v => ({
          skysoft_defect_id:         v.vrl_id,
          external_garage_defect_id: v.garage_finding_id,
          rpor_id:                   v.rpor_id
        }));

      webhookResult = await garageWebhookService.notifyWorkOrderCreated(
        roId,
        defectsPayload,
        garageUserId
      );
    } else {
      // Original single-defect path — unchanged
      webhookResult = await garageWebhookService.notifyQuickJobCreated(
        roId,
        primaryVrl?.vrl_id            || null,
        primaryVrl?.garage_finding_id || null,
        primaryVrl?.rpor_id           || null,
        garageUserId
      );
    }

    if (webhookResult.success) {
      console.log(`[QuickJob] Webhook triggered — ro_id=${roId} | event=${event_type}`);
    } else {
      console.warn(`[QuickJob] Webhook failed (non-critical):`, webhookResult.error);
    }
  } catch (webhookError) {
    console.warn(`[QuickJob] Webhook error (non-critical):`, webhookError.message);
    webhookResult = { success: false, error: webhookError.message };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 9: LOG TO vm_logs
  // ─────────────────────────────────────────────────────────────────────────
  try {
    let logMessage;

    if (isWorkOrderEvent) {
      const createdCount = vrlResults.filter(v => !v.skipped && !v.error).length;
      const skippedCount = vrlResults.filter(v => v.skipped).length;
      const failedCount  = vrlResults.filter(v => v.error).length;
      logMessage =
        `WorkOrder RO Created — ` +
        `WO#: ${work_order_number} | ` +
        `Vehicle: ${unitNumber} | ` +
        `Defects: ${createdCount} created` +
        (skippedCount ? `, ${skippedCount} skipped (duplicate)` : '') +
        (failedCount  ? `, ${failedCount} failed` : '');
    } else {
      const repairItemSummary = repairItemResults.created.length > 0
        ? repairItemResults.created.map(ri =>
            `${ri.repair_name} (${ri.assignments_processed} mechanic assignment${ri.assignments_processed === 1 ? '' : 's'})`
          ).join(', ')
        : 'No repair items';
      const failedSummary = repairItemResults.failed.length > 0
        ? ` | ${repairItemResults.failed.length} repair item(s) failed to add`
        : '';
      logMessage =
        `QuickJob RO Created — ` +
        `WO#: ${work_order_number} | ` +
        `Vehicle: ${unitNumber} | ` +
        `Defect: ${defectsArray[0]?.name || 'unknown'} | ` +
        `Repair Items: ${repairItemSummary}${failedSummary}`;
    }

    await db.query(
      `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time) VALUES (?, ?, ?, NOW())`,
      [roId, userId, logMessage]
    );
  } catch (logError) {
    console.error('[QuickJob] vm_logs insert failed:', logError.message);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RESPONSE
  // ─────────────────────────────────────────────────────────────────────────
  return res.json({
    success: true,
    status: 'OK',
    event_type,
    duration_ms: Date.now() - startTime,
    ro: {
      ro_id:              roId,
      work_order_number,
      work_order_status:  work_order_status || 'IN_PROGRESS',
      vehicle_id:         vehicleId,
      vendor_id:          vendorId,
      requested_by:       garageUserId
    },
    // For quick_job: single entry. For Work_Order_...: one entry per defect.
    vrls: vrlResults,
    // Only populated for quick_job
    ...(isWorkOrderEvent ? {} : { rpor: { rpor_id: primaryRporId }, repair_items: repairItemResults }),
    webhook: webhookResult
  });
}

module.exports = { handleQuickJobROCreation };