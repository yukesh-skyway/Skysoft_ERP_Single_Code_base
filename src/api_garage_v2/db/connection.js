/**
 * Database Connection for Garage Webhook API
 * 
 * This references the main API's database connection
 * to ensure both systems use the same database pool
 */

// Import the existing database connection from main API
const db = require('../../api/db/connection');

// Re-export all database methods
module.exports = db;
