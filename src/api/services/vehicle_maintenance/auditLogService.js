/**
 * Audit Log Service
 * Tracks all changes to repair code categories
 * Skysoft Fleet Maintenance Module
 */

const { executeQuery } = require('../../db/connection');

/**
 * Log table structure:
 * - log_id (bigint, AUTO_INCREMENT)
 * - log_date_time (datetime, CURRENT_TIMESTAMP)
 * - log_ip (varchar 50)
 * - log_browser (varchar 255)
 * - user_id (int)
 * - log_source (text) - Module name
 * - log_remark (text) - Action description
 * - log_old_value (text) - Old value (JSON)
 * - log_updated_value (text) - New value (JSON)
 */

/**
 * Create audit log entry
 * @param {Object} logData - Log data
 * @returns {Promise<Object>} Log result
 */
const createAuditLog = async (logData) => {
  try {
    const {
      ipAddress,
      browser,
      userId = 0, // Default to 0 if no user (system action)
      source = 'repair_code_categories',
      remark,
      oldValue = null,
      newValue = null
    } = logData;

    // Convert objects to JSON strings
    const oldValueJson = oldValue ? JSON.stringify(oldValue) : null;
    const newValueJson = newValue ? JSON.stringify(newValue) : null;

    const query = `
      INSERT INTO user_activity_logs 
      (log_date_time, log_ip, log_browser, user_id, log_source, log_remark, log_old_value, log_updated_value)
      VALUES (NOW(), ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await executeQuery(query, [
      ipAddress || 'unknown',
      browser || 'unknown',
      userId,
      source,
      remark,
      oldValueJson,
      newValueJson
    ]);

    return {
      success: true,
      logId: result.insertId
    };
  } catch (error) {
    console.error('❌ Error creating audit log:', error);
    // Don't throw - logging should not break the main operation
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Log category creation
 * @param {Object} category - Created category data
 * @param {Object} metadata - Request metadata (ip, browser, userId)
 * @returns {Promise<Object>} Log result
 */
const logCategoryCreated = async (category, metadata) => {
  return await createAuditLog({
    ipAddress: metadata.ipAddress,
    browser: metadata.browser,
    userId: metadata.userId,
    source: 'Manage Repair Code Categories',
    remark: `Created new repair code category: ${category.categoryName}`,
    oldValue: null,
    newValue: category
  });
};

/**
 * Log category update
 * @param {Object} oldCategory - Original category data
 * @param {Object} newCategory - Updated category data
 * @param {Object} metadata - Request metadata
 * @returns {Promise<Object>} Log result
 */
const logCategoryUpdated = async (oldCategory, newCategory, metadata) => {
  // Build a list of changed fields
  const changes = [];
  
  if (oldCategory.categoryName !== newCategory.categoryName) {
    changes.push(`name: "${oldCategory.categoryName}" → "${newCategory.categoryName}"`);
  }
  if (oldCategory.type !== newCategory.type) {
    changes.push(`type: "${oldCategory.type}" → "${newCategory.type}"`);
  }
  if (oldCategory.status !== newCategory.status) {
    const oldStatus = oldCategory.status === 1 ? 'Active' : 'Inactive';
    const newStatus = newCategory.status === 1 ? 'Active' : 'Inactive';
    changes.push(`status: ${oldStatus} → ${newStatus}`);
  }
  if (oldCategory.colorCode !== newCategory.colorCode) {
    changes.push(`color: ${oldCategory.colorCode} → ${newCategory.colorCode}`);
  }
  if (oldCategory.icon !== newCategory.icon) {
    changes.push(`icon: ${oldCategory.icon} → ${newCategory.icon}`);
  }
  if (oldCategory.sortOrder !== newCategory.sortOrder) {
    changes.push(`order: ${oldCategory.sortOrder} → ${newCategory.sortOrder}`);
  }

  const remark = changes.length > 0
    ? `Updated repair code category \"${oldCategory.categoryName}\": ${changes.join(', ')}`
    : `Updated repair code category \"${oldCategory.categoryName}\"`;

  return await createAuditLog({
    ipAddress: metadata.ipAddress,
    browser: metadata.browser,
    userId: metadata.userId,
    source: 'Manage Repair Code Categories',
    remark,
    oldValue: oldCategory,
    newValue: newCategory
  });
};

/**
 * Log category deletion (soft delete)
 * @param {Object} category - Deleted category data
 * @param {Object} metadata - Request metadata
 * @returns {Promise<Object>} Log result
 */
const logCategoryDeleted = async (category, metadata) => {
  return await createAuditLog({
    ipAddress: metadata.ipAddress,
    browser: metadata.browser,
    userId: metadata.userId,
    source: 'Manage Repair Code Categories',
    remark: `Deleted (soft) repair code category: ${category.categoryName}`,
    oldValue: category,
    newValue: { ...category, status: 2 }
  });
};

/**
 * Log permanent category deletion
 * @param {Object} category - Permanently deleted category data
 * @param {Object} metadata - Request metadata
 * @returns {Promise<Object>} Log result
 */
const logCategoryPermanentlyDeleted = async (category, metadata) => {
  return await createAuditLog({
    ipAddress: metadata.ipAddress,
    browser: metadata.browser,
    userId: metadata.userId,
    source: 'Manage Repair Code Categories',
    remark: `PERMANENTLY deleted repair code category: ${category.categoryName}`,
    oldValue: category,
    newValue: null
  });
};

/**
 * Get audit logs for a specific category
 * @param {number} categoryId - Category ID
 * @param {number} limit - Number of logs to retrieve
 * @returns {Promise<Array>} Array of audit logs
 */
const getCategoryAuditLogs = async (categoryId, limit = 50) => {
  try {
    const query = `
      SELECT 
        log_id as logId,
        log_date_time as dateTime,
        log_ip as ipAddress,
        log_browser as browser,
        user_id as userId,
        log_source as source,
        log_remark as remark,
        log_old_value as oldValue,
        log_updated_value as updatedValue
      FROM log
      WHERE log_source = 'repair_code_categories'
        AND (log_remark LIKE ? OR log_old_value LIKE ? OR log_updated_value LIKE ?)
      ORDER BY log_date_time DESC
      LIMIT ?
    `;

    const searchPattern = `%"id":${categoryId}%`;
    const results = await executeQuery(query, [
      `%ID: ${categoryId}%`,
      searchPattern,
      searchPattern,
      limit
    ]);

    // Parse JSON strings back to objects
    return results.map(log => ({
      ...log,
      oldValue: log.oldValue ? JSON.parse(log.oldValue) : null,
      updatedValue: log.updatedValue ? JSON.parse(log.updatedValue) : null
    }));
  } catch (error) {
    console.error('❌ Error fetching audit logs:', error);
    throw error;
  }
};

/**
 * Get all audit logs for repair code categories
 * @param {number} limit - Number of logs to retrieve
 * @param {number} offset - Offset for pagination
 * @returns {Promise<Object>} Paginated audit logs
 */
const getAllCategoryAuditLogs = async (limit = 100, offset = 0) => {
  try {
    const query = `
      SELECT 
        log_id as logId,
        log_date_time as dateTime,
        log_ip as ipAddress,
        log_browser as browser,
        user_id as userId,
        log_source as source,
        log_remark as remark,
        log_old_value as oldValue,
        log_updated_value as updatedValue
      FROM log
      WHERE log_source = 'repair_code_categories'
      ORDER BY log_date_time DESC
      LIMIT ? OFFSET ?
    `;

    const results = await executeQuery(query, [limit, offset]);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM log 
      WHERE log_source = 'repair_code_categories'
    `;
    const countResult = await executeQuery(countQuery);
    const total = countResult[0].total;

    // Parse JSON strings
    const logs = results.map(log => ({
      ...log,
      oldValue: log.oldValue ? JSON.parse(log.oldValue) : null,
      updatedValue: log.updatedValue ? JSON.parse(log.updatedValue) : null
    }));

    return {
      success: true,
      data: logs,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    };
  } catch (error) {
    console.error('❌ Error fetching all audit logs:', error);
    throw error;
  }
};

/**
 * Get audit logs by user
 * @param {number} userId - User ID
 * @param {number} limit - Number of logs to retrieve
 * @returns {Promise<Array>} Array of audit logs
 */
const getAuditLogsByUser = async (userId, limit = 50) => {
  try {
    const query = `
      SELECT 
        log_id as logId,
        log_date_time as dateTime,
        log_ip as ipAddress,
        log_browser as browser,
        user_id as userId,
        log_source as source,
        log_remark as remark,
        log_old_value as oldValue,
        log_updated_value as updatedValue
      FROM log
      WHERE log_source = 'repair_code_categories' AND user_id = ?
      ORDER BY log_date_time DESC
      LIMIT ?
    `;

    const results = await executeQuery(query, [userId, limit]);

    return results.map(log => ({
      ...log,
      oldValue: log.oldValue ? JSON.parse(log.oldValue) : null,
      updatedValue: log.updatedValue ? JSON.parse(log.updatedValue) : null
    }));
  } catch (error) {
    console.error('❌ Error fetching user audit logs:', error);
    throw error;
  }
};

/**
 * Get audit log statistics
 * @returns {Promise<Object>} Statistics
 */
const getAuditLogStatistics = async () => {
  try {
    const query = `
      SELECT 
        COUNT(*) as totalLogs,
        COUNT(DISTINCT user_id) as uniqueUsers,
        COUNT(CASE WHEN log_remark LIKE '%Created%' THEN 1 END) as createdCount,
        COUNT(CASE WHEN log_remark LIKE '%Updated%' THEN 1 END) as updatedCount,
        COUNT(CASE WHEN log_remark LIKE '%Deleted%' THEN 1 END) as deletedCount,
        MIN(log_date_time) as firstLog,
        MAX(log_date_time) as lastLog
      FROM log
      WHERE log_source = 'repair_code_categories'
    `;

    const results = await executeQuery(query);
    
    return {
      success: true,
      data: results[0]
    };
  } catch (error) {
    console.error('❌ Error fetching audit statistics:', error);
    throw error;
  }
};
/**
 * Log successful creation of a single maintenance defect
 * @param {Object} defect - Created defect data
 * @param {Object} metadata - Request metadata
 * @returns {Promise<Object>} Log result
 */
/**
 * Log successful creation of a single maintenance defect
 * @param {Object} defect - Created defect data
 * @param {Object} metadata - Request metadata
 * @returns {Promise<Object>} Log result
 */
/**
 * Log successful creation of a single maintenance defect
 * @param {Object} defect - Created defect data
 * @param {Object} metadata - Request metadata
 * @returns {Promise<Object>} Log result
 */
/**
 * Log successful creation of a single maintenance defect
 * @param {Object} defect - Created defect data
 * @param {Object} metadata - Request metadata
 * @returns {Promise<Object>} Log result
 */
async function logMaintenanceDefectCreated(defect, metadata) {
  const vehicleInfo = defect.vehicle_nickname || defect.vehicle_number || `ID ${defect.vehicle_id}`;
  
  // ✅ Add "Created" so getActionType returns "Create"
  let remark = `Created maintenance defect for vehicle '${vehicleInfo}': ${defect.setting_name}`;
  
  if (defect.next_service_date) {
    remark += ` | Due Date: ${defect.next_service_date} (Status: ${defect.status})`;
  }
  
  if (defect.kms_threshold) {
    const thresholdKm = (defect.kms_threshold || 0);
    remark += ` | Due KM: ${thresholdKm.toLocaleString()} (Status: ${defect.status})`;
  }
  
  return await createAuditLog({
    ipAddress: metadata.ipAddress,
    browser: metadata.browser,
    userId: metadata.userId,
    source: 'Maintenance Operations',
    remark: remark,
    oldValue: null,
    newValue: {
      defect_id: defect.defect_id,
      vehicle_id: defect.vehicle_id,
      vehicle_nickname: defect.vehicle_nickname,
      setting_name: defect.setting_name,
      scheduled_maintenance_id: defect.scheduled_maintenance_id,
      status: defect.status,
      next_service_date: defect.next_service_date,
      kms_threshold: defect.kms_threshold,
      last_replaced_km: defect.last_replaced_km,
      last_maintenance_date: defect.last_maintenance_date
    }
  });
}

/**
 * Log maintenance defect creation error
 * @param {Object} item - Item that caused error
 * @param {Object} error - Error object
 * @param {Object} metadata - Request metadata
 * @returns {Promise<Object>} Log result
 */
/**
 * Log maintenance defect creation error
 * @param {Object} item - Item that caused error
 * @param {Object} error - Error object
 * @param {Object} metadata - Request metadata
 * @returns {Promise<Object>} Log result
 */
async function logMaintenanceDefectCreationError(item, error, metadata) {
  const vehicleInfo = item.vehicle_nickname || item.vehicle_number || `Vehicle ID ${item.vehicle_id}`;
  
  // ✅ Match the maintenance style
  const remark = `Error creating defect for vehicle '${vehicleInfo}': ${item.setting_name} - ${error.message}`;
  
  return await createAuditLog({
    ipAddress: metadata.ipAddress,
    browser: metadata.browser,
    userId: metadata.userId,
    source: 'Maintenance Operations',
    remark: remark,
    oldValue: null,
    newValue: {
      vehicle_id: item.vehicle_id,
      vehicle_nickname: item.vehicle_nickname,
      setting_name: item.setting_name,
      scheduled_maintenance_id: item.scheduled_maintenance_id,
      error_message: error.message
    }
  });
}
module.exports = {
  createAuditLog,
  logCategoryCreated,
  logCategoryUpdated,
  logCategoryDeleted,
  logCategoryPermanentlyDeleted,
  getCategoryAuditLogs,
  getAllCategoryAuditLogs,
  getAuditLogsByUser,
  getAuditLogStatistics,
  // Vehicle logging functions
  logVehicleKilometerUpdate,
  logVehicleStatusUpdate,
  logVehicleUpdate,
  logVehicleKmSyncStatusUpdate,
  // Interval Configuration logging functions
  logIntervalConfigCreated,
  logIntervalConfigUpdated,
  logIntervalConfigDeleted,
  logIntervalConfigStatusUpdate,
  logIntervalConfigBulkStatusUpdate,
  // Scheduled Configuration logging functions
  logScheduledConfigCreated,
  logScheduledConfigUpdated,
  logScheduledConfigDeleted,
  logScheduledConfigDuplicated,
  logScheduledConfigStatusToggle,
  logScheduledConfigBulkDelete,
  logScheduledConfigBulkStatusUpdate,
  // Configuration Settings logging functions
  logConfigurationSettingCreated,
  logConfigurationSettingUpdated,
  logConfigurationSettingDeleted,
  logConfigurationSettingStatusToggle,
  // Payment Methods logging functions
  logPaymentMethodCreated,
  logPaymentMethodUpdated,
  logPaymentMethodDeleted,
  // Vendor Management logging functions
  logVendorCreated,
  logVendorUpdated,
  logVendorDeleted,
  // Defect Management logging functions
  logDefectCreated,
  logDefectUpdated,
  logDefectStatusUpdate,
  logDefectManagerStatusUpdate,
  logDefectApproved,
  logDefectsMerged,
  logDefectsUnmerged,
  logDefectsRepairNotNeeded,
  logDefectsCancelled,
  logDefectsBulkUpdated,
  logDefectInspectionStatusUpdate,
  logMaintenanceDefectCreated,
  logMaintenanceDefectCreationError,
  // Repair Order logging functions
  logRepairOrderCreated,
  logRepairOrderUpdated,
  logRepairOrderCompleted,
  logRepairOrderStatusUpdate,
  logRepairOrderCancelled,
  logRepairOrderDeleted,
  // Maintenance Operations logging functions
  logMaintenanceDefectsCreated,
  // Service History logging functions
  logServiceHistoryBulkUpdate,
  logServiceHistoryUpdate,
  logServiceHistoryStatusUpdate,
  logServiceHistoryDeleted
};

/**
 * ===================================
 * VEHICLE MANAGEMENT LOGGING FUNCTIONS
 * ===================================
 */

/**
 * Log vehicle kilometer update
 * @param {Object} oldVehicle - Original vehicle data
 * @param {Object} newVehicle - Updated vehicle data with new KM
 * @param {Object} metadata - Request metadata
 * @returns {Promise<Object>} Log result
 */
async function logVehicleKilometerUpdate(oldVehicle, newVehicle, metadata) {
  const oldKm = oldVehicle.current_km || 0;
  const newKm = newVehicle.current_km || 0;
  const difference = newKm - oldKm;
  const sign = difference >= 0 ? '+' : '';
  
  return await createAuditLog({
    ipAddress: metadata.ipAddress,
    browser: metadata.browser,
    userId: metadata.userId,
    source: 'fleet_management',
    remark: `Updated odometer for vehicle "${oldVehicle.vehicle_nickname || oldVehicle.vehicle_number}": ${oldKm} km → ${newKm} km (${sign}${difference} km)`,
    oldValue: {
      id: oldVehicle.id,
      vehicle_number: oldVehicle.vehicle_number,
      vehicle_nickname: oldVehicle.vehicle_nickname,
      current_km: oldKm
    },
    newValue: {
      id: newVehicle.id,
      vehicle_number: newVehicle.vehicle_number,
      vehicle_nickname: newVehicle.vehicle_nickname,
      current_km: newKm
    }
  });
}

/**
 * Log vehicle status update (Active/Inactive/etc)
 * @param {Object} oldVehicle - Original vehicle data
 * @param {Object} newVehicle - Updated vehicle data with new status
 * @param {Object} metadata - Request metadata
 * @returns {Promise<Object>} Log result
 */
async function logVehicleStatusUpdate(oldVehicle, newVehicle, metadata) {
  const statusMap = {
    1: 'Active',
    0: 'Inactive',
    '-1': 'Deleted',
    2: 'Under Maintenance',
    3: 'Out of Service'
  };
  
  const oldStatus = statusMap[oldVehicle.status] || `Status ${oldVehicle.status}`;
  const newStatus = statusMap[newVehicle.status] || `Status ${newVehicle.status}`;
  
  return await createAuditLog({
    ipAddress: metadata.ipAddress,
    browser: metadata.browser,
    userId: metadata.userId,
    source: 'fleet_management',
    remark: `Updated status for vehicle "${oldVehicle.vehicle_nickname || oldVehicle.vehicle_number}": ${oldStatus} → ${newStatus}`,
    oldValue: {
      id: oldVehicle.id,
      vehicle_number: oldVehicle.vehicle_number,
      vehicle_nickname: oldVehicle.vehicle_nickname,
      status: oldVehicle.status,
      status_text: oldStatus
    },
    newValue: {
      id: newVehicle.id,
      vehicle_number: newVehicle.vehicle_number,
      vehicle_nickname: newVehicle.vehicle_nickname,
      status: newVehicle.status,
      status_text: newStatus
    }
  });
}

/**
 * Log general vehicle update
 * @param {Object} oldVehicle - Original vehicle data
 * @param {Object} newVehicle - Updated vehicle data
 * @param {Object} metadata - Request metadata
 * @returns {Promise<Object>} Log result
 */
async function logVehicleUpdate(oldVehicle, newVehicle, metadata) {
  const changes = [];
  
  // Track all changed fields
  const fieldsToTrack = [
    { key: 'vehicle_nickname', label: 'Nickname' },
    { key: 'vehicle_number', label: 'Number' },
    { key: 'vehicle_type', label: 'Type' },
    { key: 'vehicle_vin', label: 'VIN' },
    { key: 'vehicle_year', label: 'Year' },
    { key: 'vehicle_configuration', label: 'Configuration' },
    { key: 'vehicle_comments', label: 'Comments' },
    { key: 'has_wheelchair', label: 'Wheelchair Access' }
  ];
  
  fieldsToTrack.forEach(field => {
    if (oldVehicle[field.key] !== newVehicle[field.key]) {
      changes.push(`${field.label}: "${oldVehicle[field.key] || 'N/A'}" → "${newVehicle[field.key] || 'N/A'}"`);
    }
  });
  
  const remark = changes.length > 0
    ? `Updated vehicle "${oldVehicle.vehicle_nickname || oldVehicle.vehicle_number}": ${changes.join(', ')}`
    : `Updated vehicle "${oldVehicle.vehicle_nickname || oldVehicle.vehicle_number}"`;
  
  return await createAuditLog({
    ipAddress: metadata.ipAddress,
    browser: metadata.browser,
    userId: metadata.userId,
    source: 'fleet_management',
    remark,
    oldValue: oldVehicle,
    newValue: newVehicle
  });
}

/**
 * Log vehicle KM sync status update
 * @param {Object} oldVehicle - Original vehicle data
 * @param {Object} newVehicle - Updated vehicle data with new KM sync status
 * @param {Object} metadata - Request metadata
 * @returns {Promise<Object>} Log result
 */
async function logVehicleKmSyncStatusUpdate(oldVehicle, newVehicle, metadata) {
  const statusMap = {
    'synced': 'Synced',
    'paused': 'Paused',
    'resumed': 'Resumed',
    null: 'Not Set'
  };
  
  const oldStatus = statusMap[oldVehicle.km_sync_status] || oldVehicle.km_sync_status || 'Not Set';
  const newStatus = statusMap[newVehicle.km_sync_status] || newVehicle.km_sync_status || 'Not Set';
  
  return await createAuditLog({
    ipAddress: metadata.ipAddress,
    browser: metadata.browser,
    userId: metadata.userId,
    source: 'fleet_management',
    remark: `Updated KM sync status for vehicle "${oldVehicle.vehicle_nickname || oldVehicle.vehicle_number}": ${oldStatus} → ${newStatus}`,
    oldValue: {
      id: oldVehicle.id,
      vehicle_number: oldVehicle.vehicle_number,
      vehicle_nickname: oldVehicle.vehicle_nickname,
      km_sync_status: oldVehicle.km_sync_status,
      km_sync_status_text: oldStatus
    },
    newValue: {
      id: newVehicle.id,
      vehicle_number: newVehicle.vehicle_number,
      vehicle_nickname: newVehicle.vehicle_nickname,
      km_sync_status: newVehicle.km_sync_status,
      km_sync_status_text: newStatus
    }
  });
}

/**
 * ===================================
 * INTERVAL CONFIGURATION LOGGING FUNCTIONS
 * ===================================
 */

/**
 * Log interval configuration creation
 * @param {Object} config - Created interval configuration data
 * @param {Object} metadata - Request metadata (ip, browser, userId)
 * @returns {Promise<Object>} Log result
 */
async function logIntervalConfigCreated(config, metadata) {
  return await createAuditLog({
    ipAddress: metadata.ipAddress,
    browser: metadata.browser,
    userId: metadata.userId,
    source: 'Maintenance Interval Configuration',
    remark: `Created new interval configuration: "${config.setting_name}"`,
    oldValue: null,
    newValue: config
  });
}

/**
 * Log interval configuration update
 * @param {Object} oldConfig - Original interval configuration data
 * @param {Object} newConfig - Updated interval configuration data
 * @param {Object} metadata - Request metadata
 * @returns {Promise<Object>} Log result
 */
async function logIntervalConfigUpdated(oldConfig, newConfig, metadata) {
  // Build a list of changed fields
  const changes = [];
  
  if (oldConfig.setting_name !== newConfig.setting_name) {
    changes.push(`name: "${oldConfig.setting_name}" → "${newConfig.setting_name}"`);
  }
  if (oldConfig.setting_type !== newConfig.setting_type) {
    changes.push(`type: "${oldConfig.setting_type}" → "${newConfig.setting_type}"`);
  }
  if (oldConfig.status !== newConfig.status) {
    const oldStatus = oldConfig.status === 1 ? 'Active' : 'Inactive';
    const newStatus = newConfig.status === 1 ? 'Active' : 'Inactive';
    changes.push(`status: ${oldStatus} → ${newStatus}`);
  }
  if (oldConfig.time_unit !== newConfig.time_unit) {
    const formatTimeUnit = (unit) => {
      if (!unit) return 'None';
      // Capitalize first letter for display
      return unit.charAt(0).toUpperCase() + unit.slice(1);
    };
    changes.push(`time unit: ${formatTimeUnit(oldConfig.time_unit)} → ${formatTimeUnit(newConfig.time_unit)}`);
  }
  if (oldConfig.icon_name !== newConfig.icon_name) {
    changes.push(`icon: "${oldConfig.icon_name}" → "${newConfig.icon_name}"`);
  }

  const remark = changes.length > 0
    ? `Updated interval configuration "${oldConfig.setting_name}": ${changes.join(', ')}`
    : `Updated interval configuration "${oldConfig.setting_name}"`;

  return await createAuditLog({
    ipAddress: metadata.ipAddress,
    browser: metadata.browser,
    userId: metadata.userId,
    source: 'Maintenance Interval Configuration',
    remark,
    oldValue: oldConfig,
    newValue: newConfig
  });
}

/**
 * Log interval configuration deletion
 * @param {Object} config - Deleted interval configuration data
 * @param {Object} metadata - Request metadata
 * @returns {Promise<Object>} Log result
 */
async function logIntervalConfigDeleted(config, metadata) {
  return await createAuditLog({
    ipAddress: metadata.ipAddress,
    browser: metadata.browser,
    userId: metadata.userId,
    source: 'Maintenance Interval Configuration',
    remark: `Deleted interval configuration: "${config.setting_name}"`,
    oldValue: config,
    newValue: null
  });
}

/**
 * Log interval configuration status update
 * @param {Object} oldConfig - Original interval configuration data
 * @param {Object} newConfig - Updated interval configuration data with new status
 * @param {Object} metadata - Request metadata
 * @returns {Promise<Object>} Log result
 */
async function logIntervalConfigStatusUpdate(oldConfig, newConfig, metadata) {
  const statusMap = {
    1: 'Active',
    2: 'Inactive'
  };
  
  const oldStatus = statusMap[oldConfig.status] || `Status ${oldConfig.status}`;
  const newStatus = statusMap[newConfig.status] || `Status ${newConfig.status}`;
  
  return await createAuditLog({
    ipAddress: metadata.ipAddress,
    browser: metadata.browser,
    userId: metadata.userId,
    source: 'Maintenance Interval Configuration',
    remark: `Updated status for interval configuration "${oldConfig.setting_name}": ${oldStatus} → ${newStatus}`,
    oldValue: {
      id: oldConfig.id,
      setting_name: oldConfig.setting_name,
      setting_type: oldConfig.setting_type,
      status: oldConfig.status,
      status_text: oldStatus,
      time_unit: oldConfig.time_unit,
      icon_name: oldConfig.icon_name,
      added_by: oldConfig.added_by,
      added_by_name: oldConfig.added_by_name
    },
    newValue: {
      id: newConfig.id,
      setting_name: newConfig.setting_name,
      setting_type: newConfig.setting_type,
      status: newConfig.status,
      status_text: newStatus,
      time_unit: newConfig.time_unit,
      icon_name: newConfig.icon_name,
      added_by: newConfig.added_by,
      added_by_name: newConfig.added_by_name
    }
  });
}

/**
 * Log interval configuration bulk status update
 * @param {Array} configs - Array of interval configurations with old and new status
 * @param {number} newStatus - New status value (1 = Active, 2 = Inactive)
 * @param {Object} metadata - Request metadata
 * @returns {Promise<Object>} Log result
 */
async function logIntervalConfigBulkStatusUpdate(configs, newStatus, metadata) {
  const statusMap = {
    1: 'Active',
    2: 'Inactive'
  };
  
  const newStatusText = statusMap[newStatus] || `Status ${newStatus}`;
  const configNames = configs.map(c => c.setting_name).join(', ');
  
  return await createAuditLog({
    ipAddress: metadata.ipAddress,
    browser: metadata.browser,
    userId: metadata.userId,
    source: 'Maintenance Interval Configuration',
    remark: `Bulk updated ${configs.length} interval configuration(s) to ${newStatusText}: ${configNames}`,
    oldValue: configs,
    newValue: configs.map(c => ({ ...c, status: newStatus }))
  });
}

/**
 * ===================================
 * SCHEDULED CONFIGURATION LOGGING FUNCTIONS
 * ===================================
 */

/**
 * Log scheduled configuration creation
 * @param {Object} config - Created scheduled configuration data
 * @param {Object} metadata - Request metadata (ip, browser, userId)
 * @returns {Promise<Object>} Log result
 */
async function logScheduledConfigCreated(config, metadata) {
  return await createAuditLog({
    ipAddress: metadata.ipAddress,
    browser: metadata.browser,
    userId: metadata.userId,
    source: 'Maintenance Data Setup',
    remark: `Created new scheduled configuration: "${config.configuration_name}"`,
    oldValue: null,
    newValue: config
  });
}

/**
 * Log scheduled configuration update
 * @param {Object} oldConfig - Original scheduled configuration data
 * @param {Object} newConfig - Updated scheduled configuration data
 * @param {Object} metadata - Request metadata
 * @returns {Promise<Object>} Log result
 */
async function logScheduledConfigUpdated(oldConfig, newConfig, metadata) {
  // Build a list of changed fields
  const changes = [];
  
  if (oldConfig.configuration_name !== newConfig.configuration_name) {
    changes.push(`name: "${oldConfig.configuration_name}" → "${newConfig.configuration_name}"`);
  }
  if (oldConfig.status !== newConfig.status) {
    const oldStatus = oldConfig.status === 1 ? 'Active' : 'Inactive';
    const newStatus = newConfig.status === 1 ? 'Active' : 'Inactive';
    changes.push(`status: ${oldStatus} → ${newStatus}`);
  }

  const remark = changes.length > 0
    ? `Updated scheduled configuration "${oldConfig.configuration_name}": ${changes.join(', ')}`
    : `Updated scheduled configuration "${oldConfig.configuration_name}"`;

  return await createAuditLog({
    ipAddress: metadata.ipAddress,
    browser: metadata.browser,
    userId: metadata.userId,
    source: 'Maintenance Data Setup',
    remark,
    oldValue: oldConfig,
    newValue: newConfig
  });
}

/**
 * Log scheduled configuration deletion
 * @param {Object} config - Deleted scheduled configuration data
 * @param {Object} metadata - Request metadata
 * @returns {Promise<Object>} Log result
 */
async function logScheduledConfigDeleted(config, metadata) {
  return await createAuditLog({
    ipAddress: metadata.ipAddress,
    browser: metadata.browser,
    userId: metadata.userId,
    source: 'Maintenance Data Setup',
    remark: `Deleted scheduled configuration: "${config.configuration_name}"`,
    oldValue: config,
    newValue: null
  });
}

/**
 * Log scheduled configuration duplication
 * @param {Object} oldConfig - Original scheduled configuration data
 * @param {Object} newConfig - Duplicated scheduled configuration data
 * @param {Object} metadata - Request metadata
 * @returns {Promise<Object>} Log result
 */
async function logScheduledConfigDuplicated(oldConfig, newConfig, metadata) {
  return await createAuditLog({
    ipAddress: metadata.ipAddress,
    browser: metadata.browser,
    userId: metadata.userId,
    source: 'Maintenance Data Setup',
    remark: `Duplicated scheduled configuration: "${oldConfig.configuration_name}" → "${newConfig.configuration_name}"`,
    oldValue: oldConfig,
    newValue: newConfig
  });
}

/**
 * Log scheduled configuration status toggle
 * @param {Object} oldConfig - Original scheduled configuration data
 * @param {Object} newConfig - Updated scheduled configuration data with new status
 * @param {Object} metadata - Request metadata
 * @returns {Promise<Object>} Log result
 */
async function logScheduledConfigStatusToggle(oldConfig, newConfig, metadata) {
  const statusMap = {
    1: 'Active',
    2: 'Inactive'
  };
  
  const oldStatus = statusMap[oldConfig.status] || `Status ${oldConfig.status}`;
  const newStatus = statusMap[newConfig.status] || `Status ${newConfig.status}`;
  
  return await createAuditLog({
    ipAddress: metadata.ipAddress,
    browser: metadata.browser,
    userId: metadata.userId,
    source: 'Maintenance Data Setup',
    remark: `Toggled status for scheduled configuration "${oldConfig.configuration_name}": ${oldStatus} → ${newStatus}`,
    oldValue: {
      id: oldConfig.id,
      configuration_name: oldConfig.configuration_name,
      status: oldConfig.status,
      status_text: oldStatus
    },
    newValue: {
      id: newConfig.id,
      configuration_name: newConfig.configuration_name,
      status: newConfig.status,
      status_text: newStatus
    }
  });
}

/**
 * Log scheduled configuration bulk delete
 * @param {Array} configs - Array of scheduled configurations to delete
 * @param {Object} metadata - Request metadata
 * @returns {Promise<Object>} Log result
 */
async function logScheduledConfigBulkDelete(configs, metadata) {
  const configNames = configs.map(c => c.configuration_name).join(', ');
  
  return await createAuditLog({
    ipAddress: metadata.ipAddress,
    browser: metadata.browser,
    userId: metadata.userId,
    source: 'Maintenance Data Setup',
    remark: `Bulk deleted ${configs.length} scheduled configuration(s): ${configNames}`,
    oldValue: configs,
    newValue: null
  });
}

/**
 * Log scheduled configuration bulk status update
 * @param {Array} configs - Array of scheduled configurations with old and new status
 * @param {number} newStatus - New status value (1 = Active, 2 = Inactive)
 * @param {Object} metadata - Request metadata
 * @returns {Promise<Object>} Log result
 */
async function logScheduledConfigBulkStatusUpdate(configs, newStatus, metadata) {
  const statusMap = {
    1: 'Active',
    2: 'Inactive'
  };
  
  const newStatusText = statusMap[newStatus] || `Status ${newStatus}`;
  const configNames = configs.map(c => c.configuration_name).join(', ');
  
  return await createAuditLog({
    ipAddress: metadata.ipAddress,
    browser: metadata.browser,
    userId: metadata.userId,
    source: 'Maintenance Data Setup',
    remark: `Bulk updated ${configs.length} scheduled configuration(s) to ${newStatusText}: ${configNames}`,
    oldValue: configs,
    newValue: configs.map(c => ({ ...c, status: newStatus }))
  });
}

/**
 * ===================================
 * CONFIGURATION SETTINGS LOGGING FUNCTIONS
 * ===================================
 */

/**
 * Log configuration setting creation
 * @param {Object} setting - Created configuration setting data
 * @param {Object} metadata - Request metadata (ip, browser, userId)
 * @returns {Promise<Object>} Log result
 */
async function logConfigurationSettingCreated(setting, metadata) {
  return await createAuditLog({
    ipAddress: metadata.ipAddress,
    browser: metadata.browser,
    userId: metadata.userId,
    source: 'Maintenance Data Setup',
    remark: `Created new configuration setting: "${setting.setting_name}" for configuration "${setting.configuration_name || 'ID ' + setting.configuration}"`,
    oldValue: null,
    newValue: setting
  });
}

/**
 * Log configuration setting update
 * @param {Object} oldSetting - Original configuration setting data
 * @param {Object} newSetting - Updated configuration setting data
 * @param {Object} metadata - Request metadata
 * @returns {Promise<Object>} Log result
 */
async function logConfigurationSettingUpdated(oldSetting, newSetting, metadata) {
  // Build a list of changed fields
  const changes = [];
  
  if (oldSetting.kms !== newSetting.kms) {
    changes.push(`KMS: ${oldSetting.kms} → ${newSetting.kms}`);
  }
  if (oldSetting.kms_to_alert !== newSetting.kms_to_alert) {
    changes.push(`KMS Alert: ${oldSetting.kms_to_alert} → ${newSetting.kms_to_alert}`);
  }
  if (oldSetting.days !== newSetting.days) {
    changes.push(`Days: ${oldSetting.days} → ${newSetting.days}`);
  }
  if (oldSetting.days_to_alert !== newSetting.days_to_alert) {
    changes.push(`Days Alert: ${oldSetting.days_to_alert} → ${newSetting.days_to_alert}`);
  }
  if (oldSetting.time_unit !== newSetting.time_unit) {
    changes.push(`Time Unit: ${oldSetting.time_unit} → ${newSetting.time_unit}`);
  }
  if (oldSetting.status !== newSetting.status) {
    const oldStatus = oldSetting.status === 1 ? 'Active' : 'Inactive';
    const newStatus = newSetting.status === 1 ? 'Active' : 'Inactive';
    changes.push(`Status: ${oldStatus} → ${newStatus}`);
  }

  const remark = changes.length > 0
    ? `Updated configuration setting "${newSetting.setting_name}": ${changes.join(', ')}`
    : `Updated configuration setting "${newSetting.setting_name}"`;

  return await createAuditLog({
    ipAddress: metadata.ipAddress,
    browser: metadata.browser,
    userId: metadata.userId,
    source: 'Maintenance Data Setup',
    remark,
    oldValue: oldSetting,
    newValue: newSetting
  });
}

/**
 * Log configuration setting deletion
 * @param {Object} setting - Deleted configuration setting data
 * @param {Object} metadata - Request metadata
 * @returns {Promise<Object>} Log result
 */
async function logConfigurationSettingDeleted(setting, metadata) {
  return await createAuditLog({
    ipAddress: metadata.ipAddress,
    browser: metadata.browser,
    userId: metadata.userId,
    source: 'Maintenance Data Setup',
    remark: `Deleted configuration setting: "${setting.setting_name}" from configuration "${setting.configuration_name || 'ID ' + setting.configuration}"`,
    oldValue: setting,
    newValue: null
  });
}

/**
 * Log configuration setting status toggle
 * @param {Object} oldSetting - Original configuration setting data
 * @param {Object} newSetting - Updated configuration setting data with new status
 * @param {Object} metadata - Request metadata
 * @returns {Promise<Object>} Log result
 */
async function logConfigurationSettingStatusToggle(oldSetting, newSetting, metadata) {
  const statusMap = {
    1: 'Active',
    2: 'Inactive'
  };
  
  const oldStatus = statusMap[oldSetting.status] || `Status ${oldSetting.status}`;
  const newStatus = statusMap[newSetting.status] || `Status ${newSetting.status}`;
  
  return await createAuditLog({
    ipAddress: metadata.ipAddress,
    browser: metadata.browser,
    userId: metadata.userId,
    source: 'Maintenance Data Setup',
    remark: `Toggled status for configuration setting "${oldSetting.setting_name}": ${oldStatus} → ${newStatus}`,
    oldValue: {
      id: oldSetting.id,
      setting_name: oldSetting.setting_name,
      configuration: oldSetting.configuration,
      status: oldSetting.status,
      status_text: oldStatus
    },
    newValue: {
      id: newSetting.id,
      setting_name: newSetting.setting_name,
      configuration: newSetting.configuration,
      status: newSetting.status,
      status_text: newStatus
    }
  });
}

/**
 * ===================================
 * PAYMENT METHODS LOGGING FUNCTIONS
 * ===================================
 */

/**
 * Log payment method creation
 * @param {Object} paymentMethod - Created payment method data
 * @param {Object} metadata - Request metadata (ip, browser, userId)
 * @returns {Promise<Object>} Log result
 */
async function logPaymentMethodCreated(paymentMethod, metadata) {
  return await createAuditLog({
    ipAddress: metadata.ipAddress,
    browser: metadata.browser,
    userId: metadata.userId,
    source: 'Payment Methods',
    remark: `Created new payment method: "${paymentMethod.name}"`,
    oldValue: null,
    newValue: paymentMethod
  });
}

/**
 * Log payment method update
 * @param {Object} oldPaymentMethod - Original payment method data
 * @param {Object} newPaymentMethod - Updated payment method data
 * @param {Object} metadata - Request metadata
 * @returns {Promise<Object>} Log result
 */
async function logPaymentMethodUpdated(oldPaymentMethod, newPaymentMethod, metadata) {
  // Build a list of changed fields
  const changes = [];
  
  if (oldPaymentMethod.name !== newPaymentMethod.name) {
    changes.push(`name: "${oldPaymentMethod.name}" → "${newPaymentMethod.name}"`);
  }
  if (oldPaymentMethod.status !== newPaymentMethod.status) {
    const oldStatus = oldPaymentMethod.status === 1 ? 'Active' : 'Inactive';
    const newStatus = newPaymentMethod.status === 1 ? 'Active' : 'Inactive';
    changes.push(`status: ${oldStatus} → ${newStatus}`);
  }

  const remark = changes.length > 0
    ? `Updated payment method "${oldPaymentMethod.name}": ${changes.join(', ')}`
    : `Updated payment method "${oldPaymentMethod.name}"`;

  return await createAuditLog({
    ipAddress: metadata.ipAddress,
    browser: metadata.browser,
    userId: metadata.userId,
    source: 'Payment Methods',
    remark,
    oldValue: oldPaymentMethod,
    newValue: newPaymentMethod
  });
}

/**
 * Log payment method deletion
 * @param {Object} paymentMethod - Deleted payment method data
 * @param {Object} metadata - Request metadata
 * @returns {Promise<Object>} Log result
 */
async function logPaymentMethodDeleted(paymentMethod, metadata) {
  return await createAuditLog({
    ipAddress: metadata.ipAddress,
    browser: metadata.browser,
    userId: metadata.userId,
    source: 'Payment Methods',
    remark: `Deleted payment method: \"${paymentMethod.name}\"`,
    oldValue: paymentMethod,
    newValue: null
  });
}

