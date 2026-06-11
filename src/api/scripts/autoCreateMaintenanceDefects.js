/**
 * Auto Create Maintenance Defects Script
 * ==========================================
 * Automatically creates defects from overdue and due soon scheduled maintenance items
 * 
 * Features:
 * - Fetches all overdue and due soon maintenance items across all vehicles
 * - Validates required data (last_maintenance_date, last_replaced_km)
 * - Checks for duplicate defects before creating
 * - Creates defects in vehicle_repair_logs table
 * - Logs all activities to system_activities table
 * - Transaction-based (all-or-nothing per batch)
 * 
 * Usage:
 * node autoCreateMaintenanceDefects.js
 * 
 * Cron Job Example (Daily at 2:00 AM):
 * 0 2 * * * /usr/bin/node /path/to/api/scripts/autoCreateMaintenanceDefects.js >> /path/to/logs/maintenance-defects.log 2>&1
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('../db/connection');

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
  // Only create defects for items that are OVERDUE
  // Set to false to also include DUE_SOON items
  OVERDUE_ONLY: false,
  
  // Batch size for processing (to prevent memory issues with large datasets)
  BATCH_SIZE: 50,
  
  // Enable detailed debug logging
  DEBUG_MODE: true,
  
  // Dry run mode (no actual inserts, just validation and logging)
  DRY_RUN: false
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Format date to YYYY-MM-DD
 */
function formatDate(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Log with timestamp
 */
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const prefix = {
    'INFO': '📋',
    'SUCCESS': '✅',
    'WARNING': '⚠️',
    'ERROR': '❌',
    'DEBUG': '🔍'
  }[level] || '📋';
  
  console.log(`[${timestamp}] ${prefix} ${message}`);
}

/**
 * Calculate maintenance status (OVERDUE, DUE_SOON, or GOOD)
 */
function calculateMaintenanceStatus(row) {
  const currentKm = parseFloat(row.current_km || 0);
  const lastReplacedKm = parseFloat(row.last_replaced_km || 0);
  const lastMaintenanceDate = row.last_maintenance_date;
  const today = new Date();
  
  let status = 'GOOD';
  let primaryReason = null;
  let actualKmsSinceService = 0;
  let actualDaysSinceService = 0;
  let kmsRemaining = 0;
  let daysRemaining = 0;
  let validationErrors = [];

  // KMS-based calculation
  if ((row.interval_type === 'KMS' || row.interval_type === 'BOTH') && row.kms && row.kms > 0) {
    if (!row.last_replaced_km || row.last_replaced_km === null) {
      validationErrors.push('Missing Last Replaced KM');
    } else {
      actualKmsSinceService = currentKm - lastReplacedKm;
      kmsRemaining = row.kms - actualKmsSinceService;

      if (actualKmsSinceService >= row.kms) {
        status = 'OVERDUE';
        primaryReason = 'KMS';
      } else if (row.kms_to_alert && actualKmsSinceService >= row.kms_to_alert) {
        if (status !== 'OVERDUE') {
          status = 'DUE_SOON';
          primaryReason = 'KMS';
        }
      }
    }
  }

  // DURATION-based calculation
  if ((row.interval_type === 'DURATION' || row.interval_type === 'BOTH') && row.days && row.days > 0) {
    if (!lastMaintenanceDate || lastMaintenanceDate === null) {
      validationErrors.push('Missing Last Maintenance Date');
    } else {
      const lastDate = new Date(lastMaintenanceDate);
      actualDaysSinceService = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
      
      // Convert duration to days based on time_unit
      let durationInDays = row.days;
      let alertInDays = row.days_to_alert || 0;
      
      switch ((row.time_unit || 'DAYS').toUpperCase()) {
        case 'WEEKS':
          durationInDays = row.days * 7;
          alertInDays = row.days_to_alert * 7;
          break;
        case 'MONTHS':
          durationInDays = row.days * 30;
          alertInDays = row.days_to_alert * 30;
          break;
        case 'YEARS':
          durationInDays = row.days * 365;
          alertInDays = row.days_to_alert * 365;
          break;
      }
      
      daysRemaining = durationInDays - actualDaysSinceService;

      if (actualDaysSinceService >= durationInDays) {
        status = 'OVERDUE';
        primaryReason = row.interval_type === 'BOTH' ? (primaryReason === 'KMS' ? 'BOTH' : 'DURATION') : 'DURATION';
      } else if (alertInDays && actualDaysSinceService >= alertInDays) {
        if (status !== 'OVERDUE') {
          status = 'DUE_SOON';
          primaryReason = row.interval_type === 'BOTH' ? (primaryReason === 'KMS' ? 'BOTH' : 'DURATION') : 'DURATION';
        }
      }
    }
  }

  // Calculate next service date
  let nextServiceDate = null;
  if ((row.interval_type === 'DURATION' || row.interval_type === 'BOTH') && row.days && lastMaintenanceDate) {
    let durationInDays = row.days;
    switch ((row.time_unit || 'DAYS').toUpperCase()) {
      case 'WEEKS': durationInDays = row.days * 7; break;
      case 'MONTHS': durationInDays = row.days * 30; break;
      case 'YEARS': durationInDays = row.days * 365; break;
    }
    const lastDate = new Date(lastMaintenanceDate);
    const nextDate = new Date(lastDate);
    nextDate.setDate(nextDate.getDate() + durationInDays);
    nextServiceDate = formatDate(nextDate);
  }

  return {
    status,
    primaryReason,
    actualKmsSinceService,
    actualDaysSinceService,
    kmsRemaining,
    daysRemaining,
    nextServiceDate,
    validationErrors,
    kms_progress: row.kms ? `${actualKmsSinceService.toLocaleString()} / ${row.kms.toLocaleString()} km` : 'N/A',
    days_progress: row.days ? `${actualDaysSinceService} / ${row.days} ${row.time_unit || 'DAYS'}` : 'N/A'
  };
}

