'use strict';

const db = require('../../db/connection');

// ─── GET ALL SLOTS ────────────────────────────────────────────────────────────
// Returns all slots with vehicle type, collection, and sub-collection names joined
async function getAllSlots() {
  const [rows] = await db.query(`
    SELECT
      s.id,
      s.slot_name,
      s.slot_type,
      s.slot_order,
      s.slot_unique_id,
      s.status,
      s.slot_updated_date,
      vt.id            AS vehicle_type_id,
      vt.vehicle_type  AS vehicle_type_name,
      vc.id            AS collection_id,
      vc.name          AS collection_name,
      vsc.id           AS sub_collection_id,
      vsc.name         AS sub_collection_name
    FROM slots s
    LEFT JOIN vehicletypes          vt  ON vt.id  = s.vehicle_type
    LEFT JOIN vehicles_collections  vc  ON vc.id  = s.vehicle_collection
    LEFT JOIN vehicles_sub_collections vsc ON vsc.id = s.vehicle_sub_collection
    WHERE s.status = 1
    ORDER BY s.slot_order ASC, s.id ASC
  `);
  return rows;
}

// ─── GET SLOT BY ID ───────────────────────────────────────────────────────────
async function getSlotById(id) {
  const [rows] = await db.query(`
    SELECT
      s.id,
      s.slot_name,
      s.slot_type,
      s.slot_order,
      s.slot_unique_id,
      s.status,
      s.slot_updated_date,
      vt.id            AS vehicle_type_id,
      vt.vehicle_type  AS vehicle_type_name,
      vc.id            AS collection_id,
      vc.name          AS collection_name,
      vsc.id           AS sub_collection_id,
      vsc.name         AS sub_collection_name
    FROM slots s
    LEFT JOIN vehicletypes          vt  ON vt.id  = s.vehicle_type
    LEFT JOIN vehicles_collections  vc  ON vc.id  = s.vehicle_collection
    LEFT JOIN vehicles_sub_collections vsc ON vsc.id = s.vehicle_sub_collection
    WHERE s.id = ?
    LIMIT 1
  `, [id]);
  return rows[0] ?? null;
}

// ─── GET SLOTS WITH BOOKINGS FOR A DATE RANGE ─────────────────────────────────
// Used by the Dispatch Chart to show what is booked on each slot per day
async function getSlotsWithBookings(startDate, endDate) {
  // First get all active slots
  const [slots] = await db.query(`
    SELECT
      s.id,
      s.slot_name,
      s.slot_type,
      s.slot_order,
      s.slot_unique_id,
      vt.id           AS vehicle_type_id,
      vt.vehicle_type AS vehicle_type_name,
      vc.id           AS collection_id,
      vc.name         AS collection_name,
      vsc.id          AS sub_collection_id,
      vsc.name        AS sub_collection_name
    FROM slots s
    LEFT JOIN vehicletypes             vt  ON vt.id  = s.vehicle_type
    LEFT JOIN vehicles_collections     vc  ON vc.id  = s.vehicle_collection
    LEFT JOIN vehicles_sub_collections vsc ON vsc.id = s.vehicle_sub_collection
    WHERE s.status = 1
    ORDER BY s.slot_order ASC, s.id ASC
  `);

  if (!slots.length) return [];

  // Then get all bookings in the date range
  const [bookings] = await db.query(`
    SELECT
      sb.id                  AS booking_id,
      sb.slot                AS slot_id,
    DATE_FORMAT(sb.booking_trip_date, '%Y-%m-%d') AS booking_trip_date,
      sb.booking_type,
      sb.status              AS booking_status,
      sb.vehicle_leg_notes,
      sb.is_wheelchair_required,
      -- Charter side
      q.id                   AS quote_id,
      -- Contract side
      cs.id                  AS segment_id,
      cs.contract_id,
      -- Driver assigned
      tds.driver             AS driver_id,
      CONCAT(u.fullname, ' ', COALESCE(u.lastname, '')) AS driver_name,
      tds.status             AS driver_schedule_status,
      -- Vehicle assigned
      tvs.vehicle            AS vehicle_id,
      v.vehicle_nickname,
      v.vehicle_number,
      tvs.status             AS vehicle_schedule_status,
      -- Outsource
      tos.outsourced_to      AS outsource_company_id,
      oc.company_name        AS outsource_company_name,
      tos.status             AS outsource_status
    FROM slot_bookings sb
    LEFT JOIN quotes              q   ON q.id  = sb.quote   AND sb.booking_type = 'CHARTER'
    LEFT JOIN contract_segments   cs  ON cs.id = sb.segment AND sb.booking_type = 'CONTRACT'
    LEFT JOIN trip_driver_schedule  tds ON tds.booked_slot = sb.id AND tds.status = 'CONFIRMED'
    LEFT JOIN users                 u   ON u.id = tds.driver
    LEFT JOIN trip_vehicle_schedule tvs ON tvs.booked_slot = sb.id AND tvs.status = 'CONFIRMED'
    LEFT JOIN vehicles              v   ON v.id = tvs.vehicle
    LEFT JOIN trip_outsource_schedule tos ON tos.booked_slot = sb.id AND tos.status = 'CONFIRMED'
    LEFT JOIN outsourcing_companies   oc  ON oc.id = tos.outsourced_to
    WHERE sb.booking_trip_date BETWEEN ? AND ?
      AND sb.status != 3
    ORDER BY sb.booking_trip_date ASC, sb.id ASC
  `, [startDate, endDate]);

  // Map bookings onto their slots
  const bookingsBySlot = {};
  for (const b of bookings) {
    if (!bookingsBySlot[b.slot_id]) bookingsBySlot[b.slot_id] = [];
    bookingsBySlot[b.slot_id].push(b);
  }

  return slots.map(slot => ({
    ...slot,
    bookings: bookingsBySlot[slot.id] ?? [],
  }));
}

