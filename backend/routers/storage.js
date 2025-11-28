const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { pool } = require('../models/database');

const router = express.Router();

// Handle raw PUT uploads (for signed URL compatibility)
router.put('/upload/:uploadId', express.raw({ 
  type: '*/*', 
  limit: '100mb' 
}), async (req, res) => {
  try {
    const { uploadId } = req.params;
    
    // Verify upload session exists and is valid
    const sessionResult = await pool.query(`
      SELECT * FROM upload_sessions 
      WHERE id = $1 AND expires_at > CURRENT_TIMESTAMP AND completed_at IS NULL
    `, [uploadId]);

    const session = sessionResult.rows[0];
    if (!session) {
      return res.status(404).json({ error: 'Upload session not found or expired' });
    }

    // Ensure uploads directory exists
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Write file to disk
    const filePath = path.join(uploadDir, uploadId);
    fs.writeFileSync(filePath, req.body);
    
    // Generate ETag
    const etag = crypto.createHash('md5').update(req.body).digest('hex');
    
    // Set CORS headers for direct upload
    res.set('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:3000');
    res.set('Access-Control-Allow-Methods', 'PUT, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Content-Length');
    res.set('Access-Control-Expose-Headers', 'ETag');
    res.set('ETag', `"${etag}"`);
    
    res.status(200).json({ success: true, etag });
  } catch (error) {
    console.error('Storage upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Handle OPTIONS requests for CORS preflight
router.options('/upload/:uploadId', (req, res) => {
  res.set('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:3000');
  res.set('Access-Control-Allow-Methods', 'PUT, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Content-Length');
  res.set('Access-Control-Max-Age', '86400');
  res.status(200).end();
});

module.exports = router;