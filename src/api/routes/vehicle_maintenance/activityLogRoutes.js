/**
 * Activity Log Routes
 * RESTful API endpoints for user activity logs
 * Skysoft Fleet Maintenance Module
 * 
 * @author Skysoft Fleet Management Team
 * @version 1.0.0
 * @date 2025-12-16
 */

const express = require('express');
const router = express.Router();
const { executeQuery } = require('../../db/connection');
const { addMetadata } = require('../../middleware/requestMetadata');

// Debug route to verify router is loaded
router.get('/ping', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Activity Logs router is working!',
    timestamp: new Date().toISOString()
  });
});

/**
 * @route   GET /api/activity-logs/sources
 * @desc    Get unique log sources for filtering
 * @access  Public
 */
router.get('/sources', addMetadata, async (req, res) => {
  try {
    // Define sources
    const userLogSources = [
      'Manage Repair Code Categories',
      'fleet_management',
      'Maintenance Interval Configuration',
      'Maintenance Data Setup',
      'Payment Methods',
      'Manage Vendors',
      'Maintenance Service History',
      'Manage Defects',
      'Manage Repair Orders',
      'Maintenance Operations'
    ];

    // Dynamic placeholders
    const placeholders = userLogSources.map(() => '?').join(', ');

    const query = `
      SELECT DISTINCT log_source as source
      FROM user_activity_logs
      WHERE log_source IS NOT NULL
        AND log_source IN (${placeholders})
      
      UNION
      
      SELECT DISTINCT 'System - Scheduled Maintenance' as source
      FROM system_activities
      WHERE activity_type = 'Scheduled Maintenance Defect Creation'
      
      ORDER BY source
    `;

    const results = await executeQuery(query, userLogSources); // ✅ Use userLogSources

    res.status(200).json({
      success: true,
      data: results.map(r => r.source),
      metadata: req.metadata
    });
  } catch (error) {
    console.error('❌ Error in GET /api/activity-logs/sources:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      metadata: req.metadata
    });
  }
});

/**
 * @route   GET /api/activity-logs/users
 * @desc    Get unique users for filtering (with user names)
 * @access  Public
 */