// ============================================
// MAIN FUNCTIONS
// ============================================

/**
 * Fetch all overdue and due soon maintenance items
 */
async function fetchMaintenanceItems(connection) {
  log('Fetching all vehicles with scheduled maintenance...', 'INFO');

  const query = `
    SELECT 
      v.id as vehicle_id,
      v.vehicle_nickname,
      v.vehicle_number,
      v.vehicle_type,
      v.current_km,
      v.vehicle_configuration,
      scs.id as scheduled_maintenance_id,
      scs.setting_name,
      cs.interval_type,
      cs.kms,
      cs.kms_to_alert,
      cs.days,
      cs.days_to_alert,
      cs.time_unit,
      vsm.last_replaced_km,
      vsm.last_maintenance_date,
      vsm.status as vsm_status
    FROM vehicles v
    INNER JOIN vehicle_scheduled_maintenance vsm ON vsm.vehicle = v.id AND vsm.status = 1
    INNER JOIN scheduled_configuration_settings scs ON scs.id = vsm.scheduled_maintenance AND scs.status = 1
    INNER JOIN configuration_settings cs ON cs.setting = scs.id AND cs.configuration = v.vehicle_configuration AND cs.status = 1
    WHERE v.status = 1
    ORDER BY v.vehicle_number, scs.setting_name
  `;

  const [rows] = await connection.query(query);
  log(`Found ${rows.length} vehicle × maintenance combinations to process`, 'INFO');

  return rows;
}

/**
 * Process maintenance items and filter by status
 */
