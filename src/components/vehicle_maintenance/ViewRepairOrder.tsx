import React, { useEffect, useState } from 'react';
import { X, Edit, Ban, CheckCircle, Printer, Mail, Eye, AlertCircle, FileText, Package, Wrench, Clock, DollarSign, Truck, User, Calendar, Info, MapPin, Phone, Building2, ChevronDown, ChevronRight, Search, Settings } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Separator } from '../../components/ui/separator';
import { ScrollArea } from '../../components/ui/scroll-area';
import { toast } from 'sonner@2.0.3';
import { API_BASE_URL, buildApiUrl, API_ENDPOINTS } from '../../config/api';
import { UpdateROModal } from './UpdateROModal';
import CompleteROModal from './CompleteROModal';
import CompleteROModalWithoutWO from './CompleteROModalWithoutWOProps';
import { showConfirmationToast } from '../../utils/confirmationToast';
import { generateEnterpriseROPrint } from '../../utils/printTemplate';
import { motion, AnimatePresence } from "motion/react";
import {  ArrowRight, CheckCircle2 } from "lucide-react";
interface ViewRepairOrderProps {
  roId: number;
  onClose: () => void;
  onRefresh?: () => void;
  onEdit?: (roId: number) => void;
}

interface RepairItem {
  id: number;
  vrlid: number;
  repair_code_category: string;
  repair_desc: string;
  issue_type: string;
  rpor_status: string; // Snapshot status when added to RO
  live_defect_status: string; // Live current status from vehicle_repair_logs
  defect_source: string;
  notes: string;
  manager_status: string | null;
  manager_name: string | null;
  manager_update_date: string | null;
  fullname: string | null;
  middlename: string | null;
  lastname: string | null;
  manager_id: number | null;
  is_duplicate: string;
  merged_records_id: string | null;
  merged_count: number;
  primary_defect_id: number | null;
  motive_def_unique_id: string | null;
  motive_driver_signed: string | null;
  motive_driver_signed_date: string | null;
  motive_driver_inspection_status: string | null;
  motive_driver_username: string | null;
  reported_by: number | null;
  reported_by_name: string | null;
  repair_purchase_order: number;
  repair_log_id: number;
  // Per-item completion details
  work_order_number: string | null;
  invoice_number: string | null;
  invoice_url: string | null;
  invoice_amount: number | null;
  service_completion_date: string | null;
  current_kms: number | null;
garage_repair_items: GarageRepairItem[];
}
interface ScheduledMaintenanceItem {
  id: number;
  vrlid: number | null;
  setting_name: string;
  rpor_status: string;
   repair_notes?: string; 
  scheduled_maintenance_setting_id: number;
  repair_purchase_order: number;
  // Per-item completion details
  work_order_number: string | null;
  invoice_number: string | null;
  invoice_url: string | null;
  invoice_amount: number | null;
  service_completion_date: string | null;
  current_kms: number | null;
 garage_repair_items: GarageRepairItem[];
   
  // 🆕 ADD THESE VRL COLUMNS
  vehicle: number;
  external_garage_defect_id: number | string;
  logged_by: number | null;
  reported_by_internal: number | null;  // Renamed to avoid conflict with reported_by above
  logged_on: string | null;
  issue_date: string | null;
  linked_to_ro_items: number | null;
  linked_to_ro_item: number | null;
}

interface ActivityLog {
  id: number;
  log_time: string;
  log_data: string;
  fullname: string;
  nickname: string;
}

interface RODetails {
  rpoid: number;
  vehicle_nickname: string;
  requested_by_name: string;
  created_on: string;
  kms_before_service: number;
  vendor_name: string;
  vendor_email: string;
  vendor_phone: string;
  vendor_garage_url: string | null;
  estimated_repair_amount: number;
  rpostatus: number;
  repair_notes: string;
  invoice_amount: number;
  work_order_number: string;
  invoice_number: string;
  kms_after_service: number;
  service_completed_date: string;
  payment_method_name: string;
  payment_notes: string;
  attached_invoice_url: string;
  invoice_paid_status: string;
  summary: {
    item_count: number | string;  // Backend returns string, we convert to number
    status_open_count: number | string;
    status_in_progress_count: number | string;
    status_completed_count: number | string;
    status_repair_not_required_count: number | string;
  };
  repairs: RepairItem[];
  scheduled_maintenance: ScheduledMaintenanceItem[];  // ✅ Added for print template compatibility
  scheduledMaintenance: ScheduledMaintenanceItem[];  // Original camelCase format
  logs: ActivityLog[];
  attachments: any[];
}
interface GarageRepairNote {
  id: number;
  repair_item_id: number;
  garage_note_id: number;
  note: string;
  mechanicName: string | null;
  created_by: string | null;
  created_at: string;
}

// ✅ NEW
interface MechanicAssignment {
  ma_id: number;
  repair_item_id: number;
  mechanic_name: string | null;
  bay_number: string | null;
  ma_status: string | null;
  approval_status: string | null;
  approved_by: string | null;
  approved_at: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  actual_start_datetime: string | null;
  actual_end_datetime: string | null;
  mechanic_challenge_notes: string | null;
  invoice_notes: string | null;
  invoice_hours: number;
  actual_hours: number;
  duration: number;
}

interface GarageRepairItem {
  ri_id: number;
  ro_repair_or_sm_id: number;
  garage_repair_id: number;
  ri_name: string;
  ri_description: string | null;
  estimated_hours: number;
  labor_cost: number;
  total_estimated_cost: number;
  total_actual_hours: number;
  ri_status: string;
  ri_defect_status: string;
  required_parts: string | null;
  ri_created_at: string;
  mechanic_assignments: MechanicAssignment[];
  notes: GarageRepairNote[];
}

