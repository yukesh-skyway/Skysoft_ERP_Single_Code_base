import { Truck, AlertTriangle, Clock, ShieldCheck } from 'lucide-react';
import NarrativeCard from './shared/NarrativeCard';
import KpiGrid from './shared/KpiGrid';
import BottomStats from './shared/BottomStats';
import type { KpiItem } from './shared/KpiGrid';
import { useFleetDashboard } from './hooks/useFleetDashboard';

export default function FleetPanel({ animationKey }: { animationKey?: string | number }) {
  const { kpi, loading, error } = useFleetDashboard();

  const fleetKpis: KpiItem[] = [
    {
      label: 'Total vehicles',
      value: loading ? '—' : String(kpi?.totalVehicles ?? 0),
      sub:   loading ? 'Loading...' : `${kpi?.activeVehicles ?? 0} active, ${kpi?.offlineVehicles ?? 0} offline`,
      icon:  Truck,
      colors: { bg: '#eff6ff', border: '#bfdbfe', iconBg: '#2563eb', iconColor: '#ffffff', valueColor: '#1d4ed8', subColor: '#3b82f6' },
    },
    {
      label: 'Overdue maintenance',
      value: loading ? '—' : String(kpi?.overdueCount ?? 0),
      sub:   loading ? 'Loading...' : (kpi?.overdueCount === 0 ? 'All clear' : 'Requires immediate action'),
      icon:  AlertTriangle,
      colors: { bg: '#fff1f2', border: '#fecdd3', iconBg: '#e11d48', iconColor: '#ffffff', valueColor: '#be123c', subColor: '#f43f5e' },
    },
    {
      label: 'Due soon',
      value: loading ? '—' : String(kpi?.dueSoonCount ?? 0),
      sub:   loading ? 'Loading...' : 'Within alert threshold',
      icon:  Clock,
      colors: { bg: '#fffbeb', border: '#fde68a', iconBg: '#d97706', iconColor: '#ffffff', valueColor: '#b45309', subColor: '#f59e0b' },
    },
    {
      label: 'Compliance rate',
      value: loading ? '—' : `${kpi?.complianceRate ?? 0}%`,
      sub:   loading ? 'Loading...' : ((kpi?.complianceRate ?? 0) >= 80 ? 'Above target' : 'Below target'),
      icon:  ShieldCheck,
      colors: { bg: '#f0fdf4', border: '#bbf7d0', iconBg: '#16a34a', iconColor: '#ffffff', valueColor: '#15803d', subColor: '#22c55e' },
    },
  ];

  if (error) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
        Failed to load fleet data: {error}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <NarrativeCard
        animationKey={animationKey}
        title="AI story telling dashboard"
        subtitle="Consolidated narrative insights from your fleet data"
        insights={[
          {
            type: 'info',
            title: 'Fleet overview',
            text: 'Your fleet of 38 vehicles has maintained 94.2% uptime this month. Proactive maintenance scheduling has reduced unexpected breakdowns by 23% compared to last quarter.',
            highlight: { text: '94.2% uptime', color: '#16a34a' },
          },
          {
            type: 'trend',
            title: 'Trend insight',
            text: 'Brake system units serviced in the last 30 days show 40% longer interval before requiring attention, indicating improved service quality.',
            highlight: { text: '40% longer interval', color: '#2563eb' },
          },
          {
            type: 'warning',
            title: 'Action required',
            text: '7 vehicles are approaching their scheduled maintenance window within the next 14 days. Early scheduling could prevent service disruptions during peak operational periods.',
            highlight: { text: '7 vehicles', color: '#d97706' },
          },
        ]}
      />

      <KpiGrid items={fleetKpis} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Fleet Health Bars */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="text-sm font-medium text-gray-800 mb-1">Fleet health analysis</h3>
          <p className="text-xs text-gray-400 mb-4">AI-powered health monitoring</p>
          <div className="bg-green-50 border border-green-100 rounded-lg p-3 mb-4">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-green-700">Overall fleet health</span>
              <span className="text-lg font-medium text-green-600">
                {loading ? '—' : `${kpi?.complianceRate ?? 0}%`}
              </span>
            </div>
            <div className="h-2 bg-green-200 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full" style={{ width: `${kpi?.complianceRate ?? 0}%` }} />
            </div>
            <p className="text-xs text-green-600 mt-1">Based on scheduled maintenance compliance</p>
          </div>
          {[
            { label: 'Engine systems',     value: 95, color: '#22c55e' },
            { label: 'Brake systems',      value: 88, color: '#3b82f6' },
            { label: 'Transmission',       value: 78, color: '#f59e0b' },
            { label: 'Tires & suspension', value: 91, color: '#22c55e' },
          ].map((bar, i) => (
            <div key={i} className="mb-3 last:mb-0">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-gray-500">{bar.label}</span>
                <span className="text-xs font-medium text-gray-700">{bar.value}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${bar.value}%`, background: bar.color }} />
              </div>
            </div>
          ))}
        </div>

        {/* Failure Predictions */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="text-sm font-medium text-gray-800 mb-1">Failure predictions</h3>
          <p className="text-xs text-gray-400 mb-4">Potential issues detected by AI</p>
          {[
            {
              risk: 'High risk',
              riskStyle: { background: '#fee2e2', color: '#b91c1c' },
              borderColor: '#f87171',
              bg: '#fff1f2',
              unit: 'Unit #204',
              title: 'Transmission fluid degradation',
              detail: 'Predicted failure in 15–20 days • Confidence: 87%',
            },
            {
              risk: 'Medium risk',
              riskStyle: { background: '#fef3c7', color: '#92400e' },
              borderColor: '#fbbf24',
              bg: '#fffbeb',
              unit: 'Unit #117, #331',
              title: 'Brake pad wear pattern',
              detail: 'Maintenance needed in 30–45 days • Confidence: 73%',
            },
            {
              risk: 'Monitor',
              riskStyle: { background: '#dbeafe', color: '#1e40af' },
              borderColor: '#60a5fa',
              bg: '#eff6ff',
              unit: 'Unit #089',
              title: 'Engine coolant temperature trend',
              detail: 'No immediate action — monitor closely • Confidence: 61%',
            },
          ].map((p, i) => (
            <div
              key={i}
              className="rounded-r-lg px-3 py-2.5 mb-3 last:mb-0 border-l-4"
              style={{ background: p.bg, borderColor: p.borderColor }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={p.riskStyle}>
                  {p.risk}
                </span>
                <span className="text-xs text-gray-400">{p.unit}</span>
              </div>
              <p className="text-sm font-medium text-gray-800">{p.title}</p>
              <p className="text-xs text-gray-400 mt-0.5">{p.detail}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Suggestion Grid */}
      <div>
        <h3 className="text-sm font-medium text-gray-800 mb-1">Performance improvement suggestions</h3>
        <p className="text-xs text-gray-400 mb-3">AI-recommended actions to optimize maintenance</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { bg: '#eff6ff', border: '#bfdbfe', title: 'Cost optimization',     body: 'Consolidate maintenance schedules for Units #204–#331 to save $2,400 annually on vendor dispatch fees.',                         pill: 'Potential savings: $2,400/year', pillBg: '#dbeafe', pillColor: '#1e40af' },
            { bg: '#f0fdf4', border: '#bbf7d0', title: 'Downtime reduction',    body: 'Shift brake maintenance to off-peak hours (weekends) to increase vehicle availability by 12% during high-demand periods.',       pill: '+12% availability',              pillBg: '#dcfce7', pillColor: '#15803d' },
            { bg: '#fdf2f8', border: '#f5d0fe', title: 'Preventive actions',    body: 'Implement oil analysis for high-mileage units to detect issues 45 days earlier and reduce engine repairs by 30%.',              pill: '-30% engine repairs',            pillBg: '#fae8ff', pillColor: '#86198f' },
            { bg: '#fffbeb', border: '#fde68a', title: 'Schedule optimization', body: 'Adjust PM intervals based on actual usage. AI suggests extending oil change intervals to 8,000 km for highway units.',          pill: 'Optimized intervals',            pillBg: '#fef3c7', pillColor: '#92400e' },
          ].map((s, i) => (
            <div key={i} className="rounded-xl p-4 border" style={{ background: s.bg, borderColor: s.border }}>
              <p className="text-sm font-medium text-gray-800 mb-1">{s.title}</p>
              <p className="text-xs text-gray-500 leading-relaxed mb-3">{s.body}</p>
              <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: s.pillBg, color: s.pillColor }}>
                {s.pill}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Recommendations */}
      <div>
        <h3 className="text-sm font-medium text-gray-800 mb-1">Overall fleet management recommendations</h3>
        <p className="text-xs text-gray-400 mb-3">Strategic insights for long-term success</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { title: 'Operational excellence', body: 'Your fleet shows strong maintenance discipline. Continue current preventive maintenance frequency to maintain the 94% uptime rate.', status: '✓ On track',        statusColor: '#16a34a' },
            { title: 'Risk mitigation',        body: 'Prioritize transmission services for older units (5+ years) to prevent costly failures. Budget $18,000 for proactive replacements this quarter.',      status: '⚠ Action needed',  statusColor: '#d97706' },
            { title: 'Efficiency gains',       body: 'Implement telematics-based maintenance alerts to reduce manual inspections by 40% and catch issues 2 weeks earlier on average.',                        status: '↘ -40% manual work', statusColor: '#2563eb' },
          ].map((r, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-sm font-medium text-gray-800 mb-2">{r.title}</p>
              <p className="text-xs text-gray-500 leading-relaxed mb-3">{r.body}</p>
              <span className="text-xs font-medium" style={{ color: r.statusColor }}>{r.status}</span>
            </div>
          ))}
        </div>
      </div>

      <BottomStats
        stats={[
          { value: '$48K', label: 'Potential annual savings', color: 'purple' },
          { value: '+18%', label: 'Uptime improvement',       color: 'green'  },
          { value: '-35%', label: 'Emergency repairs',        color: 'red'    },
          { value: '92%',  label: 'AI prediction accuracy',  color: 'blue'   },
        ]}
      />
    </div>
  );
}