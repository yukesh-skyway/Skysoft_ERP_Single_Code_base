/**
 * CreateDefectModalEnhanced Component
 * Enterprise-level SaaS modal for creating new defects with MULTI-VEHICLE SUPPORT
 * Features: Multi-step wizard, multi-vehicle checkbox selection, Select All/Deselect All, react-hook-form, smooth animations
 */

import React, { useState, useEffect } from 'react';
import { 
  X, Plus, Trash2, Check, AlertCircle, Loader2, 
  ChevronRight, ChevronLeft, Sparkles, FileText,
  Calendar, Tag, StickyNote, Truck, CheckCircle2, CheckSquare, Square
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { API_ENDPOINTS, apiFetch } from '../../config/api';
import { motion, AnimatePresence } from 'motion/react';
import { useForm, useFieldArray } from 'react-hook-form@7.55.0';
import { SingleSelectDropdown } from './SingleSelectDropdown';

interface DefectFormData {
  vehicle_ids: string[];  // ✅ Changed to array for multi-select
  defects: {
    category: string;
    desc: string;
    notes: string;
  }[];
}

interface RepairCategory {
  id: number;
  repair_code_category: string;
  repair_category_type: string;
  status: number;
}

interface Vehicle {
  id: number;
  vehicle_nickname: string;
}

interface CreateDefectModalEnhancedProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  vehicles: Vehicle[];
  repairCategories: RepairCategory[];
}

