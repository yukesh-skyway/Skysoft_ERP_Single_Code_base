import React, { useState, useEffect } from "react";
import {
  X,
  CheckCircle,
  Search,
  Save,
  ChevronDown,
  ChevronUp,
  Info,
  CheckCircle2,
  ArrowRight,
  Wrench,
} from "lucide-react";
import { toast } from "sonner@2.0.3";
import { buildApiUrl, API_ENDPOINTS } from "../../config/api";
import { useAuth } from "../../contexts/AuthContext";
import { motion, AnimatePresence } from "motion/react";
import { RefreshCw } from 'lucide-react';
import { useRef } from 'react';
interface Vehicle {
  id: number;
  vehicle_nickname: string;
  vehicle_configuration?: number;
}

interface Vendor {
  id: number;
  vendor_name: string;
}

interface Defect {
  id: number;
  vrlid: number;
  repair_code_category: string;
  repair_code_category_name?: string;
  repair_desc: string;
  issue_type: string;
  defect_source: string;
  defect_status: string;
  notes: string;
  is_duplicate?: string;
  merged_records_id?: string;
  merged_count?: number;
  primary_defect_id?: number;
  motive_def_unique_id?: string;
  rpor_status?: string; // Repair Order status (In_Progress, Pending, etc.)
}

interface ScheduledMaintenanceItem {
  scsid: number;
  setting_name: string;
  setting_type: string;
  kms_html: string;
  duration_html: string;
  trip_actual_run_kms_htm: string;
  days_from_effective_date_htm: string;
  rpor_status?: string; // Repair Order status (In_Progress, Pending, etc.) - only in edit mode
  repair_purchase_order?: number; // RO ID - only in edit mode
  interval_type?: string; // KMS, DURATION, or BOTH
  kms?: number; // KM interval
  days?: number; // Duration interval
  time_unit?: string; // Time unit (DAYS, WEEKS, MONTHS, YEARS)
  next_service_date?: string; // Next service date (YYYY-MM-DD)
  last_replaced_km?: number; // Last service KM
  last_maintenance_date?: string; // Last service date
  status?: string; // OVERDUE, DUE_SOON, GOOD
  // ⭐ NEW: Duplicate detection fields from backend
  existing_ro_number?: string; // RO number if already in active RO
  existing_ro_id?: number; // RO ID if already in active RO
  existing_ro_status?: string; // Status in existing RO
  // ⭐ NEW: Fields for maintenance defects (when fetched from vehicle_repair_logs)
  id?: number; // Defect ID for preselection matching
  notes?: string; // Defect notes
  defect_source?: string; // Should be 'maintenance'
  vrlid?: number; // Defect ID (same as scsid for maintenance defects)
  repair_code_category?: string; // Category ID
  repair_code_category_name?: string; // Category name
  repair_desc?: string; // Repair description
  repair_notes?: string; // Repair notes from rpor table
  defect_status?: string; // Defect status (Open, Reopened, etc.)
}

interface User {
  uid: number;
  fullname: string;
  middlename?: string;
  lastname?: string;
  nickname?: string;
}

interface MechanicCheckResult {
  hasHours: boolean;
  summary?: {
    total_repair_items: number;
    total_assignments: number;
    total_hours: number;
  };
  items?: Array<{
    repair_item_id: number;
    repair_item_name: string;
    mechanics: Array<{
      assignment_id: number;
      mechanic_name: string;
      actual_hours: number;
    }>;
  }>;
}

interface CreateROModalProps {
  isOpen: boolean;
  onClose: () => void;
onSuccess: (roId?: number, mode?: "create" | "edit" | "update") => void;
  vehicles: Vehicle[];
  vendors: Vendor[];
  preselectedDefectIds?: string; // Comma-separated defect IDs from URL
  preselectedVehicleId?: number;
  mode?: "create" | "edit" | "update";
  existingROId?: number;
  existingROData?: {
    vehicle: number;
    requestedBy: number;
    busKms: string;
    vendor: number;
    estimatedAmount: string;
    notes: string;
    defectIds: number[];
    scheduledItemIds: number[];
    
    // Update mode specific fields
     vendor_locked?: boolean;  // ⭐ ADD THIS
    invoice_amount?: string;
    work_order_number?: string;
    invoice_number?: string;
    kms_after_service?: string;
    service_completed_date?: string;
    payment_method?: number;
    payment_notes?: string;
    repair_notes?: string;
  };
}

export function CreateROModal({
  isOpen,
  onClose,
  onSuccess,
  vehicles,
  vendors,
  preselectedDefectIds = "",
  preselectedVehicleId,
  mode = "create",
  existingROId,
  existingROData,
}: CreateROModalProps) {
  // Get current logged-in user
  const { user } = useAuth();
const [garageWebhookTriggered, setGarageWebhookTriggered] = useState(false);
  const [formData, setFormData] = useState({
    vehicle: preselectedVehicleId || "",
    requestedBy: "",
    busKms: "0",
    vendor: "",
    estimatedAmount: "0",
    notes: "",
    // Update mode specific fields
    invoice_amount: "0",
    work_order_number: "",
    invoice_number: "",
    kms_after_service: "0",
    service_completed_date: "",
    payment_method: "",
    payment_notes: "",
    repair_notes: "",
  });

  const [selectedDefects, setSelectedDefects] = useState<
    number[]
  >([]);
  const [selectedScheduledItems, setSelectedScheduledItems] =
    useState<number[]>([]);
  const [availableDefects, setAvailableDefects] = useState<
    Defect[]
  >([]);
  const [availableScheduledItems, setAvailableScheduledItems] =
    useState<ScheduledMaintenanceItem[]>([]);

  // Defects and scheduled items already in the RO (for display in green section)
  const [defectsInRO, setDefectsInRO] = useState<Defect[]>([]);
  const [scheduledItemsInRO, setScheduledItemsInRO] = useState<
    ScheduledMaintenanceItem[]
  >([]);

  // Configuration name for the selected vehicle
  const [configurationName, setConfigurationName] =
    useState<string>("");
    const [vendorLocked, setVendorLocked] = useState(false);

  const [users, setUsers] = useState<User[]>([]);
  const [loadingDefects, setLoadingDefects] = useState(false);
  const [loadingScheduled, setLoadingScheduled] =
    useState(false);
  const [submitting, setSubmitting] = useState(false);

  // KM auto-fetch states
  const [kmLoading, setKmLoading] = useState(false);
  const [kmMessage, setKmMessage] = useState("");
  
  // Success overlay state
  const [showSuccess, setShowSuccess] = useState(false);
const [showUpdateSuccess, setShowUpdateSuccess] = useState(false); // ⭐ NEW for update mode
  // Track initially selected defects (read-only)
  const [initialSelectedDefects, setInitialSelectedDefects] =
    useState<number[]>([]);
  const [
    initialSelectedScheduledItems,
    setInitialSelectedScheduledItems,
  ] = useState<number[]>([]);

  // Search states
  const [defectSearchQuery, setDefectSearchQuery] =
    useState("");
  const [scheduledSearchQuery, setScheduledSearchQuery] =
    useState("");

  // Accordion states for "Already in RO" sections - CLOSED by default
  const [defectsAccordionOpen, setDefectsAccordionOpen] =
    useState(false);
  const [scheduledAccordionOpen, setScheduledAccordionOpen] =
    useState(false);

  // Validation error states
  const [errors, setErrors] = useState({
    vehicle: "",
    requestedBy: "",
    busKms: "",
    vendor: "",
    estimatedAmount: "",
    items: "",
  });
// Add this ref to track KM fetch
const kmFetchedRef = useRef<Set<number>>(new Set());


  // Initialize preselected defect IDs - REMOVED
  // Now handled after availableDefects are loaded (see useEffect after formData.vehicle)

  // Populate form data in edit mode
  useEffect(() => {
    if (mode === "edit" && existingROData && isOpen) {
console.log("🔄 EDIT MODE OPENED - Refreshing data...");
    
    const refreshData = async () => {
      // Clear existing data first
      setAvailableDefects([]);
      setDefectsInRO([]);
      setAvailableScheduledItems([]);
      setScheduledItemsInRO([]);
      
      // Fetch fresh data
      await fetchVehicleDefects(Number(formData.vehicle));
      await fetchVehicleScheduledMaintenance(Number(formData.vehicle));
      await fetchDefectsInRO(selectedDefects);
      
      console.log("✅ Data refresh complete");
    };
    
    refreshData();
      
      const defectIds = existingROData.defectIds || [];
      const scheduledItemIds =
        existingROData.scheduledItemIds || [];

      setFormData({
        vehicle: existingROData.vehicle.toString(),
        requestedBy: existingROData.requestedBy.toString(),
        busKms: existingROData.busKms,
        vendor: existingROData.vendor.toString(),
        estimatedAmount: existingROData.estimatedAmount,
        notes: existingROData.notes,
      });
      setSelectedDefects(defectIds);
      setSelectedScheduledItems(scheduledItemIds);
      setInitialSelectedDefects(defectIds);
      setInitialSelectedScheduledItems(scheduledItemIds);
      setKmMessage(""); // Clear KM message in edit mode
setVendorLocked(!!(existingROData as any).vendor_locked);
console.log("🔒 VENDOR LOCK DEBUG:", {
  vendor_locked: (existingROData as any).vendor_locked,
  work_order_number: existingROData.work_order_number,
  full_existingROData: existingROData,
});
      setShowSuccess(false); // Reset success overlay state

      console.log("📝 EDIT mode initialized:", {
        roId: existingROId,
        defectIds,
        scheduledItemIds,
        vehicleId: existingROData.vehicle,
        totalDefects: defectIds.length,
        totalScheduled: scheduledItemIds.length,
      });

      // Fetch defect details for defects already in this RO
      fetchDefectsInRO(existingROData.defectIds || []);
    } else if (mode === "create" && isOpen) {
      // Reset form for create mode
      setFormData({
        vehicle: preselectedVehicleId?.toString() || "",
        requestedBy: "",
        busKms: "0",
        vendor: "",
        estimatedAmount: "0",
        notes: "",
      });
      // Don't clear selected defects here - they'll be set after availableDefects load
      if (!preselectedDefectIds) {
        setSelectedDefects([]);
      }
      setSelectedScheduledItems([]);
      setShowSuccess(false); // Reset success overlay state
    } else if (mode === "update" && existingROData && isOpen) {
      setFormData({
        vehicle: existingROData.vehicle.toString(),
        requestedBy: existingROData.requestedBy.toString(),
        busKms: existingROData.busKms,
        vendor: existingROData.vendor.toString(),
        estimatedAmount: existingROData.estimatedAmount,
        notes: existingROData.notes,
        // Update mode specific fields
        invoice_amount: existingROData.invoice_amount || "0",
        work_order_number:
          existingROData.work_order_number || "",
        invoice_number: existingROData.invoice_number || "",
        kms_after_service:
          existingROData.kms_after_service || "0",
        service_completed_date:
          existingROData.service_completed_date || "",
        payment_method:
          existingROData.payment_method?.toString() || "",
        payment_notes: existingROData.payment_notes || "",
        repair_notes: existingROData.repair_notes || "",
      });
      setSelectedDefects(existingROData.defectIds || []);
      setSelectedScheduledItems(
        existingROData.scheduledItemIds || [],
      );
      setInitialSelectedDefects(existingROData.defectIds || []);
      setInitialSelectedScheduledItems(
        existingROData.scheduledItemIds || [],
      );
      setVendorLocked(false);
    }
  }, [mode, existingROData, isOpen, preselectedVehicleId]);

  // Fetch users on mount
  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen]);