function processMaintenanceItems(rows) {
  log('Processing maintenance items...', 'INFO');

  const overdueItems = [];
  const dueSoonItems = [];
  const invalidItems = [];

  for (const row of rows) {
    const result = calculateMaintenanceStatus(row);

    // Create item object
    const item = {
      vehicle_id: row.vehicle_id,
      vehicle_nickname: row.vehicle_nickname,
      vehicle_number: row.vehicle_number,
      vehicle_type: row.vehicle_type,
      scheduled_maintenance_id: row.scheduled_maintenance_id,
      setting_name: row.setting_name,
      interval_type: row.interval_type,
      status: result.status,
      primary_reason: result.primaryReason,
      current_km: parseFloat(row.current_km || 0),
      last_replaced_km: parseFloat(row.last_replaced_km || 0),
      actual_kms_since_service: result.actualKmsSinceService,
      kms_threshold: row.kms,
      kms_remaining: result.kmsRemaining,
      last_maintenance_date: row.last_maintenance_date,
      actual_days_since_service: result.actualDaysSinceService,
      days_threshold: row.days,
      days_remaining: result.daysRemaining,
      time_unit: row.time_unit,
      next_service_date: result.nextServiceDate,
      kms_progress: result.kms_progress,
      days_progress: result.days_progress,
      validation_errors: result.validationErrors
    };

    // Check for validation errors
    if (result.validationErrors.length > 0) {
      invalidItems.push(item);
      if (CONFIG.DEBUG_MODE) {
        log(`⚠️  ${row.vehicle_nickname} - ${row.setting_name}: ${result.validationErrors.join(', ')}`, 'WARNING');
      }
      continue; // Skip items with validation errors
    }

    // Filter by status
    if (result.status === 'OVERDUE') {
      overdueItems.push(item);
    } else if (result.status === 'DUE_SOON' && !CONFIG.OVERDUE_ONLY) {
      dueSoonItems.push(item);
    }
  }

  log(`Processing complete:`, 'SUCCESS');
  log(`  - Overdue: ${overdueItems.length}`, 'INFO');
  log(`  - Due Soon: ${dueSoonItems.length}`, 'INFO');
  log(`  - Invalid (missing data): ${invalidItems.length}`, 'WARNING');

  return {
    overdue: overdueItems,
    dueSoon: dueSoonItems,
    invalid: invalidItems
  };
}

/**
 * Check if defect already exists for this maintenance item
 */
async function checkDuplicate(connection, vehicleId, scheduledMaintenanceId) {
  const [duplicateCheck] = await connection.query(
    `SELECT id, defect_status 
     FROM vehicle_repair_logs 
     WHERE vehicle = ? 
       AND schedule_maintenance_id = ?
       AND defect_status NOT IN ('Completed', 'Repair_Not_Required', 'Rejected')
     LIMIT 1`,
    [vehicleId, scheduledMaintenanceId]
  );

  return duplicateCheck.length > 0 ? duplicateCheck[0] : null;
}

/**
 * Get or create "Scheduled Maintenance" repair category
 */
async function getOrCreateMaintenanceCategory(connection) {
  // Check if category exists
  let [categoryRows] = await connection.query(
    `SELECT id FROM repair_code_categories 
     WHERE repair_code_category = 'Scheduled Maintenance' 
       AND repair_category_type = 'skysoft' 
       AND status = 1 
     LIMIT 1`
  );

  if (categoryRows.length === 0) {
    log('Creating "Scheduled Maintenance" repair category...', 'INFO');
    const [insertResult] = await connection.query(
      `INSERT INTO repair_code_categories (
        repair_code_category, 
        repair_category_type, 
        status
      ) VALUES ('Scheduled Maintenance', 'skysoft', 1)`
    );
    log(`Created category with ID: ${insertResult.insertId}`, 'SUCCESS');
    return insertResult.insertId;
  }

  return categoryRows[0].id;
}

/**
 * Build defect notes (format: "Setting Name | Due KM: 25000" or "Setting Name | Due Date: 2026-03-15")
 */
function buildDefectNotes(item) {
  let notes = `${item.setting_name}`;
  
  if (item.primary_reason === 'KMS' || item.primary_reason === 'BOTH') {
    const thresholdKm = (item.last_replaced_km || 0) + (item.kms_threshold || 0);
    notes += ` | 🔧 Due KM: ${thresholdKm.toLocaleString()}`;
  }
  
  if (item.primary_reason === 'DURATION' || item.primary_reason === 'BOTH') {
    if (item.next_service_date) {
      notes += ` | 🔧  Due Date: ${item.next_service_date}`;
    }
  }

  if (item.last_maintenance_date) {
    notes += ` | 📅 Last Serviced: ${formatDate(item.last_maintenance_date)}`;
  }

  if (item.last_replaced_km) {
    notes += ` | 🚗️ Last KM: ${parseFloat(item.last_replaced_km).toLocaleString()}`;
  }

  return notes;
}

