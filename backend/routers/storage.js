const express = require('express');
const crypto = require('crypto');
const { pool, createLargeObject } = require('../models/database');
const { validateFileSize } = require('../utils/fileLimits');

const router = express.Router();

// Handle raw PUT uploads using PostgreSQL Large Objects
router.put('/upload/:uploadId', express.raw({ 
  type: '*/*', 
  limit: '100mb' 
}), async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { uploadId } = req.params;
    
    await client.query('BEGIN');
    
    // Verify upload session exists and is valid
    const sessionResult = await client.query(`
      SELECT * FROM upload_sessions 
      WHERE id = $1 AND expires_at > CURRENT_TIMESTAMP AND completed_at IS NULL
    `, [uploadId]);

    const session = sessionResult.rows[0];
    if (!session) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Upload session not found or expired' });
    }

    // Validate file size based on session mime type
    const sizeValidation = validateFileSize(session.mime_type, req.body.length);
    if (!sizeValidation.isValid) {
      await client.query('ROLLBACK');
      return res.status(413).json({ 
        error: `File too large. Maximum size for ${session.mime_type} is ${Math.round(sizeValidation.limit / 1024 / 1024)}MB`,
        maxSize: sizeValidation.limit,
        receivedSize: req.body.length
      });
    }

    // Store file data as base64 in session metadata
    const fileData = req.body.toString('base64');
    console.log('Storing file data, size:', req.body.length, 'base64 length:', fileData.length);
    
    // Store file data in upload session for completion
    const updateResult = await client.query(`
      UPDATE upload_sessions 
      SET metadata_json = jsonb_set(COALESCE(metadata_json, '{}'), '{file_data}', $1::text::jsonb)
      WHERE id = $2
      RETURNING metadata_json
    `, [JSON.stringify(fileData), uploadId]);
    
    console.log('File data stored in session:', uploadId, 'Updated metadata:', updateResult.rows[0]?.metadata_json);
    
    await client.query('COMMIT');
    
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
    await client.query('ROLLBACK');
    console.error('Storage upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  } finally {
    client.release();
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