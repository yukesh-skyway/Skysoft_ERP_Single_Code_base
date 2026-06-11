import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Calendar, DollarSign, FileText, CreditCard, Wrench, ChevronDown, ChevronUp, Package, CheckCircle, Upload, File, Trash2, Download } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { API_BASE_URL, buildApiUrl, API_ENDPOINTS } from '../../config/api';
import { FormDatePickerCustom } from './FormComponents';
import { showConfirmationToast } from '../../utils/confirmationToast';
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight, CheckCircle2 } from "lucide-react";

interface CompleteROModalProps {
  isOpen: boolean;
  onClose: () => void;
  roId: number;
  roDetails: any;
  onSuccess: () => void;
}

// Defect status options (matching PHP globalSkySoftDefectsStatus)
// Only allow Completed and Repair Not Required in Complete RO modal
const DEFECT_STATUS_OPTIONS = [
  'Completed',
  'Repair_Not_Required'
];

export default function CompleteROModal({ isOpen, onClose, roId, roDetails, onSuccess }: CompleteROModalProps) {
  const [loading, setLoading] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [defects, setDefects] = useState<any[]>([]);
  const [scheduledMaintenance, setScheduledMaintenance] = useState<any[]>([]);
  const [invoiceSummaryExpanded, setInvoiceSummaryExpanded] = useState(false);
  
  // 🔥 Success overlay state
  const [showCompleteOverlay, setShowCompleteOverlay] = useState(false);
  
  // 🔥 File upload state
  const [attachedInvoice, setAttachedInvoice] = useState<File | null>(null);
  const [existingAttachments, setExistingAttachments] = useState<any[]>([]);
  const [fileError, setFileError] = useState('');
  
  // Form state
  const [formData, setFormData] = useState({
    txtKms: '',
    txtInvoiceAmount: '',
    txtWorkOrderNumber: '',
    txtInvoiceNumber: '',
    txtServiceCompletedDate: '',
    txtPaymentMethod: '',
    txtPaymentNotes: '',
    txtRepairNotes: ''
  });

  // Defect status mappings
  const [repairStatuses, setRepairStatuses] = useState<Record<string, string>>({});

  // Validation errors
  const [errors, setErrors] = useState({
    txtKms: '',
    txtInvoiceAmount: '',
    txtWorkOrderNumber: '',
    txtInvoiceNumber: '',
    txtServiceCompletedDate: '',
    txtPaymentMethod: '',
    defectStatuses: ''
  });

  useEffect(() => {
    if (isOpen && roDetails) {
      loadModalData();
    }
  }, [isOpen, roDetails]);

  const loadModalData = async () => {
    try {
      // Load payment methods
      const pmResponse = await fetch(buildApiUrl(API_ENDPOINTS.repairOrders.paymentMethods), {
        credentials: 'include'
      });
      const pmData = await pmResponse.json();
      const loadedPaymentMethods = pmData.data || [];
      setPaymentMethods(loadedPaymentMethods);

      // Load defects and scheduled maintenance for this RO and get the data
      const itemsData = await loadROItems();

      // Load existing attachments
      await loadExistingAttachments();

      // Calculate defaults from loaded data
      calculateDefaults(itemsData, loadedPaymentMethods);
    } catch (error) {
      console.error('Error loading modal data:', error);
      toast.error('Failed to load form data');
    }
  };

  const loadExistingAttachments = async () => {
    try {
      const response = await fetch(buildApiUrl(`/api/repair-orders/${roId}/attachments`), {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setExistingAttachments(data.data || []);
      }
    } catch (error) {
      console.error('Error loading attachments:', error);
      // Don't show error toast - attachments are optional
    }
  };

  const loadROItems = async () => {
    try {
      // Get RO details which includes defects and scheduled maintenance
      const response = await fetch(buildApiUrl(API_ENDPOINTS.repairOrders.details(roId)), {
        credentials: 'include'
      });
      const data = await response.json();
      
      console.log('🔍 DEBUG - Full API Response:', data);
      
      if (data.success) {
        const details = data.data;
        let loadedDefects: any[] = [];
        let loadedScheduledMaintenance: any[] = [];
        
        console.log('🔍 DEBUG - details.repairs:', details.repairs);
        
        // Set defects
        if (details.repairs && details.repairs.length > 0) {
          loadedDefects = details.repairs;
          setDefects(details.repairs);
          
          // Initialize repair statuses with current values
          const initialRepairStatuses: Record<string, string> = {};
          details.repairs.forEach((defect: any) => {
            initialRepairStatuses[defect.id] = defect.rpor_status || 'Pending';
          });
          setRepairStatuses(initialRepairStatuses);
        }

        // Set scheduled maintenance
        if (details.scheduledMaintenance && details.scheduledMaintenance.length > 0) {
          loadedScheduledMaintenance = details.scheduledMaintenance;
          setScheduledMaintenance(details.scheduledMaintenance);
        }

        return { defects: loadedDefects, scheduledMaintenance: loadedScheduledMaintenance };
      }
      return { defects: [], scheduledMaintenance: [] };
    } catch (error) {
      console.error('Error loading RO items:', error);
      return { defects: [], scheduledMaintenance: [] };
    }
  };

  // 🔥 File upload handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type (matching PHP: jpg, jpeg, png, gif, pdf)
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf'];
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'pdf'];
    
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension || '')) {
      setFileError('Only JPG, PNG, GIF, and PDF files are allowed');
      setAttachedInvoice(null);
      e.target.value = ''; // Reset input
      return;
    }

    // Validate file size (50MB = 50,000,000 bytes - matching PHP)
    if (file.size > 50000000) {
      setFileError('File size must not exceed 50MB');
      setAttachedInvoice(null);
      e.target.value = ''; // Reset input
      return;
    }

    setFileError('');
    setAttachedInvoice(file);
  };

  const handleRemoveFile = () => {
    setAttachedInvoice(null);
    setFileError('');
  };

