/**
 * Database TypeScript Interfaces
 * Matches MySQL database schema exactly
 */

// ============================================
// VEHICLES TABLE
// ============================================
export interface Vehicle {
  id: number;
  vehicle_nickname: string;
  vehicle_number: string;
  vehicle_type: number;              // FK to vehicletypes.id
  vehicle_vin: string;
  vehicle_year: string;
  vehicle_comments: string;
  vehicle_configuration: number;
  status: -1 | 0 | 1;               // -1=Sold, 0=Inactive, 1=Active
  asset_id: string | null;
  has_wheelchair: 'yes' | 'no';
  motive_vehicle_id: number | null;
  motive_company_id: number | null;
  motive_comp_groupid: number | null;
  
  // Joined relationships (populated from queries)
  vehicle_type_info?: VehicleType;
  configurations?: VehicleConfiguration[];
}

// ============================================
// VEHICLE TYPES TABLE
// ============================================
export interface VehicleType {
  id: number;
  vc_id: number;
  vsc_id: number;
  vehicle_type: string;
  vehicle_desc: string;
  fuel_km: number | null;
  wear_tire_km: number | null;
  cca_per_day: number | null;
  insurance_per_day: number | null;
  driver_wages: number | null;
  operating_cost: number;
  updated_by: number;
  updated_on: string;
  other_cost_1: number | null;
  other_cost_2: number | null;
  other_cost_3: number | null;
  vehicle_invoice_item: string | null;
}

// ============================================
// VEHICLE CONFIGURATION TABLE
// ============================================
export interface VehicleConfiguration {
  id: number;
  vehicle_id: number;
  vehicle_config_type: 'CHARTER' | 'CONTRACT';
  vehicle_config_valid_from: string;
  vehicle_config_valid_to: string;
  created_by: number;
  created_on: string;
}

// ============================================
// DEFECTS TABLE (Placeholder - add your structure)
// ============================================
export interface Defect {
  id: number;
  vehicle_id: number;
  defect_category: string;
  defect_description: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  status: string;
  source: string;
  reported_date: string;
  resolved_date?: string;
  created_by: number;
  created_on: string;
  
  // Relationships
  vehicle?: Vehicle;
}

// ============================================
// REPAIR ORDERS TABLE (Placeholder - add your structure)
// ============================================
export interface RepairOrder {
  id: number;
  ro_number: string;
  vehicle_id: number;
  vendor_id: number;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  status: string;
  ro_type: string;
  requested_by: number;
  assigned_to?: number;
  created_date: string;
  scheduled_date?: string;
  completed_date?: string;
  estimated_cost: number;
  actual_cost?: number;
  notes?: string;
  
  // Relationships
  vehicle?: Vehicle;
  vendor?: Vendor;
  defects?: Defect[];
}

// ============================================
// VENDORS TABLE (Placeholder - add your structure)
// ============================================
export interface Vendor {
  id: number;
  vendor_name: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  vendor_type: string;
  status: 'Active' | 'Inactive';
  rating?: number;
  created_on: string;
}

// ============================================
// PAYMENTS TABLE (Placeholder - add your structure)
// ============================================
export interface Payment {
  id: number;
  payment_number: string;
  ro_id: number;
  vendor_id: number;
  amount: number;
  payment_date?: string;
  payment_method: string;
  status: string;
  notes?: string;
  created_on: string;
  
  // Relationships
  repair_order?: RepairOrder;
  vendor?: Vendor;
}

// ============================================
// MAINTENANCE SCHEDULES TABLE (Placeholder)
// ============================================
export interface MaintenanceSchedule {
  id: number;
  vehicle_id: number;
  schedule_type: string;
  interval_km?: number;
  interval_days?: number;
  last_service_date?: string;
  next_service_date: string;
  status: string;
  created_on: string;
  
  // Relationships
  vehicle?: Vehicle;
}

// ============================================
// USERS TABLE (Placeholder - add your structure)
// ============================================
export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: string;
  status: 'Active' | 'Inactive';
  created_on: string;
}

// ============================================
// API RESPONSE TYPES
// ============================================
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============================================
// QUERY FILTERS
// ============================================
export interface VehicleFilters {
  status?: -1 | 0 | 1;
  vehicle_type?: number;
  has_wheelchair?: 'yes' | 'no';
  search?: string;
}

export interface DefectFilters {
  vehicle_id?: number;
  severity?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
}

export interface RepairOrderFilters {
  vehicle_id?: number;
  vendor_id?: number;
  status?: string;
  priority?: string;
  date_from?: string;
  date_to?: string;
}
