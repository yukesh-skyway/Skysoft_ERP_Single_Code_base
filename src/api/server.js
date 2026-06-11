/**
 * Express Server for Skysoft Fleet Maintenance Module
 * Node.js Backend API
 */

const express = require('express');
const cors = require('cors');
require('dotenv').config(); // Loads .env from /api/.env

const { testConnection } = require('./db/connection');
const repairCodeCategoryRoutes = require('./routes/vehicle_maintenance/repairCodeCategoryRoutes');
const vehicleRoutes = require('./routes//vehicle_maintenance/vehicleRoutes');
const intervalConfigRoutes = require('./routes/vehicle_maintenance/intervalConfigurationRoutes');
const activityLogRoutes = require('./routes/vehicle_maintenance/activityLogRoutes');
const scheduledConfigRoutes = require('./routes/vehicle_maintenance/scheduledConfigurationRoutes');
const configurationSettingsRoutes = require('./routes/vehicle_maintenance/configurationSettingsRoutes');
const vehicleScheduledMaintenanceRoutes = require('./routes/vehicle_maintenance/vehicleScheduledMaintenanceRoutes');
const vendorRoutes = require('./routes/vehicle_maintenance/vendorRoutes');
const repairOrderRoutes = require('./routes/vehicle_maintenance/repairOrderRoutes');
const userRoutes = require('./routes/vehicle_maintenance/userRoutes');
const paymentMethodRoutes = require('./routes/vehicle_maintenance/paymentMethodRoutes');
const defectRoutes = require('./routes/vehicle_maintenance/defectRoutes');
const authRoutes = require('./routes/vehicle_maintenance/authRoutes');
const otpRoutes = require('./routes/vehicle_maintenance/otpRoutes'); // ✅ OTP routes for Fleet Action verification
const maintenanceOperationsRoutes = require('./routes/vehicle_maintenance/maintenanceOperationsRoutes'); // ✅ Maintenance Operations for automated defect creation
const matrixViewRoutes = require('./routes/vehicle_maintenance/matrixViewRoutes'); // ✅ Matrix View routes for custom views
const capabilityRoutes = require('./routes/vehicle_maintenance/capabilityRoutes'); // ✅ Capability routes for RBAC
const roleRoutes = require('./routes/vehicle_maintenance/roleRoutes'); // ✅ Role routes for RBAC
const { verifyPHPSession } = require('./middleware/phpSession');
const { attachMetadata } = require('./middleware/requestMetadata');
const slotsRoutes = require('./routes/Dispatch/slotsRoutes');

const app = express();
const PORT = process.env.PORT || 5002;

// CORS Middleware - Allow all origins including Figma iframe
app.use((req, res, next) => {
  // Get the origin from the request
  const origin = req.headers.origin;
  
  // Log CORS requests for debugging
  if (origin) {
    console.log(`🌐 CORS Request from: ${origin}`);
  }
  
  // Set CORS headers to allow any origin
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, ngrok-skip-browser-warning, Cache-Control');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, X-Content-Range');
  
  // Critical: Allow private network access from secure contexts (HTTPS -> localhost)
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  
  // Handle preflight OPTIONS requests
  if (req.method === 'OPTIONS') {
    console.log(`✅ Preflight request handled for: ${req.path}`);
    return res.status(204).end();
  }
  
  next();
});

// Fix — add a limit:
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// ========================================
// 🏥 HEALTH CHECK ENDPOINTS (No Auth Required)
// ========================================
// IMPORTANT: These must be BEFORE authentication middleware
// so they work even when server is starting up or PHP session is down

// Health check endpoint at /health
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Skysoft Fleet Maintenance API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime()
  });
});

// Health check endpoint at /api/health (for frontend compatibility)
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Skysoft Fleet Maintenance API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime()
  });
});
// ========================================
// 🔧 GARAGE WEBHOOK API (Bearer Token Auth)
// ========================================
// IMPORTANT: Mount BEFORE PHP session middleware
// These routes use Bearer token authentication, not PHP sessions

const garageWebhookRoutes = require('../api_garage_v2/routes/webhookRoutes');
app.use('/api_garage_v2', garageWebhookRoutes);

console.log('🔧 Garage Webhook API mounted at /api_garage_v2');

// ========================================
// 🔐 AUTHENTICATION MIDDLEWARE CHAIN
// ========================================
// (Order is critical!)

// 1️⃣ FIRST: Verify PHP session and attach user to req.user
app.use(verifyPHPSession);

// 2️⃣ SECOND: Attach metadata (IP, browser, userId from req.user)
app.use(attachMetadata);

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Database connection test endpoint
app.get('/api/test-db', async (req, res) => {
  try {
    const isConnected = await testConnection();
    if (isConnected) {
      res.status(200).json({
        success: true,
        message: 'Database connection successful',
        database: process.env.DB_NAME
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Database connection failed'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Database connection error',
      details: error.message
    });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/repair-code-categories', repairCodeCategoryRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/interval-configurations', intervalConfigRoutes);
app.use('/api/activity-logs', activityLogRoutes);
app.use('/api/scheduled-configurations', scheduledConfigRoutes);
app.use('/api/configuration-settings', configurationSettingsRoutes);
app.use('/api/vehicle-scheduled-maintenance', vehicleScheduledMaintenanceRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/repair-orders', repairOrderRoutes);
app.use('/api/users', userRoutes);
app.use('/api/payment-methods', paymentMethodRoutes);
app.use('/api/defects', defectRoutes);
app.use('/api/dispatch/slots', slotsRoutes);

app.use('/api/otp', otpRoutes); // ✅ OTP routes for Fleet Action verification
app.use('/api/maintenance-operations', maintenanceOperationsRoutes); // ✅ Maintenance Operations for automated defect creation
app.use('/api/maintenance-matrix-views', matrixViewRoutes); // ✅ Matrix View routes for custom views
app.use('/api/capabilities', capabilityRoutes); // ✅ Capability routes for RBAC
app.use('/api/roles', roleRoutes); // ✅ Role routes for RBAC

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server
app.listen(PORT, () => {
  console.log('\n🚀 ========================================');
  console.log(`   Skysoft Fleet Maintenance API Server`);
  console.log('   ========================================');
  console.log(`   🌐 Server running on port ${PORT}`);
  console.log(`   📊 Database: ${process.env.DB_NAME || 'skysoft_dev'}`);
  console.log(`   🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   ⏰ Started at: ${new Date().toISOString()}`);
  console.log('   ========================================\n');
  
  // Test database connection on startup
  testConnection().then(isConnected => {
    if (isConnected) {
      console.log('✅ Initial database connection test successful\n');
    } else {
      console.error('❌ Initial database connection test failed\n');
    }
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('✅ HTTP server closed');
    require('./db/connection').closePool();
  });
});

process.on('SIGINT', () => {
  console.log('\n👋 SIGINT signal received: closing HTTP server');
  process.exit(0);
});

module.exports = app;