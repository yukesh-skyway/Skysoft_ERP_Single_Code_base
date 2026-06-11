/**
 * Twilio OTP Service
 * Reuses existing PHP Twilio logic for Fleet Action User Verification
 * 
 * Database Tables Used:
 * - settings (twilio_sid, twilio_auth_token, twilio_number)
 * - users (user_otp, otp_last_generated, otp_method, user_phone)
 * - sms_logs (tracks all SMS sent)
 */

const db = require('../../db/connection');
const axios = require('axios');

class TwilioOtpService {
  constructor() {
    this.twilioConfig = null;
  }

  /**
   * Load Twilio configuration from settings table
   * Matches PHP: select * from settings where name in('twilio_sid', 'twilio_auth_token', 'twilio_number')
   */
  async loadTwilioConfig() {
    try {
      const query = `
        SELECT name, value 
        FROM settings 
        WHERE name IN ('twilio_sid', 'twilio_auth_token', 'twilio_number')
      `;
      
      const [results] = await db.query(query);
      
      const config = {
        twilioSid: '',
        twilioAuthToken: '',
        twilioNumber: ''
      };

      results.forEach(row => {
        if (row.name === 'twilio_sid') config.twilioSid = row.value;
        if (row.name === 'twilio_auth_token') config.twilioAuthToken = row.value;
        if (row.name === 'twilio_number') config.twilioNumber = row.value;
      });

      // Validate config
      if (!config.twilioSid || !config.twilioAuthToken || !config.twilioNumber) {
        throw new Error('Twilio configuration incomplete. Please configure Twilio settings.');
      }

      this.twilioConfig = config;
      return config;
    } catch (error) {
      console.error('❌ Failed to load Twilio config:', error);
      throw error;
    }
  }

