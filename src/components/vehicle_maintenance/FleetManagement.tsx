import React, { useState, Fragment, useEffect, useMemo } from 'react';
import { Power, Search, Upload, Download, X, Bus, Settings, RefreshCw, Pause, Play, Grid, List, Link as LinkIcon, ChevronDown, ChevronUp, Shield, Edit, CheckCircle, Wrench, Plus, ArrowRight, Calendar, Gauge, AlertCircle, ExternalLink, Send, Filter, Accessibility, Loader2, ArrowUpDown, ArrowUp, ArrowDown, Tag, Clock, User, FileText } from 'lucide-react';
import { MultiSelectFilter } from './MultiSelectFilter';
import { VehicleFilter } from './VehicleFilter';
import { toast } from 'sonner@2.0.3';
import { DatePicker } from '../../components/ui/date-picker';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router';
import { API_BASE_URL, API_ENDPOINTS, buildApiUrl, apiFetch } from '../../config/api';

interface ServiceSetting {
  id: string; // configuration_settings.id (assignment ID)
  setting_id: string; // scheduled_configuration_settings.id (master setting ID)
  setting_name: string;
  interval_type: 'KM' | 'Days' | 'Weeks' | 'Months' | 'Years' | 'Both'; // Type from the interval configuration
  maintenance_type?: string; // ✅ ADD THIS: Maintenance type (REGULAR, OVERHAUL, or display values)
  time_unit?: 'Days' | 'Weeks' | 'Months' | 'Years'; // Time unit for duration-based intervals
  kms: number;
  kms_to_alert: number;
  duration_days: number;
  duration_to_alert: number;
}

interface ServiceHistory {
  setting_id: string;
  replace_date: string;
  replaced_km: string;
}

interface MaintenanceConfiguration {
  id: string;
  configuration_name: string;
  vehicle_type: string;
  status: 'active' | 'inactive';
  settings: ServiceSetting[];
}

// Backend API Response Interface
interface VehicleApiResponse {
  id: number;
  vehicle_nickname: string;
  vehicle_type: string | null;
  vehicle_type_name?: string | null; // From vehicletypes table JOIN
  collection_name?: string | null; // From vehicles_collections table JOIN
  sub_collection_name?: string | null; // From vehicles_sub_collections table JOIN
  vehicle_number: string | null;
  vehicle_vin: string | null;
  asset_id: string | null;
  vehicle_configuration: string | null; // ID reference to scheduled_configurations table
  vehicle_configuration_name?: string | null; // From scheduled_configurations table JOIN
  current_km: number | null;
  km_sync_status?: 'synced' | 'paused' | 'resumed' | null; // KM sync status from Motive API
  status: number; // 1=Active, 0=Inactive, -1=Archived
  has_wheelchair: string; // 'yes' or 'no'
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_comments: string | null;
  status_label?: string;
}

interface Vehicle {
  id: string;
  vehicleNumber: string;
  vehicleType: string;
  collection: string;
  subCollection: string;
  vehicleConfiguration: string;
  make: string;
  model: string;
  year: string;
  vin: string;
  registrationNumber: string;
  capacity: string;
  fuelType: string;
  currentKm: string;
  status: 'Active' | 'Inactive';
  lastServiceDate: string;
  hasWheelchair: 'Yes' | 'No';
  customFields?: CustomField[];
  kmSyncStatus?: 'synced' | 'paused' | 'resumed' | null;
  assignedConfigurationId?: string | null;
  serviceHistory?: ServiceHistory[];
}

interface CustomField {
  id: string;
  fieldName: string;
  fieldType: 'text' | 'number' | 'date' | 'select';
  fieldValue: string;
  options?: string[];
}

interface FleetManagementProps {
  onNavigateToMaintenance?: () => void;
}

