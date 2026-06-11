/**
 * Garage Webhook Service
 * Sends RO event notifications to third-party Garage application
 * Triggers on: RO Create, RO Update
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const db = require('../../db/connection');

class GarageWebhookService {
  constructor() {
    this.webhookUrl = process.env.GARAGE_WEBHOOK_URL;
    this.secretKey = process.env.GARAGE_WEBHOOK_SECRET_KEY;
    this.enabled = this.webhookUrl && this.secretKey; // Only enable if credentials exist
    
    // Create log directory if it doesn't exist
    this.logDir = path.join(__dirname, '../../app-log/garage');
    this.ensureLogDirectory();
  }

  /**
   * Ensure log directory exists
   */
  async ensureLogDirectory() {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create garage log directory:', error);
    }
  }

  /**
   * Get current date log file path
   */
  getLogFilePath() {
    const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return path.join(this.logDir, `webhook_call_log_${dateStr}.txt`);
  }

  /**
   * Write to log file
   */
  async logToFile(message) {
    try {
      const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0];
      const logMessage = `${timestamp} ${message}\n`;
      const logFile = this.getLogFilePath();
      
      await fs.appendFile(logFile, logMessage, 'utf8');
    } catch (error) {
      console.error('Failed to write to garage webhook log:', error);
    }
  }

  /**
   * Log to database (vm_logs table)
   * Uses user_id = 0 for system-triggered actions (Garage API webhook)
   * This indicates automated/system events rather than user-initiated actions
   */
  async logToDatabase(roid, userId, message) {
    try {
      // Use userId if provided, otherwise use 0 for system events
      const finalUserId = userId || 0;
      
      const query = `
        INSERT INTO vm_logs (ro_id, user_id, log_data, log_time)
        VALUES (?, ?, ?, NOW())
      `;
      await db.query(query, [roid, finalUserId, message]);
    } catch (error) {
      console.error('Failed to log to database:', error);
    }
  }

  /**
   * Send webhook to Garage App
   * @param {number} roid - Repair Order ID
   * @param {string} action - 'created' or 'updated'
   * @param {number} status - RO status (0=Open, 1=In Progress, 2=Completed, 3=Reopened)
   * @param {number} userId - User ID for logging
   * @returns {Promise<Object>} - Webhook response
   */
  async sendWebhook(roid, action, status, userId = null) {
    // Skip if webhook not configured
    if (!this.enabled) {
      console.log('[Garage Webhook] Skipped - No credentials configured');
      return { success: false, message: 'Webhook not configured' };
    }

    try {
      // Validate action
      const validActions = ['created', 'updated'];
      if (!validActions.includes(action.toLowerCase())) {
        throw new Error(`Invalid webhook action: ${action}`);
      }

      // Build webhook payload
      const payload = {
        event: `ro.${action.toLowerCase()}`,
        roid: parseInt(roid),
        status: parseInt(status)
      };

      // Log request
      const requestLog = `Garage Webhook Request initiated (RO ${roid} ${action}): ${JSON.stringify(payload)}`;
      await this.logToFile(requestLog);
      console.log(`[Garage Webhook] ${requestLog}`);

      // Send POST request with Bearer token
      const response = await axios.post(this.webhookUrl, payload, {
        headers: {
          'Authorization': `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10 second timeout
      });

      // Log successful response
      const responseLog = `Garage Webhook Response (RO ${roid} ${action}): Status ${response.status} - ${JSON.stringify(response.data)}`;
      await this.logToFile(responseLog);
      console.log(`[Garage Webhook] ${responseLog}`);

      // Log to database (always log, even without userId)
      await this.logToDatabase(roid, userId, `Garage App webhook triggered for RO ${action}`);

      return {
        success: true,
        status: response.status,
        data: response.data
      };

    } catch (error) {
      // Log error
      const errorLog = `Garage Webhook Error (RO ${roid} ${action}): ${error.message}`;
      await this.logToFile(errorLog);
      console.error(`[Garage Webhook] ${errorLog}`, error);

      // Log to database (always log errors, even without userId)
      await this.logToDatabase(roid, userId, `Garage App webhook FAILED for RO ${action}: ${error.message}`);

      return {
        success: false,
        error: error.message,
        details: error.response?.data || null
      };
    }
  }

  /**
   * Send webhook for RO creation
   */
  async notifyROCreated(roid, status = 1, userId = null) {
    return await this.sendWebhook(roid, 'created', status, userId);
  }

  /**
   * Send webhook for RO update
   */
  async notifyROUpdated(roid, status, userId = null) {
    return await this.sendWebhook(roid, 'updated', status, userId);
  }
  /**
   * Send webhook for defect/service request creation (Skysoft → Garage)
   * Called after successful VRL + RPOR insertion from Garage payload
   * 
   * Fetches fresh RPOR status from repair_purchase_orders table
   * to ensure webhook reflects current state (0=Open, 1=In Progress, 2=Completed, 3=Reopened)
   * 
   * @param {number} skysoftDefectId - VRL ID (Skysoft defect identifier)
   * @param {number} externalGarageDefectId - Garage defect_id (external reference)
   * @param {number} roid - Repair Order ID
   * @param {number} rporId - Repair Purchase Order ID
   * @param {number} garageUserId - User ID from VRL.logged_by (Garage Mechanics user)
   * @returns {Promise<Object>} - Webhook response
   */
async notifyDefectCreated(skysoftDefectId, externalGarageDefectId, roid, rporId, garageUserId = null) {
    // Skip if webhook not configured
    if (!this.enabled) {
      return { success: false, message: 'Webhook not configured' };
    }

    try {
      // Fetch fresh RO status from database
      const [rporRows] = await db.query(
        `SELECT status FROM repair_purchase_orders WHERE id = ? LIMIT 1`,
        [roid]
      );

      if (!rporRows || rporRows.length === 0) {
        throw new Error(`RO not found with ID ${roid}`);
      }

      const rporStatus = rporRows[0].status;

      const payload = {
        event: 'skysoft_defect.created',
        skysoft_defect_id: parseInt(skysoftDefectId),
        external_garage_defect_id: parseInt(externalGarageDefectId),
        roid: parseInt(roid),
        rpor_id: parseInt(rporId),
        status: parseInt(rporStatus)
      };

      // Log request only
      const requestLog = `Garage Webhook Request initiated (Defect ${externalGarageDefectId} skysoft_defect.created): ${JSON.stringify(payload)}`;
      await this.logToFile(requestLog);

      // Send webhook
      const response = await axios.post(this.webhookUrl, payload, {
        headers: {
          'Authorization': `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      // Log response only
      const responseLog = `Garage Webhook Response (Defect ${externalGarageDefectId} skysoft_defect.created): Status ${response.status} - ${JSON.stringify(response.data)}`;
      await this.logToFile(responseLog);

      // Log to database
      await this.logToDatabase(
        roid,
        garageUserId,
        `Garage defect created webhook triggered (VRL ${skysoftDefectId}, Garage defect ${externalGarageDefectId}, RPOR ${rporId}, status ${rporStatus})`
      );

      return {
        success: true,
        status: response.status,
        data: response.data
      };

    } catch (error) {
      const errorLog = `Garage Webhook Error (Defect ${externalGarageDefectId} skysoft_defect.created): ${error.message}`;
      await this.logToFile(errorLog);

      await this.logToDatabase(
        roid,
        garageUserId,
        `Garage defect webhook FAILED (VRL ${skysoftDefectId}, Garage defect ${externalGarageDefectId}): ${error.message}`
      );

      return {
        success: false,
        error: error.message,
        details: error.response?.data || null
      };
    }
  }

/**
 * Send webhook for QuickJob RO + Defect creation (Skysoft → Garage)
 * Called after successful RO + VRL + RPOR insertion from QuickJob payload
 * Combines ro.created and skysoft_defect.created into a single call
 *
 * @param {number} roid - Repair Order ID (newly created)
 * @param {number} skysoftDefectId - VRL ID
 * @param {number} externalGarageDefectId - garage_finding_id
 * @param {number} rporId - RPOR ID
 * @param {number} roStatus - RO status (default 1 = Active)
 * @param {number} garageUserId - User ID for logging
 * @returns {Promise<Object>} - Webhook response
 */
async notifyQuickJobCreated(roid, skysoftDefectId, externalGarageDefectId, rporId, garageUserId = null) {
  if (!this.enabled) {
    return { success: false, message: 'Webhook not configured' };
  }

  try {
    // Fetch fresh RO status from DB — same pattern as notifyDefectCreated
    const [roRows] = await db.query(
      `SELECT status FROM repair_purchase_orders WHERE id = ? LIMIT 1`,
      [roid]
    );

    if (!roRows || roRows.length === 0) {
      throw new Error(`RO not found with ID ${roid}`);
    }

    const roStatus = roRows[0].status;

    const payload = {
      event:                     'skysoft_quickjob.created',
      roid:                      parseInt(roid),
      skysoft_defect_id:         parseInt(skysoftDefectId),
      external_garage_defect_id: parseInt(externalGarageDefectId),
      rpor_id:                   parseInt(rporId),
      status:                    parseInt(roStatus)   // ← live value from DB
    };

    const requestLog = `Garage Webhook Request initiated (QuickJob RO ${roid} skysoft_quickjob.created): ${JSON.stringify(payload)}`;
    await this.logToFile(requestLog);

    const response = await axios.post(this.webhookUrl, payload, {
      headers: {
        'Authorization': `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    const responseLog = `Garage Webhook Response (QuickJob RO ${roid} skysoft_quickjob.created): Status ${response.status} - ${JSON.stringify(response.data)}`;
    await this.logToFile(responseLog);

    await this.logToDatabase(
      roid,
      garageUserId,
      `Garage QuickJob webhook triggered — RO ${roid} | VRL ${skysoftDefectId} | Garage defect ${externalGarageDefectId} | RPOR ${rporId}`
    );

    return {
      success: true,
      status: response.status,
      data: response.data
    };

  } catch (error) {
    const errorLog = `Garage Webhook Error (QuickJob RO ${roid} skysoft_quickjob.created): ${error.message}`;
    await this.logToFile(errorLog);

    await this.logToDatabase(
      roid,
      garageUserId,
      `Garage QuickJob webhook FAILED — RO ${roid} | VRL ${skysoftDefectId} | Garage defect ${externalGarageDefectId}: ${error.message}`
    );

    return {
      success: false,
      error: error.message,
      details: error.response?.data || null
    };
  }
}
/**
 * Send webhook for WorkOrder RO creation with multiple defects (Skysoft → Garage)
 * Called after successful RO + multiple VRLs + RPORs insertion from Work_Order_Creation_Without_RO payload
 *
 * @param {number} roid - Repair Order ID (newly created, shared by all defects)
 * @param {Array}  defects - Array of { skysoft_defect_id, external_garage_defect_id, rpor_id }
 * @param {number} garageUserId - User ID for logging
 * @returns {Promise<Object>} - Webhook response
 */
async notifyWorkOrderCreated(roid, defects, garageUserId = null) {
  if (!this.enabled) {
    return { success: false, message: 'Webhook not configured' };
  }

  try {
    // Fetch fresh RO status from DB — same pattern as notifyQuickJobCreated
    const [roRows] = await db.query(
      `SELECT status FROM repair_purchase_orders WHERE id = ? LIMIT 1`,
      [roid]
    );

    if (!roRows || roRows.length === 0) {
      throw new Error(`RO not found with ID ${roid}`);
    }

    const roStatus = roRows[0].status;

    const payload = {
      event:   'skysoft_workorder.created',
      roid:    parseInt(roid),
      status:  parseInt(roStatus),
      defects: defects.map(d => ({
        skysoft_defect_id:         parseInt(d.skysoft_defect_id),
        external_garage_defect_id: parseInt(d.external_garage_defect_id),
        rpor_id:                   parseInt(d.rpor_id)
      }))
    };

    const requestLog = `Garage Webhook Request initiated (WorkOrder RO ${roid} skysoft_workorder.created): ${JSON.stringify(payload)}`;
    await this.logToFile(requestLog);

    const response = await axios.post(this.webhookUrl, payload, {
      headers: {
        'Authorization': `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    const responseLog = `Garage Webhook Response (WorkOrder RO ${roid} skysoft_workorder.created): Status ${response.status} - ${JSON.stringify(response.data)}`;
    await this.logToFile(responseLog);

    await this.logToDatabase(
      roid,
      garageUserId,
      `Garage WorkOrder webhook triggered — RO ${roid} | ${defects.length} defect(s) | IDs: ${defects.map(d => d.external_garage_defect_id).join(', ')}`
    );

    return {
      success: true,
      status:  response.status,
      data:    response.data
    };

  } catch (error) {
    const errorLog = `Garage Webhook Error (WorkOrder RO ${roid} skysoft_workorder.created): ${error.message}`;
    await this.logToFile(errorLog);

    await this.logToDatabase(
      roid,
      garageUserId,
      `Garage WorkOrder webhook FAILED — RO ${roid} | ${defects.length} defect(s): ${error.message}`
    );

    return {
      success: false,
      error:   error.message,
      details: error.response?.data || null
    };
  }
}
  /**
 * Send webhook for defect removal from RO (Skysoft → Garage)
 * Called after successful RPOR deletion and VRL update
 * 
 * Indicates that a defect/service request has been unlinked from an RO
 * and is no longer associated with that repair order
 * 
 * @param {number} skysoftDefectId - VRL ID (Skysoft defect identifier)
 * @param {number} externalGarageDefectId - Garage defect_id (external reference)
 * @param {number} roid - Repair Order ID (the one it's being removed from)
 * @param {number} rporId - Repair Purchase Order ID (being deleted)
 * @param {number} roStatus - RO status (0=Open, 1=In Progress, 2=Completed, 3=Reopened)
 * @param {number} garageUserId - User ID for logging
 * @returns {Promise<Object>} - Webhook response
 */
async notifyDefectRemoved(skysoftDefectId, externalGarageDefectId, roid, rporId, roStatus = 1, garageUserId = null) {
  // Skip if webhook not configured
  if (!this.enabled) {
    return { success: false, message: 'Webhook not configured' };
  }

  try {
    const payload = {
      event: 'skysoft_defect.removed',
      skysoft_defect_id: parseInt(skysoftDefectId),
      external_garage_defect_id: parseInt(externalGarageDefectId),
      roid: parseInt(roid),
      status: parseInt(roStatus)      // RO Status
      
    };

    const requestLog = `Garage Webhook Request initiated (RO ${roid} updated): ${JSON.stringify(payload)}`;
    await this.logToFile(requestLog);

    const response = await axios.post(this.webhookUrl, payload, {
      headers: {
        'Authorization': `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    const responseLog = `Garage Webhook Response (Defect ${externalGarageDefectId} skysoft_defect.removed): Status ${response.status} - ${JSON.stringify(response.data)}`;
    await this.logToFile(responseLog);

    await this.logToDatabase(
      roid,
      garageUserId,
      `Garage defect removed webhook triggered (VRL ${skysoftDefectId}, Garage defect ${externalGarageDefectId}, RPOR ${rporId}, RO status ${roStatus})`
    );

    return {
      success: true,
      status: response.status,
      data: response.data
    };

  } catch (error) {
    const errorLog = `Garage Webhook Error (Defect ${externalGarageDefectId} skysoft_defect.removed): ${error.message}`;
    await this.logToFile(errorLog);

    await this.logToDatabase(
      roid,
      garageUserId,
      `Garage defect removal webhook FAILED (VRL ${skysoftDefectId}, Garage defect ${externalGarageDefectId}): ${error.message}`
    );

    return {
      success: false,
      error: error.message,
      details: error.response?.data || null
    };
  }
}


/**
 * Send webhook for entire RO cancellation (Skysoft → Garage)
 * Called when user cancels the entire Repair Order
 * Notifies Garage that the RO and all associated defects are cancelled
 * 
 * @param {number} roid - Repair Order ID being cancelled
 * @param {number} garageUserId - User ID for logging
 * @returns {Promise<Object>} - Webhook response
 */
async notifyROCancelled(roid, garageUserId = null) {
  // Skip if webhook not configured
  if (!this.enabled) {
    return { success: false, message: 'Webhook not configured' };
  }

  try {
    const payload = {
      event: 'ro.cancelled',
      roid: parseInt(roid),
      status: 3,  // Cancelled status
      timestamp: new Date().toISOString()
    };

    const requestLog = `Garage Webhook Request initiated (RO ${roid} ro.cancelled): ${JSON.stringify(payload)}`;
    await this.logToFile(requestLog);

    const response = await axios.post(this.webhookUrl, payload, {
      headers: {
        'Authorization': `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    const responseLog = `Garage Webhook Response (RO ${roid} ro.cancelled): Status ${response.status} - ${JSON.stringify(response.data)}`;
    await this.logToFile(responseLog);

    await this.logToDatabase(
      roid,
      garageUserId,
      `Garage RO cancellation webhook triggered (RO ${roid} status set to cancelled)`
    );

    return {
      success: true,
      status: response.status,
      data: response.data
    };

  } catch (error) {
    const errorLog = `Garage Webhook Error (RO ${roid} ro.cancelled): ${error.message}`;
    await this.logToFile(errorLog);

    await this.logToDatabase(
      roid,
      garageUserId,
      `Garage RO cancellation webhook FAILED (RO ${roid}): ${error.message}`
    );

    return {
      success: false,
      error: error.message,
      details: error.response?.data || null
    };
  }
}
}

// Export singleton instance
module.exports = new GarageWebhookService();
