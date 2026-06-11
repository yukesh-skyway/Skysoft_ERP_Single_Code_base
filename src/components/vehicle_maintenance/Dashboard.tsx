import { Construction, Sparkles, Lock } from 'lucide-react';

export function Dashboard() {
  return (
    <div className="space-y-6 relative min-h-[600px]">
      {/* Header */}
      <div>
        <h1 className="text-gray-900 mb-1">Maintenance Dashboard</h1>
        <p className="text-gray-600">Real-time overview of fleet maintenance operations</p>
      </div>

      {/* Under Development Overlay */}
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl animate-pulse">
            <Construction className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-3xl text-gray-900 mb-3">Under Development</h2>
          <p className="text-gray-600 mb-6 leading-relaxed">
            This comprehensive maintenance dashboard is currently being built. Check back soon for real-time fleet metrics, defect tracking, and maintenance insights.
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