/**
 * URL Configuration - Centralized URL Management
 * Change these values once to affect the entire backend module
 * Skysoft Fleet Maintenance Module
 */

// ========================================
// 🌐 BASE CONFIGURATION
// ========================================

/**
 * Base application URL
 * This is the root URL of your application
 * @example 'https://dev.strategyit.ca'
 */
const BASE_URL = process.env.BASE_URL || 'https://dev.strategyit.ca';

/**
 * PHP module base path (relative to BASE_URL)
 * @example '/vehicle_maintenance_module'
 */
const PHP_MODULE_PATH = process.env.PHP_MODULE_PATH || '/vehicle_maintenance_module';

/**
 * API base path (relative to BASE_URL)
 * @example '/api'
 */
const API_PATH = process.env.API_PATH || '/api';

// ========================================
// 🔗 COMPUTED URLS (Auto-generated)
// ========================================

/**
 * Full API base URL
 * @computed BASE_URL + API_PATH
 */
const API_BASE_URL = `${BASE_URL}${API_PATH}`;

/**
 * Full PHP module URL
 * @computed BASE_URL + PHP_MODULE_PATH
 */
const PHP_MODULE_URL = `${BASE_URL}${PHP_MODULE_PATH}`;

// ========================================
// 🔐 AUTHENTICATION ENDPOINTS
// ========================================

/**
 * PHP session endpoint (get current user session)
 * @computed PHP_MODULE_URL + '/api/auth/get-session.php'
 */
const PHP_SESSION_ENDPOINT = `${PHP_MODULE_URL}/api/auth/get-session.php`;

/**
 * Login page URL
 * @computed BASE_URL + '/login.php'
 */
const LOGIN_URL = `${BASE_URL}/login.php`;

/**
 * Logout page URL
 * @computed BASE_URL + '/logout.php'
 */
const LOGOUT_URL = `${BASE_URL}/logout.php`;

// ========================================
// 📋 EXPORTS
// ========================================

module.exports = {
  // Base URLs
  BASE_URL,
  PHP_MODULE_PATH,
  API_PATH,
  
  // Computed URLs
  API_BASE_URL,
  PHP_MODULE_URL,
  
  // Auth endpoints
  PHP_SESSION_ENDPOINT,
  LOGIN_URL,
  LOGOUT_URL,
  
  // Utility functions
  
  /**
   * Build a full URL from a path
   * @param {string} path - Path to append to BASE_URL
   * @returns {string} Full URL
   * @example buildUrl('/vehicles') => 'https://dev.strategyit.ca/vehicles'
   */
  buildUrl: (path) => {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${BASE_URL}${cleanPath}`;
  },
  
  /**
   * Build a full API URL from a path
   * @param {string} path - Path to append to API_BASE_URL
   * @returns {string} Full API URL
   * @example buildApiUrl('/vehicles') => 'https://dev.strategyit.ca/api/vehicles'
   */
  buildApiUrl: (path) => {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${API_BASE_URL}${cleanPath}`;
  },
  
  /**
   * Build a PHP module URL from a path
   * @param {string} path - Path to append to PHP_MODULE_URL
   * @returns {string} Full PHP module URL
   * @example buildPhpUrl('/reports/index.php') => 'https://dev.strategyit.ca/vehicle_maintenance_module/reports/index.php'
   */
  buildPhpUrl: (path) => {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${PHP_MODULE_URL}${cleanPath}`;
  }
};

// ========================================
// 🔍 LOGGING (Development mode only)
// ========================================

if (process.env.NODE_ENV === 'development') {
  console.log('\n📋 URL Configuration Loaded:');
  console.log('   ========================================');
  console.log(`   🌐 BASE_URL:              ${BASE_URL}`);
  console.log(`   🔧 PHP_MODULE_PATH:       ${PHP_MODULE_PATH}`);
  console.log(`   📡 API_PATH:              ${API_PATH}`);
  console.log('   ----------------------------------------');
  console.log(`   🚀 API_BASE_URL:          ${API_BASE_URL}`);
  console.log(`   🔗 PHP_MODULE_URL:        ${PHP_MODULE_URL}`);
  console.log('   ----------------------------------------');
  console.log(`   🔐 PHP_SESSION_ENDPOINT:  ${PHP_SESSION_ENDPOINT}`);
  console.log(`   🔑 LOGIN_URL:             ${LOGIN_URL}`);
  console.log(`   🚪 LOGOUT_URL:            ${LOGOUT_URL}`);
  console.log('   ========================================\n');
}
