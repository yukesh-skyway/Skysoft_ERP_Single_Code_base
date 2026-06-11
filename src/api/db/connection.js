/**
 * MySQL Database Connection Configuration
 * Skysoft Fleet Maintenance Module
 */
require('dotenv').config(); // ✅ ADD THIS LINE
const mysql = require('mysql2/promise');

// Create connection pool for better performance
let pool = null;

/**
 * Initialize MySQL connection pool
 */
const initializePool = () => {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'strategyit_skysoft',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      maxAllowedPacket: 16777216, // 16MB - prevents malformed packet errors
      charset: 'utf8mb4'
    });

    console.log('✅ MySQL connection pool initialized');
  }
  return pool;
};

/**
 * Get database connection from pool
 */
const getConnection = async () => {
  try {
    const pool = initializePool();
    const connection = await pool.getConnection();
    return connection;
  } catch (error) {
    console.error('❌ Database connection error:', error);
    throw new Error('Failed to connect to database');
  }
};

/**
 * Execute query with automatic connection handling
 */
const executeQuery = async (query, params = []) => {
  let connection;
  try {
    connection = await getConnection();
    
    // Log query details for debugging
    console.log('🔍 Executing query with', params.length, 'parameters');
    
    const [results] = await connection.execute(query, params);
    return results;
  } catch (error) {
    console.error('❌ Query execution error:', error.message);
    console.error('📝 Query:', query.substring(0, 200));
    console.error('📊 Params count:', params.length);
    console.error('📦 Error code:', error.code);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

/**
 * Test database connection
 */
const testConnection = async () => {
  try {
    const connection = await getConnection();
    await connection.ping();
    connection.release();
    console.log('✅ Database connection test successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection test failed:', error);
    return false;
  }
};

/**
 * Close all connections in pool
 */
const closePool = async () => {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('✅ MySQL connection pool closed');
  }
};

// Initialize pool immediately
const dbPool = initializePool();

module.exports = {
  // Export pool directly for services that use db.query()
  query: (sql, params) => dbPool.query(sql, params),
  execute: (sql, params) => dbPool.execute(sql, params),
  
  // Legacy exports for compatibility
  initializePool,
  getConnection,
  executeQuery,
  testConnection,
  closePool,
  
  // Export pool for advanced usage
  pool: dbPool
};