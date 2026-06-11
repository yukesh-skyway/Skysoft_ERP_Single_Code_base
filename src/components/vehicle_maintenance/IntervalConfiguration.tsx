import { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Search, Plus, Filter, Download, Edit2, Check, X, 
  AlertCircle, TrendingUp, BarChart3,
  ChevronDown, ChevronUp, Settings, Grid, List,
  Gauge, Calendar, LucideIcon, FileText, Hash, CheckSquare, CalendarClock, Loader2, Wrench
} from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { API_BASE_URL, API_ENDPOINTS, buildApiUrl, apiFetch } from '../../config/api';
import { useAuth } from '../../contexts/AuthContext';
import { getUsername, getUserId } from '../../utils/userSession';

interface Interval {
  id: string;
  interval_name: string;
  interval_type: 'KM' | 'Duration' | 'Both';
  maintenance_type: 'Regular Maintenance' | 'Overhaul Maintenance';
  time_unit?: 'Weeks' | 'Months' | 'Years'; // For date-based intervals
  status: 'active' | 'inactive';
  description?: string;
  created_date: string;
  created_by: string;
  last_modified?: string;
  modified_by?: string;
  icon_name: string;
}

interface FormData {
  interval_name: string;
  interval_type: 'KM' | 'Duration' | 'Both';
  maintenance_type: 'Regular Maintenance' | 'Overhaul Maintenance';
  status: 'active' | 'inactive';
  icon_name: string;
}

interface IconOption {
  label: string;
  value: string;
  icon: LucideIcon;
}

const ICON_OPTIONS: IconOption[] = [
  { label: 'Gauge', value: 'gauge', icon: Gauge },
  { label: 'Calendar', value: 'calendar', icon: Calendar },
  { label: 'Calendar + Gauge (Both)', value: 'calendar-clock', icon: CalendarClock },
];

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toISOString().split('T')[0]; // YYYY-MM-DD format
};

const INTERVAL_TYPES: Array<'KM' | 'Duration' | 'Both'> = ['KM', 'Duration', 'Both'];
const MAINTENANCE_TYPES: Array<'Regular Maintenance' | 'Overhaul Maintenance'> = ['Regular Maintenance', 'Overhaul Maintenance'];

// Custom Input Component
interface CustomInputProps {
  type?: 'text' | 'number' | 'search';
  name?: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  error?: string;
  className?: string;
  min?: number;
  max?: number;
}

function CustomInput({ 
  type = 'text', 
  name, 
  value, 
  onChange, 
  placeholder, 
  icon, 
  disabled, 
  error,
  className = '',
  min,
  max
}: CustomInputProps) {
  return (
    <div className={`relative ${className}`}>
      {icon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          {icon}
        </div>
      )}
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        min={min}
        max={max}
        className={`w-full ${icon ? 'pl-10' : 'pl-3'} pr-3 py-2 text-sm bg-white border rounded-lg transition-all ${
          disabled
            ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
            : error
            ? 'border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-100'
            : 'border-slate-300 hover:border-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
        } focus:outline-none`}
      />
    </div>
  );
}

// Custom Dropdown Component
interface CustomDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  error?: string;
  name?: string;
  className?: string;
}

