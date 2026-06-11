import { useState, useEffect, useRef } from 'react';
import { Plus, Filter, Search, ChevronRight, Eye, Edit, Ban, FileText, Truck, Building2, CheckCircle, Clock, XCircle, AlertCircle, Calendar, ArrowUpDown, ArrowUp, ArrowDown, X, Save, RefreshCcw, RefreshCw } from 'lucide-react';
import Select from 'react-select';
import { toast } from 'sonner@2.0.3';
import { API_BASE_URL, API_ENDPOINTS, buildApiUrl } from '../../config/api';
import { ViewRepairOrder } from './ViewRepairOrder';
import { CreateROModal } from './CreateROModal';
import { UpdateROModal } from './UpdateROModal';
import { DatePicker } from '../../components/ui/date-picker';
import { showConfirmationToast } from '../../utils/confirmationToast';

interface Vehicle {
  id: number;
  vehicle_nickname: string;
}

interface Vendor {
  id: number;
  vendor_name: string;
}

interface RepairOrder {
  created_on: string;
  rpoid: number;
  rpostatus: number;
  vehicle_nickname: string;
  kms_before_service: number;
  estimated_repair_amount: number;
  invoice_amount: number;
  vendor_name: string;
  invoice_number: string;
  work_order_number: string;
  service_completed_date: string | null;
  requested_by_name: string;
  payment_method_name: string;
  repair_notes: string;
  ro_source_type?: string;
  total_defects?: number;
  completed_defects?: number;
  rejected_defects?: number;
}

interface Defect {
  id: number;
  vrlid: number;
  category: string;
  repair_code_category: string;
  description: string;
  repair_desc: string;
  severity: string;
  issue_type: string;
  source: string;
  defect_source: string;
  status: string;
  defect_status: string;
  notes: string;
  is_duplicate?: string;
  merged_records_id?: string;
  merged_count?: number;
  primary_defect_id?: number;
  motive_def_unique_id?: string;
}

interface ScheduledMaintenanceItem {
  scsid: number;
  setting_name: string;
  setting_type: string;
  kms: number;
  kms_to_alert: number;
  days: number;
  days_to_alert: number;
  trip_actual_run_kms: number;
  days_from_effective_date: number;
  trip_actual_run_kms_htm: string;
  days_from_effective_date_htm: string;
}

interface User {
  id: number;
  uid: number;
  fullname: string;
  middlename?: string;
  lastname?: string;
  nickname?: string;
}

type SortColumn = 'created_on' | 'rpoid' | 'status' | 'vehicle_nickname' | 'kms_before_service' | 'estimated_repair_amount' | 'invoice_amount' | 'vendor_name' | 'invoice_number' | 'work_order_number' | 'service_completed_date' | 'requested_by_name' | 'payment_method_name' | 'repair_notes';
type SortOrder = 'ASC' | 'DESC';
type ModalMode = 'create' | 'edit' | null;

interface SelectOption {
  value: string | number;
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
  }),
  placeholder: (provided: any) => ({
    ...provided,
    color: '#9ca3af',
  }),
};

interface ManageROProps {
  preselectedVehicleId?: number;
  preselectedDefectIds?: string;
  onCreateROComplete?: () => void;
  autoOpenViewROId?: number; // Auto-open View RO modal for this RO ID
  autoOpenEditROId?: number; // Auto-open Edit RO modal for this RO ID
}

