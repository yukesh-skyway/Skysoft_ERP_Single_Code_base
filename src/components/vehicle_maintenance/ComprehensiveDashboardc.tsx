import { Construction, Sparkles } from 'lucide-react';

export function ComprehensiveDashboard() {
  return (
    <div className="space-y-6 relative min-h-[600px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl text-gray-900 mb-1">Fleet Management Dashboard</h1>
          <p className="text-sm sm:text-base text-gray-600">Comprehensive overview of your fleet operations</p>
        </div>
      </div>

      {/* Under Development Overlay */}
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl animate-pulse">
            <Construction className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-3xl text-gray-900 mb-3">Under Development</h2>
          <p className="text-gray-600 mb-6 leading-relaxed">
            This comprehensive fleet management dashboard is currently being built. Check back soon for real-time KPIs, fleet metrics, and actionable insights.
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
            <Sparkles className="w-4 h-4 text-blue-500" />
            <span>Coming Soon</span>
          </div>
        </div>
      </div>
    </div>
  );
}