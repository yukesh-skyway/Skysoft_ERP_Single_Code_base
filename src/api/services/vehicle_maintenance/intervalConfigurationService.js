/**
 * Interval Configuration Service
 * Handles scheduled_configuration_settings CRUD operations
 * 
 * @author Skysoft Fleet Management Team
 * @version 1.0.0
 * @date 2025-12-16
 */

const db = require('../../db/connection');

/**
 * Get all interval configuration settings with optional filtering
 * @param {Object} filters - Optional filters (status, setting_type, search)
 * @returns {Promise<Array>} - Array of settings
 */
const getAllSettings = async (filters = {}) => {
  try {
    let query = `
      SELECT 
        s.*,
        u.fullname as added_by_name,
        CASE 
          WHEN s.status = 1 THEN 'Active'
          WHEN s.status = 2 THEN 'Inactive'
          ELSE 'Unknown'
        END as status_label
      FROM scheduled_configuration_settings s
      LEFT JOIN users u ON s.added_by = u.id
      WHERE 1=1
    `;
    
    const params = [];

    // Filter by status
    if (filters.status !== undefined && filters.status !== null && filters.status !== '') {
      query += ' AND s.status = ?';
      params.push(filters.status);
    }

    // Filter by setting type
    if (filters.setting_type) {
      query += ' AND s.setting_type = ?';
      params.push(filters.setting_type);
    }

    // Filter by maintenance type
    if (filters.maintenance_type) {
      query += ' AND s.maintenance_type = ?';
      params.push(filters.maintenance_type);
    }

    // Search across setting_name
    if (filters.search) {
      query += ' AND s.setting_name LIKE ?';
      params.push(`%${filters.search}%`);
    }

    // Order by
    const orderBy = filters.orderBy || 'setting_name';
    const orderDir = filters.orderDir === 'desc' ? 'DESC' : 'ASC';
    query += ` ORDER BY s.${orderBy} ${orderDir}`;

    // Pagination
    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(parseInt(filters.limit));
      
      if (filters.offset) {
        query += ' OFFSET ?';
        params.push(parseInt(filters.offset));
      }
    }

    const [rows] = await db.query(query, params);
    return rows;
  } catch (error) {
    console.error('Error getting interval configuration settings:', error);
    throw new Error('Failed to retrieve settings: ' + error.message);
  }
};

/**
 * Get setting by ID
 * @param {number} id - Setting ID
 * @returns {Promise<Object|null>} - Setting object or null
 */
const getSettingById = async (id) => {
  try {
    const query = `
      SELECT 
        s.*,
        u.fullname as added_by_name,
        CASE 
          WHEN s.status = 1 THEN 'Active'
          WHEN s.status = 2 THEN 'Inactive'
          ELSE 'Unknown'
        END as status_label
      FROM scheduled_configuration_settings s
      LEFT JOIN users u ON s.added_by = u.id
      WHERE s.id = ?
    `;
    
    const [rows] = await db.query(query, [id]);
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error('Error getting setting by ID:', error);
    throw new Error('Failed to retrieve setting: ' + error.message);
  }
};

/**
 * Get setting by name
 * @param {string} name - Setting name
 * @returns {Promise<Object|null>} - Setting object or null
 */
const getSettingByName = async (name) => {
  try {
    const query = `
      SELECT 
        s.*,
        CASE 
          WHEN s.status = 1 THEN 'Active'
          WHEN s.status = 2 THEN 'Inactive'
          ELSE 'Unknown'
        END as status_label
      FROM scheduled_configuration_settings s
      WHERE LOWER(TRIM(s.setting_name)) = LOWER(TRIM(?))
    `;
    
    const [rows] = await db.query(query, [name]);
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error('Error getting setting by name:', error);
    throw new Error('Failed to retrieve setting: ' + error.message);
  }
};

/**
 * Create new interval configuration setting
 * @param {Object} settingData - { setting_name, setting_type, added_by, status }
 * @returns {Promise<Object>} - Created setting with success/error info
 */
