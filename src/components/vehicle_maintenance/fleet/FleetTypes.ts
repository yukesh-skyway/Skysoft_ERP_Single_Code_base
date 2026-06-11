/**
 * Fleet Management Types
 * Extracted from FleetManagement.tsx
 */

export interface ServiceSetting {
  id: string;
  setting_id: string;
  setting_name: string;
  interval_type: 'KM' | 'Days' | 'Weeks' | 'Months' | 'Years' | 'Both';
  time_unit?: 'Days' | 'Weeks' | 'Months' | 'Years';
  kms: number;
  kms_to_alert: number;
  duration_days: number;
  duration_to_alert: number;
}

export interface ServiceHistory {
  setting_id: string;
  replace_date: string;
  replaced_km: string;
}

export interface MaintenanceConfiguration {
  id: string;
  configuration_name: string;
  vehicle_type: string;
  status: 'active' | 'inactive';
  settings: ServiceSetting[];
}

export interface VehicleApiResponse {
  id: number;
  vehicle_nickname: string;
  vehicle_type: string | null;
  vehicle_type_name?: string | null;
  collection_name?: string | null;
  sub_collection_name?: string | null;
  vehicle_number: string | null;
  vehicle_vin: string | null;
  asset_id: string | null;
  vehicle_configuration: string | null;
  vehicle_configuration_name?: string | null;
  current_km: number | null;
  km_sync_status?: 'synced' | 'paused' | 'resumed' | null;
  status: number;
  has_wheelchair: string;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_comments: string | null;
  status_label?: string;
}

export interface Vehicle {
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

export interface CustomField {
  id: string;
  fieldName: string;
  fieldType: 'text' | 'number' | 'date' | 'select';
  fieldValue: string;
  options?: string[];
}
