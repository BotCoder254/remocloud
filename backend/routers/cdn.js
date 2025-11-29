const express = require('express');
const { pool, readLargeObject } = require('../models/database');
const { validateSignedUrl, setCacheHeaders } = require('../middleware/cdn');

const router = express.Router();

// Serve files via CDN with signed URL validation
router.get('/:objectKey', validateSignedUrl, setCacheHeaders, async (req, res) => {
  const client = await pool.connect();
  
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control');
    
    const objectKey = req.params.objectKey || req.cdnAuth?.objectKey;
    console.log('CDN: Looking for objectKey:', objectKey);
    
    // Check if this is a derivative first
    let derivativeResult = await client.query(
      'SELECT * FROM image_derivatives WHERE object_key = $1',
      [objectKey]
    );

    if (derivativeResult.rows.length > 0) {
      const derivative = derivativeResult.rows[0];
      
      if (!derivative.file_hash) {
        return res.status(404).json({ error: 'Derivative not found' });
      }

      const { getFileData } = require('../utils/fileStorage');
      const fileBuffer = await getFileData(client, derivative.file_hash);

      await pool.query(
        'UPDATE image_derivatives SET accessed_at = CURRENT_TIMESTAMP WHERE id = $1',
        [derivative.id]
      );

      res.setHeader('Content-Type', derivative.mime_type);
      res.setHeader('Content-Length', fileBuffer.length);
      res.setHeader('Content-Disposition', 'inline');
      res.set('Cache-Control', 'public, max-age=2592000');
      
      return res.send(fileBuffer);
    }
    
    // Find original file by object key
    const result = await client.query(
      'SELECT id, object_key, original_name, mime_type, file_hash FROM files WHERE object_key = $1 AND deleted_at IS NULL',
      [objectKey]
    );

    console.log('CDN: Query result:', result.rows.length, 'files found');
    if (result.rows.length > 0) {
      console.log('CDN: File found:', { id: result.rows[0].id, object_key: result.rows[0].object_key, file_hash: result.rows[0].file_hash });
    }

    const file = result.rows[0];
    if (!file || !file.file_hash) {
      console.log('CDN: File not found or no file_hash. File exists:', !!file, 'file_hash:', file?.file_hash);
      return res.status(404).json({ error: 'File not found' });
    }

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

  } catch (error) {
    console.error('CDN serve error:', error);
    res.status(500).json({ error: 'Failed to serve file' });
  } finally {
    client.release();
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
    console.log('CDN Public: Looking for objectKey:', objectKey);
    
    // Find public file by object key
    const result = await client.query(
      'SELECT id, object_key, original_name, mime_type, file_hash, is_public FROM files WHERE object_key = $1 AND is_public = true AND deleted_at IS NULL',
      [objectKey]
    );

    console.log('CDN Public: Query result:', result.rows.length, 'files found');
    if (result.rows.length > 0) {
      console.log('CDN Public: File found:', { id: result.rows[0].id, object_key: result.rows[0].object_key, file_hash: result.rows[0].file_hash, is_public: result.rows[0].is_public });
    }

    const file = result.rows[0];
    if (!file || !file.file_hash) {
      console.log('CDN Public: File not found or no file_hash. File exists:', !!file, 'file_hash:', file?.file_hash);
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

// Debug endpoint to check files in database
router.get('/debug/files', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, object_key, file_hash, original_name, is_public, created_at FROM files ORDER BY created_at DESC LIMIT 10'
    );
    res.json({ files: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;