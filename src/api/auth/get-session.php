<?php
/**
 * Get Session Endpoint
 * Returns current user session information for React frontend
 * This file should be placed at: /vehicle_maintenance_module/api/auth/get-session.php
 */

// Load URL configuration
require_once __DIR__ . '/config.php';

// Load centralized database configuration
require_once __DIR__ . '/db-config.php';

// CRITICAL: Use the same session configuration as main Skysoft app
// This ensures we read the SAME session cookie
ini_set('session.cookie_path', '/');
ini_set('session.cookie_domain', '.skywayhub.co');
ini_set('session.cookie_httponly', '1');
ini_set('session.cookie_secure', '1');
ini_set('session.cookie_samesite', 'Lax');

// Start session (will read existing session from main site)
session_start();
session_write_close();
// Set JSON header
header('Content-Type: application/json');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Origin: ' . getCorsOrigin());
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Cookie');

// Handle OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Only allow GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'error' => 'Method not allowed',
        'message' => 'Only GET requests are allowed'
    ]);
    exit;
}

/**
 * Fetch role names from database
 * @param string $roleIds Comma-separated role IDs (e.g., "1,2,3")
 * @return array Array of role objects with role_id and role_name
 */
function getRoleNames($roleIds) {
    if (empty($roleIds)) {
        error_log('⚠️ getRoleNames: No role IDs provided');
        return [];
    }
    
    // Parse comma-separated IDs
    $ids = array_map('trim', explode(',', $roleIds));
    $ids = array_filter($ids, 'is_numeric');
    
    if (empty($ids)) {
        error_log('⚠️ getRoleNames: No valid numeric IDs found in: ' . $roleIds);
        return [];
    }
    
    error_log('🔍 getRoleNames: Fetching roles for IDs: ' . implode(',', $ids));
    
    $pdo = getDbConnection();
    if (!$pdo) {
        error_log('❌ getRoleNames: Database connection failed');
        return [];
    }
    
    try {
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        // Note: roles table uses 'id' as primary key, not 'role_id'
        // We alias it as role_id for the frontend
        $sql = "SELECT id as role_id, role_name FROM roles WHERE id IN ($placeholders) AND status = 1 ORDER BY id";
        error_log('🔍 getRoleNames SQL: ' . $sql);
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute($ids);
        $roles = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        error_log('✅ getRoleNames: Found ' . count($roles) . ' roles: ' . json_encode($roles));
        return $roles;
    } catch (PDOException $e) {
        error_log('❌ Error fetching roles: ' . $e->getMessage());
        error_log('❌ SQL State: ' . $e->getCode());
        return [];
    }
}

// DEBUG: Log all session variables to see what's available
error_log('🔍 === SESSION DEBUG START ===');
error_log('🔍 Session ID: ' . session_id());
error_log('🔍 All Session Variables: ' . json_encode($_SESSION));
error_log('🔍 === SESSION DEBUG END ===');

// Check if user is logged in
$isLoggedIn = false;
$userData = null;

// Check for user_id in session
if (isset($_SESSION['user_id'])) {
    $isLoggedIn = true;
    
    // Extract values with fallbacks (matching current-user.php pattern)
    $userId = $_SESSION['user_id'];
    $username = $_SESSION['username'] ?? $_SESSION['user_name'] ?? 'Unknown';
    $email = $_SESSION['email'] ?? $_SESSION['user_email'] ?? null;
    $roleIds = $_SESSION['role'] ?? $_SESSION['user_role'] ?? '';
    
    error_log('🔍 Extracted from session:');
    error_log('   - user_id: ' . $userId);
    error_log('   - username: ' . $username);
    error_log('   - email: ' . $email);
    error_log('   - role: ' . $roleIds);
    
    // Fetch role names from database
    $roles = getRoleNames($roleIds);
    error_log('🔍 Roles fetched: ' . json_encode($roles));
    
    // Match hardcoded format exactly
    $userData = [
        'id' => (int)$userId,
        'username' => $username,
        'email' => $email,
        'role' => $roleIds,
        'roles' => $roles // Array of role objects with role_id and role_name
    ];
} else {
    error_log('⚠️ No user_id found in session');
}

// Log final result
error_log('🔐 Session Check - Is Logged In: ' . ($isLoggedIn ? 'Yes' : 'No'));
error_log('🔐 Session Check - User Data: ' . json_encode($userData));

// Return response - Match hardcoded format exactly
if ($isLoggedIn) {
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'user' => $userData
    ]);
} else {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'message' => 'Not authenticated'
    ]);
}