// ✅ CORRECTED: calculateDefaults function - Groups by UNIQUE INVOICE NUMBERS
const calculateDefaults = (itemsData: { defects: any[], scheduledMaintenance: any[] }, paymentMethods: any[]) => {
  console.log('🔍 DEBUG - itemsData.defects:', itemsData.defects);
  console.log('🔍 DEBUG - itemsData.scheduledMaintenance:', itemsData.scheduledMaintenance);
  
  // ✅ FIXED: Use Map to track UNIQUE INVOICE NUMBERS and prevent duplicate counting
  const invoiceMap = new Map<string, number>();
  let workOrders: string[] = [];
  let invoiceNumbers: string[] = [];
  let latestServiceDate: string | null = null;
  let maxCurrentKms: number | null = null;

  // Process defects (repairs) from freshly loaded data
  itemsData.defects.forEach((defect: any) => {
    // ✅ FIXED: Group by UNIQUE invoice numbers (not work orders)
    if (defect.invoice_number && defect.invoice_amount) {
      const invNum = defect.invoice_number;
      const amount = parseFloat(defect.invoice_amount);
      
      if (!invoiceMap.has(invNum)) {
        // First time seeing this invoice - add it
        invoiceMap.set(invNum, amount);
        console.log(`  ➕ Adding UNIQUE defect invoice: ${invNum} = $${amount} (ID: ${defect.id})`);
      } else {
        // Duplicate invoice - skip to prevent double counting
        console.log(`  ⏭️  Skipping duplicate invoice: ${invNum} (ID: ${defect.id})`);
      }
    } else if (defect.invoice_amount && !defect.invoice_number) {
      // Item has invoice amount but no invoice number - add to a special "no-inv" category
      const amount = parseFloat(defect.invoice_amount);
      const key = `defect-${defect.id}`;
      invoiceMap.set(key, amount);
      console.log(`  ➕ Adding defect without invoice number: $${amount} (ID: ${defect.id})`);
    }
    
    // Collect unique work order numbers (for display only)
    if (defect.work_order_number && !workOrders.includes(defect.work_order_number)) {
      workOrders.push(defect.work_order_number);
    }
    
    // Collect unique invoice numbers
    if (defect.invoice_number && !invoiceNumbers.includes(defect.invoice_number)) {
      invoiceNumbers.push(defect.invoice_number);
    }
    
    // Use LATEST service completion date
    if (defect.service_completion_date) {
      const date = new Date(defect.service_completion_date);
      if (!latestServiceDate || date > new Date(latestServiceDate)) {
        latestServiceDate = defect.service_completion_date;
      }
    }
    
    // Use MAXIMUM current_kms (vehicle odometer only increases)
    if (defect.current_kms) {
      const kms = parseFloat(defect.current_kms);
      if (maxCurrentKms === null || kms > maxCurrentKms) {
        maxCurrentKms = kms;
      }
    }
  });

  // 🔥 NEW: Process scheduled maintenance items from freshly loaded data
  itemsData.scheduledMaintenance.forEach((sm: any) => {
    // ✅ FIXED: Group by UNIQUE invoice numbers (not work orders)
    if (sm.invoice_number && sm.invoice_amount) {
      const invNum = sm.invoice_number;
      const amount = parseFloat(sm.invoice_amount);
      
      if (!invoiceMap.has(invNum)) {
        // First time seeing this invoice - add it
        invoiceMap.set(invNum, amount);
        console.log(`  ➕ Adding UNIQUE scheduled maintenance invoice: ${invNum} = $${amount} (ID: ${sm.id})`);
      } else {
        // Duplicate invoice - skip to prevent double counting
        console.log(`  ⏭️  Skipping duplicate invoice: ${invNum} (ID: ${sm.id})`);
      }
    } else if (sm.invoice_amount && !sm.invoice_number) {
      // Item has invoice amount but no invoice number - add to a special "no-inv" category
      const amount = parseFloat(sm.invoice_amount);
      const key = `scheduled-${sm.id}`;
      invoiceMap.set(key, amount);
      console.log(`  ➕ Adding scheduled maintenance without invoice number: $${amount} (ID: ${sm.id})`);
    }
    
    // Collect unique work order numbers (for display only)
    if (sm.work_order_number && !workOrders.includes(sm.work_order_number)) {
      workOrders.push(sm.work_order_number);
    }
    
    // Collect unique invoice numbers
    if (sm.invoice_number && !invoiceNumbers.includes(sm.invoice_number)) {
      invoiceNumbers.push(sm.invoice_number);
    }
    
    // Use LATEST service completion date
    if (sm.service_completion_date) {
      const date = new Date(sm.service_completion_date);
      if (!latestServiceDate || date > new Date(latestServiceDate)) {
        latestServiceDate = sm.service_completion_date;
      }
    }
    
    // Use MAXIMUM current_kms (vehicle odometer only increases)
    if (sm.current_kms) {
      const kms = parseFloat(sm.current_kms);
      if (maxCurrentKms === null || kms > maxCurrentKms) {
        maxCurrentKms = kms;
      }
    }
  });

  // ✅ FIXED: Calculate grand total from UNIQUE INVOICE NUMBERS only
  const grandTotal = Array.from(invoiceMap.values()).reduce((sum, amount) => sum + amount, 0);

  console.log('🔍 DEBUG - Calculated values:', {
    uniqueInvoices: Array.from(invoiceMap.keys()),
    invoiceAmounts: Array.from(invoiceMap.entries()),
    grandTotal,
    invoiceNumbers,
    latestServiceDate,
    maxCurrentKms
  });

  // Format date to YYYY-MM-DD
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toISOString().split('T')[0];
  };

  // Format number field (handle null, 0, and existing values)
  const formatNumber = (value: any, fallback: any = '') => {
    if (value === null || value === undefined || value === '') return fallback;
    return String(value);
  };

  // 🔥 Find "Accounts Payable" payment method ID as default
  const accountsPayable = paymentMethods.find(pm => 
    pm.payment_method && pm.payment_method.toLowerCase().includes('accounts payable')
  );
  const defaultPaymentMethod = accountsPayable ? String(accountsPayable.id) : '';

  console.log('💳 [PAYMENT-METHOD-DEFAULT] Accounts Payable:', accountsPayable);
  console.log('💳 [PAYMENT-METHOD-DEFAULT] Default Payment Method ID:', defaultPaymentMethod);

