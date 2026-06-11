/**
 * Vendor Service
 * Business logic for vendors
 */

const db = require('../../db/connection');
const auditLogService = require('./auditLogService');

/**
 * Get all vendors
 */
async function getAllVendors({ status = 1, key = '' } = {}) {
  try {
    let query = 'SELECT * FROM vendors WHERE id != 0';
    const params = [];

    // Status filter
    if (status !== undefined && status !== '' && status !== 'all') {
      query += ' AND status = ?';
      params.push(status);
    }

    // Search filter (matches PHP logic)
    if (key && key.trim() !== '') {
      query += ' AND (vendor_name LIKE ? OR vendor_address LIKE ? OR vendor_email LIKE ? OR vendor_phone LIKE ?)';
      const searchPattern = `%${key}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    query += ' ORDER BY vendor_name ASC';

    const [vendors] = await db.query(query, params);
    return vendors;
  } catch (error) {
    console.error('Service error in getAllVendors:', error);
    throw error;
  }
}

/**
 * Get a vendor by ID
 */
async function getVendorById(id) {
  try {
    const query = 'SELECT * FROM vendors WHERE id = ? LIMIT 1';
    const [results] = await db.query(query, [id]);
    return results[0] || null;
  } catch (error) {
    console.error('Service error in getVendorById:', error);
    throw error;
  }
}

/**
 * Create a new vendor
 */
async function createVendor(vendorData, metadata = {}) {
  try {
    const {
      vendor_name,
      vendor_email = '',
      vendor_phone = '',
      vendor_address = '',
      vendor_notes = '',
      status = 1
    } = vendorData;

    const query = `
      INSERT INTO vendors (
        vendor_name,
        vendor_address,
        vendor_phone,
        vendor_email,
        vendor_notes,
        status
      ) VALUES (?, ?, ?, ?, ?, ?)
    `;

    const [result] = await db.query(query, [
      vendor_name,
      vendor_address,
      vendor_phone,
      vendor_email,
      vendor_notes,
      status
    ]);

    const newVendor = {
      id: result.insertId,
      vendor_name,
      vendor_address,
      vendor_email,
      vendor_phone,
      vendor_notes,
      status
    };

    // Log vendor creation
    await auditLogService.logVendorCreated(newVendor, metadata);

    return newVendor;
  } catch (error) {
    console.error('Service error in createVendor:', error);
    throw error;
  }
}

/**
 * Update a vendor
 */
async function updateVendor(id, vendorData, metadata = {}) {
  try {
    // Get old vendor data for audit log
    const oldVendor = await getVendorById(id);
    if (!oldVendor) {
      return null;
    }

    const updateFields = [];
    const updateValues = [];

    const allowedFields = [
      'vendor_name', 'vendor_email',
      'vendor_phone', 'vendor_address', 'vendor_notes', 'status'
    ];

    allowedFields.forEach(field => {
      if (vendorData[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        updateValues.push(vendorData[field]);
      }
    });

    if (updateFields.length === 0) {
      throw new Error('No fields to update');
    }

    updateValues.push(id);

    const query = `
      UPDATE vendors 
      SET ${updateFields.join(', ')}
      WHERE id = ?
      LIMIT 1
    `;

    const [result] = await db.query(query, updateValues);

    if (result.affectedRows === 0) {
      return null;
    }

    const updatedVendor = await getVendorById(id);

    // Log vendor update
    await auditLogService.logVendorUpdated(oldVendor, updatedVendor, metadata);

    return updatedVendor;
  } catch (error) {
    console.error('Service error in updateVendor:', error);
    throw error;
  }
}

/**
 * Delete a vendor (soft delete)
 */
async function deleteVendor(id, metadata = {}) {
  try {
    // Get vendor data for audit log
    const vendor = await getVendorById(id);
    if (!vendor) {
      return null;
    }

    const query = 'UPDATE vendors SET status = 0 WHERE id = ? LIMIT 1';
    const [result] = await db.query(query, [id]);

    if (result.affectedRows === 0) {
      return null;
    }

    // Log vendor deletion
    await auditLogService.logVendorDeleted(vendor, metadata);

    return { id };
  } catch (error) {
    console.error('Service error in deleteVendor:', error);
    throw error;
  }
}

module.exports = {
  getAllVendors,
  getVendorById,
  createVendor,
  updateVendor,
  deleteVendor
};
