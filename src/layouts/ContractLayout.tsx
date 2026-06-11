/**
 * ============================================
 * 📄 CONTRACT LAYOUT
 * ============================================
 * File: src/layouts/ContractLayout.tsx
 *
 * Wraps all /contract_module/* routes.
 * Matches VM module design — white sidebar,
 * blue-600 active state, lucide-react icons.
 */

import { Outlet, useNavigate, useLocation } from "react-router";
import {
  LayoutDashboard,
  FileText,
  Layers,
  BookOpen,
  Truck,
  ArrowLeft,
  ChevronRight,
} from "lucide-react";

const NAV_ITEMS = [
  {
    section: "Main",
    items: [
      { label: "Dashboard",         path: "/contract_module/dashboard",          icon: LayoutDashboard },
    ],
  },
  {
    section: "Management",
    items: [
      { label: "Manage Contracts",  path: "/contract_module/contracts",          icon: FileText },
      { label: "Manage Segments",   path: "/contract_module/segments",           icon: Layers },
      { label: "Pricing Library",   path: "/contract_module/pricing",            icon: BookOpen },
      { label: "Dispatch Patterns", path: "/contract_module/dispatch-patterns",  icon: Truck },
    ],
  },
];

export function ContractLayout() {
  const navigate   = useNavigate();
  const location   = useLocation();

  const isActive = (path: string) =>
    location.pathname === path ||
    (path !== "/contract_module/dashboard" && location.pathname.startsWith(path));

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      {/* ── Sidebar ────────────────────────────────── */}
      <aside className="w-60 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">

        {/* Header */}
        <div className="h-14 flex items-center gap-3 px-4 border-b border-gray-200">
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center flex-shrink-0">
            <FileText className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 leading-tight">Contract</p>
            <p className="text-xs text-gray-500">SkyWayHub</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
          {NAV_ITEMS.map((group) => (
            <div key={group.section}>
              <p className="px-3 mb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                {group.section}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon    = item.icon;
                  const active  = isActive(item.path);
                  return (
                    <button
                      key={item.path}
                      onClick={() => navigate(item.path)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm
                                  transition-colors text-left
                                  ${active
                                    ? "bg-blue-50 text-blue-600 font-medium"
                                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"}`}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span className="flex-1">{item.label}</span>
                      {active && <ChevronRight className="w-3 h-3 opacity-60" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-200 p-2">
          <button
            onClick={() => navigate("/")}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-500
                       hover:bg-gray-50 hover:text-gray-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to modules
          </button>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

    </div>
  );
}