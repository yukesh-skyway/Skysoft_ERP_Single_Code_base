/**
 * Repair Code Category Routes
 * API endpoints for repair code categories management
 * Skysoft Fleet Maintenance Module
 */

const express = require('express');
const router = express.Router();
const repairCodeCategoryService = require('../../services/vehicle_maintenance/repairCodeCategoryService');
const { addMetadata } = require('../../middleware/requestMetadata');

/**
 * @route   GET /api/repair-code-categories
 * @desc    Get all repair code categories with filters and sorting
 * @access  Public
 * @query   status - Filter by status (1=Active, 2=Inactive, 0=Deleted)
 * @query   repair_category_type - Filter by type (skysoft/motive)
 * @query   search - Search in category name
 * @query   sortBy - Sort field (id, repair_code_category, repair_category_type, status)
 * @query   sortOrder - Sort order (asc/desc)
 * @query   limit - Number of records
 * @query   offset - Pagination offset
 */
router.get('/', addMetadata, async (req, res) => {
  try {
    const filters = {
      status: req.query.status ? parseInt(req.query.status) : undefined,
      repair_category_type: req.query.repair_category_type,
      search: req.query.search,
      sortBy: req.query.sortBy || 'id',
      sortOrder: req.query.sortOrder || 'asc',
      limit: req.query.limit ? parseInt(req.query.limit) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset) : undefined
    };

    const categories = await repairCodeCategoryService.getAllCategories(filters);

    res.json({
      success: true,
      count: categories.length,
      data: categories,
      filters: filters
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching repair code categories',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/repair-code-categories/stats
 * @desc    Get category statistics
 * @access  Public
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await repairCodeCategoryService.getCategoryStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching category stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching category statistics',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/repair-code-categories/type/:type
 * @desc    Get categories by type (skysoft/motive)
 * @access  Public
 * @param   type - Category type (skysoft or motive)
 */
router.get('/type/:type', async (req, res) => {
  try {
    const { type } = req.params;

    if (!['skysoft', 'motive'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category type. Use "skysoft" or "motive"'
      });
    }

    const categories = await repairCodeCategoryService.getCategoriesByType(type);

    res.json({
      success: true,
      count: categories.length,
      data: categories
    });
  } catch (error) {
    console.error('Error fetching categories by type:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching categories by type',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/repair-code-categories/:id
 * @desc    Get category by ID
 * @access  Public
 * @param   id - Category ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'Valid category ID is required'
      });
    }

    const category = await repairCodeCategoryService.getCategoryById(parseInt(id));

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    res.json({
      success: true,
      data: category
    });
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching category',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/repair-code-categories/:id/audit
 * @desc    Get category audit history
 * @access  Public
 * @param   id - Category ID
 */
router.get('/:id/audit', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'Valid category ID is required'
      });
    }

    const auditHistory = await repairCodeCategoryService.getCategoryAuditHistory(parseInt(id));

    res.json({
      success: true,
      data: auditHistory
    });
  } catch (error) {
    console.error('Error fetching audit history:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching audit history',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/repair-code-categories
 * @desc    Create new repair code category
 * @access  Public
 * @body    repair_code_category - Category name (required)
 * @body    repair_category_type - Type (skysoft/motive, default: skysoft)
 * @body    status - Status (1=Active, 2=Inactive, default: 1)
 */
router.post('/', addMetadata, async (req, res) => {
  try {
    const { repair_code_category, repair_category_type, status } = req.body;

    // Validation
    if (!repair_code_category || repair_code_category.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Category name is required'
      });
    }

    if (repair_category_type && !['skysoft', 'motive'].includes(repair_category_type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category type. Use "skysoft" or "motive"'
      });
    }

    if (status !== undefined && ![0, 1, 2].includes(parseInt(status))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Use 0 (Deleted), 1 (Active), or 2 (Inactive)'
      });
    }

    // Get user ID from request metadata (set by middleware)
    const userId = req.metadata?.userId || 0;

    const categoryData = {
      repair_code_category: repair_code_category.trim(),
      repair_category_type: repair_category_type || 'skysoft',
      status: status !== undefined ? parseInt(status) : 1
    };

    const newCategory = await repairCodeCategoryService.createCategory(categoryData, userId);

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: newCategory
    });
  } catch (error) {
    console.error('Error creating category:', error);
    
    if (error.message.includes('already exists')) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error creating category',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/repair-code-categories/:id
 * @desc    Update repair code category
 * @access  Public
 * @param   id - Category ID
 * @body    repair_code_category - Category name
 * @body    repair_category_type - Type (skysoft/motive)
 * @body    status - Status (0/1/2)
 */
router.put('/:id', addMetadata, async (req, res) => {
  try {
    const { id } = req.params;
    const { repair_code_category, repair_category_type, status } = req.body;

    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'Valid category ID is required'
      });
    }

    // Validation
    if (repair_category_type && !['skysoft', 'motive'].includes(repair_category_type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category type. Use "skysoft" or "motive"'
      });
    }

    if (status !== undefined && ![0, 1, 2].includes(parseInt(status))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Use 0 (Deleted), 1 (Active), or 2 (Inactive)'
      });
    }

    // Get user ID from request metadata
    const userId = req.metadata?.userId || 0;

    const categoryData = {};
    if (repair_code_category !== undefined) categoryData.repair_code_category = repair_code_category.trim();
    if (repair_category_type !== undefined) categoryData.repair_category_type = repair_category_type;
    if (status !== undefined) categoryData.status = parseInt(status);

    const updatedCategory = await repairCodeCategoryService.updateCategory(
      parseInt(id),
      categoryData,
      userId
    );

    res.json({
      success: true,
      message: 'Category updated successfully',
      data: updatedCategory
    });
  } catch (error) {
    console.error('Error updating category:', error);
    
    if (error.message === 'Category not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('already exists')) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error updating category',
      error: error.message
    });
  }
});

