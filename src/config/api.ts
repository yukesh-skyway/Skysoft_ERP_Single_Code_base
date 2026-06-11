/**
 * API Configuration
 * Central configuration for all API endpoints
 */

import { API_BASE_URL as BASE_URL_FROM_CONFIG } from './urls';

// ========================================
// 🔧 ENVIRONMENT CONFIGURATION
// ========================================
// The API_BASE_URL is now imported from centralized /config/urls.ts
// To change the base URL, edit /config/urls.ts

export const API_BASE_URL = BASE_URL_FROM_CONFIG;

// ========================================
// 🔍 DEBUGGING: Log current configuration
console.log('🔧 API Configuration:');
console.log('   📡 API_BASE_URL:', API_BASE_URL);
console.log('   🌐 Mode:', API_BASE_URL.includes('ngrok') ? 'NGROK TUNNEL' : API_BASE_URL.includes('localhost') ? 'LOCAL' : 'PRODUCTION');
// ========================================

// API endpoints
export const API_ENDPOINTS = {
  // Vehicle Management
  vehicles: {
    base: '/vehicles',
    byId: (id: string) => `/vehicles/${id}`,
    updateKilometers: (id: string) => `/vehicles/${id}/kilometers`,
    updateStatus: (id: string) => `/vehicles/${id}/status`,
    currentKm: (id: string | number) => `/vehicles/${id}/current-km`,
    syncKm: (id: string | number) => `/vehicles/${id}/sync-km`,
  },
  
  // Repair Code Categories
  repairCodeCategories: {
    base: '/repair-code-categories',
    byId: (id: string) => `/repair-code-categories/${id}`,
    updateStatus: (id: string) => `/repair-code-categories/${id}/status`,
    statistics: '/repair-code-categories/statistics',
  },
  
  // Interval Configuration
  intervalConfiguration: {
    base: '/interval-configurations',
    byId: (id: string) => `/interval-configurations/${id}`,
    updateStatus: (id: string) => `/interval-configurations/${id}/status`,
  },
  
  // Activity Logs
  activityLogs: {
    base: '/activity-logs',
    sources: '/activity-logs/sources',
    users: '/activity-logs/users',
    statistics: '/activity-logs/statistics',
    systemActivities: '/activity-logs/system-activities', // ✅ NEW: System automation logs
  },
  
  // Scheduled Configurations
  scheduledConfigurations: {
    base: '/scheduled-configurations',
    byId: (id: string | number) => `/scheduled-configurations/${id}`,
    duplicate: (id: string | number) => `/scheduled-configurations/${id}/duplicate`,
    toggleStatus: (id: string | number) => `/scheduled-configurations/${id}/toggle-status`,
    bulkDelete: '/scheduled-configurations/bulk-delete',
    bulkUpdateStatus: '/scheduled-configurations/bulk-update-status',
  },
  
  // Configuration Settings
  configurationSettings: {
    base: '/configuration-settings',
    byConfigId: (configId: string | number) => `/configuration-settings/${configId}`,
    byId: (id: string | number) => `/configuration-settings/${id}`,
    toggleStatus: (id: string | number) => `/configuration-settings/${id}/toggle-status`,
  },
  
  // Vendors
  vendors: {
    base: '/vendors',
    byId: (id: string | number) => `/vendors/${id}`,
    update: (id: string | number) => `/vendors/${id}`,
  },
  
  // Repair Orders
  repairOrders: {
    base: '/repair-orders',
    byId: (id: string | number) => `/repair-orders/${id}`,
    cancel: (id: string | number) => `/repair-orders/${id}/cancel`,
    updateStatus: (id: string | number) => `/repair-orders/${id}/status`,
    defects: (vehicleId: string | number) => `/repair-orders/defects/${vehicleId}`,
    scheduledMaintenance: (vehicleId: string | number) => `/repair-orders/scheduled-maintenance/${vehicleId}`,
    create: '/repair-orders/create',
    details: (roId: string | number) => `/repair-orders/${roId}/details`,
    complete: (roId: string | number) => `/repair-orders/${roId}/complete`,
    completeFull: (roId: string | number) => `/repair-orders/${roId}/complete-full`,
    update: (roId: string | number) => `/repair-orders/${roId}`, // ✅ NEW: Update RO endpoint
    attachments: (roId: string | number) => `/repair-orders/${roId}/attachments`, // ✅ NEW: Get attachments
    paymentMethods: '/repair-orders/payment-methods',
    dashboardStatistics: '/repair-orders/dashboard/statistics',
    maintenanceHistory: '/repair-orders/maintenance-history', // ✅ NEW: Get all completed scheduled maintenance records
  },
  
  // Defects
  defects: {
    base: '/defects',
    byId: (id: string | number) => `/defects/${id}`,
    byVehicle: (vehicleId: string | number) => `/defects/vehicle/${vehicleId}`,
    updateStatus: (id: string | number) => `/defects/${id}/status`,
    updateManagerStatus: (id: string | number) => `/defects/${id}/manager-status`,
    approve: (id: string | number) => `/defects/${id}/approve`,
    edit: (id: string | number) => `/defects/${id}/edit`,
    save: (id: string | number) => `/defects/${id}/save`,
    merge: '/defects/merge',
    unmerge: '/defects/unmerge',
    mergedGroup: (mergeId: string) => `/defects/merged-group/${mergeId}`,
    validateRoVehicle: '/defects/validate-ro-vehicle',
    inspectionStatus: '/defects/inspection-status',
    motiveInspectionStatus: '/defects/motive-inspection-status', // ✅ NEW: Recheck motive status
    create: '/defects', // POST to base endpoint
  },
  
  // Users
  users: {
    base: '/users',
    byId: (id: string | number) => `/users/${id}`,
  },
  
  // Payment Methods
  paymentMethods: {
    base: '/payment-methods',
    byId: (id: string | number) => `/payment-methods/${id}`,
  },
  
  // Health Check
  health: '/health',
  
  // OTP (Fleet Action User Verification)
  otp: {
    send: '/otp/send',
    verify: '/otp/verify',
    resend: '/otp/resend',
    status: '/otp/status',
  },
  
  // Maintenance Operations (Automated Defect Creation)
  maintenanceOperations: {
    overdueDueSoon: '/maintenance-operations/overdue-due-soon',
    createDefects: '/maintenance-operations/create-defects',
  },

  // ========================================
  // 🚌 LINE RUN MODULE ENDPOINTS
  // All mounted at /line_run/* on the backend
  // Added in Phase 2 — do not edit VM endpoints above
  // ========================================
  lineRun: {
    // Companies
    companies: {
      base: '/line_run/companies',
      byId: (id: number) => `/line_run/companies/${id}`,
      active: '/line_run/companies/active',
      stats: (id: number) => `/line_run/companies/${id}/stats`,
      dashboard: (id: number) => `/line_run/companies/${id}/dashboard`,
    },
    // Routes
    routes: {
      base: '/line_run/routes',
      byId: (id: number) => `/line_run/routes/${id}`,
      grouped: '/line_run/routes/grouped',
      tripCounts: '/line_run/routes/trip-counts',
      stats: (id: number) => `/line_run/routes/${id}/stats`,
      trips: (id: number) => `/line_run/routes/${id}/trips`,
      stops: (id: number) => `/line_run/routes/${id}/stops`,
      rates: (id: number) => `/line_run/routes/${id}/rates`,
      currentRate: (id: number) => `/line_run/routes/${id}/rates/current`,
      withTripsAndStops: '/line_run/routes/with-trips-and-stops',
      batchTrips: '/line_run/routes/batch/trips',
      batchRates: '/line_run/routes/batch/rates',
      batchAll: '/line_run/routes/batch/all',
    },
    // Trips
    trips: {
      byId: (id: number) => `/line_run/trips/${id}`,
      base: '/line_run/trips',
      stops: (id: number) => `/line_run/trips/${id}/stops`,
      saveWithHistory: (id: number) => `/line_run/trips/${id}/save-with-history`,
      configHistory: (id: number) => `/line_run/trips/${id}/config-history`,
    },
    // Schedules
    schedules: {
      base: '/line_run/schedules',
      byId: (id: number) => `/line_run/schedules/${id}`,
      generate: '/line_run/schedules/generate-from-pattern',
      autoComplete: '/line_run/schedules/auto-complete',
      bulkUpdate: '/line_run/schedules/bulk-update',
      alterSchedule: '/line_run/schedules/alter-schedule',
    },
    // Settlements
    settlements: {
      base: '/line_run/settlements',
      byId: (id: number) => `/line_run/settlements/${id}`,
      calculate: (id: number) => `/line_run/settlements/${id}/calculate`,
      invoice: (id: number) => `/line_run/settlements/${id}/invoice`,
      report: (id: number) => `/line_run/settlements/${id}/report`,
      stats: '/line_run/settlements/stats',
      byMonth: (year: number, month: number) => `/line_run/settlements/calculate/by-month/${year}/${month}`,
    },
    // Clients
    clients: {
      base: '/line_run/clients',
      byId: (id: number) => `/line_run/clients/${id}`,
      contacts: (clientId: number) => `/line_run/clients/${clientId}/contacts`,
      contactById: (clientId: number, id: number) => `/line_run/clients/${clientId}/contacts/${id}`,
    },
    // T-Shirt Sizes
    tshirtSizes: {
      base: '/line_run/tshirt-sizes',
      byId: (id: number) => `/line_run/tshirt-sizes/${id}`,
      trips: (id: number) => `/line_run/tshirt-sizes/${id}/trips`,
      periods: (id: number) => `/line_run/tshirt-sizes/${id}/periods`,
      routePeriods: (routeId: number) => `/line_run/tshirt-sizes/routes/${routeId}/periods`,
      specialWeeks: (id: number) => `/line_run/tshirt-sizes/${id}/special-weeks`,
    },
    // Dashboard
    dashboard: {
      stats: '/line_run/dashboard/stats',
      trend: '/line_run/dashboard/trend',
      kmDistribution: '/line_run/dashboard/km-distribution',
      routePerformance: '/line_run/dashboard/route-performance',
      cancellations: '/line_run/dashboard/cancellations',
      activity: '/line_run/dashboard/activity',
      activeRoutes: '/line_run/dashboard/active-routes',
      performanceTrend: '/line_run/dashboard/performance-trend',
    },
    // Reports
    reports: {
      unpaidKm: '/line_run/reports/unpaid-km',
    },
    // Expenses
    expenses: {
      base: '/line_run/expenses',
      byId: (id: number) => `/line_run/expenses/${id}`,
      summaryMonthly: '/line_run/expenses/summary/monthly',
      summaryYearly: '/line_run/expenses/summary/yearly',
      monthOverMonth: '/line_run/expenses/summary/month-over-month',
    },
    // Events
    events: {
      base: '/line_run/events',
      byId: (id: number) => `/line_run/events/${id}`,
    },
    // Maps (Google Maps proxy)
    maps: {
      autocomplete: '/line_run/maps/autocomplete',
      geocode: '/line_run/maps/geocode',
      distance: '/line_run/maps/distance',
      placeDetails: '/line_run/maps/place-details',
    },
    // Live Positions
    livePositions: {
      positions: '/line_run/live-positions/positions',
      vehiclePosition: (vehicleId: string) => `/line_run/live-positions/positions/vehicle/${vehicleId}`,
      cleanup: '/line_run/live-positions/positions/cleanup',
    },
    // Uploads
    uploads: {
      schedule: '/line_run/uploads/schedule',
      base: '/line_run/uploads',
      byId: (id: number) => `/line_run/uploads/${id}`,
    },
  },
dispatch: {
  slots: {
    base:          '/dispatch/slots',
    byId:          (id: number) => `/dispatch/slots/${id}`,
    configuration: (id: number) => `/dispatch/slots/${id}/configuration`,
    bookings:      (start: string, end: string) =>
                     `/dispatch/slots/bookings?start=${start}&end=${end}`,
    vehicleTypes:  '/dispatch/slots/vehicle-types',
  },
},
};