const formValues = {
    txtKms: maxCurrentKms ? maxCurrentKms.toFixed(2) : '',
    
    // ✅ FIXED: Invoice Amount: ALWAYS use calculated grandTotal based on UNIQUE invoice numbers (ignore roDetails.invoice_amount)
    txtInvoiceAmount: formatNumber(
      invoiceNumbers.length > 0 && grandTotal > 0 ? grandTotal.toFixed(2) : ''
    ),
    // Work Order: Use work_order_number if exists, otherwise join calculated workOrders
    txtWorkOrderNumber: formatNumber(roDetails?.work_order_number, workOrders.join(',')),
    
    // Invoice Number: Use invoice_number if exists, otherwise join calculated invoiceNumbers
    txtInvoiceNumber: formatNumber(roDetails?.invoice_number, invoiceNumbers.join(',')),
    
    // Service Date: Use service_completed_date if exists, otherwise calculated latestServiceDate
    txtServiceCompletedDate: roDetails?.service_completed_date 
      ? formatDate(roDetails.service_completed_date) 
      : (latestServiceDate ? formatDate(latestServiceDate) : ''),
    
    // Payment Method: Use payment_method ID if exists, otherwise default to "Accounts Payable"
    txtPaymentMethod: formatNumber(roDetails?.payment_method, defaultPaymentMethod),
    
    // Payment Notes: Use payment_notes if exists
    txtPaymentNotes: roDetails?.payment_notes || '',
    
    // Repair Notes: Use repair_notes if exists
    txtRepairNotes: roDetails?.repair_notes || ''
  };

  console.log('🔍 DEBUG - Final form values:', formValues);

  setFormData(formValues);
};

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Reset errors
    const newErrors = {
      txtKms: '',
      txtInvoiceAmount: '',
      txtWorkOrderNumber: '',
      txtInvoiceNumber: '',
      txtServiceCompletedDate: '',
      txtPaymentMethod: '',
      defectStatuses: ''
    };

    let hasErrors = false;

    // Validation
    if (!formData.txtKms || parseFloat(formData.txtKms) <= 0) {
      newErrors.txtKms = 'Please enter valid kilometers after repair';
      hasErrors = true;
    }

    if (!formData.txtInvoiceAmount || parseFloat(formData.txtInvoiceAmount) <= 0) {
      newErrors.txtInvoiceAmount = 'Please enter valid invoice amount';
      hasErrors = true;
    }

    if (!formData.txtWorkOrderNumber.trim()) {
      newErrors.txtWorkOrderNumber = 'Work order number is required';
      hasErrors = true;
    }

    if (!formData.txtInvoiceNumber.trim()) {
      newErrors.txtInvoiceNumber = 'Invoice number is required';
      hasErrors = true;
    }

    if (!formData.txtServiceCompletedDate) {
      newErrors.txtServiceCompletedDate = 'Service completion date is required';
      hasErrors = true;
    }

    if (!formData.txtPaymentMethod) {
      newErrors.txtPaymentMethod = 'Please select a payment method';
      hasErrors = true;
    }

    // Validate all defects have status selected
    const missingDefectStatus = defects.some(defect => !repairStatuses[defect.id]);
    if (missingDefectStatus) {
      newErrors.defectStatuses = 'Please select status for all defects';
      hasErrors = true;
    }

    setErrors(newErrors);

    if (hasErrors) {
      toast.error('Please fix all validation errors before submitting');
      return;
    }

    // Show confirmation toast
    showConfirmationToast({
      title: 'Are you sure to mark this complete?',
      message: `This will mark RO${roId} as completed and cannot be undone.`,
      confirmText: 'Yes, Complete',
      cancelText: 'Cancel',
      variant: 'default',
      onConfirm: async () => {
  console.log('1. Setting overlay to TRUE');
  setShowCompleteOverlay(true);
  setLoading(true);
        try {
          
          // 🔥 Use FormData for file upload (matching PHP multipart/form-data)
          const formDataToSend = new FormData();
          
          // Add all form fields
          formDataToSend.append('txtKms', formData.txtKms);
          formDataToSend.append('txtInvoiceAmount', formData.txtInvoiceAmount);
          formDataToSend.append('txtWorkOrderNumber', formData.txtWorkOrderNumber);
          formDataToSend.append('txtInvoiceNumber', formData.txtInvoiceNumber);
          formDataToSend.append('txtServiceCompletedDate', formData.txtServiceCompletedDate);
          formDataToSend.append('txtPaymentMethod', formData.txtPaymentMethod);
          formDataToSend.append('txtPaymentNotes', formData.txtPaymentNotes);
          formDataToSend.append('txtRepairNotes', formData.txtRepairNotes);
          
          // Add repair statuses as JSON string
          formDataToSend.append('repairs', JSON.stringify(repairStatuses));
          
          // 🔥 Add file if attached (matching PHP: attached_invoice)
          if (attachedInvoice) {
            formDataToSend.append('attached_invoice', attachedInvoice);
          }

          const response = await fetch(buildApiUrl(API_ENDPOINTS.repairOrders.completeFull(roId)), {
            method: 'POST',
            credentials: 'include',
            // ❌ NO Content-Type header - browser will set multipart/form-data with boundary automatically
            body: formDataToSend
          });

          const data = await response.json();

          if (!response.ok || !data.success) {
            setShowCompleteOverlay(false);
            throw new Error(data.error || data.message || 'Failed to complete RO');
          }

          // Keep overlay visible for 3 seconds then close
setTimeout(() => {
  setShowCompleteOverlay(false);
  toast.success(`RO${roId} completed successfully!`, { duration: 3000 });
  onSuccess();
  // Close after a small delay to ensure overlay fade out
  setTimeout(() => {
    onClose();
  }, 500);
}, 5000);
        } catch (error: any) {
          setShowCompleteOverlay(false);
          console.error('Error completing RO:', error);
          toast.error(error.message || 'Failed to complete repair order');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  if (!isOpen) return null;

  const invoiceSummary = roDetails?.invoice_summary || [];
  const grandTotal = invoiceSummary.reduce((sum: number, group: any) => 
    sum + (parseFloat(group.invoice_amount) || 0), 0
  );

  // Check if all defects are Completed or Repair_Not_Required
  const canComplete = defects.length === 0 || defects.every(defect => {
    const status = repairStatuses[defect.id];
    return status === 'Completed' || status === 'Repair_Not_Required';
  });

  // Get list of defects that are not completed
  const incompleteDefects = defects.filter(defect => {
    const status = repairStatuses[defect.id];
    return status !== 'Completed' && status !== 'Repair_Not_Required';
  });

  return (
    <>
      {/* Success Overlay */}
      <AnimatePresence>
        {showCompleteOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
           className="fixed inset-0 bg-white z-[9999] flex flex-col items-center justify-center"
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
              Repair Order Completed Successfully!
            </motion.h3>
            
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.5 }}
              className="text-gray-600 text-center max-w-md"
            >
              RO #{roId} has been marked as completed
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
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-blue-600" />
                </div>
                <div className="text-left">
                  <p className="text-lg font-semibold text-gray-900">Finalizing Records</p>
                  <p className="text-sm text-gray-600">Updating database...</p>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[140] p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-white">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Complete Repair Order: RO{roId}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Vehicle {roDetails?.vehicle_nickname}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* RO Summary */}
              <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div>
                  <label className="text-sm font-medium text-gray-700">Vehicle</label>
                  <p className="text-sm text-gray-900 mt-1">{roDetails?.vehicle_nickname}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Requested By</label>
                  <p className="text-sm text-gray-900 mt-1">{roDetails?.requested_by_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Bus KM's at time of repair</label>
                  <p className="text-sm text-gray-900 mt-1">{roDetails?.kms_before_service}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Vendor</label>
                  <p className="text-sm text-gray-900 mt-1">{roDetails?.vendor_name}</p>
                </div>
              </div>

              {/* Invoice Summary - Collapsible */}
              {invoiceSummary.length > 0 && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div 
                    className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => setInvoiceSummaryExpanded(!invoiceSummaryExpanded)}
                  >
                    <strong className="text-sm text-gray-900">Invoice Summary</strong>
                    {invoiceSummaryExpanded ? (
                      <ChevronUp className="h-4 w-4 text-gray-600" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-600" />
                    )}
                  </div>
                  
                  {invoiceSummaryExpanded && (
                    <div className="p-4 space-y-3">
                      <h3 className="text-right font-semibold text-lg text-gray-900">
                        Grand Total: ${grandTotal.toFixed(2)}
                      </h3>
                      
                      {invoiceSummary.map((group: any, idx: number) => (
                        <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-white">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <strong className="text-sm text-gray-900">{group.work_order_number}</strong>
                              {group.work_order_status && (
                                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800">
                                  {group.work_order_status}
                                </span>
                              )}
                              <br />
                              <small className="text-xs text-gray-600">
                                Invoice: {group.invoice_number}
                                {group.service_completion_date && (
                                  <> | {new Date(group.service_completion_date).toLocaleDateString()}</>
                                )}
                              </small>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold text-gray-900">
                                ${parseFloat(group.invoice_amount || 0).toFixed(2)}
                              </div>
                              {group.invoice_url && (
                                <a 
                                  href={group.invoice_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:underline"
                                >
                                  View Invoice
                                </a>
                              )}
                            </div>
                          </div>

                          {group.repairs && group.repairs.length > 0 && (
                            <>
                              <p className="text-xs font-medium text-gray-700 mt-3 mb-1">Repairs</p>
                              <ul className="text-xs text-gray-600 space-y-1">
                                {group.repairs.map((r: any, ridx: number) => (
                                  <li key={ridx}>
                                    Repair ID {r.repair_log_id} ({r.defect_status})
                                  </li>
                                ))}
                              </ul>
                            </>
                          )}

                          {group.sms && group.sms.length > 0 && (
                            <>
                              <p className="text-xs font-medium text-gray-700 mt-3 mb-1">Scheduled Maintenance</p>
                              <ul className="text-xs text-gray-600 space-y-1">
                                {group.sms.map((sm: any, smidx: number) => (
                                  <li key={smidx}>{sm.setting_name}</li>
                                ))}
                              </ul>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Completion Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Estimated Repair Amount <span className="text-gray-500">(Read-only)</span>
                  </label>
                  <p className="text-sm text-gray-900 mt-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                    ${parseFloat(roDetails?.estimated_repair_amount || 0).toFixed(2)}
                  </p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Actual Invoice Amount <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.txtInvoiceAmount}
                    onChange={(e) => {
                      setFormData({ ...formData, txtInvoiceAmount: e.target.value });
                      if (errors.txtInvoiceAmount) setErrors({ ...errors, txtInvoiceAmount: '' });
                    }}
                    className={`mt-1 w-full px-3 py-2 border ${errors.txtInvoiceAmount ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-2 ${errors.txtInvoiceAmount ? 'focus:ring-red-500' : 'focus:ring-blue-500'}`}
                  />
                  {errors.txtInvoiceAmount && (
                    <p className="text-xs text-red-600 mt-1">{errors.txtInvoiceAmount}</p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Work Order Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.txtWorkOrderNumber}
                    onChange={(e) => {
                      setFormData({ ...formData, txtWorkOrderNumber: e.target.value });
                      if (errors.txtWorkOrderNumber) setErrors({ ...errors, txtWorkOrderNumber: '' });
                    }}
                    className={`mt-1 w-full px-3 py-2 border ${errors.txtWorkOrderNumber ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-2 ${errors.txtWorkOrderNumber ? 'focus:ring-red-500' : 'focus:ring-blue-500'}`}
                  />
                  {errors.txtWorkOrderNumber && (
                    <p className="text-xs text-red-600 mt-1">{errors.txtWorkOrderNumber}</p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Invoice Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.txtInvoiceNumber}
                    onChange={(e) => {
                      setFormData({ ...formData, txtInvoiceNumber: e.target.value });
                      if (errors.txtInvoiceNumber) setErrors({ ...errors, txtInvoiceNumber: '' });
                    }}
                    className={`mt-1 w-full px-3 py-2 border ${errors.txtInvoiceNumber ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-2 ${errors.txtInvoiceNumber ? 'focus:ring-red-500' : 'focus:ring-blue-500'}`}
                  />
                  {errors.txtInvoiceNumber && (
                    <p className="text-xs text-red-600 mt-1">{errors.txtInvoiceNumber}</p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Kms after Repair <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.txtKms}
                    onChange={(e) => {
                      setFormData({ ...formData, txtKms: e.target.value });
                      if (errors.txtKms) setErrors({ ...errors, txtKms: '' });
                    }}
                    className={`mt-1 w-full px-3 py-2 border ${errors.txtKms ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-2 ${errors.txtKms ? 'focus:ring-red-500' : 'focus:ring-blue-500'}`}
                  />
                  {errors.txtKms && (
                    <p className="text-xs text-red-600 mt-1">{errors.txtKms}</p>
                  )}
                </div>

                <div>
                  <FormDatePickerCustom
                    label="Service Completed Date"
                    name="txtServiceCompletedDate"
                    required
                    value={formData.txtServiceCompletedDate}
                    onChange={(value) => {
                      setFormData({ ...formData, txtServiceCompletedDate: value });
                      if (errors.txtServiceCompletedDate) setErrors({ ...errors, txtServiceCompletedDate: '' });
                    }}
                    error={errors.txtServiceCompletedDate}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Payment Method <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.txtPaymentMethod}
                    onChange={(e) => {
                      setFormData({ ...formData, txtPaymentMethod: e.target.value });
                      if (errors.txtPaymentMethod) setErrors({ ...errors, txtPaymentMethod: '' });
                    }}
                    className={`mt-1 w-full px-3 py-2 border ${errors.txtPaymentMethod ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-2 ${errors.txtPaymentMethod ? 'focus:ring-red-500' : 'focus:ring-blue-500'}`}
                  >
                    <option value="">Select Payment Method</option>
                    {paymentMethods.map((pm) => (
                      <option key={pm.id} value={pm.id}>
                        {pm.payment_method}
                      </option>
                    ))}
                  </select>
                  {errors.txtPaymentMethod && (
                    <p className="text-xs text-red-600 mt-1">{errors.txtPaymentMethod}</p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Payment Notes</label>
                  <textarea
                    rows={2}
                    value={formData.txtPaymentNotes}
                    onChange={(e) => setFormData({ ...formData, txtPaymentNotes: e.target.value })}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Vehicle Repairs */}
              {defects.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Wrench className="h-5 w-5 text-blue-600" />
                    Vehicle Repairs
                  </h3>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-2 text-left">Category</th>
                          <th className="px-4 py-2 text-left">Repair</th>
                          <th className="px-4 py-2 text-left">Severity</th>
                          <th className="px-4 py-2 text-left">Current Status</th>
                          <th className="px-4 py-2 text-left">Change Status <span className="text-red-500">*</span></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {defects.map((defect) => (
                          <tr key={defect.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              {defect.repair_code_category}
                              <br />
                              <small className="text-gray-500">
                                ({defect.defect_source} - {defect.vrlid})
                              </small>
                            </td>
                            <td className="px-4 py-3">
                              {defect.repair_desc}
                              {defect.notes && (
                                <>
                                  <br />
                                  <i className="text-gray-600">Notes: {defect.notes}</i>
                                </>
                              )}
                            </td>
                            <td className="px-4 py-3">{defect.issue_type}</td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                                {defect.rpor_status}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <select
                                required
                                value={repairStatuses[defect.id] || ''}
                                onChange={(e) => {
                                  setRepairStatuses({
                                    ...repairStatuses,
                                    [defect.id]: e.target.value
                                  });
                                  if (errors.defectStatuses) setErrors({ ...errors, defectStatuses: '' });
                                }}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                              >
                                <option value="">Select Status</option>
                                {DEFECT_STATUS_OPTIONS.map((status) => (
                                  <option key={status} value={status}>
                                    {status.replace(/_/g, ' ')}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {errors.defectStatuses && (
                    <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors.defectStatuses}
                    </p>
                  )}
                </div>
              )}

              {/* Scheduled Maintenance - Auto-Update Information */}
              {scheduledMaintenance.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Package className="h-5 w-5 text-blue-600" />
                    Scheduled Maintenance Records
                    <span className="ml-auto text-xs font-normal text-gray-600 flex items-center gap-1">
                      <CheckCircle className="h-4 w-4" />
                      Status will be updated
                    </span>
                  </h3>
                  <div className="border border-blue-200 rounded-lg overflow-hidden bg-blue-50">
                    <div className="px-4 py-3 bg-blue-100 border-b border-blue-200">
                      <p className="text-sm text-blue-800 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        The following scheduled maintenance records will be marked as <strong>"Completed"</strong> in this RO. Their schedule dates/kilometers will NOT be automatically updated.
                      </p>
                    </div>
                    <table className="w-full text-sm">
                      <thead className="bg-blue-100">
                        <tr>
                          <th className="px-4 py-2 text-left text-blue-900">Maintenance Type</th>
                          <th className="px-4 py-2 text-left text-blue-900">Current Status</th>
                          <th className="px-4 py-2 text-center text-blue-900">Will Update To</th>
                          <th className="px-4 py-2 text-left text-blue-900">Serviced Date</th>
                          <th className="px-4 py-2 text-left text-blue-900">Serviced KM</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-blue-200 bg-white">
                        {scheduledMaintenance.map((sm: any) => (
                          <tr key={sm.id} className="hover:bg-blue-50">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-blue-600" />
                                <span className="font-medium text-gray-900">{sm.setting_name}</span>
                              </div>
                              <small className="text-gray-500 ml-6">
                                ID: {sm.scheduled_maintenance_setting_id}
                              </small>
                            </td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">
                                {sm.rpor_status || 'Pending'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="px-3 py-1 text-xs rounded-full bg-blue-600 text-white font-medium">
                                Completed ✓
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-medium text-gray-700">
                                {sm.service_completion_date 
                                  ? new Date(sm.service_completion_date).toLocaleDateString() 
                                  : 'No date'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-medium text-gray-700">
                                {sm.current_kms ? `${parseFloat(sm.current_kms).toLocaleString()} km` : 'No KMs'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="text-sm font-medium text-gray-700">Repair Notes</label>
                <textarea
                  rows={4}
                  value={formData.txtRepairNotes}
                  onChange={(e) => setFormData({ ...formData, txtRepairNotes: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter any notes about the repair completion..."
                />
              </div>

              {/* 🔥 File Upload Section (matching PHP) */}
              <div>
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Attach Invoice
                  <span className="text-gray-500 font-normal text-xs">(jpg, png, gif, pdf only - Max 50MB)</span>
                </label>
                
                {/* Existing Attachments Display */}
                {existingAttachments.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-medium text-gray-600">Existing Attachments:</p>
                    {existingAttachments.map((att) => (
                      <div key={att.id} className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center gap-2">
                          <File className="h-4 w-4 text-blue-600 flex-shrink-0" />
                          <div>
                            <span className="text-sm font-medium text-gray-900">{att.original_filename || 'Invoice'}</span>
                            <span className="text-xs text-gray-500 ml-2">
                              {new Date(att.upload_timestamp).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <a
                          href={`${API_BASE_URL}/uploads/ro/${roId}/${att.stored_filename}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 p-1"
                          title="Download attachment"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      </div>
                    ))}
                  </div>
                )}

                {/* File Input / Upload Area */}
                <div className="mt-3">
                  {!attachedInvoice ? (
                    <label className="cursor-pointer block">
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 hover:border-blue-500 hover:bg-blue-50 transition-all duration-200">
                        <div className="flex flex-col items-center gap-3">
                          <div className="p-3 bg-blue-100 rounded-full">
                            <Upload className="h-6 w-6 text-blue-600" />
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-medium text-gray-700">Click to upload invoice</p>
                            <p className="text-xs text-gray-500 mt-1">JPG, PNG, GIF, PDF up to 50MB</p>
                          </div>
                        </div>
                        <input
                          type="file"
                          accept=".jpg,.jpeg,.png,.gif,.pdf,image/jpeg,image/png,image/gif,application/pdf"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                      </div>
                    </label>
                  ) : (
                    <div className="flex items-center justify-between p-4 bg-green-50 border-2 border-green-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <File className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{attachedInvoice.name}</p>
                          <p className="text-xs text-gray-600">
                            {(attachedInvoice.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveFile}
                        className="text-red-600 hover:text-red-800 p-2 hover:bg-red-100 rounded-lg transition-colors"
                        title="Remove file"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                  {fileError && (
                    <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {fileError}
                    </p>
                  )}
                </div>
              </div>
            </form>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex-1">
              {!canComplete && incompleteDefects.length > 0 && (
                <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Cannot complete RO</p>
                    <p className="text-xs mt-0.5">
                      All defects must be marked as "Completed" or "Repair Not Required". 
                      {incompleteDefects.length} defect(s) still need to be updated.
                    </p>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 ml-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || !canComplete}
                title={!canComplete ? 'All defects must be Completed or Repair Not Required' : ''}
                className="px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Completing...
                  </>
                ) : (
                  'Mark as Complete'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}