// Fetch defects when vehicle changes
useEffect(() => {
  if (formData.vehicle) {
    const vehicleId = Number(formData.vehicle);
    
    fetchVehicleDefects(vehicleId);
    fetchVehicleScheduledMaintenance(vehicleId);
    
    // Auto-fetch current kilometers from Motive API (CREATE mode only)
    if (mode === "create" && !kmFetchedRef.current.has(vehicleId)) {
      kmFetchedRef.current.add(vehicleId); // ⭐ Mark as fetched
      fetchVehicleCurrentKm(vehicleId);
    }
  } else {
    setAvailableDefects([]);
    setAvailableScheduledItems([]);
    setKmMessage("");
  }
}, [formData.vehicle, mode]);
useEffect(() => {
  if (!isOpen) {
    kmFetchedRef.current.clear(); // ⭐ Reset when modal closes
  }
}, [isOpen]);
  // Auto-select preselected defects after available defects are loaded
  useEffect(() => {
    if (
      preselectedDefectIds &&
      availableDefects.length > 0 &&
      mode === "create"
    ) {
      const ids = preselectedDefectIds
        .split(",")
        .map((id) => parseInt(id.trim()))
        .filter((id) => !isNaN(id));
      // Match by id field, but store as vrlid (which is what the checkbox uses)
      const validVrlids = ids
        .map(
          (id) =>
            availableDefects.find((d) => d.id === id)?.vrlid,
        )
        .filter(
          (vrlid): vrlid is number => vrlid !== undefined,
        );

      if (validVrlids.length > 0) {
        setSelectedDefects(validVrlids);
        console.log(
          `✅ Auto-selected ${validVrlids.length} preselected regular defects (vrlids):`,
          validVrlids,
        );
      }
    }
  }, [availableDefects, preselectedDefectIds, mode]);

  // Auto-select preselected maintenance defects after available scheduled items are loaded
  useEffect(() => {
    if (
      preselectedDefectIds &&
      availableScheduledItems.length > 0 &&
      mode === "create"
    ) {
      const ids = preselectedDefectIds
        .split(",")
        .map((id) => parseInt(id.trim()))
        .filter((id) => !isNaN(id));
      // Match by id field, but store as vrlid/scsid (which is what the checkbox uses)
      const validVrlids = ids
        .map(
          (id) =>
            availableScheduledItems.find((d) => d.id === id)
              ?.vrlid,
        )
        .filter(
          (vrlid): vrlid is number => vrlid !== undefined,
        );

      if (validVrlids.length > 0) {
        setSelectedScheduledItems(validVrlids);
        console.log(
          `✅ Auto-selected ${validVrlids.length} preselected maintenance defects (vrlids):`,
          validVrlids,
        );
      }
    }
  }, [availableScheduledItems, preselectedDefectIds, mode]);

  // Set default values for Requested By (current user) and Vendor (SM Autocare Ltd) in create mode
  useEffect(() => {
    if (
      isOpen &&
      mode === "create" &&
      users.length > 0 &&
      vendors.length > 0
    ) {
      // Only set defaults if form fields are empty (not in edit mode)
      setFormData((prev) => {
        const updates: any = {};

        // Set default Requested By to current logged-in user
        if (!prev.requestedBy && user?.id) {
          // Find user in the users list by matching ID
          const currentUserInList = users.find(
            (u) => u.uid === user.id,
          );
          if (currentUserInList) {
            updates.requestedBy =
              currentUserInList.uid.toString();
            console.log(
              "✅ Auto-filled Requested By:",
              currentUserInList.fullname,
            );
          }
        }

        // Set default Vendor to SM Autocare Ltd
        if (!prev.vendor) {
          const smAutocare = vendors.find(
            (v) => v.vendor_name === "SM Autocare Ltd",
          );
          if (smAutocare) {
            updates.vendor = smAutocare.id.toString();
            console.log(
              "✅ Auto-filled Vendor: SM Autocare Ltd",
            );
          }
        }

        return Object.keys(updates).length > 0
          ? { ...prev, ...updates }
          : prev;
      });
    }
  }, [isOpen, mode, users, vendors, user]);

  const fetchUsers = async () => {
    try {
      const response = await fetch(
        buildApiUrl(
          `${API_ENDPOINTS.users.base}?role=1,2&status=1`,
        ),
        {
          headers: { "ngrok-skip-browser-warning": "true" },
        },
      );
      const data = await response.json();
      if (data.success) {
        setUsers(data.data || []);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to load users");
    }
  };

  const fetchVehicleDefects = async (vehicleId: number) => {
  setLoadingDefects(true);
  try {
    const params = new URLSearchParams();
    
    // ADD THIS: Cache busting timestamp
    params.append("_t", Date.now().toString());

    // Only pass txtDefects in CREATE mode with preselected defects
    if (mode === "create" && preselectedDefectIds) {
      params.append("txtDefects", preselectedDefectIds);
    }

    // Pass ro_id in EDIT mode to get defects with their RO statuses
    if (mode === "edit" && existingROId) {
      params.append("ro_id", existingROId.toString());
      console.log("📝 EDIT MODE: Fetching defects for RO:", {
        vehicleId,
        roId: existingROId,
        timestamp: Date.now(),
      });
    }

    // ⭐ NEW: Exclude maintenance defects from Section 1
    params.append("source_filter", "exclude_maintenance");

    const response = await fetch(
      buildApiUrl(
        `${API_ENDPOINTS.repairOrders.defects(vehicleId)}?${params}`,
      ),
      {
        headers: { 
          "ngrok-skip-browser-warning": "true",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache"
        },
      },
    );

      const data = await response.json();
      if (data.success) {
        const defects = data.data || [];

        console.log(
          `✅ Loaded ${defects.length} defects for vehicle ${vehicleId}`,
          {
            totalDefects: defects.length,
            defectIds: defects.map((d) => d.vrlid),
            mode,
            existingROId,
          },
        );

        // In EDIT mode, separate defects into two groups
        if (mode === "edit" && existingROId) {
          // Group 1: Defects already in this RO (have rpor_status)
          const defectsInThisRO = defects.filter(
            (d) => d.rpor_status,
          );

          // Group 2: Available defects (no rpor_status)
          const availableForSelection = defects.filter(
            (d) => !d.rpor_status,
          );

          console.log("📊 EDIT MODE defect groups:", {
            inRO: defectsInThisRO.length,
            available: availableForSelection.length,
            inROIds: defectsInThisRO.map((d) => d.vrlid),
            availableIds: availableForSelection.map(
              (d) => d.vrlid,
            ),
          });

          setDefectsInRO(defectsInThisRO);
          setAvailableDefects(availableForSelection);
        } else {
          // CREATE mode: all defects are available
          setAvailableDefects(defects);
        }
      }
    } catch (error) {
      console.error("Error fetching defects:", error);
      toast.error("Failed to load defects");
    } finally {
      setLoadingDefects(false);
    }
    console.log("🔍 ALL DEFECTS STATUSES:", defects.map(d => ({
  id: d.vrlid,
  status: d.defect_status,
  source: d.defect_source
})));
  };

  // Fetch defect details for defects already in this RO (for edit mode)
  const fetchDefectsInRO = async (defectIds: number[]) => {
    if (defectIds.length === 0 || !existingROId) {
      setDefectsInRO([]);
      return;
    }



    console.log(
      "🔍 Fetching RO details to get defects with statuses, RO ID:",
      existingROId,
    );

    try {
      // Fetch the full RO details which includes defects with their rpor_status
      const response = await fetch(
        buildApiUrl(
          API_ENDPOINTS.repairOrders.details(existingROId),
        ),
        {
          headers: { "ngrok-skip-browser-warning": "true" },
          credentials: "include",
        },
      );

      const data = await response.json();
      if (data.success && data.data && data.data.repairs) {
        const defectsWithStatus = data.data.repairs as Defect[];
        setDefectsInRO(defectsWithStatus);
        console.log(
          `✅ Loaded ${defectsWithStatus.length} defects already in RO with statuses:`,
          defectsWithStatus.map((d) => ({
            id: d.vrlid,
            status: d.rpor_status,
          })),
        );
      } else {
        setDefectsInRO([]);
        console.warn("No repairs found in RO details response");
      }
    } catch (error) {
      console.error("Error fetching defects in RO:", error);
      setDefectsInRO([]);
    }
  };

  const fetchVehicleScheduledMaintenance = async (
    vehicleId: number,
  ) => {
    setLoadingScheduled(true);
    try {
      const params = new URLSearchParams();

      // If in edit mode, include RO ID so API returns defects already in this RO
      if (mode === "edit" && existingROId) {
        params.append("ro_id", existingROId.toString());
        console.log(
          "📝 EDIT MODE: Fetching maintenance defects for RO:",
          {
            vehicleId,
            roId: existingROId,
            params: params.toString(),
          },
        );
      }

      // ⭐ NEW: Fetch ONLY maintenance defects (not calculated items)
      params.append("source_filter", "maintenance");

      const response = await fetch(
        buildApiUrl(
          `${API_ENDPOINTS.repairOrders.defects(vehicleId)}?${params}`,
        ),
        {
          headers: { "ngrok-skip-browser-warning": "true" },
        },
      );

      console.log(
        `🌐 [FRONTEND] Fetching maintenance defects for vehicle ${vehicleId}...`,
      );

      const data = await response.json();
      if (data.success) {
        const maintenanceDefects = data.data || [];

        console.log(
          `✅ Loaded ${maintenanceDefects.length} maintenance defects for vehicle ${vehicleId}`,
          {
            totalDefects: maintenanceDefects.length,
            defectIds: maintenanceDefects.map(
              (d: Defect) => d.vrlid,
            ),
            mode,
            existingROId,
          },
        );

        // In EDIT mode, separate items into two groups (same as Section 1 logic)
        if (mode === "edit" && existingROId) {
          // Group 1: Defects already in this RO (have rpor_status)
          const defectsInThisRO = maintenanceDefects.filter(
            (d: Defect) => d.rpor_status,
          );

          // Group 2: Available defects (no rpor_status)
          const availableForSelection =
            maintenanceDefects.filter(
              (d: Defect) => !d.rpor_status,
            );

          console.log(
            "📊 EDIT MODE maintenance defect groups:",
            {
              inRO: defectsInThisRO.length,
              available: availableForSelection.length,
              inROIds: defectsInThisRO.map(
                (d: Defect) => d.vrlid,
              ),
              availableIds: availableForSelection.map(
                (d: Defect) => d.vrlid,
              ),
            },
          );

          // Store in scheduled items state (reusing existing state variables)
          setScheduledItemsInRO(
            defectsInThisRO.map((d) => ({
              scsid: d.vrlid,
              setting_name: d.repair_desc,
              setting_type: "MAINTENANCE",
              kms_html: "",
              duration_html: "",
              trip_actual_run_kms_htm: "",
              days_from_effective_date_htm: "",
              rpor_status: d.rpor_status,
              repair_purchase_order: d.repair_purchase_order,
              notes: d.notes,
              defect_source: d.defect_source,
              vrlid: d.vrlid,
              repair_code_category: d.repair_code_category,
              repair_code_category_name:
                d.repair_code_category_name,
              repair_desc: d.repair_desc,
              repair_notes: d.repair_notes,
              defect_status: d.defect_status,
            })),
          );

          setAvailableScheduledItems(
            availableForSelection.map((d) => ({
              scsid: d.vrlid,
              id: d.id, // ⭐ ADD THIS: Include id for preselection matching
              setting_name: d.repair_desc,
              setting_type: "MAINTENANCE",
              kms_html: "",
              duration_html: "",
              trip_actual_run_kms_htm: "",
              days_from_effective_date_htm: "",
              notes: d.notes,
              defect_source: d.defect_source,
              vrlid: d.vrlid,
              repair_code_category: d.repair_code_category,
              repair_code_category_name:
                d.repair_code_category_name,
              repair_desc: d.repair_desc,
              defect_status: d.defect_status,
            })),
          );
        } else {
          // CREATE mode: all maintenance defects are available
          setAvailableScheduledItems(
            maintenanceDefects.map((d: Defect) => ({
              scsid: d.vrlid,
              id: d.id, // ⭐ ADD THIS: Include id for preselection matching
              setting_name: d.repair_desc,
              setting_type: "MAINTENANCE",
              kms_html: "",
              duration_html: "",
              trip_actual_run_kms_htm: "",
              days_from_effective_date_htm: "",
              notes: d.notes,
              defect_source: d.defect_source,
              vrlid: d.vrlid,
              repair_code_category: d.repair_code_category,
              repair_code_category_name:
                d.repair_code_category_name,
              repair_desc: d.repair_desc,
              defect_status: d.defect_status,
            })),
          );
        }

        // Clear configuration name (no longer needed)
        setConfigurationName("");
      }
    } catch (error) {
      console.error(
        "Error fetching maintenance defects:",
        error,
      );
      toast.error("Failed to load maintenance defects");
    } finally {
      setLoadingScheduled(false);
    }
  };

  const fetchVehicleCurrentKm = async (vehicleId: number) => {
     // ⭐ GUARD: Don't fetch KM in edit or update modes
    if (mode === "edit" || mode === "update") {
      return;
    }
     // ⭐⭐⭐ ADD THIS NEW GUARD HERE (after the mode check) ⭐⭐⭐
if (submitting || showSuccess || showUpdateSuccess || !isOpen) {
  return;
}

    if (!vehicleId) {
      setFormData((prev) => ({ ...prev, busKms: "0" }));
      setKmMessage("");
      toast.dismiss(); // ⭐ Add this line

      return;
    }

    try {
      setKmLoading(true);
      setKmMessage("Fetching km details from Motive...");

      const response = await fetch(
        buildApiUrl(
          API_ENDPOINTS.vehicles.currentKm(vehicleId),
        ),
        {
          method: "GET",
          headers: {
            "ngrok-skip-browser-warning": "true",
          },
        },
      );

      const data = await response.json();
// ⭐ NEW: Check if modal is still open before showing toast
if (!isOpen) {
  return;
}
      if (data.success && data.kilometers > 0) {
        setFormData((prev) => ({
          ...prev,
          busKms: data.kilometers.toString(),
        }));
        setKmMessage("✅ Fetched from Motive");

        toast.success("Vehicle odometer fetched from Motive", {
          description: `Current reading: ${data.kilometers.toFixed(2)} km`,
            position: "bottom-left",
        });
      } else {
        setKmMessage("⚠️ Unable to fetch from Motive");

        toast.warning("Could not fetch odometer from Motive", {
          description: "Please enter kilometers manually",
          position: "bottom-left",
        });
      }
    } catch (error) {
      console.error("Error fetching KM:", error);
      setKmMessage("❌ Error fetching from Motive");

      toast.error("Failed to fetch vehicle kilometers", {
        description: "Please enter manually",

      });
    } finally {
      setKmLoading(false);
    }
  };

      const checkMechanicAssignment = async (
  vrlId: number
): Promise<MechanicCheckResult> => {
  try {
    const response = await fetch(
      buildApiUrl(
        `${API_ENDPOINTS.repairOrders.base}/${existingROId}/defect-mechanic-check/${vrlId}`
      ),
      {
        headers: { "ngrok-skip-browser-warning": "true" },
        credentials: "include",
      }
    );
    const data = await response.json();
    if (data.success && data.hasHours) {
      return { hasHours: true, summary: data.summary, items: data.data };
    }
    return { hasHours: false };
  } catch (error) {
    console.error("Error checking mechanic assignment:", error);
    return { hasHours: false };
  }
};

const buildMechanicBlockMessage = (result: MechanicCheckResult): string => {
  if (!result.items || result.items.length === 0)
    return "A mechanic has already contributed hours to this defect.";

  const lines: string[] = [
    `Cannot remove — ${result.summary?.total_assignments} mechanic assignment(s) across ${result.summary?.total_repair_items} repair item(s) | Total: ${result.summary?.total_hours} hrs`,
    "",
  ];
  result.items.forEach((item) => {
    lines.push(`🔧 ${item.repair_item_name}`);
    item.mechanics.forEach((m) => {
      lines.push(`   • ${m.mechanic_name} — ${m.actual_hours} hrs`);
    });
  });
  return lines.join("\n");
};
const handleDefectToggle = async (defectId: number) => {
    const isRemoving = selectedDefects.includes(defectId);

    if (isRemoving && mode === "edit" && initialSelectedDefects.includes(defectId)) {
      const defect = defectsInRO.find((d) => d.vrlid === defectId);
    if (defect?.rpor_status === "In_Progress" || defect?.rpor_status === "In Progress") {
        const result = await checkMechanicAssignment(defectId);
        if (result.hasHours) {
          toast.error(buildMechanicBlockMessage(result), {
            duration: 8000,
            style: { whiteSpace: "pre-line" },
          });
          return;
        }
      }
    }

    setSelectedDefects((prev) => {
      const newSelection = isRemoving
        ? prev.filter((id) => id !== defectId)
        : [...prev, defectId];
      console.log("🔄 Defect Toggle:", {
        defectId,
        action: isRemoving ? "REMOVE" : "ADD",
        previousSelection: prev,
        newSelection,
        totalSelected: newSelection.length,
      });
      return newSelection;
    });

    if (errors.items) setErrors({ ...errors, items: "" });
  };

  const handleScheduledToggle = (itemId: number) => {
    setSelectedScheduledItems((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId],
    );
    // Clear items error when user selects/deselects
    if (errors.items) setErrors({ ...errors, items: "" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Clear previous errors
    setErrors({
      vehicle: "",
      requestedBy: "",
      busKms: "",
      vendor: "",
      estimatedAmount: "",
      items: "",
    });

    // Validation
    let hasErrors = false;
    const newErrors = {
      vehicle: "",
      requestedBy: "",
      busKms: "",
      vendor: "",
      estimatedAmount: "",
      items: "",
    };

    if (!formData.vehicle) {
      newErrors.vehicle = "Please select a vehicle";
      hasErrors = true;
    }

    if (!formData.requestedBy) {
      newErrors.requestedBy =
        "Please select who requested this repair";
      hasErrors = true;
    }

    if (!formData.busKms || parseFloat(formData.busKms) <= 0) {
      newErrors.busKms =
        "Please enter valid vehicle odometer reading";
      hasErrors = true;
    }

    if (!formData.vendor) {
      newErrors.vendor = "Please select a vendor";
      hasErrors = true;
    }

    // Estimated Amount is now OPTIONAL - removed validation
    // if (!formData.estimatedAmount || parseFloat(formData.estimatedAmount) <= 0) {
    //   newErrors.estimatedAmount = 'Please enter valid estimated repair amount';
    //   hasErrors = true;
    // }

    if (
      selectedDefects.length === 0 &&
      selectedScheduledItems.length === 0
    ) {
      newErrors.items =
        "Please select at least one defect or scheduled maintenance item";
      hasErrors = true;
    }

    // ⭐ NEW: Validate scheduled maintenance items for duplicates (CREATE mode only)
    if (
      mode === "create" &&
      selectedScheduledItems.length > 0
    ) {
      const duplicateItems: {
        name: string;
        roNumber: string;
        status: string;
      }[] = [];

      selectedScheduledItems.forEach((itemId) => {
        const item = availableScheduledItems.find(
          (i) => i.scsid === itemId,
        );
        if (item && item.existing_ro_number) {
          duplicateItems.push({
            name: item.setting_name,
            roNumber: item.existing_ro_number,
            status: item.existing_ro_status || "Unknown",
          });
        }
      });

      if (duplicateItems.length > 0) {
        const errorMessage =
          duplicateItems.length === 1
            ? `"${duplicateItems[0].name}" is already in ${duplicateItems[0].roNumber} (Status: ${duplicateItems[0].status})`
            : `${duplicateItems.length} items are already in active ROs:\n` +
              duplicateItems
                .map(
                  (d) =>
                    `• ${d.name} → ${d.roNumber} (${d.status})`,
                )
                .join("\n");

        newErrors.items =
          "Some scheduled maintenance items are already in active ROs";
        hasErrors = true;

        toast.error(errorMessage, {
          duration: 6000,
          style: { whiteSpace: "pre-line" },
        });
      }
    }

    if (hasErrors) {
      setErrors(newErrors);
      if (!newErrors.items) {
        toast.error("Please fill all required fields");
      }
      return;
    }

    // ⭐ Safety net: block submit if any removed In_Progress defect has mechanic hours
    if (mode === "edit") {
      const removedDefects = initialSelectedDefects.filter(
        (id) => !selectedDefects.includes(id)
      );
      for (const defectId of removedDefects) {
        const defect = defectsInRO.find((d) => d.vrlid === defectId);
  if (defect?.rpor_status === "In_Progress" || defect?.rpor_status === "In Progress") {
          const result = await checkMechanicAssignment(defectId);
          if (result.hasHours) {
            toast.error(buildMechanicBlockMessage(result), {
              duration: 8000,
              style: { whiteSpace: "pre-line" },
            });
            return;
          }
        }
      }
    }

    setSubmitting(true);

    // Show processing toast
    const processingMessage =
      mode === "edit"
        ? "Updating Repair Order..."
        : "Creating Repair Order...";
    toast.loading(processingMessage);

    try {
      console.log("🚀 Submitting RO Update:", {
        mode,
        roId: existingROId,
        selectedDefects,
        initialSelectedDefects,
        selectedScheduledItems,
        formData,
      });

      // ⭐ CHANGE: Maintenance defects are now regular defects, combine both arrays
      // Section 1 (selectedDefects) = skysoft/motive defects
      // Section 2 (selectedScheduledItems) = maintenance defects
      // Both should be sent as 'vrls' since they're all defects now
      const allDefects = [
        ...selectedDefects,
        ...selectedScheduledItems,
      ];

      const payload = {
        txtVehicle: formData.vehicle,
        txtRequestedBy: formData.requestedBy,
        txtBusKms: formData.busKms,
        txtVendor: formData.vendor,
        txtEstimatedAmount: formData.estimatedAmount,
        txtNotes: formData.notes,
        vrls: allDefects, // ⭐ All defects (skysoft/motive/maintenance)
        scheduled_maintenance_items: [], // ⭐ No longer used (kept for backward compatibility)
      };

      console.log("📦 Payload being sent:", payload);
      console.log("📊 Defect breakdown:", {
        section1_defects: selectedDefects.length,
        section2_maintenance_defects:
          selectedScheduledItems.length,
        total_defects: allDefects.length,
      });

      const url =
        mode === "edit"
          ? buildApiUrl(
              `${API_ENDPOINTS.repairOrders.base}/${existingROId}`,
            )
          : buildApiUrl(API_ENDPOINTS.repairOrders.create);

      const method = mode === "edit" ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      console.log("📥 Response from server:", data);

      toast.dismiss(); // Dismiss loading toast

if (data.success) {
// REPLACE — pass garage flag to overlay via state:
const garageTriggered = data.garage_webhook_triggered ?? false;
setGarageWebhookTriggered(garageTriggered);  // new state

if (mode === "edit") {
  setShowUpdateSuccess(true);
  setTimeout(() => {
    toast.success(`Repair Order #${existingROId} updated successfully!`);
    onSuccess(existingROId, "edit");
    onClose();
    setTimeout(() => setShowUpdateSuccess(false), 300);
  }, 5000);
} else if (mode === "update") {
    // ⭐ UPDATE mode - show success overlay (same as create)
    setShowUpdateSuccess(true);
    
    setTimeout(() => {
      toast.success(`Repair Order #${existingROId} completed successfully!`);
      onSuccess(existingROId, "update");
      onClose();
      setTimeout(() => setShowUpdateSuccess(false), 300);
    }, 3500);
  } else {
    // Create mode - show success overlay
    setShowSuccess(true);
    
    setTimeout(() => {
      toast.success(`Repair Order #${data.ro_id} created successfully!`);
      onSuccess(data.ro_id, "create");
      onClose();
      setTimeout(() => setShowSuccess(false), 300);
    }, 5000);
  }
} else {
        toast.error(
          data.message || `Failed to ${mode} repair order`,
        );
      }
    } catch (error) {
      console.error(`Error ${mode}ing RO:`, error);
      toast.dismiss(); // Dismiss loading toast
      toast.error(
        `Failed to ${mode} repair order. Please try again.`,
      );
    } finally {
      setSubmitting(false);
    }
  };

  const getUserDisplayName = (user: User) => {
    if (user.nickname) {
      return `${user.fullname} (${user.nickname})`;
    }
    let name = user.fullname;
    if (user.middlename) name += ` ${user.middlename}`;
    if (user.lastname) name += ` ${user.lastname}`;
    return name;
  };



  // Filter defects based on search query
  // NOTE: In EDIT mode, availableDefects already excludes defects in RO (separated by rpor_status in fetchVehicleDefects)
  const filteredDefects = availableDefects.filter((defect) => {
    // Apply search filter only (no need to filter by initialSelectedDefects anymore)
    if (!defectSearchQuery.trim()) return true;
    const query = defectSearchQuery.toLowerCase();
    return (
      String(defect.repair_code_category || "")
        .toLowerCase()
        .includes(query) ||
      defect.repair_desc?.toLowerCase().includes(query) ||
      defect.issue_type?.toLowerCase().includes(query) ||
      defect.defect_source?.toLowerCase().includes(query) ||
      defect.vrlid?.toString().includes(query) ||
      defect.notes?.toLowerCase().includes(query)
    );
  });

  // Filter scheduled maintenance based on search query
  // NOTE: In EDIT mode, availableScheduledItems already excludes items in RO (separated by rpor_status in fetchVehicleScheduledMaintenance)
  const filteredScheduledItems = availableScheduledItems.filter(
    (item) => {
      // Apply search filter only (no need to filter by initialSelectedScheduledItems anymore)
      if (!scheduledSearchQuery.trim()) return true;
      const query = scheduledSearchQuery.toLowerCase();
      return (
        item.setting_name?.toLowerCase().includes(query) ||
        item.scsid?.toString().includes(query) ||
        item.trip_actual_run_kms_htm
          ?.toLowerCase()
          .includes(query) ||
        item.days_from_effective_date_htm
          ?.toLowerCase()
          .includes(query)
      );
    },
  );

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black bg-opacity-50 transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-y-0 right-0 z-50 w-full bg-white shadow-2xl flex flex-col animate-slide-in">
{/* Success Overlay - Create Mode */}
<AnimatePresence>
  {showSuccess && (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 bg-white z-50 flex flex-col items-center justify-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.3, type: 'spring', stiffness: 200, damping: 15 }}
      >
        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 className="w-14 h-14 text-green-600" />
        </div>
      </motion.div>
      
      <motion.h3
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        className="text-2xl font-bold text-gray-900 mb-2"
      >
        Repair Order Created Successfully!
      </motion.h3>
      
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, duration: 0.5 }}
        className="flex items-center gap-4 mt-6"
      >
        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ 
            delay: 1.4, 
            duration: 0.6,
            repeat: Infinity,
            repeatType: "reverse",
            repeatDelay: 0.3
          }}
        >
          <ArrowRight className="w-8 h-8 text-blue-600" />
        </motion.div>
        
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 1.8, duration: 0.5 }}
          className="flex items-center gap-3"
        >
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
            <Wrench className="w-6 h-6 text-blue-600" />
          </div>
          <div className="text-left">
      
