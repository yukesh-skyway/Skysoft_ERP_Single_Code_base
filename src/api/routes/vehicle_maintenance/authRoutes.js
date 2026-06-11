/**
 * Authentication Routes
 * Handles user session verification from PHP backend
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const { PHP_SESSION_ENDPOINT, LOGOUT_URL } = require('../../config/urls');

/**
 * GET /api/auth/current-user
 * Returns current user session from PHP backend
 * 
 * This endpoint forwards the request to PHP which reads the session
 */
router.get('/current-user', async (req, res) => {
  try {
    console.log('🔐 Checking PHP session...');
    console.log('   PHP Endpoint:', PHP_SESSION_ENDPOINT);
    console.log('   Cookie header:', req.headers.cookie ? 'Present ✅' : 'Missing ❌');
    
    // DEBUG: Show ALL cookies being sent
    if (req.headers.cookie) {
      console.log('   📋 ALL Cookies received from browser:');
      console.log('   ' + req.headers.cookie);
      console.log('   ');
      console.log('   📋 Parsed cookies:');
      const cookies = req.headers.cookie.split(';').map(c => c.trim());
      cookies.forEach(cookie => {
        const [name, value] = cookie.split('=');
        if (name === 'PHPSESSID') {
          console.log(`      🔑 ${name} = ${value}`);
        } else {
          console.log(`      ⚪ ${name} = ${value.substring(0, 30)}...`);
        }
      });
    }
    
    // Forward the request to PHP WITH ALL COOKIES
    // CRITICAL: Send the EXACT cookie header as-is to preserve all PHPSESSID entries
    const response = await axios.get(PHP_SESSION_ENDPOINT, {
      headers: {
        'Cookie': req.headers.cookie || '',           // Pass ALL cookies exactly as received
        'User-Agent': req.headers['user-agent'] || '',
        'X-Forwarded-For': req.headers['x-forwarded-for'] || req.ip || '',
        'X-Real-IP': req.ip || ''
      },
      validateStatus: function (status) {
        // Don't throw error on any status code
        return status >= 200 && status < 600;
      },
      timeout: 30000, // 30 second timeout (increased from 5s)
      maxRedirects: 0 // Don't follow redirects
    });
    
    console.log('   PHP Response Status:', response.status);
    console.log('   PHP Response Data:', response.data);
    console.log('   Result:', response.data.success ? '✅ User found' : '❌ Not authenticated');
    
    // Return whatever PHP returned
    return res.status(response.status).json(response.data);

  } catch (error) {
    console.error('❌ Error checking PHP session:');
    console.error('   Error type:', error.name);
    console.error('   Error message:', error.message);
    console.error('   Error code:', error.code);
    
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('   Response status:', error.response.status);
      console.error('   Response data:', error.response.data);
      
      return res.status(error.response.status).json({
        success: false,
        error: 'PHP endpoint error',
        message: error.message,
        details: error.response.data
      });
    } else if (error.request) {
      // The request was made but no response was received
      console.error('   No response received from PHP endpoint');
      
      return res.status(503).json({
        success: false,
        error: 'Cannot reach PHP endpoint',
        message: 'Make sure PHP file exists and is accessible',
        endpoint: PHP_SESSION_ENDPOINT,
        hint: 'Try accessing the PHP endpoint directly in your browser while logged in'
      });
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('   Request setup error');
      
      return res.status(500).json({
        success: false,
        error: 'Failed to check session',
        message: error.message,
        details: 'Error occurred while setting up the request'
      });
    }
  }
});

/**
 * POST /api/auth/logout
 * Logout user (clears session)
 */
router.post('/logout', (req, res) => {
  // This would typically redirect to PHP logout
  res.status(200).json({
    success: true,
    message: 'Logout successful',
    redirect: LOGOUT_URL
  });
});

/**
 * GET /api/auth/debug-session
 * Debug endpoint to check session and metadata
 */
router.get('/debug-session', (req, res) => {
  console.log('🔍 SESSION DEBUG INFO:');
  console.log('   ========================================');
  console.log('   Headers:', JSON.stringify(req.headers, null, 2));
  console.log('   ----------------------------------------');
  console.log('   req.user:', req.user ? JSON.stringify(req.user, null, 2) : 'null');
  console.log('   ----------------------------------------');
  console.log('   req.metadata:', req.metadata ? JSON.stringify(req.metadata, null, 2) : 'null');
  console.log('   ========================================');
  
  res.status(200).json({
    success: true,
    debug: {
      hasCookie: !!req.headers.cookie,
      cookiePreview: req.headers.cookie ? req.headers.cookie.substring(0, 100) + '...' : null,
      hasPHPSESSID: req.headers.cookie ? req.headers.cookie.includes('PHPSESSID') : false,
      user: req.user || null,
      metadata: req.metadata || null,
      phpEndpoint: PHP_SESSION_ENDPOINT
    },
    message: 'Check server console for full debug information'
  });
});

module.exports = router;