/**
 * ===================================
 * VENDOR MANAGEMENT LOGGING FUNCTIONS
 * ===================================
 */

/**
 * Log vendor creation
 * @param {Object} vendor - Created vendor data
 * @param {Object} metadata - Request metadata (ip, browser, userId)
 * @returns {Promise<Object>} Log result
 */
async function logVendorCreated(vendor, metadata) {
  return await createAuditLog({
    ipAddress: metadata.ipAddress,
    browser: metadata.browser,
    userId: metadata.userId,
    source: 'Manage Vendors',
    remark: `Created new vendor: \"${vendor.vendor_name}\"`,
    oldValue: null,
    newValue: vendor
  });
}

/**
 * Log vendor update
 * @param {Object} oldVendor - Original vendor data
 * @param {Object} newVendor - Updated vendor data
 * @param {Object} metadata - Request metadata
 * @returns {Promise<Object>} Log result
 */
async function logVendorUpdated(oldVendor, newVendor, metadata) {
  // Build a list of changed fields
  const changes = [];
  
  if (oldVendor.vendor_name !== newVendor.vendor_name) {
    changes.push(`name: \"${oldVendor.vendor_name}\" → \"${newVendor.vendor_name}\"`);
  }
  if (oldVendor.vendor_address !== newVendor.vendor_address) {
    changes.push(`address: \"${oldVendor.vendor_address || 'N/A'}\" → \"${newVendor.vendor_address || 'N/A'}\"`);
  }
  if (oldVendor.vendor_email !== newVendor.vendor_email) {
    changes.push(`email: \"${oldVendor.vendor_email || 'N/A'}\" → \"${newVendor.vendor_email || 'N/A'}\"`);
  }
  if (oldVendor.vendor_phone !== newVendor.vendor_phone) {
    changes.push(`phone: \"${oldVendor.vendor_phone || 'N/A'}\" → \"${newVendor.vendor_phone || 'N/A'}\"`);
  }
  if (oldVendor.vendor_notes !== newVendor.vendor_notes) {
    changes.push(`notes: Updated`);
  }
  if (oldVendor.status !== newVendor.status) {
    const oldStatus = oldVendor.status === 1 ? 'Active' : 'Inactive';
    const newStatus = newVendor.status === 1 ? 'Active' : 'Inactive';
    changes.push(`status: ${oldStatus} → ${newStatus}`);
  }

  const remark = changes.length > 0
    ? `Updated vendor \"${oldVendor.vendor_name}\": ${changes.join(', ')}`
    : `Updated vendor \"${oldVendor.vendor_name}\"`;

  return await createAuditLog({
    ipAddress: metadata.ipAddress,
    browser: metadata.browser,
    userId: metadata.userId,
    source: 'Manage Vendors',
    remark,
    oldValue: oldVendor,
    newValue: newVendor
  });
}

