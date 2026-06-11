/**
 * Webhook Logger Utility
 * Dual logging system: File + Database
 * 
 * Matches PHP implementation:
 * - Writes to daily text log files (garage_api_call_log_YYYY-MM-DD.txt)
 * - Writes to database (vm_logs table)
 * - Writes raw requests to JSON files (raw_requests_YYYY-MM-DD.json)
 */

const fs = require('fs').promises;
const path = require('path');
const db = require('../db/connection');

// Log directory (configurable via .env)
const LOG_DIR = path.join(__dirname, '../logs/webhooks');

/**
 * Ensure log directory exists
 */
async function ensureLogDirectory() {
  try {
    await fs.mkdir(LOG_DIR, { recursive: true });
  } catch (error) {
    console.error('❌ Error creating log directory:', error);
  }
}

/**
 * Get current date string in YYYY-MM-DD format
 */
function getDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Log to daily text file
 * 
 * @param {string} message - Log message
 * @param {object} data - Additional data to log
 */
async function logToFile(message, data = {}) {
  try {
    await ensureLogDirectory();

    const dateStr = getDateString();
    const logFile = path.join(LOG_DIR, `garage_api_call_log_${dateStr}.txt`);
    
    console.log('📝 Attempting to write log file:', logFile);
    console.log('📝 Message:', message);

    const timestamp = new Date().toISOString();
    const safeData = data || {};                                    // ← ADD
    const { oldValue, newValue, rawLog, ...meta } = safeData;      // ← use safeData

    const separator = '-'.repeat(40);
    let logEntry = `[${timestamp}] ${message}\n`;
    logEntry += `${JSON.stringify(meta, null, 2)}\n`;
    logEntry += `\n${separator} Old Value ${separator}\n`;
    logEntry += oldValue && Object.keys(oldValue).length > 0
      ? JSON.stringify(oldValue, null, 2)
      : '(no data)';
    logEntry += `\n\n${separator} New Value ${separator}\n`;
    logEntry += newValue && Object.keys(newValue).length > 0
      ? JSON.stringify(newValue, null, 2)
      : '(no data)';
    logEntry += `\n\n${separator} Raw Log from Garage ${separator}\n`;
    logEntry += rawLog && Object.keys(rawLog).length > 0
      ? JSON.stringify(rawLog, null, 2)
      : '(no raw data)';
    logEntry += `\n${'='.repeat(80)}\n`;

    await fs.appendFile(logFile, logEntry, 'utf8');
    console.log('✅ Log file written successfully');              // ← ADD
  } catch (error) {
    console.error('❌ Error writing to log file:', error);
    console.error('❌ Stack:', error.stack);                      // ← ADD
  }
}

/**
 * Log raw request to JSON file
 * Useful for debugging and replay
 * 
 * @param {object} req - Express request object
 * @param {object} data - Additional data to log
 */
async function logRawRequest(req, data = {}) {
  try {
    await ensureLogDirectory();

    const dateStr = getDateString();
    const logFile = path.join(LOG_DIR, `raw_requests_${dateStr}.json`);

    const rawRequest = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      headers: req.headers,
      query: req.query,
      body: req.body,
      ip: req.ip || req.connection.remoteAddress,
      ...data
    };

    // Read existing file (if exists)
    let requests = [];
    try {
      const content = await fs.readFile(logFile, 'utf8');
      requests = JSON.parse(content);
    } catch (error) {
      // File doesn't exist or is invalid JSON - start fresh
      requests = [];
    }

    // Append new request
    requests.push(rawRequest);

    // Write back to file
    await fs.writeFile(logFile, JSON.stringify(requests, null, 2), 'utf8');
  } catch (error) {
    console.error('❌ Error writing raw request log:', error);
  }
}

/**
 * Log to database (vm_logs table)
 * 
 * @param {number} userId - User ID (from API token)
 * @param {string} source - Source of the log entry (e.g., "Garage Webhook")
 * @param {string} action - Action performed
 * @param {object} oldValue - Old value (before change)
 * @param {object} newValue - New value (after change)
 */
