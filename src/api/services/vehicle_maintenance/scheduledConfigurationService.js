/**
 * Scheduled Configuration Service
 * Business logic for scheduled_configurations table management
 * Skysoft Fleet Maintenance Module
 */

const pool = require('../../db/connection');
const auditLogService = require('./auditLogService');

/**
 * Get all scheduled configurations with optional filters
 * @param {Object} filters - Optional filters (status, search)
 * @returns {Promise<Object>} List of configurations
 */
const getAllConfigurations = async (filters = {}) => {
  try {
    let query = `
      SELECT 
        id,
        configuration_name,
        status
      FROM scheduled_configurations
      WHERE 1=1
    `;
    const params = [];

    // Apply status filter
    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    // Apply search filter
    if (filters.search) {
      query += ' AND configuration_name LIKE ?';
      params.push(`%${filters.search}%`);
    }

    query += ' ORDER BY id DESC';

    const [rows] = await pool.query(query, params);

    return {
      success: true,
      data: rows,
      count: rows.length
    };
  } catch (error) {
    console.error('❌ Error fetching configurations:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get all scheduled configurations WITH their settings
 * @param {Object} filters - Optional filters (status, search)
 * @returns {Promise<Object>} List of configurations with settings
 */
const getAllConfigurationsWithSettings = async (filters = {}) => {
  try {
    // First get all configurations
    let configQuery = `
      SELECT 
        id,
        configuration_name,
        status
      FROM scheduled_configurations
      WHERE 1=1
    `;
    const configParams = [];

    // Apply status filter
    if (filters.status) {
      configQuery += ' AND status = ?';
      configParams.push(filters.status);
    }

    // Apply search filter
    if (filters.search) {
      configQuery += ' AND configuration_name LIKE ?';
      configParams.push(`%${filters.search}%`);
    }

    configQuery += ' ORDER BY id DESC';

    const [configurations] = await pool.query(configQuery, configParams);

    // For each configuration, get its settings
    const configurationsWithSettings = await Promise.all(
      configurations.map(async (config) => {
        const [settings] = await pool.query(
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
            scs.setting_name
          FROM configuration_settings cs
          LEFT JOIN scheduled_configuration_settings scs ON cs.setting = scs.id
          WHERE cs.configuration = ? AND cs.status = 1
          ORDER BY cs.id ASC`,
          [config.id]
        );

        console.log(`📋 Config ID ${config.id} (${config.configuration_name}): ${settings.length} settings`);

        return {
          id: config.id,
          configuration_name: config.configuration_name,
          status: config.status,
          settings: settings || []
        };
      })
    );

    return {
      success: true,
      data: configurationsWithSettings,
      count: configurationsWithSettings.length
    };
  } catch (error) {
    console.error('❌ Error fetching configurations with settings:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get a single configuration by ID
 * @param {number} id - Configuration ID
 * @returns {Promise<Object>} Configuration data
 */
const getConfigurationById = async (id) => {
  try {
    const query = `
      SELECT 
        id,
        configuration_name,
        status
      FROM scheduled_configurations
      WHERE id = ?
    `;

    const [rows] = await pool.query(query, [id]);

    if (rows.length === 0) {
      return {
        success: false,
        error: 'Configuration not found'
      };
    }

    return {
      success: true,
      data: rows[0]
    };
  } catch (error) {
    console.error('❌ Error fetching configuration by ID:', error);
    return {
      success: false,
      error: 'Failed to fetch configuration',
      details: error.message
    };
  }
};

/**
 * Create a new scheduled configuration
 * @param {Object} configData - { configuration_name, status }
 * @param {Object} metadata - Request metadata (ip, browser, userId)
 * @returns {Promise<Object>} Created configuration
 */
const createConfiguration = async (configData, metadata = {}) => {
  try {
    const { configuration_name, status = 1 } = configData;

    // Validate required fields
    if (!configuration_name || configuration_name.trim() === '') {
      return {
        success: false,
        error: 'Configuration name is required'
      };
    }

    // Check for duplicate configuration name
    const [existing] = await pool.query(
      'SELECT id FROM scheduled_configurations WHERE configuration_name = ?',
      [configuration_name]
    );

    if (existing.length > 0) {
      return {
        success: false,
        error: 'Configuration name already exists'
      };
    }

    const query = `
      INSERT INTO scheduled_configurations 
      (configuration_name, status)
      VALUES (?, ?)
    `;

    const [result] = await pool.query(query, [
      configuration_name,
      status
    ]);

    // Fetch the created configuration
    const createdConfigResult = await getConfigurationById(result.insertId);
    
    if (!createdConfigResult.success) {
      console.error('❌ Failed to fetch created configuration:', createdConfigResult.error);
      // Still return success but with basic data
      return {
        success: true,
        message: 'Configuration created successfully',
        data: {
          id: result.insertId,
          configuration_name,
          status
        },
        id: result.insertId
      };
    }

    // Log the creation
    try {
      await auditLogService.logScheduledConfigCreated(
        createdConfigResult.data,
        metadata
      );
    } catch (logError) {
      console.error('❌ Failed to log configuration creation:', logError);
      // Don't fail the operation if logging fails
    }

    return {
      success: true,
      message: 'Configuration created successfully',
      data: createdConfigResult.data,
      id: result.insertId
    };
  } catch (error) {
    console.error('❌ Error creating configuration:', error);
    
    // Handle unique constraint violation
    if (error.code === 'ER_DUP_ENTRY') {
      return {
        success: false,
        error: 'Configuration name already exists'
      };
    }

    // Return error instead of throwing
    return {
      success: false,
      error: 'Failed to create configuration',
      details: error.message
    };
  }
};

/**
 * Update a scheduled configuration
 * @param {number} id - Configuration ID
 * @param {Object} configData - { configuration_name, status }
 * @param {Object} metadata - Request metadata (ip, browser, userId)
 * @returns {Promise<Object>} Updated configuration
 */
const updateConfiguration = async (id, configData, metadata = {}) => {
  try {
    const { configuration_name, status } = configData;

    // Check if configuration exists
    const existing = await getConfigurationById(id);
    if (!existing.success) {
      return existing;
    }

    const oldConfig = { ...existing.data };

    // Build update query dynamically
    const updates = [];
    const params = [];

    if (configuration_name !== undefined) {
      // Check for duplicate name (excluding current configuration)
      const [duplicate] = await pool.query(
        'SELECT id FROM scheduled_configurations WHERE configuration_name = ? AND id != ?',
        [configuration_name, id]
      );

      if (duplicate.length > 0) {
        return {
          success: false,
          error: 'Configuration name already exists'
        };
      }

      updates.push('configuration_name = ?');
      params.push(configuration_name);
    }

    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }

    if (updates.length === 0) {
      return {
        success: false,
        error: 'No fields to update'
      };
    }

    params.push(id);

    const query = `
      UPDATE scheduled_configurations 
      SET ${updates.join(', ')}
      WHERE id = ?
    `;

    await pool.query(query, params);

    // Fetch the updated configuration
    const updatedConfigResult = await getConfigurationById(id);
    
    if (!updatedConfigResult.success) {
      return {
        success: false,
        error: 'Failed to fetch updated configuration'
      };
    }

    // Log the update
    try {
      await auditLogService.logScheduledConfigUpdated(
        oldConfig,
        updatedConfigResult.data,
        metadata
      );
    } catch (logError) {
      console.error('❌ Failed to log configuration update:', logError);
      // Don't fail the operation if logging fails
    }

    return {
      success: true,
      message: 'Configuration updated successfully',
      data: updatedConfigResult.data
    };
  } catch (error) {
    console.error('❌ Error updating configuration:', error);
    
    // Handle unique constraint violation
    if (error.code === 'ER_DUP_ENTRY') {
      return {
        success: false,
        error: 'Configuration name already exists'
      };
    }

    return {
      success: false,
      error: 'Failed to update configuration',
      details: error.message
    };
  }
};

/**
 * Delete a scheduled configuration
 * @param {number} id - Configuration ID
 * @param {Object} metadata - Request metadata (ip, browser, userId)
 * @returns {Promise<Object>} Deletion result
 */
const deleteConfiguration = async (id, metadata = {}) => {
  try {
    // Check if configuration exists
    const existing = await getConfigurationById(id);
    if (!existing.success) {
      return existing;
    }

    const query = 'DELETE FROM scheduled_configurations WHERE id = ?';
    const [result] = await pool.query(query, [id]);

    if (result.affectedRows === 0) {
      return {
        success: false,
        error: 'Configuration not found'
      };
    }

    // Log the deletion
    try {
      await auditLogService.logScheduledConfigDeleted(
        existing.data,
        metadata
      );
    } catch (logError) {
      console.error('❌ Failed to log configuration deletion:', logError);
      // Don't fail the operation if logging fails
    }

    return {
      success: true,
      message: 'Configuration deleted successfully'
    };
  } catch (error) {
    console.error('❌ Error deleting configuration:', error);
    return {
      success: false,
      error: 'Failed to delete configuration',
      details: error.message
    };
  }
};

/**
 * Toggle configuration status (active/inactive)
 * @param {number} id - Configuration ID
 * @param {Object} metadata - Request metadata (ip, browser, userId)
 * @returns {Promise<Object>} Updated configuration
 */
const toggleConfigurationStatus = async (id, metadata = {}) => {
  try {
    const existing = await getConfigurationById(id);
    if (!existing.success) {
      return existing;
    }

    const oldConfig = { ...existing.data };
    const newStatus = existing.data.status === 1 ? 2 : 1;

    const query = `
      UPDATE scheduled_configurations 
      SET status = ?
      WHERE id = ?
    `;

    await pool.query(query, [newStatus, id]);

    // Fetch the updated configuration
    const updatedConfigResult = await getConfigurationById(id);
    
    if (!updatedConfigResult.success) {
      return {
        success: false,
        error: 'Failed to fetch updated configuration'
      };
    }

    // Log the status toggle
    try {
      await auditLogService.logScheduledConfigStatusToggle(
        oldConfig,
        updatedConfigResult.data,
        metadata
      );
    } catch (logError) {
      console.error('❌ Failed to log status toggle:', logError);
      // Don't fail the operation if logging fails
    }

    return {
      success: true,
      message: 'Configuration status toggled successfully',
      data: updatedConfigResult.data
    };
  } catch (error) {
    console.error('❌ Error toggling configuration status:', error);
    return {
      success: false,
      error: 'Failed to toggle configuration status',
      details: error.message
    };
  }
};

/**
 * Bulk delete configurations
 * @param {Array<number>} ids - Array of configuration IDs
 * @param {Object} metadata - Request metadata (ip, browser, userId)
 * @returns {Promise<Object>} Deletion results
 */
const bulkDeleteConfigurations = async (ids, metadata = {}) => {
  try {
    if (!Array.isArray(ids) || ids.length === 0) {
      return {
        success: false,
        error: 'No configuration IDs provided'
      };
    }

    // Fetch configs before deleting for logging
    const placeholdersQuery = ids.map(() => '?').join(',');
    const [configs] = await pool.query(
      `SELECT * FROM scheduled_configurations WHERE id IN (${placeholdersQuery})`,
      ids
    );

    const query = `DELETE FROM scheduled_configurations WHERE id IN (${placeholdersQuery})`;
    const [result] = await pool.query(query, ids);

    // Log the bulk deletion
    try {
      await auditLogService.logScheduledConfigBulkDelete(
        configs,
        metadata
      );
    } catch (logError) {
      console.error('❌ Failed to log bulk deletion:', logError);
      // Don't fail the operation if logging fails
    }

    return {
      success: true,
      message: `${result.affectedRows} configuration(s) deleted successfully`,
      deletedCount: result.affectedRows
    };
  } catch (error) {
    console.error('❌ Error bulk deleting configurations:', error);
    return {
      success: false,
      error: 'Failed to delete configurations',
      details: error.message
    };
  }
};

/**
 * Bulk update configuration status
 * @param {Array<number>} ids - Array of configuration IDs
 * @param {number} status - New status (1=Active, 2=Inactive)
 * @param {Object} metadata - Request metadata (ip, browser, userId)
 * @returns {Promise<Object>} Update results
 */
const bulkUpdateStatus = async (ids, status, metadata = {}) => {
  try {
    if (!Array.isArray(ids) || ids.length === 0) {
      return {
        success: false,
        error: 'No configuration IDs provided'
      };
    }

    if (![1, 2].includes(status)) {
      return {
        success: false,
        error: 'Invalid status value. Must be 1 (Active) or 2 (Inactive)'
      };
    }

    // Fetch configs before updating for logging
    const placeholdersQuery = ids.map(() => '?').join(',');
    const [configs] = await pool.query(
      `SELECT * FROM scheduled_configurations WHERE id IN (${placeholdersQuery})`,
      ids
    );

    const query = `UPDATE scheduled_configurations SET status = ? WHERE id IN (${placeholdersQuery})`;
    const [result] = await pool.query(query, [status, ...ids]);

    // Log the bulk update
    try {
      await auditLogService.logScheduledConfigBulkStatusUpdate(
        configs,
        status,
        metadata
      );
    } catch (logError) {
      console.error('❌ Failed to log bulk status update:', logError);
      // Don't fail the operation if logging fails
    }

    return {
      success: true,
      message: `${result.affectedRows} configuration(s) updated successfully`,
      updatedCount: result.affectedRows
    };
  } catch (error) {
    console.error('❌ Error bulk updating configurations:', error);
    return {
      success: false,
      error: 'Failed to update configurations',
      details: error.message
    };
  }
};

/**
 * Duplicate a scheduled configuration
 * @param {number} id - Configuration ID to duplicate
 * @param {string} newName - New configuration name (optional, will auto-generate if not provided)
 * @param {Object} metadata - Request metadata (ip, browser, userId)
 * @returns {Promise<Object>} Duplicated configuration
 */
const duplicateConfiguration = async (id, newName = null, metadata = {}) => {
  try {
    // Get the original configuration
    const original = await getConfigurationById(id);
    if (!original.success) {
      return original;
    }

    // Generate a unique name if not provided
    let duplicateName = newName;
    if (!duplicateName) {
      duplicateName = `${original.data.configuration_name} - Copy`;
      
      // Check if name exists and append number if needed
      let counter = 1;
      let nameExists = true;
      
      while (nameExists) {
        const [existing] = await pool.query(
          'SELECT id FROM scheduled_configurations WHERE configuration_name = ?',
          [duplicateName]
        );
        
        if (existing.length === 0) {
          nameExists = false;
        } else {
          duplicateName = `${original.data.configuration_name} - Copy (${counter})`;
          counter++;
        }
      }
    } else {
      // Check if provided name already exists
      const [existing] = await pool.query(
        'SELECT id FROM scheduled_configurations WHERE configuration_name = ?',
        [newName]
      );
      
      if (existing.length > 0) {
        return {
          success: false,
          error: 'Configuration name already exists'
        };
      }
    }

    // Create the duplicate
    const query = `
      INSERT INTO scheduled_configurations 
      (configuration_name, status)
      VALUES (?, ?)
    `;

    const [result] = await pool.query(query, [
      duplicateName,
      original.data.status
    ]);

    // Fetch the created duplicate
    const duplicatedConfigResult = await getConfigurationById(result.insertId);
    
    if (!duplicatedConfigResult.success) {
      return {
        success: false,
        error: 'Failed to fetch duplicated configuration'
      };
    }

    // Log the duplication
    try {
      await auditLogService.logScheduledConfigDuplicated(
        original.data,
        duplicatedConfigResult.data,
        metadata
      );
    } catch (logError) {
      console.error('❌ Failed to log duplication:', logError);
      // Don't fail the operation if logging fails
    }

    return {
      success: true,
      message: 'Configuration duplicated successfully',
      data: duplicatedConfigResult.data,
      id: result.insertId
    };
  } catch (error) {
    console.error('❌ Error duplicating configuration:', error);
    return {
      success: false,
      error: 'Failed to duplicate configuration',
      details: error.message
    };
  }
};

module.exports = {
  getAllConfigurations,
  getAllConfigurationsWithSettings,
  getConfigurationById,
  createConfiguration,
  updateConfiguration,
  deleteConfiguration,
  toggleConfigurationStatus,
  bulkDeleteConfigurations,
  bulkUpdateStatus,
  duplicateConfiguration
};
