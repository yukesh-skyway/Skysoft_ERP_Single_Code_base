import { AlertOctagon, Wrench, CheckCircle2, Timer } from 'lucide-react';
import NarrativeCard from './shared/NarrativeCard';
import KpiGrid from './shared/KpiGrid';
import BottomStats from './shared/BottomStats';
import type { KpiItem } from './shared/KpiGrid';

const defectKpis: KpiItem[] = [
  {
    label: 'Open defects',
    value: '24',
    sub: '+3 from last week',
    icon: AlertOctagon,
    colors: {
      bg:         '#fff1f2',
      border:     '#fecdd3',
      iconBg:     '#e11d48',
      iconColor:  '#ffffff',
      valueColor: '#be123c',
      subColor:   '#f43f5e',
    },
  },
  {
    label: 'In progress',
    value: '8',
    sub: 'Across 6 vehicles',
    icon: Wrench,
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
    label: 'Resolved (month)',
    value: '34',
    sub: '+12% vs last month',
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
    label: 'Avg resolution',
    value: '4.2d',
    sub: '-0.8d improved',
    icon: Timer,
    colors: {
      bg:         '#eff6ff',
      border:     '#bfdbfe',
      iconBg:     '#2563eb',
      iconColor:  '#ffffff',
      valueColor: '#1d4ed8',
      subColor:   '#3b82f6',
    },
  },
];

const recentDefects = [
  { id: 1042, vehicle: 'Unit 204', description: '🔧 Oil Change | 🚨 Due KM: 245,000 | ⚙️ Last KM: 237,400', source: 'Maintenance', date: 'Mar 20', status: 'Open'        },
  { id: 1041, vehicle: 'Unit 117', description: '🔧 Brake Inspection | 🚨 Due Date: 2026-03-18',             source: 'Maintenance', date: 'Mar 19', status: 'In Progress' },
  { id: 1039, vehicle: 'Unit 089', description: 'Engine warning light on',                                   source: 'Driver',      date: 'Mar 18', status: 'In Progress' },
  { id: 1037, vehicle: 'Unit 331', description: '🔧 Tire Rotation | 🚨 Due KM: 198,000 | ⚙️ Last KM: 191,500', source: 'Maintenance', date: 'Mar 17', status: 'Completed' },
  { id: 1035, vehicle: 'Unit 056', description: 'AC not cooling properly',                                   source: 'Driver',      date: 'Mar 16', status: 'Open'        },
];

const statusColors: Record<string, { bg: string; color: string }> = {
  'Open':        { bg: '#dbeafe', color: '#1e40af' },
  'In Progress': { bg: '#fef3c7', color: '#92400e' },
  'Completed':   { bg: '#dcfce7', color: '#15803d' },
  'Rejected':    { bg: '#fee2e2', color: '#b91c1c' },
};

export default function DefectPanel({ animationKey }: { animationKey?: string | number }) {
  return (
    <div className="space-y-5">
      <NarrativeCard
        animationKey={animationKey}
        insights={[
          {
            type: 'info',
            title: 'Defect summary',
            text: '24 open defects across the fleet. 62% were auto-generated from overdue scheduled maintenance alerts.',
          },
          {
            type: 'trend',
            title: 'Resolution trend',
            text: 'Average resolution time improved to 4.2 days, down from 5.0 days last month. Mechanic M. Johnson leads with the fastest turnaround at 2.8 days average.',
          },
        ]}
      />

      <KpiGrid items={defectKpis} />

      {/* Recent Defects Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-medium text-gray-800">Recent defects</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-gray-400">#</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-gray-400">Vehicle</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-gray-400">Description</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-gray-400">Source</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-gray-400">Date</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-gray-400">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recentDefects.map(d => (
                <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-xs text-gray-400">#{d.id}</td>
                  <td className="px-4 py-3 text-xs font-medium text-gray-700">{d.vehicle}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">{d.description}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{d.source}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{d.date}</td>
                  <td className="px-4 py-3">
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={statusColors[d.status]}
                    >
                      {d.status}
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
          { value: '24',   label: 'Open defects',    color: 'red'    },
          { value: '+12%', label: 'Resolution rate', color: 'green'  },
          { value: '4.2d', label: 'Avg resolution',  color: 'blue'   },
          { value: '62%',  label: 'Auto-generated',  color: 'purple' },
        ]}
      />
    </div>
  );
}