async function logToDatabase(userId, source, action, oldValue = null, newValue = null) {
  try {
    await db.query(
      `INSERT INTO vm_logs 
       (user_id, log_data, log_time)
       VALUES (?, ?, NOW())`,
      [userId, action]
    );
  } catch (error) {
    console.error('❌ Error writing to database log:', error);
  }
}

/**
 * Log webhook activity (dual logging: file + database)
 * 
 * @param {object} req - Express request object
 * @param {string} action - Action performed
 * @param {object} options - Logging options
 * @param {object} options.oldValue - Old value (before change)
 * @param {object} options.newValue - New value (after change)
 * @param {object} options.additionalData - Additional data to log
 */

async function logWebhookActivity(req, action, options = {}) {
  const {
    oldValue = null,
    newValue = null,
    rawLog = null,
    additionalData = {}
  } = options;

  const userId = req.apiToken?.userId || null;
  const source = 'Garage Webhook';

  // Each log call is independent — one failure won't kill the others
  await logToFile(action, {
    userId,
    source,
    path: req.path,
    method: req.method,
    oldValue,
    newValue,
    rawLog,
    ...additionalData
  }).catch(e => console.error('❌ logToFile failed:', e));

  if (userId) {
    await logToDatabase(userId, source, action, oldValue, newValue)
      .catch(e => console.error('❌ logToDatabase failed:', e));
  }

  if (process.env.WEBHOOK_LOG_RAW_REQUESTS === 'true') {
    await logRawRequest(req, { action, ...additionalData })
      .catch(e => console.error('❌ logRawRequest failed:', e));
  }
}

/**
 * Log defect update
 * 
 * @param {object} req - Express request object
 * @param {number} roId - Repair order ID
 * @param {number} defectId - Defect ID
 * @param {object} oldStatus - Old status data
 * @param {object} newStatus - New status data
 */
async function logDefectUpdate(req, roId, defectId, oldStatus, newStatus) {
  await logWebhookActivity(req, `Defect Update - RO #${roId}, Defect #${defectId}`, {
    oldValue: oldStatus,
    newValue: newStatus,
    additionalData: {
      roId,
      defectId,
      statusChange: `${oldStatus.status} → ${newStatus.status}`
    }
  });
}

/**
 * Log RO (Repair Order) update
 * 
 * @param {object} req - Express request object
 * @param {number} roId - Repair order ID
 * @param {object} updates - Update details
 */
async function logROUpdate(req, roId, updates) {
  await logWebhookActivity(req, `RO Update - RO #${roId}`, {
    oldValue: updates.old,
    newValue: updates.new,
    additionalData: {
      roId,
      updateType: updates.type || 'full',
      itemsUpdated: updates.itemsUpdated || 0
    }
  });
}

/**
 * Log scheduled maintenance update
 * 
 * @param {object} req - Express request object
 * @param {number} smId - Scheduled maintenance ID
 * @param {object} oldData - Old data
 * @param {object} newData - New data
 */
async function logScheduledMaintenanceUpdate(req, smId, oldData, newData) {
  await logWebhookActivity(req, `Scheduled Maintenance Update - SM #${smId}`, {
    oldValue: oldData,
    newValue: newData,
    additionalData: {
      smId,
      statusChange: `${oldData.status} → ${newData.status}`
    }
  });
}

/**
 * Log Motive API sync
 * 
 * @param {object} req - Express request object
 * @param {string} action - Motive action performed
 * @param {object} data - Sync data
 * @param {boolean} success - Whether sync was successful
 */
async function logMotiveSync(req, action, data, success = true) {
  await logWebhookActivity(req, `Motive Sync - ${action} (${success ? 'Success' : 'Failed'})`, {
    newValue: data,
    additionalData: {
      motiveAction: action,
      success,
      timestamp: new Date().toISOString()
    }
  });
}

module.exports = {
  logToFile,
  logRawRequest,
  logToDatabase,
  logWebhookActivity,
  logDefectUpdate,
  logROUpdate,
  logScheduledMaintenanceUpdate,
  logMotiveSync
};