/**
 * Create a single defect
 */
async function createDefect(connection, item, categoryId, currentDate) {
  const processingStartTime = new Date().toISOString();
  
  try {
    // Build notes and repair description
    const notes = buildDefectNotes(item);
    const repairDesc = 'SCHEDULED MAINTENANCE DEFECT';

    // Step 1: Create system_activities record FIRST
    const initialActivityMetadata = {
      status: 'IN_PROGRESS',
      vehicle_id: item.vehicle_id,
      vehicle_nickname: item.vehicle_nickname || item.vehicle_number,
      setting_name: item.setting_name,
      maintenance_status: item.status,
      maintenance_details: {
        last_service_date: item.last_maintenance_date || 'N/A',
        last_service_km: item.last_replaced_km || 0,
        current_km: item.current_km || 0,
        kms_progress: item.kms_progress || 'N/A',
        days_progress: item.days_progress || 'N/A',
        primary_reason: item.primary_reason || 'N/A'
      },
      defect_details: {
        repair_description: repairDesc,
        notes: notes,
        defect_source: 'maintenance',
        initial_status: 'Open',
        issue_date: currentDate
      },
      processing_started_at: processingStartTime,
      automated_creation: true,
      script_name: 'autoCreateMaintenanceDefects.js'
    };

    const [activityInsertResult] = await connection.query(
      `INSERT INTO system_activities (
        activity_type,
        source_table,
        source_record_id,
        triggered_by,
        metadata,
        created_at
      ) VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        'Scheduled Maintenance Defect Creation',
        'vehicle_repair_logs',
        null, // Will be updated after defect creation
        'System - Scheduled Maintenance',
        JSON.stringify(initialActivityMetadata)
      ]
    );

    const systemActivityId = activityInsertResult.insertId;

    // Step 2: Insert defect using system_activities.id as reported_by and logged_by
    const [insertResult] = await connection.query(
      `INSERT INTO vehicle_repair_logs (
        vehicle,
        repair_code_category,
        repair_desc,
        notes,
        reported_by,
        logged_by,
        issue_date,
        defect_source,
        defect_status,
        schedule_maintenance_id,
        logged_on
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'maintenance', 'Open', ?, NOW())`,
      [
        item.vehicle_id,
        categoryId,
        repairDesc,
        notes,
        systemActivityId, // Use system_activities.id
        systemActivityId, // Use system_activities.id
        currentDate,
        item.scheduled_maintenance_id
      ]
    );

    const newDefectId = insertResult.insertId;

    // Step 3: Update system_activities with SUCCESS status and defect_id
    const finalActivityMetadata = {
      status: 'SUCCESS',
      defect_id: newDefectId,
      system_activity_id: systemActivityId,
      vehicle_id: item.vehicle_id,
      vehicle_nickname: item.vehicle_nickname || item.vehicle_number,
      setting_name: item.setting_name,
      maintenance_status: item.status,
      maintenance_details: {
        last_service_date: item.last_maintenance_date || 'N/A',
        last_service_km: item.last_replaced_km || 0,
        current_km: item.current_km || 0,
        kms_progress: item.kms_progress || 'N/A',
        days_progress: item.days_progress || 'N/A',
        primary_reason: item.primary_reason || 'N/A'
      },
      defect_details: {
        repair_description: repairDesc,
        notes: notes,
        defect_source: 'maintenance',
        initial_status: 'Open',
        issue_date: currentDate,
        reported_by: systemActivityId,
        logged_by: systemActivityId
      },
      processing_started_at: processingStartTime,
      processing_completed_at: new Date().toISOString(),
      insert_id: newDefectId,
      affected_rows: insertResult.affectedRows,
      automated_creation: true,
      script_name: 'autoCreateMaintenanceDefects.js'
    };

    // Get primary key column name
    const [pkColumn] = await connection.query(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = 'system_activities' 
         AND COLUMN_KEY = 'PRI' 
       LIMIT 1`
    );

    const primaryKeyField = pkColumn.length > 0 ? pkColumn[0].COLUMN_NAME : 'id';

    await connection.query(
      `UPDATE system_activities 
       SET source_record_id = ?,
           metadata = ?,
           created_at = NOW()
       WHERE ${primaryKeyField} = ?`,
      [
        newDefectId,
        JSON.stringify(finalActivityMetadata),
        systemActivityId
      ]
    );

    return {
      success: true,
      defect_id: newDefectId,
      system_activity_id: systemActivityId,
      vehicle_id: item.vehicle_id,
      vehicle_nickname: item.vehicle_nickname,
      setting_name: item.setting_name
    };

  } catch (error) {
    // Log failure to system_activities
    await connection.query(
      `INSERT INTO system_activities (
        activity_type,
        source_table,
        source_record_id,
        triggered_by,
        metadata,
        created_at
      ) VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        'Scheduled Maintenance Defect Creation',
        'vehicle_repair_logs',
        null,
        'System - Scheduled Maintenance',
        JSON.stringify({
          status: 'FAILED',
          error_type: 'CREATION_ERROR',
          error_message: error.message,
          error_code: error.code || null,
          vehicle_id: item.vehicle_id,
          vehicle_nickname: item.vehicle_nickname || item.vehicle_number,
          scheduled_maintenance_id: item.scheduled_maintenance_id,
          setting_name: item.setting_name,
          maintenance_status: item.status,
          processing_started_at: processingStartTime,
          processing_completed_at: new Date().toISOString(),
          automated_creation: true,
          script_name: 'autoCreateMaintenanceDefects.js'
        })
      ]
    );

    throw error;
  }
}

/**
 * Create defects in batches
 */
async function createDefectsBatch(connection, items, categoryId, currentDate) {
  const createdDefects = [];
  const skippedDuplicates = [];
  const errors = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    try {
      // Check for duplicate
      const duplicate = await checkDuplicate(connection, item.vehicle_id, item.scheduled_maintenance_id);
      
      if (duplicate) {
        skippedDuplicates.push({
          vehicle_id: item.vehicle_id,
          vehicle_nickname: item.vehicle_nickname,
          setting_name: item.setting_name,
          existing_defect_id: duplicate.id,
          existing_status: duplicate.defect_status
        });
        
        if (CONFIG.DEBUG_MODE) {
          log(`Skipped duplicate: ${item.vehicle_nickname} - ${item.setting_name} (Defect #${duplicate.id} - ${duplicate.defect_status})`, 'DEBUG');
        }
        
        continue;
      }

      // Create defect
      if (!CONFIG.DRY_RUN) {
        const result = await createDefect(connection, item, categoryId, currentDate);
        createdDefects.push(result);
        
        if (CONFIG.DEBUG_MODE) {
          log(`Created defect #${result.defect_id}: ${item.vehicle_nickname} - ${item.setting_name}`, 'DEBUG');
        }
      } else {
        log(`[DRY RUN] Would create: ${item.vehicle_nickname} - ${item.setting_name}`, 'DEBUG');
      }

    } catch (error) {
      errors.push({
        vehicle_id: item.vehicle_id,
        vehicle_nickname: item.vehicle_nickname,
        setting_name: item.setting_name,
        error: error.message
      });
      
      log(`Error creating defect for ${item.vehicle_nickname} - ${item.setting_name}: ${error.message}`, 'ERROR');
    }
  }

  return {
    createdDefects,
    skippedDuplicates,
    errors
  };
}

