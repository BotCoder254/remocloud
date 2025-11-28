const express = require('express');
const path = require('path');
const fs = require('fs');
const { pool } = require('../models/database');
const { validateSignedUrl, setCacheHeaders } = require('../middleware/cdn');

const router = express.Router();

// Serve files via CDN with signed URL validation
router.get('/:objectKey', validateSignedUrl, setCacheHeaders, async (req, res) => {
  try {
    const objectKey = req.params.objectKey || req.cdnAuth?.objectKey;
    
    // Check if this is a derivative first
    let derivativeResult = await pool.query(
      'SELECT * FROM image_derivatives WHERE object_key = $1',
      [objectKey]
    );

    if (derivativeResult.rows.length > 0) {
      // Serve derivative
      const derivative = derivativeResult.rows[0];
      const filePath = path.join(__dirname, '../uploads', derivative.object_key);
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Derivative not found on disk' });
      }

      // Update access time
      await pool.query(
        'UPDATE image_derivatives SET accessed_at = CURRENT_TIMESTAMP WHERE id = $1',
        [derivative.id]
      );

      res.setHeader('Content-Type', derivative.mime_type);
      res.setHeader('Content-Length', derivative.size);
      res.setHeader('Content-Disposition', `inline`);
      res.set('Cache-Control', 'public, max-age=2592000'); // 30 days for derivatives
      
      const fileStream = fs.createReadStream(filePath);
      return fileStream.pipe(res);
    }
    
    // Find original file by object key
    const result = await pool.query(
      'SELECT * FROM files WHERE object_key = $1',
      [objectKey]
    );

    const file = result.rows[0];
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Construct file path
    const filePath = path.join(__dirname, '../uploads', file.filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    // Set file-specific headers
    res.setHeader('Content-Type', file.mime_type);
    res.setHeader('Content-Length', file.size);
    res.setHeader('ETag', `"${file.file_hash}"`);
    
    // Set content disposition based on purpose
    const { purpose } = req.cdnAuth;
    if (purpose === 'download') {
      res.setHeader('Content-Disposition', `attachment; filename="${file.original_name}"`);
    } else {
      res.setHeader('Content-Disposition', `inline; filename="${file.original_name}"`);
    }

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    
    // Handle range requests for media streaming
    const range = req.headers.range;
    if (range && (file.mime_type.startsWith('video/') || file.mime_type.startsWith('audio/'))) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : file.size - 1;
      const chunksize = (end - start) + 1;
      
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${file.size}`);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Length', chunksize);
      
      const stream = fs.createReadStream(filePath, { start, end });
      stream.pipe(res);
    } else {
      fileStream.pipe(res);
    }

  } catch (error) {
    console.error('CDN serve error:', error);
    res.status(500).json({ error: 'Failed to serve file' });
  }
});

// Serve public files without authentication
router.get('/public/:objectKey', setCacheHeaders, async (req, res) => {
  try {
    const objectKey = req.params.objectKey;
    
    // Find public file by object key
    const result = await pool.query(
      'SELECT * FROM files WHERE object_key = $1 AND is_public = true',
      [objectKey]
    );

    const file = result.rows[0];
    if (!file) {
      return res.status(404).json({ error: 'Public file not found' });
    }

    const filePath = path.join(__dirname, '../uploads', file.filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    // Set public cache headers (longer cache time)
    res.set('Cache-Control', 'public, max-age=31536000'); // 1 year
    res.setHeader('Content-Type', file.mime_type);
    res.setHeader('Content-Length', file.size);
    res.setHeader('ETag', `"${file.file_hash}"`);
    res.setHeader('Content-Disposition', `inline; filename="${file.original_name}"`);

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

  } catch (error) {
    console.error('Public CDN serve error:', error);
    res.status(500).json({ error: 'Failed to serve public file' });
  }
});

module.exports = router;