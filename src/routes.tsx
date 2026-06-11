import { createBrowserRouter } from "react-router";

// ── Shared ──────────────────────────────────────────────
import { ModuleSelector } from "./components/shared/ModuleSelector";
import { LrComingSoon }   from "./components/shared/LrComingSoon";

// ── Layouts ─────────────────────────────────────────────
import { VmLayout }       from "./layouts/VmLayout";
import { LrLayout }       from "./layouts/LrLayout";
import { ContractLayout } from "./layouts/ContractLayout";

// ── Vehicle Maintenance Pages ────────────────────────────
// (paths updated: ./components/ → ./components/vehicle_maintenance/)
import { Dashboard }                  from "./components/vehicle_maintenance/Dashboard";
import { ComprehensiveDashboard }     from "./components/vehicle_maintenance/ComprehensiveDashboard";
import { IntervalConfiguration }      from "./components/vehicle_maintenance/IntervalConfiguration";
import { MaintenanceDataSetup }       from "./components/vehicle_maintenance/MaintenanceDataSetup";
import { MaintenanceSchedule }        from "./components/vehicle_maintenance/MaintenanceSchedule";
import { ManageRO }                   from "./components/vehicle_maintenance/ManageRO";
import { ManagePaymentMethods }       from "./components/vehicle_maintenance/ManagePaymentMethods";
import { ManageVendors }              from "./components/vehicle_maintenance/ManageVendors";
import { RODashboard }                from "./components/vehicle_maintenance/RODashboard";
import { PreventiveMaintenance }      from "./components/vehicle_maintenance/PreventiveMaintenance";
import { FleetAvailability }          from "./components/vehicle_maintenance/FleetAvailability";
import { FleetCollection }            from "./components/vehicle_maintenance/FleetCollection";
import { FleetSubCollection }         from "./components/vehicle_maintenance/FleetSubCollection";
import { FleetTypes }                 from "./components/vehicle_maintenance/FleetTypes";
import { FleetManagement }            from "./components/vehicle_maintenance/FleetManagement";
import { ActivityLogs }               from "./components/vehicle_maintenance/ActivityLogs";
import { MessageCenter }              from "./components/vehicle_maintenance/MessageCenter";
import { ManageRepairCodeCategories } from "./components/vehicle_maintenance/ManageRepairCodeCategories";
import { MaintenanceHistory }         from "./components/vehicle_maintenance/MaintenanceHistory";
import { ManageDefectsEnhanced }      from "./components/vehicle_maintenance/ManageDefectsEnhanced";
import { UserAccessControl }          from "./components/vehicle_maintenance/UserAccessControl";
import { NotFound }                   from "./components/vehicle_maintenance/NotFound";
import FleetDashboard                 from "./components/vehicle_maintenance/FleetDashboard";
import { AIAssistance }               from "./components/vehicle_maintenance/AIAssistance";

// ── Contract Pages ───────────────────────────────────────
import { ContractDashboard } from "./components/contract/ContractDashboard";
import { ManageContracts }   from "./components/contract/ManageContracts";
import { ManageSegments }    from "./components/contract/ManageSegments";
import { PricingLibrary }    from "./components/contract/PricingLibrary";
import { DispatchPatterns }  from "./components/contract/DispatchPatterns";
// ── Dispatch Manager Pages ───────────────────────────────────────
import { DispatchManagerLayout } from "./layouts/DispatchManagerLayout";
import { DispatchChart } from "./components/dispatch/DispatchChart";
//import { DispatchDashboard } from "./components/dispatch/DispatchDashboard";
//import { ManageTrips } from "./components/dispatch/ManageTrips";
//import { BookingStatistics } from "./components/dispatch/BookingStatistics";

// ============================================
// 🌐 BASENAME
// ============================================
// Always "/" — the module paths (/vehicle_maintenance_module,
// /line_run_module) are now ROUTE paths, not the basename.
//
// Previously the old single-module routes.tsx used
// basename = "/vehicle_maintenance_module" so that all
// child routes were relative (e.g. "fleet-management").
//
// Now we have TWO modules as explicit top-level routes:
//   /vehicle_maintenance_module/fleet-management
//   /line_run_module/clients
//
// Using basename="/vehicle_maintenance_module" would
// cause double-up in production:
//   ❌ /vehicle_maintenance_module/vehicle_maintenance_module/fleet-management
//
// basename="/" means React Router resolves paths as-is. ✅
const getBasename = (): string => "/";

/**
 * ========================================
 * 🗺️ REACT ROUTER CONFIGURATION
 * ========================================
 *
 * This file defines all URL routes for the SkyWayHub Platform.
 * Each route maps a URL path to a specific component.
 *
 * BASE PATH:
 * - Vehicle Maintenance : /vehicle_maintenance_module/
 * - Line Run Module     : /line_run_module/
 * - Contract Module     : /contract_module/
 * - Root                : / (ModuleSelector)
 *
 * BENEFITS OF URL-BASED ROUTING:
 * ✅ Right-click menu items → "Open in new tab" works
 * ✅ Bookmark specific screens
 * ✅ Share direct URLs with colleagues
 * ✅ Browser back/forward buttons work
 * ✅ URL updates as you navigate
 * ✅ Professional web app behavior
 *
 * DATA PASSING BETWEEN SCREENS:
 * - URL Params: ?vehicleId=123&defectIds=1,2,3 (for temporary data)
 * - Router State: navigate('/path', { state: { data } }) (for complex objects)
 */

