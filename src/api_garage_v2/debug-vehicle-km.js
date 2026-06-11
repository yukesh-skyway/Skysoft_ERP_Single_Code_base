/**
 * Debug script for Vehicle Latest KM endpoint (No dependencies version)
 * Run with: node debug-vehicle-km-simple.js
 */

const fs = require('fs');
const path = require('path');

// Simple .env parser - MUST LOAD FIRST before requiring db
function loadEnv(envPath) {
  try {
    const envFile = fs.readFileSync(envPath, 'utf8');
    const lines = envFile.split('\n');
    
    lines.forEach(line => {
      line = line.trim();
      if (line && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        const value = valueParts.join('=').trim();
        process.env[key.trim()] = value;
      }
    });
    console.log(`✅ Loaded environment from ${envPath}\n`);
  } catch (error) {
    console.log(`⚠️  Could not load .env file from ${envPath}`);
    console.log(`   Error: ${error.message}\n`);
  }
}

// Load environment variables FIRST
const envPath = path.join(__dirname, '../api/.env');
console.log(`Loading environment from: ${envPath}\n`);
loadEnv(envPath);

// NOW require db connection (after env is loaded)
const db = require('../api/db/connection');

async function debugVehicleKm(vehicleName) {
  console.log('========================================');
  console.log('🔍 Debugging Vehicle Latest KM');
  console.log('========================================\n');
  
  console.log(`Vehicle Name: ${vehicleName}\n`);
  
  try {
    // Step 1: Check if vehicle exists
    console.log('Step 1: Looking up vehicle in database...');
    const [vehicleResults] = await db.query(`
      SELECT 
        v.id,
        v.vehicle_nickname,
        v.motive_vehicle_id,
        vt.vehicle_type
      FROM vehicles v
      LEFT JOIN vehicletypes vt ON vt.id = v.vehicle_type
      WHERE v.vehicle_nickname = ?
      LIMIT 1
    `, [vehicleName]);
    
    if (!vehicleResults || vehicleResults.length === 0) {
      console.log('❌ Vehicle NOT FOUND in database\n');
      process.exit(1);
    }
    
    const vehicle = vehicleResults[0];
    console.log('✅ Vehicle found:');
    console.log(`   ID: ${vehicle.id}`);
    console.log(`   Nickname: ${vehicle.vehicle_nickname}`);
    console.log(`   Motive Vehicle ID: ${vehicle.motive_vehicle_id || 'NULL'}`);;
    console.log(`   Vehicle Type: ${vehicle.vehicle_type || 'NULL'}\n`);
    
    // Step 2: Check motive_vehicle_id
    let motiveVehicleId = vehicle.motive_vehicle_id;
    
    if (!motiveVehicleId || motiveVehicleId === '') {
      console.log('⚠️  Motive Vehicle ID is NULL in vehicles table');
      console.log('   Checking vehicle_repair_logs table...\n');
      
      const [defectResults] = await db.query(`
        SELECT motive_vehicle_id 
        FROM vehicle_repair_logs 
        WHERE vehicle = ? AND motive_vehicle_id IS NOT NULL 
        ORDER BY id DESC 
        LIMIT 1
      `, [vehicle.id]);
      
      if (defectResults && defectResults.length > 0) {
        motiveVehicleId = defectResults[0].motive_vehicle_id;
        console.log(`✅ Found Motive Vehicle ID in repair logs: ${motiveVehicleId}\n`);
      } else {
        console.log('❌ No Motive Vehicle ID found in repair logs either\n');
        console.log('🔧 SOLUTION: Update the vehicle record with a motive_vehicle_id:');
        console.log(`   UPDATE vehicles SET motive_vehicle_id = YOUR_MOTIVE_ID WHERE id = ${vehicle.id};\n`);
        
        // Check if there are ANY Motive-sourced defects
        console.log('   Checking for Motive-sourced defects...');
        const [motiveDefects] = await db.query(`
          SELECT id, motive_vehicle_id, motive_record_id, defect_source, created_date
          FROM vehicle_repair_logs
          WHERE vehicle = ? AND defect_source = 'motive'
          ORDER BY id DESC
          LIMIT 5
        `, [vehicle.id]);
        
        if (motiveDefects && motiveDefects.length > 0) {
          console.log(`   Found ${motiveDefects.length} Motive defects for this vehicle:`);
          motiveDefects.forEach(d => {
            console.log(`   - Defect ID: ${d.id}, Motive Vehicle ID: ${d.motive_vehicle_id}, Date: ${d.created_date}`);
          });
          console.log('');
        } else {
          console.log('   No Motive-sourced defects found for this vehicle\n');
        }
        
        // Check if OTHER vehicles have motive_vehicle_id
        console.log('   Checking if OTHER vehicles have motive_vehicle_id...');
        const [otherVehicles] = await db.query(`
          SELECT vehicle_nickname, motive_vehicle_id
          FROM vehicles
          WHERE motive_vehicle_id IS NOT NULL
          LIMIT 5
        `);
        
        if (otherVehicles && otherVehicles.length > 0) {
          console.log(`   Found ${otherVehicles.length} other vehicles with Motive IDs:`);
          otherVehicles.forEach(v => {
            console.log(`   - ${v.vehicle_nickname}: ${v.motive_vehicle_id}`);
          });
          console.log('');
        }
        
        console.log('❌ STOPPING: Vehicle has no motive_vehicle_id\n');
        process.exit(1);
      }
    } else {
      console.log(`✅ Motive Vehicle ID: ${motiveVehicleId}\n`);
    }
    
    // Step 3: Check if Motive API is enabled
    console.log('Step 2: Checking Motive API configuration...');
    console.log(`   MOTIVE_API_ENABLED: ${process.env.MOTIVE_API_ENABLED || 'NOT SET'}`);
    console.log(`   MOTIVE_API_KEY: ${process.env.MOTIVE_API_KEY ? process.env.MOTIVE_API_KEY.substring(0, 20) + '...' : 'NOT SET'}\n`);
    
    if (process.env.MOTIVE_API_ENABLED !== 'true') {
      console.log('❌ Motive API is DISABLED');
      console.log('🔧 SOLUTION: Enable it in your .env file:');
      console.log('   MOTIVE_API_ENABLED=true\n');
      process.exit(1);
    }
    
    if (!process.env.MOTIVE_API_KEY) {
      console.log('❌ Motive API Key is NOT SET');
      console.log('🔧 SOLUTION: Add your API key to .env file:');
      console.log('   MOTIVE_API_KEY=your_api_key_here\n');
      process.exit(1);
    }
    
    console.log('✅ Motive API is enabled and configured\n');
    
    // Step 4: Test Motive API call
    console.log('Step 3: Testing Motive API call...');
    const https = require('https');
    const readingDate = new Date().toISOString().split('T')[0];
    // 🔴 Try v2/vehicles endpoint instead of v2/vehicles/{id}/locations
    const apiUrl = `https://api.gomotive.com/v2/vehicles?id=${motiveVehicleId}`;
    
    console.log(`   URL: ${apiUrl}`);
    console.log(`   Date: ${readingDate}\n`);
    
    const options = {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json',
        'x-api-key': process.env.MOTIVE_API_KEY
      }
    };
    
    https.get(apiUrl, options, (res) => {
      let data = '';
      
      console.log(`   HTTP Status Code: ${res.statusCode}`);
      console.log(`   HTTP Status Message: ${res.statusMessage}\n`);
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', async () => {
        try {
          const jsonData = JSON.parse(data);
          
          console.log('✅ Motive API Response:');
          console.log(JSON.stringify(jsonData, null, 2));
          console.log('');
          
          if (jsonData && jsonData.current_location && jsonData.current_location.odometer) {
            const odometer = jsonData.current_location.odometer;
            const latestKm = parseFloat(odometer).toFixed(2);
            
            console.log('✅ SUCCESS!');
            console.log(`   Raw Odometer: ${odometer}`);
            console.log(`   Formatted KM: ${latestKm}\n`);
          } else {
            console.log('⚠️  Motive API returned data but no odometer reading');
            console.log('   This could mean:');
            console.log('   - Vehicle has no recent location data');
            console.log('   - Vehicle is not active in Motive');
            console.log('   - Reading date has no data\n');
          }
        } catch (error) {
          console.log('❌ Failed to parse Motive API response');
          console.log(`   Raw response: ${data}\n`);
        }
        
        await db.end();
      });
    }).on('error', async (error) => {
      console.log('❌ Motive API Error:');
      console.log(`   Message: ${error.message}\n`);
      await db.end();
    });
    
  } catch (error) {
    console.log('❌ Error:', error.message);
    console.log(error);
    await db.end();
  }
}

// Get vehicle name from command line or use default
const vehicleName = process.argv[2] || '9611';
debugVehicleKm(vehicleName);