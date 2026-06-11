import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form@7.55.0';
import Select from 'react-select';
import { 
  Search, Download, Calendar, Wrench, CheckCircle, 
  AlertTriangle, Clock, FileText, Eye, X, Bus, 
  ArrowUpDown, ChevronLeft, ChevronRight, Filter,
  Package, Settings, RefreshCw, CheckCheck
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { API_BASE_URL, buildApiUrl, API_ENDPOINTS, apiFetch } from '../../config/api';
import { ViewRepairOrder } from './ViewRepairOrder';
import { DatePicker } from '../../components/ui/date-picker';

interface MaintenanceHistoryRecord {
  id: number;
  vehicle_id: number;
  vehicle_nickname: string;
  vehicle_type: string;
  scheduled_maintenance_id: number;
  scheduled_maintenance_name: string;
  scheduled_maintenance_setting_id: string;
  
  // RO Information
  ro_id: number;
  ro_number: string;
  ro_status: string;
  ro_completed_date: string;
  
  // Maintenance Status
  rpor_status: string; // Status in the RO (Completed, Repair_Not_Required, etc.)
  
  // Service Details
  service_completion_date: string;
  kms_at_completion: number;
  invoice_amount: number | null;
  vendor_name: string | null;
  
  // Current Tracking Information
  last_maintenance_date: string | null;
  last_replaced_km: number | null;
  current_vehicle_km: number;
  
  // Next Due Information (if status is Completed)
  next_due_km: number | null;
  next_due_date: string | null;
  km_interval: number | null;
  days_interval: number | null;
  
  // Current Assignment
  current_ro_assignment: number | null; // NULL if not assigned, RO ID if assigned
  current_ro_number: string | null;
}

interface FilterOptions {
  vehicleNicknames: string[];
  maintenanceTypes: string[];
  statuses: string[];
  vendors: string[];
}

interface FilterFormData {
  vehicleNickname: string;
  maintenanceType: string;
  status: string;
  dateFrom: string;
  dateTo: string;
}

interface SelectOption {
  value: string;
  label: string;
}

// Custom styles for react-select to match Material Design
const customSelectStyles = {
  control: (provided: any, state: any) => ({
    ...provided,
    borderColor: state.isFocused ? '#3b82f6' : '#d1d5db',
    boxShadow: state.isFocused ? '0 0 0 2px rgba(59, 130, 246, 0.5)' : 'none',
    borderRadius: '0.5rem',
    padding: '0.125rem',
    paddingLeft: '2rem', // Space for icon
    '&:hover': {
      borderColor: '#3b82f6',
    },
  }),
  option: (provided: any, state: any) => ({
    ...provided,
    backgroundColor: state.isSelected ? '#3b82f6' : state.isFocused ? '#dbeafe' : 'white',
    color: state.isSelected ? 'white' : '#374151',
    cursor: 'pointer',
    '&:active': {
      backgroundColor: '#3b82f6',
    },
  }),
  menu: (provided: any) => ({
    ...provided,
    borderRadius: '0.5rem',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    border: '1px solid #d1d5db',
    zIndex: 9999,
  }),
  menuPortal: (provided: any) => ({
    ...provided,
    zIndex: 9999,
  }),
  placeholder: (provided: any) => ({
    ...provided,
    color: '#9ca3af',
  }),
};

export function MaintenanceHistory() {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<MaintenanceHistoryRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<MaintenanceHistoryRecord[]>([]);
  
  // Search term
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // React Hook Form for filters
  const { register, watch, setValue, reset: resetFilters } = useForm<FilterFormData>({
    defaultValues: {
      vehicleNickname: '',
      maintenanceType: '',
      status: '',
      dateFrom: '',
      dateTo: ''
    }
  });
  
  const vehicleNicknameFilter = watch('vehicleNickname');
  const maintenanceTypeFilter = watch('maintenanceType');
  const statusFilter = watch('status');
  const dateFrom = watch('dateFrom');
  const dateTo = watch('dateTo');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(25);
  
  // Sorting
  const [sortField, setSortField] = useState<keyof MaintenanceHistoryRecord>('ro_completed_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // View RO Modal
  const [selectedROId, setSelectedROId] = useState<number | null>(null);
  const [showROModal, setShowROModal] = useState(false);
  
  // Filter options
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    vehicleNicknames: [],
    maintenanceTypes: [],
    statuses: [],
    vendors: []
  });

  useEffect(() => {
    fetchMaintenanceHistory();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [records, searchTerm, vehicleNicknameFilter, maintenanceTypeFilter, statusFilter, dateFrom, dateTo, sortField, sortOrder]);

  const fetchMaintenanceHistory = async () => {
    setLoading(true);
    try {
      console.log('🔍 Fetching maintenance history from:', API_ENDPOINTS.repairOrders.maintenanceHistory);
      console.log('📍 Full URL:', buildApiUrl(API_ENDPOINTS.repairOrders.maintenanceHistory));
      console.log('⚠️  If you see "Unknown column \'NaN\'" error, this is a BACKEND issue.');
      console.log('📋 Check /BACKEND_SPEC_MaintenanceHistory.md for implementation details.');
      
      const data = await apiFetch(API_ENDPOINTS.repairOrders.maintenanceHistory);

      console.log('📦 Received data:', data);

      if (!data.success) {
        throw new Error(data.error || data.message || 'Failed to fetch maintenance history');
      }

      const historyRecords = data.data || [];
      console.log(`✅ Loaded ${historyRecords.length} maintenance history records`);
      setRecords(historyRecords);
      
      // Build filter options
      const vehicles = [...new Set(historyRecords.map((r: MaintenanceHistoryRecord) => r.vehicle_nickname))].sort();
      const types = [...new Set(historyRecords.map((r: MaintenanceHistoryRecord) => r.scheduled_maintenance_name))].sort();
      const statuses = [...new Set(historyRecords.map((r: MaintenanceHistoryRecord) => r.rpor_status))].sort();
      const vendors = [...new Set(historyRecords.map((r: MaintenanceHistoryRecord) => r.vendor_name).filter(Boolean))].sort();
      
      setFilterOptions({
        vehicleNicknames: vehicles,
        maintenanceTypes: types,
        statuses: statuses,
        vendors: vendors as string[]
      });

      toast.success(`Loaded ${historyRecords.length} maintenance history records`);
    } catch (error: any) {
      console.error('❌ Error fetching maintenance history:', error);
      
      // Provide more specific error messages
      let errorMessage = error.message || 'Failed to load maintenance history';
      
      if (errorMessage.includes('NaN')) {
        errorMessage = `Backend Error: ${errorMessage}\n\n` +
          `This is a backend PHP issue. The backend is trying to use an undefined variable in a SQL query.\n` +
          `Please check /BACKEND_SPEC_MaintenanceHistory.md for the correct implementation.\n\n` +
          `Common causes:\n` +
          `1. Using $_SESSION['user_id'] when it's not set\n` +
          `2. Using a GET parameter without checking if it exists\n` +
          `3. Not validating variables before using them in SQL WHERE clauses`;
        
        console.error('🔴 BACKEND IMPLEMENTATION ERROR:');
        console.error('   The endpoint /api/repair-orders/maintenance-history needs to be created or fixed.');
        console.error('   See /BACKEND_SPEC_MaintenanceHistory.md for complete implementation guide.');
      }
      
      toast.error(errorMessage.split('\n')[0]); // Show first line in toast
      
      // Set empty data on error so UI doesn't break
      setRecords([]);
      setFilterOptions({
        vehicleNicknames: [],
        maintenanceTypes: [],
        statuses: [],
        vendors: []
      });
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...records];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(r => 
        r.vehicle_nickname.toLowerCase().includes(term) ||
        r.scheduled_maintenance_name.toLowerCase().includes(term) ||
        String(r.ro_number).toLowerCase().includes(term) ||
        r.vendor_name?.toLowerCase().includes(term)
      );
    }

    // Vehicle filter
    if (vehicleNicknameFilter) {
      filtered = filtered.filter(r => r.vehicle_nickname === vehicleNicknameFilter);
    }

    // Maintenance type filter
    if (maintenanceTypeFilter) {
      filtered = filtered.filter(r => r.scheduled_maintenance_name === maintenanceTypeFilter);
    }

    // Status filter
    if (statusFilter) {
      filtered = filtered.filter(r => r.rpor_status === statusFilter);
    }

    // Date range filter
    if (dateFrom) {
      filtered = filtered.filter(r => r.ro_completed_date >= dateFrom);
    }
    if (dateTo) {
      filtered = filtered.filter(r => r.ro_completed_date <= dateTo);
    }

    // Sorting
    filtered.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc' 
          ? aVal.localeCompare(bVal) 
          : bVal.localeCompare(aVal);
      }
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      return 0;
    });

    setFilteredRecords(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  };

  const handleSort = (field: keyof MaintenanceHistoryRecord) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    resetFilters();
  };

  const handleViewRO = (roId: number) => {
    setSelectedROId(roId);
    setShowROModal(true);
  };

  const handleCloseROModal = () => {
    setShowROModal(false);
    setSelectedROId(null);
  };

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { bg: string; text: string; border: string; icon: any }> = {
      'Completed': { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', icon: CheckCheck },
      'Repair_Not_Required': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', icon: CheckCircle },
      'In_Progress': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: Settings },
      'Pending': { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200', icon: Clock },
      'Rejected': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', icon: X },
      'Paused': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', icon: Clock },
    };

    const config = configs[status] || configs['Pending'];
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border ${config.bg} ${config.text} ${config.border}`}>
        <Icon className="w-3 h-3" />
        {status.replace(/_/g, ' ')}
      </span>
    );
  };

  const exportToCSV = () => {
    const headers = [
      'Vehicle',
      'Maintenance Type',
      'RO Number',
      'Completion Date',
      'Status',
      'KMs at Completion',
      'Next Due KM',
      'Next Due Date',
      'Vendor'
    ];

    const rows = filteredRecords.map(r => [
      r.vehicle_nickname,
      r.scheduled_maintenance_name,
      r.ro_number,
      r.ro_completed_date,
      r.rpor_status.replace(/_/g, ' '),
      r.kms_at_completion?.toString() || '',
      r.next_due_km?.toLocaleString() || 'N/A',
      r.next_due_date || 'N/A',
      r.vendor_name || 'N/A'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `maintenance-history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    toast.success('Maintenance history exported to CSV');
  };

  // Pagination calculations
  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentRecords = filteredRecords.slice(startIndex, endIndex);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-gray-600">Loading maintenance history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl text-gray-900 flex items-center gap-2">
              <Wrench className="w-6 h-6 text-blue-600" />
              Maintenance History
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              View all completed scheduled maintenance records
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchMaintenanceHistory()}
              className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2 text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <button
              onClick={exportToCSV}
              disabled={filteredRecords.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by vehicle, maintenance type, RO number, or vendor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 border rounded-lg flex items-center gap-2 text-sm ${
              showFilters ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-5 gap-3 pt-3 border-t border-gray-200">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Vehicle</label>
              <Select
                value={vehicleNicknameFilter ? { value: vehicleNicknameFilter, label: vehicleNicknameFilter } : null}
                onChange={(option) => setValue('vehicleNickname', option?.value || '')}
                options={filterOptions.vehicleNicknames.map(v => ({ value: v, label: v }))}
                isClearable
                placeholder="All Vehicles"
                styles={customSelectStyles}
                menuPortalTarget={document.body}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Maintenance Type</label>
              <Select
                value={maintenanceTypeFilter ? { value: maintenanceTypeFilter, label: maintenanceTypeFilter } : null}
                onChange={(option) => setValue('maintenanceType', option?.value || '')}
                options={filterOptions.maintenanceTypes.map(t => ({ value: t, label: t }))}
                isClearable
                placeholder="All Types"
                styles={customSelectStyles}
                menuPortalTarget={document.body}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Status</label>
              <Select
                value={statusFilter ? { value: statusFilter, label: statusFilter.replace(/_/g, ' ') } : null}
                onChange={(option) => setValue('status', option?.value || '')}
                options={filterOptions.statuses.map(s => ({ value: s, label: s.replace(/_/g, ' ') }))}
                isClearable
                placeholder="All Statuses"
                styles={customSelectStyles}
                menuPortalTarget={document.body}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Date From</label>
              <DatePicker
                value={dateFrom}
                onChange={(date) => setValue('dateFrom', date ? date.toISOString().split('T')[0] : '')}
                placeholder="Pick a date"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Date To</label>
              <DatePicker
                value={dateTo}
                onChange={(date) => setValue('dateTo', date ? date.toISOString().split('T')[0] : '')}
                placeholder="Pick a date"
              />
            </div>
            <div className="col-span-5 flex justify-end">
              <button
                onClick={handleClearFilters}
                className="px-4 py-1.5 text-sm text-gray-600 hover:text-gray-900"
              >
                Clear All Filters
              </button>
            </div>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between text-sm text-gray-600">
          <div>
            Showing {startIndex + 1}-{Math.min(endIndex, filteredRecords.length)} of {filteredRecords.length} records
            {records.length !== filteredRecords.length && ` (filtered from ${records.length} total)`}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="bg-gray-100 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left">
                <button
                  onClick={() => handleSort('vehicle_nickname')}
                  className="flex items-center gap-1 text-xs uppercase tracking-wide text-gray-700 hover:text-gray-900"
                >
                  <Bus className="w-3 h-3" />
                  Vehicle
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="px-4 py-3 text-left">
                <button
                  onClick={() => handleSort('scheduled_maintenance_name')}
                  className="flex items-center gap-1 text-xs uppercase tracking-wide text-gray-700 hover:text-gray-900"
                >
                  <Package className="w-3 h-3" />
                  Maintenance Type
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="px-4 py-3 text-left">
                <button
                  onClick={() => handleSort('ro_number')}
                  className="flex items-center gap-1 text-xs uppercase tracking-wide text-gray-700 hover:text-gray-900"
                >
                  <FileText className="w-3 h-3" />
                  RO Number
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="px-4 py-3 text-left">
                <button
                  onClick={() => handleSort('ro_completed_date')}
                  className="flex items-center gap-1 text-xs uppercase tracking-wide text-gray-700 hover:text-gray-900"
                >
                  <Calendar className="w-3 h-3" />
                  Completed Date
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="px-4 py-3 text-left">
                <span className="text-xs uppercase tracking-wide text-gray-700">Status</span>
              </th>
              <th className="px-4 py-3 text-left">
                <button
                  onClick={() => handleSort('kms_at_completion')}
                  className="flex items-center gap-1 text-xs uppercase tracking-wide text-gray-700 hover:text-gray-900"
                >
                  KMs
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="px-4 py-3 text-left">
                <span className="text-xs uppercase tracking-wide text-gray-700">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {currentRecords.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <Wrench className="w-12 h-12 text-gray-300" />
                    <p>No maintenance history records found</p>
                    <p className="text-sm">Try adjusting your filters or search criteria</p>
                  </div>
                </td>
              </tr>
            ) : (
              currentRecords.map((record, index) => (
                <tr key={`${startIndex + index}-${record.id}-${record.ro_id}`} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Bus className="w-4 h-4 text-gray-400" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">{record.vehicle_nickname}</div>
                        <div className="text-xs text-gray-500">{record.vehicle_type}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900">{record.scheduled_maintenance_name}</div>
                    <div className="text-xs text-gray-500">ID: {record.scheduled_maintenance_setting_id}</div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleViewRO(record.ro_id)}
                      className="text-sm text-blue-600 hover:text-blue-800 hover:underline font-medium"
                    >
                      {record.ro_number}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900">
                      {record.service_completion_date ? record.service_completion_date.substring(0, 10) : 'N/A'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {getStatusBadge(record.rpor_status)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900">
                      {record.kms_at_completion ? record.kms_at_completion.toLocaleString() : 'N/A'}
                    </div>
                    <div className="text-xs text-gray-500">
                      Current: {record.current_vehicle_km.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleViewRO(record.ro_id)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="View RO Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-white border-t border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-8 h-8 rounded-lg text-sm ${
                        currentPage === pageNum
                          ? 'bg-blue-600 text-white'
                          : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View RO Modal */}
      {showROModal && selectedROId && (
        <ViewRepairOrder
          roId={selectedROId}
          onClose={handleCloseROModal}
          onUpdate={fetchMaintenanceHistory}
        />
      )}
    </div>
  );
}