import React, { useEffect, useState } from 'react';
import { X, Upload, Loader2, FileText, Trash2, CheckCircle, DollarSign, FileWarning, Package, Wrench } from 'lucide-react';
import { useForm } from 'react-hook-form@7.55.0';
import { Badge } from '../../components/ui/badge';
import { toast } from 'sonner@2.0.3';
import { API_BASE_URL, buildApiUrl, API_ENDPOINTS } from '../../config/api';
import { FormInput, FormSelect, FormDatePickerCustom } from './FormComponents';
import { showConfirmationToast } from '../../utils/confirmationToast';

interface UpdateROModalProps {
  roId: number;
  onClose: () => void;
  onSuccess: () => void;
}

interface PaymentMethod {
  id: number;
  payment_method: string;
}

interface RepairItem {
  repair_code_category: string;
  repair_desc: string;
  repair_notes: string;
  issue_type: string;
  rpor_status: string;
  work_order_number: string | null;
  invoice_number: string | null;
  invoice_url: string | null;
  invoice_amount: number | null;
  service_completion_date: string | null;
  current_kms: number | null;
}

interface ScheduledMaintenanceItem {
  setting_name: string;
  notes?: string;
  rpor_status: string;
  work_order_number: string | null;
  invoice_number: string | null;
  invoice_url: string | null;
  invoice_amount: number | null;
  service_completion_date: string | null;
  current_kms: number | null;
}

interface ROData {
  rpoid: number;
  vehicle_nickname: string;
  requested_by_name: string;
  kms_before_service: number;
  vendor_name: string;
  estimated_repair_amount: number;
  invoice_amount: number;
  work_order_number: string;
  invoice_number: string;
  kms_after_service: number;
  service_completed_date: string;
  payment_method: number;
  payment_notes: string;
  repair_notes: string;
  repairs: RepairItem[];
  scheduledMaintenance: ScheduledMaintenanceItem[];
  rpostatus: number;
  attached_invoice_url: string;
}

interface UpdateROFormData {
  kms_after_service: string;
  invoice_amount: string;
  work_order_number: string;
  invoice_number: string;
  service_completed_date: string;
  payment_method: string;
  payment_notes: string;
  repair_notes: string;
}