/**
 * Log vendor deletion (soft delete)
 * @param {Object} vendor - Deleted vendor data
 * @param {Object} metadata - Request metadata
 * @returns {Promise<Object>} Log result
 */
async function logVendorDeleted(vendor, metadata) {
  return await createAuditLog({
    ipAddress: metadata.ipAddress,
    browser: metadata.browser,
    userId: metadata.userId,
    source: 'Manage Vendors',
    remark: `Deactivated vendor: \"${vendor.vendor_name}\"`,
    oldValue: vendor,
    newValue: { ...vendor, status: 0 }
  });
}

/**
 * ===================================
 * DEFECT MANAGEMENT LOGGING FUNCTIONS
 * ===================================
 */

/**
 * Log defect creation
 * @param {Object} defect - Created defect data
 * @param {Object} metadata - Request metadata (ip, browser, userId)
 * @returns {Promise<Object>} Log result
 */
async function logDefectCreated(defect, metadata) {
  const vehicleInfo = defect.vehicle_nickname || defect.vehicle_number || `ID ${defect.vehicle_id}`;
  const categoryInfo = defect.category_name || 'N/A';
  const description = defect.notes || defect.defect_comments || 'No description';
  const defectId = defect.id || 'N/A';
  
  return await createAuditLog({
    ipAddress: metadata.ipAddress,
    browser: metadata.browser,
    userId: metadata.userId,
    source: 'Manage Defects',
    remark: `Created new defect #${defectId} for vehicle "${vehicleInfo}": ${categoryInfo} - ${description}`,
    oldValue: null,
    newValue: defect
  });
}

