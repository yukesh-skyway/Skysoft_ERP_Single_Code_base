/**
 * URL Configuration - Centralized URL Management (Frontend)
 * Change these values once to affect the entire frontend module
 * Skysoft Fleet Maintenance Module
 */

// ========================================
// 🌐 BASE CONFIGURATION
// ========================================

/**
 * Base application URL
 * This is the root URL of your PHP application
 *
 * ENVIRONMENTS:
 * - Development: 'https://dev.strategyit.ca'
 * - UAT: 'https://uat.skywayhub.co'
 * - Production: 'https://skywayhub.co'
 */
//export const BASE_URL = "https://dev.strategyit.ca";
export const BASE_URL = "http://localhost:3000";
/**
 * PHP module base path (relative to BASE_URL)
 * This is where your PHP vehicle maintenance module is located
 */
export const PHP_MODULE_PATH = "/vehicle_maintenance_module";

/**
 * API base path (relative to BASE_URL)
 * This is where your Node.js API is hosted
 */
export const API_PATH = "/api";

// ========================================
// 🔗 COMPUTED URLS (Auto-generated)
// ========================================

/**
 * Full API base URL
 * Used by API configuration
 */
export const API_BASE_URL = `${BASE_URL}${API_PATH}`;

/**
 * Full PHP module URL
 */
export const PHP_MODULE_URL = `${BASE_URL}${PHP_MODULE_PATH}`;

// ========================================
// 🔐 AUTHENTICATION ENDPOINTS
// ========================================

/**
 * Login page URL
 */
export const LOGIN_URL = `${BASE_URL}/login.php`;

/**
 * Logout page URL
 */
export const LOGOUT_URL = `${BASE_URL}/logout.php`;

/**
 * Current user session endpoint
 */
export const CURRENT_USER_ENDPOINT = `${API_BASE_URL}/auth/current-user`;

/**
 * PHP session verification endpoint
 */
export const PHP_SESSION_ENDPOINT = `${PHP_MODULE_URL}/api/auth/get-session.php`;

// ========================================
// 🏠 APPLICATION URLS
// ========================================

/**
 * Home page URL
 */
export const HOME_URL = `${BASE_URL}/`;

/**
 * Dashboard URL (if different from home)
 */
export const DASHBOARD_URL = `${BASE_URL}/dashboard.php`;

// ========================================
// 🛠️ UTILITY FUNCTIONS
// ========================================

/**
 * Build a full URL from a path
 * @param path - Path to append to BASE_URL
 * @returns Full URL
 * @example buildUrl('/vehicles') => 'https://dev.strategyit.ca/vehicles'
 */
export const buildUrl = (path: string): string => {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${BASE_URL}${cleanPath}`;
};

/**
 * Build a full API URL from a path
 * @param path - Path to append to API_BASE_URL
 * @returns Full API URL
 * @example buildApiUrl('/vehicles') => 'https://dev.strategyit.ca/api/vehicles'
 */
export const buildApiUrl = (path: string): string => {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
};

/**
 * Build a PHP module URL from a path
 * @param path - Path to append to PHP_MODULE_URL
 * @returns Full PHP module URL
 * @example buildPhpUrl('/reports/index.php') => 'https://dev.strategyit.ca/vehicle_maintenance_module/reports/index.php'
 */
export const buildPhpUrl = (path: string): string => {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${PHP_MODULE_URL}${cleanPath}`;
};

/**
 * Get the current origin dynamically (for environment-agnostic redirects)
 * Useful when you want to redirect to the current environment's home page
 * @returns Current window origin
 * @example getOrigin() => 'https://dev.strategyit.ca'
 */
export const getOrigin = (): string => {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return BASE_URL;
};

/**
 * Get the home URL for the current environment
 * Uses dynamic origin if available, falls back to configured BASE_URL
 * @returns Home URL
 */
export const getHomeUrl = (): string => {
  return `${getOrigin()}/`;
};

// ========================================
// 🔍 DEBUGGING (Development mode only)
// ========================================

if (
  typeof window !== "undefined" &&
  process.env.NODE_ENV === "development"
) {
  console.log("\n📋 Frontend URL Configuration:");
  console.log("   ========================================");
  console.log(`   🌐 BASE_URL:              ${BASE_URL}`);
  console.log(
    `   🔧 PHP_MODULE_PATH:       ${PHP_MODULE_PATH}`,
  );
  console.log(`   📡 API_PATH:              ${API_PATH}`);
  console.log("   ----------------------------------------");
  console.log(`   🚀 API_BASE_URL:          ${API_BASE_URL}`);
  console.log(`   🔗 PHP_MODULE_URL:        ${PHP_MODULE_URL}`);
  console.log("   ----------------------------------------");
  console.log(`   🔑 LOGIN_URL:             ${LOGIN_URL}`);
  console.log(`   🚪 LOGOUT_URL:            ${LOGOUT_URL}`);
  console.log(
    `   👤 CURRENT_USER_ENDPOINT: ${CURRENT_USER_ENDPOINT}`,
  );
  console.log(
    `   🔐 PHP_SESSION_ENDPOINT:  ${PHP_SESSION_ENDPOINT}`,
  );
  console.log("   ========================================\n");
}

// ========================================
// 📦 DEFAULT EXPORT
// ========================================

export default {
  BASE_URL,
  PHP_MODULE_PATH,
  API_PATH,
  API_BASE_URL,
  PHP_MODULE_URL,
  LOGIN_URL,
  LOGOUT_URL,
  CURRENT_USER_ENDPOINT,
  PHP_SESSION_ENDPOINT,
  HOME_URL,
  DASHBOARD_URL,
  buildUrl,
  buildApiUrl,
  buildPhpUrl,
  getOrigin,
  getHomeUrl,
};