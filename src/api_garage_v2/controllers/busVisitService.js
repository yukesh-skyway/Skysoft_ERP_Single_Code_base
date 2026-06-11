'use strict';

const db = require('../db/connection');

/**
 * busVisitService.js
 *
 * Handles incoming bus visit webhook payloads.
 * Updates the `vehicles` table with the latest visit status.
 *
 * Event-aware: only touches `bus_visit_status` (and `updated_at`)
 * — no other vehicle fields are overwritten.
 */

/**
 * Valid statuses expected from the garage webhook.
 * Adjust this list to match whatever your garage sends.
 */
const VALID_STATUSES = [
  'OPEN',
  'IN_PROGRESS',
  'CLOSED',
  'CANCELLED',
];

/**
 * updateVehicleBusVisitStatus
 *
 * * Finds the vehicle by vehicle_nickname from payload
 * and updates only the `bus_visit_status` field.
 *
 * @param {object} payload - Raw request body from busVisit endpoint
 * @param {number} payload.visit_id      - Bus visit ID
 * @param {string|number} payload.vehicle - Vehicle nickname / bus number
 * @param {string} payload.status        - New visit status
 * @param {number} userId                - Authenticated user from req.apiToken.userId
 * @returns {object} result
 */
async function updateVehicleBusVisitStatus(payload, userId) {
  const { visit_id, vehicle, status } = payload;
const vehicleNick = String(vehicle).trim();
  // ── 1. Validate required fields ──────────────────────────────────────────
  if (!visit_id) {
    throw new Error('visit_id is required');
  }

  if (!vehicle) {
    throw new Error('vehicle is required');
  }

  if (!status) {
    throw new Error('status is required');
  }
const normalizedStatus = String(status).trim().toUpperCase();

if (!VALID_STATUSES.includes(normalizedStatus)) {
    throw new Error(
      `Invalid status "${normalizedStatus}". Must be one of: ${VALID_STATUSES.join(', ')}`
    );
  }

  // ── 2. Check vehicle exists ───────────────────────────────────────────────
const [rows] = await db.query(
  `SELECT id, vehicle_nickname, bus_visit_status
   FROM vehicles
   WHERE vehicle_nickname = ?
   LIMIT 1`,
  [vehicleNick]
);

  if (!rows || rows.length === 0) {
  throw new Error(
  `Vehicle nickname "${vehicle}" not found in vehicles table`
);
  }


const currentStatus = rows[0].bus_visit_status || null;
  // ── 3. Skip update if status hasn't changed ───────────────────────────────
if (String(currentStatus).trim() === normalizedStatus) {
  return {
    vehicle_nickname: vehicleNick,
    visit_id,
    action: 'skipped',
    reason: `Status is already "${normalizedStatus}" — no update needed`,
  };
}

  // ── 4. Update ONLY bus_visit_status ──────────────────────────────────────
await db.query(
  `UPDATE vehicles
      SET bus_visit_status = ?
    WHERE vehicle_nickname = ?`,
  [normalizedStatus, vehicleNick]
);


return {
  vehicle_nickname: vehicleNick,
  visit_id,
  action: 'updated',
  previous_status: currentStatus,
  new_status: normalizedStatus,
};
}

module.exports = { updateVehicleBusVisitStatus };