/**
 * Log defect update
 * @param {Object} oldDefect - Original defect data
 * @param {Object} newDefect - Updated defect data
 * @param {Object} metadata - Request metadata
 * @returns {Promise<Object>} Log result
 */
async function logDefectUpdated(oldDefect, newDefect, metadata) {
  const changes = [];
  
  const fieldsToTrack = [
    { key: 'defect_brief', label: 'Issue' },
    { key: 'defect_comments', label: 'Description' },
    { key: 'category_name', label: 'Category' },
    { key: 'defect_status', label: 'Defect Status' },
    { key: 'manager_status', label: 'Manager Status' },
    { key: 'motive_defect_id', label: 'Motive ID' },
    { key: 'defect_location', label: 'Location' },
    { key: 'notes', label: 'Notes' }
  ];
  
  fieldsToTrack.forEach(field => {
    if (oldDefect[field.key] !== newDefect[field.key]) {
      changes.push(`${field.label}: "${oldDefect[field.key] || 'N/A'}\" → \"${newDefect[field.key] || 'N/A'}"`);
    }
  });
  
  const vehicleInfo = newDefect.vehicle_nickname || newDefect.vehicle_number || `ID ${newDefect.vehicle_id}`;
  const defectId = newDefect.id || oldDefect.id || 'N/A';
  const remark = changes.length > 0
    ? `Updated defect #${defectId} for vehicle "${vehicleInfo}": ${changes.join(', ')}`
    : `Updated defect #${defectId} for vehicle "${vehicleInfo}"`;
  
  return await createAuditLog({
    ipAddress: metadata.ipAddress,
    browser: metadata.browser,
    userId: metadata.userId,
    source: 'Manage Defects',
    remark,
    oldValue: oldDefect,
    newValue: newDefect
  });
}

