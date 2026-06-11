/**
 * Configuration Settings Service
 * Business logic for configuration_settings table management
 * Skysoft Fleet Maintenance Module
 */

const pool = require('../../db/connection');
const auditLogService = require('./auditLogService');

/**
 * Get all settings for a specific configuration
 * @param {number} configurationId - Configuration ID
 * @returns {Promise<Object>} List of settings
 */
const getConfigurationSettings = async (configurationId) => {
  try {
    const query = `
      SELECT 
        cs.id,
        cs.configuration,
        cs.setting,
        cs.kms,
        cs.kms_to_alert,
        cs.days,
        cs.days_to_alert,
        cs.time_unit,
        cs.status,
        cs.interval_type,
        cs.maintenance_type,
        ms.setting_name as setting_name
      FROM configuration_settings cs
      LEFT JOIN scheduled_configuration_settings ms ON cs.setting = ms.id
      WHERE cs.configuration = ?
      ORDER BY cs.id ASC
    `;

    const [rows] = await pool.query(query, [configurationId]);

    return {
      success: true,
      data: rows,
      count: rows.length
    };
  } catch (error) {
    console.error('❌ Error fetching configuration settings:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Create a new configuration setting
 * @param {Object} settingData - Setting data
 * @param {Object} metadata - Request metadata (userId, userName, userRole)
 * @returns {Promise<Object>} Created setting
 */
const createConfigurationSetting = async (settingData, metadata) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const {
      configuration,
      setting,
      kms = 0,
      kms_to_alert = 0,
      days = 0,
      days_to_alert = 0,
      time_unit = 'DAYS',
      status = 1,
      maintenance_type = 'Regular Maintenance'
    } = settingData;

    // Check for duplicate configuration + setting combination
    const [existing] = await connection.query(
      'SELECT id FROM configuration_settings WHERE configuration = ? AND setting = ?',
      [configuration, setting]
    );

    if (existing.length > 0) {
      await connection.rollback();
      return {
        success: false,
        error: 'already_added'
      };
    }

    // Get the interval_type and maintenance_type from scheduled_configuration_settings
    const [intervalData] = await connection.query(
      'SELECT setting_type, maintenance_type FROM scheduled_configuration_settings WHERE id = ?',
      [setting]
    );

    if (intervalData.length === 0) {
      await connection.rollback();
      return {
        success: false,
        error: 'Selected interval not found'
      };
    }

    const interval_type = intervalData[0].setting_type;
    // Get maintenance_type from interval and ensure it's in ENUM format
    const maintenance_type_enum = intervalData[0].maintenance_type || 'REGULAR';

    // Insert the new setting with interval_type and maintenance_type
    const [result] = await connection.query(
      `INSERT INTO configuration_settings 
       (configuration, setting, kms, kms_to_alert, days, days_to_alert, time_unit, status, interval_type, maintenance_type, days_in_string) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '')`,
      [configuration, setting, kms, kms_to_alert, days, days_to_alert, time_unit, status, interval_type, maintenance_type_enum]
    );

    // Get the created setting with interval details and configuration name
    const [createdSetting] = await connection.query(
      `SELECT 
        cs.id,
        cs.configuration,
        cs.setting,
        cs.kms,
        cs.kms_to_alert,
        cs.days,
        cs.days_to_alert,
        cs.time_unit,
        cs.status,
        cs.interval_type,
        cs.maintenance_type,
        ms.setting_name as setting_name,
        sc.configuration_name as configuration_name
      FROM configuration_settings cs
      LEFT JOIN scheduled_configuration_settings ms ON cs.setting = ms.id
      LEFT JOIN scheduled_configurations sc ON cs.configuration = sc.id
      WHERE cs.id = ?`,
      [result.insertId]
    );

    // Log the activity
    await auditLogService.logConfigurationSettingCreated(createdSetting[0], metadata);

    // ✅ NEW: AUTO-PROPAGATE TO VEHICLES
    console.log(`\n🔍 AUTO-PROPAGATION DEBUG:`);
    console.log(`   Configuration ID: ${configuration}`);
    console.log(`   Setting ID: ${setting}`);
    
    // Find all vehicles that have this configuration assigned
    const [vehiclesWithConfig] = await connection.query(
      `SELECT id, vehicle_number, vehicle_configuration 
       FROM vehicles 
       WHERE vehicle_configuration = ? 
       AND status = 1`,
      [configuration]
    );

    console.log(`   Found ${vehiclesWithConfig.length} vehicle(s) with this configuration`);
    if (vehiclesWithConfig.length > 0) {
      console.log(`   Vehicle IDs: ${vehiclesWithConfig.map(v => `${v.vehicle_number}(${v.id})`).join(', ')}`);
    }

    let affectedVehicles = 0;
    
    if (vehiclesWithConfig.length > 0) {
      console.log(`\n🚀 Propagating new setting to ${vehiclesWithConfig.length} vehicle(s)...`);
      
      // Get today's date in YYYY-MM-DD format
      const today = new Date().toISOString().split('T')[0];
      
      // For each vehicle, insert the new maintenance record
      for (const vehicle of vehiclesWithConfig) {
        try {
          // Check if this maintenance record already exists for this vehicle
          const [existingRecord] = await connection.query(
            `SELECT id FROM vehicle_scheduled_maintenance 
             WHERE vehicle = ? AND scheduled_maintenance = ?`,
            [vehicle.id, setting]
          );

          if (existingRecord.length === 0) {
            // Insert new maintenance record
            await connection.query(
              `INSERT INTO vehicle_scheduled_maintenance 
               (vehicle, scheduled_maintenance, effective_date, last_maintenance_date, last_replaced_km, status)
               VALUES (?, ?, ?, ?, 0, 1)`,
              [vehicle.id, setting, today, today]
            );
            
            affectedVehicles++;
            console.log(`  ✅ Added to vehicle ${vehicle.vehicle_number} (ID: ${vehicle.id})`);
          } else {
            console.log(`  ⚠️  Skipped vehicle ${vehicle.vehicle_number} (ID: ${vehicle.id}) - already has this setting`);
          }
        } catch (vehicleError) {
          console.error(`  ❌ Error adding to vehicle ${vehicle.id}:`, vehicleError.message);
          // Continue with other vehicles even if one fails
        }
      }
      
      console.log(`✅ Successfully propagated to ${affectedVehicles} vehicle(s)`);
    } else {
      console.log('ℹ️  No vehicles currently assigned to this configuration');
    }

    await connection.commit();

    return {
      success: true,
      data: createdSetting[0],
      message: affectedVehicles > 0 
        ? `Configuration setting created successfully and applied to ${affectedVehicles} vehicle(s)`
        : 'Configuration setting created successfully',
      affectedVehicles: affectedVehicles,
      totalVehiclesWithConfig: vehiclesWithConfig.length
    };
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error creating configuration setting:', error);
    return {
      success: false,
      error: error.message
    };
  } finally {
    connection.release();
  }
};

/**
 * Update a configuration setting
 * @param {number} id - Setting ID
 * @param {Object} settingData - Updated setting data
 * @param {Object} metadata - Request metadata (userId, userName, userRole)
 * @returns {Promise<Object>} Updated setting
 */
const updateConfigurationSetting = async (id, settingData, metadata) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Get old values for audit log
    const [oldRecord] = await connection.query(
      'SELECT * FROM configuration_settings WHERE id = ?',
      [id]
    );

    if (oldRecord.length === 0) {
      await connection.rollback();
      return {
        success: false,
        error: 'Configuration setting not found'
      };
    }

    const {
      kms = 0,
      kms_to_alert = 0,
      days = 0,
      days_to_alert = 0,
      time_unit = 'DAYS',
      status = 1,
      maintenance_type = 'Regular Maintenance'
    } = settingData;

    // Update the setting
    await connection.query(
      `UPDATE configuration_settings 
       SET kms = ?, 
           kms_to_alert = ?, 
           days = ?, 
           days_to_alert = ?, 
           time_unit = ?, 
           status = ?,
           maintenance_type = ?
       WHERE id = ?`,
      [kms, kms_to_alert, days, days_to_alert, time_unit, status, maintenance_type, id]
    );

    // Get the updated setting with interval details and configuration name
    const [updatedSetting] = await connection.query(
      `SELECT 
        cs.id,
        cs.configuration,
        cs.setting,
        cs.kms,
        cs.kms_to_alert,
        cs.days,
        cs.days_to_alert,
        cs.time_unit,
        cs.status,
        cs.interval_type,
        cs.maintenance_type,
        ms.setting_name as setting_name,
        sc.configuration_name as configuration_name
      FROM configuration_settings cs
      LEFT JOIN scheduled_configuration_settings ms ON cs.setting = ms.id
      LEFT JOIN scheduled_configurations sc ON cs.configuration = sc.id
      WHERE cs.id = ?`,
      [id]
    );

    // Log the activity
    await auditLogService.logConfigurationSettingUpdated(oldRecord[0], updatedSetting[0], metadata);

    await connection.commit();

    return {
      success: true,
      data: updatedSetting[0],
      message: 'Configuration setting updated successfully'
    };
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error updating configuration setting:', error);
    return {
      success: false,
      error: error.message
    };
  } finally {
    connection.release();
  }
};

