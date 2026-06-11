/**
 * Defect Management Types
 * Extracted from ManageDefectsEnhanced.tsx
 */

export interface Defect {
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
  defect_source: 'motive' | 'skysoft';
  estimate?: string;
  linked_to_roid?: number;
  related_repair_purchase_order?: number;
  previous_ro_id?: number;
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
}

export interface RepairCategory {
  id: number;
  repair_code_category: string;
  repair_category_type: string;
}

export interface User {
  id: number;
  fullname: string;
  middlename?: string;
  nickname?: string;
  lastname?: string;
}

export interface Vehicle {
  id: number;
  vehicle_nickname: string;
  vehicle_type?: string;
}

export interface Filters {
  search: string;
  repair_category: string[];
  reported_by: string[];
  mechanic: string[];
  vehicle: string[];
  defect_status: string[];
  date_from: string;
  date_to: string;
  defect_source: string[];
  linked_to_ro: string;
  manager_status: string[];
  issue_type: string[];
}

export interface StatusSummary {
  [key: string]: number;
}
