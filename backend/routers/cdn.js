const express = require('express');
const { pool, readLargeObject } = require('../models/database');
const { validateSignedUrl, setCacheHeaders } = require('../middleware/cdn');

const router = express.Router();

// Serve files via CDN with signed URL validation
router.get('/:objectKey', validateSignedUrl, setCacheHeaders, async (req, res) => {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control');
    
    const objectKey = req.params.objectKey || req.cdnAuth?.objectKey;
    
    // Check if this is a derivative first
    let derivativeResult = await pool.query(
      'SELECT * FROM image_derivatives WHERE object_key = $1',
      [objectKey]
    );

    if (derivativeResult.rows.length > 0) {
      // Serve derivative from file storage
      const derivative = derivativeResult.rows[0];
      
      if (!derivative.file_hash) {
        return res.status(404).json({ error: 'Derivative not found in database' });
      }

      const client = await pool.connect();
      try {
        // Read derivative from file_data table
        const { getFileData } = require('../utils/fileStorage');
        const fileBuffer = await getFileData(client, derivative.file_hash);

        // Update access time
        await pool.query(
          'UPDATE image_derivatives SET accessed_at = CURRENT_TIMESTAMP WHERE id = $1',
          [derivative.id]
        );

        res.setHeader('Content-Type', derivative.mime_type);
        res.setHeader('Content-Length', fileBuffer.length);
        res.setHeader('Content-Disposition', `inline`);
        res.set('Cache-Control', 'public, max-age=2592000'); // 30 days for derivatives
        
        return res.send(fileBuffer);
      } finally {
        client.release();
      }
    }
    
    // Find original file by object key
    const result = await pool.query(
      'SELECT * FROM files WHERE object_key = $1 AND deleted_at IS NULL',
      [objectKey]
    );

    const file = result.rows[0];
    if (!file || !file.file_hash) {
      return res.status(404).json({ error: 'File not found' });
    }

    const client = await pool.connect();
    try {
      // Read file from file_data table
      const { getFileData } = require('../utils/fileStorage');
      const fileBuffer = await getFileData(client, file.file_hash);

      // Set file-specific headers
      res.setHeader('Content-Type', file.mime_type);
      res.setHeader('Content-Length', fileBuffer.length);
      res.setHeader('ETag', `"${file.file_hash}"`);
      
      // Set content disposition based on purpose
      const { purpose } = req.cdnAuth;
      if (purpose === 'download') {
        res.setHeader('Content-Disposition', `attachment; filename="${file.original_name}"`);
      } else {
        res.setHeader('Content-Disposition', `inline; filename="${file.original_name}"`);
      }

      // Handle range requests for media streaming
      const range = req.headers.range;
      if (range && (file.mime_type.startsWith('video/') || file.mime_type.startsWith('audio/'))) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileBuffer.length - 1;
        const chunksize = (end - start) + 1;
        
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${fileBuffer.length}`);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Length', chunksize);
        
        const chunk = fileBuffer.slice(start, end + 1);
        res.send(chunk);
      } else {
        res.send(fileBuffer);
      }
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('CDN serve error:', error);
    res.status(500).json({ error: 'Failed to serve file' });
  }
});

// Serve public files without authentication using Large Objects
router.get('/public/:objectKey', setCacheHeaders, async (req, res) => {
  const client = await pool.connect();
  
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control');
    
    const objectKey = req.params.objectKey;
    
    // Find public file by object key
    const result = await client.query(
      'SELECT * FROM files WHERE object_key = $1 AND is_public = true AND deleted_at IS NULL',
      [objectKey]
    );

    const file = result.rows[0];
    if (!file || !file.file_hash) {
      return res.status(404).json({ error: 'Public file not found' });
    }

    // Read file from file_data table
    const { getFileData } = require('../utils/fileStorage');
    const fileBuffer = await getFileData(client, file.file_hash);

    // Set public cache headers (longer cache time)
    res.set('Cache-Control', 'public, max-age=31536000'); // 1 year
    res.setHeader('Content-Type', file.mime_type);
    res.setHeader('Content-Length', fileBuffer.length);
    res.setHeader('ETag', `"${file.file_hash}"`);
    res.setHeader('Content-Disposition', `inline; filename="${file.original_name}"`);

    res.send(fileBuffer);

  } catch (error) {
    console.error('Public CDN serve error:', error);
    res.status(500).json({ error: 'Failed to serve public file' });
  } finally {
    client.release();
  }
});

module.exports = router;