// API Helper Functions
const vehicleApi = {
  async getAll(filters?: Record<string, string>) {
    try {
      const queryParams = new URLSearchParams(filters).toString();
      const url = buildApiUrl(`${API_ENDPOINTS.vehicles.base}${queryParams ? `?${queryParams}` : ''}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw new Error('Cannot connect to backend server. Please check your ngrok tunnel connection');
      }
      throw error;
    }
  },

  async getById(id: string) {
    const response = await fetch(buildApiUrl(API_ENDPOINTS.vehicles.byId(id)), {
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    if (!response.ok) throw new Error('Failed to fetch vehicle');
    const data = await response.json();
    return data;
  },

  async updateKilometers(id: string, kmData: { current_km?: number; km_sync_status?: string; km_notes?: string }) {
    const response = await fetch(buildApiUrl(API_ENDPOINTS.vehicles.updateKilometers(id)), {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
      },
      body: JSON.stringify(kmData)
    });
    if (!response.ok) throw new Error('Failed to update kilometers');
    const data = await response.json();
    return data;
  },

  async updateStatus(id: string, status: number) {
    const response = await fetch(buildApiUrl(API_ENDPOINTS.vehicles.updateStatus(id)), {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
      },
      body: JSON.stringify({ status })
    });
    if (!response.ok) throw new Error('Failed to update status');
    const data = await response.json();
    return data;
  },

  async update(id: string, data: Partial<VehicleApiResponse>) {
    const response = await fetch(buildApiUrl(API_ENDPOINTS.vehicles.byId(id)), {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
      },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update vehicle');
    const result = await response.json();
    return result;
  }
};

// Map backend vehicle to frontend format
const mapVehicleFromApi = (apiVehicle: VehicleApiResponse): Vehicle => {
  return {
    id: apiVehicle.id.toString(),
    vehicleNumber: apiVehicle.vehicle_nickname || 'N/A',
    vehicleType: apiVehicle.vehicle_type_name || apiVehicle.vehicle_type || 'Unknown', // Use vehicle_type_name from JOIN
    collection: apiVehicle.collection_name || 'N/A', // From vehicles_collections table
    subCollection: apiVehicle.sub_collection_name || 'N/A', // From vehicles_sub_collections table
    vehicleConfiguration: apiVehicle.vehicle_configuration_name || 'N/A', // From scheduled_configurations table
    make: apiVehicle.vehicle_make || 'Unknown',
    model: apiVehicle.vehicle_model || 'Unknown',
    year: apiVehicle.vehicle_year || 'N/A',
    vin: apiVehicle.vehicle_vin || 'N/A',
    registrationNumber: apiVehicle.vehicle_number || 'N/A',
    capacity: '40 passengers', // Default - can be enhanced later
    fuelType: 'Diesel', // Default - can be enhanced later
    currentKm: apiVehicle.current_km ? apiVehicle.current_km.toLocaleString() : '0',
    status: apiVehicle.status === 1 ? 'Active' : 'Inactive',
    lastServiceDate: '2025-11-15', // Default - can be enhanced later
    hasWheelchair: apiVehicle.has_wheelchair === 'yes' ? 'Yes' : 'No', // Based on enum('yes','no')
    kmSyncStatus: apiVehicle.km_sync_status || null, // Map from database
    assignedConfigurationId: apiVehicle.vehicle_configuration ? apiVehicle.vehicle_configuration.toString() : null, // Map vehicle_configuration to assignedConfigurationId
    serviceHistory: [] // Will be stored separately
  };
};

export function FleetManagement({ onNavigateToMaintenance }: FleetManagementProps) {
  const navigate = useNavigate();
  
  // Maintenance Configurations from database (via API) - starts empty, populated by API call
  const [maintenanceConfigurations, setMaintenanceConfigurations] = useState<MaintenanceConfiguration[]>([]);
  
  // Keep mock data as fallback (commented out)
  /*const [maintenanceConfigurations, setMaintenanceConfigurations] = useState<MaintenanceConfiguration[]>([
    {
      id: 'conf-1',
      configuration_name: 'Standard City Bus Config (2020-2023)',
      vehicle_type: 'Standard City Bus',
      status: 'active',
      settings: [
        {
          id: 'set-1',
          setting_name: 'Engine Oil',
          interval_type: 'Both',
          time_unit: 'Days',
          kms: 25000,
          kms_to_alert: 20000,
          duration_days: 180,
          duration_to_alert: 160
        },
        {
          id: 'set-2',
          setting_name: 'Air Filter Replacement',
          interval_type: 'KM',
          time_unit: 'Days',
          kms: 50000,
          kms_to_alert: 45000,
          duration_days: 365,
          duration_to_alert: 330
        },
        {
          id: 'set-3',
          setting_name: 'Brake Inspection',
          interval_type: 'Months',
          time_unit: 'Months',
          kms: 40000,
          kms_to_alert: 35000,
          duration_days: 12,
          duration_to_alert: 11
        }
      ]
    },
    {
      id: 'conf-2',
      configuration_name: 'Standard City Bus Config (2015-2019)',
      vehicle_type: 'Standard City Bus',
      status: 'active',
      settings: [
        {
          id: 'set-4',
          setting_name: 'Engine Oil',
          interval_type: 'Both',
          time_unit: 'Days',
          kms: 20000,
          kms_to_alert: 18000,
          duration_days: 150,
          duration_to_alert: 140
        },
        {
          id: 'set-5',
          setting_name: 'Transmission Service',
          interval_type: 'Days',
          time_unit: 'Days',
          kms: 60000,
          kms_to_alert: 55000,
          duration_days: 540,
          duration_to_alert: 510
        }
      ]
    },
    {
      id: 'conf-3',
      configuration_name: 'Double Decker Bus Premium',
      vehicle_type: 'Double Decker Bus',
      status: 'active',
      settings: [
        {
          id: 'set-6',
          setting_name: 'Engine Oil',
          interval_type: 'Both',
          time_unit: 'Days',
          kms: 30000,
          kms_to_alert: 25000,
          duration_days: 200,
          duration_to_alert: 180
        },
        {
          id: 'set-7',
          setting_name: 'Coolant System Check',
          interval_type: 'Weeks',
          time_unit: 'Weeks',
          kms: 45000,
          kms_to_alert: 40000,
          duration_days: 52,
          duration_to_alert: 48
        },
        {
          id: 'set-8',
          setting_name: 'Brake Inspection',
          interval_type: 'KM',
          time_unit: 'Days',
          kms: 35000,
          kms_to_alert: 30000,
          duration_days: 270,
          duration_to_alert: 250
        }
      ]
    },
    {
      id: 'conf-4',
      configuration_name: 'Electric Bus Standard',
      vehicle_type: 'Electric Bus',
      status: 'active',
      settings: [
        {
          id: 'set-9',
          setting_name: 'Battery Health Check',
          interval_type: 'Both',
          time_unit: 'Days',
          kms: 15000,
          kms_to_alert: 12000,
          duration_days: 90,
          duration_to_alert: 75
        },
        {
          id: 'set-10',
          setting_name: 'Motor System Inspection',
          interval_type: 'Years',
          time_unit: 'Years',
          kms: 30000,
          kms_to_alert: 27000,
          duration_days: 1,
          duration_to_alert: 1
        },
        {
          id: 'set-11',
          setting_name: 'Brake System Check',
          interval_type: 'KM',
          time_unit: 'Days',
          kms: 25000,
          kms_to_alert: 22000,
          duration_days: 150,
          duration_to_alert: 135
        }
      ]
    },
    {
      id: 'conf-5',
      configuration_name: 'Electric Bus Extended Range',
      vehicle_type: 'Electric Bus',
      status: 'active',
      settings: [
        {
          id: 'set-9',
          setting_name: 'Battery Check',
          interval_type: 'Both',
          time_unit: 'Days',
          kms: 10000,
          kms_to_alert: 5000,
          duration_days: 365,
          duration_to_alert: 30
        },
        {
          id: 'set-10',
          setting_name: 'Brake Inspection',
          interval_type: 'Months',
          time_unit: 'Months',
          kms: 20000,
          kms_to_alert: 10000,
          duration_days: 24,
          duration_to_alert: 22
        }
      ]
    },
    {
      id: 'conf-6',
      configuration_name: 'Intercity Coach Long Distance',
      vehicle_type: 'Intercity Coach',
      status: 'active',
      settings: [
        {
          id: 'set-11',
          setting_name: 'Oil Change',
          interval_type: 'Both',
          time_unit: 'Days',
          kms: 10000,
          kms_to_alert: 5000,
          duration_days: 365,
          duration_to_alert: 30
        },
        {
          id: 'set-12',
          setting_name: 'Brake Inspection',
          interval_type: 'KM',
          time_unit: 'Days',
          kms: 20000,
          kms_to_alert: 10000,
          duration_days: 730,
          duration_to_alert: 30
        }
      ]
    },
    {
      id: 'conf-7',
      configuration_name: 'School Bus Standard',
      vehicle_type: 'School Bus',
      status: 'active',
      settings: [
        {
          id: 'set-13',
          setting_name: 'Oil Change',
          interval_type: 'Both',
          time_unit: 'Days',
          kms: 10000,
          kms_to_alert: 5000,
          duration_days: 365,
          duration_to_alert: 30
        },
        {
          id: 'set-14',
          setting_name: 'Brake Inspection',
          interval_type: 'Days',
          time_unit: 'Days',
          kms: 20000,
          kms_to_alert: 10000,
          duration_days: 730,
          duration_to_alert: 30
        }
      ]
    },
    {
      id: 'conf-8',
      configuration_name: 'School Bus Special Needs',
      vehicle_type: 'School Bus',
      status: 'active',
      settings: [
        {
          id: 'set-15',
          setting_name: 'Oil Change',
          interval_type: 'Both',
          time_unit: 'Days',
          kms: 10000,
          kms_to_alert: 5000,
          duration_days: 365,
          duration_to_alert: 30
        },
        {
          id: 'set-16',
          setting_name: 'Brake Inspection',
          interval_type: 'Weeks',
          time_unit: 'Weeks',
          kms: 20000,
          kms_to_alert: 10000,
          duration_days: 104,
          duration_to_alert: 100
        }
      ]
    }
  ]);*/

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State to store vehicle maintenance records for accordion display
  const [vehicleMaintenanceRecords, setVehicleMaintenanceRecords] = useState<{[vehicleId: string]: any[]}>({});
  
  // State to store service history logs
  const [serviceHistoryLogs, setServiceHistoryLogs] = useState<any[]>([]);

  // Fetch vehicles and configurations from API on component mount
  useEffect(() => {
    fetchVehicles();
    fetchMaintenanceConfigurations();
  }, []);

  const fetchMaintenanceConfigurations = async () => {
    try {
      // Clear existing configurations to ensure fresh data
      console.log('🧹 Clearing old configurations...');
      setMaintenanceConfigurations([]);
      
      console.log('📋 Fetching fresh maintenance configurations from API...');
      const response = await fetch(buildApiUrl(`${API_ENDPOINTS.scheduledConfigurations.base}?status=1&include_settings=true`), {
        headers: { 
          'ngrok-skip-browser-warning': 'true',
          'Cache-Control': 'no-cache'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch configurations');
      }

      const result = await response.json();
      console.log('📦 API Response:', result);
      console.log('📦 Raw data sample:', result.data?.[0]);

      if (result.success && result.data) {
        // Transform API data to match MaintenanceConfiguration type
        const transformedConfigs: MaintenanceConfiguration[] = result.data.map((config: any) => {
          console.log('🔄 Processing config:', config.id, config.configuration_name);
          console.log('🔄 Config settings:', config.settings);
          
          return {
            id: config.id.toString(),
            configuration_name: config.configuration_name,
            vehicle_type: 'All',  // No vehicle type filtering yet
            status: config.status === 1 ? 'active' : 'inactive',
            settings: Array.isArray(config.settings) ? config.settings.map((setting: any) => {
              console.log('⚙️ Setting:', {
                id: setting.id,
                name: setting.setting_name,
                interval_type: setting.interval_type,
                maintenance_type: setting.maintenance_type,
                time_unit: setting.time_unit,
                kms: setting.kms,
                kms_to_alert: setting.kms_to_alert,
                days: setting.days,
                days_to_alert: setting.days_to_alert
              });
              
              return {
                id: setting.id.toString(), // configuration_settings.id
                setting_id: setting.setting?.toString() || setting.id.toString(), // scheduled_configuration_settings.id
                setting_name: setting.setting_name || 'Unknown',
                interval_type: setting.interval_type || 'Both',
                maintenance_type: setting.maintenance_type || 'Regular Maintenance', // ✅ ADD THIS
                time_unit: setting.time_unit || undefined,
                kms: setting.kms || 0,
                kms_to_alert: setting.kms_to_alert || 0,
                duration_days: setting.days || 0,
                duration_to_alert: setting.days_to_alert || 0
              };
            }) : []
          };
        });

        setMaintenanceConfigurations(transformedConfigs);
        console.log('✅ Loaded fresh configurations:', transformedConfigs.length);
        console.log('📋 Configuration details:', transformedConfigs);
        
        if (transformedConfigs.length > 0) {
          toast.success(`Loaded ${transformedConfigs.length} fresh configurations from database`, { duration: 2000 });
        } else {
          console.warn('⚠️ No configurations returned from API');
        }
      }
    } catch (error) {
      console.error('❌ Error fetching maintenance configurations:', error);
      setMaintenanceConfigurations([]); // Clear configurations on error
      toast.error('Failed to load maintenance configurations', { 
        description: 'Please check your connection and try again',
        duration: 3000 
      });
    }
  };

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await vehicleApi.getAll();
      
      if (response.success && response.data) {
        const mappedVehicles = response.data.map(mapVehicleFromApi);
        setVehicles(mappedVehicles);
        toast.success(`Loaded ${mappedVehicles.length} vehicles from database`, { duration: 2000 });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load vehicles';
      setError(errorMessage);
      toast.error(errorMessage, { duration: 4000 });
      console.error('Error fetching vehicles:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch vehicle maintenance records from API
  const fetchVehicleMaintenanceRecords = async (vehicleId: string) => {
    try {
      console.log(`📋 Fetching maintenance records for vehicle ${vehicleId}...`);
      const response = await fetch(buildApiUrl(`/vehicle-scheduled-maintenance/${vehicleId}`), {
        headers: {
          'ngrok-skip-browser-warning': 'true'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch maintenance records: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success && result.data) {
        console.log(`✅ Loaded ${result.data.length} maintenance records for vehicle ${vehicleId}`);
        // Store records indexed by vehicle ID
        setVehicleMaintenanceRecords(prev => ({
          ...prev,
          [vehicleId]: result.data
        }));
        return result.data;
      }
    } catch (error) {
      console.error(`❌ Error fetching maintenance records for vehicle ${vehicleId}:`, error);
      return [];
    }
  };

  // Mock data for fallback (keeping first vehicle for reference)
  const mockVehicles: Vehicle[] = [
    {
      id: '1',
      vehicleNumber: 'BUS-001',
      vehicleType: 'Standard City Bus',
      collection: 'City Bus Fleet',
      subCollection: 'Route 101 Buses',
      vehicleConfiguration: 'Standard',
      make: 'Volvo',
      model: 'B7RLE',
      year: '2021',
      vin: '1VBAA00C2KD123456',
      registrationNumber: 'ABC-1234',
      capacity: '40 passengers',
      fuelType: 'Diesel',
      currentKm: '45,200',
      status: 'Active',
      lastServiceDate: '2025-11-15',
      hasWheelchair: 'No',
      kmSyncStatus: 'synced',
      assignedConfigurationId: 'conf-1',
      serviceHistory: [
        { setting_id: 'set-1', replace_date: '2025-10-15', replaced_km: '40,000' },
        { setting_id: 'set-3', replace_date: '2025-09-20', replaced_km: '35,000' }
      ]
    },
    {
      id: '2',
      vehicleNumber: 'BUS-002',
      vehicleType: 'Double Decker Bus',
      collection: 'City Bus Fleet',
      subCollection: 'Route 202 Buses',
      vehicleConfiguration: 'Premium',
      make: 'Mercedes',
      model: 'Citaro G',
      year: '2022',
      vin: '1VBAA00C3KD234567',
      registrationNumber: 'ABC-1235',
      capacity: '80 passengers',
      fuelType: 'Diesel',
      currentKm: '32,100',
      status: 'Active',
      lastServiceDate: '2025-11-20',
      hasWheelchair: 'Yes',
      kmSyncStatus: 'paused',
      assignedConfigurationId: 'conf-3',
      serviceHistory: [
        { setting_id: 'set-6', replace_date: '2025-11-01', replaced_km: '30,000' }
      ]
    },
    {
      id: '3',
      vehicleNumber: 'BUS-003',
      vehicleType: 'Electric Bus',
      collection: 'City Bus Fleet',
      subCollection: 'Route 101 Buses',
      vehicleConfiguration: 'Electric',
      make: 'BYD',
      model: 'K9',
      year: '2023',
      vin: '1VBAA00C4KD345678',
      registrationNumber: 'ABC-1236',
      capacity: '35 passengers',
      fuelType: 'Electric',
      currentKm: '18,500',
      status: 'Active',
      lastServiceDate: '2025-11-25',
      hasWheelchair: 'No',
      kmSyncStatus: 'resumed',
      assignedConfigurationId: 'conf-4',
    },
    {
      id: '4',
      vehicleNumber: 'BUS-004',
      vehicleType: 'Standard City Bus',
      collection: 'City Bus Fleet',
      subCollection: 'Route 101 Buses',
      vehicleConfiguration: 'Standard',
      make: 'Volvo',
      model: 'B8RLE',
      year: '2021',
      vin: '1VBAA00C5KD456789',
      registrationNumber: 'ABC-1237',
      capacity: '45 passengers',
      fuelType: 'Diesel',
      currentKm: '52,000',
      status: 'Active',
      lastServiceDate: '2025-11-10',
      hasWheelchair: 'Yes',
      kmSyncStatus: 'synced',
    },
    {
      id: '5',
      vehicleNumber: 'BUS-005',
      vehicleType: 'Electric Bus',
      collection: 'City Bus Fleet',
      subCollection: 'Route 202 Buses',
      make: 'BYD',
      model: 'K7M',
      year: '2023',
      vin: '1VBAA00C6KD567890',
      registrationNumber: 'ABC-1238',
      capacity: '30 passengers',
      fuelType: 'Electric',
      currentKm: '12,300',
      status: 'Active',
      lastServiceDate: '2025-11-28',
      hasWheelchair: 'No',
      kmSyncStatus: 'paused',
    },
    {
      id: '6',
      vehicleNumber: 'BUS-006',
      vehicleType: 'Intercity Coach',
      collection: 'Intercity Bus Fleet',
      subCollection: 'Express Service',
      make: 'Scania',
      model: 'Touring HD',
      year: '2022',
      vin: '1VBAA00C7KD678901',
      registrationNumber: 'ABC-1239',
      capacity: '55 passengers',
      fuelType: 'Diesel',
      currentKm: '67,800',
      status: 'Active',
      lastServiceDate: '2025-11-05',
      hasWheelchair: 'No',
      kmSyncStatus: 'synced',
    },
    {
      id: '7',
      vehicleNumber: 'BUS-007',
      vehicleType: 'School Bus',
      collection: 'School Bus Fleet',
      subCollection: 'Standard Service',
      make: 'Blue Bird',
      model: 'Vision',
      year: '2020',
      vin: '1VBAA00C8KD789012',
      registrationNumber: 'ABC-1240',
      capacity: '48 passengers',
      fuelType: 'Diesel',
      currentKm: '78,900',
      status: 'Active',
      lastServiceDate: '2025-11-01',
      hasWheelchair: 'Yes',
      kmSyncStatus: null,
    },
    {
      id: '8',
      vehicleNumber: 'BUS-008',
      vehicleType: 'Double Decker Bus',
      collection: 'City Bus Fleet',
      subCollection: 'Route 202 Buses',
      make: 'Alexander Dennis',
      model: 'Enviro500',
      year: '2021',
      vin: '1VBAA00C9KD890123',
      registrationNumber: 'ABC-1241',
      capacity: '90 passengers',
      fuelType: 'Hybrid',
      currentKm: '41,200',
      status: 'Active',
      lastServiceDate: '2025-11-18',
      hasWheelchair: 'Yes',
      kmSyncStatus: 'resumed',
    },
    {
      id: '9',
      vehicleNumber: 'BUS-009',
      vehicleType: 'Standard City Bus',
      collection: 'City Bus Fleet',
      subCollection: 'Route 101 Buses',
      make: 'Volvo',
      model: 'B7RLE',
      year: '2020',
      vin: '1VBAA00C0KD901234',
      registrationNumber: 'ABC-1242',
      capacity: '42 passengers',
      fuelType: 'Diesel',
      currentKm: '89,500',
      status: 'Inactive',
      lastServiceDate: '2025-10-20',
      hasWheelchair: 'No',
      kmSyncStatus: null,
    },
    {
      id: '10',
      vehicleNumber: 'BUS-010',
      vehicleType: 'Electric Bus',
      collection: 'City Bus Fleet',
      subCollection: 'Route 101 Buses',
      make: 'Proterra',
      model: 'ZX5',
      year: '2023',
      vin: '1VBAA00C1KD012345',
      registrationNumber: 'ABC-1243',
      capacity: '38 passengers',
      fuelType: 'Electric',
      currentKm: '15,600',
      status: 'Active',
      lastServiceDate: '2025-11-22',
      hasWheelchair: 'Yes',
      kmSyncStatus: 'synced',
    },
    {
      id: '11',
      vehicleNumber: 'BUS-011',
      vehicleType: 'Intercity Coach',
      collection: 'Intercity Bus Fleet',
      subCollection: 'Express Service',
      make: 'MAN',
      model: "Lion's Coach",
      year: '2022',
      vin: '1VBAA00C2KD123456',
      registrationNumber: 'ABC-1244',
      capacity: '50 passengers',
      fuelType: 'Diesel',
      currentKm: '54,300',
      status: 'Active',
      lastServiceDate: '2025-11-12',
      hasWheelchair: 'No',
      kmSyncStatus: 'resumed',
    },
    {
      id: '12',
      vehicleNumber: 'BUS-012',
      vehicleType: 'School Bus',
      collection: 'School Bus Fleet',
      subCollection: 'Standard Service',
      make: 'IC Bus',
      model: 'CE Series',
      year: '2021',
      vin: '1VBAA00C3KD234567',
      registrationNumber: 'ABC-1245',
      capacity: '44 passengers',
      fuelType: 'Diesel',
      currentKm: '62,100',
      status: 'Active',
      lastServiceDate: '2025-11-08',
      hasWheelchair: 'Yes',
      kmSyncStatus: 'paused',
    },
  ];

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterVehicle, setFilterVehicle] = useState<string[]>([]);
  const [filterVehicleType, setFilterVehicleType] = useState<string[]>([]);
  const [filterCollection, setFilterCollection] = useState<string[]>([]);
  const [filterKmSyncStatus, setFilterKmSyncStatus] = useState<string[]>([]);
  const [filterConfiguration, setFilterConfiguration] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedVehicleForConfig, setSelectedVehicleForConfig] = useState<Vehicle | null>(null);
  const [selectedConfigId, setSelectedConfigId] = useState<string>('');
  const [expandedAccordions, setExpandedAccordions] = useState<string[]>([]);
  const [expandedConfigsInModal, setExpandedConfigsInModal] = useState<string[]>([]);
  const [selectedServices, setSelectedServices] = useState<{[configId: string]: string[]}>({});
  
  // Fleet Action Modal States
  const [showFleetActionModal, setShowFleetActionModal] = useState(false);
  const [showMFAVerification, setShowMFAVerification] = useState(false);
  const [selectedVehicleForAction, setSelectedVehicleForAction] = useState<Vehicle | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [isMfaVerified, setIsMfaVerified] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [editingKm, setEditingKm] = useState(false);
  const [newKmValue, setNewKmValue] = useState('');
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [serviceFormData, setServiceFormData] = useState<{ replace_date: string; replaced_km: string }>({ replace_date: '', replaced_km: '' });
  const [showServiceHistoryPanel, setShowServiceHistoryPanel] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  
  // ✅ NEW: Track active RO assignments for scheduled maintenance settings
  // Format: { settingId: { roId, roStatus, roStatusText, rporStatus } }
  const [activeROAssignments, setActiveROAssignments] = useState<Record<string, any>>({});

  // Get unique values from actual vehicle data for filters
  // Use useMemo to prevent recalculation and maintain stable references
  const vehicleTypes = useMemo(() => 
    [...new Set(vehicles.map((v) => v.vehicleType).filter(Boolean))],
    [vehicles]
  );
  
  const collections = useMemo(() => 
    [...new Set(vehicles.map((v) => v.collection).filter(Boolean))],
    [vehicles]
  );

  // Get unique vehicle numbers for filter - sorted with Active vehicles first
  const vehicleNumbers = useMemo(() => {
    const uniqueVehicles = vehicles.filter((v, index, self) => 
      v.vehicleNumber && self.findIndex(t => t.vehicleNumber === v.vehicleNumber) === index
    );
    
    // Sort: Active vehicles first, then by vehicle number
    return uniqueVehicles
      .sort((a, b) => {
        // Active status first
        if (a.status === 'Active' && b.status !== 'Active') return -1;
        if (a.status !== 'Active' && b.status === 'Active') return 1;
        // Then by vehicle number
        return a.vehicleNumber.localeCompare(b.vehicleNumber);
      })
      .map(v => v.vehicleNumber);
  }, [vehicles]);
  
  const statuses = ['Active', 'Inactive'];
  const kmSyncStatuses = ['Synced', 'Paused', 'Resumed', 'Not Set'];

  // Toggle accordion for vehicle - only one open at a time
  const toggleAccordion = async (vehicleId: string) => {
    const isExpanding = !expandedAccordions.includes(vehicleId);
    
    // Close all and open only the clicked one, or close if clicking the open one
    setExpandedAccordions(prev =>
      prev.includes(vehicleId)
        ? [] // Close if already open
        : [vehicleId] // Open only this one, closing others
    );
    
    // Fetch maintenance records when expanding
    if (isExpanding) {
      await fetchVehicleMaintenanceRecords(vehicleId);
    }
  };

  // Get configuration details for a vehicle
  const getVehicleConfiguration = (assignedConfigId?: string | null): MaintenanceConfiguration | null => {
    if (!assignedConfigId) return null;
    return maintenanceConfigurations.find(c => c.id === assignedConfigId) || null;
  };

  // Get available configurations (all configurations regardless of status)
  const getAvailableConfigurations = (vehicleType: string) => {
    // Return all configurations - no status or vehicle type filtering
    return maintenanceConfigurations;
  };

  // Get assigned configuration name
  const getAssignedConfigurationName = (assignedConfigId?: string | null) => {
    if (!assignedConfigId) return null;
    const config = maintenanceConfigurations.find(c => c.id === assignedConfigId);
    return config?.configuration_name || null;
  };
  
  // Get unique configuration names for filter (must be after getAssignedConfigurationName is defined)
  const configurationNames = useMemo(() => 
    Array.from(new Set(
      vehicles
        .filter(v => v.assignedConfigurationId)
        .map(v => getAssignedConfigurationName(v.assignedConfigurationId))
        .filter((name): name is string => name !== null)
    )),
    [vehicles, maintenanceConfigurations]
  );

  const filteredVehicles = vehicles.filter((vehicle) => {
    const matchesSearch = 
      vehicle.vehicleNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vehicle.make.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vehicle.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vehicle.registrationNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vehicle.vin?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vehicle.year?.toString().includes(searchTerm) ||
      vehicle.vehicleType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vehicle.collection.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vehicle.subCollection?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vehicle.currentKm?.toString().includes(searchTerm) ||
      vehicle.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vehicle.kmSyncStatus?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus.length === 0 || filterStatus.includes(vehicle.status);
    const matchesVehicle = filterVehicle.length === 0 || filterVehicle.includes(vehicle.vehicleNumber);
    const matchesVehicleType = filterVehicleType.length === 0 || filterVehicleType.includes(vehicle.vehicleType);
    const matchesCollection = filterCollection.length === 0 || filterCollection.includes(vehicle.collection);
    
    // KM Sync Status filter
    const matchesKmSyncStatus = filterKmSyncStatus.length === 0 || filterKmSyncStatus.some(status => {
      if (status === 'Not Set') return !vehicle.kmSyncStatus;
      return vehicle.kmSyncStatus?.toLowerCase() === status.toLowerCase();
    });
    
    // Configuration filter
    const matchesConfiguration = filterConfiguration.length === 0 || filterConfiguration.some(configName => {
      const vehicleConfigName = getAssignedConfigurationName(vehicle.assignedConfigurationId);
      return vehicleConfigName === configName;
    });
    
    return matchesSearch && matchesStatus && matchesVehicle && matchesVehicleType && matchesCollection && matchesKmSyncStatus && matchesConfiguration;
  });

  // Handle column sorting
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new column and default to ascending
      setSortColumn(column);
      setSortDirection('asc');
    }
    // Reset to first page when sorting changes
    setCurrentPage(1);
  };

  // Apply sorting to filtered vehicles
  const sortedVehicles = [...filteredVehicles].sort((a, b) => {
    // If no sort column is selected, sort by status (Active first) by default
    if (!sortColumn) {
      // Active vehicles first, then Inactive
      if (a.status === 'Active' && b.status !== 'Active') return -1;
      if (a.status !== 'Active' && b.status === 'Active') return 1;
      // If both same status, sort by vehicle number
      return a.vehicleNumber.localeCompare(b.vehicleNumber);
    }

    let aValue: any;
    let bValue: any;

    switch (sortColumn) {
      case 'vehicleNumber':
        aValue = a.vehicleNumber.toLowerCase();
        bValue = b.vehicleNumber.toLowerCase();
        break;
      case 'vehicleType':
        aValue = a.vehicleType.toLowerCase();
        bValue = b.vehicleType.toLowerCase();
        break;
      case 'registration':
        aValue = a.registrationNumber.toLowerCase();
        bValue = b.registrationNumber.toLowerCase();
        break;
      case 'vin':
        aValue = (a.vin || '').toLowerCase();
        bValue = (b.vin || '').toLowerCase();
        break;
      case 'year':
        aValue = parseInt(a.year || '0');
        bValue = parseInt(b.year || '0');
        break;
      case 'collection':
        aValue = a.collection.toLowerCase();
        bValue = b.collection.toLowerCase();
        break;
      case 'vehicleConfiguration':
        aValue = a.vehicleConfiguration.toLowerCase();
        bValue = b.vehicleConfiguration.toLowerCase();
        break;
      case 'wheelchair':
        aValue = a.hasWheelchair === 'Yes' ? 1 : 0;
        bValue = b.hasWheelchair === 'Yes' ? 1 : 0;
        break;
      case 'currentKm':
        // Remove commas and parse as number
        aValue = parseInt(a.currentKm.replace(/,/g, ''));
        bValue = parseInt(b.currentKm.replace(/,/g, ''));
        break;
      case 'status':
        aValue = a.status.toLowerCase();
        bValue = b.status.toLowerCase();
        break;
      case 'kmSync':
        aValue = (a.kmSyncStatus || '').toLowerCase();
        bValue = (b.kmSyncStatus || '').toLowerCase();
        break;
      default:
        return 0;
    }

    // Compare values
    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const handleKmSyncAction = (vehicleId: string, action: 'synced' | 'paused' | 'resumed') => {
    setVehicles((prevVehicles) =>
      prevVehicles.map((v) =>
        v.id === vehicleId ? { ...v, kmSyncStatus: action } : v
      )
    );
  };

  // Handle opening Fleet Action modal with MFA
const handleOpenFleetAction = (vehicle: Vehicle) => {
  // Skip MFA on localhost
  const isLocalhost = window.location.hostname === 'localhost';
  
  setSelectedVehicleForAction(vehicle);
  
  if (isLocalhost) {
    // ✅ BYPASS MFA BUT LOAD DATA
    setShowFleetActionModal(true);
    setIsMfaVerified(true);
    setNewKmValue(vehicle.currentKm || '');
    
    // 🔥 Load maintenance data (same as handleMFAVerification does)
    fetchVehicleMaintenanceRecords(vehicle.id);
    fetchServiceHistoryLogs(vehicle.id);
    
  } else {
    // Production: Show MFA modal
    setShowMFAVerification(true);
  }
  
  setMfaCode('');
  setOtpSent(false);
  setSendingOtp(false);
};
  // Handle Send OTP
  const handleSendOtp = async () => {
    setSendingOtp(true);
    try {
      const response = await fetch(buildApiUrl(API_ENDPOINTS.otp.send), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true' 
        },
        credentials: 'include',
        body: JSON.stringify({
          purpose: 'FLEET_ACTION_VERIFICATION'
        })
      });

      const result = await response.json();

      if (result.success) {
        setSendingOtp(false);
        setOtpSent(true);
        
        // Show appropriate success message based on delivery method
        if (result.smsSent && result.emailSent) {
          toast.success('OTP sent to your phone and email', { duration: 3000 });
        } else if (result.smsSent) {
          toast.success('OTP sent successfully to your phone', { duration: 3000 });
        } else if (result.emailSent) {
          toast.success('OTP sent successfully to your email', { duration: 3000 });
        }
      } else {
        throw new Error(result.error || 'Failed to send OTP');
      }
    } catch (error: any) {
      setSendingOtp(false);
      console.error('Failed to send OTP:', error);
      toast.error(error.message || 'Failed to send OTP. Please try again.', { duration: 5000 });
    }
  };

  // Handle MFA Verification
  const handleMFAVerification = async () => {
    try {
      const response = await fetch(buildApiUrl(API_ENDPOINTS.otp.verify), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true' 
        },
        credentials: 'include',
        body: JSON.stringify({
          otp: mfaCode
        })
      });

      const result = await response.json();

      if (result.success) {
        setIsMfaVerified(true);
        setShowMFAVerification(false);
        setShowFleetActionModal(true);
        setNewKmValue(selectedVehicleForAction?.currentKm || '');
        toast.success('OTP verified successfully', { duration: 2000 });
        
        // Load maintenance records and service history when modal opens
        if (selectedVehicleForAction) {
          fetchVehicleMaintenanceRecords(selectedVehicleForAction.id);
          fetchServiceHistoryLogs(selectedVehicleForAction.id);
        }
      } else {
        toast.error(result.error || 'Invalid OTP. Please try again.', { duration: 3000 });
      }
    } catch (error: any) {
      console.error('Failed to verify OTP:', error);
      toast.error(error.message || 'Failed to verify OTP. Please try again.', { duration: 3000 });
    }
  };

  // Handle Fleet Action Modal Close
  const handleCloseFleetAction = () => {
    setShowFleetActionModal(false);
    setShowMFAVerification(false);
    setSelectedVehicleForAction(null);
    setMfaCode('');
    setIsMfaVerified(false);
    setOtpSent(false);
    setSendingOtp(false);
    setEditingKm(false);
    setNewKmValue('');
    setEditingServiceId(null);
    setServiceFormData({ replace_date: '', replaced_km: '' });
    setShowServiceHistoryPanel(false);
    setActiveROAssignments({}); // ✅ Clear active RO assignments
  };

  // Handle KM Update
  const handleUpdateKm = async () => {
    if (!selectedVehicleForAction || !newKmValue) return;
    
    try {
      // Remove commas and convert to number
      const kmNumber = parseInt(newKmValue.replace(/,/g, ''));
      
      // Update via API
      await vehicleApi.updateKilometers(selectedVehicleForAction.id, { current_km: kmNumber });
      
      // Update local state
      setVehicles((prevVehicles) =>
        prevVehicles.map((v) =>
          v.id === selectedVehicleForAction.id ? { ...v, currentKm: newKmValue } : v
        )
      );
      
      // Update selected vehicle
      setSelectedVehicleForAction(prev => prev ? { ...prev, currentKm: newKmValue } : null);
      
      toast.success(`Current KM updated to ${newKmValue} successfully`, { duration: 3000 });
      setEditingKm(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update kilometers';
      toast.error(errorMessage, { duration: 4000 });
      console.error('Error updating KM:', err);
    }
  };

  // Handle Sync Actions from Fleet Action Modal
  const handleFleetSyncAction = async (action: 'synced' | 'paused' | 'resumed') => {
    if (!selectedVehicleForAction) return;
    
    try {
      // Update via API
      await vehicleApi.updateKilometers(selectedVehicleForAction.id, {
        km_sync_status: action
      });
      
      // Update local state
      setVehicles((prevVehicles) =>
        prevVehicles.map((v) =>
          v.id === selectedVehicleForAction.id ? { ...v, kmSyncStatus: action } : v
        )
      );
      
      const actionText = action === 'paused' ? 'Paused' : action === 'resumed' ? 'Resumed' : 'Synced';
      toast.success(`KM Sync ${actionText} successfully`, { duration: 2000 });
      
      // Update selected vehicle state
      setSelectedVehicleForAction(prev => prev ? { ...prev, kmSyncStatus: action } : null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update KM sync status';
      toast.error(errorMessage, { duration: 4000 });
      console.error('Error updating KM sync status:', err);
    }
  };

  // Handle Sync Kilometers from Motive API
  const handleSyncKilometers = async () => {
    if (!selectedVehicleForAction) return;
    
    // Pre-check: Verify vehicle is active before attempting sync
    if (selectedVehicleForAction.status !== 'Active') {
      toast.error(
        <div>
          <div className="font-semibold">Cannot sync inactive vehicle</div>
          <div className="text-sm mt-1">
            Please activate vehicle <strong>{selectedVehicleForAction.vehicleNumber}</strong> first, then try syncing again.
          </div>
        </div>,
        { duration: 6000 }
      );
      return;
    }
    
    try {
      // Show loading toast
      const loadingToast = toast.loading(
        `Syncing kilometers for ${selectedVehicleForAction.vehicleNumber} from Motive API...`, 
        { duration: Infinity }
      );
      
      // Call sync endpoint
      const response = await apiFetch(API_ENDPOINTS.vehicles.syncKm(selectedVehicleForAction.id), {
        method: 'POST'
      });
      
      // Dismiss loading toast
      toast.dismiss(loadingToast);
      
      if (response.success) {
        const { data } = response;
        
        // Update local state with new kilometers
        setVehicles((prevVehicles) =>
          prevVehicles.map((v) =>
            v.id === selectedVehicleForAction.id ? { ...v, currentKm: data.new_km.toLocaleString() } : v
          )
        );
        
        // Update selected vehicle state
        setSelectedVehicleForAction(prev => prev ? { ...prev, currentKm: data.new_km.toLocaleString() } : null);
        
        // Show success with details
        toast.success(
          <div>
            <div className="font-semibold">Kilometers synced successfully!</div>
            <div className="text-sm mt-1">
              {data.nickname}: {data.previous_km?.toLocaleString() || 0} km → {data.new_km.toLocaleString()} km
            </div>
            <div className="text-xs text-gray-600 mt-1">Source: {data.source}</div>
          </div>,
          { duration: 5000 }
        );
      } else {
        throw new Error(response.message || response.error || 'Failed to sync kilometers');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sync kilometers';
      
      // Show user-friendly error messages with specific guidance
      if (errorMessage.includes('must be active')) {
        toast.error(
          <div>
            <div className="font-semibold">Vehicle must be active</div>
            <div className="text-sm mt-1">
              This vehicle is currently inactive. Please activate it first using the "Activate Vehicle" button below.
            </div>
          </div>,
          { duration: 6000 }
        );
      } else if (errorMessage.includes('not found in Motive')) {
        const unitMatch = errorMessage.match(/unit (\w+)/i);
        const unitNumber = unitMatch ? unitMatch[1] : selectedVehicleForAction.vehicleNumber;
        
        toast.error(
          <div>
            <div className="font-semibold">Vehicle not found in Motive API</div>
            <div className="text-sm mt-1">
              Unit <strong>{unitNumber}</strong> was not found in the Motive system.
            </div>
            <div className="text-xs text-gray-600 mt-2">
              Possible reasons:
              <ul className="list-disc list-inside mt-1">
                <li>Vehicle not registered in Motive</li>
                <li>Unit number mismatch</li>
                <li>Vehicle recently added (sync pending)</li>
              </ul>
            </div>
          </div>,
          { duration: 8000 }
        );
      } else if (errorMessage.includes('unit number not found')) {
        toast.error(
          <div>
            <div className="font-semibold">No unit number configured</div>
            <div className="text-sm mt-1">
              This vehicle does not have a unit number. Please add one in the vehicle details.
            </div>
          </div>,
          { duration: 6000 }
        );
      } else if (errorMessage.includes('Cannot connect to backend')) {
        toast.error(
          <div>
            <div className="font-semibold">Connection Error</div>
            <div className="text-sm mt-1">
              Cannot connect to the server. Please check if the backend is running.
            </div>
          </div>,
          { duration: 6000 }
        );
      } else {
        toast.error(
          <div>
            <div className="font-semibold">Sync Failed</div>
            <div className="text-sm mt-1">{errorMessage}</div>
          </div>,
          { duration: 5000 }
        );
      }
      
      console.error('Error syncing kilometers:', err);
    }
  };

  // Handle Status Change from Fleet Action Modal
  const handleFleetStatusChange = async (newStatus: 'Active' | 'Inactive') => {
    if (!selectedVehicleForAction) return;
    
    try {
      // Convert status to API format: 1=Active, 0=Inactive
      const statusValue = newStatus === 'Active' ? 1 : 0;
      
      // Update via API
      await vehicleApi.updateStatus(selectedVehicleForAction.id, statusValue);
      
      // Update local state
      setVehicles((prevVehicles) =>
        prevVehicles.map((v) =>
          v.id === selectedVehicleForAction.id ? { ...v, status: newStatus } : v
        )
      );
      
      toast.success(`Vehicle ${newStatus === 'Active' ? 'activated' : 'inactivated'} successfully`, { duration: 3000 });
      
      // Update selected vehicle state
      setSelectedVehicleForAction(prev => prev ? { ...prev, status: newStatus } : null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update vehicle status';
      toast.error(errorMessage, { duration: 4000 });
      console.error('Error updating vehicle status:', err);
    }
  };

  // Handle Edit Service History
  const handleEditService = async (settingId: string, maintenanceRecord?: any) => {
    // ✅ First check if this maintenance item is assigned to an active RO
    if (selectedVehicleForAction?.id) {
      try {
        const response = await fetch(
          buildApiUrl(`/repair-orders/check-scheduled-maintenance-active/${settingId}?vehicle_id=${selectedVehicleForAction.id}`)
        );
        
        if (!response.ok) {
          throw new Error('Failed to check maintenance status');
        }
        
        const result = await response.json();
        
        if (result.isAssigned && result.data) {
          // ❌ Item is in an active RO - show warning and prevent edit
          toast.error(
            `Cannot edit: This maintenance item is currently assigned to RO #${result.data.roId} (${result.data.roStatusText}). Please complete or cancel that RO first.`,
            { duration: 6000 }
          );
          console.warn('🚫 Edit blocked - Item in active RO:', result.data);
          return; // Prevent editing
        }
      } catch (err) {
        console.error('Error checking maintenance status:', err);
        toast.error('Failed to verify maintenance status. Please try again.', { duration: 3000 });
        return;
      }
    }
    
    // ✅ All good - proceed with edit
    setEditingServiceId(settingId);
    if (maintenanceRecord && (maintenanceRecord.last_maintenance_date || maintenanceRecord.last_replaced_km)) {
      // Prefill with data from vehicle_scheduled_maintenance table
      setServiceFormData({
        replace_date: maintenanceRecord.last_maintenance_date || '',
        replaced_km: maintenanceRecord.last_replaced_km 
          ? maintenanceRecord.last_replaced_km.toLocaleString() 
          : ''
      });
    } else {
      setServiceFormData({ replace_date: '', replaced_km: '' });
    }
  };

  // ✅ Fetch active RO assignments for all scheduled maintenance settings
  const fetchActiveROAssignments = async (vehicleId: number, settingIds: string[]) => {
    if (!vehicleId || settingIds.length === 0) {
      setActiveROAssignments({});
      return;
    }

    try {
      console.log(`🔍 Fetching active RO assignments for ${settingIds.length} settings...`);
      
      // Fetch all settings in parallel
      const promises = settingIds.map(settingId => 
        fetch(buildApiUrl(`/repair-orders/check-scheduled-maintenance-active/${settingId}?vehicle_id=${vehicleId}`))
          .then(res => res.json())
          .then(result => ({
            settingId,
            isAssigned: result.isAssigned,
            data: result.data
          }))
          .catch(err => {
            console.error(`Error checking setting ${settingId}:`, err);
            return { settingId, isAssigned: false, data: null };
          })
      );

      const results = await Promise.all(promises);
      
      // Build a map of settingId -> RO data
      const assignmentsMap: Record<string, any> = {};
      results.forEach(result => {
        if (result.isAssigned && result.data) {
          assignmentsMap[result.settingId?.toString()] = result.data;
        }
      });

      console.log(`✅ Found ${Object.keys(assignmentsMap).length} settings with active RO assignments:`, assignmentsMap);
      console.log('📋 Assignment Map Keys:', Object.keys(assignmentsMap));
      setActiveROAssignments(assignmentsMap);
      
    } catch (err) {
      console.error('Error fetching active RO assignments:', err);
      setActiveROAssignments({});
    }
  };

  // Handle Save Service History
  const handleSaveServiceHistory = async (settingId: string, maintenanceRecord?: any) => {
    if (!selectedVehicleForAction || !serviceFormData.replace_date || !serviceFormData.replaced_km) {
      toast.error('Please fill in all fields', { duration: 2000 });
      return;
    }

    const loadingToast = toast.loading('Updating service history...');

    try {
      // Extract date only (YYYY-MM-DD) from the date input
      const dateOnly = serviceFormData.replace_date.split('T')[0];
      
      // Prepare update data for vehicle_scheduled_maintenance table
      const updateData = {
        last_maintenance_date: dateOnly,
        last_replaced_km: parseInt(serviceFormData.replaced_km.replace(/,/g, ''))
      };

      // Update via API - use the maintenance record ID
      if (!maintenanceRecord || !maintenanceRecord.id) {
        throw new Error('Maintenance record not found. Please refresh and try again.');
      }

      console.log('🔄 Updating maintenance record:', {
        id: maintenanceRecord.id,
        updateData
      });

      const response = await fetch(buildApiUrl(`/vehicle-scheduled-maintenance/${maintenanceRecord.id}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData)
      }).catch(err => {
        console.error('Network error:', err);
        throw new Error('Cannot connect to server. Please ensure the backend is running.');
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ 
          message: `Server returned ${response.status}: ${response.statusText}` 
        }));
        throw new Error(errorData.message || 'Failed to update service history');
      }

      const result = await response.json();
      console.log('✅ Service history updated successfully:', result);

      // Get the setting name for the log
      const config = getVehicleConfiguration(selectedVehicleForAction.assignedConfigurationId || '');
      const setting = config?.settings.find(s => s.setting_id === settingId);
      
      // Create activity log (non-blocking - don't await)
      createActivityLog({
        source: 'Service Maintenance History',
        remark: `Updated service history for ${selectedVehicleForAction.vehicleNumber} - ${setting?.setting_name || 'Service'}`,
        oldValue: {
          vehicleId: selectedVehicleForAction.id,
          vehicleNumber: selectedVehicleForAction.vehicleNumber,
          settingId: settingId,
          settingName: setting?.setting_name,
          date: maintenanceRecord.last_maintenance_date,
          km: maintenanceRecord.last_replaced_km
        },
        updatedValue: {
          vehicleId: selectedVehicleForAction.id,
          vehicleNumber: selectedVehicleForAction.vehicleNumber,
          settingId: settingId,
          settingName: setting?.setting_name,
          date: dateOnly,
          km: parseInt(serviceFormData.replaced_km.replace(/,/g, ''))
        }
      });

      // Refresh maintenance records to get updated data
      await fetchVehicleMaintenanceRecords(selectedVehicleForAction.id);
      
      // Refresh service history logs (non-blocking)
      fetchServiceHistoryLogs(selectedVehicleForAction.id);

      toast.dismiss(loadingToast);
      toast.success(
        `✅ Service history saved! Date: ${serviceFormData.replace_date}, KM: ${serviceFormData.replaced_km}`, 
        { duration: 3000 }
      );
      setEditingServiceId(null);
      setServiceFormData({ replace_date: '', replaced_km: '' });
    } catch (error) {
      toast.dismiss(loadingToast);
      console.error('❌ Error updating service history:', error);
      
      // More specific error messages
      let errorMessage = 'Failed to update service history';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage, { duration: 5000 });
    }
  };

  // Handle Cancel Service Edit
  const handleCancelServiceEdit = () => {
    setEditingServiceId(null);
    setServiceFormData({ replace_date: '', replaced_km: '' });
  };

  // Create activity log entry
  const createActivityLog = async (logData: {
    source: string;
    remark: string;
    oldValue?: any;
    updatedValue?: any;
  }) => {
    try {
      console.log('📝 Creating activity log...', logData);
      
      const payload = {
        user_id: 1, // TODO: Replace with actual user ID from auth context
        source: logData.source,
        remark: logData.remark,
        old_value: logData.oldValue ? JSON.stringify(logData.oldValue) : null,
        updated_value: logData.updatedValue ? JSON.stringify(logData.updatedValue) : null,
        ip_address: 'N/A', // Browser doesn't expose real IP
        browser: navigator.userAgent
      };
      
      console.log('📝 Activity log payload:', payload);
      
      const response = await fetch(buildApiUrl(API_ENDPOINTS.activityLogs.base), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify(payload)
      });

      const responseData = await response.json().catch(() => null);
      
      if (!response.ok) {
        console.error('❌ Failed to create activity log:', response.status, responseData);
        // Don't throw error - logging is non-critical
      } else {
        console.log('✅ Activity log created successfully:', responseData);
      }
    } catch (error) {
      console.error('❌ Error creating activity log:', error);
      // Don't throw error - logging is non-critical, shouldn't block main operation
    }
  };

  // Fetch service history logs for a vehicle
  const fetchServiceHistoryLogs = async (vehicleId: string) => {
    try {
      console.log('📋 Fetching service history logs for vehicle:', vehicleId);
      
      const response = await fetch(
        buildApiUrl(`${API_ENDPOINTS.activityLogs.base}?source=Service Maintenance History&limit=50`),
        {
          headers: { 'ngrok-skip-browser-warning': 'true' }
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('📋 Received logs:', data);
        
        // Filter logs for the specific vehicle
        const vehicleLogs = data.data.filter((log: any) => {
          try {
            const updatedValue = JSON.parse(log.updatedValue);
            return updatedValue.vehicleId === vehicleId || updatedValue.vehicle_id === vehicleId;
          } catch {
            return false;
          }
        });
        
        console.log('📋 Filtered logs for vehicle:', vehicleLogs);
        setServiceHistoryLogs(vehicleLogs);
      } else {
        console.error('❌ Failed to fetch logs:', response.status);
        setServiceHistoryLogs([]);
      }
    } catch (error) {
      console.error('❌ Error fetching service history logs:', error);
      setServiceHistoryLogs([]);
    }
  };

  // Handle opening configuration assignment modal
  const handleOpenConfigModal = async (vehicle: Vehicle) => {
    setSelectedVehicleForConfig(vehicle);
    setSelectedConfigId(vehicle.assignedConfigurationId || '');
    
    // Fetch fresh configuration data from API before opening modal
    console.log('🔄 Fetching fresh configuration data for modal...');
    await fetchMaintenanceConfigurations();
    
    // Fetch vehicle's current maintenance records to determine which settings are active
    console.log('🔄 Fetching vehicle maintenance records for modal...');
    const currentMaintenanceRecords = await fetchVehicleMaintenanceRecords(vehicle.id);
    
    // Wait a moment for state to update, then initialize selected services
    setTimeout(() => {
      const initialSelections: {[configId: string]: string[]} = {};
      getAvailableConfigurations(vehicle.vehicleType).forEach(config => {
        // ✅ NEW LOGIC: If this is the vehicle's currently assigned configuration, select ALL settings
        if (vehicle.assignedConfigurationId && config.id === vehicle.assignedConfigurationId) {
          // Auto-select ALL settings from the assigned configuration
          const allSettingIds = config.settings.map(s => s.id);
          initialSelections[config.id] = allSettingIds;
          console.log(`✅ Config ${config.configuration_name} (ASSIGNED): Auto-selected all ${allSettingIds.length} settings`);
        } else {
          // For other configurations, only select settings that are currently active for this vehicle
          const activeSettingIds = config.settings
            .filter(setting => {
              // Check if this setting has an active record in vehicle_scheduled_maintenance
              const hasActiveRecord = currentMaintenanceRecords.some(
                (record: any) => 
                  record.scheduled_maintenance?.toString() === setting.setting_id?.toString() && 
                  record.status === 1 // Only active records
              );
              return hasActiveRecord;
            })
            .map(s => s.id); // Use configuration_settings.id for the selection
          
          initialSelections[config.id] = activeSettingIds;
          console.log(`Config ${config.configuration_name}: ${activeSettingIds.length} active settings selected`);
        }
      });
      setSelectedServices(initialSelections);
    }, 100);
    
    setShowConfigModal(true);
  };

  // Handle assigning configuration to vehicle
  const handleAssignConfiguration = async () => {
    if (!selectedVehicleForConfig || !selectedConfigId) return;
    
    const selectedServiceIds = selectedServices[selectedConfigId] || [];
    if (selectedServiceIds.length === 0) {
      toast.error('Please select at least one service to assign', { duration: 3000 });
      return;
    }
    
    const config = maintenanceConfigurations.find(c => c.id === selectedConfigId);
    const configName = config?.configuration_name || 'Configuration';
    
    // Show loading toast
    const loadingToast = toast.loading('Assigning configuration...');
    
    try {
      // Get today's date in YYYY-MM-DD format
      const today = new Date().toISOString().split('T')[0];
      
      // Prepare the data for vehicle_scheduled_maintenance table
      // Map configuration_settings.id to scheduled_configuration_settings.id
      const maintenanceData = selectedServiceIds.map(configSettingId => {
        // Find the setting to get the master setting_id
        const setting = config?.settings.find(s => s.id === configSettingId);
        const masterSettingId = setting?.setting_id || configSettingId;
        
        return {
          vehicle: parseInt(selectedVehicleForConfig.id),
          scheduled_maintenance: parseInt(masterSettingId), // Use master setting ID
          effective_date: today,
          last_maintenance_date: today,
          last_replaced_km: 0,
          status: 1 // Active
        };
      });
      
      console.log('Sending maintenance assignment:', {
        vehicleId: parseInt(selectedVehicleForConfig.id),
        configurationId: parseInt(selectedConfigId),
        maintenanceRecords: maintenanceData
      });
      
      // Call API to save vehicle scheduled maintenance
      const response = await fetch(buildApiUrl('/vehicle-scheduled-maintenance/bulk'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({
          vehicleId: parseInt(selectedVehicleForConfig.id),
          configurationId: parseInt(selectedConfigId), // Add configuration ID
          maintenanceRecords: maintenanceData
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `Server returned ${response.status}` }));
        console.error('API Error Response:', errorData);
        throw new Error(errorData.message || `Failed to assign configuration (${response.status})`);
      }
      
      const result = await response.json();
      console.log('Assignment successful:', result);
      
      // Refresh vehicles from database to get updated vehicle_configuration
      await fetchVehicles();
      
      toast.dismiss(loadingToast);
      toast.success(
        `${configName} assigned with ${selectedServiceIds.length} service${selectedServiceIds.length !== 1 ? 's' : ''}`, 
        { duration: 3000 }
      );
      
      setShowConfigModal(false);
      setSelectedVehicleForConfig(null);
      setSelectedConfigId('');
      setExpandedConfigsInModal([]);
      setSelectedServices({});
      
    } catch (error) {
      toast.dismiss(loadingToast);
      console.error('Error assigning configuration:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to assign configuration. Please try again.',
        { duration: 4000 }
      );
    }
  };

  // Toggle configuration accordion in modal
  const toggleConfigAccordion = (configId: string) => {
    setExpandedConfigsInModal(prev =>
      prev.includes(configId)
        ? [] // Close if already open
        : [configId] // Open only this one, close all others
    );
  };

  // Toggle individual service selection
  const toggleServiceSelection = (configId: string, serviceId: string) => {
    setSelectedServices(prev => {
      const currentServices = prev[configId] || [];
      const isSelected = currentServices.includes(serviceId);
      
      return {
        ...prev,
        [configId]: isSelected
          ? currentServices.filter(id => id !== serviceId)
          : [...currentServices, serviceId]
      };
    });
  };

  // Select all services for a configuration
  const selectAllServices = (configId: string, allServiceIds: string[]) => {
    setSelectedServices(prev => ({
      ...prev,
      [configId]: allServiceIds
    }));
  };

  // Deselect all services for a configuration
  const deselectAllServices = (configId: string) => {
    setSelectedServices(prev => ({
      ...prev,
      [configId]: []
    }));
  };

  // Navigate to Maintenance Data Setup with filtering
  const handleNavigateToMaintenanceSetup = (configId: string, configName: string) => {
    // Store the filter parameters in localStorage for the Maintenance Data Setup component to read
    localStorage.setItem('maintenanceSetupFilter', JSON.stringify({
      configId: configId,
      configName: configName,
      timestamp: Date.now()
    }));
    
    // Close the modal first
    setShowConfigModal(false);
    setSelectedVehicleForConfig(null);
    setSelectedConfigId('');
    setExpandedConfigsInModal([]);
    setSelectedServices({});
    
    // Show toast notification
    toast.success(`Navigating to Maintenance Data Setup`, { 
      description: `Filtered by: ${configName}`,
      duration: 2500 
    });
    
    // Navigate to Maintenance Data Setup using React Router
   navigate('/maintenance-setup');
// Result: /maintenance-setup ✅
  };

  const getStatusColor = (status: 'Active' | 'Inactive') => {
    switch (status) {
      case 'Active':
        return 'bg-green-50 text-green-700';
      case 'Inactive':
        return 'bg-gray-50 text-gray-600';
      default:
        return 'bg-gray-50 text-gray-600';
    }
  };

  const getSyncStatusColor = (syncStatus: 'synced' | 'paused' | 'resumed' | null) => {
    if (!syncStatus) return '';
    switch (syncStatus) {
      case 'synced':
        return 'bg-blue-50 text-blue-700 border border-blue-200';
      case 'paused':
        return 'bg-orange-50 text-orange-700 border border-orange-200';
      case 'resumed':
        return 'bg-purple-50 text-purple-700 border border-purple-200';
      default:
        return '';
    }
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = sortedVehicles.slice(indexOfFirstItem, indexOfLastItem);

  const totalPages = Math.ceil(sortedVehicles.length / itemsPerPage);

  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  // Render sortable column header
  const renderSortableHeader = (label: string, column: string, width: string, alignment: 'left' | 'center' = 'left') => {
    const isActive = sortColumn === column;
    const alignmentClass = alignment === 'center' ? 'justify-center' : 'justify-start';
    
    return (
      <th className={`text-${alignment} text-xs text-gray-700 font-semibold py-3 px-4 whitespace-nowrap ${width}`}>
        <button
          onClick={() => handleSort(column)}
          className={`flex items-center gap-1.5 ${alignmentClass} w-full hover:text-blue-600 transition-colors group`}
        >
          <span>{label}</span>
          {isActive ? (
            sortDirection === 'asc' ? (
              <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
            ) : (
              <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
            )
          ) : (
            <ArrowUpDown className="w-3.5 h-3.5 opacity-0 group-hover:opacity-50 transition-opacity" />
          )}
        </button>
      </th>
    );
  };

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading vehicles from database...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    const isConnectionError = error.includes('Cannot connect to backend server');
    
    return (
      <div className="flex items-center justify-center min-h-[400px] p-4">
        <div className="text-center max-w-2xl">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-lg text-gray-900 font-medium mb-2">Failed to Load Vehicles</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          
          {isConnectionError && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 text-left">
              <p className="text-sm text-blue-900 font-medium mb-2">🚀 How to start the backend server:</p>
              <div className="bg-white rounded border border-blue-200 p-3 font-mono text-xs text-gray-700 mb-2">
                <div>1. Open a new terminal</div>
                <div>2. cd api</div>
                <div>3. node server.js</div>
              </div>
              <p className="text-xs text-blue-700">
                Connected to API: <span className="font-mono font-medium">{API_BASE_URL.replace('/api', '')}</span>
              </p>
            </div>
          )}
          
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={fetchVehicles}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Retry Connection
            </button>
            <a
              href={buildApiUrl('/health').replace('/api', '')}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors inline-flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Test Server
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl text-gray-900 mb-1">Fleet Management</h1>
          <p className="text-sm sm:text-base text-gray-600">
            Manage all fleet vehicles (Buses) - {vehicles.length} vehicles loaded from database
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={fetchVehicles}
            className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            title="Refresh data from database"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="text-sm">Refresh</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
              <Bus className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-gray-600">Total Buses</div>
              <div className="text-xl sm:text-2xl text-gray-900">{vehicles.length}</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
              <Bus className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-gray-600">Active</div>
              <div className="text-xl sm:text-2xl text-gray-900">
                {vehicles.filter((v) => v.status === 'Active').length}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-purple-50 rounded-lg flex items-center justify-center flex-shrink-0">
              <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-gray-600">Configured</div>
              <div className="text-xl sm:text-2xl text-gray-900">
                {vehicles.filter((v) => v.assignedConfigurationId !== null && v.assignedConfigurationId !== '' && v.vehicleConfiguration !== 'N/A').length}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0">
              <Bus className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-gray-600">Inactive</div>
              <div className="text-xl sm:text-2xl text-gray-900">
                {vehicles.filter((v) => v.status === 'Inactive').length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-col gap-4">
          {/* Search Bar and Toggle */}
          <div className="flex flex-col gap-2">
            <div className="flex gap-3">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by vehicle #, type, registration, VIN, year, collection, status..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors whitespace-nowrap ${
                  showFilters
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Filter className="w-4 h-4" />
                <span className="text-sm">{showFilters ? 'Hide Filters' : 'Show Filters'}</span>
              </button>
            </div>
            
            {/* Sort Indicator */}
            {sortColumn && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Sorted by:</span>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-lg">
                  <span className="text-xs font-medium text-blue-700">
                    {sortColumn === 'vehicleNumber' && 'Vehicle #'}
                    {sortColumn === 'vehicleType' && 'Type'}
                    {sortColumn === 'registration' && 'Registration'}
                    {sortColumn === 'vin' && 'VIN'}
                    {sortColumn === 'year' && 'Year'}
                    {sortColumn === 'collection' && 'Collection'}
                    {sortColumn === 'vehicleConfiguration' && 'Configuration'}
                    {sortColumn === 'wheelchair' && 'Wheelchair'}
                    {sortColumn === 'currentKm' && 'Current KM'}
                    {sortColumn === 'status' && 'Status'}
                    {sortColumn === 'kmSync' && 'KM Sync'}
                  </span>
                  {sortDirection === 'asc' ? (
                    <ArrowUp className="w-3 h-3 text-blue-600" />
                  ) : (
                    <ArrowDown className="w-3 h-3 text-blue-600" />
                  )}
                  <button
                    onClick={() => {
                      setSortColumn(null);
                      setSortDirection('asc');
                    }}
                    className="ml-1 text-blue-600 hover:text-blue-800"
                    title="Clear sort"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Filters Row */}
          {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            <div>
              <VehicleFilter
                options={vehicleNumbers}
                selectedValues={filterVehicle}
                onChange={setFilterVehicle}
                placeholder="All Vehicles"
              />
            </div>

            <div>
              <MultiSelectFilter
                label="Vehicle Type"
                options={vehicleTypes}
                selectedValues={filterVehicleType}
                onChange={setFilterVehicleType}
                placeholder="All Vehicle Types"
              />
            </div>

            <div>
              <MultiSelectFilter
                label="Status"
                options={statuses}
                selectedValues={filterStatus}
                onChange={setFilterStatus}
                placeholder="All Status"
              />
            </div>

            <div>
              <MultiSelectFilter
                label="Collection"
                options={collections}
                selectedValues={filterCollection}
                onChange={setFilterCollection}
                placeholder="All Collections"
              />
            </div>

            <div>
              <MultiSelectFilter
                label="KM Sync Status"
                options={kmSyncStatuses}
                selectedValues={filterKmSyncStatus}
                onChange={setFilterKmSyncStatus}
                placeholder="All Sync Status"
              />
            </div>

            <div>
              <MultiSelectFilter
                label="Maintenance Config"
                options={configurationNames}
                selectedValues={filterConfiguration}
                onChange={setFilterConfiguration}
                placeholder="All Configurations"
              />
            </div>
          </div>
          )}

          {/* Action Buttons - Separate row for better mobile layout */}
          {showFilters && (
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-3 pt-2">
            <button 
              onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {viewMode === 'list' ? <Grid className="w-4 h-4" /> : <List className="w-4 h-4" />}
              <span className="text-sm">{viewMode === 'list' ? 'Grid' : 'List'}</span>
            </button>

            <button className="flex items-center justify-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <Download className="w-4 h-4" />
              <span className="text-sm">Export</span>
            </button>
          </div>
          )}
        </div>
      </div>

      {/* Vehicles List */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
        {viewMode === 'list' ? (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm table-auto">
                <thead>
                  <tr className="border-b-2 border-gray-300 bg-gray-50">
                    {renderSortableHeader('Vehicle #', 'vehicleNumber', 'w-[120px]')}
                    {renderSortableHeader('Type', 'vehicleType', 'w-[140px]')}
                    {renderSortableHeader('Registration', 'registration', 'w-[120px]')}
                    {renderSortableHeader('VIN', 'vin', 'w-[140px]')}
                    {renderSortableHeader('Year', 'year', 'w-[70px]')}
                    {renderSortableHeader('Collection', 'collection', 'w-[160px]')}
                    {renderSortableHeader('Configuration', 'vehicleConfiguration', 'w-[140px]')}
                    <th className="text-center text-xs text-gray-700 font-semibold py-3 px-4 whitespace-nowrap w-[80px]">
                      <button
                        onClick={() => handleSort('wheelchair')}
                        className={`flex items-center justify-center gap-1 w-full hover:text-blue-600 transition-colors group`}
                      >
                        <Accessibility className="w-4 h-4" title="Wheelchair Accessible" />
                        <span>WC</span>
                        {sortColumn === 'wheelchair' ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 opacity-0 group-hover:opacity-50 transition-opacity" />
                        )}
                      </button>
                    </th>
                    {renderSortableHeader('Current KM', 'currentKm', 'w-[110px]')}
                    {renderSortableHeader('Status', 'status', 'w-[90px]')}
                    {renderSortableHeader('KM Sync', 'kmSync', 'w-[100px]')}
                    <th className="text-center text-xs text-gray-700 font-semibold py-3 px-4 whitespace-nowrap w-[110px]">Fleet Actions</th>
                    <th className="text-left text-xs text-gray-700 font-semibold py-3 px-4 whitespace-nowrap w-[120px]">Maintenance</th>
                  </tr>
                </thead>
                <tbody>
                  {currentItems.flatMap((vehicle) => {
                    const config = getVehicleConfiguration(vehicle.assignedConfigurationId);
                    const isExpanded = expandedAccordions.includes(vehicle.id);
                    
                    const rows: JSX.Element[] = [
                        <tr key={vehicle.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-4 text-sm text-gray-900">
                            <div className="flex items-center gap-2">
                              {config && (
                                <button
                                  onClick={() => toggleAccordion(vehicle.id)}
                                  className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all duration-200"
                                >
                                  <motion.div
                                    animate={{ rotate: isExpanded ? 180 : 0 }}
                                    transition={{ duration: 0.3, ease: "easeInOut" }}
                                  >
                                    <ChevronDown className="w-4 h-4" />
                                  </motion.div>
                                </button>
                              )}
                              <span className="font-medium">{vehicle.vehicleNumber}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-700">{vehicle.vehicleType}</td>
                          <td className="py-3 px-4 text-sm text-gray-700">{vehicle.registrationNumber}</td>
                          <td className="py-3 px-4 text-xs text-gray-600 truncate max-w-[140px]" title={vehicle.vin}>{vehicle.vin}</td>
                          <td className="py-3 px-4 text-sm text-gray-700">{vehicle.year}</td>
                          <td className="py-3 px-4 text-sm text-gray-700">
                            <div className="font-medium">{vehicle.collection}</div>
                            <div className="text-xs text-gray-500 mt-0.5">{vehicle.subCollection}</div>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-700">{vehicle.vehicleConfiguration}</td>
                          <td className="py-3 px-4 text-center">
                            {vehicle.hasWheelchair === 'Yes' ? (
                              <div className="flex items-center justify-center">
                                <div className="bg-blue-100 p-1.5 rounded-full">
                                  <Accessibility className="w-4 h-4 text-blue-600" title="Wheelchair Accessible" />
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-300 text-sm">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-900 font-medium">{vehicle.currentKm} km</td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(vehicle.status)}`}>
                              {vehicle.status}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {vehicle.kmSyncStatus ? (
                              <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${getSyncStatusColor(vehicle.kmSyncStatus)}`}>
                                {vehicle.kmSyncStatus}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleOpenFleetAction(vehicle)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 border border-blue-200 hover:border-blue-300 rounded-lg transition-all whitespace-nowrap"
                              title="Fleet Actions (MFA Required)"
                            >
                              <Shield className="w-3.5 h-3.5" />
                              Actions
                            </button>
                          </td>
                          <td className="py-3 px-4">
                            <button
                              onClick={() => handleOpenConfigModal(vehicle)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-600 hover:text-green-700 hover:bg-green-50 border border-green-200 hover:border-green-300 rounded-lg transition-all whitespace-nowrap"
                              title="Assign Maintenance Configuration"
                            >
                              <Settings className="w-3.5 h-3.5" />
                              Configure
                            </button>
                          </td>
                        </tr>
                    ];
                    
                    // Add accordion row if expanded
                    if (isExpanded && config) {
                      rows.push(
                        <tr key={`${vehicle.id}-accordion`}>
                          <td colSpan={13} className="p-0 bg-white overflow-hidden">
                            <AnimatePresence>
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ 
                                  height: { duration: 0.3, ease: "easeInOut" },
                                  opacity: { duration: 0.2, ease: "easeInOut" }
                                }}
                              >
                              {/* Enhanced Header */}
                              <div className="bg-gradient-to-r from-blue-50 to-white border-y border-gray-200">
                                <div className="flex items-center justify-between gap-3 px-6 py-3">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center">
                                      <Settings className="w-4 h-4 text-white" />
                                    </div>
                                    <div>
                                      <h4 className="text-xs text-gray-500 font-medium uppercase tracking-wide">Assigned Configuration</h4>
                                      <p className="text-sm text-gray-900 font-semibold mt-0.5">{config.configuration_name}</p>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => {
                                      handleNavigateToMaintenanceSetup(config.id, config.configuration_name);
                                    }}
                                    className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-700 hover:underline font-medium transition-colors"
                                    title="View this configuration in Maintenance Data Setup"
                                  >
                                    <span className="hidden sm:inline">View in Maintenance Data Setup</span>
                                    <ExternalLink className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                              
                              {(() => {
                                // Calculate active settings for this vehicle
                                const vehicleRecords = vehicleMaintenanceRecords[vehicle.id] || [];
                                const activeSettings = config.settings?.filter(setting => {
                                  return vehicleRecords.some(
                                    (record: any) => 
                                      record.scheduled_maintenance?.toString() === setting.setting_id?.toString() && 
                                      record.status === 1 // Only active records
                                  );
                                }) || [];
                                
                                return activeSettings.length > 0 ? (
                                <div className="overflow-x-auto px-6 pb-4">
                                    <table className="w-full text-sm">
                                      <thead>
                                        <tr className="bg-gray-100 border-b-2 border-gray-300">
                                          <th className="text-left text-xs text-gray-700 font-semibold py-3 px-4 uppercase tracking-wide">
                                            <div className="flex items-center gap-2">
                                              <Wrench className="w-3.5 h-3.5" />
                                              Service Name
                                            </div>
                                          </th>
                                          <th className="text-left text-xs text-gray-700 font-semibold py-3 px-4 uppercase tracking-wide bg-blue-50">
                                            <div className="flex items-center gap-2">
                                              <Calendar className="w-3.5 h-3.5" />
                                              Last Replace Date
                                            </div>
                                          </th>
                                          <th className="text-left text-xs text-gray-700 font-semibold py-3 px-4 uppercase tracking-wide bg-blue-50">
                                            <div className="flex items-center gap-2">
                                              <Gauge className="w-3.5 h-3.5" />
                                              Last Replaced KM
                                            </div>
                                          </th>
                                          <th className="text-left text-xs text-gray-700 font-semibold py-3 px-4 uppercase tracking-wide">
                                            <div className="flex items-center gap-2">
                                              <Tag className="w-3.5 h-3.5" />
                                              Interval Type
                                            </div>
                                          </th>
                                          <th className="text-left text-xs text-gray-700 font-semibold py-3 px-4 uppercase tracking-wide">
                                            <div className="flex items-center gap-2">
                                              <Settings className="w-3.5 h-3.5" />
                                              Maintenance Type
                                            </div>
                                          </th>
                                          <th className="text-left text-xs text-gray-700 font-semibold py-3 px-4 uppercase tracking-wide">
                                            <div className="flex items-center gap-2">
                                              <Gauge className="w-3.5 h-3.5" />
                                              Service KMs
                                            </div>
                                          </th>
                                          <th className="text-left text-xs text-gray-700 font-semibold py-3 px-4 uppercase tracking-wide">
                                            <div className="flex items-center gap-2">
                                              <AlertCircle className="w-3.5 h-3.5" />
                                              KMs Alert
                                            </div>
                                          </th>
                                          <th className="text-left text-xs text-gray-700 font-semibold py-3 px-4 uppercase tracking-wide">
                                            <div className="flex items-center gap-2">
                                              <Tag className="w-3.5 h-3.5" />
                                              Time Unit
                                            </div>
                                          </th>
                                          <th className="text-left text-xs text-gray-700 font-semibold py-3 px-4 uppercase tracking-wide">
                                            <div className="flex items-center gap-2">
                                              <Calendar className="w-3.5 h-3.5" />
                                              Duration
                                            </div>
                                          </th>
                                          <th className="text-left text-xs text-gray-700 font-semibold py-3 px-4 uppercase tracking-wide">
                                            <div className="flex items-center gap-2">
                                              <AlertCircle className="w-3.5 h-3.5" />
                                              Duration Alert
                                            </div>
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-200">
                                        {config.settings
                                          .filter(setting => {
                                            // Only show settings that have active records in vehicle_scheduled_maintenance
                                            const vehicleRecords = vehicleMaintenanceRecords[vehicle.id] || [];
                                            return vehicleRecords.some(
                                              (record: any) => 
                                                record.scheduled_maintenance?.toString() === setting.setting_id?.toString() && 
                                                record.status === 1 // Only active records
                                            );
                                          })
                                          .map((setting, index) => {
                                          // Get maintenance record from API data using setting_id (master ID) and vehicle ID
                                          const vehicleRecords = vehicleMaintenanceRecords[vehicle.id] || [];
                                          const maintenanceRecord = vehicleRecords.find(
                                            (record: any) => 
                                              record.scheduled_maintenance?.toString() === setting.setting_id?.toString() && 
                                              record.status === 1 // Only show active records
                                          );
                                          
                                          return (
                                            <tr key={setting.id} className={`transition-colors hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                                              <td className="py-3 px-4">
                                                <div className="flex items-center gap-2">
                                                  <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                                                  <span className="text-gray-900 font-medium">{setting.setting_name}</span>
                                                </div>
                                              </td>
                                              <td className="py-3 px-4 bg-blue-50">
                                                {maintenanceRecord?.last_maintenance_date ? (
                                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-600 text-white rounded text-xs font-medium">
                                                    <Calendar className="w-3 h-3" />
                                                    {maintenanceRecord.last_maintenance_date}
                                                  </span>
                                                ) : (
                                                  <span className="text-xs text-gray-400">—</span>
                                                )}
                                              </td>
                                              <td className="py-3 px-4 bg-blue-50">
                                                {maintenanceRecord?.last_replaced_km !== undefined && maintenanceRecord?.last_replaced_km !== null ? (
                                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-600 text-white rounded text-xs font-medium">
                                                    <Gauge className="w-3 h-3" />
                                                    {maintenanceRecord.last_replaced_km.toLocaleString()} km
                                                  </span>
                                                ) : (
                                                  <span className="text-xs text-gray-400">—</span>
                                                )}
                                              </td>
                                              <td className="py-3 px-4">
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                                                  <Tag className="w-3 h-3" />
                                                  {setting.interval_type}
                                                </span>
                                              </td>
                                              <td className="py-3 px-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium ${
                                                  setting.maintenance_type === 'Overhaul Maintenance' || setting.maintenance_type === 'OVERHAUL'
                                                    ? 'bg-orange-100 text-orange-700'
                                                    : 'bg-emerald-100 text-emerald-700'
                                                }`}>
                                                  {setting.maintenance_type === 'Overhaul Maintenance' || setting.maintenance_type === 'OVERHAUL'
                                                    ? 'Overhaul'
                                                    : 'Regular'}
                                                </span>
                                              </td>
                                              <td className="py-3 px-4">
                                                <span className="text-gray-900 font-medium">
                                                  {setting.kms.toLocaleString()} km
                                                </span>
                                              </td>
                                              <td className="py-3 px-4">
                                                <span className="text-gray-700">
                                                  {setting.kms_to_alert.toLocaleString()} km
                                                </span>
                                              </td>
                                              <td className="py-3 px-4">
                                                {setting.time_unit ? (
                                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                                                    <Tag className="w-3 h-3" />
                                                    {setting.time_unit}
                                                  </span>
                                                ) : (
                                                  <span className="text-xs text-gray-400">—</span>
                                                )}
                                              </td>
                                              <td className="py-3 px-4">
                                                <span className="text-gray-900 font-medium">
                                                  {setting.duration_days}
                                                </span>
                                              </td>
                                              <td className="py-3 px-4">
                                                <span className="text-gray-700">
                                                  {setting.duration_to_alert}
                                                </span>
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : (
                                  <div className="text-center py-8 px-6">
                                    <Settings className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                                    <p className="text-sm text-gray-500">No active settings</p>
                                    <p className="text-xs text-gray-400 mt-1">All settings are currently inactive</p>
                                  </div>
                                );
                              })()}
                                </motion.div>
                            </AnimatePresence>
                          </td>
                        </tr>
                      );
                    }
                    
                    return rows;
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile/Tablet Card View */}
            <div className="lg:hidden space-y-4">
              {currentItems.map((vehicle) => (
                <div key={vehicle.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Bus className="w-5 h-5 text-blue-600 flex-shrink-0" />
                        <span className="text-sm text-gray-900 truncate">{vehicle.vehicleNumber}</span>
                        {vehicle.hasWheelchair === 'Yes' && (
                          <Accessibility className="w-4 h-4 text-blue-600" title="Wheelchair Accessible" />
                        )}
                      </div>
                      <div className="text-xs text-gray-600">{vehicle.vehicleType}</div>
                    </div>
                    <span className={`inline-flex px-2 py-1 rounded text-xs flex-shrink-0 ml-2 ${getStatusColor(vehicle.status)}`}>
                      {vehicle.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3 text-xs">
                    <div>
                      <div className="text-gray-500">Vehicle Type</div>
                      <div className="text-gray-900 truncate">{vehicle.vehicleType}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Registration</div>
                      <div className="text-gray-900">{vehicle.registrationNumber}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">VIN</div>
                      <div className="text-gray-900 truncate" title={vehicle.vin}>{vehicle.vin}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Year</div>
                      <div className="text-gray-900">{vehicle.year}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Collection</div>
                      <div className="text-gray-900 truncate">{vehicle.collection}</div>
                      <div className="text-gray-500 text-xs truncate">{vehicle.subCollection}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Configuration</div>
                      <div className="text-gray-900 truncate">{vehicle.vehicleConfiguration}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Current KM</div>
                      <div className="text-gray-900">{vehicle.currentKm} km</div>
                    </div>
                  </div>

                  {vehicle.kmSyncStatus && (
                    <div className="mb-3">
                      <div className="text-xs text-gray-500 mb-1">KM Sync Status</div>
                      <span className={`inline-flex px-2 py-1 rounded text-xs ${getSyncStatusColor(vehicle.kmSyncStatus)}`}>
                        {vehicle.kmSyncStatus}
                      </span>
                    </div>
                  )}

                  {/* Fleet Actions Section */}
                  <div className="pt-3 border-t border-gray-100">
                    <div className="text-xs text-gray-500 mb-2">Fleet Actions</div>
                    <button
                      onClick={() => handleOpenFleetAction(vehicle)}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors mb-3"
                      title="Fleet Actions (MFA Required)"
                    >
                      <Shield className="w-4 h-4" />
                      Open Fleet Actions
                    </button>

                    {/* Maintenance Actions Section */}
                    <div className="text-xs text-gray-500 mb-2">Maintenance Actions</div>
                    <div className="flex items-center flex-wrap gap-2">
                      <button
                        onClick={() => handleOpenConfigModal(vehicle)}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm text-green-600 hover:bg-green-50 border border-green-200 rounded-lg transition-colors"
                        title="Assign Maintenance Configuration"
                      >
                        <Settings className="w-4 h-4" />
                        Configure
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          /* Grid View */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {currentItems.map((vehicle) => (
              <div key={vehicle.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all bg-white">
                {/* Header */}
                <div className="flex items-start justify-between mb-3 pb-3 border-b border-gray-100">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Bus className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-gray-900 truncate">{vehicle.vehicleNumber}</div>
                      <div className="text-xs text-gray-500 truncate">{vehicle.registrationNumber}</div>
                    </div>
                  </div>
                  <span className={`inline-flex px-2 py-1 rounded text-xs flex-shrink-0 ml-2 ${getStatusColor(vehicle.status)}`}>
                    {vehicle.status}
                  </span>
                </div>

                {/* Details */}
                <div className="space-y-2.5 mb-3 text-xs">
                  {/* Vehicle Type */}
                  <div className="bg-gray-50 rounded p-2">
                    <div className="text-gray-500 mb-1">Vehicle Type</div>
                    <div className="text-gray-900">{vehicle.vehicleType}</div>
                  </div>

                  {/* Collection */}
                  <div>
                    <div className="text-gray-500">Collection</div>
                    <div className="text-gray-900">{vehicle.collection}</div>
                    <div className="text-gray-500 text-xs">{vehicle.subCollection}</div>
                  </div>

                  {/* Configuration */}
                  <div>
                    <div className="text-gray-500">Configuration</div>
                    <div className="text-gray-900">{vehicle.vehicleConfiguration}</div>
                  </div>

                  {/* Grid: Year & Wheelchair */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-gray-500">Year</div>
                      <div className="text-gray-900">{vehicle.year}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Wheelchair</div>
                      <div className="text-gray-900 flex items-center gap-1">
                        {vehicle.hasWheelchair === 'Yes' ? (
                          <>
                            <Accessibility className="w-4 h-4 text-blue-600" />
                            <span className="text-xs">Yes</span>
                          </>
                        ) : (
                          <span className="text-gray-400">No</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* VIN & Registration */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-gray-500">VIN</div>
                      <div className="text-gray-900 text-xs truncate" title={vehicle.vin}>{vehicle.vin}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Registration</div>
                      <div className="text-gray-900 text-xs">{vehicle.registrationNumber}</div>
                    </div>
                  </div>

                  {/* Current KM */}
                  <div className="bg-blue-50 rounded p-2">
                    <div className="text-gray-500 mb-1 flex items-center gap-1">
                      <Gauge className="w-3 h-3" />
                      Current Kilometers
                    </div>
                    <div className="text-blue-900 font-medium">{vehicle.currentKm} km</div>
                  </div>

                  {/* KM Sync Status */}
                  {vehicle.kmSyncStatus && (
                    <div>
                      <div className="text-gray-500 mb-1">KM Sync Status</div>
                      <span className={`inline-flex px-2 py-1 rounded text-xs ${getSyncStatusColor(vehicle.kmSyncStatus)}`}>
                        {vehicle.kmSyncStatus}
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="pt-3 border-t border-gray-100 space-y-3">
                  {/* Fleet Actions */}
                  <div>
                    <div className="text-xs text-gray-500 mb-2">Fleet Actions</div>
                    <button
                      onClick={() => handleOpenFleetAction(vehicle)}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors"
                      title="Fleet Actions (MFA Required)"
                    >
                      <Shield className="w-4 h-4" />
                      Open Fleet Actions
                    </button>
                  </div>

                  {/* Maintenance Actions */}
                  <div>
                    <div className="text-xs text-gray-500 mb-2">Maintenance Actions</div>
                    <div className="flex items-center flex-wrap gap-1">
                      <button
                        onClick={() => handleOpenConfigModal(vehicle)}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm text-green-600 hover:bg-green-50 border border-green-200 rounded-lg transition-colors"
                        title="Assign Maintenance Configuration"
                      >
                        <Settings className="w-4 h-4" />
                        Configure
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between mt-6 pt-4 border-t border-gray-200 gap-4">
            <div className="text-sm text-gray-600">
              Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, sortedVehicles.length)} of {sortedVehicles.length} entries
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-sm bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(totalPages, 5) }, (_, index) => {
                  let pageNumber;
                  if (totalPages <= 5) {
                    pageNumber = index + 1;
                  } else if (currentPage <= 3) {
                    pageNumber = index + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNumber = totalPages - 4 + index;
                  } else {
                    pageNumber = currentPage - 2 + index;
                  }
                  
                  return (
                    <button
                      key={pageNumber}
                      onClick={() => handlePageChange(pageNumber)}
                      className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                        currentPage === pageNumber
                          ? 'bg-blue-600 text-white'
                          : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {pageNumber}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-sm bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>



      {/* Configuration Assignment Modal */}
      <AnimatePresence>
        {showConfigModal && selectedVehicleForConfig && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto"
            >
            <div className="border-b border-gray-200 px-4 sm:px-6 py-4 flex items-start sm:items-center justify-between sticky top-0 bg-white">
              <div className="flex-1 min-w-0 pr-4">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-base sm:text-lg text-gray-900">Assign Configuration</h2>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                    {getAvailableConfigurations(selectedVehicleForConfig.vehicleType).length} Available
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-gray-600 truncate">
                  Vehicle: {selectedVehicleForConfig.vehicleNumber} - {selectedVehicleForConfig.vehicleType}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowConfigModal(false);
                  setSelectedVehicleForConfig(null);
                  setSelectedConfigId('');
                  setExpandedConfigsInModal([]);
                  setSelectedServices({});
                }}
                className="p-1 text-gray-400 hover:text-gray-600 rounded flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6">
              {/* Info Banner */}
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-900">
                  <span className="font-medium">Note:</span> Configurations are sourced from Maintenance Data Setup (Active configurations only).
                </p>
              </div>

              <div className="mb-6">
                <label className="block text-sm text-gray-700 mb-3">
                  Available Configurations
                </label>
                
                {getAvailableConfigurations(selectedVehicleForConfig.vehicleType).length > 0 ? (
                  <div className="space-y-3">
                    {getAvailableConfigurations(selectedVehicleForConfig.vehicleType).map((config) => {
                      const isExpanded = expandedConfigsInModal.includes(config.id);
                      const selectedServiceIds = selectedServices[config.id] || [];
                      const allServiceIds = config.settings.map(s => s.id);
                      
                      return (
                        <div
                          key={config.id}
                          className={`border-2 rounded-lg transition-all duration-200 ${
                            selectedConfigId === config.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-blue-300'
                          }`}
                        >
                          {/* Configuration Header */}
                          <div
                            className="p-4 cursor-pointer"
                            onClick={() => setSelectedConfigId(config.id)}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                <input
                                  type="radio"
                                  checked={selectedConfigId === config.id}
                                  onChange={() => setSelectedConfigId(config.id)}
                                  className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0"
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm text-gray-900 font-medium mb-1">{config.configuration_name}</div>
                                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                                    <span className="flex items-center gap-1">
                                      <Settings className="w-3 h-3" />
                                      {config.settings.length} Service{config.settings.length !== 1 ? 's' : ''}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <CheckCircle className="w-3 h-3 text-green-600" />
                                      {config.status}
                                    </span>
                                    {selectedServiceIds.length > 0 && (
                                      <span className="flex items-center gap-1 text-blue-600 font-medium">
                                        <CheckCircle className="w-3 h-3" />
                                        {selectedServiceIds.length} selected
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleNavigateToMaintenanceSetup(config.id, config.configuration_name);
                                    }}
                                    className="flex items-center gap-1 text-blue-600 hover:text-blue-700 hover:underline font-medium text-xs mt-1 transition-colors"
                                    title="View this configuration in Maintenance Data Setup"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    View in Maintenance Data Setup
                                  </button>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {selectedConfigId === config.id && (
                                  <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded">
                                    Selected
                                  </span>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleConfigAccordion(config.id);
                                  }}
                                  className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                                  title={isExpanded ? "Hide settings" : "Show settings"}
                                >
                                  <motion.div
                                    animate={{ rotate: isExpanded ? 180 : 0 }}
                                    transition={{ duration: 0.3, ease: "easeInOut" }}
                                  >
                                    <ChevronDown className="w-4 h-4 text-gray-600" />
                                  </motion.div>
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Settings Accordion with smooth transition */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ 
                                  height: { duration: 0.3, ease: "easeInOut" },
                                  opacity: { duration: 0.2, ease: "easeInOut" }
                                }}
                                className="overflow-hidden"
                              >
                                <div className="border-t border-gray-200 bg-white">
                              <div className="p-4">
                                {/* Select All / Deselect All Header - Only show if settings exist */}
                                {config.settings && config.settings.length > 0 && (
                                  <div className="flex items-center justify-between mb-3">
                                    <div className="text-xs font-medium text-gray-700 flex items-center gap-2">
                                      <Wrench className="w-3.5 h-3.5 text-blue-600" />
                                      Select Services to Include
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => selectAllServices(config.id, allServiceIds)}
                                        className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
                                      >
                                        Select All
                                      </button>
                                      <span className="text-gray-300">|</span>
                                      <button
                                        onClick={() => deselectAllServices(config.id)}
                                        className="text-xs text-gray-600 hover:text-gray-700 font-medium transition-colors"
                                      >
                                        Deselect All
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {/* Services Table or Empty State */}
                                {config.settings && config.settings.length > 0 ? (
                                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                                    <div className="overflow-x-auto">
                                      <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                          <tr>
                                            <th className="w-12 px-3 py-2 text-left">
                                              <span className="sr-only">Select</span>
                                            </th>
                                            <th className="px-3 py-2 text-left text-xs text-gray-700">
                                              Setting
                                            </th>
                                            <th className="px-3 py-2 text-left text-xs text-gray-700">
                                              Interval Type
                                            </th>
                                            <th className="px-3 py-2 text-left text-xs text-gray-700">
                                              Maintenance Type
                                            </th>
                                            <th className="px-3 py-2 text-right text-xs text-gray-700">
                                              KMs
                                            </th>
                                            <th className="px-3 py-2 text-right text-xs text-gray-700">
                                              KMs Alert
                                            </th>
                                            <th className="px-3 py-2 text-right text-xs text-gray-700">
                                              Duration
                                            </th>
                                            <th className="px-3 py-2 text-right text-xs text-gray-700">
                                              Duration Alert
                                            </th>
                                            <th className="px-3 py-2 text-center text-xs text-gray-700">
                                              Time Unit
                                            </th>
                                          </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                        {config.settings.map((setting) => {
                                          const isServiceSelected = selectedServiceIds.includes(setting.id);
                                          
                                          // Normalize interval_type to uppercase for comparison
                                          const intervalType = (setting.interval_type || '').toUpperCase();
                                          
                                          // Check if KM-based (show KM columns)
                                          const isKmBased = intervalType === 'KM' || intervalType === 'BOTH';
                                          
                                          // Check if duration-based (show duration columns)
                                          const isDurationBased = intervalType === 'DURATION' || 
                                                                 intervalType === 'DAYS' || 
                                                                 intervalType === 'WEEKS' || 
                                                                 intervalType === 'MONTHS' || 
                                                                 intervalType === 'YEARS' || 
                                                                 intervalType === 'BOTH';
                                          
                                          return (
                                            <tr
                                              key={setting.id}
                                              onClick={() => toggleServiceSelection(config.id, setting.id)}
                                              className={`cursor-pointer transition-colors duration-150 ${
                                                isServiceSelected
                                                  ? 'bg-blue-50 hover:bg-blue-100'
                                                  : 'hover:bg-gray-50'
                                              }`}
                                            >
                                              <td className="px-3 py-3">
                                                <input
                                                  type="checkbox"
                                                  checked={isServiceSelected}
                                                  onChange={() => toggleServiceSelection(config.id, setting.id)}
                                                  className="w-4 h-4 text-blue-600 rounded"
                                                  onClick={(e) => e.stopPropagation()}
                                                />
                                              </td>
                                              <td className="px-3 py-3 text-sm text-gray-900">
                                                {setting.setting_name}
                                              </td>
                                              <td className="px-3 py-3">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800">
                                                  {setting.interval_type}
                                                </span>
                                              </td>
                                              <td className="px-3 py-3">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                                  setting.maintenance_type === 'Overhaul Maintenance' || setting.maintenance_type === 'OVERHAUL'
                                                    ? 'bg-orange-100 text-orange-700'
                                                    : 'bg-emerald-100 text-emerald-700'
                                                }`}>
                                                  {setting.maintenance_type === 'Overhaul Maintenance' || setting.maintenance_type === 'OVERHAUL'
                                                    ? 'Overhaul'
                                                    : 'Regular'}
                                                </span>
                                              </td>
                                              <td className="px-3 py-3 text-sm text-right text-gray-900">
                                                {isKmBased && setting.kms > 0
                                                  ? setting.kms.toLocaleString()
                                                  : <span className="text-gray-400">N/A</span>
                                                }
                                              </td>
                                              <td className="px-3 py-3 text-sm text-right text-orange-600">
                                                {isKmBased && setting.kms_to_alert > 0
                                                  ? setting.kms_to_alert.toLocaleString()
                                                  : <span className="text-gray-400">N/A</span>
                                                }
                                              </td>
                                              <td className="px-3 py-3 text-sm text-right text-gray-900">
                                                {isDurationBased && setting.duration_days > 0
                                                  ? setting.duration_days.toLocaleString()
                                                  : <span className="text-gray-400">N/A</span>
                                                }
                                              </td>
                                              <td className="px-3 py-3 text-sm text-right text-orange-600">
                                                {isDurationBased && setting.duration_to_alert > 0
                                                  ? setting.duration_to_alert.toLocaleString()
                                                  : <span className="text-gray-400">N/A</span>
                                                }
                                              </td>
                                              <td className="px-3 py-3 text-xs text-center">
                                                {setting.time_unit ? (
                                                  <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded font-medium capitalize">
                                                    {setting.time_unit}
                                                  </span>
                                                ) : (
                                                  <span className="text-gray-400">—</span>
                                                )}
                                              </td>
                                            </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50">
                                    <Settings className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                                    <p className="text-sm text-gray-900 font-medium mb-2">
                                      No Settings Configured
                                    </p>
                                    <p className="text-xs text-gray-600 mb-4">
                                      This configuration doesn't have any settings assigned yet.
                                    </p>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleNavigateToMaintenanceSetup(config.id, config.configuration_name);
                                      }}
                                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                      Add Settings in Maintenance Data Setup
                                    </button>
                                  </div>
                                )}
                              </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-8 text-center border-2 border-dashed border-gray-300 rounded-lg">
                    <Settings className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                    <p className="text-sm text-gray-900 font-medium mb-2">
                      No configurations available
                    </p>
                    <p className="text-xs text-gray-600 mb-4">
                      No active configurations found for <span className="font-medium">{selectedVehicleForConfig.vehicleType}</span>
                    </p>
                    <p className="text-xs text-gray-500">
                      Please create a configuration in <span className="font-medium">Maintenance Data Setup</span> for this vehicle type first.
                    </p>
                  </div>
                )}
              </div>

              {selectedVehicleForConfig.assignedConfigurationId && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-900">
                    <span className="font-medium">Currently Assigned:</span>{' '}
                    {getAssignedConfigurationName(selectedVehicleForConfig.assignedConfigurationId) || 'None'}
                  </p>
                </div>
              )}
            </div>

            <div className="bg-gray-50 border-t border-gray-200 px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sticky bottom-0">
              <button
                onClick={() => {
                  setShowConfigModal(false);
                  setSelectedVehicleForConfig(null);
                  setSelectedConfigId('');
                  setExpandedConfigsInModal([]);
                  setSelectedServices({});
                }}
                className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignConfiguration}
                disabled={!selectedConfigId || (selectedServices[selectedConfigId] || []).length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {selectedConfigId && (selectedServices[selectedConfigId] || []).length > 0 
                  ? `Assign ${(selectedServices[selectedConfigId] || []).length} Service${(selectedServices[selectedConfigId] || []).length !== 1 ? 's' : ''}`
                  : 'Assign Configuration'
                }
              </button>
            </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MFA Verification Modal */}
      {showMFAVerification && selectedVehicleForAction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 rounded-t-lg">
              <div className="flex items-center gap-3">

                <div>
                  <h3 className="text-lg text-white">MFA Verification Required</h3>
                  <p className="text-xs text-blue-100">Security verification for Fleet Actions</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-6">
                <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg mb-4">
                  <Shield className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-amber-900 font-medium mb-1">Critical System Action</p>
                    <p className="text-xs text-amber-700">
                      Fleet Actions affect critical system operations. Please verify your identity to proceed.
                    </p>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm text-gray-700 mb-2">
                    Vehicle: <span className="font-medium text-gray-900">{selectedVehicleForAction.vehicleNumber}</span>
                  </label>
                  
                  {/* Send OTP Button */}
                  <div className="mb-4">
                    <button
                      onClick={handleSendOtp}
                      disabled={otpSent || sendingOtp}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
                    >
                      <Send className={`w-4 h-4 ${sendingOtp ? 'animate-pulse' : ''}`} />
                      {sendingOtp ? 'Sending OTP...' : otpSent ? 'OTP Sent ✓' : 'Send OTP to Authorize'}
                    </button>
                    {otpSent && (
                      <p className="text-xs text-green-600 mt-2 text-center">
                        ✓ OTP has been sent to your registered device
                      </p>
                    )}
                  </div>

                  <label className="block text-sm text-gray-700 mb-2">
                    Enter MFA Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value)}
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    disabled={!otpSent}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-lg tracking-widest disabled:bg-gray-100 disabled:cursor-not-allowed"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && mfaCode.length === 6) {
                        handleMFAVerification();
                      }
                    }}
                  />
           
                </div>
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={handleCloseFleetAction}
                  className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleMFAVerification}
                  disabled={!otpSent || mfaCode.length !== 6}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Verify & Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fleet Action Modal */}
      {showFleetActionModal && selectedVehicleForAction && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Enhanced Header */}
            <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 px-8 py-6 sticky top-0 z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
