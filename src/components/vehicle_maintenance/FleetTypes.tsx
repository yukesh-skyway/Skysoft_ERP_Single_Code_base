import { useState } from 'react';
import { Plus, Edit2, Copy, Search, X, Car, ChevronLeft, ChevronRight } from 'lucide-react';

interface VehicleType {
  id: string;
  vehicleType: string;
  vehicleDesc: string;
  collectionId: string;
  collectionName: string;
  subCollectionId: string;
  subCollectionName: string;
  invoiceItem: string;
}

interface Collection {
  id: string;
  name: string;
  status: 'Active' | 'Inactive';
}

interface SubCollection {
  id: string;
  name: string;
  collectionId: string;
  status: 'Active' | 'Inactive';
}

interface BasicCost {
  year: number;
  fuelKm: string;
  wearTire: string;
  cca: string;
  insurance: string;
  driverWages: string;
  otherCost1: string;
  otherCost1Label: string;
  otherCost2: string;
  otherCost2Label: string;
  otherCost3: string;
  otherCost3Label: string;
}

interface MonthlyPricing {
  year: number;
  jan: string;
  feb: string;
  mar: string;
  apr: string;
  may: string;
  jun: string;
  jul: string;
  aug: string;
  sep: string;
  oct: string;
  nov: string;
  dec: string;
}

