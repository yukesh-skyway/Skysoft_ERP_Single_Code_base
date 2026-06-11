import { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Search, Plus, Filter, Download, Edit2, Check, X, 
  AlertCircle, TrendingUp, BarChart3,
  ChevronDown, ChevronUp, Settings, Grid, List, Trash2,
  Wrench, Cog, Battery, Zap, Wind, Car, Fuel, Package,
  Shield, Gauge, CircleDot, Hammer, Boxes, LucideIcon, FileText, Hash, CheckSquare,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { API_BASE_URL, API_ENDPOINTS, buildApiUrl, apiFetch } from '../../config/api';

// Backend API Response Interface (matches database schema)
interface RepairCodeCategoryAPI {
  id: number;
  repair_code_category: string;
  repair_category_type: 'skysoft' | 'motive';
  status: number; // 1 = Active, 0 = Inactive
}

// Frontend Interface (for display)
interface RepairCodeCategory {
  id: string;
  repair_code_category: string;
  repair_category_type: 'skysoft' | 'motive';
  status: 'active' | 'inactive';
  icon_name: string;
}

interface FormData {
  repair_code_category: string;
  repair_category_type: 'skysoft' | 'motive';
  status: 'active' | 'inactive';
  icon_name: string;
}

// Helper function to convert API response to frontend format
const apiToFrontend = (apiData: RepairCodeCategoryAPI): RepairCodeCategory => ({
  id: String(apiData.id),
  repair_code_category: apiData.repair_code_category,
  repair_category_type: apiData.repair_category_type,
  status: apiData.status === 1 ? 'active' : 'inactive',
  icon_name: 'wrench' // Default icon since not in database
});

// Helper function to convert frontend format to API request
const frontendToApi = (frontendData: FormData): Partial<RepairCodeCategoryAPI> => ({
  repair_code_category: frontendData.repair_code_category.trim(),
  repair_category_type: frontendData.repair_category_type,
  status: frontendData.status === 'active' ? 1 : 0
});

interface IconOption {
  label: string;
  value: string;
  icon: LucideIcon;
}

const ICON_OPTIONS: IconOption[] = [
  { label: 'Wrench', value: 'wrench', icon: Wrench },
  { label: 'Cog', value: 'cog', icon: Cog },
  { label: 'Battery', value: 'battery', icon: Battery },
  { label: 'Zap', value: 'zap', icon: Zap },
  { label: 'Wind', value: 'wind', icon: Wind },
  { label: 'Car', value: 'car', icon: Car },
  { label: 'Fuel', value: 'fuel', icon: Fuel },
  { label: 'Package', value: 'package', icon: Package },
  { label: 'Shield', value: 'shield', icon: Shield },
  { label: 'Gauge', value: 'gauge', icon: Gauge },
  { label: 'Circle', value: 'circle', icon: CircleDot },
  { label: 'Hammer', value: 'hammer', icon: Hammer },
  { label: 'Boxes', value: 'boxes', icon: Boxes },
];

const getIconComponent = (iconName: string): LucideIcon => {
  const iconOption = ICON_OPTIONS.find(opt => opt.value === iconName);
  return iconOption ? iconOption.icon : Wrench;
};

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

// Custom Dropdown Component
interface CustomDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string, label: string }[];
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  icon?: React.ReactNode;
}

