/**
 * GarageRepairItemsModal.tsx
 *
 * Reuses the existing RO details endpoint (API_ENDPOINTS.repairOrders.details)
 * — the same one ViewRepairOrder uses — so NO new backend endpoint is needed.
 *
 * Strategy:
 *   1. Fetch repairOrders.details(linkedToRoid)
 *   2. Search repairs[] and scheduledMaintenance[] for the item whose
 *      vrlid matches the defect's vrlid
 *   3. Render that item's garage_repair_items in a Garage-style modal
 *
 * ─── Usage in ManageDefectsEnhanced ──────────────────────────────────────────
 *
 *  // 1. Import
 *  import { GarageRepairItemsModal, GarageModalTarget } from './GarageRepairItemsModal';
 *
 *  // 2. State (near other modal states)
 *  const [garageModalDefect, setGarageModalDefect] = useState<GarageModalTarget | null>(null);
 *
 *  // 3. Open button — inside the Actions <td>, only show when linked_to_roid exists
 *  {defect.linked_to_roid && (
 *    <button
 *      onClick={() => setGarageModalDefect({
 *        vrlid:           defect.id,               // or defect.vrlid if your Defect type has it
 *        linkedToRoid:    defect.linked_to_roid!,
 *        vehicleNickname: defect.vehicle_nickname,
 *        repairDesc:      defect.repair_desc,
 *        categoryName:    defect.category_name,
 *      })}
 *      className="p-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
 *      title="View Garage repair items"
 *    >
 *      <Wrench className="w-5 h-5" />
 *    </button>
 *  )}
 *
 *  // 4. Render modal (bottom of return(), alongside ViewRepairOrder etc.)
 *  {garageModalDefect && (
 *    <GarageRepairItemsModal
 *      {...garageModalDefect}
 *      onClose={() => setGarageModalDefect(null)}
 *    />
 *  )}
 */

import React, { useEffect, useState } from 'react';
import {
  X, Wrench, User, AlertCircle,
  ChevronDown, ChevronRight,
} from 'lucide-react';
import { buildApiUrl, API_ENDPOINTS } from '../../config/api';

// ─── Types (mirrors ViewRepairOrder interfaces) ───────────────────────────────

interface GarageRepairNote {
  id: number;
  repair_item_id: number;
  garage_note_id: number;
  note: string;
  mechanicName: string | null;
  created_by: string | null;
  created_at: string;
}

interface MechanicAssignment {
  ma_id: number;
  repair_item_id: number;
  mechanic_name: string | null;
  bay_number: string | null;
  ma_status: string | null;
  approval_status: string | null;
  approved_by: string | null;
  approved_at: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  actual_start_datetime: string | null;
  actual_end_datetime: string | null;
  mechanic_challenge_notes: string | null;
  invoice_notes: string | null;
  invoice_hours: number;
  actual_hours: number;
  duration: number;
}

interface GarageRepairItem {
  ri_id: number;
  ro_repair_or_sm_id: number;
  garage_repair_id: number;
  ri_name: string;
  ri_description: string | null;
  estimated_hours: number;
  labor_cost: number;
  total_estimated_cost: number;
  total_actual_hours: number;
  ri_status: string;
  ri_defect_status: string;
  required_parts: string | null;
  ri_created_at: string;
  mechanic_assignments: MechanicAssignment[];
  notes: GarageRepairNote[];
}

export interface GarageModalTarget {
  vrlid: number;
  linkedToRoid: number;
  vehicleNickname: string;
  repairDesc: string | null;
  categoryName: string | null;
  workOrderNumber: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (d: string | null): string => {
  if (!d) return 'N/A';
  const dt = new Date(d);
  return (
    `${dt.getFullYear()}-` +
    `${String(dt.getMonth() + 1).padStart(2, '0')}-` +
    `${String(dt.getDate()).padStart(2, '0')} ` +
    `${String(dt.getHours()).padStart(2, '0')}:` +
    `${String(dt.getMinutes()).padStart(2, '0')}`
  );
};

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);

// ─── Badge helpers ─────────────────────────────────────────────────────────────