router.get('/users', addMetadata, async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT 
        ual.user_id as userId,
        COALESCE(u.nickname, u.fullname, CONCAT('User ', ual.user_id)) as userName
      FROM user_activity_logs ual
      LEFT JOIN users u ON ual.user_id = u.id
      WHERE ual.user_id IS NOT NULL
      ORDER BY userName
    `;

    const results = await executeQuery(query);

    res.status(200).json({
      success: true,
      data: results,
      metadata: req.metadata
    });
  } catch (error) {
    console.error('❌ Error in GET /api/activity-logs/users:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      metadata: req.metadata
    });
  }
});

/**
 * @route   GET /api/activity-logs/statistics
 * @desc    Get activity log statistics (optionally filtered by source)
 * @query   source - Optional log source filter (module name)
 * @access  Public
 */
router.get('/', addMetadata, async (req, res) => {
  try {
    const {
      source,
      user_id,
      date_from,
      date_to,
      search,
      limit = 100,
      offset = 0
    } = req.query;

    // Define sources
    const userLogSources = [
      'Manage Repair Code Categories',
      'fleet_management',
      'Maintenance Interval Configuration',
      'Maintenance Data Setup',
      'Payment Methods',
      'Manage Vendors',
      'Maintenance Service History',
      'Manage Defects',
      'Manage Repair Orders',
      'Maintenance Operations'
    ];

    // Dynamic placeholders
    const placeholders = userLogSources.map(() => '?').join(', ');

    // Build user activity logs query
    let userLogsQuery = `
      SELECT 
        ual.log_id as logId,
        ual.log_date_time as dateTime,
        ual.log_ip as ipAddress,
        ual.log_browser as browser,
        ual.user_id as userId,
        COALESCE(u.nickname, u.fullname, CONCAT('User ', ual.user_id)) as userName,
        ual.log_source as source,
        ual.log_remark as remark,
        SUBSTRING(ual.log_old_value, 1, 5000) as oldValue,
        SUBSTRING(ual.log_updated_value, 1, 5000) as updatedValue
      FROM user_activity_logs ual
      LEFT JOIN users u ON ual.user_id = u.id
      WHERE ual.log_source IN (${placeholders})
    `;

    const params = [...userLogSources];

    // Filter by source/module
    if (source) {
      if (source === 'System - Scheduled Maintenance') {
        userLogsQuery += ' AND 1=0';
      } else {
        userLogsQuery += ' AND ual.log_source = ?';
        params.push(source);
      }
    }

    // Filter by user
    if (user_id) {
      userLogsQuery += ' AND ual.user_id = ?';
      params.push(user_id);
    }

    // Filter by date range
    if (date_from) {
      userLogsQuery += ' AND DATE(ual.log_date_time) >= ?';
      params.push(date_from);
    }

    if (date_to) {
      userLogsQuery += ' AND DATE(ual.log_date_time) <= ?';
      params.push(date_to);
    }

    // Search across multiple fields
    if (search) {
      userLogsQuery += ` AND (
        ual.log_remark LIKE ? OR
        ual.log_source LIKE ?
      )`;
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam);
    }

    // Build system activities query
    let systemLogsQuery = '';
    const systemParams = [];
    
    if (!user_id && (!source || source === 'System - Scheduled Maintenance')) {
      systemLogsQuery = `
        UNION ALL
        SELECT 
          sa.activity_id as logId,
          sa.created_at as dateTime,
          'System' as ipAddress,
          'Automated' as browser,
          NULL as userId,
          sa.triggered_by as userName,
          'System - Scheduled Maintenance' as source,
          CONCAT(
            'System created scheduled maintenance defect for vehicle \\'',
            JSON_UNQUOTE(JSON_EXTRACT(sa.metadata, '$.vehicle_nickname')),
            '\\': ',
            JSON_UNQUOTE(JSON_EXTRACT(sa.metadata, '$.defect_details.notes')),
            ' (Status: ',
            JSON_UNQUOTE(JSON_EXTRACT(sa.metadata, '$.maintenance_status')),
            ')'
          ) as remark,
          NULL as oldValue,
          NULL as updatedValue
        FROM system_activities sa
        WHERE sa.activity_type = 'Scheduled Maintenance Defect Creation'
          AND sa.triggered_by = 'System - Scheduled Maintenance'
      `;
      
      if (date_from) {
        systemLogsQuery += ' AND DATE(sa.created_at) >= ?';
        systemParams.push(date_from);
      }
      
      if (date_to) {
        systemLogsQuery += ' AND DATE(sa.created_at) <= ?';
        systemParams.push(date_to);
      }
      
      if (search) {
        systemLogsQuery += ` AND (
          JSON_UNQUOTE(JSON_EXTRACT(sa.metadata, '$.defect_details.notes')) LIKE ? OR
          JSON_UNQUOTE(JSON_EXTRACT(sa.metadata, '$.vehicle_nickname')) LIKE ? OR
          JSON_UNQUOTE(JSON_EXTRACT(sa.metadata, '$.maintenance_status')) LIKE ?
        )`;
        const searchParam = `%${search}%`;
        systemParams.push(searchParam, searchParam, searchParam);
      }
    }

    let query = userLogsQuery + systemLogsQuery;
    query += ' ORDER BY dateTime DESC';

    const safeLimit = parseInt(limit) || 100;
    const safeOffset = parseInt(offset) || 0;
    query += ` LIMIT ${safeOffset}, ${safeLimit}`;

    const allParams = [...params, ...systemParams];

    console.log('🔍 Executing combined query with system logs');
    const results = await executeQuery(query, allParams);
    console.log('✅ Query results count:', results.length);

    // ✅ FIX: Use dynamic placeholders for count query too!
    const userCountPlaceholders = userLogSources.map(() => '?').join(', ');
    let userCountQuery = `
      SELECT COUNT(*) as total 
      FROM user_activity_logs ual
      WHERE ual.log_source IN (${userCountPlaceholders})
    `;
    const userCountParams = [...userLogSources];

    if (source) {
      if (source === 'System - Scheduled Maintenance') {
        userCountQuery += ' AND 1=0';
      } else {
        userCountQuery += ' AND ual.log_source = ?';
        userCountParams.push(source);
      }
    }
    if (user_id) {
      userCountQuery += ' AND ual.user_id = ?';
      userCountParams.push(user_id);
    }
    if (date_from) {
      userCountQuery += ' AND DATE(ual.log_date_time) >= ?';
      userCountParams.push(date_from);
    }
    if (date_to) {
      userCountQuery += ' AND DATE(ual.log_date_time) <= ?';
      userCountParams.push(date_to);
    }
    if (search) {
      userCountQuery += ` AND (
        ual.log_remark LIKE ? OR
        ual.log_source LIKE ?
      )`;
      const searchParam = `%${search}%`;
      userCountParams.push(searchParam, searchParam);
    }

    const userCountResult = await executeQuery(userCountQuery, userCountParams);
    let total = userCountResult[0].total;

    // Add system logs count if applicable
    if (!user_id && (!source || source === 'System - Scheduled Maintenance')) {
      let systemCountQuery = `
        SELECT COUNT(*) as total
        FROM system_activities sa
        WHERE sa.activity_type = 'Scheduled Maintenance Defect Creation'
          AND sa.triggered_by = 'System - Scheduled Maintenance'
      `;
      const systemCountParams = [];
      
      if (date_from) {
        systemCountQuery += ' AND DATE(sa.created_at) >= ?';
        systemCountParams.push(date_from);
      }
      if (date_to) {
        systemCountQuery += ' AND DATE(sa.created_at) <= ?';
        systemCountParams.push(date_to);
      }
      if (search) {
        systemCountQuery += ` AND (
          JSON_UNQUOTE(JSON_EXTRACT(sa.metadata, '$.defect_details.notes')) LIKE ? OR
          JSON_UNQUOTE(JSON_EXTRACT(sa.metadata, '$.vehicle_nickname')) LIKE ? OR
          JSON_UNQUOTE(JSON_EXTRACT(sa.metadata, '$.maintenance_status')) LIKE ?
        )`;
        const searchParam = `%${search}%`;
        systemCountParams.push(searchParam, searchParam, searchParam);
      }
      
      const systemCountResult = await executeQuery(systemCountQuery, systemCountParams);
      total += systemCountResult[0].total;
    }

    console.log('📈 Total logs in database:', total);

    // Parse JSON strings in old/new values
    const logs = results.map(log => {
      let parsedOldValue = log.oldValue;
      let parsedUpdatedValue = log.updatedValue;

      if (log.oldValue && typeof log.oldValue === 'string') {
        try {
          if (log.oldValue.trim().startsWith('{') || log.oldValue.trim().startsWith('[')) {
            parsedOldValue = JSON.parse(log.oldValue);
          }
        } catch (e) {
          parsedOldValue = log.oldValue;
        }
      }

      if (log.updatedValue && typeof log.updatedValue === 'string') {
        try {
          if (log.updatedValue.trim().startsWith('{') || log.updatedValue.trim().startsWith('[')) {
            parsedUpdatedValue = JSON.parse(log.updatedValue);
          }
        } catch (e) {
          parsedUpdatedValue = log.updatedValue;
        }
      }

      return {
        ...log,
        oldValue: parsedOldValue,
        updatedValue: parsedUpdatedValue
      };
    });

    res.status(200).json({
      success: true,
      data: logs,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < total
      },
      metadata: req.metadata
    });
  } catch (error) {
    console.error('❌ Error in GET /api/activity-logs:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      metadata: req.metadata
    });
  }
});

/**
 * @route   GET /api/activity-logs/test/count
 * @desc    Test endpoint to check if table has data
 * @access  Public
 */
router.get('/test/count', addMetadata, async (req, res) => {
  try {
    const query = 'SELECT COUNT(*) as total FROM user_activity_logs';
    const result = await executeQuery(query);
    
    const sampleQuery = 'SELECT * FROM user_activity_logs ORDER BY log_date_time DESC LIMIT 5';
    const samples = await executeQuery(sampleQuery);
    
    res.status(200).json({
      success: true,
      totalRecords: result[0].total,
      sampleRecords: samples,
      message: `Found ${result[0].total} records in user_activity_logs table`
    });
  } catch (error) {
    console.error('❌ Error in test endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   GET /api/activity-logs/test/new-modules
 * @desc    Test endpoint to check new modules without large fields
 * @access  Public
 */
router.get('/test/new-modules', addMetadata, async (req, res) => {
  try {
    const query = `
      SELECT 
        log_id,
        log_source,
        log_remark,
        log_date_time
      FROM user_activity_logs
      WHERE log_source IN ('Maintenance Service History', 'Manage Defects', 'Manage Repair Orders')
      ORDER BY log_date_time DESC
      LIMIT 10
    `;
    
    const results = await executeQuery(query);
    
    res.status(200).json({
      success: true,
      count: results.length,
      data: results,
      message: 'Successfully fetched logs from new modules'
    });
  } catch (error) {
    console.error('❌ Error testing new modules:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: error.code
    });
  }
});

/**
 * @route   GET /api/activity-logs
 * @desc    Get all activity logs with filtering and pagination
 * @query   source, user_id, date_from, date_to, search, limit, offset
 * @access  Public
 */
router.get('/', addMetadata, async (req, res) => {
  try {
    const {
      source,
      user_id,
      date_from,
      date_to,
      search,
      limit = 100,
      offset = 0
    } = req.query;

    // Only show the 9 implemented module sources
    const implementedSources = [
      'Manage Repair Code Categories',
      'fleet_management',
      'Maintenance Interval Configuration',
      'Maintenance Data Setup',
      'Payment Methods',
      'Manage Vendors',
      'Maintenance Service History',
      'Manage Defects',
      'Manage Repair Orders',
      'Maintenance Operations'
    ];
        const placeholders = userLogSources.map(() => '?').join(', ');

    // Build user activity logs query
    let userLogsQuery = `
      SELECT 
        ual.log_id as logId,
        ual.log_date_time as dateTime,
        ual.log_ip as ipAddress,
        ual.log_browser as browser,
        ual.user_id as userId,
        COALESCE(u.nickname, u.fullname, CONCAT('User ', ual.user_id)) as userName,
        ual.log_source as source,
        ual.log_remark as remark,
        SUBSTRING(ual.log_old_value, 1, 5000) as oldValue,
        SUBSTRING(ual.log_updated_value, 1, 5000) as updatedValue
      FROM user_activity_logs ual
      LEFT JOIN users u ON ual.user_id = u.id
       WHERE ual.log_source IN (${placeholders})
    `;

      const params = [...userLogSources];

    // Filter by source/module
    if (source) {
      if (source === 'System - Scheduled Maintenance') {
        // When filtering to System - Scheduled Maintenance, exclude all user logs
        userLogsQuery += ' AND 1=0';
      } else {
        // Filter to specific user log source
        userLogsQuery += ' AND ual.log_source = ?';
        params.push(source);
      }
    }

    // Filter by user
    if (user_id) {
      userLogsQuery += ' AND ual.user_id = ?';
      params.push(user_id);
    }

    // Filter by date range
    if (date_from) {
      userLogsQuery += ' AND DATE(ual.log_date_time) >= ?';
      params.push(date_from);
    }

    if (date_to) {
      userLogsQuery += ' AND DATE(ual.log_date_time) <= ?';
      params.push(date_to);
    }

    // Search across multiple fields
    if (search) {
      userLogsQuery += ` AND (
        ual.log_remark LIKE ? OR
        ual.log_source LIKE ?
      )`;
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam);
    }

    // Build system activities query
    let systemLogsQuery = '';
    const systemParams = [];
    
    // Only include system logs if not filtered by user (system logs have no user_id)
    // and if source is either 'System - Scheduled Maintenance' or not specified
    if (!user_id && (!source || source === 'System - Scheduled Maintenance')) {
      systemLogsQuery = `
        UNION ALL
        SELECT 
          sa.activity_id as logId,
          sa.created_at as dateTime,
          'System' as ipAddress,
          'Automated' as browser,
          NULL as userId,
          sa.triggered_by as userName,
          'System - Scheduled Maintenance' as source,
          CONCAT(
            'System created scheduled maintenance defect for vehicle \\'',
            JSON_UNQUOTE(JSON_EXTRACT(sa.metadata, '$.vehicle_nickname')),
            '\\': ',
            JSON_UNQUOTE(JSON_EXTRACT(sa.metadata, '$.defect_details.notes')),
            ' (Status: ',
            JSON_UNQUOTE(JSON_EXTRACT(sa.metadata, '$.maintenance_status')),
            ')'
          ) as remark,
          NULL as oldValue,
          NULL as updatedValue
        FROM system_activities sa
        WHERE sa.activity_type = 'Scheduled Maintenance Defect Creation'
          AND sa.triggered_by = 'System - Scheduled Maintenance'
      `;
      
      // Apply date filters to system logs too
      if (date_from) {
        systemLogsQuery += ' AND DATE(sa.created_at) >= ?';
        systemParams.push(date_from);
      }
      
      if (date_to) {
        systemLogsQuery += ' AND DATE(sa.created_at) <= ?';
        systemParams.push(date_to);
      }
      
      // Apply search filter to system logs
      if (search) {
        systemLogsQuery += ` AND (
          JSON_UNQUOTE(JSON_EXTRACT(sa.metadata, '$.defect_details.notes')) LIKE ? OR
          JSON_UNQUOTE(JSON_EXTRACT(sa.metadata, '$.vehicle_nickname')) LIKE ? OR
          JSON_UNQUOTE(JSON_EXTRACT(sa.metadata, '$.maintenance_status')) LIKE ?
        )`;
        const searchParam = `%${search}%`;
        systemParams.push(searchParam, searchParam, searchParam);
      }
    }

    // Combine queries
    let query = userLogsQuery + systemLogsQuery;
    
    // Order by most recent first
    query += ' ORDER BY dateTime DESC';

    // Pagination - Direct integer insertion
    const safeLimit = parseInt(limit) || 100;
    const safeOffset = parseInt(offset) || 0;
    query += ` LIMIT ${safeOffset}, ${safeLimit}`;

    // Combine all params
    const allParams = [...params, ...systemParams];

    console.log('🔍 Executing combined query with system logs');
    console.log('📊 With params:', allParams);

    const results = await executeQuery(query, allParams);
    
    console.log('✅ Query results count:', results.length);

    // Get total count for pagination - must include both sources
    let userCountQuery = `
      SELECT COUNT(*) as total 
      FROM user_activity_logs ual
      WHERE ual.log_source IN (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const userCountParams = [...implementedSources];

    if (source) {
      if (source === 'System - Scheduled Maintenance') {
        // When filtering to System - Scheduled Maintenance, exclude all user logs from count
        userCountQuery += ' AND 1=0';
      } else {
        // Filter to specific user log source
        userCountQuery += ' AND ual.log_source = ?';
        userCountParams.push(source);
      }
    }
    if (user_id) {
      userCountQuery += ' AND ual.user_id = ?';
      userCountParams.push(user_id);
    }
    if (date_from) {
      userCountQuery += ' AND DATE(ual.log_date_time) >= ?';
      userCountParams.push(date_from);
    }
    if (date_to) {
      userCountQuery += ' AND DATE(ual.log_date_time) <= ?';
      userCountParams.push(date_to);
    }
    if (search) {
      userCountQuery += ` AND (
        ual.log_remark LIKE ? OR
        ual.log_source LIKE ?
      )`;
      const searchParam = `%${search}%`;
      userCountParams.push(searchParam, searchParam);
    }

    const userCountResult = await executeQuery(userCountQuery, userCountParams);
    let total = userCountResult[0].total;

    // Add system logs count if applicable
    if (!user_id && (!source || source === 'System - Scheduled Maintenance')) {
      let systemCountQuery = `
        SELECT COUNT(*) as total
        FROM system_activities sa
        WHERE sa.activity_type = 'Scheduled Maintenance Defect Creation'
          AND sa.triggered_by = 'System - Scheduled Maintenance'
      `;
      const systemCountParams = [];
      
      if (date_from) {
        systemCountQuery += ' AND DATE(sa.created_at) >= ?';
        systemCountParams.push(date_from);
      }
      if (date_to) {
        systemCountQuery += ' AND DATE(sa.created_at) <= ?';
        systemCountParams.push(date_to);
      }
      if (search) {
        systemCountQuery += ` AND (
          JSON_UNQUOTE(JSON_EXTRACT(sa.metadata, '$.defect_details.notes')) LIKE ? OR
          JSON_UNQUOTE(JSON_EXTRACT(sa.metadata, '$.vehicle_nickname')) LIKE ? OR
          JSON_UNQUOTE(JSON_EXTRACT(sa.metadata, '$.maintenance_status')) LIKE ?
        )`;
        const searchParam = `%${search}%`;
        systemCountParams.push(searchParam, searchParam, searchParam);
      }
      
      const systemCountResult = await executeQuery(systemCountQuery, systemCountParams);
      total += systemCountResult[0].total;
    }

    console.log('📈 Total logs in database:', total);

    // Parse JSON strings in old/new values - handle both JSON and plain text
    const logs = results.map(log => {
      let parsedOldValue = log.oldValue;
      let parsedUpdatedValue = log.updatedValue;

      // Try to parse oldValue if it's a JSON string
      if (log.oldValue && typeof log.oldValue === 'string') {
        try {
          if (log.oldValue.trim().startsWith('{') || log.oldValue.trim().startsWith('[')) {
            parsedOldValue = JSON.parse(log.oldValue);
          }
        } catch (e) {
          // Keep as string if not valid JSON
          parsedOldValue = log.oldValue;
        }
      }

      // Try to parse updatedValue if it's a JSON string
      if (log.updatedValue && typeof log.updatedValue === 'string') {
        try {
          if (log.updatedValue.trim().startsWith('{') || log.updatedValue.trim().startsWith('[')) {
            parsedUpdatedValue = JSON.parse(log.updatedValue);
          }
        } catch (e) {
          // Keep as string if not valid JSON
          parsedUpdatedValue = log.updatedValue;
        }
      }

      return {
        ...log,
        oldValue: parsedOldValue,
        updatedValue: parsedUpdatedValue
      };
    });

    res.status(200).json({
      success: true,
      data: logs,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < total
      },
      metadata: req.metadata
    });
  } catch (error) {
    console.error('❌ Error in GET /api/activity-logs:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      metadata: req.metadata
    });
  }
});

