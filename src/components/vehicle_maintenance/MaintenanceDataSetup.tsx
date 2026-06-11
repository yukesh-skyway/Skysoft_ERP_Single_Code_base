import { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, Plus, Filter, Download, Edit2, Check, X, 
  AlertCircle, Settings, Grid, List,
  ChevronDown, ChevronUp, Wrench, Clock, Trash2,
  Gauge, Truck, Calendar, Database, Eye, CheckSquare, Square
} from 'lucide-react';
import { toast, Toaster } from 'sonner@2.0.3';
import { API_ENDPOINTS, apiFetch, buildApiUrl } from '../../config/api';
import { useAuth } from '../../contexts/AuthContext';
import { getUsername, getUserId } from '../../utils/userSession';

// Interval type from Interval Configuration
interface Interval {
  id: string;
  interval_name: string;
  interval_type: 'KMS' | 'DURATION' | 'BOTH';
  interval_value: number;
  interval_value_days?: number;
  interval_value_km?: number;
  status: 'active' | 'inactive';
  description: string;
  maintenance_type?: string; // 'Regular Maintenance' or 'Overhaul Maintenance'
}

interface ServiceSetting {
  id: string;
  interval_id: string; // Reference to interval configuration
  setting_name: string;
  interval_type: 'KMS' | 'DURATION' | 'BOTH'; // Type from the interval configuration
  kms: number;
  kms_to_alert: number;
  duration_days: number;
  duration_to_alert: number;
  time_unit?: 'days' | 'weeks' | 'months' | 'years';
  status?: 'active' | 'inactive';
  maintenance_type?: string; // 'Regular Maintenance' or 'Overhaul Maintenance'
}

interface MaintenanceConfiguration {
  id: string;
  configuration_name: string;
  settings: ServiceSetting[];
  settings_count?: number; // Count of settings from API
  status: 'active' | 'inactive';
  created_date: string;
  created_by: string;
  last_modified: string;
  modified_by: string;
}

interface FormData {
  configuration_name: string;
  status: 'active' | 'inactive';
}

interface SettingFormData {
  setting_name: string;
  kms: number | string;
  kms_to_alert: number | string;
  duration_days: number | string;
  duration_to_alert: number | string;
  time_unit: 'days' | 'weeks' | 'months' | 'years';
  status: 'active' | 'inactive';
}

// Removed VEHICLE_TYPES and VEHICLES - no longer needed

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toISOString().split('T')[0]; // YYYY-MM-DD format
};

// Custom Dropdown Component - Enterprise Style
interface DropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; disabled?: boolean }[];
  placeholder?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

