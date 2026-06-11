import { useState } from "react";
import { Scheduler, createRosterConfig, RosterActions } from "@/components/scheduler";
import type { Block, Resource } from "@/components/scheduler";

const categories: Resource[] = [
  { id: "charter",   name: "Charter Fleet",  kind: "category", colorIdx: 0 },
  { id: "contract",  name: "Contract Fleet", kind: "category", colorIdx: 2 },
  { id: "outsource", name: "Outsource",      kind: "category", colorIdx: 4 },
];

const employees: Resource[] = [
  { id: "slot-a", name: "Slot A · Bus 01", kind: "employee", categoryId: "charter",   colorIdx: 0 },
  { id: "slot-b", name: "Slot B · Bus 02", kind: "employee", categoryId: "charter",   colorIdx: 0 },
  { id: "slot-c", name: "Slot C · Bus 03", kind: "employee", categoryId: "charter",   colorIdx: 1 },
  { id: "slot-d", name: "Slot D · Van 01", kind: "employee", categoryId: "contract",  colorIdx: 2 },
  { id: "slot-e", name: "Slot E · Van 02", kind: "employee", categoryId: "contract",  colorIdx: 2 },
  { id: "slot-f", name: "Slot F · Van 03", kind: "employee", categoryId: "contract",  colorIdx: 3 },
  { id: "slot-g", name: "Slot G · Ext 01", kind: "employee", categoryId: "outsource", colorIdx: 4 },
  { id: "slot-h", name: "Slot H · Ext 02", kind: "employee", categoryId: "outsource", colorIdx: 4 },
];

function dayOffset(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

const INITIAL_SHIFTS: Block[] = [
  { id:"b1",  categoryId:"charter",   employeeId:"slot-a", employee:"John D.",  date:dayOffset(0), startH:6,    endH:14,   status:"published" },
  { id:"b2",  categoryId:"charter",   employeeId:"slot-a", employee:"John D.",  date:dayOffset(1), startH:8,    endH:11,   status:"published" },
  { id:"b3",  categoryId:"charter",   employeeId:"slot-a", employee:"John D.",  date:dayOffset(2), startH:7.5,  endH:9,    status:"published" },
  { id:"b4",  categoryId:"charter",   employeeId:"slot-a", employee:"John D.",  date:dayOffset(4), startH:16,   endH:22,   status:"draft"     },
  { id:"b5",  categoryId:"charter",   employeeId:"slot-b", employee:"Maria S.", date:dayOffset(1), startH:9,    endH:17,   status:"published" },
  { id:"b6",  categoryId:"charter",   employeeId:"slot-b", employee:"Maria S.", date:dayOffset(3), startH:5,    endH:8,    status:"published" },
  { id:"b7",  categoryId:"charter",   employeeId:"slot-b", employee:"Maria S.", date:dayOffset(5), startH:12,   endH:20,   status:"published" },
  { id:"b8",  categoryId:"charter",   employeeId:"slot-c", employee:"James T.", date:dayOffset(0), startH:8,    endH:16,   status:"published" },
  { id:"b9",  categoryId:"charter",   employeeId:"slot-c", employee:"James T.", date:dayOffset(2), startH:14.5, endH:16.5, status:"published" },
  { id:"b10", categoryId:"charter",   employeeId:"slot-c", employee:"James T.", date:dayOffset(4), startH:22,   endH:24,   status:"published" },
  { id:"b11", categoryId:"contract",  employeeId:"slot-d", employee:"Kevin R.", date:dayOffset(0), startH:7,    endH:15,   status:"published" },
  { id:"b12", categoryId:"contract",  employeeId:"slot-d", employee:"Kevin R.", date:dayOffset(2), startH:7,    endH:15,   status:"published" },
  { id:"b13", categoryId:"contract",  employeeId:"slot-d", employee:"Kevin R.", date:dayOffset(4), startH:7,    endH:15,   status:"draft"     },
  { id:"b14", categoryId:"contract",  employeeId:"slot-e", employee:"Lisa M.",  date:dayOffset(1), startH:8,    endH:16,   status:"published" },
  { id:"b15", categoryId:"contract",  employeeId:"slot-e", employee:"Lisa M.",  date:dayOffset(3), startH:8,    endH:16,   status:"published" },
  { id:"b16", categoryId:"contract",  employeeId:"slot-e", employee:"Lisa M.",  date:dayOffset(5), startH:8,    endH:16,   status:"published" },
  { id:"b17", categoryId:"contract",  employeeId:"slot-f", employee:"Amir P.",  date:dayOffset(0), startH:6,    endH:14,   status:"published" },
  { id:"b18", categoryId:"contract",  employeeId:"slot-f", employee:"Amir P.",  date:dayOffset(2), startH:6,    endH:14,   status:"published" },
  { id:"b19", categoryId:"contract",  employeeId:"slot-f", employee:"Amir P.",  date:dayOffset(6), startH:6,    endH:14,   status:"draft"     },
  { id:"b20", categoryId:"outsource", employeeId:"slot-g", employee:"ABC Co.",  date:dayOffset(0), startH:8,    endH:17,   status:"published" },
  { id:"b21", categoryId:"outsource", employeeId:"slot-g", employee:"ABC Co.",  date:dayOffset(3), startH:8,    endH:17,   status:"published" },
  { id:"b22", categoryId:"outsource", employeeId:"slot-h", employee:"XYZ Co.",  date:dayOffset(1), startH:9,    endH:18,   status:"published" },
  { id:"b23", categoryId:"outsource", employeeId:"slot-h", employee:"XYZ Co.",  date:dayOffset(4), startH:9,    endH:18,   status:"draft"     },
];

const config = createRosterConfig({
  initialScrollToNow: true,
  snapMinutes: 30,
  labels: {
    category:  "Fleet",
    employee:  "Slot",
    shift:     "Dispatch",
    draft:     "Pending",
    published: "Confirmed",
  },
});

export function DispatchChart() {
  const [shifts, setShifts] = useState<Block[]>(INITIAL_SHIFTS);

  return (
    <div style={{ height: "calc(100vh - 88px)" }}>
      <Scheduler
        categories={categories}
        employees={employees}
        shifts={shifts}
        onShiftsChange={setShifts}
        config={config}
        initialView="week"
        headerActions={({ copyLastWeek, publishAllDrafts, draftCount }) => (
          <RosterActions
            onCopyLastWeek={copyLastWeek}
            onPublishAll={publishAllDrafts}
            draftCount={draftCount}
            onFillFromSchedules={() => {}}
          />
        )}
      />
    </div>
  );
}