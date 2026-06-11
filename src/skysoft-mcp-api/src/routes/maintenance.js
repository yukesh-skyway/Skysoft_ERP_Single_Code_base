import { authenticate } from "../middleware/authenticate.js";
import {
  getMaintenanceRawQuery,
  getActiveDefectsQuery,
  getActiveRepairOrdersQuery
} from "../queries/maintenance.js";
import { calculateMaintenanceStatus } from "../services/maintenanceCalculator.js";

export default async function maintenanceRoutes(app) {

  app.get("/fleet-health", { preHandler: authenticate }, async (req, reply) => {

    // Run all three queries in parallel
    const [
      [maintenanceRows],
      [defectRows],
      [roRows]
    ] = await Promise.all([
      app.db.query(getMaintenanceRawQuery()),
      app.db.query(getActiveDefectsQuery()),
      app.db.query(getActiveRepairOrdersQuery())
    ]);

    // Index defects and ROs by vehicle_id for O(1) lookup
    const defectMap = {};
    for (const row of defectRows) {
      defectMap[row.vehicle_id] = {
        open_defect_count: row.open_defect_count,
        defects: typeof row.defects === 'string'
          ? JSON.parse(row.defects)
          : (row.defects || [])
      };
    }

    const roMap = {};
    for (const row of roRows) {
      roMap[row.vehicle_id] = {
        active_ro_count: row.active_ro_count,
        repair_orders: typeof row.repair_orders === 'string'
          ? JSON.parse(row.repair_orders)
          : (row.repair_orders || [])
      };
    }

    // Build fleet map from maintenance rows
    const fleetMap = {};

    for (const row of maintenanceRows) {
      const calc = calculateMaintenanceStatus(row);

      if (!fleetMap[row.vehicle_id]) {
        fleetMap[row.vehicle_id] = {
          vehicle_id:       row.vehicle_id,
          vehicle_nickname: row.vehicle_nickname,
          vehicle_number:   row.vehicle_number,
          vehicle_type:     row.vehicle_type,
          current_km:       parseFloat(row.current_km || 0),
          config_group:     row.configuration_name,
          overdue:          [],
          due_soon:         [],
          good:             [],
          missing_data:     []
        };
      }

      const v = fleetMap[row.vehicle_id];

      // Check missing data
      const missing = [];
      if (
        (row.interval_type === 'KMS' || row.interval_type === 'BOTH') &&
        row.kms > 0 &&
        (!row.last_replaced_km || row.last_replaced_km === '0')
      ) missing.push('last_replaced_km');

      if (
        (row.interval_type === 'DURATION' || row.interval_type === 'BOTH') &&
        row.days > 0 && !row.last_maintenance_date
      ) missing.push('last_maintenance_date');

      if (missing.length > 0) {
        v.missing_data.push({ setting: row.setting_name, missing });
        continue;
      }

      const item = {
        setting_name:      row.setting_name,
        maintenance_type:  row.maintenance_type,
        interval_type:     row.interval_type,
        primary_reason:    calc.primaryReason,
        kms_progress:      calc.kmsProgress,
        days_progress:     calc.daysProgress,
        next_service_date: calc.nextServiceDate,
        kms_remaining:     calc.kmsRemaining,
        days_remaining:    calc.daysRemaining
      };

      if (calc.status === 'OVERDUE')       v.overdue.push(item);
      else if (calc.status === 'DUE_SOON') v.due_soon.push(item);
      else                                  v.good.push(item);
    }

    // Build final fleet array — merge in defects + ROs
    const fleet = Object.values(fleetMap).map(v => {
      const defectData = defectMap[v.vehicle_id] || {
        open_defect_count: 0,
        defects: []
      };
      const roData = roMap[v.vehicle_id] || {
        active_ro_count: 0,
        repair_orders: []
      };

      return {
        ...v,
        // Maintenance health
        health_score:   v.overdue.length > 0 ? 'CRITICAL'
                      : v.due_soon.length > 0 ? 'WARNING'
                      : 'HEALTHY',
        overdue_count:  v.overdue.length,
        due_soon_count: v.due_soon.length,
        good_count:     v.good.length,
        total_items:    v.overdue.length + v.due_soon.length + v.good.length,

        // Active defects from vehicle_repair_logs
        open_defect_count: defectData.open_defect_count,
        open_defects:      defectData.defects,

        // Active repair orders from repair_purchase_orders + rpor
        active_ro_count: roData.active_ro_count,
        repair_orders:   roData.repair_orders
      };
    });

    // Sort — critical first, warning, healthy
    fleet.sort((a, b) => {
      const order = { CRITICAL: 0, WARNING: 1, HEALTHY: 2 };
      return order[a.health_score] - order[b.health_score];
    });

    return {
      success: true,
      summary: {
        total_vehicles:       fleet.length,
        critical:             fleet.filter(v => v.health_score === 'CRITICAL').length,
        warning:              fleet.filter(v => v.health_score === 'WARNING').length,
        healthy:              fleet.filter(v => v.health_score === 'HEALTHY').length,
        total_overdue:        fleet.reduce((s, v) => s + v.overdue_count, 0),
        total_due_soon:       fleet.reduce((s, v) => s + v.due_soon_count, 0),
        total_open_defects:   fleet.reduce((s, v) => s + v.open_defect_count, 0),
        total_active_ros:     fleet.reduce((s, v) => s + v.active_ro_count, 0)
      },
      fleet,
      timestamp: new Date().toISOString()
    };
  });
}