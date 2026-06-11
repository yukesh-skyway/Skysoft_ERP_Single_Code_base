/**
 * Vehicle Scheduled Maintenance Routes
 * RESTful API endpoints for managing vehicle maintenance assignments
 * Handles the vehicle_scheduled_maintenance table operations
 */

const express = require('express');
const router = express.Router();
const db = require('../../db/connection');
const { addMetadata } = require('../../middleware/requestMetadata');
const { 
  logServiceHistoryBulkUpdate, 
  logServiceHistoryUpdate, 
  logServiceHistoryStatusUpdate,
  logServiceHistoryDeleted 
} = require('../../services/vehicle_maintenance/auditLogService');

/**
 * @route   POST /api/vehicle-scheduled-maintenance/bulk
 * @desc    Bulk assign/update maintenance settings for a vehicle
 * @body    { vehicleId: number, configurationId: number, maintenanceRecords: [{vehicle, scheduled_maintenance, effective_date, last_maintenance_date, last_replaced_km, status}] }
 * @access  Public
 */
router.post('/bulk', addMetadata, async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    const { vehicleId, configurationId, maintenanceRecords } = req.body;
    
    // Validation
    if (!vehicleId || !Array.isArray(maintenanceRecords) || maintenanceRecords.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'vehicleId and maintenanceRecords array are required'
      });
    }
    
    await connection.beginTransaction();
    
    // Update vehicle_configuration in vehicles table if configurationId is provided
    if (configurationId) {
      await connection.query(
        'UPDATE vehicles SET vehicle_configuration = ? WHERE id = ?',
        [configurationId, vehicleId]
      );
    }
    
    // Get current active maintenance records for this vehicle
    const [existingRecords] = await connection.query(
      'SELECT id, scheduled_maintenance, status FROM vehicle_scheduled_maintenance WHERE vehicle = ?',
      [vehicleId]
    );
    
    // Create a map of existing records by scheduled_maintenance ID
    const existingMap = new Map();
    existingRecords.forEach(record => {
      existingMap.set(record.scheduled_maintenance, record);
    });
    
    // Get the requested scheduled_maintenance IDs
    const requestedMaintenanceIds = maintenanceRecords.map(r => r.scheduled_maintenance);
    
    const insertedRecords = [];
    const updatedRecords = [];
    const deactivatedRecords = [];
    
    // Process each requested maintenance record
    for (const record of maintenanceRecords) {
      const existing = existingMap.get(record.scheduled_maintenance);
      
      if (!existing) {
        // Insert new record
        const [result] = await connection.query(
          `INSERT INTO vehicle_scheduled_maintenance 
           (vehicle, scheduled_maintenance, effective_date, last_maintenance_date, last_replaced_km, status) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            record.vehicle,
            record.scheduled_maintenance,
            record.effective_date,
            record.last_maintenance_date,
            record.last_replaced_km,
            record.status
          ]
        );
        insertedRecords.push(result.insertId);
      } else if (existing.status !== 1) {
        // Reactivate previously inactive record
        await connection.query(
          `UPDATE vehicle_scheduled_maintenance 
           SET status = 1, effective_date = ? 
           WHERE id = ?`,
          [record.effective_date, existing.id]
        );
        updatedRecords.push(existing.id);
      }
    }
    
    // Deactivate records that are no longer selected
    for (const [maintenanceId, existing] of existingMap.entries()) {
      if (!requestedMaintenanceIds.includes(maintenanceId) && existing.status === 1) {
        await connection.query(
          'UPDATE vehicle_scheduled_maintenance SET status = 2 WHERE id = ?',
          [existing.id]
        );
        deactivatedRecords.push(existing.id);
      }
    }
    
    // ✅ Fetch vehicle and configuration info for audit logging
    let vehicleInfo = { vehicleId, configurationId };
    let configInfo = null;
    
    try {
      const [vehicleData] = await connection.query(
        'SELECT id, vehicle_number, vehicle_nickname, vehicle_configuration FROM vehicles WHERE id = ?',
        [vehicleId]
      );
      
      if (vehicleData.length > 0) {
        vehicleInfo = {
          vehicleId,
          configurationId,
          vehicle_number: vehicleData[0].vehicle_number,
          vehicle_nickname: vehicleData[0].vehicle_nickname,
          previous_configuration: vehicleData[0].vehicle_configuration
        };
      }
      
      // Fetch configuration name if configurationId exists
      if (configurationId) {
        const [configData] = await connection.query(
          'SELECT id, configuration_name FROM scheduled_configurations WHERE id = ?',
          [configurationId]
        );
        
        if (configData.length > 0) {
          configInfo = configData[0];
        }
      }
    } catch (fetchError) {
      console.error('⚠️ Error fetching vehicle/config info for audit log:', fetchError);
    }
    
    // ✅ Log the bulk update to audit trail
    try {
      if (insertedRecords.length > 0 || updatedRecords.length > 0 || deactivatedRecords.length > 0) {
        await logServiceHistoryBulkUpdate(
          vehicleInfo,
          configInfo,
          {
            inserted: insertedRecords.length,
            reactivated: updatedRecords.length,
            deactivated: deactivatedRecords.length,
            insertedIds: insertedRecords,
            reactivatedIds: updatedRecords,
            deactivatedIds: deactivatedRecords
          },
          req.metadata || {
            ipAddress: req.ip,
            browser: req.headers['user-agent'],
            userId: req.user?.id || 1
          }
        );
        console.log('✅ [AUDIT LOG] Maintenance Service History bulk update logged successfully');
      }
    } catch (logError) {
      console.error('❌ Error logging Service History bulk update:', logError);
      // Don't fail the request if logging fails
    }
    
    await connection.commit();
    
    res.status(200).json({
      success: true,
      message: 'Vehicle maintenance assignments updated successfully',
      data: {
        vehicleId,
        configurationId,
        inserted: insertedRecords.length,
        reactivated: updatedRecords.length,
        deactivated: deactivatedRecords.length,
        insertedIds: insertedRecords,
        reactivatedIds: updatedRecords,
        deactivatedIds: deactivatedRecords
      },
      metadata: req.metadata
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('Error in POST /api/vehicle-scheduled-maintenance/bulk:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      metadata: req.metadata
    });
  } finally {
    connection.release();
  }
});

/**
 * @route   GET /api/vehicle-scheduled-maintenance/:vehicleId
 * @desc    Get all scheduled maintenance for a specific vehicle
 * @params  vehicleId - The vehicle ID
 * @access  Public
 */
router.get('/:vehicleId', async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const { includeInactive } = req.query;
    
    let query = `
      SELECT 
        vsm.id,
        vsm.vehicle,
        vsm.scheduled_maintenance,
        vsm.effective_date,
        vsm.last_maintenance_date,
        vsm.last_replaced_km,
        vsm.status,
        v.vehicle_nickname,
        scs.setting_name,
        scs.setting_type as interval_type
      FROM vehicle_scheduled_maintenance vsm
      LEFT JOIN scheduled_configuration_settings scs ON vsm.scheduled_maintenance = scs.id
      LEFT JOIN vehicles v ON v.id = vsm.vehicle
      WHERE vsm.vehicle = ?
    `;
    
    const params = [vehicleId];
    
    // By default, only return active records unless includeInactive=true
    if (includeInactive !== 'true') {
      query += ' AND vsm.status = 1';
    }
    
    query += ' ORDER BY vsm.effective_date DESC';
    
    const [records] = await db.query(query, params);
    
    res.status(200).json({
      success: true,
      data: records,
      count: records.length,
      metadata: req.metadata
    });
    
  } catch (error) {
    console.error('Error in GET /api/vehicle-scheduled-maintenance/:vehicleId:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      metadata: req.metadata
    });
  }
});

/**
 * @route   PUT /api/vehicle-scheduled-maintenance/:id/status
 * @desc    Update the status of a scheduled maintenance record
 * @params  id - The record ID
 * @body    { status: 1 | 2 }
 * @access  Public
 */
router.put('/:id/status', addMetadata, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (![1, 2].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Status must be 1 (Active) or 2 (Inactive)'
      });
    }
    
    // ✅ Fetch record data BEFORE update for audit logging
    const [beforeUpdate] = await db.query(
      `SELECT vsm.*, v.vehicle_number, v.vehicle_nickname, scs.setting_name
       FROM vehicle_scheduled_maintenance vsm
       LEFT JOIN vehicles v ON vsm.vehicle = v.id
       LEFT JOIN scheduled_configuration_settings scs ON vsm.scheduled_maintenance = scs.id
       WHERE vsm.id = ?`,
      [id]
    );
    
    if (beforeUpdate.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Scheduled maintenance record not found'
      });
    }
    
    const oldRecord = beforeUpdate[0];
    const oldStatus = oldRecord.status;
    
    // Update the status
    const [result] = await db.query(
      'UPDATE vehicle_scheduled_maintenance SET status = ? WHERE id = ?',
      [status, id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Scheduled maintenance record not found'
      });
    }
    
    // ✅ Log the status change to audit trail
    try {
      await logServiceHistoryStatusUpdate(
        oldRecord,
        oldStatus,
        status,
        req.metadata || {
          ipAddress: req.ip,
          browser: req.headers['user-agent'],
          userId: req.user?.id || 1
        }
      );
      console.log('✅ [AUDIT LOG] Maintenance Service History status update logged successfully');
    } catch (logError) {
      console.error('❌ Error logging Maintenance Service History status update:', logError);
      // Don't fail the request if logging fails
    }
    
    res.status(200).json({
      success: true,
      message: `Maintenance record ${status === 1 ? 'activated' : 'deactivated'} successfully`,
      data: { id, status },
      metadata: req.metadata
    });
    
  } catch (error) {
    console.error('Error in PUT /api/vehicle-scheduled-maintenance/:id/status:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      metadata: req.metadata
    });
  }
});

/**
 * @route   PUT /api/vehicle-scheduled-maintenance/:id
 * @desc    Update maintenance record details (last maintenance date, km, etc.)
 * @params  id - The record ID
 * @body    { last_maintenance_date?, last_replaced_km? }
 * @access  Public
 */
router.put('/:id', addMetadata, async (req, res) => {
  try {
    const { id } = req.params;
    const { last_maintenance_date, last_replaced_km } = req.body;
    
    const updates = [];
    const values = [];
    
    if (last_maintenance_date !== undefined) {
      updates.push('last_maintenance_date = ?');
      values.push(last_maintenance_date);
    }
    
    if (last_replaced_km !== undefined) {
      updates.push('last_replaced_km = ?');
      values.push(last_replaced_km);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'No valid fields to update'
      });
    }
    
    // ✅ Fetch record data BEFORE update for audit logging
    const [beforeUpdate] = await db.query(
      `SELECT vsm.*, v.vehicle_number, v.vehicle_nickname, scs.setting_name
       FROM vehicle_scheduled_maintenance vsm
       LEFT JOIN vehicles v ON vsm.vehicle = v.id
       LEFT JOIN scheduled_configuration_settings scs ON vsm.scheduled_maintenance = scs.id
       WHERE vsm.id = ?`,
      [id]
    );
    
    if (beforeUpdate.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Scheduled maintenance record not found'
      });
    }
    
    const oldRecord = beforeUpdate[0];
    
    values.push(id);
    
    const [result] = await db.query(
      `UPDATE vehicle_scheduled_maintenance SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Scheduled maintenance record not found'
      });
    }
    
    // ✅ Create the new record object with updated values
    const newRecord = {
      ...oldRecord,
      last_maintenance_date: last_maintenance_date !== undefined ? last_maintenance_date : oldRecord.last_maintenance_date,
      last_replaced_km: last_replaced_km !== undefined ? last_replaced_km : oldRecord.last_replaced_km
    };
    
    // ✅ Log the update to audit trail
    try {
      await logServiceHistoryUpdate(
        oldRecord,
        newRecord,
        req.metadata || {
          ipAddress: req.ip,
          browser: req.headers['user-agent'],
          userId: req.user?.id || 1
        }
      );
      console.log('✅ [AUDIT LOG] Maintenance Service History update logged successfully');
    } catch (logError) {
      console.error('❌ Error logging Maintenance Service History update:', logError);
      // Don't fail the request if logging fails
    }
    
    res.status(200).json({
      success: true,
      message: 'Maintenance record updated successfully',
      data: { id, last_maintenance_date, last_replaced_km },
      metadata: req.metadata
    });
    
  } catch (error) {
    console.error('Error in PUT /api/vehicle-scheduled-maintenance/:id:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      metadata: req.metadata
    });
  }
});

