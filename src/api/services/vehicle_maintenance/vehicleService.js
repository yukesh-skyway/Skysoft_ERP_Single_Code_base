/**
 * Vehicle Service - Simplified for Updates Only
 * Handles vehicle status and kilometer updates
 * Works with existing table structure (14 fields)
 * 
 * @author Skysoft Fleet Management Team
 * @version 1.0.0
 * @date 2025-12-16
 */

const db = require('../../db/connection');
const auditLog = require('./auditLogService');

/**
 * Get all vehicles with optional filtering
 * @param {Object} filters - Optional filters (status, vehicle_type, has_wheelchair, search)
 * @returns {Promise<Array>} - Array of vehicles
 */
const getAllVehicles = async (filters = {}) => {
  try {
    let query = `
      SELECT 
        v.id,
        v.vehicle_nickname,
        v.vehicle_number,
        v.vehicle_type,
        v.vehicle_vin,
        v.vehicle_year,
        v.vehicle_comments,
        v.current_km,
        v.km_sync_status,
        v.vehicle_configuration,
        v.status,
        v.asset_id,
        v.has_wheelchair,
        v.motive_vehicle_id,
        v.motive_company_id,
        v.motive_comp_groupid,
        vt.vehicle_type as vehicle_type_name,
        vc.name as collection_name,
        vsc.name as sub_collection_name,
        sc.configuration_name as vehicle_configuration_name,
        CASE 
          WHEN v.status = 1 THEN 'Active'
          WHEN v.status = 0 THEN 'Inactive'
          WHEN v.status = -1 THEN 'Archived'
          ELSE 'Unknown'
        END as status_label
      FROM vehicles v
      LEFT JOIN vehicletypes vt ON v.vehicle_type = vt.id
      LEFT JOIN vehicles_collections vc ON vt.vc_id = vc.id
      LEFT JOIN vehicles_sub_collections vsc ON vt.vsc_id = vsc.id
      LEFT JOIN scheduled_configurations sc ON v.vehicle_configuration = sc.id
      WHERE 1=1
    `;
    
    const params = [];

    // Filter by status
    if (filters.status !== undefined && filters.status !== null && filters.status !== '') {
      query += ' AND v.status = ?';
      params.push(filters.status);
    }

    // Filter by vehicle type
    if (filters.vehicle_type) {
      query += ' AND v.vehicle_type = ?';
      params.push(filters.vehicle_type);
    }

    // Filter by wheelchair accessibility
    if (filters.has_wheelchair) {
      query += ' AND v.has_wheelchair = ?';
      params.push(filters.has_wheelchair);
    }

    // Filter by configuration
    if (filters.vehicle_configuration) {
      query += ' AND v.vehicle_configuration = ?';
      params.push(filters.vehicle_configuration);
    }

    // Search across multiple fields
    if (filters.search) {
      query += ` AND (
        v.vehicle_nickname LIKE ? OR
        v.vehicle_number LIKE ? OR
        v.vehicle_vin LIKE ? OR
        v.asset_id LIKE ? OR
        v.vehicle_comments LIKE ?
      )`;
      const searchParam = `%${filters.search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam, searchParam);
    }

    // Order by
    const orderBy = filters.orderBy || 'vehicle_nickname';
    const orderDir = filters.orderDir === 'desc' ? 'DESC' : 'ASC';
    query += ` ORDER BY v.${orderBy} ${orderDir}`;

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
    console.error('Error getting vehicles:', error);
    throw new Error('Failed to retrieve vehicles: ' + error.message);
  }
};

/**
 * Get vehicle by ID
 * @param {number} id - Vehicle ID
 * @returns {Promise<Object|null>} - Vehicle object or null
 */
const getVehicleById = async (id) => {
  try {
    const query = `
      SELECT 
        v.id,
        v.vehicle_nickname,
        v.vehicle_number,
        v.vehicle_type,
        v.vehicle_vin,
        v.vehicle_year,
        v.vehicle_comments,
        v.current_km,
        v.km_sync_status,
        v.vehicle_configuration,
        v.status,
        v.asset_id,
        v.has_wheelchair,
        v.motive_vehicle_id,
        v.motive_company_id,
        v.motive_comp_groupid,
        vt.vehicle_type as vehicle_type_name,
        vc.name as collection_name,
        vsc.name as sub_collection_name,
        sc.configuration_name as vehicle_configuration_name,
        CASE 
          WHEN v.status = 1 THEN 'Active'
          WHEN v.status = 0 THEN 'Inactive'
          WHEN v.status = -1 THEN 'Archived'
          ELSE 'Unknown'
        END as status_label
      FROM vehicles v
      LEFT JOIN vehicletypes vt ON v.vehicle_type = vt.id
      LEFT JOIN vehicles_collections vc ON vt.vc_id = vc.id
      LEFT JOIN vehicles_sub_collections vsc ON vt.vsc_id = vsc.id
      LEFT JOIN scheduled_configurations sc ON v.vehicle_configuration = sc.id
      WHERE v.id = ?
    `;
    
    const [rows] = await db.query(query, [id]);
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error('Error getting vehicle by ID:', error);
    throw new Error('Failed to retrieve vehicle: ' + error.message);
  }
};

/**
 * Get vehicle by nickname
 * @param {string} nickname - Vehicle nickname
 * @returns {Promise<Object|null>} - Vehicle object or null
 */
const getVehicleByNickname = async (nickname) => {
  try {
    const query = `
      SELECT 
        v.id,
        v.vehicle_nickname,
        v.vehicle_number,
        v.vehicle_type,
        v.vehicle_vin,
        v.vehicle_year,
        v.vehicle_comments,
        v.current_km,
        v.km_sync_status,
        v.vehicle_configuration,
        v.status,
        v.asset_id,
        v.has_wheelchair,
        v.motive_vehicle_id,
        v.motive_company_id,
        v.motive_comp_groupid,
        vt.vehicle_type as vehicle_type_name,
        vc.name as collection_name,
        vsc.name as sub_collection_name,
        sc.configuration_name as vehicle_configuration_name,
        CASE 
          WHEN v.status = 1 THEN 'Active'
          WHEN v.status = 0 THEN 'Inactive'
          WHEN v.status = -1 THEN 'Archived'
          ELSE 'Unknown'
        END as status_label
      FROM vehicles v
      LEFT JOIN vehicletypes vt ON v.vehicle_type = vt.id
      LEFT JOIN vehicles_collections vc ON vt.vc_id = vc.id
      LEFT JOIN vehicles_sub_collections vsc ON vt.vsc_id = vsc.id
      LEFT JOIN scheduled_configurations sc ON v.vehicle_configuration = sc.id
      WHERE LOWER(TRIM(v.vehicle_nickname)) = LOWER(TRIM(?))
    `;
    
    const [rows] = await db.query(query, [nickname]);
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error('Error getting vehicle by nickname:', error);
    throw new Error('Failed to retrieve vehicle: ' + error.message);
  }
};

/**
 * Update vehicle status and comments
 * @param {number} id - Vehicle ID
 * @param {Object} updateData - { status, vehicle_comments }
 * @param {Object} metadata - Request metadata (ipAddress, browser, userId)
 * @returns {Promise<Object>} - Updated vehicle
 */
const updateVehicleStatus = async (id, updateData, metadata = {}) => {
  try {
    // Check if vehicle exists
    const existingVehicle = await getVehicleById(id);
    if (!existingVehicle) {
      return {
        success: false,
        error: 'Vehicle not found',
        statusCode: 404
      };
    }

    // Validate status
    if (updateData.status !== undefined) {
      const validStatuses = [1, 0, -1, '1', '0', '-1'];
      if (!validStatuses.includes(updateData.status)) {
        return {
          success: false,
          error: 'Invalid status. Must be 1 (Active), 0 (Inactive), or -1 (Archived)',
          statusCode: 400
        };
      }
    }

    const updateFields = [];
    const updateValues = [];

    if (updateData.status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(parseInt(updateData.status));
    }

    if (updateData.vehicle_comments !== undefined) {
      updateFields.push('vehicle_comments = ?');
      updateValues.push(updateData.vehicle_comments.trim());
    }

    if (updateFields.length === 0) {
      return {
        success: false,
        error: 'No fields to update',
        statusCode: 400
      };
    }

    updateValues.push(id);

    const query = `
      UPDATE vehicles 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `;

    await db.query(query, updateValues);

    // Fetch updated vehicle
    const updatedVehicle = await getVehicleById(id);

    // Log the status change if status was updated
    if (updateData.status !== undefined) {
      await auditLog.logVehicleStatusUpdate(existingVehicle, updatedVehicle, metadata);
    }

    return {
      success: true,
      data: updatedVehicle,
      message: 'Vehicle status updated successfully',
      statusCode: 200
    };
  } catch (error) {
    console.error('Error updating vehicle status:', error);
    throw new Error('Failed to update vehicle status: ' + error.message);
  }
};

/**
 * Update vehicle kilometer reading
 * Updates the current_km field and optionally km_sync_status
 * 
 * @param {number} id - Vehicle ID
 * @param {Object} kmData - { current_km, km_sync_status, km_notes }
 * @param {Object} metadata - Request metadata (ipAddress, browser, userId)
 * @returns {Promise<Object>} - Updated vehicle
 */
const updateVehicleKilometers = async (id, kmData, metadata = {}) => {
  try {
    // Check if vehicle exists
    const existingVehicle = await getVehicleById(id);
    if (!existingVehicle) {
      return {
        success: false,
        error: 'Vehicle not found',
        statusCode: 404
      };
    }

    // Validate kilometer value
    if (kmData.current_km !== undefined) {
      const km = parseInt(kmData.current_km);
      if (isNaN(km) || km < 0) {
        return {
          success: false,
          error: 'Invalid kilometer value. Must be a positive number',
          statusCode: 400
        };
      }
    }

    // Validate km_sync_status if provided
    if (kmData.km_sync_status !== undefined) {
      const validStatuses = ['synced', 'paused', 'resumed', null];
      if (!validStatuses.includes(kmData.km_sync_status)) {
        return {
          success: false,
          error: 'Invalid km_sync_status. Must be "synced", "paused", "resumed", or null',
          statusCode: 400
        };
      }
    }

    const updateFields = [];
    const updateValues = [];

    // Update current_km field
    if (kmData.current_km !== undefined) {
      updateFields.push('current_km = ?');
      updateValues.push(parseInt(kmData.current_km));
    }

    // Update km_sync_status field
    if (kmData.km_sync_status !== undefined) {
      updateFields.push('km_sync_status = ?');
      updateValues.push(kmData.km_sync_status);
    }

    // Optionally update vehicle_comments with notes
    if (kmData.km_notes) {
      const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const existingComments = existingVehicle.vehicle_comments || '';
      const kmNote = `\n[KM Update ${timestamp}]: ${kmData.current_km} KM - ${kmData.km_notes}`;
      updateFields.push('vehicle_comments = ?');
      updateValues.push((existingComments + kmNote).trim());
    }

    if (updateFields.length === 0) {
      return {
        success: false,
        error: 'No fields to update',
        statusCode: 400
      };
    }

    updateValues.push(id);

    const query = `
      UPDATE vehicles 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `;

    await db.query(query, updateValues);

    // Fetch updated vehicle
    const updatedVehicle = await getVehicleById(id);

    // Log the kilometer change
    if (kmData.current_km !== undefined) {
      await auditLog.logVehicleKilometerUpdate(existingVehicle, updatedVehicle, metadata);
    }
    
    // Log the KM sync status change
    if (kmData.km_sync_status !== undefined) {
      await auditLog.logVehicleKmSyncStatusUpdate(existingVehicle, updatedVehicle, metadata);
    }

    return {
      success: true,
      data: updatedVehicle,
      message: 'Vehicle kilometer reading updated successfully',
      statusCode: 200
    };
  } catch (error) {
    console.error('Error updating vehicle kilometers:', error);
    throw new Error('Failed to update vehicle kilometers: ' + error.message);
  }
};

/**
 * Update any vehicle field (general update)
 * Only updates existing fields in your current table structure
 * 
 * @param {number} id - Vehicle ID
 * @param {Object} updateData - Fields to update
 * @returns {Promise<Object>} - Updated vehicle
 */
const updateVehicle = async (id, updateData) => {
  try {
    // Check if vehicle exists
    const existingVehicle = await getVehicleById(id);
    if (!existingVehicle) {
      return {
        success: false,
        error: 'Vehicle not found',
        statusCode: 404
      };
    }

    // Allowed fields (existing table structure only)
    const allowedFields = [
      'vehicle_nickname', 'vehicle_number', 'vehicle_type', 'vehicle_vin',
      'vehicle_year', 'vehicle_comments', 'current_km', 'km_sync_status',
      'vehicle_configuration', 'status', 'asset_id', 'has_wheelchair', 
      'motive_vehicle_id', 'motive_company_id', 'motive_comp_groupid'
    ];

    const updateFields = [];
    const updateValues = [];

    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        
        // Handle trimming for string fields
        if (typeof updateData[field] === 'string') {
          updateValues.push(updateData[field].trim());
        } else {
          updateValues.push(updateData[field]);
        }
      }
    });

    if (updateFields.length === 0) {
      return {
        success: false,
        error: 'No valid fields to update',
        statusCode: 400
      };
    }

    // Validate status if being updated
    if (updateData.status !== undefined) {
      const validStatuses = [1, 0, -1, '1', '0', '-1'];
      if (!validStatuses.includes(updateData.status)) {
        return {
          success: false,
          error: 'Invalid status. Must be 1 (Active), 0 (Inactive), or -1 (Archived)',
          statusCode: 400
        };
      }
    }

    // Validate has_wheelchair if being updated
    if (updateData.has_wheelchair !== undefined) {
      const validWheelchair = ['yes', 'no'];
      if (!validWheelchair.includes(updateData.has_wheelchair.toLowerCase())) {
        return {
          success: false,
          error: 'Invalid has_wheelchair value. Must be "yes" or "no"',
          statusCode: 400
        };
      }
    }

    updateValues.push(id);

    const query = `
      UPDATE vehicles 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `;

    await db.query(query, updateValues);

    // Fetch updated vehicle
    const updatedVehicle = await getVehicleById(id);

    // Log the change
    await auditLog.logChange({
      entity: 'vehicle',
      entityId: id,
      action: 'update',
      changes: updateData
    });

    return {
      success: true,
      data: updatedVehicle,
      message: 'Vehicle updated successfully',
      statusCode: 200
    };
  } catch (error) {
    console.error('Error updating vehicle:', error);
    
    // Handle unique constraint violation
    if (error.code === 'ER_DUP_ENTRY') {
      return {
        success: false,
        error: 'Duplicate entry detected',
        details: ['Vehicle with this nickname already exists'],
        statusCode: 409
      };
    }

    throw new Error('Failed to update vehicle: ' + error.message);
  }
};

/**
 * Get vehicle statistics
 * @returns {Promise<Object>} - Vehicle statistics
 */
const getVehicleStatistics = async () => {
  try {
    const query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) as inactive,
        SUM(CASE WHEN status = -1 THEN 1 ELSE 0 END) as archived,
        SUM(CASE WHEN has_wheelchair = 'yes' THEN 1 ELSE 0 END) as wheelchair_accessible,
        COUNT(DISTINCT vehicle_type) as unique_types,
        COUNT(DISTINCT vehicle_configuration) as unique_configurations,
        SUM(CASE WHEN motive_vehicle_id IS NOT NULL THEN 1 ELSE 0 END) as motive_integrated
      FROM vehicles
    `;

    const [rows] = await db.query(query);
    return rows[0];
  } catch (error) {
    console.error('Error getting vehicle statistics:', error);
    throw new Error('Failed to retrieve statistics: ' + error.message);
  }
};

module.exports = {
  getAllVehicles,
  getVehicleById,
  getVehicleByNickname,
  updateVehicleStatus,
  updateVehicleKilometers,
  updateVehicle,
  getVehicleStatistics
};