/**
 * Delete a configuration setting
 * @param {number} id - Setting ID
 * @param {Object} metadata - Request metadata (userId, userName, userRole)
 * @returns {Promise<Object>} Deletion result
 */
const deleteConfigurationSetting = async (id, metadata) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Get the setting for audit log (with setting_name and configuration_name)
    const [settingWithDetails] = await connection.query(
      `SELECT 
        cs.*, 
        ms.setting_name as setting_name,
        sc.configuration_name as configuration_name
      FROM configuration_settings cs
      LEFT JOIN scheduled_configuration_settings ms ON cs.setting = ms.id
      LEFT JOIN scheduled_configurations sc ON cs.configuration = sc.id
      WHERE cs.id = ?`,
      [id]
    );

    if (settingWithDetails.length === 0) {
      await connection.rollback();
      return {
        success: false,
        error: 'Configuration setting not found'
      };
    }

    // Delete the setting
    await connection.query('DELETE FROM configuration_settings WHERE id = ?', [id]);

    // Log the activity
    await auditLogService.logConfigurationSettingDeleted(settingWithDetails[0], metadata);

    await connection.commit();

    return {
      success: true,
      message: 'Configuration setting deleted successfully'
    };
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error deleting configuration setting:', error);
    return {
      success: false,
      error: error.message
    };
  } finally {
    connection.release();
  }
};

