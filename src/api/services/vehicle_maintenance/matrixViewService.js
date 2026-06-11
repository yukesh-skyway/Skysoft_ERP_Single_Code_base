/**
 * Matrix View Service
 * Business logic for Fleet_Matrix_View settings management
 * Organization-level custom views for Maintenance Schedule Matrix
 * Skysoft Fleet Maintenance Module
 */

const db = require('../../db/connection');

/**
 * Generate a slug from view name
 * @param {string} viewName - Display name
 * @returns {string} Slug (lowercase with underscores)
 */
const generateSlug = (viewName) => {
  return viewName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_') // Replace non-alphanumeric with underscore
    .replace(/^_+|_+$/g, ''); // Remove leading/trailing underscores
};

/**
 * Get all organization matrix views
 * @returns {Promise<Object>} List of views
 */
const getAllMatrixViews = async () => {
  try {
    const query = `
      SELECT 
        id,
        name,
        value,
        description,
        options
      FROM settings
      WHERE settings_group = 'Fleet_Matrix_View'
        AND status = 1
      ORDER BY name ASC
    `;

    const [rows] = await db.query(query);

    // Parse JSON values
    const views = rows.map(row => ({
      id: row.id,
      name: row.name,
      config: JSON.parse(row.value),
      description: row.description,
      options: row.options ? JSON.parse(row.options) : null
    }));

    return {
      success: true,
      data: views,
      count: views.length
    };
  } catch (error) {
    console.error('❌ Error fetching matrix views:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get a specific matrix view by name
 * @param {string} name - View name (slug)
 * @returns {Promise<Object>} View data
 */
const getMatrixViewByName = async (name) => {
  try {
    const query = `
      SELECT 
        id,
        name,
        value,
        description,
        options
      FROM settings
      WHERE settings_group = 'Fleet_Matrix_View'
        AND name = ?
        AND status = 1
    `;

    const [rows] = await db.query(query, [name]);

    if (rows.length === 0) {
      return {
        success: false,
        error: 'View not found'
      };
    }

    const view = {
      id: rows[0].id,
      name: rows[0].name,
      config: JSON.parse(rows[0].value),
      description: rows[0].description,
      options: rows[0].options ? JSON.parse(rows[0].options) : null
    };

    return {
      success: true,
      data: view
    };
  } catch (error) {
    console.error('❌ Error fetching matrix view:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get the default matrix view
 * @returns {Promise<Object>} Default view data
 */
const getDefaultMatrixView = async () => {
  try {
    const query = `
      SELECT 
        id,
        name,
        value,
        description,
        options
      FROM settings
      WHERE settings_group = 'Fleet_Matrix_View'
        AND status = 1
        AND JSON_EXTRACT(value, '$.isDefault') = true
      LIMIT 1
    `;

    const [rows] = await db.query(query);

    if (rows.length === 0) {
      return {
        success: false,
        error: 'No default view found'
      };
    }

    const view = {
      id: rows[0].id,
      name: rows[0].name,
      config: JSON.parse(rows[0].value),
      description: rows[0].description,
      options: rows[0].options ? JSON.parse(rows[0].options) : null
    };

    return {
      success: true,
      data: view
    };
  } catch (error) {
    console.error('❌ Error fetching default matrix view:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Create a new matrix view
 * @param {Object} viewData - View configuration
 * @returns {Promise<Object>} Created view
 */
const createMatrixView = async (viewData) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const {
      viewName,
      vehicleOrder = [],
      columnOrder = [],
      filters = {},
      description = '',
      setAsDefault = false
    } = viewData;

    if (!viewName || viewName.trim() === '') {
      await connection.rollback();
      return {
        success: false,
        error: 'View name is required'
      };
    }

    // Generate slug from view name
    const slug = generateSlug(viewName);

    // Check if slug already exists
    const [existing] = await connection.query(
      `SELECT id FROM settings 
       WHERE settings_group = 'Fleet_Matrix_View' 
       AND name = ? 
       AND status = 1`,
      [slug]
    );

    if (existing.length > 0) {
      await connection.rollback();
      return {
        success: false,
        error: 'A view with this name already exists'
      };
    }

    // If setting as default, unset all other defaults first
    if (setAsDefault) {
      await connection.query(
        `UPDATE settings 
         SET value = JSON_SET(value, '$.isDefault', false)
         WHERE settings_group = 'Fleet_Matrix_View'
         AND status = 1`
      );
    }

    // Build config object
    const config = {
      viewName,
      vehicleOrder,
      columnOrder,
      filters,
      isDefault: setAsDefault,
      createdAt: new Date().toISOString()
    };

    // Insert new view
    const [result] = await connection.query(
      `INSERT INTO settings 
       (settings_group, name, value, description, control, options, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        'Fleet_Matrix_View',
        slug,
        JSON.stringify(config),
        description,
        'json',
        null,
        1
      ]
    );

    await connection.commit();

    return {
      success: true,
      message: 'Matrix view saved successfully',
      data: {
        id: result.insertId,
        name: slug,
        viewName,
        config
      }
    };
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error creating matrix view:', error);
    return {
      success: false,
      error: error.message
    };
  } finally {
    connection.release();
  }
};

/**
 * Update an existing matrix view
 * @param {string} name - View name (slug)
 * @param {Object} viewData - Updated view configuration
 * @returns {Promise<Object>} Updated view
 */
const updateMatrixView = async (name, viewData) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Check if view exists
    const [existingView] = await connection.query(
      `SELECT id, value FROM settings 
       WHERE settings_group = 'Fleet_Matrix_View' 
       AND name = ? 
       AND status = 1`,
      [name]
    );

    if (existingView.length === 0) {
      await connection.rollback();
      return {
        success: false,
        error: 'View not found'
      };
    }

    const currentConfig = JSON.parse(existingView[0].value);

    const {
      viewName = currentConfig.viewName,
      vehicleOrder = currentConfig.vehicleOrder,
      columnOrder = currentConfig.columnOrder,
      filters = currentConfig.filters,
      description,
      setAsDefault = false
    } = viewData;

    // If setting as default, unset all other defaults first
    if (setAsDefault) {
      await connection.query(
        `UPDATE settings 
         SET value = JSON_SET(value, '$.isDefault', false)
         WHERE settings_group = 'Fleet_Matrix_View'
         AND status = 1`
      );
    }

    // Build updated config
    const updatedConfig = {
      ...currentConfig,
      viewName,
      vehicleOrder,
      columnOrder,
      filters,
      isDefault: setAsDefault,
      updatedAt: new Date().toISOString()
    };

    // Update the view
    const updateQuery = description !== undefined
      ? `UPDATE settings 
         SET value = ?, description = ? 
         WHERE settings_group = 'Fleet_Matrix_View' 
         AND name = ? 
         AND status = 1`
      : `UPDATE settings 
         SET value = ? 
         WHERE settings_group = 'Fleet_Matrix_View' 
         AND name = ? 
         AND status = 1`;

    const updateParams = description !== undefined
      ? [JSON.stringify(updatedConfig), description, name]
      : [JSON.stringify(updatedConfig), name];

    await connection.query(updateQuery, updateParams);

    await connection.commit();

    return {
      success: true,
      message: 'Matrix view updated successfully',
      data: {
        name,
        viewName,
        config: updatedConfig
      }
    };
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error updating matrix view:', error);
    return {
      success: false,
      error: error.message
    };
  } finally {
    connection.release();
  }
};

/**
 * Delete a matrix view (soft delete)
 * @param {string} name - View name (slug)
 * @returns {Promise<Object>} Deletion result
 */
const deleteMatrixView = async (name) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Check if view exists
    const [existingView] = await connection.query(
      `SELECT id FROM settings 
       WHERE settings_group = 'Fleet_Matrix_View' 
       AND name = ? 
       AND status = 1`,
      [name]
    );

    if (existingView.length === 0) {
      await connection.rollback();
      return {
        success: false,
        error: 'View not found'
      };
    }

    // Soft delete (set status = 0)
    await connection.query(
      `UPDATE settings 
       SET status = 0 
       WHERE settings_group = 'Fleet_Matrix_View' 
       AND name = ? 
       AND status = 1`,
      [name]
    );

    await connection.commit();

    return {
      success: true,
      message: 'Matrix view deleted successfully'
    };
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error deleting matrix view:', error);
    return {
      success: false,
      error: error.message
    };
  } finally {
    connection.release();
  }
};

/**
 * Set a view as the default
 * @param {string} name - View name (slug)
 * @returns {Promise<Object>} Update result
 */
const setDefaultMatrixView = async (name) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Check if view exists
    const [existingView] = await connection.query(
      `SELECT id FROM settings 
       WHERE settings_group = 'Fleet_Matrix_View' 
       AND name = ? 
       AND status = 1`,
      [name]
    );

    if (existingView.length === 0) {
      await connection.rollback();
      return {
        success: false,
        error: 'View not found'
      };
    }

    // Unset all defaults
    await connection.query(
      `UPDATE settings 
       SET value = JSON_SET(value, '$.isDefault', false)
       WHERE settings_group = 'Fleet_Matrix_View'
       AND status = 1`
    );

    // Set the selected view as default
    await connection.query(
      `UPDATE settings 
       SET value = JSON_SET(value, '$.isDefault', true)
       WHERE settings_group = 'Fleet_Matrix_View'
       AND name = ?
       AND status = 1`,
      [name]
    );

    await connection.commit();

    return {
      success: true,
      message: 'Default view set successfully'
    };
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error setting default matrix view:', error);
    return {
      success: false,
      error: error.message
    };
  } finally {
    connection.release();
  }
};

module.exports = {
  getAllMatrixViews,
  getMatrixViewByName,
  getDefaultMatrixView,
  createMatrixView,
  updateMatrixView,
  deleteMatrixView,
  setDefaultMatrixView
};