<p className="text-lg font-semibold text-gray-900">
  {garageWebhookTriggered ? 'Sending to Garage' : 'Repair Order Saved'}
</p>
<p className="text-sm text-gray-600">
  {garageWebhookTriggered ? 'Processing request...' : 'No garage system connected'}
</p>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>

{/* Success Overlay - Update Mode */}
{/* Success Overlay - Update Mode */}
<AnimatePresence>
  {showUpdateSuccess && (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 bg-white z-50 flex flex-col items-center justify-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.3, type: 'spring', stiffness: 200, damping: 15 }}
      >
        <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mb-6">
          <RefreshCw className="w-14 h-14 text-blue-600" />
        </div>
      </motion.div>
      
      <motion.h3
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        className="text-2xl font-bold text-gray-900 mb-2"
      >
        Repair Order Updated
      </motion.h3>
      
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.5 }}
        className="text-gray-600 text-center max-w-md"
      >
        Defect details updated inside RO
      </motion.p>
      
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, duration: 0.5 }}
        className="flex items-center gap-4 mt-6"
      >
        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ 
            delay: 1.4, 
            duration: 0.6,
            repeat: Infinity,
            repeatType: "reverse",
            repeatDelay: 0.3
          }}
        >
          <ArrowRight className="w-8 h-8 text-blue-600" />
        </motion.div>
        
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 1.8, duration: 0.5 }}
          className="flex items-center gap-3"
        >
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
          </div>
          <div className="text-left">
         
