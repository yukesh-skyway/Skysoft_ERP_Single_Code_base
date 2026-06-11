import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { Scheduler, createRosterConfig } from "@/components/scheduler";
import type { Block, Resource, SchedulerToolbarContext } from "@/components/scheduler";
import {
  Maximize2, Minimize2, ZoomIn, ZoomOut,
  ChevronLeft, ChevronRight, Loader2,
} from "lucide-react";
import { apiFetch, API_ENDPOINTS } from "../../config/api";
import "./dispatch-chart.css";


// ─── TYPES ────────────────────────────────────────────────────────────────────
interface ApiSlot {
  id: number;
  slot_name: string;
  slot_type: "INTERNAL" | "OUTSOURCE";
  slot_order: number;
  slot_unique_id: string;
  status: number;
  vehicle_type_id: number | null;
  vehicle_type_name: string | null;
  collection_id: number | null;
  collection_name: string | null;
  sub_collection_id: number | null;
  sub_collection_name: string | null;
  bookings: ApiBooking[];
}

interface ApiBooking {
  booking_id: number;
  slot_id: number;
  booking_trip_date: string;        // "YYYY-MM-DD"
  booking_type: "CHARTER" | "CONTRACT";
  booking_status: number;           // 1=Allocated, 2=Confirmed, 3=Cancelled
  vehicle_leg_notes: string | null;
  driver_id: number | null;
  driver_name: string | null;
  driver_schedule_status: string | null;
  vehicle_id: number | null;
  vehicle_nickname: string | null;
  vehicle_number: string | null;
  outsource_company_name: string | null;
}

// ─── DATE HELPERS ─────────────────────────────────────────────────────────────
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun",
                      "Jul","Aug","Sep","Oct","Nov","Dec"];

function getWeekDates(d: Date): Date[] {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(mon);
    dd.setDate(mon.getDate() + i);
    return dd;
  });
}

