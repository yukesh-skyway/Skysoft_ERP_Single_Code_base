/**
 * Motive Defect Service
 * Handles syncing defect statuses with Motive API after manager approval
 * 
 * Matches PHP implementation:
 * - pushToMotive($defectId)
 * - buildMotivePayload($defectData, $allDefectIds)
 */

const axios = require('axios');
const db = require('../../db/connection');
const fs = require('fs');
const path = require('path');

class MotiveDefectService {
  constructor() {
    this.apiKey = process.env.MOTIVE_API_KEY || '';
    this.baseUrl = 'https://api.gomotive.com/v2';
    this.logDir = path.join(__dirname, '../../app-log/motive');
  }

  /**
   * Main function to push defect status updates to Motive API
   * Matches PHP: pushToMotive($defectId)
   * 
   * @param {number} defectId - Primary defect ID
   * @returns {Promise<Object>} - {success: 'OK'|'NOOK', message, detail, defect_ids_synced}
   */
  async pushToMotive(defectId) {
    const logFile = this.getLogFilePath();
    
    try {
      if (!defectId) {
        throw new Error('Missing defect_id');
      }

      // Validate API Key
      if (!this.apiKey) {
        const errorMsg = 'MOTIVE_API_KEY not configured in environment variables';
        this.logToFile(logFile, `❌ ${errorMsg}`);
        console.error('❌ MOTIVE API ERROR:', errorMsg);
        return {
          success: 'NOOK',
          message: 'Motive sync failed - API key missing',
          detail: errorMsg
        };
      }

      this.logToFile(logFile, `➡️ Incoming request with defect_id: ${defectId}`);

      // 1. Fetch primary defect (ONLY Motive defects)
      const defectQuery = `
        SELECT * FROM vehicle_repair_logs 
        WHERE id = ? AND defect_source = 'motive'
        LIMIT 1
      `;
      const [defects] = await db.query(defectQuery, [defectId]);

      if (!defects || defects.length === 0) {
        throw new Error('Defect not found or not a Motive defect');
      }

      const defectData = defects[0];
      
      this.logToFile(logFile, `📋 Fetched defect - ID: ${defectData.id}, Motive Defect ID: ${defectData.motive_defect_id}, Motive Record ID: ${defectData.motive_record_id}`);

      // 2. Validate Motive IDs
      if (!defectData.motive_defect_id || !defectData.motive_record_id) {
        throw new Error('Missing Motive IDs (motive_defect_id or motive_record_id)');
      }

      // 3. Check if merged group - get ALL Motive defects in group WITH their motive_record_ids
      let defectsToSync = [];

      if (defectData.merged_records_id && defectData.is_duplicate === 'n') {
        // Primary defect in merged group → get all Motive defects in group
        const mergedQuery = `
          SELECT id, motive_defect_id, motive_record_id, motive_inspection_isodate, logged_on, defect_status
          FROM vehicle_repair_logs 
          WHERE merged_records_id = ? 
            AND defect_source = 'motive'
            AND motive_defect_id IS NOT NULL
            AND motive_record_id IS NOT NULL
        `;
        const [mergedDefects] = await db.query(mergedQuery, [defectData.merged_records_id]);
        defectsToSync = mergedDefects;
        
        this.logToFile(logFile, `🔍 Detected merge_id: ${defectData.merged_records_id}`);
        this.logToFile(logFile, `📋 Fetched ${defectsToSync.length} defects in merge group: [${defectsToSync.map(d => d.id).join(', ')}]`);
      } else {
        // Standalone defect
        defectsToSync = [defectData];
      }

      // 4. Group defects by motive_record_id
      const groupedByReport = {};
      
      defectsToSync.forEach(d => {
        const recordId = d.motive_record_id;
        if (!groupedByReport[recordId]) {
          groupedByReport[recordId] = [];
        }
        groupedByReport[recordId].push(d);
      });

      this.logToFile(logFile, `🗂️ Grouped by motive_record_id:`);
      Object.keys(groupedByReport).forEach(recordId => {
        const defectIds = groupedByReport[recordId].map(d => d.motive_defect_id);
        this.logToFile(logFile, `   - Report ${recordId}: [${defectIds.join(', ')}]`);
      });

      // 5. Loop through each unique motive_record_id and send separate API calls
      const allSyncedDefectIds = [];
      let successCount = 0;
      let failCount = 0;
      const errors = [];

      for (const [motiveRecordId, defectsInReport] of Object.entries(groupedByReport)) {
        try {
          // Get unique motive_defect_ids for this report
          const motiveDefectIds = [...new Set(defectsInReport.map(d => parseInt(d.motive_defect_id)).filter(id => id > 0))];
          
          if (motiveDefectIds.length === 0) {
            this.logToFile(logFile, `⚠️ No valid defect IDs for report ${motiveRecordId}, skipping...`);
            continue;
          }

          // Use the first defect's data for payload (they all have same status)
          const sampleDefect = defectsInReport[0];
          
          // Build payload for THIS report only
          const payload = this.buildMotivePayload(sampleDefect, motiveDefectIds);
          
          // Send PUT request to Motive API
          const inspectionTime = sampleDefect.motive_inspection_isodate || sampleDefect.logged_on;
          const url = `${this.baseUrl}/inspection_reports/${motiveRecordId}?time=${encodeURIComponent(inspectionTime)}`;
          
          this.logToFile(logFile, `🚀 Sending PUT to report ${motiveRecordId}`);
          this.logToFile(logFile, `📦 Payload: ${JSON.stringify(payload)}`);
          
          const headers = {
            'accept': 'application/json',
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'X-Time-Zone': 'Eastern Time (US & Canada)',
            'X-Metric-Units': 'true'
          };

          const response = await axios.put(url, payload, {
            headers,
            timeout: 30000 // 30 second timeout
          });
          
          this.logToFile(logFile, `✅ Success: ${response.status} OK`);
          
          allSyncedDefectIds.push(...motiveDefectIds);
          successCount++;
          
        } catch (error) {
          failCount++;
          const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
          const statusCode = error.response?.status || 'N/A';
          
          this.logToFile(logFile, `❌ Failed to sync report ${motiveRecordId}: ${errorMessage} (HTTP ${statusCode})`);
          errors.push({
            motiveRecordId,
            error: errorMessage,
            statusCode
          });
          
          console.error(`❌ MOTIVE API SYNC FAILED for report ${motiveRecordId}:`, errorMessage);
        }
      }

      // 6. Final summary
      const totalReports = Object.keys(groupedByReport).length;
      
      this.logToFile(logFile, `📊 Summary: ${successCount}/${totalReports} reports synced successfully`);
      this.logToFile(logFile, `💾 Updated ${allSyncedDefectIds.length} Motive defect(s) total: [${allSyncedDefectIds.join(', ')}]`);
      
      if (failCount > 0) {
        this.logToFile(logFile, `⚠️ ${failCount} report(s) failed to sync`);
      }

      // Return success if at least one report was synced
      if (successCount > 0) {
        return {
          success: 'OK',
          message: `Successfully synced ${successCount}/${totalReports} Motive report(s) with ${allSyncedDefectIds.length} defect(s)`,
          defect_ids_synced: allSyncedDefectIds,
          reports_synced: successCount,
          reports_failed: failCount,
          errors: errors.length > 0 ? errors : undefined
        };
      } else {
        throw new Error(`Failed to sync all ${totalReports} report(s): ${errors.map(e => e.error).join('; ')}`);
      }

    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
      const errorDetail = error.response?.data || error.message;
      const statusCode = error.response?.status || 'N/A';

      this.logToFile(logFile, `❌ Motive Push Error: ${errorMessage} for defect_id: ${defectId}`);
      this.logToFile(logFile, `   HTTP Status Code: ${statusCode}`);
      this.logToFile(logFile, `   Error details: ${JSON.stringify(errorDetail)}`);
      
      // Enhanced console logging for debugging
      console.error('❌ MOTIVE API SYNC FAILED:');
      console.error('   Status Code:', statusCode);
      console.error('   Error Message:', errorMessage);
      console.error('   Full Response:', error.response?.data);

      return {
        success: 'NOOK',
        message: 'Motive sync failed',
        detail: `${errorMessage} (HTTP ${statusCode})`,
        full_error: errorDetail
      };
    }
  }

