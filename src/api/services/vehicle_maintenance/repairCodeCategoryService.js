/**
 * Repair Code Category Service - ENHANCED VERSION
 * Business logic for repair code categories management
 * With improved duplication handling and validation
 * Skysoft Fleet Maintenance Module
 */

const db = require('../../db/connection');
const auditLogService = require('./auditLogService');

/**
 * ============================================
 * UTILITY FUNCTIONS
 * ============================================
 */

/**
 * Normalize category name
 * - Trim whitespace
 * - Replace multiple spaces with single space
 * - Convert to consistent case for comparison
 */
const normalizeCategoryName = (name) => {
  if (!name) return '';
  return name.trim().replace(/\s+/g, ' ');
};

/**
 * Validate category name
 */
const validateCategoryName = (name) => {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Category name is required' };
  }

  const normalized = normalizeCategoryName(name);
  
  if (normalized.length === 0) {
    return { valid: false, error: 'Category name cannot be empty or whitespace only' };
  }

  if (normalized.length > 500) {
    return { valid: false, error: 'Category name cannot exceed 500 characters' };
  }

  // Check for invalid characters (optional - customize as needed)
  // const invalidChars = /[<>{}]/;
  // if (invalidChars.test(normalized)) {
  //   return { valid: false, error: 'Category name contains invalid characters' };
  // }

  return { valid: true, normalized };
};

/**
 * Check for duplicate category name (case-insensitive)
 * @param {string} categoryName - Category name to check
 * @param {number|null} excludeId - ID to exclude from check (for updates)
 * @returns {Promise<{exists: boolean, conflictId: number|null, conflictName: string|null}>}
 */
const checkDuplicateCategory = async (categoryName, excludeId = null) => {
  try {
    const normalized = normalizeCategoryName(categoryName);
    
    let query = `
      SELECT id, repair_code_category 
      FROM repair_code_categories 
      WHERE LOWER(TRIM(repair_code_category)) = LOWER(?)
    `;
    const params = [normalized];

    if (excludeId) {
      query += ' AND id != ?';
      params.push(excludeId);
    }

    const [results] = await db.query(query, params);

    if (results.length > 0) {
      return {
        exists: true,
        conflictId: results[0].id,
        conflictName: results[0].repair_code_category
      };
    }

    return { exists: false, conflictId: null, conflictName: null };
  } catch (error) {
    console.error('Error checking duplicate category:', error);
    throw error;
  }
};

/**
 * ============================================
 * MAIN CRUD OPERATIONS
 * ============================================
 */

/**
 * Get all categories with filters
 */
const getAllCategories = async (filters = {}) => {
  try {
    let query = `
      SELECT 
        id,
        repair_code_category,
        repair_category_type,
        status
      FROM repair_code_categories
      WHERE 1=1
    `;

    const params = [];

    // Filter by status
    if (filters.status !== undefined && filters.status !== 'all') {
      query += ' AND status = ?';
      params.push(parseInt(filters.status));
    }

    // Filter by type
    if (filters.repair_category_type) {
      query += ' AND repair_category_type = ?';
      params.push(filters.repair_category_type);
    }

    // Search functionality (case-insensitive)
    if (filters.search) {
      query += ' AND LOWER(repair_code_category) LIKE LOWER(?)';
      params.push(`%${filters.search}%`);
    }

    // Sorting
    const validSortFields = ['id', 'repair_code_category', 'repair_category_type', 'status'];
    const sortField = validSortFields.includes(filters.sortBy) ? filters.sortBy : 'id';
    const sortOrder = filters.sortOrder === 'desc' ? 'DESC' : 'ASC';
    query += ` ORDER BY ${sortField} ${sortOrder}`;

    // Pagination
    if (filters.limit) {
      const limit = parseInt(filters.limit);
      const offset = filters.offset ? parseInt(filters.offset) : 0;
      query += ' LIMIT ? OFFSET ?';
      params.push(limit, offset);
    }

    const [categories] = await db.query(query, params);
    return categories;
  } catch (error) {
    console.error('Error in getAllCategories service:', error);
    throw error;
  }
};

/**
 * Get category by ID
 */
const getCategoryById = async (id) => {
  try {
    const query = `
      SELECT 
        id,
        repair_code_category,
        repair_category_type,
        status
      FROM repair_code_categories
      WHERE id = ?
    `;

    const [categories] = await db.query(query, [id]);
    return categories.length > 0 ? categories[0] : null;
  } catch (error) {
    console.error('Error in getCategoryById service:', error);
    throw error;
  }
};

