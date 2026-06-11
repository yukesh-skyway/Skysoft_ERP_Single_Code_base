/**
 * VRL Creation Logger Utility
 * Dual logging system: File + Database
 * 
 * Logs all VRL creation activity from Garage defects:
 * - Daily text log files (vrl_creation_log_YYYY-MM-DD.txt)
 * - Database vm_logs table
 * - Raw payloads for debugging (vrl_raw_payloads_YYYY-MM-DD.json)
 */

const fs = require('fs').promises;
const path = require('path');
const db = require('../../api/db/connection');

// Log directory (configurable via .env)
//const LOG_DIR = process.env.VRL_LOG_DIR || path.join(__dirname, '../../logs/vrl');
const LOG_DIR = path.join(__dirname, '../logs/vrl');

/**
 * Ensure log directory exists
 */
async function ensureLogDirectory() {
  try {
    await fs.mkdir(LOG_DIR, { recursive: true });
  } catch (error) {
    console.error('❌ Error creating VRL log directory:', error);
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
 * Get current timestamp in ISO format
 */
function getTimestamp() {
  return new Date().toISOString();
}

/**
 * Log VRL creation to daily text file
 * 
 * @param {string} action - Action performed (e.g., "VRL_CREATED", "VRL_SKIPPED", "VRL_ERROR")
 * @param {object} details - Details to log
 */
async function logToFile(action, details = {}) {
  try {
    await ensureLogDirectory();

    const dateStr = getDateString();
    const logFile = path.join(LOG_DIR, `vrl_creation_log_${dateStr}.txt`);
    const timestamp = getTimestamp();

    const {
      vrlId = null,
      externalDefectId = null,
      roId = null,
      rpoId = null,
      vehicleId = null,
      defectStatus = null,
      oldValue = null,
      newValue = null,
      errorMessage = null,
      webhookResult = null,
      duration = 0,
      ...extra
    } = details;

    const separator = '-'.repeat(80);
    let logEntry = `\n[${timestamp}] ${action}\n`;
    logEntry += `${separator}\n`;

    // Key details
    logEntry += `VRL ID:              ${vrlId || 'N/A'}\n`;
    logEntry += `External Defect ID:  ${externalDefectId || 'N/A'}\n`;
    logEntry += `RO ID:               ${roId || 'N/A'}\n`;
    logEntry += `RPO ID:              ${rpoId || 'N/A'}\n`;
    logEntry += `Vehicle ID:          ${vehicleId || 'N/A'}\n`;
    logEntry += `Defect Status:       ${defectStatus || 'N/A'}\n`;
    logEntry += `Duration (ms):       ${duration}\n`;

    // Old value (before)
    if (oldValue && Object.keys(oldValue).length > 0) {
      logEntry += `\n${separator} Before State ${separator}\n`;
      logEntry += JSON.stringify(oldValue, null, 2);
    }

    // New value (after)
    if (newValue && Object.keys(newValue).length > 0) {
      logEntry += `\n\n${separator} After State ${separator}\n`;
      logEntry += JSON.stringify(newValue, null, 2);
    }

    // Webhook result
    if (webhookResult) {
      logEntry += `\n\n${separator} Webhook Notification ${separator}\n`;
      logEntry += `Status: ${webhookResult.success ? '✅ SUCCESS' : '❌ FAILED'}\n`;
      if (webhookResult.success) {
        logEntry += `HTTP Status: ${webhookResult.status}\n`;
        logEntry += `Response: ${JSON.stringify(webhookResult.data, null, 2)}\n`;
      } else {
        logEntry += `Error: ${webhookResult.error}\n`;
        if (webhookResult.details) {
          logEntry += `Details: ${JSON.stringify(webhookResult.details, null, 2)}\n`;
        }
      }
    }

    // Error message
    if (errorMessage) {
      logEntry += `\n\n${separator} Error ${separator}\n`;
      logEntry += `${errorMessage}\n`;
    }

    // Extra data
    if (Object.keys(extra).length > 0) {
      logEntry += `\n\n${separator} Additional Data ${separator}\n`;
      logEntry += JSON.stringify(extra, null, 2);
    }

    logEntry += `\n${'='.repeat(80)}\n`;

    await fs.appendFile(logFile, logEntry, 'utf8');
  } catch (error) {
    console.error('❌ Error writing VRL log file:', error);
  }
}

/**
 * Log raw payload for debugging
 * 
 * @param {object} payload - Garage defect payload
 * @param {number} roId - RO ID
 * @param {number} externalDefectId - Defect ID
 */
async function logRawPayload(payload, roId, externalDefectId) {
  try {
    await ensureLogDirectory();

    const dateStr = getDateString();
    const logFile = path.join(LOG_DIR, `vrl_raw_payloads_${dateStr}.json`);

    const rawEntry = {
      timestamp: getTimestamp(),
      roId,
      externalDefectId,
      payload
    };

    // Read existing file (if exists)
    let payloads = [];
    try {
      const content = await fs.readFile(logFile, 'utf8');
      payloads = JSON.parse(content);
    } catch (error) {
      // File doesn't exist or is invalid JSON - start fresh
      payloads = [];
    }

    // Append new payload
    payloads.push(rawEntry);

    // Write back to file
    await fs.writeFile(logFile, JSON.stringify(payloads, null, 2), 'utf8');
  } catch (error) {
    console.error('❌ Error writing raw payload log:', error);
  }
}

/**
 * Log to database (vm_logs table)
 * 
 * @param {number} roId - RO ID
 * @param {number} userId - User ID (Garage Mechanics)
 * @param {string} message - Log message
 */
async function logToDatabase(roId, userId, message) {
  try {
    await db.query(
      `INSERT INTO vm_logs (ro_id, user_id, log_data, log_time)
       VALUES (?, ?, ?, NOW())`,
      [roId, userId, message]
    );
  } catch (error) {
    console.error('❌ Error writing VRL log to database:', error);
  }
}

/**
 * Log VRL creation success
 * 
 * @param {object} vrlResult - VRL creation result
 * @param {object} webhookResult - Webhook notification result
 * @param {number} roId - RO ID
 * @param {number} userId - User ID (Garage Mechanics)
 * @param {number} duration - Duration in ms
 */
async function logVRLCreated(vrlResult, webhookResult, roId, userId, duration = 0) {
  const action = 'VRL_CREATED ✅';
  
  await logToFile(action, {
    vrlId: vrlResult.vrl_id,
    externalDefectId: vrlResult.external_garage_defect_id,
    roId: vrlResult.ro_id,
    rpoId: vrlResult.rpo_id,
    vehicleId: vrlResult.vehicle,
    defectStatus: vrlResult.defect_status,
    newValue: vrlResult,
    webhookResult,
    duration
  });

  await logToDatabase(
    roId,
    userId,
    `VRL Creation SUCCESS: VRL #${vrlResult.vrl_id}, Garage Defect #${vrlResult.external_garage_defect_id}, Vehicle #${vrlResult.vehicle}, Status: ${vrlResult.defect_status}`
  );
}

/**
 * Log VRL creation skipped (duplicate)
 * 
 * @param {object} skipResult - Skip result
 * @param {number} roId - RO ID
 * @param {number} userId - User ID (Garage Mechanics)
 */
async function logVRLSkipped(skipResult, roId, userId) {
  const action = 'VRL_SKIPPED ⏭️';
  
  await logToFile(action, {
    vrlId: skipResult.existing_vrl_id,
    externalDefectId: skipResult.external_garage_defect_id,
    roId: skipResult.ro_id,
    vehicleId: skipResult.vehicle,
    defectStatus: skipResult.existing_status,
    newValue: skipResult,
    duration: skipResult.duration_ms
  });

  await logToDatabase(
    roId,
    userId,
    `VRL Creation SKIPPED (Duplicate): Garage Defect #${skipResult.external_garage_defect_id} already exists as VRL #${skipResult.existing_vrl_id}`
  );
}

/**
 * Log VRL creation error
 * 
 * @param {object} defect - Defect object
 * @param {number} roId - RO ID
 * @param {number} userId - User ID (Garage Mechanics)
 * @param {Error} error - Error object
 * @param {number} duration - Duration in ms
 */
async function logVRLError(defect, roId, userId, error, duration = 0) {
  const action = 'VRL_ERROR ❌';
  
  await logToFile(action, {
    externalDefectId: defect?.defect_id || 'UNKNOWN',
    roId,
    defectStatus: defect?.status || 'N/A',
    errorMessage: error.message,
    duration,
    errorStack: error.stack,
    defectPayload: defect
  });

  await logToDatabase(
    roId,
    userId,
    `VRL Creation ERROR: Garage Defect #${defect?.defect_id || 'UNKNOWN'} failed - ${error.message}`
  );
}

/**
 * Log batch VRL creation summary
 * 
 * @param {object} batchResults - Batch results from createMultipleVRLsFromGarageDefects
 * @param {number} roId - RO ID
 * @param {number} userId - User ID (Garage Mechanics)
 */
async function logBatchVRLCreation(batchResults, roId, userId) {
  const action = 'VRL_BATCH_COMPLETE 📊';
  
  await logToFile(action, {
    roId,
    newValue: {
      summary: batchResults.summary,
      created: batchResults.created.length,
      skipped: batchResults.skipped.length,
      failed: batchResults.failed.length
    },
    duration: batchResults.summary.duration_ms,
    createdDetails: batchResults.created,
    skippedDetails: batchResults.skipped,
    failedDetails: batchResults.failed
  });

  await logToDatabase(
    roId,
    userId,
    `VRL Batch Creation COMPLETE: ${batchResults.summary.succeeded} created, ${batchResults.summary.skipped} skipped, ${batchResults.summary.failed} failed. Total duration: ${batchResults.summary.duration_ms}ms`
  );
}

/**
 * Log webhook notification for defect
 * 
 * @param {object} payload - Webhook payload sent to Garage
 * @param {object} result - Webhook response result
 * @param {number} roId - RO ID
 * @param {number} userId - User ID (Garage Mechanics)
 */
async function logWebhookNotification(payload, result, roId, userId) {
  const action = result.success ? 'WEBHOOK_SENT ✅' : 'WEBHOOK_FAILED ❌';
  
  await logToFile(action, {
    vrlId: payload.skysoft_defect_id,
    externalDefectId: payload.external_garage_defect_id,
    roId: payload.roid,
    rpoId: payload.rpor_id,
    newValue: {
      payload,
      result
    }
  });

  await logToDatabase(
    roId,
    userId,
    `Webhook Notification (skysoft_defect.created): VRL #${payload.skysoft_defect_id}, Defect #${payload.external_garage_defect_id} - ${result.success ? 'SUCCESS' : 'FAILED: ' + result.error}`
  );
}

module.exports = {
  logToFile,
  logRawPayload,
  logToDatabase,
  logVRLCreated,
  logVRLSkipped,
  logVRLError,
  logBatchVRLCreation,
  logWebhookNotification
};