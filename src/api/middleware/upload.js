/**
 * Multer File Upload Middleware
 * Handles file uploads for RO invoices (matching PHP implementation)
 * 
 * PHP Logic Reference:
 * - Upload directory: uploads/ro/{ro_id}/
 * - Allowed types: jpg, jpeg, png, gif, pdf
 * - Max file size: 50MB (50,000,000 bytes)
 * - File naming: {timestamp}.{extension}
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Storage configuration (matching PHP logic)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Get RO ID from request parameters
    const roId = req.params.id;
    
    // Create upload directory: uploads/ro/{ro_id}/ (OUTSIDE vehicle_schedule_maintenance_module)
    const uploadDir = path.join(__dirname, '../../../uploads/ro', roId.toString());
    
    console.log('📁 Upload directory path:', uploadDir);
    
    // Create directory if it doesn't exist (matching PHP: mkdir($target_dir, 0755, true))
    try {
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true, mode: 0o755 });
        console.log('✅ Created upload directory:', uploadDir);
      }
      cb(null, uploadDir);
    } catch (error) {
      console.error('❌ Failed to create upload directory:', error);
      cb(error, null);
    }
  },
  filename: (req, file, cb) => {
    // Generate timestamp-based filename (matching PHP: round(microtime(true)))
    const timestamp = Date.now(); // Use milliseconds for uniqueness
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `${timestamp}${ext}`;
    console.log('📄 Generated filename:', filename);
    cb(null, filename);
  }
});

// File filter (matching PHP validation)
const fileFilter = (req, file, cb) => {
  // Allowed file types (matching PHP: jpg, jpeg, png, gif, pdf)
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'application/pdf'
  ];
  
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.pdf'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPG, PNG, GIF, and PDF files are allowed'), false);
  }
};

// Multer upload instance (matching PHP: 50MB limit)
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB (matching PHP: 50000000 bytes)
  }
});

module.exports = upload;