/**
 * @route   GET /api/activity-logs/:id
 * @desc    Get specific log entry by ID
 * @param   id - Log ID
 * @access  Public
 */
router.get('/:id', addMetadata, async (req, res) => {
  try {
    const logId = parseInt(req.params.id);

    if (isNaN(logId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid log ID',
        metadata: req.metadata
      });
    }

    const query = `
      SELECT 
        log_id as logId,
        log_date_time as dateTime,
        log_ip as ipAddress,
        log_browser as browser,
        user_id as userId,
        log_source as source,
        log_remark as remark,
        log_old_value as oldValue,
        log_updated_value as updatedValue
      FROM user_activity_logs
      WHERE log_id = ?
    `;

    const results = await executeQuery(query, [logId]);

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Log entry not found',
        metadata: req.metadata
      });
    }

    const log = results[0];

    // Parse JSON strings
    const parsedLog = {
      ...log,
      oldValue: log.oldValue ? (log.oldValue.startsWith('{') || log.oldValue.startsWith('[') ? JSON.parse(log.oldValue) : log.oldValue) : null,
      updatedValue: log.updatedValue ? (log.updatedValue.startsWith('{') || log.updatedValue.startsWith('[') ? JSON.parse(log.updatedValue) : log.updatedValue) : null
    };

    res.status(200).json({
      success: true,
      data: parsedLog,
      metadata: req.metadata
    });
  } catch (error) {
    console.error('❌ Error in GET /api/activity-logs/:id:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      metadata: req.metadata
    });
  }
});