// ─── GET SLOT CONFIGURATION ───────────────────────────────────────────────────
async function getSlotConfiguration(slotId) {
  const [rows] = await db.query(`
    SELECT
      sc.id,
      sc.slot_id,
      sc.slot_config_type,
      sc.config_valid_from,
      sc.config_valid_to,
      sc.created_on,
      CONCAT(u.fullname, ' ', COALESCE(u.lastname, '')) AS created_by_name
    FROM slot_configuration sc
    LEFT JOIN users u ON u.id = sc.created_by
    WHERE sc.slot_id = ?
    ORDER BY sc.config_valid_from DESC
  `, [slotId]);
  return rows;
}

// ─── CREATE SLOT ──────────────────────────────────────────────────────────────
async function createSlot(data) {
  const {
    slot_name,
    slot_type,
    vehicle_collection,
    vehicle_sub_collection,
    vehicle_type,
    slot_order,
    slot_unique_id,
  } = data;

  const [result] = await db.query(`
    INSERT INTO slots
      (slot_name, slot_type, vehicle_collection, vehicle_sub_collection,
       vehicle_type, slot_order, slot_unique_id, status, slot_updated_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW())
  `, [
    slot_name,
    slot_type,
    vehicle_collection ?? null,
    vehicle_sub_collection ?? null,
    vehicle_type ?? null,
    slot_order ?? 0,
    slot_unique_id ?? null,
  ]);

  return getSlotById(result.insertId);
}

// ─── UPDATE SLOT ──────────────────────────────────────────────────────────────
async function updateSlot(id, data) {
  const fields = [];
  const values = [];

  const allowed = [
    'slot_name', 'slot_type', 'vehicle_collection',
    'vehicle_sub_collection', 'vehicle_type', 'slot_order', 'slot_unique_id',
  ];

  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(data[key]);
    }
  }

  if (!fields.length) throw new Error('No valid fields to update');

  fields.push('slot_updated_date = NOW()');
  values.push(id);

  await db.query(
    `UPDATE slots SET ${fields.join(', ')} WHERE id = ?`,
    values
  );

  // Log name change to slot_history if name changed
  if (data.slot_name) {
    const existing = await getSlotById(id);
    if (existing && existing.slot_name !== data.slot_name) {
      await db.query(`
        INSERT INTO slot_history (sh_slot_id, sh_slot_old_name, sh_slot_new_name, sh_updated_on, sh_updated_by)
        VALUES (?, ?, ?, NOW(), ?)
      `, [id, existing.slot_name, data.slot_name, data.updated_by ?? null]);
    }
  }

  return getSlotById(id);
}

// ─── DEACTIVATE SLOT (soft delete) ────────────────────────────────────────────
async function deactivateSlot(id) {
  await db.query(
    `UPDATE slots SET status = 0, slot_updated_date = NOW() WHERE id = ?`,
    [id]
  );
  return { success: true };
}

// ─── GET VEHICLE TYPES (for slot creation dropdowns) ─────────────────────────
async function getVehicleTypes() {
  const [rows] = await db.query(`
    SELECT
      vt.id,
      vt.vehicle_type,
      vt.vehicle_desc,
      vc.id   AS collection_id,
      vc.name AS collection_name,
      vsc.id   AS sub_collection_id,
      vsc.name AS sub_collection_name
    FROM vehicletypes vt
    LEFT JOIN vehicles_collections     vc  ON vc.id  = vt.vc_id
    LEFT JOIN vehicles_sub_collections vsc ON vsc.id = vt.vsc_id
    ORDER BY vc.name ASC, vsc.name ASC, vt.vehicle_type ASC
  `);
  return rows;
}

module.exports = {
  getAllSlots,
  getSlotById,
  getSlotsWithBookings,
  getSlotConfiguration,
  createSlot,
  updateSlot,
  deactivateSlot,
  getVehicleTypes,
};