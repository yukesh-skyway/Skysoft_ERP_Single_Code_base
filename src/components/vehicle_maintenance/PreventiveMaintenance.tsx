import { useState } from 'react';
import {
  Sparkles,
  Lock,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Brain,
  Zap,
  Target,
  BarChart3,
  Activity,
  Wrench,
  Calendar,
  DollarSign,
  Clock,
  ArrowRight,
  LightbulbIcon,
  TrendingDown,
  Shield,
  MessageSquare
} from 'lucide-react';

export function PreventiveMaintenance() {
  const [isUnlocked, setIsUnlocked] = useState(false);

  const handleUnlock = () => {
    setIsUnlocked(true);
  };

  return (
    <div className="space-y-6 relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl text-gray-900">Preventive Maintenance</h1>
            <span className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-full text-xs shadow-lg">
              <Sparkles className="w-3.5 h-3.5" />
              AI Powered
            </span>
          </div>
          <p className="text-gray-600 mt-1">
            Advanced AI-driven insights for proactive fleet management
          </p>
        </div>
      </div>

      {/* Blur Overlay when locked */}
      {!isUnlocked && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/40 backdrop-blur-md">
          <div className="text-center max-w-md mx-auto p-8">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl">
              <Lock className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl text-gray-900 mb-3">Premium Feature</h2>
            <p className="text-gray-600 mb-6">
              Unlock AI-powered predictive maintenance, fleet health analysis, and intelligent recommendations to optimize your operations.
            </p>
            <button
              onClick={handleUnlock}
              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-2xl transition-all transform hover:scale-105 flex items-center gap-2 mx-auto"
            >
              <Sparkles className="w-5 h-5" />
              <span>Unlock Premium Features</span>
              <ArrowRight className="w-5 h-5" />
            </button>
            <p className="text-sm text-gray-500 mt-4">
              Start your 30-day free trial • No credit card required
            </p>
          </div>
        </div>
      )}

      {/* Content (blurred when locked) */}
      <div className={isUnlocked ? '' : 'filter blur-sm pointer-events-none select-none'}>
        {/* AI Story Telling Dashboard */}
        <div className="bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 rounded-xl border border-blue-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg text-gray-900 flex items-center gap-2">
                AI Story Telling Dashboard
                <Sparkles className="w-4 h-4 text-purple-600" />
              </h2>
              <p className="text-sm text-gray-600">Consolidated narrative insights from your fleet data</p>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 border border-blue-100 shadow-sm">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <Brain className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-gray-800 leading-relaxed">
                    <span className="font-semibold">Fleet Overview:</span> Your fleet of 45 vehicles has maintained an impressive <span className="text-green-600 font-semibold">94.2% uptime</span> this month. AI analysis shows that proactive maintenance scheduling has reduced unexpected breakdowns by 23% compared to last quarter.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <TrendingUp className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <p className="text-gray-800 leading-relaxed">
                    <span className="font-semibold">Trend Insight:</span> The system detected a positive trend in brake system maintenance. Units serviced in the last 30 days show <span className="text-blue-600 font-semibold">40% longer interval</span> before requiring attention, indicating improved service quality.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-gray-800 leading-relaxed">
                    <span className="font-semibold">Action Required:</span> AI has identified 7 vehicles approaching their scheduled maintenance window within the next 14 days. Early scheduling could prevent potential service disruptions during peak operational periods.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* AI Predictive Analysis Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Fleet Health Prediction */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Activity className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg text-gray-900">Fleet Health Analysis</h3>
                <p className="text-sm text-gray-600">AI-powered health monitoring</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Overall Health Score */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-700">Overall Fleet Health</span>
                  <span className="text-2xl font-semibold text-green-600">92%</span>
                </div>
                <div className="w-full bg-green-200 rounded-full h-3">
                  <div className="bg-gradient-to-r from-green-500 to-emerald-500 h-3 rounded-full" style={{ width: '92%' }}></div>
                </div>
                <p className="text-xs text-gray-600 mt-2">Excellent condition - Above industry average</p>
              </div>

              {/* Health Categories */}
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-700">Engine Systems</span>
                    <span className="text-sm font-semibold text-green-600">95%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full" style={{ width: '95%' }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-700">Brake Systems</span>
                    <span className="text-sm font-semibold text-blue-600">88%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full" style={{ width: '88%' }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-700">Transmission</span>
                    <span className="text-sm font-semibold text-yellow-600">78%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-yellow-500 h-2 rounded-full" style={{ width: '78%' }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-700">Suspension</span>
                    <span className="text-sm font-semibold text-green-600">91%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full" style={{ width: '91%' }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Failure Prediction */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg text-gray-900">Failure Predictions</h3>
                <p className="text-sm text-gray-600">Potential issues detected by AI</p>
              </div>
            </div>

            <div className="space-y-3">
              {/* High Priority */}
              <div className="border-l-4 border-red-500 bg-red-50 rounded-r-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-md border border-red-200">
                        High Risk
                      </span>
                      <span className="text-xs text-gray-600">Unit #9567</span>
                    </div>
                    <p className="text-sm text-gray-800 font-medium">Transmission Fluid Degradation</p>
                    <p className="text-xs text-gray-600 mt-1">
                      Predicted failure in 15-20 days • Confidence: 87%
                    </p>
                  </div>
                </div>
              </div>

              {/* Medium Priority */}
              <div className="border-l-4 border-yellow-500 bg-yellow-50 rounded-r-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-md border border-yellow-200">
                        Medium Risk
                      </span>
                      <span className="text-xs text-gray-600">Unit #9570, #9571</span>
                    </div>
                    <p className="text-sm text-gray-800 font-medium">Brake Pad Wear Pattern</p>
                    <p className="text-xs text-gray-600 mt-1">
                      Predicted maintenance needed in 30-45 days • Confidence: 73%
                    </p>
                  </div>
                </div>
              </div>

              {/* Low Priority */}
              <div className="border-l-4 border-blue-500 bg-blue-50 rounded-r-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-md border border-blue-200">
                        Monitor
                      </span>
                      <span className="text-xs text-gray-600">Unit #9568</span>
                    </div>
                    <p className="text-sm text-gray-800 font-medium">AC Compressor Efficiency</p>
                    <p className="text-xs text-gray-600 mt-1">
                      Monitor trend - No immediate action required • Confidence: 65%
                    </p>
                  </div>
                </div>
              </div>

              {/* Good Status */}
              <div className="border-l-4 border-green-500 bg-green-50 rounded-r-lg p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="text-sm text-gray-800 font-medium">38 Units in Optimal Condition</p>
                    <p className="text-xs text-gray-600">No predicted failures in next 60 days</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Performance Improvement Suggestions */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Target className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="text-lg text-gray-900">Performance Improvement Suggestions</h3>
              <p className="text-sm text-gray-600">AI-recommended actions to optimize maintenance</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Suggestion 1 */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-5 border border-blue-200">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <DollarSign className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-1">Cost Optimization</h4>
                  <p className="text-xs text-gray-700 mb-2">
                    Consolidate maintenance schedules for Units #9566-9570 to save $2,400 annually on vendor dispatch fees.
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-md">
                      Potential Savings: $2,400/year
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Suggestion 2 */}
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-5 border border-green-200">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-1">Downtime Reduction</h4>
                  <p className="text-xs text-gray-700 mb-2">
                    Shift brake maintenance to off-peak hours (weekends) to increase vehicle availability by 12% during high-demand periods.
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-md">
                      +12% Availability
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Suggestion 3 */}
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-5 border border-purple-200">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Wrench className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-1">Preventive Actions</h4>
                  <p className="text-xs text-gray-700 mb-2">
                    Implement oil analysis program for high-mileage units to detect issues 45 days earlier and reduce engine repairs by 30%.
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-md">
                      -30% Engine Repairs
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Suggestion 4 */}
            <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-5 border border-amber-200">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-1">Schedule Optimization</h4>
                  <p className="text-xs text-gray-700 mb-2">
                    Adjust PM intervals based on actual usage patterns. AI suggests extending oil change intervals to 8,000 km for highway units.
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-md">
                      Optimized Intervals
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Overall Fleet Management Recommendations */}
        <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 rounded-lg border border-indigo-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
              <LightbulbIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg text-gray-900">Overall Fleet Management Recommendations</h3>
              <p className="text-sm text-gray-600">Strategic insights for long-term success</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Recommendation 1 */}
            <div className="bg-white rounded-lg p-5 border border-indigo-100 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                </div>
                <h4 className="text-sm font-semibold text-gray-900">Operational Excellence</h4>
              </div>
              <p className="text-xs text-gray-700 leading-relaxed mb-3">
                Your fleet shows strong maintenance discipline. Continue current preventive maintenance frequency to maintain the 94% uptime rate.
              </p>
              <div className="flex items-center gap-1 text-xs text-green-600">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>On Track</span>
              </div>
            </div>

            {/* Recommendation 2 */}
            <div className="bg-white rounded-lg p-5 border border-indigo-100 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Shield className="w-4 h-4 text-blue-600" />
                </div>
                <h4 className="text-sm font-semibold text-gray-900">Risk Mitigation</h4>
              </div>
              <p className="text-xs text-gray-700 leading-relaxed mb-3">
                Prioritize transmission services for older units (5+ years) to prevent costly failures. Budget $18,000 for proactive replacements this quarter.
              </p>
              <div className="flex items-center gap-1 text-xs text-amber-600">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Action Needed</span>
              </div>
            </div>

            {/* Recommendation 3 */}
            <div className="bg-white rounded-lg p-5 border border-indigo-100 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Zap className="w-4 h-4 text-purple-600" />
                </div>
                <h4 className="text-sm font-semibold text-gray-900">Efficiency Gains</h4>
              </div>
              <p className="text-xs text-gray-700 leading-relaxed mb-3">
                Implement telematics-based maintenance alerts to reduce manual inspections by 40% and catch issues 2 weeks earlier on average.
              </p>
              <div className="flex items-center gap-1 text-xs text-blue-600">
                <TrendingDown className="w-3.5 h-3.5" />
                <span>-40% Manual Work</span>
              </div>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-indigo-200">
            <div className="text-center">
              <div className="text-2xl font-semibold text-indigo-600 mb-1">$48K</div>
              <div className="text-xs text-gray-600">Potential Annual Savings</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold text-green-600 mb-1">+18%</div>
              <div className="text-xs text-gray-600">Uptime Improvement</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold text-blue-600 mb-1">-35%</div>
              <div className="text-xs text-gray-600">Emergency Repairs</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold text-purple-600 mb-1">92%</div>
              <div className="text-xs text-gray-600">AI Prediction Accuracy</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
