/**
 * Maintenance Operations Routes
 * Handles automated maintenance defect creation and scheduling operations
 */

const express = require('express');
const router = express.Router();
const db = require('../../db/connection');
const { addMetadata, formatMetadataForLog } = require('../../middleware/requestMetadata');
const auditLogService = require('../../services/vehicle_maintenance/auditLogService'); // ✅ IMPORT THE WHOLE SERVICE

/**
 * @route   GET /api/maintenance-operations/overdue-due-soon
 * @desc    Get all overdue and due soon scheduled maintenance items across all vehicles
 *          EXCLUDING items that already have active defects OR have missing required data
 * @access  Public
 * @returns Structured preview of items that would be created as defects
 */
router.get('/overdue-due-soon', async (req, res) => {
  try {
    console.log('🔍 Fetching all overdue and due soon maintenance items...');

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

    const [rows] = await db.query(query);

    console.log(`📊 Processing ${rows.length} vehicle × service combinations...`);

    const overdueItems = [];
    const dueSoonItems = [];
    const today = new Date();
    let skippedMissingData = 0;
    let skippedExistingDefects = 0;

    // Process each row to calculate status
    for (const row of rows) {
      const currentKm = parseFloat(row.current_km || 0);
      const lastReplacedKm = parseFloat(row.last_replaced_km || 0);
      const lastMaintenanceDate = row.last_maintenance_date;
      
      let status = 'GOOD';
      let primaryReason = null;
      let actualKmsSinceService = 0;
      let actualDaysSinceService = 0;
      let kmsRemaining = 0;
      let daysRemaining = 0;

      // KMS-based calculation
      if ((row.interval_type === 'KMS' || row.interval_type === 'BOTH') && row.kms && row.kms > 0) {
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

      // DURATION-based calculation
      if ((row.interval_type === 'DURATION' || row.interval_type === 'BOTH') && row.days && row.days > 0) {
        if (lastMaintenanceDate) {
          const lastDate = new Date(lastMaintenanceDate);
          actualDaysSinceService = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
          
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
        nextServiceDate = nextDate.toISOString().split('T')[0];
      }

// Only include OVERDUE or DUE_SOON items
if (status === 'OVERDUE' || status === 'DUE_SOON') {
  // ✅ FIXED: Validate required data based on interval_type BEFORE including in list
  const missingRequiredData = [];
  
  // Check KMS-based requirements
  if ((row.interval_type === 'KMS' || row.interval_type === 'BOTH') && row.kms && row.kms > 0) {
    // ✅ FIX: Check the ORIGINAL row value, not the parsed value
    if (!row.last_replaced_km || row.last_replaced_km === 0 || row.last_replaced_km === '0') {
      missingRequiredData.push('Last Replaced KM');
    }
  }
  
  // Check DURATION-based requirements
  if ((row.interval_type === 'DURATION' || row.interval_type === 'BOTH') && row.days && row.days > 0) {
    if (!row.last_maintenance_date || row.last_maintenance_date === null || row.last_maintenance_date === '') {
      missingRequiredData.push('Last Maintenance Date');
    }
  }
  
  // ✅ Skip if required data is missing
  if (missingRequiredData.length > 0) {
    console.log(`⏭️ Skipping Vehicle ${row.vehicle_id} - ${row.setting_name} (Missing: ${missingRequiredData.join(', ')})`);
    skippedMissingData++;
    continue;
  }

  // ✅ Check if this item already has an active defect created
  const [duplicateCheck] = await db.query(
    `SELECT id, defect_status 
     FROM vehicle_repair_logs 
     WHERE vehicle = ? 
       AND schedule_maintenance_id = ?
       AND defect_status NOT IN ('Completed', 'Repair_Not_Required', 'Rejected')
     LIMIT 1`,
    [row.vehicle_id, row.scheduled_maintenance_id]
  );

  // ✅ Only add if NO active defect exists
  if (duplicateCheck.length === 0) {
    const item = {
      vehicle_id: row.vehicle_id,
      vehicle_nickname: row.vehicle_nickname,
      vehicle_number: row.vehicle_number,
      vehicle_type: row.vehicle_type,
      scheduled_maintenance_id: row.scheduled_maintenance_id,
      setting_name: row.setting_name,
      interval_type: row.interval_type,
      status: status,
      primary_reason: primaryReason,
      current_km: currentKm,
      last_replaced_km: lastReplacedKm,
      actual_kms_since_service: actualKmsSinceService,
      kms_threshold: row.kms,
      kms_remaining: kmsRemaining,
      last_maintenance_date: lastMaintenanceDate,
      actual_days_since_service: actualDaysSinceService,
      days_threshold: row.days,
      days_remaining: daysRemaining,
      time_unit: row.time_unit,
      next_service_date: nextServiceDate,
      kms_progress: row.kms ? `${actualKmsSinceService.toLocaleString()} / ${row.kms.toLocaleString()} km` : 'N/A',
      days_progress: row.days ? `${actualDaysSinceService} / ${row.days} ${row.time_unit || 'DAYS'}` : 'N/A'
    };

    if (status === 'OVERDUE') {
      overdueItems.push(item);
    } else {
      dueSoonItems.push(item);
    }
  } else {
    // ✅ Log skipped item (already has defect)
    console.log(`⏭️ Skipping Vehicle ${row.vehicle_id} - ${row.setting_name} (Defect #${duplicateCheck[0].id} already exists - Status: ${duplicateCheck[0].defect_status})`);
    skippedExistingDefects++;
  }
}
    }

    // Sort by vehicle number, then by setting name
    const sortItems = (items) => items.sort((a, b) => {
      if (a.vehicle_number !== b.vehicle_number) {
        return a.vehicle_number.localeCompare(b.vehicle_number);
      }
      return a.setting_name.localeCompare(b.setting_name);
    });

    sortItems(overdueItems);
    sortItems(dueSoonItems);

    // Generate summary statistics
    const summary = {
      total_items: overdueItems.length + dueSoonItems.length,
      overdue_count: overdueItems.length,
      due_soon_count: dueSoonItems.length,
      affected_vehicles: new Set([...overdueItems, ...dueSoonItems].map(item => item.vehicle_id)).size,
      skipped_missing_data: skippedMissingData,
      skipped_existing_defects: skippedExistingDefects,
      by_reason: {
        kms_only: [...overdueItems, ...dueSoonItems].filter(item => item.primary_reason === 'KMS').length,
        duration_only: [...overdueItems, ...dueSoonItems].filter(item => item.primary_reason === 'DURATION').length,
        both: [...overdueItems, ...dueSoonItems].filter(item => item.primary_reason === 'BOTH').length
      },
      by_vehicle_type: {}
    };

    // Count by vehicle type
    [...overdueItems, ...dueSoonItems].forEach(item => {
      if (!summary.by_vehicle_type[item.vehicle_type]) {
        summary.by_vehicle_type[item.vehicle_type] = 0;
      }
      summary.by_vehicle_type[item.vehicle_type]++;
    });

    console.log(`✅ Found ${summary.total_items} items (${summary.overdue_count} overdue, ${summary.due_soon_count} due soon)`);
    console.log(`⏭️ Skipped ${skippedMissingData} items with missing data, ${skippedExistingDefects} items with existing defects`);

    res.json({
      success: true,
      summary: summary,
      data: {
        overdue: overdueItems,
        due_soon: dueSoonItems
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error fetching overdue/due soon items:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch overdue and due soon items',
      error: error.message
    });
  }
});
/**
 * @route   POST /api/maintenance-operations/create-defects
 * @desc    Bulk create defects from selected scheduled maintenance items
 * @access  Public
 * @body    { selectedItems: [{ vehicle_id, scheduled_maintenance_id, setting_name, ... }] }
 */
router.post('/create-defects', addMetadata, async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const { selectedItems } = req.body;
    const requestMetadata = formatMetadataForLog(req);

    if (!Array.isArray(selectedItems) || selectedItems.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        success: false,
        message: 'No items selected',
        errors: ['selectedItems array is required and cannot be empty']
      });
    }

    console.log(`🔧 Creating defects for ${selectedItems.length} scheduled maintenance items by User #${requestMetadata.userId}`);

    // Find or create category
    let [categoryRows] = await connection.query(
      `SELECT id FROM repair_code_categories 
       WHERE repair_code_category = 'Scheduled Maintenance' 
         AND repair_category_type = 'skysoft' 
         AND status = 1 
       LIMIT 1`
    );

    let categoryId;
    if (categoryRows.length === 0) {
      console.log('📝 Creating "Scheduled Maintenance" repair category...');
      const [insertResult] = await connection.query(
        `INSERT INTO repair_code_categories (
          repair_code_category, 
          repair_category_type, 
          status
        ) VALUES ('Scheduled Maintenance', 'skysoft', 1)`
      );
      categoryId = insertResult.insertId;
    } else {
      categoryId = categoryRows[0].id;
    }

    const currentDate = new Date().toISOString().split('T')[0];
    const createdDefects = [];
    const skippedDuplicates = [];
    const errors = [];

    // Process each item
    for (let i = 0; i < selectedItems.length; i++) {
      const item = selectedItems[i];
      
      try {
        // Validate required fields
        if (!item.vehicle_id || !item.scheduled_maintenance_id) {
          const validationError = `Missing vehicle_id or scheduled_maintenance_id`;
          errors.push(`Item #${i + 1}: ${validationError}`);
          continue;
        }

        // Check for duplicate
        const [duplicateCheck] = await connection.query(
          `SELECT id, defect_status 
           FROM vehicle_repair_logs 
           WHERE vehicle = ? 
             AND schedule_maintenance_id = ?
             AND defect_status NOT IN ('Completed', 'Repair_Not_Required', 'Rejected')
           LIMIT 1`,
          [item.vehicle_id, item.scheduled_maintenance_id]
        );

        if (duplicateCheck.length > 0) {
          skippedDuplicates.push({
            vehicle_id: item.vehicle_id,
            vehicle_nickname: item.vehicle_nickname,
            setting_name: item.setting_name,
            existing_defect_id: duplicateCheck[0].id,
            existing_status: duplicateCheck[0].defect_status
          });
          continue;
        }

         // Build notes
        let notes = `${item.setting_name}`;
        
        if (item.primary_reason === 'KMS' || item.primary_reason === 'BOTH') {
          const thresholdKm = (item.last_replaced_km || 0) + (item.kms_threshold || 0);
          notes += ` | 🔧 Due KM: ${thresholdKm.toLocaleString()}`;
        }
        
        if (item.primary_reason === 'DURATION' || item.primary_reason === 'BOTH') {
          if (item.next_service_date) {
            notes += ` |  📅 Due Date: ${item.next_service_date}`;
          }
        }
// ✅ ALWAYS add these two fields for ALL types (KMS, DURATION, BOTH)
notes += ` | 📅 Last Serviced: ${item.last_maintenance_date}`;
notes += ` | 🚗 Last Serviced KM: ${(item.last_replaced_km || 0).toLocaleString()}`;
        const repairDesc = 'SCHEDULED MAINTENANCE DEFECT';

        // Insert defect
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
            requestMetadata.userId || 0,
            requestMetadata.userId || 0,
            currentDate,
            item.scheduled_maintenance_id
          ]
        );

        const newDefectId = insertResult.insertId;

        // ✅ Log each successful defect creation
   // ✅ Log each successful defect creation
await auditLogService.logMaintenanceDefectCreated(
  {
    defect_id: newDefectId,
    vehicle_id: item.vehicle_id,
    vehicle_nickname: item.vehicle_nickname,
    setting_name: item.setting_name,
    scheduled_maintenance_id: item.scheduled_maintenance_id,
    status: item.status,
    next_service_date: item.next_service_date,
    kms_threshold: item.kms_threshold,
    last_replaced_km: item.last_replaced_km, // ✅ ADD THIS
    last_maintenance_date: item.last_maintenance_date // ✅ ADD THIS
  },
  requestMetadata
);

        createdDefects.push({
          defect_id: newDefectId,
          vehicle_id: item.vehicle_id,
          vehicle_nickname: item.vehicle_nickname,
          setting_name: item.setting_name,
          scheduled_maintenance_id: item.scheduled_maintenance_id
        });

        console.log(`✅ Created defect ID ${newDefectId} for Vehicle ${item.vehicle_id} - ${item.setting_name}`);
        
      } catch (itemError) {
        console.error(`❌ Error creating defect for Vehicle ${item.vehicle_id}:`, itemError);
        errors.push(`Item #${i + 1} (Vehicle ${item.vehicle_id}): ${itemError.message}`);
        
        // ✅ Log each error
        await auditLogService.logMaintenanceDefectCreationError(
          item,
          itemError,
          requestMetadata
        );
      }
    }

    await connection.commit();
    connection.release();

    console.log(`🎉 Successfully created ${createdDefects.length} defects, skipped ${skippedDuplicates.length} duplicates`);

    res.json({
      success: true,
      message: `Successfully created ${createdDefects.length} defect${createdDefects.length !== 1 ? 's' : ''}`,
      created_count: createdDefects.length,
      skipped_count: skippedDuplicates.length,
      created_defects: createdDefects,
      skipped_duplicates: skippedDuplicates,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('❌ Error creating defects from maintenance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create defects',
      error: error.message
    });
  }
});

module.exports = router;