/**
 * Main execution function
 */
async function main() {
  const startTime = Date.now();
  log('='.repeat(80), 'INFO');
  log('AUTO CREATE MAINTENANCE DEFECTS - STARTED', 'INFO');
  log('='.repeat(80), 'INFO');
  log(`Configuration:`, 'INFO');
  log(`  - Overdue Only: ${CONFIG.OVERDUE_ONLY}`, 'INFO');
  log(`  - Batch Size: ${CONFIG.BATCH_SIZE}`, 'INFO');
  log(`  - Debug Mode: ${CONFIG.DEBUG_MODE}`, 'INFO');
  log(`  - Dry Run: ${CONFIG.DRY_RUN}`, 'INFO');
  log('', 'INFO');

  const connection = await db.getConnection();
  
  try {
    // Step 1: Fetch all maintenance items
    const rows = await fetchMaintenanceItems(connection);
    
    if (rows.length === 0) {
      log('No vehicles with scheduled maintenance found', 'WARNING');
      connection.release();
      return;
    }

    // Step 2: Process and filter items
    const processed = processMaintenanceItems(rows);
    const itemsToProcess = [...processed.overdue, ...processed.dueSoon];

    if (itemsToProcess.length === 0) {
      log('No overdue or due soon maintenance items found', 'INFO');
      connection.release();
      return;
    }

    log('', 'INFO');
    log('Creating defects...', 'INFO');

    // Step 3: Get or create maintenance category
    const categoryId = await getOrCreateMaintenanceCategory(connection);
    const currentDate = formatDate(new Date());

    // Step 4: Create defects in batches
    let totalCreated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    for (let i = 0; i < itemsToProcess.length; i += CONFIG.BATCH_SIZE) {
      const batch = itemsToProcess.slice(i, i + CONFIG.BATCH_SIZE);
      log(`Processing batch ${Math.floor(i / CONFIG.BATCH_SIZE) + 1} (${batch.length} items)...`, 'INFO');

      await connection.beginTransaction();
      
      try {
        const result = await createDefectsBatch(connection, batch, categoryId, currentDate);
        
        if (!CONFIG.DRY_RUN) {
          await connection.commit();
        } else {
          await connection.rollback();
        }

        totalCreated += result.createdDefects.length;
        totalSkipped += result.skippedDuplicates.length;
        totalErrors += result.errors.length;

      } catch (error) {
        await connection.rollback();
        log(`Batch processing failed: ${error.message}`, 'ERROR');
        totalErrors += batch.length;
      }
    }

    // Step 5: Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    log('', 'INFO');
    log('='.repeat(80), 'INFO');
    log('EXECUTION SUMMARY', 'SUCCESS');
    log('='.repeat(80), 'INFO');
    log(`Total Items Evaluated: ${rows.length}`, 'INFO');
    log(`Overdue Items: ${processed.overdue.length}`, 'INFO');
    log(`Due Soon Items: ${processed.dueSoon.length}`, 'INFO');
    log(`Invalid Items (missing data): ${processed.invalid.length}`, 'WARNING');
    log(`Items to Process: ${itemsToProcess.length}`, 'INFO');
    log('', 'INFO');
    log(`✅ Defects Created: ${totalCreated}`, 'SUCCESS');
    log(`⏭️  Defects Skipped (duplicates): ${totalSkipped}`, 'WARNING');
    log(`❌ Errors: ${totalErrors}`, totalErrors > 0 ? 'ERROR' : 'INFO');
    log('', 'INFO');
    log(`Execution Time: ${duration} seconds`, 'INFO');
    log('='.repeat(80), 'INFO');

    connection.release();
    
    // Exit with appropriate code
    process.exit(totalErrors > 0 ? 1 : 0);

  } catch (error) {
    await connection.rollback();
    connection.release();
    log(`CRITICAL ERROR: ${error.message}`, 'ERROR');
    log(error.stack, 'ERROR');
    process.exit(1);
  }
}

// ============================================
// EXECUTION
// ============================================

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  log(`Uncaught Exception: ${error.message}`, 'ERROR');
  log(error.stack, 'ERROR');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log(`Unhandled Rejection at: ${promise}, reason: ${reason}`, 'ERROR');
  process.exit(1);
});

// Run the script
main();
