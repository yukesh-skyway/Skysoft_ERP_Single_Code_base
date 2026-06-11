import { useState, useEffect } from 'react';
import { 
  Plus, Edit,Building, Search, X, Save, RefreshCw, AlertCircle, CheckCircle, 
  Store, Filter, ChevronLeft, ChevronRight, Mail, Phone, MapPin, FileText, Wrench
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { buildApiUrl, API_ENDPOINTS } from '../../config/api';

interface Vendor {
  id: number;
  vendor_name: string;
  vendor_address: string;
  vendor_phone: string;
  vendor_email: string;
  vendor_notes: string;
  status: number;
  garage_url: string | null;
}

type ModalMode = 'create' | 'edit' | null;

export function ManageVendors() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [filteredVendors, setFilteredVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchKey, setSearchKey] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [emailError, setEmailError] = useState<string>('');
  
  // Form state
  const [formData, setFormData] = useState({
    vendor_name: '',
    vendor_address: '',
    vendor_phone: '',
    vendor_email: '',
    vendor_notes: '',
    status: 1
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Email validation function
  const validateEmail = (email: string): boolean => {
    if (!email.trim()) return true; // Empty email is valid (optional field)
    
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email.trim());
  };

  // Handle email change with validation
  const handleEmailChange = (email: string) => {
    setFormData({ ...formData, vendor_email: email });
    
    if (email.trim() && !validateEmail(email)) {
      setEmailError('Please enter a valid email address');
    } else {
      setEmailError('');
    }
  };

  // Fetch vendors
  const fetchVendors = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter === 'active' ? '1' : '0');
      }
      if (searchKey.trim()) {
        params.append('key', searchKey.trim());
      }

      const url = `${buildApiUrl(API_ENDPOINTS.vendors.base)}${params.toString() ? '?' + params.toString() : ''}`;
      
      const response = await fetch(url, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      const data = await response.json();
      
      if (data.success) {
        setVendors(data.data || []);
        setFilteredVendors(data.data || []);
      } else {
        toast.error('Failed to load vendors');
      }
    } catch (error) {
      console.error('Error fetching vendors:', error);
      toast.error('Failed to load vendors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, [statusFilter, searchKey]);

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredVendors.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredVendors.length / itemsPerPage);

  // Handle create/edit modal
  const handleOpenModal = (mode: 'create' | 'edit', vendor?: Vendor) => {
    setModalMode(mode);
    setEmailError(''); // Reset email error
    if (mode === 'edit' && vendor) {
      setSelectedVendor(vendor);
      setFormData({
        vendor_name: vendor.vendor_name,
        vendor_address: vendor.vendor_address || '',
        vendor_phone: vendor.vendor_phone || '',
        vendor_email: vendor.vendor_email || '',
        vendor_notes: vendor.vendor_notes || '',
        status: vendor.status
      });
    } else {
      setFormData({
        vendor_name: '',
        vendor_address: '',
        vendor_phone: '',
        vendor_email: '',
        vendor_notes: '',
        status: 1
      });
    }
  };

  const handleCloseModal = () => {
    setModalMode(null);
    setSelectedVendor(null);
    setFormData({
      vendor_name: '',
      vendor_address: '',
      vendor_phone: '',
      vendor_email: '',
      vendor_notes: '',
      status: 1
    });
    setEmailError('');
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.vendor_name.trim()) {
      toast.error('Vendor name is required');
      return;
    }

    if (emailError) {
      toast.error(emailError);
      return;
    }

    // Check for duplicate vendor name
    const duplicateVendor = vendors.find(v => 
      v.vendor_name.toLowerCase().trim() === formData.vendor_name.toLowerCase().trim() &&
      (modalMode === 'create' || v.id !== selectedVendor?.id)
    );

    if (duplicateVendor) {
      toast.error(`A vendor with the name "${formData.vendor_name}" already exists. Please use a different name.`);
      return;
    }

    setSubmitting(true);

    try {
      const url = modalMode === 'create'
        ? buildApiUrl(API_ENDPOINTS.vendors.base)
        : buildApiUrl(API_ENDPOINTS.vendors.update(selectedVendor!.id));

      const response = await fetch(url, {
        method: modalMode === 'create' ? 'POST' : 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        toast.success(data.message || `Vendor ${modalMode === 'create' ? 'created' : 'updated'} successfully`);
        handleCloseModal();
        fetchVendors();
      } else {
        toast.error(data.error || `Failed to ${modalMode} vendor`);
      }
    } catch (error) {
      console.error(`Error ${modalMode}ing vendor:`, error);
      toast.error(`Failed to ${modalMode} vendor`);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchVendors();
  };

  const clearFilters = () => {
    setSearchKey('');
    setStatusFilter('all');
    setCurrentPage(1);
  };

return (
  <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
<div className="max-w-[1700px] mx-auto">

      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

          {/* Left Section */}
          <div>
            <h1 className="text-2xl text-gray-900 flex items-center gap-3">
              <Building className="w-7 h-7 text-blue-600" />
              Manage Vendors
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Manage vendor information for repair orders and external services
            </p>
          </div>

          {/* Right Button */}
          <button
            onClick={() => handleOpenModal('create')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Vendor
          </button>

        </div>
      </div>
          </div>
  
      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <form onSubmit={handleSearch} className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm text-gray-700 mb-1.5">
              Search Key
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchKey}
                onChange={(e) => setSearchKey(e.target.value)}
                placeholder="Search by name, email, phone, or address..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent"
              />
            </div>
          </div>

          <div className="w-48">
            <label className="block text-sm text-gray-700 mb-1.5">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="px-4 py-2 bg-[#2563eb] text-white rounded-lg hover:bg-[#1d4ed8] transition-colors flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              Filter
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Clear
            </button>
            <button
              type="button"
              onClick={fetchVendors}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 text-[#2563eb] animate-spin" />
          </div>
        ) : currentItems.length === 0 ? (
          <div className="text-center py-12">
            <Store className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">No vendors found</p>
            <p className="text-sm text-gray-500 mt-1">
              {searchKey || statusFilter !== 'all' 
                ? 'Try adjusting your filters' 
                : 'Create your first vendor to get started'}
            </p>
          </div>
        ) : (
          <>
            <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
              <p className="text-sm text-gray-600">
                Showing <span className="font-medium">{indexOfFirstItem + 1}</span> to{' '}
                <span className="font-medium">{Math.min(indexOfLastItem, filteredVendors.length)}</span> of{' '}
                <span className="font-medium">{filteredVendors.length}</span> vendor(s)
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs text-gray-700 uppercase tracking-wider">
                      Vendor Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs text-gray-700 uppercase tracking-wider">
                      Address
                    </th>
                    <th className="px-6 py-3 text-left text-xs text-gray-700 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs text-gray-700 uppercase tracking-wider">
                      Phone
                    </th>
                    <th className="px-6 py-3 text-left text-xs text-gray-700 uppercase tracking-wider">
  Garage
</th>
                    <th className="px-6 py-3 text-left text-xs text-gray-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs text-gray-700 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentItems.map((vendor) => (
                    <tr key={vendor.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Store className="w-4 h-4 text-[#2563eb]" />
                          <span className="text-sm text-gray-900">{vendor.vendor_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-start gap-2">
                          {vendor.vendor_address ? (
                            <>
                              <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                              <span className="text-sm text-gray-600">{vendor.vendor_address}</span>
                            </>
                          ) : (
                            <span className="text-sm text-gray-400">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {vendor.vendor_email ? (
                            <>
                              <Mail className="w-4 h-4 text-gray-400" />
                              <span className="text-sm text-gray-600">{vendor.vendor_email}</span>
                            </>
                          ) : (
                            <span className="text-sm text-gray-400">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {vendor.vendor_phone ? (
                            <>
                              <Phone className="w-4 h-4 text-gray-400" />
                              <span className="text-sm text-gray-600">{vendor.vendor_phone}</span>
                            </>
                          ) : (
                            <span className="text-sm text-gray-400">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
  {vendor.garage_url ? (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 text-xs rounded-full">
      <Wrench className="w-3 h-3" />
      Connected
    </span>
  ) : (
    <span className="text-sm text-gray-400">—</span>
  )}
</td>
                      <td className="px-6 py-4">
                        {vendor.status === 1 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 text-xs rounded-full">
                            <CheckCircle className="w-3 h-3" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                            <X className="w-3 h-3" />
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleOpenModal('edit', vendor)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#2563eb] text-white text-sm rounded hover:bg-[#1d4ed8] transition-colors"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    Page {currentPage} of {totalPages}
                  </span>
                </div>

                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create/Edit Modal */}
      {modalMode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg text-gray-900">
                {modalMode === 'create' ? 'Create Vendor' : `Update ${selectedVendor?.vendor_name}`}
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-5">
                {/* Vendor Name */}
                <div>
                  <label className="block text-sm text-gray-700 mb-1.5">
                    Vendor Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.vendor_name}
                    onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
                    placeholder="Enter vendor name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent"
                  />
                </div>

                {/* Address */}
                <div>
                  <label className="block text-sm text-gray-700 mb-1.5">
                    Address
                  </label>
                  <textarea
                    value={formData.vendor_address}
                    onChange={(e) => setFormData({ ...formData, vendor_address: e.target.value })}
                    placeholder="Enter address"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent resize-none"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm text-gray-700 mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.vendor_email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    placeholder="Enter email address"
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                      emailError
                        ? 'border-red-500 focus:ring-red-500 focus:border-transparent'
                        : 'border-gray-300 focus:ring-[#2563eb] focus:border-transparent'
                    }`}
                  />
                  {emailError && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                      <p className="text-sm text-red-500">{emailError}</p>
                    </div>
                  )}
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm text-gray-700 mb-1.5">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={formData.vendor_phone}
                    onChange={(e) => setFormData({ ...formData, vendor_phone: e.target.value })}
                    placeholder="Enter phone number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm text-gray-700 mb-1.5">
                    Notes
                  </label>
                  <textarea
                    value={formData.vendor_notes}
                    onChange={(e) => setFormData({ ...formData, vendor_notes: e.target.value })}
                    placeholder="Enter any additional notes"
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent resize-none"
                  />
                </div>

                {/* Status (Edit mode only) */}
                {modalMode === 'edit' && (
                  <div>
                    <label className="block text-sm text-gray-700 mb-1.5">
                      Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent"
                    >
                      <option value={1}>Active</option>
                      <option value={0}>Inactive</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="mt-6 pt-4 border-t border-gray-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-4 py-2 bg-[#2563eb] text-white rounded-lg hover:bg-[#1d4ed8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {modalMode === 'create' ? 'Create Vendor' : 'Update Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}