export const router = createBrowserRouter([

  // ========================================
  // 🏠 ROOT — Module Selector
  // ========================================
  {
    path: "/",
    Component: ModuleSelector,
  },

  // ========================================
  // 🔧 MODULE 1: Vehicle Maintenance
  // Base: /vehicle_maintenance_module
  // ========================================
  {
    path: "/vehicle_maintenance_module",
    element: <VmLayout />,
    children: [
      // ========================================
      // 🏠 HOME / DASHBOARD ROUTES
      // ========================================
      {
        index: true,
        Component: ManageDefectsEnhanced, // ✅ Default landing page: Manage All Defects
      },
      {
        path: "comprehensive-dashboard",
        Component: ComprehensiveDashboard,
      },
      {
        path: "dashboard",
        Component: Dashboard,
      },

      // ========================================
      // 🔧 MAINTENANCE ROUTES
      // ========================================
      {
        path: "interval-config",
        Component: IntervalConfiguration,
      },
      {
        path: "maintenance-setup",
        Component: MaintenanceDataSetup,
      },
      {
        path: "maintenance-schedule",
        Component: MaintenanceSchedule,
      },
      {
        path: "maintenance-history",
        Component: MaintenanceHistory,
      },
      {
        path: "preventive-maintenance",
        Component: PreventiveMaintenance,
      },

      // ========================================
      // 🚨 DEFECTS & REPAIR ORDERS
      // ========================================
      {
        path: "manage-defects",
        Component: ManageDefectsEnhanced,
      },
      {
        path: "repair-orders",
        Component: ManageRO,
      },
      {
        path: "ro-dashboard",
        Component: RODashboard,
      },
      {
        path: "manage-repair-code-categories",
        Component: ManageRepairCodeCategories,
      },

      // ========================================
      // 🚗 FLEET MANAGEMENT ROUTES
      // ========================================
      {
        path: "fleet-management",
        Component: FleetManagement,
      },
      {
        path: "fleet-availability",
        Component: FleetAvailability,
      },
      {
        path: "fleet-collection",
        Component: FleetCollection,
      },
      {
        path: "fleet-sub-collection",
        Component: FleetSubCollection,
      },
      {
        path: "fleet-types",
        Component: FleetTypes,
      },
      {
        path: "fleet-dashboard",       // ✅ lowercase with hyphen
        Component: FleetDashboard,     // ✅ matches the import
      },

      // ========================================
      // 💰 VENDOR & PAYMENT ROUTES
      // ========================================
      {
        path: "manage-vendors",
        Component: ManageVendors,
      },
      {
        path: "manage-payment-methods",
        Component: ManagePaymentMethods,
      },

      // ========================================
      // ⚙️ SYSTEM & ADMIN ROUTES
      // ========================================
      {
        path: "activity-logs",
        Component: ActivityLogs,
      },
      {
        path: "user-access-control",
        Component: UserAccessControl,
      },

      // ========================================
      // 🤖 AI ASSISTANCE
      // ========================================
      {
        path: "ai-assistance",
        Component: AIAssistance,
      },

      // ========================================
      // 💬 MESSAGE CENTER
      // ========================================
      {
        path: "message-center",
        Component: MessageCenter,
      },

      // ========================================
      // 🚫 404 NOT FOUND (Catch-all route)
      // ========================================
      {
        path: "*",
        Component: NotFound,
      },
    ],
  },

  // ========================================
  // 🚌 MODULE 2: Line Run
  // Base: /line_run_module
  // Real components added in Phase 3
  // ========================================
  {
    path: "/line_run_module",
    element: <LrLayout />,
    children: [
      { index: true,           Component: LrComingSoon },
      { path: "dashboard",     Component: LrComingSoon },
      { path: "clients",       Component: LrComingSoon },
      { path: "companies",     Component: LrComingSoon },
      { path: "routes",        Component: LrComingSoon },
      { path: "trip-setup",    Component: LrComingSoon },
      { path: "schedules",     Component: LrComingSoon },
      { path: "tshirt-sizing", Component: LrComingSoon },
      { path: "settlements",   Component: LrComingSoon },
      { path: "expenses",      Component: LrComingSoon },
      { path: "reports",       Component: LrComingSoon },
      { path: "events",        Component: LrComingSoon },
      { path: "*",             Component: NotFound },
    ],
  },

  // ========================================
  // 📄 MODULE 3: Contract
  // Base: /contract_module
  // ========================================
  {
    path: "/contract_module",
    element: <ContractLayout />,
    children: [
      { index: true,                Component: ContractDashboard },
      { path: "dashboard",          Component: ContractDashboard },
      { path: "contracts",          Component: ManageContracts },
      { path: "segments",           Component: ManageSegments },
      { path: "pricing",            Component: PricingLibrary },
      { path: "dispatch-patterns",  Component: DispatchPatterns },
      { path: "*",                  Component: NotFound },
    ],
  },
// ========================================
// 📊 MODULE 4: Dispatch Manager
// Base: /dispatch_manager
// ========================================
{
  path: "/dispatch_manager",
  element: <DispatchManagerLayout />, // You'll need to create this layout
  children: [
    { index: true,                Component: DispatchChart },  // Default page
    { path: "dispatch-chart",     Component: DispatchChart },
   
    { path: "*",                  Component: NotFound },
  ],
},
  // Global 404
  {
    path: "*",
    Component: NotFound,
  },

], {
  basename: getBasename()
});