export function ViewRepairOrder({ roId, onClose, onRefresh, onEdit }: ViewRepairOrderProps) {
  const [loading, setLoading] = useState(true);
  const [roDetails, setRoDetails] = useState<RODetails | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [isActivityLogClosing, setIsActivityLogClosing] = useState(false); // ✅ NEW: Track activity log closing animation
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false); // ✅ NEW: Track open animation
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [showCancelOverlay, setShowCancelOverlay] = useState(false);
  
  // Accordion states
  const [repairsExpanded, setRepairsExpanded] = useState(true);
  const [maintenanceExpanded, setMaintenanceExpanded] = useState(true);
  
  // Detail view states
  const [selectedRepair, setSelectedRepair] = useState<RepairItem | null>(null);
  const [selectedMaintenance, setSelectedMaintenance] = useState<ScheduledMaintenanceItem | null>(null);
  const [isDetailClosing, setIsDetailClosing] = useState(false);
  
  // Search states
  const [repairSearchQuery, setRepairSearchQuery] = useState('');
  const [maintenanceSearchQuery, setMaintenanceSearchQuery] = useState('');

  useEffect(() => {
    fetchRODetails();
  }, [roId]);

  // ✅ NEW: Handle Activity Log opening animation
  useEffect(() => {
    if (showActivityLog) {
      // Small delay to trigger animation after DOM mount
      setTimeout(() => {
        setIsActivityLogOpen(true);
      }, 10);
    } else {
      setIsActivityLogOpen(false);
    }
  }, [showActivityLog]);

  const fetchRODetails = async () => {
    try {
      setLoading(true);
      const url = buildApiUrl(API_ENDPOINTS.repairOrders.details(roId));
      
      const response = await fetch(url, {
        headers: {
          'ngrok-skip-browser-warning': 'true'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch repair order details (${response.status})`);
      }

      const data = await response.json();
      
      if (data.success) {
        // ✅ Map scheduledMaintenance to scheduled_maintenance for print template compatibility
        const roData = {
          ...data.data,
          scheduled_maintenance: data.data.scheduledMaintenance || []
        };
        setRoDetails(roData);
        
        // DEBUG: Log how many activity logs were fetched
        console.log('📋 Activity Logs Debug:', {
          ro_id: roId,
          total_logs_from_api: data.data?.logs?.length || 0,
          logs_preview: data.data?.logs?.slice(0, 3).map(log => ({
            id: log.id,
            log_data: log.log_data,
            log_time: log.log_time
          }))
        });
        
        // DEBUG: Log summary data for Complete button
        console.log('🔍 RO Summary Debug:', {
          ro_id: roId,
          status: data.data?.rpostatus,
          summary: data.data?.summary,
          canComplete: data.data?.summary ? 
            (data.data.summary.item_count > 0 && 
             data.data.summary.item_count === (data.data.summary.status_completed_count + data.data.summary.status_repair_not_required_count)) 
            : false
        });
      } else {
        throw new Error(data.error || 'Failed to fetch repair order details');
      }
    } catch (error: any) {
      console.error('Error fetching RO details:', error);
      toast.error(`Failed to load repair order details: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  // ✅ NEW: Handle Activity Log close with smooth animation
  const handleCloseActivityLog = () => {
    setIsActivityLogClosing(true);
    setTimeout(() => {
      setShowActivityLog(false);
      setIsActivityLogClosing(false);
    }, 300);
  };

  const handleEditRO = () => {
    if (onEdit && roDetails) {
      handleClose();
      // Small delay to allow view modal to close before opening edit modal
      setTimeout(() => {
        onEdit(roDetails.rpoid);
      }, 350);
    }
  };

const handleCancelRO = async () => {
  if (!roDetails) return;

  // Show confirmation toast first
  showConfirmationToast({
    title: 'Are you sure you want to cancel this Repair Order?',
    confirmText: 'OK',
    cancelText: 'Cancel',
    variant: 'destructive',
    onConfirm: async () => {
      try {
        setCancelling(true);
        
        // Show the success overlay immediately
        setShowCancelOverlay(true);
        
        const response = await fetch(buildApiUrl(API_ENDPOINTS.repairOrders.cancel(roId)), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true'
          },
          body: JSON.stringify({}),
        });

        const data = await response.json();

        if (data.success) {
          // Keep overlay visible for 3 seconds then close
          setTimeout(() => {
            setShowCancelOverlay(false);
            toast.success('Repair order cancelled successfully');
            onRefresh?.();
            handleClose();
          }, 5000);
       } else {
  setShowCancelOverlay(false);
  toast.error(data.error || 'Failed to cancel repair order', {
    duration: 8000,
    style: { whiteSpace: 'pre-line' },
  });
}
      } catch (error) {
        setShowCancelOverlay(false);
        console.error('Error cancelling RO:', error);
        toast.error('Failed to cancel repair order');
      } finally {
        setCancelling(false);
      }
    }
  });
};

  const handleCompleteRO = () => {
    // Open the Complete RO Modal
    setShowCompleteModal(true);
  };

  // ✅ Print functionality - Enterprise Level
  const handlePrint = () => {
    if (!roDetails) {
      toast.error('No repair order data to print');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow pop-ups to print');
      return;
    }

    // Generate enterprise-level print content
    const printContent = generateEnterpriseROPrint(roDetails);
    printWindow.document.write(printContent);
    printWindow.document.close();
    
    // Wait for content to load, then print
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  };

  const generatePrintHTML = () => {
    if (!roDetails) return '';

    const statusLabels: Record<number, string> = {
      1: 'Pending',
      2: 'In Progress',
      3: 'Completed',
      4: 'RO Cancelled'
    };

    const currentStatus = statusLabels[roDetails.rpostatus] || 'Unknown';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Repair Order #${roDetails.rpoid} - ${roDetails.vehicle_nickname}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            padding: 40px;
            color: #1f2937;
            line-height: 1.6;
          }
          .header {
            border-bottom: 4px solid #2563eb;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .company-name {
            font-size: 28px;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 5px;
          }
          .document-title {
            font-size: 20px;
            color: #4b5563;
            margin-bottom: 15px;
          }
          .ro-number {
            font-size: 32px;
            font-weight: bold;
            color: #1f2937;
            margin-bottom: 10px;
          }
          .vehicle-info {
            font-size: 18px;
            color: #6b7280;
          }
          .status-badge {
            display: inline-block;
            padding: 6px 16px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 600;
            margin-top: 10px;
          }
          .status-pending { background: #fef3c7; color: #92400e; }
          .status-inprogress { background: #dbeafe; color: #1e40af; }
          .status-completed { background: #d1fae5; color: #065f46; }
          .status-cancelled { background: #fee2e2; color: #991b1b; }
          .info-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
            margin-bottom: 30px;
          }
          .info-section {
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 20px;
          }
          .info-section-title {
            font-size: 14px;
            font-weight: 600;
            color: #2563eb;
            text-transform: uppercase;
            margin-bottom: 15px;
            letter-spacing: 0.5px;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #e5e7eb;
          }
          .info-row:last-child {
            border-bottom: none;
          }
          .info-label {
            font-weight: 600;
            color: #6b7280;
            font-size: 13px;
          }
          .info-value {
            color: #1f2937;
            font-size: 13px;
            text-align: right;
          }
          .section-title {
            font-size: 18px;
            font-weight: bold;
            color: #1f2937;
            margin: 30px 0 15px 0;
            padding-bottom: 10px;
            border-bottom: 2px solid #e5e7eb;
          }
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
            font-size: 13px;
          }
          .items-table th {
            background: #2563eb;
            color: white;
            padding: 12px 10px;
            text-align: left;
            font-weight: 600;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .items-table td {
            padding: 12px 10px;
            border-bottom: 1px solid #e5e7eb;
          }
          .items-table tr:last-child td {
            border-bottom: none;
          }
          .items-table tr:nth-child(even) {
            background: #f9fafb;
          }
          .badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
          }
          .badge-open { background: #dbeafe; color: #1e40af; }
          .badge-reopened { background: #fed7aa; color: #c2410c; }
          .badge-inprogress { background: #e0e7ff; color: #4338ca; }
          .badge-paused { background: #fef3c7; color: #92400e; }
          .badge-pending { background: #fef3c7; color: #92400e; }
          .badge-completed { background: #d1fae5; color: #065f46; }
          .badge-rejected { background: #fee2e2; color: #991b1b; }
          .badge-cancelled { background: #f3f4f6; color: #4b5563; }
          .badge-major { background: #fee2e2; color: #991b1b; }
          .badge-minor { background: #fef3c7; color: #92400e; }
          .badge-scheduled { background: #dbeafe; color: #1e40af; }
          .summary-box {
            background: #f0f9ff;
            border: 2px solid #2563eb;
            border-radius: 8px;
            padding: 20px;
            margin: 30px 0;
          }
          .summary-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            font-size: 15px;
          }
          .summary-label {
            font-weight: 600;
            color: #1f2937;
          }
          .summary-value {
            color: #2563eb;
            font-weight: bold;
          }
          .notes-section {
            background: #fffbeb;
            border: 1px solid #fcd34d;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
          }
          .notes-title {
            font-weight: 600;
            color: #92400e;
            margin-bottom: 10px;
            font-size: 14px;
          }
          .notes-content {
            color: #78350f;
            font-size: 13px;
            line-height: 1.6;
          }
          .footer {
            margin-top: 50px;
            padding-top: 20px;
            border-top: 2px solid #e5e7eb;
            text-align: center;
            color: #9ca3af;
            font-size: 12px;
          }
          @media print {
            body {
              padding: 20px;
            }
            .page-break {
              page-break-before: always;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">SKYSOFT FLEET MANAGEMENT</div>
          <div class="document-title">Repair Order Details</div>
          <div class="ro-number">RO #${roDetails.rpoid}</div>
          <div class="vehicle-info">Vehicle: ${roDetails.vehicle_nickname || 'N/A'}</div>
          <span class="status-badge status-${currentStatus.toLowerCase().replace(' ', '')}">${currentStatus}</span>
        </div>

        <div class="info-grid">
          <div class="info-section">
            <div class="info-section-title">Service Information</div>
            <div class="info-row">
              <span class="info-label">Requested By:</span>
              <span class="info-value">${roDetails.requested_by_name || 'N/A'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">KMs Before Service:</span>
              <span class="info-value">${roDetails.kms_before_service?.toLocaleString() || 'N/A'}</span>
            </div>
            ${roDetails.kms_after_service ? `
            <div class="info-row">
              <span class="info-label">KMs After Service:</span>
              <span class="info-value">${roDetails.kms_after_service.toLocaleString()}</span>
            </div>
            ` : ''}
            ${roDetails.service_completed_date ? `
            <div class="info-row">
              <span class="info-label">Service Completed:</span>
              <span class="info-value">${roDetails.service_completed_date}</span>
            </div>
            ` : ''}
          </div>

          <div class="info-section">
            <div class="info-section-title">Vendor Information</div>
            <div class="info-row">
              <span class="info-label">Vendor:</span>
              <span class="info-value">${roDetails.vendor_name || 'N/A'}</span>
            </div>
            ${roDetails.vendor_email ? `
            <div class="info-row">
              <span class="info-label">Email:</span>
              <span class="info-value">${roDetails.vendor_email}</span>
            </div>
            ` : ''}
            ${roDetails.vendor_phone ? `
            <div class="info-row">
              <span class="info-label">Phone:</span>
              <span class="info-value">${roDetails.vendor_phone}</span>
            </div>
            ` : ''}
          </div>

          <div class="info-section">
            <div class="info-section-title">Financial Information</div>
            <div class="info-row">
              <span class="info-label">Estimated Amount:</span>
              <span class="info-value">$${roDetails.estimated_repair_amount?.toFixed(2) || '0.00'}</span>
            </div>
            ${roDetails.invoice_amount ? `
            <div class="info-row">
              <span class="info-label">Invoice Amount:</span>
              <span class="info-value">$${roDetails.invoice_amount.toFixed(2)}</span>
            </div>
            ` : ''}
            ${roDetails.payment_method_name ? `
            <div class="info-row">
              <span class="info-label">Payment Method:</span>
              <span class="info-value">${roDetails.payment_method_name}</span>
            </div>
            ` : ''}
            ${roDetails.invoice_paid_status ? `
            <div class="info-row">
              <span class="info-label">Payment Status:</span>
              <span class="info-value">${roDetails.invoice_paid_status}</span>
            </div>
            ` : ''}
          </div>

          <div class="info-section">
            <div class="info-section-title">Work Order Details</div>
            ${roDetails.work_order_number ? `
            <div class="info-row">
              <span class="info-label">Work Order #:</span>
              <span class="info-value">${roDetails.work_order_number}</span>
            </div>
            ` : ''}
            ${roDetails.invoice_number ? `
            <div class="info-row">
              <span class="info-label">Invoice #:</span>
              <span class="info-value">${roDetails.invoice_number}</span>
            </div>
            ` : ''}
          </div>
        </div>

        ${roDetails.repair_notes ? `
        <div class="notes-section">
          <div class="notes-title">Repair Notes</div>
          <div class="notes-content">${roDetails.repair_notes.replace(/\n/g, '<br>')}</div>
        </div>
        ` : ''}

        ${roDetails.repairs && roDetails.repairs.length > 0 ? `
        <div class="section-title">Repair Items (${roDetails.repairs.length})</div>
        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 8%">ID</th>
              <th style="width: 20%">Category</th>
              <th style="width: 32%">Description</th>
              <th style="width: 10%">Type</th>
              <th style="width: 12%">Status</th>
              <th style="width: 10%">Source</th>
              <th style="width: 8%">Manager</th>
            </tr>
          </thead>
          <tbody>
            ${roDetails.repairs.map(repair => `
              <tr>
                <td><strong>#${repair.vrlid}</strong></td>
                <td>${repair.repair_code_category || 'N/A'}</td>
                <td>${repair.repair_desc || 'N/A'}</td>
                <td><span class="badge badge-${repair.issue_type?.toLowerCase()}">${repair.issue_type || 'N/A'}</span></td>
                <td><span class="badge badge-${repair.rpor_status?.toLowerCase().replace('_', '')}">${repair.rpor_status?.replace(/_/g, ' ') || 'N/A'}</span></td>
                <td><span class="badge badge-${repair.defect_source?.toLowerCase()}">${repair.defect_source || 'N/A'}</span></td>
                <td><span class="badge badge-${repair.manager_status?.toLowerCase()}">${repair.manager_status || 'N/A'}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ` : ''}

        ${roDetails.scheduled_maintenance && roDetails.scheduled_maintenance.length > 0 ? `
        <div class="section-title">Scheduled Maintenance Items (${roDetails.scheduled_maintenance.length})</div>
        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 10%">ID</th>
              <th style="width: 60%">Maintenance Item</th>
              <th style="width: 15%">Status</th>
              <th style="width: 15%">Completion Date</th>
            </tr>
          </thead>
          <tbody>
            ${roDetails.scheduled_maintenance.map(item => `
              <tr>
                <td><strong>#${item.id}</strong></td>
                <td>${item.repair_notes || 'N/A'}</td>
                <td><span class="badge badge-${item.rpor_status?.toLowerCase().replace('_', '')}">${item.rpor_status?.replace(/_/g, ' ') || 'N/A'}</span></td>
                <td>${item.service_completion_date || 'N/A'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ` : ''}

        <div class="summary-box">
          <div class="summary-row">
            <span class="summary-label">Total Items:</span>
            <span class="summary-value">${roDetails.summary?.item_count || 0}</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">Completed:</span>
            <span class="summary-value">${roDetails.summary?.status_completed_count || 0}</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">In Progress:</span>
            <span class="summary-value">${roDetails.summary?.status_in_progress_count || 0}</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">Pending:</span>
            <span class="summary-value">${roDetails.summary?.status_pending_count || 0}</span>
          </div>
        </div>

        <div class="footer">
          <p>Generated on ${new Date().toLocaleString()} | Skysoft Fleet Management System</p>
          <p>This document is computer-generated and does not require a signature</p>
        </div>
      </body>
      </html>
    `;
  };

  const getStatusBadge = (status: number) => {
    switch (status) {
      case 1:
        return <Badge className="bg-green-500 text-white">Active</Badge>;
      case 2:
        return <Badge className="bg-blue-500 text-white">Finished</Badge>;
      case 3:
        return <Badge className="bg-gray-500 text-white">Cancelled</Badge>;
      default:
        return <Badge>Unknown</Badge>;
    }
  };

  const getDefectStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      Open: 'bg-yellow-500 text-white',
      Pending: 'bg-orange-500 text-white',
      In_Progress: 'bg-blue-500 text-white',
      Completed: 'bg-green-500 text-white',
      Rejected: 'bg-red-500 text-white',
      Paused: 'bg-gray-500 text-white',
      Reopened: 'bg-purple-500 text-white',
      Repair_Not_Required: 'bg-teal-500 text-white',
      Ro_Cancelled: 'bg-gray-600 text-white',
    };

    // Handle null or undefined status
    if (!status) {
      return (
        <Badge className="bg-gray-400 text-white">
          Unknown
        </Badge>
      );
    }

    return (
      <Badge className={statusColors[status] || 'bg-gray-400 text-white'}>
        {status.replace(/_/g, ' ')}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    // Format as YYYY-MM-DD HH:MM
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount || 0);
  };

const renderCompletionDetails = (item: RepairItem | ScheduledMaintenanceItem) => {
  const hasDetails = item.work_order_number || item.invoice_number || item.invoice_amount || item.service_completion_date || item.current_kms;

  if (!hasDetails) {
    return (
      <div className="text-xs text-gray-400 italic">
        No completion details
      </div>
    );
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 space-y-2 text-xs">
      {/* WO & Invoice row */}
      {(item.work_order_number || item.invoice_number) && (
        <div className="flex gap-2">
          {item.work_order_number && (
            <div className="flex-1 bg-white rounded border border-gray-100 px-2 py-1.5">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">WO#</p>
              <p className="font-semibold text-gray-800 mt-0.5">{item.work_order_number}</p>
            </div>
          )}
          {item.invoice_number && (
            <div className="flex-1 bg-white rounded border border-gray-100 px-2 py-1.5">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Invoice#</p>
              <p className="font-semibold text-gray-800 mt-0.5">{item.invoice_number}</p>
            </div>
          )}
        </div>
      )}

      {/* Amount & Date row */}
      {(item.invoice_amount || item.service_completion_date) && (
        <div className="flex gap-2">
          {item.invoice_amount && (
            <div className="flex-1 bg-green-50 rounded border border-green-200 px-2 py-1.5">
              <p className="text-[10px] text-green-500 uppercase tracking-wide">Amount</p>
              <p className="font-semibold text-green-700 mt-0.5">CAD ${Number(item.invoice_amount).toFixed(2)}</p>
            </div>
          )}
          {item.service_completion_date && (
            <div className="flex-1 bg-white rounded border border-gray-100 px-2 py-1.5">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Completed</p>
              <p className="font-semibold text-gray-800 mt-0.5">{formatDate(item.service_completion_date)}</p>
            </div>
          )}
        </div>
      )}

      {/* KMs row */}
      {item.current_kms && (
        <div className="bg-white rounded border border-gray-100 px-2 py-1.5">
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Vehicle KMs</p>
          <p className="font-semibold text-gray-800 mt-0.5">{Number(item.current_kms).toLocaleString()} km</p>
        </div>
      )}

      {/* Invoice link */}
      {item.invoice_url && (
        <a href={item.invoice_url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium mt-1">
          <FileText className="h-3 w-3" />
          View Invoice ↗
        </a>
      )}
    </div>
  );
};
  // Check if RO can be canceled
  // Only allow canceling Active ROs where ALL items are "Open" or "In_Progress" (work not completed)
const canCancelRO = () => {
  if (!roDetails) return false;
  if (roDetails.rpostatus !== 1) return false;

  const blockedStatuses = ['SR_STARTED', 'Repair_Started', 'Completed','Paused','SR_PAUSED','In_Progress','In Progress','SR_COMPLETED_FIXED'];

  const hasActiveWork = roDetails.repairs?.some(r => blockedStatuses.includes(r.rpor_status) || blockedStatuses.includes(r.live_defect_status))
    || roDetails.scheduledMaintenance?.some(r => blockedStatuses.includes(r.rpor_status));

  return !hasActiveWork;
};
  
  // Filter repairs based on search query
  const filteredRepairs = roDetails?.repairs?.filter(repair => {
    if (!repairSearchQuery.trim()) return true;
    const query = repairSearchQuery.toLowerCase();
    return (
      repair.vrlid?.toString().includes(query) ||
      repair.repair_code_category?.toLowerCase().includes(query) ||
      repair.repair_desc?.toLowerCase().includes(query) ||
      repair.issue_type?.toLowerCase().includes(query) ||
      repair.defect_source?.toLowerCase().includes(query) ||
      repair.notes?.toLowerCase().includes(query) ||
      repair.live_defect_status?.toLowerCase().includes(query)
    );
  }) || [];
  
  // Filter scheduled maintenance based on search query
  const filteredScheduledMaintenance = roDetails?.scheduledMaintenance?.filter(item => {
    if (!maintenanceSearchQuery.trim()) return true;
    const query = maintenanceSearchQuery.toLowerCase();
    return (
      item.scheduled_maintenance_setting_id?.toString().includes(query) ||
      item.setting_name?.toLowerCase().includes(query) ||
      item.rpor_status?.toLowerCase().includes(query)
    );
  }) || [];

const COMPLETE_STATUSES = ['Completed', 'Repair_Not_Required', 'SR_COMPLETED_FIXED'] as const;
type CompleteStatus = typeof COMPLETE_STATUSES[number];

const canCompleteRO = () => {
  if (!roDetails) return false;
  if (roDetails.rpostatus !== 1) return false;
  if (!roDetails.summary) return false;

  const item_count = Number(roDetails.summary.item_count);
  if (item_count === 0) return false;

  // ✅ If vendor has NO garage_url, bypass all status checks
  const isGarageVendor = roDetails.vendor_garage_url && roDetails.vendor_garage_url.trim() !== '';
  if (!isGarageVendor) {
    console.log('ℹ️ canCompleteRO: Non-garage vendor — bypassing defect status checks');
    return true;
  }

  // Garage vendor — enforce status checks
  const hasRepairs = roDetails.repairs && roDetails.repairs.length > 0;
  if (hasRepairs) {
    const allRepairsComplete = roDetails.repairs.every((repair: RepairItem) => {
      const status = repair.live_defect_status || repair.rpor_status;
      return COMPLETE_STATUSES.includes(status as CompleteStatus);
    });
    if (!allRepairsComplete) {
      console.log('❌ canCompleteRO: Not all repairs are Completed, Repair_Not_Required, or SR_COMPLETED_FIXED');
      return false;
    }
  }

  const hasScheduledMaintenance = roDetails.scheduledMaintenance && roDetails.scheduledMaintenance.length > 0;
  if (hasScheduledMaintenance) {
    const allMaintenanceComplete = roDetails.scheduledMaintenance.every((sm: ScheduledMaintenanceItem) => {
      return COMPLETE_STATUSES.includes(sm.rpor_status as CompleteStatus);
    });
    if (!allMaintenanceComplete) {
      console.log('❌ canCompleteRO: Not all scheduled maintenance items are Completed, Repair_Not_Required, or SR_COMPLETED_FIXED');
      return false;
    }
  }

  return true;
};

const getCompleteButtonTooltip = () => {
    if (!roDetails) return 'Loading...';
    if (roDetails.rpostatus !== 1) return 'Only active ROs can be completed';
    if (!roDetails.summary || Number(roDetails.summary.item_count) === 0)
      return 'RO must have items to complete';

    // ✅ Non-garage vendor — always enabled
    const isGarageVendor = roDetails.vendor_garage_url && roDetails.vendor_garage_url.trim() !== '';
    if (!isGarageVendor) return 'Complete Repair Order';

    // Garage vendor — show blocking messages if incomplete
    const hasRepairs = roDetails.repairs && roDetails.repairs.length > 0;
    if (hasRepairs) {
      const incompleteRepairs = roDetails.repairs.filter((repair: RepairItem) => {
        const status = repair.live_defect_status || repair.rpor_status;
        return status !== 'Completed' && status !== 'Repair_Not_Required';
      });
      if (incompleteRepairs.length > 0) {
        return `All repairs must be "Completed" or "Repair Not Required" (${incompleteRepairs.length} incomplete)`;
      }
    }

    const hasScheduledMaintenance = roDetails.scheduledMaintenance && roDetails.scheduledMaintenance.length > 0;
    if (hasScheduledMaintenance) {
      const incompleteMaintenanceItems = roDetails.scheduledMaintenance.filter((sm: ScheduledMaintenanceItem) => {
        return sm.rpor_status !== 'Completed' && sm.rpor_status !== 'Repair_Not_Required';
      });
      if (incompleteMaintenanceItems.length > 0) {
        return `All scheduled maintenance must be "Completed" or "Repair Not Required" (${incompleteMaintenanceItems.length} incomplete)`;
      }
    }

    return 'Complete Repair Order';
  };

  const canEditRO = () => {
    if (!roDetails) return false;
    if (roDetails.rpostatus !== 1) return false;
    return roDetails.invoice_paid_status !== 'Paid';
  };

  if (loading) {
    return (
      <div className={`fixed inset-0 bg-black/50 z-[100] transition-opacity duration-300`}>
        <div className={`absolute top-0 right-0 h-full w-full bg-white shadow-2xl transform transition-transform duration-300 translate-x-0`}>
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto"></div>
              <p className="mt-6 text-gray-600">Loading repair order details...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!roDetails) {
    return (
      <div className={`fixed inset-0 bg-black/50 z-[100] transition-opacity duration-300`}>
        <div className={`absolute top-0 right-0 h-full w-full bg-white shadow-2xl transform transition-transform duration-300 translate-x-0`}>
          <div className="flex items-center justify-center h-full">
            <div className="text-center p-8">
              <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h3 className="mb-2">Repair Order Not Found</h3>
              <p className="text-gray-600 mb-6">The requested repair order could not be loaded.</p>
              <Button onClick={handleClose} className="bg-blue-600 hover:bg-blue-700">Close</Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div 
        className={`fixed inset-0 bg-black/50 z-[100] transition-opacity duration-300 ${isClosing ? 'opacity-0' : 'opacity-100'}`}
        onClick={() => {
          if (!showCompleteModal && !showUpdateModal) {
            handleClose();
          }
        }}
      >
        <div 
        className={`absolute top-0 right-0 h-full w-full bg-gray-50 shadow-2xl z-[110] transform transition-transform duration-300 ${isClosing ? 'translate-x-full' : 'translate-x-0'} flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cancel Overlay */}
<AnimatePresence>
  {showCancelOverlay && (
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
        <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mb-6">
          <Ban className="w-14 h-14 text-red-600" />
        </div>
      </motion.div>
      
      <motion.h3
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        className="text-2xl font-bold text-gray-900 mb-2"
      >
        Repair Order Cancelled
      </motion.h3>
      
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.5 }}
        className="text-gray-600 text-center max-w-md"
      >
        RO #{roId} has been cancelled successfully
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
            <p className="text-lg font-semibold text-gray-900">Updating Records</p>
            <p className="text-sm text-gray-600">Releasing linked defects...</p>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>

        {/* Compact Header */}
        <div className="bg-white border-b shadow-sm">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-600 p-2.5 rounded-lg">
                    <FileText className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h1 className="text-xl text-gray-900">RO{roDetails.rpoid}</h1>
                    <p className="text-sm text-gray-500">Repair Order</p>
                  </div>
                </div>
                
                <Separator orientation="vertical" className="h-10" />
                
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">Vehicle:</span>
                  <span className="text-sm text-gray-900">{roDetails.vehicle_nickname}</span>
                </div>
                
                <Separator orientation="vertical" className="h-10" />
                
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Status:</span>
                  {getStatusBadge(roDetails.rpostatus)}
                </div>
              </div>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Action Bar */}
          <div className="px-6 pb-3">
            <div className="flex gap-2 flex-wrap">
              {roDetails.rpostatus === 1 && (
                <>
                  {canEditRO() ? (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-2 border-blue-600 text-blue-600 hover:bg-blue-50"
                      onClick={handleEditRO}
                    >
                      <Edit className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled
                      className="gap-2"
                      title="RO can't be edited once invoice is paid"
                    >
                      <Edit className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                  )}

                  {/* Cancel Button - Commented Out */}
            {canCancelRO() ? (
  <Button
    variant="outline"
    size="sm"
    className="gap-2 text-red-600 border-red-300 hover:bg-red-50"
    onClick={handleCancelRO}
    disabled={cancelling}
  >
    <Ban className="h-3.5 w-3.5" />
    {cancelling ? 'Cancelling...' : 'Cancel'}
  </Button>
) : (
  roDetails.rpostatus === 1 && (
    <Button
      variant="outline"
      size="sm"
      disabled
      className="gap-2"
      title="Cannot cancel: items have work in progress (SR_STARTED, In_Progress, Repair_Started, or Completed)"
    >
      <Ban className="h-3.5 w-3.5" />
      Cancel
    </Button>
  )
)}

                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-2 text-green-600 border-green-300 hover:bg-green-50"
                    onClick={handleCompleteRO}
                    disabled={!canCompleteRO()}
                    title={getCompleteButtonTooltip()}
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    Complete
                  </Button>
                </>
              )}

              {roDetails.rpostatus === 2 && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-2 border-blue-600 text-blue-600 hover:bg-blue-50"
                  onClick={() => setShowUpdateModal(true)}
                >
                  <Edit className="h-3.5 w-3.5" />
                  Update
                </Button>
              )}

              <div className="flex-1"></div>

<Button
  variant="outline"
  size="sm"
  className="gap-2"
  onClick={() => fetchRODetails()}
  disabled={loading}
>
  {loading ? (
    <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-blue-600" />
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
  )}
  Refresh
</Button>
              <Button 
                variant="outline" 
                size="sm"
                className="gap-2 border-blue-600 text-blue-600 hover:bg-blue-50"
                onClick={() => setShowActivityLog(true)}
              >
                <Clock className="h-3.5 w-3.5" />
                Activity Logs
                {roDetails.logs && roDetails.logs.length > 0 && (
                  <Badge className="ml-1 bg-blue-600 text-white text-xs px-1.5 py-0.5">{roDetails.logs.length}</Badge>
                )}
              </Button>

              <Button variant="outline" size="sm" className="gap-2" onClick={handlePrint}>
                <Printer className="h-3.5 w-3.5" />
                Print
              </Button>

              <Button variant="outline" size="sm" className="gap-2">
                <Mail className="h-3.5 w-3.5" />
                Email
              </Button>
            </div>
          </div>


        </div>

        {/* Content - Two Column Layout */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full flex">
            {/* Left Column - Details */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Summary Cards Row */}
              <div className="grid grid-cols-5 gap-4">
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-50 p-2.5 rounded-lg">
                      <Package className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Total Items</p>
                      <p className="text-2xl text-gray-900 mt-0.5">{roDetails.summary?.item_count || 0}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-yellow-50 p-2.5 rounded-lg">
                      <Clock className="h-5 w-5 text-yellow-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase">In Progress</p>
                      <p className="text-2xl text-gray-900 mt-0.5">{roDetails.summary?.status_in_progress_count || 0}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-green-50 p-2.5 rounded-lg">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Completed</p>
                      <p className="text-2xl text-gray-900 mt-0.5">{roDetails.summary?.status_completed_count || 0}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-purple-50 p-2.5 rounded-lg flex-shrink-0">
                      <DollarSign className="h-5 w-5 text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 uppercase">Est. Amount</p>
                      <p className="text-lg text-gray-900 mt-0.5 break-words">{formatCurrency(roDetails.estimated_repair_amount)}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-emerald-50 p-2.5 rounded-lg flex-shrink-0">
                      <DollarSign className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 uppercase">Inv.Amount</p>
                      <p className="text-lg text-gray-900 mt-0.5 break-words">{formatCurrency(roDetails.invoice_amount)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Vehicle Repairs Table */}
              {roDetails.repairs && roDetails.repairs.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                  <div className="bg-gray-50 border-b px-4 py-3 flex items-center justify-between gap-4">
                    <h3 className="flex items-center gap-2 text-gray-900 flex-shrink-0">
                      <Wrench className="h-4 w-4 text-blue-600" />
                      Vehicle Existing Repairs
                    </h3>
                    <div className="flex items-center gap-3 flex-1 max-w-md">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search repairs..."
                          value={repairSearchQuery}
                          onChange={(e) => setRepairSearchQuery(e.target.value)}
                          className="w-full pl-10 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 whitespace-nowrap">
                        {filteredRepairs.length} / {roDetails.repairs.length} Items
                      </Badge>
                    </div>
                  </div>
                  <div className="overflow-y-auto" style={{ maxHeight: '500px' }}>
                    <table className="w-full text-sm border-collapse">
                      <thead className="bg-gray-50 sticky top-0 z-10">
                        <tr className="border-b border-gray-200">
                          <th className="px-4 py-2.5 text-left text-xs text-gray-600 uppercase tracking-wider">ID</th>
                          <th className="px-4 py-2.5 text-left text-xs text-gray-600 uppercase tracking-wider">Category</th>
                          <th className="px-4 py-2.5 text-left text-xs text-gray-600 uppercase tracking-wider">Description</th>
                          
                          <th className="px-4 py-2.5 text-left text-xs text-gray-600 uppercase tracking-wider">Completion Details</th>
                          <th className="px-4 py-2.5 text-left text-xs text-gray-600 uppercase tracking-wider">Status</th>
                          <th className="px-4 py-2.5 text-left text-xs text-gray-600 uppercase tracking-wider">Approver</th>
                          <th className="px-4 py-2.5 text-center text-xs text-gray-600 uppercase tracking-wider">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {filteredRepairs.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">
                              No repairs match your search
                            </td>
                          </tr>
                        ) : (
                          filteredRepairs.map((repair) => {
                          // Approver status logic
                          let approverStatusHtml = <span className="text-xs text-gray-500">Pending</span>;
                          
                          if (repair.defect_source === 'skysoft' && repair.manager_status) {
                            const approverName = [repair.fullname, repair.middlename, repair.lastname]
                              .filter(Boolean)
                              .join(' ');
                            approverStatusHtml = (
                              <div className="text-xs">
                                <Badge className="bg-blue-600 text-white text-xs mb-1">{repair.manager_status}</Badge>
                                <div className="text-xs text-gray-600">
                                  {approverName}
                                </div>
                              </div>
                            );
                          } else if (repair.defect_source === 'motive' && repair.manager_status) {
                            approverStatusHtml = (
                              <div className="text-xs">
                                <Badge className="bg-blue-600 text-white text-xs mb-1">{repair.manager_status}</Badge>
                                <div className="text-xs text-gray-600">{repair.manager_name}</div>
                              </div>
                            );
                          }

                          const isReopened = repair.motive_def_unique_id?.startsWith('RE');

                          return (
                            <tr key={repair.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3">
                                <div className="flex flex-col">
                                  <span className="text-blue-600">#{repair.vrlid}</span>
                                  <span className="text-xs text-gray-500 uppercase">{repair.defect_source}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                                  {repair.repair_code_category}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 max-w-md">
                                <div>
                                  <p className="text-sm text-gray-900 mb-1">{repair.repair_desc}</p>
                                  {repair.notes && (
                                    <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded mt-1">
                                      {repair.notes}
                                    </div>
                                  )}
                                  <div className="flex gap-1.5 mt-1.5 flex-wrap">
                                    {isReopened && (
                                      <Badge className="bg-red-600 text-white text-xs">
                                        Reopened
                                      </Badge>
                                    )}
                                    {repair.is_duplicate === 'y' && repair.primary_defect_id && (
                                      <Badge variant="outline" className="text-xs border-blue-500 text-blue-700">
                                        Merged to #{repair.primary_defect_id}
                                      </Badge>
                                    )}
                                    {repair.merged_records_id && repair.merged_count > 0 && (
                                      <Badge variant="outline" className="text-xs border-blue-500 text-blue-700">
                                        +{repair.merged_count} Merged
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </td>
                             
                              <td className="px-4 py-3">{renderCompletionDetails(repair)}</td>
                           <td className="px-4 py-3">{getDefectStatusBadge(repair.rpor_status)}</td>
                              <td className="px-4 py-3">{approverStatusHtml}</td>
                              <td className="px-4 py-3 text-center">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-2 text-blue-600 border-blue-300 hover:bg-blue-50"
                                  onClick={() => setSelectedRepair(repair)}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  Repair Details
                                </Button>
                              </td>
                            </tr>
                          );
                        })
                        )}
                      </tbody>
                    </table>
                  </div>
                  {/* Table Footer with Stats */}
                  <div className="bg-gray-50 px-4 py-2 border-t border-gray-300 text-xs text-gray-600">
                    Showing {filteredRepairs.length} of {roDetails.repairs.length} repairs
                  </div>
                </div>
              )}

              {/* Scheduled Maintenance Table */}
              {roDetails.scheduledMaintenance && roDetails.scheduledMaintenance.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                  <div className="bg-gray-50 border-b px-4 py-3 flex items-center justify-between gap-4">
                    <h3 className="flex items-center gap-2 text-gray-900 flex-shrink-0">
                      <Calendar className="h-4 w-4 text-blue-600" />
                      Scheduled Maintenance
                    </h3>
                    <div className="flex items-center gap-3 flex-1 max-w-md">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search maintenance..."
                          value={maintenanceSearchQuery}
                          onChange={(e) => setMaintenanceSearchQuery(e.target.value)}
                          className="w-full pl-10 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 whitespace-nowrap">
                        {filteredScheduledMaintenance.length} / {roDetails.scheduledMaintenance.length} Items
                      </Badge>
                    </div>
                  </div>
                  <div className="overflow-y-auto" style={{ maxHeight: '400px' }}>
                    <table className="w-full text-sm border-collapse">
                      <thead className="bg-gray-50 sticky top-0 z-10">
                        <tr className="border-b border-gray-200">
                          <th className="px-4 py-2.5 text-left text-xs text-gray-600 uppercase tracking-wider">ID</th>
                          <th className="px-4 py-2.5 text-left text-xs text-gray-600 uppercase tracking-wider">Maintenance Task</th>
                          <th className="px-4 py-2.5 text-left text-xs text-gray-600 uppercase tracking-wider">Completion Details</th>
                          <th className="px-4 py-2.5 text-left text-xs text-gray-600 uppercase tracking-wider">Status</th>
                          <th className="px-4 py-2.5 text-center text-xs text-gray-600 uppercase tracking-wider">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {filteredScheduledMaintenance.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                              No maintenance items match your search
                            </td>
                          </tr>
                        ) : (
                          filteredScheduledMaintenance.map((sm) => (
                          <tr key={sm.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3">
                              <span className="text-blue-600 text-sm"> #{sm.vrlid ?? sm.scheduled_maintenance_setting_id}</span>
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs">
                                {sm.setting_name}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">{renderCompletionDetails(sm)}</td>
                            <td className="px-4 py-3">{getDefectStatusBadge(sm.rpor_status)}</td>
                            <td className="px-4 py-3 text-center">
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-2 text-blue-600 border-blue-300 hover:bg-blue-50"
                                onClick={() => setSelectedMaintenance(sm)}
                              >
                                <Eye className="h-3.5 w-3.5" />
                                Repair Details
                              </Button>
                            </td>
                          </tr>
                        ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  {/* Table Footer with Stats */}
                  <div className="bg-gray-50 px-4 py-2 border-t border-gray-300 text-xs text-gray-600">
                    Showing {filteredScheduledMaintenance.length} of {roDetails.scheduledMaintenance.length} items
                  </div>
                </div>
              )}
            </div>

            {/* Right Column - RO Information & Completion Details */}
            <div className="w-96 border-l border-gray-200 overflow-y-auto p-6 space-y-6 bg-white">
              {/* RO Information */}
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
                <div className="bg-blue-50 border-b px-4 py-3">
                  <h3 className="flex items-center gap-2 text-gray-900">
                    <Info className="h-4 w-4 text-blue-600" />
                    Order Information
                  </h3>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <Truck className="h-4 w-4 text-gray-400 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs text-gray-500">Vehicle</p>
                      <p className="text-sm text-gray-900">{roDetails.vehicle_nickname}</p>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex items-start gap-3">
                    <User className="h-4 w-4 text-gray-400 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs text-gray-500">Requested By</p>
                      <p className="text-sm text-gray-900">{roDetails.requested_by_name}</p>
                    </div>
                  </div>
<Separator />

<div className="flex items-start gap-3">
  <Calendar className="h-4 w-4 text-gray-400 mt-0.5" />
  <div className="flex-1">
    <p className="text-xs text-gray-500">Request on</p>
    <p className="text-sm text-gray-900">{roDetails.created_on ? formatDate(roDetails.created_on) : 'N/A'}</p>
  </div>
</div>
                  <Separator />


                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs text-gray-500">KMs Before Service</p>
                      <p className="text-sm text-gray-900">{roDetails.kms_before_service?.toLocaleString()}</p>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex items-start gap-3">
                    <Building2 className="h-4 w-4 text-gray-400 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs text-gray-500">Vendor</p>
                      <p className="text-sm text-gray-900">{roDetails.vendor_name}</p>
                      {roDetails.vendor_email && (
                        <p className="text-xs text-blue-600 mt-1">{roDetails.vendor_email}</p>
                      )}
                      {roDetails.vendor_phone && (
                        <p className="text-xs text-gray-600 mt-0.5 flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {roDetails.vendor_phone}
                        </p>
                      )}
                    </div>
                  </div>

                  <Separator />

                  <div className="flex items-start gap-3">
                    <DollarSign className="h-4 w-4 text-gray-400 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs text-gray-500">Estimated Amount</p>
                      <p className="text-sm text-green-600">{formatCurrency(roDetails.estimated_repair_amount)}</p>
                    </div>
                  </div>

                  {roDetails.repair_notes && (
                    <>
                      <Separator />
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <p className="text-xs text-amber-700 mb-1">Repair Notes:</p>
                        <p className="text-sm text-gray-800">{roDetails.repair_notes}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Completion Details */}
              {roDetails.rpostatus === 2 && (
                <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
                  <div className="bg-green-50 border-b px-4 py-3">
                    <h3 className="flex items-center gap-2 text-green-800">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      Completion Details
                    </h3>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <DollarSign className="h-4 w-4 text-gray-400 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-xs text-gray-500">Inv.Amount</p>
                        <p className="text-sm text-green-600">{formatCurrency(roDetails.invoice_amount)}</p>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex items-start gap-3">
                      <FileText className="h-4 w-4 text-gray-400 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-gray-500">Work Order Number</p>
                          {roDetails.rpostatus === 1 && (!roDetails.work_order_number || roDetails.work_order_number.trim() === '') && (
                            <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-300">
                              Required to Complete
                            </Badge>
                          )}
                        </div>
                        <p className={`text-sm ${!roDetails.work_order_number || roDetails.work_order_number.trim() === '' ? 'text-orange-600 italic' : 'text-gray-900'}`}>
                          {roDetails.work_order_number || 'Not set'}
                        </p>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex items-start gap-3">
                      <FileText className="h-4 w-4 text-gray-400 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-gray-500">Invoice Number</p>
                          {roDetails.rpostatus === 1 && (!roDetails.invoice_number || roDetails.invoice_number.trim() === '') && (
                            <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-300">
                              Required to Complete
                            </Badge>
                          )}
                        </div>
                        <p className={`text-sm ${!roDetails.invoice_number || roDetails.invoice_number.trim() === '' ? 'text-orange-600 italic' : 'text-gray-900'}`}>
                          {roDetails.invoice_number || 'Not set'}
                        </p>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex items-start gap-3">
                      <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-xs text-gray-500">KMs After Service</p>
                        <p className="text-sm text-gray-900">{roDetails.kms_after_service?.toLocaleString() || 'N/A'}</p>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex items-start gap-3">
                      <Calendar className="h-4 w-4 text-gray-400 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-xs text-gray-500">Service Completed</p>
                        <p className="text-sm text-gray-900">{roDetails.service_completed_date || 'N/A'}</p>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex items-start gap-3">
                      <DollarSign className="h-4 w-4 text-gray-400 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-xs text-gray-500">Payment Method</p>
                        <p className="text-sm text-gray-900">{roDetails.payment_method_name?.replace(/_/g, ' ') || 'N/A'}</p>
                      </div>
                    </div>

                    {roDetails.payment_notes && (
                      <>
                        <Separator />
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <p className="text-xs text-blue-700 mb-1">Payment Notes:</p>
                          <p className="text-sm text-gray-800">{roDetails.payment_notes}</p>
                        </div>
                      </>
                    )}

                    {(roDetails.attached_invoice_url || (roDetails.attachments && roDetails.attachments.length > 0)) && (
                      <>
                        <Separator />
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                          <p className="text-xs text-gray-700 mb-2">Attached Invoices:</p>
                          {roDetails.attached_invoice_url ? (
                            <a
                              href={roDetails.attached_invoice_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline flex items-center gap-2 text-sm"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              Download Invoice
                            </a>
                          ) : (
                            <div className="space-y-1.5">
                              {roDetails.attachments.map((att: any) => (
                                <a
                                  key={att.id}
                                  href={`/uploads/ro/${roDetails.rpoid}/${att.filename}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline flex items-center gap-2 text-sm"
                                >
                                  <FileText className="h-3.5 w-3.5" />
                                  {att.filename_original}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
        </div>

      {/* Activity Log Side Panel */}
      {showActivityLog && (
        <>
          {/* Overlay */}
          <div 
            className={`fixed inset-0 bg-black/60 z-[120] transition-opacity duration-300 ${isActivityLogOpen ? 'opacity-100' : 'opacity-0'}`}
            onClick={handleCloseActivityLog}
          />
          
          {/* Side Panel */}
          <div 
            className={`fixed top-0 right-0 h-screen w-[360px] bg-white shadow-2xl z-[130] transform transition-all duration-300 ease-out flex flex-col ${isActivityLogOpen && !isActivityLogClosing ? 'translate-x-0' : 'translate-x-full'}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Panel Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3 flex items-center justify-between shadow-lg shrink-0">
              <div className="flex items-center gap-2">
                <div className="bg-white/20 p-1.5 rounded-lg">
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base font-semibold">Activity Logs</h2>
                  <p className="text-blue-100 text-[10px] mt-0.5">
                    RO{roDetails.rpoid} - Complete History
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCloseActivityLog}
                className="text-white hover:bg-white/20 shrink-0 h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Log Stats */}
            <div className="bg-blue-50 border-b px-4 py-2 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="bg-blue-600 text-white rounded-full px-2.5 py-0.5">
                    <span className="text-xs font-semibold">{roDetails.logs?.length || 0}</span>
                  </div>
                  <span className="text-xs text-gray-700 font-medium">Total Activity Entries</span>
                </div>
                {roDetails.logs && roDetails.logs.length > 0 && (
                  <div className="text-[10px] text-gray-600">
                    Latest: {formatDate(roDetails.logs[0].log_time)}
                  </div>
                )}
              </div>
            </div>

            {/* Logs Content - Scrollable */}
            <div className="flex-1 overflow-y-auto px-4 pt-3 pb-8 bg-gray-50"
              style={{ maxHeight: 'calc(100vh - 180px)' }}
            >
              {roDetails.logs && roDetails.logs.length > 0 ? (
                <div className="space-y-3 pb-4">
                  {roDetails.logs.map((log, index) => {
                    const isFirst = index === 0;
                    const isLast = index === roDetails.logs.length - 1;
                    
                    // ✅ Detect if this is a Garage API system action (regardless of user_id)
                    const isGarageAction = log.log_data && (
                      log.log_data.includes('Garage Module API') ||
                      log.log_data.includes('Garage Update defect API') ||
                      log.log_data.includes('Garage Import') ||
                      log.log_data.includes('Garage API') ||
                      log.log_data.includes('Garage App webhook') ||
                      log.log_data.toLowerCase().includes('garage')
                    );
                    
                    // ✅ Get appropriate display name based on log type
                    const getDisplayName = () => {
                      // Always check for Garage actions first (even if user_id exists)
                      if (log.log_data) {
                        if (log.log_data.includes('Garage Module API') || log.log_data.includes('Garage Import')) {
                          return 'Garage Import System';
                        }
                        if (log.log_data.includes('Garage Update defect API Call')) {
                          return 'Garage Update System';
                        }
                        if (log.log_data.includes('Garage API') || log.log_data.includes('Garage Update')) {
                          return 'Garage API System';
                        }
                        if (log.log_data.includes('webhook') || log.log_data.includes('Garage App')) {
                          return 'Garage Integration';
                        }
                      }
                      
                      // If not a Garage action, show user name or generic system
                      if (log.fullname && !isGarageAction) return log.fullname;
                      
                      return 'System Action';
                    };
                    
                    return (
                      <div 
                        key={log.id} 
                        className={`relative pl-5 pb-3 ${!isLast ? 'border-l-2 border-blue-200' : ''}`}
                      >
                        {/* Timeline Dot */}
                        <div className={`absolute left-0 -translate-x-1/2 flex items-center justify-center w-4 h-4 rounded-full ${
                          isFirst ? 'bg-blue-600 ring-3 ring-blue-200' : 'bg-blue-400'
                        }`}>
                          {isFirst && <div className="w-1 h-1 bg-white rounded-full" />}
                        </div>

                        {/* Log Card */}
                        <div className={`bg-white border rounded-lg shadow-sm hover:shadow transition-all duration-200 p-2.5 ${
                          isFirst ? 'border-blue-400 ring-1 ring-blue-100' : 'border-gray-200'
                        }`}>
                          <div className="flex items-start justify-between mb-1.5">
                            <div className="flex items-center gap-1.5">
                              <div className={`rounded-full p-1 ${ 
                                isGarageAction ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                              }`}>
                                {isGarageAction ? (
                                  <Settings className="h-3 w-3" />
                                ) : (
                                  <User className="h-3 w-3" />
                                )}
                              </div>
                              <div>
                                <p className={`text-xs font-medium ${isGarageAction ? 'text-purple-700' : 'text-blue-700'}`}>
                                  {getDisplayName()}
                                </p>
                                {log.nickname && log.fullname && !isGarageAction && (
                                  <p className="text-[9px] text-gray-500">@{log.nickname}</p>
                                )}
                                {isGarageAction && (
                                  <p className="text-[9px] text-gray-500">Automated Action</p>
                                )}
                              </div>
                            </div>
                            {isFirst && (
                              <Badge className="bg-green-500 text-white text-[9px] px-2 py-0.5 font-medium shrink-0">Latest</Badge>
                            )}
                          </div>
                          
                          <p className="text-xs text-gray-800 mb-1.5 leading-relaxed">{log.log_data}</p>
                          
                          <div className="flex items-center gap-1 text-[10px] text-gray-500">
                            <Clock className="h-2.5 w-2.5" />
                            {formatDate(log.log_time)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center py-16">
                  <div className="bg-gray-100 rounded-full p-5 mb-4">
                    <Clock className="h-12 w-12 text-gray-400" />
                  </div>
                  <h3 className="text-base font-medium text-gray-800 mb-2">No Activity Logs</h3>
                  <p className="text-sm text-gray-500 max-w-xs">
                    There are no activity logs recorded for this repair order yet. 
                    Actions will appear here as they happen.
                  </p>
                </div>
              )}
            </div>

            {/* Panel Footer */}
            <div className="bg-white border-t px-4 py-2 flex items-center justify-between shrink-0 shadow-lg">
              <p className="text-[10px] text-gray-600">
                Showing all {roDetails.logs?.length || 0} entries
              </p>
              <Button 
                onClick={handleCloseActivityLog}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 h-7 text-xs px-3"
              >
                Close
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Repair Item Detail View */}
      {selectedRepair && (
        <>
          {/* Overlay */}
          <div 
            className={`fixed inset-0 bg-black/50 z-[120] transition-opacity duration-300 ${isDetailClosing ? 'opacity-0' : 'opacity-100'}`}
            onClick={() => {
              setIsDetailClosing(true);
              setTimeout(() => {
                setSelectedRepair(null);
                setIsDetailClosing(false);
              }, 300);
            }}
          />
          
          {/* Detail Panel */}
          <div 
            className={`fixed top-0 right-0 h-full w-full bg-gray-50 shadow-2xl z-[130] transform transition-transform duration-300 flex flex-col ${isDetailClosing ? 'translate-x-full' : 'translate-x-0'}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Panel Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-lg">
                  <Wrench className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-2xl">Repair Details</h2>
                  <p className="text-blue-100 text-sm mt-1">
                    Defect #{selectedRepair.vrlid} - {selectedRepair.defect_source.toUpperCase()}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setIsDetailClosing(true);
                  setTimeout(() => {
                    setSelectedRepair(null);
                    setIsDetailClosing(false);
                  }, 300);
                }}
                className="text-white hover:bg-white/20"
              >
                <X className="h-6 w-6" />
              </Button>
            </div>
{/* Content */}
<div className="flex-1 overflow-y-auto">
  <div className="w-full p-6 space-y-4">
{selectedRepair.garage_repair_items && selectedRepair.garage_repair_items.length > 0 ? (
  <div className="space-y-6">
    {selectedRepair.garage_repair_items.map((garageItem, itemIndex) => (
      <div key={garageItem.ri_id} className="space-y-4">
        
        {/* Separator between multiple repair items */}
        {itemIndex > 0 && (
          <div className="border-t-2 border-blue-300 pt-4">
            <Badge className="bg-blue-100 text-blue-800 text-xs mb-2">
              Repair Item {itemIndex + 1} of {selectedRepair.garage_repair_items.length}
            </Badge>
          </div>
        )}
        {selectedRepair.garage_repair_items.length > 1 && itemIndex === 0 && (
          <Badge className="bg-blue-100 text-blue-800 text-xs mb-2">
            Repair Item 1 of {selectedRepair.garage_repair_items.length}
          </Badge>
        )}

        {/* STATUS BAR */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div style={{ backgroundColor: '#334155' }} className="px-4 py-3 flex items-center gap-2">
            <Info className="h-4 w-4 text-white" />
            <h3 className="text-white text-sm font-semibold">Overview</h3>
          </div>
          <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 uppercase tracking-wide">Defect Status</span>
              {getDefectStatusBadge(garageItem.ri_defect_status)}
            </div>
            <div className="w-px h-6 bg-gray-200" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 uppercase tracking-wide">Item Status</span>
              <Badge className="bg-blue-600 text-white text-xs">{garageItem.ri_status || 'N/A'}</Badge>
            </div>
          </div>
        </div>

        {/* ROW 1: Work Item + Hours & Cost */}
        <div className="grid grid-cols-2 gap-4">

          {/* Work Item */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="bg-blue-600 px-4 py-3 flex items-center gap-2">
              <Wrench className="h-4 w-4 text-white" />
              <h3 className="text-white text-sm font-semibold">Work Item</h3>
              <span className="ml-auto text-xs bg-white/20 text-white px-2 py-0.5 rounded-full">
                #{garageItem.garage_repair_id}
              </span>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Item Name</p>
                <p className="text-sm font-semibold text-gray-900">{garageItem.ri_name || 'N/A'}</p>
              </div>

              {garageItem.ri_description && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Description</p>
                  <p className="text-sm text-gray-700">{garageItem.ri_description}</p>
                </div>
              )}

              {garageItem.required_parts && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs text-amber-600 uppercase tracking-wide mb-1">⚙ Required Parts</p>
                  <p className="text-sm text-amber-900">{garageItem.required_parts}</p>
                </div>
              )}

              <div className="text-xs text-gray-400 pt-1 border-t border-gray-100">
                Created: {garageItem.ri_created_at ? formatDate(garageItem.ri_created_at) : 'N/A'}
              </div>
            </div>
          </div>

          {/* Hours & Cost */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="bg-purple-600 px-4 py-3 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-white" />
              <h3 className="text-white text-sm font-semibold">Hours & Cost</h3>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Hours</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-center">
                    <p className="text-xs text-blue-500 uppercase tracking-wide mb-1">Est. Hours</p>
                    <p className="text-lg font-bold text-blue-700">{garageItem.estimated_hours ?? '—'}</p>
                  </div>
                  <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-center">
                    <p className="text-xs text-indigo-500 uppercase tracking-wide mb-1">Total Actual</p>
                    <p className="text-lg font-bold text-indigo-700">{garageItem.total_actual_hours ?? '—'}</p>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Cost</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-green-50 border border-green-100 rounded-lg p-3 text-center">
                    <p className="text-xs text-green-500 uppercase tracking-wide mb-1">Labor Cost</p>
                    <p className="text-base font-bold text-green-700">{formatCurrency(garageItem.labor_cost)}</p>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-center">
                    <p className="text-xs text-emerald-500 uppercase tracking-wide mb-1">Total Est. Cost</p>
                    <p className="text-base font-bold text-emerald-700">{formatCurrency(garageItem.total_estimated_cost)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ROW 2: Mechanic Assignments (multiple) */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div style={{ backgroundColor: '#4f46e5' }} className="px-4 py-3 flex items-center gap-2">
            <User className="h-4 w-4 text-white" />
            <h3 className="text-white text-sm font-semibold">Mechanic Assignments</h3>
            <span className="ml-auto text-xs bg-white/20 text-white px-2 py-0.5 rounded-full">
              {garageItem.mechanic_assignments.length} {garageItem.mechanic_assignments.length === 1 ? 'assignment' : 'assignments'}
            </span>
          </div>
          <div className="p-4">
            {garageItem.mechanic_assignments.length > 0 ? (
              <div className="grid grid-cols-2 gap-4">
                {garageItem.mechanic_assignments.map((ma) => (
                  <div key={ma.ma_id} className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                    {/* Mechanic Info */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                        <User className="h-5 w-5 text-indigo-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900">{ma.mechanic_name || 'Unassigned'}</p>
                        <p className="text-xs text-gray-500">Bay {ma.bay_number || 'N/A'}</p>
                      </div>
                      <Badge className="bg-blue-600 text-white text-xs">{ma.ma_status || 'N/A'}</Badge>
                    </div>

                    {/* Approval */}
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-gray-400 uppercase tracking-wide">Approval:</span>
                      <Badge variant="outline" className="text-xs">{ma.approval_status || 'N/A'}</Badge>
                      {ma.approved_by && (
                        <span className="text-gray-500">by {ma.approved_by} {ma.approved_at ? `· ${formatDate(ma.approved_at)}` : ''}</span>
                      )}
                    </div>

                    {/* Hours */}
                    <div className="bg-white rounded-lg p-2 flex items-center justify-between text-xs">
                      <div className="text-center">
                        <p className="text-gray-400 uppercase tracking-wide">Actual Hrs</p>
                        <p className="font-semibold text-gray-800">{ma.actual_hours ?? '—'}</p>
                      </div>
                      <div className="w-px h-6 bg-gray-200" />
                      <div className="text-center">
                        <p className="text-gray-400 uppercase tracking-wide">Invoice Hrs</p>
                        <p className="font-semibold text-gray-800">{ma.invoice_hours ?? '—'}</p>
                      </div>
                      <div className="w-px h-6 bg-gray-200" />
                      <div className="text-center">
                        <p className="text-gray-400 uppercase tracking-wide">Duration</p>
                        <p className="font-semibold text-gray-800">{ma.duration ?? '—'}</p>
                      </div>
                    </div>

                    {/* Timeline */}
                    <div className="space-y-2">
                      <div className="bg-white rounded-lg p-2">
                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Scheduled</p>
                        <div className="grid grid-cols-2 gap-1 text-xs">
                          <div>
                            <span className="text-gray-500">Start: </span>
                            <span className="font-semibold">{ma.scheduled_start ? formatDate(ma.scheduled_start) : 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">End: </span>
                            <span className="font-semibold">{ma.scheduled_end ? formatDate(ma.scheduled_end) : 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="bg-teal-50 border border-teal-100 rounded-lg p-2">
                        <p className="text-xs text-teal-600 uppercase tracking-wide mb-1">Actual</p>
                        <div className="grid grid-cols-2 gap-1 text-xs">
                          <div>
                            <span className="text-teal-500">Start: </span>
                            <span className="font-semibold text-teal-800">{ma.actual_start_datetime ? formatDate(ma.actual_start_datetime) : 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-teal-500">End: </span>
                            <span className="font-semibold text-teal-800">{ma.actual_end_datetime ? formatDate(ma.actual_end_datetime) : 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Challenge Notes */}
                    {ma.mechanic_challenge_notes && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                        <p className="text-xs text-red-500 uppercase tracking-wide mb-1">⚠ Challenge Notes</p>
                        <p className="text-sm text-red-900">{ma.mechanic_challenge_notes}</p>
                      </div>
                    )}

                    {/* Invoice Notes */}
                    {ma.invoice_notes && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
                        <p className="text-xs text-blue-500 uppercase tracking-wide mb-1">📋 Invoice Notes</p>
                        <p className="text-sm text-blue-900">{ma.invoice_notes}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <User className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No Mechanic Assigned</p>
              </div>
            )}
          </div>
        </div>

        {/* ROW 3: Notes for this repair item */}
        {garageItem.notes?.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div style={{ backgroundColor: '#f97316' }} className="px-4 py-3 flex items-center gap-2">
              <FileText className="h-4 w-4 text-white" />
              <h3 className="text-white text-sm font-semibold">Mechanic Notes</h3>
              <span className="ml-auto text-xs bg-white/20 text-white px-2 py-0.5 rounded-full">
                {garageItem.notes.length} {garageItem.notes.length === 1 ? 'note' : 'notes'}
              </span>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 gap-3">
                {garageItem.notes.map((note) => (
                  <div key={note.id} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-indigo-600">
                            {(note.mechanicName || note.created_by || '?').charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="text-xs font-semibold text-gray-800">
                          {note.mechanicName || note.created_by || 'Unknown'}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400">{formatDate(note.created_at)}</span>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">{note.note}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    ))}
  </div>
) : (
  <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-10 text-center">
    <Wrench className="h-12 w-12 text-gray-300 mx-auto mb-3" />
    <p className="text-sm font-medium text-gray-500">No Garage Work Item Linked</p>
    <p className="text-xs text-gray-400 mt-1">This repair has not been pushed to Garage yet.</p>
  </div>
)}
</div>
</div>
</div>
    </>
  )}


      {/* Scheduled Maintenance Detail View */}
      {selectedMaintenance && (
        <>
          {/* Overlay */}
          <div 
            className={`fixed inset-0 bg-black/50 z-[120] transition-opacity duration-300 ${isDetailClosing ? 'opacity-0' : 'opacity-100'}`}
            onClick={() => {
              setIsDetailClosing(true);
              setTimeout(() => {
                setSelectedMaintenance(null);
                setIsDetailClosing(false);
              }, 300);
            }}
          />
          
          {/* Detail Panel */}
          <div 
            className={`fixed top-0 right-0 h-full w-full bg-gray-50 shadow-2xl z-[130] transform transition-transform duration-300 flex flex-col ${isDetailClosing ? 'translate-x-full' : 'translate-x-0'}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Panel Header */}
            <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-6 flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-lg">
                  <Calendar className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-2xl">Maintenance Details</h2>
                  <p className="text-purple-100 text-sm mt-1">
                    Task #{selectedMaintenance.scheduled_maintenance_setting_id}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setIsDetailClosing(true);
                  setTimeout(() => {
                    setSelectedMaintenance(null);
                    setIsDetailClosing(false);
                  }, 300);
                }}
                className="text-white hover:bg-white/20"
              >
                <X className="h-6 w-6" />
              </Button>
            </div>

{/* Content */}
<div className="flex-1 overflow-y-auto">
  <div className="w-full p-6 space-y-4">
{selectedMaintenance.garage_repair_items && selectedMaintenance.garage_repair_items.length > 0 ? (
  <div className="space-y-6">
  {selectedMaintenance.garage_repair_items.map((garageItem, itemIndex) => (
      <div key={garageItem.ri_id} className="space-y-4">
        
        {/* Separator between multiple repair items */}
        {itemIndex > 0 && (
          <div className="border-t-2 border-blue-300 pt-4">
            <Badge className="bg-blue-100 text-blue-800 text-xs mb-2">
              Repair Item {itemIndex + 1} of {selectedMaintenance.garage_repair_items.length}
            </Badge>
          </div>
        )}
        {selectedMaintenance.garage_repair_items.length > 1 && itemIndex === 0 && (
          <Badge className="bg-blue-100 text-blue-800 text-xs mb-2">
            Repair Item 1 of {selectedMaintenance.garage_repair_items.length}
          </Badge>
        )}

        {/* STATUS BAR */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div style={{ backgroundColor: '#334155' }} className="px-4 py-3 flex items-center gap-2">
            <Info className="h-4 w-4 text-white" />
            <h3 className="text-white text-sm font-semibold">Overview</h3>
          </div>
          <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 uppercase tracking-wide">Defect Status</span>
              {getDefectStatusBadge(garageItem.ri_defect_status)}
            </div>
            <div className="w-px h-6 bg-gray-200" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 uppercase tracking-wide">Item Status</span>
              <Badge className="bg-blue-600 text-white text-xs">{garageItem.ri_status || 'N/A'}</Badge>
            </div>
          </div>
        </div>

        {/* ROW 1: Work Item + Hours & Cost */}
        <div className="grid grid-cols-2 gap-4">

          {/* Work Item */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="bg-blue-600 px-4 py-3 flex items-center gap-2">
              <Wrench className="h-4 w-4 text-white" />
              <h3 className="text-white text-sm font-semibold">Work Item</h3>
              <span className="ml-auto text-xs bg-white/20 text-white px-2 py-0.5 rounded-full">
                #{garageItem.garage_repair_id}
              </span>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Item Name</p>
                <p className="text-sm font-semibold text-gray-900">{garageItem.ri_name || 'N/A'}</p>
              </div>

              {garageItem.ri_description && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Description</p>
                  <p className="text-sm text-gray-700">{garageItem.ri_description}</p>
                </div>
              )}

              {garageItem.required_parts && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs text-amber-600 uppercase tracking-wide mb-1">⚙ Required Parts</p>
                  <p className="text-sm text-amber-900">{garageItem.required_parts}</p>
                </div>
              )}

              <div className="text-xs text-gray-400 pt-1 border-t border-gray-100">
                Created: {garageItem.ri_created_at ? formatDate(garageItem.ri_created_at) : 'N/A'}
              </div>
            </div>
          </div>

          {/* Hours & Cost */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="bg-purple-600 px-4 py-3 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-white" />
              <h3 className="text-white text-sm font-semibold">Hours & Cost</h3>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Hours</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-center">
                    <p className="text-xs text-blue-500 uppercase tracking-wide mb-1">Est. Hours</p>
                    <p className="text-lg font-bold text-blue-700">{garageItem.estimated_hours ?? '—'}</p>
                  </div>
                  <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-center">
                    <p className="text-xs text-indigo-500 uppercase tracking-wide mb-1">Total Actual</p>
                    <p className="text-lg font-bold text-indigo-700">{garageItem.total_actual_hours ?? '—'}</p>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Cost</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-green-50 border border-green-100 rounded-lg p-3 text-center">
                    <p className="text-xs text-green-500 uppercase tracking-wide mb-1">Labor Cost</p>
                    <p className="text-base font-bold text-green-700">{formatCurrency(garageItem.labor_cost)}</p>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-center">
                    <p className="text-xs text-emerald-500 uppercase tracking-wide mb-1">Total Est. Cost</p>
                    <p className="text-base font-bold text-emerald-700">{formatCurrency(garageItem.total_estimated_cost)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ROW 2: Mechanic Assignments (multiple) */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div style={{ backgroundColor: '#4f46e5' }} className="px-4 py-3 flex items-center gap-2">
            <User className="h-4 w-4 text-white" />
            <h3 className="text-white text-sm font-semibold">Mechanic Assignments</h3>
            <span className="ml-auto text-xs bg-white/20 text-white px-2 py-0.5 rounded-full">
              {garageItem.mechanic_assignments.length} {garageItem.mechanic_assignments.length === 1 ? 'assignment' : 'assignments'}
            </span>
          </div>
          <div className="p-4">
            {garageItem.mechanic_assignments.length > 0 ? (
              <div className="grid grid-cols-2 gap-4">
                {garageItem.mechanic_assignments.map((ma) => (
                  <div key={ma.ma_id} className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                    {/* Mechanic Info */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                        <User className="h-5 w-5 text-indigo-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900">{ma.mechanic_name || 'Unassigned'}</p>
                        <p className="text-xs text-gray-500">Bay {ma.bay_number || 'N/A'}</p>
                      </div>
                      <Badge className="bg-blue-600 text-white text-xs">{ma.ma_status || 'N/A'}</Badge>
                    </div>

                    {/* Approval */}
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-gray-400 uppercase tracking-wide">Approval:</span>
                      <Badge variant="outline" className="text-xs">{ma.approval_status || 'N/A'}</Badge>
                      {ma.approved_by && (
                        <span className="text-gray-500">by {ma.approved_by} {ma.approved_at ? `· ${formatDate(ma.approved_at)}` : ''}</span>
                      )}
                    </div>

                    {/* Hours */}
                    <div className="bg-white rounded-lg p-2 flex items-center justify-between text-xs">
                      <div className="text-center">
                        <p className="text-gray-400 uppercase tracking-wide">Actual Hrs</p>
                        <p className="font-semibold text-gray-800">{ma.actual_hours ?? '—'}</p>
                      </div>
                      <div className="w-px h-6 bg-gray-200" />
                      <div className="text-center">
                        <p className="text-gray-400 uppercase tracking-wide">Invoice Hrs</p>
                        <p className="font-semibold text-gray-800">{ma.invoice_hours ?? '—'}</p>
                      </div>
                      <div className="w-px h-6 bg-gray-200" />
                      <div className="text-center">
                        <p className="text-gray-400 uppercase tracking-wide">Duration</p>
                        <p className="font-semibold text-gray-800">{ma.duration ?? '—'}</p>
                      </div>
                    </div>

                    {/* Timeline */}
                    <div className="space-y-2">
                      <div className="bg-white rounded-lg p-2">
                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Scheduled</p>
                        <div className="grid grid-cols-2 gap-1 text-xs">
                          <div>
                            <span className="text-gray-500">Start: </span>
                            <span className="font-semibold">{ma.scheduled_start ? formatDate(ma.scheduled_start) : 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">End: </span>
                            <span className="font-semibold">{ma.scheduled_end ? formatDate(ma.scheduled_end) : 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="bg-teal-50 border border-teal-100 rounded-lg p-2">
                        <p className="text-xs text-teal-600 uppercase tracking-wide mb-1">Actual</p>
                        <div className="grid grid-cols-2 gap-1 text-xs">
                          <div>
                            <span className="text-teal-500">Start: </span>
                            <span className="font-semibold text-teal-800">{ma.actual_start_datetime ? formatDate(ma.actual_start_datetime) : 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-teal-500">End: </span>
                            <span className="font-semibold text-teal-800">{ma.actual_end_datetime ? formatDate(ma.actual_end_datetime) : 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Challenge Notes */}
                    {ma.mechanic_challenge_notes && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                        <p className="text-xs text-red-500 uppercase tracking-wide mb-1">⚠ Challenge Notes</p>
                        <p className="text-sm text-red-900">{ma.mechanic_challenge_notes}</p>
                      </div>
                    )}

                    {/* Invoice Notes */}
                    {ma.invoice_notes && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
                        <p className="text-xs text-blue-500 uppercase tracking-wide mb-1">📋 Invoice Notes</p>
                        <p className="text-sm text-blue-900">{ma.invoice_notes}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <User className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No Mechanic Assigned</p>
              </div>
            )}
          </div>
        </div>

        {/* ROW 3: Notes for this repair item */}
        {garageItem.notes?.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div style={{ backgroundColor: '#f97316' }} className="px-4 py-3 flex items-center gap-2">
              <FileText className="h-4 w-4 text-white" />
              <h3 className="text-white text-sm font-semibold">Mechanic Notes</h3>
              <span className="ml-auto text-xs bg-white/20 text-white px-2 py-0.5 rounded-full">
                {garageItem.notes.length} {garageItem.notes.length === 1 ? 'note' : 'notes'}
              </span>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 gap-3">
                {garageItem.notes.map((note) => (
                  <div key={note.id} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-indigo-600">
                            {(note.mechanicName || note.created_by || '?').charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="text-xs font-semibold text-gray-800">
                          {note.mechanicName || note.created_by || 'Unknown'}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400">{formatDate(note.created_at)}</span>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">{note.note}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    ))}
  </div>
) : (
  <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-10 text-center">
    <Wrench className="h-12 w-12 text-gray-300 mx-auto mb-3" />
    <p className="text-sm font-medium text-gray-500">No Garage Work Item Linked</p>
    <p className="text-xs text-gray-400 mt-1">This repair has not been pushed to Garage yet.</p>
  </div>
)}
  </div>
</div>

           
          </div>
        </>
      )}

      {/* Update RO Modal */}
      {showUpdateModal && (
        <UpdateROModal
          roId={roId}
          onClose={() => setShowUpdateModal(false)}
          onSuccess={() => {
            fetchRODetails();
            if (onRefresh) {
              onRefresh();
            }
          }}
        />
      )}

{/* Complete RO Modal — garage vendor uses original, non-garage uses WithoutWO */}
      {showCompleteModal && (
        roDetails?.vendor_garage_url && roDetails.vendor_garage_url.trim() !== ''
          ? (
            <CompleteROModal
              isOpen={showCompleteModal}
              onClose={() => setShowCompleteModal(false)}
              roId={roId}
              roDetails={roDetails}
              onSuccess={() => {
                fetchRODetails();
                if (onRefresh) onRefresh();
                setShowCompleteModal(false);
              }}
            />
          )
          : (
            <CompleteROModalWithoutWO
              isOpen={showCompleteModal}
              onClose={() => setShowCompleteModal(false)}
              roId={roId}
              roDetails={roDetails}
              onSuccess={() => {
                fetchRODetails();
                if (onRefresh) onRefresh();
                setShowCompleteModal(false);
              }}
            />
          )
      )}
    </>
  );
}