/**
 * @route   POST /api/activity-logs
 * @desc    Create a new activity log entry
 * @body    { user_id, source, remark, old_value, updated_value, ip_address, browser }
 * @access  Public
 */
router.post('/', addMetadata, async (req, res) => {
  try {
    const {
      user_id,
      source,
      remark,
      old_value,
      updated_value,
      ip_address,
      browser
    } = req.body;

    console.log('📝 Creating activity log:', req.body);

    // Validation
    if (!user_id || !source || !remark) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'user_id, source, and remark are required',
        metadata: req.metadata
      });
    }

    // Insert the log entry
    const query = `
      INSERT INTO user_activity_logs (
        user_id,
        log_source,
        log_remark,
        log_old_value,
        log_updated_value,
        log_ip,
        log_browser,
        log_date_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    const params = [
      user_id,
      source,
      remark,
      old_value || null,
      updated_value || null,
      ip_address || 'N/A',
      browser || 'Unknown'
    ];

    const result = await executeQuery(query, params);

    console.log('✅ Activity log created successfully, ID:', result.insertId);

    res.status(201).json({
      success: true,
      message: 'Activity log created successfully',
      data: {
        logId: result.insertId,
        userId: user_id,
        source,
        remark,
        createdAt: new Date().toISOString()
      },
      metadata: req.metadata
    });
  } catch (error) {
    console.error('❌ Error in POST /api/activity-logs:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      metadata: req.metadata
    });
  }
});

module.exports = router;
