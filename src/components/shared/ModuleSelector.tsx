/**
 * ============================================
 * 🏠 MODULE SELECTOR — SkyWayHub Landing Page
 * ============================================
 * File: src/components/shared/ModuleSelector.tsx
 *
 * Enterprise module launcher.
 * To add a module: add one entry to MODULES. Nothing else changes.
 */

import { useState } from "react";
import { Search } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

const MODULES = [
  {
    id:          "fleet_management",
    label:       "Fleet Management",
    description: "Complete fleet overview, vehicle tracking, utilization reports and fleet analytics.",
    href:        "/fleet_management",
    tags:        ["Overview", "Tracking", "Utilization", "Analytics"],
    color:       "blue",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
      </svg>
    ),
  },
  {
    id:          "driver_management",
    label:       "Driver Management",
    description: "Driver profiles, licenses, documents, performance tracking and payroll.",
    href:        "/driver_management",
    tags:        ["Profiles", "Licenses", "Documents", "Performance", "Payroll"],
    color:       "teal",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M18 10v4m-2-2h4" />
      </svg>
    ),
  },
  {
    id:          "vehicle_maintenance",
    label:       "Fleet Maintenance",
    description: "Vehicle management, defects, repair orders and scheduled maintenance.",
    href:        "/vehicle_maintenance_module",
    tags:        ["Defects", "Repair Orders", "Fleet", "Maintenance"],
    color:       "sky",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    id:          "line_run",
    label:       "Line Run",
    description: "Client management, routes, trip setup, schedules and KM tracking.",
    href:        "/line_run_module",
    tags:        ["Clients", "Routes", "Schedules", "Settlements"],
    color:       "emerald",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
      </svg>
    ),
  },
  {
    id:          "contract",
    label:       "Contract",
    description: "Contract management, segments, pricing library and dispatch patterns.",
    href:        "/contract_module",
    tags:        ["Contracts", "Segments", "Pricing", "Dispatch"],
    color:       "violet",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    id:          "charter",
    label:       "Charter",
    description: "Charter business management, bookings, fleet allocation and customer contracts.",
    href:        "/charter_module",
    tags:        ["Charter", "Bookings", "Fleet", "Customers", "Contracts"],
    color:       "orange",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M12 8v4l3 3" />
      </svg>
    ),
  },
  {
    id:          "my_account",
    label:       "My Account",
    description: "Profile settings, organization preferences, billing and user management.",
    href:        "/account",
    tags:        ["Profile", "Settings", "Billing", "Users"],
    color:       "amber",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  {
    id:          "cash_management",
    label:       "Cash Management",
    description: "Manage expense types, accounts, voucher templates and financial reports.",
    href:        "/cash_management",
    tags:        ["Expense Types", "Accounts", "Vouchers", "Reports"],
    color:       "cyan",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id:          "dispatch_manager",
    label:       "Dispatch Manager",
    description: "Manage trips, dispatch chart, dashboard and booking statistics.",
    href:        "/dispatch_manager",
    tags:        ["Trips", "Dispatch Chart", "Dashboard", "Booking Stats"],
    color:       "indigo",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id:          "settings",
    label:       "Settings",
    description: "API settings, tax configuration, templates, company config and payouts.",
    href:        "/settings",
    tags:        ["API", "Tax", "Templates", "Pricing", "Payouts", "Availability"],
    color:       "rose",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    id:          "reports",
    label:       "Reports",
    description: "Cash reports, vehicle reports, driver reports, dispatch summary and analytics.",
    href:        "/reports",
    tags:        ["Cash", "Vehicle", "Driver", "Dispatch", "AR", "Commission", "Activity Logs"],
    color:       "emerald",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    id:          "client_management",
    label:       "Client Management",
    description: "Customer profiles, account management, communication history and client analytics.",
    href:        "/client_management",
    tags:        ["Customers", "Accounts", "Communication", "Analytics"],
    color:       "purple",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    id:          "company_management",
    label:       "Company Management",
    description: "Company profiles, branches, departments, roles and organizational structure.",
    href:        "/company_management",
    tags:        ["Branches", "Departments", "Roles", "Structure", "Settings"],
    color:       "pink",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  // ── Add future modules here ───────────────────────────
];

const C: Record<string, { bg: string; iconBg: string; iconText: string; border: string; tag: string; tagText: string; arrow: string }> = {
  blue:    { bg: "hover:border-blue-200 hover:shadow-blue-50",    iconBg: "bg-blue-50",    iconText: "text-blue-600",    border: "group-hover:border-blue-200",    tag: "bg-blue-50",    tagText: "text-blue-700",    arrow: "text-blue-600" },
  teal:    { bg: "hover:border-teal-200 hover:shadow-teal-50",    iconBg: "bg-teal-50",    iconText: "text-teal-600",    border: "group-hover:border-teal-200",    tag: "bg-teal-50",    tagText: "text-teal-700",    arrow: "text-teal-600" },
  sky:     { bg: "hover:border-sky-200 hover:shadow-sky-50",      iconBg: "bg-sky-50",     iconText: "text-sky-600",     border: "group-hover:border-sky-200",     tag: "bg-sky-50",     tagText: "text-sky-700",     arrow: "text-sky-600" },
  emerald: { bg: "hover:border-emerald-200 hover:shadow-emerald-50", iconBg: "bg-emerald-50", iconText: "text-emerald-600", border: "group-hover:border-emerald-200", tag: "bg-emerald-50", tagText: "text-emerald-700", arrow: "text-emerald-600" },
  violet:  { bg: "hover:border-violet-200 hover:shadow-violet-50",  iconBg: "bg-violet-50",  iconText: "text-violet-600",  border: "group-hover:border-violet-200",  tag: "bg-violet-50",  tagText: "text-violet-700",  arrow: "text-violet-600" },
  amber:   { bg: "hover:border-amber-200 hover:shadow-amber-50",    iconBg: "bg-amber-50",   iconText: "text-amber-600",   border: "group-hover:border-amber-200",   tag: "bg-amber-50",   tagText: "text-amber-700",   arrow: "text-amber-600" },
  rose:    { bg: "hover:border-rose-200 hover:shadow-rose-50",      iconBg: "bg-rose-50",    iconText: "text-rose-600",    border: "group-hover:border-rose-200",    tag: "bg-rose-50",    tagText: "text-rose-700",    arrow: "text-rose-600" },
  cyan:    { bg: "hover:border-cyan-200 hover:shadow-cyan-50",      iconBg: "bg-cyan-50",    iconText: "text-cyan-600",    border: "group-hover:border-cyan-200",    tag: "bg-cyan-50",    tagText: "text-cyan-700",    arrow: "text-cyan-600" },
  indigo:  { bg: "hover:border-indigo-200 hover:shadow-indigo-50",  iconBg: "bg-indigo-50",  iconText: "text-indigo-600",  border: "group-hover:border-indigo-200",  tag: "bg-indigo-50",  tagText: "text-indigo-700",  arrow: "text-indigo-600" },
  orange:  { bg: "hover:border-orange-200 hover:shadow-orange-50",  iconBg: "bg-orange-50",  iconText: "text-orange-600",  border: "group-hover:border-orange-200",  tag: "bg-orange-50",  tagText: "text-orange-700",  arrow: "text-orange-600" },
  purple:  { bg: "hover:border-purple-200 hover:shadow-purple-50",  iconBg: "bg-purple-50",  iconText: "text-purple-600",  border: "group-hover:border-purple-200",  tag: "bg-purple-50",  tagText: "text-purple-700",  arrow: "text-purple-600" },
  pink:    { bg: "hover:border-pink-200 hover:shadow-pink-50",      iconBg: "bg-pink-50",    iconText: "text-pink-600",    border: "group-hover:border-pink-200",    tag: "bg-pink-50",    tagText: "text-pink-700",    arrow: "text-pink-600" },
};

export function ModuleSelector() {
  const { user, logout } = useAuth();
  const [search, setSearch] = useState("");
  const currentYear = new Date().getFullYear();

  const filtered = MODULES.filter((m) =>
    !search ||
    m.label.toLowerCase().includes(search.toLowerCase()) ||
    m.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* ── Header ──────────────────────────────── */}
   <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="w-full px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 leading-none">SkyWayHub</p>
              <p className="text-xs text-gray-400 leading-none mt-0.5">Operations Platform</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-xs font-semibold text-blue-700">
                    {user.username?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="text-sm text-gray-600 hidden sm:block">{user.username}</span>
              </div>
            )}
            <button onClick={logout}
              className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200
                         px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* ── Page title ──────────────────────────── */}
      <div className="w-full px-8 pt-10 pb-6">
        <h1 className="text-xl font-semibold text-gray-900">
          Welcome back{user?.username ? `, ${user.username}` : ""}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Select a module to get started. You can switch between modules at any time.
        </p>
        <div className="relative mt-4 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search modules..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg
                       bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* ── Grid ────────────────────────────────── */}
      <main className="flex-1 w-full px-8 pb-10">
        <p className="text-xs text-gray-400 mb-3">
          {filtered.length} module{filtered.length !== 1 ? "s" : ""}
          {search && ` matching "${search}"`}
        </p>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <Search className="w-7 h-7 text-gray-300" />
            <p className="text-sm text-gray-400">No modules match "{search}"</p>
            <button onClick={() => setSearch("")} className="text-xs text-blue-600 hover:underline">
              Clear search
            </button>
          </div>
        ) : (
          <div className="grid gap-3"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
            {filtered.map((mod) => {
              const c = C[mod.color] ?? C.blue;
              return (
                <a key={mod.id} href={mod.href}
                  className={`group bg-white rounded-xl border border-gray-200 p-5
                               hover:shadow-md transition-all duration-150 flex flex-col gap-3
                               ${c.bg}`}>

                  {/* Icon */}
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center
                                   flex-shrink-0 ${c.iconBg} ${c.iconText}`}>
                    {mod.icon}
                  </div>

                  {/* Text */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-1">{mod.label}</h3>
                    <p className="text-xs text-gray-500 leading-relaxed">{mod.description}</p>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5">
                    {mod.tags.map((tag) => (
                      <span key={tag}
                        className={`px-2 py-0.5 text-xs rounded-full font-medium
                                    ${c.tag} ${c.tagText}`}>
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* CTA */}
                  <div className={`flex items-center gap-1 text-xs font-medium mt-auto
                                   ${c.arrow} group-hover:gap-2 transition-all`}>
                    Open module
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Professional Footer ──────────────────────────────── */}
      <footer className="bg-white border-t border-gray-100 mt-auto">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Left Section - Copyright */}
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-blue-600/10 flex items-center justify-center">
                <svg className="w-3 h-3 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </div>
              <p className="text-xs text-gray-500">
                © {currentYear} Skyway · All rights reserved
              </p>
            </div>

            {/* Center Section - Version & Status */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
                <span className="text-[11px] text-gray-400 font-mono">All systems operational</span>
              </div>
              <div className="w-px h-3 bg-gray-200"></div>
              <span className="text-[11px] text-gray-400 font-mono">v{currentYear}.1.0</span>
            </div>

            {/* Right Section - Modules Count */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 px-2 py-0.5 bg-gray-50 rounded-full">
                <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <span className="text-[11px] text-gray-500 font-medium">
                  {MODULES.length} Active Modules
                </span>
              </div>
              <div className="w-px h-3 bg-gray-200"></div>
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-gray-400">Skysoft Technologies</span>
              </div>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}