<p className="text-lg font-semibold text-gray-900">
  {garageWebhookTriggered ? 'Syncing to Garage System' : 'Repair Order Updated'}
</p>
<p className="text-sm text-gray-600">
  {garageWebhookTriggered ? 'This will update the Garage system automatically' : 'No garage system connected for this vendor'}
</p>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              disabled={submitting}
            >
              <X className="w-5 h-5" />
            </button>
            <div>
    <h2 className="text-lg sm:text-xl text-gray-900">
  {mode === "edit" 
    ? "Edit Repair Order" 
    : mode === "update"
      ? "Update Repair Order"
      : "Create Repair Order"}
</h2>
<p className="text-sm text-gray-600 mt-0.5">
  {mode === "edit" 
    ? `RO #${existingROId}`
    : mode === "update"
      ? `Complete RO #${existingROId}`
      : "Fill in the details below"}
</p>
            </div>
          </div>
       <button
  onClick={handleSubmit}
  disabled={submitting}
  className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
>
  {submitting ? (
    <>
      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
      {mode === "edit" ? "Updating..." : mode === "update" ? "Completing..." : "Creating..."}
    </>
  ) : (
    <>
      <Save className="w-4 h-4" />
      {mode === "edit" ? "Update RO" : mode === "update" ? "Complete RO" : "Create RO"}
    </>
  )}