/**
 * @route   PATCH /api/repair-code-categories/:id/status
 * @desc    Update category status only
 * @access  Public
 * @param   id - Category ID
 * @body    status - Status (0/1/2)
 */
router.patch('/:id/status', addMetadata, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'Valid category ID is required'
      });
    }

    if (status === undefined || ![0, 1, 2].includes(parseInt(status))) {
      return res.status(400).json({
        success: false,
        message: 'Valid status is required. Use 0 (Deleted), 1 (Active), or 2 (Inactive)'
      });
    }

    // Get user ID from request metadata
    const userId = req.metadata?.userId || 0;

    const updatedCategory = await repairCodeCategoryService.updateCategoryStatus(
      parseInt(id),
      parseInt(status),
      userId
    );

    res.json({
      success: true,
      message: 'Category status updated successfully',
      data: updatedCategory
    });
  } catch (error) {
    console.error('Error updating category status:', error);
    
    if (error.message === 'Category not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error updating category status',
      error: error.message
    });
  }
});

/**
 * @route   DELETE /api/repair-code-categories/:id
 * @desc    Soft delete category (set status to 0)
 * @access  Public
 * @param   id - Category ID
 * @query   hard - If true, permanently delete (use with caution)
 */
router.delete('/:id', addMetadata, async (req, res) => {
  try {
    const { id } = req.params;
    const { hard } = req.query;

    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'Valid category ID is required'
      });
    }

    // Get user ID from request metadata
    const userId = req.metadata?.userId || 0;

    let result;
    if (hard === 'true') {
      // Hard delete (permanent)
      result = await repairCodeCategoryService.hardDeleteCategory(parseInt(id));
    } else {
      // Soft delete (set status to 0)
      result = await repairCodeCategoryService.deleteCategory(parseInt(id), userId);
    }

    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error('Error deleting category:', error);
    
    if (error.message === 'Category not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('in use')) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error deleting category',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/repair-code-categories/bulk
 * @desc    Bulk update categories
 * @access  Public
 * @body    updates - Array of {id, status, repair_category_type}
 */
router.post('/bulk', addMetadata, async (req, res) => {
  try {
    const { updates } = req.body;

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Updates array is required and must not be empty'
      });
    }

    // Get user ID from request metadata
    const userId = req.metadata?.userId || 0;

    const results = await repairCodeCategoryService.bulkUpdateCategories(updates, userId);

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    res.json({
      success: true,
      message: `Bulk update completed. ${successCount} successful, ${failureCount} failed`,
      data: results
    });
  } catch (error) {
    console.error('Error in bulk update:', error);
    res.status(500).json({
      success: false,
      message: 'Error performing bulk update',
      error: error.message
    });
  }
});

module.exports = router;