function toYMD(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Returns [startDate, endDate] for the current view window + 1 week buffer */
function getDateRange(view: ViewType, date: Date): [string, string] {
  if (view === "day") {
    const start = new Date(date); start.setDate(start.getDate() - 1);
    const end   = new Date(date); end.setDate(end.getDate() + 1);
    return [toYMD(start), toYMD(end)];
  }
  if (view === "week") {
    const wd    = getWeekDates(date);
    const start = new Date(wd[0]); start.setDate(start.getDate() - 7);
    const end   = new Date(wd[6]); end.setDate(end.getDate() + 7);
    return [toYMD(start), toYMD(end)];
  }
  // month
  const start = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  const end   = new Date(date.getFullYear(), date.getMonth() + 2, 0);
  return [toYMD(start), toYMD(end)];
}

function buildRangeText(view: ViewType, date: Date): string {
  const y = date.getFullYear();
  const m = MONTHS_SHORT[date.getMonth()];
  if (view === "day") return `${m} ${date.getDate()}, ${y}`;
  if (view === "week") {
    const wd = getWeekDates(date);
    const sm = MONTHS_SHORT[wd[0].getMonth()];
    const em = MONTHS_SHORT[wd[6].getMonth()];
    return wd[0].getMonth() === wd[6].getMonth()
      ? `${sm} ${wd[0].getDate()} – ${wd[6].getDate()}, ${y}`
      : `${sm} ${wd[0].getDate()} – ${em} ${wd[6].getDate()}, ${y}`;
  }
  const lastDay = new Date(y, date.getMonth() + 1, 0).getDate();
  return `${m} 1 – ${m} ${lastDay}, ${y}`;
}

function shiftDate(date: Date, view: ViewType, dir: number): Date {
  const d = new Date(date);
  if (view === "day")   d.setDate(d.getDate() + dir);
  if (view === "week")  d.setDate(d.getDate() + dir * 7);
  if (view === "month") d.setMonth(d.getMonth() + dir);
  return d;
}

// ─── DATA TRANSFORM ───────────────────────────────────────────────────────────
// Maps API slots → scheduler Resource[] (categories + employees) + Block[]

function buildSchedulerData(apiSlots: ApiSlot[]): {
  categories: Resource[];
  employees:  Resource[];
  shifts:     Block[];
} {


const categories: Resource[] = [
  { id: "CONTRACT",  name: "Contract",  kind: "category" as const, colorIdx: 0 },
  { id: "CHARTER",   name: "Charter",   kind: "category" as const, colorIdx: 2 },
  { id: "OUTSOURCE", name: "Outsource", kind: "category" as const, colorIdx: 4 },
];

  // ── Employees: one per slot ───────────────────────────────────────────────
const employees: Resource[] = apiSlots.map((s) => ({
  id:         `slot-${s.id}`,
  name:       s.slot_name,
  kind:       "employee" as const,
  categoryId: s.slot_type === "OUTSOURCE" ? "OUTSOURCE" : "CONTRACT",
  colorIdx:   0,
}));

  // ── Shifts: one per booking ───────────────────────────────────────────────
  const shifts: Block[] = [];
  for (const slot of apiSlots) {
    for (const b of slot.bookings) {
      // Build a readable label: driver name or vehicle or outsource company
      const label =
        b.driver_name?.trim()       ||
        b.vehicle_nickname          ||
        b.vehicle_number            ||
        b.outsource_company_name    ||
        (b.booking_type === "CHARTER" ? "Charter" : "Contract");

      // booking_status: 1=Allocated(draft), 2=Confirmed(published), 3=Cancelled(skip)
      if (b.booking_status === 3) continue;

      shifts.push({
        id:         `booking-${b.booking_id}`,
   categoryId: slot.slot_type === "OUTSOURCE" ? "OUTSOURCE" : "CONTRACT",
        employeeId: `slot-${slot.id}`,
        employee:   label,
        date:       b.booking_trip_date.slice(0, 10),
        startH:     6,    // TODO: wire real times from trip_driver_schedule
        endH:       14,   // TODO: wire real times from trip_driver_schedule
        status:     b.booking_status === 2 ? "published" : "draft",
      });
    }
  }

  return { categories, employees, shifts };
}

// ─── VIEW TYPES ───────────────────────────────────────────────────────────────
type ViewType = "day" | "week" | "month";

const VIEW_OPTIONS: { value: ViewType; label: string }[] = [
  { value: "day",   label: "Day"   },
  { value: "week",  label: "Week"  },
  { value: "month", label: "Month" },
];

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────
function ViewToggle({ view, onChange }: { view: ViewType; onChange: (v: ViewType) => void }) {
  return (
    <div className="flex items-center bg-gray-100 rounded-lg p-0.5 gap-0.5">
      {VIEW_OPTIONS.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
            view === opt.value
              ? "bg-white text-blue-600 shadow-sm border border-gray-200"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function DateNav({
  view, currentDate, onNavigate, onToday,
}: {
  view: ViewType;
  currentDate: Date;
  onNavigate: (dir: number) => void;
  onToday: () => void;
}) {
  const rangeText = useMemo(() => buildRangeText(view, currentDate), [view, currentDate]);

  const isToday = useMemo(() => {
    const t = new Date();
    const sameYM =
      currentDate.getFullYear() === t.getFullYear() &&
      currentDate.getMonth()    === t.getMonth();
    if (view === "month") return sameYM;
    if (view === "week") {
      return getWeekDates(currentDate).some(
        d => d.getFullYear() === t.getFullYear() &&
             d.getMonth()    === t.getMonth()    &&
             d.getDate()     === t.getDate()
      );
    }
    return sameYM && currentDate.getDate() === t.getDate();
  }, [currentDate, view]);

  return (
    <div className="flex items-center gap-1">
      <div className="w-px h-4 bg-gray-200 mx-1" />
      {!isToday && (
        <button
          onClick={onToday}
          className="px-2 py-1 text-[11px] font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors"
        >
          Today
        </button>
      )}
      <button onClick={() => onNavigate(-1)} className="p-1 hover:bg-gray-200 rounded text-gray-400 transition-colors" title="Previous">
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>
      <span className="text-xs font-medium text-gray-600 min-w-[130px] text-center select-none">
        {rangeText}
      </span>
      <button onClick={() => onNavigate(1)} className="p-1 hover:bg-gray-200 rounded text-gray-400 transition-colors" title="Next">
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const config = createRosterConfig({
  initialScrollToNow: true,
  snapMinutes: 30,
  defaultSettings: { visibleFrom: 0, visibleTo: 24 },
  labels: {
    category:  "Fleet",
    employee:  "Slot",
    shift:     "Dispatch",
    draft:     "Pending",
    published: "Confirmed",
  },
});

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export function DispatchChart() {
  const [fullscreen, setFullscreen] = useState(false);
  const [zoom, setZoom]             = useState(1);
  const [view, setView]             = useState<ViewType>("week");
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());

  // ── API state ──────────────────────────────────────────────────────────────
  const [apiSlots, setApiSlots]   = useState<ApiSlot[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  // ── Derived scheduler data ─────────────────────────────────────────────────
  const { categories, employees, shifts: apiShifts } = useMemo(
    () => buildSchedulerData(apiSlots),
    [apiSlots]
  );

  // ── Local shift edits (drag/resize in the UI) layered on top of API data ──
  const [localShifts, setLocalShifts] = useState<Block[]>([]);
  const [shiftsInitialized, setShiftsInitialized] = useState(false);

  // Sync API shifts → local shifts when API data changes
  useEffect(() => {
    setLocalShifts(apiShifts);
    setShiftsInitialized(true);
  }, [apiShifts]);

  // ── Fetch bookings when view/date changes ──────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const [start, end] = getDateRange(view, currentDate);

    setLoading(true);
    setError(null);

apiFetch(API_ENDPOINTS.dispatch.slots.bookings(start, end))
  .then(res => {
    if (!cancelled) {
      setApiSlots(res.data ?? []);
      setLoading(false);
    }
  })
  .catch(err => {
    if (!cancelled) {
      console.error("[DispatchChart] fetch error:", err);
      setError("Failed to load dispatch data");
      setLoading(false);
    }
  });

    return () => { cancelled = true; };
  }, [view, currentDate]);

  // ── Scheduler refs ─────────────────────────────────────────────────────────
  const goToDateRef = useRef<((d: Date) => void) | null>(null);
  const goToNowRef  = useRef<(() => void) | null>(null);

  const zoomIn    = () => setZoom(z => Math.min(1.4, +(z + 0.1).toFixed(1)));
  const zoomOut   = () => setZoom(z => Math.max(0.6, +(z - 0.1).toFixed(1)));
  const resetZoom = () => setZoom(1);

  const handleNavigate = useCallback((dir: number) => {
    setCurrentDate(prev => {
      const next = shiftDate(prev, view, dir);
      goToDateRef.current?.(next);
      return next;
    });
  }, [view]);

  const handleToday = useCallback(() => {
    const today = new Date();
    setCurrentDate(today);
    goToNowRef.current?.();
  }, []);

  const handleViewChange = useCallback((v: ViewType) => setView(v), []);

  const toolbarSlot = useCallback((ctx: SchedulerToolbarContext) => {
    goToDateRef.current = ctx.goToDate as (d: Date) => void;
    goToNowRef.current  = ctx.goToNow;
    return null;
  }, []);

  // ── Show loading skeleton if no data yet ───────────────────────────────────
  const showSkeleton = loading && !shiftsInitialized;

  const schedulerJSX = (
    <Scheduler
      categories={categories.length ? categories : [{ id: "loading", name: "Loading…", kind: "category", colorIdx: 0 }]}
      employees={employees.length  ? employees  : [{ id: "loading", name: "Loading…", kind: "employee", categoryId: "loading", colorIdx: 0 }]}
      shifts={localShifts}
      onShiftsChange={setLocalShifts}
      config={config}
      initialView={view}
      initialDate={currentDate}
      showViewTabs={false}
      showAddShiftButton={false}
      showNowButton={false}
      isLoading={showSkeleton}
      slots={{ toolbar: toolbarSlot }}
    />
  );

  // ── Toolbar pieces ─────────────────────────────────────────────────────────
  const toolbarLeft = (
    <div className="flex items-center gap-2">
      <ViewToggle view={view} onChange={handleViewChange} />
      <DateNav
        view={view}
        currentDate={currentDate}
        onNavigate={handleNavigate}
        onToday={handleToday}
      />
      {/* loading indicator */}
      {loading && shiftsInitialized && (
        <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin ml-1" />
      )}
    </div>
  );

  const toolbarRight = (isFullscreen: boolean) => (
    <div className="flex items-center gap-1">
      <button onClick={zoomOut}   className="p-1.5 hover:bg-gray-200 rounded text-gray-400 transition-colors"><ZoomOut className="w-3.5 h-3.5" /></button>
      <button onClick={resetZoom} className="px-2 py-1 text-[11px] font-medium text-gray-400 hover:bg-gray-200 rounded min-w-[40px] text-center">{Math.round(zoom * 100)}%</button>
      <button onClick={zoomIn}    className="p-1.5 hover:bg-gray-200 rounded text-gray-400 transition-colors"><ZoomIn className="w-3.5 h-3.5" /></button>
      <div className="w-px h-4 bg-gray-200 mx-1" />
      {isFullscreen ? (
        <button onClick={() => setFullscreen(false)} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 text-white text-xs rounded-lg hover:bg-gray-700">
          <Minimize2 className="w-3 h-3" /> Exit
        </button>
      ) : (
        <button onClick={() => setFullscreen(true)} className="p-1.5 hover:bg-gray-200 rounded text-gray-400 transition-colors" title="Fullscreen">
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );

  // ── FULLSCREEN ─────────────────────────────────────────────────────────────
  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col">
        <div className="flex items-center justify-between px-6 py-2.5 border-b border-gray-200 bg-gray-50 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Dispatch Chart</span>
            {toolbarLeft}
          </div>
          {toolbarRight(true)}
        </div>
        <div className="flex-1 overflow-hidden dispatch-hide-internal-toolbar"
          style={{ transform:`scale(${zoom})`, transformOrigin:"top left", width:`${100/zoom}%`, height:`${100/zoom}%` }}>
          {schedulerJSX}
        </div>
      </div>
    );
  }

  // ── NORMAL ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 px-6 py-4" style={{ height: "calc(100vh - 64px)" }}>

      <div className="flex-1 flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden min-h-0">

        {/* toolbar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Dispatch Chart</span>
            {toolbarLeft}
          </div>
          {toolbarRight(false)}
        </div>

        {/* error banner */}
        {error && (
          <div className="shrink-0 px-4 py-2 bg-red-50 border-b border-red-100 text-xs text-red-600 flex items-center gap-2">
            <span>⚠ {error}</span>
            <button
              onClick={() => { setError(null); setCurrentDate(new Date()); }}
              className="ml-auto text-red-500 hover:text-red-700 underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* scheduler */}
        <div className="flex-1 min-h-0 overflow-hidden dispatch-hide-internal-toolbar">
          <div style={{ width: `${zoom * 100}%`, height: "100%" }}>
            {schedulerJSX}
          </div>
        </div>
      </div>

      {/* legend — derived from live categories */}
      <div className="flex items-center gap-5 shrink-0 flex-wrap">
        {categories.map((cat, i) => {
          const colors = ["bg-blue-500","bg-purple-500","bg-green-500","bg-amber-500","bg-pink-500","bg-teal-500"];
          return (
            <div key={cat.id} className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-full ${colors[i % colors.length]}`} />
              <span className="text-xs text-gray-500">{cat.name}</span>
            </div>
          );
        })}
        <div className="flex items-center gap-1.5 ml-4 pl-4 border-l border-gray-200">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
          <span className="text-xs text-gray-500">Confirmed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span className="text-xs text-gray-500">Pending</span>
        </div>
      </div>
    </div>
  );
}