// Helper function to build full URL
export const buildApiUrl = (endpoint: string): string => {
  return `${API_BASE_URL}${endpoint}`;
};

// Helper to get appropriate headers based on environment
export const getApiHeaders = (additionalHeaders?: Record<string, string>): Record<string, string> => {
  const isNgrok = API_BASE_URL.includes('ngrok');
  
  const baseHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...additionalHeaders,
  };
  
  // Only add ngrok header when using ngrok tunnel
  if (isNgrok) {
    baseHeaders['ngrok-skip-browser-warning'] = 'true';
  }
  
  return baseHeaders;
};

// Common fetch wrapper with error handling
// Common fetch wrapper with error handling
export const apiFetch = async (endpoint: string, options?: RequestInit) => {
  const url = buildApiUrl(endpoint);
  
  console.log(`🔄 API Request: ${options?.method || 'GET'} ${url}`);
  
  try {
    const response = await fetch(url, {
      ...options,
      credentials: 'include',
      headers: getApiHeaders(options?.headers as Record<string, string>),
    });

    console.log(`✅ API Response: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      // ============================================
      // 🔒 401 — Let AuthContext interceptor handle it
      // Don't throw here — throwing causes components to
      // show a toast BEFORE the expired screen appears.
      // ============================================
      if (response.status === 401) {
        console.warn('🔒 401 in apiFetch — AuthContext interceptor will handle this');
        return new Promise(() => {}); // suspend caller; expired screen takes over
      }

      const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
      const errorMessage = errorData.error || errorData.message || `HTTP error! status: ${response.status}`;
      const error: any = new Error(errorMessage);
      error.response = errorData;
      error.status = response.status;

      if (response.status >= 500) {
        console.error(`❌ Server Error for ${url}:`, error);
      } else if (response.status >= 400) {
        console.log(`ℹ️ Validation Error (${response.status}):`, errorMessage);
      }

      throw error;
    }

    return await response.json();
  } catch (error) {
    const isValidationError = (error as any).status >= 400 && (error as any).status < 500;
    
    if (!isValidationError) {
      console.error(`❌ API Error for ${url}:`, error);
    }
    
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      console.error('🔍 CORS/Network Diagnostic:');
      console.error('   📍 URL:', url);
      console.error('   🌐 Origin:', window.location.origin);
      console.error('   🔧 Base URL:', API_BASE_URL);
      console.error('   ⚠️  Possible causes:');
      console.error('      1. CORS not configured on server');
      console.error('      2. Server is not running');
      console.error('      3. Network/firewall blocking request');
      console.error('      4. SSL certificate issue');
      
      const isProduction = API_BASE_URL.includes('strategyit.ca');
      const isNgrok = API_BASE_URL.includes('ngrok');
      const isLocal = API_BASE_URL.includes('localhost');
      
      if (isProduction) {
        throw new Error(`Cannot connect to production server at ${API_BASE_URL}. This is likely a CORS issue. The server must allow requests from origin: ${window.location.origin}. Please check server CORS configuration.`);
      } else if (isNgrok) {
        throw new Error('Cannot connect to ngrok tunnel. Please verify: 1) ngrok is running, 2) URL is correct, 3) Node.js server is running');
      } else if (isLocal) {
        throw new Error('Cannot connect to local server. Please check if Node.js server is running on the correct port.');
      } else {
        throw new Error(`Cannot connect to ${API_BASE_URL}. Please check network connectivity and server availability.`);
      }
    }
    throw error;
  }
};