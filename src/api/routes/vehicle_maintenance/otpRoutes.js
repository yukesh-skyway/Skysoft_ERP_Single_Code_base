/**
 * OTP Routes
 * Handles OTP generation, verification, and resending for Fleet Action User Verification
 * 
 * Endpoints:
 * - POST /api/otp/send          - Send OTP to user
 * - POST /api/otp/verify        - Verify OTP
 * - POST /api/otp/resend        - Resend OTP
 * - GET  /api/otp/status        - Get user's 2FA status
 */

const express = require('express');
const router = express.Router();
const twilioOtpService = require('../../services/vehicle_maintenance/twilioOtpService');
const db = require('../../db/connection');

/**
 * POST /api/otp/send
 * Send OTP to user for Fleet Action verification
 * 
 * Body:
 * - userId: User ID (from req.user)
 * - purpose: 'FLEET_ACTION_VERIFICATION' (optional)
 * 
 * Response:
 * {
 *   success: true,
 *   smsSent: true,
 *   emailSent: false,
 *   message: 'OTP sent to your phone',
 *   expiresInMinutes: 5
 * }
 */
router.post('/send', async (req, res) => {
  try {
    // Get user ID from authenticated session (populated by phpSession middleware)
    const userId = req.user?.id;
    const userName = req.user?.fullname || 'User';

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    console.log(`\n📱 POST /api/otp/send - User: ${userId} (${userName})`);

    // Get user's phone number from database
    const [userResults] = await db.query(
      'SELECT user_phone, email FROM users WHERE id = ? AND status = 1 LIMIT 1',
      [userId]
    );

    if (userResults.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found or inactive'
      });
    }

    const user = userResults[0];

    // Validate phone number exists
    if (!user.user_phone || user.user_phone.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'No phone number associated with this account. Please contact administrator.'
      });
    }

    // Send OTP
    const purpose = req.body.purpose || 'FLEET_ACTION_VERIFICATION';
    const result = await twilioOtpService.sendOTP(
      userId,
      user.user_phone,
      userName,
      purpose
    );

    console.log(`✅ OTP sent successfully to user ${userId}`);

    return res.json(result);

  } catch (error) {
    console.error('❌ Error in POST /api/otp/send:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to send OTP. Please try again.'
    });
  }
});

/**
 * POST /api/otp/verify
 * Verify OTP entered by user
 * 
 * Body:
 * - otp: 6-digit OTP code
 * 
 * Response:
 * {
 *   success: true,
 *   message: 'OTP verified successfully'
 * }
 */
router.post('/verify', async (req, res) => {
  try {
    // Get user ID from authenticated session
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const { otp } = req.body;

    // Validate OTP input
    if (!otp || otp.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'OTP is required'
      });
    }

    // Validate OTP format (6 digits)
    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        error: 'OTP must be a 6-digit number'
      });
    }

    console.log(`\n🔐 POST /api/otp/verify - User: ${userId}, OTP: ${otp}`);

    // Verify OTP
    const result = await twilioOtpService.verifyOTP(userId, otp);

    if (result.success) {
      console.log(`✅ OTP verified successfully for user ${userId}`);
      return res.json(result);
    } else {
      console.log(`❌ OTP verification failed for user ${userId}: ${result.error}`);
      return res.status(400).json(result);
    }

  } catch (error) {
    console.error('❌ Error in POST /api/otp/verify:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to verify OTP. Please try again.'
    });
  }
});

/**
 * POST /api/otp/resend
 * Resend OTP to user
 * 
 * Response:
 * {
 *   success: true,
 *   smsSent: true,
 *   message: 'OTP resent to your phone'
 * }
 */
router.post('/resend', async (req, res) => {
  try {
    // Get user ID from authenticated session
    const userId = req.user?.id;
    const userName = req.user?.fullname || 'User';

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    console.log(`\n🔄 POST /api/otp/resend - User: ${userId} (${userName})`);

    // Resend OTP
    const result = await twilioOtpService.resendOTP(userId, userName);

    console.log(`✅ OTP resent successfully to user ${userId}`);

    return res.json(result);

  } catch (error) {
    console.error('❌ Error in POST /api/otp/resend:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to resend OTP. Please try again.'
    });
  }
});

/**
 * GET /api/otp/status
 * Check if user has 2FA enabled and OTP method
 * 
 * Response:
 * {
 *   twoFactorEnabled: true,
 *   otpMethod: 'SMS',
 *   phoneNumberMasked: '****1234'
 * }
 */
router.get('/status', async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    // Get user's 2FA settings
    const [userResults] = await db.query(
      `SELECT 
        two_factor_authentication, 
        otp_method, 
        user_phone 
       FROM users 
       WHERE id = ? 
       LIMIT 1`,
      [userId]
    );

    if (userResults.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = userResults[0];

    // Mask phone number (show last 4 digits)
    let phoneNumberMasked = '';
    if (user.user_phone && user.user_phone.length >= 10) {
      const lastFour = user.user_phone.slice(-4);
      phoneNumberMasked = '****' + lastFour;
    } else {
      phoneNumberMasked = user.user_phone || '';
    }

    return res.json({
      success: true,
      twoFactorEnabled: user.two_factor_authentication === 1,
      otpMethod: user.otp_method || 'SMS',
      phoneNumberMasked
    });

  } catch (error) {
    console.error('❌ Error in GET /api/otp/status:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to get OTP status'
    });
  }
});

module.exports = router;
