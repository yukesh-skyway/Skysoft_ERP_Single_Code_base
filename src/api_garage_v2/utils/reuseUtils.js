/**
 * Reusable Utility Functions
 * 
 * Converted from PHP commonFunction class
 * Provides common helper methods used across the application
 */

const fs = require('fs').promises;
const path = require('path');
const db = require('../db/connection');

/**
 * Log message to file with timestamp
 * Converted from PHP: logFileMsg($logFile, $message)
 * 
 * @param {string} logFile - Path to log file
 * @param {string} message - Message to log
 */
async function logFileMsg(logFile, message) {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const logEntry = `[${timestamp}] ${message}\n`;
  
  try {
    await ensureLogDirectory(logFile);  // ← ADD THIS LINE
    await fs.appendFile(logFile, logEntry, 'utf8');
  } catch (error) {
    console.error('Failed to write to log file:', error);
  }
}

/**
 * Get defect status mapping for SkySoft and Motive
 * Converted from PHP: getDefectStatuses($decision)
 * 
 * @param {string} decision - Status decision
 * @returns {Object} Object with skysoft and motive status
 */
function getDefectStatuses(decision) {
  const statusMap = {
    'Open': { skysoft: 'Open', motive: 'open' },
    'Pending': { skysoft: 'Pending', motive: 'open' },
    'In_Progress': { skysoft: 'In_Progress', motive: 'open' },
    'Paused': { skysoft: 'Paused', motive: 'open' },
    'Reopened': { skysoft: 'Reopened', motive: 'open' },
    'Repair_Started': { skysoft: 'Repair_Started', motive: 'open' },
    'Completed': { skysoft: 'Completed', motive: 'repaired' },
    'Ro_Cancelled': { skysoft: 'Ro_Cancelled', motive: 'ro_cancelled' },
    'Rejected': { skysoft: 'Repair_Not_Required', motive: 'no_repair_needed' },
    'Repair_Not_Required': { skysoft: 'Repair_Not_Required', motive: 'no_repair_needed' }
  };

  return statusMap[decision] || { skysoft: decision, motive: 'open' };
}

/**
 * Format UTC datetime to MySQL format
 * Converted from PHP: formatUtcToMysql($utcDatetime, $timezone)
 * 
 * 🔴 CRITICAL FIX: Now converts to LOCAL server time (not UTC) to match PHP behavior
 * 
 * @param {string|null} utcDatetime - UTC datetime string (ISO format)
 * @param {string|null} timezone - Optional timezone to convert to
 * @returns {string|null} MySQL datetime format (YYYY-MM-DD HH:MM:SS) in local time
 */
