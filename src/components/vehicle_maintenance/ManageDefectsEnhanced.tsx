import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { 
  Search, Filter, RefreshCw, ChevronDown, ChevronUp, 
  X, CheckCircle, AlertTriangle, Clock, XCircle, Eye, Edit2, 
  Plus, TrendingUp, Settings, Calendar, Users, Wrench,
  FileText, DollarSign, PlayCircle, PauseCircle, RotateCcw, Ban,
  Copy, Trash2, Link2, GitMerge, MapPin, Bus,
  Info, HelpCircle, Save, ClipboardList, CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { buildApiUrl, API_ENDPOINTS, apiFetch } from '../../config/api';
import { MultiSelectFilter } from './MultiSelectFilter';
import { VehicleFilter } from './VehicleFilter';
import { DatePicker } from '../../components/ui/date-picker';
import { CreateDefectModalEnhanced } from './CreateDefectModalEnhanced';
import { SingleSelectDropdown } from './SingleSelectDropdown';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, Tag, StickyNote } from 'lucide-react';
import { showConfirmationToast } from '../../utils/confirmationToast';
import { getCurrentUser } from '../../utils/userSession';
import { MaintenanceSchedule } from './MaintenanceSchedule';
import { ManageRO } from './ManageRO';
import { ViewRepairOrder } from './ViewRepairOrder';
import { GarageRepairItemsModal, GarageModalTarget } from './Garagerepairitemsmodal';
// ✅ Customize Garage button color here
const GARAGE_BUTTON_COLOR = '#1e293b'; // Dark Slate - change this to any color you want
// Types
interface Defect {
  id: number;
  vehicle: number;
  vehicle_nickname: string;
  repair_code_category: number | null;
  category_name: string | null;
  repair_desc: string | null;
  notes: string | null;
  issue_date: string;
  reported_by: number;
  fullname: string;
  middlename?: string;
  nickname?: string;
  lastname?: string;
  mechanic?: number;
  mechanicf?: string;
  mechanicm?: string;
  mechanicn?: string;
  mechanicl?: string;
  repair_fixed_on?: string;
  logged_on: string;
  motive_record_id?: string;
  motive_defect_id?: string;
  motive_def_unique_id?: string;
  motive_defect_trigger?: string;
  defect_source: 'motive' | 'skysoft' | 'maintenance' | 'garage';
  estimate?: string;
  linked_to_roid?: number;
  linked_to_ro_items?: string; // ✅ NEW: Tracks RO item link
  related_repair_purchase_order?: number;
  previous_ro_id?: number; // ✅ NEW: Previous RO tracking
  repair_date?: string;
  motive_defect_status?: string;
  motive_inspection_date?: string;
  is_duplicate?: 'y' | 'n';
  merged_records_id?: string;
  manager_status?: string;
  manager_update_date?: string;
  manager_id?: number;
  mgrf?: string;
  mgrm?: string;
  mgrn?: string;
  mgrl?: string;
  defect_status: string | null;
  merged_count?: number;
  primary_defect_id?: number;
  external_status_fetched_at?: string;
  motive_driver_inspection_status?: string;
  motive_driver_signed?: string;
  motive_driver_signed_date?: string;
  invoice_status?: string;
  manager_name?: string;
  issue_type?: string;
  priority?: string;
  scheduled_repair?: string;
  system_triggered_by?: string; // ✅ NEW: System activities triggered_by for maintenance defects
    disengage_reason?: string;      // Deferred, Pending_Parts, Not_Approved, Duplicate, Cancelled
  disengage_notes?: string;       // Notes on why defect was disengaged
  disengaged_at?: string;         // Timestamp when defect was disengaged
  work_order_number: string | null;
}

interface RepairCategory {
  id: number;
  repair_code_category: string;
  repair_category_type: string;
}

interface User {
  id: number;
  fullname: string;
  middlename?: string;
  nickname?: string;
  lastname?: string;
}

interface Vehicle {
  id: number;
  vehicle_nickname: string;
  vehicle_type?: string;
}

interface Filters {
  search: string;
  repair_category: string[];
  reported_by: string[];
  vehicle: string[];
  defect_source: string[];
  defect_status: string[];
  manager_status: string[];
  issue_type: string[];
  date_from: string;
  date_to: string;
}

interface StatusSummary {
  [key: string]: number;
}

const statusMaster = ['Open', 'Reopened', 'In_Progress', 'Repair_Started', 'Paused', 'Pending', 'Completed', 'Repair_Not_Required', 'Rejected', 'RO_Cancelled'];
const managerStatus = ['Approved', 'Rejected']; // ✅ UPDATED: Only show Approved and Rejected
const issueTypes = ['MAJOR', 'MINOR'];


// ✅ Status priority order for sorting (workflow order)
const statusSortOrder: Record<string, number> = {
  'Reopened': 1,
  'Open': 2,
  'In_Progress': 3,
  'Repair_Started': 3.5, // Same priority as In_Progress
  'Repair Started': 3.5, // Handle space variant
  'Pending': 4,
  'Paused': 5,
  'Completed': 6,
  'Repair_Not_Required': 7,
  'Rejected': 8,
  'RO_Cancelled': 9,
  'Ro_Cancelled': 9 // Alias for RO_Cancelled
};

// Status color mapping
const statusColors: Record<string, { bg: string; text: string; icon: any; label: string }> = {
  Open: { bg: 'bg-blue-50', text: 'text-blue-700', icon: AlertTriangle, label: 'Open' },
  Pending: { bg: 'bg-yellow-50', text: 'text-yellow-700', icon: Clock, label: 'Pending' },
  In_Progress: { bg: 'bg-indigo-50', text: 'text-indigo-700', icon: PlayCircle, label: 'In Progress' },
  Repair_Started: { bg: 'bg-indigo-50', text: 'text-indigo-700', icon: PlayCircle, label: 'Repair Started' },
  'Repair Started': { bg: 'bg-indigo-50', text: 'text-indigo-700', icon: PlayCircle, label: 'Repair Started' },
  Completed: { bg: 'bg-green-50', text: 'text-green-700', icon: CheckCircle, label: 'Completed' },
  Rejected: { bg: 'bg-red-50', text: 'text-red-700', icon: XCircle, label: 'Rejected' },
  Paused: { bg: 'bg-gray-50', text: 'text-gray-700', icon: PauseCircle, label: 'Paused' },
  Reopened: { bg: 'bg-orange-50', text: 'text-orange-700', icon: RotateCcw, label: 'Reopened' },
  Repair_Not_Required: { bg: 'bg-slate-50', text: 'text-slate-700', icon: Ban, label: 'Repair Not Required' },
  RO_Cancelled: { bg: 'bg-pink-50', text: 'text-pink-700', icon: XCircle, label: 'RO Cancelled' },
  Ro_Cancelled: { bg: 'bg-pink-50', text: 'text-pink-700', icon: XCircle, label: 'RO Cancelled' },
};

const managerStatusColors: Record<string, { bg: string; text: string }> = {
  Pending_Review: { bg: 'bg-amber-50', text: 'text-amber-700' },
  Approved: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  Not_Submitted: { bg: 'bg-gray-50', text: 'text-gray-700' },
  Rejected: { bg: 'bg-rose-50', text: 'text-rose-700' },
  Reopened: { bg: 'bg-orange-50', text: 'text-orange-700' },
  On_Hold: { bg: 'bg-purple-50', text: 'text-purple-700' },
};

// ✅ Motive Defect Status label mapping
const motiveDefectStatusLabels: Record<string, string> = {
  'no_repair_needed': 'Repair Not Required',
  'repair_needed': 'Repair Needed',
  'unknown': 'Unknown'
};

interface ManageDefectsEnhancedProps {
  onNavigateToCreateRO?: (vehicleId: number, defectIds: string) => void;
  onNavigateToViewRO?: (roId: number) => void;
}

