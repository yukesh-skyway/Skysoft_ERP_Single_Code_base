/**
 * Check if Motive API is enabled
 * 
 * @returns {boolean}
 */
function isMotiveEnabled() {
  return process.env.MOTIVE_API_ENABLED === 'true' && !!process.env.MOTIVE_API_KEY;
}

const axios = require('axios');
const db = require('../../api/db/connection');
const { logFileMsg } = require('./reuseUtils');
const path = require('path');
/**
 * Push defect status to Motive API
 * Syncs completed defect statuses back to Motive inspection reports
 * Converted from PHP: $reuseClass->pushToMotive_v2()
 * 
 * @param {number} defectId - The vehicle_repair_logs ID to sync
 * @returns {Promise<Object>} Result object with success status
 */
async function pushToMotive(defectId) {
  const logDate = new Date().toISOString().split('T')[0];
  //const logPath = `${process.env.MOTIVE_LOG_DIR || './logs/motive'}/motive_update_log_${logDate}.txt`;
  const logPath = path.join(__dirname, `../logs/motive/motive_update_log_${logDate}.txt`);

  try {
    if (!isMotiveEnabled()) {
      await logFileMsg(logPath, `Motive API is disabled. Skipping sync for defect ${defectId}.`);
      return { success: false, message: 'Motive API disabled' };
    }

    // Fetch the defect details
    const [defects] = await db.query(`
      SELECT 
        vrl.id,
        vrl.motive_record_id as motive_inspection_id,
        vrl.motive_defect_id,
        vrl.defect_status as status,
        vrl.merged_records_id as defect_merge_group_id,
        vrl.motive_inspection_isodate
      FROM vehicle_repair_logs vrl
      WHERE vrl.id = ?
    `, [defectId]);

    if (defects.length === 0) {
      await logFileMsg(logPath, `Defect ${defectId} not found in database.`);
      return { success: false, message: 'Defect not found' };
    }

    const defect = defects[0];

    // Check if this defect has Motive IDs
    if (!defect.motive_inspection_id || !defect.motive_defect_id) {
      await logFileMsg(logPath, `Defect ${defectId} is not linked to Motive (missing inspection_id or defect_id).`);
      return { success: false, message: 'Not a Motive defect' };
    }

    // ✅ GROUP DEFECTS BY INSPECTION (PHP logic!)
    let defectsToSync = [defect];
    if (defect.defect_merge_group_id) {
      const [mergedDefects] = await db.query(`
        SELECT 
          vrl.id,
          vrl.motive_record_id as motive_inspection_id,
          vrl.motive_defect_id,
          vrl.defect_status as status,
          vrl.motive_inspection_isodate
        FROM vehicle_repair_logs vrl
        WHERE vrl.merged_records_id = ?
          AND vrl.motive_record_id IS NOT NULL
          AND vrl.motive_defect_id IS NOT NULL
      `, [defect.defect_merge_group_id]);
      
      defectsToSync = mergedDefects;
    }

    // ✅ Group by inspection ID (like PHP)
    const defectsByInspection = {};
    
    for (const def of defectsToSync) {
      const inspectionId = def.motive_inspection_id;
      
      if (!defectsByInspection[inspectionId]) {
        defectsByInspection[inspectionId] = {
          inspection_date: def.motive_inspection_isodate,
          defect_ids: [],
          base_defect: def
        };
      }
      
      defectsByInspection[inspectionId].defect_ids.push(def.motive_defect_id);
    }

    await logFileMsg(logPath, `Syncing ${defectsToSync.length} defect(s) to Motive...`);

    const results = [];
    
    // ✅ Loop by inspection (not by defect!)
    for (const inspectionId in defectsByInspection) {
      const group = defectsByInspection[inspectionId];
      
      try {
        // ✅ CORRECT URL FORMAT (PHP format!)
        const url = `https://api.gomotive.com/v2/inspection_reports/${inspectionId}?time=${group.inspection_date}`;
        
// ✅ Map SkySoft status to Motive status DYNAMICALLY
let motiveStatus = 'repaired';
let noteMessage = 'Repaired by SkySoft system';

if (group.base_defect.status === 'Repair_Not_Required') {
  motiveStatus = 'no_repair_needed';
  noteMessage = 'No repair needed';
} else if (group.base_defect.status === 'Completed') {
  motiveStatus = 'repaired';
  noteMessage = 'Repaired by SkySoft system';
}

const payload = {
  defect_statuses: {
    status: motiveStatus,  // ✅ DYNAMIC!
    mechanic_note: noteMessage,  // ✅ DYNAMIC!
    resolver_id: 4753112,
    mechanic_name: 'Gobinath Subramaniyam',
    mechanic_signed_at: new Date().toISOString(),
    resolved_defects: group.defect_ids,
    external_resolver_id: group.base_defect.id.toString()
  }
};

        // ✅ CORRECT HEADERS (PHP headers!)
        const headers = {
          'accept': 'application/json',
          'Content-Type': 'application/json',
          'x-api-key': process.env.MOTIVE_API_KEY,
          'X-Time-Zone': 'Eastern Time (US & Canada)',  // ← Added!
          'X-Metric-Units': 'true'  // ← Added!
        };

        await logFileMsg(logPath, `Inspection ${inspectionId}: PUT ${url} with defect_ids=${group.defect_ids}`);

        const response = await axios.put(url, payload, { headers });

        await logFileMsg(logPath, `Inspection ${inspectionId}: Motive sync successful. Response: ${JSON.stringify(response.data)}`);
        
        results.push({ 
          inspection_id: inspectionId,
          defect_ids: group.defect_ids,
          success: true, 
          response: response.data 
        });

      } catch (error) {
        await logFileMsg(logPath, `Inspection ${inspectionId}: Motive sync failed. Error: ${error.message}`);
        if (error.response) {
          await logFileMsg(logPath, `Response status: ${error.response.status}, data: ${JSON.stringify(error.response.data)}`);
        }
        results.push({ 
          inspection_id: inspectionId,
          defect_ids: group.defect_ids,
          success: false, 
          error: error.message 
        });
      }
    }

    return {
      success: true,
      inspections_synced: results.filter(r => r.success).length,
      total_inspections: results.length,
      results
    };

  } catch (error) {
    await logFileMsg(logPath, `pushToMotive error: ${error.message}`);
    return { success: false, message: error.message };
  }
}

