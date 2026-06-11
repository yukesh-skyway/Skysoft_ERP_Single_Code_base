<?php
/**
 * Centralized Database Configuration for PHP
 * Reads credentials from environment variables (matching .env file format)
 * 
 * Environment Variables Required:
 * - DB_HOST
 * - DB_PORT
 * - DB_USER
 * - DB_PASSWORD
 * - DB_NAME
 */

/**
 * Load .env file and set environment variables
 * This function parses the .env file and makes variables available via getenv()
 */
function loadEnvFile() {
    $envPath = __DIR__ . '/../.env';
    
    if (!file_exists($envPath)) {
        error_log('⚠️ .env file not found at: ' . $envPath);
        return false;
    }
    
    $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        // Skip comments
        if (strpos(trim($line), '#') === 0) {
            continue;
        }
        
        // Parse KEY=VALUE
        if (strpos($line, '=') !== false) {
            list($key, $value) = explode('=', $line, 2);
            $key = trim($key);
            $value = trim($value);
            
            // Remove quotes if present
            $value = trim($value, '"\'');
            
            // Set as environment variable
            putenv("$key=$value");
            $_ENV[$key] = $value;
            $_SERVER[$key] = $value;
        }
    }
    
    error_log('✅ .env file loaded successfully');
    return true;
}

// Load .env file when this config is included
loadEnvFile();

/**
 * Get database connection using environment variables
 * Falls back to default values if environment variables are not set
 * 
 * @return PDO|null Database connection or null on failure
 */
function getDbConnection() {
    try {
        // Read from environment variables (matching .env format)
        $host = getenv('DB_HOST') ?: 'localhost';
        $port = getenv('DB_PORT') ?: '3306';
        $dbname = getenv('DB_NAME') ?: 'strategyit_skysoft';
        $username = getenv('DB_USER') ?: 'root';
        $password = getenv('DB_PASSWORD') ?: '';
        
        // Debug log to see what values are being used
        error_log('🔍 PHP DB Connection Attempt:');
        error_log('   Host: ' . $host);
        error_log('   Port: ' . $port);
        error_log('   Database: ' . $dbname);
        error_log('   Username: ' . $username);
        error_log('   Password: ' . (empty($password) ? '(empty)' : '(set)'));
        
        // Build DSN
        $dsn = "mysql:host={$host};port={$port};dbname={$dbname};charset=utf8mb4";
        
        // Create PDO connection
        $pdo = new PDO($dsn, $username, $password);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        
        error_log('✅ PHP Database Connection Successful - Host: ' . $host . ', Database: ' . $dbname);
        
        return $pdo;
    } catch (PDOException $e) {
        error_log('❌ PHP Database Connection Error: ' . $e->getMessage());
        error_log('   Host: ' . ($host ?? 'undefined') . ', Database: ' . ($dbname ?? 'undefined'));
        error_log('   Username: ' . ($username ?? 'undefined'));
        return null;
    }
}

/**
 * Get database credentials (for debugging only)
 * WARNING: Never expose this in production!
 * 
 * @return array Database configuration
 */
function getDbConfig() {
    return [
        'host' => getenv('DB_HOST') ?: 'localhost',
        'port' => getenv('DB_PORT') ?: '3306',
        'database' => getenv('DB_NAME') ?: 'strategyit_skysoft',
        'username' => getenv('DB_USER') ?: 'root',
        // Never include password in debug output
    ];
}