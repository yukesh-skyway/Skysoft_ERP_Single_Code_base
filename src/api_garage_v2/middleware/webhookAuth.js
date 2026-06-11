/**
 * Webhook Authentication Middleware
 * Converted from PHP src/Auth/AuthMiddleware.php
 * 
 * Validates Bearer tokens for external garage webhook requests
 * This is SEPARATE from the PHP session authentication used for frontend
 */

const crypto = require('crypto');
const db = require('../db/connection');

/**
 * Validate Bearer token from Authorization header
 * 
 * Flow:
 * 1. Extract Bearer token from Authorization header
 * 2. Hash token with SHA-256 (matches PHP implementation)
 * 3. Lookup token in api_tokens table
 * 4. Validate token (not expired, not revoked)
 * 5. Validate scopes for the requested endpoint
 * 6. Update last_used_at timestamp
 * 7. Log request to api_request_logs table
 * 8. Attach token data to req.apiToken for downstream use
 */
async function validateBearerToken(req, res, next) {
  try {
    // 1. Extract Bearer token from Authorization header
    const authHeader = req.headers.authorization || req.headers['Authorization'];
    
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: 'Missing Authorization header',
        message: 'Bearer token is required for webhook access'
      });
    }

    // Check if it starts with "Bearer "
    if (!authHeader.toLowerCase().startsWith('bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Invalid Authorization header format',
        message: 'Authorization header must use Bearer token scheme'
      });
    }

    // Extract token (remove "Bearer " prefix)
    const token = authHeader.substring(7).trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Missing token',
        message: 'Bearer token cannot be empty'
      });
    }

    // 2. Hash token with SHA-256 (matches PHP's SHA2(?, 256))
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // 3. Lookup token in api_tokens table
    const [tokenRecords] = await db.query(
      `SELECT 
        id,
        user_id,
        note,
        scope,
        expires_at,
        revoked,
        last_used_at
      FROM api_tokens
      WHERE token_hash = ?`,
      [tokenHash]
    );

    if (!tokenRecords || tokenRecords.length === 0) {
      await logFailedRequest(req, null, 'Invalid token');
      return res.status(401).json({
        success: false,
        error: 'Invalid token',
        message: 'Token not found or invalid'
      });
    }

    const tokenRecord = tokenRecords[0];

    // 4. Validate token is not revoked
    if (tokenRecord.revoked) {
      await logFailedRequest(req, tokenRecord.user_id, 'Token revoked');
      return res.status(401).json({
        success: false,
        error: 'Token revoked',
        message: 'This token has been revoked'
      });
    }

    // 5. Validate token is not expired (if expiration is set)
    // If expires_at is NULL, token never expires - skip validation
    if (tokenRecord.expires_at) {
      const now = new Date();
      const expiresAt = new Date(tokenRecord.expires_at);

      if (expiresAt < now) {
        await logFailedRequest(req, tokenRecord.user_id, 'Token expired');
        return res.status(401).json({
          success: false,
          error: 'Token expired',
          message: `Token expired on ${expiresAt.toISOString()}`
        });
      }
    }

    // 6. Validate scopes for the requested endpoint
    const requiredScope = getRequiredScope(req.path, req.method);
    
    // Parse scopes - handle both JSON array and comma-separated string formats
    let tokenScopes = [];
    if (tokenRecord.scope) {
      if (typeof tokenRecord.scope === 'string') {
        // Check if it's a JSON array string
        if (tokenRecord.scope.trim().startsWith('[')) {
          try {
            tokenScopes = JSON.parse(tokenRecord.scope);
          } catch (e) {
            // If JSON parse fails, treat as comma-separated
            tokenScopes = tokenRecord.scope.split(',').map(s => s.trim());
          }
        } else {
          // Comma-separated string
          tokenScopes = tokenRecord.scope.split(',').map(s => s.trim());
        }
      } else if (Array.isArray(tokenRecord.scope)) {
        // Already an array (some MySQL drivers auto-parse JSON)
        tokenScopes = tokenRecord.scope;
      }
    }

    if (requiredScope && !hasScope(tokenScopes, requiredScope)) {
      await logFailedRequest(req, tokenRecord.user_id, `Missing scope: ${requiredScope}`);
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        message: `This token does not have the required scope: ${requiredScope}`,
        required_scope: requiredScope,
        token_scopes: tokenScopes
      });
    }

    // 7. Update last_used_at timestamp
    await db.query(
      'UPDATE api_tokens SET last_used_at = NOW() WHERE id = ?',
      [tokenRecord.id]
    );

    // 8. Log successful request to api_request_logs
    await logSuccessfulRequest(req, tokenRecord);

    // 9. Attach token data to req for downstream use
    req.apiToken = {
      id: tokenRecord.id,
      userId: tokenRecord.user_id,
      name: tokenRecord.note,
      scopes: tokenScopes
    };

    // 10. Continue to next middleware/controller
    next();

  } catch (error) {
    console.error('❌ Webhook authentication error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication error',
      message: 'An error occurred while validating the token',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

/**
 * Get required scope for a given endpoint
 * Maps endpoints to required scopes (matches PHP implementation)
 */
function getRequiredScope(path, method) {
  // Normalize path (remove trailing slash)
  const normalizedPath = path.replace(/\/$/, '');

  // Scope mapping
  const scopeMap = {
    // Read operations
    'GET /roDetails/details': 'rodetail:read',
    'POST /roDetails/list': 'rodetail:list',
    'GET /vehicleLatestkm': 'vehicle:read',

    // Write operations
    'POST /updateVehicleDefect': 'defects:update',
    'POST /updateVehicleDefect_v2': 'defects:update',
    'POST /updateRO': 'ro:update',
  };

  const key = `${method} ${normalizedPath}`;
  return scopeMap[key] || null;
}

/**
 * Check if token has required scope
 * Supports wildcard scopes (e.g., "defects:*" grants all defect scopes)
 */
function hasScope(tokenScopes, requiredScope) {
  // Check for exact match
  if (tokenScopes.includes(requiredScope)) {
    return true;
  }

  // Check for wildcard match (e.g., "defects:*" covers "defects:update")
  const [resource] = requiredScope.split(':');
  if (tokenScopes.includes(`${resource}:*`)) {
    return true;
  }

  // Check for global admin scope
  if (tokenScopes.includes('*') || tokenScopes.includes('admin')) {
    return true;
  }

  return false;
}

/**
 * Log successful API request to api_request_logs table
 */
async function logSuccessfulRequest(req, tokenRecord) {
  try {
    const userAgent = req.headers['user-agent'] || 'unknown';

    await db.query(
      `INSERT INTO api_request_logs 
       (token_id, user_id, path, method, status, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [
        tokenRecord.id,
        tokenRecord.user_id,
        req.path,
        req.method,
        200,
        userAgent
      ]
    );
  } catch (error) {
    console.error('❌ Error logging successful request:', error);
  }
}

/**
 * Log failed API request to api_request_logs table
 */
async function logFailedRequest(req, userId, reason) {
  try {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    await db.query(
      `INSERT INTO api_request_logs 
       (token_id, user_id, path, method, status, ip_address, user_agent, error_message, created_at)
       VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        userId,
        req.path,
        req.method,
        401, // Unauthorized
        ip,
        userAgent,
        reason
      ]
    );
  } catch (error) {
    console.error('❌ Error logging failed request:', error);
    // Don't throw - logging failure shouldn't block the request
  }
}

module.exports = {
  validateBearerToken,
  getRequiredScope,
  hasScope
};