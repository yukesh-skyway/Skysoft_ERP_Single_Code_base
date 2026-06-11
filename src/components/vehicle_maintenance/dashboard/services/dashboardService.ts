/**
 * Dashboard API Service
 * Uses existing backend endpoints — no new routes needed.
 *
 * Endpoints consumed:
 *   GET /api/vehicles/statistics
 *   GET /api/maintenance-operations/overdue-due-soon
 */

const BASE = import.meta.env.VITE_API_BASE_URL || 'http://dev.strategyit.ca';

export interface FleetKpi {
  totalVehicles:   number;
  activeVehicles:  number;
  offlineVehicles: number;
  overdueCount:    number;
  dueSoonCount:    number;
  complianceRate:  number;
}

export async function fetchFleetKpis(): Promise<FleetKpi> {
  // Both requests fire in parallel
  const [statsRes, maintenanceRes] = await Promise.all([
    fetch(`${BASE}/api/vehicles/statistics`),
    fetch(`${BASE}/api/maintenance-operations/overdue-due-soon`),
  ]);

  if (!statsRes.ok)       throw new Error(`Vehicle statistics fetch failed: ${statsRes.status}`);
  if (!maintenanceRes.ok) throw new Error(`Maintenance fetch failed: ${maintenanceRes.status}`);

  const statsJson       = await statsRes.json();
  const maintenanceJson = await maintenanceRes.json();

  if (!statsJson.success)       throw new Error(statsJson.message       || 'Vehicle stats error');
  if (!maintenanceJson.success) throw new Error(maintenanceJson.message || 'Maintenance error');

  const stats   = statsJson.data;          // { total, active, inactive, archived, ... }
  const summary = maintenanceJson.summary; // { overdue_count, due_soon_count, affected_vehicles, ... }

  const overdue   = summary.overdue_count   ?? 0;
  const dueSoon   = summary.due_soon_count  ?? 0;
  const total     = stats.total             ?? 0;
  const active    = stats.active            ?? 0;
  const offline   = (stats.inactive ?? 0) + (stats.archived ?? 0);

  // Compliance = vehicles with NO overdue or due soon items / total active
  // Using affected_vehicles from summary as the "problem" count
  const affectedVehicles = summary.affected_vehicles ?? 0;
  const complianceRate   = active > 0
    ? Math.round(((active - affectedVehicles) / active) * 100)
    : 100;

  return {
    totalVehicles:   total,
    activeVehicles:  active,
    offlineVehicles: offline,
    overdueCount:    overdue,
    dueSoonCount:    dueSoon,
    complianceRate:  Math.max(0, Math.min(100, complianceRate)),
  };
}