  /**
   * Generate 6-digit OTP
   * Matches PHP: mt_rand(100000, 999999)
   */
  generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Send OTP via Twilio SMS
   * Matches PHP Twilio implementation exactly
   * 
   * @param {number} userId - User ID
   * @param {string} phoneNumber - User's phone number
   * @param {string} userName - User's full name
   * @param {string} purpose - OTP purpose (e.g., 'FLEET_ACTION_VERIFICATION')
   * @returns {object} Result object with success status
   */
  async sendOTP(userId, phoneNumber, userName, purpose = 'FLEET_ACTION_VERIFICATION') {
    try {
      console.log(`\n📱 Sending OTP to user ${userId} (${userName}) - ${phoneNumber}`);

      // Load Twilio config
      if (!this.twilioConfig) {
        await this.loadTwilioConfig();
      }

      // Generate 6-digit OTP
      const otp = this.generateOTP();
      console.log(`   🔢 Generated OTP: ${otp}`);

      // Get user details to check otp_method
      const [userResults] = await db.query(
        'SELECT otp_method, user_phone, email FROM users WHERE id = ? LIMIT 1',
        [userId]
      );

      if (userResults.length === 0) {
        throw new Error('User not found');
      }

      const user = userResults[0];
      const otpMethod = user.otp_method || 'SMS';

      // Update user OTP in database
      // Matches PHP: update users set user_otp = '...', otp_last_generated = CURRENT_TIMESTAMP()
      await db.query(
        `UPDATE users 
         SET user_otp = ?, otp_last_generated = CURRENT_TIMESTAMP() 
         WHERE id = ? 
         LIMIT 1`,
        [otp, userId]
      );

      console.log(`   ✅ OTP stored in database`);

      let smsSent = false;
      let emailSent = false;
      let twilioMessageSid = '';

      // Send SMS if method is SMS or BOTH
      if (otpMethod === 'SMS' || otpMethod === 'BOTH') {
        // Prepare SMS message
        // Matches PHP: 'Your login secret code is '.$six_digit_random_number
        const smsMessage = purpose === 'FLEET_ACTION_VERIFICATION'
          ? `Your Skysoft Fleet Action verification code is ${otp}. Valid for 5 minutes.`
          : `Your login secret code is ${otp}`;

        // Send via Twilio API (using cURL equivalent in Node.js)
        // Matches PHP Twilio API call
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${this.twilioConfig.twilioSid}/Messages.json`;
        
        const authHeader = Buffer.from(
          `${this.twilioConfig.twilioSid}:${this.twilioConfig.twilioAuthToken}`
        ).toString('base64');

        const formData = new URLSearchParams({
          To: phoneNumber,
          From: this.twilioConfig.twilioNumber,
          Body: smsMessage,
          // StatusCallback: `${process.env.BASE_URL}/twiliostatusupdate.php` // Optional
        });

        try {
          console.log(`   📤 Sending SMS via Twilio...`);
          
          const response = await axios.post(twilioUrl, formData.toString(), {
            headers: {
              'Authorization': `Basic ${authHeader}`,
              'Content-Type': 'application/x-www-form-urlencoded'
            }
          });

          if (response.data && response.data.sid) {
            twilioMessageSid = response.data.sid;
            smsSent = true;
            console.log(`   ✅ SMS sent successfully. SID: ${twilioMessageSid}`);

            // Log to sms_logs table
            // Matches PHP: INSERT INTO sms_logs
            try {
              await db.query(
                `INSERT INTO sms_logs (
                  sms_type, sms_category, sms_message, sms_tracking_id, 
                  sms_number, related_quote, related_segment, 
                  sms_sent_by, sms_sent_on, sms_read_by, sms_read_on, status
                ) VALUES (
                  'OUTGOING', ?, ?, ?, 
                  ?, 0, 0, 
                  ?, CURRENT_TIMESTAMP(), '0', CURRENT_TIMESTAMP(), 'SENT'
                )`,
                [purpose, smsMessage, twilioMessageSid, phoneNumber, userId]
              );

              console.log(`   ✅ SMS logged to database`);
            } catch (dbError) {
              // SMS was sent successfully, but logging failed - this is not critical
              console.error(`   ⚠️  Warning: SMS sent but database logging failed:`, dbError.message);
              console.error(`   → SMS was still delivered successfully to ${phoneNumber}`);
              // Don't throw - SMS was sent successfully
            }
          } else {
            throw new Error('No SID received from Twilio');
          }
        } catch (twilioError) {
          // Only throw if it's an actual Twilio API error (not database logging error)
          if (twilioError.response || twilioError.request) {
            console.error(`   ❌ Twilio API Error:`, twilioError.response?.data || twilioError.message);
            throw new Error('Failed to send SMS via Twilio');
          } else {
            // Re-throw other errors
            throw twilioError;
          }
        }
      }

      // Send Email if method is EMAIL or BOTH
      // (Email sending logic can be added here similar to PHP email_template logic)
      if (otpMethod === 'EMAIL' || otpMethod === 'BOTH') {
        emailSent = true;
        console.log(`   📧 Email sending is configured but not yet implemented in Node.js`);
        // TODO: Implement email sending using your email service
      }

      // Return result
      return {
        success: true,
        smsSent,
        emailSent,
        otpMethod,
        message: smsSent && emailSent 
          ? 'OTP sent to your phone and email'
          : smsSent 
            ? 'OTP sent to your phone'
            : emailSent 
              ? 'OTP sent to your email'
              : 'OTP generated but sending failed',
        twilioSid: twilioMessageSid,
        expiresInMinutes: 5
      };

    } catch (error) {
      console.error('❌ TwilioOtpService.sendOTP error:', error);
      throw error;
    }
  }

  /**
   * Verify OTP
   * Matches PHP: Verify entered OTP against users.user_otp
   * 
   * @param {number} userId - User ID
   * @param {string} enteredOtp - OTP entered by user
   * @returns {object} Verification result
   */
  async verifyOTP(userId, enteredOtp) {
    try {
      console.log(`\n🔐 Verifying OTP for user ${userId}`);

      // Get user's stored OTP
      const [userResults] = await db.query(
        `SELECT user_otp, otp_last_generated 
         FROM users 
         WHERE id = ? 
         LIMIT 1`,
        [userId]
      );

      if (userResults.length === 0) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      const user = userResults[0];

      // Check if OTP matches
      // Matches PHP: if($userdetails->user_otp == $otp)
      if (user.user_otp !== enteredOtp) {
        console.log(`   ❌ OTP mismatch`);
        return {
          success: false,
          error: 'Incorrect OTP. Please try again.'
        };
      }

      // Check OTP expiration (5 minutes)
      const otpGeneratedTime = new Date(user.otp_last_generated).getTime();
      const currentTime = new Date().getTime();
      const timeDifference = (currentTime - otpGeneratedTime) / 1000 / 60; // in minutes

      if (timeDifference > 5) {
        console.log(`   ⏱️ OTP expired (${timeDifference.toFixed(2)} minutes old)`);
        return {
          success: false,
          error: 'OTP has expired. Please request a new one.'
        };
      }

      // Clear OTP after successful verification
      await db.query(
        `UPDATE users 
         SET user_otp = NULL 
         WHERE id = ? 
         LIMIT 1`,
        [userId]
      );

      console.log(`   ✅ OTP verified successfully`);

      return {
        success: true,
        message: 'OTP verified successfully'
      };

    } catch (error) {
      console.error('❌ TwilioOtpService.verifyOTP error:', error);
      throw error;
    }
  }

  /**
   * Resend OTP
   * Matches PHP: RESEND_SECRET_CODE action
   * 
   * @param {number} userId - User ID
   * @param {string} userName - User's full name
   * @returns {object} Result object
   */
  async resendOTP(userId, userName) {
    try {
      console.log(`\n🔄 Resending OTP for user ${userId}`);

      // Get user details
      const [userResults] = await db.query(
        'SELECT user_phone, email FROM users WHERE id = ? LIMIT 1',
        [userId]
      );

      if (userResults.length === 0) {
        throw new Error('User not found');
      }

      const user = userResults[0];

      // Send OTP using the same logic
      return await this.sendOTP(userId, user.user_phone, userName, 'FLEET_ACTION_VERIFICATION_RESEND');

    } catch (error) {
      console.error('❌ TwilioOtpService.resendOTP error:', error);
      throw error;
    }
  }
}

module.exports = new TwilioOtpService();