export const CreateDefectModalEnhanced: React.FC<CreateDefectModalEnhancedProps> = ({
  isOpen,
  onClose,
  onSuccess,
  vehicles,
  repairCategories
}) => {
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [globalErrors, setGlobalErrors] = useState<string[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);  // ✅ Multi-select state

  // Initialize react-hook-form
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    watch,
    reset,
    trigger,
    setValue
  } = useForm<DefectFormData>({
    defaultValues: {
      vehicle_ids: [],  // ✅ Array for multiple vehicles
      defects: [{ category: '', desc: '', notes: '' }]
    },
    mode: 'onChange'
  });

  // Use field array for dynamic defect rows
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'defects'
  });

  // Watch values for UI feedback
  const watchedVehicleIds = watch('vehicle_ids');
  const watchedDefects = watch('defects');

  // Filter to only show SkySoft categories
  const skySoftCategories = repairCategories.filter(
    cat => cat.repair_category_type === 'skysoft' && cat.status === 1
  );

  // Category options for dropdown - ✅ Sorted alphabetically
  const categoryOptions = skySoftCategories
    .map(cat => ({
      value: cat.id.toString(),
      label: cat.repair_code_category
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  // ✅ Multi-select vehicle functions
  const toggleVehicle = (vehicleId: string) => {
    setSelectedVehicleIds(prev => {
      const newSelection = prev.includes(vehicleId)
        ? prev.filter(id => id !== vehicleId)
        : [...prev, vehicleId];
      setValue('vehicle_ids', newSelection, { shouldValidate: true });
      return newSelection;
    });
  };

  const selectAllVehicles = () => {
    const allIds = vehicles.map(v => v.id.toString());
    setSelectedVehicleIds(allIds);
    setValue('vehicle_ids', allIds, { shouldValidate: true });
  };

  const deselectAllVehicles = () => {
    setSelectedVehicleIds([]);
    setValue('vehicle_ids', [], { shouldValidate: true });
  };

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      setGlobalErrors([]);
      setIsSubmitting(false);
      setShowSuccess(false);
      setSelectedVehicleIds([]);
      reset({
        vehicle_ids: [],
        defects: [{ category: '', desc: '', notes: '' }]
      });
    }
  }, [isOpen, reset]);

  const addDefectRow = () => {
    append({ category: '', desc: '', notes: '' });
  };

  const removeDefectRow = (index: number) => {
    if (fields.length <= 1) {
      toast.error('At least one defect is required', {
        description: 'You must create at least one defect entry'
      });
      return;
    }
    remove(index);
  };

  const validateStep1 = async (): Promise<boolean> => {
    if (selectedVehicleIds.length === 0) {
      toast.error('Please select at least one vehicle', {
        description: 'You must select vehicles before continuing'
      });
      return false;
    }
    return true;
  };

  const validateStep2 = async (): Promise<boolean> => {
    const result = await trigger('defects');
    return result;
  };

  const handleNext = async () => {
    const isValid = await validateStep1();
    if (!isValid) {
      return;
    }
    setCurrentStep(2);
    setGlobalErrors([]);
  };

  const handleBack = () => {
    setCurrentStep(1);
    setGlobalErrors([]);
  };

  const onSubmit = async (data: DefectFormData) => {
    setIsSubmitting(true);
    setGlobalErrors([]);

    try {
      // Prepare defects data
      const defectsData = data.defects.map(defect => {
        const selectedCategory = skySoftCategories.find(cat => cat.id === parseInt(defect.category));
        return {
          category: parseInt(defect.category),
          desc: selectedCategory?.repair_code_category || 'Defect',
          notes: defect.notes.trim(),
        };
      });

      // ✅ Send vehicle_ids array for bulk creation
      const response = await apiFetch(API_ENDPOINTS.defects.create, {
        method: 'POST',
        body: JSON.stringify({
          vehicle_ids: data.vehicle_ids.map(id => parseInt(id)),  // ✅ Send array of vehicle IDs
          defects: defectsData
        })
      });

      if (response.success) {
        // Show success animation
        setShowSuccess(true);
        
        const totalCreated = response.count || 0;
        const vehiclesCount = data.vehicle_ids.length;
        const duplicatesSkipped = response.duplicates_skipped || 0;
        
        // Wait for animation then close
        setTimeout(() => {
          if (duplicatesSkipped > 0) {
            // Show warning about duplicates
            toast.warning('Defects created with duplicates skipped', {
              description: `${totalCreated} defect${totalCreated > 1 ? 's' : ''} created, ${duplicatesSkipped} duplicate${duplicatesSkipped > 1 ? 's' : ''} skipped`,
              duration: 5000
            });
            // Show duplicate details if available
            if (response.duplicate_details) {
              console.log('🔄 Duplicates skipped:', response.duplicate_details);
            }
          } else {
            toast.success('Defects created successfully!', {
              description: `${totalCreated} defect${totalCreated > 1 ? 's' : ''} created across ${vehiclesCount} vehicle${vehiclesCount > 1 ? 's' : ''}`
            });
          }
          onSuccess();
          handleClose();
        }, 1500);
      } else {
        // Handle validation errors from backend
        if (response.errors && Array.isArray(response.errors)) {
          setGlobalErrors(response.errors);
          // Show duplicate info in toast as well
          if (response.duplicates && response.duplicates.length > 0) {
            toast.error('Duplicate defects detected', {
              description: `Cannot create defects - all ${response.duplicates.length} are duplicates`,
              duration: 6000
            });
          }
        } else {
          toast.error('Failed to create defects', {
            description: response.message || 'An unexpected error occurred'
          });
        }
      }
    } catch (error) {
      // Check if this is an error with response data (from apiFetch)
      const errorData = (error as any).response;
      
      if (errorData) {
        // We have structured error data from the API
        if (errorData.duplicates || (errorData.errors && errorData.message?.includes('duplicate'))) {
          // This is a duplicate error (expected validation, not a system error)
          console.log('ℹ️ Duplicate defects detected:', errorData.duplicates?.length || 0);
          setGlobalErrors(errorData.errors || ['All defects are duplicates. Please check for existing defects with the same vehicle, issue, and date.']);
          toast.error('Duplicate Defects Detected', {
            description: errorData.message || `All defect(s) already exist for the selected vehicle(s)`,
            duration: 6000
          });
        } else if (errorData.errors && Array.isArray(errorData.errors)) {
          // Other validation errors (expected, not system errors)
          console.log('ℹ️ Validation errors:', errorData.errors.length);
          setGlobalErrors(errorData.errors);
          toast.error('Validation Error', {
            description: errorData.message || 'Please fix the errors and try again',
            duration: 5000
          });
        } else {
          // Generic API error (unexpected)
          console.error('Error creating defects:', error);
          const errorMessage = errorData.message || (error instanceof Error ? error.message : 'An unexpected error occurred');
          setGlobalErrors([errorMessage]);
          toast.error('Error', {
            description: errorMessage
          });
        }
      } else {
        // Network or other error without structured response (unexpected)
        console.error('Network error creating defects:', error);
        const errorMessage = error instanceof Error ? error.message : 'Network error occurred';
        toast.error('Network Error', {
          description: errorMessage
        });
        setGlobalErrors([errorMessage]);
      }
      setIsSubmitting(false);
    } finally {
      // Finally block intentionally left minimal
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
    // Reset state after modal closes
    setTimeout(() => {
      setCurrentStep(1);
      setGlobalErrors([]);
      setIsSubmitting(false);
      setShowSuccess(false);
      setSelectedVehicleIds([]);
      reset();
    }, 300);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSubmitting) handleClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[95vh] overflow-hidden flex flex-col"
          >
            {/* Success Overlay */}
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
                    transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 15 }}
                  >
                    <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6">
                      <CheckCircle2 className="w-14 h-14 text-green-600" />
                    </div>
                  </motion.div>
                  <motion.h3
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="text-2xl font-bold text-gray-900 mb-2"
                  >
                    Defects Created Successfully!
                  </motion.h3>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="text-gray-600"
                  >
                    Processing your request...
                  </motion.p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Header */}
            <div className="relative bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">Create New Defect{fields.length > 1 ? 's' : ''}</h2>
                    <p className="text-blue-100 text-sm mt-0.5">
                      {currentStep === 1 
                        ? `Select vehicle${selectedVehicleIds.length !== 1 ? 's' : ''} to report defect${selectedVehicleIds.length > 1 ? 's' : ''}` 
                        : `Adding ${fields.length} defect${fields.length > 1 ? 's' : ''} to ${selectedVehicleIds.length} vehicle${selectedVehicleIds.length > 1 ? 's' : ''}`
                      }
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-sm flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>

              {/* Progress Steps */}
              <div className="flex items-center gap-3 mt-6">
                <div className="flex items-center gap-2 flex-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${
                    currentStep >= 1 ? 'bg-white text-blue-600' : 'bg-white/20 text-white/60'
                  }`}>
                    {currentStep > 1 ? <Check className="w-5 h-5" /> : '1'}
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-medium text-white/80">Step 1</div>
                    <div className="text-sm font-semibold text-white">Vehicle Selection</div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-white/60" />
                <div className="flex items-center gap-2 flex-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${
                    currentStep >= 2 ? 'bg-white text-blue-600' : 'bg-white/20 text-white/60'
                  }`}>
                    2
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-medium text-white/80">Step 2</div>
                    <div className="text-sm font-semibold text-white">Defect Details</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Content - Scrollable */}
            <div className="flex-1 overflow-y-auto bg-gray-50">
              <form onSubmit={handleSubmit(onSubmit)}>
                <AnimatePresence mode="wait">
                  {/* Step 1: Vehicle Selection with CHECKBOXES */}
                  {currentStep === 1 && (
                    <motion.div
                      key="step1"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.2 }}
                      className="p-8"
                    >
                      <div className="max-w-2xl mx-auto">
                        <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-200 p-8">
                          <div className="flex items-start gap-4 mb-6">
                            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                              <Truck className="w-6 h-6 text-blue-600" />
                            </div>
                            <div className="flex-1">
                              <h3 className="text-lg font-semibold text-gray-900 mb-1">Select Vehicles</h3>
                              <p className="text-sm text-gray-600">
                                Choose one or more vehicles to create the same defect(s) for all selected vehicles
                              </p>
                            </div>
                          </div>

                          {/* Select All / Deselect All Buttons */}
                          <div className="flex items-center gap-3 mb-4">
                            <button
                              type="button"
                              onClick={selectAllVehicles}
                              disabled={isSubmitting}
                              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <CheckSquare className="w-4 h-4" />
                              Select All
                            </button>
                            <button
                              type="button"
                              onClick={deselectAllVehicles}
                              disabled={isSubmitting}
                              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-300 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Square className="w-4 h-4" />
                              Deselect All
                            </button>
                            {selectedVehicleIds.length > 0 && (
                              <span className="text-sm font-medium text-blue-600 ml-auto">
                                {selectedVehicleIds.length} vehicle{selectedVehicleIds.length > 1 ? 's' : ''} selected
                              </span>
                            )}
                          </div>

                          {/* Vehicle Checkbox List */}
                          <div className="space-y-2 max-h-96 overflow-y-auto border-2 border-gray-200 rounded-xl p-4">
                            {vehicles.length === 0 ? (
                              <div className="text-center py-8 text-gray-500">
                                <Truck className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                                <p className="text-sm">No vehicles available</p>
                              </div>
                            ) : (
                              vehicles.map(vehicle => (
                                <label
                                  key={vehicle.id}
                                  className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                                    selectedVehicleIds.includes(vehicle.id.toString())
                                      ? 'bg-blue-50 border-blue-300 shadow-sm'
                                      : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedVehicleIds.includes(vehicle.id.toString())}
                                    onChange={() => toggleVehicle(vehicle.id.toString())}
                                    disabled={isSubmitting}
                                    className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
                                  />
                                  <span className={`text-sm font-medium flex-1 ${
                                    selectedVehicleIds.includes(vehicle.id.toString())
                                      ? 'text-blue-900'
                                      : 'text-gray-700'
                                  }`}>
                                    {vehicle.vehicle_nickname || `Vehicle #${vehicle.id}`}
                                  </span>
                                  {selectedVehicleIds.includes(vehicle.id.toString()) && (
                                    <Check className="w-5 h-5 text-blue-600" />
                                  )}
                                </label>
                              ))
                            )}
                          </div>

                          {selectedVehicleIds.length === 0 && (
                            <p className="text-sm text-red-600 mt-3 flex items-center gap-2">
                              <AlertCircle className="w-4 h-4" />
                              Please select at least one vehicle to continue
                            </p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Step 2: Defect Form */}
                  {currentStep === 2 && (
                    <motion.div
                      key="step2"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      className="p-8"
                    >
                      <div className="max-w-4xl mx-auto space-y-6">
                        {/* Header with Add Button */}
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">Defect Information</h3>
                            <p className="text-sm text-gray-600 mt-0.5">
                              These defect(s) will be created for all {selectedVehicleIds.length} selected vehicle{selectedVehicleIds.length > 1 ? 's' : ''}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={addDefectRow}
                            disabled={isSubmitting}
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Plus className="w-4 h-4" />
                            Add Defect
                          </button>
                        </div>

                        {/* Defect Rows */}
                        <div className="space-y-4">
                          {fields.map((field, index) => (
                            <motion.div
                              key={field.id}
                              initial={{ opacity: 0, y: 20, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              transition={{ duration: 0.2 }}
                              className="bg-white rounded-2xl shadow-sm border-2 border-gray-200 hover:border-blue-200 transition-all overflow-hidden"
                            >
                              {/* Defect Header */}
                              <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-gray-50 to-white border-b-2 border-gray-100">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                                    <span className="text-sm font-bold text-blue-600">#{index + 1}</span>
                                  </div>
                                  <div>
                                    <span className="text-sm font-semibold text-gray-900">Defect Entry</span>
                                    <p className="text-xs text-gray-500">
                                      Will be created for {selectedVehicleIds.length} vehicle{selectedVehicleIds.length > 1 ? 's' : ''}
                                    </p>
                                  </div>
                                </div>
                                {fields.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removeDefectRow(index)}
                                    disabled={isSubmitting}
                                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Remove this defect"
                                  >
                                    <Trash2 className="w-5 h-5" />
                                  </button>
                                )}
                              </div>

                              {/* Defect Form Fields */}
                              <div className="p-6 space-y-5">
                                {/* Repair Category */}
                                <div className="space-y-2">
                                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                    <Tag className="w-4 h-4 text-gray-400" />
                                    Repair Category <span className="text-red-500">*</span>
                                  </label>
                                  <SingleSelectDropdown
                                    label="Repair Categories"
                                    options={categoryOptions}
                                    value={watchedDefects[index]?.category || ''}
                                    onChange={(value) => {
                                      setValue(`defects.${index}.category`, value, { shouldValidate: true });
                                      
                                      // ✅ Auto-populate Issue field with "Campaign - " when Campaign category is selected
                                      const selectedCategory = categoryOptions.find(opt => opt.value === value);
                                      if (selectedCategory?.label === 'Campaign') {
                                        setValue(`defects.${index}.notes`, 'Campaign - ', { shouldValidate: true });
                                      }
                                    }}
                                    placeholder="Select category..."
                                    error={errors.defects?.[index]?.category?.message}
                                    disabled={isSubmitting}
                                    showSelectedLabel={false}
                                  />
                                  <AnimatePresence>
                                    {errors.defects?.[index]?.category && (
                                      <motion.div
                                        initial={{ opacity: 0, y: -5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0 }}
                                        className="flex items-center gap-1.5 text-red-600 text-xs"
                                      >
                                        <AlertCircle className="w-3.5 h-3.5" />
                                        {errors.defects[index].category?.message}
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>

                                {/* Issue (Notes Field) */}
                                <div className="space-y-2">
                                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                    <StickyNote className="w-4 h-4 text-gray-400" />
                                    Issue <span className="text-red-500">*</span>
                                  </label>
                                  <textarea
                                    {...register(`defects.${index}.notes`, {
                                      required: 'Issue description is required',
                                      validate: (value) => value.trim() !== '' || 'Issue cannot be empty'
                                    })}
                                    disabled={isSubmitting}
                                    placeholder="Describe the issue in detail..."
                                    rows={3}
                                    className={`w-full px-4 py-3 bg-white border-2 rounded-xl text-sm transition-all focus:outline-none focus:ring-4 focus:ring-blue-500/20 resize-none disabled:opacity-50 disabled:cursor-not-allowed ${
                                      errors.defects?.[index]?.notes
                                        ? 'border-red-300 focus:border-red-500'
                                        : watchedDefects[index]?.notes?.trim()
                                          ? 'border-green-300 focus:border-green-500'
                                          : 'border-gray-200 focus:border-blue-500'
                                    }`}
                                  />
                                  <AnimatePresence>
                                    {errors.defects?.[index]?.notes && (
                                      <motion.div
                                        initial={{ opacity: 0, y: -5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0 }}
                                        className="flex items-center gap-1.5 text-red-600 text-xs"
                                      >
                                        <AlertCircle className="w-3.5 h-3.5" />
                                        {errors.defects[index].notes?.message}
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>

                        {/* Add Another Button */}
                        <div className="flex justify-center pt-2">
                          <button
                            type="button"
                            onClick={addDefectRow}
                            disabled={isSubmitting}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-blue-600 text-sm font-medium rounded-xl border-2 border-blue-200 hover:bg-blue-50 hover:border-blue-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Plus className="w-4 h-4" />
                            Add Another Defect
                          </button>
                        </div>

                        {/* Global Error Display */}
                        <AnimatePresence>
                          {globalErrors.length > 0 && (
                            <motion.div
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0 }}
                              className="bg-red-50 border-2 border-red-200 rounded-2xl p-6"
                            >
                              <div className="flex items-start gap-3">
                                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                  <AlertCircle className="w-5 h-5 text-red-600" />
                                </div>
                                <div className="flex-1">
                                  <h4 className="font-semibold text-red-900 mb-2">Please fix the following errors:</h4>
                                  <ul className="space-y-1.5">
                                    {globalErrors.map((error, index) => (
                                      <li key={index} className="text-sm text-red-700 flex items-start gap-2">
                                        <span className="text-red-400 mt-0.5">•</span>
                                        <span>{error}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </form>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-4 p-6 bg-white border-t-2 border-gray-100">
              <div className="text-sm text-gray-600">
                {currentStep === 1 ? (
                  <span>
                    Step 1 of 2 - {selectedVehicleIds.length > 0 
                      ? `${selectedVehicleIds.length} vehicle${selectedVehicleIds.length > 1 ? 's' : ''} selected` 
                      : 'Select vehicles'}
                  </span>
                ) : (
                  <span>
                    Step 2 of 2 - {fields.length} defect{fields.length > 1 ? 's' : ''} × {selectedVehicleIds.length} vehicle{selectedVehicleIds.length > 1 ? 's' : ''} = {fields.length * selectedVehicleIds.length} total
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                {currentStep === 1 ? (
                  <>
                    <button
                      type="button"
                      onClick={handleClose}
                      disabled={isSubmitting}
                      className="px-6 py-2.5 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleNext}
                      disabled={selectedVehicleIds.length === 0}
                      className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next: Add Defects
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleBack}
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-2 px-6 py-2.5 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmit(onSubmit)}
                      disabled={isSubmitting || fields.length === 0}
                      className="inline-flex items-center gap-2 px-8 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          Create {fields.length * selectedVehicleIds.length} Defect{fields.length * selectedVehicleIds.length > 1 ? 's' : ''}
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};