function CustomDropdown({ value, onChange, options, placeholder, disabled, error, icon }: CustomDropdownProps) {
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
            : error
            ? 'border-red-300 hover:border-red-400'
            : 'border-slate-300 hover:border-slate-400'
        }`}
      >
        <div className="flex items-center gap-2">
          {icon && <div className="w-4 h-4 text-slate-400">{icon}</div>}
          <span className={selectedOption ? 'text-slate-900' : 'text-slate-500'}>
            {selectedOption?.label || placeholder || 'Select'}
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
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors ${
                value === option.value
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-slate-700'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Category Name MultiSelect Component
interface CategoryNameMultiSelectProps {
  categories: RepairCodeCategory[];
  selectedCategoryIds: string[];
  onChange: (selectedIds: string[]) => void;
}

function CategoryNameMultiSelect({ categories, selectedCategoryIds, onChange }: CategoryNameMultiSelectProps) {
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

  const filteredCategories = categories.filter(category =>
    category.repair_code_category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectAll = () => {
    if (selectedCategoryIds.length === categories.length) {
      onChange([]);
    } else {
      onChange(categories.map(c => c.id));
    }
  };

  const handleToggle = (categoryId: string) => {
    if (selectedCategoryIds.includes(categoryId)) {
      onChange(selectedCategoryIds.filter(id => id !== categoryId));
    } else {
      onChange([...selectedCategoryIds, categoryId]);
    }
  };

  const selectedCount = selectedCategoryIds.length;
  const displayText = selectedCount === 0 
    ? 'All Categories' 
    : selectedCount === categories.length 
    ? 'All Categories' 
    : `${selectedCount} Categor${selectedCount === 1 ? 'y' : 'ies'}`;

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
          <span className={selectedCount > 0 && selectedCount < categories.length ? 'text-slate-900 font-medium' : 'text-slate-600'}>
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
                placeholder="Search categories..."
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
                selectedCategoryIds.length === categories.length
                  ? 'bg-blue-600 border-blue-600'
                  : 'border-slate-300'
              }`}>
                {selectedCategoryIds.length === categories.length && (
                  <Check className="w-3 h-3 text-white" />
                )}
              </div>
              <span className="font-medium text-slate-700">Select All</span>
            </button>
          </div>

          {/* Category List */}
          <div className="max-h-60 overflow-y-auto">
            {filteredCategories.length > 0 ? (
              filteredCategories.map((category) => {
                const IconComponent = getIconComponent(category.icon_name);
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => handleToggle(category.id)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors flex items-center gap-2 border-b border-slate-100 last:border-b-0"
                  >
                    <div className={`w-4 h-4 border-2 rounded flex items-center justify-center flex-shrink-0 ${
                      selectedCategoryIds.includes(category.id)
                        ? 'bg-blue-600 border-blue-600'
                        : 'border-slate-300'
                    }`}>
                      {selectedCategoryIds.includes(category.id) && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </div>
                    <IconComponent className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-slate-900 truncate">{category.repair_code_category}</div>
                      <div className="text-xs text-slate-500">
                        {category.repair_category_type === 'skysoft' ? 'Skysoft' : 'Motive'}
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-4 text-sm text-slate-500 text-center">
                No categories found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function ManageRepairCodeCategories() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [categoryNameFilter, setCategoryNameFilter] = useState<string[]>([]); // For specific category name filtering
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortField, setSortField] = useState<keyof RepairCodeCategory>('repair_code_category');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedCategory, setSelectedCategory] = useState<RepairCodeCategory | null>(null);
  const [showBulkPanel, setShowBulkPanel] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    repair_code_category: '',
    repair_category_type: 'skysoft',
    status: 'active',
    icon_name: 'wrench'
  });
  const [formErrors, setFormErrors] = useState<Partial<FormData>>({});
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  // Data from API - start with empty array, will be populated on component mount
  const [categories, setCategories] = useState<RepairCodeCategory[]>([]);

  // Fetch categories from API on component mount
  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      setApiError(null);
      const response = await fetch(buildApiUrl(`${API_ENDPOINTS.repairCodeCategories.base}?sortBy=repair_code_category&sortOrder=asc`), {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Fetched categories from API:', data);
        
        // Handle different response structures
        let apiCategories = [];
        if (Array.isArray(data)) {
          // Direct array response
          apiCategories = data;
        } else if (data.data && Array.isArray(data.data)) {
          // Wrapped in data property
          apiCategories = data.data;
        } else if (data.categories && Array.isArray(data.categories)) {
          // Wrapped in categories property
          apiCategories = data.categories;
        }
        
        console.log('📦 API categories to convert:', apiCategories);
        
        // Convert API data to frontend format
        const frontendData = apiCategories.map(apiToFrontend);
        console.log('✨ Converted to frontend format:', frontendData);
        
        setCategories(frontendData);
        toast.success(`Loaded ${frontendData.length} categories from database`, { duration: 2000 });
      } else {
        const errorText = await response.text();
        console.error('⚠️ API returned error:', response.status, errorText);
        
        // Try to parse error message
        let errorMessage = `Failed to load categories: ${response.status} ${response.statusText}`;
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.error) {
            errorMessage = errorData.error;
            setApiError(errorData.error); // Store for banner display
          }
        } catch {
          // If parsing fails, use default message
        }
        
        toast.error(errorMessage, { duration: 5000 });
      }
    } catch (error) {
      console.error('❌ Error fetching categories:', error);
      setApiError('Failed to connect to API server');
      toast.error('Failed to connect to API - check console for details');
    } finally {
      setLoading(false);
    }
  };

  // Filtering and sorting
  const filteredCategories = useMemo(() => {
    let filtered = categories.filter(category => {
      const matchesSearch = 
        category.repair_code_category.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || category.status === statusFilter;
      
      // Category name filter - if specific categories selected, only show those
      const matchesCategoryName = categoryNameFilter.length === 0 || categoryNameFilter.includes(category.id);
      
      return matchesSearch && matchesStatus && matchesCategoryName;
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
  }, [categories, searchTerm, statusFilter, categoryNameFilter, sortField, sortDirection]);

  // Calculate active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchTerm) count++;
    if (statusFilter !== 'all') count++;
    if (categoryNameFilter.length > 0 && categoryNameFilter.length < categories.length) count++;
    return count;
  }, [searchTerm, statusFilter, categoryNameFilter, categories.length]);

  // Clear all filters function
  const handleClearAllFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setCategoryNameFilter([]);
    setCurrentPage(1);
    toast.success('All filters cleared');
  };

  // Pagination
  const totalPages = Math.ceil(filteredCategories.length / itemsPerPage);
  const paginatedCategories = filteredCategories.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSort = (field: keyof RepairCodeCategory) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedCategories(paginatedCategories.map(c => c.id));
    } else {
      setSelectedCategories([]);
    }
  };

  const handleSelectCategory = (id: string) => {
    setSelectedCategories(prev =>
      prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id]
    );
  };

  const handleStatusToggle = async (id: string) => {
    const category = categories.find(cat => cat.id === id);
    if (!category) return;
    
    const newStatus = category.status === 'active' ? 'inactive' : 'active';
    const newStatusValue = newStatus === 'active' ? 1 : 0;
    
    try {
      const response = await fetch(buildApiUrl(API_ENDPOINTS.repairCodeCategories.updateStatus(id)), {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ status: newStatusValue })
      });
      
      if (response.ok) {
        setCategories(prev =>
          prev.map(cat =>
            cat.id === id
              ? { ...cat, status: newStatus }
              : cat
          )
        );
        
        toast.success(
          `Category status changed to ${newStatus === 'active' ? 'Active' : 'Inactive'}`,
          { duration: 3000 }
        );
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to update status');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status - check console for details');
    }
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(filteredCategories, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `repair_code_categories_${new Date().toISOString().split('T')[0]}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const stats = useMemo(() => {
    const active = categories.filter(c => c.status === 'active').length;
    const inactive = categories.filter(c => c.status === 'inactive').length;
    const skysoft = categories.filter(c => c.repair_category_type === 'skysoft').length;
    const motive = categories.filter(c => c.repair_category_type === 'motive').length;

    return { active, inactive, skysoft, motive };
  }, [categories]);

  const handleBulkDelete = () => {
    toast.warning(
      <div>
        <p className="font-medium">Delete {selectedCategories.length} categor{selectedCategories.length === 1 ? 'y' : 'ies'}?</p>
        <p className="text-sm mt-1">This action cannot be undone.</p>
      </div>,
      {
        duration: 6000,
        action: {
          label: 'Confirm',
          onClick: async () => {
            try {
              // Delete each category via API
              const deletePromises = selectedCategories.map(id =>
                fetch(buildApiUrl(API_ENDPOINTS.repairCodeCategories.byId(id)), {
                  method: 'DELETE',
                  headers: { 'ngrok-skip-browser-warning': 'true' }
                })
              );
              
              const responses = await Promise.all(deletePromises);
              const allSuccessful = responses.every(res => res.ok);
              
              if (allSuccessful) {
                setCategories(prev =>
                  prev.filter(cat => !selectedCategories.includes(cat.id))
                );
                setSelectedCategories([]);
                setShowBulkPanel(false);
                toast.success(`${selectedCategories.length} categor${selectedCategories.length === 1 ? 'y' : 'ies'} deleted successfully!`);
              } else {
                toast.error('Some categories could not be deleted');
              }
            } catch (error) {
              console.error('Error deleting categories:', error);
              toast.error('Failed to delete categories');
            }
          },
        },
      }
    );
  };

  const handleBulkInactive = () => {
    toast.warning(
      <div>
        <p className="font-medium">Set {selectedCategories.length} categor{selectedCategories.length === 1 ? 'y' : 'ies'} to inactive?</p>
        <p className="text-sm mt-1">This will deactivate the selected categories.</p>
      </div>,
      {
        duration: 6000,
        action: {
          label: 'Confirm',
          onClick: async () => {
            try {
              // Update status for each category via API
              const updatePromises = selectedCategories.map(id =>
                fetch(buildApiUrl(API_ENDPOINTS.repairCodeCategories.updateStatus(id)), {
                  method: 'PATCH',
                  headers: { 
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true'
                  },
                  body: JSON.stringify({ status: 0 }) // 0 = Inactive
                })
              );
              
              const responses = await Promise.all(updatePromises);
              const allSuccessful = responses.every(res => res.ok);
              
              if (allSuccessful) {
                setCategories(prev =>
                  prev.map(cat =>
                    selectedCategories.includes(cat.id)
                      ? { ...cat, status: 'inactive' as const }
                      : cat
                  )
                );
                setSelectedCategories([]);
                setShowBulkPanel(false);
                toast.success(`${selectedCategories.length} categor${selectedCategories.length === 1 ? 'y' : 'ies'} deactivated successfully!`);
              } else {
                toast.error('Some categories could not be deactivated');
              }
            } catch (error) {
              console.error('Error deactivating categories:', error);
              toast.error('Failed to deactivate categories');
            }
          },
        },
      }
    );
  };

  const handleBulkActive = () => {
    toast.warning(
      <div>
        <p className="font-medium">Set {selectedCategories.length} categor{selectedCategories.length === 1 ? 'y' : 'ies'} to active?</p>
        <p className="text-sm mt-1">This will activate the selected categories.</p>
      </div>,
      {
        duration: 6000,
        action: {
          label: 'Confirm',
          onClick: async () => {
            try {
              // Update status for each category via API
              const updatePromises = selectedCategories.map(id =>
                fetch(buildApiUrl(API_ENDPOINTS.repairCodeCategories.updateStatus(id)), {
                  method: 'PATCH',
                  headers: { 
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true'
                  },
                  body: JSON.stringify({ status: 1 }) // 1 = Active
                })
              );
              
              const responses = await Promise.all(updatePromises);
              const allSuccessful = responses.every(res => res.ok);
              
              if (allSuccessful) {
                setCategories(prev =>
                  prev.map(cat =>
                    selectedCategories.includes(cat.id)
                      ? { ...cat, status: 'active' as const }
                      : cat
                  )
                );
                setSelectedCategories([]);
                setShowBulkPanel(false);
                toast.success(`${selectedCategories.length} categor${selectedCategories.length === 1 ? 'y' : 'ies'} activated successfully!`);
              } else {
                toast.error('Some categories could not be activated');
              }
            } catch (error) {
              console.error('Error activating categories:', error);
              toast.error('Failed to activate categories');
            }
          },
        },
      }
    );
  };

  const openCreateModal = () => {
    setModalMode('create');
    setSelectedCategory(null);
    setFormData({
      repair_code_category: '',
      repair_category_type: 'skysoft',
      status: 'active',
      icon_name: 'wrench'
    });
    setFormErrors({});
    setShowModal(true);
  };

  const openEditModal = (category: RepairCodeCategory) => {
    setModalMode('edit');
    setSelectedCategory(category);
    setFormData({
      repair_code_category: category.repair_code_category,
      repair_category_type: category.repair_category_type,
      status: category.status,
      icon_name: category.icon_name
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

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Partial<FormData> = {};
    
    // Required field validation
    if (!formData.repair_code_category || !formData.repair_code_category.trim()) {
      errors.repair_code_category = 'Category name is required';
    }
    
    // Enhanced duplicate validation (case-insensitive)
    if (formData.repair_code_category.trim()) {
      const categoryNameLower = formData.repair_code_category.trim().toLowerCase();
      const isDuplicate = categories.some(cat => {
        // Skip current category when editing
        if (modalMode === 'edit' && selectedCategory && cat.id === selectedCategory.id) {
          return false;
        }
        return cat.repair_code_category.toLowerCase() === categoryNameLower;
      });
      
      if (isDuplicate) {
        errors.repair_code_category = 'This category name already exists';
      }
    }
    
    setFormErrors(errors);
    
    if (Object.keys(errors).length === 0) {
      try {
        // Convert frontend data to API format
        const apiData = frontendToApi(formData);
        
        if (modalMode === 'create') {
          // Create new category
          const response = await fetch(buildApiUrl(API_ENDPOINTS.repairCodeCategories.base), {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify(apiData)
          });
          
          if (response.ok) {
            const data = await response.json();
            // Convert API response to frontend format
            const newCategory = apiToFrontend(data.data);
            setCategories(prev => [...prev, newCategory]);
            toast.success(
              `Category "${formData.repair_code_category}" created successfully`,
              { duration: 3000 }
            );
          } else {
            const error = await response.json();
            // Check for duplicate error from database
            if (error.message && error.message.toLowerCase().includes('duplicate')) {
              toast.error('This category name already exists in the database');
              setFormErrors({ repair_code_category: 'This category name already exists' });
            } else {
              toast.error(error.message || 'Failed to create category');
            }
            return;
          }
        } else if (modalMode === 'edit' && selectedCategory) {
          // Update existing category
          const response = await fetch(buildApiUrl(API_ENDPOINTS.repairCodeCategories.byId(selectedCategory.id)), {
            method: 'PUT',
            headers: { 
              'Content-Type': 'application/json',
              'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify(apiData)
          });
          
          if (response.ok) {
            const data = await response.json();
            // Convert API response to frontend format
            const updatedCategory = apiToFrontend(data.data);
            setCategories(prev =>
              prev.map(cat =>
                cat.id === selectedCategory.id
                  ? updatedCategory
                  : cat
              )
            );
            toast.success(
              `Category "${formData.repair_code_category}" updated successfully`,
              { duration: 3000 }
            );
          } else {
            const error = await response.json();
            // Check for duplicate error from database
            if (error.message && error.message.toLowerCase().includes('duplicate')) {
              toast.error('This category name already exists in the database');
              setFormErrors({ repair_code_category: 'This category name already exists' });
            } else {
              toast.error(error.message || 'Failed to update category');
            }
            return;
          }
        }
        
        setShowModal(false);
        setFormData({
          repair_code_category: '',
          repair_category_type: 'skysoft',
          status: 'active',
          icon_name: 'wrench'
        });
        setFormErrors({});
      } catch (error) {
        console.error('Error submitting form:', error);
        toast.error('Failed to save category - check console for details');
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
                Manage Repair Code Categories
              </h1>
            </div>
            <button
              onClick={openCreateModal}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Create Category
            </button>
          </div>
        </div>
      </div>

      {/* Backend Error Alert */}
      {apiError && categories.length === 0 && !loading && (
        <div className="bg-red-50 border-b-2 border-red-400">
          <div className="max-w-[1600px] mx-auto px-6 py-4">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-red-900 mb-1">Backend Server Restart Required</h3>
                <p className="text-sm text-red-800 mb-2">
                  <strong>Error:</strong> {apiError}
                </p>
                {apiError.includes("Unknown column 'created_by'") && (
                  <>
                    <p className="text-sm text-red-800 mb-3">
                      The backend code has been updated to match your database schema (no created_by, created_on, updated_by, updated_on columns), 
                      but the server is still running old code in memory. Please restart your Node.js backend server.
                    </p>
                    <div className="bg-red-100 border border-red-300 rounded-lg p-3 text-sm font-mono text-red-900">
                      <div className="mb-1">1. Press <kbd className="px-2 py-1 bg-red-200 rounded font-semibold">Ctrl + C</kbd> in your terminal to stop the server</div>
                      <div>2. Run <kbd className="px-2 py-1 bg-red-200 rounded font-semibold">node server.js</kbd> to restart</div>
                    </div>
                  </>
                )}
                {!apiError.includes("Unknown column") && (
                  <button
                    onClick={fetchCategories}
                    className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm flex items-center gap-2"
                  >
                    <Loader2 className="w-4 h-4" />
                    Retry Connection
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-[1600px] mx-auto px-6 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Total Categories</p>
                <p className="text-2xl text-slate-900">{categories.length}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Grid className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Active Categories</p>
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
                <p className="text-sm text-slate-600 mb-1">Inactive Categories</p>
                <p className="text-2xl text-orange-600">{stats.inactive}</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <X className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Skysoft Categories</p>
                <p className="text-2xl text-blue-600">{stats.skysoft}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Grid className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Motive Categories</p>
                <p className="text-2xl text-purple-600">{stats.motive}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-purple-600" />
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
                  placeholder="Search by name, description, or code prefix..."
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
                {/* Header with Clear All */}
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-300">
                  <h3 className="text-sm font-medium text-slate-900">Advanced Filters</h3>
                  {activeFilterCount > 0 && (
                    <button
                      onClick={handleClearAllFilters}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                      Clear All ({activeFilterCount})
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm text-slate-700 mb-1">Category Name</label>
                    <CategoryNameMultiSelect
                      categories={categories}
                      selectedCategoryIds={categoryNameFilter}
                      onChange={setCategoryNameFilter}
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
                    <label className="block text-sm text-slate-700 mb-1">Sort by</label>
                    <CustomDropdown
                      value={sortField}
                      onChange={(value) => setSortField(value as keyof RepairCodeCategory)}
                      options={[
                        { value: 'repair_code_category', label: 'Category Name' },
                        { value: 'repair_category_type', label: 'Category Type' },
                        { value: 'status', label: 'Status' }
                      ]}
                      icon={<Filter className="w-4 h-4" />}
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

                {/* Active Filter Pills */}
                {activeFilterCount > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-300">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-slate-600 font-medium">Active Filters:</span>
                      
                      {searchTerm && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                          <Search className="w-3 h-3" />
                          <span>Search: "{searchTerm}"</span>
                          <button
                            onClick={() => setSearchTerm('')}
                            className="hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      
                      {statusFilter !== 'all' && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                          <CheckSquare className="w-3 h-3" />
                          <span>Status: {statusFilter === 'active' ? 'Active' : 'Inactive'}</span>
                          <button
                            onClick={() => setStatusFilter('all')}
                            className="hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      
                      {categoryNameFilter.length > 0 && categoryNameFilter.length < categories.length && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                          <Filter className="w-3 h-3" />
                          <span>Categories: {categoryNameFilter.length} selected</span>
                          <button
                            onClick={() => setCategoryNameFilter([])}
                            className="hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bulk Operations Bar */}
          {selectedCategories.length > 0 && (
            <div className="px-4 py-3 bg-blue-50 border-b border-blue-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-blue-900">
                    {selectedCategories.length} categor{selectedCategories.length === 1 ? 'y' : 'ies'} selected
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
                  onClick={() => setSelectedCategories([])}
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
                    <th className="w-12 px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedCategories.length === paginatedCategories.length && paginatedCategories.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-4 py-3 text-left">
                      <button
                        onClick={() => handleSort('repair_code_category')}
                        className="flex items-center gap-1 text-sm text-slate-700 hover:text-slate-900 font-medium"
                      >
                        Category Name
                        {sortField === 'repair_code_category' && (
                          sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <button
                        onClick={() => handleSort('repair_category_type')}
                        className="flex items-center gap-1 text-sm text-slate-700 hover:text-slate-900 font-medium"
                      >
                        Category Type
                        {sortField === 'repair_category_type' && (
                          sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-sm text-slate-700 font-medium whitespace-nowrap">Status</th>
                    <th className="px-4 py-3 text-center text-sm text-slate-700 font-medium whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {paginatedCategories.map((category) => (
                    <tr
                      key={category.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        selectedCategories.includes(category.id) ? 'bg-blue-50' : ''
                      }`}
                    >
                      <td className="w-12 px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedCategories.includes(category.id)}
                          onChange={() => handleSelectCategory(category.id)}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {(() => {
                            const IconComponent = getIconComponent(category.icon_name);
                            return <IconComponent className="w-4 h-4 text-blue-600 flex-shrink-0" />;
                          })()}
                          <span className="text-sm text-slate-900 font-medium truncate">{category.repair_code_category}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${
                          category.repair_category_type === 'skysoft'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-purple-100 text-purple-700'
                        }`}>
                          {category.repair_category_type === 'skysoft' ? 'Skysoft' : 'Motive'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${
                          category.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {category.status === 'active' ? (
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
                        <button
                          onClick={() => openEditModal(category)}
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
              {paginatedCategories.map((category) => (
                <div
                  key={category.id}
                  className={`p-4 border rounded-lg hover:shadow-md transition-all ${
                    selectedCategories.includes(category.id)
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(category.id)}
                      onChange={() => handleSelectCategory(category.id)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      category.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                      {category.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-2">
                      {(() => {
                        const IconComponent = getIconComponent(category.icon_name);
                        return <IconComponent className="w-4 h-4 text-blue-600" />;
                      })()}
                      <h3 className="text-sm text-slate-900 font-medium">{category.repair_code_category}</h3>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${
                      category.repair_category_type === 'skysoft'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-purple-100 text-purple-700'
                    }`}>
                      {category.repair_category_type === 'skysoft' ? 'Skysoft' : 'Motive'}
                    </span>
                  </div>

                  <button
                    onClick={() => openEditModal(category)}
                    className="w-full px-3 py-2 text-sm text-blue-600 border border-blue-200 rounded hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit Category
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {filteredCategories.length > 0 && (
            <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between">
              <div className="text-sm text-slate-600">
                Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
                {Math.min(currentPage * itemsPerPage, filteredCategories.length)} of{' '}
                {filteredCategories.length} categories
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
              <h3 className="text-lg text-slate-900 font-medium mb-1">Loading categories...</h3>
              <p className="text-sm text-slate-600">
                Fetching data from the server
              </p>
            </div>
          )}

          {/* Empty State */}
          {!loading && filteredCategories.length === 0 && (
            <div className="p-12 text-center">
              <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h3 className="text-lg text-slate-900 font-medium mb-1">No categories found</h3>
              <p className="text-sm text-slate-600 mb-4">
                Try adjusting your search or filter criteria
              </p>
              <button
                onClick={handleClearAllFilters}
                className="px-4 py-2 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-2xl">
            <h2 className="text-xl text-slate-900 font-medium mb-4">
              {modalMode === 'create' ? 'Create New Category' : 'Edit Category'}
            </h2>
            <form onSubmit={handleFormSubmit}>
              <div className="mb-4">
                <label className="block text-sm text-slate-700 mb-1">Category Name</label>
                <CustomInput
                  type="text"
                  name="repair_code_category"
                  value={formData.repair_code_category}
                  onChange={handleFormChange}
                  placeholder="e.g., Engine"
                  icon={<FileText className="w-4 h-4" />}
                  error={formErrors.repair_code_category}
                />
                {formErrors.repair_code_category && (
                  <p className="text-sm text-red-500 mt-1">{formErrors.repair_code_category}</p>
                )}
              </div>

              <div className="mb-4">
                <label className="block text-sm text-slate-700 mb-1">Category Type</label>
                <CustomDropdown
                  value={formData.repair_category_type}
                  onChange={(value) => setFormData({ ...formData, repair_category_type: value as 'skysoft' | 'motive' })}
                  options={[
                    { value: 'skysoft', label: 'Skysoft' },
                    { value: 'motive', label: 'Motive' }
                  ]}
                  icon={<Hash className="w-4 h-4" />}
                />
              </div>

              <div className="mb-4">
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

              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors ml-2"
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