/**
 * Toggle configuration setting status
 * @param {number} id - Setting ID
 * @param {Object} metadata - Request metadata
 * @returns {Promise<Object>} Updated setting
 */
const toggleSettingStatus = async (id, metadata) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Get current setting with details and configuration name
    const [currentSetting] = await connection.query(
      `SELECT \n        cs.*,
        ms.setting_name as setting_name,
        sc.configuration_name as configuration_name
      FROM configuration_settings cs
      LEFT JOIN scheduled_configuration_settings ms ON cs.setting = ms.id
      LEFT JOIN scheduled_configurations sc ON cs.configuration = sc.id
      WHERE cs.id = ?`,
      [id]
    );

    if (currentSetting.length === 0) {
      await connection.rollback();
      return {
        success: false,
        error: 'Configuration setting not found'
      };
    }

    const newStatus = currentSetting[0].status === 1 ? 2 : 1;

    // Update status
    await connection.query(
      'UPDATE configuration_settings SET status = ? WHERE id = ?',
      [newStatus, id]
    );

    // Get the updated setting with configuration name
    const [updatedSetting] = await connection.query(
      `SELECT 
        cs.id,
        cs.configuration,
        cs.setting,
        cs.kms,
        cs.kms_to_alert,
        cs.days,
        cs.days_to_alert,
        cs.time_unit,
        cs.status,
        cs.interval_type,
        cs.maintenance_type,
        ms.setting_name as setting_name,
        sc.configuration_name as configuration_name
      FROM configuration_settings cs
      LEFT JOIN scheduled_configuration_settings ms ON cs.setting = ms.id
      LEFT JOIN scheduled_configurations sc ON cs.configuration = sc.id
      WHERE cs.id = ?`,
      [id]
    );

    // Log the activity
    await auditLogService.logConfigurationSettingStatusToggle(currentSetting[0], updatedSetting[0], metadata);

    await connection.commit();

    return {
      success: true,
      data: updatedSetting[0],
      message: 'Status updated successfully'
    };
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error toggling setting status:', error);
    return {
      success: false,
      error: error.message
    };
  } finally {
    connection.release();
  }
};

module.exports = {
  getConfigurationSettings,
  createConfigurationSetting,
  updateConfigurationSetting,
  deleteConfigurationSetting,
  toggleSettingStatus
};
