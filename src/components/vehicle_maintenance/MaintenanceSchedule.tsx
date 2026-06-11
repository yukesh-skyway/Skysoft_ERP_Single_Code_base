import { useState, useMemo, useRef, useEffect } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { toast } from 'sonner@2.0.3';
import { 
  Calendar as CalendarIcon, RefreshCw, List, Search, Filter,
  AlertCircle, AlertTriangle, CheckCircle, Clock, TrendingUp, Wrench,
  Download, Settings, ChevronDown, ChevronUp, Truck, X, Eye, Car, Maximize, Minimize,
  Check, CheckSquare, Square, Database, Save, Edit3, Plus, Trash2, GripVertical, Layout, Layers,
  FileText, ZoomIn, ZoomOut, RotateCcw
} from 'lucide-react';
import { buildApiUrl } from '../../config/urls';
import { ViewRepairOrder } from './ViewRepairOrder';

// Utility function to format date to YYYY-MM-DD
const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toISOString().split('T')[0];
  } catch (error) {
    return 'N/A';
  }
};

interface Vehicle {
  id: string;
  vehicle_number: string;
  vehicle_nickname: string;
  vehicle_type: string;
  current_km: number;
  last_service_date: string;
  last_service_km: number;
  configuration_id: string;
  configuration_name: string;
  avg_km_per_day: number;
}

interface MaintenanceItem {
  id: string;
  vehicle_id: string;
  vehicle_number: string;
  vehicle_nickname: string;
  vehicle_type: string;
  configuration_name: string;
  setting_name: string;
  setting_type?: string;
  interval_type?: string;
  maintenance_type?: string; // ✅ Add maintenance type field
  km_interval?: number;
  km_alert?: number;
  time_interval?: number;
  time_alert?: number;
  time_unit?: string;
  current_km: number;
  km_since_service?: number;
  last_service_km?: number;
  last_service_date: string;
  days_since_service?: number;
  status: 'overdue' | 'due_soon' | 'upcoming' | 'good';
  priority: 'critical' | 'high' | 'medium' | 'low';
  estimated_days_to_service?: number | null;
  estimated_km_to_service?: number | null;
  created_at?: string;
  updated_at?: string;
  // Legacy fields for backward compatibility
  interval_kms?: number;
  kms_to_alert?: number;
  duration_days?: number;
  duration_to_alert?: number;
  km_remaining?: number;
  days_remaining?: number;
  next_service_km?: number;
  next_service_date_estimate?: string;
  // RO Assignment info
  assigned_ro_id?: number | null;
  assigned_ro_number?: string | null;
  // Backend status fields
  status_color?: string;
  primary_reason?: string | null;
  trip_actual_run_kms_htm?: string;
  days_from_effective_date_htm?: string;
  next_service_date?: string | null;
}

interface CustomView {
  id: string;
  name: string;
  vehicleOrder: string[]; // Array of vehicle IDs in order
  columnOrder: string[]; // Array of service names in order
  createdAt: string;
  config?: {
    viewName: string;
    vehicleOrder: string[];
    columnOrder: string[];
    filters: {
      maintenanceTypeFilter: string; // ✅ Add maintenance type filter
      vehicleTypeFilter: string;
      selectedVehicleIds: string[];
      statusFilter: string;
    };
    isDefault?: boolean;
    createdAt: string;
    updatedAt?: string;
  };
  description?: string;
}


interface MatrixColumn {
  id: number;
  name: string;
}

interface MatrixMaintenanceItem {
  vehicle_maintenance_id: number;
  config_id: number;
  due_status: string;
  interval_type: string;
  ro_id: number | null;
  ro_number: string | null;
  kms_remaining?: number;
  kms_overdue?: number;
  next_due_kms?: number;
  current_kms?: number;
  last_kms?: number;
  interval_kms?: number;
  trip_actual_run_kms_htm?: string;
  days_remaining?: number;
  days_overdue?: number;
  next_due_date?: string;
  last_date?: string;
  interval_days?: number;
  days_from_effective_date_htm?: string;
  next_service_date?: string | null;
}

interface MatrixVehicle {
  vehicle_id: number;
  vehicle_nickname: string;
  vehicle_number: string;
  vehicle_type: string;
  maintenance_items: {
    [serviceName: string]: MatrixMaintenanceItem | null;
  };
}

interface MatrixData {
  columns: MatrixColumn[];
  vehicles: MatrixVehicle[];
  stats: {
    total_vehicles: number;
    total_services: number;
    total_cells: number;
  };
}

// Drag and Drop Item Types
const ItemTypes = {
  VEHICLE_ROW: 'vehicle_row',
  COLUMN_HEADER: 'column_header',
};

// Custom Dropdown Component - Enterprise Style
interface DropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
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
        <div className="absolute z-[70] w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-auto">
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

// Custom Multiselect Dropdown for Vehicles - Enterprise Style
interface VehicleMultiSelectProps {
  vehicles: Vehicle[];
  selectedVehicleIds: string[];
  onChange: (ids: string[]) => void;
}

