/**
 * ============================================
 * 🚌 LINE RUN LAYOUT
 * ============================================
 * File: src/layouts/LrLayout.tsx
 *
 * Wraps all /line_run_module/* routes.
 * Same design system as VmLayout — zinc/new-york,
 * Tailwind, shadcn/ui, lucide-react icons.
 *
 * LrTopNav will be added in Phase 3 when LR
 * components are copied in. Using placeholder now.
 */

import { Outlet } from "react-router";

export function LrLayout() {
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      {/* ── Sidebar ─────────────────────────── */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">

        {/* Logo / Module Header */}
        <div className="h-16 flex items-center gap-3 px-5 border-b border-gray-200">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 leading-tight">Line Run</p>
            <p className="text-xs text-gray-500">SkyWayHub</p>
          </div>
        </div>

        {/* Navigation — will be replaced by LrTopNav in Phase 3 */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          <NavItem href="/line_run_module/dashboard"     label="Dashboard" />
          <NavItem href="/line_run_module/clients"       label="Clients" />
          <NavItem href="/line_run_module/companies"     label="Companies" />
          <NavItem href="/line_run_module/routes"        label="Routes" />
          <NavItem href="/line_run_module/trip-setup"    label="Trip Setup" />
          <NavItem href="/line_run_module/schedules"     label="Schedules" />
          <NavItem href="/line_run_module/tshirt-sizing" label="T-Shirt Sizing" />
          <NavItem href="/line_run_module/settlements"   label="Settlements" />
          <NavItem href="/line_run_module/expenses"      label="Expenses" />
          <NavItem href="/line_run_module/reports"       label="Reports" />
          <NavItem href="/line_run_module/events"        label="Events" />
        </nav>

        {/* Footer — switch module */}
        <div className="border-t border-gray-200 p-3">
          <a
            href="/vehicle_maintenance_module"
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600
                       hover:bg-gray-50 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            Switch to Fleet Maintenance
          </a>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────── */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        <Outlet />
      </main>

    </div>
  );
}

// ── Internal nav item helper ──────────────────
function NavItem({ href, label }: { href: string; label: string }) {
  const isActive = typeof window !== "undefined" &&
    window.location.pathname.startsWith(href);

  return (
    <a
      href={href}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                  transition-colors ${
                    isActive
                      ? "bg-blue-50 text-blue-600 font-medium"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
    >
      {label}
    </a>
  );
}
