/**
 * Advanced Kilometer Sync Script with Options
 * 
 * This enhanced version supports:
 * - Sync specific vehicles by ID or unit number
 * - Dry-run mode (preview without updating)
 * - Force sync (update even if unchanged)
 * - Verbose logging
 * - KM Sync Status Check (only syncs if status is 'resumed' or 'synced')
 * 
 * Usage:
 *   node api/scripts/syncKilometersAdvanced.js [options]
 * 
 * Options:
 *   --dry-run              Preview changes without updating database
 *   --vehicle-ids=1,2,3    Sync specific vehicle IDs only
 *   --units=101,102,103    Sync specific unit numbers only
 *   --force                Update even if kilometers unchanged
 *   --verbose              Show detailed API responses
 *   --include-inactive     Include inactive vehicles (status != 1)
 * 
 * KM Sync Status Logic:
 *   Only vehicles with km_sync_status = 'resumed' OR 'synced' will be updated
 *   Vehicles with status = '', NULL, 'paused', or any other value will be SKIPPED
 * 
 * Examples:
 *   node api/scripts/syncKilometersAdvanced.js --dry-run
 *   node api/scripts/syncKilometersAdvanced.js --vehicle-ids=1,2,3
 *   node api/scripts/syncKilometersAdvanced.js --units=101,102,103 --force
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('../db/connection');
const MotiveService = require('../services/motiveService');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  force: args.includes('--force'),
  verbose: args.includes('--verbose'),
  includeInactive: args.includes('--include-inactive'),
  vehicleIds: null,
  units: null
};

// Parse vehicle IDs
const vehicleIdsArg = args.find(arg => arg.startsWith('--vehicle-ids='));
if (vehicleIdsArg) {
  options.vehicleIds = vehicleIdsArg.split('=')[1].split(',').map(id => parseInt(id.trim()));
}

// Parse unit numbers
const unitsArg = args.find(arg => arg.startsWith('--units='));
if (unitsArg) {
  options.units = unitsArg.split('=')[1].split(',').map(u => u.trim());
}

// Color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  dim: '\x1b[2m'
};

/**
 * Main sync function
 */
