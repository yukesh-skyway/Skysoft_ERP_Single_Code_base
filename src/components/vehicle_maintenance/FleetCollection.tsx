import { useState } from 'react';
import { Plus, Edit2, Trash2, Save, X, Layers } from 'lucide-react';

interface Collection {
  id: string;
  name: string;
  description: string;
  status: 'Active' | 'Inactive';
  createdDate: string;
  vehicleCount: number;
}

export function FleetCollection() {
  const [collections, setCollections] = useState<Collection[]>([
    {
      id: '1',
      name: 'City Bus Fleet',
      description: 'All city buses operating in metropolitan area',
      status: 'Active',
      createdDate: '2024-01-15',
      vehicleCount: 45,
    },
    {
      id: '2',
      name: 'Intercity Bus Fleet',
      description: 'Long-distance intercity bus operations',
      status: 'Active',
      createdDate: '2024-02-20',
      vehicleCount: 28,
    },
    {
      id: '3',
      name: 'School Bus Fleet',
      description: 'School transportation services',
      status: 'Active',
      createdDate: '2024-03-10',
      vehicleCount: 35,
    },
  ]);

  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'Active' as 'Active' | 'Inactive',
  });

  const handleSave = () => {
    if (formData.name) {
      if (isEditing && editingId) {
        setCollections(
          collections.map((collection) =>
            collection.id === editingId ? { ...collection, ...formData } : collection
          )
        );
      } else {
        const newCollection: Collection = {
          id: Date.now().toString(),
          ...formData,
          createdDate: new Date().toISOString().split('T')[0],
          vehicleCount: 0,
        };
        setCollections([...collections, newCollection]);
      }
      resetForm();
    }
  };

  const handleEdit = (collection: Collection) => {
    setIsEditing(true);
    setEditingId(collection.id);
    setFormData({
      name: collection.name,
      description: collection.description,
      status: collection.status,
    });
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this collection?')) {
      setCollections(collections.filter((collection) => collection.id !== id));
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      status: 'Active',
    });
    setIsEditing(false);
    setEditingId(null);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl text-gray-900 mb-1">Fleet Collection</h1>
        <p className="text-sm sm:text-base text-gray-600">Manage fleet collections and groupings</p>
      </div>

      {/* Form Card */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
        <h2 className="text-base sm:text-lg text-gray-900 mb-4">
          {isEditing ? 'Edit Collection' : 'Add New Collection'}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-sm text-gray-600 mb-2 block">Collection Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., City Bus Fleet"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
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
              placeholder="Description of the fleet collection..."
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={handleSave}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
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

      {/* Collections Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {collections.map((collection) => (
          <div key={collection.id} className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Layers className="w-5 h-5 text-blue-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-gray-900 truncate">{collection.name}</div>
                  <span
                    className={`inline-flex px-2 py-0.5 rounded text-xs mt-1 ${
                      collection.status === 'Active'
                        ? 'bg-green-50 text-green-700'
                        : 'bg-gray-50 text-gray-600'
                    }`}
                  >
                    {collection.status}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                <button
                  onClick={() => handleEdit(collection)}
                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(collection.id)}
                  className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <p className="text-sm text-gray-600 mb-4 line-clamp-2">{collection.description}</p>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
              <div>
                <div className="text-xs text-gray-500">Vehicles</div>
                <div className="text-lg text-gray-900">{collection.vehicleCount}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Created</div>
                <div className="text-xs sm:text-sm text-gray-900">{collection.createdDate}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
