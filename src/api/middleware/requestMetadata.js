/**
 * Request Metadata Middleware
 * Extracts IP address, browser, and user ID from requests
 * Skysoft Fleet Maintenance Module
 */

/**
 * Extract client IP address
 * @param {Object} req - Express request object
 * @returns {string} IP address
 */
const getClientIP = (req) => {
  // Check various headers for IP (handles proxies, load balancers)
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.connection?.socket?.remoteAddress ||
    'unknown'
  );
};

/**
 * Extract browser/user agent
 * @param {Object} req - Express request object
 * @returns {string} Browser user agent
 */
const getBrowser = (req) => {
  return req.headers['user-agent'] || 'unknown';
};

/**
 * Extract user ID from request
 * Priority: req.user.id (from PHP session), header, query, body, default to 0
 * @param {Object} req - Express request object
 * @returns {number} User ID
 */
const getUserId = (req) => {
  // Priority 1: From PHP session middleware (verifyPHPSession sets req.user)
  // This is populated by the PHP session check that runs BEFORE this middleware
  if (req.user && req.user.id) {
    return parseInt(req.user.id);
  }
  
  // Priority 2: From custom header (useful for API testing)
  if (req.headers['x-user-id']) {
    return parseInt(req.headers['x-user-id']);
  }
  
  // Priority 3: From query parameter (for testing)
  if (req.query.userId) {
    return parseInt(req.query.userId);
  }
  
  // Priority 4: From request body (for POST/PUT - backward compatibility)
  if (req.body && req.body.userId) {
    return parseInt(req.body.userId);
  }
  
  // Default: 0 (system/unknown user)
  // This happens when no PHP session exists or session is invalid
  return 0;
};

/**
 * Middleware to attach metadata to request
 * Adds req.metadata object with IP, browser, and userId
 */
const attachMetadata = (req, res, next) => {
  req.metadata = {
    ipAddress: getClientIP(req),
    browser: getBrowser(req),
    userId: getUserId(req)
  };
  
  // Optional: Log metadata for debugging
  if (process.env.NODE_ENV === 'development') {
    console.log('📋 Request Metadata:', {
      method: req.method,
      path: req.path,
      ip: req.metadata.ipAddress,
      userId: req.metadata.userId,
      browser: req.metadata.browser.substring(0, 50) + '...'
    });
  }
  
  next();
};

/**
 * Truncate browser string to fit database field
 * @param {string} browser - Full user agent string
 * @param {number} maxLength - Maximum length (default 255)
 * @returns {string} Truncated browser string
 */
const truncateBrowser = (browser, maxLength = 255) => {
  if (!browser || browser.length <= maxLength) {
    return browser;
  }
  return browser.substring(0, maxLength - 3) + '...';
};

/**
 * Format metadata for logging
 * @param {Object} req - Express request object
 * @returns {Object} Formatted metadata
 */
const formatMetadataForLog = (req) => {
  const metadata = req.metadata || {
    ipAddress: getClientIP(req),
    browser: getBrowser(req),
    userId: getUserId(req)
  };
  
  return {
    ipAddress: metadata.ipAddress.substring(0, 50), // Truncate to fit DB field
    browser: truncateBrowser(metadata.browser, 255), // Truncate to fit DB field
    userId: metadata.userId
  };
};

module.exports = {
  attachMetadata,
  addMetadata: attachMetadata, // Alias for backward compatibility
  getClientIP,
  getBrowser,
  getUserId,
  truncateBrowser,
  formatMetadataForLog
};