function VehicleMultiSelect({ vehicles, selectedVehicleIds, onChange }: VehicleMultiSelectProps) {
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

  const filteredVehicles = vehicles.filter(v =>
    v.vehicle_nickname.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.vehicle_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggle = (vehicleId: string) => {
    if (selectedVehicleIds.length === 0) {
      // If all selected, start with only this one
      onChange([vehicleId]);
    } else if (selectedVehicleIds.includes(vehicleId)) {
      // Remove from selection
      const newSelection = selectedVehicleIds.filter(id => id !== vehicleId);
      onChange(newSelection);
    } else {
      // Add to selection
      onChange([...selectedVehicleIds, vehicleId]);
    }
  };

  const handleSelectAll = () => {
    if (selectedVehicleIds.length === vehicles.length || selectedVehicleIds.length === 0) {
      onChange([]);
    } else {
      onChange(vehicles.map(v => v.id));
    }
  };

  const isSelected = (vehicleId: string) => {
    return selectedVehicleIds.length === 0 || selectedVehicleIds.includes(vehicleId);
  };

  const displayText = selectedVehicleIds.length === 0 
    ? 'All Vehicles' 
    : selectedVehicleIds.length === vehicles.length
    ? 'All Vehicles'
    : `${selectedVehicleIds.length} Selected`;

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
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Filter className="w-4 h-4 text-slate-500 flex-shrink-0" />
          <span className="text-slate-900 truncate">{displayText}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {selectedVehicleIds.length > 0 && selectedVehicleIds.length < vehicles.length && (
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
              {selectedVehicleIds.length}
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {isOpen && (
        <div className="absolute z-[70] w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-w-md">
          {/* Search Box */}
          <div className="p-2 border-b border-slate-200">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search vehicles..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Select All */}
          <div className="p-2 border-b border-slate-200 bg-slate-50">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSelectAll();
              }}
              onMouseDown={(e) => e.preventDefault()}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-slate-100 rounded transition-colors"
            >
              {(selectedVehicleIds.length === vehicles.length || selectedVehicleIds.length === 0) ? (
                <CheckSquare className="w-4 h-4 text-blue-600" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span className="font-medium text-slate-700">
                {(selectedVehicleIds.length === vehicles.length || selectedVehicleIds.length === 0) ? 'Deselect All' : 'Select All'}
              </span>
            </button>
          </div>

          {/* Vehicle List */}
          <div className="max-h-64 overflow-y-auto">
            {filteredVehicles.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-slate-500">
                No vehicles found
              </div>
            ) : (
              filteredVehicles.map((vehicle) => (
                <button
                  key={vehicle.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggle(vehicle.id);
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-b-0 ${
                    isSelected(vehicle.id) ? 'bg-blue-50' : ''
                  }`}
                >
                  {isSelected(vehicle.id) ? (
                    <CheckSquare className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      <span className={`font-medium truncate ${isSelected(vehicle.id) ? 'text-blue-700' : 'text-slate-900'}`}>
                        {vehicle.vehicle_nickname}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 mt-0.5">
                      {vehicle.vehicle_type} • {vehicle.current_km.toLocaleString()} km
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <span className="text-xs text-slate-600">
              {selectedVehicleIds.length === 0 
                ? `Showing all ${vehicles.length} vehicles` 
                : `Showing ${selectedVehicleIds.length} of ${vehicles.length} vehicles`}
            </span>
            {selectedVehicleIds.length > 0 && selectedVehicleIds.length < vehicles.length && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-xs text-red-600 hover:text-red-700 font-medium"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Draggable Column Header Component (moved outside for stability)
interface DraggableColumnHeaderProps {
  service: string;
  index: number;
  isEditMode: boolean;
  moveColumn: (dragIndex: number, hoverIndex: number) => void;
}

function DraggableColumnHeader({ service, index, isEditMode, moveColumn }: DraggableColumnHeaderProps) {
  const ref = useRef<HTMLDivElement>(null);
  
  const [{ isDragging }, drag] = useDrag({
    type: ItemTypes.COLUMN_HEADER,
    item: { index },
    canDrag: isEditMode,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: ItemTypes.COLUMN_HEADER,
    hover: (item: { index: number }, monitor) => {
      if (!ref.current || !isEditMode) return;
      
      const dragIndex = item.index;
      const hoverIndex = index;
      
      if (dragIndex === hoverIndex) return;
      
      moveColumn(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
  });

  drag(drop(ref));

  return (
    <div
      ref={ref}
      className={`p-3.5 bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-lg border-2 border-blue-300 shadow-sm ${
        isEditMode ? 'cursor-move hover:shadow-md hover:border-blue-400' : ''
      } ${isDragging ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center gap-2">
        {isEditMode && <GripVertical className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />}
        <div className="text-xs text-blue-900 font-bold truncate flex-1 leading-tight" title={service}>
          {service}
        </div>
      </div>
    </div>
  );
}

// Draggable Vehicle Row Component (moved outside for stability)
interface DraggableVehicleRowProps {
  vehicle: Vehicle;
  index: number;
  uniqueServices: string[];
  vehicleItems: MaintenanceItem[];
  isEditMode: boolean;
  moveVehicle: (dragIndex: number, hoverIndex: number) => void;
  getStatusIcon: (status: string) => JSX.Element;
  getStatusLabel: (status: string) => string;
  openCellDetails: (item: MaintenanceItem) => void;
  setSelectedROId: (id: number) => void;
  setShowViewROModal: (show: boolean) => void;
}

function DraggableVehicleRow({
  vehicle,
  index,
  uniqueServices,
  vehicleItems,
  isEditMode,
  moveVehicle,
  getStatusIcon,
  getStatusLabel,
  openCellDetails,
  setSelectedROId,
  setShowViewROModal,
}: DraggableVehicleRowProps) {
  const ref = useRef<HTMLDivElement>(null);
  
  const [{ isDragging }, drag] = useDrag({
    type: ItemTypes.VEHICLE_ROW,
    item: { index },
    canDrag: isEditMode,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: ItemTypes.VEHICLE_ROW,
    hover: (item: { index: number }, monitor) => {
      if (!ref.current || !isEditMode) return;
      
      const dragIndex = item.index;
      const hoverIndex = index;
      
      if (dragIndex === hoverIndex) return;
      
      moveVehicle(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
  });

  drag(drop(ref));

  const getProgressPercentage = (item: MaintenanceItem) => {
    // For BOTH interval type, calculate both and return the higher progress
    if (item.interval_type === 'BOTH') {
      let kmProgress = 0;
      let daysProgress = 0;
      
      if (item.interval_kms > 0) {
        kmProgress = ((item.current_km - item.last_service_km) / item.interval_kms) * 100;
      }
      if (item.duration_days > 0) {
        daysProgress = (item.days_since_service / item.duration_days) * 100;
      }
      
      // Return the higher progress (more critical)
      const maxProgress = Math.max(kmProgress, daysProgress);
      return Math.min(100, Math.max(0, maxProgress));
    }
    
    // For KMS or DURATION only
    if (item.interval_kms > 0) {
      const kmProgress = ((item.current_km - item.last_service_km) / item.interval_kms) * 100;
      return Math.min(100, Math.max(0, kmProgress));
    }
    if (item.duration_days > 0) {
      const daysProgress = (item.days_since_service / item.duration_days) * 100;
      return Math.min(100, Math.max(0, daysProgress));
    }
    return 0;
  };

  return (
    <div
      ref={ref}
      className={`grid gap-3 ${isDragging ? 'opacity-50' : ''}`}
      style={{ gridTemplateColumns: `220px repeat(${uniqueServices.length}, 165px)` }}
    >
      {/* Vehicle Info Cell - Frozen Left Column */}
      <div className="sticky left-0 z-30 bg-white pl-6" style={{ paddingRight: '16px', marginRight: '-4px', boxShadow: '6px 0 12px -4px rgba(0, 0, 0, 0.2)' }}>
        <div className="p-3.5 bg-white rounded-lg border-2 border-slate-400 shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center gap-2.5">
            {isEditMode && <GripVertical className="w-4 h-4 text-slate-400 cursor-move" />}
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Truck className="w-4 h-4 text-blue-700" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm text-slate-900 font-semibold truncate">{vehicle.vehicle_nickname}</div>
              <div className="text-xs text-slate-600 truncate">{vehicle.vehicle_type}</div>
              <div className="text-xs text-slate-500 mt-0.5 font-medium">{vehicle.current_km.toLocaleString()} km</div>
            </div>
          </div>
        </div>
      </div>

      {/* Service Status Cells */}
      {uniqueServices.map((service, idx) => {
        const item = vehicleItems.find(i => i.setting_name === service);
        
        if (!item) {
          return (
            <div key={idx} className="p-3.5 bg-slate-50/50 rounded-lg border border-slate-200 opacity-50">
              <div className="text-xs text-slate-400 text-center font-medium">N/A</div>
            </div>
          );
        }

        const progress = getProgressPercentage(item);
const missingDate = !item.last_service_date || item.last_service_date === '' || item.last_service_date === 'N/A';
const missingKm   = !item.last_service_km  || item.last_service_km === 0;

const hasMissingData = 
  item.interval_type === 'KMS'      ? missingKm :
  item.interval_type === 'DURATION' ? missingDate :
  item.interval_type === 'BOTH'     ? (missingDate || missingKm) :
  false;
        return (
          <button
            key={idx}
            onClick={() => {
              // If assigned to RO, open the RO modal instead of cell details
              if (item.assigned_ro_id) {
                setSelectedROId(item.assigned_ro_id);
                setShowViewROModal(true);
              } else {
                openCellDetails(item);
              }
            }}
            title={item.assigned_ro_number ? `Click to view ${item.assigned_ro_number}` : 'Click for details'}
            className={`p-3.5 rounded-lg border-2 transition-all hover:shadow-lg hover:scale-[1.02] relative overflow-hidden group ${ item.status === 'overdue'
                ? 'bg-gradient-to-br from-red-50 to-red-100/50 border-red-300 hover:from-red-100 hover:to-red-100'
                : item.status === 'due_soon'
                ? 'bg-gradient-to-br from-orange-50 to-orange-100/50 border-orange-300 hover:from-orange-100 hover:to-orange-100'
                : item.status === 'upcoming'
                ? 'bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-300 hover:from-blue-100 hover:to-blue-100'
                : 'bg-gradient-to-br from-green-50 to-green-100/50 border-green-300 hover:from-green-100 hover:to-green-100'
            }`}
          >



            
            {/* Progress Bar Background */}
            <div 
              className={`absolute bottom-0 left-0 h-1 transition-all ${
                
                item.status === 'overdue'
                  ? 'bg-red-500'
                  : item.status === 'due_soon'
                  ? 'bg-orange-500'
                  : item.status === 'upcoming'
                  ? 'bg-blue-500'
                  : 'bg-green-500'
              }`}
              style={{ width: `${progress}%` }}
            ></div>

            <div className="text-left relative z-10">
              {/* Status Icon */}
       <div className={`flex items-center gap-1.5 mb-2 ${
                item.status === 'overdue'
                  ? 'text-red-700'
                  : item.status === 'due_soon'
                  ? 'text-orange-700'
                  : item.status === 'upcoming'
                  ? 'text-blue-700'
                  : 'text-green-700'
              }`}>
                <div className={`p-1 rounded ${
                  item.status === 'overdue'
                    ? 'bg-red-200'
                    : item.status === 'due_soon'
                    ? 'bg-orange-200'
                    : item.status === 'upcoming'
                    ? 'bg-blue-200'
                    : 'bg-green-200'
                }`}>
                  {getStatusIcon(item.status)}
                </div>
                <span className="text-xs font-bold uppercase tracking-wide">{getStatusLabel(item.status)}</span>
              </div>

              {/* Progress Info */}
              <div className="space-y-1">
                {/* For KMS-based intervals, show Next Service KM */}
                {(item.interval_type === 'KMS' || item.interval_type === 'BOTH') && item.interval_kms > 0 && (
                  <div className="text-xs text-slate-800">
                    <div className="font-semibold text-slate-900">
                      Next Service
                    </div>
                    <div className="text-slate-900 font-bold text-[11px]">
                      {((item.last_service_km || 0) + item.interval_kms).toLocaleString()} km
                    </div>
                  </div>
                )}

                {/* Show days progress for DURATION or BOTH types */}
                {item.days_from_effective_date_htm !== 'N/A' && (
                  <div className="text-xs text-slate-800">
                    <div className="font-semibold text-slate-900">
                      {item.days_from_effective_date_htm}
                    </div>
                    <div className="text-slate-600 text-[10px]">
                      Time Elapsed
                    </div>
                    {item.next_service_date && (
                      <div className="text-slate-900 font-bold text-[11px] mt-0.5">
                        Next: {item.next_service_date}
                      </div>
                    )}
                  </div>
                )}

                {item.primary_reason && (
                  <div className="text-[10px] text-slate-700 mt-1 pt-1 border-t border-slate-300/50">
                    <span className="font-medium">Reason:</span> {item.primary_reason}
                  </div>
                )}

              {/* RO Badge - Below Reason */}
                {item.assigned_ro_number && (
                  <div className="mt-1.5">
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded shadow-md border border-blue-400">
                      <FileText className="w-3 h-3 flex-shrink-0" />
                      <span className="text-[10px] font-bold tracking-wide">{item.assigned_ro_number}</span>
                    </div>
                  </div>
                )}

                {/* ✅ No History badge - after RO badge */}
                {hasMissingData && (
                  <div className="mt-1.5">
                    <div
                      style={{ animation: 'blink-pulse 1.2s ease-in-out infinite' }}
                      title={[
                        missingDate && 'No last service date',
                        missingKm   && 'No last service KM',
                      ].filter(Boolean).join(' • ')}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-400 text-yellow-900 rounded shadow-sm text-[10px] font-bold uppercase tracking-wide"
                    >
                      <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                      No History
                    </div>
                  </div>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function MaintenanceSchedule() {
  const [viewMode, setViewMode] = useState<'table' | 'matrix'>('matrix');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'overdue' | 'due_soon' | 'upcoming' | 'good'>('all');
  const [maintenanceTypeFilter, setMaintenanceTypeFilter] = useState<string>('all'); // ✅ Add maintenance type filter
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortField, setSortField] = useState<keyof MaintenanceItem>('status');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedCell, setSelectedCell] = useState<MaintenanceItem | null>(null);
  const [showCellModal, setShowCellModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100); // Zoom percentage: 50% to 200%
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
  
  // View RO Modal state
  const [selectedROId, setSelectedROId] = useState<number | null>(null);
  const [showViewROModal, setShowViewROModal] = useState(false);
  
  // Custom View States
  const [customViews, setCustomViews] = useState<CustomView[]>([]);
  const [activeCustomView, setActiveCustomView] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showCustomViewModal, setShowCustomViewModal] = useState(false);
  const [showManageViewsModal, setShowManageViewsModal] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [newViewDescription, setNewViewDescription] = useState('');
  const [setAsDefault, setSetAsDefault] = useState(false);
  const [vehicleOrder, setVehicleOrder] = useState<string[]>([]);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);

  // Real data from API
  const [maintenanceData, setMaintenanceData] = useState<MaintenanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch scheduled maintenance data from API
  useEffect(() => {
    fetchMaintenanceData();
  }, []);

  const fetchMaintenanceData = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('📊 Fetching scheduled maintenance for all vehicles...');
      
      const response = await fetch(buildApiUrl('/repair-orders/scheduled-maintenance-all'), {
        headers: {
          'ngrok-skip-browser-warning': 'true'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch maintenance data');
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        console.log(`✅ Loaded ${result.data.length} maintenance items`);
        
        // Transform API data to match MaintenanceItem interface
        const transformedData: MaintenanceItem[] = result.data.map((item: any) => {
          const kmRemaining = item.kms && item.kms > 0 ? 
            Math.max(0, item.kms - item.actual_kms_since_service) : 0;
          const daysRemaining = item.days && item.days > 0 ? 
            Math.max(0, item.days - item.actual_days_since_service) : 0;
          
          return {
            id: item.id || '',
            vehicle_id: (item.vehicle_id || '').toString(),
            vehicle_number: item.vehicle_number || '',
            vehicle_nickname: item.vehicle_nickname || '',
            vehicle_type: item.vehicle_type_name || 'Unknown',
            configuration_name: item.configuration_name || '',
            setting_name: item.setting_name,
            setting_type: item.setting_type,
            interval_type: item.interval_type,
            maintenance_type: item.maintenance_type, // ✅ Add maintenance type
            km_interval: item.kms || 0,
            km_alert: item.kms_to_alert || 0,
            time_interval: item.days || 0,
            time_alert: item.days_to_alert || 0,
            time_unit: item.time_unit || 'DAYS',
            current_km: item.current_km,
            km_since_service: item.actual_kms_since_service,
            last_service_date: item.last_maintenance_date,
            last_service_km: item.last_replaced_km,
            days_since_service: item.actual_days_since_service,
            status: item.status.toLowerCase() as 'overdue' | 'due_soon' | 'upcoming' | 'good',
            priority: item.status === 'OVERDUE' ? 'high' : item.status === 'DUE_SOON' ? 'medium' : 'low',
            estimated_days_to_service: daysRemaining,
            estimated_km_to_service: kmRemaining,
            // Legacy fields for backward compatibility
            interval_kms: item.kms || 0,
            kms_to_alert: item.kms_to_alert || 0,
            duration_days: item.days || 0,
            duration_to_alert: item.days_to_alert || 0,
            km_remaining: kmRemaining,
            days_remaining: daysRemaining,
            next_service_km: item.last_replaced_km + (item.kms || 0),
            next_service_date_estimate: daysRemaining > 0 ? 
              new Date(Date.now() + daysRemaining * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : 'Overdue',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            // RO Assignment info
            assigned_ro_id: item.assigned_ro_id || null,
            assigned_ro_number: item.assigned_ro_number || null,
            // Backend status fields
            status_color: item.status_color || 'gray',
            primary_reason: item.primary_reason || null,
            trip_actual_run_kms_htm: item.trip_actual_run_kms_htm || 'N/A',
            days_from_effective_date_htm: item.days_from_effective_date_htm || 'N/A',
            next_service_date: item.next_service_date || null
          };
        });

        setMaintenanceData(transformedData);
        toast.success(`Loaded ${transformedData.length} maintenance items`, { duration: 2000 });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load maintenance data';
      setError(errorMessage);
      toast.error(errorMessage, { duration: 4000 });
      console.error('Error fetching maintenance data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch matrix views from API
  const fetchMatrixViews = async () => {
    try {
      console.log('📊 Fetching matrix views...');
      
      const response = await fetch(buildApiUrl('/maintenance-matrix-views'), {
        headers: {
          'ngrok-skip-browser-warning': 'true'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch matrix views');
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        console.log(`✅ Loaded ${result.count} matrix views`);
        
        // Transform API data to match CustomView interface
        const transformedViews: CustomView[] = result.data.map((view: any) => ({
          id: view.name, // Use the slug as ID
          name: view.config.viewName,
          vehicleOrder: view.config.vehicleOrder || [],
          columnOrder: view.config.columnOrder || [],
          createdAt: view.config.createdAt,
          config: view.config,
          description: view.description
        }));
        
        setCustomViews(transformedViews);
        
        // Check if there's a default view and load it
        const defaultView = transformedViews.find(v => v.config?.isDefault);
        if (defaultView) {
          console.log(`✅ Loading default view: ${defaultView.name}`);
          setActiveCustomView(defaultView.id);
          setVehicleOrder(defaultView.vehicleOrder);
          setColumnOrder(defaultView.columnOrder);
          if (defaultView.config?.filters) {
            setMaintenanceTypeFilter(defaultView.config.filters.maintenanceTypeFilter || 'all'); // ✅ Restore maintenance type filter
            setVehicleTypeFilter(defaultView.config.filters.vehicleTypeFilter);
            setSelectedVehicleIds(defaultView.config.filters.selectedVehicleIds);
            setStatusFilter(defaultView.config.filters.statusFilter as any);
          }
        }
      }
    } catch (err: any) {
      console.error('Error fetching matrix views:', err);
      // Don't show error toast for views - it's not critical
    }
  };

  // Load matrix views on component mount
  useEffect(() => {
    fetchMatrixViews();
  }, []);

  // Use real maintenance data from API
  const maintenanceItems = useMemo(() => {
    // Return real data from API
    return maintenanceData;
  }, [maintenanceData]);

  // Extract unique vehicles from maintenance data
  const vehicles: Vehicle[] = useMemo(() => {
    const uniqueVehicles = new Map<string, Vehicle>();
    
    maintenanceData.forEach(item => {
      if (!uniqueVehicles.has(item.vehicle_id)) {
        uniqueVehicles.set(item.vehicle_id, {
          id: item.vehicle_id,
          vehicle_number: item.vehicle_number || '',
          vehicle_nickname: item.vehicle_nickname || '',
          vehicle_type: item.vehicle_type || '',
          current_km: item.current_km || 0,
          last_service_date: item.last_service_date || '',
          last_service_km: item.last_service_km || 0,
          configuration_id: '', // Not needed from API
          configuration_name: item.configuration_name || '',
          avg_km_per_day: 0 // Not needed from API
        });
      }
    });
    
    return Array.from(uniqueVehicles.values());
  }, [maintenanceData]);

  // Get unique vehicle types from vehicles data
  const uniqueVehicleTypes = useMemo(() => {
    const types = new Set<string>();
    vehicles.forEach(v => {
      if (v.vehicle_type && v.vehicle_type !== 'Unknown') {
        types.add(v.vehicle_type);
      }
    });
    return Array.from(types).sort();
  }, [vehicles]);

  // Get available vehicles based on selected vehicle type (cascading filter)
  const availableVehicles = useMemo(() => {
    if (vehicleTypeFilter === 'all') {
      return vehicles;
    }
    return vehicles.filter(v => v.vehicle_type === vehicleTypeFilter);
  }, [vehicles, vehicleTypeFilter]);

  // Reset vehicle filter when vehicle type changes
  const handleVehicleTypeChange = (type: string) => {
    setVehicleTypeFilter(type);
    setSelectedVehicleIds([]); // Reset vehicle filter when type changes
  };

  // Filtering
  const filteredItems = useMemo(() => {
    return maintenanceItems.filter(item => {
      const matchesSearch = 
        item.vehicle_nickname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.setting_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.vehicle_type?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      const matchesVehicleType = vehicleTypeFilter === 'all' || item.vehicle_type === vehicleTypeFilter;
      
      // Vehicle filter - if specific vehicles selected, only show those
      const matchesVehicle = selectedVehicleIds.length === 0 || selectedVehicleIds.includes(item.vehicle_id);
      
      return matchesSearch && matchesStatus && matchesVehicleType && matchesVehicle;
    });
  }, [maintenanceItems, searchTerm, statusFilter, vehicleTypeFilter, selectedVehicleIds]);

  // Sorting
  const sortedItems = useMemo(() => {
    const sorted = [...filteredItems];
    sorted.sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];

      // Priority sorting
      if (sortField === 'priority') {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        aValue = priorityOrder[a.priority];
        bValue = priorityOrder[b.priority];
      }

      // Status sorting
      if (sortField === 'status') {
        const statusOrder = { overdue: 0, due_soon: 1, upcoming: 2, good: 3 };
        aValue = statusOrder[a.status];
        bValue = statusOrder[b.status];
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredItems, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(sortedItems.length / itemsPerPage);
  const paginatedItems = sortedItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSort = (field: keyof MaintenanceItem) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Statistics
  const stats = useMemo(() => {
    const overdue = maintenanceItems.filter(i => i.status === 'overdue').length;
    const dueSoon = maintenanceItems.filter(i => i.status === 'due_soon').length;
    const good = maintenanceItems.filter(i => i.status === 'good').length;
    return { overdue, dueSoon, good };
  }, [maintenanceItems]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'overdue':
        return 'bg-red-100 text-red-700';
      case 'due_soon':
        return 'bg-orange-100 text-orange-700';
      case 'good':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'overdue':
        return <AlertCircle className="w-4 h-4" />;
      case 'due_soon':
        return <AlertTriangle className="w-4 h-4" />;
      case 'good':
        return <CheckCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'overdue':
        return 'Overdue';
      case 'due_soon':
        return 'Due Soon';
      case 'good':
        return 'Good';
      default:
        return status;
    }
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(filteredItems, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `maintenance_schedule_${new Date().toISOString().split('T')[0]}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const openVehicleDetails = (vehicleId: string) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (vehicle) {
      setSelectedVehicle(vehicle);
      setShowDetailsModal(true);
    }
  };

  const openCellDetails = (item: MaintenanceItem) => {
    setSelectedCell(item);
    setShowCellModal(true);
  };

  // Custom View Management Functions
  const saveCustomView = async () => {
    if (!newViewName.trim()) {
      toast.error('Please enter a view name');
      return;
    }
      // ✅  VALIDATION
  if (maintenanceTypeFilter !== 'all') {
    toast.error('Maintenance Type filter must be set to "All" when saving a view');
    return;
  }
    
    try {
      const uniqueServices = Array.from(new Set(maintenanceItems.map(item => item.setting_name)));
      
      const viewData = {
        viewName: newViewName,
        vehicleOrder: vehicleOrder.length > 0 ? vehicleOrder : vehicles.map(v => v.id),
        columnOrder: columnOrder.length > 0 ? columnOrder : uniqueServices,
        filters: {
          maintenanceTypeFilter, // ✅ Add maintenance type filter
          vehicleTypeFilter,
          selectedVehicleIds,
          statusFilter
        },
        description: newViewDescription.trim() || `Custom view for ${newViewName}`,
        setAsDefault: setAsDefault
      };
      
      console.log('💾 Saving matrix view:', viewData);
      
      const response = await fetch(buildApiUrl('/maintenance-matrix-views'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify(viewData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save view');
      }

      const result = await response.json();
      
      if (result.success) {
        console.log(`✅ View saved: ${result.data.name}`);
        toast.success(`Custom view "${newViewName}" saved successfully!`);
        
        // Refresh the views list
        await fetchMatrixViews();
        
        // Reset form
        setNewViewName('');
        setNewViewDescription('');
        setSetAsDefault(false);
        setShowCustomViewModal(false);
        setIsEditMode(false);
        
        // Set as active view
        setActiveCustomView(result.data.name);
      }
    } catch (err: any) {
      console.error('Error saving matrix view:', err);
      toast.error(err.message || 'Failed to save custom view');
    }
  };

  const updateCustomView = async () => {
    if (!activeCustomView) {
      toast.error('No active view to update');
      return;
    }
      // ✅ VALIDATION
  if (maintenanceTypeFilter !== 'all') {
    toast.error('Maintenance Type filter must be set to "All" when saving a view');
    return;
  }
    
    try {
      const uniqueServices = Array.from(new Set(maintenanceItems.map(item => item.setting_name)));
      const currentView = customViews.find(v => v.id === activeCustomView);
      
      if (!currentView) {
        toast.error('Active view not found');
        return;
      }
      
      const viewData = {
        viewName: currentView.name,
        vehicleOrder: vehicleOrder.length > 0 ? vehicleOrder : vehicles.map(v => v.id),
        columnOrder: columnOrder.length > 0 ? columnOrder : uniqueServices,
        filters: {
          maintenanceTypeFilter, // ✅ Add maintenance type filter
          vehicleTypeFilter,
          selectedVehicleIds,
          statusFilter
        },
        description: currentView.description || `Custom view for ${currentView.name}`,
        setAsDefault: currentView.config?.isDefault || false
      };
      
      console.log(`💾 Updating matrix view: ${activeCustomView}`, viewData);
      
      const response = await fetch(buildApiUrl(`/maintenance-matrix-views/${activeCustomView}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify(viewData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update view');
      }

      const result = await response.json();
      
      if (result.success) {
        console.log(`✅ View updated: ${currentView.name}`);
        toast.success(`Custom view "${currentView.name}" updated successfully!`);
        
        // Refresh the views list
        await fetchMatrixViews();
        
        setShowCustomViewModal(false);
        setIsEditMode(false);
      }
    } catch (err: any) {
      console.error('Error updating matrix view:', err);
      toast.error(err.message || 'Failed to update custom view');
    }
  };

  const deleteCustomView = async (viewId: string) => {
    const viewToDelete = customViews.find(v => v.id === viewId);
    
    if (!viewToDelete) return;
    
    try {
      console.log(`🗑️ Deleting matrix view: ${viewId}`);
      
      const response = await fetch(buildApiUrl(`/maintenance-matrix-views/${viewId}`), {
        method: 'DELETE',
        headers: {
          'ngrok-skip-browser-warning': 'true'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete view');
      }

      const result = await response.json();
      
      if (result.success) {
        console.log(`✅ View deleted: ${viewId}`);
        toast.success(`Custom view "${viewToDelete.name}" deleted successfully!`);
        
        // Clear active view if it was deleted
        if (activeCustomView === viewId) {
          setActiveCustomView(null);
          setVehicleOrder([]);
          setColumnOrder([]);
        }
        
        // Refresh the views list
        await fetchMatrixViews();
      }
    } catch (err: any) {
      console.error('Error deleting matrix view:', err);
      toast.error(err.message || 'Failed to delete custom view');
    }
  };

  const loadCustomView = (viewId: string) => {
    const view = customViews.find(v => v.id === viewId);
    if (view) {
      console.log(`📂 Loading matrix view: ${view.name}`);
      
      setActiveCustomView(viewId);
      setVehicleOrder(view.vehicleOrder);
      setColumnOrder(view.columnOrder);
      
      // Load filters if available
      if (view.config?.filters) {
        setVehicleTypeFilter(view.config.filters.vehicleTypeFilter);
        setSelectedVehicleIds(view.config.filters.selectedVehicleIds);
        setStatusFilter(view.config.filters.statusFilter as any);
      }
      
      toast.success(`Custom view "${view.name}" loaded successfully!`);
      setShowManageViewsModal(false);
    }
  };

  const clearCustomView = () => {
    setActiveCustomView(null);
    setVehicleOrder([]);
    setColumnOrder([]);
    setIsEditMode(false);
    toast.info('Switched to default view');
  };

  const moveVehicle = (dragIndex: number, hoverIndex: number) => {
    if (!isEditMode) return;
    
    const newOrder = [...vehicleOrder];
    const [removed] = newOrder.splice(dragIndex, 1);
    newOrder.splice(hoverIndex, 0, removed);
    setVehicleOrder(newOrder);
  };

  const moveColumn = (dragIndex: number, hoverIndex: number) => {
    if (!isEditMode) return;
    
    const newOrder = [...columnOrder];
    const [removed] = newOrder.splice(dragIndex, 1);
    newOrder.splice(hoverIndex, 0, removed);
    setColumnOrder(newOrder);
  };

  // Matrix content component (reusable for both regular and fullscreen)
  const MatrixContent = ({ isFullscreenMode = false }: { isFullscreenMode?: boolean }) => {
    // ✅ First filter maintenance items by maintenance type
    let filteredMaintenanceItems = maintenanceItems;
    if (maintenanceTypeFilter !== 'all') {
      filteredMaintenanceItems = maintenanceItems.filter(item => {
        const itemType = item.maintenance_type?.toUpperCase();
        if (maintenanceTypeFilter === 'regular') {
          return itemType === 'REGULAR' || itemType === 'REGULAR MAINTENANCE';
        } else if (maintenanceTypeFilter === 'overhaul') {
          return itemType === 'OVERHAUL' || itemType === 'OVERHAUL MAINTENANCE';
        }
        return true;
      });
    }
    
    // ✅ Get unique services based on filtered maintenance items
    const uniqueServices = Array.from(new Set(filteredMaintenanceItems.map(item => item.setting_name)));
    
    // ✅ Filter vehicles to only show those that have services for the selected maintenance type
    let filteredVehicles = vehicles;
    if (maintenanceTypeFilter !== 'all') {
      const vehiclesWithFilteredServices = new Set(filteredMaintenanceItems.map(item => item.vehicle_id));
      filteredVehicles = filteredVehicles.filter(v => vehiclesWithFilteredServices.has(v.id));
    }
    
    // Filter vehicles based on type and selection (cascading)
    // First filter by vehicle type
    if (vehicleTypeFilter !== 'all') {
      filteredVehicles = filteredVehicles.filter(v => v.vehicle_type === vehicleTypeFilter);
    }
    
    // Then filter by selected vehicles
    if (selectedVehicleIds.length > 0) {
      filteredVehicles = filteredVehicles.filter(v => selectedVehicleIds.includes(v.id));
    }
    
    // Initialize orders if not set or if in edit mode for the first time
    useEffect(() => {
      if (isEditMode && vehicleOrder.length === 0) {
        setVehicleOrder(filteredVehicles.map(v => v.id));
      }
      if (isEditMode && columnOrder.length === 0) {
        setColumnOrder(uniqueServices);
      }
    }, [isEditMode]);
    
    // Apply custom view ordering
    const orderedVehicles = vehicleOrder.length > 0 && (activeCustomView || isEditMode)
      ? vehicleOrder.map(id => filteredVehicles.find(v => v.id === id)).filter(Boolean) as Vehicle[]
      : filteredVehicles;
    
  
const orderedServices = columnOrder.length > 0 && (activeCustomView || isEditMode)
  ? columnOrder.filter(serviceName => 
      filteredMaintenanceItems.some(item => item.setting_name === serviceName)
    )
  : uniqueServices;
    return (
      <div className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden ${isFullscreenMode ? 'h-full flex flex-col' : ''}`}>
        <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-slate-50 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg text-slate-900 font-semibold flex items-center gap-2">
                <Wrench className="w-5 h-5 text-blue-600" />
                Fleet Maintenance Matrix
              </h2>
              <div className="flex items-center gap-4 mt-2 flex-wrap">
                <p className="text-xs text-slate-600">
                  Quick overview of all vehicles and their maintenance status
                </p>
                {/* Compact Status Legend */}
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-slate-500 font-medium">Legend:</span>
                  <div className="flex items-center gap-1.5" title="Overdue - Action Required">
                    <div className="w-3.5 h-3.5 bg-gradient-to-br from-red-50 to-red-100 border border-red-300 rounded flex items-center justify-center">
                      <AlertCircle className="w-2 h-2 text-red-600" />
                    </div>
                    <span className="text-slate-700 font-medium">Overdue</span>
                  </div>
                  <div className="flex items-center gap-1.5" title="Due Soon - Schedule">
                    <div className="w-3.5 h-3.5 bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-300 rounded flex items-center justify-center">
                      <AlertTriangle className="w-2 h-2 text-orange-600" />
                    </div>
                    <span className="text-slate-700 font-medium">Due Soon</span>
                  </div>
                  <div className="flex items-center gap-1.5" title="Good - On Track">
                    <div className="w-3.5 h-3.5 bg-gradient-to-br from-green-50 to-green-100 border border-green-300 rounded flex items-center justify-center">
                      <CheckCircle className="w-2 h-2 text-green-600" />
                    </div>
                    <span className="text-slate-700 font-medium">Good</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* ✅ Maintenance Type Filter - FIRST */}
              <div className="min-w-[200px]">
                <CustomDropdown
                  value={maintenanceTypeFilter}
                  onChange={(value) => setMaintenanceTypeFilter(value)}
                  options={[
                    { value: 'all', label: 'All Maintenance Types' },
                    { value: 'regular', label: 'Regular Maintenance' },
                    { value: 'overhaul', label: 'Overhaul Maintenance' }
                  ]}
                  icon={<Settings className="w-4 h-4" />}
                />
              </div>

              {/* Vehicle Type Filter */}
              <div className="min-w-[180px]">
                <CustomDropdown
                  value={vehicleTypeFilter}
                  onChange={handleVehicleTypeChange}
                  options={[
                    { value: 'all', label: 'All Types' },
                    ...uniqueVehicleTypes.map(type => ({ value: type, label: type }))
                  ]}
                  icon={<Truck className="w-4 h-4" />}
                />
              </div>

              {/* Vehicle Filter Dropdown - Enterprise Style */}
              <div className="min-w-[200px]">
                <VehicleMultiSelect
                  vehicles={availableVehicles}
                  selectedVehicleIds={selectedVehicleIds}
                  onChange={setSelectedVehicleIds}
                />
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-600 bg-white px-3 py-2 rounded-lg border border-slate-200">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                <span>{orderedVehicles.length} Vehicles • {orderedServices.length} Services</span>
                {maintenanceTypeFilter !== 'all' && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ml-1 ${
                    maintenanceTypeFilter === 'regular' 
                      ? 'bg-emerald-100 text-emerald-700' 
                      : 'bg-orange-100 text-orange-700'
                  }`}>
                    {maintenanceTypeFilter === 'regular' ? 'Regular' : 'Overhaul'}
                  </span>
                )}
                {vehicleTypeFilter !== 'all' && (
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium ml-1">
                    {vehicleTypeFilter}
                  </span>
                )}
              </div>

              {/* Custom View Controls */}
              <div className="flex items-center gap-2">
                {/* Custom View Selector */}
                {customViews.length > 0 && (
                  <div className="min-w-[180px]">
                    <CustomDropdown
                      value={activeCustomView || ''}
                      onChange={(value) => {
                        if (value === '') {
                          clearCustomView();
                        } else {
                          loadCustomView(value);
                        }
                      }}
                      options={[
                        { value: '', label: 'Default View' },
                        ...customViews.map(view => ({
                          value: view.id,
                          label: view.name
                        }))
                      ]}
                      icon={<Layout className="w-4 h-4" />}
                      placeholder="Select View"
                    />
                  </div>
                )}

                {/* Edit Mode Toggle */}
                <button
                  onClick={() => {
                    if (!isEditMode) {
                      setVehicleOrder(orderedVehicles.map(v => v.id));
                      setColumnOrder(orderedServices);
                    }
                    setIsEditMode(!isEditMode);
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                    isEditMode
                      ? 'bg-orange-600 text-white hover:bg-orange-700'
                      : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
                  }`}
                  title={isEditMode ? 'Exit Edit Mode' : 'Edit Layout'}
                >
                  <Edit3 className="w-4 h-4" />
                  <span className="text-sm font-medium">{isEditMode ? 'Exit Edit' : 'Edit'}</span>
                </button>

                {/* Save Custom View Button */}
                {isEditMode && (
                  <button
                    onClick={() => setShowCustomViewModal(true)}
                    className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    title="Save as Custom View"
                  >
                    <Save className="w-4 h-4" />
                    <span className="text-sm font-medium">Save View</span>
                  </button>
                )}

                {/* Manage Views Button - Always visible */}
                <button
                  onClick={() => setShowManageViewsModal(true)}
                  className="flex items-center gap-2 px-3 py-2 bg-white text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                  title="Manage Custom Views"
                >
                  <Settings className="w-4 h-4" />
                  <span className="text-sm font-medium">Manage Views</span>
                  {customViews.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                      {customViews.length}
                    </span>
                  )}
                </button>
              </div>

              {!isFullscreenMode && (
                <button
                  onClick={() => setIsFullscreen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  title="Fullscreen Mode"
                >
                  <Maximize className="w-4 h-4" />
                  <span className="text-sm font-medium">Fullscreen</span>
                </button>
              )}
              {isFullscreenMode && (
                <>
                  {/* Zoom Controls */}
                  <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200">
                    <button
                      onClick={() => setZoomLevel(prev => Math.max(50, prev - 10))}
                      disabled={zoomLevel <= 50}
                      className="p-1.5 hover:bg-slate-100 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Zoom Out"
                    >
                      <ZoomOut className="w-4 h-4 text-slate-600" />
                    </button>
                    <span className="text-sm font-medium text-slate-700 min-w-[60px] text-center">
                      {zoomLevel}%
                    </span>
                    <button
                      onClick={() => setZoomLevel(prev => Math.min(200, prev + 10))}
                      disabled={zoomLevel >= 200}
                      className="p-1.5 hover:bg-slate-100 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Zoom In"
                    >
                      <ZoomIn className="w-4 h-4 text-slate-600" />
                    </button>
                    <div className="w-px h-5 bg-slate-300 mx-1"></div>
                    <button
                      onClick={() => setZoomLevel(100)}
                      className="p-1.5 hover:bg-slate-100 rounded transition-colors"
                      title="Reset Zoom"
                    >
                      <RotateCcw className="w-4 h-4 text-slate-600" />
                    </button>
                  </div>
                  
                  <button
                    onClick={() => {
                      setIsFullscreen(false);
                      setZoomLevel(100); // Reset zoom when exiting fullscreen
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
                    title="Exit Fullscreen"
                  >
                    <Minimize className="w-4 h-4" />
                    <span className="text-sm font-medium">Exit</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

          <div 
            className={`overflow-auto ${isFullscreenMode ? 'flex-1' : 'max-h-[calc(100vh-350px)]'}`} 
            style={{ 
              scrollbarGutter: 'stable',
              ...(isFullscreenMode ? {
                fontSize: `${zoomLevel}%`
              } : {})
            }}
          >
            <div 
              className="min-w-max relative pl-6" 
              style={isFullscreenMode ? { 
                zoom: `${zoomLevel}%`
              } : {}}
            >
              {/* Header Row - Sticky Top */}
              <div className="sticky top-0 z-50 bg-white shadow-md border-b-2 border-slate-300">
                <div className="grid gap-3 pt-4 pr-6 pb-4" style={{ gridTemplateColumns: `220px repeat(${orderedServices.length}, 165px)` }}>
                  {/* Top-Left Corner - Frozen both directions */}
                  <div className="sticky left-0 z-60 bg-white pl-6" style={{ paddingRight: '16px', marginRight: '-4px', boxShadow: '6px 0 12px -4px rgba(0, 0, 0, 0.2)' }}>
                    <div className="p-3 bg-slate-100 rounded-lg border-2 border-slate-400 shadow-lg">
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-slate-700" />
                        <div className="text-sm text-slate-900 font-semibold">Vehicle</div>
                      </div>
                    </div>
                  </div>
                  {orderedServices.map((service, idx) => (
                    <DraggableColumnHeader 
                      key={service} 
                      service={service} 
                      index={idx} 
                      isEditMode={isEditMode}
                      moveColumn={moveColumn}
                    />
                  ))}
                </div>
              </div>

              {/* Vehicle Rows */}
              <div className="space-y-3 pr-6 pb-6 pt-3">
          {orderedVehicles.map((vehicle, vIdx) => {
  // ✅ Use filteredMaintenanceItems instead of maintenanceItems
  const vehicleItems = filteredMaintenanceItems.filter(item => item.vehicle_id === vehicle.id);
  
  return (
    <DraggableVehicleRow
      key={vehicle.id}
      vehicle={vehicle}
      index={vIdx}
      uniqueServices={orderedServices}
      vehicleItems={vehicleItems}  // Now properly filtered by maintenance type!
      isEditMode={isEditMode}
      moveVehicle={moveVehicle}
      getStatusIcon={getStatusIcon}
      getStatusLabel={getStatusLabel}
      openCellDetails={openCellDetails}
      setSelectedROId={setSelectedROId}
      setShowViewROModal={setShowViewROModal}
    />
  );
})}
              </div>
            </div>
          </div>
      </div>
    );
  };

  // Table Content Component
  const TableContent = () => {
    return (
      <div className="overflow-x-auto">{/* Table content will go here */}</div>
    );
  };

  // Main render
  return (
    <DndProvider backend={HTML5Backend}>
    <div className="min-h-full bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl text-slate-900 flex items-center gap-3">
                <CalendarIcon className="w-8 h-8 text-blue-600" />
                Maintenance Schedule
              </h1>
              <p className="text-sm text-slate-600 mt-1">Track and manage scheduled maintenance based on intervals and vehicle data</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  viewMode === 'table'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
                }`}
              >
                <List className="w-4 h-4" />
                Table
              </button>
              <button
                onClick={() => setViewMode('matrix')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  viewMode === 'matrix'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
                }`}
              >
                <Wrench className="w-4 h-4" />
                Matrix
              </button>
              <button
                onClick={fetchMaintenanceData}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-slate-600 border border-slate-300 hover:bg-slate-50 transition-colors disabled:opacity-50"
                title="Refresh data"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 py-6">
        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <RefreshCw className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
              <p className="text-slate-600">Loading maintenance data...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-red-600" />
              <div>
                <p className="text-red-800 font-medium">Failed to load maintenance data</p>
                <p className="text-red-600 text-sm mt-1">{error}</p>
                <button
                  onClick={fetchMaintenanceData}
                  className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content - Only show when not loading */}
        {!loading && !error && (
          <>
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Overdue</p>
                <p className="text-2xl text-red-600">{stats.overdue}</p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Due Soon</p>
                <p className="text-2xl text-orange-600">{stats.dueSoon}</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Good Status</p>
                <p className="text-2xl text-green-600">{stats.good}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
        </div>

        {viewMode === 'table' ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            {/* Toolbar */}
            <div className="p-4 border-b border-slate-200">
              <div className="flex flex-col lg:flex-row gap-4 mb-4">
                {/* Search */}
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by vehicle, service type, or vehicle type..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                        { value: 'overdue', label: 'Overdue' },
                        { value: 'due_soon', label: 'Due Soon' },
                        { value: 'upcoming', label: 'Upcoming' },
                        { value: 'good', label: 'Good' }
                      ]}
                      icon={<Filter className="w-4 h-4" />}
                    />
                  </div>

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
                  </button>

                  <button
                    onClick={() => {
                      fetchMaintenanceData();
                      toast.success('Refreshing maintenance data...');
                    }}
                    disabled={loading}
                    className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Refresh data from server"
                  >
                    <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
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
                <div className="bg-gradient-to-br from-slate-50 to-white rounded-xl border border-slate-200 shadow-sm">
                  {/* Filter Header */}
                  <div className="px-4 py-3 border-b border-slate-200 bg-white rounded-t-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-blue-600" />
                        <h3 className="text-sm font-semibold text-slate-900">Advanced Filters</h3>
                        {(vehicleTypeFilter !== 'all' || selectedVehicleIds.length > 0 || statusFilter !== 'all') && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                            {[
                              vehicleTypeFilter !== 'all' ? 1 : 0,
                              selectedVehicleIds.length,
                              statusFilter !== 'all' ? 1 : 0
                            ].reduce((a, b) => a + b, 0)} active
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          setVehicleTypeFilter('all');
                          setSelectedVehicleIds([]);
                          setStatusFilter('all');
                          setSearchTerm('');
                        }}
                        className="text-xs text-slate-600 hover:text-red-600 font-medium transition-colors flex items-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" />
                        Clear All
                      </button>
                    </div>
                  </div>

                  {/* Filter Controls */}
                  <div className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Vehicle Type Filter */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-2">
                          Vehicle Type
                        </label>
                        <CustomDropdown
                          value={vehicleTypeFilter}
                          onChange={handleVehicleTypeChange}
                          options={[
                            { value: 'all', label: 'All Vehicle Types' },
                            ...uniqueVehicleTypes.map(type => ({ value: type, label: type }))
                          ]}
                          icon={<Truck className="w-4 h-4" />}
                        />
                      </div>

                      {/* Vehicle Multiselect - Cascading Filter */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-2">
                          Select Vehicles
                        </label>
                        <VehicleMultiSelect
                          vehicles={availableVehicles}
                          selectedVehicleIds={selectedVehicleIds}
                          onChange={setSelectedVehicleIds}
                        />
                        {vehicleTypeFilter !== 'all' && (
                          <p className="text-xs text-slate-500 mt-1.5">
                            {availableVehicles.length} vehicle{availableVehicles.length !== 1 ? 's' : ''} available
                          </p>
                        )}
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
                    {(vehicleTypeFilter !== 'all' || selectedVehicleIds.length > 0 || statusFilter !== 'all') && (
                      <div className="mt-4 pt-4 border-t border-slate-200">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-semibold text-slate-700">Active Filters:</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {vehicleTypeFilter !== 'all' && (
                            <span className="px-3 py-1.5 bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 text-xs rounded-lg flex items-center gap-2 border border-blue-200 shadow-sm">
                              <Truck className="w-3.5 h-3.5" />
                              <span className="font-medium">{vehicleTypeFilter}</span>
                              <button
                                onClick={() => handleVehicleTypeChange('all')}
                                className="hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          )}
                          {selectedVehicleIds.length > 0 && selectedVehicleIds.map(vehicleId => {
                            const vehicle = vehicles.find(v => v.id === vehicleId);
                            return vehicle ? (
                              <span key={vehicleId} className="px-3 py-1.5 bg-gradient-to-r from-purple-50 to-purple-100 text-purple-700 text-xs rounded-lg flex items-center gap-2 border border-purple-200 shadow-sm">
                                <Database className="w-3.5 h-3.5" />
                                <span className="font-medium">{vehicle.vehicle_nickname}</span>
                                <button
                                  onClick={() => setSelectedVehicleIds(prev => prev.filter(id => id !== vehicleId))}
                                  className="hover:bg-purple-200 rounded-full p-0.5 transition-colors"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            ) : null;
                          })}
                          {statusFilter !== 'all' && (
                            <span className="px-3 py-1.5 bg-gradient-to-r from-green-50 to-green-100 text-green-700 text-xs rounded-lg flex items-center gap-2 border border-green-200 shadow-sm">
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span className="font-medium">Status: {statusFilter.replace('_', ' ')}</span>
                              <button
                                onClick={() => setStatusFilter('all')}
                                className="hover:bg-green-200 rounded-full p-0.5 transition-colors"
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

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <button
                        onClick={() => handleSort('vehicle_number')}
                        className="flex items-center gap-1 text-sm text-slate-700 hover:text-slate-900 font-medium"
                      >
                        Vehicle
                        {sortField === 'vehicle_number' && (
                          sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <button
                        onClick={() => handleSort('setting_name')}
                        className="flex items-center gap-1 text-sm text-slate-700 hover:text-slate-900 font-medium"
                      >
                        Service Type
                        {sortField === 'setting_name' && (
                          sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-sm text-slate-700 font-medium whitespace-nowrap">Current KM</th>
                    <th className="px-4 py-3 text-left text-sm text-slate-700 font-medium whitespace-nowrap">Progress</th>
                    <th className="px-4 py-3 text-left">
                      <button
                        onClick={() => handleSort('status')}
                        className="flex items-center gap-1 text-sm text-slate-700 hover:text-slate-900 font-medium"
                      >
                        Status
                        {sortField === 'status' && (
                          sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-sm text-slate-700 font-medium whitespace-nowrap">Assigned RO</th>
                    <th className="px-4 py-3 text-center text-sm text-slate-700 font-medium whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {paginatedItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Truck className="w-4 h-4 text-blue-600" />
                          <div>
                            <div className="text-sm text-slate-900 font-medium">{item.vehicle_nickname}</div>
                            <div className="text-xs text-slate-600">{item.vehicle_type}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-slate-900">{item.setting_name}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-slate-900 font-medium">
                          {item.current_km ? item.current_km.toLocaleString() : 'N/A'}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-slate-700">
                          {/* For KMS-based intervals, show Next Service KM */}
                          {(item.interval_type === 'KMS' || item.interval_type === 'BOTH') && item.interval_kms > 0 && (
                            <div className="mb-0.5 font-medium text-slate-900">
                              Next Service: {((item.last_service_km || 0) + item.interval_kms).toLocaleString()} km
                            </div>
                          )}
                          
                          {/* Show days progress for DURATION or BOTH types */}
                          {item.days_from_effective_date_htm !== 'N/A' && (
                            <div className="space-y-0.5">
                              <div className="text-xs text-slate-600">{item.days_from_effective_date_htm}</div>
                              {item.next_service_date && (
                                <div className="text-xs font-medium text-slate-900">
                                  Next: {item.next_service_date}
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* N/A fallback */}
                          {(item.interval_type === 'DURATION' && item.days_from_effective_date_htm === 'N/A') && (
                            <div className="text-slate-400">N/A</div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${getStatusBadge(item.status)}`}>
                            {getStatusIcon(item.status)}
                            {getStatusLabel(item.status)}
                          </span>
                          {item.primary_reason && (
                            <span className="text-xs text-slate-600">
                              Reason: {item.primary_reason}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {item.assigned_ro_number ? (
                          <button
                            onClick={() => {
                              if (item.assigned_ro_id) {
                                setSelectedROId(item.assigned_ro_id);
                                setShowViewROModal(true);
                              }
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded-md text-xs font-medium hover:bg-blue-700 transition-colors"
                          >
                            <FileText className="w-3 h-3" />
                            {item.assigned_ro_number}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">Not assigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => openCellDetails(item)}
                          className="inline-flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {filteredItems.length > 0 && (
              <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between">
                <div className="text-sm text-slate-600">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
                  {Math.min(currentPage * itemsPerPage, filteredItems.length)} of{' '}
                  {filteredItems.length} items
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
            {filteredItems.length === 0 && (
              <div className="p-12 text-center">
                <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                <h3 className="text-lg text-slate-900 font-medium mb-1">No maintenance items found</h3>
                <p className="text-sm text-slate-600 mb-4">
                  Try adjusting your search or filter criteria
                </p>
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('all');
                    setVehicleTypeFilter('all');
                    setSelectedVehicleIds([]);
                  }}
                  className="px-4 py-2 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Matrix View - Regular Mode (only if not fullscreen) */
          !isFullscreen && <MatrixContent />
        )}
        </>
        )}
      </div>

      {/* Fullscreen Matrix Modal */}
      {isFullscreen && (
        <div className="fixed inset-0 bg-slate-900 z-50 flex flex-col">
          <MatrixContent isFullscreenMode={true} />
        </div>
      )}

      {/* Vehicle Details Modal */}
      {showDetailsModal && selectedVehicle && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl text-slate-900 font-medium flex items-center gap-2">
                <Car className="w-6 h-6 text-blue-600" />
                {selectedVehicle.vehicle_nickname} - Maintenance Details
              </h2>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="p-1 hover:bg-slate-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Vehicle Info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 bg-slate-50 rounded-lg">
              <div>
                <p className="text-xs text-slate-600 mb-1">Vehicle Type</p>
                <p className="text-sm text-slate-900 font-medium">{selectedVehicle.vehicle_type}</p>
              </div>
              <div>
                <p className="text-xs text-slate-600 mb-1">Current KM</p>
                <p className="text-sm text-slate-900 font-medium">{selectedVehicle.current_km.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-slate-600 mb-1">Last Service</p>
                <p className="text-sm text-slate-900 font-medium">{formatDate(selectedVehicle.last_service_date)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-600 mb-1">Configuration</p>
                <p className="text-sm text-slate-900 font-medium">{selectedVehicle.configuration_name}</p>
              </div>
            </div>

            {/* Maintenance Items */}
            <div>
              <h3 className="text-sm text-slate-900 font-medium mb-3">All Maintenance Items</h3>
              <div className="space-y-3">
                {maintenanceItems
                  .filter(item => item.vehicle_id === selectedVehicle.id)
                  .map((item) => (
                    <div key={item.id} className="p-4 border border-slate-200 rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h4 className="text-sm text-slate-900 font-medium mb-1">{item.setting_name}</h4>
                          <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                            <div>Interval: {item.interval_kms > 0 && `${item.interval_kms.toLocaleString()} km`} {item.duration_days > 0 && `${item.duration_days} days`}</div>
                            <div>Days Since Service: {item.days_since_service}</div>
                            <div>KM Remaining: {item.km_remaining > 0 ? item.km_remaining.toLocaleString() : 'Overdue'}</div>
                            <div>Days Remaining: {item.days_remaining > 0 ? item.days_remaining : 'Overdue'}</div>
                            {item.next_service_date_estimate !== 'N/A' && (
                              <div className="col-span-2">Next Service: {item.next_service_date_estimate}</div>
                            )}
                          </div>
                        </div>
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${getStatusBadge(item.status)}`}>
                          {getStatusIcon(item.status)}
                          {getStatusLabel(item.status)}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cell Details Modal */}
      {showCellModal && selectedCell && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl text-slate-900 font-medium flex items-center gap-2">
                <Wrench className="w-6 h-6 text-blue-600" />
                {selectedCell.setting_name}
              </h2>
              <button
                onClick={() => setShowCellModal(false)}
                className="p-1 hover:bg-slate-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Status Banner */}
            <div className={`p-4 rounded-lg mb-6 border-2 ${
              selectedCell.status === 'overdue' 
                ? 'bg-red-50 border-red-300' 
                : selectedCell.status === 'due_soon'
                ? 'bg-orange-50 border-orange-300'
                : selectedCell.status === 'upcoming'
                ? 'bg-blue-50 border-blue-300'
                : 'bg-green-50 border-green-300'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${getStatusBadge(selectedCell.status)}`}>
                    {getStatusIcon(selectedCell.status)}
                    {getStatusLabel(selectedCell.status)}
                  </span>
                  {selectedCell.primary_reason && (
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      selectedCell.status === 'overdue' 
                        ? 'bg-red-200 text-red-800' 
                        : selectedCell.status === 'due_soon'
                        ? 'bg-orange-200 text-orange-800'
                        : 'bg-blue-200 text-blue-800'
                    }`}>
                      Primary: {selectedCell.primary_reason}
                    </span>
                  )}
                </div>
                {selectedCell.assigned_ro_number && (
                  <button
                    onClick={() => {
                      if (selectedCell.assigned_ro_id) {
                        setShowCellModal(false);
                        setSelectedROId(selectedCell.assigned_ro_id);
                        setShowViewROModal(true);
                      }
                    }}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    View {selectedCell.assigned_ro_number}
                  </button>
                )}
              </div>
            </div>

            {/* Vehicle Info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 bg-slate-50 rounded-lg">
              <div>
                <p className="text-xs text-slate-600 mb-1">Vehicle</p>
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-blue-600" />
                  <p className="text-sm text-slate-900 font-medium">{selectedCell.vehicle_nickname}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-600 mb-1">Vehicle Type</p>
                <p className="text-sm text-slate-900 font-medium">{selectedCell.vehicle_type}</p>
              </div>
              <div>
                <p className="text-xs text-slate-600 mb-1">Current KM</p>
                <p className="text-sm text-slate-900 font-medium">{selectedCell.current_km.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-slate-600 mb-1">Configuration</p>
                <p className="text-sm text-slate-900 font-medium">{selectedCell.configuration_name}</p>
              </div>
            </div>

            {/* Maintenance Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {/* Interval Information */}
              <div className="p-4 border border-slate-200 rounded-lg bg-white">
                <h3 className="text-sm text-slate-900 font-medium mb-3 flex items-center gap-2">
                  <Settings className="w-4 h-4 text-blue-600" />
                  Maintenance Interval
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Interval Type:</span>
                    <span className="text-slate-900 font-medium">{selectedCell.interval_type}</span>
                  </div>
                  {(selectedCell.interval_type === 'KMS' || selectedCell.interval_type === 'BOTH') && selectedCell.interval_kms > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">KM Interval:</span>
                      <span className="text-slate-900 font-medium">{selectedCell.interval_kms.toLocaleString()} km</span>
                    </div>
                  )}
                  {(selectedCell.interval_type === 'DURATION' || selectedCell.interval_type === 'BOTH') && selectedCell.duration_days > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">Time Interval:</span>
                      <span className="text-slate-900 font-medium">{selectedCell.duration_days} {selectedCell.time_unit?.toLowerCase()}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-600">Last Service Date:</span>
                    <span className="text-slate-900 font-medium">{formatDate(selectedCell.last_service_date)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Last Service KM:</span>
                    <span className={`font-medium ${selectedCell.last_service_km > 0 ? 'text-slate-900' : 'text-red-600'}`}>
                      {selectedCell.last_service_km > 0 ? `${selectedCell.last_service_km.toLocaleString()} km` : '0km'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Progress Information */}
              <div className="p-4 border border-slate-200 rounded-lg bg-white">
                <h3 className="text-sm text-slate-900 font-medium mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                  Current Progress
                </h3>
                <div className="space-y-2 text-sm">
                  {selectedCell.trip_actual_run_kms_htm !== 'N/A' && (
                    <div>
                      <div className="mb-1">
                        <span className="text-slate-600 text-sm">KM Progress:</span>
                        <div className="mt-1 text-xs space-y-0.5">
                          {(() => {
                            // Parse format: "actualKms / intervalKms km"
                            const match = selectedCell.trip_actual_run_kms_htm.match(/^([\d,]+)\s*\/\s*([\d,]+)\s*km$/);
                            if (match) {
                              return (
                                <>
                                  <div className="flex justify-between">
                                    <span className="text-slate-500">Actual KMs traveled:</span>
                                    <span className="text-slate-900 font-medium">{match[1]} km</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-500">Interval threshold:</span>
                                    <span className="text-slate-900 font-medium">{match[2]} km</span>
                                  </div>
                                </>
                              );
                            }
                            return <span className="text-slate-900 font-medium">{selectedCell.trip_actual_run_kms_htm}</span>;
                          })()}
                        </div>
                      </div>
                    </div>
                  )}
                  {selectedCell.days_from_effective_date_htm !== 'N/A' && (
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-slate-600">Time Progress:</span>
                        <span className="text-slate-900 font-medium">{selectedCell.days_from_effective_date_htm}</span>
                      </div>
                      {selectedCell.next_service_date && (
                        <div className="flex justify-between">
                          <span className="text-slate-600">Next Service Date:</span>
                          <span className="text-slate-900 font-bold">{selectedCell.next_service_date}</span>
                        </div>
                      )}
                    </div>
                  )}
                  {selectedCell.assigned_ro_number ? (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                      <div className="flex items-center gap-2 text-blue-800">
                        <FileText className="w-4 h-4" />
                        <span className="text-xs font-medium">Assigned to {selectedCell.assigned_ro_number}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded">
                      <span className="text-xs text-slate-600">Not currently assigned to any Repair Order</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* All Maintenance Items for this Vehicle */}
            <div>
              <h3 className="text-sm text-slate-900 font-medium mb-3 flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                All Maintenance Items for {selectedCell.vehicle_nickname}
              </h3>
              <div className="space-y-2">
                {maintenanceItems
                  .filter(item => item.vehicle_id === selectedCell.vehicle_id)
                  .map((item) => (
                    <div 
                      key={item.id} 
                      className={`p-4 border-2 rounded-lg transition-all ${
                        item.id === selectedCell.id 
                          ? 'border-blue-400 bg-blue-50' 
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="text-sm text-slate-900 font-medium">{item.setting_name}</h4>
                            {item.id === selectedCell.id && (
                              <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full font-medium">Current</span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                            {item.trip_actual_run_kms_htm !== 'N/A' && (
                              <div className="flex items-center gap-1 text-slate-700">
                                <span className="text-slate-500">KMs:</span>
                                <span className="font-medium">{item.trip_actual_run_kms_htm}</span>
                              </div>
                            )}
                            {item.days_from_effective_date_htm !== 'N/A' && (
                              <div className="flex items-center gap-1 text-slate-700">
                                <span className="text-slate-500">Time:</span>
                                <span className="font-medium">{item.days_from_effective_date_htm}</span>
                              </div>
                            )}
                            {item.assigned_ro_number && (
                              <div className="col-span-2 flex items-center gap-1 mt-1">
                                <FileText className="w-3 h-3 text-blue-600" />
                                <button
                                  onClick={() => {
                                    if (item.assigned_ro_id) {
                                      setShowCellModal(false);
                                      setSelectedROId(item.assigned_ro_id);
                                      setShowViewROModal(true);
                                    }
                                  }}
                                  className="text-blue-600 hover:text-blue-700 hover:underline font-medium"
                                >
                                  {item.assigned_ro_number}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${getStatusBadge(item.status)}`}>
                            {getStatusIcon(item.status)}
                            {getStatusLabel(item.status)}
                          </span>
                          {item.primary_reason && (
                            <span className="text-xs text-slate-600">
                              {item.primary_reason}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowCellModal(false)}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Custom View Modal */}
      {showCustomViewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl text-slate-900 font-medium flex items-center gap-2">
                <Save className="w-6 h-6 text-blue-600" />
                {activeCustomView ? 'Update or Save View' : 'Save Custom View'}
              </h2>
              <button
                onClick={() => {
                  setShowCustomViewModal(false);
                  setNewViewName('');
                  setNewViewDescription('');
                  setSetAsDefault(false);
                }}
                className="p-1 hover:bg-slate-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Info message when editing an existing view */}
            {activeCustomView && (
              <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800 font-medium">
                  <strong>Editing:</strong> {customViews.find(v => v.id === activeCustomView)?.name}
                </p>
                <p className="text-xs text-yellow-700 mt-1">
                  Click <strong>"Update View"</strong> to save changes to the current view, or enter a new name and click <strong>"Save as New"</strong> to create a copy.
                </p>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm text-slate-700 font-medium mb-2">
                View Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                placeholder="e.g., Critical School Buses"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                autoFocus
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm text-slate-700 font-medium mb-2">
                Description
              </label>
              <textarea
                value={newViewDescription}
                onChange={(e) => setNewViewDescription(e.target.value)}
                placeholder="Optional description of this view..."
                rows={2}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-xs text-blue-800 mb-2">
                This will save:
              </p>
              <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
                <li>{vehicleOrder.length || vehicles.length} vehicles in custom order</li>
                <li>{columnOrder.length || Array.from(new Set(maintenanceItems.map(i => i.setting_name))).length} maintenance columns</li>
                <li>Current filters (vehicle type, status, selected vehicles)</li>
              </ul>
            </div>

            <div className="mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={setAsDefault}
                  onChange={(e) => setSetAsDefault(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700">Set as default view for all users</span>
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowCustomViewModal(false);
                  setNewViewName('');
                  setNewViewDescription('');
                  setSetAsDefault(false);
                }}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
              >
                Cancel
              </button>
              
              {/* Show Update button if editing an existing view */}
              {activeCustomView && (
                <button
                  onClick={updateCustomView}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                  title="Update the current view with your changes"
                >
                  <Save className="w-4 h-4" />
                  Update View
                </button>
              )}
              
              {/* Save as New button */}
              <button
                onClick={saveCustomView}
                disabled={!newViewName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                title={activeCustomView ? "Save as a new view" : "Save this view"}
              >
                <Save className="w-4 h-4" />
                {activeCustomView ? 'Save as New' : 'Save View'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Custom Views Modal */}
      {showManageViewsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl text-slate-900 font-medium flex items-center gap-2">
                <Settings className="w-6 h-6 text-blue-600" />
                Manage Custom Views
              </h2>
              <button
                onClick={() => setShowManageViewsModal(false)}
                className="p-1 hover:bg-slate-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {customViews.length === 0 ? (
              <div className="text-center py-12">
                <Layers className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-600 mb-2">No custom views saved yet</p>
                <p className="text-sm text-slate-500">Create a custom arrangement and save it to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {customViews.map((view) => (
                  <div
                    key={view.id}
                    className={`p-4 border-2 rounded-lg transition-all ${
                      activeCustomView === view.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-slate-900 font-medium">{view.name}</h3>
                          {activeCustomView === view.id && (
                            <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                              Active
                            </span>
                          )}
                          {view.config?.isDefault && (
                            <span className="px-2 py-0.5 bg-yellow-500 text-white text-xs rounded-full flex items-center gap-1">
                              ⭐ Default
                            </span>
                          )}
                        </div>
                        {view.description && (
                          <p className="text-sm text-slate-600 mb-1">
                            {view.description}
                          </p>
                        )}
                        <p className="text-xs text-slate-600">
                          {view.vehicleOrder.length} vehicles • {view.columnOrder.length} services
                        </p>
                        {view.config?.filters && (
                          <p className="text-xs text-slate-500 mt-1">
                            Filters: {view.config.filters.vehicleTypeFilter !== 'all' ? view.config.filters.vehicleTypeFilter : 'All Types'} • {view.config.filters.statusFilter !== 'all' ? view.config.filters.statusFilter.replace('_', ' ') : 'All Statuses'}
                          </p>
                        )}
                        <p className="text-xs text-slate-400 mt-1">
                          Created: {new Date(view.createdAt).toLocaleDateString('en-CA')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {!view.config?.isDefault && (
                          <button
                            onClick={async () => {
                              try {
                                const response = await fetch(buildApiUrl(`/maintenance-matrix-views/${view.id}/set-default`), {
                                  method: 'POST',
                                  headers: { 'ngrok-skip-browser-warning': 'true' }
                                });
                                if (response.ok) {
                                  toast.success(`"${view.name}" set as default view`);
                                  await fetchMatrixViews();
                                }
                              } catch (err) {
                                toast.error('Failed to set default view');
                              }
                            }}
                            className="px-3 py-1.5 bg-yellow-500 text-white text-sm rounded-lg hover:bg-yellow-600 transition-colors"
                            title="Set as Default"
                          >
                            ⭐ Default
                          </button>
                        )}
                        <button
                          onClick={() => loadCustomView(view.id)}
                          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          Load
                        </button>
                        <button
                          onClick={() => deleteCustomView(view.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete View"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowManageViewsModal(false)}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View RO Modal */}
      {showViewROModal && selectedROId && (
        <ViewRepairOrder
          roId={selectedROId}
          onClose={() => {
            setShowViewROModal(false);
            setSelectedROId(null);
            // Refresh data when RO modal closes in case changes were made
            fetchMaintenanceData();
          }}
          onUpdate={fetchMaintenanceData}
        />
      )}
    </div>
    </DndProvider>
  );
}
