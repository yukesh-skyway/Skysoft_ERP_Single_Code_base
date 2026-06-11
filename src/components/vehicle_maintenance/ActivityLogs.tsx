import React, { useState, useEffect } from 'react';
import { X, Calendar, User, Search, FileText, RefreshCw, TrendingUp, Download, Database, Filter, Edit, AlertCircle, Info, Loader2, ChevronLeft, ChevronRight, Settings } from 'lucide-react';
import { API_BASE_URL, API_ENDPOINTS, buildApiUrl } from '../../config/api';
import { toast } from 'sonner@2.0.3';
import { DatePicker } from '../../components/ui/date-picker';

interface LogEntry {
  logId: number | string; // Can be number for user logs or string (composite) for system logs
  dateTime: string;
  ipAddress: string;
  browser: string;
  userId: number;
  userName: string;
  source: string;
  remark: string;
  oldValue: any;
  updatedValue: any;
  logType?: 'user' | 'system'; // New field to distinguish log types
}

interface UserOption {
  userId: number;
  userName: string;
}

export function ActivityLogs() {
  // State
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sources, setSources] = useState<string[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [statistics, setStatistics] = useState<any>(null);

  // Filters
  const [filterSource, setFilterSource] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [searchKey, setSearchKey] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const itemsPerPage = 25;

  // Fetch sources and users for filters
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const [sourcesRes, usersRes] = await Promise.all([
          fetch(buildApiUrl(API_ENDPOINTS.activityLogs.sources), {
            headers: { 'ngrok-skip-browser-warning': 'true' },
            credentials: 'include'
          }),
          fetch(buildApiUrl(API_ENDPOINTS.activityLogs.users), {
            headers: { 'ngrok-skip-browser-warning': 'true' },
            credentials: 'include'
          })
        ]);

        if (sourcesRes.ok) {
          const sourcesData = await sourcesRes.json();
          setSources(sourcesData.data || []);
        }

        if (usersRes.ok) {
          const usersData = await usersRes.json();
          console.log('👥 Fetched users:', usersData.data);
          setUsers(usersData.data || []);
        }
      } catch (error) {
        console.error('Error fetching filter options:', error);
      }
    };

    const fetchStats = async () => {
      try {
        const response = await fetch(buildApiUrl(API_ENDPOINTS.activityLogs.statistics), {
          headers: { 'ngrok-skip-browser-warning': 'true' },
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          setStatistics(data.data);
        }
      } catch (error) {
        console.error('Error fetching statistics:', error);
      }
    };

    fetchFilters();
    fetchStats();
  }, []);

  // Fetch logs when filters or pagination change
  useEffect(() => {
    fetchLogs();
  }, [currentPage, filterSource, filterUser, dateFrom, dateTo, searchKey]);

  // Fetch statistics when filterSource changes
  useEffect(() => {
    fetchStatistics();
  }, [filterSource]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: itemsPerPage.toString(),
        offset: ((currentPage - 1) * itemsPerPage).toString()
      });

      if (filterSource) params.append('source', filterSource);
      if (filterUser) params.append('user_id', filterUser);
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      if (searchKey) params.append('search', searchKey);

      console.log('📡 Fetching logs from:', buildApiUrl(`${API_ENDPOINTS.activityLogs.base}?${params}`));
      console.log('🔍 Filter parameters:', {
        filterSource,
        filterUser,
        dateFrom,
        dateTo,
        searchKey
      });
      console.log('⚠️ SYSTEM LOGS WILL ONLY SHOW IF:');
      console.log('  1. User filter is empty (filterUser):', filterUser === '' ? '✅ EMPTY' : '❌ FILTERED');
      console.log('  2. Source is either empty OR "System - Scheduled Maintenance":', 
        filterSource === '' ? '✅ All Modules' : 
        filterSource === 'System - Scheduled Maintenance' ? '✅ System - Scheduled Maintenance' : 
        '❌ OTHER MODULE (system logs hidden)');

      const response = await fetch(buildApiUrl(`${API_ENDPOINTS.activityLogs.base}?${params}`), {
        headers: { 'ngrok-skip-browser-warning': 'true' },
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Received data:', data);
      console.log('📊 Total logs received:', data.data?.length);
      console.log('📊 Backend says total count:', data.pagination?.total);
      
      // ✅ Auto-detect system logs ONLY by source field
      // System logs = ONLY from system_activities table (source === 'System - Scheduled Maintenance')
      // User logs = from user_activity_logs table (all other sources)
      const logsWithType = (data.data || []).map((log: LogEntry) => ({
        ...log,
        logType: log.source === 'System - Scheduled Maintenance' ? 'system' : 'user'
      }));
      
      const systemLogsCount = logsWithType.filter(l => l.logType === 'system').length;
      const userLogsCount = logsWithType.filter(l => l.logType === 'user').length;
      
      console.log('🤖 System logs (from system_activities):', systemLogsCount);
      console.log('👤 User logs (from user_activity_logs):', userLogsCount);
      console.log('🔍 Sample system log:', logsWithType.find(l => l.logType === 'system'));
      console.log('🔍 All logs data:', logsWithType);
      
      setLogs(logsWithType);
      setTotalLogs(data.pagination?.total || 0);
    } catch (error: any) {
      console.error('❌ Error fetching logs:', error);
      toast.error(`Failed to load activity logs: ${error.message}`);
      setLogs([]);
      setTotalLogs(0);
    } finally {
      setLoading(false);
    }
  };

  const fetchStatistics = async () => {
    try {
      const params = new URLSearchParams();
      if (filterSource) {
        params.append('source', filterSource);
      }

      const url = params.toString() 
        ? `${API_ENDPOINTS.activityLogs.statistics}?${params}`
        : API_ENDPOINTS.activityLogs.statistics;

      console.log('📊 Fetching statistics from:', buildApiUrl(url));
      
      const response = await fetch(buildApiUrl(url), {
        headers: { 'ngrok-skip-browser-warning': 'true' },
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Statistics data:', data.data);
        setStatistics(data.data);
      }
    } catch (error) {
      console.error('Error fetching statistics:', error);
    }
  };

  const applyFilters = () => {
    setCurrentPage(1);
    fetchLogs();
  };

  const handleReset = () => {
    setFilterSource('');
    setFilterUser('');
    setSearchKey('');
    setDateFrom('');
    setDateTo('');
    setCurrentPage(1);
  };

  const handleExport = () => {
    // Create CSV content
    const headers = ['Date & Time', 'User', 'Source/Module', 'Action Description', 'IP Address', 'Browser'];
    const csvContent = [
      headers.join(','),
      ...logs.map((log) =>
        [
          log.dateTime,
          log.userName || `User ${log.userId}`,
          log.source,
          `"${log.remark.replace(/"/g, '""')}"`, // Escape quotes
          log.ipAddress,
          `"${log.browser?.substring(0, 50) || 'N/A'}"`,
        ].join(',')
      ),
    ].join('\n');

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `activity_logs_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Activity logs exported successfully');
  };

  const getSourceIcon = (source: string) => {
    const sourceMap: { [key: string]: JSX.Element } = {
      'fleet_management': <Edit className="w-4 h-4" />,
      'repair_code_categories': <FileText className="w-4 h-4" />,
      'maintenance': <Edit className="w-4 h-4" />,
      'defect_logging': <AlertCircle className="w-4 h-4" />,
      'repair_orders': <FileText className="w-4 h-4" />,
      'Manage Repair Code Categories': <FileText className="w-4 h-4" />,
      'Maintenance Service History': <Calendar className="w-4 h-4" />,
      'Manage Defects': <AlertCircle className="w-4 h-4" />,
      'Manage Repair Orders': <FileText className="w-4 h-4" />,
      'System - Scheduled Maintenance': <Settings className="w-4 h-4" />,
    };
    return sourceMap[source] || <Info className="w-4 h-4" />;
  };

  const getSourceColor = (source: string) => {
    const colorMap: { [key: string]: string } = {
      'fleet_management': 'bg-blue-50 text-blue-700 border-blue-200',
      'repair_code_categories': 'bg-purple-50 text-purple-700 border-purple-200',
      'maintenance': 'bg-green-50 text-green-700 border-green-200',
      'defect_logging': 'bg-orange-50 text-orange-700 border-orange-200',
      'repair_orders': 'bg-indigo-50 text-indigo-700 border-indigo-200',
      'Manage Repair Code Categories': 'bg-purple-50 text-purple-700 border-purple-200',
      'Maintenance Service History': 'bg-teal-50 text-teal-700 border-teal-200',
      'Manage Defects': 'bg-orange-50 text-orange-700 border-orange-200',
      'Manage Repair Orders': 'bg-indigo-50 text-indigo-700 border-indigo-200',
      'System - Scheduled Maintenance': 'bg-slate-50 text-slate-700 border-slate-200',
    };
    return colorMap[source] || 'bg-gray-50 text-gray-700 border-gray-200';
  };

  const getActionType = (remark: string): { type: string; color: string } => {
    const remarkLower = remark.toLowerCase();
    
    if (remarkLower.includes('created') || remarkLower.includes('added')) {
      return { type: 'Create', color: 'bg-green-100 text-green-800 border-green-300' };
    }
    if (remarkLower.includes('updated') || remarkLower.includes('modified')) {
      return { type: 'Update', color: 'bg-blue-100 text-blue-800 border-blue-300' };
    }
    if (remarkLower.includes('deleted') || remarkLower.includes('removed')) {
      return { type: 'Delete', color: 'bg-red-100 text-red-800 border-red-300' };
    }
    if (remarkLower.includes('status')) {
      return { type: 'Status Change', color: 'bg-purple-100 text-purple-800 border-purple-300' };
    }
    
    return { type: 'Info', color: 'bg-gray-100 text-gray-800 border-gray-300' };
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).replace(',', '');
  };

  const formatSourceName = (source: string) => {
    // Handle special sources that shouldn't be split
    if (source === 'System - Scheduled Maintenance') {
      return source;
    }
    return source.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const renderValueChange = (log: LogEntry) => {
    // If oldValue or updatedValue are objects, show them nicely
    const oldVal = log.oldValue;
    const newVal = log.updatedValue;

    if (!oldVal && !newVal) return null;

    // Extract simple changes from the remark if available
    const remarkMatch = log.remark.match(/: (.*) → (.*)/);
    if (remarkMatch) {
      return (
        <div className="flex flex-wrap items-center gap-4 text-xs mt-2">
          <div className="flex items-center gap-2">
            <span className="text-gray-500">From:</span>
            <span className="text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200">
              {remarkMatch[1]}
            </span>
          </div>
          <span className="text-gray-400">→</span>
          <div className="flex items-center gap-2">
            <span className="text-gray-500">To:</span>
            <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-200">
              {remarkMatch[2]}
            </span>
          </div>
        </div>
      );
    }

    // If values are objects, show key changes
    if (typeof oldVal === 'object' && typeof newVal === 'object' && oldVal && newVal) {
      const changes: string[] = [];
      
      // ✅ Fields to exclude from automatic change tracking (we handle these in remark)
      const excludedFields = ['id', 'issue_type', 'repair_code_category', 'vehicle_id', 'created_at', 'updated_at'];
      
      Object.keys(newVal).forEach(key => {
        if (oldVal[key] !== newVal[key] && !excludedFields.includes(key)) {
          changes.push(`${key}: ${oldVal[key]} → ${newVal[key]}`);
        }
      });

      if (changes.length > 0) {
        return (
          <div className="mt-2 p-2 bg-gray-50 rounded border border-gray-200 text-xs">
            <div className="text-gray-600 mb-1">Changes:</div>
            {changes.map((change, idx) => (
              <div key={idx} className="text-gray-700">{change}</div>
            ))}
          </div>
        );
      }
    }

    return null;
  };

  const totalPages = Math.ceil(totalLogs / itemsPerPage);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl text-gray-900 mb-1">Activity Logs</h1>
          <p className="text-sm sm:text-base text-gray-600">
            Track all user actions, fleet updates, and system activities
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              fetchLogs();
              fetchStatistics();
              toast.success('Logs refreshed');
            }}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={handleExport}
            disabled={logs.length === 0}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      {statistics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Total Logs</span>
              <Database className="w-4 h-4 text-gray-400" />
            </div>
            <div className="text-2xl font-semibold text-gray-900">{statistics.totalLogs?.toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Today</span>
              <Calendar className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-semibold text-blue-600">{statistics.logsToday?.toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">This Week</span>
              <Calendar className="w-4 h-4 text-green-500" />
            </div>
            <div className="text-2xl font-semibold text-green-600">{statistics.logsThisWeek?.toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Unique Users</span>
              <User className="w-4 h-4 text-purple-500" />
            </div>
            <div className="text-2xl font-semibold text-purple-600">{statistics.uniqueUsers}</div>
          </div>
        </div>
      )}

      {/* Filters Card */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <h3 className="text-base text-gray-900">Filters</h3>
        </div>

        <div className="space-y-3">
          {/* First Row: Dates and Dropdowns */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {/* Date From */}
            <div>
              <DatePicker
                value={dateFrom}
                onChange={(date) => {
                  setDateFrom(date ? date.toISOString().split('T')[0] : '');
                  setCurrentPage(1);
                }}
                placeholder="Date From (yyyy-mm-dd)"
              />
            </div>

            {/* Date To */}
            <div>
              <DatePicker
                value={dateTo}
                onChange={(date) => {
                  setDateTo(date ? date.toISOString().split('T')[0] : '');
                  setCurrentPage(1);
                }}
                placeholder="Date To (yyyy-mm-dd)"
              />
            </div>

            {/* Module/Source */}
            <div>
              <select
                value={filterSource}
                onChange={(e) => {
                  setFilterSource(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Modules</option>
                {sources.map((source) => (
                  <option key={source} value={source}>
                    {formatSourceName(source)}
                  </option>
                ))}
              </select>
            </div>

            {/* User */}
            <div>
              <select
                value={filterUser}
                onChange={(e) => {
                  setFilterUser(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Users</option>
                {users.map((user) => (
                  <option key={user.userId} value={user.userId}>
                    {user.userName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Second Row: Search */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchKey}
                onChange={(e) => setSearchKey(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    setCurrentPage(1);
                    applyFilters();
                  }
                }}
                placeholder="Search in descriptions, values, or actions..."
                className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-white text-gray-700 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Results Card */}
      <div className="bg-white rounded-lg border border-gray-200">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-gray-200">
          <div className="text-sm text-gray-600">
            Showing {logs.length > 0 ? ((currentPage - 1) * itemsPerPage + 1) : 0} to{' '}
            {Math.min(currentPage * itemsPerPage, totalLogs)} of {totalLogs} log entries
          </div>
        </div>

        {/* Logs List */}
        <div className="divide-y divide-gray-200">
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
              <p className="text-sm text-gray-500">Loading activity logs...</p>
            </div>
          ) : logs.length > 0 ? (
            logs.map((log) => {
              const actionType = getActionType(log.remark);
              
              return (
                <div key={log.logId} className="p-4 sm:p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    {/* Icon */}
                    <div className="flex items-start gap-3 flex-shrink-0">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center border ${getSourceColor(
                          log.source
                        )}`}
                      >
                        {getSourceIcon(log.source)}
                      </div>
                    </div>

                    {/* Log Details */}
                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Header Row */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-xs border ${getSourceColor(log.source)}`}>
                            {formatSourceName(log.source)}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-xs border ${actionType.color}`}>
                            {actionType.type}
                          </span>
                          {log.logType === 'system' && (
                            <span className="px-2 py-0.5 rounded text-xs border bg-slate-100 text-slate-700 border-slate-300">
                              Automated
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">{formatDate(log.dateTime)}</div>
                      </div>

                      {/* Description */}
                      <p className="text-sm text-gray-900">{log.remark}</p>

                      {/* Value Changes */}
                      {renderValueChange(log)}

                      {/* Footer Row */}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          {log.logType === 'system' ? (
                            <>
                              <Settings className="w-3 h-3" />
                              <span>{log.userName}</span>
                            </>
                          ) : (
                            <>
                              <User className="w-3 h-3" />
                              <span>{log.userName || `User ${log.userId}`}</span>
                            </>
                          )}
                        </div>
                        <span className="text-gray-400">•</span>
                        <span>IP: {log.ipAddress}</span>
                        {log.browser && log.browser !== 'Automated' && (
                          <>
                            <span className="text-gray-400">•</span>
                            <span title={log.browser} className="truncate max-w-xs">
                              {log.browser.substring(0, 50)}...
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center text-sm text-gray-500">
              No log entries found. Try adjusting your filters.
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 sm:p-6 border-t border-gray-200">
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-1 px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
                Prev
              </button>
              <span className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="flex items-center gap-1 px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}