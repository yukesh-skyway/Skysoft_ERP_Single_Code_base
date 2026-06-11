/**
 * PHP Session Middleware
 * Verifies PHP session and attaches user data to req.user
 * Skysoft Fleet Maintenance Module
 */

const axios = require('axios');
const { PHP_SESSION_ENDPOINT, LOGIN_URL } = require('../config/urls');

/**
 * Middleware to verify PHP session and attach user to request
 * This runs BEFORE attachMetadata so that userId can be extracted from req.user
 */
const verifyPHPSession = async (req, res, next) => {
  try {
    // Skip session check for public endpoints
    const publicPaths = ['/health', '/api/auth/current-user', '/api/auth/debug-session'];
    if (publicPaths.some(path => req.path === path)) {
      console.log(`⏭️  Skipping session check for public endpoint: ${req.path}`);
      return next();
    }

    // Check if session cookie exists
    if (!req.headers.cookie || !req.headers.cookie.includes('PHPSESSID')) {
      console.warn('⚠️  No PHPSESSID cookie found in request');
      console.warn('   Cookies received:', req.headers.cookie ? req.headers.cookie.substring(0, 100) : 'None');
      req.user = null;
      return next();
    }

    console.log(`🔐 Verifying PHP session for: ${req.method} ${req.path}`);
    console.log(`   Cookie: ${req.headers.cookie.substring(0, 100)}...`);
    console.log(`   Calling: ${PHP_SESSION_ENDPOINT}`);
    
    // Call PHP session endpoint with the session cookie
    const response = await axios.get(PHP_SESSION_ENDPOINT, {
      headers: {
        'Cookie': req.headers.cookie,
        'User-Agent': req.headers['user-agent'] || 'Node.js Backend'
      },
      validateStatus: function (status) {
        // Don't throw error on any status code
        return status >= 200 && status < 600;
      },
      timeout: 3000 // 3 second timeout
    });

    console.log(`   PHP Response Status: ${response.status}`);
    console.log(`   PHP Response Data:`, JSON.stringify(response.data).substring(0, 200));

    // Check if session is valid and user data is present
    if (response.status === 200 && response.data.success && response.data.user) {
      // Attach user to request object
      req.user = response.data.user;
      console.log(`✅ User authenticated: ${req.user.username} (ID: ${req.user.id})`);
    } else {
      // Session invalid or expired
      console.warn('⚠️  PHP session invalid or expired');
      console.warn('   Response:', JSON.stringify(response.data));
      req.user = null;
      
      // Optional: Return 401 for protected endpoints
      // Uncomment below to enforce authentication on all routes
      
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        redirect: LOGIN_URL
      });
      
    }

  } catch (error) {
    // Log error but don't break the request
    console.error('❌ PHP session verification failed:');
    console.error('   Error:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('   → PHP endpoint unreachable');
      console.error('   → Endpoint:', PHP_SESSION_ENDPOINT);
    } else if (error.code === 'ETIMEDOUT') {
      console.error('   → PHP endpoint timeout');
    }
     // Instead of silently continuing, return 503
  return res.status(503).json({
    success: false,
    message: 'Authentication service unavailable',
    code: 'AUTH_SERVICE_DOWN'
  });
    // Set user to null and continue
    req.user = null;
    
    // Optional: Return error for critical operations
    // For now, we'll allow the request to continue with userId=0
  }

  // Always call next() to continue the request chain
  next();
};

/**
 * Middleware to require authentication
 * Use this on routes that MUST have a valid user session
 */
const requireAuth = (req, res, next) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      redirect: LOGIN_URL
    });
  }
  next();
};

/**
 * Middleware to require specific role(s)
 * @param {Array|String} allowedRoles - Role IDs that are allowed (e.g., ['1', '2'] for Admin/Manager)
 */
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Convert to array if single role
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    
    // Check if user has any of the allowed roles
    const userRoles = req.user.role.split(',');
    const hasRole = roles.some(role => userRoles.includes(role.toString()));
    
    if (!hasRole) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        required: roles,
        current: userRoles
      });
    }
    
    next();
  };
};

module.exports = {
  verifyPHPSession,
  requireAuth,
  requireRole
};