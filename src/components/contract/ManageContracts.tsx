/**
 * ============================================
 * 📄 MANAGE CONTRACTS
 * ============================================
 * File: src/components/contract/ManageContracts.tsx
 */

import { useEffect, useState, useCallback } from "react";
import { Plus, Search, FileText, Edit, Eye, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "../../config/api";

// ── Types ─────────────────────────────────────────────────
type ContractStatus = "SCHEDULED" | "ONRUN" | "FINISHED" | "CANCELED";
type DialogMode     = "view" | "edit" | "create" | null;

interface Contract {
  id: number;
  contract_number: string;
  client_name: string;
  contact_name: string | null;
  sales_rep_name: string;
  contract_start_date: string;
  contract_end_date: string;
  no_of_vehicles: number;
  no_of_drivers: number;
  contract_base_amount: number;
  contract_total_amount: number;
  status: ContractStatus;
  segment_count: number;
  created_on: string;
}

interface FormData {
  client: string;
  contact: string;
  sales_rep: string;
  contract_start_date: string;
  contract_end_date: string;
  no_of_vehicles: number;
  no_of_drivers: number;
  contract_description: string;
  contract_base_amount: number;
  contract_tax_amount: number;
  contract_total_amount: number;
  is_hst: number;
  status: ContractStatus;
}

// ── Constants ─────────────────────────────────────────────
const STATUS_STYLES: Record<ContractStatus, string> = {
  SCHEDULED: "bg-blue-50 text-blue-700",
  ONRUN:     "bg-green-50 text-green-700",
  FINISHED:  "bg-violet-50 text-violet-700",
  CANCELED:  "bg-red-50 text-red-700",
};

const DEFAULT_FORM: FormData = {
  client: "",
  contact: "",
  sales_rep: "",
  contract_start_date: "",
  contract_end_date: "",
  no_of_vehicles: 1,
  no_of_drivers: 0,
  contract_description: "",
  contract_base_amount: 0,
  contract_tax_amount: 0,
  contract_total_amount: 0,
  is_hst: 1,
  status: "SCHEDULED",
};

const PAGE_SIZE = 15;

// ── Component ─────────────────────────────────────────────
export function ManageContracts() {
  const [contracts, setContracts]   = useState<Contract[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [search, setSearch]         = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [currentPage, setCurrentPage]   = useState(1);
  const [dialogMode, setDialogMode]     = useState<DialogMode>(null);
  const [selected, setSelected]         = useState<Contract | null>(null);
  const [formData, setFormData]         = useState<FormData>(DEFAULT_FORM);
  const [saving, setSaving]             = useState(false);

  // ── Fetch ──────────────────────────────────────────────
  const fetchContracts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch("/contracts");
      if (res.success) setContracts(res.data);
    } catch (err: any) {
      setError(err.message || "Failed to load contracts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchContracts(); }, [fetchContracts]);

  // ── Filter + Paginate ──────────────────────────────────
  const filtered = contracts.filter((c) => {
    const matchSearch = !search ||
      c.contract_number.toLowerCase().includes(search.toLowerCase()) ||
      c.client_name.toLowerCase().includes(search.toLowerCase()) ||
      c.sales_rep_name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "ALL" || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalPages  = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated   = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => { setCurrentPage(1); }, [search, statusFilter]);

  // ── Stats ──────────────────────────────────────────────
  const stats = {
    total:     contracts.length,
    scheduled: contracts.filter((c) => c.status === "SCHEDULED").length,
    onrun:     contracts.filter((c) => c.status === "ONRUN").length,
    canceled:  contracts.filter((c) => c.status === "CANCELED").length,
  };

  // ── Dialog helpers ─────────────────────────────────────
  const openCreate = () => {
    setSelected(null);
    setFormData(DEFAULT_FORM);
    setDialogMode("create");
  };

  const openView = (c: Contract) => {
    setSelected(c);
    setDialogMode("view");
  };

  const openEdit = (c: Contract) => {
    setSelected(c);
    setFormData({
      client:                  String(c.client_name),
      contact:                 c.contact_name ?? "",
      sales_rep:               c.sales_rep_name,
      contract_start_date:     c.contract_start_date,
      contract_end_date:       c.contract_end_date,
      no_of_vehicles:          c.no_of_vehicles,
      no_of_drivers:           c.no_of_drivers,
      contract_description:    "",
      contract_base_amount:    c.contract_base_amount,
      contract_tax_amount:     0,
      contract_total_amount:   c.contract_total_amount,
      is_hst:                  1,
      status:                  c.status,
    });
    setDialogMode("edit");
  };

  const closeDialog = () => {
    setDialogMode(null);
    setSelected(null);
    setFormData(DEFAULT_FORM);
  };

  const set = (patch: Partial<FormData>) =>
    setFormData((prev) => ({ ...prev, ...patch }));

  // ── Save ───────────────────────────────────────────────
  const handleSave = async () => {
    if (!formData.client || !formData.contract_start_date || !formData.contract_end_date) {
      toast.error("Client, start date and end date are required");
      return;
    }
    try {
      setSaving(true);
      if (dialogMode === "create") {
        const res = await apiFetch("/contracts", {
          method: "POST",
          body: JSON.stringify(formData),
        });
        if (res.success) {
          toast.success("Contract created successfully");
          closeDialog();
          void fetchContracts();
        }
      } else if (dialogMode === "edit" && selected) {
        const res = await apiFetch(`/contracts/${selected.id}`, {
          method: "PUT",
          body: JSON.stringify(formData),
        });
        if (res.success) {
          toast.success("Contract updated successfully");
          closeDialog();
          void fetchContracts();
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save contract");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────
  const handleDelete = (c: Contract) => {
    toast(
      (t) => (
        <div className="flex items-center gap-3">
          <span className="text-sm">Delete <strong>{c.contract_number}</strong>?</span>
          <button
            className="bg-red-600 text-white text-xs px-2 py-1 rounded"
            onClick={async () => {
              try {
                await apiFetch(`/contracts/${c.id}`, { method: "DELETE" });
                toast.dismiss(t.id);
                toast.success("Contract deleted");
                void fetchContracts();
              } catch (err: any) {
                toast.error(err.message);
              }
            }}
          >
            Delete
          </button>
          <button className="text-xs text-gray-500" onClick={() => toast.dismiss(t.id)}>
            Cancel
          </button>
        </div>
      ),
      { duration: 5000 }
    );
  };

  const isReadOnly = dialogMode === "view";

  // ── Render ─────────────────────────────────────────────
  return (
    <div className="space-y-6 p-4 md:p-6">

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Manage contracts</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {contracts.length} contract{contracts.length !== 1 ? "s" : ""} total
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700
                     text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> New contract
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200
                        rounded-lg text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total",     value: stats.total,     color: "text-gray-900" },
          { label: "Scheduled", value: stats.scheduled, color: "text-blue-700" },
          { label: "On run",    value: stats.onrun,     color: "text-green-700" },
          { label: "Canceled",  value: stats.canceled,  color: "text-red-700" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search contracts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="ALL">All status</option>
          <option value="SCHEDULED">Scheduled</option>
          <option value="ONRUN">On run</option>
          <option value="FINISHED">Finished</option>
          <option value="CANCELED">Canceled</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-gray-400">
            Loading...
          </div>
        ) : paginated.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <FileText className="w-8 h-8 text-gray-300" />
            <p className="text-sm text-gray-400">No contracts found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Contract #</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Client</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Sales rep</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Start</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">End</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Vehicles</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Segments</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {paginated.map((c) => (
                <tr key={c.id}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-blue-600 cursor-pointer"
                    onClick={() => openView(c)}>
                    {c.contract_number}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{c.client_name}</td>
                  <td className="px-4 py-3 text-gray-500">{c.sales_rep_name}</td>
                  <td className="px-4 py-3 text-gray-500">{c.contract_start_date}</td>
                  <td className="px-4 py-3 text-gray-500">{c.contract_end_date}</td>
                  <td className="px-4 py-3 text-gray-700">{c.no_of_vehicles}</td>
                  <td className="px-4 py-3 text-gray-700">{c.segment_count}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium
                                      ${STATUS_STYLES[c.status]}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openView(c)}
                        className="p-1 text-gray-400 hover:text-blue-600 transition-colors">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button onClick={() => openEdit(c)}
                        className="p-1 text-gray-400 hover:text-blue-600 transition-colors">
                        <Edit className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">
            Showing {(currentPage - 1) * PAGE_SIZE + 1}–
            {Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded border border-gray-200 disabled:opacity-40
                         hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 text-gray-700">{currentPage} / {totalPages}</span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded border border-gray-200 disabled:opacity-40
                         hover:bg-gray-50 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Dialog ──────────────────────────────────────── */}
      {dialogMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.45)" }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh]
                          overflow-y-auto">

            {/* Dialog Header */}
            <div className="flex items-center justify-between px-6 py-4
                            border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">
                {dialogMode === "create" ? "New contract"
                 : dialogMode === "edit" ? "Edit contract"
                 : `Contract — ${selected?.contract_number}`}
              </h2>
              <button onClick={closeDialog}
                className="text-gray-400 hover:text-gray-600 transition-colors text-lg">
                ✕
              </button>
            </div>

            {/* Dialog Body */}
            <div className="px-6 py-5 space-y-5">

              {/* Client + Sales Rep */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Client <span className="text-red-500">*</span>
                  </label>
                  {isReadOnly
                    ? <p className="text-sm text-gray-900">{selected?.client_name || "—"}</p>
                    : <input type="text" value={formData.client}
                        onChange={(e) => set({ client: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                                   focus:outline-none focus:ring-2 focus:ring-blue-500" />}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sales rep
                  </label>
                  {isReadOnly
                    ? <p className="text-sm text-gray-900">{selected?.sales_rep_name || "—"}</p>
                    : <input type="text" value={formData.sales_rep}
                        onChange={(e) => set({ sales_rep: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                                   focus:outline-none focus:ring-2 focus:ring-blue-500" />}
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start date <span className="text-red-500">*</span>
                  </label>
                  {isReadOnly
                    ? <p className="text-sm text-gray-900">{selected?.contract_start_date || "—"}</p>
                    : <input type="date" value={formData.contract_start_date}
                        onChange={(e) => set({ contract_start_date: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                                   focus:outline-none focus:ring-2 focus:ring-blue-500" />}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End date <span className="text-red-500">*</span>
                  </label>
                  {isReadOnly
                    ? <p className="text-sm text-gray-900">{selected?.contract_end_date || "—"}</p>
                    : <input type="date" value={formData.contract_end_date}
                        onChange={(e) => set({ contract_end_date: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                                   focus:outline-none focus:ring-2 focus:ring-blue-500" />}
                </div>
              </div>

              {/* Vehicles + Drivers */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vehicles</label>
                  {isReadOnly
                    ? <p className="text-sm text-gray-900">{selected?.no_of_vehicles}</p>
                    : <input type="number" min={1} value={formData.no_of_vehicles}
                        onChange={(e) => set({ no_of_vehicles: +e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                                   focus:outline-none focus:ring-2 focus:ring-blue-500" />}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Drivers</label>
                  {isReadOnly
                    ? <p className="text-sm text-gray-900">{selected?.no_of_drivers}</p>
                    : <input type="number" min={0} value={formData.no_of_drivers}
                        onChange={(e) => set({ no_of_drivers: +e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                                   focus:outline-none focus:ring-2 focus:ring-blue-500" />}
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                {isReadOnly
                  ? <span className={`px-2 py-0.5 rounded-full text-xs font-medium
                                      ${STATUS_STYLES[selected?.status ?? "SCHEDULED"]}`}>
                      {selected?.status}
                    </span>
                  : <select value={formData.status}
                      onChange={(e) => set({ status: e.target.value as any })}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                                 focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="SCHEDULED">Scheduled</option>
                      <option value="ONRUN">On run</option>
                      <option value="FINISHED">Finished</option>
                      <option value="CANCELED">Canceled</option>
                    </select>}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                {isReadOnly
                  ? <p className="text-sm text-gray-900">{selected?.contract_number || "—"}</p>
                  : <textarea rows={3} value={formData.contract_description}
                      onChange={(e) => set({ contract_description: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                                 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />}
              </div>

            </div>

            {/* Dialog Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4
                            border-t border-gray-100">
              {isReadOnly ? (
                <>
                  <button onClick={closeDialog}
                    className="px-4 py-2 text-sm border border-gray-200 rounded-lg
                               hover:bg-gray-50 transition-colors">
                    Close
                  </button>
                  <button onClick={() => selected && openEdit(selected)}
                    className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700
                               text-white rounded-lg transition-colors">
                    Edit
                  </button>
                </>
              ) : (
                <>
                  <button onClick={closeDialog}
                    className="px-4 py-2 text-sm border border-gray-200 rounded-lg
                               hover:bg-gray-50 transition-colors">
                    Cancel
                  </button>
                  <button onClick={handleSave} disabled={saving}
                    className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700
                               text-white rounded-lg transition-colors disabled:opacity-60">
                    {saving ? "Saving..." : "Save"}
                  </button>
                </>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
