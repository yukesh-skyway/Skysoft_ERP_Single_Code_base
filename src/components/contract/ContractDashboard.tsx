/**
 * ============================================
 * 📄 CONTRACT DASHBOARD
 * ============================================
 * File: src/components/contract/ContractDashboard.tsx
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { FileText, Layers, BookOpen, Truck, TrendingUp, AlertCircle } from "lucide-react";
import { apiFetch } from "../../config/api";

interface DashboardStats {
  total_contracts: number;
  scheduled: number;
  onrun: number;
  finished: number;
  canceled: number;
  total_segments: number;
  active_segments: number;
  total_pricing_configs: number;
}

interface RecentContract {
  id: number;
  contract_number: string;
  client_name: string;
  sales_rep_name: string;
  contract_start_date: string;
  contract_end_date: string;
  status: string;
  segment_count: number;
}

const STATUS_STYLES: Record<string, string> = {
  SCHEDULED: "bg-blue-50 text-blue-700",
  ONRUN:     "bg-green-50 text-green-700",
  FINISHED:  "bg-violet-50 text-violet-700",
  CANCELED:  "bg-red-50 text-red-700",
};

export function ContractDashboard() {
  const navigate = useNavigate();

  const [stats, setStats]     = useState<DashboardStats | null>(null);
  const [recent, setRecent]   = useState<RecentContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [statsRes, recentRes] = await Promise.all([
          apiFetch("/contracts/dashboard/stats"),
          apiFetch("/contracts/recent"),
        ]);
        if (statsRes.success)  setStats(statsRes.data);
        if (recentRes.success) setRecent(recentRes.data);
      } catch (err: any) {
        setError(err.message || "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const statCards = [
    { label: "Total contracts",  value: stats?.total_contracts  ?? 0, color: "text-gray-900",   bg: "bg-white" },
    { label: "Scheduled",        value: stats?.scheduled        ?? 0, color: "text-blue-700",   bg: "bg-blue-50" },
    { label: "On run",           value: stats?.onrun            ?? 0, color: "text-green-700",  bg: "bg-green-50" },
    { label: "Total segments",   value: stats?.total_segments   ?? 0, color: "text-violet-700", bg: "bg-violet-50" },
  ];

  const quickLinks = [
    { label: "Manage contracts",  icon: FileText,  path: "/contract_module/contracts",         desc: "View and manage all contracts" },
    { label: "Manage segments",   icon: Layers,    path: "/contract_module/segments",           desc: "All segments across contracts" },
    { label: "Pricing library",   icon: BookOpen,  path: "/contract_module/pricing",            desc: "Pricing configs for contracts" },
    { label: "Dispatch patterns", icon: Truck,     path: "/contract_module/dispatch-patterns",  desc: "Named recurring dispatch patterns" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-gray-500">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">

      {/* ── Page Header ─────────────────────────── */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Contract Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Overview of all contracts and segments</p>
      </div>

      {/* ── Error ───────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ── Stat Cards ──────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div key={card.label}
            className={`${card.bg} rounded-xl border border-gray-200 p-5`}>
            <p className="text-sm text-gray-500">{card.label}</p>
            <p className={`text-3xl font-bold mt-1 ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* ── Quick Links ─────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Quick access</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <button
                key={link.path}
                onClick={() => navigate(link.path)}
                className="bg-white border border-gray-200 rounded-xl p-4 text-left
                           hover:border-blue-300 hover:shadow-sm transition-all group"
              >
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center
                                mb-3 group-hover:bg-blue-100 transition-colors">
                  <Icon className="w-4 h-4 text-blue-600" />
                </div>
                <p className="text-sm font-medium text-gray-900">{link.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{link.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Recent Contracts ────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">Recent contracts</h2>
          <button
            onClick={() => navigate("/contract_module/contracts")}
            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
          >
            View all <TrendingUp className="w-3 h-3" />
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {recent.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <FileText className="w-8 h-8 text-gray-300" />
              <p className="text-sm text-gray-400">No contracts yet</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Contract</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Client</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Start</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">End</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Segments</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((c) => (
                  <tr key={c.id}
                    onClick={() => navigate("/contract_module/contracts")}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer">
                    <td className="px-4 py-3 font-medium text-blue-600">{c.contract_number}</td>
                    <td className="px-4 py-3 text-gray-700">{c.client_name}</td>
                    <td className="px-4 py-3 text-gray-500">{c.contract_start_date}</td>
                    <td className="px-4 py-3 text-gray-500">{c.contract_end_date}</td>
                    <td className="px-4 py-3 text-gray-700">{c.segment_count}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium
                                        ${STATUS_STYLES[c.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </div>
  );
}