const createSetting = async (settingData) => {
  try {
    // Validate required fields
    if (!settingData.setting_name || !settingData.setting_name.trim()) {
      return {
        success: false,
        error: 'Setting name is required',
        statusCode: 400
      };
    }

    if (!settingData.setting_type) {
      return {
        success: false,
        error: 'Setting type is required',
        statusCode: 400
      };
    }

    if (!settingData.added_by) {
      return {
        success: false,
        error: 'Added by (user ID) is required',
        statusCode: 400
      };
    }

    if (!settingData.maintenance_type) {
      return {
        success: false,
        error: 'Maintenance type is required',
        statusCode: 400
      };
    }

    // Validate setting_type
    const validTypes = ['KMS', 'DURATION', 'BOTH'];
    if (!validTypes.includes(settingData.setting_type)) {
      return {
        success: false,
        error: 'Invalid setting type. Must be KMS, DURATION, or BOTH',
        statusCode: 400
      };
    }

    // Validate maintenance_type
    const validMaintenanceTypes = ['REGULAR', 'OVERHAUL'];
    if (!validMaintenanceTypes.includes(settingData.maintenance_type)) {
      return {
        success: false,
        error: 'Invalid maintenance type. Must be REGULAR or OVERHAUL',
        statusCode: 400
      };
    }

    // Validate status
    const validStatuses = [1, 2, '1', '2'];
    if (settingData.status && !validStatuses.includes(settingData.status)) {
      return {
        success: false,
        error: 'Invalid status. Must be 1 (Active) or 2 (Inactive)',
        statusCode: 400
      };
    }

    // Normalize and trim setting name
    const normalizedName = settingData.setting_name.trim().replace(/\s+/g, ' ');

    // Check for duplicate setting name
    const existingSetting = await getSettingByName(normalizedName);
    if (existingSetting) {
      return {
        success: false,
        error: 'Duplicate setting name detected',
        details: [`A setting with the name "${normalizedName}" already exists (ID: ${existingSetting.id})`],
        statusCode: 409
      };
    }

    // Insert new setting
    const query = `
      INSERT INTO scheduled_configuration_settings 
      (setting_name, setting_type, maintenance_type, added_by, status, added_on)
      VALUES (?, ?, ?, ?, ?, NOW())
    `;

    const status = settingData.status || 1; // Default to Active

    const [result] = await db.query(query, [
      normalizedName,
      settingData.setting_type,
      settingData.maintenance_type,
      settingData.added_by,
      status
    ]);

    // Fetch the created setting
    const createdSetting = await getSettingById(result.insertId);

    return {
      success: true,
      data: createdSetting,
      message: 'Interval configuration setting created successfully',
      statusCode: 201
    };
  } catch (error) {
    console.error('Error creating interval configuration setting:', error);

    // Handle unique constraint violation
    if (error.code === 'ER_DUP_ENTRY') {
      return {
        success: false,
        error: 'Duplicate setting name detected',
        details: ['A setting with this name already exists'],
        statusCode: 409
      };
    }

    throw new Error('Failed to create setting: ' + error.message);
  }
};

/**
 * Update interval configuration setting
 * @param {number} id - Setting ID
 * @param {Object} updateData - Fields to update
 * @returns {Promise<Object>} - Updated setting
 */