/**
 * Log defect status update
 * @param {Object} oldDefect - Original defect data
 * @param {Object} newDefect - Updated defect with new status
 * @param {Object} metadata - Request metadata
 * @returns {Promise<Object>} Log result
 */
async function logDefectStatusUpdate(oldDefect, newDefect, metadata) {
  const vehicleInfo = oldDefect.vehicle_nickname || oldDefect.vehicle_number || `ID ${oldDefect.vehicle_id}`;
  
  return await createAuditLog({
    ipAddress: metadata.ipAddress,
    browser: metadata.browser,
    userId: metadata.userId,
    source: 'Manage Defects',
    remark: `Updated defect status for vehicle "${vehicleInfo}": ${oldDefect.defect_status || 'N/A'} → ${newDefect.defect_status || 'N/A'}`,
    oldValue: {
      id: oldDefect.id,
      vehicle_id: oldDefect.vehicle_id,
      vehicle_nickname: oldDefect.vehicle_nickname,
      defect_status: oldDefect.defect_status,
      defect_comments: oldDefect.defect_comments
    },
    newValue: {
      id: newDefect.id,
      vehicle_id: newDefect.vehicle_id,
      vehicle_nickname: newDefect.vehicle_nickname,
      defect_status: newDefect.defect_status,
      defect_comments: newDefect.defect_comments
    }
  });
}