/**
 * Create new repair code category
 * WITH ENHANCED DUPLICATION CHECKING
 */
const createCategory = async (categoryData, userId) => {
  try {
    // Step 1: Validate category name
    const validation = validateCategoryName(categoryData.repair_code_category);
    if (!validation.valid) {
      const error = new Error(validation.error);
      error.status = 400;
      throw error;
    }

    const normalizedName = validation.normalized;

    // Step 2: Check for duplicates (case-insensitive, trimmed)
    const duplicate = await checkDuplicateCategory(normalizedName);
    if (duplicate.exists) {
      const error = new Error(
        `Category "${duplicate.conflictName}" already exists (ID: ${duplicate.conflictId}). ` +
        `Please use a different name.`
      );
      error.status = 409; // Conflict
      error.conflictId = duplicate.conflictId;
      error.conflictName = duplicate.conflictName;
      throw error;
    }

    // Step 3: Validate category type
    const validTypes = ['skysoft', 'motive'];
    const categoryType = categoryData.repair_category_type || 'skysoft';
    if (!validTypes.includes(categoryType)) {
      const error = new Error(`Invalid category type. Must be one of: ${validTypes.join(', ')}`);
      error.status = 400;
      throw error;
    }

    // Step 4: Insert into database
    const query = `
      INSERT INTO repair_code_categories (
        repair_code_category,
        repair_category_type,
        status
      ) VALUES (?, ?, ?)
    `;

    const params = [
      normalizedName, // Use normalized name
      categoryType,
      categoryData.status !== undefined ? categoryData.status : 1
    ];

    const [result] = await db.query(query, params);

    // Step 5: Log audit trail
    const newCategory = await getCategoryById(result.insertId);
    
    // Always log the activity (even with userId 0 for system/anonymous users)
    await auditLogService.logCategoryCreated(
      {
        categoryName: newCategory.repair_code_category,
        type: newCategory.repair_category_type,
        status: newCategory.status
      },
      { userId: userId || 0, ipAddress: 'API', browser: 'API' }
    );

    return newCategory;
  } catch (error) {
    console.error('Error in createCategory service:', error);
    throw error;
  }
};

/**
 * Update repair code category
 * WITH ENHANCED DUPLICATION CHECKING
 */
const updateCategory = async (id, categoryData, userId) => {
  try {
    // Step 1: Check if category exists
    const existing = await getCategoryById(id);
    if (!existing) {
      const error = new Error('Category not found');
      error.status = 404;
      throw error;
    }

    // Step 2: Validate and check for duplicates if name is being changed
    if (categoryData.repair_code_category !== undefined) {
      const validation = validateCategoryName(categoryData.repair_code_category);
      if (!validation.valid) {
        const error = new Error(validation.error);
        error.status = 400;
        throw error;
      }

      const normalizedName = validation.normalized;

      // Only check for duplicates if the name is actually changing
      if (normalizedName.toLowerCase() !== existing.repair_code_category.toLowerCase()) {
        const duplicate = await checkDuplicateCategory(normalizedName, id);
        if (duplicate.exists) {
          const error = new Error(
            `Category "${duplicate.conflictName}" already exists (ID: ${duplicate.conflictId}). ` +
            `Please use a different name.`
          );
          error.status = 409; // Conflict
          error.conflictId = duplicate.conflictId;
          error.conflictName = duplicate.conflictName;
          throw error;
        }
      }

      // Use normalized name
      categoryData.repair_code_category = normalizedName;
    }

    // Step 3: Validate category type if provided
    if (categoryData.repair_category_type !== undefined) {
      const validTypes = ['skysoft', 'motive'];
      if (!validTypes.includes(categoryData.repair_category_type)) {
        const error = new Error(`Invalid category type. Must be one of: ${validTypes.join(', ')}`);
        error.status = 400;
        throw error;
      }
    }

    // Step 4: Build update query
    const updateFields = [];
    const params = [];

    if (categoryData.repair_code_category !== undefined) {
      updateFields.push('repair_code_category = ?');
      params.push(categoryData.repair_code_category);
    }

    if (categoryData.repair_category_type !== undefined) {
      updateFields.push('repair_category_type = ?');
      params.push(categoryData.repair_category_type);
    }

    if (categoryData.status !== undefined) {
      updateFields.push('status = ?');
      params.push(categoryData.status);
    }

    if (updateFields.length === 0) {
      const error = new Error('No fields to update');
      error.status = 400;
      throw error;
    }

    params.push(id);

    const query = `
      UPDATE repair_code_categories 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `;

    await db.query(query, params);

    // Step 5: Log audit trail
    const updatedCategory = await getCategoryById(id);
    
    // Always log the activity (even with userId 0 for system/anonymous users)
    await auditLogService.logCategoryUpdated(
      {
        categoryName: existing.repair_code_category,
        type: existing.repair_category_type,
        status: existing.status
      },
      {
        categoryName: updatedCategory.repair_code_category,
        type: updatedCategory.repair_category_type,
        status: updatedCategory.status
      },
      { userId: userId || 0, ipAddress: 'API', browser: 'API' }
    );

    return updatedCategory;
  } catch (error) {
    console.error('Error in updateCategory service:', error);
    throw error;
  }
};