function CustomDropdown({ value, onChange, options, placeholder, icon, disabled }: DropdownProps) {
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
            : 'border-slate-300 hover:border-slate-400'
        }`}
      >
        <div className="flex items-center gap-2">
          {icon && <span className="text-slate-500">{icon}</span>}
          <span className={selectedOption ? 'text-slate-900' : 'text-slate-500'}>
            {selectedOption?.label || placeholder}
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-auto">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                if (!option.disabled) {
                  onChange(option.value);
                  setIsOpen(false);
                }
              }}
              disabled={option.disabled}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                option.disabled
                  ? 'bg-slate-50 text-slate-400 cursor-not-allowed opacity-60'
                  : value === option.value
                  ? 'bg-blue-50 text-blue-700 font-medium hover:bg-blue-100'
                  : 'text-slate-700 hover:bg-blue-50'
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

// Custom Multiselect Dropdown - Enterprise Style
interface MultiSelectDropdownProps {
  value: string[];
  onChange: (value: string[]) => void;
  options: Vehicle[];
  placeholder?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  onToggle?: (vehicleNumber: string) => void;
}

function MultiSelectDropdown({ value, onChange, options, placeholder, icon, disabled, onToggle }: MultiSelectDropdownProps) {
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

  const filteredOptions = options.filter(opt =>
    opt.vehicle_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggle = (vehicleNumber: string) => {
    if (onToggle) {
      onToggle(vehicleNumber);
    }
  };

  const handleSelectAll = () => {
    if (value.length === options.length) {
      onChange([]);
    } else {
      onChange(options.map(opt => opt.vehicle_number));
    }
  };

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
            : 'border-slate-300 hover:border-slate-400'
        }`}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {icon && <span className="text-slate-500 flex-shrink-0">{icon}</span>}
          <span className={`truncate ${value.length > 0 ? 'text-slate-900' : 'text-slate-500'}`}>
            {value.length > 0 ? `${value.length} selected` : placeholder || 'Select vehicles'}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {value.length > 0 && (
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
              {value.length}
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg">
          {/* Search Box */}
          <div className="p-2 border-b border-slate-200">
            <CustomInput
              type="search"
              placeholder="Search vehicles..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              icon={<Search className="w-4 h-4" />}
            />
          </div>

          {/* Select All */}
          <div className="p-2 border-b border-slate-200 bg-slate-50">
            <button
              type="button"
              onClick={handleSelectAll}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-slate-100 rounded transition-colors"
            >
              {value.length === options.length ? (
                <CheckSquare className="w-4 h-4 text-blue-600" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span className="font-medium text-slate-700">
                {value.length === options.length ? 'Deselect All' : 'Select All'}
              </span>
            </button>
          </div>

          {/* Options List */}
          <div className="max-h-48 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-slate-500">
                No vehicles found
              </div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleToggle(option.vehicle_number)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-blue-50 transition-colors ${
                    value.includes(option.vehicle_number) ? 'bg-blue-50' : ''
                  }`}
                >
                  {value.includes(option.vehicle_number) ? (
                    <CheckSquare className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  )}
                  <span className={value.includes(option.vehicle_number) ? 'text-blue-700 font-medium' : 'text-slate-700'}>
                    {option.vehicle_number}
                  </span>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          {value.length > 0 && (
            <div className="p-2 border-t border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={() => onChange([])}
                className="w-full px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded transition-colors font-medium"
              >
                Clear Selection
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Custom Input Component - Enterprise Style
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

// Configuration Name MultiSelect Component
interface ConfigurationNameMultiSelectProps {
  configurations: MaintenanceConfiguration[];
  selectedConfigurationIds: string[];
  onChange: (selectedIds: string[]) => void;
}

function ConfigurationNameMultiSelect({ configurations, selectedConfigurationIds, onChange }: ConfigurationNameMultiSelectProps) {
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

  const filteredConfigurations = configurations.filter(config =>
    config.configuration_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectAll = () => {
    if (selectedConfigurationIds.length === configurations.length) {
      onChange([]);
    } else {
      onChange(configurations.map(c => c.id));
    }
  };

  const handleToggle = (configId: string) => {
    if (selectedConfigurationIds.includes(configId)) {
      onChange(selectedConfigurationIds.filter(id => id !== configId));
    } else {
      onChange([...selectedConfigurationIds, configId]);
    }
  };

  const selectedCount = selectedConfigurationIds.length;
  const displayText = selectedCount === 0 
    ? 'All Configurations' 
    : selectedCount === configurations.length 
    ? 'All Configurations' 
    : `${selectedCount} Configuration${selectedCount === 1 ? '' : 's'}`;

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
          <Database className="w-4 h-4 text-slate-500" />
          <span className={selectedCount > 0 && selectedCount < configurations.length ? 'text-slate-900 font-medium' : 'text-slate-600'}>
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
                placeholder="Search configurations..."
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
                selectedConfigurationIds.length === configurations.length
                  ? 'bg-blue-600 border-blue-600'
                  : 'border-slate-300'
              }`}>
                {selectedConfigurationIds.length === configurations.length && (
                  <Check className="w-3 h-3 text-white" />
                )}
              </div>
              <span className="font-medium text-slate-700">Select All</span>
            </button>
          </div>

          {/* Configuration List */}
          <div className="max-h-60 overflow-y-auto">
            {filteredConfigurations.length > 0 ? (
              filteredConfigurations.map((config) => (
                <button
                  key={config.id}
                  type="button"
                  onClick={() => handleToggle(config.id)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors flex items-center gap-2 border-b border-slate-100 last:border-b-0"
                >
                  <div className={`w-4 h-4 border-2 rounded flex items-center justify-center flex-shrink-0 ${
                    selectedConfigurationIds.includes(config.id)
                      ? 'bg-blue-600 border-blue-600'
                      : 'border-slate-300'
                  }`}>
                    {selectedConfigurationIds.includes(config.id) && (
                      <Check className="w-3 h-3 text-white" />
                    )}
                  </div>
                  <Truck className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-slate-900 truncate">{config.configuration_name}</div>
                    <div className="text-xs text-slate-500">
                      {config.settings.length} setting{config.settings.length === 1 ? '' : 's'}
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 text-xs rounded-full ${
                    config.status === 'active'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {config.status}
                  </span>
                </button>
              ))
            ) : (
              <div className="px-3 py-4 text-sm text-slate-500 text-center">
                No configurations found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Vehicle Type component removed - no longer needed

interface MaintenanceDataSetupProps {
  initialFilter?: { configurationName?: string; configId?: string } | null;
  onClearFilter?: () => void;
}

export function MaintenanceDataSetup({ initialFilter = null, onClearFilter }: MaintenanceDataSetupProps) {
  // Get current user session
  const { user } = useAuth();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [configurationNameFilter, setConfigurationNameFilter] = useState<string[]>([]); // For specific configuration name filtering
  const [showFilters, setShowFilters] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortField, setSortField] = useState<keyof MaintenanceConfiguration>('configuration_name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [showModal, setShowModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedConfig, setSelectedConfig] = useState<MaintenanceConfiguration | null>(null);
  const [formData, setFormData] = useState<FormData>({
    configuration_name: '',
    status: 'active'
  });
  const [settingFormData, setSettingFormData] = useState<SettingFormData>({
    setting_name: '',
    kms: '',
    kms_to_alert: '',
    duration_days: '',
    duration_to_alert: '',
    time_unit: 'days',
    status: 'active'
  });
  const [editingSettingId, setEditingSettingId] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<any>({});
  const [selectedIntervalId, setSelectedIntervalId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  // Interval data from Interval Configuration API
  const [availableIntervals, setAvailableIntervals] = useState<Interval[]>([]);

  // Configurations from API - initialized as empty, populated in useEffect
  const [configurations, setConfigurations] = useState<MaintenanceConfiguration[]>([]);

  // Load settings counts for all configurations
  const loadAllSettingsCounts = async (configs: MaintenanceConfiguration[]) => {
    try {
      // Load counts for each configuration in parallel
      const countPromises = configs.map(async (config) => {
        try {
          const response = await fetch(buildApiUrl(API_ENDPOINTS.configurationSettings.byConfigId(config.id)), {
            headers: {
              'ngrok-skip-browser-warning': 'true'
            }
          });
          const result = await response.json();
          
          if (result.success) {
            return {
              id: config.id,
              count: result.data.length
            };
          }
          return { id: config.id, count: 0 };
        } catch (error) {
          console.error(`Error loading count for config ${config.id}:`, error);
          return { id: config.id, count: 0 };
        }
      });

      const counts = await Promise.all(countPromises);
      
      // Update configurations with counts
      setConfigurations(prev => prev.map(config => {
        const countData = counts.find(c => c.id === config.id);
        return countData ? { ...config, settings_count: countData.count } : config;
      }));
    } catch (error) {
      console.error('Error loading settings counts:', error);
    }
  };

  // Fetch intervals and configurations from API on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setApiError(null);
        
        // Fetch intervals from Interval Configuration API (only active intervals)
        const intervalsResponse = await apiFetch(`${API_ENDPOINTS.intervalConfiguration.base}?status=1`);
        
        if (intervalsResponse.success) {
          // Map API response to UI format
          const mappedIntervals: Interval[] = intervalsResponse.data.map((interval: any) => ({
            id: interval.id.toString(),
            interval_name: interval.setting_name,
            interval_type: interval.setting_type, // 'KMS', 'DURATION', or 'BOTH'
            interval_value: 0, // Backend doesn't store interval_value, we'll handle this
            interval_value_days: 0,
            interval_value_km: 0,
            status: interval.status === 1 ? 'active' : 'inactive',
            description: interval.setting_name,
            maintenance_type: interval.maintenance_type || 'Regular Maintenance' // Add maintenance type
          }));
          
          setAvailableIntervals(mappedIntervals);
        }
        
        // Fetch configurations
        const response = await apiFetch(API_ENDPOINTS.scheduledConfigurations.base);
        
        if (response.success) {
          // Map API response to UI format
          const mappedConfigs: MaintenanceConfiguration[] = response.data.map((config: any) => ({
            id: config.id.toString(),
            configuration_name: config.configuration_name,
            status: config.status === 1 ? 'active' : 'inactive',
            settings: [], // Settings will be fetched separately when config is selected
            created_date: config.created_date || formatDate(new Date().toISOString()),
            created_by: config.created_by || 'Unknown',
            last_modified: config.last_modified || formatDate(new Date().toISOString()),
            modified_by: config.modified_by || 'Unknown'
          }));
          
          setConfigurations(mappedConfigs);
          
          // Load settings counts for all configurations
          loadAllSettingsCounts(mappedConfigs);
        }
      } catch (error: any) {
        console.error('Error fetching data:', error);
        setApiError(error.message || 'Failed to load data');
        toast.error('Failed to load data', {
          description: error.message || 'Please check your connection and try again'
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Prepare interval options for CustomDropdown
  const intervalOptions = useMemo(() => {
    // Get list of already added interval IDs from the selected configuration
    const currentSettings = selectedConfig?.settings || [];
    const addedIntervalIds = new Set(currentSettings.map(s => s.interval_id));
    
    return availableIntervals
      .filter(i => i.status === 'active')
      .map(interval => {
        const isAlreadyAdded = addedIntervalIds.has(interval.id);
        
        // Convert ENUM to display label for dropdown
        let maintenanceLabel = interval.maintenance_type || 'Regular Maintenance';
        if (maintenanceLabel === 'OVERHAUL') {
          maintenanceLabel = 'OVERHAUL';
        } else if (maintenanceLabel === 'REGULAR') {
          maintenanceLabel = 'REGULAR';
        }
        
        return {
          value: interval.id,
          label: `${interval.interval_name} (${interval.interval_type}) - ${maintenanceLabel}`,
          disabled: isAlreadyAdded // Disable already added intervals
        };
      });
  }, [availableIntervals, selectedConfig]);

  // Prepare status options for CustomDropdown in Create/Edit modal
  const statusOptions = useMemo(() => {
    return [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' }
    ];
  }, []);

  // Prepare time unit options for duration-based intervals
  const timeUnitOptions = useMemo(() => {
    return [
      { value: 'days', label: 'Days' },
      { value: 'weeks', label: 'Weeks' },
      { value: 'months', label: 'Months' },
      { value: 'years', label: 'Years' }
    ];
  }, []);

  // Get the currently selected interval to determine which fields to show
  const selectedInterval = useMemo(() => {
    return availableIntervals.find(i => i.id === selectedIntervalId);
  }, [availableIntervals, selectedIntervalId]);

  // Determine which fields should be shown based on interval type
  const intervalTypeUpper = selectedInterval?.interval_type?.toUpperCase();
  const showKmsFields = intervalTypeUpper === 'KM' || intervalTypeUpper === 'KMS' || intervalTypeUpper === 'BOTH';
  const showDurationFields = intervalTypeUpper === 'DURATION' || intervalTypeUpper === 'BOTH';

  // Filtering and sorting
  // Handle initial filter from Fleet Management navigation
  useEffect(() => {
    if (initialFilter) {
      const filters: string[] = [];
      
      // Prefer configId if available, otherwise fall back to configurationName
      if (initialFilter.configId) {
        setConfigurationNameFilter([initialFilter.configId]);
        filters.push(`Configuration: ${initialFilter.configurationName || initialFilter.configId}`);
      } else if (initialFilter.configurationName) {
        setConfigurationNameFilter([initialFilter.configurationName]);
        filters.push(`Configuration: ${initialFilter.configurationName}`);
      }
      
      if (filters.length > 0) {
        setShowFilters(true); // Automatically show filters when navigating with a filter
        toast.success('Filters Applied', {
          description: filters.join(' • '),
          duration: 4000,
        });
      }
    }
  }, [initialFilter]);

  // Also check localStorage for filter parameters (backup method)
  useEffect(() => {
    const storedFilter = localStorage.getItem('maintenanceSetupFilter');
    if (storedFilter && !initialFilter) {
      try {
        const filterData = JSON.parse(storedFilter);
        // Only apply if within last 10 seconds (to avoid stale filters)
        if (filterData.timestamp && (Date.now() - filterData.timestamp < 10000)) {
          if (filterData.configId) {
            setConfigurationNameFilter([filterData.configId]);
            setShowFilters(true);
            toast.success('Filters Applied', {
              description: `Configuration: ${filterData.configName || filterData.configId}`,
              duration: 4000,
            });
          }
          // Clear the localStorage after reading
          localStorage.removeItem('maintenanceSetupFilter');
        }
      } catch (error) {
        console.error('Error reading maintenance filter from localStorage:', error);
      }
    }
  }, [initialFilter]);

  const filteredData = useMemo(() => {
    let filtered = configurations.filter(config => {
      const matchesSearch = 
        config.configuration_name.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || config.status === statusFilter;
      
      // Configuration name filter - if specific configurations selected, only show those
      const matchesConfigurationName = configurationNameFilter.length === 0 || configurationNameFilter.includes(config.id);
      
      return matchesSearch && matchesStatus && matchesConfigurationName;
    });

    // Sort
    filtered.sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [configurations, searchTerm, statusFilter, configurationNameFilter, sortField, sortDirection]);

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchTerm) count++;
    if (statusFilter !== 'all') count++;
    if (configurationNameFilter.length > 0 && configurationNameFilter.length < configurations.length) count++;
    return count;
  }, [searchTerm, statusFilter, configurationNameFilter, configurations.length]);

  // Clear all filters function
  const handleClearAllFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setConfigurationNameFilter([]);
    setCurrentPage(1);
    if (onClearFilter) {
      onClearFilter(); // Clear the filter in App.tsx as well
    }
    toast.success('All filters cleared');
  };

  // Pagination
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSort = (field: keyof MaintenanceConfiguration) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(paginatedData.map(i => i.id));
    } else {
      setSelectedItems([]);
    }
  };

  const handleSelectItem = (id: string) => {
    setSelectedItems(prev =>
      prev.includes(id) ? prev.filter(iId => iId !== id) : [...prev, id]
    );
  };

  const handleStatusToggle = (id: string) => {
    setConfigurations(prev =>
      prev.map(config =>
        config.id === id
          ? { ...config, status: config.status === 'active' ? 'inactive' : 'active', last_modified: new Date().toISOString(), modified_by: getUsername(user) }
          : config
      )
    );
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(filteredData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `maintenance_configurations_${new Date().toISOString().split('T')[0]}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const stats = useMemo(() => {
    const active = configurations.filter(c => c.status === 'active').length;
    const inactive = configurations.filter(c => c.status === 'inactive').length;
    const totalSettings = configurations.reduce((sum, c) => sum + c.settings.length, 0);
    const avgSettings = configurations.length > 0 
      ? Math.round(totalSettings / configurations.length) 
      : 0;

    return { active, inactive, totalSettings, avgSettings };
  }, [configurations]);

  const handleBulkActive = () => {
    toast.info(`Set ${selectedItems.length} configuration${selectedItems.length === 1 ? '' : 's'} to active?`, {
      description: 'Click confirm to activate selected configurations',
      duration: 5000,
      action: {
        label: 'Confirm',
        onClick: async () => {
          try {
            const response = await apiFetch(API_ENDPOINTS.scheduledConfigurations.bulkUpdateStatus, {
              method: 'POST',
              body: JSON.stringify({
                ids: selectedItems.map(id => parseInt(id)),
                status: 1 // Active
              })
            });

            if (response.success) {
              setConfigurations(prev =>
                prev.map(config =>
                  selectedItems.includes(config.id)
                    ? { ...config, status: 'active' as const, last_modified: formatDate(new Date().toISOString()), modified_by: getUsername(user) }
                    : config
                )
              );
              setSelectedItems([]);
              toast.success('Configurations activated', {
                description: `${selectedItems.length} configuration${selectedItems.length === 1 ? '' : 's'} set to active`,
                duration: 3000,
              });
            }
          } catch (error: any) {
            console.error('Error activating configurations:', error);
            toast.error('Failed to activate configurations', {
              description: error.message || 'Please try again'
            });
          }
        },
      },
    });
  };

  const handleBulkInactive = () => {
    toast.info(`Set ${selectedItems.length} configuration${selectedItems.length === 1 ? '' : 's'} to inactive?`, {
      description: 'Click confirm to deactivate selected configurations',
      duration: 5000,
      action: {
        label: 'Confirm',
        onClick: async () => {
          try {
            const response = await apiFetch(API_ENDPOINTS.scheduledConfigurations.bulkUpdateStatus, {
              method: 'POST',
              body: JSON.stringify({
                ids: selectedItems.map(id => parseInt(id)),
                status: 2 // Inactive
              })
            });

            if (response.success) {
              setConfigurations(prev =>
                prev.map(config =>
                  selectedItems.includes(config.id)
                    ? { ...config, status: 'inactive' as const, last_modified: formatDate(new Date().toISOString()), modified_by: getUsername(user) }
                    : config
                )
              );
              setSelectedItems([]);
              toast.success('Configurations deactivated', {
                description: `${selectedItems.length} configuration${selectedItems.length === 1 ? '' : 's'} set to inactive`,
                duration: 3000,
              });
            }
          } catch (error: any) {
            console.error('Error deactivating configurations:', error);
            toast.error('Failed to deactivate configurations', {
              description: error.message || 'Please try again'
            });
          }
        },
      },
    });
  };

  const openCreateModal = () => {
    setModalMode('create');
    setSelectedConfig(null);
    setFormData({
      configuration_name: '',
      status: 'active'
    });
    setFormErrors({});
    setShowModal(true);
  };

  const openEditModal = (config: MaintenanceConfiguration) => {
    setModalMode('edit');
    setSelectedConfig(config);
    setFormData({
      configuration_name: config.configuration_name,
      status: config.status
    });
    setFormErrors({});
    setShowModal(true);
  };

  const loadConfigurationSettings = async (configId: string) => {
    try {
      const result = await apiFetch(API_ENDPOINTS.configurationSettings.byConfigId(configId));

      if (result.success) {
        // Map API response to UI format
        const settings: ServiceSetting[] = result.data.map((item: any) => {
          // Use interval_type directly from API (KMS, DURATION, or BOTH)
          const interval_type: 'KMS' | 'DURATION' | 'BOTH' = item.interval_type || 'BOTH';
          
          return {
            id: item.id.toString(),
            interval_id: item.setting.toString(),
            interval_type: interval_type,
            setting_name: item.setting_name,
            kms: item.kms,
            kms_to_alert: item.kms_to_alert,
            duration_days: item.days,
            duration_to_alert: item.days_to_alert,
            time_unit: item.time_unit.toLowerCase(),
            status: item.status === 1 ? 'active' : 'inactive',
            maintenance_type: item.maintenance_type || 'Regular Maintenance' // Pull directly from database
          };
        });

        // Update the selected config with loaded settings
        setSelectedConfig(prev => prev ? { ...prev, settings, settings_count: settings.length } : prev);
        
        // Also update the configurations array so the count persists
        setConfigurations(prev => prev.map(config => 
          config.id === configId 
            ? { ...config, settings, settings_count: settings.length }
            : config
        ));
      }
    } catch (error) {
      console.error('Error loading configuration settings:', error);
      toast.error(
        'Failed to load settings. Please ensure the backend server is running and ngrok tunnel is active. ' +
        'See /api/START_SERVER_HERE.md for instructions.',
        { duration: 8000 }
      );
    }
  };

  const openSettingsModal = async (config: MaintenanceConfiguration) => {
    setSelectedConfig(config);
    setShowSettingsModal(true);
    // Load settings from API
    await loadConfigurationSettings(config.id);
  };

  const openViewModal = async (config: MaintenanceConfiguration) => {
    setSelectedConfig(config);
    setShowViewModal(true);
    // Load settings from API
    await loadConfigurationSettings(config.id);
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (formErrors[name]) {
      setFormErrors((prev: any) => ({
        ...prev,
        [name]: undefined
      }));
    }
  };

  // Handler for Vehicle Type dropdown in Create/Edit modal
  // Handler for Status dropdown in Create/Edit modal
  const handleStatusSelect = (value: string) => {
    setFormData(prev => ({
      ...prev,
      status: value as 'active' | 'inactive'
    }));
    if (formErrors.status) {
      setFormErrors((prev: any) => ({
        ...prev,
        status: undefined
      }));
    }
  };

  const handleIntervalSelect = (intervalId: string) => {
    setSelectedIntervalId(intervalId);
    const selected = availableIntervals.find(i => i.id === intervalId);
    if (selected) {
      // Auto-populate values based on interval type
      let kms = 0;
      let kms_to_alert = 0;
      let duration_days = 0;
      let duration_to_alert = 0;

      if (selected.interval_type === 'KMS') {
        kms = selected.interval_value;
        kms_to_alert = Math.round(selected.interval_value * 0.75); // 75% threshold
      } else if (selected.interval_type === 'DURATION') {
        duration_days = selected.interval_value;
        duration_to_alert = Math.round(selected.interval_value * 0.9); // 90% threshold
      } else if (selected.interval_type === 'BOTH') {
        kms = selected.interval_value_km || selected.interval_value;
        kms_to_alert = Math.round((selected.interval_value_km || selected.interval_value) * 0.75);
        duration_days = selected.interval_value_days || selected.interval_value;
        duration_to_alert = Math.round((selected.interval_value_days || selected.interval_value) * 0.9);
      }

      setSettingFormData({
        setting_name: selected.interval_name,
        kms,
        kms_to_alert,
        duration_days,
        duration_to_alert,
        time_unit: 'days',
        status: 'active'
      });
    }
  };

  const handleSettingFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSettingFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: any = {};
    if (!formData.configuration_name) {
      errors.configuration_name = 'Configuration name is required';
    }
    setFormErrors(errors);
    if (Object.keys(errors).length === 0) {
      handleCreateOrUpdateConfiguration();
    }
  };

  // API: Create or Update Configuration
  const handleCreateOrUpdateConfiguration = async () => {
    try {
      if (modalMode === 'create') {
        const response = await apiFetch(API_ENDPOINTS.scheduledConfigurations.base, {
          method: 'POST',
          body: JSON.stringify({
            configuration_name: formData.configuration_name,
            status: formData.status === 'active' ? 1 : 2,
            user_id: getUserId(user) // Send user ID from session
          })
        });

        if (response.success) {
          // Map the created configuration to UI format
          const newConfig: MaintenanceConfiguration = {
            id: response.data.id.toString(),
            configuration_name: response.data.configuration_name,
            status: response.data.status === 1 ? 'active' : 'inactive',
            settings: [],
            created_date: response.data.created_date || formatDate(new Date().toISOString()),
            created_by: response.data.created_by || 'Unknown',
            last_modified: response.data.last_modified || formatDate(new Date().toISOString()),
            modified_by: response.data.modified_by || 'Unknown'
          };
          
          setConfigurations(prev => [...prev, newConfig]);
          // Don't show toast if backend already sent a message
          if (!response.message) {
            toast.success('Configuration created successfully');
          }
        }
      } else if (modalMode === 'edit' && selectedConfig) {
        const response = await apiFetch(
          API_ENDPOINTS.scheduledConfigurations.byId(selectedConfig.id),
          {
            method: 'PUT',
            body: JSON.stringify({
              configuration_name: formData.configuration_name,
              status: formData.status === 'active' ? 1 : 2,
              user_id: getUserId(user) // Send user ID from session
            })
          }
        );

        if (response.success) {
          setConfigurations(prev =>
            prev.map(config =>
              config.id === selectedConfig.id
                ? {
                    ...config,
                    configuration_name: response.data.configuration_name,
                    status: response.data.status === 1 ? 'active' : 'inactive',
                    last_modified: response.data.last_modified || formatDate(new Date().toISOString()),
                    modified_by: response.data.modified_by || 'Unknown'
                  }
                : config
            )
          );
          // Don't show toast if backend already sent a message
          if (!response.message) {
            toast.success('Configuration updated successfully');
          }
        }
      }

      setShowModal(false);
      setFormData({
        configuration_name: '',
        status: 'active'
      });
      setFormErrors({});
    } catch (error: any) {
      console.error('Error saving configuration:', error);
      
      // Customize error message for duplicate entries
      let errorMessage = 'Failed to save configuration';
      let errorDescription = error.message || 'Please try again';
      
      if (error.message && error.message.toLowerCase().includes('already exists')) {
        errorMessage = 'Duplicate Entry Not Allowed';
        errorDescription = error.message;
      }
      
      toast.error(errorMessage, {
        description: errorDescription
      });
    }
  };

  const handleAddSetting = async () => {
    if (!selectedConfig) return;
    
    if (!selectedIntervalId && !editingSettingId) {
      toast.error('Please select an interval from the dropdown', {
        description: 'An interval must be selected to add a new setting',
        duration: 4000,
      });
      return;
    }

    // ========================================
    // 🔍 COMPREHENSIVE VALIDATION
    // ========================================
    
    // Get interval type to determine required fields
    const selectedInterval = availableIntervals.find(i => i.id === selectedIntervalId);
    const intervalTypeUpper = selectedInterval?.interval_type?.toUpperCase();
    
    // Determine which fields are required based on interval type
    const requiresKms = intervalTypeUpper === 'KM' || intervalTypeUpper === 'KMS' || intervalTypeUpper === 'BOTH';
    const requiresDuration = intervalTypeUpper === 'DURATION' || intervalTypeUpper === 'BOTH';
    
    const kms = Number(settingFormData.kms) || 0;
    const kmsToAlert = Number(settingFormData.kms_to_alert) || 0;
    const duration = Number(settingFormData.duration_days) || 0;
    const durationToAlert = Number(settingFormData.duration_to_alert) || 0;

    // ========================================
    // VALIDATION 1: KM-based intervals
    // ========================================
    if (requiresKms) {
      // Check if KMs field is empty or zero
      if (!kms || kms <= 0) {
        toast.error('KMs value required', {
          description: `This is a ${intervalTypeUpper} interval. Please enter a valid KMs value greater than 0.`,
          duration: 5000,
        });
        return;
      }

      // Check if KMs to Alert field is empty or zero
      if (!kmsToAlert || kmsToAlert <= 0) {
        toast.error('KMs to Alert value required', {
          description: `This is a ${intervalTypeUpper} interval. Please enter a valid KMs to Alert value greater than 0.`,
          duration: 5000,
        });
        return;
      }

      // Check if KMs is greater than KMs to Alert
      if (kms <= kmsToAlert) {
        toast.error('Invalid KMs values', {
          description: 'KMs value must be greater than KMs to Alert value. Example: KMs: 10000, KMs to Alert: 9000',
          duration: 5000,
        });
        return;
      }

      /* Check if values are reasonable (not too large)
      if (kms > 1000000 || kmsToAlert > 1000000) {
        toast.error('KMs value too large', {
          description: 'Please enter a reasonable KMs value (maximum: 1,000,000 km)',
          duration: 5000,
        });
        return;
      }
        */
    }

    // ========================================
    // VALIDATION 2: Duration-based intervals
    // ========================================
    if (requiresDuration) {
      // Check if Duration field is empty or zero
      if (!duration || duration <= 0) {
        toast.error('Duration value required', {
          description: `This is a ${intervalTypeUpper} interval. Please enter a valid Duration value greater than 0.`,
          duration: 5000,
        });
        return;
      }

      // Check if Duration to Alert field is empty or zero
      if (!durationToAlert || durationToAlert <= 0) {
        toast.error('Duration to Alert value required', {
          description: `This is a ${intervalTypeUpper} interval. Please enter a valid Duration to Alert value greater than 0.`,
          duration: 5000,
        });
        return;
      }

      // Check if Duration is greater than Duration to Alert
      if (duration <= durationToAlert) {
        toast.error('Invalid Duration values', {
          description: 'Duration value must be greater than Duration to Alert value. Example: Duration: 365 days, Duration to Alert: 330 days',
          duration: 5000,
        });
        return;
      }

      // Check if values are reasonable (not too large)
      const maxDays = settingFormData.time_unit === 'days' ? 3650 : // 10 years
                      settingFormData.time_unit === 'weeks' ? 520 : // 10 years
                      settingFormData.time_unit === 'months' ? 120 : // 10 years
                      100; // years

      if (duration > maxDays || durationToAlert > maxDays) {
        toast.error('Duration value too large', {
          description: `Please enter a reasonable duration value (maximum: ${maxDays} ${settingFormData.time_unit})`,
          duration: 5000,
        });
        return;
      }
    }

    // ========================================
    // VALIDATION 3: BOTH type - All fields required
    // ========================================
    if (intervalTypeUpper === 'BOTH') {
      // This validation is already covered above, but let's add a helpful message
      const missingFields: string[] = [];
      if (!kms || kms <= 0) missingFields.push('KMs');
      if (!kmsToAlert || kmsToAlert <= 0) missingFields.push('KMs to Alert');
      if (!duration || duration <= 0) missingFields.push('Duration');
      if (!durationToAlert || durationToAlert <= 0) missingFields.push('Duration to Alert');

      if (missingFields.length > 0) {
        toast.error('All fields are required', {
          description: `This is a BOTH (KM + Duration) interval. Missing: ${missingFields.join(', ')}. All values must be greater than 0.`,
          duration: 6000,
        });
        return;
      }
    }

    // ========================================
    // VALIDATION 4: Alert values must be less than main values
    // ========================================
    if (requiresKms && kmsToAlert >= kms) {
      toast.error('Alert threshold too high', {
        description: 'KMs to Alert must be less than KMs. The alert should trigger BEFORE reaching the maintenance threshold.',
        duration: 5000,
      });
      return;
    }

    if (requiresDuration && durationToAlert >= duration) {
      toast.error('Alert threshold too high', {
        description: 'Duration to Alert must be less than Duration. The alert should trigger BEFORE reaching the maintenance threshold.',
        duration: 5000,
      });
      return;
    }

    // ========================================
    // VALIDATION 5: Reasonable alert gap (optional, but helpful)
    // ========================================
    if (requiresKms) {
      const kmGapPercentage = ((kms - kmsToAlert) / kms) * 100;
      if (kmGapPercentage < 5) {
        toast.warning('Alert gap too small', {
          description: 'Alert is set to trigger very close to the maintenance threshold. Consider setting it earlier (recommended: 10-20% gap).',
          duration: 5000,
        });
        // Don't return - this is just a warning
      }
    }

    if (requiresDuration) {
      const durationGapPercentage = ((duration - durationToAlert) / duration) * 100;
      if (durationGapPercentage < 5) {
        toast.warning('Alert gap too small', {
          description: 'Alert is set to trigger very close to the maintenance threshold. Consider setting it earlier (recommended: 10-20% gap).',
          duration: 5000,
        });
        // Don't return - this is just a warning
      }
    }

    try {
      if (editingSettingId) {
        // Edit existing setting - API UPDATE
        // Find the interval to get its maintenance_type
        const editingInterval = availableIntervals.find(i => i.id === selectedIntervalId);
        
        const payload = {
          kms: Number(settingFormData.kms) || 0,
          kms_to_alert: Number(settingFormData.kms_to_alert) || 0,
          days: Number(settingFormData.duration_days) || 0,
          days_to_alert: Number(settingFormData.duration_to_alert) || 0,
          time_unit: settingFormData.time_unit.toUpperCase(),
          status: settingFormData.status === 'active' ? 1 : 2,
          maintenance_type: editingInterval?.maintenance_type || 'Regular Maintenance', // Include maintenance type
          user_id: getUserId(user) // Send user ID from session
        };

        const result = await apiFetch(API_ENDPOINTS.configurationSettings.byId(editingSettingId), {
          method: 'PUT',
          body: JSON.stringify(payload)
        });

        if (result.success) {
          // Refresh the settings list
          await loadConfigurationSettings(selectedConfig.id);
          setEditingSettingId(null);
          
          // Don't show toast if backend already sent a message
          if (!result.message) {
            toast.success('Setting updated successfully', {
              description: `${settingFormData.setting_name} has been updated`,
              duration: 3000,
            });
          }
        } else {
          toast.error('Failed to update setting', {
            description: result.error || 'An error occurred',
            duration: 4000,
          });
        }
      } else {
        // Add new setting - API CREATE
        const selectedInterval = availableIntervals.find(i => i.id === selectedIntervalId);
        if (!selectedInterval) {
          toast.error('Selected interval not found');
          return;
        }

        // ========================================
        // 🔍 CLIENT-SIDE DUPLICATE CHECK
        // ========================================
        // Check if this interval is already added to the configuration
        const currentSettings = selectedConfig?.settings || [];
        const isDuplicateSetting = currentSettings.some(
          setting => setting.interval_id === selectedIntervalId
        );

        if (isDuplicateSetting) {
          toast.error('Duplicate Setting', {
            description: `"${selectedInterval.interval_name}" has already been added to this configuration. Each interval can only be added once per configuration.`,
            duration: 6000,
          });
          return;
        }

        // Show info toast about propagation
        toast.info('Adding setting...', {
          description: 'This setting will be automatically added to all vehicles assigned to this configuration',
          duration: 4000,
        });

        const payload = {
          configuration: parseInt(selectedConfig.id),
          setting: parseInt(selectedIntervalId),
          kms: Number(settingFormData.kms) || 0,
          kms_to_alert: Number(settingFormData.kms_to_alert) || 0,
          days: Number(settingFormData.duration_days) || 0,
          days_to_alert: Number(settingFormData.duration_to_alert) || 0,
          time_unit: settingFormData.time_unit.toUpperCase(),
          status: settingFormData.status === 'active' ? 1 : 2,
          maintenance_type: selectedInterval.maintenance_type, // Include maintenance type from selected interval
          user_id: getUserId(user) // Send user ID from session
        };

        const result = await apiFetch(API_ENDPOINTS.configurationSettings.base, {
          method: 'POST',
          body: JSON.stringify(payload)
        });

        if (result.success) {
          // Refresh the settings list
          await loadConfigurationSettings(selectedConfig.id);
          
          // Show success message with vehicle count
          if (result.affectedVehicles > 0) {
            toast.success('Setting added and propagated!', {
              description: `${selectedInterval.interval_name} has been added to the configuration and applied to ${result.affectedVehicles} vehicle(s)`,
              duration: 5000,
            });
          } else if (result.totalVehiclesWithConfig === 0) {
            toast.success('Setting added successfully', {
              description: `${selectedInterval.interval_name} has been added. No vehicles are currently assigned to this configuration.`,
              duration: 4000,
            });
          } else {
            toast.success('Setting added successfully', {
              description: `${selectedInterval.interval_name} has been added to the configuration`,
              duration: 3000,
            });
          }
        } else {
          // ========================================
          // 🔍 DETECT DUPLICATE ENTRY ERROR
          // ========================================
          const errorMessage = result.error || 'An error occurred';
          
          // Check if it's the "already_added" error from backend - silently skip
          if (errorMessage === 'already_added') {
            return;
          }
          
          const isDuplicate = errorMessage.toLowerCase().includes('duplicate') || 
                            errorMessage.toLowerCase().includes('already exists') ||
                            errorMessage.toLowerCase().includes('unique');
          
          if (isDuplicate) {
            toast.error('Duplicate Setting', {
              description: `"${selectedInterval.interval_name}" has already been added to this configuration. Each interval can only be added once per configuration.`,
              duration: 6000,
            });
          } else {
            toast.error('Failed to add setting', {
              description: errorMessage,
              duration: 4000,
            });
          }
        }
      }

      // Reset form
      setSelectedIntervalId('');
      setSettingFormData({
        setting_name: '',
        kms: '',
        kms_to_alert: '',
        duration_days: '',
        duration_to_alert: '',
        time_unit: 'days',
        status: 'active'
      });
    } catch (error) {
      console.error('Error saving setting:', error);
      toast.error('Failed to save setting', {
        description: 'Backend server may not be running. Check /api/START_SERVER_HERE.md for setup instructions.',
        duration: 8000,
      });
    }
  };

  const handleEditSetting = (setting: ServiceSetting) => {
    setEditingSettingId(setting.id);
    setSelectedIntervalId(setting.interval_id);
    setSettingFormData({
      setting_name: setting.setting_name,
      kms: setting.kms,
      kms_to_alert: setting.kms_to_alert,
      duration_days: setting.duration_days,
      duration_to_alert: setting.duration_to_alert,
      time_unit: setting.time_unit || 'days',
      status: setting.status || 'active'
    });
  };

  const handleDeleteSetting = (settingId: string) => {
    if (!selectedConfig) return;
    
    const settingToDelete = selectedConfig.settings.find(s => s.id === settingId);
    const settingName = settingToDelete?.setting_name || 'this setting';
    
    // Use toast with action button for confirmation
    toast.warning(`Delete ${settingName}?`, {
      description: 'This action cannot be undone',
      duration: 5000,
      action: {
        label: 'Delete',
        onClick: async () => {
          try {
            const response = await fetch(buildApiUrl(API_ENDPOINTS.configurationSettings.byId(settingId)), {
              method: 'DELETE',
              headers: { 
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
              }
            });

            const result = await response.json();

            if (result.success) {
              // Refresh the settings list
              await loadConfigurationSettings(selectedConfig.id);
              
              toast.success('Setting deleted', {
                description: `${settingName} has been removed`,
                duration: 3000,
              });
            } else {
              toast.error('Failed to delete setting', {
                description: result.error || 'An error occurred',
                duration: 4000,
              });
            }
          } catch (error) {
            console.error('Error deleting setting:', error);
            toast.error('Failed to delete setting', {
              description: 'Backend server may not be running. Check /api/START_SERVER_HERE.md',
              duration: 8000
            });
          }
        },
      },
    });
  };

  const cancelEditSetting = () => {
    setEditingSettingId(null);
    setSelectedIntervalId('');
    setSettingFormData({
      setting_name: '',
      kms: '',
      kms_to_alert: '',
      duration_days: '',
      duration_to_alert: '',
      time_unit: 'days',
      status: 'active'
    });
  };

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Toast Notifications */}
      <Toaster 
        position="top-right" 
        richColors 
        closeButton
        toastOptions={{
          style: {
            fontSize: '14px',
          },
        }}
      />
      
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl text-slate-900 flex items-center gap-3">
                <Settings className="w-8 h-8 text-blue-600" />
                Manage Scheduled Configurations
              </h1>
              <p className="text-sm text-slate-600 mt-1">Configure vehicle-specific maintenance settings and service intervals</p>
            </div>
            <button
              onClick={openCreateModal}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Create Configuration
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Total Configurations</p>
                <p className="text-2xl text-slate-900">{configurations.length}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Database className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Active Configurations</p>
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
                <p className="text-sm text-slate-600 mb-1">Total Settings</p>
                <p className="text-2xl text-purple-600">{stats.totalSettings}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Wrench className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Avg. Settings/Config</p>
                <p className="text-2xl text-orange-600">{stats.avgSettings}</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <Gauge className="w-6 h-6 text-orange-600" />
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
                  placeholder="Search by configuration name or vehicle type..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  icon={<Search className="w-5 h-5" />}
                />
              </div>

              {/* Filters */}
              <div className="flex gap-2">
                <div className="min-w-[160px]">
                  <CustomDropdown
                    value={statusFilter}
                    onChange={(val) => setStatusFilter(val as any)}
                    options={[
                      { value: 'all', label: 'All Status' },
                      { value: 'active', label: 'Active Only' },
                      { value: 'inactive', label: 'Inactive Only' }
                    ]}
                    icon={<Filter className="w-4 h-4" />}
                  />
                </div>

                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`px-4 py-2 border rounded-lg transition-colors flex items-center gap-2 relative ${
                    showFilters
                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                      : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Filter className="w-5 h-5" />
                  Filters
                  {activeFilterCount > 0 && (
                    <span className="absolute -top-2 -right-2 flex items-center justify-center w-5 h-5 bg-blue-600 text-white text-xs font-medium rounded-full">
                      {activeFilterCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
                  className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2"
                >
                  {viewMode === 'list' ? <Grid className="w-5 h-5" /> : <List className="w-5 h-5" />}
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

            {/* Enterprise-Level Filter Panel */}
            {showFilters && (
              <div className="mt-4 bg-gradient-to-br from-slate-50 to-white rounded-xl border border-slate-200 shadow-sm">
                {/* Filter Header */}
                <div className="px-4 py-3 border-b border-slate-200 bg-white rounded-t-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Filter className="w-4 h-4 text-blue-600" />
                      <h3 className="text-sm font-semibold text-slate-900">Advanced Filters</h3>
                      {activeFilterCount > 0 && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                          {activeFilterCount} active
                        </span>
                      )}
                    </div>
                    {activeFilterCount > 0 && (
                      <button
                        onClick={handleClearAllFilters}
                        className="text-xs text-slate-600 hover:text-red-600 font-medium transition-colors flex items-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" />
                        Clear All ({activeFilterCount})
                      </button>
                    )}
                  </div>
                </div>

                {/* Filter Controls */}
                <div className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Configuration Name Filter */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-2">
                        Configuration Name
                      </label>
                      <ConfigurationNameMultiSelect
                        configurations={configurations}
                        selectedConfigurationIds={configurationNameFilter}
                        onChange={(selectedIds) => {
                          setConfigurationNameFilter(selectedIds);
                          setCurrentPage(1);
                        }}
                      />
                    </div>

                    {/* Items Per Page */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-2">
                        Items Per Page
                      </label>
                      <CustomDropdown
                        value={itemsPerPage.toString()}
                        onChange={(val) => {
                          setItemsPerPage(Number(val));
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

                    {/* Sort Direction */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-2">
                        Sort Direction
                      </label>
                      <CustomDropdown
                        value={sortDirection}
                        onChange={(val) => setSortDirection(val as 'asc' | 'desc')}
                        options={[
                          { value: 'asc', label: 'Ascending (A → Z)' },
                          { value: 'desc', label: 'Descending (Z → A)' }
                        ]}
                        icon={<ChevronDown className="w-4 h-4" />}
                      />
                    </div>
                  </div>

                  {/* Active Filters Display */}
                  {activeFilterCount > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-200">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold text-slate-700">Active Filters:</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {/* Search Term Filter Pill */}
                        {searchTerm && (
                          <span className="px-3 py-1.5 bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 text-xs rounded-lg flex items-center gap-2 border border-blue-200 shadow-sm">
                            <Search className="w-3.5 h-3.5" />
                            <span className="font-medium">Search: "{searchTerm}"</span>
                            <button
                              onClick={() => setSearchTerm('')}
                              className="hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        )}

                        {/* Status Filter Pill */}
                        {statusFilter !== 'all' && (
                          <span className="px-3 py-1.5 bg-gradient-to-r from-green-50 to-green-100 text-green-700 text-xs rounded-lg flex items-center gap-2 border border-green-200 shadow-sm">
                            <Check className="w-3.5 h-3.5" />
                            <span className="font-medium">Status: {statusFilter}</span>
                            <button
                              onClick={() => setStatusFilter('all')}
                              className="hover:bg-green-200 rounded-full p-0.5 transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        )}

                        {/* Configuration Name Filter Pill */}
                        {configurationNameFilter.length > 0 && configurationNameFilter.length < configurations.length && (
                          <span className="px-3 py-1.5 bg-gradient-to-r from-purple-50 to-purple-100 text-purple-700 text-xs rounded-lg flex items-center gap-2 border border-purple-200 shadow-sm">
                            <Database className="w-3.5 h-3.5" />
                            <span className="font-medium">
                              Configuration: {configurationNameFilter.length} selected
                            </span>
                            <button
                              onClick={() => setConfigurationNameFilter([])}
                              className="hover:bg-purple-200 rounded-full p-0.5 transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Bulk Operations Bar */}
          {selectedItems.length > 0 && (
            <div className="px-4 py-3 bg-blue-50 border-b border-blue-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-blue-900">
                    {selectedItems.length} configuration{selectedItems.length === 1 ? '' : 's'} selected
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
                  onClick={() => setSelectedItems([])}
                  className="text-sm text-slate-600 hover:text-slate-800"
                >
                  Clear selection
                </button>
              </div>
            </div>
          )}

          {/* Loading State */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-slate-600">Loading configurations...</p>
            </div>
          ) : (
            <>
          {/* Table View */}
          {viewMode === 'list' ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedItems.length === paginatedData.length && paginatedData.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-4 py-3 text-left">
                      <button
                        onClick={() => handleSort('configuration_name')}
                        className="flex items-center gap-1 text-sm text-slate-700 hover:text-slate-900 font-medium"
                      >
                        Configuration Name
                        {sortField === 'configuration_name' && (
                          sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-sm text-slate-700 font-medium whitespace-nowrap">Setting(s)</th>
                    <th className="px-4 py-3 text-left text-sm text-slate-700 font-medium whitespace-nowrap">Status</th>
                    <th className="px-4 py-3 text-center text-sm text-slate-700 font-medium whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {paginatedData.map((config) => (
                    <tr
                      key={config.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        selectedItems.includes(config.id) ? 'bg-blue-50' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedItems.includes(config.id)}
                          onChange={() => handleSelectItem(config.id)}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Truck className="w-4 h-4 text-blue-600" />
                          <span className="text-sm text-slate-900 font-medium">{config.configuration_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button
                          onClick={() => openViewModal(config)}
                          className="text-sm text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
                        >
                          <Eye className="w-4 h-4" />
                          View {config.settings_count ?? config.settings.length} setting{(config.settings_count ?? config.settings.length) !== 1 ? 's' : ''}
                        </button>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                            config.status === 'active'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {config.status === 'active' ? (
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
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openSettingsModal(config)}
                            className="inline-flex items-center gap-1 px-3 py-1 text-sm text-purple-600 hover:bg-purple-50 rounded transition-colors"
                          >
                            <Settings className="w-4 h-4" />
                            Manage
                          </button>
                          <button
                            onClick={() => openEditModal(config)}
                            className="inline-flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            /* Grid View */
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {paginatedData.map((config) => (
                <div
                  key={config.id}
                  className={`p-3 border rounded-lg hover:shadow-md transition-all ${
                    selectedItems.includes(config.id)
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  {/* Header Row */}
                  <div className="flex items-center justify-between mb-2">
                    <input
                      type="checkbox"
                      checked={selectedItems.includes(config.id)}
                      onChange={() => handleSelectItem(config.id)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        config.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {config.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  {/* Title */}
                  <div className="flex items-start gap-2 mb-2">
                    <Truck className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <h3 className="text-xs text-slate-900 font-medium leading-tight">{config.configuration_name}</h3>
                  </div>
                  
                  {/* Settings Count */}
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200">
                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                      {config.settings_count ?? config.settings.length} {(config.settings_count ?? config.settings.length) !== 1 ? 'settings' : 'setting'}
                    </span>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => openSettingsModal(config)}
                      className="flex-1 px-2 py-1.5 text-xs text-purple-600 border border-purple-200 rounded hover:bg-purple-50 transition-colors flex items-center justify-center gap-1"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      Manage
                    </button>
                    <button
                      onClick={() => openEditModal(config)}
                      className="flex-1 px-2 py-1.5 text-xs text-blue-600 border border-blue-200 rounded hover:bg-blue-50 transition-colors flex items-center justify-center gap-1"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
            </>
          )}

          {/* Pagination */}
          {filteredData.length > 0 && (
            <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between">
              <div className="text-sm text-slate-600">
                Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
                {Math.min(currentPage * itemsPerPage, filteredData.length)} of{' '}
                {filteredData.length} configurations
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

          {/* Empty State */}
          {filteredData.length === 0 && (
            <div className="p-12 text-center">
              <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h3 className="text-lg text-slate-900 font-medium mb-1">No configurations found</h3>
              <p className="text-sm text-slate-600 mb-4">
                Try adjusting your search or filter criteria
              </p>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                }}
                className="px-4 py-2 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Configuration Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-2xl">
            <h2 className="text-xl text-slate-900 font-medium mb-4">
              {modalMode === 'create' ? 'Create New Configuration' : 'Edit Configuration'}
            </h2>
            <form onSubmit={handleFormSubmit}>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm text-slate-700 mb-1">Configuration Name *</label>
                  <CustomInput
                    type="text"
                    name="configuration_name"
                    value={formData.configuration_name}
                    onChange={handleFormChange}
                    placeholder="e.g., Prevost (1998 - 2002)"
                    icon={<Database className="w-4 h-4" />}
                    error={formErrors.configuration_name}
                  />
                  {formErrors.configuration_name && (
                    <p className="text-sm text-red-500 mt-1">{formErrors.configuration_name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm text-slate-700 mb-1">Status</label>
                  <CustomDropdown
                    value={formData.status}
                    onChange={handleStatusSelect}
                    options={statusOptions}
                    placeholder="Select status..."
                    icon={<CheckSquare className="w-4 h-4" />}
                  />
                  {formErrors.status && (
                    <p className="text-sm text-red-500 mt-1">{formErrors.status}</p>
                  )}
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

      {/* View Settings Modal */}
      {showViewModal && selectedConfig && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl text-slate-900 font-medium">
                Settings for {selectedConfig.configuration_name}
              </h2>
              <button
                onClick={() => setShowViewModal(false)}
                className="p-1 hover:bg-slate-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border border-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm text-slate-700 font-medium border-b whitespace-nowrap">Setting</th>
                    <th className="px-4 py-3 text-left text-sm text-slate-700 font-medium border-b whitespace-nowrap">Interval Type</th>
                    <th className="px-4 py-3 text-left text-sm text-slate-700 font-medium border-b whitespace-nowrap">Kms</th>
                    <th className="px-4 py-3 text-left text-sm text-slate-700 font-medium border-b whitespace-nowrap">Kms to Alert</th>
                    <th className="px-4 py-3 text-left text-sm text-slate-700 font-medium border-b whitespace-nowrap">Time Unit</th>
                    <th className="px-4 py-3 text-left text-sm text-slate-700 font-medium border-b whitespace-nowrap">Duration</th>
                    <th className="px-4 py-3 text-left text-sm text-slate-700 font-medium border-b whitespace-nowrap">Duration to Alert</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedConfig.settings.map((setting) => (
                    <tr key={setting.id} className="border-b border-slate-200">
                      <td className="px-4 py-3 text-sm text-slate-900">{setting.setting_name}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded font-medium">
                          {setting.interval_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-900">
                        {setting.interval_type === 'DURATION' ? 'N/A' : setting.kms.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-900">
                        {setting.interval_type === 'DURATION' ? 'N/A' : setting.kms_to_alert.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {setting.time_unit ? (
                          <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded font-medium capitalize">
                            {setting.time_unit}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-900">
                        {setting.interval_type === 'KMS' ? 'N/A' : setting.duration_days}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-900">
                        {setting.interval_type === 'KMS' ? 'N/A' : setting.duration_to_alert}
                      </td>
                    </tr>
                  ))}
                  {selectedConfig.settings.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-600">
                        No settings configured yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end mt-4">
              <button
                onClick={() => setShowViewModal(false)}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Settings Modal */}
      {showSettingsModal && selectedConfig && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl text-slate-900 font-medium">
                Manage Settings for {selectedConfig.configuration_name}
              </h2>
              <button
                onClick={() => {
                  setShowSettingsModal(false);
                  setEditingSettingId(null);
                  setSelectedIntervalId('');
                  setSettingFormData({
                    setting_name: '',
                    kms: '',
                    kms_to_alert: '',
                    duration_days: '',
                    duration_to_alert: '',
                    time_unit: 'days',
                    status: 'active'
                  });
                }}
                className="p-1 hover:bg-slate-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Add/Edit Setting Form */}
            <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <h3 className="text-sm text-slate-900 font-medium mb-3">
                {editingSettingId ? 'Edit Setting' : 'Add New Setting'}
              </h3>
              <div className="mb-3">
                <label className="block text-xs text-slate-700 mb-1">
                  Select Interval from Configuration *
                </label>
                <CustomDropdown
                  value={selectedIntervalId}
                  onChange={handleIntervalSelect}
                  options={intervalOptions}
                  placeholder="-- Select an Interval --"
                  icon={<Settings className="w-4 h-4" />}
                />
              </div>
              <div className="space-y-3">
                {/* Setting Name - Always shown */}
                <div>
                  <label className="block text-xs text-slate-700 mb-1">Setting Name *</label>
                  <CustomInput
                    type="text"
                    name="setting_name"
                    value={settingFormData.setting_name}
                    onChange={handleSettingFormChange}
                    placeholder="e.g., Engine Oil"
                    disabled
                    icon={<Wrench className="w-4 h-4" />}
                  />
                </div>

                {/* Duration Fields - Show FIRST if interval type is Duration or BOTH */}
                {showDurationFields && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-slate-700 mb-1">Time Unit *</label>
                      <CustomDropdown
                        value={settingFormData.time_unit}
                        onChange={(value) => setSettingFormData(prev => ({ ...prev, time_unit: value as 'days' | 'weeks' | 'months' | 'years' }))}
                        options={timeUnitOptions}
                        placeholder="Select unit"
                        icon={<Clock className="w-4 h-4" />}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-700 mb-1">Duration *</label>
                      <CustomInput
                        type="number"
                        name="duration_days"
                        value={settingFormData.duration_days}
                        onChange={handleSettingFormChange}
                        placeholder="180"
                        icon={<Calendar className="w-4 h-4" />}
                        min={0}
                      />
                      <p className="text-[10px] text-slate-500 mt-1">Must be greater than Duration to Alert</p>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-700 mb-1">Duration to Alert *</label>
                      <CustomInput
                        type="number"
                        name="duration_to_alert"
                        value={settingFormData.duration_to_alert}
                        onChange={handleSettingFormChange}
                        placeholder="150"
                        icon={<Clock className="w-4 h-4" />}
                        min={0}
                      />
                      <p className="text-[10px] text-slate-500 mt-1">Must be less than Duration</p>
                    </div>
                  </div>
                )}
                
                {/* KMS Fields - Show SECOND if interval type is KMS or BOTH */}
                {showKmsFields && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-slate-700 mb-1">Kms *</label>
                      <CustomInput
                        type="number"
                        name="kms"
                        value={settingFormData.kms}
                        onChange={handleSettingFormChange}
                        placeholder="20000"
                        icon={<Gauge className="w-4 h-4" />}
                        min={0}
                      />
                      <p className="text-[10px] text-slate-500 mt-1">Must be greater than Kms to Alert</p>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-700 mb-1">Kms to Alert *</label>
                      <CustomInput
                        type="number"
                        name="kms_to_alert"
                        value={settingFormData.kms_to_alert}
                        onChange={handleSettingFormChange}
                        placeholder="15000"
                        icon={<AlertCircle className="w-4 h-4" />}
                        min={0}
                      />
                      <p className="text-[10px] text-slate-500 mt-1">Must be less than Kms</p>
                    </div>
                    <div></div> {/* Empty div for grid spacing to match duration fields */}
                  </div>
                )}
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleAddSetting}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingSettingId ? 'Update Setting' : 'Add Setting'}
                </button>
                {editingSettingId && (
                  <button
                    onClick={cancelEditSetting}
                    className="px-4 py-2 bg-slate-200 text-slate-700 text-sm rounded-lg hover:bg-slate-300 transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>

            {/* Settings Table */}
            <div className="overflow-x-auto">
              <table className="w-full border border-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm text-slate-700 font-medium border-b whitespace-nowrap">Setting</th>
                    <th className="px-4 py-3 text-left text-sm text-slate-700 font-medium border-b whitespace-nowrap">Interval Type</th>
                    <th className="px-4 py-3 text-left text-sm text-slate-700 font-medium border-b whitespace-nowrap">Maintenance Type</th>
                    <th className="px-4 py-3 text-left text-sm text-slate-700 font-medium border-b whitespace-nowrap">Kms</th>
                    <th className="px-4 py-3 text-left text-sm text-slate-700 font-medium border-b whitespace-nowrap">Kms to Alert</th>
                    <th className="px-4 py-3 text-left text-sm text-slate-700 font-medium border-b whitespace-nowrap">Duration</th>
                    <th className="px-4 py-3 text-left text-sm text-slate-700 font-medium border-b whitespace-nowrap">Duration to Alert</th>
                    <th className="px-4 py-3 text-left text-sm text-slate-700 font-medium border-b whitespace-nowrap">Time Unit</th>
                    <th className="px-4 py-3 text-center text-sm text-slate-700 font-medium border-b whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedConfig.settings.map((setting) => (
                    <tr key={setting.id} className="border-b border-slate-200">
                      <td className="px-4 py-3 text-sm text-slate-900">{setting.setting_name}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded font-medium">
                          {setting.interval_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 text-xs rounded font-medium ${
                          setting.maintenance_type === 'Overhaul Maintenance' || setting.maintenance_type === 'OVERHAUL'
                            ? 'bg-orange-100 text-orange-700' 
                            : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {setting.maintenance_type === 'Overhaul Maintenance' || setting.maintenance_type === 'OVERHAUL'
                            ? 'Overhaul' 
                            : 'Regular'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-900">
                        {setting.interval_type?.toUpperCase() === 'DURATION' ? 'N/A' : setting.kms.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-900">
                        {setting.interval_type?.toUpperCase() === 'DURATION' ? 'N/A' : setting.kms_to_alert.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-900">
                        {(setting.interval_type?.toUpperCase() === 'KM' || setting.interval_type?.toUpperCase() === 'KMS') ? 'N/A' : setting.duration_days}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-900">
                        {(setting.interval_type?.toUpperCase() === 'KM' || setting.interval_type?.toUpperCase() === 'KMS') ? 'N/A' : setting.duration_to_alert}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-900">
                        {(setting.interval_type?.toUpperCase() === 'KM' || setting.interval_type?.toUpperCase() === 'KMS') ? 'N/A' : (
                          <span className="capitalize">{setting.time_unit || 'days'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEditSetting(setting)}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteSetting(setting.id)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {selectedConfig.settings.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-600">
                        No settings configured yet. Add your first setting above.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end mt-4">
              <button
                onClick={() => {
                  setShowSettingsModal(false);
                  setEditingSettingId(null);
                  setSelectedIntervalId('');
                  setSettingFormData({
                    setting_name: '',
                    kms: '',
                    kms_to_alert: '',
                    duration_days: '',
                    duration_to_alert: '',
                    time_unit: 'days',
                    status: 'active'
                  });
                }}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}