<div className="w-14 h-14 bg-white bg-opacity-20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg">
  <Settings className="w-7 h-7 text-blue-900" />  
</div>
                  <div>
                    <h3 className="text-2xl text-white font-semibold">Fleet Actions Center</h3>
                    <p className="text-sm text-blue-100 mt-1 flex items-center gap-2">
                      <Bus className="w-4 h-4" />
                      {selectedVehicleForAction.vehicleNumber} • {selectedVehicleForAction.vehicleType}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleCloseFleetAction}
                  className="p-2 text-white hover:bg-white hover:bg-opacity-20 rounded-xl transition-all hover:rotate-90 duration-300"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 bg-gradient-to-b from-gray-50 to-white">
              <div className="space-y-6">
                {/* Enhanced Status Overview */}
                <div>
                  <h4 className="text-sm uppercase tracking-wide text-gray-500 font-semibold mb-4 flex items-center gap-2">
                    <div className="w-1 h-4 bg-blue-600 rounded-full"></div>
                    Vehicle Overview
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white border-2 border-blue-100 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Gauge className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="text-xs text-gray-500 font-medium">Current Odometer</div>
                      </div>
                      <div className="text-2xl text-gray-900 font-bold break-all">{selectedVehicleForAction.currentKm}</div>
                      <div className="text-xs text-gray-500 mt-1">Kilometers</div>
                    </div>
                    <div className="bg-white border-2 border-green-100 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                          <Power className="w-5 h-5 text-green-600" />
                        </div>
                        <div className="text-xs text-gray-500 font-medium">Vehicle Status</div>
                      </div>
                      <span className={`inline-flex px-3 py-1.5 rounded-lg text-sm font-medium ${getStatusColor(selectedVehicleForAction.status)}`}>
                        {selectedVehicleForAction.status}
                      </span>
                    </div>
                    {selectedVehicleForAction.kmSyncStatus && (
                      <div className="bg-white border-2 border-purple-100 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                            <RefreshCw className="w-5 h-5 text-purple-600" />
                          </div>
                          <div className="text-xs text-gray-500 font-medium">Sync Status</div>
                        </div>
                        <span className={`inline-flex px-3 py-1.5 rounded-lg text-sm font-medium ${getSyncStatusColor(selectedVehicleForAction.kmSyncStatus)}`}>
                          {selectedVehicleForAction.kmSyncStatus}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

              {/* KM Management Section */}
              <div>
                <h4 className="text-sm uppercase tracking-wide text-gray-500 font-semibold mb-4 flex items-center gap-2">
                  <div className="w-1 h-4 bg-blue-600 rounded-full"></div>
                  Odometer Management
                </h4>
                <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                
                {editingKm ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-700 font-medium mb-3 flex items-center gap-2">
                        <Edit className="w-4 h-4 text-blue-600" />
                        New Odometer Value <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={newKmValue}
                        onChange={(e) => setNewKmValue(e.target.value)}
                        placeholder="e.g., 45,200"
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-base"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleUpdateKm}
                        disabled={!newKmValue}
                        className="flex-1 px-5 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium flex items-center justify-center gap-2 shadow-sm hover:shadow transition-all"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Update Odometer
                      </button>
                      <button
                        onClick={() => {
                          setEditingKm(false);
                          setNewKmValue(selectedVehicleForAction?.currentKm || '');
                        }}
                        className="px-5 py-3 bg-white text-gray-700 border-2 border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Update vehicle odometer reading</p>
                      <p className="text-xs text-gray-400">Manually adjust the current kilometer value</p>
                    </div>
                    <button
                      onClick={() => setEditingKm(true)}
                      className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 text-sm font-medium flex items-center gap-2 shadow-sm hover:shadow transition-all"
                    >
                      <Edit className="w-4 h-4" />
                      Edit Odometer
                    </button>
                  </div>
                )}
              </div>
            </div>

              {/* KM Sync Actions Section */}
              <div>
                <h4 className="text-sm uppercase tracking-wide text-gray-500 font-semibold mb-4 flex items-center gap-2">
                  <div className="w-1 h-4 bg-blue-600 rounded-full"></div>
                  Synchronization Control
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <button
                    onClick={() => handleFleetSyncAction('paused')}
                    className="group relative overflow-hidden flex flex-col items-center gap-3 p-6 bg-gradient-to-br from-orange-50 to-orange-100 border-2 border-orange-200 rounded-xl hover:shadow-lg hover:scale-105 transition-all text-center"
                  >
                    <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                      <Pause className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-orange-900">Pause Sync</span>
                      <p className="text-xs text-orange-700 mt-1">Temporarily stop</p>
                    </div>
                  </button>
                  <button
                    onClick={() => handleFleetSyncAction('resumed')}
                    className="group relative overflow-hidden flex flex-col items-center gap-3 p-6 bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200 rounded-xl hover:shadow-lg hover:scale-105 transition-all text-center"
                  >
                    <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                      <Play className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-purple-900">Resume Sync</span>
                      <p className="text-xs text-purple-700 mt-1">Continue syncing</p>
                    </div>
                  </button>
                  <button
                    onClick={handleSyncKilometers}
                    disabled={selectedVehicleForAction.status !== 'Active'}
                    className="group relative overflow-hidden flex flex-col items-center gap-3 p-6 bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl hover:shadow-lg hover:scale-105 transition-all text-center disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                      <RefreshCw className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-blue-900">Sync Now</span>
                      <p className="text-xs text-blue-700 mt-1">
                        {selectedVehicleForAction.status === 'Active' ? 'Fetch & update KM' : 'Requires active vehicle'}
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Vehicle Status Actions Section */}
              <div>
                <h4 className="text-sm uppercase tracking-wide text-gray-500 font-semibold mb-4 flex items-center gap-2">
                  <div className="w-1 h-4 bg-blue-600 rounded-full"></div>
                  Vehicle Status Control
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    onClick={() => handleFleetStatusChange('Active')}
                    disabled={selectedVehicleForAction.status === 'Active'}
                    className="group relative overflow-hidden flex flex-col items-center gap-3 p-6 bg-gradient-to-br from-green-50 to-emerald-100 border-2 border-green-200 rounded-xl hover:shadow-lg hover:scale-105 transition-all text-center disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-sm"
                  >
                    <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                      <Power className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-green-900">Activate Vehicle</span>
                      <p className="text-xs text-green-700 mt-1">Set to active status</p>
                    </div>
                  </button>
                  <button
                    onClick={() => handleFleetStatusChange('Inactive')}
                    disabled={selectedVehicleForAction.status === 'Inactive'}
                    className="group relative overflow-hidden flex flex-col items-center gap-3 p-6 bg-gradient-to-br from-red-50 to-rose-100 border-2 border-red-200 rounded-xl hover:shadow-lg hover:scale-105 transition-all text-center disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-sm"
                  >
                    <div className="w-12 h-12 bg-red-500 rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                      <Power className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-red-900">Deactivate Vehicle</span>
                      <p className="text-xs text-red-700 mt-1">Set to inactive status</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Service History Management Button */}
              {selectedVehicleForAction.assignedConfigurationId && (() => {
                const config = getVehicleConfiguration(selectedVehicleForAction.assignedConfigurationId);
                if (!config) return null;
                
                // Get active settings only
                const vehicleRecords = vehicleMaintenanceRecords[selectedVehicleForAction.id] || [];
                const activeSettings = config.settings.filter(setting => {
                  return vehicleRecords.some(
                    (record: any) => 
                      record.scheduled_maintenance?.toString() === setting.setting_id?.toString() && 
                      record.status === 1
                  );
                });
                
                const totalServices = activeSettings.length;
                const completedServices = activeSettings.filter(setting => {
                  const maintenanceRecord = vehicleRecords.find(
                    (record: any) => 
                      record.scheduled_maintenance?.toString() === setting.setting_id?.toString() && 
                      record.status === 1
                  );
                  return maintenanceRecord && (maintenanceRecord.last_maintenance_date || maintenanceRecord.last_replaced_km);
                }).length;
                const completionPercentage = Math.round((completedServices / totalServices) * 100);
                
                return (
                  <div>
                    <h4 className="text-sm uppercase tracking-wide text-gray-500 font-semibold mb-4 flex items-center gap-2">
                      <div className="w-1 h-4 bg-blue-600 rounded-full"></div>
                      Service History
                    </h4>
                    <div className="relative overflow-hidden border-2 border-blue-200 rounded-2xl p-6 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 shadow-sm hover:shadow-lg transition-shadow">
                      {/* Decorative background pattern */}
                      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-400 opacity-10 rounded-full -mr-16 -mt-16"></div>
                      <div className="absolute bottom-0 left-0 w-24 h-24 bg-purple-400 opacity-10 rounded-full -ml-12 -mb-12"></div>
                      
                      <div className="relative">
                        <div className="flex items-start gap-4 mb-4">
                          <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                            <Wrench className="w-7 h-7 text-white" />
                          </div>
                          <div className="flex-1">
                            <h4 className="text-lg text-gray-900 font-semibold mb-1">Service History Management</h4>
                            <p className="text-sm text-gray-600">
                              Track and manage all maintenance replacements
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-3 mb-4">
                          <span className="px-4 py-1.5 bg-white text-blue-700 text-sm rounded-full font-medium border-2 border-blue-200 shadow-sm">
                            {config.configuration_name}
                          </span>
                          <span className="px-4 py-1.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm rounded-full font-medium shadow-sm">
                            {completedServices} / {totalServices} Services
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="mb-5">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-gray-600 font-medium">Completion Progress</span>
                            <span className="text-xs text-blue-600 font-bold">{completionPercentage}%</span>
                          </div>
                          <div className="w-full bg-white rounded-full h-2.5 border border-gray-200 shadow-inner">
                            <div 
                              className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full rounded-full transition-all duration-500 shadow-sm"
                              style={{ width: `${completionPercentage}%` }}
                            ></div>
                          </div>
                        </div>
                        
                        <button
                          onClick={async () => {
                            setShowServiceHistoryPanel(true);
                            await fetchServiceHistoryLogs(selectedVehicleForAction.id);
                            
                            // ✅ Fetch active RO assignments for all settings
                            const settingIds = config.settings
                              .filter(setting => {
                                const vehicleRecords = vehicleMaintenanceRecords[selectedVehicleForAction.id] || [];
                                return vehicleRecords.some(
                                  (record: any) => 
                                    record.scheduled_maintenance?.toString() === setting.setting_id?.toString() && 
                                    record.status === 1
                                );
                              })
                              .map(setting => setting.setting_id);
                            
                            await fetchActiveROAssignments(selectedVehicleForAction.id, settingIds);
                          }}
                          className="w-full px-6 py-3.5 bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 text-white rounded-xl hover:from-blue-700 hover:via-blue-800 hover:to-indigo-800 text-sm font-semibold flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all group"
                        >
                          <Settings className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
                          Open Service History Panel
                          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Warning Notice */}
              <div className="flex items-start gap-4 p-5 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-xl shadow-sm">
                <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-amber-900 font-semibold mb-1.5">Security & Audit Notice</p>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    All fleet actions are logged and monitored for security purposes. These operations affect critical system functions including maintenance scheduling, defect tracking, and repair order management. Unauthorized or improper use may result in system alerts.
                  </p>
                </div>
              </div>
              </div>
            </div>

            {/* Enhanced Footer */}
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-t-2 border-gray-200 px-8 py-5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Shield className="w-4 h-4" />
                <span>Secured by MFA Protection</span>
              </div>
              <button
                onClick={handleCloseFleetAction}
                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 text-sm font-medium shadow-sm hover:shadow transition-all"
              >
                Close Panel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Service History Full-Screen Slide Panel */}
      {showServiceHistoryPanel && selectedVehicleForAction && selectedVehicleForAction.assignedConfigurationId && (() => {
        const config = getVehicleConfiguration(selectedVehicleForAction.assignedConfigurationId);
        if (!config) return null;

        return (
          <div className="fixed inset-0 z-[60] overflow-hidden">
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
              onClick={() => setShowServiceHistoryPanel(false)}
            />
            
            {/* Slide Panel */}
            <div 
              className="absolute right-0 top-0 h-full w-full bg-white shadow-2xl transform transition-transform duration-300 ease-out"
              style={{ animation: 'slideIn 0.3s ease-out' }}
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5 sticky top-0 z-10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setShowServiceHistoryPanel(false)}
                      className="p-2 text-white hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                    >
                      <X className="w-6 h-6" />
                    </button>
                    <div>
                      <h2 className="text-xl text-white font-medium flex items-center gap-3">
                        <Wrench className="w-6 h-6" />
                        Service History Management
                      </h2>
                      <p className="text-sm text-blue-100 mt-1">
                        {selectedVehicleForAction.vehicleNumber} - {selectedVehicleForAction.vehicleType}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="bg-white border-2 border-gray-200 px-5 py-2.5 rounded-xl shadow-lg">
                      <div className="flex items-center gap-2">
                        <Settings className="w-4 h-4 text-gray-700" />
                        <div>
                          <div className="text-xs text-gray-600 font-medium tracking-wide uppercase">Configuration</div>
                          <div className="text-base text-gray-900 font-semibold">{config.configuration_name}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="h-[calc(100vh-88px)] overflow-y-auto">
                <div className="max-w-7xl mx-auto p-6 space-y-6">
                  {/* Info Banner */}
                  <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded-r-lg">
                    <div className="flex items-start gap-3">
                      <Settings className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-blue-900 font-medium mb-1">
                          Configuration-Based Service Tracking
                        </p>
                        <p className="text-xs text-blue-700">
                          Track maintenance replacements for each service setting in the assigned configuration. 
                          Enter the date and odometer reading when each service was completed.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Vehicle Info Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Bus className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Vehicle Number</div>
                          <div className="text-sm text-gray-900 font-medium">{selectedVehicleForAction.vehicleNumber}</div>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                          <Gauge className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Current KM</div>
                          <div className="text-sm text-gray-900 font-medium">{selectedVehicleForAction.currentKm}</div>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                          <Settings className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Active Services</div>
                          <div className="text-sm text-gray-900 font-medium">
                            {config.settings.filter(setting => {
                              const vehicleRecords = vehicleMaintenanceRecords[selectedVehicleForAction.id] || [];
                              return vehicleRecords.some(
                                (record: any) => 
                                  record.scheduled_maintenance?.toString() === setting.setting_id?.toString() && 
                                  record.status === 1
                              );
                            }).length} Services
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Service Settings Grid */}
                  <div>
                    <h3 className="text-lg text-gray-900 font-medium mb-4 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-blue-600" />
                      Service Settings & History
                    </h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {config.settings
                        .filter(setting => {
                          // Only show settings that have active records in vehicle_scheduled_maintenance
                          const vehicleRecords = vehicleMaintenanceRecords[selectedVehicleForAction.id] || [];
                          return vehicleRecords.some(
                            (record: any) => 
                              record.scheduled_maintenance?.toString() === setting.setting_id?.toString() && 
                              record.status === 1 // Only active records
                          );
                        })
                        .map((setting) => {
                        // Get maintenance record from API data
                        const vehicleRecords = vehicleMaintenanceRecords[selectedVehicleForAction.id] || [];
                        const maintenanceRecord = vehicleRecords.find(
                          (record: any) => 
                            record.scheduled_maintenance?.toString() === setting.setting_id?.toString() && 
                            record.status === 1
                        );
                        const history = selectedVehicleForAction.serviceHistory?.find(h => h.setting_id === setting.id);
                        const isEditing = editingServiceId === setting.setting_id;
                        
                        // ✅ Check if this setting has an active RO assignment
                        const activeRO = activeROAssignments[setting.setting_id?.toString()];
                        
                        // DEBUG: Log for first setting only
                        if (setting === config.settings[0]) {
                          console.log(`🔍 Checking setting "${setting.setting_name}" (ID: ${setting.setting_id})`);
                          console.log('Available assignments:', Object.keys(activeROAssignments));
                          console.log('Found activeRO:', activeRO);
                        }

                        return (
                          <div key={setting.id} className="bg-white border-2 border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
                            {/* Service Header */}
                            <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-5 py-4 border-b border-gray-200">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <h4 className="text-base text-gray-900 font-medium">{setting.setting_name}</h4>
                                    {/* ✅ Active RO Badge - Combined */}
                                    {activeRO && (
                                      <span className="px-3 py-1 bg-gradient-to-r from-orange-100 to-blue-100 text-gray-800 text-xs font-semibold rounded-full border-2 border-orange-300 flex items-center gap-1.5 shadow-sm">
                                        <FileText className="w-3.5 h-3.5 text-orange-600" />
                                        <span className="text-orange-700">RO #{activeRO.roId}</span>
                                        <span className="text-gray-400">•</span>
                                        <span className="text-blue-700">{activeRO.rporStatus}</span>
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-3 text-xs">
                                    <span className="flex items-center gap-1 text-gray-600">
                                      <Gauge className="w-3 h-3" />
                                      {setting.kms.toLocaleString()} KM
                                    </span>
                                    <span className="flex items-center gap-1 text-gray-600">
                                      <Calendar className="w-3 h-3" />
                                      {setting.duration_days}  {setting.time_unit || 'Days'} 
                                    </span>
                                  </div>
                                </div>
                                {maintenanceRecord && (maintenanceRecord.last_maintenance_date || maintenanceRecord.last_replaced_km) ? (
                                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                                    <CheckCircle className="w-5 h-5 text-green-600" />
                                  </div>
                                ) : (
                                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                                    <X className="w-5 h-5 text-gray-400" />
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Service Body */}
                            <div className="p-5">
                              {isEditing ? (
                                <div className="space-y-4">
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-sm text-gray-700 font-medium mb-2">
                                        Replace Date <span className="text-red-500">*</span>
                                      </label>
                                      <DatePicker
                                        value={serviceFormData.replace_date}
                                        onChange={(date) => {
                                          const formattedDate = date 
                                            ? date.toISOString().split('T')[0] 
                                            : '';
                                          setServiceFormData(prev => ({ 
                                            ...prev, 
                                            replace_date: formattedDate 
                                          }));
                                        }}
                                        placeholder="Select maintenance date"
                                        className="focus:ring-2 focus:ring-blue-500"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-sm text-gray-700 font-medium mb-2">
                                        Replaced KM <span className="text-red-500">*</span>
                                      </label>
                                      <div className="relative">
                                        <input
                                          type="text"
                                          value={serviceFormData.replaced_km}
                                          onChange={(e) => {
                                            // Allow only numbers and commas
                                            const value = e.target.value.replace(/[^\d,]/g, '');
                                            // Remove existing commas and reformat
                                            const numericValue = value.replace(/,/g, '');
                                            if (numericValue === '' || /^\d+$/.test(numericValue)) {
                                              const formattedValue = numericValue === '' 
                                                ? '' 
                                                : parseInt(numericValue).toLocaleString();
                                              setServiceFormData(prev => ({ 
                                                ...prev, 
                                                replaced_km: formattedValue 
                                              }));
                                            }
                                          }}
                                          placeholder="e.g., 25,000"
                                          className="w-full px-4 py-2.5 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">
                                          km
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3 pt-2">
                                    <button
                                      onClick={() => handleSaveServiceHistory(setting.setting_id, maintenanceRecord)}
                                      className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center justify-center gap-2"
                                    >
                                      <CheckCircle className="w-4 h-4" />
                                      Save History
                                    </button>
                                    <button
                                      onClick={handleCancelServiceEdit}
                                      className="px-4 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : maintenanceRecord && (maintenanceRecord.last_maintenance_date || maintenanceRecord.last_replaced_km) ? (
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                      <div className="text-xs text-blue-600 font-medium mb-1">Replace Date</div>
                                      <div className="text-sm text-gray-900 font-medium">
                                        {maintenanceRecord.last_maintenance_date || '—'}
                                      </div>
                                    </div>
                                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                      <div className="text-xs text-green-600 font-medium mb-1">Replaced KM</div>
                                      <div className="text-sm text-gray-900 font-medium">
                                        {maintenanceRecord.last_replaced_km ? `${maintenanceRecord.last_replaced_km.toLocaleString()} km` : '—'}
                                      </div>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => handleEditService(setting.setting_id, maintenanceRecord)}
                                    className="w-full px-4 py-2.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100 text-sm font-medium flex items-center justify-center gap-2"
                                  >
                                    <Edit className="w-4 h-4" />
                                    Edit Service History
                                  </button>
                                </div>
                              ) : (
                                <div className="text-center py-6">
                                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <Plus className="w-6 h-6 text-gray-400" />
                                  </div>
                                  <p className="text-sm text-gray-600 mb-4">No service history recorded</p>
                                  <button
                                    onClick={() => handleEditService(setting.setting_id, maintenanceRecord)}
                                    className="px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium flex items-center justify-center gap-2 mx-auto"
                                  >
                                    <Plus className="w-4 h-4" />
                                    Add Service History
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Bottom Spacer */}
                  <div className="h-6"></div>
                </div>
              </div>
            </div>

            <style>{`
              @keyframes slideIn {
                from {
                  transform: translateX(100%);
                }
                to {
                  transform: translateX(0);
                }
              }
            `}</style>
          </div>
        );
      })()}
    </div>
  );
}