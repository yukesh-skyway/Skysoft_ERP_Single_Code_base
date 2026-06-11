const express = require('express');
const router = express.Router();
const db = require('../../db/connection');
const { 
  logPaymentMethodCreated,
  logPaymentMethodUpdated,
  logPaymentMethodDeleted 
} = require('../../services/vehicle_maintenance/auditLogService');

// Get all payment methods with filtering and pagination
router.get('/', async (req, res) => {
  try {
    const { txtKey = '', page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = 'SELECT * FROM payment_methods WHERE id != 0';
    const params = [];

    // Add search filter
    if (txtKey) {
      query += ' AND payment_method LIKE ?';
      params.push(`%${txtKey}%`);
    }

    // Get total count
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
    const [countResult] = await db.query(countQuery, params);
    const total = countResult[0].total;

    // Add pagination
    query += ' ORDER BY payment_method ASC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [rows] = await db.query(query, params);

    res.json({
      success: true,
      data: rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching payment methods:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment methods',
      error: error.message
    });
  }
});

// Get single payment method by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(
      'SELECT * FROM payment_methods WHERE id = ? LIMIT 1',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Payment method not found'
      });
    }

    res.json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error('Error fetching payment method:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment method',
      error: error.message
    });
  }
});

// Create new payment method
router.post('/', async (req, res) => {
  try {
    const { txtName } = req.body;

    if (!txtName || txtName.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Please fill all required details.'
      });
    }

    const [result] = await db.query(
      'INSERT INTO payment_methods (payment_method, status) VALUES (?, 1)',
      [txtName]
    );

    if (result.insertId) {
      // Log the creation
      await logPaymentMethodCreated(
        {
          id: result.insertId,
          name: txtName,
          status: 1
        },
        {
          ipAddress: req.ipAddress,
          browser: req.browser,
          userId: req.userId || 0
        }
      );

      res.json({
        success: true,
        message: 'Payment method created successfully',
        id: result.insertId
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Unable to add payment method.'
      });
    }
  } catch (error) {
    console.error('Error creating payment method:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment method',
      error: error.message
    });
  }
});

// Update payment method
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { txtName, txtStatus } = req.body;

    if (!txtName || txtName.trim() === '' || txtStatus === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Please fill all required details.'
      });
    }

    // Get old data before update
    const [oldData] = await db.query(
      'SELECT * FROM payment_methods WHERE id = ? LIMIT 1',
      [id]
    );

    if (oldData.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Payment method not found'
      });
    }

    const [result] = await db.query(
      'UPDATE payment_methods SET payment_method = ?, status = ? WHERE id = ? LIMIT 1',
      [txtName, txtStatus, id]
    );

    if (result.affectedRows > 0) {
      // Log the update with old and new values
      await logPaymentMethodUpdated(
        {
          id: oldData[0].id,
          name: oldData[0].payment_method,
          status: oldData[0].status
        },
        {
          id: parseInt(id),
          name: txtName,
          status: parseInt(txtStatus)
        },
        {
          ipAddress: req.ipAddress,
          browser: req.browser,
          userId: req.userId || 0
        }
      );

      res.json({
        success: true,
        message: 'Payment method updated successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Payment method not found'
      });
    }
  } catch (error) {
    console.error('Error updating payment method:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update payment method',
      error: error.message
    });
  }
});

// Delete payment method (soft delete by setting status to 0)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get old data before delete
    const [oldData] = await db.query(
      'SELECT * FROM payment_methods WHERE id = ? LIMIT 1',
      [id]
    );

    if (oldData.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Payment method not found'
      });
    }

    const [result] = await db.query(
      'UPDATE payment_methods SET status = 0 WHERE id = ? LIMIT 1',
      [id]
    );

    if (result.affectedRows > 0) {
      // Log the deletion
      await logPaymentMethodDeleted(
        {
          id: oldData[0].id,
          name: oldData[0].payment_method,
          status: oldData[0].status
        },
        {
          ipAddress: req.ipAddress,
          browser: req.browser,
          userId: req.userId || 0
        }
      );

      res.json({
        success: true,
        message: 'Payment method deleted successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Payment method not found'
      });
    }
  } catch (error) {
    console.error('Error deleting payment method:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete payment method',
      error: error.message
    });
  }
});

module.exports = router;
