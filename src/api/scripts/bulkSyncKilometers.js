/**
 * Bulk Kilometer Sync Script
 * 
 * This script syncs ALL active vehicle kilometers from Motive API to the database.
 * It handles cases where vehicles may not exist in Motive gracefully.
 * 
 * Usage:
 *   node api/scripts/bulkSyncKilometers.js
 * 
 * Features:
 * - Syncs only ACTIVE vehicles (status = 1)
 * - Handles missing Motive data gracefully
 * - Shows detailed progress and results
 * - Updates current_km in vehicles table
 * - Provides summary statistics
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('../db/connection');
const MotiveService = require('../services/motiveService');

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m'
};

/**
 * Main bulk sync function
 */
async function bulkSyncKilometers() {
  const startTime = Date.now();
  
  console.log(`\n${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}   🚌 BULK KILOMETER SYNC FROM MOTIVE API${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}\n`);
  
  try {
    // Initialize Motive Service
    const motiveService = new MotiveService();
    
    console.log(`${colors.blue}📊 Step 1: Fetching active vehicles from database...${colors.reset}`);
    
    // Get all ACTIVE vehicles (status = 1) with unit numbers
    const [vehicles] = await db.query(`
      SELECT 
        id,
        vehicle_nickname,
        vehicle_number,
        asset_id,
        motive_vehicle_id,
        current_km,
        status
      FROM vehicles
      WHERE status = 1
      ORDER BY vehicle_nickname ASC
    `);
    
    if (!vehicles || vehicles.length === 0) {
      console.log(`${colors.yellow}⚠️  No active vehicles found in database${colors.reset}\n`);
      process.exit(0);
    }
    
    console.log(`${colors.green}✅ Found ${vehicles.length} active vehicles${colors.reset}\n`);
    
    console.log(`${colors.blue}📊 Step 2: Fetching vehicle data from Motive API...${colors.reset}`);
    
    // Fetch ALL vehicle locations from Motive once (more efficient)
    const vehicleLocations = await motiveService.fetchAll('vehicle_locations', 'vehicles');
    console.log(`${colors.green}✅ Fetched ${vehicleLocations.length} vehicles from Motive${colors.reset}\n`);
    
    console.log(`${colors.blue}📊 Step 3: Syncing kilometers...${colors.reset}\n`);
    
    // Statistics
    const stats = {
      total: vehicles.length,
      success: 0,
      noUnitNumber: 0,
      notInMotive: 0,
      noOdometerData: 0,
      updateFailed: 0,
      skipped: 0,
      unchanged: 0
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
        console.log(`${colors.yellow}${progress} ⚠️  ID:${vehicle.id} - No identifier found${colors.reset}`);
        stats.noUnitNumber++;
        results.push({
          vehicle_id: vehicle.id,
          nickname: vehicle.vehicle_nickname,
          status: 'no_unit_number',
          message: 'No unit number found'
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
        results.push({
          vehicle_id: vehicle.id,
          nickname: vehicle.vehicle_nickname,
          unit_number: unitNumber,
          status: 'not_in_motive',
          message: 'Vehicle not found in Motive API'
        });
        continue;
      }
      
      // Extract odometer
      const odometerMeters = motiveVehicle.vehicle?.current_location?.odometer || 0;
      
      if (!odometerMeters || odometerMeters === 0) {
        console.log(`${colors.yellow}${progress} ⚠️  ${vehicle.vehicle_nickname} (Unit: ${unitNumber}) - No odometer data${colors.reset}`);
        stats.noOdometerData++;
        results.push({
          vehicle_id: vehicle.id,
          nickname: vehicle.vehicle_nickname,
          unit_number: unitNumber,
          status: 'no_odometer',
          message: 'No odometer data available in Motive'
        });
        continue;
      }
      
      // Convert meters to kilometers (round to nearest 5 km)
      const newKm = Math.round(odometerMeters / 5) * 5;
      const previousKm = vehicle.current_km || 0;
      
      // Check if value changed
      if (newKm === previousKm) {
        console.log(`${colors.cyan}${progress} ℹ️  ${vehicle.vehicle_nickname} (Unit: ${unitNumber}) - Unchanged: ${newKm} km${colors.reset}`);
        stats.unchanged++;
        results.push({
          vehicle_id: vehicle.id,
          nickname: vehicle.vehicle_nickname,
          unit_number: unitNumber,
          status: 'unchanged',
          previous_km: previousKm,
          new_km: newKm,
          message: 'Kilometers unchanged'
        });
        continue;
      }
      
      // Update database
      try {
        await db.query(
          'UPDATE vehicles SET current_km = ? WHERE id = ?',
          [newKm, vehicle.id]
        );
        
        const change = newKm - previousKm;
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
          change: change,
          message: 'Successfully updated'
        });
        
      } catch (error) {
        console.log(`${colors.red}${progress} ❌ ${vehicle.vehicle_nickname} (Unit: ${unitNumber}) - Update failed: ${error.message}${colors.reset}`);
        stats.updateFailed++;
        results.push({
          vehicle_id: vehicle.id,
          nickname: vehicle.vehicle_nickname,
          unit_number: unitNumber,
          status: 'update_failed',
          previous_km: previousKm,
          new_km: newKm,
          error: error.message,
          message: 'Database update failed'
        });
      }
    }
    
    // Calculate duration
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    // Print summary
    console.log(`\n${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}   📊 SYNC SUMMARY${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}\n`);
    
    console.log(`${colors.bright}Total Vehicles:${colors.reset}          ${stats.total}`);
    console.log(`${colors.green}${colors.bright}✅ Successfully Updated:${colors.reset}  ${stats.success}`);
    console.log(`${colors.cyan}${colors.bright}ℹ️  Unchanged:${colors.reset}            ${stats.unchanged}`);
    console.log(`${colors.yellow}${colors.bright}⚠️  No Unit Number:${colors.reset}       ${stats.noUnitNumber}`);
    console.log(`${colors.yellow}${colors.bright}⚠️  Not in Motive:${colors.reset}        ${stats.notInMotive}`);
    console.log(`${colors.yellow}${colors.bright}⚠️  No Odometer Data:${colors.reset}     ${stats.noOdometerData}`);
    console.log(`${colors.red}${colors.bright}❌ Update Failed:${colors.reset}         ${stats.updateFailed}`);
    console.log(`\n${colors.bright}Duration:${colors.reset}                ${duration}s\n`);
    
    // Success rate
    const successRate = stats.total > 0 ? ((stats.success / stats.total) * 100).toFixed(1) : 0;
    console.log(`${colors.bright}Success Rate:${colors.reset}            ${successRate}%\n`);
    
    // Show detailed results for failures if any
    const failures = results.filter(r => r.status === 'update_failed' || r.status === 'no_odometer');
    if (failures.length > 0) {
      console.log(`${colors.yellow}${colors.bright}⚠️  Vehicles requiring attention:${colors.reset}\n`);
      failures.forEach(f => {
        console.log(`   • ${f.nickname} (Unit: ${f.unit_number || 'N/A'}) - ${f.message}`);
      });
      console.log('');
    }
    
    console.log(`${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}\n`);
    
    // Export results to JSON file (optional)
    const fs = require('fs');
    const resultsFile = `./api/scripts/sync-results-${Date.now()}.json`;
    fs.writeFileSync(resultsFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      duration_seconds: duration,
      statistics: stats,
      results: results
    }, null, 2));
    
    console.log(`${colors.green}📁 Detailed results saved to: ${resultsFile}${colors.reset}\n`);
    
    process.exit(0);
    
  } catch (error) {
    console.error(`\n${colors.red}${colors.bright}❌ FATAL ERROR:${colors.reset}`, error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
bulkSyncKilometers();