/**
 * Log defect manager status update
 * @param {Object} oldDefect - Original defect data
 * @param {Object} newDefect - Updated defect with new manager status
 * @param {Object} metadata - Request metadata
 * @returns {Promise<Object>} Log result
 */
async function logDefectManagerStatusUpdate(oldDefect, newDefect, metadata) {
  const vehicleInfo = oldDefect.vehicle_nickname || oldDefect.vehicle_number || `ID ${oldDefect.vehicle_id}`;
  const managerInfo = newDefect.manager_name || newDefect.manager_id || 'Manager';
  
  return await createAuditLog({
    ipAddress: metadata.ipAddress,
    browser: metadata.browser,
    userId: metadata.userId,
    source: 'Manage Defects',
    remark: `${managerInfo} updated manager status for vehicle "${vehicleInfo}": ${oldDefect.manager_status || 'Pending'} → ${newDefect.manager_status || 'N/A'}`,
    oldValue: {
      id: oldDefect.id,
      vehicle_id: oldDefect.vehicle_id,
      manager_status: oldDefect.manager_status,
      manager_id: oldDefect.manager_id,
      manager_name: oldDefect.manager_name
    },
    newValue: {
      id: newDefect.id,
      vehicle_id: newDefect.vehicle_id,
      manager_status: newDefect.manager_status,
      manager_id: newDefect.manager_id,
      manager_name: newDefect.manager_name
    }
  });
}

/**
 * Log defect approval by manager
 * @param {Object} defect - Approved defect data
 * @param {Object} metadata - Request metadata
 * @returns {Promise<Object>} Log result
 */
async function logDefectApproved(defect, metadata) {
  const vehicleInfo = defect.vehicle_nickname || defect.vehicle_number || `ID ${defect.vehicle_id}`;
  const managerInfo = defect.manager_name || `Manager ID ${defect.manager_id}`;
  
  return await createAuditLog({
    ipAddress: metadata.ipAddress,
    browser: metadata.browser,
    userId: metadata.userId,
    source: 'Manage Defects',
    remark: `${managerInfo} approved defect for vehicle "${vehicleInfo}"`,
    oldValue: {
      id: defect.id,
      manager_status: 'Pending',
      defect_status: defect.old_defect_status
    },
    newValue: {
      id: defect.id,
      manager_status: 'Approved',
      manager_id: defect.manager_id,
      manager_name: defect.manager_name,
      defect_status: defect.defect_status
    }
  });
}

/**
 * Log defect merge operation
 * @param {Array} defects - Array of defects being merged
 * @param {number} primaryDefectId - ID of primary defect
 * @param {Object} metadata - Request metadata
 * @returns {Promise<Object>} Log result
 */
async function logDefectsMerged(defects, primaryDefectId, metadata) {
  const defectIds = defects.map(d => d.id || d).join(', ');
  const primaryDefect = defects.find(d => d.id === primaryDefectId) || { vehicle_nickname: 'Unknown' };
  const vehicleInfo = primaryDefect.vehicle_nickname || primaryDefect.vehicle_number || `ID ${primaryDefect.vehicle_id}`;
  
  return await createAuditLog({
    ipAddress: metadata.ipAddress,
    browser: metadata.browser,
    userId: metadata.userId,
    source: 'Manage Defects',
    remark: `Merged ${defects.length} defects (IDs: ${defectIds}) for vehicle "${vehicleInfo}" into primary defect #${primaryDefectId}`,
    oldValue: null,
    newValue: null
  });
}

/**
 * Log defect unmerge operation
 * @param {Array} defects - Array of defects being unmerged
 * @param {number} primaryDefectId - ID of the primary defect (if any)
 * @param {Object} metadata - Request metadata
 * @returns {Promise<Object>} Log result
 */
async function logDefectsUnmerged(defects, primaryDefectId, metadata) {
  const defectIds = defects.map(d => d.id || d).join(', ');
  
  let remark = `Unmerged ${defects.length} defect(s) (IDs: ${defectIds})`;
  
  if (primaryDefectId) {
    remark += ` from primary defect #${primaryDefectId}`;
  }
  
  return await createAuditLog({
    ipAddress: metadata.ipAddress,
    browser: metadata.browser,
    userId: metadata.userId,
    source: 'Manage Defects',
    remark,
    oldValue: null,
    newValue: null
  });
}

/**
 * Log repair not needed action
 * @param {Array} defects - Array of defects marked as repair not needed
 * @param {Object} metadata - Request metadata
 * @returns {Promise<Object>} Log result
 */
async function logDefectsRepairNotNeeded(defects, metadata) {
  const defectIds = defects.map(d => d.id || d).join(', ');
  
  return await createAuditLog({
    ipAddress: metadata.ipAddress,
    browser: metadata.browser,
    userId: metadata.userId,
    source: 'Manage Defects',
    remark: `Marked ${defects.length} defect(s) as "Repair Not Needed" (IDs: ${defectIds})`,
    oldValue: defects.map(d => ({
      id: d.id,
      defect_status: d.old_defect_status || d.defect_status
    })),
    newValue: defects.map(d => ({
      id: d.id,
      defect_status: 'Repair_Not_Required'
    }))
  });
}

/**
 * Log defect cancellation/rejection
 * @param {Array} defects - Array of defects being cancelled
 * @param {Object} metadata - Request metadata
 * @returns {Promise<Object>} Log result
 */
async function logDefectsCancelled(defects, metadata) {
  const defectIds = defects.map(d => d.id || d).join(', ');
  
  return await createAuditLog({
    ipAddress: metadata.ipAddress,
    browser: metadata.browser,
    userId: metadata.userId,
    source: 'Manage Defects',
    remark: `Cancelled/Rejected ${defects.length} defect(s) (IDs: ${defectIds})`,
    oldValue: defects.map(d => ({
      id: d.id,
      defect_status: d.old_defect_status || d.defect_status,
      manager_status: d.manager_status
    })),
    newValue: defects.map(d => ({
      id: d.id,
      defect_status: 'Rejected',
      manager_status: 'Cancelled'
    }))
  });
}

/**
 * Log bulk defect updates
 * @param {Array} updates - Array of defect updates
 * @param {Object} metadata - Request metadata
 * @returns {Promise<Object>} Log result
 */
