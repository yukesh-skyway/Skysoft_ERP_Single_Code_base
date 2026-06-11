import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Calendar, DollarSign, FileText, CreditCard, Wrench, ChevronDown, ChevronUp, Package, CheckCircle, Upload, File, Trash2, Download } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { API_BASE_URL, buildApiUrl, API_ENDPOINTS } from '../../config/api';
import { FormDatePickerCustom } from './FormComponents';
import { showConfirmationToast } from '../../utils/confirmationToast';
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight, CheckCircle2 } from "lucide-react";

interface CompleteROModalWithoutWOProps {
  isOpen: boolean;
  onClose: () => void;
  roId: number;
  roDetails: any;
  onSuccess: () => void;
}

const DEFECT_STATUS_OPTIONS = [
  'Completed',
  'Repair_Not_Required'
];

export default function CompleteROModalWithoutWO({ isOpen, onClose, roId, roDetails, onSuccess }: CompleteROModalWithoutWOProps) {
  const [loading, setLoading] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [defects, setDefects] = useState<any[]>([]);
  const [scheduledMaintenance, setScheduledMaintenance] = useState<any[]>([]);
  const [invoiceSummaryExpanded, setInvoiceSummaryExpanded] = useState(false);

  const [liveKm, setLiveKm] = useState<number | null>(null);
  const [loadingLiveKm, setLoadingLiveKm] = useState(false);
  const [liveKmError, setLiveKmError] = useState<string | null>(null);

  const [showCompleteOverlay, setShowCompleteOverlay] = useState(false);

  const [attachedInvoice, setAttachedInvoice] = useState<File | null>(null);
  const [existingAttachments, setExistingAttachments] = useState<any[]>([]);
  const [fileError, setFileError] = useState('');

  const [formData, setFormData] = useState({
    txtKms: '',                  // ← CHANGE 4: NOT auto-populated
    txtInvoiceAmount: '',
    txtWorkOrderNumber: '',
    txtInvoiceNumber: '',
    txtServiceCompletedDate: '',
    txtPaymentMethod: '',
    txtPaymentNotes: '',
    txtRepairNotes: ''
  });

  const [repairStatuses, setRepairStatuses] = useState<Record<string, string>>({});
  const [repairDates, setRepairDates] = useState<Record<string, string>>({});
  const [repairKms, setRepairKms] = useState<Record<string, string>>({});
  const [savingApprove, setSavingApprove] = useState<number | null>(null);
  const [savingStatuses, setSavingStatuses] = useState(false);

  const [smStatuses, setSmStatuses] = useState<Record<string, string>>({});
  const [smDates, setSmDates] = useState<Record<string, string>>({});
  const [smKms, setSmKms] = useState<Record<string, string>>({});
  const [savingSmApprove, setSavingSmApprove] = useState<number | null>(null);
  const [savingSmStatuses, setSavingSmStatuses] = useState(false);

  // Row-level validation errors
  const [rowErrors, setRowErrors] = useState<Record<string, { date?: string; kms?: string; status?: string }>>({});
  const [smRowErrors, setSmRowErrors] = useState<Record<string, { date?: string; kms?: string; status?: string }>>({});

  const [errors, setErrors] = useState({
    txtKms: '',
    txtInvoiceAmount: '',
    txtWorkOrderNumber: '',
    txtInvoiceNumber: '',
    txtServiceCompletedDate: '',
    txtPaymentMethod: '',
    defectStatuses: ''
  });

  // ─── CHANGE 5: Auto-populate all defect/SM rows when KMs field changes ───
  const handleKmsChange = (value: string) => {
    setFormData(prev => ({ ...prev, txtKms: value }));
    if (errors.txtKms) setErrors(prev => ({ ...prev, txtKms: '' }));

    const today = new Date().toISOString().split('T')[0];
    const rawKms = value.replace(/,/g, '').replace(/[^\d.]/g, '');

    // Populate all defect rows
    setRepairKms(prev => {
      const next = { ...prev };
      defects.forEach(d => { next[d.id] = rawKms; });
      return next;
    });
    setRepairDates(prev => {
      const next = { ...prev };
      defects.forEach(d => { if (!prev[d.id]) next[d.id] = today; });
      return next;
    });

    // Populate all SM rows
setSmKms(prev => {
  const next = { ...prev };
  scheduledMaintenance.forEach(sm => {
    if (sm.manager_status !== 'Approved') next[sm.id] = rawKms;  // ← skip approved
  });
  return next;
});
setSmDates(prev => {
  const next = { ...prev };
  scheduledMaintenance.forEach(sm => {
    if (sm.manager_status !== 'Approved' && !prev[sm.id]) next[sm.id] = today;  // ← skip approved
  });
  return next;
});
  };

  // ─── Approve single defect ───────────────────────────────────────────────
  const handleApproveDefect = async (defect: any) => {
    if (defect.manager_status === 'Approved') {
      toast.error(`Already approved by ${defect.manager_name || 'manager'}`);
      return;
    }

    const status = repairStatuses[defect.id];
    const date = repairDates[defect.id];
    const kms = repairKms[defect.id];

    const errs: { date?: string; kms?: string; status?: string } = {};
    if (!status) errs.status = 'Status is required';
    if (!date) errs.date = 'Date is required';
    if (!kms || kms === '0') errs.kms = 'Kilometers is required';

    if (Object.keys(errs).length > 0) {
      setRowErrors(prev => ({ ...prev, [defect.id]: errs }));
      toast.error('Please fill in all required fields for this defect');
      return;
    }
    setRowErrors(prev => ({ ...prev, [defect.id]: {} }));

    setSavingApprove(defect.id);
    try {
      const response = await fetch(buildApiUrl(`/repair-orders/${roId}/approve-defect`), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rpor_id: defect.id,
          vrl_id: defect.repair_log_id || defect.vrlid,
          status,
          repair_fixed_on: date || null,
          service_completion_date: date || null,
          current_kms: kms || null,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || 'Failed to approve defect');
      }
      toast.success(`Defect #${defect.vrlid} approved as ${status.replace(/_/g, ' ')}`);

      await loadROItems(true);
    } catch (error: any) {
      toast.error(error.message || 'Failed to approve defect');
    } finally {
      setSavingApprove(null);
    }
  };

  // ─── Bulk save defect statuses ───────────────────────────────────────────
  const handleSave = async () => {
    setSavingStatuses(true);
    try {
      const response = await fetch(buildApiUrl(`/repair-orders/${roId}/approve-defects-bulk`), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: defects
            .filter((d) => d.id)
            .map((d) => ({
              rpor_id: d.id,
              vrl_id: d.repair_log_id || d.vrlid,
              status: repairStatuses[d.id],
              repair_fixed_on: repairDates[d.id] || null,
              service_completion_date: repairDates[d.id] || null,
              current_kms: repairKms[d.id] || null,
            })),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || 'Failed to save statuses');
      }
      toast.success('Defect statuses saved successfully');
      await loadROItems(true);
    } catch (error: any) {
      toast.error(error.message || 'Failed to save statuses');
    } finally {
      setSavingStatuses(false);
    }
  };

  // ─── Approve single SM row ───────────────────────────────────────────────
  const handleApproveSM = async (sm: any) => {
    if (sm.manager_status === 'Approved') {
      toast.error(`Already approved by ${sm.manager_name || 'manager'}`);
      return;
    }

    const status = smStatuses[sm.id];
    const date = smDates[sm.id];
    const kms = smKms[sm.id];

    const errs: { date?: string; kms?: string; status?: string } = {};
    if (!status) errs.status = 'Status is required';
    if (!date) errs.date = 'Date is required';
    if (!kms || kms === '0') errs.kms = 'Kilometers is required';

    if (Object.keys(errs).length > 0) {
      setSmRowErrors(prev => ({ ...prev, [sm.id]: errs }));
      toast.error('Please fill in all required fields for this maintenance item');
      return;
    }
    setSmRowErrors(prev => ({ ...prev, [sm.id]: {} }));

    setSavingSmApprove(sm.id);
    console.log('🚀 Approving SM Item:', { id: sm.id, setting_name: sm.setting_name, status, date, kms });

    try {
      const payload = {
        rpor_id: sm.id,
        vrl_id: sm.repair_log_id || sm.vrlid,
        status,
        repair_fixed_on: date || null,
        service_completion_date: date || null,
        current_kms: kms || null,
        scheduled_maintenance_setting_id: sm.scheduled_maintenance_setting_id,
        vehicle_id: roDetails?.vehicle,
        setting_name: sm.setting_name,
        ro_number: roId,
        vendor_name: roDetails?.vendor_name
      };

      console.log('📤 Sending payload:', JSON.stringify(payload, null, 2));

      const response = await fetch(buildApiUrl(`/repair-orders/${roId}/approve-scheduled-maintenance`), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      console.log('📥 Response:', { status: response.status, ok: response.ok, data });

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || 'Failed to approve maintenance item');
      }

      toast.success(`Maintenance "${sm.setting_name}" approved as ${status.replace(/_/g, ' ')}`);

      if (data.motive_sync) {
        if (data.motive_sync.success === 'OK') {
          toast.success(`✅ Synced to Motive: ${data.motive_sync.message}`);
        } else if (data.motive_sync.success === 'NOOK') {
          toast.warning(`⚠️ Maintenance approved but Motive sync failed: ${data.motive_sync.message}`);
        }
      }

      setScheduledMaintenance(prev =>
        prev.map(item =>
          item.id === sm.id
            ? { ...item, manager_status: 'Approved', manager_name: data.manager_name || '', rpor_status: status }
            : item
        )
      );

      await loadROItems(true);
    } catch (error: any) {
      console.error('❌ Approval failed:', error);
      toast.error(error.message || 'Failed to approve maintenance item');
    } finally {
      setSavingSmApprove(null);
    }
  };

  // ─── Bulk save SM statuses ───────────────────────────────────────────────
  const handleSaveSM = async () => {
    setSavingSmStatuses(true);
    try {
      const response = await fetch(buildApiUrl(`/repair-orders/${roId}/approve-defects-bulk`), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: scheduledMaintenance
            .filter((sm) => sm.id)
            .map((sm) => ({
              rpor_id: sm.id,
              vrl_id: sm.repair_log_id || sm.vrlid || null,
              repair_fixed_on: smDates[sm.id] || null,
              service_completion_date: smDates[sm.id] || null,
              current_kms: smKms[sm.id] || null,
            })),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || 'Failed to save maintenance statuses');
      }
      toast.success('Maintenance statuses saved successfully');
      await loadROItems(true);
    } catch (error: any) {
      toast.error(error.message || 'Failed to save maintenance statuses');
    } finally {
      setSavingSmStatuses(false);
    }
  };

  useEffect(() => {
    if (isOpen && roDetails) {
      loadModalData();
      fetchLiveKm();
    }
  }, [isOpen, roDetails]);

  const loadModalData = async () => {
    try {
      const pmResponse = await fetch(buildApiUrl(API_ENDPOINTS.repairOrders.paymentMethods), {
        credentials: 'include'
      });
      const pmData = await pmResponse.json();
      const loadedPaymentMethods = pmData.data || [];
      setPaymentMethods(loadedPaymentMethods);

      const itemsData = await loadROItems(false);
      await loadExistingAttachments();
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
    }
  };

  // ─── Load RO items — skipStateInit=true preserves user edits ────────────
  const loadROItems = async (skipStateInit = false) => {
    try {
      const response = await fetch(buildApiUrl(API_ENDPOINTS.repairOrders.details(roId)), {
        credentials: 'include'
      });
      const data = await response.json();
      console.log('🔍 DEBUG - Full API Response:', data);

      if (data.success) {
        const details = data.data;
        let loadedDefects: any[] = [];
        let loadedScheduledMaintenance: any[] = [];

        if (details.repairs && details.repairs.length > 0) {
          loadedDefects = details.repairs;
          if (!skipStateInit) {
            setDefects(details.repairs);
          } else {
            setDefects(prev =>
              prev.map(item => {
                const fresh = details.repairs.find((d: any) => d.id === item.id);
                return fresh ? { ...fresh } : item;
              })
            );
          }

          const initialRepairStatuses: Record<string, string> = {};
          const initialRepairDates: Record<string, string> = {};
          const initialRepairKms: Record<string, string> = {};

          details.repairs.forEach((defect: any) => {
            initialRepairStatuses[defect.id] =
              DEFECT_STATUS_OPTIONS.includes(defect.rpor_status) ? defect.rpor_status : '';
            if (defect.service_completion_date) {
              initialRepairDates[defect.id] = defect.service_completion_date.split('T')[0];
            } else if (defect.repair_fixed_on) {
              initialRepairDates[defect.id] = defect.repair_fixed_on.split('T')[0];
            }
            if (defect.current_kms) {
              initialRepairKms[defect.id] = String(defect.current_kms);
            }
          });

          if (!skipStateInit) {
            setRepairStatuses(initialRepairStatuses);
            setRepairDates(initialRepairDates);
            setRepairKms(initialRepairKms);
          }
        }

        if (details.scheduledMaintenance && details.scheduledMaintenance.length > 0) {
          loadedScheduledMaintenance = details.scheduledMaintenance;
          console.log('📋 Scheduled Maintenance Items Loaded:', details.scheduledMaintenance.length);
          details.scheduledMaintenance.forEach((sm: any, index: number) => {
            console.log(`  SM ${index + 1}:`, {
              id: sm.id,
              scheduled_maintenance_setting_id: sm.scheduled_maintenance_setting_id,
              vrlid: sm.vrlid,
              repair_log_id: sm.repair_log_id,
              setting_name: sm.setting_name,
              rpor_status: sm.rpor_status,
              manager_status: sm.manager_status,
              service_completion_date: sm.service_completion_date,
              current_kms: sm.current_kms
            });
          });

          if (!skipStateInit) {
            setScheduledMaintenance(details.scheduledMaintenance);
          } else {
            setScheduledMaintenance(prev =>
              prev.map(item => {
                const fresh = details.scheduledMaintenance.find((s: any) => s.id === item.id);
                return fresh ? { ...fresh } : item;
              })
            );
          }

          const initialSmStatuses: Record<string, string> = {};
          const initialSmDates: Record<string, string> = {};
          const initialSmKms: Record<string, string> = {};

          details.scheduledMaintenance.forEach((sm: any) => {
            initialSmStatuses[sm.id] =
              DEFECT_STATUS_OPTIONS.includes(sm.rpor_status) ? sm.rpor_status : '';
            if (sm.service_completion_date) {
              initialSmDates[sm.id] = sm.service_completion_date.split('T')[0];
            }
            if (sm.current_kms) {
              initialSmKms[sm.id] = String(Math.round(parseFloat(sm.current_kms)));
            }
          });

          if (!skipStateInit) {
            setSmStatuses(initialSmStatuses);
            setSmDates(initialSmDates);
            setSmKms(initialSmKms);
          }
        }

        return { defects: loadedDefects, scheduledMaintenance: loadedScheduledMaintenance };
      }
      return { defects: [], scheduledMaintenance: [] };
    } catch (error) {
      console.error('Error loading RO items:', error);
      return { defects: [], scheduledMaintenance: [] };
    }
  };

  const fetchLiveKm = async () => {
    if (!roId) return;
    setLoadingLiveKm(true);
    setLiveKmError(null);
    try {
      const response = await fetch(buildApiUrl(`/repair-orders/${roId}/live-km`), {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success && data.data?.kilometers) {
        setLiveKm(data.data.kilometers);
        // ← CHANGE 4: Do NOT auto-populate txtKms from live KM
      } else {
        setLiveKmError(data.message || 'Could not fetch live KM');
      }
    } catch (error) {
      console.error('Error fetching live KM:', error);
      setLiveKmError('Failed to fetch live KM');
    } finally {
      setLoadingLiveKm(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf'];
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'pdf'];

    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension || '')) {
      setFileError('Only JPG, PNG, GIF, and PDF files are allowed');
      setAttachedInvoice(null);
      e.target.value = '';
      return;
    }
    if (file.size > 50000000) {
      setFileError('File size must not exceed 50MB');
      setAttachedInvoice(null);
      e.target.value = '';
      return;
    }
    setFileError('');
    setAttachedInvoice(file);
  };

  const handleRemoveFile = () => {
    setAttachedInvoice(null);
    setFileError('');
  };

  const calculateDefaults = (itemsData: { defects: any[], scheduledMaintenance: any[] }, paymentMethods: any[]) => {
    const invoiceMap = new Map<string, number>();
    let workOrders: string[] = [];
    let invoiceNumbers: string[] = [];
    let latestServiceDate: string | null = null;
    // ← CHANGE 4: we no longer track maxCurrentKms for auto-populating txtKms

    itemsData.defects.forEach((defect: any) => {
      if (defect.invoice_number && defect.invoice_amount) {
        if (!invoiceMap.has(defect.invoice_number)) invoiceMap.set(defect.invoice_number, parseFloat(defect.invoice_amount));
      } else if (defect.invoice_amount && !defect.invoice_number) {
        invoiceMap.set(`defect-${defect.id}`, parseFloat(defect.invoice_amount));
      }
      if (defect.work_order_number && !workOrders.includes(defect.work_order_number)) workOrders.push(defect.work_order_number);
      if (defect.invoice_number && !invoiceNumbers.includes(defect.invoice_number)) invoiceNumbers.push(defect.invoice_number);
      if (defect.service_completion_date) {
        const date = new Date(defect.service_completion_date);
        if (!latestServiceDate || date > new Date(latestServiceDate)) latestServiceDate = defect.service_completion_date;
      }
    });

    itemsData.scheduledMaintenance.forEach((sm: any) => {
      if (sm.invoice_number && sm.invoice_amount) {
        if (!invoiceMap.has(sm.invoice_number)) invoiceMap.set(sm.invoice_number, parseFloat(sm.invoice_amount));
      } else if (sm.invoice_amount && !sm.invoice_number) {
        invoiceMap.set(`scheduled-${sm.id}`, parseFloat(sm.invoice_amount));
      }
      if (sm.work_order_number && !workOrders.includes(sm.work_order_number)) workOrders.push(sm.work_order_number);
      if (sm.invoice_number && !invoiceNumbers.includes(sm.invoice_number)) invoiceNumbers.push(sm.invoice_number);
      if (sm.service_completion_date) {
        const date = new Date(sm.service_completion_date);
        if (!latestServiceDate || date > new Date(latestServiceDate)) latestServiceDate = sm.service_completion_date;
      }
    });

    const grandTotal = Array.from(invoiceMap.values()).reduce((sum, amount) => sum + amount, 0);
    const formatDate = (dateStr: string | null) => dateStr ? new Date(dateStr).toISOString().split('T')[0] : '';
    const formatNumber = (value: any, fallback: any = '') => (value === null || value === undefined || value === '') ? fallback : String(value);

    const accountsPayable = paymentMethods.find(pm => pm.payment_method?.toLowerCase().includes('accounts payable'));
    const defaultPaymentMethod = accountsPayable ? String(accountsPayable.id) : '';

    setFormData({
      txtKms: '',                              // ← CHANGE 4: always start blank
      txtInvoiceAmount: formatNumber(invoiceNumbers.length > 0 && grandTotal > 0 ? grandTotal.toFixed(2) : ''),
      txtWorkOrderNumber: formatNumber(roDetails?.work_order_number, workOrders.join(',')),
      txtInvoiceNumber: formatNumber(roDetails?.invoice_number, invoiceNumbers.join(',')),
      txtServiceCompletedDate: roDetails?.service_completed_date
        ? formatDate(roDetails.service_completed_date)
        : (latestServiceDate ? formatDate(latestServiceDate) : ''),
      txtPaymentMethod: formatNumber(roDetails?.payment_method, defaultPaymentMethod),
      txtPaymentNotes: roDetails?.payment_notes || '',
      txtRepairNotes: roDetails?.repair_notes || ''
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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

    // ← CHANGE 4: KMs still validated (must enter something if they type)
    if (formData.txtKms && parseFloat(formData.txtKms) <= 0) {
      newErrors.txtKms = 'Please enter valid kilometers after repair';
      hasErrors = true;
    }
    if (!formData.txtInvoiceAmount || parseFloat(formData.txtInvoiceAmount) <= 0) {
  newErrors.txtInvoiceAmount = 'Invoice amount is required';
  hasErrors = true;
}
    // ← CHANGES 1,2,3,6: Work Order, Payment Method, Invoice Number, Invoice Amount are NOT mandatory
    if (!formData.txtServiceCompletedDate) { newErrors.txtServiceCompletedDate = 'Service completion date is required'; hasErrors = true; }
    if (!formData.txtInvoiceAmount || parseFloat(formData.txtInvoiceAmount) <= 0) { newErrors.txtInvoiceAmount = 'Invoice amount is required'; hasErrors = true; }
    if (defects.some(defect => !repairStatuses[defect.id])) { newErrors.defectStatuses = 'Please select status for all defects'; hasErrors = true; }

    setErrors(newErrors);
    if (hasErrors) { toast.error('Please fix all validation errors before submitting'); return; }

    showConfirmationToast({
      title: 'Are you sure to mark this complete?',
      message: `This will mark RO${roId} as completed and cannot be undone.`,
      confirmText: 'Yes, Complete',
      cancelText: 'Cancel',
      variant: 'default',
      onConfirm: async () => {
        setShowCompleteOverlay(true);
        setLoading(true);
        try {
          const formDataToSend = new FormData();
        if (formData.txtKms) {
  formDataToSend.append('txtKms', formData.txtKms || '0');
}
          formDataToSend.append('txtInvoiceAmount', formData.txtInvoiceAmount);
          formDataToSend.append('txtWorkOrderNumber', formData.txtWorkOrderNumber);
          formDataToSend.append('txtInvoiceNumber', formData.txtInvoiceNumber);
          formDataToSend.append('txtServiceCompletedDate', formData.txtServiceCompletedDate);
          formDataToSend.append('txtPaymentMethod', formData.txtPaymentMethod);
          formDataToSend.append('txtPaymentNotes', formData.txtPaymentNotes);
          formDataToSend.append('txtRepairNotes', formData.txtRepairNotes);
          formDataToSend.append('repairs', JSON.stringify(
            Object.entries(repairStatuses).reduce((acc, [id, status]) => ({
              ...acc,
              [id]: { status, repair_fixed_on: repairDates[id] || null, service_completion_date: repairDates[id] || null, current_kms: repairKms[id] || null }
            }), {})
          ));
          if (attachedInvoice) formDataToSend.append('attached_invoice', attachedInvoice);

          const response = await fetch(buildApiUrl(API_ENDPOINTS.repairOrders.completeFull(roId)), {
            method: 'POST',
            credentials: 'include',
            body: formDataToSend
          });
          const data = await response.json();
          if (!response.ok || !data.success) {
            setShowCompleteOverlay(false);
            throw new Error(data.error || data.message || 'Failed to complete RO');
          }
          setTimeout(() => {
            setShowCompleteOverlay(false);
            toast.success(`RO${roId} completed successfully!`, { duration: 3000 });
            onSuccess();
            setTimeout(() => { onClose(); }, 500);
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
  const grandTotal = invoiceSummary.reduce((sum: number, group: any) => sum + (parseFloat(group.invoice_amount) || 0), 0);

  const canComplete = defects.length === 0 || defects.every(defect => {
    const status = repairStatuses[defect.id];
    return status === 'Completed' || status === 'Repair_Not_Required';
  });

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
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-white z-[9999] flex flex-col items-center justify-center"
          >
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3, type: 'spring', stiffness: 200, damping: 15 }}>
              <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6">
                <CheckCircle2 className="w-14 h-14 text-green-600" />
              </div>
            </motion.div>
            <motion.h3 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.5 }} className="text-2xl font-bold text-gray-900 mb-2">
              Repair Order Completed Successfully!
            </motion.h3>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8, duration: 0.5 }} className="text-gray-600 text-center max-w-md">
              RO #{roId} has been marked as completed
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2, duration: 0.5 }} className="flex items-center gap-4 mt-6">
              <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 1.4, duration: 0.6, repeat: Infinity, repeatType: "reverse", repeatDelay: 0.3 }}>
                <ArrowRight className="w-8 h-8 text-blue-600" />
              </motion.div>
              <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 1.8, duration: 0.5 }} className="flex items-center gap-3">
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
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-white">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Complete Repair Order: RO{roId}{' '}
                <span className="text-sm font-medium text-white bg-amber-500 px-2 py-0.5 rounded-full ml-1">External Vendor RO</span>
              </h2>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <p className="text-sm text-gray-600">Vehicle: {roDetails?.vehicle_nickname}</p>
                {loadingLiveKm ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                    <div className="animate-spin rounded-full h-3 w-3 border-2 border-gray-500 border-t-transparent"></div>Loading KM...
                  </span>
                ) : liveKm ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Live KM: {liveKm.toLocaleString()} km
                    <button onClick={() => { navigator.clipboard.writeText(liveKm.toString()); toast.success(`Copied ${liveKm.toLocaleString()} km to clipboard!`); }} className="ml-0.5 hover:bg-purple-200 rounded-full p-0.5 transition-colors" title="Copy KM to clipboard">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    </button>
                  </span>
                ) : liveKmError ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-red-100 text-red-600 rounded-full">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    {liveKmError}
                  </span>
                ) : null}
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <form onSubmit={handleSubmit} className="space-y-6">

              {/* RO Summary */}
              <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div><label className="text-sm font-medium text-gray-700">Vehicle</label><p className="text-sm text-gray-900 mt-1">{roDetails?.vehicle_nickname}</p></div>
                <div><label className="text-sm font-medium text-gray-700">Requested By</label><p className="text-sm text-gray-900 mt-1">{roDetails?.requested_by_name}</p></div>
                <div><label className="text-sm font-medium text-gray-700">Bus KM's at time of repair</label><p className="text-sm text-gray-900 mt-1">{roDetails?.kms_before_service}</p></div>
                <div><label className="text-sm font-medium text-gray-700">Vendor</label><p className="text-sm text-gray-900 mt-1">{roDetails?.vendor_name}</p></div>
              </div>

              {/* Invoice Summary - Collapsible */}
              {invoiceSummary.length > 0 && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => setInvoiceSummaryExpanded(!invoiceSummaryExpanded)}>
                    <strong className="text-sm text-gray-900">Invoice Summary</strong>
                    {invoiceSummaryExpanded ? <ChevronUp className="h-4 w-4 text-gray-600" /> : <ChevronDown className="h-4 w-4 text-gray-600" />}
                  </div>
                  {invoiceSummaryExpanded && (
                    <div className="p-4 space-y-3">
                      <h3 className="text-right font-semibold text-lg text-gray-900">Grand Total: ${grandTotal.toFixed(2)}</h3>
                      {invoiceSummary.map((group: any, idx: number) => (
                        <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-white">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <strong className="text-sm text-gray-900">{group.work_order_number}</strong>
                              {group.work_order_status && <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800">{group.work_order_status}</span>}
                              <br />
                              <small className="text-xs text-gray-600">Invoice: {group.invoice_number}{group.service_completion_date && <> | {new Date(group.service_completion_date).toLocaleDateString()}</>}</small>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold text-gray-900">${parseFloat(group.invoice_amount || 0).toFixed(2)}</div>
                              {group.invoice_url && <a href={group.invoice_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">View Invoice</a>}
                            </div>
                          </div>
                          {group.repairs?.length > 0 && (<><p className="text-xs font-medium text-gray-700 mt-3 mb-1">Repairs</p><ul className="text-xs text-gray-600 space-y-1">{group.repairs.map((r: any, ridx: number) => <li key={ridx}>Repair ID {r.repair_log_id} ({r.defect_status})</li>)}</ul></>)}
                          {group.sms?.length > 0 && (<><p className="text-xs font-medium text-gray-700 mt-3 mb-1">Scheduled Maintenance</p><ul className="text-xs text-gray-600 space-y-1">{group.sms.map((sm: any, smidx: number) => <li key={smidx}>{sm.setting_name}</li>)}</ul></>)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Completion Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Estimated Repair Amount <span className="text-gray-500">(Read-only)</span></label>
                  <p className="text-sm text-gray-900 mt-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">${parseFloat(roDetails?.estimated_repair_amount || 0).toFixed(2)}</p>
                </div>

                {/* CHANGE 6: Invoice Amount — optional (no asterisk) */}
                <div>
                   <label className="text-sm font-medium text-gray-700">
    Actual Invoice Amount <span className="text-red-500">*</span>
  </label>
                  <input type="number" step="0.01" value={formData.txtInvoiceAmount}
                    onChange={(e) => { setFormData({ ...formData, txtInvoiceAmount: e.target.value }); if (errors.txtInvoiceAmount) setErrors({ ...errors, txtInvoiceAmount: '' }); }}
                    className={`mt-1 w-full px-3 py-2 border ${errors.txtInvoiceAmount ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-2 ${errors.txtInvoiceAmount ? 'focus:ring-red-500' : 'focus:ring-blue-500'}`}
                  />
                  {errors.txtInvoiceAmount && <p className="text-xs text-red-600 mt-1">{errors.txtInvoiceAmount}</p>}
                </div>

                {/* CHANGE 1: Work Order Number — optional (no asterisk) */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Work Order Number</label>
                  <input type="text" value={formData.txtWorkOrderNumber}
                    onChange={(e) => { setFormData({ ...formData, txtWorkOrderNumber: e.target.value }); if (errors.txtWorkOrderNumber) setErrors({ ...errors, txtWorkOrderNumber: '' }); }}
                    className={`mt-1 w-full px-3 py-2 border ${errors.txtWorkOrderNumber ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-2 ${errors.txtWorkOrderNumber ? 'focus:ring-red-500' : 'focus:ring-blue-500'}`}
                  />
                  {errors.txtWorkOrderNumber && <p className="text-xs text-red-600 mt-1">{errors.txtWorkOrderNumber}</p>}
                </div>

                {/* CHANGE 3: Invoice Number — optional (no asterisk) */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Invoice Number</label>
                  <input type="text" value={formData.txtInvoiceNumber}
                    onChange={(e) => { setFormData({ ...formData, txtInvoiceNumber: e.target.value }); if (errors.txtInvoiceNumber) setErrors({ ...errors, txtInvoiceNumber: '' }); }}
                    className={`mt-1 w-full px-3 py-2 border ${errors.txtInvoiceNumber ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-2 ${errors.txtInvoiceNumber ? 'focus:ring-red-500' : 'focus:ring-blue-500'}`}
                  />
                  {errors.txtInvoiceNumber && <p className="text-xs text-red-600 mt-1">{errors.txtInvoiceNumber}</p>}
                </div>

                {/* CHANGE 4 & 5: KMs — blank by default; triggers row auto-population on change */}
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Kms after Repair
                    <span className="ml-1 text-xs text-blue-600 font-normal">(auto-fills rows below)</span>
                  </label>
                  <input
                    type="number" step="0.01" value={formData.txtKms}
                    onChange={(e) => handleKmsChange(e.target.value)}
                    placeholder="Enter KMs to auto-fill defect rows"
                    className={`mt-1 w-full px-3 py-2 border ${errors.txtKms ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-2 ${errors.txtKms ? 'focus:ring-red-500' : 'focus:ring-blue-500'}`}
                  />
                  {errors.txtKms && <p className="text-xs text-red-600 mt-1">{errors.txtKms}</p>}
                </div>

                <div>
                  <FormDatePickerCustom label="Service Completed Date" name="txtServiceCompletedDate" required value={formData.txtServiceCompletedDate}
                    onChange={(value) => { setFormData({ ...formData, txtServiceCompletedDate: value }); if (errors.txtServiceCompletedDate) setErrors({ ...errors, txtServiceCompletedDate: '' }); }}
                    error={errors.txtServiceCompletedDate}
                  />
                </div>

                {/* CHANGE 2: Payment Method — optional (no asterisk) */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Payment Method</label>
                  <select value={formData.txtPaymentMethod}
                    onChange={(e) => { setFormData({ ...formData, txtPaymentMethod: e.target.value }); if (errors.txtPaymentMethod) setErrors({ ...errors, txtPaymentMethod: '' }); }}
                    className={`mt-1 w-full px-3 py-2 border ${errors.txtPaymentMethod ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-2 ${errors.txtPaymentMethod ? 'focus:ring-red-500' : 'focus:ring-blue-500'}`}
                  >
                    <option value="">Select Payment Method</option>
                    {paymentMethods.map((pm) => <option key={pm.id} value={pm.id}>{pm.payment_method}</option>)}
                  </select>
                  {errors.txtPaymentMethod && <p className="text-xs text-red-600 mt-1">{errors.txtPaymentMethod}</p>}
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Payment Notes</label>
                  <textarea rows={2} value={formData.txtPaymentNotes} onChange={(e) => setFormData({ ...formData, txtPaymentNotes: e.target.value })} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              {/* ── Section 1: Vehicle Repairs ── */}
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
                          <th className="px-4 py-2 text-left">Service Completed Date</th>
                          <th className="px-4 py-2 text-left">Kilometers</th>
                          <th className="px-4 py-2 text-left">Change Status <span className="text-red-500">*</span></th>
                          <th className="px-4 py-2 text-center">Approve</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {defects.map((defect) => {
                          const isAlreadyApproved = defect.manager_status === 'Approved';
                          return (
                            <tr key={defect.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                {defect.repair_code_category}<br />
                                <small className="text-gray-500">({defect.defect_source} - {defect.vrlid})</small>
                              </td>
                              <td className="px-4 py-3">
                                {defect.repair_desc}
                                {defect.notes && <><br /><i className="text-gray-600">Notes: {defect.notes}</i></>}
                              </td>

                              {/* Service Completed Date */}
                              <td className="px-4 py-3">
                                <FormDatePickerCustom
                                  label="" name={`repair_date_${defect.id}`}
                                  value={repairDates[defect.id] || ''}
                                  onChange={(value) => setRepairDates(prev => ({ ...prev, [defect.id]: value }))}
                                  disabled={isAlreadyApproved}
                                />
                                {rowErrors[defect.id]?.date && (
                                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                    <AlertCircle className="h-3 w-3" />{rowErrors[defect.id].date}
                                  </p>
                                )}
                              </td>

                              {/* Kilometers */}
                              <td className="px-4 py-3">
                                <input
                                  type="text" inputMode="numeric" placeholder="0"
                                  value={repairKms[defect.id] ? Number(repairKms[defect.id].replace(/,/g, '')).toLocaleString('en-US') : ''}
                                  onChange={(e) => { const raw = e.target.value.replace(/,/g, '').replace(/[^\d]/g, ''); setRepairKms(prev => ({ ...prev, [defect.id]: raw })); }}
                                  disabled={isAlreadyApproved}
                                  className={`w-36 px-2 py-1.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm
                                    ${rowErrors[defect.id]?.kms ? 'border-red-500' : 'border-gray-300'}
                                    ${isAlreadyApproved ? 'bg-gray-100 cursor-not-allowed text-gray-500' : ''}`}
                                />
                                {rowErrors[defect.id]?.kms && (
                                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                    <AlertCircle className="h-3 w-3" />{rowErrors[defect.id].kms}
                                  </p>
                                )}
                              </td>

                              {/* Status */}
                              <td className="px-4 py-3">
                                <select
                                  required value={repairStatuses[defect.id] || ''}
                                  onChange={(e) => { setRepairStatuses({ ...repairStatuses, [defect.id]: e.target.value }); if (errors.defectStatuses) setErrors({ ...errors, defectStatuses: '' }); }}
                                  disabled={isAlreadyApproved}
                                  className={`w-full px-2 py-1.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm
                                    ${rowErrors[defect.id]?.status ? 'border-red-500' : 'border-gray-300'}
                                    ${isAlreadyApproved ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                                >
                                  <option value="">Select Status</option>
                                  {DEFECT_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>)}
                                </select>
                                {rowErrors[defect.id]?.status && (
                                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                    <AlertCircle className="h-3 w-3" />{rowErrors[defect.id].status}
                                  </p>
                                )}
                              </td>

                              {/* Approve button */}
                              <td className="px-4 py-3 text-center">
                                <button
                                  type="button"
                                  disabled={!repairStatuses[defect.id] || savingApprove === defect.id || isAlreadyApproved}
                                  onClick={() => handleApproveDefect(defect)}
                                  className={`inline-flex items-center justify-center p-2 rounded-lg transition-colors
                                    ${isAlreadyApproved ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed'}`}
                                  title={isAlreadyApproved ? `Already approved by ${defect.manager_name || 'manager'} on ${defect.manager_update_date ? new Date(defect.manager_update_date).toLocaleDateString() : 'unknown date'}` : 'Approve this defect'}
                                >
                                  {savingApprove === defect.id ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> : <CheckCircle className="h-4 w-4" />}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {errors.defectStatuses && (
                    <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />{errors.defectStatuses}
                    </p>
                  )}

                  {/* Save Repairs button */}
                  <div className="flex justify-end mt-2">
                    <button
                      type="button" onClick={handleSave} disabled={savingStatuses}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                      {savingStatuses ? <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>Saving...</> : 'Save Repairs'}
                    </button>
                  </div>
                </div>
              )}

              {/* ── Section 2: Scheduled Maintenance ── */}
              {scheduledMaintenance.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Package className="h-5 w-5 text-blue-600" />
                    Scheduled Maintenance Records
                  </h3>

                  <div className="mb-4 p-3 bg-amber-50 border-l-4 border-amber-500 rounded-r-lg">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm">
                        <p className="font-medium text-amber-800">Important Note:</p>
                        <p className="text-amber-700 text-xs mt-0.5">
                          Saving the Maintenance Record values (Date and KM) will not impact the future interval of these maintenance items.
                          Upon approving the record, the <strong>next schedule date will automatically be calculated</strong> based on the maintenance interval settings.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="border border-blue-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-blue-100">
                        <tr>
                          <th className="px-4 py-2 text-left text-blue-900">Maintenance Type</th>
                          <th className="px-4 py-2 text-left text-blue-900">Service Completed Date</th>
                          <th className="px-4 py-2 text-left text-blue-900">Kilometers</th>
                          <th className="px-4 py-2 text-left text-blue-900">Change Status <span className="text-red-500">*</span></th>
                          <th className="px-4 py-2 text-center text-blue-900">Approve</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-blue-200 bg-white">
                        {scheduledMaintenance.map((sm: any) => {
                          const isAlreadyApproved = sm.manager_status === 'Approved';
                          return (
                            <tr key={sm.id} className="hover:bg-blue-50">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <CheckCircle className="h-4 w-4 text-blue-600 flex-shrink-0" />
                                  <span className="font-medium text-gray-900">{sm.setting_name}</span>
                                </div>
                                <small className="text-gray-500 ml-6">ID: {sm.scheduled_maintenance_setting_id}</small>
                              </td>

                              {/* Service Completed Date */}
                              <td className="px-4 py-3">
                                <FormDatePickerCustom
                                  label="" name={`sm_date_${sm.id}`}
                                  value={smDates[sm.id] || ''}
                                  onChange={(value) => setSmDates(prev => ({ ...prev, [sm.id]: value }))}
                                  disabled={isAlreadyApproved}
                                />
                                {smRowErrors[sm.id]?.date && (
                                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                    <AlertCircle className="h-3 w-3" />{smRowErrors[sm.id].date}
                                  </p>
                                )}
                              </td>

                              {/* Kilometers */}
                              <td className="px-4 py-3">
                                <input
                                  type="text" inputMode="numeric" placeholder="0"
                                  value={smKms[sm.id] ? Number(smKms[sm.id].replace(/,/g, '')).toLocaleString('en-US') : ''}
                                  onChange={(e) => { const raw = e.target.value.replace(/,/g, '').replace(/[^\d]/g, ''); setSmKms(prev => ({ ...prev, [sm.id]: raw })); }}
                                  disabled={isAlreadyApproved}
                                  className={`w-36 px-2 py-1.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm
                                    ${smRowErrors[sm.id]?.kms ? 'border-red-500' : 'border-gray-300'}
                                    ${isAlreadyApproved ? 'bg-gray-100 cursor-not-allowed text-gray-500' : ''}`}
                                />
                                {smRowErrors[sm.id]?.kms && (
                                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                    <AlertCircle className="h-3 w-3" />{smRowErrors[sm.id].kms}
                                  </p>
                                )}
                              </td>

                              {/* Change Status */}
                              <td className="px-4 py-3">
                                <select
                                  required value={smStatuses[sm.id] || ''}
                                  onChange={(e) => setSmStatuses(prev => ({ ...prev, [sm.id]: e.target.value }))}
                                  disabled={isAlreadyApproved}
                                  className={`w-full px-2 py-1.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm
                                    ${smRowErrors[sm.id]?.status ? 'border-red-500' : 'border-gray-300'}
                                    ${isAlreadyApproved ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                                >
                                  <option value="">Select Status</option>
                                  {DEFECT_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>)}
                                </select>
                                {smRowErrors[sm.id]?.status && (
                                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                    <AlertCircle className="h-3 w-3" />{smRowErrors[sm.id].status}
                                  </p>
                                )}
                              </td>

                              {/* Approve */}
                              <td className="px-4 py-3 text-center">
                                <button
                                  type="button"
                                  disabled={!smStatuses[sm.id] || savingSmApprove === sm.id || isAlreadyApproved}
                                  onClick={() => handleApproveSM(sm)}
                                  className={`inline-flex items-center justify-center p-2 rounded-lg transition-colors
                                    ${isAlreadyApproved ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed'}`}
                                  title={isAlreadyApproved ? `Already approved by ${sm.manager_name || 'manager'}` : 'Approve this maintenance item'}
                                >
                                  {savingSmApprove === sm.id ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> : <CheckCircle className="h-4 w-4" />}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Save Maintenance button */}
                  <div className="flex justify-end mt-2">
                    <button
                      type="button" onClick={handleSaveSM} disabled={savingSmStatuses}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                      {savingSmStatuses ? <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>Saving...</> : 'Save Maintenance'}
                    </button>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="text-sm font-medium text-gray-700">Repair Notes</label>
                <textarea rows={4} value={formData.txtRepairNotes} onChange={(e) => setFormData({ ...formData, txtRepairNotes: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter any notes about the repair completion..."
                />
              </div>

              {/* File Upload */}
              <div>
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Upload className="h-4 w-4" />Attach Invoice
                  <span className="text-gray-500 font-normal text-xs">(jpg, png, gif, pdf only - Max 50MB)</span>
                </label>
                {existingAttachments.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-medium text-gray-600">Existing Attachments:</p>
                    {existingAttachments.map((att) => (
                      <div key={att.id} className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center gap-2">
                          <File className="h-4 w-4 text-blue-600 flex-shrink-0" />
                          <div>
                            <span className="text-sm font-medium text-gray-900">{att.original_filename || 'Invoice'}</span>
                            <span className="text-xs text-gray-500 ml-2">{new Date(att.upload_timestamp).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <a href={`${API_BASE_URL}/uploads/ro/${roId}/${att.stored_filename}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 p-1" title="Download attachment">
                          <Download className="h-4 w-4" />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-3">
                  {!attachedInvoice ? (
                    <label className="cursor-pointer block">
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 hover:border-blue-500 hover:bg-blue-50 transition-all duration-200">
                        <div className="flex flex-col items-center gap-3">
                          <div className="p-3 bg-blue-100 rounded-full"><Upload className="h-6 w-6 text-blue-600" /></div>
                          <div className="text-center">
                            <p className="text-sm font-medium text-gray-700">Click to upload invoice</p>
                            <p className="text-xs text-gray-500 mt-1">JPG, PNG, GIF, PDF up to 50MB</p>
                          </div>
                        </div>
                        <input type="file" accept=".jpg,.jpeg,.png,.gif,.pdf,image/jpeg,image/png,image/gif,application/pdf" onChange={handleFileChange} className="hidden" />
                      </div>
                    </label>
                  ) : (
                    <div className="flex items-center justify-between p-4 bg-green-50 border-2 border-green-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg"><File className="h-5 w-5 text-green-600" /></div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{attachedInvoice.name}</p>
                          <p className="text-xs text-gray-600">{(attachedInvoice.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                      </div>
                      <button type="button" onClick={handleRemoveFile} className="text-red-600 hover:text-red-800 p-2 hover:bg-red-100 rounded-lg transition-colors" title="Remove file">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                  {fileError && <p className="text-xs text-red-600 mt-2 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{fileError}</p>}
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
                    <p className="text-xs mt-0.5">All defects must be marked as "Completed" or "Repair Not Required". {incompleteDefects.length} defect(s) still need to be updated.</p>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 ml-4">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSubmit} disabled={loading || !canComplete}
                title={!canComplete ? 'All defects must be Completed or Repair Not Required' : ''}
                className="px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {loading ? <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>Completing...</> : 'Mark as Complete'}
              </button>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}