/**
 * Map SkySoft defect status to Motive status
 * 
 * @param {string} skysoftStatus - SkySoft status
 * @returns {string|null} Motive status or null if not applicable
 */
function mapStatusToMotive(skysoftStatus) {
  const statusMap = {
    'Completed': 'resolved',
    'Repair_Not_Required': 'resolved',
    'In_Progress': null, // Don't sync in-progress to Motive
    'Open': null,
    'Pending': null
  };

  return statusMap[skysoftStatus] || null;
}

/**
 * Fetch data from Motive API (general-purpose method)
 * Converted from PHP: $motiveClass->fetchMotiveData()
 * 
 * @param {string} endpoint - Motive API endpoint name
 * @param {string} method - HTTP method (GET, POST, PUT, DELETE)
 * @param {Object} params - Request parameters
 * @returns {Promise<Object|null>} Motive API response data
 */
async function fetchMotiveData(endpoint, method = 'GET', params = {}) {
  try {
    // Check if Motive API is enabled
    if (!isMotiveEnabled()) {
      console.log('Motive API is disabled');
      return null;
    }

    const motiveApiKey = process.env.MOTIVE_API_KEY;
    
    // Map endpoint names to actual Motive API URLs
    const endpointMap = {
      'getV2MotiveVehicleOdometer': (p) => {
        const vehicleId = p.motive_vechicle_id || p.motive_vehicle_id;
        // âœ… Correct endpoint: /v2/vehicle_locations with vehicle_ids[] parameter
        return `https://api.gomotive.com/v2/vehicle_locations?vehicle_ids[]=${vehicleId}`;
      },
      'getMotiveVehicleDetails': (p) => {
        const vehicleId = p.motive_vehicle_id;
        return `https://api.gomotive.com/v2/vehicles/${vehicleId}`;
      },
      'getMotiveInspectionReport': (p) => {
        const inspectionId = p.inspection_id;
        return `https://api.gomotive.com/v2/inspection_reports/${inspectionId}`;
      },
      'getMotiveDefectDetails': (p) => {
        const inspectionId = p.inspection_id;
        const defectId = p.defect_id;
        return `https://api.gomotive.com/v2/inspection_reports/${inspectionId}/defects/${defectId}`;
      }
      // Add more endpoint mappings as needed
    };

    // Get the URL builder function for this endpoint
    const urlBuilder = endpointMap[endpoint];
    if (!urlBuilder) {
      console.error(`Unknown Motive API endpoint: ${endpoint}`);
      return null;
    }

    // Build the URL
    const url = urlBuilder(params);

    // Prepare headers
    const headers = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'x-api-key': motiveApiKey
    };

    // Make the API request
    let response;
    const axiosConfig = { headers };

    switch (method.toUpperCase()) {
      case 'GET':
        response = await axios.get(url, axiosConfig);
        break;
      case 'POST':
        response = await axios.post(url, params.data || {}, axiosConfig);
        break;
      case 'PUT':
        response = await axios.put(url, params.data || {}, axiosConfig);
        break;
      case 'DELETE':
        response = await axios.delete(url, axiosConfig);
        break;
      default:
        throw new Error(`Unsupported HTTP method: ${method}`);
    }

    // Return the response data
    return response.data;

  } catch (error) {
    console.error('Motive API Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return null;
  }
}

/**
 * Get vehicle odometer reading from Motive
 * 
 * @param {string} motiveVehicleId - Motive vehicle ID
 * @param {string} readingDate - Date for odometer reading (YYYY-MM-DD)
 * @returns {Promise<Object|null>} Vehicle location data with odometer
 */
async function getMotiveVehicleOdometer(motiveVehicleId, readingDate = null) {
  if (!motiveVehicleId) {
    return null;
  }

  const params = {
    motive_vehicle_id: motiveVehicleId,
    reading_date: readingDate || new Date().toISOString().split('T')[0]
  };

  const result = await fetchMotiveData('getV2MotiveVehicleOdometer', 'GET', params);
  
  // Extract odometer value from response
  if (result && result.current_location && result.current_location.odometer > 0) {
    return {
      odometer: result.current_location.odometer,
      latitude: result.current_location.latitude,
      longitude: result.current_location.longitude,
      located_at: result.current_location.located_at,
      raw_data: result
    };
  }

  return null;
}

module.exports = {
  pushToMotive,
  isMotiveEnabled,
  fetchMotiveData,
  getMotiveVehicleOdometer
};