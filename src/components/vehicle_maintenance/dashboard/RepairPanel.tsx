import { ClipboardList, CheckCircle2, HardHat, PackageX } from 'lucide-react';
import NarrativeCard from './shared/NarrativeCard';
import KpiGrid from './shared/KpiGrid';
import BottomStats from './shared/BottomStats';
import type { KpiItem } from './shared/KpiGrid';

const repairKpis: KpiItem[] = [
  {
    label: 'Active ROs',
    value: '12',
    sub: '5 bays occupied',
    icon: ClipboardList,
    colors: {
      bg:         '#eff6ff',
      border:     '#bfdbfe',
      iconBg:     '#2563eb',
      iconColor:  '#ffffff',
      valueColor: '#1d4ed8',
      subColor:   '#3b82f6',
    },
  },
  {
    label: 'Completed (month)',
    value: '47',
    sub: '+8% vs last month',
    icon: CheckCircle2,
    colors: {
      bg:         '#f0fdf4',
      border:     '#bbf7d0',
      iconBg:     '#16a34a',
      iconColor:  '#ffffff',
      valueColor: '#15803d',
      subColor:   '#22c55e',
    },
  },
  {
    label: 'Labour hours',
    value: '183h',
    sub: 'Est. 210h projected',
    icon: HardHat,
    colors: {
      bg:         '#fffbeb',
      border:     '#fde68a',
      iconBg:     '#d97706',
      iconColor:  '#ffffff',
      valueColor: '#b45309',
      subColor:   '#f59e0b',
    },
  },
  {
    label: 'Pending parts',
    value: '6',
    sub: 'Blocking 4 ROs',
    icon: PackageX,
    colors: {
      bg:         '#fff1f2',
      border:     '#fecdd3',
      iconBg:     '#e11d48',
      iconColor:  '#ffffff',
      valueColor: '#be123c',
      subColor:   '#f43f5e',
    },
  },
];

const activeROs = [
  { ro: 'RO-2041', vehicle: 'Unit 204', mechanic: 'M. Johnson',  bay: 'Bay 3', hours: '4.5h', status: 'In Progress'   },
  { ro: 'RO-2039', vehicle: 'Unit 117', mechanic: 'D. Patel',    bay: 'Bay 1', hours: '2.0h', status: 'In Progress'   },
  { ro: 'RO-2038', vehicle: 'Unit 331', mechanic: 'T. Williams', bay: 'Bay 5', hours: '6.0h', status: 'Pending Parts' },
  { ro: 'RO-2035', vehicle: 'Unit 089', mechanic: 'M. Johnson',  bay: 'Bay 2', hours: '3.5h', status: 'Completed'     },
  { ro: 'RO-2033', vehicle: 'Unit 056', mechanic: 'A. Chen',     bay: 'Bay 4', hours: '5.0h', status: 'Open'          },
];

const statusColors: Record<string, { bg: string; color: string }> = {
  'In Progress':   { bg: '#fef3c7', color: '#92400e' },
  'Pending Parts': { bg: '#dbeafe', color: '#1e40af' },
  'Completed':     { bg: '#dcfce7', color: '#15803d' },
  'Open':          { bg: '#f3f4f6', color: '#374151' },
};

export default function RepairPanel({ animationKey }: { animationKey?: string | number }) {
  return (
    <div className="space-y-5">
      <NarrativeCard
        animationKey={animationKey}
        insights={[
          {
            type: 'info',
            title: 'RO overview',
            text: '12 active repair orders are currently in progress across 5 bays. Labour efficiency is at 87% — actual hours tracking below estimates for the third consecutive month.',
          },
          {
            type: 'warning',
            title: 'Parts bottleneck',
            text: '6 parts requests are pending approval, blocking 4 active ROs. Average parts wait time has increased to 3.1 days — consider pre-ordering high-frequency items.',
          },
        ]}
      />

      <KpiGrid items={repairKpis} />

      {/* Active ROs Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-medium text-gray-800">Active repair orders</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-gray-400">RO #</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-gray-400">Vehicle</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-gray-400">Mechanic</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-gray-400">Bay</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-gray-400">Est. hours</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-gray-400">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {activeROs.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-xs font-medium text-gray-700">{r.ro}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{r.vehicle}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{r.mechanic}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{r.bay}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{r.hours}</td>
                  <td className="px-4 py-3">
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={statusColors[r.status]}
                    >
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <BottomStats
        stats={[
          { value: '12',   label: 'Active ROs',        color: 'blue'   },
          { value: '87%',  label: 'Labour efficiency', color: 'green'  },
          { value: '3.1d', label: 'Avg parts wait',    color: 'amber'  },
          { value: '47',   label: 'Completed month',   color: 'purple' },
        ]}
      />
    </div>
  );
}