const WorkStatusBadge = ({ status }: { status: string | null }) => {
  if (!status) return <span className="text-xs text-gray-500">—</span>;
  const map: Record<string, string> = {
    Scheduled:  'bg-sky-100 text-sky-800 border-sky-200',
    Started:    'bg-green-100 text-green-800 border-green-200',
    Paused:     'bg-yellow-100 text-yellow-800 border-yellow-200',
    Completed:  'bg-emerald-100 text-emerald-800 border-emerald-200',
    Disengaged: 'bg-orange-100 text-orange-800 border-orange-200',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${map[status] ?? 'bg-gray-100 text-gray-700 border-gray-200'}`}>
      {status}
    </span>
  );
};

const ApprovalBadge = ({ status }: { status: string | null }) => {
  if (!status) return <span className="text-xs text-gray-500">—</span>;
  const map: Record<string, string> = {
    Pending:  'bg-yellow-100 text-yellow-800 border-yellow-200',
    Approved: 'bg-green-100 text-green-800 border-green-200',
    Rejected: 'bg-red-100 text-red-800 border-red-200',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${map[status] ?? 'bg-gray-100 text-gray-700 border-gray-200'}`}>
      {status}
    </span>
  );
};

// ─── RepairItemRow ─────────────────────────────────────────────────────────────