async function syncKilometers() {
  const startTime = Date.now();
  
  console.log(`\n${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}   🚌 ADVANCED KILOMETER SYNC${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}\n`);
  
  // Show options
  if (options.dryRun) {
    console.log(`${colors.yellow}${colors.bright}⚠️  DRY RUN MODE: No changes will be saved${colors.reset}`);
  }
  if (options.force) {
    console.log(`${colors.magenta}${colors.bright}⚡ FORCE MODE: Will update all vehicles${colors.reset}`);
  }
  if (options.includeInactive) {
    console.log(`${colors.yellow}${colors.bright}⚠️  Including inactive vehicles${colors.reset}`);
  }
  if (options.vehicleIds) {
    console.log(`${colors.blue}🎯 Targeting vehicle IDs: ${options.vehicleIds.join(', ')}${colors.reset}`);
  }
  if (options.units) {
    console.log(`${colors.blue}🎯 Targeting units: ${options.units.join(', ')}${colors.reset}`);
  }
  console.log('');
  
  try {
    const motiveService = new MotiveService();
    
    console.log(`${colors.blue}📊 Step 1: Fetching vehicles from database...${colors.reset}`);
    
    // Build query
    let query = `
      SELECT 
        id,
        vehicle_nickname,
        vehicle_number,
        asset_id,
        motive_vehicle_id,
        current_km,
        status,
        km_sync_status
      FROM vehicles
      WHERE 1=1
    `;
    
    const queryParams = [];
    
    // Apply filters
    if (!options.includeInactive) {
      query += ' AND status = 1';
    }
    
    if (options.vehicleIds && options.vehicleIds.length > 0) {
      const placeholders = options.vehicleIds.map(() => '?').join(',');
      query += ` AND id IN (${placeholders})`;
      queryParams.push(...options.vehicleIds);
    }
    
    if (options.units && options.units.length > 0) {
      const placeholders = options.units.map(() => '?').join(',');
      query += ` AND (vehicle_number IN (${placeholders}) OR asset_id IN (${placeholders}) OR vehicle_nickname IN (${placeholders}))`;
      queryParams.push(...options.units, ...options.units, ...options.units);
    }
    
    query += ' ORDER BY vehicle_nickname ASC';
    
    const [vehicles] = await db.query(query, queryParams);
    
    if (!vehicles || vehicles.length === 0) {
      console.log(`${colors.yellow}⚠️  No vehicles found matching criteria${colors.reset}\n`);
      process.exit(0);
    }
    
    console.log(`${colors.green}✅ Found ${vehicles.length} vehicle(s)${colors.reset}\n`);
    
    console.log(`${colors.blue}📊 Step 2: Fetching data from Motive API...${colors.reset}`);
    const vehicleLocations = await motiveService.fetchAll('vehicle_locations', 'vehicles');
    console.log(`${colors.green}✅ Fetched ${vehicleLocations.length} vehicles from Motive${colors.reset}\n`);
    
    console.log(`${colors.blue}📊 Step 3: ${options.dryRun ? 'Previewing' : 'Syncing'} kilometers...${colors.reset}\n`);
    
    // Statistics
    const stats = {
      total: vehicles.length,
      success: 0,
      noUnitNumber: 0,
      notInMotive: 0,
      noOdometerData: 0,
      updateFailed: 0,
      skipped: 0,
      syncPaused: 0,
      unchanged: 0,
      wouldUpdate: 0 // For dry-run
    };
    
    const results = [];
    
    // Process each vehicle
    for (let i = 0; i < vehicles.length; i++) {
      const vehicle = vehicles[i];
      const progress = `[${i + 1}/${vehicles.length}]`;
      
      // Use vehicle_nickname as PRIMARY identifier (matches Motive's vehicle number)
      // Fallback to vehicle_number or asset_id if nickname is empty
      const unitNumber = vehicle.vehicle_nickname || vehicle.vehicle_number || vehicle.asset_id;
      
      if (!unitNumber) {
        console.log(`${colors.yellow}${progress} ⚠️  ${vehicle.vehicle_nickname || `ID:${vehicle.id}`} - No unit number${colors.reset}`);
        stats.noUnitNumber++;
        results.push({ vehicle_id: vehicle.id, nickname: vehicle.vehicle_nickname, status: 'no_unit_number' });
        continue;
      }
      
      // ✅ CHECK KM_SYNC_STATUS - Only sync if status is 'resumed' or 'synced'
      const kmSyncStatus = vehicle.km_sync_status ? vehicle.km_sync_status.toLowerCase().trim() : '';
      
      // Log the sync status for each vehicle
      console.log(`${colors.dim}   [${unitNumber}] km_sync_status: ${kmSyncStatus || '(empty)'}${colors.reset}`);
      
      // Only allow updates if status is 'resumed' or 'synced'
      if (kmSyncStatus !== 'resumed' && kmSyncStatus !== 'synced') {
        const statusDisplay = kmSyncStatus || 'empty/NULL';
        console.log(`${colors.yellow}${progress} ⏸️  ${vehicle.vehicle_nickname} (Unit: ${unitNumber}) - Sync paused (status: ${statusDisplay})${colors.reset}`);
        stats.syncPaused++;
        results.push({ 
          vehicle_id: vehicle.id, 
          nickname: vehicle.vehicle_nickname, 
          unit_number: unitNumber, 
          status: 'sync_paused',
          km_sync_status: statusDisplay
        });
        continue;
      }
      
      // Find vehicle in Motive data by matching vehicle.number with our unitNumber
      const motiveVehicle = vehicleLocations.find(v => {
        const vehicleUnit = v.vehicle?.number;
        return vehicleUnit && String(vehicleUnit) === String(unitNumber);
      });
      
      if (!motiveVehicle) {
        console.log(`${colors.yellow}${progress} ⚠️  ${vehicle.vehicle_nickname} (Unit: ${unitNumber}) - Not found in Motive${colors.reset}`);
        stats.notInMotive++;
        results.push({ vehicle_id: vehicle.id, nickname: vehicle.vehicle_nickname, unit_number: unitNumber, status: 'not_in_motive' });
        continue;
      }
      
      const odometerMeters = motiveVehicle.vehicle?.current_location?.odometer || 0;
      
      if (!odometerMeters || odometerMeters === 0) {
        console.log(`${colors.yellow}${progress} ⚠️  ${vehicle.vehicle_nickname} (Unit: ${unitNumber}) - No odometer data${colors.reset}`);
        stats.noOdometerData++;
        results.push({ vehicle_id: vehicle.id, nickname: vehicle.vehicle_nickname, unit_number: unitNumber, status: 'no_odometer' });
        continue;
      }
      
      const newKm = Math.round(odometerMeters / 5) * 5;
      const previousKm = vehicle.current_km || 0;
      const change = newKm - previousKm;
      
      // Show verbose Motive data
      if (options.verbose) {
        console.log(`${colors.dim}   Motive data: ${odometerMeters}m → ${newKm}km${colors.reset}`);
      }
      
      // Skip if unchanged and not in force mode
      if (newKm === previousKm && !options.force) {
        console.log(`${colors.cyan}${progress} ℹ️  ${vehicle.vehicle_nickname} (Unit: ${unitNumber}) - Unchanged: ${newKm} km${colors.reset}`);
        stats.unchanged++;
        results.push({ vehicle_id: vehicle.id, nickname: vehicle.vehicle_nickname, unit_number: unitNumber, status: 'unchanged', km: newKm });
        continue;
      }
      
      // Dry run mode
      if (options.dryRun) {
        const changeSymbol = change > 0 ? '+' : '';
        console.log(`${colors.magenta}${progress} 🔍 ${vehicle.vehicle_nickname} (Unit: ${unitNumber}) - WOULD UPDATE: ${previousKm} km → ${newKm} km (${changeSymbol}${change} km)${colors.reset}`);
        stats.wouldUpdate++;
        results.push({ 
          vehicle_id: vehicle.id, 
          nickname: vehicle.vehicle_nickname, 
          unit_number: unitNumber, 
          status: 'would_update', 
          previous_km: previousKm, 
          new_km: newKm, 
          change 
        });
        continue;
      }
      
      // Actually update database
      try {
        await db.query(
          'UPDATE vehicles SET current_km = ? WHERE id = ?',
          [newKm, vehicle.id]
        );
        
        const changeSymbol = change > 0 ? '+' : '';
        console.log(`${colors.green}${progress} ✅ ${vehicle.vehicle_nickname} (Unit: ${unitNumber}) - ${previousKm} km → ${newKm} km (${changeSymbol}${change} km)${colors.reset}`);
        stats.success++;
        results.push({ 
          vehicle_id: vehicle.id, 
          nickname: vehicle.vehicle_nickname, 
          unit_number: unitNumber, 
          status: 'success', 
          previous_km: previousKm, 
          new_km: newKm, 
          change 
        });
        
      } catch (error) {
        console.log(`${colors.red}${progress} ❌ ${vehicle.vehicle_nickname} (Unit: ${unitNumber}) - Update failed: ${error.message}${colors.reset}`);
        stats.updateFailed++;
        results.push({ 
          vehicle_id: vehicle.id, 
          nickname: vehicle.vehicle_nickname, 
          unit_number: unitNumber, 
          status: 'update_failed', 
          error: error.message 
        });
      }
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    // Summary
    console.log(`\n${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}   📊 ${options.dryRun ? 'PREVIEW' : 'SYNC'} SUMMARY${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}\n`);
    
    console.log(`${colors.bright}Total Vehicles:${colors.reset}          ${stats.total}`);
    
    if (options.dryRun) {
      console.log(`${colors.magenta}${colors.bright}🔍 Would Update:${colors.reset}         ${stats.wouldUpdate}`);
    } else {
      console.log(`${colors.green}${colors.bright}✅ Successfully Updated:${colors.reset}  ${stats.success}`);
    }
    
    console.log(`${colors.cyan}${colors.bright}ℹ️  Unchanged:${colors.reset}            ${stats.unchanged}`);
    console.log(`${colors.yellow}${colors.bright}⏸️  Sync Paused:${colors.reset}          ${stats.syncPaused}`);
    console.log(`${colors.yellow}${colors.bright}⚠️  No Unit Number:${colors.reset}       ${stats.noUnitNumber}`);
    console.log(`${colors.yellow}${colors.bright}⚠️  Not in Motive:${colors.reset}        ${stats.notInMotive}`);
    console.log(`${colors.yellow}${colors.bright}⚠️  No Odometer Data:${colors.reset}     ${stats.noOdometerData}`);
    
    if (!options.dryRun) {
      console.log(`${colors.red}${colors.bright}❌ Update Failed:${colors.reset}         ${stats.updateFailed}`);
    }
    
    console.log(`\n${colors.bright}Duration:${colors.reset}                ${duration}s\n`);
    
    if (options.dryRun) {
      console.log(`${colors.yellow}${colors.bright}💡 To apply these changes, run without --dry-run${colors.reset}\n`);
    }
    
    console.log(`${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}\n`);
    
    process.exit(0);
    
  } catch (error) {
    console.error(`\n${colors.red}${colors.bright}❌ FATAL ERROR:${colors.reset}`, error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Show help
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
${colors.bright}${colors.cyan}Advanced Kilometer Sync Script${colors.reset}

${colors.bright}Usage:${colors.reset}
  node api/scripts/syncKilometersAdvanced.js [options]

${colors.bright}Options:${colors.reset}
  --dry-run              Preview changes without updating database
  --vehicle-ids=1,2,3    Sync specific vehicle IDs only
  --units=101,102,103    Sync specific unit numbers only
  --force                Update even if kilometers unchanged
  --verbose              Show detailed API responses
  --include-inactive     Include inactive vehicles (status != 1)
  --help, -h             Show this help message

${colors.bright}Examples:${colors.reset}
  ${colors.dim}# Preview all changes${colors.reset}
  node api/scripts/syncKilometersAdvanced.js --dry-run

  ${colors.dim}# Sync specific vehicles${colors.reset}
  node api/scripts/syncKilometersAdvanced.js --vehicle-ids=1,2,3

  ${colors.dim}# Sync by unit numbers${colors.reset}
  node api/scripts/syncKilometersAdvanced.js --units=101,102,103

  ${colors.dim}# Force update all vehicles${colors.reset}
  node api/scripts/syncKilometersAdvanced.js --force

  ${colors.dim}# Combine options${colors.reset}
  node api/scripts/syncKilometersAdvanced.js --units=101,102 --dry-run --verbose
`);
  process.exit(0);
}

// Run the script
syncKilometers();