</button>
        </div>

        {/* Content */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-4 sm:px-6 py-6"
        >
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* LEFT SIDE - RO Information */}
              <div className="lg:col-span-1 space-y-6">
                <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 sm:p-6">
                  <h3 className="text-base text-gray-900 mb-4 border-b border-gray-300 pb-2">
                    RO Information
                  </h3>

                  <div className="space-y-4">
                    {/* Vehicle */}
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">
                        Select Vehicle{" "}
                        <span className="text-red-600">*</span>
                      </label>
                      <select
                        required
                        value={formData.vehicle}
                        onChange={(e) => {
                          setFormData({
                            ...formData,
                            vehicle: e.target.value,
                          });
                          if (errors.vehicle)
                            setErrors({
                              ...errors,
                              vehicle: "",
                            });
                        }}
                        disabled={mode === "edit"}
                        className={`w-full px-3 py-2 text-sm border ${errors.vehicle ? "border-red-500" : "border-gray-300"} rounded-lg focus:outline-none focus:ring-2 ${errors.vehicle ? "focus:ring-red-500" : "focus:ring-blue-500"} ${
                          mode === "edit"
                            ? "bg-gray-100 cursor-not-allowed opacity-60"
                            : ""
                        }`}
                      >
                        <option value="">Select Vehicle</option>
                        {vehicles.map((vehicle) => (
                          <option
                            key={vehicle.id}
                            value={vehicle.id}
                          >
                            {vehicle.vehicle_nickname}
                          </option>
                        ))}
                      </select>
                      {errors.vehicle && (
                        <p className="text-xs text-red-600 mt-1">
                          {errors.vehicle}
                        </p>
                      )}
                      {mode === "edit" && !errors.vehicle && (
                        <p className="text-xs text-gray-500 mt-1">
                          Vehicle cannot be changed when editing
                        </p>
                      )}
                    </div>

                    {/* Requested By */}
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">
                        Requested By{" "}
                        <span className="text-red-600">*</span>
                      </label>
                      <select
                        required
                        value={formData.requestedBy}
                        onChange={(e) => {
                          setFormData({
                            ...formData,
                            requestedBy: e.target.value,
                          });
                          if (errors.requestedBy)
                            setErrors({
                              ...errors,
                              requestedBy: "",
                            });
                        }}
                        className={`w-full px-3 py-2 text-sm border ${errors.requestedBy ? "border-red-500" : "border-gray-300"} rounded-lg focus:outline-none focus:ring-2 ${errors.requestedBy ? "focus:ring-red-500" : "focus:ring-blue-500"}`}
                      >
                        <option value="">Select User</option>
                        {users.map((user) => (
                          <option
                            key={user.uid}
                            value={user.uid}
                          >
                            {getUserDisplayName(user)}
                          </option>
                        ))}
                      </select>
                      {errors.requestedBy && (
                        <p className="text-xs text-red-600 mt-1">
                          {errors.requestedBy}
                        </p>
                      )}
                    </div>

                    {/* Bus KMs */}
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">
                        Bus KM's at time of repair{" "}
                        <span className="text-red-600">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          required
                          min="0"
                          step="0.01"
                          value={formData.busKms}
                          onChange={(e) => {
                            setFormData({
                              ...formData,
                              busKms: e.target.value,
                            });
                            if (errors.busKms)
                              setErrors({
                                ...errors,
                                busKms: "",
                              });
                            setKmMessage(""); // Clear message when user manually edits
                          }}
                          disabled={kmLoading}
                          className={`w-full px-3 py-2 text-sm border ${errors.busKms ? "border-red-500" : "border-gray-300"} rounded-lg focus:outline-none focus:ring-2 ${errors.busKms ? "focus:ring-red-500" : "focus:ring-blue-500"} ${kmLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                        />
                        {kmLoading && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                          </div>
                        )}
                      </div>
                      {kmMessage && (
                        <div
                          className={`text-xs mt-1 flex items-center gap-1 ${
                            kmMessage.includes("✅")
                              ? "text-green-600"
                              : kmMessage.includes("⚠️")
                                ? "text-yellow-600"
                                : kmMessage.includes("❌")
                                  ? "text-red-600"
                                  : "text-blue-600"
                          }`}
                        >
                          {kmMessage}
                        </div>
                      )}
                      {errors.busKms && (
                        <p className="text-xs text-red-600 mt-1">
                          {errors.busKms}
                        </p>
                      )}
                    </div>

{/* Vendor */}
<div>
  <label className="block text-sm text-gray-700 mb-1">
    Vendor{" "}
    <span className="text-red-600">*</span>
  </label>
  <select
    required
    value={formData.vendor}
    onChange={(e) => {
      setFormData({
        ...formData,
        vendor: e.target.value,
      });
      if (errors.vendor)
        setErrors({
          ...errors,
          vendor: "",
        });
    }}
    disabled={vendorLocked}
    className={`w-full px-3 py-2 text-sm border ${
      errors.vendor ? "border-red-500" : "border-gray-300"
    } rounded-lg focus:outline-none focus:ring-2 ${
      errors.vendor ? "focus:ring-red-500" : "focus:ring-blue-500"
    } ${vendorLocked ? "bg-gray-100 cursor-not-allowed opacity-60" : ""}`}
  >
    <option value="">Select Vendor</option>
    {vendors.map((vendor) => (
      <option
        key={vendor.id}
        value={vendor.id}
      >
        {vendor.vendor_name}
      </option>
    ))}
  </select>
  {errors.vendor && (
    <p className="text-xs text-red-600 mt-1">
      {errors.vendor}
    </p>
  )}
{vendorLocked && (
  <div className="mt-2 flex items-start gap-2 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2">
    <span className="text-amber-500 text-sm mt-0.5 flex-shrink-0">🔒</span>
    <p className="text-xs text-amber-800 leading-relaxed">
      Vendor is locked — this RO has an active Work Order in the
      garage system. To change the vendor, remove the Work Order
      from the garage first, then edit this RO.
    </p>
  </div>
)}
</div>

                    {/* Estimated Amount */}
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">
                        Estimated Repair Amount
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.estimatedAmount}
                        onChange={(e) => {
                          setFormData({
                            ...formData,
                            estimatedAmount: e.target.value,
                          });
                          if (errors.estimatedAmount)
                            setErrors({
                              ...errors,
                              estimatedAmount: "",
                            });
                        }}
                        className={`w-full px-3 py-2 text-sm border ${errors.estimatedAmount ? "border-red-500" : "border-gray-300"} rounded-lg focus:outline-none focus:ring-2 ${errors.estimatedAmount ? "focus:ring-red-500" : "focus:ring-blue-500"}`}
                      />
                      {errors.estimatedAmount && (
                        <p className="text-xs text-red-600 mt-1">
                          {errors.estimatedAmount}
                        </p>
                      )}
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">
                        Notes
                      </label>
                      <textarea
                        value={formData.notes}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            notes: e.target.value,
                          })
                        }
                        rows={4}
                        placeholder="Additional notes..."
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>


                  </div>
                </div>

                {/* Selection Summary - Moved to left side below RO Information */}
                {(selectedDefects.length > 0 ||
                  selectedScheduledItems.length > 0) && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 animate-fadeIn">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <h4 className="text-sm text-blue-900 mb-1">
                          Selection Summary
                        </h4>
                        <p className="text-sm text-blue-700">
                          <span className="font-medium">
                            {selectedDefects.length}
                          </span>{" "}
                          defect(s)
                          {mode === "edit" &&
                            initialSelectedDefects.length >
                              0 && (
                              <span className="text-xs ml-1">
                                ({initialSelectedDefects.length}{" "}
                                existing +{" "}
                                {selectedDefects.length -
                                  initialSelectedDefects.length}{" "}
                                new)
                              </span>
                            )}{" "}
                          and{" "}
                          <span className="font-medium">
                            {selectedScheduledItems.length}
                          </span>{" "}
                          scheduled maintenance item(s)
                          {mode === "edit" &&
                            initialSelectedScheduledItems.length >
                              0 && (
                              <span className="text-xs ml-1">
                                (
                                {
                                  initialSelectedScheduledItems.length
                                }{" "}
                                existing +{" "}
                                {selectedScheduledItems.length -
                                  initialSelectedScheduledItems.length}{" "}
                                new)
                              </span>
                            )}{" "}
                          selected
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT SIDE - Vehicle Existing Repairs & Scheduled Maintenance */}
              <div className="lg:col-span-2 space-y-6">
                {/* Vehicle Existing Repairs (Defects) */}
                <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                  <div className="bg-white px-4 py-3 border-b border-gray-300 flex items-center justify-between gap-4">
                    <h3 className="text-base text-gray-900 flex-shrink-0">
                      Vehicle Existing Repairs
                    </h3>
                    {availableDefects.length > 0 && (
                      <div className="flex items-center gap-3 flex-1 max-w-md">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Search repairs..."
                            value={defectSearchQuery}
                            onChange={(e) =>
                              setDefectSearchQuery(
                                e.target.value,
                              )
                            }
                            className="w-full pl-10 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <span className="text-sm text-gray-600 whitespace-nowrap">
                          {selectedDefects.length} selected{" "}
                          {mode === "edit" &&
                            `(${initialSelectedDefects.length} in RO + ${selectedDefects.length - initialSelectedDefects.length} new)`}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Already in RO Defects Section - ACCORDION (Only shows items from backend AND only in EDIT mode) */}
                  {mode === "edit" &&
                    initialSelectedDefects.length > 0 && (
                      <div className="bg-green-50 border-b border-green-200">
                        {/* Accordion Header - Clickable */}
                        <button
                          type="button"
                          onClick={() =>
                            setDefectsAccordionOpen(
                              !defectsAccordionOpen,
                            )
                          }
                          className="w-full px-4 py-3 flex items-center justify-between hover:bg-green-100 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-700 flex-shrink-0" />
                            <div className="text-left">
                              <h4 className="text-sm font-medium text-green-900">
                                Already in this Repair Order (
                                {initialSelectedDefects.length})
                              </h4>
                              <p className="text-xs text-green-700 mt-0.5">
                                You can remove defects added
                                later. The original defect
                                assigned at RO creation cannot
                                be removed.
                              </p>
                            </div>
                          </div>
                          {defectsAccordionOpen ? (
                            <ChevronUp className="w-5 h-5 text-green-700 flex-shrink-0" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-green-700 flex-shrink-0" />
                          )}
                        </button>

                        {/* Accordion Content - Collapsible */}
                        <div
                          className={`bg-white border-t border-green-200 overflow-hidden transition-all duration-300 ease-in-out ${
                            defectsAccordionOpen
                              ? "max-h-[300px] opacity-100"
                              : "max-h-0 opacity-0"
                          }`}
                        >
                          {(() => {
                            // Use defectsInRO state which is fetched separately for edit mode
                            const defectsInThisRO = defectsInRO;

                            // DEBUG: Log to help troubleshoot
                            if (
                              defectsAccordionOpen &&
                              initialSelectedDefects.length > 0
                            ) {
                              console.log(
                                "🔍 Accordion Debug:",
                                {
                                  initialSelectedDefects,
                                  defectsInROCount:
                                    defectsInRO.length,
                                  defectsInROIds:
                                    defectsInRO.map(
                                      (d) => d.vrlid,
                                    ),
                                },
                              );
                            }

                            if (defectsInThisRO.length === 0) {
                              return (
                                <div className="px-4 py-6 text-center">
                                  <p className="text-sm text-gray-500">
                                    Loading defect details...
                                  </p>
                                  <p className="text-xs text-gray-400 mt-2">
                                    Expected IDs: [
                                    {initialSelectedDefects.join(
                                      ", ",
                                    )}
                                    ]
                                  </p>
                                </div>
                              );
                            }

                            return (
                              /* Scrollable table container */
                              <div
                                className="overflow-y-auto h-full"
                                style={{ maxHeight: "300px" }}
                              >
                                <table className="w-full border-collapse">
                                  <thead className="bg-green-50 sticky top-0 z-10">
                                    <tr>
                                      <th className="px-3 py-2 text-left text-xs text-gray-700 border-b border-green-200 w-1/4">
                                        Category
                                      </th>
                                      <th className="px-3 py-2 text-left text-xs text-gray-700 border-b border-green-200 w-1/3">
                                        Repair
                                      </th>
                                    
                                      <th className="px-3 py-2 text-center text-xs text-gray-700 border-b border-green-200 w-24">
                                        Status
                                      </th>
                                      <th className="px-3 py-2 text-center text-xs text-gray-700 border-b border-green-200 w-20">
                                        Remove
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white">
                                    {defectsInThisRO.map(
                                      (defect) => {
                                        const isInProgress =
                                          defect.rpor_status ===
                                          "In_Progress";
                                        const isPending =
                                          defect.rpor_status ===
                                          "Pending";
                                        // Allow removal if defect came from a previous RO (has previous_ro_id)
const blockedStatuses = [ 'SR_STARTED', 'Repair_Started', 'Paused','SR_PAUSED', 'Completed','SR_COMPLETED_FIXED','Repair_Not_Required','Reopened'];
const canRemove = !blockedStatuses.includes(defect.rpor_status || '');
                                        // Check if this defect was newly added in this edit session (not in initial, but selected now)
                                        const isNewlyAdded =
                                          mode === "edit" &&
                                          !initialSelectedDefects.includes(
                                            defect.vrlid,
                                          );

                                        return (
                                          <tr
                                            key={defect.vrlid}
                                            className="border-b border-green-100"
                                          >
                                            <td className="px-3 py-3 text-sm align-top">
                                              <div className="text-gray-900">
                                                {
                                                  defect.repair_code_category
                                                }
                                              </div>
                                              <div className="text-xs text-gray-500">
                                                (
                                                {
                                                  defect.defect_source
                                                }{" "}
                                                - {defect.vrlid}
                                                )
                                                {isNewlyAdded && (
                                                  <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 border border-blue-300">
                                                    NEW
                                                  </span>
                                                )}
                                                {defect.previous_ro_id && (
                                                  <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200">
                                                    from RO#
                                                    {
                                                      defect.previous_ro_id
                                                    }
                                                  </span>
                                                )}
                                              </div>
                                            </td>
                                            <td className="px-3 py-3 text-sm align-top">
                                              <div className="text-gray-900">
                                                {
                                                  defect.repair_desc
                                                }
                                              </div>
                                              {defect.notes && (
                                                <div className="text-xs text-gray-600 italic mt-1">
                                                  <span className="font-medium">
                                                    Notes:
                                                  </span>{" "}
                                                  {defect.notes}
                                                </div>
                                              )}
                                            </td>
                                           
                                            <td className="px-3 py-3 text-center align-top">
                                              <span
                                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                                                  isInProgress
                                                    ? "bg-blue-100 text-blue-800"
                                                    : isPending
                                                      ? "bg-yellow-100 text-yellow-800"
                                                      : "bg-gray-100 text-gray-800"
                                                }`}
                                              >
                                                {defect.rpor_status ||
                                                  "Unknown"}
                                              </span>
                                            </td>
                                            <td className="px-3 py-3 text-center align-top">
                                              <input
                                                type="checkbox"
                                                checked={selectedDefects.includes(
                                                  defect.vrlid,
                                                )}
                                                onChange={async (e) => {
  if (!e.target.checked) {
if (defect.rpor_status === "In_Progress" || defect.rpor_status === "In Progress") {
      const result = await checkMechanicAssignment(defect.vrlid);
      if (result.hasHours) {
        toast.error(buildMechanicBlockMessage(result), {
          duration: 8000,
          style: { whiteSpace: "pre-line" },
        });
        return;
      }
    }
    setSelectedDefects(
      selectedDefects.filter((id) => id !== defect.vrlid)
    );
  } else {
    setSelectedDefects([...selectedDefects, defect.vrlid]);
  }
}}
                                                disabled={
                                                  !canRemove
                                                }
                                                className={`w-4 h-4 border-gray-300 rounded ${
                                                  canRemove
                                                    ? "cursor-pointer hover:border-blue-500"
                                                    : "opacity-50 cursor-not-allowed bg-gray-100"
                                                }`}
                                                title={
                                                  canRemove
                                                    ? "Click to remove from this RO"
                                                    : "Original defect assigned at RO creation cannot be removed"
                                                }
                                              />
                                            </td>
                                          </tr>
                                        );
                                      },
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    )}

                  <div className="bg-white">
                    {!formData.vehicle ? (
                      <p className="text-sm text-gray-500 text-center py-8 italic">
                        Select a vehicle to see its active
                        repairs
                      </p>
                    ) : loadingDefects ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="text-sm text-gray-500 mt-2">
                          Loading defects...
                        </p>
                      </div>
                    ) : availableDefects.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-8">
                        No active repairs available on this
                        vehicle.
                      </p>
                    ) : (
                      <>
                        {/* Scrollable Table Container */}
                        <div
                          className="overflow-y-auto"
                          style={{ maxHeight: "400px" }}
                        >
                          <table className="w-full border-collapse">
                            <thead className="bg-gray-100 sticky top-0 z-10">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs text-gray-700 border-b border-gray-300">
                                  Category
                                </th>
                                <th className="px-3 py-2 text-left text-xs text-gray-700 border-b border-gray-300">
                                  Repair
                                </th>
                               
                               
                                <th className="px-3 py-2 text-left text-xs text-gray-700 border-b border-gray-300">
                                  Status
                                </th>
                            
                                <th className="px-3 py-2 text-center text-xs text-gray-700 border-b border-gray-300 w-16">
                                  <input
                                    type="checkbox"
                                    checked={
                                      filteredDefects.length >
                                        0 &&
                                      filteredDefects.every(
                                        (d) =>
                                          selectedDefects.includes(
                                            d.vrlid,
                                          ),
                                      )
                                    }
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        // Select all VISIBLE filtered defects (add to existing selections from RO)
                                        const newSelections = [
                                          ...new Set([
                                            ...selectedDefects,
                                            ...filteredDefects.map(
                                              (d) => d.vrlid,
                                            ),
                                          ]),
                                        ];
                                        setSelectedDefects(
                                          newSelections,
                                        );
                                      } else {
                                        // Deselect all VISIBLE filtered defects (keep only RO defects + non-visible defects)
                                        const filteredIds =
                                          new Set(
                                            filteredDefects.map(
                                              (d) => d.vrlid,
                                            ),
                                          );
                                        setSelectedDefects(
                                          selectedDefects.filter(
                                            (id) =>
                                              !filteredIds.has(
                                                id,
                                              ),
                                          ),
                                        );
                                      }
                                    }}
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    title="Select all"
                                  />
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white">
                              {filteredDefects.length === 0 ? (
                                <tr>
                                  <td
                                    colSpan={6}
                                    className="px-3 py-8 text-center text-sm text-gray-500"
                                  >
                                    No repairs match your search
                                  </td>
                                </tr>
                              ) : (
                                filteredDefects.map(
                                  (defect) => (
                                    <tr
                                      key={defect.vrlid}
                                      className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
                                    >
                                      <td className="px-3 py-3 text-sm align-top">
                                        <div className="flex items-start gap-2">
                                          <div className="flex-1">
                                            <div className="text-gray-900">
                                              {defect.repair_code_category_name ||
                                                defect.repair_code_category}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                              (
                                              {
                                                defect.defect_source
                                              }{" "}
                                              - {defect.vrlid})
                                              {defect.previous_ro_id && (
                                                <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200">
                                                  from RO#
                                                  {
                                                    defect.previous_ro_id
                                                  }
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </td>
                                      <td className="px-3 py-3 text-sm align-top">
                                        <div className="text-gray-900 mb-1">
                                          {defect.repair_desc}
                                        </div>
                                        {defect.notes && (
                                          <div className="text-xs text-gray-600 italic mb-1">
                                            <span className="font-medium">
                                              Notes:
                                            </span>{" "}
                                            {defect.notes}
                                          </div>
                                        )}
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          {defect.motive_def_unique_id?.startsWith(
                                            "RE",
                                          ) && (
                                            <span className="inline-flex items-center px-2 py-0.5 bg-red-600 text-white text-xs rounded">
                                              Reopened
                                            </span>
                                          )}
                                          {defect.is_duplicate ===
                                            "y" &&
                                            defect.primary_defect_id && (
                                              <span className="inline-flex items-center px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded border border-blue-200">
                                                merged to #
                                                {
                                                  defect.primary_defect_id
                                                }
                                              </span>
                                            )}
                                          {defect.merged_records_id &&
                                            defect.merged_count &&
                                            defect.merged_count >
                                              0 && (
                                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded border border-blue-200">
                                                <span className="bg-blue-600 text-white px-1.5 py-0.5 rounded text-xs">
                                                  {
                                                    defect.merged_count
                                                  }
                                                </span>
                                                merged
                                              </span>
                                            )}
                                        </div>
                                      </td>
                                   
                                      <td className="px-3 py-3 text-sm align-top">
                                        <span className="text-gray-900">
                                          {defect.defect_status}
                                        </span>
                                      </td>
                                     
                                      <td className="px-3 py-3 text-center align-top">
                                        <input
                                          type="checkbox"
                                          checked={selectedDefects.includes(
                                            defect.vrlid,
                                          )}
                                          onChange={() =>
                                            handleDefectToggle(
                                              defect.vrlid,
                                            )
                                          }
                                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                        />
                                      </td>
                                    </tr>
                                  ),
                                )
                              )}
                            </tbody>
                          </table>
                        </div>
                        {/* Table Footer with Stats */}
                        <div className="bg-gray-50 px-4 py-2 border-t border-gray-300 text-xs text-gray-600">
                          Showing {filteredDefects.length} of{" "}
                          {availableDefects.length} repairs
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Scheduled Maintenance */}
                <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                  <div className="bg-white px-4 py-3 border-b border-gray-300 flex items-center justify-between gap-4">
                    <div className="flex-shrink-0">
                      <h3 className="text-base text-gray-900">
                        Scheduled Maintenance
                      </h3>
                      <p className="text-xs text-gray-600 mt-0.5">
                        Maintenance defects created from
                        automated scheduled maintenance checks
                      </p>
                    </div>
                    {availableScheduledItems.length > 0 && (
                      <div className="flex items-center gap-3 flex-1 max-w-md">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Search maintenance..."
                            value={scheduledSearchQuery}
                            onChange={(e) =>
                              setScheduledSearchQuery(
                                e.target.value,
                              )
                            }
                            className="w-full pl-10 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <span className="text-sm text-gray-600 whitespace-nowrap">
                          {selectedScheduledItems.length} /{" "}
                          {filteredScheduledItems.length}{" "}
                          selected
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Already in RO Scheduled Items - ACCORDION (Only shows items from backend AND only in EDIT mode) */}
                  {mode === "edit" &&
                    initialSelectedScheduledItems.length > 0 &&
                    scheduledItemsInRO.length > 0 && (
                      <div className="bg-green-50 border-b border-green-200">
                        {/* Accordion Header - Clickable */}
                        <button
                          type="button"
                          onClick={() =>
                            setScheduledAccordionOpen(
                              !scheduledAccordionOpen,
                            )
                          }
                          className="w-full px-4 py-3 flex items-center justify-between hover:bg-green-100 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-700 flex-shrink-0" />
                            <div className="text-left">
                              <h4 className="text-sm font-medium text-green-900">
                                Already in this Repair Order (
                                {
                                  initialSelectedScheduledItems.length
                                }
                                )
                              </h4>
                              <p className="text-xs text-green-700 mt-0.5">
                                {
                                  initialSelectedScheduledItems.length
                                }{" "}
                                item(s) are already associated
                                and cannot be removed. You can
                                add more items from below.
                              </p>
                            </div>
                          </div>
                          {scheduledAccordionOpen ? (
                            <ChevronUp className="w-5 h-5 text-green-700 flex-shrink-0" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-green-700 flex-shrink-0" />
                          )}
                        </button>

                        {/* Accordion Content - Collapsible */}
                        <div
                          className={`bg-white border-t border-green-200 overflow-hidden transition-all duration-300 ease-in-out ${
                            scheduledAccordionOpen
                              ? "max-h-[300px] opacity-100"
                              : "max-h-0 opacity-0"
                          }`}
                        >
                          {(() => {
                            // In EDIT mode, items already in RO are in scheduledItemsInRO state
                            // In CREATE mode, we filter from availableScheduledItems
                            const scheduledInThisRO =
                              mode === "edit"
                                ? scheduledItemsInRO
                                : availableScheduledItems.filter(
                                    (item) =>
                                      initialSelectedScheduledItems.includes(
                                        item.scsid,
                                      ),
                                  );

                            if (
                              scheduledInThisRO.length === 0
                            ) {
                              return (
                                <div className="px-4 py-6 text-center">
                                  <p className="text-sm text-gray-500">
                                    No scheduled maintenance
                                    items found. The items may
                                    have been removed or the
                                    data is still loading.
                                  </p>
                                  <p className="text-xs text-gray-400 mt-2">
                                    Expected IDs: [
                                    {initialSelectedScheduledItems.join(
                                      ", ",
                                    )}
                                    ]
                                  </p>
                                  <p className="text-xs text-gray-400 mt-1">
                                    Available Items:{" "}
                                    {
                                      availableScheduledItems.length
                                    }{" "}
                                    total
                                  </p>
                                </div>
                              );
                            }

                            return (
                              /* Scrollable table container */
                              <div
                                className="overflow-y-auto h-full"
                                style={{ maxHeight: "300px" }}
                              >
                                <table className="w-full border-collapse">
                                  <thead className="bg-green-50 sticky top-0 z-10">
                                    <tr>
                                      <th className="px-3 py-2 text-left text-xs text-gray-700 border-b border-green-200 w-1/4">
                                        Category
                                      </th>
                                      <th className="px-3 py-2 text-left text-xs text-gray-700 border-b border-green-200 flex-1">
                                        Repair
                                      </th>
                                      <th className="px-3 py-2 text-left text-xs text-gray-700 border-b border-green-200 w-24">
                                        Status
                                      </th>
                                       <th className="px-3 py-2 text-left text-xs text-gray-700 border-b border-green-200 w-24">
                                        Remove
                                      </th>
                                      <th className="px-3 py-2 text-center text-xs text-gray-700 border-b border-green-200 w-12"></th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white">
{scheduledInThisRO.map((item) => {
  const blockedStatuses = ['SR_STARTED', 'Repair_Started', 'Paused','SR_PAUSED', 'Completed','SR_COMPLETED_FIXED','Repair_Not_Required','Reopened'];
  const canRemove = !blockedStatuses.includes(item.rpor_status || '');
  return (
    <tr key={item.scsid} className="border-b border-green-100">
      <td className="px-3 py-3 text-sm align-top">
        <div className="text-gray-900">
          {item.repair_code_category_name || "Scheduled Maintenance"}
        </div>
        <div className="text-xs text-gray-500">
          ({item.defect_source || "maintenance"} - {item.vrlid || item.scsid})
        </div>
      </td>
      <td className="px-3 py-3 text-sm align-top">
        <div className="text-gray-900">
          {item.notes || item.setting_name}
        </div>
      </td>
      <td className="px-3 py-3 text-sm align-top">
        <div className="text-gray-900">
          {item.defect_status || "Open"}
        </div>
      </td>
      <td className="px-3 py-3 text-center align-top">
        <input
          type="checkbox"
          checked={selectedScheduledItems.includes(item.vrlid || item.scsid)}
          onChange={(e) => {
            const id = item.vrlid || item.scsid;
            if (e.target.checked) {
              setSelectedScheduledItems([...selectedScheduledItems, id]);
            } else {
              setSelectedScheduledItems(selectedScheduledItems.filter((i) => i !== id));
            }
          }}
          disabled={!canRemove}
          className={`w-4 h-4 border-gray-300 rounded ${
            canRemove ? "cursor-pointer hover:border-blue-500" : "opacity-50 cursor-not-allowed bg-gray-100"
          }`}
          title={canRemove ? "Click to remove from this RO" : `Cannot remove: status is ${item.rpor_status}`}
        />
      </td>
    </tr>
  );
})}
                                  </tbody>
                                </table>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    )}

                  <div className="bg-white">
                    {!formData.vehicle ? (
                      <p className="text-sm text-gray-500 text-center py-8 italic">
                        Select a vehicle to see its maintenance
                        defects
                      </p>
                    ) : loadingScheduled ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="text-sm text-gray-500 mt-2">
                          Loading maintenance defects...
                        </p>
                      </div>
                    ) : availableScheduledItems.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-8">
                        No maintenance defects available.
                        Maintenance defects are created
                        automatically by the daily scheduled
                        maintenance system.
                      </p>
                    ) : (
                      <>
                        {/* Scrollable Table Container */}
                        <div
                          className="overflow-y-auto"
                          style={{ maxHeight: "300px" }}
                        >
                          <table className="w-full border-collapse">
                            <thead className="bg-gray-100 sticky top-0 z-10">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs text-gray-700 border-b border-gray-300">
                                  Category
                                </th>
                                <th className="px-3 py-2 text-left text-xs text-gray-700 border-b border-gray-300">
                                  Repair
                                </th>
                                <th className="px-3 py-2 text-left text-xs text-gray-700 border-b border-gray-300">
                                  Status
                                </th>
                                <th className="px-3 py-2 text-center text-xs text-gray-700 border-b border-gray-300 w-16">
                                  <input
                                    type="checkbox"
                                    checked={(() => {
                                      // Check if all SELECTABLE+VISIBLE items are selected
                                      const selectableItems =
                                        filteredScheduledItems.filter(
                                          (item) => {
                                            const isAlreadyInRO =
                                              initialSelectedScheduledItems.includes(
                                                item.scsid,
                                              );
                                            return !isAlreadyInRO;
                                          },
                                        );
                                      // If no selectable items, return false
                                      if (
                                        selectableItems.length ===
                                        0
                                      )
                                        return false;
                                      // Check if ALL selectable items are in selectedScheduledItems
                                      return selectableItems.every(
                                        (item) =>
                                          selectedScheduledItems.includes(
                                            item.scsid,
                                          ),
                                      );
                                    })()}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        // Only select VISIBLE items that are NOT already in RO
                                        const selectableItems =
                                          filteredScheduledItems.filter(
                                            (item) => {
                                              const isAlreadyInRO =
                                                initialSelectedScheduledItems.includes(
                                                  item.scsid,
                                                );
                                              return !isAlreadyInRO;
                                            },
                                          );
                                        const newSelections = [
                                          ...new Set([
                                            ...selectedScheduledItems,
                                            ...selectableItems.map(
                                              (item) =>
                                                item.scsid,
                                            ),
                                          ]),
                                        ];
                                        setSelectedScheduledItems(
                                          newSelections,
                                        );
                                      } else {
                                        // Deselect ONLY VISIBLE selectable items (keep items already in RO)
                                        const selectableItems =
                                          filteredScheduledItems.filter(
                                            (item) => {
                                              const isAlreadyInRO =
                                                initialSelectedScheduledItems.includes(
                                                  item.scsid,
                                                );
                                              return !isAlreadyInRO;
                                            },
                                          );
                                        const selectableIds =
                                          new Set(
                                            selectableItems.map(
                                              (item) =>
                                                item.scsid,
                                            ),
                                          );
                                        setSelectedScheduledItems(
                                          selectedScheduledItems.filter(
                                            (id) =>
                                              !selectableIds.has(
                                                id,
                                              ),
                                          ),
                                        );
                                      }
                                    }}
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    title="Select all"
                                  />
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white">
                              {filteredScheduledItems.length ===
                              0 ? (
                                <tr>
                                  <td
                                    colSpan={4}
                                    className="px-3 py-8 text-center text-sm text-gray-500"
                                  >
                                    No maintenance defects match
                                    your search
                                  </td>
                                </tr>
                              ) : (
                                filteredScheduledItems.map(
                                  (item) => {
                                    const isDisabled =
                                      initialSelectedScheduledItems.includes(
                                        item.scsid,
                                      );

                                    return (
                                      <tr
                                        key={item.scsid}
                                        className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
                                      >
                                        {/* Category Column */}
                                        <td className="px-3 py-3 text-sm align-top">
                                          <div className="flex items-start gap-2">
                                            <div className="flex-1">
                                              <div className="text-gray-900">
                                                {item.repair_code_category_name ||
                                                  item.repair_code_category ||
                                                  "N/A"}
                                              </div>
                                              <div className="text-xs text-gray-500">
                                                (maintenance -{" "}
                                                {item.vrlid ||
                                                  item.scsid}
                                                )
                                              </div>
                                            </div>
                                          </div>
                                        </td>

                                        {/* Repair Column */}
                                        <td className="px-3 py-3 text-sm align-top">
                                          {item.notes && (
                                            <div className="text-sm text-gray-600 font-semibold">
                                              {item.notes}
                                            </div>
                                          )}
                                        </td>

                                        {/* Status Column */}
                                        <td className="px-3 py-3 text-sm align-top">
                                          <span className="text-gray-900">
                                            {item.defect_status ||
                                              "Open"}
                                          </span>
                                        </td>

                                        {/* Checkbox Column */}
                                        <td className="px-3 py-3 text-center align-top">
                                          <input
                                            type="checkbox"
                                            checked={selectedScheduledItems.includes(
                                              item.scsid,
                                            )}
                                            onChange={() =>
                                              handleScheduledToggle(
                                                item.scsid,
                                              )
                                            }
                                            disabled={
                                              isDisabled
                                            }
                                            className={`w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 ${
                                              isDisabled
                                                ? "opacity-50 cursor-not-allowed bg-gray-100"
                                                : ""
                                            }`}
                                            title={
                                              initialSelectedScheduledItems.includes(
                                                item.scsid,
                                              )
                                                ? "Already in RO - cannot be removed"
                                                : ""
                                            }
                                          />
                                        </td>
                                      </tr>
                                    );
                                  },
                                )
                              )}
                            </tbody>
                          </table>
                        </div>
                        {/* Table Footer with Stats */}
                        <div className="bg-gray-50 px-4 py-2 border-t border-gray-300 text-xs text-gray-600">
                          Showing{" "}
                          {filteredScheduledItems.length} of{" "}
                          {availableScheduledItems.length}{" "}
                          maintenance defects
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Items Selection Error Message */}
                {errors.items && (
                  <div className="bg-red-50 border-2 border-red-500 rounded-lg p-4 animate-fadeIn">
                    <div className="flex items-start gap-3">
                      <Info className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="text-sm font-medium text-red-900 mb-1">
                          Selection Required
                        </h4>
                        <p className="text-sm text-red-700">
                          {errors.items}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}