export function UpdateROModal({ roId, onClose, onSuccess }: UpdateROModalProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [roData, setRoData] = useState<ROData | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [attachedInvoice, setAttachedInvoice] = useState<File | null>(null);

  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<UpdateROFormData>({
    mode: 'onChange',
    defaultValues: {
      kms_after_service: '',
      invoice_amount: '',
      work_order_number: '',
      invoice_number: '',
      service_completed_date: '',
      payment_method: '',
      payment_notes: '',
      repair_notes: ''
    }
  });

  const serviceCompletedDate = watch('service_completed_date');

  useEffect(() => {
    fetchData();
  }, [roId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const roResponse = await fetch(buildApiUrl(API_ENDPOINTS.repairOrders.details(roId)), {
        credentials: 'include',
        headers: {
          'ngrok-skip-browser-warning': 'true',
        },
      });
      const roResult = await roResponse.json();
      
      if (!roResult.success) {
        throw new Error(roResult.message || 'Failed to fetch RO details');
      }

      if (roResult.data.rpostatus !== 2) {
        toast.error('Only In Progress repair orders can be updated');
        onClose();
        return;
      }
      
      const pmResponse = await fetch(buildApiUrl(API_ENDPOINTS.repairOrders.paymentMethods), {
        credentials: 'include',
        headers: {
          'ngrok-skip-browser-warning': 'true',
        },
      });
      const pmResult = await pmResponse.json();
      
      if (!pmResult.success) {
        throw new Error(pmResult.message || 'Failed to fetch payment methods');
      }
      
      setRoData(roResult.data);
      setPaymentMethods(pmResult.data);
      
      let formattedDate = '';
      if (roResult.data.service_completed_date) {
        const dateStr = roResult.data.service_completed_date;
        if (dateStr.includes(' ')) {
          formattedDate = dateStr.split(' ')[0];
        } else {
          formattedDate = dateStr;
        }
      }
      
      setValue('kms_after_service', roResult.data.kms_after_service?.toString() || '');
      setValue('invoice_amount', roResult.data.invoice_amount?.toString() || '');
      setValue('work_order_number', roResult.data.work_order_number || '');
      setValue('invoice_number', roResult.data.invoice_number || '');
      setValue('service_completed_date', formattedDate);
      setValue('payment_method', roResult.data.payment_method?.toString() || '');
      setValue('payment_notes', roResult.data.payment_notes || '');
      setValue('repair_notes', roResult.data.repair_notes || '');
      
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast.error(error.message || 'Failed to load data');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf'];
      const maxSize = 50 * 1024 * 1024;
      
      if (!allowedTypes.includes(file.type)) {
        toast.error(`Invalid file: ${file.name} (invalid type)`);
      } else if (file.size > maxSize) {
        toast.error(`Invalid file: ${file.name} (exceeds 50MB)`);
      } else {
        setAttachedInvoice(file);
        toast.success('File added successfully');
      }
      
      e.target.value = '';
    }
  };

  const removeFile = () => {
    setAttachedInvoice(null);
    toast.info('File removed');
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return '';
    if (dateStr.includes(' ')) {
      return dateStr.split(' ')[0];
    }
    return dateStr;
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

const onSubmit = async (data: UpdateROFormData) => {
  if (!serviceCompletedDate) {
    toast.error('Service Completed Date is required');
    return;
  }

  showConfirmationToast({
    title: 'Are you sure you want to update this Repair Order?',
    confirmText: 'Update',
    cancelText: 'Cancel',
    variant: 'default',
    onConfirm: async () => {
      try {
        setSubmitting(true);

        const formData = new FormData();
        formData.append('txtKms', data.kms_after_service || '0');
        formData.append('txtInvoiceAmount', data.invoice_amount || '0');
        formData.append('txtWorkOrderNumber', data.work_order_number || '');
        formData.append('txtInvoiceNumber', data.invoice_number || '');
        formData.append('txtServiceCompletedDate', serviceCompletedDate || '');
        formData.append('txtPaymentMethod', data.payment_method || '');
        formData.append('txtPaymentNotes', data.payment_notes || '');
        formData.append('txtRepairNotes', data.repair_notes || '');

        if (attachedInvoice) {
          formData.append('attached_invoice', attachedInvoice);
        }

        const response = await fetch(buildApiUrl(API_ENDPOINTS.repairOrders.update(roId)), {
          method: 'PUT',
          credentials: 'include',
          headers: {
            'ngrok-skip-browser-warning': 'true',
          },
          body: formData,
        });

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.message || 'Failed to update repair order');
        }

        toast.success('Repair Order updated successfully' + (attachedInvoice ? ' with invoice attachment' : ''));

        setTimeout(() => {
          onSuccess();
          onClose();
        }, 500);

      } catch (error: any) {
        console.error('Error updating RO:', error);
        toast.error(error.message || 'Failed to update repair order');
      } finally {
        setSubmitting(false);
      }
    }
  });
};

  if (loading) {
    return (
      <>
        <div className="fixed inset-0 z-[140] bg-black bg-opacity-50 transition-opacity duration-300" />
        <div className="fixed inset-y-0 right-0 z-[150] w-full bg-white shadow-2xl flex items-center justify-center animate-slide-in">
          <div className="flex flex-col items-center justify-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
            <div className="text-center">
              <p className="text-lg text-gray-900">Loading Repair Order</p>
              <p className="text-sm text-gray-500 mt-1">Please wait...</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!roData) {
    return null;
  }

  const paymentMethodOptions = paymentMethods.map(pm => ({
    value: pm.id.toString(),
    label: pm.payment_method
  }));

  return (
    <>
      <div 
        className="fixed inset-0 z-[140] bg-black bg-opacity-50 transition-opacity duration-300"
        onClick={onClose}
      />
      
      <div className="fixed inset-y-0 right-0 z-[150] w-full bg-white shadow-2xl flex flex-col animate-slide-in">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              disabled={submitting}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-lg sm:text-xl text-gray-900">Update Repair Order</h2>
              <p className="text-sm text-gray-600 mt-0.5">
                RO #{roData.rpoid} • {roData.vehicle_nickname}
              </p>
            </div>
          </div>
          <button
            onClick={handleSubmit(onSubmit)}
            disabled={submitting}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Update RO
              </>
            )}
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1 space-y-6">
                <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 sm:p-6">
                  <h3 className="text-base text-gray-900 mb-4 border-b border-gray-300 pb-2">
                    RO Information
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-gray-600">Vehicle:</span>
                      <span className="text-sm text-gray-900">{roData.vehicle_nickname}</span>
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-gray-600">Requested By:</span>
                      <span className="text-sm text-gray-900">{roData.requested_by_name}</span>
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-gray-600">Initial Kms:</span>
                      <span className="text-sm text-gray-900">{roData.kms_before_service?.toLocaleString()} km</span>
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-gray-600">Vendor:</span>
                      <span className="text-sm text-gray-900">{roData.vendor_name}</span>
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-gray-600">Estimated Amount:</span>
                      <span className="text-sm text-gray-900 flex items-center gap-1">
                        <DollarSign className="h-3 w-3 text-green-600" />
                        {roData.estimated_repair_amount?.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 sm:p-6">
                  <h3 className="text-base text-gray-900 mb-4 border-b border-gray-300 pb-2">
                    Completion Details
                  </h3>
                  
                  <div className="space-y-4">
                    <FormInput
                      label="Kms After Repair"
                      name="kms_after_service"
                      type="number"
                      placeholder="Enter kilometers"
                      required
                      register={register}
                      error={errors.kms_after_service?.message}
                    />
                    
                    <FormInput
                      label="Actual Invoice Amount"
                      name="invoice_amount"
                      type="number"
                      placeholder="0.00"
                      required
                      register={register}
                      error={errors.invoice_amount?.message}
                    />
                    
                    <FormInput
                      label="Work Order Number"
                      name="work_order_number"
                      type="text"
                      placeholder="Enter work order number"
                      required
                      register={register}
                      error={errors.work_order_number?.message}
                    />
                    
                    <FormInput
                      label="Invoice Number"
                      name="invoice_number"
                      type="text"
                      placeholder="Enter invoice number"
                      required
                      register={register}
                      error={errors.invoice_number?.message}
                    />
                    
                    <FormDatePickerCustom
                      label="Service Completed Date"
                      name="service_completed_date"
                      required
                      value={serviceCompletedDate}
                      onChange={(value) => setValue('service_completed_date', value, { shouldValidate: true })}
                      error={errors.service_completed_date?.message}
                    />
                    
                    <FormSelect
                      label="Payment Method"
                      name="payment_method"
                      options={paymentMethodOptions}
                      placeholder="Select payment method"
                      required
                      register={register}
                      error={errors.payment_method?.message}
                    />
                    
                    <FormInput
                      label="Payment Notes"
                      name="payment_notes"
                      type="textarea"
                      placeholder="Enter payment notes (optional)"
                      rows={3}
                      register={register}
                      error={errors.payment_notes?.message}
                    />
                    
                    <FormInput
                      label="Repair Notes"
                      name="repair_notes"
                      type="textarea"
                      placeholder="Enter repair notes (optional)"
                      rows={3}
                      register={register}
                      error={errors.repair_notes?.message}
                    />
                  </div>
                </div>
              </div>

              <div className="lg:col-span-2 space-y-6">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border-2 border-dashed border-blue-300 p-4 sm:p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-600 p-2 rounded-lg">
                        <Upload className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-base text-gray-900">Invoice Attachments</h3>
                        <p className="text-sm text-gray-600 mt-0.5">
                          Upload invoice files (JPG, PNG, GIF, PDF • Max 50MB each)
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-blue-600 text-white">
                      {attachedInvoice ? 1 : 0} file{attachedInvoice ? '' : 's'}
                    </Badge>
                  </div>

                  <div className="relative">
                    <input
                      type="file"
                      onChange={handleFileChange}
                      accept=".jpg,.jpeg,.png,.gif,.pdf"
                      className="hidden"
                      id="invoice-upload"
                      disabled={submitting}
                    />
                    <label
                      htmlFor="invoice-upload"
                      className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-all ${
                        submitting 
                          ? 'border-gray-300 bg-gray-50 cursor-not-allowed' 
                          : 'border-blue-400 bg-white hover:bg-blue-50 hover:border-blue-500'
                      }`}
                    >
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className={`h-8 w-8 mb-2 ${submitting ? 'text-gray-400' : 'text-blue-600'}`} />
                        <p className="mb-1 text-sm text-gray-700">
                          <span className="font-semibold">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs text-gray-500">JPG, PNG, GIF, PDF (max 50MB per file)</p>
                      </div>
                    </label>
                  </div>

                  {attachedInvoice && (
                    <div className="mt-4 space-y-2">
                      <p className="text-sm text-gray-700 mb-2">Ready to upload:</p>
                      <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-300 transition-all group">
                        <div className="bg-blue-100 p-2 rounded-lg flex-shrink-0">
                          {attachedInvoice.type.includes('pdf') ? (
                            <FileText className="h-5 w-5 text-blue-600" />
                          ) : (
                            <FileWarning className="h-5 w-5 text-blue-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900 truncate">{attachedInvoice.name}</p>
                          <p className="text-xs text-gray-500">{formatFileSize(attachedInvoice.size)}</p>
                        </div>
                        <Badge variant="outline" className="text-xs flex-shrink-0">
                          {attachedInvoice.type.split('/')[1].toUpperCase()}
                        </Badge>
                        <button
                          type="button"
                          onClick={removeFile}
                          disabled={submitting}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-red-600 hover:bg-red-50 rounded flex-shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {roData.repairs && roData.repairs.length > 0 && (
                  <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                    <div className="bg-white px-4 py-3 border-b border-gray-300 flex items-center gap-2">
                      <Wrench className="h-5 w-5 text-orange-600" />
                      <h3 className="text-base text-gray-900">Vehicle Repairs</h3>
                      <Badge className="bg-orange-100 text-orange-700">{roData.repairs.length}</Badge>
                    </div>
                    <div className="bg-white overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs text-gray-700 border-b border-gray-300">Category</th>
                            <th className="px-3 py-2 text-left text-xs text-gray-700 border-b border-gray-300">Repair Description</th>
                  
                            <th className="px-3 py-2 text-left text-xs text-gray-700 border-b border-gray-300">Completion Details</th>
                            <th className="px-3 py-2 text-left text-xs text-gray-700 border-b border-gray-300">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {roData.repairs.map((repair, index) => (
                            <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="px-3 py-3 text-sm text-gray-900">{repair.repair_code_category}</td>
                              <td className="px-3 py-3 text-sm text-gray-900">{repair.repair_notes}</td>
                          
                              <td className="px-3 py-3">{renderCompletionDetails(repair)}</td>
                              <td className="px-3 py-3 text-sm text-gray-700">{repair.rpor_status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {roData.scheduledMaintenance && roData.scheduledMaintenance.length > 0 && (
                  <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                    <div className="bg-white px-4 py-3 border-b border-gray-300 flex items-center gap-2">
                      <Package className="h-5 w-5 text-purple-600" />
                      <h3 className="text-base text-gray-900">Scheduled Maintenance</h3>
                      <Badge className="bg-purple-100 text-purple-700">{roData.scheduledMaintenance.length}</Badge>
                    </div>
                    <div className="bg-white overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs text-gray-700 border-b border-gray-300">Maintenance Task</th>
                            <th className="px-3 py-2 text-left text-xs text-gray-700 border-b border-gray-300">Completion Details</th>
                            <th className="px-3 py-2 text-left text-xs text-gray-700 border-b border-gray-300">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {roData.scheduledMaintenance.map((item, index) => (
                            <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="px-3 py-3 text-sm align-top">
                                {item.notes && (
                                  <div className="text-sm text-gray-600 font-semibold">
                                    {item.notes}
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-3">{renderCompletionDetails(item)}</td>
                              <td className="px-3 py-3">
                                <Badge variant="outline" className={
                                  item.rpor_status === 'Completed' ? 'border-green-300 text-green-700' :
                                  item.rpor_status === 'In_Progress' ? 'border-blue-300 text-blue-700' :
                                  'border-gray-300 text-gray-700'
                                }>
                                  {item.rpor_status === 'In_Progress' && 'In Progress'}
                                  {item.rpor_status === 'Completed' && 'Maintenance Done'}
                                  {item.rpor_status === 'Ro_Cancelled' && 'Canceled'}
                                  {item.rpor_status === 'Repair_Not_Required' && 'Not Fixed'}
                                  {!['In_Progress', 'Completed', 'Ro_Cancelled', 'Repair_Not_Required'].includes(item.rpor_status) && item.rpor_status}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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