async function logDefectsBulkUpdated(updates, metadata) {
  const defectIds = updates.map(u => u.id || u.defect_id).join(', ');
  
  return await createAuditLog({
    ipAddress: metadata.ipAddress,
    browser: metadata.browser,
    userId: metadata.userId,
    source: 'Manage Defects',
    remark: `Bulk updated ${updates.length} defect(s) (IDs: ${defectIds})`,
    oldValue: updates,
    newValue: updates
  });
}

/**
 * Log inspection status update
 * @param {Object} defect - Defect with updated inspection status
 * @param {Object} metadata - Request metadata
 * @returns {Promise<Object>} Log result
 */
async function logDefectInspectionStatusUpdate(defect, metadata) {
  const vehicleInfo = defect.vehicle_nickname || defect.vehicle_number || `ID ${defect.vehicle_id}`;
  
  return await createAuditLog({
    ipAddress: metadata.ipAddress,
    browser: metadata.browser,
    userId: metadata.userId,
    source: 'Manage Defects',
    remark: `Updated inspection status for defect #${defect.id} on vehicle "${vehicleInfo}": ${defect.inspection_status}`,
    oldValue: {
      id: defect.id,
      inspection_status: defect.old_inspection_status
    },
    newValue: {
      id: defect.id,
      inspection_status: defect.inspection_status,
      driver_signed: defect.driver_signed,
      driver_signed_date: defect.driver_signed_date
    }
  });
}

/**
 * ===================================
 * REPAIR ORDER (RO) LOGGING FUNCTIONS
 * ===================================
 */

/**
 * Log repair order creation
 * @param {Object} repairOrder - Created repair order data
 * @param {Object} metadata - Request metadata
 * @returns {Promise<Object>} Log result
 */
async function logRepairOrderCreated(repairOrder, metadata) {
  const vehicleInfo = repairOrder.vehicle_nickname || repairOrder.vehicle_number || `ID ${repairOrder.vehicle_id}`;
  const vendorInfo = repairOrder.vendor_name || `Vendor ID ${repairOrder.vendor_id}`;
  
  // Build defect IDs list
  const defectIds = repairOrder.defect_ids || [];
  const defectsList = defectIds.length > 0 ? defectIds.join(', ') : 'none';
  
  // Build maintenance IDs list
  const maintenanceIds = repairOrder.maintenance_ids || [];
  const maintenanceList = maintenanceIds.length > 0 ? maintenanceIds.join(', ') : 'none';
  
  return await createAuditLog({
    ipAddress: metadata.ipAddress,
    browser: metadata.browser,
    userId: metadata.userId,
    source: 'Manage Repair Orders',
    remark: `Created RO #${repairOrder.id} for vehicle "${vehicleInfo}" with vendor "${vendorInfo}" (Defects: ${defectsList}; Maintenance: ${maintenanceList})`,
    oldValue: null,
    newValue: repairOrder
  });
}

/**
 * Log repair order update/edit
 * @param {Object} oldRO - Original repair order data
 * @param {Object} newRO - Updated repair order data
 * @param {Object} metadata - Request metadata
 * @param {Object} defectChanges - Optional defect change tracking { defectsAdded: [], defectsRemoved: [], smAdded: [], smRemoved: [] }
 * @returns {Promise<Object>} Log result
 */
async function logRepairOrderUpdated(oldRO, newRO, metadata, defectChanges = null) {
  const changes = [];
  
  const fieldsToTrack = [
    { key: 'vendor_id', label: 'Vendor' },
    { key: 'vendor_name', label: 'Vendor Name' },
    { key: 'purchase_order_number', label: 'PO Number' },
    { key: 'issue_date', label: 'Issue Date' },
    { key: 'expected_completion_date', label: 'Expected Completion' },
    { key: 'repair_order_status', label: 'Status' }
  ];
  
  fieldsToTrack.forEach(field => {
    if (oldRO[field.key] !== newRO[field.key]) {
      changes.push(`${field.label}: "${oldRO[field.key] || 'N/A'}" → "${newRO[field.key] || 'N/A'}"`);
    }
  });
  
  // Add defect changes to the main remark if provided (show just IDs, matching Create RO format)
  if (defectChanges) {
    if (defectChanges.defectsAdded && defectChanges.defectsAdded.length > 0) {
      changes.push(`Added Defects: ${defectChanges.defectsAdded.join(', ')}`);
    }
    
    if (defectChanges.defectsRemoved && defectChanges.defectsRemoved.length > 0) {
      changes.push(`Removed Defects: ${defectChanges.defectsRemoved.join(', ')}`);
    }
    
    if (defectChanges.smAdded && defectChanges.smAdded.length > 0) {
      changes.push(`Added Maintenance: ${defectChanges.smAdded.join(', ')}`);
    }
    if (defectChanges.smRemoved && defectChanges.smRemoved.length > 0) {
      changes.push(`Removed Maintenance: ${defectChanges.smRemoved.join(', ')}`);
    }
  }
  
  const vehicleInfo = newRO.vehicle_nickname || newRO.vehicle_number || `ID ${newRO.vehicle_id}`;
  const remark = changes.length > 0
    ? `Updated RO #${newRO.id} for vehicle "${vehicleInfo}": ${changes.join(', ')}`
    : `Updated RO #${newRO.id} for vehicle "${vehicleInfo}"`;
  
  return await createAuditLog({
    ipAddress: metadata.ipAddress,
    browser: metadata.browser,
    userId: metadata.userId,
    source: 'Manage Repair Orders',
    remark,
    oldValue: oldRO,
    newValue: newRO
  });
}

/**
 * Log repair order completion
 * @param {Object} repairOrder - Completed repair order data
 * @param {Object} metadata - Request metadata
 * @returns {Promise<Object>} Log result
 */
async function logRepairOrderCompleted(repairOrder, metadata) {
  const vehicleInfo = repairOrder.vehicle_nickname || repairOrder.vehicle_number || `ID ${repairOrder.vehicle_id}`;
  const vendorInfo = repairOrder.vendor_name || `Vendor ID ${repairOrder.vendor_id}`;
  const totalCost = repairOrder.total_cost || repairOrder.invoice_amount || 0;
  
  return await createAuditLog({
    ipAddress: metadata.ipAddress,
    browser: metadata.browser,
    userId: metadata.userId,
    source: 'Manage Repair Orders',
    remark: `Completed RO #${repairOrder.id} for vehicle "${vehicleInfo}" with vendor "${vendorInfo}" - Total: $${totalCost}`,
    oldValue: {
      id: repairOrder.id,
      repair_order_status: 'In_Progress'
    },
    newValue: repairOrder
  });
}

/**
 * Log repair order status update
 * @param {Object} oldRO - Original repair order data
 * @param {Object} newRO - Updated repair order with new status
 * @param {Object} metadata - Request metadata
 * @returns {Promise<Object>} Log result
 */
async function logRepairOrderStatusUpdate(oldRO, newRO, metadata) {
  const vehicleInfo = oldRO.vehicle_nickname || oldRO.vehicle_number || `ID ${oldRO.vehicle_id}`;
  
  return await createAuditLog({
    ipAddress: metadata.ipAddress,
    browser: metadata.browser,
    userId: metadata.userId,
    source: 'Manage Repair Orders',
    remark: `Updated RO #${oldRO.id} status for vehicle "${vehicleInfo}": ${oldRO.repair_order_status} → ${newRO.repair_order_status}`,
    oldValue: {
      id: oldRO.id,
      repair_order_status: oldRO.repair_order_status
    },
    newValue: {
      id: newRO.id,
      repair_order_status: newRO.repair_order_status
    }
  });
}

/**
 * Log repair order cancellation
 * @param {Object} repairOrder - Cancelled repair order data
 * @param {Object} metadata - Request metadata
 * @returns {Promise<Object>} Log result
 */
async function logRepairOrderCancelled(repairOrder, metadata) {
  const vehicleInfo = repairOrder.vehicle_nickname || repairOrder.vehicle_number || `ID ${repairOrder.vehicle_id}`;
  const vendorInfo = repairOrder.vendor_name || `Vendor ID ${repairOrder.vendor_id}`;
  
  return await createAuditLog({
    ipAddress: metadata.ipAddress,
    browser: metadata.browser,
    userId: metadata.userId,
    source: 'Manage Repair Orders',
    remark: `Cancelled RO #${repairOrder.id} for vehicle "${vehicleInfo}" with vendor "${vendorInfo}"`,
    oldValue: repairOrder,
    newValue: {
      ...repairOrder,
      repair_order_status: 'Cancelled'
    }
  });
}

/**
 * Log repair order deletion
 * @param {Object} repairOrder - Deleted repair order data
 * @param {Object} metadata - Request metadata
 * @returns {Promise<Object>} Log result
 */
async function logRepairOrderDeleted(repairOrder, metadata) {
  const vehicleInfo = repairOrder.vehicle_nickname || repairOrder.vehicle_number || `ID ${repairOrder.vehicle_id}`;
  const vendorInfo = repairOrder.vendor_name || `Vendor ID ${repairOrder.vendor_id}`;
  
  return await createAuditLog({
    ipAddress: metadata.ipAddress,
    browser: metadata.browser,
    userId: metadata.userId,
    source: 'Manage Repair Orders',
    remark: `Deleted RO #${repairOrder.id} for vehicle "${vehicleInfo}" with vendor "${vendorInfo}"`,
    oldValue: repairOrder,
    newValue: null
  });
}