export function ManageRO({ 
  preselectedVehicleId, 
  preselectedDefectIds,
  onCreateROComplete,
  autoOpenViewROId,
  autoOpenEditROId
}: ManageROProps = {}) {
  // Filter states - Updated for react-select - ✅ DEFAULT: Pre-filter 'Ready to Complete' on page load
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<SelectOption | null>({ value: 'ready_to_complete', label: 'Ready to Complete' }); // ✅ Pre-select Ready to Complete
  const [vehicleFilter, setVehicleFilter] = useState<SelectOption | null>(null);
  const [vendorFilter, setVendorFilter] = useState<SelectOption | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('All');
  const [selectedStatusCard, setSelectedStatusCard] = useState<'All' | 'Active' | 'Finished' | 'Canceled' | 'ReadyToComplete'>('ReadyToComplete'); // ✅ Pre-select Ready to Complete card

  // Data states
  const [repairOrders, setRepairOrders] = useState<RepairOrder[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(true);

  // Statistics state
  const [statistics, setStatistics] = useState({
    activeCount: 0,
    finishedCount: 0,
    canceledCount: 0,
    readyToCompleteCount: 0
  });

  // ✅ NEW: Unfiltered statistics for stat cards (always shows total counts)
  const [unfilteredStatistics, setUnfilteredStatistics] = useState({
    totalCount: 0,
    activeCount: 0,
    finishedCount: 0,
    canceledCount: 0,
    readyToCompleteCount: 0
  });

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);

  // Ref for table container to handle scroll on pagination
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Sorting states
  const [sortColumn, setSortColumn] = useState<SortColumn>('created_on');
  const [sortOrder, setSortOrder] = useState<SortOrder>('DESC');

  // Modal and view states
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedROId, setSelectedROId] = useState<number | null>(null);
  const [selectedRO, setSelectedRO] = useState<RepairOrder | null>(null);
  const [editingRO, setEditingRO] = useState<RepairOrder | null>(null);
  const [editROData, setEditROData] = useState<any>(null);
  const [loadingEditData, setLoadingEditData] = useState(false);

  // Form state for create/edit
  const [formData, setFormData] = useState<any>({
    roNumber: '',
    vehicle: '',
    currentKm: '',
    vendor: '',
    priority: 'Medium',
    status: 'Draft',
    requestedBy: '',
    createdDate: new Date().toISOString().split('T')[0],
    estimatedAmount: '',
    actualAmount: '',
    notes: '',
    defects: []
  });

  const [selectedDefects, setSelectedDefects] = useState<number[]>([]);
  const [selectedScheduledItems, setSelectedScheduledItems] = useState<number[]>([]);
  const [availableDefects, setAvailableDefects] = useState<Defect[]>([]);
  const [availableScheduledItems, setAvailableScheduledItems] = useState<ScheduledMaintenanceItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingDefects, setLoadingDefects] = useState(false);
  const [loadingScheduled, setLoadingScheduled] = useState(false);
  const [activeDefectTab, setActiveDefectTab] = useState<'user' | 'motive' | 'scheduled'>('user');

  const priorities: Array<'Low' | 'Medium' | 'High' | 'Critical'> = ['Low', 'Medium', 'High', 'Critical'];
  const statuses = ['Draft', 'Pending', 'In Progress', 'Completed', 'Cancelled'];

  // Mock defect data
  const userDefects: Defect[] = [
    { id: 1, vrlid: 101, category: 'Engine', repair_code_category: 'E001', description: 'Engine overheating warning', repair_desc: 'Engine overheating warning', severity: 'High', issue_type: 'Mechanical', source: 'User', defect_source: 'User', status: 'Open', defect_status: 'Open', notes: 'Engine is overheating frequently' },
    { id: 2, vrlid: 102, category: 'Electrical', repair_code_category: 'E002', description: 'Headlight not working', repair_desc: 'Headlight not working', severity: 'Medium', issue_type: 'Electrical', source: 'User', defect_source: 'User', status: 'Open', defect_status: 'Open', notes: 'Headlight is not turning on' },
  ];

  const motiveDefects: Defect[] = [
    { id: 3, vrlid: 103, category: 'Brakes', repair_code_category: 'B001', description: 'Brake pad wear critical', repair_desc: 'Brake pad wear critical', severity: 'Critical', issue_type: 'Mechanical', source: 'Motive', defect_source: 'Motive', status: 'Open', defect_status: 'Open', notes: 'Brake pads are worn out' },
    { id: 4, vrlid: 104, category: 'Engine', repair_code_category: 'E003', description: 'Check engine light', repair_desc: 'Check engine light', severity: 'Medium', issue_type: 'Mechanical', source: 'Motive', defect_source: 'Motive', status: 'Pending', defect_status: 'Pending', notes: 'Check engine light is on' },
  ];

  const scheduledDefects: Defect[] = [
    { id: 5, vrlid: 105, category: 'Maintenance', repair_code_category: 'M001', description: 'Oil change due', repair_desc: 'Oil change due', severity: 'Low', issue_type: 'Maintenance', source: 'Scheduled', defect_source: 'Scheduled', status: 'Scheduled', defect_status: 'Scheduled', notes: 'Oil change is due' },
    { id: 6, vrlid: 106, category: 'Maintenance', repair_code_category: 'M002', description: 'Tire rotation due', repair_desc: 'Tire rotation due', severity: 'Low', issue_type: 'Maintenance', source: 'Scheduled', defect_source: 'Scheduled', status: 'Scheduled', defect_status: 'Scheduled', notes: 'Tire rotation is due' },
  ];

  // Fetch vehicles and vendors on mount
  useEffect(() => {
    fetchVehicles();
    fetchVendors();
    fetchUnfilteredStatistics(); // ✅ NEW: Fetch unfiltered stats on mount
  }, []);

  // Auto-open Create RO modal when navigating from ManageDefects with preselected data
  useEffect(() => {
    if (preselectedDefectIds && preselectedVehicleId) {
      // Wait for vehicles and vendors to load
      if (vehicles.length > 0 && vendors.length > 0) {
        setModalMode('create');
        toast.info('Opening Create RO with selected defects...', { duration: 2000 });
      }
    }
  }, [preselectedDefectIds, preselectedVehicleId, vehicles.length, vendors.length]);

  // Auto-open View RO modal when navigating from ManageDefects to view a specific RO
  useEffect(() => {
    if (autoOpenViewROId) {
      setSelectedROId(autoOpenViewROId);
      toast.info(`Opening Repair Order #${autoOpenViewROId}...`, { duration: 2000 });
    }
  }, [autoOpenViewROId]);

  // Auto-open Edit RO modal when navigating from ManageDefects View RO → Edit
  useEffect(() => {
    if (autoOpenEditROId) {
      handleEditFromView(autoOpenEditROId);
      toast.info(`Opening Edit RO for RO #${autoOpenEditROId}...`, { duration: 2000 });
    }
  }, [autoOpenEditROId]);

  // Debounce search term to avoid too many API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500); // 500ms delay

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset to page 1 when filters change (except pagination changes)
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, statusFilter, vehicleFilter, vendorFilter, dateFrom, dateTo, sortColumn, sortOrder, selectedStatusCard]);

  // Fetch repair orders when filters change
  useEffect(() => {
    fetchRepairOrders();
  }, [currentPage, sortColumn, sortOrder, debouncedSearchTerm, statusFilter, vehicleFilter, vendorFilter, dateFrom, dateTo, selectedStatusCard]);

  // Scroll to table when page changes (smooth scroll to prevent jarring jumps)
  useEffect(() => {
    if (tableContainerRef.current && currentPage > 1) {
      tableContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [currentPage]);

  // Load defects when edit mode is opened
  useEffect(() => {
    if (modalMode === 'edit' && editROData && editingRO) {
      console.log('🔄 Loading defects for edit mode:', editROData.defectIds);
      
      // Set form data from editROData
      setFormData({
        roNumber: editingRO.ro_number || '',
        vehicle: editROData.vehicle || '',
        currentKm: editingRO.kms_before_service?.toString() || '',
        vendor: editROData.vendor || '',
        status: getStatusName(editingRO.rpostatus) || 'Active',
        requestedBy: editingRO.requested_by_name || '',
        createdDate: formatDate(editingRO.created_on),
        estimatedAmount: editROData.estimatedAmount || '',
        actualAmount: editingRO.invoice_amount?.toString() || '',
        notes: editROData.notes || ''
      });
      
      // Populate available defects from all sources
      setAvailableDefects([...userDefects, ...motiveDefects, ...scheduledDefects]);
      
      // Set selected defects from editROData
      if (editROData.defectIds && editROData.defectIds.length > 0) {
        setSelectedDefects(editROData.defectIds);
        console.log('✅ Loaded defects:', editROData.defectIds);
      } else {
        setSelectedDefects([]);
        console.log('ℹ️ No defects found for this RO');
      }
    } else if (modalMode === 'create') {
      // Reset for create mode
      setFormData({
        roNumber: 'Auto-generated',
        vehicle: '',
        currentKm: '',
        vendor: '',
        status: 'Active',
        requestedBy: 'Current User',
        createdDate: formatDate(new Date().toISOString()),
        estimatedAmount: '',
        actualAmount: '',
        notes: ''
      });
      
      // Populate available defects from all sources
      setAvailableDefects([...userDefects, ...motiveDefects, ...scheduledDefects]);
      setSelectedDefects([]);
    }
  }, [modalMode, editROData, editingRO]);

  const fetchVehicles = async () => {
    try {
      const response = await fetch(buildApiUrl(`${API_ENDPOINTS.vehicles.base}?status=1`), {
        headers: {
          'ngrok-skip-browser-warning': 'true'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.success) {
        setVehicles(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        toast.error('Cannot connect to API server. Please check your ngrok tunnel connection.');
      } else {
        toast.error('Failed to load vehicles');
      }
    }
  };

  const fetchVendors = async () => {
    try {
      const response = await fetch(buildApiUrl(`${API_ENDPOINTS.vendors.base}?status=1`), {
        headers: {
          'ngrok-skip-browser-warning': 'true'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.success) {
        setVendors(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching vendors:', error);
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        toast.error('Cannot connect to API server. Please check your ngrok tunnel connection.');
      } else {
        toast.error('Failed to load vendors');
      }
    }
  };

  // ✅ NEW: Fetch unfiltered statistics (for stat cards that never change)
  const fetchUnfilteredStatistics = async () => {
    try {
      // Fetch with NO filters to get total counts
      const params = new URLSearchParams({
        page: '1',
        limit: '1', // We only need the statistics, not the records
        sortColumn: 'created_on',
        sortOrder: 'DESC'
      });

      const response = await fetch(buildApiUrl(`${API_ENDPOINTS.repairOrders.base}?${params}`), {
        headers: {
          'ngrok-skip-browser-warning': 'true'
        }
      });
      const data = await response.json();

      if (data.success) {
        setUnfilteredStatistics({
          totalCount: data.total || 0,
          activeCount: data.statistics?.activeCount || 0,
          finishedCount: data.statistics?.finishedCount || 0,
          canceledCount: data.statistics?.canceledCount || 0,
          readyToCompleteCount: data.statistics?.readyToCompleteCount || 0
        });
        console.log('📊 [UNFILTERED STATS] Loaded:', {
          total: data.total,
          statistics: data.statistics
        });
      }
    } catch (error) {
      console.error('Error fetching unfiltered statistics:', error);
    }
  };

  const fetchRepairOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        sortColumn,
        sortOrder,
      });

      if (debouncedSearchTerm) params.append('txtKey', debouncedSearchTerm);
      
      // ✅ Status card filter takes priority over dropdown filter
      if (selectedStatusCard !== 'All') {
        if (selectedStatusCard === 'ReadyToComplete') {
          // Filter for Active ROs only, we'll filter on backend
          params.append('txtStatus', '1');
          params.append('readyToComplete', 'true');
        } else {
          const statusMap = { 'Active': '1', 'Finished': '2', 'Canceled': '3' };
          params.append('txtStatus', statusMap[selectedStatusCard]);
        }
      } else if (statusFilter) {
        // ✅ Handle Ready to Complete from dropdown
        if (statusFilter.value === 'ready_to_complete') {
          params.append('txtStatus', '1');
          params.append('readyToComplete', 'true');
        } else {
          params.append('txtStatus', statusFilter.value.toString());
        }
      }
      
      if (vehicleFilter) params.append('txtVehicle', vehicleFilter.value.toString());
      if (vendorFilter) params.append('txtVendor', vendorFilter.value.toString());
      if (dateFrom) params.append('txtStarting', dateFrom);
      if (dateTo) params.append('txtEnds', dateTo);

      const response = await fetch(buildApiUrl(`${API_ENDPOINTS.repairOrders.base}?${params}`), {
        headers: {
          'ngrok-skip-browser-warning': 'true'
        }
      });
      const data = await response.json();
      
      if (data.success) {
        setRepairOrders(data.data || []);
        setTotalRecords(data.total || 0);
        setStatistics(data.statistics || {
          activeCount: 0,
          finishedCount: 0,
          canceledCount: 0,
          readyToCompleteCount: 0
        });
      } else {
        toast.error('Failed to load repair orders');
      }
    } catch (error) {
      console.error('Error fetching repair orders:', error);
      toast.error('Cannot connect to API server. Please check your ngrok tunnel connection.');
      setRepairOrders([]);
      setTotalRecords(0);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRO = async (rpoid: number) => {
    showConfirmationToast({
      title: 'Are you sure you want to cancel this Repair Order?',
      confirmText: 'OK',
      cancelText: 'Cancel',
      variant: 'destructive',
      onConfirm: async () => {
        try {
          const response = await fetch(buildApiUrl(API_ENDPOINTS.repairOrders.cancel), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify({ rpoid })
          });

          const data = await response.json();
          
          if (data.success) {
            toast.success('Repair order canceled successfully!');
            fetchRepairOrders();
            fetchUnfilteredStatistics(); // ✅ Refresh stat cards
          } else {
            toast.error(data.message || 'Failed to cancel repair order');
          }
        } catch (error) {
          console.error('Error canceling repair order:', error);
          toast.error('Failed to cancel repair order');
        }
      }
    });
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortColumn(column);
      setSortOrder('DESC');
    }
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter(null);
    setVehicleFilter(null);
    setVendorFilter(null);
    setDateFrom('');
    setDateTo('');
    setPriorityFilter('All');
    setCurrentPage(1);
  };

  const fetchROForEdit = async (rpoid: number) => {
    setLoadingEditData(true);
    try {
      const response = await fetch(
        buildApiUrl(`${API_ENDPOINTS.repairOrders.base}/${rpoid}/edit`), 
        {
          headers: { 'ngrok-skip-browser-warning': 'true' }
        }
      );
      const data = await response.json();
      
      if (data.success) {
setEditROData({
  vehicle: data.data.vehicle_id,
  requestedBy: data.data.requested_by_uid,
  busKms: data.data.kms_before_service.toString(),
  vendor: data.data.vendor_id,
  estimatedAmount: data.data.estimated_repair_amount.toString(),
  notes: data.data.repair_notes || '',
  defectIds: data.data.defect_ids || [],
  scheduledItemIds: data.data.scheduled_item_ids || [],
  vendor_locked: data.data.vendor_locked ?? false,        // ⭐ ADD THIS
  work_order_number: data.data.work_order_number || '',   // ⭐ ADD THIS
});
        setModalMode('edit');
      } else {
        toast.error('Failed to load RO details');
      }
    } catch (error) {
      console.error('Error fetching RO for edit:', error);
      toast.error('Failed to load RO details');
    } finally {
      setLoadingEditData(false);
    }
  };

  const handleOpenModal = async (mode: ModalMode, ro?: RepairOrder) => {
    if (mode === 'edit' && ro) {
      setEditingRO(ro);
      await fetchROForEdit(ro.rpoid);
    } else if (mode === 'create') {
      setEditingRO(null);
      setEditROData(null);
      setModalMode('create');
    }
  };

  const handleCloseModal = () => {
    setModalMode(null);
    setSelectedRO(null);
    setEditingRO(null);
    setEditROData(null);
    setFormData({});
    setSelectedDefects([]);
  };

  const handleEditFromView = async (roId: number) => {
    // Close the view modal
    setSelectedROId(null);
    
    // Find the RO from the list
    const ro = repairOrders.find(r => r.rpoid === roId);
    
    // If RO is in the list, use it; otherwise create a minimal object
    // This allows editing ROs that aren't in the current filtered/paginated view
    if (ro) {
      setEditingRO(ro);
    } else {
      // Create minimal RO object - fetchROForEdit will populate the full data
      setEditingRO({
        rpoid: roId,
        ro_number: `RO-${roId}`, // Temporary placeholder
        vehicle_nickname: '', // Will be populated by fetchROForEdit
        vendor_name: '', // Will be populated by fetchROForEdit
        rpostatus: '', // Will be populated by fetchROForEdit
        estimated_repair_amount: 0,
        kms_before_service: 0,
        requested_by_name: '',
        created_at: ''
      });
    }
    
    await fetchROForEdit(roId);
  };

  const handleSaveRO = () => {
    // TODO: Implement API call to save RO
    toast.success(`Repair Order ${formData.roNumber} saved successfully!`);
    handleCloseModal();
    fetchRepairOrders();
    fetchUnfilteredStatistics(); // ✅ Refresh stat cards
    if (onCreateROComplete) {
      onCreateROComplete();
    }
  };

  const handleVehicleChange = (vehicleId: string) => {
    // TODO: Fetch current KM from Motive API
    setFormData({
      ...formData,
      vehicle: vehicleId
    });
  };

  const handleAddDefect = (defect: Defect) => {
    if (!selectedDefects.find(d => d === defect.id)) {
      setSelectedDefects([...selectedDefects, defect.id]);
    }
  };

  const handleRemoveDefect = (id: string) => {
    setSelectedDefects(selectedDefects.filter(d => d !== id));
  };

  const getDefectsByTab = () => {
    switch (activeDefectTab) {
      case 'user': return userDefects;
      case 'motive': return motiveDefects;
      case 'scheduled': return scheduledDefects;
    }
  };

  const getStatusBadge = (status: number) => {
    switch (status) {
      case 1:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-blue-100 text-blue-700">
            <Clock className="w-3 h-3" />
            Active
          </span>
        );
      case 2:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-green-100 text-green-700">
            <CheckCircle className="w-3 h-3" />
            Finished
          </span>
        );
      case 3:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-red-100 text-red-700">
            <XCircle className="w-3 h-3" />
            Canceled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
            <AlertCircle className="w-3 h-3" />
            Unknown
          </span>
        );
    }
  };

  const getStatusName = (status: number) => {
    switch (status) {
      case 1: return 'Active';
      case 2: return 'Finished';
      case 3: return 'Canceled';
      default: return 'Unknown';
    }
  };

  // Helper function to check if RO is ready to be completed
  const getDefectCompletionStatus = (ro: RepairOrder) => {
    // ✅ Convert strings to numbers to prevent string concatenation ("1" + "0" = "10")
    const total = Number(ro.total_defects) || 0;
    const completed = Number(ro.completed_defects) || 0;
    const rejected = Number(ro.rejected_defects) || 0;
    const resolved = completed + rejected;

    return {
      total,
      completed,
      rejected,
      resolved,
      pending: total - resolved,
      isReadyToComplete: total > 0 && resolved === total,
      hasDefects: total > 0
    };
  };

  // Badge component for defect completion status
  const getDefectCompletionBadge = (ro: RepairOrder) => {
    // Only show for Active ROs
    if (ro.rpostatus !== 1) return null;

    const status = getDefectCompletionStatus(ro);

    // No defects - no badge
    if (!status.hasDefects) return null;

    // All defects resolved - Ready to Complete
    if (status.isReadyToComplete) {
      return (
        <span 
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-green-100 text-green-700 border border-green-300"
          title={`All ${status.total} defects resolved (${status.completed} completed, ${status.rejected} rejected)`}
        >
          <CheckCircle className="w-3 h-3" />
          Ready to Complete
        </span>
      );
    }

    // Some defects pending
    return (
      <span 
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-orange-100 text-orange-700 border border-orange-300"
        title={`${status.pending} of ${status.total} defects pending (${status.resolved} resolved)`}
      >
        <AlertCircle className="w-3 h-3" />
        {status.pending} Pending
      </span>
    );
  };

  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
    }
    return sortOrder === 'ASC' ? 
      <ArrowUp className="w-4 h-4 text-blue-600" /> : 
      <ArrowDown className="w-4 h-4 text-blue-600" />;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    // Format as YYYY-MM-DD to match system-wide standard
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Critical': return 'bg-red-100 text-red-800';
      case 'High': return 'bg-orange-100 text-orange-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      case 'Low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'Critical': return 'bg-red-50 text-red-700 border-red-200';
      case 'High': return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'Medium': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'Low': return 'bg-green-50 text-green-700 border-green-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const totalPages = Math.ceil(totalRecords / itemsPerPage);
  const startRecord = (currentPage - 1) * itemsPerPage + 1;
  const endRecord = Math.min(currentPage * itemsPerPage, totalRecords);

  // Calculate which page numbers to show (sliding window of 5 pages)
  const getPageNumbers = () => {
    const maxPagesToShow = 5;
    const pages: number[] = [];
    
    if (totalPages <= maxPagesToShow) {
      // If total pages <= 5, show all pages
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show a sliding window of 5 pages centered around current page
      let startPage = Math.max(1, currentPage - 2);
      let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
      
      // Adjust if we're near the end
      if (endPage - startPage < maxPagesToShow - 1) {
        startPage = Math.max(1, endPage - maxPagesToShow + 1);
      }
      
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
    }
    
    return pages;
  };

  const pageNumbers = getPageNumbers();

  // ✅ UPDATED: Use unfiltered statistics from API (counts from ALL data, never filtered)
  const totalCount = unfilteredStatistics.totalCount;
  const activeCount = unfilteredStatistics.activeCount;
  const finishedCount = unfilteredStatistics.finishedCount;
  const canceledCount = unfilteredStatistics.canceledCount;
  const readyToCompleteCount = unfilteredStatistics.readyToCompleteCount;

  // ✅ Handle status card click
  const handleStatusCardClick = (status: 'All' | 'Active' | 'Finished' | 'Canceled' | 'ReadyToComplete') => {
    setSelectedStatusCard(status);
    // ✅ FIXED: Always clear dropdown status filter when clicking ANY card (including 'All')
    // This ensures "Total ROs" card properly shows all records without any status filter
    setStatusFilter(null);
  };

  // ✅ Multi-level sorting: Active (most recent) → Finished (most recent) → Canceled (most recent)
  const getSortedRepairOrders = () => {
    return [...repairOrders].sort((a, b) => {
      // Priority order: Active (1) → Finished (2) → Canceled (3)
      const statusPriority = { 1: 1, 2: 2, 3: 3 };
      const priorityDiff = statusPriority[a.rpostatus as keyof typeof statusPriority] - statusPriority[b.rpostatus as keyof typeof statusPriority];
      
      if (priorityDiff !== 0) {
        return priorityDiff; // Sort by status first
      }
      
      // Within same status, sort by created_on DESC (most recent first)
      return new Date(b.created_on).getTime() - new Date(a.created_on).getTime();
    });
  };

  const sortedRepairOrders = getSortedRepairOrders();

  const renderModal = () => {
    if (!modalMode) return null;

    const isViewMode = false;
    const title = modalMode === 'create' ? 'Create Repair Order' : 'Edit Repair Order';

    return (
      <>
        {/* Backdrop */}
        <div 
          className="fixed inset-0 z-40 bg-black bg-opacity-50 transition-opacity duration-300"
          onClick={handleCloseModal}
        />
        
        {/* Sliding Panel */}
        <div className="fixed inset-y-0 right-0 z-50 w-full bg-white shadow-2xl flex flex-col animate-slide-in">
          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 bg-white">
            <div className="flex items-center gap-4">
              <button
                onClick={handleCloseModal}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <div>
                <h2 className="text-lg sm:text-xl text-gray-900">{title}</h2>
                <p className="text-sm text-gray-600 mt-0.5">{formData.roNumber}</p>
              </div>
            </div>
            <button
              onClick={handleSaveRO}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Save className="w-4 h-4" />
              {modalMode === 'create' ? 'Create RO' : 'Save Changes'}
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
            <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - RO Information */}
              <div className="lg:col-span-1 space-y-6">
                <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 sm:p-6">
                  <h3 className="text-base text-gray-900 mb-4">RO Information</h3>

                  <div className="space-y-4">
                    <div>
                      <label className="text-sm text-gray-600 mb-2 block">RO Number</label>
                      <input
                        type="text"
                        value={formData.roNumber}
                        disabled
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-600"
                      />
                    </div>

                    <div>
                      <label className="text-sm text-gray-600 mb-2 block">Vehicle *</label>
                      <select
                        value={formData.vehicle}
                        onChange={(e) => handleVehicleChange(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select Vehicle</option>
                        {vehicles.map(vehicle => (
                          <option key={vehicle.id} value={vehicle.id}>{vehicle.vehicle_nickname}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-sm text-gray-600 mb-2 block">Current Kilometer</label>
                      <input
                        type="text"
                        value={formData.currentKm}
                        disabled
                        placeholder="Auto-pulled from Motive"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-600"
                      />
                      {formData.currentKm && (
                        <p className="text-xs text-gray-500 mt-1">Synced from Motive API</p>
                      )}
                    </div>

                    <div>
                      <label className="text-sm text-gray-600 mb-2 block">Vendor</label>
                      <select
                        value={formData.vendor}
                        onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select Vendor</option>
                        {vendors.map(vendor => (
                          <option key={vendor.id} value={vendor.id}>{vendor.vendor_name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-sm text-gray-600 mb-2 block">Status</label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {statuses.map(status => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-sm text-gray-600 mb-2 block">Requested By</label>
                      <input
                        type="text"
                        value={formData.requestedBy}
                        disabled
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-600"
                      />
                    </div>

                    <div>
                      <label className="text-sm text-gray-600 mb-2 block">Created Date</label>
                      <input
                        type="date"
                        value={formData.createdDate}
                        disabled
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-600"
                      />
                    </div>

                    <div>
                      <label className="text-sm text-gray-600 mb-2 block">Estimated Amount</label>
                      <input
                        type="text"
                        value={formData.estimatedAmount}
                        onChange={(e) => setFormData({ ...formData, estimatedAmount: e.target.value })}
                        placeholder="$0.00"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="text-sm text-gray-600 mb-2 block">Actual Amount</label>
                      <input
                        type="text"
                        value={formData.actualAmount}
                        onChange={(e) => setFormData({ ...formData, actualAmount: e.target.value })}
                        placeholder="$0.00"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="text-sm text-gray-600 mb-2 block">Notes</label>
                      <textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="Additional notes..."
                        rows={4}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Defects */}
              <div className="lg:col-span-2 space-y-6">
                {/* Selected Defects */}
                <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 sm:p-6">
                  <h3 className="text-base text-gray-900 mb-4">Selected Defects ({selectedDefects.length})</h3>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {selectedDefects.length === 0 ? (
                      <div className="text-center py-12">
                        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-sm text-gray-500">No defects selected</p>
                        <p className="text-xs text-gray-400 mt-1">Add defects from the available list below</p>
                      </div>
                    ) : (
                      selectedDefects.map(defectId => {
                        const defect = availableDefects.find(d => d.id === defectId);
                        if (!defect) return null;
                        return (
                          <div key={defect.id} className="p-4 bg-white border border-blue-200 rounded-lg shadow-sm">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-sm text-gray-900">{defect.id}</span>
                                  <span className={`px-2 py-0.5 rounded text-xs border ${getSeverityColor(defect.severity)}`}>
                                    {defect.severity}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-700 mb-2">{defect.description}</p>
                                <div className="flex items-center gap-3">
                                  <span className="text-xs text-gray-500">{defect.category}</span>
                                  <span className="text-xs text-gray-400">•</span>
                                  <span className="text-xs text-gray-500">{defect.source}</span>
                                </div>
                              </div>
                              <button
                                onClick={() => handleRemoveDefect(defect.id)}
                                className="ml-3 p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Available Defects */}
                <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                  <div className="border-b border-gray-200 px-4 sm:px-6 py-3 bg-white">
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setActiveDefectTab('user')}
                        className={`px-4 py-2 text-sm border-b-2 transition-colors ${
                          activeDefectTab === 'user'
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        User Defects ({userDefects.length})
                      </button>
                      <button
                        onClick={() => setActiveDefectTab('motive')}
                        className={`px-4 py-2 text-sm border-b-2 transition-colors ${
                          activeDefectTab === 'motive'
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Motive Defects ({motiveDefects.length})
                      </button>
                      <button
                        onClick={() => setActiveDefectTab('scheduled')}
                        className={`px-4 py-2 text-sm border-b-2 transition-colors ${
                          activeDefectTab === 'scheduled'
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Scheduled ({scheduledDefects.length})
                      </button>
                    </div>
                  </div>

                  <div className="p-4 sm:p-6 bg-white">
                    <h4 className="text-sm text-gray-900 mb-4">Available Defects - Click to Add</h4>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {getDefectsByTab().map(defect => (
                        <div
                          key={defect.id}
                          className={`p-4 border rounded-lg cursor-pointer transition-all ${
                            selectedDefects.find(d => d === defect.id)
                              ? 'border-blue-300 bg-blue-50'
                              : 'border-gray-200 hover:border-blue-300 hover:shadow-sm bg-white'
                          }`}
                          onClick={() => handleAddDefect(defect)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-sm text-gray-900">{defect.id}</span>
                                <span className={`px-2 py-0.5 rounded text-xs border ${getSeverityColor(defect.severity)}`}>
                                  {defect.severity}
                                </span>
                              </div>
                              <p className="text-sm text-gray-700 mb-2">{defect.description}</p>
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-gray-500">{defect.category}</span>
                                <span className="text-xs text-gray-400">•</span>
                                <span className="text-xs text-gray-500">{defect.source}</span>
                              </div>
                            </div>
                            {selectedDefects.find(d => d === defect.id) && (
                              <CheckCircle className="w-5 h-5 text-blue-600 ml-3" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl text-gray-900 mb-1">Manage Repair Orders</h1>
          <p className="text-sm sm:text-base text-gray-600">View, create, and manage repair orders</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              fetchRepairOrders();
              fetchUnfilteredStatistics(); // ✅ Refresh stat cards
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm"
            title="Refresh data"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={() => handleOpenModal('create')}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-all shadow-md hover:shadow-lg"
          >
            <Plus className="w-5 h-5" />
            <span>Create RO</span>
          </button>
        </div>
      </div>

      {/* Stats Cards - Clickable with Visual Feedback */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <div 
          onClick={() => handleStatusCardClick('All')}
          className={`bg-white rounded-lg border p-4 cursor-pointer transition-all duration-200 hover:shadow-md ${
            selectedStatusCard === 'All' 
              ? 'border-blue-500 ring-2 ring-blue-200 shadow-md' 
              : 'border-gray-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              selectedStatusCard === 'All' ? 'bg-blue-100' : 'bg-blue-50'
            }`}>
              <FileText className={`w-5 h-5 ${
                selectedStatusCard === 'All' ? 'text-blue-700' : 'text-blue-600'
              }`} />
            </div>
            <div>
              <div className="text-xs text-gray-600">Total ROs</div>
              <div className="text-xl text-gray-900">{totalCount}</div>
            </div>
          </div>
        </div>

        <div 
          onClick={() => handleStatusCardClick('Active')}
          className={`bg-white rounded-lg border p-4 cursor-pointer transition-all duration-200 hover:shadow-md ${
            selectedStatusCard === 'Active' 
              ? 'border-blue-500 ring-2 ring-blue-200 shadow-md' 
              : 'border-gray-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              selectedStatusCard === 'Active' ? 'bg-blue-100' : 'bg-blue-50'
            }`}>
              <Clock className={`w-5 h-5 ${
                selectedStatusCard === 'Active' ? 'text-blue-700' : 'text-blue-600'
              }`} />
            </div>
            <div>
              <div className="text-xs text-gray-600">Active</div>
              <div className="text-xl text-gray-900">{activeCount}</div>
            </div>
          </div>
        </div>

        <div 
          onClick={() => handleStatusCardClick('ReadyToComplete')}
          className={`bg-white rounded-lg border p-4 cursor-pointer transition-all duration-200 hover:shadow-md ${
            selectedStatusCard === 'ReadyToComplete' 
              ? 'border-emerald-500 ring-2 ring-emerald-200 shadow-md' 
              : 'border-gray-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              selectedStatusCard === 'ReadyToComplete' ? 'bg-emerald-100' : 'bg-emerald-50'
            }`}>
              <CheckCircle className={`w-5 h-5 ${
                selectedStatusCard === 'ReadyToComplete' ? 'text-emerald-700' : 'text-emerald-600'
              }`} />
            </div>
            <div>
              <div className="text-xs text-gray-600">Ready to Complete</div>
              <div className="text-xl text-gray-900">{readyToCompleteCount}</div>
            </div>
          </div>
        </div>

        <div 
          onClick={() => handleStatusCardClick('Finished')}
          className={`bg-white rounded-lg border p-4 cursor-pointer transition-all duration-200 hover:shadow-md ${
            selectedStatusCard === 'Finished' 
              ? 'border-green-500 ring-2 ring-green-200 shadow-md' 
              : 'border-gray-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              selectedStatusCard === 'Finished' ? 'bg-green-100' : 'bg-green-50'
            }`}>
              <CheckCircle className={`w-5 h-5 ${
                selectedStatusCard === 'Finished' ? 'text-green-700' : 'text-green-600'
              }`} />
            </div>
            <div>
              <div className="text-xs text-gray-600">Finished</div>
              <div className="text-xl text-gray-900">{finishedCount}</div>
            </div>
          </div>
        </div>

        <div 
          onClick={() => handleStatusCardClick('Canceled')}
          className={`bg-white rounded-lg border p-4 cursor-pointer transition-all duration-200 hover:shadow-md ${
            selectedStatusCard === 'Canceled' 
              ? 'border-red-500 ring-2 ring-red-200 shadow-md' 
              : 'border-gray-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              selectedStatusCard === 'Canceled' ? 'bg-red-100' : 'bg-red-50'
            }`}>
              <XCircle className={`w-5 h-5 ${
                selectedStatusCard === 'Canceled' ? 'text-red-700' : 'text-red-600'
              }`} />
            </div>
            <div>
              <div className="text-xs text-gray-600">Canceled</div>
              <div className="text-xl text-gray-900">{canceledCount}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div
          className="flex items-center justify-between p-4 cursor-pointer"
          onClick={() => setFiltersOpen(!filtersOpen)}
        >
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg text-gray-900">Filters</h2>
          </div>
          <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${filtersOpen ? 'rotate-90' : ''}`} />
        </div>

        {filtersOpen && (
          <div className="border-t border-gray-200 p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Search Key */}
              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  Search Key
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search RO#, Vehicle, Vendor, Invoice, Notes..."
                    className={`w-full pl-10 pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      searchTerm ? 'border-blue-500' : 'border-gray-300'
                    }`}
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      title="Clear search"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  Status
                </label>
                <div className="relative">
                  <CheckCircle className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 z-10 pointer-events-none" />
                  <Select
                    value={statusFilter}
                    onChange={(option) => {
                      setStatusFilter(option);
                      // Clear status card selection when using dropdown
                      setSelectedStatusCard('All');
                    }}
                    options={[
                      { value: '1', label: 'Active' },
                      { value: '2', label: 'Finished' },
                      { value: '3', label: 'Canceled' },
                      { value: 'ready_to_complete', label: 'Ready to Complete' }
                    ]}
                    styles={customSelectStyles}
                    isClearable
                    placeholder="All"
                  />
                </div>
              </div>

              {/* Vehicle Filter */}
              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  Vehicle
                </label>
                <div className="relative">
                  <Truck className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 z-10 pointer-events-none" />
                  <Select
                    value={vehicleFilter}
                    onChange={(option) => setVehicleFilter(option)}
                    options={vehicles.map((vehicle) => ({
                      value: vehicle.id,
                      label: vehicle.vehicle_nickname
                    }))}
                    styles={customSelectStyles}
                    isClearable
                    placeholder="All"
                  />
                </div>
              </div>

              {/* Vendor Filter */}
              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  Vendor
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 z-10 pointer-events-none" />
                  <Select
                    value={vendorFilter}
                    onChange={(option) => setVendorFilter(option)}
                    options={vendors.map((vendor) => ({
                      value: vendor.id,
                      label: vendor.vendor_name
                    }))}
                    styles={customSelectStyles}
                    isClearable
                    placeholder="All"
                  />
                </div>
              </div>

              {/* Date From */}
              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  From Date
                </label>
                <DatePicker
                  value={dateFrom}
                  onChange={(date) => setDateFrom(date ? date.toISOString().split('T')[0] : '')}
                  placeholder="yyyy-mm-dd"
                />
              </div>

              {/* Date To */}
              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  To Date
                </label>
                <DatePicker
                  value={dateTo}
                  onChange={(date) => setDateTo(date ? date.toISOString().split('T')[0] : '')}
                  placeholder="yyyy-mm-dd"
                />
              </div>
            </div>

            {/* Filter Actions */}
            <div className="flex flex-wrap gap-2 mt-4">
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <RefreshCcw className="w-4 h-4" />
                Reset
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Results Summary */}
      <div className="text-sm text-gray-600">
        Showing {totalRecords > 0 ? startRecord : 0} to {endRecord} of {totalRecords} Repair Order(s)
      </div>

      {/* RO Table */}
      <div ref={tableContainerRef} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : repairOrders.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">No repair orders found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th 
                    className="px-4 py-3 text-left text-xs text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('created_on')}
                  >
                    <div className="flex items-center gap-1">
                      RO Date
                      {getSortIcon('created_on')}
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('rpoid')}
                  >
                    <div className="flex items-center gap-1">
                      RO Number
                      {getSortIcon('rpoid')}
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center gap-1">
                      Status
                      {getSortIcon('status')}
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('vehicle_nickname')}
                  >
                    <div className="flex items-center gap-1">
                      Vehicle
                      {getSortIcon('vehicle_nickname')}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs text-gray-700 uppercase tracking-wider">
                    Vendor
                  </th>
                  <th className="px-4 py-3 text-left text-xs text-gray-700 uppercase tracking-wider">
                    Service Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs text-gray-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sortedRepairOrders.map((ro) => (
                  <tr 
                    key={ro.rpoid}
                    className={`hover:bg-gray-50 transition-colors ${
                      ro.ro_source_type === 'Motive Defect' ? 'bg-blue-50' : ''
                    }`}
                  >
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                      {formatDate(ro.created_on)}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          setSelectedROId(ro.rpoid);
                        }}
                        className="text-blue-600 hover:text-blue-700 hover:underline inline-flex items-center gap-1 cursor-pointer bg-transparent border-none p-0"
                      >
                        <FileText className="w-3 h-3" />
                        RO{ro.rpoid}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getStatusBadge(ro.rpostatus)}
                        {getDefectCompletionBadge(ro)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {ro.vehicle_nickname}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {ro.vendor_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                      {ro.service_completed_date ? formatDate(ro.service_completed_date) : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedROId(ro.rpoid)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {ro.rpostatus !== 2 && ro.rpostatus !== 3 && (
                          <button
                            onClick={() => handleOpenModal('edit', ro)}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Bottom Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              Showing {startRecord} to {endRecord} of {totalRecords} results
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              <div className="flex items-center gap-1">
                {pageNumbers.map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-1 rounded text-sm ${
                      currentPage === page
                        ? 'bg-blue-600 text-white'
                        : 'border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal for Create/Edit */}
      <CreateROModal
        isOpen={modalMode === 'create' || modalMode === 'edit'}
        mode={modalMode === 'edit' ? 'edit' : 'create'}
        existingROId={editingRO?.rpoid}
        existingROData={editROData}
        onClose={() => {
          handleCloseModal();
          // Clear preselected data after closing
          if (onCreateROComplete) {
            onCreateROComplete();
          }
        }}
        onSuccess={(roId, mode) => {
          fetchRepairOrders();
          fetchUnfilteredStatistics(); // ✅ Refresh stat cards
          // Clear preselected data after success
          if (onCreateROComplete) {
            onCreateROComplete();
          }
          // If edit mode, open the View RO modal
          if (mode === 'edit' && roId) {
            setSelectedROId(roId);
          }
        }}
        vehicles={vehicles}
        vendors={vendors}
        preselectedDefectIds={preselectedDefectIds}
        preselectedVehicleId={preselectedVehicleId}
      />

      {/* View RO Details Modal */}
      {selectedROId && (
        <ViewRepairOrder
          roId={selectedROId}
          onClose={() => setSelectedROId(null)}
          onRefresh={fetchRepairOrders}
          onEdit={handleEditFromView}
        />
      )}
    </div>
  );
}