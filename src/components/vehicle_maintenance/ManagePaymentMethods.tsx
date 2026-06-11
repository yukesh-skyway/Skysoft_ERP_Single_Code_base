import { useState, useEffect } from 'react';
import { 
  Plus, Edit, Search, X, Save, RefreshCw, AlertCircle, CheckCircle, 
  CreditCard, DollarSign, Filter, ArrowUpDown, ChevronLeft, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { buildApiUrl, API_ENDPOINTS } from '../../config/api';

interface PaymentMethod {
  id: number;
  payment_method: string;
  status: number;
}

type ModalMode = 'create' | 'edit' | null;

export function ManagePaymentMethods() {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [filteredMethods, setFilteredMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    payment_method: '',
    status: 1
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Fetch payment methods
  const fetchPaymentMethods = async () => {
    setLoading(true);
    try {
      const response = await fetch(buildApiUrl(API_ENDPOINTS.paymentMethods.base), {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      const data = await response.json();
      
      if (data.success) {
        setPaymentMethods(data.data || []);
        setFilteredMethods(data.data || []);
      } else {
        toast.error('Failed to load payment methods');
      }
    } catch (error) {
      console.error('Error fetching payment methods:', error);
      toast.error('Failed to load payment methods');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPaymentMethods();
  }, []);

  // Filter payment methods
  useEffect(() => {
    let filtered = [...paymentMethods];

    // Search filter
    if (searchTerm.trim()) {
      filtered = filtered.filter(method =>
        method.payment_method.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      const status = statusFilter === 'active' ? 1 : 0;
      filtered = filtered.filter(method => method.status === status);
    }

    setFilteredMethods(filtered);
    setCurrentPage(1);
  }, [searchTerm, statusFilter, paymentMethods]);

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredMethods.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredMethods.length / itemsPerPage);

  // Handle create/edit modal
  const handleOpenModal = (mode: 'create' | 'edit', method?: PaymentMethod) => {
    setModalMode(mode);
    if (mode === 'edit' && method) {
      setSelectedMethod(method);
      setFormData({
        payment_method: method.payment_method,
        status: method.status
      });
    } else {
      setSelectedMethod(null);
      setFormData({
        payment_method: '',
        status: 1
      });
    }
  };

  const handleCloseModal = () => {
    setModalMode(null);
    setSelectedMethod(null);
    setFormData({
      payment_method: '',
      status: 1
    });
  };

  // Handle submit (create or update)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.payment_method.trim()) {
      toast.error('Please enter a payment method name');
      return;
    }

    // Check for duplicate payment method name
    const duplicateMethod = paymentMethods.find(method => 
      method.payment_method.toLowerCase().trim() === formData.payment_method.toLowerCase().trim() &&
      (modalMode === 'create' || method.id !== selectedMethod?.id)
    );

    if (duplicateMethod) {
      toast.error(`A payment method with the name "${formData.payment_method}" already exists. Please use a different name.`);
      return;
    }

    setSubmitting(true);

    try {
      const url = modalMode === 'edit' && selectedMethod
        ? buildApiUrl(API_ENDPOINTS.paymentMethods.byId(selectedMethod.id))
        : buildApiUrl(API_ENDPOINTS.paymentMethods.base);

      const method = modalMode === 'edit' ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({
          txtName: formData.payment_method,
          txtStatus: formData.status
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success(data.message || `Payment method ${modalMode === 'edit' ? 'updated' : 'created'} successfully`);
        fetchPaymentMethods();
        handleCloseModal();
      } else {
        toast.error(data.message || `Failed to ${modalMode} payment method`);
      }
    } catch (error) {
      console.error(`Error ${modalMode}ing payment method:`, error);
      toast.error(`Failed to ${modalMode} payment method`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-[1700px] mx-auto w-full">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl text-gray-900 flex items-center gap-3">
                <CreditCard className="w-7 h-7 text-blue-600" />
                Manage Payment Methods
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Create and manage payment methods for repair orders
              </p>
            </div>
            <button
              onClick={() => handleOpenModal('create')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Payment Method
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search payment methods..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            {/* Status Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm appearance-none bg-white"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* Results count */}
          <div className="mt-3 text-sm text-gray-600">
            Showing {currentItems.length} of {filteredMethods.length} payment method(s)
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="text-center py-12">
              <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
              <p className="text-gray-600">Loading payment methods...</p>
            </div>
          ) : currentItems.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">No payment methods found</p>
              <button
                onClick={() => handleOpenModal('create')}
                className="mt-4 text-blue-600 hover:text-blue-700 text-sm"
              >
                Create your first payment method
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs text-gray-700">
                        Payment Method
                      </th>
                      <th className="px-6 py-3 text-left text-xs text-gray-700">
                        Status
                      </th>
                      <th className="px-6 py-3 text-center text-xs text-gray-700">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {currentItems.map((method) => (
                      <tr key={method.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-900">{method.payment_method}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {method.status === 1 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                              <CheckCircle className="w-3 h-3" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                              <AlertCircle className="w-3 h-3" />
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => handleOpenModal('edit', method)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                          >
                            <Edit className="w-3 h-3" />
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
                <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Page {currentPage} of {totalPages}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {modalMode && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={handleCloseModal}
          />
          
          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg text-gray-900">
                  {modalMode === 'create' ? 'Create Payment Method' : 'Edit Payment Method'}
                </h2>
                <button
                  onClick={handleCloseModal}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="p-6">
                <div className="space-y-4">
                  {/* Payment Method Name */}
                  <div>
                    <label className="block text-sm text-gray-700 mb-2">
                      Payment Method Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.payment_method}
                      onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                      placeholder="e.g., Cash, Credit Card, Bank Transfer"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>

                  {/* Status */}
                  {modalMode === 'edit' && (
                    <div>
                      <label className="block text-sm text-gray-700 mb-2">
                        Status <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      >
                        <option value={1}>Active</option>
                        <option value={0}>Inactive</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    disabled={submitting}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        {modalMode === 'create' ? 'Creating...' : 'Updating...'}
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        {modalMode === 'create' ? 'Create' : 'Update'}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}