/**
 * ===================================
 * MAINTENANCE OPERATIONS LOGGING FUNCTIONS
 * ===================================
 */

/**
 * Log creation of defects from scheduled maintenance
 * @param {Array} createdDefects - Array of created defects
 * @param {Object} metadata - Request metadata
 * @returns {Promise<Object>} Log result
 */
async function logMaintenanceDefectsCreated(createdDefects, metadata) {
  const defectCount = createdDefects.length;
  const vehicleIds = [...new Set(createdDefects.map(d => d.vehicle_id))];
  const vehicleInfo = vehicleIds.length === 1 
    ? `vehicle ${createdDefects[0].vehicle_nickname || createdDefects[0].vehicle_number || vehicleIds[0]}`
    : `${vehicleIds.length} vehicles`;
  
  return await createAuditLog({
    ipAddress: metadata.ipAddress,
    browser: metadata.browser,
    userId: metadata.userId,
    source: 'Maintenance Operations',
    remark: `Created ${defectCount} maintenance defect(s) for ${vehicleInfo} from scheduled maintenance`,
    oldValue: null,
    newValue: createdDefects
  });
}

/**
 * ===================================
 * SERVICE HISTORY LOGGING FUNCTIONS
 * ===================================
 */

/**
 * Log bulk update of vehicle scheduled maintenance assignments
 * @param {Object} vehicleInfo - Vehicle information
 * @param {Object} configInfo - Configuration information
 * @param {Object} changes - Summary of changes (inserted, reactivated, deactivated)
 * @param {Object} metadata - Request metadata
 * @returns {Promise<Object>} Log result
 */
async function logServiceHistoryBulkUpdate(vehicleInfo, configInfo, changes, metadata) {
  const changeDetails = [];
  
  if (changes.inserted > 0) {
    changeDetails.push(`${changes.inserted} assigned`);
  }
  if (changes.reactivated > 0) {
    changeDetails.push(`${changes.reactivated} reactivated`);
  }
  if (changes.deactivated > 0) {
    changeDetails.push(`${changes.deactivated} deactivated`);
  }
  
  const changesSummary = changeDetails.join(', ');
  const configName = configInfo?.configuration_name || `Configuration ID ${vehicleInfo.configurationId || 'N/A'}`;
  
  return await createAuditLog({
    ipAddress: metadata.ipAddress,
    browser: metadata.browser,
    userId: metadata.userId,
    source: 'Maintenance Service History',
    remark: `Updated scheduled maintenance for vehicle "${vehicleInfo.vehicle_nickname || vehicleInfo.vehicle_number}" - Configuration: "${configName}" - Changes: ${changesSummary}`,
    oldValue: {
      vehicle_id: vehicleInfo.vehicleId,
      vehicle_number: vehicleInfo.vehicle_number,
      vehicle_nickname: vehicleInfo.vehicle_nickname,
      previous_configuration: vehicleInfo.previous_configuration
    },
    newValue: {
      vehicle_id: vehicleInfo.vehicleId,
      vehicle_number: vehicleInfo.vehicle_number,
      vehicle_nickname: vehicleInfo.vehicle_nickname,
      new_configuration: vehicleInfo.configurationId,
      configuration_name: configName,
      changes: {
        inserted_count: changes.inserted,
        reactivated_count: changes.reactivated,
        deactivated_count: changes.deactivated,
        inserted_ids: changes.insertedIds || [],
        reactivated_ids: changes.reactivatedIds || [],
        deactivated_ids: changes.deactivatedIds || []
      }
    }
  });
}

/**
 * Log update of service history record (last maintenance date/km)
 * @param {Object} oldRecord - Original record data
 * @param {Object} newRecord - Updated record data
 * @param {Object} metadata - Request metadata
 * @returns {Promise<Object>} Log result
 */
async function logServiceHistoryUpdate(oldRecord, newRecord, metadata) {
  const changes = [];
  
  if (oldRecord.last_maintenance_date !== newRecord.last_maintenance_date) {
    changes.push(`Last Service Date: ${oldRecord.last_maintenance_date || 'Not set'} → ${newRecord.last_maintenance_date || 'Not set'}`);
  }
  
  if (oldRecord.last_replaced_km !== newRecord.last_replaced_km) {
    const oldKm = oldRecord.last_replaced_km ? `${oldRecord.last_replaced_km.toLocaleString()} km` : 'Not set';
    const newKm = newRecord.last_replaced_km ? `${newRecord.last_replaced_km.toLocaleString()} km` : 'Not set';
    changes.push(`Last Service KM: ${oldKm} → ${newKm}`);
  }
  
  const changesText = changes.join('; ');
  const vehicleInfo = `${oldRecord.vehicle_nickname || oldRecord.vehicle_number || `Vehicle ID ${oldRecord.vehicle}`}`;
  const settingName = oldRecord.setting_name || `Setting ID ${oldRecord.scheduled_maintenance}`;
  
  return await createAuditLog({
    ipAddress: metadata.ipAddress,
    browser: metadata.browser,
    userId: metadata.userId,
    source: 'Maintenance Service History',
    remark: `Updated "${settingName}" for vehicle "${vehicleInfo}" - ${changesText}`,
    oldValue: {
      record_id: oldRecord.id,
      vehicle_id: oldRecord.vehicle,
      vehicle_number: oldRecord.vehicle_number,
      vehicle_nickname: oldRecord.vehicle_nickname,
      scheduled_maintenance_id: oldRecord.scheduled_maintenance,
      setting_name: oldRecord.setting_name,
      last_maintenance_date: oldRecord.last_maintenance_date,
      last_replaced_km: oldRecord.last_replaced_km
    },
    newValue: {
      record_id: newRecord.id,
      vehicle_id: newRecord.vehicle,
      vehicle_number: newRecord.vehicle_number,
      vehicle_nickname: newRecord.vehicle_nickname,
      scheduled_maintenance_id: newRecord.scheduled_maintenance,
      setting_name: newRecord.setting_name,
      last_maintenance_date: newRecord.last_maintenance_date,
      last_replaced_km: newRecord.last_replaced_km
    }
  });
}

/**
 * Log status update of service history record (activate/deactivate)
 * @param {Object} record - Record data
 * @param {Number} oldStatus - Old status value
 * @param {Number} newStatus - New status value
 * @param {Object} metadata - Request metadata
 * @returns {Promise<Object>} Log result
 */
async function logServiceHistoryStatusUpdate(record, oldStatus, newStatus, metadata) {
  const statusMap = { 1: 'Active', 2: 'Inactive' };
  const oldStatusText = statusMap[oldStatus] || `Status ${oldStatus}`;
  const newStatusText = statusMap[newStatus] || `Status ${newStatus}`;
  
  const vehicleInfo = `${record.vehicle_nickname || record.vehicle_number || `Vehicle ID ${record.vehicle}`}`;
  const settingName = record.setting_name || `Setting ID ${record.scheduled_maintenance}`;
  
  return await createAuditLog({
    ipAddress: metadata.ipAddress,
    browser: metadata.browser,
    userId: metadata.userId,
    source: 'Maintenance Service History',
    remark: `Changed status of "${settingName}" for vehicle "${vehicleInfo}": ${oldStatusText} → ${newStatusText}`,
    oldValue: {
      record_id: record.id,
      vehicle_id: record.vehicle,
      vehicle_number: record.vehicle_number,
      vehicle_nickname: record.vehicle_nickname,
      scheduled_maintenance_id: record.scheduled_maintenance,
      setting_name: record.setting_name,
      status: oldStatus,
      status_text: oldStatusText
    },
    newValue: {
      record_id: record.id,
      vehicle_id: record.vehicle,
      vehicle_number: record.vehicle_number,
      vehicle_nickname: record.vehicle_nickname,
      scheduled_maintenance_id: record.scheduled_maintenance,
      setting_name: record.setting_name,
      status: newStatus,
      status_text: newStatusText
    }
  });
}

/**
 * Log deletion of service history record
 * @param {Object} record - Record data before deletion
 * @param {Object} metadata - Request metadata
 * @returns {Promise<Object>} Log result
 */
async function logServiceHistoryDeleted(record, metadata) {
  const vehicleInfo = `${record.vehicle_nickname || record.vehicle_number || `Vehicle ID ${record.vehicle}`}`;
  const settingName = record.setting_name || `Setting ID ${record.scheduled_maintenance}`;
  
  return await createAuditLog({
    ipAddress: metadata.ipAddress,
    browser: metadata.browser,
    userId: metadata.userId,
    source: 'Maintenance Service History',
    remark: `Deleted maintenance assignment "${settingName}" from vehicle "${vehicleInfo}"`,
    oldValue: {
      record_id: record.id,
      vehicle_id: record.vehicle,
      vehicle_number: record.vehicle_number,
      vehicle_nickname: record.vehicle_nickname,
      scheduled_maintenance_id: record.scheduled_maintenance,
      setting_name: record.setting_name,
      last_maintenance_date: record.last_maintenance_date,
      last_replaced_km: record.last_replaced_km,
      status: record.status,
      effective_date: record.effective_date
    },
    newValue: null
  });
}