/**
 * Delete repair code category (soft delete)
 */
const deleteCategory = async (id, userId) => {
  try {
    const existing = await getCategoryById(id);
    if (!existing) {
      const error = new Error('Category not found');
      error.status = 404;
      throw error;
    }

    const query = `
      UPDATE repair_code_categories 
      SET status = 0
      WHERE id = ?
    `;

    await db.query(query, [id]);

    // Always log the activity (even with userId 0 for system/anonymous users)
    await auditLogService.logCategoryDeleted(
      {
        categoryName: existing.repair_code_category,
        type: existing.repair_category_type,
        status: existing.status
      },
      { userId: userId || 0, ipAddress: 'API', browser: 'API' }
    );

    return { success: true, message: 'Category deleted successfully' };
  } catch (error) {
    console.error('Error in deleteCategory service:', error);
    throw error;
  }
};

/**
 * Hard delete category (permanent)
 */
const hardDeleteCategory = async (id) => {
  try {
    const existing = await getCategoryById(id);
    if (!existing) {
      const error = new Error('Category not found');
      error.status = 404;
      throw error;
    }

    // TODO: Check if category is being used in repair codes/defects
    // Prevent deletion if in use

    const query = 'DELETE FROM repair_code_categories WHERE id = ?';
    await db.query(query, [id]);

    return { success: true, message: 'Category permanently deleted' };
  } catch (error) {
    console.error('Error in hardDeleteCategory service:', error);
    throw error;
  }
};

/**
 * Get category statistics
 */
const getCategoryStats = async () => {
  try {
    const query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 2 THEN 1 ELSE 0 END) as inactive,
        SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) as deleted,
        SUM(CASE WHEN repair_category_type = 'skysoft' THEN 1 ELSE 0 END) as skysoft,
        SUM(CASE WHEN repair_category_type = 'motive' THEN 1 ELSE 0 END) as motive
      FROM repair_code_categories
    `;

    const [stats] = await db.query(query);
    return stats[0];
  } catch (error) {
    console.error('Error in getCategoryStats service:', error);
    throw error;
  }
};

/**
 * Get categories by type
 */
const getCategoriesByType = async (type) => {
  try {
    const query = `
      SELECT 
        id,
        repair_code_category,
        repair_category_type,
        status
      FROM repair_code_categories
      WHERE repair_category_type = ? AND status = 1
      ORDER BY repair_code_category ASC
    `;

    const [categories] = await db.query(query, [type]);
    return categories;
  } catch (error) {
    console.error('Error in getCategoriesByType service:', error);
    throw error;
  }
};

/**
 * Bulk update categories
 */
const bulkUpdateCategories = async (updates, userId) => {
  try {
    const results = [];

    for (const update of updates) {
      try {
        const result = await updateCategory(update.id, update.data, userId);
        results.push({ success: true, id: update.id, data: result });
      } catch (error) {
        results.push({ 
          success: false, 
          id: update.id, 
          error: error.message,
          status: error.status || 500
        });
      }
    }

    return results;
  } catch (error) {
    console.error('Error in bulkUpdateCategories service:', error);
    throw error;
  }
};

/**
 * Update category status
 */
const updateCategoryStatus = async (id, status, userId) => {
  try {
    const validStatuses = [0, 1, 2];
    if (!validStatuses.includes(status)) {
      const error = new Error('Invalid status. Must be 0 (deleted), 1 (active), or 2 (inactive)');
      error.status = 400;
      throw error;
    }

    return await updateCategory(id, { status }, userId);
  } catch (error) {
    console.error('Error in updateCategoryStatus service:', error);
    throw error;
  }
};

module.exports = {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  hardDeleteCategory,
  getCategoryStats,
  getCategoriesByType,
  bulkUpdateCategories,
  updateCategoryStatus,
  // Export utility functions for testing
  normalizeCategoryName,
  validateCategoryName,
  checkDuplicateCategory
};
