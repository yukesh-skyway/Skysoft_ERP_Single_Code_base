<?php
/**
 * URL Configuration for PHP Files
 * Centralized URL management for PHP backend
 * Skysoft Fleet Maintenance Module
 * 
 * CHANGE THESE VALUES TO AFFECT ALL PHP FILES
 */

// ========================================
// 🌐 BASE CONFIGURATION
// ========================================

/**
 * Base application URL
 * This is the root URL of your application
 * 
 * ENVIRONMENTS:
 * - Development: 'https://dev.strategyit.ca'
 * - Staging: 'https://staging.strategyit.ca' (example)
 * - Production: 'https://strategyit.ca' (example)
 */
define('BASE_URL', 'https://dev.strategyit.ca');

/**
 * Allowed CORS origins (for Access-Control-Allow-Origin header)
 * Can be a single URL or array of URLs
 */
define('ALLOWED_ORIGINS', [
    'https://dev.strategyit.ca',
    'http://localhost:3000',      // React local development
    'http://localhost:5173',      // Vite local development
    // Add more origins as needed
]);

/**
 * Get the appropriate CORS origin header value
 * @return string The origin to use in Access-Control-Allow-Origin
 */
function getCorsOrigin() {
    $requestOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';
    
    // If request origin is in allowed list, use it
    if (in_array($requestOrigin, ALLOWED_ORIGINS)) {
        return $requestOrigin;
    }
    
    // Otherwise, use BASE_URL as default
    return BASE_URL;
}

// ========================================
// 🔗 COMPUTED URLS
// ========================================

/**
 * API base path
 */
define('API_PATH', '/api');

/**
 * Full API base URL
 */
define('API_BASE_URL', BASE_URL . API_PATH);

/**
 * PHP module path
 */
define('PHP_MODULE_PATH', '/vehicle_maintenance_module');

/**
 * Full PHP module URL
 */
define('PHP_MODULE_URL', BASE_URL . PHP_MODULE_PATH);

// ========================================
// 🔐 AUTHENTICATION ENDPOINTS
// ========================================

/**
 * Login page URL
 */
define('LOGIN_URL', BASE_URL . '/login.php');

/**
 * Logout page URL
 */
define('LOGOUT_URL', BASE_URL . '/logout.php');

/**
 * Session endpoint URL
 */
define('SESSION_ENDPOINT', PHP_MODULE_URL . '/api/auth/get-session.php');

// ========================================
// 🛠️ UTILITY FUNCTIONS
// ========================================

/**
 * Build a full URL from a path
 * @param string $path Path to append to BASE_URL
 * @return string Full URL
 */
function buildUrl($path) {
    $cleanPath = (strpos($path, '/') === 0) ? $path : '/' . $path;
    return BASE_URL . $cleanPath;
}

/**
 * Build a full API URL from a path
 * @param string $path Path to append to API_BASE_URL
 * @return string Full API URL
 */
function buildApiUrl($path) {
    $cleanPath = (strpos($path, '/') === 0) ? $path : '/' . $path;
    return API_BASE_URL . $cleanPath;
}

/**
 * Build a PHP module URL from a path
 * @param string $path Path to append to PHP_MODULE_URL
 * @return string Full PHP module URL
 */
function buildPhpUrl($path) {
    $cleanPath = (strpos($path, '/') === 0) ? $path : '/' . $path;
    return PHP_MODULE_URL . $cleanPath;
}

// ========================================
// 🔍 DEBUG OUTPUT (Development only)
// ========================================

if (php_sapi_name() === 'cli' || (isset($_GET['debug']) && $_GET['debug'] === 'config')) {
    error_log("\n📋 PHP URL Configuration:");
    error_log("   ========================================");
    error_log("   🌐 BASE_URL:         " . BASE_URL);
    error_log("   📡 API_PATH:         " . API_PATH);
    error_log("   🔧 PHP_MODULE_PATH:  " . PHP_MODULE_PATH);
    error_log("   ----------------------------------------");
    error_log("   🚀 API_BASE_URL:     " . API_BASE_URL);
    error_log("   🔗 PHP_MODULE_URL:   " . PHP_MODULE_URL);
    error_log("   ----------------------------------------");
    error_log("   🔑 LOGIN_URL:        " . LOGIN_URL);
    error_log("   🚪 LOGOUT_URL:       " . LOGOUT_URL);
    error_log("   🔐 SESSION_ENDPOINT: " . SESSION_ENDPOINT);
    error_log("   ========================================\n");
}
