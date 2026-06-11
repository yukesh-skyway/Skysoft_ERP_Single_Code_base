import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiFetch } from '../config/api';
import { useAuth } from './AuthContext';

// ============================================
// 🎨 FIGMA DEVELOPMENT MODE
// ============================================
// Detect if running in Figma iframe
const isRunningInFigma = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  try {
    // Check if we're in an iframe
    const inIframe = window.self !== window.top;
    
    // Check if parent origin contains 'figma'
    if (inIframe) {
      try {
        const parentOrigin = document.referrer;
        return parentOrigin.includes('figma.com');
      } catch (e) {
        // Cross-origin restriction, assume Figma if in iframe
        return true;
      }
    }
    
    return false;
  } catch (e) {
    return false;
  }
};

// ============================================
// 💻 LOCAL DEVELOPMENT MODE
// ============================================
// Detect if running on localhost
const isLocalDevelopment = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  return (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  );
};

// Mock capabilities for Figma development
// Grant all capabilities for testing
const FIGMA_DEV_CAPABILITIES = [
  'VIEW_REPAIR_CODE_CATEGORIES',
  'ADD_REPAIR_CODE_CATEGORY',
  'EDIT_REPAIR_CODE_CATEGORY',
  'DELETE_REPAIR_CODE_CATEGORY',
  'MOTIVE_DEFECTS',
  'FLEET_MAP',
  'VEHICLE_MAINTENANCE_NEW',
  'MANAGE_VENDORS',
  'MANAGE_PAYMENT_METHODS',
  'VIEW_REPAIR_ORDERS',
  'CREATE_REPAIR_ORDERS',
  'EDIT_REPAIR_ORDERS',
  'DELETE_REPAIR_ORDERS',
  'VIEW_SERVICE_HISTORY',
  'MANAGE_FLEET',
  'MANAGE_USERS',
  'MANAGE_ROLES',
  'MANAGE_CAPABILITIES',
];

interface CapabilitiesContextType {
  capabilities: string[];
  loading: boolean;
  error: string | null;
  hasCapability: (capability: string) => boolean;
  hasAnyCapability: (capabilities: string[]) => boolean;
  hasAllCapabilities: (capabilities: string[]) => boolean;
  refreshCapabilities: () => Promise<void>;
  isAdmin: boolean;
  userRoles: string[];
}

const CapabilitiesContext = createContext<CapabilitiesContextType | undefined>(undefined);

export function CapabilitiesProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRoles, setUserRoles] = useState<string[]>([]);

  const fetchCapabilities = async () => {
    try {
      setLoading(true);
      setError(null);

      // 🎨 FIGMA MODE: Use mock capabilities
      if (isRunningInFigma()) {
        console.log('🎨 FIGMA MODE - Using mock capabilities');
        setCapabilities(FIGMA_DEV_CAPABILITIES);
        setIsAdmin(true); // Grant admin for testing
        setUserRoles(['Admin', 'Manager', 'Mechanic', 'Driver']);
        setLoading(false);
        return;
      }

      // 💻 LOCAL DEVELOPMENT MODE: Use mock capabilities
      if (isLocalDevelopment()) {
        console.log('💻 LOCAL DEVELOPMENT MODE - Using mock capabilities');
        setCapabilities(FIGMA_DEV_CAPABILITIES);
        setIsAdmin(true); // Grant admin for testing
        setUserRoles(['Admin', 'Manager', 'Mechanic', 'Driver']);
        setLoading(false);
        return;
      }

      // 🌐 PRODUCTION MODE: Check if we have user from AuthContext
      if (!user) {
        console.warn('⚠️ No user session available');
        setCapabilities([]);
        setIsAdmin(false);
        setUserRoles([]);
        setLoading(false);
        return;
      }

      console.log('👤 User from AuthContext:', user);

      // ✅ NEW APPROACH: Use session data to determine admin status
      // Check if user has roles from session
      if (user.roles && Array.isArray(user.roles)) {
        const roleNames = user.roles.map((r: any) => r.role_name);
        setUserRoles(roleNames);
        
        // Check if user is admin
        const isUserAdmin = roleNames.some((roleName: string) => 
          roleName.toLowerCase() === 'admin' || 
          roleName.toLowerCase() === 'super admin'
        );
        setIsAdmin(isUserAdmin);
        
        console.log('✅ Roles from session:', {
          userRoles: roleNames,
          isAdmin: isUserAdmin
        });
      } else if (user.role) {
        // Fallback: Parse role string "1,2" and check if contains "1" (Admin)
        const roleIds = user.role.split(',').map((r: string) => r.trim());
        const isUserAdmin = roleIds.includes('1'); // Assuming role ID 1 is Admin
        setIsAdmin(isUserAdmin);
        
        console.log('✅ Role IDs from session:', {
          roleIds,
          isAdmin: isUserAdmin
        });
      }

      // 🌐 STILL TRY TO FETCH CAPABILITIES from API
      try {
        const response = await apiFetch('/capabilities/user');
        
        console.log('📊 Capabilities API Response:', response);
        
        if (response.success && response.capabilities) {
          setCapabilities(response.capabilities);
          
          // Override isAdmin if API provides it
          if (response.isAdmin !== undefined) {
            setIsAdmin(response.isAdmin);
          }
          
          // Override userRoles if API provides them
          if (response.userRoles && response.userRoles.length > 0) {
            setUserRoles(response.userRoles);
          }
          
          console.log('✅ Capabilities loaded from API:', {
            capabilitiesCount: response.capabilities.length,
            isAdmin: response.isAdmin ?? isAdmin,
            userRoles: response.userRoles ?? userRoles
          });
        } else {
          console.warn('⚠️ API did not return capabilities, using session-based auth only');
          // Keep the isAdmin and userRoles we derived from session
        }
      } catch (apiError: any) {
        console.warn('⚠️ Capabilities API failed, using session-based auth:', apiError.message);
        // Keep the isAdmin and userRoles we derived from session
        // This is OK - we can still show Access Control based on session roles
      }
      
    } catch (err: any) {
      console.error('Error in capabilities provider:', err);
      setError(err.message || 'Failed to fetch capabilities');
      setCapabilities([]);
      // Don't reset isAdmin/userRoles if we already got them from session
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Wait for auth to finish loading before fetching capabilities
    if (!authLoading) {
      fetchCapabilities();
    }
  }, [authLoading, user]);

  const hasCapability = (capability: string): boolean => {
    return capabilities.includes(capability);
  };

  const hasAnyCapability = (caps: string[]): boolean => {
    return caps.some(cap => capabilities.includes(cap));
  };

  const hasAllCapabilities = (caps: string[]): boolean => {
    return caps.every(cap => capabilities.includes(cap));
  };

  const refreshCapabilities = async () => {
    await fetchCapabilities();
  };

  return (
    <CapabilitiesContext.Provider
      value={{
        capabilities,
        loading,
        error,
        hasCapability,
        hasAnyCapability,
        hasAllCapabilities,
        refreshCapabilities,
        isAdmin,
        userRoles,
      }}
    >
      {children}
    </CapabilitiesContext.Provider>
  );
}

export function useCapabilities() {
  const context = useContext(CapabilitiesContext);
  if (context === undefined) {
    throw new Error('useCapabilities must be used within a CapabilitiesProvider');
  }
  return context;
}