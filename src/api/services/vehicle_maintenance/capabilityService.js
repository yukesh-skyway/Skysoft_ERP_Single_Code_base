const pool = require('../../db/connection');

class CapabilityService {
  /**
   * Get user's role information (for checking if user is Admin)
   */
  async getUserRoleInfo(userId) {
    try {
      const connection = await pool.getConnection();
      
      try {
        // Get user's role(s) and role names
        const [users] = await connection.query(`
          SELECT u.role
          FROM users u
          WHERE u.id = ?
        `, [userId]);
        
        if (!users || users.length === 0) {
          return { isAdmin: false, userRoles: [] };
        }
        
        const userRole = users[0].role;
        
        if (!userRole) {
          return { isAdmin: false, userRoles: [] };
        }
        
        // Parse roles (handle comma-separated like "1,2,3")
        const roleIds = userRole.toString().split(',').map(r => parseInt(r.trim())).filter(r => !isNaN(r));
        
        if (roleIds.length === 0) {
          return { isAdmin: false, userRoles: [] };
        }
        
        // Get role names
        const placeholders = roleIds.map(() => '?').join(',');
        const [roles] = await connection.query(`
          SELECT role_name
          FROM roles
          WHERE id IN (${placeholders})
        `, roleIds);
        
        const userRoles = roles.map(r => r.role_name);
        
        // Check if any role is Admin or Super Admin
        const isAdmin = userRoles.some(roleName => 
          roleName.toLowerCase() === 'admin' || 
          roleName.toLowerCase() === 'super admin'
        );
        
        return { isAdmin, userRoles };
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('Error in getUserRoleInfo:', error);
      throw error;
    }
  }
  
  /**
   * Get all capabilities for a specific user
   * Uses existing table structure:
   * - users.role -> roles.id
   * - role_capability.role -> users.role
   * - role_capability.capability -> capabilities.id
   */
  async getUserCapabilities(userId) {
    try {
      const connection = await pool.getConnection();
      
      try {
        // Get user's role(s) from users table
        const [users] = await connection.query(
          'SELECT role FROM users WHERE id = ?',
          [userId]
        );
        
        if (!users || users.length === 0) {
          return [];
        }
        
        const userRole = users[0].role;
        
        if (!userRole) {
          return [];
        }
        
        // Parse roles (handle comma-separated like "1,2,3")
        const roleIds = userRole.toString().split(',').map(r => parseInt(r.trim())).filter(r => !isNaN(r));
        
        if (roleIds.length === 0) {
          return [];
        }
        
        // Get all capabilities for these roles from existing tables
        // rc.role = users.role AND rc.capability = c.id
        const placeholders = roleIds.map(() => '?').join(',');
        const [capabilities] = await connection.query(`
          SELECT DISTINCT c.capability
          FROM role_capability rc
          JOIN capabilities c ON rc.capability = c.id
          WHERE rc.role IN (${placeholders})
          ORDER BY c.capability
        `, roleIds);
        
        return capabilities.map(c => c.capability);
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('Error in getUserCapabilities:', error);
      throw error;
    }
  }
  
  /**
   * Get all capabilities grouped by screen for a specific role
   */
  async getRoleCapabilities(roleId) {
    try {
      const connection = await pool.getConnection();
      
      try {
        // Get all capabilities for this role
        const [capabilities] = await connection.query(`
          SELECT 
            c.id,
            c.capability,
            c.module
          FROM role_capability rc
          JOIN capabilities c ON rc.capability = c.id
          WHERE rc.role = ?
          ORDER BY c.module, c.capability
        `, [roleId]);
        
        // Group capabilities by screen/module
        const grouped = {};
        
        capabilities.forEach(cap => {
          // Extract screen_id and action from capability name
          // e.g., "VIEW_REPAIR_CODE_CATEGORIES" -> screen: "repair_code_categories", action: "VIEW"
          const parts = cap.capability.split('_');
          
          // For capabilities like VIEW_REPAIR_CODE_CATEGORIES, EDIT_REPAIR_CODE_CATEGORIES
          // First part is the action (VIEW, EDIT, DELETE, etc.)
          const action = parts[0];
          const screenParts = parts.slice(1);
          const screenId = screenParts.join('_').toLowerCase();
          
          if (!grouped[screenId]) {
            grouped[screenId] = {
              role_id: parseInt(roleId),
              screen_id: screenId,
              capabilities: []
            };
          }
          
          grouped[screenId].capabilities.push(action);
        });
        
        return Object.values(grouped);
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('Error in getRoleCapabilities:', error);
      throw error;
    }
  }
  
  /**
   * Update capabilities for a role
   * Deletes existing and inserts new ones
   */
  async updateRoleCapabilities(roleId, capabilityData) {
    try {
      const connection = await pool.getConnection();
      
      try {
        await connection.beginTransaction();
        
        // Delete existing capabilities for this role
        await connection.query(
          'DELETE FROM role_capability WHERE role = ?',
          [roleId]
        );
        
        // Insert new capabilities
        // capabilityData is an array like:
        // [{ screen_id: "repair_code_categories", capabilities: ["VIEW", "CREATE", "EDIT"] }]
        
        for (const screenData of capabilityData) {
          if (screenData.capabilities && screenData.capabilities.length > 0) {
            for (const action of screenData.capabilities) {
              // Build capability name: ACTION_SCREEN_ID (uppercase)
              // e.g., "VIEW_REPAIR_CODE_CATEGORIES"
              const capabilityName = `${action}_${screenData.screen_id.toUpperCase()}`;
              
              // Find the capability ID from capabilities table
              const [capRows] = await connection.query(
                'SELECT id FROM capabilities WHERE capability = ?',
                [capabilityName]
              );
              
              if (capRows && capRows.length > 0) {
                const capabilityId = capRows[0].id;
                
                // Insert into role_capability
                await connection.query(
                  'INSERT IGNORE INTO role_capability (role, capability) VALUES (?, ?)',
                  [roleId, capabilityId]
                );
              } else {
                console.warn(`Capability not found: ${capabilityName}`);
              }
            }
          }
        }
        
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('Error in updateRoleCapabilities:', error);
      throw error;
    }
  }
}

module.exports = new CapabilityService();
