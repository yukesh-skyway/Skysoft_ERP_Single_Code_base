/**
 * Vehicle Sync Validator
 * 
 * Checks if your vehicles are properly configured for Motive kilometer sync
 * Identifies issues before running the actual sync
 * 
 * Usage:
 *   node api/scripts/validateVehiclesForSync.js
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('../db/connection');
const MotiveService = require('../services/motiveService');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m'
};

async function validateVehicles() {
  console.log(`\n${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}   🔍 VEHICLE SYNC VALIDATOR${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}\n`);
  
  try {
    // 1. Check environment variables
    console.log(`${colors.blue}📋 Step 1: Checking environment configuration...${colors.reset}`);
    
    const apiKey = process.env.MOTIVE_API_KEY;
    const baseUrl = process.env.MOTIVE_API_BASE_URL;
    
    if (!apiKey) {
      console.log(`${colors.red}❌ MOTIVE_API_KEY not found in .env file${colors.reset}`);
      console.log(`${colors.yellow}   Add: MOTIVE_API_KEY=your_key_here${colors.reset}\n`);
      process.exit(1);
    } else {
      console.log(`${colors.green}✅ MOTIVE_API_KEY configured${colors.reset}`);
    }
    
    if (!baseUrl) {
      console.log(`${colors.yellow}⚠️  MOTIVE_API_BASE_URL not set (using default)${colors.reset}`);
    } else {
      console.log(`${colors.green}✅ MOTIVE_API_BASE_URL: ${baseUrl}${colors.reset}`);
    }
    
    console.log('');
    
    // 2. Check database connection
    console.log(`${colors.blue}📋 Step 2: Checking database connection...${colors.reset}`);
    
    try {
      await db.query('SELECT 1');
      console.log(`${colors.green}✅ Database connection successful${colors.reset}\n`);
    } catch (error) {
      console.log(`${colors.red}❌ Database connection failed: ${error.message}${colors.reset}\n`);
      process.exit(1);
    }
    
    // 3. Check Motive API connection
    console.log(`${colors.blue}📋 Step 3: Testing Motive API connection...${colors.reset}`);
    
    const motiveService = new MotiveService();
    let motiveVehicles = [];
    
    try {
      motiveVehicles = await motiveService.fetchAll('vehicle_locations', 'vehicles');
      console.log(`${colors.green}✅ Motive API connected - Found ${motiveVehicles.length} vehicles${colors.reset}\n`);
    } catch (error) {
      console.log(`${colors.red}❌ Motive API connection failed: ${error.message}${colors.reset}\n`);
      process.exit(1);
    }
    
    // 4. Analyze database vehicles
    console.log(`${colors.blue}📋 Step 4: Analyzing database vehicles...${colors.reset}\n`);
    
    const [allVehicles] = await db.query(`
      SELECT 
        id,
        vehicle_nickname,
        vehicle_number,
        asset_id,
        motive_vehicle_id,
        current_km,
        status
      FROM vehicles
      ORDER BY status DESC, vehicle_nickname ASC
    `);
    
    // Statistics
    const stats = {
      total: allVehicles.length,
      active: 0,
      inactive: 0,
      hasUnitNumber: 0,
      noUnitNumber: 0,
      inMotive: 0,
      notInMotive: 0,
      hasOdometer: 0,
      noOdometer: 0,
      readyToSync: 0,
      needsAttention: 0
    };
    
    const issues = [];
    
    // Analyze each vehicle
    for (const vehicle of allVehicles) {
      const isActive = vehicle.status === 1;
      // Use vehicle_nickname as PRIMARY identifier (matches Motive's vehicle number)
      const unitNumber = vehicle.vehicle_nickname || vehicle.vehicle_number || vehicle.asset_id;
      
      if (isActive) {
        stats.active++;
      } else {
        stats.inactive++;
      }
      
      // Check unit number
      if (!unitNumber) {
        stats.noUnitNumber++;
        if (isActive) {
          issues.push({
            vehicle_id: vehicle.id,
            nickname: vehicle.vehicle_nickname,
            issue: 'No unit number',
            severity: 'high',
            solution: 'Add vehicle_nickname or vehicle_number to database'
          });
        }
        continue;
      }
      
      stats.hasUnitNumber++;
      
      // Check if in Motive - match Motive's vehicle.number with our unitNumber
      const motiveVehicle = motiveVehicles.find(v => {
        const vehicleUnit = v.vehicle?.number;
        return vehicleUnit && String(vehicleUnit) === String(unitNumber);
      });
      
      if (!motiveVehicle) {
        stats.notInMotive++;
        if (isActive) {
          issues.push({
            vehicle_id: vehicle.id,
            nickname: vehicle.vehicle_nickname,
            unit_number: unitNumber,
            issue: 'Not found in Motive',
            severity: 'high',
            solution: 'Verify unit number matches Motive or deactivate vehicle'
          });
        }
        continue;
      }
      
      stats.inMotive++;
      
      // Check odometer data
      const odometerMeters = motiveVehicle.vehicle?.current_location?.odometer || 0;
      
      if (!odometerMeters || odometerMeters === 0) {
        stats.noOdometer++;
        if (isActive) {
          issues.push({
            vehicle_id: vehicle.id,
            nickname: vehicle.vehicle_nickname,
            unit_number: unitNumber,
            issue: 'No odometer data in Motive',
            severity: 'medium',
            solution: 'Check GPS tracker status in Motive'
          });
        }
        continue;
      }
      
      stats.hasOdometer++;
      
      // Vehicle is ready!
      if (isActive) {
        stats.readyToSync++;
      }
    }
    
    stats.needsAttention = issues.length;
    
    // Display results
    console.log(`${colors.bright}Database Summary:${colors.reset}`);
    console.log(`  Total vehicles:       ${stats.total}`);
    console.log(`  ${colors.green}Active (status=1):${colors.reset}    ${stats.active}`);
    console.log(`  ${colors.yellow}Inactive:${colors.reset}             ${stats.inactive}`);
    console.log('');
    
    console.log(`${colors.bright}Unit Number Status:${colors.reset}`);
    console.log(`  ${colors.green}Has unit number:${colors.reset}      ${stats.hasUnitNumber}`);
    console.log(`  ${colors.red}Missing unit number:${colors.reset}  ${stats.noUnitNumber}`);
    console.log('');
    
    console.log(`${colors.bright}Motive API Match:${colors.reset}`);
    console.log(`  ${colors.green}Found in Motive:${colors.reset}      ${stats.inMotive}`);
    console.log(`  ${colors.red}Not in Motive:${colors.reset}        ${stats.notInMotive}`);
    console.log('');
    
    console.log(`${colors.bright}Odometer Data:${colors.reset}`);
    console.log(`  ${colors.green}Has odometer data:${colors.reset}    ${stats.hasOdometer}`);
    console.log(`  ${colors.red}Missing odometer:${colors.reset}     ${stats.noOdometer}`);
    console.log('');
    
    console.log(`${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.bright}${colors.green}✅ READY TO SYNC: ${stats.readyToSync} vehicles${colors.reset}`);
    if (stats.needsAttention > 0) {
      console.log(`${colors.bright}${colors.yellow}⚠️  NEEDS ATTENTION: ${stats.needsAttention} vehicles${colors.reset}`);
    }
    console.log(`${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}\n`);
    
    // Show issues
    if (issues.length > 0) {
      console.log(`${colors.bright}${colors.yellow}🔧 Issues Found:${colors.reset}\n`);
      
      // Group by severity
      const highPriority = issues.filter(i => i.severity === 'high');
      const mediumPriority = issues.filter(i => i.severity === 'medium');
      
      if (highPriority.length > 0) {
        console.log(`${colors.red}${colors.bright}HIGH PRIORITY (${highPriority.length}):${colors.reset}`);
        highPriority.forEach(issue => {
          console.log(`  ${colors.red}❌${colors.reset} ${issue.nickname || `ID:${issue.vehicle_id}`} ${issue.unit_number ? `(Unit: ${issue.unit_number})` : ''}`);
          console.log(`     Issue: ${issue.issue}`);
          console.log(`     Solution: ${issue.solution}\n`);
        });
      }
      
      if (mediumPriority.length > 0) {
        console.log(`${colors.yellow}${colors.bright}MEDIUM PRIORITY (${mediumPriority.length}):${colors.reset}`);
        mediumPriority.forEach(issue => {
          console.log(`  ${colors.yellow}⚠️${colors.reset}  ${issue.nickname || `ID:${issue.vehicle_id}`} (Unit: ${issue.unit_number})`);
          console.log(`     Issue: ${issue.issue}`);
          console.log(`     Solution: ${issue.solution}\n`);
        });
      }
      
      console.log(`${colors.bright}Recommendation:${colors.reset} Fix these issues before running bulk sync\n`);
    }
    
    // Show sample matching vehicles
    const matchedVehicles = allVehicles.filter(v => {
      const unitNumber = v.vehicle_number || v.asset_id || v.vehicle_nickname;
      if (!unitNumber) return false;
      
      const motiveVehicle = motiveVehicles.find(mv => {
        const vehicleUnit = mv.vehicle?.number;
        return vehicleUnit && String(vehicleUnit) === String(unitNumber);
      });
      
      if (!motiveVehicle) return false;
      
      const odometerMeters = motiveVehicle.vehicle?.current_location?.odometer || 0;
      return odometerMeters > 0;
    });
    
    if (matchedVehicles.length > 0) {
      console.log(`${colors.bright}${colors.green}✅ Sample vehicles ready to sync:${colors.reset}\n`);
      matchedVehicles.slice(0, 5).forEach(v => {
        const unitNumber = v.vehicle_number || v.asset_id || v.vehicle_nickname;
        console.log(`  • ${v.vehicle_nickname} (Unit: ${unitNumber}) - Current: ${v.current_km || 0} km`);
      });
      if (matchedVehicles.length > 5) {
        console.log(`  ... and ${matchedVehicles.length - 5} more`);
      }
      console.log('');
    }
    
    // Next steps
    console.log(`${colors.bright}${colors.cyan}Next Steps:${colors.reset}\n`);
    
    if (stats.readyToSync > 0) {
      console.log(`${colors.green}1. Preview sync:${colors.reset}`);
      console.log(`   node api/scripts/syncKilometersAdvanced.js --dry-run\n`);
      
      console.log(`${colors.green}2. Run sync:${colors.reset}`);
      console.log(`   node api/scripts/bulkSyncKilometers.js\n`);
    }
    
    if (stats.needsAttention > 0) {
      console.log(`${colors.yellow}3. Fix issues above, then re-run this validator${colors.reset}\n`);
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error(`\n${colors.red}${colors.bright}❌ VALIDATION ERROR:${colors.reset}`, error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

validateVehicles();