const RepairItemRow = ({
  item,
  index,
  total,
}: {
  item: GarageRepairItem;
  index: number;
  total: number;
}) => {
  const [open, setOpen] = useState(false);
  const firstMA = item.mechanic_assignments?.[0] ?? null;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">

      {/* Summary row */}
      <div
        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer select-none"
        onClick={() => setOpen(!open)}
      >
        {/* Index pill */}
        <span className="w-6 h-6 flex-shrink-0 rounded-full bg-gray-200 text-gray-700 text-xs font-semibold flex items-center justify-center">
          {index + 1}
        </span>

        {/* Name - flex-1 with min width */}
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900">{item.ri_name}</p>
            <span className="text-xs text-gray-500">#{item.garage_repair_id}</span>
            {total > 1 && (
              <span className="text-[10px] bg-blue-100 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded">
                {index + 1}/{total}
              </span>
            )}
          </div>
          {item.ri_description && (
            <p className="text-xs text-gray-600 mt-0.5 truncate">{item.ri_description}</p>
          )}
          {item.required_parts && (
            <p className="text-xs text-amber-700 mt-0.5">⚙ {item.required_parts}</p>
          )}
        </div>

        {/* Mechanic - wider */}
        <div className="w-40 flex-shrink-0 flex items-center gap-1.5">
          {firstMA ? (
            <>
              <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-medium text-indigo-700 flex-shrink-0">
                {(firstMA.mechanic_name || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-900 truncate">{firstMA.mechanic_name || 'Unassigned'}</p>
                {firstMA.bay_number && (
                  <p className="text-[10px] text-gray-500">Bay {firstMA.bay_number}</p>
                )}
              </div>
            </>
          ) : (
            <span className="text-xs text-gray-500">Unassigned</span>
          )}
        </div>

        {/* Est. hrs - wider */}
        <div className="w-20 flex-shrink-0 text-center">
          <p className="text-[10px] text-gray-500 font-medium">Est.</p>
          <p className="text-sm font-semibold text-gray-900">{item.estimated_hours ?? '—'} hrs</p>
        </div>

        {/* Actual hrs - wider */}
        <div className="w-20 flex-shrink-0 text-center">
          <p className="text-[10px] text-gray-500 font-medium">Actual</p>
          <p className="text-sm font-semibold text-gray-900">{item.total_actual_hours ?? '—'} hrs</p>
        </div>

        {/* Work status - wider */}
        <div className="w-32 flex-shrink-0">
          <WorkStatusBadge status={item.ri_status} />
        </div>

        {/* Approval - wider */}
        <div className="w-28 flex-shrink-0">
          <ApprovalBadge status={firstMA?.approval_status ?? null} />
        </div>

        {/* Toggle */}
        <div className="flex-shrink-0 text-gray-400">
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
      </div>

      {/* Expanded body */}
      {open && (
        <div className="bg-gray-50 border-t border-gray-200">
          {item.mechanic_assignments.length === 0 ? (
            <div className="flex flex-col items-center py-8">
              <User className="w-7 h-7 text-gray-400 mb-2" />
              <p className="text-sm text-gray-500">No mechanic assigned yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {item.mechanic_assignments.map((ma, maIdx) => (
                <div key={ma.ma_id} className="px-5 py-4">

                  {/* Assignment header */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-semibold text-indigo-700 flex-shrink-0">
                      {(ma.mechanic_name || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">{ma.mechanic_name || 'Unassigned'}</p>
                      <p className="text-xs text-gray-500">Bay {ma.bay_number || 'N/A'}</p>
                    </div>
                    <WorkStatusBadge status={ma.ma_status} />
                    <ApprovalBadge status={ma.approval_status} />
                    {item.mechanic_assignments.length > 1 && (
                      <span className="text-[10px] text-gray-500 flex-shrink-0">
                        Assignment {maIdx + 1}/{item.mechanic_assignments.length}
                      </span>
                    )}
                  </div>

                  {/* 4-col detail grid */}
                  <div className="grid grid-cols-4 gap-3 text-xs">
                    <div className="bg-white border border-gray-200 rounded-lg p-3">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1.5 font-semibold">Scheduled</p>
                      <p className="text-gray-800 font-medium">{fmt(ma.scheduled_start)}</p>
                      <p className="text-gray-600 mt-0.5">→ {fmt(ma.scheduled_end)}</p>
                    </div>

                    <div className="bg-teal-50 border border-teal-200 rounded-lg p-3">
                      <p className="text-[10px] text-teal-700 uppercase tracking-wide mb-1.5 font-semibold">Actual time</p>
                      <p className="text-teal-800 font-medium">{fmt(ma.actual_start_datetime)}</p>
                      <p className="text-teal-700 mt-0.5">→ {fmt(ma.actual_end_datetime)}</p>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-lg p-3">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1.5 font-semibold">Hours</p>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Invoice</span>
                        <span className="font-semibold text-gray-900">{ma.invoice_hours ?? '—'}</span>
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-gray-600">Actual</span>
                        <span className="font-semibold text-gray-900">{ma.actual_hours ?? '—'}</span>
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-gray-600">Duration</span>
                        <span className="font-semibold text-gray-900">{ma.duration ?? '—'}</span>
                      </div>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-lg p-3">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1.5 font-semibold">Approval</p>
                      <ApprovalBadge status={ma.approval_status} />
                      {ma.approved_by && (
                        <p className="text-gray-600 mt-1.5 text-xs">by {ma.approved_by}</p>
                      )}
                      {ma.approved_at && (
                        <p className="text-gray-500 mt-0.5 text-xs">{fmt(ma.approved_at)}</p>
                      )}
                    </div>
                  </div>

                  {/* Challenge / invoice notes */}
                  {(ma.mechanic_challenge_notes || ma.invoice_notes) && (
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      {ma.mechanic_challenge_notes && (
                        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                          <p className="text-[10px] text-red-600 uppercase tracking-wide mb-1 font-semibold">⚠ Challenge notes</p>
                          <p className="text-xs text-red-800">{ma.mechanic_challenge_notes}</p>
                        </div>
                      )}
                      {ma.invoice_notes && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                          <p className="text-[10px] text-blue-600 uppercase tracking-wide mb-1 font-semibold">Invoice notes</p>
                          <p className="text-xs text-blue-800">{ma.invoice_notes}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Mechanic notes */}
          {item.notes?.length > 0 && (
            <div className="border-t border-gray-200 px-5 py-4">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-3 font-semibold">
                Mechanic notes ({item.notes.length})
              </p>
              <div className="grid grid-cols-2 gap-2">
                {item.notes.map((note) => (
                  <div key={note.id} className="bg-white border border-gray-200 rounded-lg px-3 py-2.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-orange-100 flex items-center justify-center text-[10px] font-bold text-orange-700">
                          {(note.mechanicName || note.created_by || '?').charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs font-medium text-gray-800">
                          {note.mechanicName || note.created_by || 'Unknown'}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-500">{fmt(note.created_at)}</span>
                    </div>
                    <p className="text-xs text-gray-700 leading-relaxed">{note.note}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Main Modal ───────────────────────────────────────────────────────────────

interface Props extends GarageModalTarget {
  onClose: () => void;
}

export function GarageRepairItemsModal({
  vrlid,
  linkedToRoid,
  vehicleNickname,
  repairDesc,
  categoryName,
  workOrderNumber,
  onClose,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [garageItems, setGarageItems] = useState<GarageRepairItem[]>([]);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = buildApiUrl(API_ENDPOINTS.repairOrders.details(linkedToRoid));
        const res = await fetch(url, {
          headers: { 'ngrok-skip-browser-warning': 'true' },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Failed to load RO');

        const roData = data.data;

        const allItems: any[] = [
          ...(roData.repairs ?? []),
          ...(roData.scheduledMaintenance ?? []),
        ];

        const matched = allItems.find(
          (item) => Number(item.vrlid) === Number(vrlid),
        );
        setGarageItems(matched?.garage_repair_items ?? []);
      } catch (err: any) {
        setError(err.message ?? 'Unknown error');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [linkedToRoid, vrlid, retryKey]);

  const totalAssignments = garageItems.reduce(
    (sum, item) => sum + (item.mechanic_assignments?.length ?? 0), 0,
  );
  const totalCost = garageItems.reduce(
    (sum, item) => sum + (item.total_estimated_cost ?? 0), 0,
  );

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[140] flex items-center justify-center p-4"
      onClick={onClose}
    >
<div
  className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[90vh] flex flex-col overflow-hidden"
  onClick={(e) => e.stopPropagation()}
>
        {/* Header - Fixed: aligned to left */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-800 to-slate-700 text-white flex-shrink-0">
          <div className="flex items-center gap-4 flex-1">
            <div className="bg-white/15 p-2 rounded-lg flex-shrink-0">
              <Wrench className="w-5 h-5" />
            </div>
           <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>

{/* Vehicle */}
<div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#cbd5e1', borderRadius: '8px', padding: '6px 10px' }}>
  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="15" height="13" rx="2"/><path d="m16 8 4 4 3-1-1-4-6-1z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
    </svg>
  </div>
  <div>
    <p style={{ fontSize: '9px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0, lineHeight: 1 }}>Vehicle</p>
    <p style={{ fontSize: '13px', color: '#0f172a', fontWeight: 600, margin: 0, lineHeight: 1.3 }}>{vehicleNickname}</p>
  </div>
</div>

<span style={{ color: '#94a3b8', fontSize: '18px', fontWeight: 300 }}>→</span>

{/* Defect */}
<div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#bfdbfe', borderRadius: '8px', padding: '6px 10px' }}>
  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#93c5fd', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1e40af" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  </div>
  <div>
    <p style={{ fontSize: '9px', color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0, lineHeight: 1 }}>Defect</p>
    <p style={{ fontSize: '13px', color: '#1e3a8a', fontWeight: 600, margin: 0, lineHeight: 1.3 }}>#{vrlid}</p>
  </div>
</div>

<span style={{ color: '#94a3b8', fontSize: '18px', fontWeight: 300 }}>→</span>

{/* Repair Order */}
<div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#c7d2fe', borderRadius: '8px', padding: '6px 10px' }}>
  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#a5b4fc', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3730a3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
    </svg>
  </div>
  <div>
    <p style={{ fontSize: '9px', color: '#4338ca', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0, lineHeight: 1 }}>Repair Order</p>
    <p style={{ fontSize: '13px', color: '#312e81', fontWeight: 600, margin: 0, lineHeight: 1.3 }}>#{linkedToRoid}</p>
  </div>
</div>

<span style={{ color: '#94a3b8', fontSize: '18px', fontWeight: 300 }}>→</span>

{/* Work Order */}
<div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#a7f3d0', borderRadius: '8px', padding: '6px 10px' }}>
  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#6ee7b7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#065f46" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </svg>
  </div>
  <div>
    <p style={{ fontSize: '9px', color: '#047857', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0, lineHeight: 1 }}>Work Order</p>
    <p style={{ fontSize: '13px', color: '#064e3b', fontWeight: 600, margin: 0, lineHeight: 1.3 }}>
      {workOrderNumber ?? '—'}
    </p>
  </div>
</div>

</div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white hover:bg-white/15 p-1.5 rounded-lg transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-header - with better contrast */}
        <div className="flex items-center gap-4 px-6 py-3 bg-gray-100 border-b border-gray-200 flex-shrink-0 flex-wrap">
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">Category</p>
            <p className="text-sm font-medium text-gray-900">{categoryName || '—'}</p>
          </div>
          <div className="w-px h-8 bg-gray-300 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">Description</p>
            <p className="text-sm font-medium text-gray-900 truncate">{repairDesc || '—'}</p>
          </div>
          <div className="w-px h-8 bg-gray-300 flex-shrink-0" />
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-center min-w-[80px] shadow-sm">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">Repair items</p>
              <p className="text-base font-bold text-gray-900">{loading ? '…' : garageItems.length}</p>
            </div>
            <div className="bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-center min-w-[80px] shadow-sm">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">Assignments</p>
              <p className="text-base font-bold text-gray-900">{loading ? '…' : totalAssignments}</p>
            </div>
          </div>
        </div>

        {/* Column labels - better visibility */}
        {!loading && !error && garageItems.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-2 bg-gray-100 border-b border-gray-200 flex-shrink-0">
            <div className="w-6 flex-shrink-0"></div>
            <div className="flex-1 min-w-[200px]">
              <p className="text-[11px] font-bold text-gray-600 uppercase tracking-wide">Service request</p>
            </div>
            <div className="w-40 flex-shrink-0">
              <p className="text-[11px] font-bold text-gray-600 uppercase tracking-wide">Team / role</p>
            </div>
            <div className="w-20 flex-shrink-0 text-center">
              <p className="text-[11px] font-bold text-gray-600 uppercase tracking-wide">Est. hrs</p>
            </div>
            <div className="w-20 flex-shrink-0 text-center">
              <p className="text-[11px] font-bold text-gray-600 uppercase tracking-wide">Actual hrs</p>
            </div>
            <div className="w-32 flex-shrink-0">
              <p className="text-[11px] font-bold text-gray-600 uppercase tracking-wide">Work status</p>
            </div>
            <div className="w-28 flex-shrink-0">
              <p className="text-[11px] font-bold text-gray-600 uppercase tracking-wide">Approval</p>
            </div>
            <div className="w-4 flex-shrink-0"></div>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
          {loading && (
            <div className="flex flex-col items-center justify-center py-24">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-700 mb-4" />
              <p className="text-sm text-gray-600">Loading garage repair items…</p>
              <p className="text-xs text-gray-500 mt-1">Fetching from RO #{linkedToRoid}</p>
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center justify-center py-20">
              <AlertCircle className="w-10 h-10 text-red-500 mb-3" />
              <p className="text-sm font-medium text-gray-800 mb-1">Could not load data</p>
              <p className="text-xs text-gray-600 mb-4 max-w-xs text-center">{error}</p>
              <button
                onClick={() => setRetryKey((k) => k + 1)}
                className="px-4 py-2 text-sm font-medium text-white bg-slate-700 rounded-lg hover:bg-slate-800 transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && garageItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="bg-gray-200 rounded-full p-5 mb-4">
                <Wrench className="w-10 h-10 text-gray-400" />
              </div>
              <p className="text-base font-medium text-gray-700 mb-1">No garage work items linked</p>
              <p className="text-sm text-gray-500 max-w-xs">
                This defect is on RO #{linkedToRoid} but no repair items have been
                created for it in Garage yet.
              </p>
            </div>
          )}

          {!loading && !error && garageItems.map((item, idx) => (
            <RepairItemRow
              key={item.ri_id}
              item={item}
              index={idx}
              total={garageItems.length}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 bg-white border-t border-gray-200 flex-shrink-0">
          <p className="text-xs text-gray-600">
            {!loading && (
              <>
                {garageItems.length} repair item{garageItems.length !== 1 ? 's' : ''}
                {totalAssignments > 0 && ` · ${totalAssignments} assignment${totalAssignments !== 1 ? 's' : ''}`}
                {totalCost > 0 && ` · ${fmtCurrency(totalCost)} est. cost`}
              </>
            )}
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}