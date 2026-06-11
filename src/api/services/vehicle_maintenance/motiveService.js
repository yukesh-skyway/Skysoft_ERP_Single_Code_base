const axios = require('axios');
require('dotenv').config();

/**
 * Motive API Service
 * Handles all interactions with the Motive API for vehicle data
 */
class MotiveService {
  constructor() {
    this.apiKey = process.env.MOTIVE_API_KEY;
    this.baseUrl = process.env.MOTIVE_API_BASE_URL || 'https://api.gomotive.com/v1';
    
    if (!this.apiKey) {
      console.warn('⚠️ MOTIVE_API_KEY not found in environment variables');
    }
  }

  /**
   * Fetch all pages from Motive API (paginated endpoint)
   * @param {string} endpoint - API endpoint (e.g., 'vehicle_locations')
   * @param {string} key - Key in response containing items array
   * @returns {Promise<Array>} - All fetched items
   */
  async fetchAll(endpoint, key) {
    let all = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      try {
        const res = await axios.get(`${this.baseUrl}/${endpoint}`, {
          params: { page_no: page, per_page: perPage },
          headers: { 
            'x-api-key': this.apiKey, 
            'accept': 'application/json' 
          }
        });

        const items = res.data[key] || [];
        if (items.length === 0) break;

        all.push(...items);
        if (items.length < perPage) break;

        page++;
      } catch (error) {
        console.error("❌ Error fetching Motive data:", error.response?.data || error.message);
        throw error;
      }
    }

    return all;
  }

  /**
   * Get current odometer reading for a specific vehicle by unit number
   * @param {string|number} unitNumber - Vehicle unit number
   * @returns {Promise<Object>} - { success, kilometers, source, raw }
   */
  async getVehicleOdometerByUnit(unitNumber) {
    try {
      console.log(`🔍 Fetching odometer for unit ${unitNumber} from Motive...`);
      
      // Fetch all vehicle locations from Motive
      const vehicleLocations = await this.fetchAll('vehicle_locations', 'vehicles');
      
      // Find the vehicle matching the unit number
      const vehicle = vehicleLocations.find(v => {
        const vehicleUnit = v.vehicle?.number;
        return vehicleUnit && String(vehicleUnit) === String(unitNumber);
      });

      if (!vehicle) {
        console.warn(`⚠️ Vehicle with unit ${unitNumber} not found in Motive`);
        return {
          success: false,
          message: `Vehicle unit ${unitNumber} not found in Motive API`,
          kilometers: 0
        };
      }

      // Extract odometer from vehicle location
      const odometerMeters = vehicle.vehicle?.current_location?.odometer || 0;
      
      if (!odometerMeters || odometerMeters === 0) {
        console.warn(`⚠️ No odometer data available for unit ${unitNumber}`);
        return {
          success: false,
          message: 'No odometer data available',
          kilometers: 0
        };
      }

      // Convert meters to kilometers (same logic as Firebase function)
      // Round to nearest 5 km
      const current_kilometers = Math.round(odometerMeters / 5) * 5;

      console.log(`✅ Fetched odometer for unit ${unitNumber}: ${current_kilometers} km (${odometerMeters} meters)`);

      return {
        success: true,
        kilometers: current_kilometers,
        source: 'motive',
        raw: {
          meters: odometerMeters,
          unit_number: unitNumber,
          vehicle_id: vehicle.vehicle?.id,
          location: vehicle.vehicle?.current_location
        }
      };

    } catch (error) {
      console.error('❌ Error fetching vehicle odometer:', error.message);
      return {
        success: false,
        message: 'Failed to fetch odometer from Motive API',
        error: error.message,
        kilometers: 0
      };
    }
  }

  /**
   * Get vehicle odometer by vehicle ID (from database)
   * This method fetches the unit number from database first, then calls Motive
   * @param {number} vehicleId - Vehicle ID from database
   * @param {Function} getVehicleFromDB - Callback to get vehicle data from DB
   * @returns {Promise<Object>} - { success, kilometers, source }
   */
  async getVehicleOdometerById(vehicleId, getVehicleFromDB) {
    try {
      // Get vehicle data from database to retrieve unit number
      const vehicle = await getVehicleFromDB(vehicleId);
      
      if (!vehicle) {
        return {
          success: false,
          message: 'Vehicle not found in database',
          kilometers: 0
        };
      }

      // Use vehicle_nickname as PRIMARY identifier (matches Motive's vehicle number)
      const unitNumber = vehicle.vehicle_nickname || vehicle.vehicle_number || vehicle.asset_id;
      
      if (!unitNumber) {
        return {
          success: false,
          message: 'Vehicle unit number not found',
          kilometers: 0
        };
      }

      // Fetch odometer from Motive using unit number
      return await this.getVehicleOdometerByUnit(unitNumber);

    } catch (error) {
      console.error('❌ Error in getVehicleOdometerById:', error.message);
      return {
        success: false,
        message: 'Failed to fetch vehicle odometer',
        error: error.message,
        kilometers: 0
      };
    }
  }
}

module.exports = MotiveService;