  /**
   * Build Motive API payload
   * Matches PHP: buildMotivePayload($defectData, $resolvedDefectIds)
   * 
   * @param {Object} defectData - Defect details from database
   * @param {Array<number>} resolvedDefectIds - Array of Motive defect IDs to mark as resolved
   * @returns {Object} - Motive API payload
   */
  buildMotivePayload(defectData, resolvedDefectIds) {
    const currentStatus = defectData.defect_status || '';
    
    // Use motive_inspection_isodate if available, otherwise fallback to logged_on
    let time = defectData.motive_inspection_isodate || defectData.logged_on || '';

    if (!time) {
      throw new Error('Invalid inspection date (both motive_inspection_isodate and logged_on are missing)');
    }

    // Log which field was used
    if (defectData.motive_inspection_isodate) {
      console.log('✅ Using motive_inspection_isodate:', defectData.motive_inspection_isodate);
    } else {
      console.log('⚠️ motive_inspection_isodate missing - using logged_on as fallback:', defectData.logged_on);
    }

    // Mechanic note based on status
    const mechanicNote = (currentStatus === 'Completed')
      ? 'Issue has been inspected and fully resolved by maintenance.'
      : 'No issues found during inspection.';

    
    // Ensure all IDs are valid integers
    const resolvedDefects = resolvedDefectIds
      .map(id => parseInt(id))
      .filter(id => id > 0);

    const uniqueDefects = [...new Set(resolvedDefects)];

    if (uniqueDefects.length === 0) {
      throw new Error('No valid defect IDs provided');
    }

    // Build payload matching PHP structure exactly
    return {
      time: time,
      inspection_report: {
        status: 'corrected'
      },
      defect_statuses: {
        status: (currentStatus === 'Completed') ? 'repaired' : 'no_repair_needed',
        mechanic_note: mechanicNote,
        mechanic_name: 'Ronaldo Newton', // Hardcoded as per PHP
        mechanic_signed_at: new Date().toISOString(), // ISO 8601 format
        resolved_defects: uniqueDefects
      }
    };
  }

  /**
   * Get log file path for current date
   * Matches PHP: /app-log/motive/motive_update_log_YYYY-MM-DD.txt
   */
  getLogFilePath() {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const fileName = `motive_update_log_${date}.txt`;
    
    // Ensure log directory exists
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }

    return path.join(this.logDir, fileName);
  }

  /**
   * Log message to file
   * Matches PHP: logFileMsg($logFile, $message)
   */
  logToFile(logFile, message) {
    try {
      const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const logMessage = `${timestamp} ${message}\n`;
      fs.appendFileSync(logFile, logMessage, 'utf8');
    } catch (error) {
      console.error('Failed to write to log file:', error.message);
    }
  }

  /**
   * Console logging for debugging
   */
  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = `[Motive Defect Service ${timestamp}]`;
    
    switch (level) {
      case 'error':
        console.error(`${prefix} ❌`, message);
        break;
      case 'success':
        console.log(`${prefix} ✅`, message);
        break;
      default:
        console.log(`${prefix} ℹ️`, message);
    }
  }
}

module.exports = new MotiveDefectService();