const updateSetting = async (id, updateData) => {
  try {
    // Check if setting exists
    const existingSetting = await getSettingById(id);
    if (!existingSetting) {
      return {
        success: false,
        error: 'Setting not found',
        statusCode: 404
      };
    }

    // Allowed fields
    const allowedFields = ['setting_name', 'setting_type', 'maintenance_type', 'status'];

    const updateFields = [];
    const updateValues = [];

    // Validate and prepare updates
    if (updateData.setting_name !== undefined) {
      const normalizedName = updateData.setting_name.trim().replace(/\s+/g, ' ');
      
      if (!normalizedName) {
        return {
          success: false,
          error: 'Setting name cannot be empty',
          statusCode: 400
        };
      }

      // Check for duplicate name (excluding current setting)
      const duplicate = await getSettingByName(normalizedName);
      if (duplicate && duplicate.id !== id) {
        return {
          success: false,
          error: 'Duplicate setting name detected',
          details: [`A setting with the name "${normalizedName}" already exists (ID: ${duplicate.id})`],
          statusCode: 409
        };
      }

      updateFields.push('setting_name = ?');
      updateValues.push(normalizedName);
    }

    if (updateData.setting_type !== undefined) {
      const validTypes = ['KMS', 'DURATION', 'BOTH'];
      if (!validTypes.includes(updateData.setting_type)) {
        return {
          success: false,
          error: 'Invalid setting type. Must be KMS, DURATION, or BOTH',
          statusCode: 400
        };
      }

      updateFields.push('setting_type = ?');
      updateValues.push(updateData.setting_type);
    }

    if (updateData.maintenance_type !== undefined) {
      const validMaintenanceTypes = ['REGULAR', 'OVERHAUL'];
      if (!validMaintenanceTypes.includes(updateData.maintenance_type)) {
        return {
          success: false,
          error: 'Invalid maintenance type. Must be REGULAR or OVERHAUL',
          statusCode: 400
        };
      }

      updateFields.push('maintenance_type = ?');
      updateValues.push(updateData.maintenance_type);
    }

    if (updateData.status !== undefined) {
      const validStatuses = [1, 2, '1', '2'];
      if (!validStatuses.includes(updateData.status)) {
        return {
          success: false,
          error: 'Invalid status. Must be 1 (Active) or 2 (Inactive)',
          statusCode: 400
        };
      }

      updateFields.push('status = ?');
      updateValues.push(parseInt(updateData.status));
    }

    if (updateFields.length === 0) {
      return {
        success: false,
        error: 'No valid fields to update',
        statusCode: 400
      };
    }

    updateValues.push(id);

    const query = `
      UPDATE scheduled_configuration_settings 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `;

    await db.query(query, updateValues);

    // Fetch updated setting
    const updatedSetting = await getSettingById(id);

    return {
      success: true,
      data: updatedSetting,
      message: 'Interval configuration setting updated successfully',
      statusCode: 200
    };
  } catch (error) {
    console.error('Error updating interval configuration setting:', error);

    // Handle unique constraint violation
    if (error.code === 'ER_DUP_ENTRY') {
      return {
        success: false,
        error: 'Duplicate setting name detected',
        details: ['A setting with this name already exists'],
        statusCode: 409
      };
    }

    throw new Error('Failed to update setting: ' + error.message);
  }
};

/**
 * Delete interval configuration setting (hard delete)
 * @param {number} id - Setting ID
 * @returns {Promise<Object>} - Success/error info
 */
const deleteSetting = async (id) => {
  try {
    // Check if setting exists
    const existingSetting = await getSettingById(id);
    if (!existingSetting) {
      return {
        success: false,
        error: 'Setting not found',
        statusCode: 404
      };
    }

    const query = 'DELETE FROM scheduled_configuration_settings WHERE id = ?';
    await db.query(query, [id]);

    return {
      success: true,
      message: 'Interval configuration setting deleted successfully',
      data: existingSetting,
      statusCode: 200
    };
  } catch (error) {
    console.error('Error deleting interval configuration setting:', error);
    
    // Handle foreign key constraint
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return {
        success: false,
        error: 'Cannot delete setting',
        details: ['This setting is currently in use by one or more maintenance configurations'],
        statusCode: 409
      };
    }

    throw new Error('Failed to delete setting: ' + error.message);
  }
};

/**
 * Update setting status (soft delete/activate)
 * @param {number} id - Setting ID
 * @param {number} status - Status (1=Active, 2=Inactive)
 * @returns {Promise<Object>} - Updated setting
 */
const updateSettingStatus = async (id, status) => {
  try {
    const validStatuses = [1, 2, '1', '2'];
    if (!validStatuses.includes(status)) {
      return {
        success: false,
        error: 'Invalid status. Must be 1 (Active) or 2 (Inactive)',
        statusCode: 400
      };
    }

    return await updateSetting(id, { status: parseInt(status) });
  } catch (error) {
    console.error('Error updating setting status:', error);
    throw new Error('Failed to update setting status: ' + error.message);
  }
};

/**
 * Get statistics for interval configuration settings
 * @returns {Promise<Object>} - Statistics
 */
const getStatistics = async () => {
  try {
    const query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 2 THEN 1 ELSE 0 END) as inactive,
        SUM(CASE WHEN setting_type = 'KMS' THEN 1 ELSE 0 END) as kms_only,
        SUM(CASE WHEN setting_type = 'BOTH' THEN 1 ELSE 0 END) as both_kms_duration
      FROM scheduled_configuration_settings
    `;

    const [rows] = await db.query(query);
    return rows[0];
  } catch (error) {
    console.error('Error getting statistics:', error);
    throw new Error('Failed to retrieve statistics: ' + error.message);
  }
};

module.exports = {
  getAllSettings,
  getSettingById,
  getSettingByName,
  createSetting,
  updateSetting,
  deleteSetting,
  updateSettingStatus,
  getStatistics
};