export function ManageDefectsEnhanced({ onNavigateToCreateRO, onNavigateToViewRO }: ManageDefectsEnhancedProps = {}) {
  // Navigation
  const navigate = useNavigate();
  
  // Tab State
  const [activeTab, setActiveTab] = useState<'defects' | 'schedule' | 'manage-ro'>('defects');
  
  // State for passing data to ManageRO tab
  const [roPreselectedVehicleId, setRoPreselectedVehicleId] = useState<number | undefined>(undefined);
  const [roPreselectedDefectIds, setRoPreselectedDefectIds] = useState<string | undefined>(undefined);
  const [editROId, setEditROId] = useState<number | undefined>(undefined); // ✅ NEW: Trigger Edit RO from View RO
  
  // State
  const [defects, setDefects] = useState<Defect[]>([]);
  const [repairCategories, setRepairCategories] = useState<RepairCategory[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDefects, setSelectedDefects] = useState<number[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  
  // Filters - ✅ DEFAULT: Pre-filter 'Open' and 'Reopened' status on page load
  const [filters, setFilters] = useState<Filters>({
    search: '',
    repair_category: [],
    reported_by: [],
    vehicle: [],
    defect_source: [],
    defect_status: ['Open', 'Reopened'], // ✅ Pre-filter Open and Reopened status by default
    manager_status: [],
    issue_type: [],
    date_from: '',
    date_to: ''
  });

  // Pagination
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Sorting - Default sort by defect_status (ASC: Reopened → Open → In Progress → ... → RO Cancelled)
  const [sort, setSort] = useState('defect_status');
  const [order, setOrder] = useState<'ASC' | 'DESC'>('ASC');

  // Status summary
  const [statusSummary, setStatusSummary] = useState<StatusSummary>({});
  const [totalSummary, setTotalSummary] = useState(0);

  // ✅ NEW: Unfiltered status summary for stat cards (always shows total counts)
  const [unfilteredStatusSummary, setUnfilteredStatusSummary] = useState<StatusSummary>({});
  const [unfilteredTotalSummary, setUnfilteredTotalSummary] = useState(0);

  // ✅ Track active status filter from card click (default to 'Open')
  const [activeStatusFilter, setActiveStatusFilter] = useState<string | null>('Open');

  // View Details Modal
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewingDefect, setViewingDefect] = useState<Defect | null>(null);

  // Edit Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingDefect, setEditingDefect] = useState<Defect | null>(null);
  const [editFormData, setEditFormData] = useState({
    category: '',
    desc: '',
    notes: '',
    status: '',
    mechanic: '',
    estimate: '',
    repair_date: '',
    issue_type: '',
    priority: '',
    scheduled_repair: ''
  });
  const [editFormErrors, setEditFormErrors] = useState({
    category: '',
    notes: '',
    status: ''
  });

  // Bulk Actions
  const [bulkActionOpen, setBulkActionOpen] = useState(false);

  // View RO Modal State
  const [viewROId, setViewROId] = useState<number | null>(null);

  // Merge Modal
  const [mergeModalOpen, setMergeModalOpen] = useState(false);

  // ✅ New Garage Repair Items Modal
  const [garageModalDefect, setGarageModalDefect] = useState<GarageModalTarget | null>(null);

  // ✅ NEW: Expandable Garage Disengagement
const [expandedDisengageIds, setExpandedDisengageIds] = useState<Set<number>>(new Set());

const toggleDisengageExpand = (defectId: number) => {
  setExpandedDisengageIds(prev => {
    const newSet = new Set(prev);
    if (newSet.has(defectId)) {
      newSet.delete(defectId);
    } else {
      newSet.add(defectId);
    }
    return newSet;
  });
};
  const [mergeCandidates, setMergeCandidates] = useState<Defect[]>([]);
  const [selectedPrimaryId, setSelectedPrimaryId] = useState<number | null>(null);
  const [mergingDefects, setMergingDefects] = useState(false);

  // ✅ UPDATED: Inline Expandable Merged Group (no modal)
  const [expandedMergeGroup, setExpandedMergeGroup] = useState<string | null>(null);
  const [mergedGroupDefects, setMergedGroupDefects] = useState<Defect[]>([]);
  const [loadingMergedGroup, setLoadingMergedGroup] = useState(false);
  const [selectedUnmergeIds, setSelectedUnmergeIds] = useState<number[]>([]);
  const [unmergingDefects, setUnmergingDefects] = useState(false);

  // Create Defect Modal
  const [createDefectModalOpen, setCreateDefectModalOpen] = useState(false);

  // ✅ NEW: Run Maintenance Defects Modal
  const [runMaintenanceModalOpen, setRunMaintenanceModalOpen] = useState(false);
  const [maintenanceData, setMaintenanceData] = useState<any>(null);
  const [loadingMaintenanceData, setLoadingMaintenanceData] = useState(false);
  const [selectedMaintenanceItems, setSelectedMaintenanceItems] = useState<Set<string>>(new Set());

  // ✅ NEW: Motive Approver Recheck State
  const [recheckingMotiveStatus, setRecheckingMotiveStatus] = useState<{ [key: number]: boolean }>({});

  // ✅ NEW: Pending Status Changes (for Save Checked button)
  const [pendingStatusChanges, setPendingStatusChanges] = useState<{ [key: number]: { defect_status?: string; manager_status?: string } }>({});

  // Fetch data on mount and when filters/pagination change
  useEffect(() => {
    fetchDefects();
  }, [page, perPage, sort, order, filters]);

  // ✅ NEW: Fetch unfiltered summary on mount (for stat cards)
  useEffect(() => {
    fetchUnfilteredSummary();
  }, []);

  useEffect(() => {
    fetchRepairCategories();
    fetchUsers();
    fetchVehicles();
  }, []);

  // ✅ Cascading Filter Effect: Clean up manager status when defect status changes
  useEffect(() => {
    if (filters.defect_status.length > 0) {
      const availableStatuses = getAvailableManagerStatuses(filters.defect_status);
      const filteredManagerStatuses = filters.manager_status.filter(status => 
        availableStatuses.includes(status)
      );
      
      // Only update if there's a difference to avoid infinite loop
      if (filteredManagerStatuses.length !== filters.manager_status.length) {
        setFilters(prev => ({ ...prev, manager_status: filteredManagerStatuses }));
      }
    }
  }, [filters.defect_status.join(',')]); // Use join to avoid reference changes

  const fetchDefects = async () => {
    console.log('🔄 [FETCH DEFECTS] Called with:', { page, perPage, sort, order, filters });
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        per_page: perPage.toString(),
        sort,
        order
      });

      // Add filters
      if (filters.search) params.append('search', filters.search);
      filters.repair_category.forEach(cat => params.append('repair_category[]', cat));
      filters.reported_by.forEach(user => params.append('reported_by[]', user));
      filters.vehicle.forEach(veh => params.append('vehicle[]', veh));
      if (filters.date_from) params.append('date_from', filters.date_from);
      if (filters.date_to) params.append('date_to', filters.date_to);
      
      filters.defect_source.forEach(src => params.append('defect_source[]', src));
      filters.defect_status.forEach(status => params.append('defect_status[]', status));
      filters.manager_status.forEach(status => params.append('manager_status[]', status));
      filters.issue_type.forEach(type => params.append('issue_type[]', type));

      const response = await fetch(buildApiUrl(`${API_ENDPOINTS.defects.base}?${params}`), {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });

      const data = await response.json();
      
      if (data.success) {
        // ✅ Backend now handles defect_status priority sorting via SQL CASE statement
        // Frontend sorting is kept as fallback for client-side flexibility
        let sortedDefects = data.data || [];
        
        sortedDefects = [...sortedDefects].sort((a, b) => {
          // Sort by the selected column only
          let primaryComparison = 0;
          
          if (sort === 'issue_date') {
            const dateA = new Date(a.issue_date).getTime();
            const dateB = new Date(b.issue_date).getTime();
            primaryComparison = order === 'DESC' ? dateB - dateA : dateA - dateB;
          } else if (sort === 'vehicle_number') {
            const numA = parseInt(a.vehicle_number) || 0;
            const numB = parseInt(b.vehicle_number) || 0;
            primaryComparison = order === 'DESC' ? numB - numA : numA - numB;
          } else if (sort === 'defect_id') {
            primaryComparison = order === 'DESC' 
              ? b.defect_id - a.defect_id 
              : a.defect_id - b.defect_id;
          } else if (sort === 'defect_status') {
            const statusA = statusSortOrder[a.defect_status] || 999;
            const statusB = statusSortOrder[b.defect_status] || 999;
            primaryComparison = order === 'DESC' ? statusB - statusA : statusA - statusB;
            
            // ✅ Secondary sort: issue_date DESC (newest first within each status)
            if (primaryComparison === 0) {
              const dateA = new Date(a.issue_date).getTime();
              const dateB = new Date(b.issue_date).getTime();
              primaryComparison = dateB - dateA; // Always DESC for secondary sort
            }
          } else if (sort === 'motive_defect_status') {
            // Handle null/empty values - always show at the end
            const motiveStatusA = a.motive_defect_status;
            const motiveStatusB = b.motive_defect_status;
            const statusA = (motiveStatusA && motiveStatusA.trim()) ? (statusSortOrder[motiveStatusA] || 999) : 9999;
            const statusB = (motiveStatusB && motiveStatusB.trim()) ? (statusSortOrder[motiveStatusB] || 999) : 9999;
            primaryComparison = order === 'DESC' ? statusB - statusA : statusA - statusB;
          } else if (sort === 'manager_status') {
            const managerA = (a.manager_status || '').toLowerCase();
            const managerB = (b.manager_status || '').toLowerCase();
            primaryComparison = order === 'DESC' 
              ? managerB.localeCompare(managerA)
              : managerA.localeCompare(managerB);
          }
          
          return primaryComparison;
        });
        
        setDefects(sortedDefects);
        setTotalRecords(data.total_records || 0);
        setTotalPages(data.total_pages || 1);
        setStatusSummary(data.status_summary || {});
        setTotalSummary(data.total_summary || 0);
      } else {
        toast.error(data.message || 'Failed to fetch defects');
      }
    } catch (error) {
      console.error('Error fetching defects:', error);
      toast.error('Failed to load defects');
    } finally {
      setLoading(false);
    }
  };

  // ✅ NEW: Fetch unfiltered summary (for stat cards that never change)
  const fetchUnfilteredSummary = async () => {
    try {
      // Fetch with NO filters to get total counts
      const params = new URLSearchParams({
        page: '1',
        per_page: '1', // We only need the summary, not the records
        sort: 'id',
        order: 'ASC'
      });

      const response = await fetch(buildApiUrl(`${API_ENDPOINTS.defects.base}?${params.toString()}`), {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      const data = await response.json();

      if (data.success) {
        setUnfilteredStatusSummary(data.status_summary || {});
        setUnfilteredTotalSummary(data.total_summary || 0);
        console.log('📊 [UNFILTERED SUMMARY] Loaded:', {
          total: data.total_summary,
          summary: data.status_summary
        });
      }
    } catch (error) {
      console.error('Error fetching unfiltered summary:', error);
    }
  };

  const fetchRepairCategories = async () => {
    try {
      const response = await fetch(buildApiUrl(`${API_ENDPOINTS.repairCodeCategories.base}?status=1&sortBy=repair_code_category&sortOrder=asc`), {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      const data = await response.json();
      if (data.success) {
        setRepairCategories(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch(buildApiUrl(`${API_ENDPOINTS.users.base}?role=1,2,3,4&status=1`), {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      const data = await response.json();
      if (data.success) {
        setUsers(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchVehicles = async () => {
    try {
      const response = await fetch(buildApiUrl(`${API_ENDPOINTS.vehicles.base}?status=1`), {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      const data = await response.json();
      if (data.success) {
        // ✅ Exclude specific cancellation vehicles from the filter
        const excludedVehicles = [
          'DRIVER SHORTAGE CANCELLATION',
          'Mechanical issue Cancellation',
          'Weather Cancellation'
        ];
        const filteredVehicles = (data.data || []).filter(
          (vehicle: Vehicle) => !excludedVehicles.includes(vehicle.vehicle_nickname)
        );
        setVehicles(filteredVehicles);
      }
    } catch (error) {
      console.error('Error fetching vehicles:', error);
    }
  };

  // ✅ NEW: Fetch Overdue/Due Soon Maintenance Items
  const handleRunMaintenanceDefects = async () => {
    setLoadingMaintenanceData(true);
    setRunMaintenanceModalOpen(true);
    setSelectedMaintenanceItems(new Set()); // Reset selection
    
    try {
      const response = await fetch(buildApiUrl(API_ENDPOINTS.maintenanceOperations.overdueDueSoon), {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setMaintenanceData(data);
        toast.success(`Found ${data.summary.total_items} maintenance items requiring attention`);
      } else {
        toast.error(data.message || 'Failed to fetch maintenance data');
        setRunMaintenanceModalOpen(false);
      }
    } catch (error) {
      console.error('Error fetching maintenance data:', error);
      toast.error('Network error. Please try again.');
      setRunMaintenanceModalOpen(false);
    } finally {
      setLoadingMaintenanceData(false);
    }
  };

  // ✅ Maintenance Item Selection Handlers
  const handleToggleMaintenanceItem = (itemId: string) => {
    setSelectedMaintenanceItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const handleSelectAllOverdue = () => {
    if (!maintenanceData?.data?.overdue) return;
    const allOverdueIds = maintenanceData.data.overdue.map((item: any, idx: number) => `overdue-${idx}`);
    setSelectedMaintenanceItems(prev => {
      const newSet = new Set(prev);
      allOverdueIds.forEach((id: string) => newSet.add(id));
      return newSet;
    });
  };

  const handleDeselectAllOverdue = () => {
    if (!maintenanceData?.data?.overdue) return;
    const allOverdueIds = maintenanceData.data.overdue.map((item: any, idx: number) => `overdue-${idx}`);
    setSelectedMaintenanceItems(prev => {
      const newSet = new Set(prev);
      allOverdueIds.forEach((id: string) => newSet.delete(id));
      return newSet;
    });
  };

  const handleSelectAllDueSoon = () => {
    if (!maintenanceData?.data?.due_soon) return;
    const allDueSoonIds = maintenanceData.data.due_soon.map((item: any, idx: number) => `due_soon-${idx}`);
    setSelectedMaintenanceItems(prev => {
      const newSet = new Set(prev);
      allDueSoonIds.forEach((id: string) => newSet.add(id));
      return newSet;
    });
  };

  const handleDeselectAllDueSoon = () => {
    if (!maintenanceData?.data?.due_soon) return;
    const allDueSoonIds = maintenanceData.data.due_soon.map((item: any, idx: number) => `due_soon-${idx}`);
    setSelectedMaintenanceItems(prev => {
      const newSet = new Set(prev);
      allDueSoonIds.forEach((id: string) => newSet.delete(id));
      return newSet;
    });
  };

  // ✅ NEW: Create Defects from Selected Maintenance Items
  const handleCreateMaintenanceDefects = async () => {
    if (selectedMaintenanceItems.size === 0) {
      toast.error('No items selected', {
        description: 'Please select at least one maintenance item to create defects'
      });
      return;
    }

    // Map selected item IDs back to actual maintenance data
    const selectedItems: any[] = [];
    
    selectedMaintenanceItems.forEach(itemId => {
      const [type, indexStr] = itemId.split('-');
      const index = parseInt(indexStr);
      
      if (type === 'overdue' && maintenanceData?.data?.overdue?.[index]) {
        selectedItems.push(maintenanceData.data.overdue[index]);
      } else if (type === 'due_soon' && maintenanceData?.data?.due_soon?.[index]) {
        selectedItems.push(maintenanceData.data.due_soon[index]);
      }
    });

    if (selectedItems.length === 0) {
      toast.error('Failed to process selection', {
        description: 'Could not find selected items'
      });
      return;
    }

    // ✅ NEW VALIDATION: Check for missing required data based on interval_type
    const invalidItems: any[] = [];
    
    selectedItems.forEach(item => {
      const intervalType = item.interval_type?.toUpperCase();
      const missingFields: string[] = [];
      
      // Check KMS-based requirements
      if (intervalType === 'KMS' || intervalType === 'BOTH') {
        if (item.last_replaced_km === null || item.last_replaced_km === undefined || item.last_replaced_km === '' || item.last_replaced_km === 0) {
          missingFields.push('Last Replaced KM (cannot be 0)');
        }
      }
      
      // Check DURATION-based requirements
      if (intervalType === 'DURATION' || intervalType === 'BOTH') {
        if (!item.last_maintenance_date || item.last_maintenance_date === null || item.last_maintenance_date === '') {
          missingFields.push('Last Maintenance Date');
        }
      }
      
      if (missingFields.length > 0) {
        invalidItems.push({
          vehicle: item.vehicle_nickname || item.vehicle_number,
          service: item.setting_name,
          missing: missingFields.join(', ')
        });
      }
    });

    // Show error if there are items with missing data
    if (invalidItems.length > 0) {
      const errorMessage = invalidItems
        .map(item => `• ${item.vehicle} - ${item.service}: Missing ${item.missing}`)
        .join('\n');
      
      toast.error('Cannot Create Defects - Missing Required Data', {
        description: `The following items cannot be processed:\n\n${errorMessage}\n\nPlease update maintenance records with the required values.`,
        duration: 8000
      });
      return; // Don't close modal, don't proceed
    }

    try {
      console.log('🔧 Creating defects for selected maintenance items:', selectedItems);

      const response = await apiFetch(API_ENDPOINTS.maintenanceOperations.createDefects, {
        method: 'POST',
        body: JSON.stringify({
          selectedItems: selectedItems
        })
      });

      if (response.success) {
        const { created_count, skipped_count, skipped_duplicates } = response;
        
        // ✅ Show detailed duplicate information if any exist
        if (skipped_count > 0 && skipped_duplicates && skipped_duplicates.length > 0) {
          const duplicateList = skipped_duplicates
            .map((dup: any) => `• ${dup.vehicle_nickname || dup.vehicle_id} - ${dup.setting_name} (Defect #${dup.existing_defect_id} - ${dup.existing_status})`)
            .join('\n');
          
          if (created_count > 0) {
            toast.warning(`Created ${created_count} defect${created_count !== 1 ? 's' : ''}, Skipped ${skipped_count} duplicate${skipped_count !== 1 ? 's' : ''}`, {
              description: `The following already have active defects:\n\n${duplicateList}`,
              duration: 8000
            });
          } else {
            toast.error('No Defects Created - All Items Already Exist', {
              description: `The following already have active defects:\n\n${duplicateList}`,
              duration: 8000
            });
            return; // Don't close modal if nothing was created
          }
        } else if (created_count > 0) {
          toast.success(`Successfully created ${created_count} defect${created_count !== 1 ? 's' : ''}!`, {
            description: 'Defects are now visible in the Manage All Defects table'
          });
        } else {
          toast.warning('No defects created', {
            description: 'All selected items already have active defects'
          });
          return; // Don't close modal
        }

        // Close modal and refresh defects ONLY if something was created
        setRunMaintenanceModalOpen(false);
        setMaintenanceData(null);
        setSelectedMaintenanceItems(new Set());
        
        // Refresh defects table
        fetchDefects();
        fetchUnfilteredSummary();
        
      } else {
        toast.error('Failed to create defects', {
          description: response.message || 'An error occurred'
        });
        // Don't close modal on error
      }
    } catch (error) {
      console.error('❌ Error creating maintenance defects:', error);
      toast.error('Network Error', {
        description: error instanceof Error ? error.message : 'Failed to connect to server'
      });
      // Don't close modal on error
    }
  };

  const handleApplyFilters = () => {
    // Validate date range before applying filters
    if (filters.date_from && filters.date_to && filters.date_to < filters.date_from) {
      toast.error('Date To cannot be before Date From. Please correct the date range.');
      return;
    }
    
    setPage(1);
    fetchDefects();
  };

  const handleResetFilters = () => {
    setFilters({
      search: '',
      repair_category: [],
      reported_by: [],
      vehicle: [],
      defect_source: [],
      defect_status: [],
      manager_status: [],
      issue_type: [],
      date_from: '',
      date_to: ''
    });
    setPage(1);
    // Reset sort to default (defect_status ASC)
    setSort('defect_status');
    setOrder('ASC');
    // Auto-apply after reset
    setTimeout(() => fetchDefects(), 0);
  };

  // ✅ Comprehensive Refresh: Resets filters AND refetches all data including summary cards
  const handleRefresh = () => {
    // Reset filters to initial state
    setFilters({
      search: '',
      repair_category: [],
      reported_by: [],
      vehicle: [],
      defect_source: [],
      defect_status: [],
      manager_status: [],
      issue_type: [],
      date_from: '',
      date_to: ''
    });
    // Reset pagination
    setPage(1);
    // Reset sort to default (defect_status ASC)
    setSort('defect_status');
    setOrder('ASC');
    // Clear pending changes
    setPendingStatusChanges({});
    // Clear selections
    setSelectedDefects([]);
    setActiveStatusFilter(null);
    // Refetch all data (including summary cards)
    fetchDefects();
    fetchUnfilteredSummary(); // ✅ Also refresh the unfiltered totals
    toast.success('Data refreshed successfully');
  };

  const handleSort = (column: string) => {
    if (sort === column) {
      setOrder(order === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSort(column);
      setOrder('DESC');
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      // ✅ UPDATED: Allow Reopened defects to be selected even if previously approved
      const selectableDefects = defects
        .filter(d => d.is_duplicate !== 'y' && 
                    (d.manager_status !== 'Approved' || d.defect_status === 'Reopened'))
        .map(d => d.id);
      setSelectedDefects(selectableDefects);
    } else {
      setSelectedDefects([]);
    }
  };

  const handleSelectDefect = (id: number) => {
    setSelectedDefects(prev =>
      prev.includes(id) ? prev.filter(did => did !== id) : [...prev, id]
    );
  };

  // ✅ UPDATED: Store status change locally (don't save immediately)
  const handleStatusChange = (defectId: number, newStatus: string) => {
    setPendingStatusChanges(prev => ({
      ...prev,
      [defectId]: {
        ...prev[defectId],
        defect_status: newStatus
      }
    }));
  };

  const handleBulkStatusChange = async (newStatus: string) => {
    if (selectedDefects.length === 0) {
      toast.error('Please select defects first');
      return;
    }

    const confirmMsg = `Update ${selectedDefects.length} defect(s) to ${statusColors[newStatus]?.label || newStatus}?`;
    if (!confirm(confirmMsg)) return;

    try {
      const promises = selectedDefects.map(id =>
        fetch(buildApiUrl(`${API_ENDPOINTS.defects.byId(id)}/status`), {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true'
          },
          body: JSON.stringify({ defect_status: newStatus })
        })
      );

      await Promise.all(promises);
      toast.success(`${selectedDefects.length} defect(s) updated successfully`);
      setSelectedDefects([]);
      fetchDefects();
      fetchUnfilteredSummary(); // ✅ Refresh stat cards
    } catch (error) {
      console.error('Error bulk updating:', error);
      toast.error('Failed to update defects');
    }
  };

  const handleCreateRO = () => {
    if (selectedDefects.length === 0) {
      toast.error('Please select at least one defect');
      return;
    }

    // ✅ VALIDATE: Check if any selected defect already has an RO created
    const defectsWithRO: string[] = [];
    selectedDefects.forEach(defectId => {
      const defect = defects.find(d => d.id === defectId);
      if (defect && defect.linked_to_roid) {
        defectsWithRO.push(`Defect #${defectId} (RO #${defect.linked_to_roid})`);
      }
    });

    if (defectsWithRO.length > 0) {
      toast.error(
        `One or more selected defects already have a Repair Order created.\n\n` +
        `Defects with existing RO:\n${defectsWithRO.join('\n')}`,
        { duration: 6000 }
      );
      return;
    }

    // ✅ VALIDATE: Only allow Open, Reopened, Ro_Cancelled defects (matching PHP logic)
  const allowedStatuses = ['Open', 'Reopened', 'RO_Cancelled'];
    const invalidDefects: string[] = [];
    
    selectedDefects.forEach(defectId => {
      const defect = defects.find(d => d.id === defectId);
      if (defect && defect.defect_status && !allowedStatuses.includes(defect.defect_status)) {
        invalidDefects.push(`Defect #${defectId} (Status: ${defect.defect_status})`);
      }
    });
    
    if (invalidDefects.length > 0) {
      toast.error(
        `Only defects with status "Open", "Reopened", or "Ro_Cancelled" can be used to create an RO.\n\n` +
        `Invalid selections:\n${invalidDefects.join('\n')}`,
        { duration: 6000 }
      );
      return;
    }

    // ✅ VALIDATE: Check same vehicle unit (matching PHP client-side validation)
    const vehicleUnits = new Set<number>();
    selectedDefects.forEach(defectId => {
      const defect = defects.find(d => d.id === defectId);
      if (defect) {
        vehicleUnits.add(defect.vehicle);
      }
    });
    
    if (vehicleUnits.size > 1) {
      toast.error('RO can only be created for defects belonging to the same vehicle unit.');
      return;
    }

    // ✅ Get the vehicle ID for the redirect
    const firstDefect = defects.find(d => d.id === selectedDefects[0]);
    if (!firstDefect) {
      toast.error('Error: Could not find defect details');
      return;
    }

    const defectIds = selectedDefects.join(',');
    const vehicleId = firstDefect.vehicle;
    
    // Set preselected data for ManageRO and switch to that tab
    setRoPreselectedVehicleId(vehicleId);
    setRoPreselectedDefectIds(defectIds);
    setActiveTab('manage-ro');
   //toast.success('Opening Create RO with selected defects...', { 
  //position: "bottom-left" 
//});
  };

  const handleSaveChecked = async () => {
    if (selectedDefects.length === 0) {
      toast.error('Please select defects first');
      return;
    }

    const confirmMsg = `Save ${selectedDefects.length} selected defect(s)?`;
    if (!confirm(confirmMsg)) return;

    await handleBulkStatusChange('Approved');
  };

  const handleRepairNotNeeded = async () => {
    if (selectedDefects.length === 0) {
      toast.error('Please select defects first');
      return;
    }

    // ✅ NEW VALIDATION: Check for maintenance records
    const selectedDefectObjects = defects.filter(d => selectedDefects.includes(d.id));
    const maintenanceDefects = selectedDefectObjects.filter(d => d.defect_source === 'maintenance');
    
    if (maintenanceDefects.length > 0) {
      const defectsList = maintenanceDefects.map(d => `#${d.id}`).join(', ');
      toast.error(
        `Maintenance records cannot be marked as "Repair Not Needed". Maintenance must be completed.\n\nMaintenance defects: ${defectsList}`,
        { duration: 6000 }
      );
      return;
    }

    // ✅ VALIDATION 1: Check RO links (both columns must be NULL/empty)
    const defectsWithRoLinks = selectedDefectObjects.filter(d => 
      (d.linked_to_ro_items && typeof d.linked_to_ro_items === 'string' && d.linked_to_ro_items.trim() !== '') || 
      (d.related_repair_purchase_order !== null && d.related_repair_purchase_order !== undefined)
    );
    
    if (defectsWithRoLinks.length > 0) {
      const defectsList = defectsWithRoLinks.map(d => `#${d.id}`).join(', ');
      toast.error(
        `Cannot mark as Repair Not Required. The following defects are linked to a Repair Order: ${defectsList}`,
        { duration: 5000 }
      );
      return;
    }

    // ✅ VALIDATION 2: Check Motive defects have motive_defect_id
    const motiveDefectsWithoutId = selectedDefectObjects.filter(d => 
      d.defect_source === 'motive' && (!d.motive_defect_id || (typeof d.motive_defect_id === 'string' && d.motive_defect_id.trim() === ''))
    );
    
    if (motiveDefectsWithoutId.length > 0) {
      const defectsList = motiveDefectsWithoutId.map(d => `#${d.id}`).join(', ');
      toast.error(
        `Motive defects are missing Motive ID and cannot be synced: ${defectsList}`,
        { duration: 5000 }
      );
      return;
    }

    // ✅ CONFIRMATION
    const hasMotiveDefects = selectedDefectObjects.some(d => d.defect_source === 'motive');
    
    showConfirmationToast({
      title: `Mark ${selectedDefects.length} defect(s) as Repair Not Required?`,
      message: hasMotiveDefects 
        ? 'This will automatically approve them and sync with Motive.'
        : 'This will automatically approve them.',
      confirmText: 'Confirm',
      cancelText: 'Cancel',
      variant: 'default',
      onConfirm: async () => {
        // ✅ FETCH CURRENT USER SESSION
        const currentUser = await getCurrentUser();
        
        if (!currentUser) {
          toast.error('Unable to fetch user session. Please refresh and try again.');
          return;
        }

        console.log('👤 [REPAIR-NOT-NEEDED] Current user:', currentUser);

        // ✅ CALL NEW ENDPOINT WITH USER INFO
        try {
          const response = await fetch(buildApiUrl(`${API_ENDPOINTS.defects.base}/bulk-repair-not-required`), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify({
              defect_ids: selectedDefects,
              manager_id: currentUser.id,
              manager_name: currentUser.username
            })
          });

          const data = await response.json();

          if (data.success) {
            let message = `Successfully marked ${data.updated_count || selectedDefects.length} defect(s) as Repair Not Required`;
            
            if (data.motive_synced > 0) {
              message += ` (${data.motive_synced} synced with Motive)`;
            }
            
            if (data.motive_failed > 0) {
              toast.warning(`${message}

⚠️ ${data.motive_failed} Motive sync(s) failed. Check logs.`, { duration: 6000 });
            } else {
              toast.success(message);
            }
            
            setSelectedDefects([]);
            fetchDefects();
          } else {
            toast.error(data.message || 'Failed to mark defects as Repair Not Required');
          }
        } catch (error) {
          console.error('Error marking defects as Repair Not Required:', error);
          toast.error('Network error. Please try again.');
        }
      }
    });
  };

  const handleMergeSelected = () => {
    if (selectedDefects.length < 2) {
      toast.error('Please select at least 2 defects to merge');
      return;
    }

    // ✅ VALIDATION: Check all selected defects are from same vehicle
    const selectedDefectObjects = defects.filter(d => selectedDefects.includes(d.id));
    
    // ✅ NEW VALIDATION: Check for maintenance records
    const maintenanceDefects = selectedDefectObjects.filter(d => d.defect_source === 'maintenance');
    
    if (maintenanceDefects.length > 0) {
      const defectsList = maintenanceDefects.map(d => `#${d.id}`).join(', ');
      toast.error(
        `Maintenance records cannot be merged with other defects.\n\nMaintenance defects: ${defectsList}`,
        { duration: 6000 }
      );
      return;
    }
    
    const vehicleIds = new Set(selectedDefectObjects.map(d => d.vehicle));
    
    if (vehicleIds.size > 1) {
      toast.error('All selected defects must belong to the same vehicle to merge');
      return;
    }
// ✅ VALIDATION: "24-Other" defects are exempt — skip them, then check remaining all match
const nonOtherDefects = selectedDefectObjects.filter(d => {
  const category = repairCategories.find(rc => rc.id === d.repair_code_category);
  return category?.repair_code_category !== '24-Other' && !category?.repair_code_category?.includes('24-Other');
});

const nonOtherCategories = new Set(nonOtherDefects.map(d => {
  const category = repairCategories.find(rc => rc.id === d.repair_code_category);
  return category?.repair_code_category;
}));

if (nonOtherCategories.size > 1) {
  const categoryList = nonOtherDefects
    .map(d => `#${d.id} (${repairCategories.find(rc => rc.id === d.repair_code_category)?.repair_code_category || 'Unknown'})`)
    .join(', ');

  toast.error(
    `All defects must have the same repair category to merge. ("24-Other" defects are exempt)\n\nConflicting defects: ${categoryList}`,
    { duration: 6000 }
  );
  return;
}
    // ✅ SIMPLIFIED LOGIC: Always let user choose primary freely
    const alreadyMerged = selectedDefectObjects.filter(d => 
      d.merged_records_id && d.merged_records_id.trim() !== ''
    );
    const newDefects = selectedDefectObjects.filter(d => 
      !d.merged_records_id || d.merged_records_id.trim() === ''
    );

    // Case 1: ALL defects are already merged → Block (nothing to do)
    if (alreadyMerged.length > 0 && newDefects.length === 0) {
      toast.error('All selected defects are already merged. Please select at least one new defect to add to the merge group.');
      return;
    }

    // Case 2: Check if defects from DIFFERENT merge groups
    if (alreadyMerged.length > 0) {
      const mergeGroups = new Set(alreadyMerged.map(d => d.merged_records_id));
      if (mergeGroups.size > 1) {
        toast.error('Cannot merge defects from different merge groups. Please select defects from only one existing merge group.');
        return;
      }
    }

    // ✅ Let user freely choose primary (no auto-selection)
    setMergeCandidates(selectedDefectObjects);
    setSelectedPrimaryId(selectedDefectObjects[0].id); // Default to first
    setMergeModalOpen(true);
  };

  const handleConfirmMerge = async () => {
    if (!selectedPrimaryId) {
      toast.error('Please select a primary defect');
      return;
    }

    const secondaryIds = mergeCandidates
      .filter(d => d.id !== selectedPrimaryId)
      .map(d => d.id);

    setMergingDefects(true);

    try {
      const response = await fetch(buildApiUrl(`${API_ENDPOINTS.defects.base}/merge`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({
          primary_defect_id: selectedPrimaryId,
          secondary_defect_ids: secondaryIds
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success(`Successfully merged ${data.total_defects_in_group} defects into group ${data.merge_id}`);
        setMergeModalOpen(false);
        setMergeCandidates([]);
        setSelectedPrimaryId(null);
        setSelectedDefects([]);
        fetchDefects(); // Refresh list
        fetchUnfilteredSummary(); // ✅ Refresh stat cards after merge
      } else {
        toast.error(data.message || 'Failed to merge defects');
      }
    } catch (error) {
      console.error('Error merging defects:', error);
      toast.error('Failed to merge defects');
    } finally {
      setMergingDefects(false);
    }
  };

  const handleViewMergedGroup = async (mergeId: string) => {
    // Toggle expansion
    if (expandedMergeGroup === mergeId) {
      setExpandedMergeGroup(null);
      setMergedGroupDefects([]);
      setSelectedUnmergeIds([]);
      return;
    }

    setExpandedMergeGroup(mergeId);
    setLoadingMergedGroup(true);
    setSelectedUnmergeIds([]);

    try {
      const response = await fetch(buildApiUrl(`${API_ENDPOINTS.defects.base}/merged-group/${mergeId}`), {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });

      const data = await response.json();

      if (data.success) {
        setMergedGroupDefects(data.all_defects || []);
      } else {
        toast.error(data.message || 'Failed to load merged group');
        setExpandedMergeGroup(null);
      }
    } catch (error) {
      console.error('Error loading merged group:', error);
      toast.error('Failed to load merged group');
      setExpandedMergeGroup(null);
    } finally {
      setLoadingMergedGroup(false);
    }
  };

  const handleUnmergeDefects = async (unmergeAll: boolean = false, specificDefectIds?: number[]) => {
    // If specific defect IDs are provided, use those; otherwise check selected IDs
    const idsToUnmerge = specificDefectIds || selectedUnmergeIds;
    
    if (!unmergeAll && idsToUnmerge.length === 0) {
      toast.error('Please select defects to unmerge');
      return;
    }

    // ✅ VALIDATE: Check if any defects have restricted statuses
    const restrictedStatuses = ['Completed', 'Repair_Not_Required', 'Repair_Not_Needed', 'Approved'];
    const defectsToUnmerge = unmergeAll 
      ? mergedGroupDefects.filter(d => d.is_duplicate !== 'n') // Exclude primary when unmerging all
      : mergedGroupDefects.filter(d => idsToUnmerge.includes(d.id));
    
    const restrictedDefects = defectsToUnmerge.filter(d => restrictedStatuses.includes(d.defect_status || ''));
    
    if (restrictedDefects.length > 0) {
      toast.error(
        `Cannot unmerge defects with "Completed", "Repair Not Needed", or "Approved" status.\n\n` +
        `Restricted defects: ${restrictedDefects.map(d => `#${d.id} (${d.defect_status})`).join(', ')}`,
        { duration: 6000 }
      );
      return;
    }

    const confirmMsg = unmergeAll 
      ? `Unmerge all ${defectsToUnmerge.length} defects in this group?`
      : specificDefectIds 
        ? `Unmerge defect #${specificDefectIds[0]}?`
        : `Unmerge ${idsToUnmerge.length} selected defect(s)?`;
    
    // Use toast confirmation instead of window.confirm
    showConfirmationToast({
      message: confirmMsg,
      onConfirm: async () => {
        setUnmergingDefects(true);

        try {
          const response = await fetch(buildApiUrl(`${API_ENDPOINTS.defects.base}/unmerge`), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify({
              defect_ids: unmergeAll ? mergedGroupDefects.filter(d => d.is_duplicate !== 'n').map(d => d.id) : idsToUnmerge,
              unmerge_all: unmergeAll
            })
          });

          const data = await response.json();

          if (data.success) {
            toast.success(`Successfully unmerged ${data.unmerged_count} defect(s)`);
            setExpandedMergeGroup(null);
            setMergedGroupDefects([]);
            setSelectedUnmergeIds([]);
            fetchDefects(); // Refresh list
            fetchUnfilteredSummary(); // ✅ Refresh stat cards after unmerge
          } else {
            toast.error(data.message || 'Failed to unmerge defects');
          }
        } catch (error) {
          console.error('Error unmerging defects:', error);
          toast.error('Failed to unmerge defects');
        } finally {
          setUnmergingDefects(false);
        }
      }
    });
  };

  const handleToggleUnmergeSelection = (defectId: number) => {
    setSelectedUnmergeIds(prev => 
      prev.includes(defectId) 
        ? prev.filter(id => id !== defectId)
        : [...prev, defectId]
    );
  };

  const handleViewDetails = (defect: Defect) => {
    setViewingDefect(defect);
    setViewModalOpen(true);
  };

  const handleViewRO = (roId: number) => {
    // Open View RO modal directly in this component
    setViewROId(roId);
  };

  const handleEditROFromView = (roId: number) => {
    // Close View RO modal
    setViewROId(null);
    
    // Switch to ManageRO tab and trigger Edit RO
    setActiveTab('manage-ro');
    setEditROId(roId);
    
    toast.info(`Opening Edit RO for RO #${roId}...`, { duration: 2000 });
  };

  const handleEditDefect = (defect: Defect) => {
    setEditingDefect(defect);
    setEditFormData({
      category: defect.repair_code_category?.toString() || '',
      desc: defect.repair_desc || '',
      notes: defect.notes || '',
      status: defect.defect_status || '',
      mechanic: defect.mechanic?.toString() || '',
      estimate: defect.estimate || '',
      repair_date: defect.repair_date || '',
      issue_type: defect.issue_type || '',
      priority: defect.priority || '',
      scheduled_repair: defect.scheduled_repair || ''
    });
    setEditFormErrors({
      category: '',
      notes: '',
      status: ''
    });
    setEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingDefect) return;

    // Validate form
    const errors = {
      category: '',
      notes: '',
      status: ''
    };

    let hasErrors = false;

    // Validate category
    if (!editFormData.category || editFormData.category === '') {
      errors.category = 'Repair category is required';
      hasErrors = true;
    }

    // Validate notes (Issue)
    if (!editFormData.notes || editFormData.notes.trim() === '') {
      errors.notes = 'Issue is required';
      hasErrors = true;
    }

    // Validate status
    if (!editFormData.status || editFormData.status === '') {
      errors.status = 'Status is required';
      hasErrors = true;
    }

    setEditFormErrors(errors);

    if (hasErrors) {
      toast.error('Please fix the validation errors before saving', {
        description: 'All required fields must be filled out'
      });
      return;
    }

    try {
      console.log('🔧 Saving defect edit:', editingDefect.id);
      console.log('📝 Edit form data:', editFormData);
      
      const response = await fetch(buildApiUrl(API_ENDPOINTS.defects.save(editingDefect.id)), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({
          repair_code_category: editFormData.category,
          repair_desc: editFormData.desc,
          notes: editFormData.notes,
          defect_status: editFormData.status,
          issue_type: editFormData.issue_type
          // TEMPORARILY REMOVED: mechanic, estimate, priority, scheduled_repair, repair_date
          // Will be re-added after core edit functionality is tested
        })
      });

      console.log('📡 Response status:', response.status);
      const data = await response.json();
      console.log('📦 Response data:', data);

      if (data.success) {
        toast.success('Defect updated successfully');
        setEditModalOpen(false);
        fetchDefects();
        fetchUnfilteredSummary(); // ✅ Refresh stat cards
      } else {
        toast.error(data.message || 'Failed to update defect');
      }
    } catch (error) {
      console.error('❌ Error updating defect:', error);
      toast.error('Failed to update defect');
    }
  };

  // ✅ Cascading Filter Logic: Calculate available Manager Statuses based on selected Defect Statuses
  const getAvailableManagerStatuses = (defectStatuses: string[] = filters.defect_status) => {
    // If no defect status filter is applied, show all manager statuses
    if (defectStatuses.length === 0) {
      return managerStatus;
    }

    const activeStatuses = ['Open', 'Reopened', 'In_Progress', 'Paused', 'Pending'];
    const completedStatuses = ['Completed', 'Repair_Not_Required'];
    const rejectedStatuses = ['Rejected', 'RO_Cancelled'];

    const hasActiveStatus = defectStatuses.some(status => activeStatuses.includes(status));
    const hasCompletedStatus = defectStatuses.some(status => completedStatuses.includes(status));
    const hasRejectedStatus = defectStatuses.some(status => rejectedStatuses.includes(status));

    let availableStatuses: string[] = [];

    // Active defects: Can only have Pending_Review, Not_Submitted, On_Hold
    if (hasActiveStatus) {
      availableStatuses.push('Pending_Review', 'Not_Submitted', 'On_Hold');
    }

    // Completed/Repair Not Required: Can have Approved, Rejected, Pending_Review
    if (hasCompletedStatus) {
      availableStatuses.push('Approved', 'Rejected', 'Pending_Review', 'Reopened');
    }

    // Rejected/Cancelled: Can have Rejected, Not_Submitted
    if (hasRejectedStatus) {
      availableStatuses.push('Rejected', 'Not_Submitted');
    }

    // Remove duplicates and sort to match original order
    const uniqueStatuses = Array.from(new Set(availableStatuses));
    return managerStatus.filter(status => uniqueStatuses.includes(status));
  };

  const formatUserName = (user: Partial<User>) => {
    if (user.nickname) return user.nickname;
    const parts = [user.fullname, user.middlename, user.lastname].filter(Boolean);
    return parts.join(' ');
  };

  const formatDefectUserName = (defect: Defect, type: 'reporter' | 'mechanic' | 'manager') => {
    if (type === 'reporter') {
      // ✅ For maintenance defects, use system_triggered_by from system_activities
      if (defect.defect_source === 'maintenance' && defect.system_triggered_by) {
        return defect.system_triggered_by;
      }
      if (defect.nickname) return defect.nickname;
      const parts = [defect.fullname, defect.middlename, defect.lastname].filter(Boolean);
      return parts.join(' ');
    } else if (type === 'mechanic') {
      if (defect.mechanicn) return defect.mechanicn;
      const parts = [defect.mechanicf, defect.mechanicm, defect.mechanicl].filter(Boolean);
      return parts.join(' ') || 'Not Assigned';
    } else {
      if (defect.mgrn) return defect.mgrn;
      const parts = [defect.mgrf, defect.mgrm, defect.mgrl].filter(Boolean);
      return parts.join(' ') || 'Not Assigned';
    }
  };

  const formatCurrency = (amount: string | undefined) => {
    if (!amount) return '$0.00';
    return `$${parseFloat(amount).toFixed(2)}`;
  };

  // Format ISO date to YYYY-MM-DD
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '';
    // If already in YYYY-MM-DD format, return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return dateString;
    // If ISO format, extract date part
    if (dateString.includes('T')) {
      return dateString.split('T')[0];
    }
    return dateString;
  };

  // ✅ UPDATED: Store manager status change locally (don't save immediately)
  const handleManagerStatusChange = (defectId: number, newManagerStatus: string) => {
    setPendingStatusChanges(prev => ({
      ...prev,
      [defectId]: {
        ...prev[defectId],
        manager_status: newManagerStatus
      }
    }));
  };

  // ✅ NEW: Save Checked Defects (Batch Update Status Changes)
  const handleSaveCheckedStatuses = async () => {
    // Get defects that are both selected AND have pending changes
    const defectsToUpdate = selectedDefects.filter(id => pendingStatusChanges[id]);
    
    if (defectsToUpdate.length === 0) {
      toast.error('No status changes to save. Please select defects and change their status first.');
      return;
    }

    // Build confirmation message with changes summary
    const changesList = defectsToUpdate.map(id => {
      const changes = pendingStatusChanges[id];
      const defect = defects.find(d => d.id === id);
      const parts = [];
      if (changes.defect_status) parts.push(`Status → ${statusColors[changes.defect_status]?.label || changes.defect_status}`);
      if (changes.manager_status) parts.push(`Manager → ${changes.manager_status.replace(/_/g, ' ')}`);
      return `Defect #${id} (${defect?.vehicle_nickname}): ${parts.join(', ')}`;
    }).slice(0, 5); // Show max 5 in preview

    const moreCount = defectsToUpdate.length > 5 ? defectsToUpdate.length - 5 : 0;

    // ✅ Use React Toast Confirmation with Confirm/Cancel buttons
    toast(
      <div className="flex flex-col gap-2">
        <div className="font-bold text-gray-900">Confirm Status Updates</div>
        <div className="text-sm text-gray-700">
          You are about to update <strong>{defectsToUpdate.length}</strong> defect{defectsToUpdate.length > 1 ? 's' : ''}:
        </div>
        <ul className="text-xs text-gray-600 list-disc pl-4 space-y-1">
          {changesList.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
          {moreCount > 0 && (
            <li className="font-medium text-blue-600">...and {moreCount} more</li>
          )}
        </ul>
      </div>,
      {
        duration: 10000,
        action: {
          label: 'Confirm',
          onClick: async () => {
            // Execute the save operation
            await executeSaveStatuses(defectsToUpdate);
          }
        },
        cancel: {
          label: 'Cancel',
          onClick: () => {
            toast.info('Status update cancelled');
          }
        }
      }
    );
  };

  // ✅ Execute the actual save operation
  const executeSaveStatuses = async (defectsToUpdate: number[]) => {
    try {
      let successCount = 0;
      let errorCount = 0;

      for (const defectId of defectsToUpdate) {
        const changes = pendingStatusChanges[defectId];
        
        try {
          // Update defect status if changed
          if (changes.defect_status) {
            const response = await fetch(buildApiUrl(`${API_ENDPOINTS.defects.byId(defectId)}/status`), {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
              },
              body: JSON.stringify({ defect_status: changes.defect_status })
            });

            const data = await response.json();
            if (!data.success) {
              errorCount++;
              continue;
            }
          }

          // Update manager status if changed
          if (changes.manager_status) {
            const response = await fetch(buildApiUrl(`${API_ENDPOINTS.defects.byId(defectId)}/manager-status`), {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
              },
              body: JSON.stringify({ manager_status: changes.manager_status })
            });

            const data = await response.json();
            if (!data.success) {
              errorCount++;
              continue;
            }
          }

          successCount++;
        } catch (error) {
          console.error(`Error updating defect ${defectId}:`, error);
          errorCount++;
        }
      }

      // Clear pending changes for successfully updated defects
      setPendingStatusChanges(prev => {
        const newPending = { ...prev };
        defectsToUpdate.forEach(id => delete newPending[id]);
        return newPending;
      });

      // Show results
      if (successCount > 0) {
        toast.success(`✅ Successfully updated ${successCount} defect(s)!`);
        fetchUnfilteredSummary(); // ✅ Refresh stat cards after bulk status changes
      }
      if (errorCount > 0) {
        toast.error(`❌ Failed to update ${errorCount} defect(s)`);
      }

      // Refresh list
      fetchDefects();
    } catch (error) {
      console.error('Error saving status changes:', error);
      toast.error('Failed to save changes. Please try again.');
    }
  };

  // ✅ NEW: Handle Manager Approve
  const handleManagerApprove = async (defect: Defect) => {
    // Validation matching PHP logic
    if (!defect.defect_status || !['Completed', 'Repair_Not_Required'].includes(defect.defect_status)) {
      toast.error('Active defects cannot be approved. Complete repair first.');
      return;
    }

    if (defect.manager_status === 'Approved') {
      toast.error('Defect is already approved by Manager.');
      return;
    }

    // Get manager status from pending changes or current value
    const managerStatus = pendingStatusChanges[defect.id]?.manager_status || defect.manager_status || '';

    if (!managerStatus || managerStatus === '') {
      toast.error('Manager status is required before approval. Please select a manager status first.');
      return;
    }

    let confirmMessage = 'Are you sure you want to approve this defect?';
    if (defect.defect_source === 'motive') {
      if (!defect.motive_defect_id) {
        toast.error('No Motive ID found for this defect. Cannot sync with Motive.');
        return;
      }
      confirmMessage = 'Are you sure you want to approve this Motive defect and update Motive?';
    }

    if (!confirm(confirmMessage)) return;

    try {
      // ✅ UPDATED: Use /approve-manager endpoint that syncs with Motive
      const response = await fetch(buildApiUrl(`${API_ENDPOINTS.defects.byId(defect.id)}/approve-manager`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({
          manager_status: managerStatus
        })
      });

      const data = await response.json();

      if (data.success) {
        // Show success with Motive sync status
        let message = data.message || 'Defect approved successfully!';
        
        if (data.motive_sync === true) {
          toast.success(`✅ ${message} (Synced with Motive)`);
        } else if (data.motive_sync === false && data.local_update) {
          toast.warning(`⚠️ ${message} (Motive sync skipped - not a Motive defect)`);
        } else {
          toast.success(message);
        }
        
        fetchDefects();
      } else {
        // Handle partial success (local updated but Motive failed)
        if (data.local_update && !data.motive_sync) {
          toast.error(`⚠️ ${data.message}\n\nLocal database updated, but Motive sync failed. Please check logs.`);
          fetchDefects(); // Still refresh to show local changes
        } else {
          toast.error(data.message || 'Approval failed');
        }
      }
    } catch (error) {
      console.error('Error approving defect:', error);
      toast.error('Network error. Please try again.');
    }
  };

  // ✅ NEW: Recheck Motive Inspection Status
  const handleRecheckMotiveStatus = async (defect: Defect) => {
    if (!defect.motive_record_id || !defect.motive_defect_id) {
      toast.error('Missing Motive inspection data');
      return;
    }

    setRecheckingMotiveStatus(prev => ({ ...prev, [defect.id]: true }));

    try {
      const response = await fetch(buildApiUrl(`${API_ENDPOINTS.defects.base}/motive-inspection-status`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({
          motive_defect_id: defect.motive_defect_id,
          motive_record_id: defect.motive_record_id,
          record_id: defect.id
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Motive status updated');
        fetchDefects(); // Refresh to show updated data
      } else {
        toast.error(data.error || 'Failed to fetch Motive status');
      }
    } catch (error) {
      console.error('Error fetching Motive status:', error);
      toast.error('Failed to fetch Motive status');
    } finally {
      setRecheckingMotiveStatus(prev => ({ ...prev, [defect.id]: false }));
    }
  };

  // ✅ NEW: Handle status card click to filter table
  const handleStatusCardClick = async (status: string | null) => {
    setActiveStatusFilter(status);
    setPage(1); // Reset to first page
    
    // Update filters based on status
    // ✅ UPDATED: When clicking Open, include both Open and Reopened
    // ✅ UPDATED: When clicking In Progress, include In_Progress, Repair_Started (both variations), and Paused
    let statusFilter: string[] = [];
    if (status === null) {
      statusFilter = [];
    } else if (status === 'Open') {
      statusFilter = ['Open', 'Reopened']; // ✅ Include Reopened when filtering Open
    } else if (status === 'In_Progress') {
      statusFilter = ['In_Progress', 'Repair_Started', 'Repair Started', 'Paused'];
    } else if (status === 'Completed') {
      statusFilter = ['Completed', 'Repair_Not_Required']; // ✅ Include Repair_Not_Required when filtering Completed
    } else {
      statusFilter = [status];
    }
    
    const updatedFilters = { 
      ...filters, 
      defect_status: statusFilter
    };
    setFilters(updatedFilters);
    
    // Manually trigger fetch with updated filters
    // We need to pass the updated filters since state updates are async
    const params = new URLSearchParams({
      page: '1',
      per_page: perPage.toString(),
      sort,
      order,
      ...(updatedFilters.search && { search: updatedFilters.search }),
      ...(updatedFilters.repair_category.length > 0 && { repair_category: updatedFilters.repair_category.join(',') }),
      ...(updatedFilters.reported_by.length > 0 && { reported_by: updatedFilters.reported_by.join(',') }),
      ...(updatedFilters.vehicle.length > 0 && { vehicle: updatedFilters.vehicle.join(',') }),
      ...(updatedFilters.defect_source.length > 0 && { defect_source: updatedFilters.defect_source.join(',') }),
      ...(updatedFilters.defect_status.length > 0 && { defect_status: updatedFilters.defect_status.join(',') }),
      ...(updatedFilters.manager_status.length > 0 && { manager_status: updatedFilters.manager_status.join(',') }),
      ...(updatedFilters.issue_type.length > 0 && { issue_type: updatedFilters.issue_type.join(',') }),
      ...(updatedFilters.date_from && { date_from: updatedFilters.date_from }),
      ...(updatedFilters.date_to && { date_to: updatedFilters.date_to })
    });

    try {
      setLoading(true);
      const response = await fetch(buildApiUrl(`${API_ENDPOINTS.defects.base}?${params}`), {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });

      const data = await response.json();
      
      if (data.success) {
        // ✅ Backend now handles defect_status priority sorting via SQL CASE statement
        // Frontend sorting is kept as fallback for client-side flexibility
        let sortedDefects = data.data || [];
        
        sortedDefects = [...sortedDefects].sort((a, b) => {
          // Sort by the selected column only
          let primaryComparison = 0;
          
          if (sort === 'issue_date') {
            const dateA = new Date(a.issue_date).getTime();
            const dateB = new Date(b.issue_date).getTime();
            primaryComparison = order === 'DESC' ? dateB - dateA : dateA - dateB;
          } else if (sort === 'vehicle_number') {
            const numA = parseInt(a.vehicle_number) || 0;
            const numB = parseInt(b.vehicle_number) || 0;
            primaryComparison = order === 'DESC' ? numB - numA : numA - numB;
          } else if (sort === 'defect_id') {
            primaryComparison = order === 'DESC' 
              ? b.defect_id - a.defect_id 
              : a.defect_id - b.defect_id;
          } else if (sort === 'defect_status') {
            const statusA = statusSortOrder[a.defect_status] || 999;
            const statusB = statusSortOrder[b.defect_status] || 999;
            primaryComparison = order === 'DESC' ? statusB - statusA : statusA - statusB;
            
            // ✅ Secondary sort: issue_date DESC (newest first within each status)
            if (primaryComparison === 0) {
              const dateA = new Date(a.issue_date).getTime();
              const dateB = new Date(b.issue_date).getTime();
              primaryComparison = dateB - dateA; // Always DESC for secondary sort
            }
          } else if (sort === 'motive_defect_status') {
            // Handle null/empty values - always show at the end
            const motiveStatusA = a.motive_defect_status;
            const motiveStatusB = b.motive_defect_status;
            const statusA = (motiveStatusA && motiveStatusA.trim()) ? (statusSortOrder[motiveStatusA] || 999) : 9999;
            const statusB = (motiveStatusB && motiveStatusB.trim()) ? (statusSortOrder[motiveStatusB] || 999) : 9999;
            primaryComparison = order === 'DESC' ? statusB - statusA : statusA - statusB;
          } else if (sort === 'manager_status') {
            const managerA = (a.manager_status || '').toLowerCase();
            const managerB = (b.manager_status || '').toLowerCase();
            primaryComparison = order === 'DESC' 
              ? managerB.localeCompare(managerA)
              : managerA.localeCompare(managerB);
          }
          
          return primaryComparison;
        });
        
        setDefects(sortedDefects);
        setTotalRecords(data.total_records || 0);
        setTotalPages(data.total_pages || 1);
        setStatusSummary(data.status_summary || {});
        setTotalSummary(data.total_summary || 0);
      } else {
        toast.error(data.message || 'Failed to fetch defects');
      }
    } catch (error) {
      console.error('Error fetching defects:', error);
      toast.error('Failed to load defects');
    } finally {
      setLoading(false);
    }
  };

  // Calculate statistics
  const stats = useMemo(() => {
    console.log('📊 [STATS CALCULATION] unfilteredStatusSummary:', unfilteredStatusSummary);
    console.log('📊 [STATS CALCULATION] unfilteredTotalSummary:', unfilteredTotalSummary);
    
    // ✅ UPDATED: Open count now includes both "Open" and "Reopened"
    const openCount = (unfilteredStatusSummary['Open'] || 0) + (unfilteredStatusSummary['Reopened'] || 0);
    // ✅ UPDATED: In Progress now includes In_Progress, Repair_Started (both variations), and Paused
    const inProgressCount = (unfilteredStatusSummary['In_Progress'] || 0) + 
                            (unfilteredStatusSummary['Repair_Started'] || 0) + 
                            (unfilteredStatusSummary['Repair Started'] || 0) + 
                            (unfilteredStatusSummary['Paused'] || 0);
    const rejectedCount = unfilteredStatusSummary['Rejected'] || 0;
    // ✅ UPDATED: Completed count now includes both \"Completed\" and \"Repair_Not_Required\"
    const completedCount = (unfilteredStatusSummary['Completed'] || 0) + (unfilteredStatusSummary['Repair_Not_Required'] || 0);

    console.log('📊 [STATS CALCULATION] Results:', {
      total: unfilteredTotalSummary,
      open: openCount,
      inProgress: inProgressCount,
      rejected: rejectedCount,
      completed: completedCount
    });

    return {
      total: unfilteredTotalSummary,
      open: openCount,
      inProgress: inProgressCount,
      rejected: rejectedCount,
      completed: completedCount
    };
  }, [unfilteredStatusSummary, unfilteredTotalSummary]);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return filters.search ||
      filters.repair_category.length > 0 ||
      filters.reported_by.length > 0 ||
      filters.vehicle.length > 0 ||
      filters.defect_source.length > 0 ||
      filters.defect_status.length > 0 ||
      filters.manager_status.length > 0 ||
      filters.issue_type.length > 0 ||
      filters.date_from ||
      filters.date_to;
  }, [filters]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Simplified Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Title & Quick Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Fleet Defects</h1>
              <p className="text-gray-600 mt-1">Monitor and Manage Vehicle Defects</p>
            </div>
            <div className="flex items-center gap-3">
              {activeTab === 'defects' && (
                <>
                  <button
                    onClick={handleRefresh}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm"
                    title="Refresh data and reset filters"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span className="hidden sm:inline">Refresh</span>
                  </button>
                  <button
                    onClick={handleRunMaintenanceDefects}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-orange-700 bg-orange-50 border-2 border-orange-300 rounded-lg hover:bg-orange-100 hover:border-orange-400 transition-all shadow-sm"
                    title="Find overdue and due soon maintenance items"
                  >
                    <Wrench className="w-4 h-4" />
                    <span className="hidden sm:inline">Run Maintenance Defects</span>
                  </button>
                  <button
                    onClick={() => setCreateDefectModalOpen(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-all shadow-md hover:shadow-lg"
                  >
                    <Plus className="w-5 h-5" />
                    <span>New Defect</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-1 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('defects')}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-all relative ${
                activeTab === 'defects'
                  ? 'text-blue-600 border-b-2 border-blue-600 -mb-[2px]'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              Defect List
            </button>
            <button
              onClick={() => setActiveTab('schedule')}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-all relative ${
                activeTab === 'schedule'
                  ? 'text-blue-600 border-b-2 border-blue-600 -mb-[2px]'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              Schedule Maintenance
            </button>
            <button
              onClick={() => setActiveTab('manage-ro')}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-all relative ${
                activeTab === 'manage-ro'
                  ? 'text-blue-600 border-b-2 border-blue-600 -mb-[2px]'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Wrench className="w-4 h-4" />
              Manage RO
            </button>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'schedule' ? (
        <MaintenanceSchedule />
      ) : activeTab === 'manage-ro' ? (
        <ManageRO 
          preselectedVehicleId={roPreselectedVehicleId}
          preselectedDefectIds={roPreselectedDefectIds}
          autoOpenEditROId={editROId}
          onCreateROComplete={() => {
            // Only switch back to defects tab if user came from defects (has preselected data)
            // This prevents unwanted tab switching when editing RO from within Manage RO tab
            if (roPreselectedDefectIds || roPreselectedVehicleId) {
              setActiveTab('defects');
              fetchDefects();
            }
            // Always clear preselected data
            setRoPreselectedVehicleId(undefined);
            setRoPreselectedDefectIds(undefined);
            setEditROId(undefined);
          }}
        />
      ) : (
        <>
          {/* Original Defects Content */}
          <div className="bg-white border-b border-gray-200">
            <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
              {/* Simplified Stats - Compact Row */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Total Card */}
            <div 
              onClick={() => handleStatusCardClick(null)}
              className={`bg-white border-2 rounded-lg p-4 hover:shadow-md transition-all cursor-pointer ${
                activeStatusFilter === null ? 'border-blue-500 ring-2 ring-blue-200 shadow-md' : 'border-blue-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 rounded-lg p-2.5">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Total</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                </div>
              </div>
            </div>

            {/* Open Card */}
            <div 
              onClick={() => handleStatusCardClick('Open')}
              className={`bg-white border-2 rounded-lg p-4 hover:shadow-md transition-all cursor-pointer ${
                activeStatusFilter === 'Open' ? 'border-blue-500 ring-2 ring-blue-200 shadow-md' : 'border-blue-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 rounded-lg p-2.5">
                  <AlertTriangle className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Open</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.open}</p>
                </div>
              </div>
            </div>

            {/* In Progress Card */}
            <div 
              onClick={() => handleStatusCardClick('In_Progress')}
              className={`bg-white border-2 rounded-lg p-4 hover:shadow-md transition-all cursor-pointer ${
                activeStatusFilter === 'In_Progress' ? 'border-indigo-500 ring-2 ring-indigo-200 shadow-md' : 'border-indigo-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="bg-indigo-100 rounded-lg p-2.5">
                  <PlayCircle className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">In Progress</p>
                  <p className="text-2xl font-bold text-indigo-600">{stats.inProgress}</p>
                </div>
              </div>
            </div>

            {/* Rejected Card */}
            <div 
              onClick={() => handleStatusCardClick('Rejected')}
              className={`bg-white border-2 rounded-lg p-4 hover:shadow-md transition-all cursor-pointer ${
                activeStatusFilter === 'Rejected' ? 'border-red-500 ring-2 ring-red-200 shadow-md' : 'border-red-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="bg-red-100 rounded-lg p-2.5">
                  <XCircle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Rejected</p>
                  <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
                </div>
              </div>
            </div>

            {/* Completed Card */}
            <div 
              onClick={() => handleStatusCardClick('Completed')}
              className={`bg-white border-2 rounded-lg p-4 hover:shadow-md transition-all cursor-pointer ${
                activeStatusFilter === 'Completed' ? 'border-green-500 ring-2 ring-green-200 shadow-md' : 'border-green-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="bg-green-100 rounded-lg p-2.5">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Completed</p>
                  <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Quick Search & Filter Toggle */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search Bar */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search defects by ID, vehicle, description, notes..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
                  className="w-full pl-12 pr-4 py-3 text-base border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
              </div>
            </div>

            {/* Filter Toggle & Quick Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setFilterOpen(!filterOpen)}
                className={`inline-flex items-center gap-2 px-5 py-3 text-sm font-medium rounded-lg transition-all border-2 ${
                  hasActiveFilters
                    ? 'bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                <Filter className="w-5 h-5" />
                <span>Filters</span>
                {hasActiveFilters && (
                  <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {[
                      ...filters.vehicle,
                      ...filters.repair_category,
                      ...filters.reported_by,
                      ...filters.defect_source,
                      ...filters.defect_status,
                      ...filters.manager_status,
                      ...filters.issue_type,
                      filters.date_from,
                      filters.date_to
                    ].filter(Boolean).length}
                  </span>
                )}
                {filterOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              
              <button
                onClick={handleApplyFilters}
                className="inline-flex items-center gap-2 px-5 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-all shadow-md hover:shadow-lg"
              >
                <Search className="w-4 h-4" />
                <span className="hidden sm:inline">Search</span>
              </button>
            </div>
          </div>

          {/* Advanced Filters Panel */}
          {filterOpen && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {/* Vehicle Filter */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                    <Bus className="w-4 h-4 text-gray-500" />
                    Vehicle
                  </label>
                  <VehicleFilter
                    options={vehicles.map(v => v.vehicle_nickname)}
                    selectedValues={filters.vehicle.map(id => {
                      const vehicle = vehicles.find(v => v.id.toString() === id);
                      return vehicle ? vehicle.vehicle_nickname : id;
                    })}
                    onChange={(nicknames) => {
                      const ids = nicknames.map(nickname => {
                        const vehicle = vehicles.find(v => v.vehicle_nickname === nickname);
                        return vehicle ? vehicle.id.toString() : nickname;
                      });
                      setFilters({ ...filters, vehicle: ids });
                    }}
                    placeholder="All Vehicles"
                  />
                </div>

                {/* Category Filter */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                    <Settings className="w-4 h-4 text-gray-500" />
                    Category
                  </label>
                  <MultiSelectFilter
                    label="Category"
                    options={repairCategories.map(cat => cat.repair_code_category)}
                    selectedValues={filters.repair_category.map(id => {
                      const category = repairCategories.find(cat => cat.id.toString() === id);
                      return category ? category.repair_code_category : id;
                    })}
                    onChange={(names) => {
                      const ids = names.map(name => {
                        const category = repairCategories.find(cat => cat.repair_code_category === name);
                        // ✅ Fixed: Handle case when category is not found
                        return category?.id ? category.id.toString() : name;
                      });
                      setFilters({ ...filters, repair_category: ids });
                    }}
                    placeholder="All Categories"
                  />
                </div>

                {/* Reported By Filter */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                    <Users className="w-4 h-4 text-gray-500" />
                    Reported By
                  </label>
                  <MultiSelectFilter
                    label="Reported By"
                    options={users.map(user => formatUserName(user))}
                    selectedValues={filters.reported_by.map(id => {
                      const user = users.find(u => u.id.toString() === id);
                      return user ? formatUserName(user) : id;
                    })}
                    onChange={(names) => {
                      const ids = names.map(name => {
                        const user = users.find(u => formatUserName(u) === name);
                        // ✅ Fixed: Handle case when user is not found
                        return user?.id ? user.id.toString() : name;
                      });
                      setFilters({ ...filters, reported_by: ids });
                    }}
                    placeholder="All Users"
                  />
                </div>

                {/* Defect Source Filter */}
{/* Defect Source Filter */}
<div>
  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
    <MapPin className="w-4 h-4 text-gray-500" />
    Source
  </label>
  <div className="flex gap-3 pt-2 flex-wrap">
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={filters.defect_source.includes('motive')}
        onChange={(e) => {
          setFilters({
            ...filters,
            defect_source: e.target.checked
              ? [...filters.defect_source, 'motive']
              : filters.defect_source.filter(s => s !== 'motive')
          });
        }}
        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
      />
      <span className="text-sm text-gray-700">Motive</span>
    </label>
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={filters.defect_source.includes('skysoft')}
        onChange={(e) => {
          setFilters({
            ...filters,
            defect_source: e.target.checked
              ? [...filters.defect_source, 'skysoft']
              : filters.defect_source.filter(s => s !== 'skysoft')
          });
        }}
        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
      />
      <span className="text-sm text-gray-700">Skysoft</span>
    </label>
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={filters.defect_source.includes('maintenance')}
        onChange={(e) => {
          setFilters({
            ...filters,
            defect_source: e.target.checked
              ? [...filters.defect_source, 'maintenance']
              : filters.defect_source.filter(s => s !== 'maintenance')
          });
        }}
        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
      />
      <span className="text-sm text-gray-700">Maintenance</span>
    </label>
    {/* ✅ ADD THIS NEW GARAGE CHECKBOX */}
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={filters.defect_source.includes('garage')}
        onChange={(e) => {
          setFilters({
            ...filters,
            defect_source: e.target.checked
              ? [...filters.defect_source, 'garage']
              : filters.defect_source.filter(s => s !== 'garage')
          });
        }}
        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
      />
      <span className="text-sm text-gray-700">Garage</span>
    </label>
  </div>
</div>
                {/* Defect Status - MultiSelect Dropdown */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                    <Info className="w-4 h-4 text-gray-500" />
                    Defect Status
                  </label>
                  <MultiSelectFilter
                    label="Defect Status"
                    options={statusMaster.map(status => {
                      const config = statusColors[status] || { label: status };
                      const count = statusSummary[status] || 0;
                      return `${config.label} (${count})`;
                    })}
                    selectedValues={filters.defect_status.map(status => {
                      const config = statusColors[status] || { label: status };
                      const count = statusSummary[status] || 0;
                      return `${config.label} (${count})`;
                    })}
                    onChange={(labelsWithCounts) => {
                      const statuses = labelsWithCounts.map(labelWithCount => {
                        // Extract label without count (e.g., "Open (12)" -> "Open")
                        const label = labelWithCount.replace(/\s*\(\d+\)$/, '').trim();
                        
                        // Find the matching status key by comparing labels
                        const entry = Object.entries(statusColors).find(([_, config]) => config.label === label);
                        
                        if (entry) {
                          return entry[0]; // Return the status key (e.g., "Open", "In_Progress")
                        }
                        
                        // Fallback: try to find by converting label to status format
                        // "In Progress" -> "In_Progress"
                        const statusKey = label.replace(/\s+/g, '_');
                        if (statusMaster.includes(statusKey)) {
                          return statusKey;
                        }
                        
                        // Last fallback: return as-is
                        return label;
                      }).filter(Boolean); // Remove any undefined/null values
                      
                      // ✅ Note: "Open" auto-includes "Reopened" only on title card click and default page load
                      // In the dropdown, users can manually select/deselect each status independently
                      setFilters({ ...filters, defect_status: statuses });
                    }}
                    placeholder="All Statuses"
                  />
                </div>

                {/* Date From */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    Date From
                  </label>
                  <DatePicker
                    value={filters.date_from}
                    onChange={(date) => {
                      const formattedDate = date ? date.toISOString().split('T')[0] : '';
                      setFilters({ ...filters, date_from: formattedDate });
                      
                      // Validate if date_to is already set and is before the new date_from
                      if (filters.date_to && formattedDate && filters.date_to < formattedDate) {
                        toast.error('Date From cannot be after Date To');
                      }
                    }}
                    placeholder="YYYY-MM-DD"
                  />
                </div>

                {/* Date To */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    Date To
                  </label>
                  <DatePicker
                    value={filters.date_to}
                    onChange={(date) => {
                      const formattedDate = date ? date.toISOString().split('T')[0] : '';
                      
                      // Validate date range
                      if (formattedDate && filters.date_from && formattedDate < filters.date_from) {
                        toast.error('Date To cannot be before Date From');
                        return; // Don't update if invalid
                      }
                      
                      setFilters({ ...filters, date_to: formattedDate });
                    }}
                    placeholder="YYYY-MM-DD"
                  />
                </div>
              </div>

              {/* Filter Actions */}
              <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200">
                <button
                  onClick={() => {
                    handleResetFilters();
                    fetchDefects();
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-all"
                >
                  <X className="w-4 h-4" />
                  Clear All Filters
                </button>
                
                <div className="text-sm text-gray-600">
                  {hasActiveFilters && (
                    <span className="font-medium">
                      {[
                        filters.vehicle.length > 0 && `${filters.vehicle.length} vehicle${filters.vehicle.length > 1 ? 's' : ''}`,
                        filters.repair_category.length > 0 && `${filters.repair_category.length} categor${filters.repair_category.length > 1 ? 'ies' : 'y'}`,
                        filters.reported_by.length > 0 && `${filters.reported_by.length} user${filters.reported_by.length > 1 ? 's' : ''}`,
                        filters.defect_source.length > 0 && `${filters.defect_source.length} source${filters.defect_source.length > 1 ? 's' : ''}`,
                        filters.defect_status.length > 0 && `${filters.defect_status.length} status${filters.defect_status.length > 1 ? 'es' : ''}`,
                        filters.manager_status.length > 0 && `${filters.manager_status.length} mgr status${filters.manager_status.length > 1 ? 'es' : ''}`,
                        filters.issue_type.length > 0 && `${filters.issue_type.length} priority`,
                        (filters.date_from || filters.date_to) && 'date range'
                      ].filter(Boolean).join(', ')} selected
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>



        {/* Bulk Actions Bar */}
        {selectedDefects.length > 0 && (
          <div className="bg-blue-50 border-b-2 border-blue-200 px-6 py-4 mb-6 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleRepairNotNeeded}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-medium text-sm shadow-sm"
                >
                  Repair Not Needed
                </button>
                <button
                  onClick={handleMergeSelected}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm shadow-sm"
                >
                  Merge Selected
                </button>
                <button
                  onClick={handleCreateRO}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm shadow-sm"
                >
                  Create RO
                </button>
              </div>
              
              <div className="flex items-center gap-3">
                <span className="text-sm text-blue-900 font-medium">
                  <strong>{selectedDefects.length}</strong> item{selectedDefects.length > 1 ? 's' : ''} selected
                </span>
                <button
                  onClick={() => setSelectedDefects([])}
                  className="text-sm text-blue-700 hover:text-blue-900 underline font-medium"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Data Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-visible">
          {/* Table Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center gap-4 mb-3 sm:mb-0">
              <h3 className="font-semibold text-gray-900 text-lg">
                {totalRecords.toLocaleString()} Result{totalRecords !== 1 ? 's' : ''}
              </h3>
              <select
                value={perPage}
                onChange={(e) => {
                  setPerPage(Number(e.target.value));
                  setPage(1);
                }}
                className="px-3 py-2 border-2 border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option key="10" value={10}>Show 10</option>
                <option key="25" value={25}>Show 25</option>
                <option key="50" value={50}>Show 50</option>
                <option key="100" value={100}>Show 100</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <RefreshCw className="w-12 h-12 text-blue-600 animate-spin mb-4" />
              <p className="text-lg font-medium text-gray-900">Loading defects...</p>
              <p className="text-sm text-gray-500 mt-1">Please wait</p>
            </div>
          ) : defects.filter(d => d.is_duplicate !== 'y').length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-4">
              <div className="bg-gray-100 rounded-full p-6 mb-4">
                <AlertTriangle className="w-16 h-16 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No defects found</h3>
              <p className="text-gray-600 mb-6 text-center max-w-md">
                {hasActiveFilters
                  ? 'Try adjusting your filters to see more results'
                  : 'Get started by creating your first defect report'}
              </p>
              <div className="flex gap-3">
                {hasActiveFilters && (
                  <button
                    onClick={() => {
                      handleResetFilters();
                      fetchDefects();
                    }}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all font-medium"
                  >
                    <X className="w-5 h-5" />
                    Clear Filters
                  </button>
                )}
                <button
                  onClick={() => toast.info('Create new defect functionality coming soon')}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-medium shadow-md"
                >
                  <Plus className="w-5 h-5" />
                  Create New Defect
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 border-b-2 border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left w-12">
                      <input
                        type="checkbox"
                        checked={selectedDefects.length === defects.filter(d => d.is_duplicate !== 'y').length && defects.filter(d => d.is_duplicate !== 'y').length > 0}
                        onChange={handleSelectAll}
                        className="w-5 h-5 text-blue-600 border-2 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      />
                    </th>
                    <th 
                      className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                      onClick={() => handleSort('vehicle_nickname')}
                    >
                      <div className="flex items-center gap-2">
                        <Bus className="w-4 h-4" />
                        Vehicle
                        {sort === 'vehicle_nickname' && (
                          order === 'ASC' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                      onClick={() => handleSort('repair_desc')}
                    >
                      <div className="flex items-center gap-2">
                        Category
                        {sort === 'repair_desc' && (
                          order === 'ASC' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                      onClick={() => handleSort('notes')}
                    >
                      <div className="flex items-center gap-2">
                        Issue
                        {sort === 'notes' && (
                          order === 'ASC' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                      onClick={() => handleSort('issue_date')}
                    >
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Date
                        {sort === 'issue_date' && (
                          order === 'ASC' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </th>
                    {/* ✅ HIDDEN: Inspected Date Column */}
                    <th 
                      className="hidden px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                      onClick={() => handleSort('motive_inspection_date')}
                    >
                      <div className="flex items-center gap-2">
                        Inspected Date
                        {sort === 'motive_inspection_date' && (
                          order === 'ASC' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </th>
                    {/* ✅ HIDDEN: Motive Approver Column */}
                    <th className="hidden px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Motive Approver
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                    <th 
                      className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                      onClick={() => handleSort('defect_status')}
                    >
                      <div className="flex items-center gap-2">
                        Status
                        {sort === 'defect_status' && (
                          order === 'ASC' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                      onClick={() => handleSort('reported_by')}
                    >
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Reported By
                        {sort === 'reported_by' && (
                          order === 'ASC' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </th>
                    {/* ✅ ID Column */}
                    <th 
                      className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                      onClick={() => handleSort('id')}
                    >
                      <div className="flex items-center gap-2">
                        ID
                        {sort === 'id' && (
                          order === 'ASC' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {defects
                    .filter(defect => defect.is_duplicate !== 'y') // Hide merged secondary defects
                    .map((defect) => {
                    const statusConfig = statusColors[defect.defect_status || ''] || { bg: 'bg-gray-50', text: 'text-gray-700', icon: AlertTriangle, label: defect.defect_status || 'Unknown' };
                    const StatusIcon = statusConfig.icon;
                    // ✅ UPDATED: Allow Reopened defects to be selectable even if previously approved
                    const isSelectable = defect.is_duplicate !== 'y' && 
                                        (defect.manager_status !== 'Approved' || defect.defect_status === 'Reopened');

                    const mainRow = (
                    <tr 
  key={defect.id}
  className={`hover:bg-gray-50 transition-colors ${
    defect.disengage_reason 
      ? 'bg-amber-50 border-l-4 border-l-amber-500' 
      : ''
  }`}
>
                          <td className="px-6 py-4">
                            {isSelectable ? (
                              <input
                                type="checkbox"
                                checked={selectedDefects.includes(defect.id)}
                                onChange={() => handleSelectDefect(defect.id)}
                                className="w-5 h-5 text-blue-600 border-2 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                              />
                            ) : (
                              <span className="text-gray-400 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="bg-gray-100 rounded p-1.5">
                                <Bus className="w-4 h-4 text-gray-600" />
                              </div>
                              <span className="font-medium text-gray-900">{defect.vehicle_nickname}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="max-w-md">
                              <div className="flex items-center gap-2 mb-1">
                                {/* ✅ Show category name with lighter styling */}
                                <p className="text-sm text-gray-500">{defect.category_name || 'No category'}</p>
                                {/* ✅ NEW: Motive Badge in Issue Column */}
                                {defect.defect_source === 'motive' && (
                                  <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[10px] rounded font-semibold uppercase tracking-wide">
                                    Motive
                                  </span>
                                )}
                                {/* ✅ NEW: Garage Badge in Issue Column */}
{defect.defect_source === 'garage' && (
  <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] rounded font-semibold uppercase tracking-wide">
    Garage
  </span>
)}
                                {/* ✅ NEW: Maintenance Badge in Issue Column */}
                                {defect.defect_source === 'maintenance' && (
                                  <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded font-semibold uppercase tracking-wide">
                                    Maintenance
                                  </span>
                                )}
                                
                              </div>
                              {/* ✅ NEW: Previous RO Badge */}
                              {defect.previous_ro_id && defect.previous_ro_id > 0 && (
                                <button
                                  onClick={() => handleViewRO(defect.previous_ro_id!)}
                                  className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded font-medium hover:bg-indigo-200 transition-colors border border-indigo-300"
                                >
                                  <FileText className="w-3 h-3" />
                                  Previous RO #{defect.previous_ro_id}
                                </button>
                              )}
                            </div>
                          </td>
                      <td className="px-6 py-4">
  <div className="max-w-xs">
    {defect.notes ? (
      <p className="font-medium text-gray-900 mb-2">{defect.notes}</p>
    ) : (
      <span className="text-gray-400 text-sm mb-2">-</span>
    )}
    
    {/* Disengagement details box - COMPLETE */}
{/* Garage Badge - Expandable with Wrench Icon */}
{/* Garage Badge - Expandable with Wrench Icon */}
{defect.disengage_reason && (
  <>
   <button
      onClick={() => toggleDisengageExpand(defect.id)}
      style={{ backgroundColor: GARAGE_BUTTON_COLOR }}
      className="hover:opacity-90 text-white px-3 py-1.5 rounded text-xs font-semibold inline-flex items-center gap-2 transition-all mb-2"
    >
      <Wrench className="w-4 h-4" />
      Garage
      <span className="text-xs ml-1">{expandedDisengageIds.has(defect.id) ? '▲' : '▼'}</span>
    </button>
    
    {/* Expanded Content - Horizontal with Smooth Animation */}
    <AnimatePresence>
      {expandedDisengageIds.has(defect.id) && (
        <motion.div
          initial={{ opacity: 0, height: 0, marginTop: 0 }}
          animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
          exit={{ opacity: 0, height: 0, marginTop: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="bg-blue-50 border border-blue-400 px-2.5 py-2 rounded flex items-center gap-3 flex-wrap text-xs overflow-hidden"
        >
          {/* Title */}
          <div className="w-full font-bold text-blue-900 uppercase border-b border-blue-400 pb-2 mb-1">
            Disengage Info
          </div>
          
          {/* Reason */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-blue-900 uppercase">Reason:</span>
            <span className="text-blue-900">{defect.disengage_reason.replace(/_/g, ' ')}</span>
          </div>
          
          {/* Divider */}
          <div className="w-px h-4 bg-blue-400 opacity-30"></div>
          
          {/* Notes */}
          {defect.disengage_notes && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-blue-900 uppercase">Notes:</span>
                <span className="text-blue-900">{defect.disengage_notes}</span>
              </div>
              
              {/* Divider */}
              <div className="w-px h-4 bg-blue-400 opacity-30"></div>
            </>
          )}
          
          {/* Date + Time */}
          {defect.disengaged_at && (
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-blue-900 uppercase">Date:</span>
              <span className="text-blue-900">
                {formatDate(defect.disengaged_at)} {new Date(defect.disengaged_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
              </span>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  </>
)}
  </div>
</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 font-medium">{formatDate(defect.issue_date)}</div>
                          </td>
                          {/* ✅ HIDDEN: Inspected Date Data */}
                          <td className="hidden px-6 py-4 whitespace-nowrap">
                            {defect.motive_inspection_date ? (
                              <div className="text-sm text-gray-900 font-medium">{formatDate(defect.motive_inspection_date)}</div>
                            ) : (
                              <span className="text-gray-400 text-sm">-</span>
                            )}
                          </td>
                          {/* ✅ HIDDEN: Motive Approver Column Data */}
                          <td className="hidden px-6 py-4 whitespace-nowrap">
                            {defect.defect_source === 'motive' && defect.motive_record_id && defect.motive_defect_id ? (
                              <div className="flex items-center gap-2">
                                <div className="text-sm">
                                  <div className="text-gray-900 font-medium">
                                    {defect.motive_driver_inspection_status ? defect.motive_driver_inspection_status.charAt(0).toUpperCase() + defect.motive_driver_inspection_status.slice(1) : 'Pending'}
                                  </div>
                                  {defect.motive_driver_signed && (
                                    <div className="text-xs text-gray-500">By {defect.motive_driver_signed}</div>
                                  )}
                                  {defect.motive_driver_signed_date && (
                                    <div className="text-xs text-gray-500">On {formatDate(defect.motive_driver_signed_date)}</div>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleRecheckMotiveStatus(defect)}
                                  disabled={recheckingMotiveStatus[defect.id]}
                                  className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
                                  title="Recheck Motive Status"
                                >
                                  {recheckingMotiveStatus[defect.id] ? (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <RefreshCw className="w-4 h-4" />
                                  )}
                                </button>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-sm">-</span>
                            )}
                          </td>
<td className="px-6 py-4 whitespace-nowrap text-center">
  <div className="inline-flex items-center justify-center gap-2">
    {/* View Button */}
    <button
      onClick={() => handleViewDetails(defect)}
      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
      title="View details"
    >
      <Eye className="w-5 h-5" />
    </button>
    
    {/* Edit Button */}
    {defect.defect_source === 'skysoft' && defect.manager_status !== 'Approved' && !defect.linked_to_roid && (
      <button
        onClick={() => handleEditDefect(defect)}
        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
        title="Edit defect"
      >
        <Edit2 className="w-5 h-5" />
      </button>
    )}
    
    {/* View RO Button */}
    {defect.linked_to_roid && (
      <button
        onClick={() => handleViewRO(defect.linked_to_roid!)}
        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
        title="View linked repair order"
      >
        <FileText className="w-5 h-5" />
      </button>
    )}
{defect.linked_to_roid && (
  <button
    onClick={() => {
      console.log('defect rpor Yuk fields:', defect.work_order_number); // ← add here
      setGarageModalDefect({
        vrlid:           defect.id,
        linkedToRoid:    defect.linked_to_roid!,
        vehicleNickname: defect.vehicle_nickname,
        repairDesc:      defect.repair_desc,
        categoryName:    defect.category_name,
        workOrderNumber: defect.work_order_number ?? null,
      });
    }}
    className="p-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
    title="View Garage repair items"
  >
    <Wrench className="w-5 h-5" />
  </button>
)}
  </div>
</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {/* ✅ UPDATED: Status Badge (no longer editable dropdown) */}
                            <div className="flex flex-col gap-1">
                              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium border ${statusConfig.bg} ${statusConfig.text} border-current`}>
                                <StatusIcon className="w-3 h-3" />
                                {statusConfig.label}
                              </span>
                              {defect.invoice_status === 'Paid' && (
                                <span className="text-xs text-green-600 font-medium">Invoice Paid</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm">
                              <div className="text-gray-900 font-medium">{formatDefectUserName(defect, 'reporter')}</div>
                            </div>
                          </td>
                          {/* ✅ ID Column Data */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-blue-600">#{defect.id}</span>
                                {/* Motive badge moved to Issue column */}
                                {/* ✅ NEW: Reopened Badge */}
                                {defect.motive_def_unique_id && defect.motive_def_unique_id.startsWith('RE') && (
                                  <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded font-medium border border-orange-300">
                                    Reopened
                                  </span>
                                )}
                              </div>
                              
                              {/* Merged Badge - Secondary Defect */}
                              {defect.is_duplicate === 'y' && defect.primary_defect_id && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-medium border border-gray-300">
                                  <Link2 className="w-3 h-3" />
                                  Merged to #{defect.primary_defect_id}
                                </span>
                              )}
                              
                              {/* Merged Badge - Primary Defect (with unmerge action) */}
                              {defect.merged_records_id && defect.merged_count && defect.merged_count > 0 && defect.is_duplicate === 'n' && (
                                <button
                                  onClick={() => handleViewMergedGroup(defect.merged_records_id!)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-bold hover:bg-purple-200 transition-colors border border-purple-300"
                                  title={expandedMergeGroup === defect.merged_records_id ? "Collapse merged group" : "Expand to view and unmerge"}
                                >
                                  <GitMerge className="w-3 h-3" />
                                  {defect.merged_count} merged
                                  {expandedMergeGroup === defect.merged_records_id ? (
                                    <ChevronUp className="w-3 h-3" />
                                  ) : (
                                    <ChevronDown className="w-3 h-3" />
                                  )}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );

                      const expandedRow = expandedMergeGroup === defect.merged_records_id && defect.merged_records_id ? (
                        <tr key={`${defect.id}-expanded`} className="bg-gradient-to-r from-orange-50 to-purple-50">
                          <td colSpan={10} className="px-6 py-4">
                            <div className="border-2 border-orange-300 rounded-xl bg-white shadow-lg">
                              {/* Header */}
                              <div className="bg-gradient-to-r from-orange-600 to-orange-700 text-white px-5 py-3 flex items-center justify-between rounded-t-xl">
                                <div className="flex items-center gap-2">
                                  <GitMerge className="w-5 h-5 rotate-180" />
                                  <h3 className="font-bold text-lg">
                                    {loadingMergedGroup ? 'Loading Merged Group...' : `Merged Group: ${defect.merged_records_id}`}
                                  </h3>
                                </div>
                                <button
                                  onClick={() => {
                                    setExpandedMergeGroup(null);
                                    setMergedGroupDefects([]);
                                    setSelectedUnmergeIds([]);
                                  }}
                                  className="text-white hover:bg-orange-800 p-1.5 rounded-lg transition-colors"
                                  title="Collapse"
                                >
                                  <X className="w-5 h-5" />
                                </button>
                              </div>

                              {/* Content */}
                              <div className="p-5">
                                {loadingMergedGroup ? (
                                  <div className="flex items-center justify-center py-12">
                                    <RefreshCw className="w-8 h-8 animate-spin text-orange-600" />
                                  </div>
                                ) : (
                                  <>
                                    {/* Merged Defects Table */}
                                    <div className="border-2 border-gray-200 rounded-xl overflow-hidden">
                                      <table className="w-full">
                                        <thead className="bg-gray-100">
                                          <tr>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                                              ID
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                                              Vehicle
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                                              Issue Description
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                                              Notes
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                                              Reported By
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                                              Status
                                            </th>
                                            <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">
                                              Actions
                                            </th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                          {mergedGroupDefects.filter(d => d.is_duplicate !== 'n').map((mergedDefect) => {
                                            const statusConfig = statusColors[mergedDefect.defect_status || ''] || statusColors.Open;
                                            const isUnmergeDisabled = ['Completed', 'Repair_Not_Required', 'Repair_Not_Needed', 'Approved'].includes(mergedDefect.defect_status || '');
                                            
                                            return (
                                              <tr 
                                                key={mergedDefect.id}
                                                className={`transition-colors ${isUnmergeDisabled ? 'bg-gray-100 opacity-60' : 'hover:bg-gray-50'}`}
                                                title={isUnmergeDisabled ? 'Defects with "Completed", "Repair Not Needed", or "Approved" status cannot be unmerged' : ''}
                                              >
                                                <td className="px-4 py-3">
                                                  <span className="text-sm font-bold text-gray-900">#{mergedDefect.id}</span>
                                                </td>
                                                <td className="px-4 py-3">
                                                  <div className="flex items-center gap-2">
                                                    <Bus className="w-4 h-4 text-gray-600" />
                                                    <span className="text-sm font-medium text-gray-900">{mergedDefect.vehicle_nickname}</span>
                                                  </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                  <div className="max-w-sm">
                                                    <p className="text-sm font-medium text-gray-900 line-clamp-2">{mergedDefect.repair_desc}</p>
                                                    <p className="text-xs text-gray-500 mt-0.5">{mergedDefect.category_name}</p>
                                                  </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                  <div className="max-w-xs">
                                                    {mergedDefect.notes ? (
                                                      <p className="text-sm text-gray-700 line-clamp-2" title={mergedDefect.notes}>
                                                        {mergedDefect.notes}
                                                      </p>
                                                    ) : (
                                                      <span className="text-xs text-gray-400 italic">No notes</span>
                                                    )}
                                                  </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                  <span className="text-sm text-gray-700">{formatDefectUserName(mergedDefect, 'reporter')}</span>
                                                </td>
                                                <td className="px-4 py-3">
                                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}>
                                                    {statusConfig.label}
                                                  </span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                  <button
                                                    onClick={() => handleUnmergeDefects(false, [mergedDefect.id])}
                                                    disabled={isUnmergeDisabled || unmergingDefects}
                                                    className="px-3 py-1.5 text-xs font-medium text-orange-700 bg-white border border-orange-300 rounded-lg hover:bg-orange-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 mx-auto"
                                                    title={isUnmergeDisabled ? 'Cannot unmerge defects with restricted status' : 'Unmerge this defect from the group'}
                                                  >
                                                    <GitMerge className="w-3.5 h-3.5 rotate-180" />
                                                    Unmerge
                                                  </button>
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null;

                      return [mainRow, expandedRow].filter(Boolean);
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t-2 border-gray-200 bg-gray-50 gap-4">
              <div className="text-sm text-gray-700 font-medium">
                Showing <span className="font-bold text-gray-900">{((page - 1) * perPage) + 1}</span> to{' '}
                <span className="font-bold text-gray-900">{Math.min(page * perPage, totalRecords)}</span> of{' '}
                <span className="font-bold text-gray-900">{totalRecords.toLocaleString()}</span> results
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Previous
                </button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-all border-2 ${
                          page === pageNum
                            ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* View Details Modal - Simplified */}
      {viewModalOpen && viewingDefect && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-5 flex items-center justify-between rounded-t-2xl">
              <div>
                <h2 className="text-2xl font-bold">Defect Details</h2>
                <p className="text-blue-100 mt-1">#{viewingDefect.id} • {viewingDefect.vehicle_nickname}</p>
              </div>
              <button
                onClick={() => setViewModalOpen(false)}
                className="p-2 text-white hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6">
              {/* Priority Banner */}
              {viewingDefect.issue_type === 'MAJOR' && (
                <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 mb-6 flex items-center gap-3">
                  <AlertTriangle className="w-8 h-8 text-red-600" />
                  <div>
                    <p className="font-bold text-red-900 text-lg">Critical Priority</p>
                    <p className="text-red-700 text-sm">This defect requires immediate attention</p>
                  </div>
                </div>
              )}

              {/* Main Info */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Issue Description</h3>
                  <p className="text-lg text-gray-900 bg-gray-50 p-4 rounded-lg border-l-4 border-blue-600">{viewingDefect.repair_desc || viewingDefect.category_name || 'No description provided'}</p>
                </div>

                {viewingDefect.notes && (
                  <div>
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Additional Notes</h3>
                    <p className="text-gray-700 bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-500">{viewingDefect.notes}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Details</h3>
                    <dl className="space-y-3">
                      <div className="flex justify-between py-2 border-b border-gray-200">
                        <dt className="text-gray-600">Category</dt>
                        <dd className="font-semibold text-gray-900">{viewingDefect.category_name || 'No category'}</dd>
                      </div>
                      <div className="flex justify-between py-2 border-b border-gray-200">
                        <dt className="text-gray-600">Source</dt>
                        <dd className="font-semibold text-gray-900 capitalize">{viewingDefect.defect_source}</dd>
                      </div>
                      {viewingDefect.estimate && (
                        <div className="flex justify-between py-2 border-b border-gray-200">
                          <dt className="text-gray-600">Estimate</dt>
                          <dd className="font-bold text-green-600 text-lg">{formatCurrency(viewingDefect.estimate)}</dd>
                        </div>
                      )}
                    </dl>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Timeline</h3>
                    <dl className="space-y-3">
                      <div className="flex justify-between py-2 border-b border-gray-200">
                        <dt className="text-gray-600">Reported</dt>
                        <dd className="font-semibold text-gray-900">{formatDate(viewingDefect.issue_date)}</dd>
                      </div>
                      <div className="flex justify-between py-2 border-b border-gray-200">
                        <dt className="text-gray-600">Reported By</dt>
                        <dd className="font-semibold text-gray-900">{formatDefectUserName(viewingDefect, 'reporter')}</dd>
                      </div>
                      {viewingDefect.repair_date && (
                        <div className="flex justify-between py-2 border-b border-gray-200">
                          <dt className="text-gray-600">Scheduled</dt>
                          <dd className="font-semibold text-gray-900">{formatDate(viewingDefect.repair_date)}</dd>
                        </div>
                      )}
                    </dl>
                  </div>
                </div>

                {/* Status */}
                <div>
                  <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Current Status</h3>
                  <div className="flex items-center gap-3">
                    {(() => {
                      const statusConfig = statusColors[viewingDefect.defect_status || ''] || { bg: 'bg-gray-50', text: 'text-gray-700', icon: AlertTriangle, label: viewingDefect.defect_status || 'Unknown' };
                      const StatusIcon = statusConfig.icon;
                      return (
                        <span className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-lg border-2 ${statusConfig.bg} ${statusConfig.text} border-current`}>
                          <StatusIcon className="w-5 h-5" />
                          {statusConfig.label}
                        </span>
                      );
                    })()}
                  </div>
                </div>

                {/* Motive Defect Status - only show for Motive defects */}
                {viewingDefect.defect_source === 'motive' && viewingDefect.motive_defect_status && (
                  <div>
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Motive Defect Status</h3>
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-lg border-2 bg-purple-100 text-purple-800 border-purple-200">
                        {motiveDefectStatusLabels[viewingDefect.motive_defect_status] || viewingDefect.motive_defect_status}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="sticky bottom-0 bg-gray-50 border-t-2 border-gray-200 px-6 py-4 flex items-center justify-end gap-3 rounded-b-2xl">
              <button
                onClick={() => setViewModalOpen(false)}
                className="px-5 py-2.5 text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-all font-medium"
              >
                Close
              </button>
              {/* Edit button - only for skysoft defects that are not approved (matching PHP logic) */}
              {viewingDefect.defect_source === 'skysoft' && viewingDefect.manager_status !== 'Approved' && (
                <button
                  onClick={() => {
                    setViewModalOpen(false);
                    handleEditDefect(viewingDefect);
                  }}
                  className="px-5 py-2.5 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-all font-medium shadow-md"
                >
                  Edit Defect
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal - Enhanced with Validation */}
      {editModalOpen && editingDefect && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-5 flex items-center justify-between rounded-t-2xl z-10">
              <div>
                <h2 className="text-2xl font-bold">Edit Defect</h2>
                <p className="text-blue-100 mt-1">#{editingDefect.id} - {editingDefect.vehicle_nickname}</p>
              </div>
              <button
                onClick={() => setEditModalOpen(false)}
                className="p-2 text-white hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              {/* Repair Category */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Tag className="w-4 h-4 text-gray-400" />
                  Repair Category <span className="text-red-500">*</span>
                </label>
                <SingleSelectDropdown
                  label="Repair Categories"
                  options={repairCategories.map(cat => ({
                    value: cat.id.toString(),
                    label: cat.repair_code_category
                  }))}
                  value={editFormData.category}
                  onChange={(value) => {
                    setEditFormData({ ...editFormData, category: value });
                    setEditFormErrors({ ...editFormErrors, category: '' });
                  }}
                  placeholder="Select category..."
                  error={editFormErrors.category}
                  showSelectedLabel={false}
                />
                <AnimatePresence>
                  {editFormErrors.category && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-1.5 text-red-600 text-xs"
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                      {editFormErrors.category}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Issue (renamed from Additional Notes, now mandatory) */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <StickyNote className="w-4 h-4 text-gray-400" />
                  Issue <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={editFormData.notes || ''}
                  onChange={(e) => {
                    setEditFormData({ ...editFormData, notes: e.target.value });
                    setEditFormErrors({ ...editFormErrors, notes: '' });
                  }}
                  rows={3}
                  placeholder="Describe the issue in detail..."
                  className={`w-full px-4 py-3 bg-white border-2 rounded-xl text-sm transition-all focus:outline-none focus:ring-4 focus:ring-blue-500/20 resize-none ${
                    editFormErrors.notes
                      ? 'border-red-300 focus:border-red-500'
                      : editFormData.notes?.trim()
                        ? 'border-green-300 focus:border-green-500'
                        : 'border-gray-200 focus:border-blue-500'
                  }`}
                />
                <AnimatePresence>
                  {editFormErrors.notes && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-1.5 text-red-600 text-xs"
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                      {editFormErrors.notes}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Defect Status */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Settings className="w-4 h-4 text-gray-400" />
                  Defect Status <span className="text-red-500">*</span>
                </label>
                <SingleSelectDropdown
                  label="Status"
                  options={statusMaster.map(status => {
                    const config = statusColors[status];
                    return {
                      value: status,
                      label: config?.label || status
                    };
                  })}
                  value={editFormData.status}
                  onChange={(value) => {
                    setEditFormData({ ...editFormData, status: value });
                    setEditFormErrors({ ...editFormErrors, status: '' });
                  }}
                  placeholder="Select status..."
                  error={editFormErrors.status}
                  showSelectedLabel={false}
                />
                <AnimatePresence>
                  {editFormErrors.status && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-1.5 text-red-600 text-xs"
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                      {editFormErrors.status}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
            
            <div className="sticky bottom-0 bg-gray-50 border-t-2 border-gray-200 px-6 py-4 flex items-center justify-end gap-3 rounded-b-2xl">
              <button
                onClick={() => setEditModalOpen(false)}
                className="px-5 py-2.5 text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-all font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-6 py-2.5 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-all font-medium shadow-md flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Merge Modal */}
      {mergeModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-purple-700 text-white px-6 py-5 flex items-center justify-between rounded-t-2xl">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <GitMerge className="w-6 h-6" />
                  Merge Defects
                </h2>
                <p className="text-purple-100 mt-1">Select primary defect and merge {mergeCandidates.length} defects</p>
              </div>
              <button
                onClick={() => {
                  setMergeModalOpen(false);
                  setMergeCandidates([]);
                  setSelectedPrimaryId(null);
                }}
                className="text-white hover:bg-purple-800 p-2 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              {/* Info Box */}
              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-blue-900 mb-1">How Merging Works</h3>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• The <strong>primary defect</strong> will be the main record shown in the list</li>
                      <li>• <strong>Secondary defects</strong> will be linked to the primary defect</li>
                      <li>• All defects in the group will move together when status is updated</li>
                      <li>• You can unmerge defects later if needed</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Defect Selection Table */}
              <div className="border-2 border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                        Primary
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                        ID
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                        Vehicle
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                        Issue Description
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                        Notes
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                        Reported By
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                        Issue Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {mergeCandidates.map((defect) => {
                      const statusConfig = statusColors[defect.defect_status || ''] || statusColors.Open;
                      const isPrimary = defect.id === selectedPrimaryId;
                      
                      return (
                        <tr 
                          key={defect.id}
                          className={`hover:bg-gray-50 transition-colors ${isPrimary ? 'bg-purple-50 border-2 border-purple-400' : ''}`}
                        >
                          <td className="px-4 py-3">
                            <input
                              type="radio"
                              name="primary-defect"
                              checked={isPrimary}
                              onChange={() => setSelectedPrimaryId(defect.id)}
                              className="w-5 h-5 text-purple-600 border-2 border-gray-300 focus:ring-2 focus:ring-purple-500"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm font-bold text-gray-900">#{defect.id}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Bus className="w-4 h-4 text-gray-600" />
                              <span className="text-sm font-medium text-gray-900">{defect.vehicle_nickname}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="max-w-sm">
                              <p className="text-sm font-medium text-gray-900 line-clamp-2">{defect.repair_desc}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{defect.category_name}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="max-w-xs">
                              {defect.notes ? (
                                <p className="text-sm text-gray-700 line-clamp-2" title={defect.notes}>
                                  {defect.notes}
                                </p>
                              ) : (
                                <span className="text-xs text-gray-400 italic">No notes</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-gray-700">{formatDefectUserName(defect, 'reporter')}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}>
                              {statusConfig.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-gray-700">{formatDate(defect.issue_date)}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Selected Primary Info */}
              {selectedPrimaryId && (
                <div className="mt-4 p-4 bg-purple-50 border-2 border-purple-200 rounded-xl">
                  <div className="flex items-center gap-2 text-purple-900">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-bold">
                      Primary Defect: #{selectedPrimaryId}
                    </span>
                  </div>
                  <p className="text-sm text-purple-800 mt-1">
                    This defect will remain visible in the main list. The other {mergeCandidates.length - 1} defect(s) will be linked to it.
                  </p>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t-2 border-gray-200 px-6 py-4 flex items-center justify-end gap-3 rounded-b-2xl">
              <button
                onClick={() => {
                  setMergeModalOpen(false);
                  setMergeCandidates([]);
                  setSelectedPrimaryId(null);
                }}
                className="px-5 py-2.5 text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-all font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmMerge}
                disabled={!selectedPrimaryId || mergingDefects}
                className="px-5 py-2.5 text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-all font-medium shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {mergingDefects ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Merging...
                  </>
                ) : (
                  <>
                    <GitMerge className="w-5 h-5" />
                    Merge {mergeCandidates.length} Defects
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Create Defect Modal - Enhanced - Only show in defects tab */}
      {activeTab === 'defects' && (
        <CreateDefectModalEnhanced
          isOpen={createDefectModalOpen}
          onClose={() => setCreateDefectModalOpen(false)}
          onSuccess={() => {
            fetchDefects();
            fetchUnfilteredSummary(); // ✅ Refresh stat cards when new defect is created
          }}
          vehicles={vehicles}
          repairCategories={repairCategories}
        />
      )}

      {/* ✅ NEW: Run Maintenance Defects Preview Modal */}
      {runMaintenanceModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="px-8 py-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Run Maintenance Defects - Preview</h2>
                <p className="text-sm text-gray-600 mt-1">Review overdue and due soon scheduled maintenance items before creating defects</p>
              </div>
              <button
                onClick={() => {
                  setRunMaintenanceModalOpen(false);
                  setMaintenanceData(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-8 py-6">
              {loadingMaintenanceData ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <RefreshCw className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                  <p className="text-gray-600 text-lg">Scanning all vehicles for maintenance items...</p>
                </div>
              ) : maintenanceData ? (
                <>
                  {/* Summary Statistics */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-200 rounded-xl p-5">
                      <div className="text-red-600 text-sm font-semibold mb-1">OVERDUE</div>
                      <div className="text-3xl font-bold text-red-700">{maintenanceData.summary.overdue_count}</div>
                    </div>
                    <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-2 border-yellow-200 rounded-xl p-5">
                      <div className="text-yellow-700 text-sm font-semibold mb-1">DUE SOON</div>
                      <div className="text-3xl font-bold text-yellow-800">{maintenanceData.summary.due_soon_count}</div>
                    </div>
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl p-5">
                      <div className="text-blue-600 text-sm font-semibold mb-1">TOTAL ITEMS</div>
                      <div className="text-3xl font-bold text-blue-700">{maintenanceData.summary.total_items}</div>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200 rounded-xl p-5">
                      <div className="text-purple-600 text-sm font-semibold mb-1">VEHICLES</div>
                      <div className="text-3xl font-bold text-purple-700">{maintenanceData.summary.affected_vehicles}</div>
                    </div>
                  </div>

                  {/* Breakdown by Reason */}
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6">
                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <Info className="w-5 h-5 text-blue-600" />
                      Breakdown by Reason
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-900">{maintenanceData.summary.by_reason.kms_only}</div>
                        <div className="text-sm text-gray-600">KMS Only</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-900">{maintenanceData.summary.by_reason.duration_only}</div>
                        <div className="text-sm text-gray-600">Duration Only</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-900">{maintenanceData.summary.by_reason.both}</div>
                        <div className="text-sm text-gray-600">Both KMS & Duration</div>
                      </div>
                    </div>
                  </div>

                  {/* Overdue Items Table */}
                  {maintenanceData.data.overdue.length > 0 && (
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-bold text-red-700 flex items-center gap-2">
                          <AlertCircle className="w-5 h-5" />
                          Overdue Items ({maintenanceData.data.overdue.length})
                        </h3>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleSelectAllOverdue}
                            className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-300 rounded hover:bg-red-100 transition-colors"
                          >
                            Select All
                          </button>
                          <button
                            onClick={handleDeselectAllOverdue}
                            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-300 rounded hover:bg-gray-100 transition-colors"
                          >
                            Deselect All
                          </button>
                        </div>
                      </div>
                      <div className="overflow-x-auto border border-gray-200 rounded-lg">
                        <table className="w-full text-sm">
                          <thead className="bg-red-50">
                            <tr>
                              <th className="px-4 py-3 text-left font-semibold text-red-900 w-12">
                                <input
                                  type="checkbox"
                                  checked={maintenanceData.data.overdue.every((item: any, idx: number) => selectedMaintenanceItems.has(`overdue-${idx}`))}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      handleSelectAllOverdue();
                                    } else {
                                      handleDeselectAllOverdue();
                                    }
                                  }}
                                  className="w-4 h-4 text-red-600 border-2 border-gray-300 rounded focus:ring-2 focus:ring-red-500"
                                />
                              </th>
                              <th className="px-4 py-3 text-left font-semibold text-red-900">Vehicle</th>
                              <th className="px-4 py-3 text-left font-semibold text-red-900">Service</th>
                              <th className="px-4 py-3 text-left font-semibold text-red-900">Last Service KM</th>
                              <th className="px-4 py-3 text-left font-semibold text-red-900">Last Service Date</th>
                              <th className="px-4 py-3 text-left font-semibold text-red-900">KMS Progress</th>
                              <th className="px-4 py-3 text-left font-semibold text-red-900">Days Progress</th>
                              <th className="px-4 py-3 text-left font-semibold text-red-900">Reason</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 bg-white">
                            {maintenanceData.data.overdue.map((item: any, idx: number) => {
                              const itemId = `overdue-${idx}`;
                              const isSelected = selectedMaintenanceItems.has(itemId);
                              return (
                                <tr key={idx} className={`hover:bg-red-50 ${isSelected ? 'bg-red-100' : ''}`}>
                                  <td className="px-4 py-3">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => handleToggleMaintenanceItem(itemId)}
                                      className="w-4 h-4 text-red-600 border-2 border-gray-300 rounded focus:ring-2 focus:ring-red-500"
                                    />
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="font-semibold text-gray-900">{item.vehicle_nickname}</div>
                                  </td>
                                <td className="px-4 py-3 font-medium text-gray-900">{item.setting_name}</td>
                                <td className="px-4 py-3 text-gray-700">
                                  {item.last_replaced_km ? 
                                    `${parseFloat(item.last_replaced_km).toLocaleString()} km` : 
                                    <span className="text-red-600 font-medium">Missing</span>
                                  }
                                </td>
                                <td className="px-4 py-3 text-gray-700">
                                  {item.last_maintenance_date ? 
                                    item.last_maintenance_date.split('T')[0] : 
                                    <span className="text-red-600 font-medium">Missing</span>
                                  }
                                </td>
                                <td className="px-4 py-3 text-gray-700">
                                  {item.kms_threshold ? 
                                    `${parseFloat(item.current_km).toLocaleString()} / ${(parseFloat(item.last_replaced_km || 0) + parseFloat(item.kms_threshold)).toLocaleString()} km` : 
                                    'N/A'
                                  }
                                </td>
                                <td className="px-4 py-3 text-gray-700">{item.days_progress}</td>
                                <td className="px-4 py-3">
                                  <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${
                                    item.primary_reason === 'BOTH' ? 'bg-purple-100 text-purple-800' :
                                    item.primary_reason === 'KMS' ? 'bg-blue-100 text-blue-800' :
                                    'bg-orange-100 text-orange-800'
                                  }`}>
                                    {item.primary_reason}
                                  </span>
                                </td>
                              </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Due Soon Items Table */}
                  {maintenanceData.data.due_soon.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-bold text-yellow-700 flex items-center gap-2">
                          <Clock className="w-5 h-5" />
                          Due Soon Items ({maintenanceData.data.due_soon.length})
                        </h3>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleSelectAllDueSoon}
                            className="px-3 py-1.5 text-xs font-medium text-yellow-700 bg-yellow-50 border border-yellow-300 rounded hover:bg-yellow-100 transition-colors"
                          >
                            Select All
                          </button>
                          <button
                            onClick={handleDeselectAllDueSoon}
                            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-300 rounded hover:bg-gray-100 transition-colors"
                          >
                            Deselect All
                          </button>
                        </div>
                      </div>
                      <div className="overflow-x-auto border border-gray-200 rounded-lg">
                        <table className="w-full text-sm">
                          <thead className="bg-yellow-50">
                            <tr>
                              <th className="px-4 py-3 text-left font-semibold text-yellow-900 w-12">
                                <input
                                  type="checkbox"
                                  checked={maintenanceData.data.due_soon.every((item: any, idx: number) => selectedMaintenanceItems.has(`due_soon-${idx}`))}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      handleSelectAllDueSoon();
                                    } else {
                                      handleDeselectAllDueSoon();
                                    }
                                  }}
                                  className="w-4 h-4 text-yellow-600 border-2 border-gray-300 rounded focus:ring-2 focus:ring-yellow-500"
                                />
                              </th>
                              <th className="px-4 py-3 text-left font-semibold text-yellow-900">Vehicle</th>
                              <th className="px-4 py-3 text-left font-semibold text-yellow-900">Service</th>
                              <th className="px-4 py-3 text-left font-semibold text-yellow-900">Last Service KM</th>
                              <th className="px-4 py-3 text-left font-semibold text-yellow-900">Last Service Date</th>
                              <th className="px-4 py-3 text-left font-semibold text-yellow-900">KMS Progress</th>
                              <th className="px-4 py-3 text-left font-semibold text-yellow-900">Days Progress</th>
                              <th className="px-4 py-3 text-left font-semibold text-yellow-900">Reason</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 bg-white">
                            {maintenanceData.data.due_soon.map((item: any, idx: number) => {
                              const itemId = `due_soon-${idx}`;
                              const isSelected = selectedMaintenanceItems.has(itemId);
                              return (
                                <tr key={idx} className={`hover:bg-yellow-50 ${isSelected ? 'bg-yellow-100' : ''}`}>
                                  <td className="px-4 py-3">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => handleToggleMaintenanceItem(itemId)}
                                      className="w-4 h-4 text-yellow-600 border-2 border-gray-300 rounded focus:ring-2 focus:ring-yellow-500"
                                    />
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="font-semibold text-gray-900">{item.vehicle_nickname}</div>
                                  </td>
                                <td className="px-4 py-3 font-medium text-gray-900">{item.setting_name}</td>
                                <td className="px-4 py-3 text-gray-700">
                                  {item.last_replaced_km ? 
                                    `${parseFloat(item.last_replaced_km).toLocaleString()} km` : 
                                    <span className="text-yellow-600 font-medium">Missing</span>
                                  }
                                </td>
                                <td className="px-4 py-3 text-gray-700">
                                  {item.last_maintenance_date ? 
                                    item.last_maintenance_date.split('T')[0] : 
                                    <span className="text-yellow-600 font-medium">Missing</span>
                                  }
                                </td>
                                <td className="px-4 py-3 text-gray-700">
                                  {item.kms_threshold ? 
                                    `${parseFloat(item.current_km).toLocaleString()} / ${(parseFloat(item.last_replaced_km || 0) + parseFloat(item.kms_threshold)).toLocaleString()} km` : 
                                    'N/A'
                                  }
                                </td>
                                <td className="px-4 py-3 text-gray-700">{item.days_progress}</td>
                                <td className="px-4 py-3">
                                  <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${
                                    item.primary_reason === 'BOTH' ? 'bg-purple-100 text-purple-800' :
                                    item.primary_reason === 'KMS' ? 'bg-blue-100 text-blue-800' :
                                    'bg-orange-100 text-orange-800'
                                  }`}>
                                    {item.primary_reason}
                                  </span>
                                </td>
                              </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {maintenanceData.summary.total_items === 0 && (
                    <div className="text-center py-12">
                      <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                      <p className="text-xl font-semibold text-gray-900">All Caught Up!</p>
                      <p className="text-gray-600 mt-2">No overdue or due soon maintenance items found.</p>
                    </div>
                  )}
                </>
              ) : null}
            </div>

            {/* Footer */}
            <div className="px-8 py-6 border-t border-gray-200 bg-gray-50 flex items-center justify-between rounded-b-2xl">
              <div className="text-sm text-gray-600">
                {maintenanceData && (
                  <div className="flex flex-col gap-1">
                    <span>Generated at {new Date(maintenanceData.timestamp).toLocaleString()}</span>
                    {selectedMaintenanceItems.size > 0 && (
                      <span className="font-semibold text-blue-600">
                        {selectedMaintenanceItems.size} item{selectedMaintenanceItems.size !== 1 ? 's' : ''} selected
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setRunMaintenanceModalOpen(false);
                    setMaintenanceData(null);
                    setSelectedMaintenanceItems(new Set());
                  }}
                  className="px-6 py-2.5 text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-all font-medium"
                >
                  Close
                </button>
                <button
                  onClick={handleCreateMaintenanceDefects}
                  disabled={selectedMaintenanceItems.size === 0}
                  className="px-6 py-2.5 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-all font-medium shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Create Defects ({selectedMaintenanceItems.size})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View RO Modal - Opens directly in this component */}
      {viewROId && (
        <ViewRepairOrder
          roId={viewROId}
          onClose={() => setViewROId(null)}
          onRefresh={fetchDefects}
          onEdit={handleEditROFromView}
        />
      )}
 {/* Garage Repair Items Modal */}
      {garageModalDefect && (
        <GarageRepairItemsModal
          {...garageModalDefect}
          onClose={() => setGarageModalDefect(null)}
        />
      )}

        </>
      )}
    </div>
  );
}