/**
 * @route   DELETE /api/vehicle-scheduled-maintenance/:id
 * @desc    Delete a scheduled maintenance record (hard delete)
 * @params  id - The record ID
 * @access  Public
 */
router.delete('/:id', addMetadata, async (req, res) => {
  try {
    const { id } = req.params;
    
    // ✅ Fetch record data BEFORE deletion for audit logging
    const [beforeDelete] = await db.query(
      `SELECT vsm.*, v.vehicle_number, v.vehicle_nickname, scs.setting_name
       FROM vehicle_scheduled_maintenance vsm
       LEFT JOIN vehicles v ON vsm.vehicle = v.id
       LEFT JOIN scheduled_configuration_settings scs ON vsm.scheduled_maintenance = scs.id
       WHERE vsm.id = ?`,
      [id]
    );
    
    if (beforeDelete.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Scheduled maintenance record not found'
      });
    }
    
    const deletedRecord = beforeDelete[0];
    
    const [result] = await db.query(
      'DELETE FROM vehicle_scheduled_maintenance WHERE id = ?',
      [id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Scheduled maintenance record not found'
      });
    }
    
    // ✅ Log the deletion to audit trail
    try {
      await logServiceHistoryDeleted(
        deletedRecord,
        req.metadata || {
          ipAddress: req.ip,
          browser: req.headers['user-agent'],
          userId: req.user?.id || 1
        }
      );
      console.log('✅ [AUDIT LOG] Maintenance Service History deletion logged successfully');
    } catch (logError) {
      console.error('❌ Error logging Maintenance Service History deletion:', logError);
      // Don't fail the request if logging fails
    }
    
    res.status(200).json({
      success: true,
      message: 'Maintenance record deleted successfully',
      data: { id },
      metadata: req.metadata
    });
    
  } catch (error) {
    console.error('Error in DELETE /api/vehicle-scheduled-maintenance/:id:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      metadata: req.metadata
    });
  }
});

module.exports = router;