function formatUtcToMysql(utcDatetime = null, timezone = null, dateOnly = false) {
  try {
    let date;
    
    if (!utcDatetime) {
      date = new Date();
    } else {
      date = new Date(utcDatetime);
    }

    if (isNaN(date.getTime())) {
      return null;
    }

    if (dateOnly) {
      // ✅ Use UTC methods to preserve the calendar date as sent
      const year  = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day   = String(date.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    // Datetime — use local time to match PHP server behavior
    const year    = date.getFullYear();
    const month   = String(date.getMonth() + 1).padStart(2, '0');
    const day     = String(date.getDate()).padStart(2, '0');
    const hours   = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } catch (error) {
    console.error('Error formatting UTC to MySQL:', error);
    return null;
  }
}

/**
 * Write activity log to database
 * Converted from PHP: writeActivityLog($sourcePage, $remark, $oldvalue, $newvalue, $userId)
 * 
 * @param {string} sourcePage - Source page/module
 * @param {string} remark - Log remark/message
 * @param {string} oldValue - Old value (JSON string)
 * @param {string} newValue - New value (JSON string)
 * @param {string|number} userId - User ID
 * @param {string|null} ipAddress - Optional IP address
 * @param {string|null} userAgent - Optional user agent
 */
async function writeActivityLog(sourcePage, remark, oldValue = '', newValue = '', userId = '', ipAddress = null, userAgent = null) {
  const logTime = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const logIP = ipAddress || 'Unknown';
  const logBrowser = userAgent || 'Unknown';
  const logUserId = userId || 'Unknown/Bot';

  try {
    await db.query(
      `INSERT INTO user_activity_logs 
       (log_date_time, log_ip, log_browser, user_id, log_source, log_remark, log_old_value, log_updated_value) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [logTime, logIP, logBrowser, logUserId, sourcePage, remark, oldValue, newValue]
    );
  } catch (error) {
    console.error('Failed to write activity log:', error);
  }
}

/**
 * Get real IP address from request
 * Converted from PHP: getRealIpAddr()
 * 
 * @param {Object} req - Express request object
 * @returns {string} IP address
 */
function getRealIpAddr(req) {
  if (req.headers['x-client-ip']) {
    return req.headers['x-client-ip'];
  }
  if (req.headers['x-forwarded-for']) {
    // x-forwarded-for may contain multiple IPs, take the first one
    return req.headers['x-forwarded-for'].split(',')[0].trim();
  }
  if (req.headers['x-real-ip']) {
    return req.headers['x-real-ip'];
  }
  if (req.connection && req.connection.remoteAddress) {
    return req.connection.remoteAddress;
  }
  if (req.socket && req.socket.remoteAddress) {
    return req.socket.remoteAddress;
  }
  return '0.0.0.0';
}

/**
 * Parse header response from HTTP response
 * Converted from PHP: parseHeaderResponse($headers)
 * 
 * @param {string} headers - Header string
 * @returns {Object} Parsed headers as key-value object
 */
function parseHeaderResponse(headers) {
  const responseArr = {};
  const tempArr = headers.split('\n');
  
  tempArr.forEach(value => {
    if (value.trim()) {
      const temp2Arr = value.split(':');
      if (temp2Arr.length >= 2) {
        const key = temp2Arr[0].trim();
        const val = temp2Arr.slice(1).join(':').trim();
        responseArr[key] = val;
      }
    }
  });

  return responseArr;
}

/**
 * Format defect captured time
 * Converted from PHP: formatDefectCapturedTime($dateString)
 * 
 * @param {string} dateString - Date string to format
 * @returns {string|null} Formatted ISO 8601 date with timezone
 */
function formatDefectCapturedTime(dateString) {
  try {
    const parsedDate = new Date(dateString);
    
    if (isNaN(parsedDate.getTime())) {
      console.error('❌ Invalid inspection date:', dateString);
      return null;
    }

    // Return ISO 8601 format with timezone
    return parsedDate.toISOString();
  } catch (error) {
    console.error('Error formatting defect captured time:', error);
    return null;
  }
}

/**
 * Convert string to safe SQL value
 * 
 * @param {any} value - Value to escape
 * @returns {string} Escaped value
 */
function escapeSql(value) {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (typeof value === 'number') {
    return value.toString();
  }
  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }
  // For string values, the database connection will handle escaping
  return value;
}

/**
 * Get current MySQL datetime
 * 
 * @returns {string} Current datetime in MySQL format
 */
function getCurrentMysqlDatetime() {
  return formatUtcToMysql();
}

/**
 * Get current MySQL date
 * 
 * @returns {string} Current date in MySQL format (YYYY-MM-DD)
 */
function getCurrentMysqlDate() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Ensure log directory exists
 * 
 * @param {string} logPath - Path to log file
 */
async function ensureLogDirectory(logPath) {
  const logDir = path.dirname(logPath);
  try {
    await fs.mkdir(logDir, { recursive: true });
  } catch (error) {
    console.error('Failed to create log directory:', error);
  }
}

/**
 * Get daily log file path
 * 
 * @param {string} logDir - Log directory
 * @param {string} prefix - Log file prefix
 * @returns {Promise<string>} Log file path
 */
async function getDailyLogFile(logDir, prefix) {
  await ensureLogDirectory(logDir);
  const today = getCurrentMysqlDate();
  return path.join(logDir, `${prefix}_${today}.txt`);
}

/**
 * Format date to match PHP format: "Mar 17, 26 - 3:45 PM"
 * 🔴 CRITICAL FIX: Matches exact PHP log time format
 * 
 * @param {Date|string} date - Date object or date string
 * @returns {string} Formatted date string
 */
function formatPhpLogTime(date) {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const day = String(d.getDate()).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2); // Last 2 digits
  
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // Hour '0' should be '12'
  
  return `${month} ${day}, ${year} - ${hours}:${minutes} ${ampm}`;
}

module.exports = {
  logFileMsg,
  getDefectStatuses,
  formatUtcToMysql,
  writeActivityLog,
  getRealIpAddr,
  parseHeaderResponse,
  formatDefectCapturedTime,
  escapeSql,
  getCurrentMysqlDatetime,
  getCurrentMysqlDate,
  ensureLogDirectory,
  getDailyLogFile,
  formatPhpLogTime
};