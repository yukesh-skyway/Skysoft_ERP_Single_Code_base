/**
 * User Service
 * Business logic for user management
 */

const db = require('../../db/connection');

/**
 * Get users with optional filters
 */
async function getUsers({ role = null, status = null } = {}) {
  try {
    let whereConditions = [];
    const queryParams = [];

    // Role filter
    if (role) {
      const roles = role.split(',').map(r => r.trim());
      const placeholders = roles.map(() => '?').join(',');
      whereConditions.push(`ur.role IN (${placeholders})`);
      queryParams.push(...roles);
    }

    // Status filter
    if (status) {
      whereConditions.push('u.status IN (?)');
      queryParams.push(status);
    }

    const whereClause = whereConditions.length > 0 
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';

    const query = `
      SELECT 
        u.id as uid, 
        u.fullname, 
        u.middlename, 
        u.lastname, 
        u.nickname,
        u.status,
        GROUP_CONCAT(DISTINCT r.role_name) as roles
      FROM users u 
      LEFT JOIN user_roles ur ON u.id = ur.user 
      LEFT JOIN roles r ON ur.role = r.id 
      ${whereClause}
      GROUP BY u.id
      ORDER BY FIELD(u.status, 1, 2, 0), u.nickname, u.fullname ASC
    `;

    const [users] = await db.query(query, queryParams);
    return users;
  } catch (error) {
    console.error('Service error in getUsers:', error);
    throw error;
  }
}

/**
 * Get a single user by ID
 */
async function getUserById(id) {
  try {
    const query = `
      SELECT 
        u.*, 
        GROUP_CONCAT(DISTINCT r.role_name) as roles
      FROM users u 
      LEFT JOIN user_roles ur ON u.id = ur.user 
      LEFT JOIN roles r ON ur.role = r.id 
      WHERE u.id = ?
      GROUP BY u.id
      LIMIT 1
    `;

    const [results] = await db.query(query, [id]);
    return results[0] || null;
  } catch (error) {
    console.error('Service error in getUserById:', error);
    throw error;
  }
}

module.exports = {
  getUsers,
  getUserById
};
