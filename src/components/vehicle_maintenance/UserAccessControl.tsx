import { useState, useEffect } from 'react';
import {
  Shield,
  Users,
  Eye,
  Edit,
  Plus,
  Trash2,
  Save,
  X,
  Search,
  RefreshCw,
  CheckSquare,
  Square,
  ChevronRight,
  ChevronDown,
  Lock,
  Unlock,
  Settings,
  Menu as MenuIcon
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { apiFetch } from '../../config/api';

interface Role {
  id: number;
  role_name: string;
  description: string;
  user_count: number;
  role_type: number; // 1 = Built-in, 2 = Custom
  status: number;    // 1 = Active, 0 = Inactive
}

interface Capability {
  id: number;
  capability: string;
  module: string;
}

interface ScreenModule {
  id: string;
  name: string;
  module: string;
  capabilities: string[];
}

interface RoleCapability {
  role_id: number;
  screen_id: string;
  capabilities: string[];
}

export function UserAccessControl() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [allCapabilities, setAllCapabilities] = useState<Capability[]>([]);
  const [screenModules, setScreenModules] = useState<ScreenModule[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [roleCapabilities, setRoleCapabilities] = useState<RoleCapability[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedModules, setExpandedModules] = useState<string[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedRole) {
      // Check if selected role is Admin (Super Admin) - make it read-only
      const isAdminRole = selectedRole.role_name.toLowerCase() === 'admin' || 
                         selectedRole.role_name.toLowerCase() === 'super admin';
      setIsReadOnly(isAdminRole);
      fetchRoleCapabilities(selectedRole.id);
    }
  }, [selectedRole]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      
      // Load roles and capabilities in parallel
      const [rolesResponse, capabilitiesResponse] = await Promise.all([
        apiFetch('/roles'),
        apiFetch('/roles/all-capabilities')
      ]);

      if (rolesResponse.success) {
        setRoles(rolesResponse.data || []);
        if (rolesResponse.data && rolesResponse.data.length > 0) {
          setSelectedRole(rolesResponse.data[0]);
        }
      }

      if (capabilitiesResponse.success) {
        const caps = capabilitiesResponse.data || [];
        setAllCapabilities(caps);
        
        // Build screen modules from capabilities
        const screens = buildScreenModules(caps);
        setScreenModules(screens);
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const buildScreenModules = (capabilities: Capability[]): ScreenModule[] => {
    const screenMap = new Map<string, ScreenModule>();

    capabilities.forEach(cap => {
      // Parse capability name to extract screen and action
      // Format: ACTION_SCREEN_ID (e.g., "VIEW_REPAIR_CODE_CATEGORIES")
      const parts = cap.capability.split('_');
      
      if (parts.length < 2) return;
      
      const action = parts[0];
      const screenParts = parts.slice(1);
      const screenId = screenParts.join('_').toLowerCase();
      
      // Convert screen_id to readable name
      const screenName = screenParts
        .map(word => word.charAt(0) + word.slice(1).toLowerCase())
        .join(' ');

      if (!screenMap.has(screenId)) {
        screenMap.set(screenId, {
          id: screenId,
          name: screenName,
          module: cap.module,
          capabilities: []
        });
      }

      const screen = screenMap.get(screenId)!;
      if (!screen.capabilities.includes(action)) {
        screen.capabilities.push(action);
      }
    });

    return Array.from(screenMap.values()).sort((a, b) => {
      // Sort by module first, then by name
      if (a.module !== b.module) {
        return a.module.localeCompare(b.module);
      }
      return a.name.localeCompare(b.name);
    });
  };

  const fetchRoleCapabilities = async (roleId: number) => {
    try {
      const response = await apiFetch(`/capabilities/role/${roleId}`);
      if (response.success) {
        setRoleCapabilities(response.capabilities || []);
        setHasChanges(false);
      }
    } catch (error) {
      console.error('Error fetching role capabilities:', error);
      toast.error('Failed to load role capabilities');
    }
  };

  const hasCapability = (screenId: string, capability: string): boolean => {
    const roleCapability = roleCapabilities.find(rc => rc.screen_id === screenId);
    return roleCapability?.capabilities.includes(capability) || false;
  };

  const toggleCapability = (screenId: string, capability: string) => {
    setHasChanges(true);
    setRoleCapabilities(prev => {
      const existing = prev.find(rc => rc.screen_id === screenId);
      
      if (existing) {
        if (existing.capabilities.includes(capability)) {
          // Remove capability
          return prev.map(rc =>
            rc.screen_id === screenId
              ? { ...rc, capabilities: rc.capabilities.filter(c => c !== capability) }
              : rc
          );
        } else {
          // Add capability
          return prev.map(rc =>
            rc.screen_id === screenId
              ? { ...rc, capabilities: [...rc.capabilities, capability] }
              : rc
          );
        }
      } else {
        // Create new entry
        return [
          ...prev,
          {
            role_id: selectedRole?.id || 0,
            screen_id: screenId,
            capabilities: [capability]
          }
        ];
      }
    });
  };

  const toggleAllCapabilities = (screenId: string, allCapabilities: string[]) => {
    setHasChanges(true);
    const existing = roleCapabilities.find(rc => rc.screen_id === screenId);
    const hasAll = allCapabilities.every(cap => existing?.capabilities.includes(cap));

    setRoleCapabilities(prev => {
      const filtered = prev.filter(rc => rc.screen_id !== screenId);
      if (hasAll) {
        // Remove all
        return filtered;
      } else {
        // Add all
        return [
          ...filtered,
          {
            role_id: selectedRole?.id || 0,
            screen_id: screenId,
            capabilities: allCapabilities
          }
        ];
      }
    });
  };

  const saveChanges = async () => {
    if (!selectedRole) return;

    try {
      setSaving(true);
      const response = await apiFetch(`/capabilities/role/${selectedRole.id}`, {
        method: 'PUT',
        body: JSON.stringify({ capabilities: roleCapabilities })
      });

      if (response.success) {
        toast.success('Permissions saved successfully');
        setHasChanges(false);
      } else {
        toast.error(response.error || 'Failed to save permissions');
      }
    } catch (error) {
      console.error('Error saving capabilities:', error);
      toast.error('Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  const discardChanges = () => {
    if (selectedRole) {
      fetchRoleCapabilities(selectedRole.id);
    }
  };

  const toggleModule = (module: string) => {
    setExpandedModules(prev =>
      prev.includes(module)
        ? prev.filter(m => m !== module)
        : [...prev, module]
    );
  };

  const getCapabilityIcon = (capability: string) => {
    switch (capability) {
      case 'VIEW':
        return <Eye className="w-4 h-4" />;
      case 'CREATE':
      case 'ADD':
        return <Plus className="w-4 h-4" />;
      case 'EDIT':
      case 'UPDATE':
        return <Edit className="w-4 h-4" />;
      case 'DELETE':
        return <Trash2 className="w-4 h-4" />;
      case 'COMPLETE':
        return <CheckSquare className="w-4 h-4" />;
      case 'PRINT':
        return <Settings className="w-4 h-4" />;
      case 'EXPORT':
        return <Save className="w-4 h-4" />;
      case 'RESOLVE':
        return <CheckSquare className="w-4 h-4" />;
      case 'SYNC':
      case 'MOTIVE':
        return <RefreshCw className="w-4 h-4" />;
      default:
        return <Lock className="w-4 h-4" />;
    }
  };

  const filteredScreens = screenModules.filter(screen =>
    screen.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    screen.module.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const groupedByModule = filteredScreens.reduce((acc, screen) => {
    if (!acc[screen.module]) {
      acc[screen.module] = [];
    }
    acc[screen.module].push(screen);
    return acc;
  }, {} as Record<string, ScreenModule[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-gray-600">Loading Access Control...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <Shield className="w-8 h-8 text-blue-600" />
              User Access Control
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Manage screen-level permissions for each role • {screenModules.length} screens • {roles.length} roles
            </p>
          </div>
          {hasChanges && !isReadOnly && (
            <div className="flex items-center gap-2">
              <button
                onClick={discardChanges}
                disabled={saving}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Discard
              </button>
              <button
                onClick={saveChanges}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Read-Only Banner for Admin Role */}
      {isReadOnly && selectedRole && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-3">
          <div className="flex items-center gap-3">
            <Lock className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900">
                Super Admin Role - Read Only Mode
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                The "{selectedRole.role_name}" role is a Super Admin and cannot be modified. This role has full system access.
              </p>
            </div>
            <div className="px-3 py-1 bg-amber-100 rounded-full">
              <span className="text-xs font-medium text-amber-800">Protected</span>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-hidden flex">
        {/* Sidebar - Roles List */}
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Roles ({roles.length})
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {roles.map(role => (
              <button
                key={role.id}
                onClick={() => setSelectedRole(role)}
                className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                  selectedRole?.id === role.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{role.role_name}</h3>
                    {role.description && role.description !== role.role_name && (
                      <p className="text-sm text-gray-600 mt-1">{role.description}</p>
                    )}
                    
                    {/* Role Type and Status Badges */}
                    <div className="flex items-center gap-2 mt-2">
                      {/* Role Type Badge */}
                      {Number(role.role_type) === 1 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                          <Lock className="w-3 h-3" />
                          Inbuilt
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                          <Settings className="w-3 h-3" />
                          Custom
                        </span>
                      )}
                      
                      {/* Status Badge */}
                      {Number(role.status) === 1 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                          <CheckSquare className="w-3 h-3" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">
                          <X className="w-3 h-3" />
                          Inactive
                        </span>
                      )}
                    </div>
                  </div>
                  {selectedRole?.id === role.id && (
                    <CheckSquare className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  )}
                </div>
                <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
                  <Users className="w-4 h-4" />
                  <span>{role.user_count} user{role.user_count !== 1 ? 's' : ''}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Main Content - Permissions Grid */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedRole ? (
            <>
              {/* Search Bar */}
              <div className="bg-white border-b border-gray-200 p-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search screens..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Permissions List */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-4">
                  {Object.entries(groupedByModule).map(([module, screens]) => {
                    const isExpanded = expandedModules.includes(module);
                    
                    return (
                      <div key={module} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                        {/* Module Header */}
                        <button
                          onClick={() => toggleModule(module)}
                          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <MenuIcon className="w-5 h-5 text-blue-600" />
                            <h3 className="font-semibold text-gray-900">{module}</h3>
                            <span className="text-sm text-gray-500">({screens.length} screen{screens.length !== 1 ? 's' : ''})</span>
                          </div>
                          {isExpanded ? (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-gray-400" />
                          )}
                        </button>

                        {/* Module Content */}
                        {isExpanded && (
                          <div className="border-t border-gray-200">
                            {screens.map(screen => {
                              const hasAllCapabilities = screen.capabilities.every(cap =>
                                hasCapability(screen.id, cap)
                              );

                              return (
                                <div
                                  key={screen.id}
                                  className="p-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
                                >
                                  <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1">
                                      <h4 className="font-medium text-gray-900">{screen.name}</h4>
                                      <p className="text-xs text-gray-500 mt-1">ID: {screen.id}</p>
                                    </div>
                                    <button
                                      onClick={() => toggleAllCapabilities(screen.id, screen.capabilities)}
                                      disabled={isReadOnly}
                                      className={`flex items-center gap-2 px-3 py-1 text-sm border border-gray-300 rounded-lg ${
                                        isReadOnly 
                                          ? 'opacity-50 cursor-not-allowed' 
                                          : 'hover:bg-gray-100'
                                      }`}
                                    >
                                      {hasAllCapabilities ? (
                                        <>
                                          <Unlock className="w-4 h-4 text-green-600" />
                                          <span className="text-green-600">Full Access</span>
                                        </>
                                      ) : (
                                        <>
                                          <Lock className="w-4 h-4 text-gray-400" />
                                          <span className="text-gray-600">Grant All</span>
                                        </>
                                      )}
                                    </button>
                                  </div>

                                  <div className="flex flex-wrap gap-2">
                                    {screen.capabilities.map(capability => {
                                      const isActive = hasCapability(screen.id, capability);

                                      return (
                                        <button
                                          key={capability}
                                          onClick={() => toggleCapability(screen.id, capability)}
                                          disabled={isReadOnly}
                                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all ${
                                            isActive
                                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                                              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                                          } ${isReadOnly ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}`}
                                        >
                                          {getCapabilityIcon(capability)}
                                          <span className="text-sm font-medium">{capability}</span>
                                          {isActive && (
                                            <CheckSquare className="w-4 h-4" />
                                          )}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Select a role to manage permissions</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}