function CustomDropdown({ value, onChange, options, placeholder, icon, disabled, error, name, className }: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div ref={dropdownRef} className={`relative ${className || ''}`}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full flex items-center justify-between px-4 py-2 text-sm bg-white border rounded-lg transition-all ${
          disabled
            ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
            : isOpen
            ? 'border-blue-500 ring-2 ring-blue-100 shadow-sm'
            : error
            ? 'border-red-300 hover:border-red-400'
            : 'border-slate-300 hover:bg-slate-50'
        }`}
      >
        <div className="flex items-center gap-2">
          {icon && <span className="text-slate-500">{icon}</span>}
          <span className={selectedOption ? 'text-slate-900' : 'text-slate-500'}>
            {selectedOption?.label || placeholder}
          </span>
        </div>
        <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-auto">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors ${
                value === option.value
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span>{option.label}</span>
                {value === option.value && <Check className="w-4 h-4 text-blue-600" />}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Custom Icon Dropdown Component with Icon Previews
interface CustomIconDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: IconOption[];
  placeholder?: string;
  disabled?: boolean;
  error?: string;
}

function CustomIconDropdown({ value, onChange, options, placeholder, disabled, error }: CustomIconDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);
  const SelectedIcon = selectedOption?.icon;

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full flex items-center justify-between px-3 py-2 text-sm bg-white border rounded-lg transition-all ${
          disabled
            ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
            : isOpen
            ? 'border-blue-500 ring-2 ring-blue-100 shadow-sm'
            : error
            ? 'border-red-300 hover:border-red-400'
            : 'border-slate-300 hover:border-slate-400'
        }`}
      >
        <div className="flex items-center gap-2">
          {SelectedIcon && <SelectedIcon className="w-4 h-4 text-blue-600" />}
          <span className={selectedOption ? 'text-slate-900' : 'text-slate-500'}>
            {selectedOption?.label || placeholder || 'Select Icon'}
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-auto">
          {options.map((option) => {
            const OptionIcon = option.icon;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors ${
                  value === option.value
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <OptionIcon className={`w-4 h-4 ${value === option.value ? 'text-blue-600' : 'text-slate-500'}`} />
                    <span>{option.label}</span>
                  </div>
                  {value === option.value && <Check className="w-4 h-4 text-blue-600" />}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Custom Textarea Component
interface CustomTextareaProps {
  name?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  error?: string;
  className?: string;
}

function CustomTextarea({ 
  name, 
  value, 
  onChange, 
  placeholder, 
  rows = 3,
  disabled, 
  error,
  className = ''
}: CustomTextareaProps) {
  return (
    <textarea
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      disabled={disabled}
      className={`w-full px-3 py-2 text-sm bg-white border rounded-lg transition-all ${
        disabled
          ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
          : error
          ? 'border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-100'
          : 'border-slate-300 hover:border-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
      } focus:outline-none ${className}`}
    />
  );
}

// Interval Name MultiSelect Component
interface IntervalNameMultiSelectProps {
  intervals: Interval[];
  selectedIntervalIds: string[];
  onChange: (selectedIds: string[]) => void;
}

function IntervalNameMultiSelect({ intervals, selectedIntervalIds, onChange }: IntervalNameMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredIntervals = intervals.filter(interval =>
    interval.interval_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false
  );

  const handleSelectAll = () => {
    if (selectedIntervalIds.length === intervals.length) {
      onChange([]);
    } else {
      onChange(intervals.map(i => i.id));
    }
  };

  const handleToggle = (intervalId: string) => {
    if (selectedIntervalIds.includes(intervalId)) {
      onChange(selectedIntervalIds.filter(id => id !== intervalId));
    } else {
      onChange([...selectedIntervalIds, intervalId]);
    }
  };

  const selectedCount = selectedIntervalIds.length;
  const displayText = selectedCount === 0 
    ? 'All Intervals' 
    : selectedCount === intervals.length 
    ? 'All Intervals' 
    : `${selectedCount} Interval${selectedCount === 1 ? '' : 's'}`;

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-3 py-2 text-sm bg-white border rounded-lg transition-all ${
          isOpen
            ? 'border-blue-500 ring-2 ring-blue-100 shadow-sm'
            : 'border-slate-300 hover:border-slate-400'
        }`}
      >
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <span className={selectedCount > 0 && selectedCount < intervals.length ? 'text-slate-900 font-medium' : 'text-slate-600'}>
            {displayText}
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-80 overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-slate-200">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search intervals..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-300 rounded focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none"
              />
            </div>
          </div>

          {/* Select All */}
          <div className="p-2 border-b border-slate-200">
            <button
              type="button"
              onClick={handleSelectAll}
              className="w-full text-left px-2 py-1.5 text-sm hover:bg-blue-50 rounded transition-colors flex items-center gap-2"
            >
              <div className={`w-4 h-4 border-2 rounded flex items-center justify-center ${
                selectedIntervalIds.length === intervals.length
                  ? 'bg-blue-600 border-blue-600'
                  : 'border-slate-300'
              }`}>
                {selectedIntervalIds.length === intervals.length && (
                  <Check className="w-3 h-3 text-white" />
                )}
              </div>
              <span className="font-medium text-slate-700">Select All</span>
            </button>
          </div>

          {/* Interval List */}
          <div className="max-h-60 overflow-y-auto">
            {filteredIntervals.length > 0 ? (
              filteredIntervals.map((interval) => {
                return (
                  <button
                    key={interval.id}
                    type="button"
                    onClick={() => handleToggle(interval.id)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors flex items-center gap-2 border-b border-slate-100 last:border-b-0"
                  >
                    <div className={`w-4 h-4 border-2 rounded flex items-center justify-center flex-shrink-0 ${
                      selectedIntervalIds.includes(interval.id)
                        ? 'bg-blue-600 border-blue-600'
                        : 'border-slate-300'
                    }`}>
                      {selectedIntervalIds.includes(interval.id) && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </div>
                    {interval.icon_name === 'gauge' && <Gauge className="w-4 h-4 text-blue-600 flex-shrink-0" />}
                    {interval.icon_name === 'calendar' && <Calendar className="w-4 h-4 text-blue-600 flex-shrink-0" />}
                    {interval.icon_name === 'calendar-clock' && <CalendarClock className="w-4 h-4 text-blue-600 flex-shrink-0" />}
                    {!['gauge', 'calendar', 'calendar-clock'].includes(interval.icon_name) && <Gauge className="w-4 h-4 text-blue-600 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="text-slate-900 truncate">{interval.interval_name}</div>
                      <div className="text-xs text-slate-500">
                        {interval.interval_type}
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-4 text-sm text-slate-500 text-center">
                No intervals found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function IntervalConfiguration() {
  // Get current user session
  const { user } = useAuth();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'KM' | 'Both'>('all');
  const [maintenanceTypeFilter, setMaintenanceTypeFilter] = useState<'all' | 'Regular Maintenance' | 'Overhaul Maintenance'>('all');
  const [intervalNameFilter, setIntervalNameFilter] = useState<string[]>([]); // For specific interval name filtering
  const [showFilters, setShowFilters] = useState(false);
  const [selectedIntervals, setSelectedIntervals] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortField, setSortField] = useState<keyof Interval>('interval_name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedInterval, setSelectedInterval] = useState<Interval | null>(null);
  const [formData, setFormData] = useState<FormData>({
    interval_name: '',
    interval_type: 'KM',
    maintenance_type: 'Regular Maintenance',
    status: 'active',
    icon_name: 'gauge'
  });
  const [formErrors, setFormErrors] = useState<Partial<FormData>>({});
  const [loading, setLoading] = useState(true);

  // Data from API
  const [intervals, setIntervals] = useState<Interval[]>([
    {
      id: '1',
      interval_name: 'Standard Oil Change',
      interval_type: 'KM',
      status: 'active',
      description: 'Regular oil change service interval',
      created_date: '2024-01-10',
      created_by: 'Admin User',
      last_modified: '2024-12-01',
      modified_by: 'Admin User',
      icon_name: 'gauge'
    },
    {
      id: '2',
      interval_name: 'Quarterly Inspection',
      interval_type: 'Duration',
      time_unit: 'Months',
      status: 'active',
      description: 'Quarterly safety and maintenance inspection',
      created_date: '2024-01-15',
      created_by: 'Admin User',
      last_modified: '2024-11-28',
      modified_by: 'Admin User',
      icon_name: 'calendar'
    },
    {
      id: '3',
      interval_name: 'Heavy Duty Service',
      interval_type: 'KM',
      status: 'active',
      description: 'Heavy duty service for large trucks',
      created_date: '2024-02-01',
      created_by: 'Admin User',
      last_modified: '2024-12-05',
      modified_by: 'Admin User',
      icon_name: 'clock'
    },
    {
      id: '4',
      interval_name: 'Extended Oil Service',
      interval_type: 'KM',
      status: 'active',
      description: 'Extended oil change interval for modern vans',
      created_date: '2024-02-10',
      created_by: 'Admin User',
      last_modified: '2024-12-08',
      modified_by: 'Admin User',
      icon_name: 'gauge'
    },
    {
      id: '5',
      interval_name: 'Tire Rotation',
      interval_type: 'Both',
      time_unit: 'Months',
      status: 'active',
      description: 'Regular tire rotation service',
      created_date: '2024-02-20',
      created_by: 'Admin User',
      last_modified: '2024-11-30',
      modified_by: 'Admin User',
      icon_name: 'calendar-clock'
    },
    {
      id: '6',
      interval_name: 'Monthly Check',
      interval_type: 'Duration',
      time_unit: 'Months',
      status: 'active',
      description: 'Monthly safety check for passenger buses',
      created_date: '2024-03-01',
      created_by: 'Admin User',
      last_modified: '2024-12-10',
      modified_by: 'Admin User',
      icon_name: 'calendar'
    },
    {
      id: '7',
      interval_name: 'Brake Service',
      interval_type: 'KM',
      status: 'active',
      description: 'Brake system inspection and service',
      created_date: '2024-03-10',
      created_by: 'Admin User',
      last_modified: '2024-12-03',
      modified_by: 'Admin User',
      icon_name: 'gauge'
    },
    {
      id: '8',
      interval_name: 'Annual Service',
      interval_type: 'Duration',
      time_unit: 'Years',
      status: 'active',
      description: 'Comprehensive annual maintenance service',
      created_date: '2024-03-15',
      created_by: 'Admin User',
      last_modified: '2024-11-25',
      modified_by: 'Admin User',
      icon_name: 'calendar'
    },
    {
      id: '9',
      interval_name: 'Bi-Weekly Inspection',
      interval_type: 'Duration',
      time_unit: 'Weeks',
      status: 'active',
      description: 'Regular bi-weekly inspection for rental vehicles',
      created_date: '2024-04-01',
      created_by: 'Admin User',
      last_modified: '2024-12-01',
      modified_by: 'Admin User',
      icon_name: 'calendar'
    }
  ]);

  // Fetch intervals from API on component mount
  useEffect(() => {
    fetchIntervals();
  }, []);

  const fetchIntervals = async () => {
    try {
      setLoading(true);
      const response = await fetch(buildApiUrl(API_ENDPOINTS.intervalConfiguration.base), {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Fetched intervals from API:', data);
        
        // Map and validate intervals from API
        const mappedIntervals = (data.data || []).map((interval: any) => {
          // Map interval_type from backend format (uppercase) to frontend format (title case)
          let intervalType = interval.setting_type || interval.interval_type;
          if (intervalType === 'KMS') intervalType = 'KM';
          if (intervalType === 'DURATION') intervalType = 'Duration';
          if (intervalType === 'BOTH') intervalType = 'Both';
          
          // Map maintenance_type from backend format (uppercase) to frontend format
          let maintenanceType = interval.maintenance_type;
          if (maintenanceType === 'REGULAR') maintenanceType = 'Regular Maintenance';
          if (maintenanceType === 'OVERHAUL') maintenanceType = 'Overhaul Maintenance';
          
          // Map status: 1 = active, 2 = inactive
          const status = interval.status === 1 || interval.status === '1' ? 'active' : 'inactive';
          
          return {
            id: interval.id?.toString() || '',
            interval_name: interval.setting_name || interval.interval_name || '',
            interval_type: intervalType,
            maintenance_type: maintenanceType || 'Regular Maintenance',
            time_unit: interval.time_unit || undefined,
            status: status,
            description: interval.description || '',
            created_date: interval.added_on || interval.created_date || new Date().toISOString().split('T')[0],
            created_by: interval.added_by_name || interval.created_by || `User ${interval.added_by || 'Unknown'}`,
            last_modified: interval.last_modified || interval.added_on || new Date().toISOString().split('T')[0],
            modified_by: interval.modified_by || interval.added_by_name || interval.created_by || `User ${interval.added_by || 'Unknown'}`,
            // Ensure icon_name has a default value
            icon_name: interval.icon_name || 
                      (intervalType === 'KM' ? 'gauge' : 
                       intervalType === 'Duration' ? 'calendar' : 
                       intervalType === 'Both' ? 'calendar-clock' : 'gauge')
          };
        });
        
        // Filter out any invalid intervals (missing required fields)
        const validIntervals = mappedIntervals.filter((interval: Interval) => {
          return interval.interval_name && interval.interval_type && interval.status;
        });
        
        if (validIntervals.length < mappedIntervals.length) {
          console.warn('⚠️ Some intervals were filtered out due to missing required fields');
          toast.warning(`${mappedIntervals.length - validIntervals.length} intervals were filtered out due to missing data`);
          console.log('Invalid intervals:', mappedIntervals.filter((i: any) => 
            !i.interval_name || !i.interval_type || !i.status
          ));
        }
        
        setIntervals(validIntervals);
      } else {
        console.warn('⚠️ API returned error, using mock data');
        toast.error('Failed to load intervals from server');
        // Keep mock data if API fails
      }
    } catch (error) {
      console.error('❌ Error fetching intervals:', error);
      // Keep mock data if API fails
    } finally {
      setLoading(false);
    }
  };

  // Filtering and sorting
  const filteredIntervals = useMemo(() => {
    console.log('🔍 Filter Debug:', {
      maintenanceTypeFilter,
      totalIntervals: intervals.length,
      intervalMaintenanceTypes: intervals.map(i => i.maintenance_type)
    });
    
    let filtered = intervals.filter(interval => {
      // Ensure interval_name exists before filtering
      const matchesSearch = 
        interval.interval_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false;
      
      const matchesStatus = statusFilter === 'all' || interval.status === statusFilter;
      const matchesType = typeFilter === 'all' || interval.interval_type === typeFilter;
      const matchesMaintenanceType = maintenanceTypeFilter === 'all' || interval.maintenance_type === maintenanceTypeFilter;
      
      // Debug individual interval matching
      if (maintenanceTypeFilter !== 'all') {
        console.log('Checking interval:', {
          name: interval.interval_name,
          maintenanceType: interval.maintenance_type,
          filterValue: maintenanceTypeFilter,
          matches: matchesMaintenanceType
        });
      }
      
      // Interval name filter - if specific intervals selected, only show those
      const matchesIntervalName = intervalNameFilter.length === 0 || intervalNameFilter.includes(interval.id);
      
      return matchesSearch && matchesStatus && matchesType && matchesMaintenanceType && matchesIntervalName;
    });

    // Sort
    filtered.sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      
      // Handle undefined/null values - push them to the end
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [intervals, searchTerm, statusFilter, typeFilter, maintenanceTypeFilter, intervalNameFilter, sortField, sortDirection]);

  // Calculate active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchTerm) count++;
    if (statusFilter !== 'all') count++;
    if (typeFilter !== 'all') count++;
    if (maintenanceTypeFilter !== 'all') count++;
    if (intervalNameFilter.length > 0 && intervalNameFilter.length < intervals.length) count++;
    return count;
  }, [searchTerm, statusFilter, typeFilter, maintenanceTypeFilter, intervalNameFilter, intervals.length]);

  // Clear all filters function
  const handleClearAllFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setTypeFilter('all');
    setMaintenanceTypeFilter('all');
    setIntervalNameFilter([]);
    setCurrentPage(1);
    toast.success('All filters cleared');
  };

  // Pagination
  const totalPages = Math.ceil(filteredIntervals.length / itemsPerPage);
  const paginatedIntervals = filteredIntervals.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSort = (field: keyof Interval) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIntervals(paginatedIntervals.map(i => i.id));
    } else {
      setSelectedIntervals([]);
    }
  };

  const handleSelectInterval = (id: string) => {
    setSelectedIntervals(prev =>
      prev.includes(id) ? prev.filter(iId => iId !== id) : [...prev, id]
    );
  };



  const handleExport = () => {
    const dataStr = JSON.stringify(filteredIntervals, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `interval_configuration_${new Date().toISOString().split('T')[0]}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const stats = useMemo(() => {
    const active = intervals.filter(i => i.status === 'active').length;
    const inactive = intervals.filter(i => i.status === 'inactive').length;

    return { active, inactive };
  }, [intervals]);

  const handleBulkActive = () => {
    toast.warning(
      <div>
        <p className="font-medium">Set {selectedIntervals.length} interval{selectedIntervals.length === 1 ? '' : 's'} to active?</p>
        <p className="text-sm mt-1">This will activate the selected intervals.</p>
      </div>,
      {
        duration: 6000,
        action: {
          label: 'Confirm',
          onClick: async () => {
            try {
              // Update each selected interval
              const updatePromises = selectedIntervals.map(async (intervalId) => {
                const interval = intervals.find(i => i.id === intervalId);
                if (!interval) return;
                
                // Map to backend format
                let backendIntervalType = interval.interval_type;
                if (backendIntervalType === 'KM') backendIntervalType = 'KMS';
                if (backendIntervalType === 'Duration') backendIntervalType = 'DURATION';
                if (backendIntervalType === 'Both') backendIntervalType = 'BOTH';
                
                const payload = {
                  setting_name: interval.interval_name,
                  setting_type: backendIntervalType,
                  status: 1 // Active
                };
                
                return fetch(buildApiUrl(API_ENDPOINTS.intervalConfiguration.byId(intervalId)), {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true'
                  },
                  body: JSON.stringify(payload)
                });
              });
              
              await Promise.all(updatePromises);
              setSelectedIntervals([]);
              toast.success(`${selectedIntervals.length} interval${selectedIntervals.length === 1 ? '' : 's'} activated successfully!`);
              fetchIntervals(); // Refresh the list
            } catch (error) {
              console.error('❌ Error activating intervals:', error);
              toast.error('Failed to activate intervals');
            }
          },
        },
      }
    );
  };

  const handleBulkInactive = () => {
    toast.warning(
      <div>
        <p className="font-medium">Set {selectedIntervals.length} interval{selectedIntervals.length === 1 ? '' : 's'} to inactive?</p>
        <p className="text-sm mt-1">This will deactivate the selected intervals.</p>
      </div>,
      {
        duration: 6000,
        action: {
          label: 'Confirm',
          onClick: async () => {
            try {
              // Update each selected interval
              const updatePromises = selectedIntervals.map(async (intervalId) => {
                const interval = intervals.find(i => i.id === intervalId);
                if (!interval) return;
                
                // Map to backend format
                let backendIntervalType = interval.interval_type;
                if (backendIntervalType === 'KM') backendIntervalType = 'KMS';
                if (backendIntervalType === 'Duration') backendIntervalType = 'DURATION';
                if (backendIntervalType === 'Both') backendIntervalType = 'BOTH';
                
                const payload = {
                  setting_name: interval.interval_name,
                  setting_type: backendIntervalType,
                  status: 2 // Inactive
                };
                
                return fetch(buildApiUrl(API_ENDPOINTS.intervalConfiguration.byId(intervalId)), {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true'
                  },
                  body: JSON.stringify(payload)
                });
              });
              
              await Promise.all(updatePromises);
              setSelectedIntervals([]);
              toast.success(`${selectedIntervals.length} interval${selectedIntervals.length === 1 ? '' : 's'} deactivated successfully!`);
              fetchIntervals(); // Refresh the list
            } catch (error) {
              console.error('❌ Error deactivating intervals:', error);
              toast.error('Failed to deactivate intervals');
            }
          },
        },
      }
    );
  };

  const openCreateModal = () => {
    setModalMode('create');
    setSelectedInterval(null);
    setFormData({
      interval_name: '',
      interval_type: 'KM',
      status: 'active',
      icon_name: 'gauge'
    });
    setFormErrors({});
    setShowModal(true);
  };

  const openEditModal = (interval: Interval) => {
    setModalMode('edit');
    setSelectedInterval(interval);
    setFormData({
      interval_name: interval.interval_name,
      interval_type: interval.interval_type,
      maintenance_type: interval.maintenance_type,
      status: interval.status,
      icon_name: interval.icon_name
    });
    setFormErrors({});
    setShowModal(true);
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (formErrors[name as keyof FormData]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: undefined
      }));
    }
  };

  // Handlers for dropdown changes in modal
  const handleIntervalTypeChange = (value: string) => {
    const intervalType = value as 'KM' | 'Duration' | 'Both';
    
    // Auto-set icon based on interval type
    let autoIcon = 'gauge'; // default
    if (intervalType === 'KM') {
      autoIcon = 'gauge';
    } else if (intervalType === 'Duration') {
      autoIcon = 'calendar';
    } else if (intervalType === 'Both') {
      autoIcon = 'calendar-clock';
    }
    
    setFormData(prev => ({
      ...prev,
      interval_type: intervalType,
      icon_name: autoIcon
    }));
    if (formErrors.interval_type) {
      setFormErrors(prev => ({
        ...prev,
        interval_type: undefined
      }));
    }
  };

  const handleStatusChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      status: value as 'active' | 'inactive'
    }));
    if (formErrors.status) {
      setFormErrors(prev => ({
        ...prev,
        status: undefined
      }));
    }
  };

  const handleIconChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      icon_name: value
    }));
    if (formErrors.icon_name) {
      setFormErrors(prev => ({
        ...prev,
        icon_name: undefined
      }));
    }
  };

  // Removed handleTimeUnitChange - time_unit field no longer used

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Partial<FormData> = {};
    if (!formData.interval_name) {
      errors.interval_name = 'Interval name is required';
    }
    setFormErrors(errors);
    if (Object.keys(errors).length === 0) {
      try {
        if (modalMode === 'create') {
          // Map to backend format
          let backendIntervalType = formData.interval_type;
          if (backendIntervalType === 'KM') backendIntervalType = 'KMS';
          if (backendIntervalType === 'Duration') backendIntervalType = 'DURATION';
          if (backendIntervalType === 'Both') backendIntervalType = 'BOTH';
          
          // Map maintenance_type to backend format
          let backendMaintenanceType = formData.maintenance_type === 'Regular Maintenance' ? 'REGULAR' : 'OVERHAUL';
          
          const backendStatus = formData.status === 'active' ? 1 : 2;
          
          const payload = {
            setting_name: formData.interval_name,
            setting_type: backendIntervalType,
            maintenance_type: backendMaintenanceType,
            status: backendStatus,
            added_by: getUserId(user) || 1 // Use session user ID, fallback to 1
          };
          
          console.log('Creating interval with payload:', payload);
          
          const result = await apiFetch(API_ENDPOINTS.intervalConfiguration.base, {
            method: 'POST',
            body: JSON.stringify(payload)
          });
          
          if (result.success) {
            console.log('✅ Interval created:', result);
            toast.success('Interval created successfully!');
            fetchIntervals(); // Refresh the list
          } else {
            console.error('❌ Failed to create interval:', result);
            
            // Check for duplicate name error
            if (result.error && (result.error.includes('Duplicate') || result.error.includes('duplicate') || result.error.includes('already exists'))) {
              toast.error('An interval with this name already exists');
            } else if (result.error && result.error.includes('Database schema not updated')) {
              // Database column missing error
              toast.error('Database Error: maintenance_type column missing. Please run the ALTER TABLE command.');
              if (result.details && result.details.length > 0) {
                console.error('Database schema issue:', result.details);
              }
            } else {
              // Show detailed error message
              const errorMsg = result.error || result.message || 'Failed to create interval';
              toast.error(errorMsg);
              if (result.details && result.details.length > 0) {
                console.error('Error details:', result.details);
              }
            }
            return; // Don't close modal on error
          }
        } else if (modalMode === 'edit' && selectedInterval) {
          // Map to backend format
          let backendIntervalType = formData.interval_type;
          if (backendIntervalType === 'KM') backendIntervalType = 'KMS';
          if (backendIntervalType === 'Duration') backendIntervalType = 'DURATION';
          if (backendIntervalType === 'Both') backendIntervalType = 'BOTH';
          
          // Map maintenance_type to backend format
          let backendMaintenanceType = formData.maintenance_type === 'Regular Maintenance' ? 'REGULAR' : 'OVERHAUL';
          
          const backendStatus = formData.status === 'active' ? 1 : 2;
          
          const payload = {
            setting_name: formData.interval_name,
            setting_type: backendIntervalType,
            maintenance_type: backendMaintenanceType,
            status: backendStatus,
            modified_by: getUserId(user) || 1 // Use session user ID, fallback to 1
          };
          
          console.log('Updating interval with payload:', payload);
          
          const result = await apiFetch(API_ENDPOINTS.intervalConfiguration.byId(selectedInterval.id), {
            method: 'PUT',
            body: JSON.stringify(payload)
          });
          
          if (result.success) {
            console.log('✅ Interval updated:', result);
            toast.success('Interval updated successfully!');
            fetchIntervals(); // Refresh the list
          } else {
            console.error('❌ Failed to update interval:', result);
            
            // Check for duplicate name error
            if (result.error && (result.error.includes('Duplicate') || result.error.includes('duplicate') || result.error.includes('already exists'))) {
              toast.error('An interval with this name already exists');
            } else if (result.error && result.error.includes('Database schema not updated')) {
              // Database column missing error
              toast.error('Database Error: maintenance_type column missing. Please run the ALTER TABLE command.');
              if (result.details && result.details.length > 0) {
                console.error('Database schema issue:', result.details);
              }
            } else {
              // Show detailed error message
              const errorMsg = result.error || result.message || 'Failed to update interval';
              toast.error(errorMsg);
              if (result.details && result.details.length > 0) {
                console.error('Error details:', result.details);
              }
            }
            return; // Don't close modal on error
          }
        }
        setShowModal(false);
        setFormData({
          interval_name: '',
          interval_type: 'KM',
          maintenance_type: 'Regular Maintenance',
          status: 'active',
          icon_name: 'gauge'
        });
        setFormErrors({});
      } catch (error) {
        console.error('❌ Error submitting form:', error);
        toast.error('An error occurred while saving the interval');
      }
    }
  };

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl text-slate-900 flex items-center gap-3">
                <Settings className="w-8 h-8 text-blue-600" />
                Scheduled Configurations Settings
              </h1>
              <p className="text-sm text-slate-600 mt-1">Configure maintenance interval settings</p>
            </div>
            <button
              onClick={openCreateModal}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Create Interval
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Total Intervals</p>
                <p className="text-2xl text-slate-900">{intervals.length}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Grid className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Active Intervals</p>
                <p className="text-2xl text-green-600">{stats.active}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Check className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Inactive Intervals</p>
                <p className="text-2xl text-orange-600">{stats.inactive}</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <X className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          {/* Toolbar */}
          <div className="p-4 border-b border-slate-200">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search */}
              <div className="flex-1">
                <CustomInput
                  type="search"
                  placeholder="Search by interval name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  icon={<Search className="w-5 h-5" />}
                />
              </div>

              {/* Filters */}
              <div className="flex gap-2">
                <CustomDropdown
                  value={statusFilter}
                  onChange={(value) => setStatusFilter(value as any)}
                  options={[
                    { value: 'all', label: 'All Status' },
                    { value: 'active', label: 'Active Only' },
                    { value: 'inactive', label: 'Inactive Only' }
                  ]}
                  icon={<CheckSquare className="w-4 h-4" />}
                />

                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`px-4 py-2 border rounded-lg transition-colors flex items-center gap-2 ${
                    showFilters
                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                      : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Filter className="w-5 h-5" />
                  Filters
                  {activeFilterCount > 0 && (
                    <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full font-medium">
                      {activeFilterCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={handleExport}
                  className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  Export
                </button>
              </div>
            </div>

            {/* Advanced Filters */}
            {showFilters && (
              <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-slate-700">Advanced Filters</h3>
                  {activeFilterCount > 0 && (
                    <button
                      onClick={handleClearAllFilters}
                      className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1.5 border border-red-200"
                    >
                      <X className="w-4 h-4" />
                      Clear All Filters
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm text-slate-700 mb-1">Select Intervals</label>
                    <IntervalNameMultiSelect
                      intervals={intervals}
                      selectedIntervalIds={intervalNameFilter}
                      onChange={setIntervalNameFilter}
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-slate-700 mb-1">Interval Type</label>
                    <CustomDropdown
                      value={typeFilter}
                      onChange={(value) => setTypeFilter(value as any)}
                      options={[
                        { value: 'all', label: 'All Types' },
                        { value: 'KM', label: 'KM' },
                        { value: 'Both', label: 'Both' }
                      ]}
                      icon={<Filter className="w-4 h-4" />}
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-slate-700 mb-1">Maintenance Type</label>
                    <CustomDropdown
                      value={maintenanceTypeFilter}
                      onChange={(value) => setMaintenanceTypeFilter(value as any)}
                      options={[
                        { value: 'all', label: 'All Types' },
                        { value: 'Regular Maintenance', label: 'Regular Maintenance' },
                        { value: 'Overhaul Maintenance', label: 'Overhaul Maintenance' }
                      ]}
                      icon={<Wrench className="w-4 h-4" />}
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-slate-700 mb-1">Items per page</label>
                    <CustomDropdown
                      value={String(itemsPerPage)}
                      onChange={(value) => {
                        setItemsPerPage(Number(value));
                        setCurrentPage(1);
                      }}
                      options={[
                        { value: '10', label: '10 per page' },
                        { value: '25', label: '25 per page' },
                        { value: '50', label: '50 per page' },
                        { value: '100', label: '100 per page' }
                      ]}
                      icon={<List className="w-4 h-4" />}
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-slate-700 mb-1">Sort direction</label>
                    <CustomDropdown
                      value={sortDirection}
                      onChange={(value) => setSortDirection(value as 'asc' | 'desc')}
                      options={[
                        { value: 'asc', label: 'Ascending' },
                        { value: 'desc', label: 'Descending' }
                      ]}
                      icon={<ChevronDown className="w-4 h-4" />}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Active Filters - Compact Pills */}
          {activeFilterCount > 0 && (
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-slate-600">Filters:</span>
              
              {searchTerm && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-slate-300 rounded text-xs">
                  <Search className="w-3 h-3 text-slate-500" />
                  <span className="max-w-[100px] truncate">{searchTerm}</span>
                  <button
                    onClick={() => setSearchTerm('')}
                    className="hover:bg-slate-100 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3 text-slate-500" />
                  </button>
                </span>
              )}

              {statusFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-slate-300 rounded text-xs">
                  <CheckSquare className="w-3 h-3 text-slate-500" />
                  <span className="capitalize">{statusFilter}</span>
                  <button
                    onClick={() => setStatusFilter('all')}
                    className="hover:bg-slate-100 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3 text-slate-500" />
                  </button>
                </span>
              )}

              {typeFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-slate-300 rounded text-xs">
                  <Filter className="w-3 h-3 text-slate-500" />
                  <span>{typeFilter}</span>
                  <button
                    onClick={() => setTypeFilter('all')}
                    className="hover:bg-slate-100 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3 text-slate-500" />
                  </button>
                </span>
              )}

              {intervalNameFilter.length > 0 && intervalNameFilter.length < intervals.length && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-slate-300 rounded text-xs">
                  <Settings className="w-3 h-3 text-slate-500" />
                  <span>{intervalNameFilter.length} interval{intervalNameFilter.length === 1 ? '' : 's'}</span>
                  <button
                    onClick={() => setIntervalNameFilter([])}
                    className="hover:bg-slate-100 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3 text-slate-500" />
                  </button>
                </span>
              )}

              <span className="text-slate-300">|</span>
              <span className="text-xs text-slate-600">
                <span className="font-semibold text-slate-900">{filteredIntervals.length}</span> of {intervals.length}
              </span>
            </div>
          )}

          {/* Bulk Operations Bar */}
          {selectedIntervals.length > 0 && (
            <div className="px-4 py-3 bg-blue-50 border-b border-blue-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-blue-900">
                    {selectedIntervals.length} interval{selectedIntervals.length === 1 ? '' : 's'} selected
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleBulkActive}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      Set to Active
                    </button>
                    <button
                      onClick={handleBulkInactive}
                      className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors flex items-center gap-2"
                    >
                      <X className="w-4 h-4" />
                      Set to Inactive
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedIntervals([])}
                  className="text-sm text-slate-600 hover:text-slate-800"
                >
                  Clear selection
                </button>
              </div>
            </div>
          )}

          {/* Table View */}
          {viewMode === 'list' ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedIntervals.length === paginatedIntervals.length && paginatedIntervals.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-4 py-3 text-left">
                      <button
                        onClick={() => handleSort('interval_name')}
                        className="flex items-center gap-1 text-sm text-slate-700 hover:text-slate-900 font-medium"
                      >
                        Interval Name
                        {sortField === 'interval_name' && (
                          sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <button
                        onClick={() => handleSort('interval_type')}
                        className="flex items-center gap-1 text-sm text-slate-700 hover:text-slate-900 font-medium"
                      >
                        Type
                        {sortField === 'interval_type' && (
                          sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <button
                        onClick={() => handleSort('maintenance_type')}
                        className="flex items-center gap-1 text-sm text-slate-700 hover:text-slate-900 font-medium"
                      >
                        Maintenance Type
                        {sortField === 'maintenance_type' && (
                          sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-sm text-slate-700 font-medium whitespace-nowrap">Status</th>
                    <th className="px-4 py-3 text-left text-sm text-slate-700 font-medium whitespace-nowrap">Created Date</th>
                    <th className="px-4 py-3 text-left text-sm text-slate-700 font-medium whitespace-nowrap">Created by</th>
                    <th className="px-4 py-3 text-center text-sm text-slate-700 font-medium whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {paginatedIntervals.map((interval) => (
                    <tr
                      key={interval.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        selectedIntervals.includes(interval.id) ? 'bg-blue-50' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIntervals.includes(interval.id)}
                          onChange={() => handleSelectInterval(interval.id)}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {interval.icon_name === 'gauge' && <Gauge className="w-4 h-4 text-blue-600" />}
                          {interval.icon_name === 'calendar' && <Calendar className="w-4 h-4 text-blue-600" />}
                          {interval.icon_name === 'calendar-clock' && <CalendarClock className="w-4 h-4 text-blue-600" />}
                          {!['gauge', 'calendar', 'calendar-clock'].includes(interval.icon_name) && <Gauge className="w-4 h-4 text-blue-600" />}
                          <span className="text-sm text-slate-900 font-medium">{interval.interval_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded font-medium">
                          {interval.interval_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                          interval.maintenance_type === 'Regular Maintenance' 
                            ? 'bg-indigo-100 text-indigo-700' 
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          <Wrench className="w-3 h-3" />
                          {interval.maintenance_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                            interval.status === 'active'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {interval.status === 'active' ? (
                            <>
                              <Check className="w-3 h-3" />
                              Active
                            </>
                          ) : (
                            <>
                              <X className="w-3 h-3" />
                              Inactive
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                        {formatDate(interval.created_date)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                        {interval.created_by}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => openEditModal(interval)}
                          className="inline-flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            /* Grid View */
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {paginatedIntervals.map((interval) => (
                <div
                  key={interval.id}
                  className={`p-4 border rounded-lg hover:shadow-md transition-all ${
                    selectedIntervals.includes(interval.id)
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <input
                      type="checkbox"
                      checked={selectedIntervals.includes(interval.id)}
                      onChange={() => handleSelectInterval(interval.id)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span
                      className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                        interval.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {interval.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-2">
                      {interval.icon_name === 'gauge' && <Gauge className="w-5 h-5 text-blue-600" />}
                      {interval.icon_name === 'calendar' && <Calendar className="w-5 h-5 text-blue-600" />}
                      {interval.icon_name === 'calendar-clock' && <CalendarClock className="w-5 h-5 text-blue-600" />}
                      {!['gauge', 'calendar', 'calendar-clock'].includes(interval.icon_name) && <Gauge className="w-5 h-5 text-blue-600" />}
                      <h3 className="text-sm text-slate-900 font-medium">{interval.interval_name}</h3>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded font-medium">
                        {interval.interval_type}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                        interval.maintenance_type === 'Regular Maintenance' 
                          ? 'bg-indigo-100 text-indigo-700' 
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        <Wrench className="w-3 h-3" />
                        {interval.maintenance_type}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => openEditModal(interval)}
                    className="w-full px-3 py-2 text-sm text-blue-600 border border-blue-200 rounded hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit Interval
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {filteredIntervals.length > 0 && (
            <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between">
              <div className="text-sm text-slate-600">
                Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
                {Math.min(currentPage * itemsPerPage, filteredIntervals.length)} of{' '}
                {filteredIntervals.length} intervals
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-slate-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
                >
                  Previous
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-1 rounded text-sm ${
                        currentPage === page
                          ? 'bg-blue-600 text-white'
                          : 'border border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border border-slate-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="p-12 text-center">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-3" />
              <h3 className="text-lg text-slate-900 font-medium mb-1">Loading intervals...</h3>
              <p className="text-sm text-slate-600">
                Fetching data from the server
              </p>
            </div>
          )}

          {/* Empty State */}
          {!loading && filteredIntervals.length === 0 && (
            <div className="p-12 text-center">
              <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h3 className="text-lg text-slate-900 font-medium mb-1">
                {activeFilterCount > 0 ? 'No matching intervals found' : 'No intervals found'}
              </h3>
              <p className="text-sm text-slate-600 mb-4">
                {activeFilterCount > 0 
                  ? 'No intervals match your current filters. Try adjusting your search or filter criteria.'
                  : 'Get started by creating your first interval.'}
              </p>
              {activeFilterCount > 0 ? (
                <button
                  onClick={handleClearAllFilters}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto"
                >
                  <X className="w-4 h-4" />
                  Clear All Filters
                </button>
              ) : (
                <button
                  onClick={openCreateModal}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto"
                >
                  <Plus className="w-4 h-4" />
                  Create Interval
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl text-slate-900 font-medium mb-4">
              {modalMode === 'create' ? 'Create New Interval' : 'Edit Interval'}
            </h2>
            <form onSubmit={handleFormSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm text-slate-700 mb-1">Interval Name</label>
                  <CustomInput
                    type="text"
                    name="interval_name"
                    value={formData.interval_name}
                    onChange={handleFormChange}
                    icon={<FileText className="w-4 h-4" />}
                    error={formErrors.interval_name}
                    placeholder="e.g., Standard Oil Change"
                  />
                  {formErrors.interval_name && (
                    <p className="text-sm text-red-500 mt-1">{formErrors.interval_name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm text-slate-700 mb-1">Interval Type</label>
                  <CustomDropdown
                    value={formData.interval_type}
                    onChange={handleIntervalTypeChange}
                    options={INTERVAL_TYPES.map(type => ({ value: type, label: type }))}
                    icon={<Settings className="w-4 h-4" />}
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-700 mb-1">Maintenance Type</label>
                  <CustomDropdown
                    value={formData.maintenance_type}
                    onChange={(value) => setFormData(prev => ({ ...prev, maintenance_type: value as 'Regular Maintenance' | 'Overhaul Maintenance' }))}
                    options={MAINTENANCE_TYPES.map(type => ({ value: type, label: type }))}
                    icon={<Wrench className="w-4 h-4" />}
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-700 mb-1">Status</label>
                  <CustomDropdown
                    value={formData.status}
                    onChange={handleStatusChange}
                    options={[
                      { value: 'active', label: 'Active' },
                      { value: 'inactive', label: 'Inactive' }
                    ]}
                    icon={<CheckSquare className="w-4 h-4" />}
                  />
                </div>

                {/* Icon field hidden per user request - still maintains value in backend */}
                <div style={{ display: 'none' }}>
                  <label className="block text-sm text-slate-700 mb-1">Icon</label>
                  <CustomIconDropdown
                    value={formData.icon_name}
                    onChange={handleIconChange}
                    options={ICON_OPTIONS}
                    placeholder="Select an icon"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {modalMode === 'create' ? 'Create' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}