export function FleetTypes() {
  // Sample Collections
  const [collections] = useState<Collection[]>([
    { id: '1', name: 'School Buses', status: 'Active' },
    { id: '2', name: 'City Transit', status: 'Active' },
    { id: '3', name: 'Charter Services', status: 'Active' },
  ]);

  // Sample Sub Collections
  const [subCollections] = useState<SubCollection[]>([
    { id: '1', name: 'Elementary School', collectionId: '1', status: 'Active' },
    { id: '2', name: 'High School', collectionId: '1', status: 'Active' },
    { id: '3', name: 'Express Routes', collectionId: '2', status: 'Active' },
    { id: '4', name: 'Local Routes', collectionId: '2', status: 'Active' },
    { id: '5', name: 'Corporate Charter', collectionId: '3', status: 'Active' },
  ]);

  // Sample Vehicle Types
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([
    {
      id: '1',
      vehicleType: 'Standard School Bus',
      vehicleDesc: '40-passenger standard yellow school bus',
      collectionId: '1',
      collectionName: 'School Buses',
      subCollectionId: '1',
      subCollectionName: 'Elementary School',
      invoiceItem: 'School Bus Service',
    },
    {
      id: '2',
      vehicleType: 'Mini School Bus',
      vehicleDesc: '20-passenger mini school bus',
      collectionId: '1',
      collectionName: 'School Buses',
      subCollectionId: '1',
      subCollectionName: 'Elementary School',
      invoiceItem: 'School Bus Service',
    },
    {
      id: '3',
      vehicleType: 'Large Capacity Bus',
      vehicleDesc: '60-passenger high school bus',
      collectionId: '1',
      collectionName: 'School Buses',
      subCollectionId: '2',
      subCollectionName: 'High School',
      invoiceItem: 'School Bus Service',
    },
    {
      id: '4',
      vehicleType: 'Express Transit Bus',
      vehicleDesc: 'High-speed city express bus',
      collectionId: '2',
      collectionName: 'City Transit',
      subCollectionId: '3',
      subCollectionName: 'Express Routes',
      invoiceItem: 'Transit Service',
    },
    {
      id: '5',
      vehicleType: 'Local Transit Bus',
      vehicleDesc: 'Standard city local bus',
      collectionId: '2',
      collectionName: 'City Transit',
      subCollectionId: '4',
      subCollectionName: 'Local Routes',
      invoiceItem: 'Transit Service',
    },
  ]);

  // Filters
  const [filterCollection, setFilterCollection] = useState('');
  const [filterSubCollection, setFilterSubCollection] = useState('');
  const [filterVehicleType, setFilterVehicleType] = useState('');
  const [searchKey, setSearchKey] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'clone'>('create');
  const [activeTab, setActiveTab] = useState<'details' | 'basic' | 'pricing'>('details');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form data
  const [formData, setFormData] = useState({
    vehicleType: '',
    vehicleDesc: '',
    collectionId: '',
    subCollectionId: '',
    invoiceItem: '',
  });

  const [basicCosts, setBasicCosts] = useState<BasicCost[]>([
    {
      year: new Date().getFullYear(),
      fuelKm: '',
      wearTire: '',
      cca: '',
      insurance: '',
      driverWages: '',
      otherCost1: '',
      otherCost1Label: '',
      otherCost2: '',
      otherCost2Label: '',
      otherCost3: '',
      otherCost3Label: '',
    },
  ]);

  const [monthlyPricing, setMonthlyPricing] = useState<MonthlyPricing[]>([
    {
      year: new Date().getFullYear(),
      jan: '',
      feb: '',
      mar: '',
      apr: '',
      may: '',
      jun: '',
      jul: '',
      aug: '',
      sep: '',
      oct: '',
      nov: '',
      dec: '',
    },
  ]);

  // Get filtered sub-collections based on selected collection
  const filteredSubCollections = filterCollection
    ? subCollections.filter((sc) => sc.collectionId === filterCollection)
    : [];

  // Get filtered vehicle types based on selected sub-collection
  const filteredVehicleTypesForDropdown = filterSubCollection
    ? vehicleTypes.filter((vt) => vt.subCollectionId === filterSubCollection)
    : [];

  // Filter and paginate vehicle types
  const getFilteredVehicleTypes = () => {
    return vehicleTypes.filter((vt) => {
      const matchesCollection = !filterCollection || vt.collectionId === filterCollection;
      const matchesSubCollection = !filterSubCollection || vt.subCollectionId === filterSubCollection;
      const matchesVehicleType = !filterVehicleType || vt.id === filterVehicleType;
      const matchesSearch =
        !searchKey ||
        vt.vehicleType.toLowerCase().includes(searchKey.toLowerCase()) ||
        vt.vehicleDesc.toLowerCase().includes(searchKey.toLowerCase()) ||
        vt.collectionName.toLowerCase().includes(searchKey.toLowerCase()) ||
        vt.subCollectionName.toLowerCase().includes(searchKey.toLowerCase());

      return matchesCollection && matchesSubCollection && matchesVehicleType && matchesSearch;
    });
  };

  const filteredData = getFilteredVehicleTypes();
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, endIndex);

  const handleReset = () => {
    setFilterCollection('');
    setFilterSubCollection('');
    setFilterVehicleType('');
    setSearchKey('');
    setCurrentPage(1);
  };

  const handleFilter = () => {
    setCurrentPage(1);
  };

  const handleCreateNew = () => {
    setModalMode('create');
    setEditingId(null);
    resetForm();
    setShowModal(true);
  };

  const handleEdit = (type: VehicleType) => {
    setModalMode('edit');
    setEditingId(type.id);
    setFormData({
      vehicleType: type.vehicleType,
      vehicleDesc: type.vehicleDesc,
      collectionId: type.collectionId,
      subCollectionId: type.subCollectionId,
      invoiceItem: type.invoiceItem,
    });
    setShowModal(true);
  };

  const handleClone = (type: VehicleType) => {
    setModalMode('clone');
    setEditingId(type.id);
    setFormData({
      vehicleType: type.vehicleType + ' (Copy)',
      vehicleDesc: type.vehicleDesc,
      collectionId: type.collectionId,
      subCollectionId: type.subCollectionId,
      invoiceItem: type.invoiceItem,
    });
    setShowModal(true);
  };

  const handleSave = () => {
    if (!formData.vehicleType || !formData.vehicleDesc || !formData.collectionId || !formData.subCollectionId) {
      alert('Please fill in all required fields');
      return;
    }

    const collection = collections.find((c) => c.id === formData.collectionId);
    const subCollection = subCollections.find((sc) => sc.id === formData.subCollectionId);

    if (modalMode === 'edit' && editingId) {
      setVehicleTypes(
        vehicleTypes.map((vt) =>
          vt.id === editingId
            ? {
                ...vt,
                ...formData,
                collectionName: collection?.name || '',
                subCollectionName: subCollection?.name || '',
              }
            : vt
        )
      );
    } else {
      const newType: VehicleType = {
        id: Date.now().toString(),
        ...formData,
        collectionName: collection?.name || '',
        subCollectionName: subCollection?.name || '',
      };
      setVehicleTypes([...vehicleTypes, newType]);
    }

    setShowModal(false);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      vehicleType: '',
      vehicleDesc: '',
      collectionId: '',
      subCollectionId: '',
      invoiceItem: '',
    });
    setBasicCosts([
      {
        year: new Date().getFullYear(),
        fuelKm: '',
        wearTire: '',
        cca: '',
        insurance: '',
        driverWages: '',
        otherCost1: '',
        otherCost1Label: '',
        otherCost2: '',
        otherCost2Label: '',
        otherCost3: '',
        otherCost3Label: '',
      },
    ]);
    setMonthlyPricing([
      {
        year: new Date().getFullYear(),
        jan: '',
        feb: '',
        mar: '',
        apr: '',
        may: '',
        jun: '',
        jul: '',
        aug: '',
        sep: '',
        oct: '',
        nov: '',
        dec: '',
      },
    ]);
    setActiveTab('details');
  };

  const addBasicCostYear = () => {
    const lastYear = basicCosts[basicCosts.length - 1]?.year || new Date().getFullYear();
    setBasicCosts([
      ...basicCosts,
      {
        year: lastYear + 1,
        fuelKm: '',
        wearTire: '',
        cca: '',
        insurance: '',
        driverWages: '',
        otherCost1: '',
        otherCost1Label: '',
        otherCost2: '',
        otherCost2Label: '',
        otherCost3: '',
        otherCost3Label: '',
      },
    ]);
  };

  const addPricingYear = () => {
    const lastYear = monthlyPricing[monthlyPricing.length - 1]?.year || new Date().getFullYear();
    setMonthlyPricing([
      ...monthlyPricing,
      {
        year: lastYear + 1,
        jan: '',
        feb: '',
        mar: '',
        apr: '',
        may: '',
        jun: '',
        jul: '',
        aug: '',
        sep: '',
        oct: '',
        nov: '',
        dec: '',
      },
    ]);
  };

  // Get sub-collections for form based on selected collection
  const formSubCollections = formData.collectionId
    ? subCollections.filter((sc) => sc.collectionId === formData.collectionId)
    : [];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl text-gray-900 mb-1">Fleet Types</h1>
          <p className="text-sm sm:text-base text-gray-600">Configure and manage vehicle types</p>
        </div>
      </div>

      {/* Filters Card */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
        <h3 className="text-base text-gray-900 mb-4">Filters</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-4">
          {/* Vehicle Collection */}
          <div>
            <label className="text-sm text-gray-600 mb-2 block">Vehicle Collection</label>
            <select
              value={filterCollection}
              onChange={(e) => {
                setFilterCollection(e.target.value);
                setFilterSubCollection('');
                setFilterVehicleType('');
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">Select</option>
              {collections.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.name}
                </option>
              ))}
            </select>
          </div>

          {/* Vehicle Sub Collection */}
          <div>
            <label className="text-sm text-gray-600 mb-2 block">Vehicle Sub Collection</label>
            <select
              value={filterSubCollection}
              onChange={(e) => {
                setFilterSubCollection(e.target.value);
                setFilterVehicleType('');
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              disabled={!filterCollection}
            >
              <option value="">Select vehicle sub collection</option>
              {filteredSubCollections.map((subCol) => (
                <option key={subCol.id} value={subCol.id}>
                  {subCol.name}
                </option>
              ))}
            </select>
          </div>

          {/* Vehicle Type */}
          <div>
            <label className="text-sm text-gray-600 mb-2 block">Vehicle Type</label>
            <select
              value={filterVehicleType}
              onChange={(e) => setFilterVehicleType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              disabled={!filterSubCollection}
            >
              <option value="">Select Vehicle Type</option>
              {filteredVehicleTypesForDropdown.map((vt) => (
                <option key={vt.id} value={vt.id}>
                  {vt.vehicleType}
                </option>
              ))}
            </select>
          </div>

          {/* Search Key */}
          <div>
            <label className="text-sm text-gray-600 mb-2 block">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchKey}
                onChange={(e) => setSearchKey(e.target.value)}
                placeholder="Search..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>

          {/* Filter Buttons */}
          <div className="flex items-end gap-2">
            <button
              onClick={handleFilter}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              Filter
            </button>
            <button
              onClick={handleReset}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Results Card */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {/* Header with count and create button */}
        <div className="p-4 sm:p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="text-sm text-gray-600">
              Showing {startIndex + 1} to {Math.min(endIndex, filteredData.length)} of {filteredData.length}{' '}
              vehicle type(s)
            </div>
            <button
              onClick={handleCreateNew}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              <Plus className="w-4 h-4" />
              Create Vehicle Type
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 sm:px-6 py-3 text-left text-xs text-gray-600">Vehicle Type</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs text-gray-600">Vehicle Collection</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs text-gray-600">Vehicle Sub Collection</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedData.length > 0 ? (
                paginatedData.map((type) => (
                  <tr key={type.id} className="hover:bg-gray-50">
                    <td className="px-4 sm:px-6 py-4">
                      <button
                        onClick={() => handleEdit(type)}
                        className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {type.vehicleType}
                      </button>
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-sm text-gray-900">{type.collectionName}</td>
                    <td className="px-4 sm:px-6 py-4 text-sm text-gray-900">{type.subCollectionName}</td>
                    <td className="px-4 sm:px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(type)}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs text-blue-600 bg-blue-50 rounded hover:bg-blue-100"
                        >
                          <Edit2 className="w-3 h-3" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleClone(type)}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs text-blue-600 bg-blue-50 rounded hover:bg-blue-100"
                        >
                          <Copy className="w-3 h-3" />
                          Clone Vehicle Type
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 sm:px-6 py-8 text-center text-sm text-gray-500">
                    No vehicle types found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 sm:p-6 border-t border-gray-200">
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-1 px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
                Prev
              </button>
              <span className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="flex items-center gap-1 px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
              <h2 className="text-lg sm:text-xl text-gray-900">
                {modalMode === 'create' && 'Create Vehicle Type'}
                {modalMode === 'edit' && 'Edit Vehicle Type'}
                {modalMode === 'clone' && 'Clone Vehicle Type'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 px-4 sm:px-6">
              <div className="flex gap-4 overflow-x-auto">
                <button
                  onClick={() => setActiveTab('details')}
                  className={`px-4 py-3 text-sm border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === 'details'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Vehicle Type Details
                </button>
                <button
                  onClick={() => setActiveTab('basic')}
                  className={`px-4 py-3 text-sm border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === 'basic'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Basic Cost Configuration
                </button>
                <button
                  onClick={() => setActiveTab('pricing')}
                  className={`px-4 py-3 text-sm border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === 'pricing'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Cost/Margin Based Pricing
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {/* Tab 1: Vehicle Type Details */}
              {activeTab === 'details' && (
                <div className="space-y-4">
                  <h3 className="text-base text-gray-900 mb-4">Vehicle Type Details</h3>

                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="text-sm text-gray-600 mb-2 block">
                        Vehicle Collection <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.collectionId}
                        onChange={(e) =>
                          setFormData({ ...formData, collectionId: e.target.value, subCollectionId: '' })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="">Select vehicle collection</option>
                        {collections.map((col) => (
                          <option key={col.id} value={col.id}>
                            {col.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-sm text-gray-600 mb-2 block">
                        Vehicle Sub Collection <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.subCollectionId}
                        onChange={(e) => setFormData({ ...formData, subCollectionId: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={!formData.collectionId}
                        required
                      >
                        <option value="">Select vehicle sub collection</option>
                        {formSubCollections.map((subCol) => (
                          <option key={subCol.id} value={subCol.id}>
                            {subCol.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-sm text-gray-600 mb-2 block">
                        Vehicle Type <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.vehicleType}
                        onChange={(e) => setFormData({ ...formData, vehicleType: e.target.value })}
                        placeholder="Enter a nick name"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-sm text-gray-600 mb-2 block">
                        Description <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.vehicleDesc}
                        onChange={(e) => setFormData({ ...formData, vehicleDesc: e.target.value })}
                        placeholder="Enter description about this type of vehicles"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-sm text-gray-600 mb-2 block">
                        Invoice Item <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.invoiceItem}
                        onChange={(e) => setFormData({ ...formData, invoiceItem: e.target.value })}
                        placeholder="Type to select existing Invoice name Eg. Canadian Contract"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Basic Cost Configuration */}
              {activeTab === 'basic' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base text-gray-900">Basic Cost Configuration</h3>
                    <button
                      onClick={addBasicCostYear}
                      className="px-3 py-1.5 text-sm bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
                    >
                      Add Next Year Basic Cost Pricing
                    </button>
                  </div>

                  <div className="space-y-6">
                    {basicCosts.map((cost, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4">
                        <div className="mb-4">
                          <label className="text-sm text-gray-600 mb-2 block">
                            Select Year Applicable <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            value={cost.year}
                            onChange={(e) => {
                              const newCosts = [...basicCosts];
                              newCosts[index].year = parseInt(e.target.value);
                              setBasicCosts(newCosts);
                            }}
                            placeholder={new Date().getFullYear().toString()}
                            className="w-full sm:w-48 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div className="space-y-3">
                          {/* Fuel (KM) */}
                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                            <label className="text-sm text-gray-600 sm:col-span-3">
                              Fuel (KM) <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value="Fuel (KM)"
                              readOnly
                              className="sm:col-span-2 px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm"
                            />
                            <select className="sm:col-span-2 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                              <option value="">--Pricing Type</option>
                              <option value="per_km">Per KM</option>
                              <option value="fixed">Fixed</option>
                            </select>
                            <input
                              type="number"
                              step="0.01"
                              value={cost.fuelKm}
                              onChange={(e) => {
                                const newCosts = [...basicCosts];
                                newCosts[index].fuelKm = e.target.value;
                                setBasicCosts(newCosts);
                              }}
                              placeholder="E.g. 0.01"
                              className="sm:col-span-5 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            />
                          </div>

                          {/* Wear Tire */}
                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                            <label className="text-sm text-gray-600 sm:col-span-3">
                              Wear Tire <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value="Wear Tire"
                              readOnly
                              className="sm:col-span-2 px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm"
                            />
                            <select className="sm:col-span-2 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                              <option value="">--Pricing Type</option>
                              <option value="per_km">Per KM</option>
                              <option value="fixed">Fixed</option>
                            </select>
                            <input
                              type="number"
                              step="0.01"
                              value={cost.wearTire}
                              onChange={(e) => {
                                const newCosts = [...basicCosts];
                                newCosts[index].wearTire = e.target.value;
                                setBasicCosts(newCosts);
                              }}
                              placeholder="E.g. 0.01"
                              className="sm:col-span-5 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            />
                          </div>

                          {/* CCA */}
                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                            <label className="text-sm text-gray-600 sm:col-span-3">
                              CCA <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value="CCA"
                              readOnly
                              className="sm:col-span-2 px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm"
                            />
                            <select className="sm:col-span-2 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                              <option value="">--Pricing Type</option>
                              <option value="per_km">Per KM</option>
                              <option value="fixed">Fixed</option>
                            </select>
                            <input
                              type="number"
                              step="0.01"
                              value={cost.cca}
                              onChange={(e) => {
                                const newCosts = [...basicCosts];
                                newCosts[index].cca = e.target.value;
                                setBasicCosts(newCosts);
                              }}
                              placeholder="E.g. 0.01"
                              className="sm:col-span-5 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            />
                          </div>

                          {/* Insurance */}
                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                            <label className="text-sm text-gray-600 sm:col-span-3">
                              Insurance <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value="Insurance"
                              readOnly
                              className="sm:col-span-2 px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm"
                            />
                            <select className="sm:col-span-2 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                              <option value="">--Pricing Type</option>
                              <option value="per_km">Per KM</option>
                              <option value="fixed">Fixed</option>
                            </select>
                            <input
                              type="number"
                              step="0.01"
                              value={cost.insurance}
                              onChange={(e) => {
                                const newCosts = [...basicCosts];
                                newCosts[index].insurance = e.target.value;
                                setBasicCosts(newCosts);
                              }}
                              placeholder="E.g. 0.01"
                              className="sm:col-span-5 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            />
                          </div>

                          {/* Driver Wages */}
                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                            <label className="text-sm text-gray-600 sm:col-span-3">
                              Driver Wages <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value="Driver Wages"
                              readOnly
                              className="sm:col-span-2 px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm"
                            />
                            <select className="sm:col-span-2 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                              <option value="">--Pricing Type</option>
                              <option value="per_km">Per KM</option>
                              <option value="fixed">Fixed</option>
                            </select>
                            <input
                              type="number"
                              step="0.01"
                              value={cost.driverWages}
                              onChange={(e) => {
                                const newCosts = [...basicCosts];
                                newCosts[index].driverWages = e.target.value;
                                setBasicCosts(newCosts);
                              }}
                              placeholder="E.g. 0.01"
                              className="sm:col-span-5 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            />
                          </div>

                          {/* Other Cost 1 */}
                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                            <label className="text-sm text-gray-600 sm:col-span-3">Other Cost 1</label>
                            <input
                              type="text"
                              value={cost.otherCost1Label}
                              onChange={(e) => {
                                const newCosts = [...basicCosts];
                                newCosts[index].otherCost1Label = e.target.value;
                                setBasicCosts(newCosts);
                              }}
                              placeholder="Custom Label"
                              className="sm:col-span-2 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            />
                            <select className="sm:col-span-2 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                              <option value="">--Pricing Type</option>
                              <option value="per_km">Per KM</option>
                              <option value="fixed">Fixed</option>
                            </select>
                            <input
                              type="number"
                              step="0.01"
                              value={cost.otherCost1}
                              onChange={(e) => {
                                const newCosts = [...basicCosts];
                                newCosts[index].otherCost1 = e.target.value;
                                setBasicCosts(newCosts);
                              }}
                              placeholder="E.g. 0.01"
                              className="sm:col-span-5 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab 3: Monthly Pricing */}
              {activeTab === 'pricing' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base text-gray-900">Cost/Margin Based Pricing Option</h3>
                    <button
                      onClick={addPricingYear}
                      className="px-3 py-1.5 text-sm bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
                    >
                      Add Next Year Pricing
                    </button>
                  </div>

                  <div className="space-y-6">
                    {monthlyPricing.map((pricing, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4">
                        <div className="mb-4">
                          <label className="text-sm text-gray-600 mb-2 block">
                            Select Year Applicable <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            value={pricing.year}
                            onChange={(e) => {
                              const newPricing = [...monthlyPricing];
                              newPricing[index].year = parseInt(e.target.value);
                              setMonthlyPricing(newPricing);
                            }}
                            placeholder={new Date().getFullYear().toString()}
                            className="w-full sm:w-48 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse border border-gray-200 text-sm">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="border border-gray-200 px-3 py-2 text-left text-xs text-gray-600">
                                  Variable Type
                                </th>
                                <th className="border border-gray-200 px-3 py-2 text-left text-xs text-gray-600">
                                  Jan
                                </th>
                                <th className="border border-gray-200 px-3 py-2 text-left text-xs text-gray-600">
                                  Feb
                                </th>
                                <th className="border border-gray-200 px-3 py-2 text-left text-xs text-gray-600">
                                  Mar
                                </th>
                                <th className="border border-gray-200 px-3 py-2 text-left text-xs text-gray-600">
                                  Apr
                                </th>
                                <th className="border border-gray-200 px-3 py-2 text-left text-xs text-gray-600">
                                  May
                                </th>
                                <th className="border border-gray-200 px-3 py-2 text-left text-xs text-gray-600">
                                  Jun
                                </th>
                                <th className="border border-gray-200 px-3 py-2 text-left text-xs text-gray-600">
                                  Jul
                                </th>
                                <th className="border border-gray-200 px-3 py-2 text-left text-xs text-gray-600">
                                  Aug
                                </th>
                                <th className="border border-gray-200 px-3 py-2 text-left text-xs text-gray-600">
                                  Sep
                                </th>
                                <th className="border border-gray-200 px-3 py-2 text-left text-xs text-gray-600">
                                  Oct
                                </th>
                                <th className="border border-gray-200 px-3 py-2 text-left text-xs text-gray-600">
                                  Nov
                                </th>
                                <th className="border border-gray-200 px-3 py-2 text-left text-xs text-gray-600">
                                  Dec
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td className="border border-gray-200 px-3 py-2 text-xs text-gray-900">
                                  Monthly Rate
                                </td>
                                {['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].map(
                                  (month) => (
                                    <td key={month} className="border border-gray-200 p-1">
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={pricing[month as keyof MonthlyPricing]}
                                        onChange={(e) => {
                                          const newPricing = [...monthlyPricing];
                                          newPricing[index] = {
                                            ...newPricing[index],
                                            [month]: e.target.value,
                                          };
                                          setMonthlyPricing(newPricing);
                                        }}
                                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                                      />
                                    </td>
                                  )
                                )}
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-6 border-t border-gray-200 flex flex-col sm:flex-row gap-2 sm:justify-end">
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                Save Vehicle Type
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
