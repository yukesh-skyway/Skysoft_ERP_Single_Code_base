import { useState } from 'react';
import { Plus, Edit2, Trash2, Save, X, Grid3x3 } from 'lucide-react';

interface SubCollection {
  id: string;
  name: string;
  parentCollection: string;
  description: string;
  status: 'Active' | 'Inactive';
  vehicleCount: number;
}

export function FleetSubCollection() {
  const [subCollections, setSubCollections] = useState<SubCollection[]>([
    {
      id: '1',
      name: 'Route 101 Buses',
      parentCollection: 'City Bus Fleet',
      description: 'Buses assigned to Route 101',
      status: 'Active',
      vehicleCount: 12,
    },
    {
      id: '2',
      name: 'Route 202 Buses',
      parentCollection: 'City Bus Fleet',
      description: 'Buses assigned to Route 202',
      status: 'Active',
      vehicleCount: 10,
    },
    {
      id: '3',
      name: 'Express Service',
      parentCollection: 'Intercity Bus Fleet',
      description: 'Express intercity service buses',
      status: 'Active',
      vehicleCount: 15,
    },
    {
      id: '4',
      name: 'Standard Service',
      parentCollection: 'Intercity Bus Fleet',
      description: 'Standard intercity service buses',
      status: 'Active',
      vehicleCount: 13,
    },
  ]);

  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    parentCollection: 'City Bus Fleet',
    description: '',
    status: 'Active' as 'Active' | 'Inactive',
  });

  const parentCollections = ['City Bus Fleet', 'Intercity Bus Fleet', 'School Bus Fleet'];

  const handleSave = () => {
    if (formData.name) {
      if (isEditing && editingId) {
        setSubCollections(
          subCollections.map((subCollection) =>
            subCollection.id === editingId ? { ...subCollection, ...formData } : subCollection
          )
        );
      } else {
        const newSubCollection: SubCollection = {
          id: Date.now().toString(),
          ...formData,
          vehicleCount: 0,
        };
        setSubCollections([...subCollections, newSubCollection]);
      }
      resetForm();
    }
  };

  const handleEdit = (subCollection: SubCollection) => {
    setIsEditing(true);
    setEditingId(subCollection.id);
    setFormData({
      name: subCollection.name,
      parentCollection: subCollection.parentCollection,
      description: subCollection.description,
      status: subCollection.status,
    });
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this sub-collection?')) {
      setSubCollections(subCollections.filter((subCollection) => subCollection.id !== id));
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      parentCollection: 'City Bus Fleet',
      description: '',
      status: 'Active',
    });
    setIsEditing(false);
    setEditingId(null);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl text-gray-900 mb-1">Fleet Sub Collection</h1>
        <p className="text-sm sm:text-base text-gray-600">Manage fleet sub-collections within parent collections</p>
      </div>

      {/* Form Card */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
        <h2 className="text-base sm:text-lg text-gray-900 mb-4">
          {isEditing ? 'Edit Sub-Collection' : 'Add New Sub-Collection'}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-sm text-gray-600 mb-2 block">Sub-Collection Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Route 101 Buses"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-sm text-gray-600 mb-2 block">Parent Collection *</label>
            <select
              value={formData.parentCollection}
              onChange={(e) => setFormData({ ...formData, parentCollection: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {parentCollections.map((collection) => (
                <option key={collection} value={collection}>
                  {collection}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm text-gray-600 mb-2 block">Status</label>
            <select
              value={formData.status}
              onChange={(e) =>
                setFormData({ ...formData, status: e.target.value as 'Active' | 'Inactive' })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="text-sm text-gray-600 mb-2 block">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Description of the sub-collection..."
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={handleSave}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Save className="w-4 h-4" />
            {isEditing ? 'Update' : 'Save'}
          </button>
          {isEditing && (
            <button
              onClick={resetForm}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Sub-Collections Table */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
        <h2 className="text-base sm:text-lg text-gray-900 mb-4">Sub-Collections List</h2>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left text-xs text-gray-600 pb-3 pr-4">Name</th>
                <th className="text-left text-xs text-gray-600 pb-3 pr-4">Parent Collection</th>
                <th className="text-left text-xs text-gray-600 pb-3 pr-4">Description</th>
                <th className="text-left text-xs text-gray-600 pb-3 pr-4">Vehicles</th>
                <th className="text-left text-xs text-gray-600 pb-3 pr-4">Status</th>
                <th className="text-left text-xs text-gray-600 pb-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {subCollections.map((subCollection) => (
                <tr key={subCollection.id} className="border-b border-gray-100 last:border-0">
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <Grid3x3 className="w-4 h-4 text-blue-600" />
                      <span className="text-sm text-gray-900">{subCollection.name}</span>
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-sm text-gray-600">
                    {subCollection.parentCollection}
                  </td>
                  <td className="py-3 pr-4 text-sm text-gray-600 max-w-xs truncate">
                    {subCollection.description}
                  </td>
                  <td className="py-3 pr-4 text-sm text-gray-900">{subCollection.vehicleCount}</td>
                  <td className="py-3 pr-4">
                    <span
                      className={`inline-flex px-2 py-1 rounded text-xs ${
                        subCollection.status === 'Active'
                          ? 'bg-green-50 text-green-700'
                          : 'bg-gray-50 text-gray-600'
                      }`}
                    >
                      {subCollection.status}
                    </span>
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(subCollection)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(subCollection.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-4">
          {subCollections.map((subCollection) => (
            <div key={subCollection.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Grid3x3 className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm text-gray-900 truncate">{subCollection.name}</div>
                    <div className="text-xs text-gray-500">{subCollection.parentCollection}</div>
                  </div>
                </div>
                <span
                  className={`inline-flex px-2 py-1 rounded text-xs flex-shrink-0 ml-2 ${
                    subCollection.status === 'Active'
                      ? 'bg-green-50 text-green-700'
                      : 'bg-gray-50 text-gray-600'
                  }`}
                >
                  {subCollection.status}
                </span>
              </div>
              
              <p className="text-sm text-gray-600 mb-3">{subCollection.description}</p>
              
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="text-sm text-gray-600">
                  <span className="text-gray-900">{subCollection.vehicleCount}</span> vehicles
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(subCollection)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(subCollection.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
