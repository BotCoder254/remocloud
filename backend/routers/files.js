const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { pool, readLargeObject, createLargeObject } = require('../models/database');
const { authenticate } = require('../middleware/auth');
const { validateFileSize } = require('../utils/fileLimits');
const analyticsService = require('../utils/analytics');

const router = express.Router();

// Get trash files (must be before /:fileId route)
router.get('/trash', authenticate, async (req, res) => {
  try {
    const { cursor, limit = 20, sortBy = 'deleted_at', sortOrder = 'DESC' } = req.query;

    let query = `
      SELECT f.id, f.original_name, f.size, f.mime_type, f.deleted_at, f.created_at,
             COALESCE(b.name, 'Unknown') as bucket_name
      FROM files f
      LEFT JOIN buckets b ON f.bucket_id = b.id
      WHERE f.user_id = $1 AND f.deleted_at IS NOT NULL
    `;
    
    let params = [req.user.id];
    let paramCount = 1;

    if (cursor) {
      paramCount++;
      const cursorCondition = sortOrder === 'DESC' ? '<' : '>';
      query += ` AND f.${sortBy} ${cursorCondition} $${paramCount}`;
      params.push(cursor);
    }

    const allowedSortFields = ['deleted_at', 'original_name', 'size'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'deleted_at';
    const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    query += ` ORDER BY f.${sortField} ${order}`;
    
    paramCount++;
    query += ` LIMIT $${paramCount}`;
    params.push(parseInt(limit) + 1);

    const result = await pool.query(query, params);
    const files = result.rows.map(file => {
      const deletedAt = new Date(file.deleted_at);
      const restoreUntil = new Date(deletedAt.getTime() + 7 * 24 * 60 * 60 * 1000);
      const expired = restoreUntil < new Date();
      
      return {
        ...file,
        restore_until: restoreUntil.toISOString(),
        expired
      };
    });

    const hasMore = files.length > parseInt(limit);
    if (hasMore) {
      files.pop();
    }

    let nextCursor = null;
    if (hasMore && files.length > 0) {
      const lastFile = files[files.length - 1];
      nextCursor = lastFile[sortField];
    }

    res.json({
      files,
      pagination: {
        hasMore,
        nextCursor,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Trash fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch trash files' });
  }
});

// Get files with pagination, filtering, and search
router.get('/', authenticate, async (req, res) => {
  try {
    const { 
      bucket_id, 
      cursor, 
      limit = 20, 
      q, 
      type, 
      minSize, 
      maxSize, 
      since,
      sortBy = 'created_at',
      sortOrder = 'DESC',
      includeDeleted = false
    } = req.query;

    let query = `
      SELECT f.*, b.name as bucket_name, u.email as created_by_email,
             CASE WHEN f.deleted_at IS NOT NULL THEN true ELSE false END as is_deleted,
             f.restore_until
      FROM files f
      LEFT JOIN buckets b ON f.bucket_id = b.id
      LEFT JOIN users u ON f.created_by = u.id
      WHERE f.user_id = $1
    `;
    
    // Filter deleted files unless explicitly requested
    if (!includeDeleted || includeDeleted === 'false') {
      query += ` AND f.deleted_at IS NULL`;
    }
    let params = [req.user.id];
    let paramCount = 1;

    // Bucket filter
    if (bucket_id) {
      paramCount++;
      query += ` AND f.bucket_id = $${paramCount}`;
      params.push(bucket_id);
    }

    // Search by filename
    if (q) {
      paramCount++;
      query += ` AND f.original_name ILIKE $${paramCount}`;
      params.push(`%${q}%`);
    }

    // Filter by file type
    if (type) {
      paramCount++;
      query += ` AND f.mime_type LIKE $${paramCount}`;
      params.push(`${type}/%`);
    }

    // Size filters
    if (minSize) {
      paramCount++;
      query += ` AND f.size >= $${paramCount}`;
      params.push(parseInt(minSize));
    }

    if (maxSize) {
      paramCount++;
      query += ` AND f.size <= $${paramCount}`;
      params.push(parseInt(maxSize));
    }

    // Date filter
    if (since) {
      paramCount++;
      query += ` AND f.created_at >= $${paramCount}`;
      params.push(since);
    }

    // Cursor pagination
    if (cursor) {
      paramCount++;
      const cursorCondition = sortOrder === 'DESC' ? '<' : '>';
      query += ` AND f.${sortBy} ${cursorCondition} $${paramCount}`;
      params.push(cursor);
    }

    // Sorting
    const allowedSortFields = ['created_at', 'original_name', 'size', 'mime_type'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    query += ` ORDER BY f.${sortField} ${order}`;

    // Limit
    paramCount++;
    query += ` LIMIT $${paramCount}`;
    params.push(parseInt(limit) + 1); // Get one extra to determine if there are more

    const result = await pool.query(query, params);
    const files = result.rows;

    // Check if there are more results
    const hasMore = files.length > parseInt(limit);
    if (hasMore) {
      files.pop(); // Remove the extra item
    }

    // Generate next cursor
    let nextCursor = null;
    if (hasMore && files.length > 0) {
      const lastFile = files[files.length - 1];
      nextCursor = lastFile[sortField];
    }

    res.json({
      files,
      pagination: {
        hasMore,
        nextCursor,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Files fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// Get files for specific bucket with enhanced metadata
router.get('/buckets/:bucketId', authenticate, async (req, res) => {
  try {
    const { bucketId } = req.params;
    const { 
      cursor, 
      limit = 20, 
      q, 
      type, 
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    // Verify bucket access
    const bucketResult = await pool.query(
      'SELECT id FROM buckets WHERE id = $1 AND user_id = $2',
      [bucketId, req.user.id]
    );

    if (!bucketResult.rows[0]) {
      return res.status(404).json({ error: 'Bucket not found' });
    }

    let query = `
      SELECT f.*, u.email as created_by_email,
             COUNT(*) OVER() as total_count
      FROM files f
      LEFT JOIN users u ON f.created_by = u.id
      WHERE f.bucket_id = $1 AND f.user_id = $2
    `;
    let params = [bucketId, req.user.id];
    let paramCount = 2;

    // Search and filters (same as above)
    if (q) {
      paramCount++;
      query += ` AND f.original_name ILIKE $${paramCount}`;
      params.push(`%${q}%`);
    }

    if (type) {
      paramCount++;
      query += ` AND f.mime_type LIKE $${paramCount}`;
      params.push(`${type}/%`);
    }

    if (cursor) {
      paramCount++;
      const cursorCondition = sortOrder === 'DESC' ? '<' : '>';
      query += ` AND f.${sortBy} ${cursorCondition} $${paramCount}`;
      params.push(cursor);
    }

    const allowedSortFields = ['created_at', 'original_name', 'size', 'mime_type'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    query += ` ORDER BY f.${sortField} ${order}`;
    
    paramCount++;
    query += ` LIMIT $${paramCount}`;
    params.push(parseInt(limit) + 1);

    const result = await pool.query(query, params);
    const files = result.rows;

    const hasMore = files.length > parseInt(limit);
    if (hasMore) {
      files.pop();
    }

    let nextCursor = null;
    if (hasMore && files.length > 0) {
      const lastFile = files[files.length - 1];
      nextCursor = lastFile[sortField];
    }

    res.json({
      files,
      pagination: {
        hasMore,
        nextCursor,
        limit: parseInt(limit),
        totalCount: files.length > 0 ? files[0].total_count : 0
      }
    });
  } catch (error) {
    console.error('Bucket files fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch bucket files' });
  }
});

// Get file details with metadata
router.get('/:fileId', authenticate, async (req, res) => {
  try {
    const { fileId } = req.params;
    
    const result = await pool.query(`
      SELECT f.*, b.name as bucket_name, u.email as created_by_email
      FROM files f
      LEFT JOIN buckets b ON f.bucket_id = b.id
      LEFT JOIN users u ON f.created_by = u.id
      WHERE f.id = $1 AND f.user_id = $2
    `, [fileId, req.user.id]);

    const file = result.rows[0];
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Get version history
    const versionsResult = await pool.query(`
      SELECT fv.*, u.email as created_by_email
      FROM file_versions fv
      LEFT JOIN users u ON fv.created_by = u.id
      WHERE fv.file_id = $1
      ORDER BY fv.version_number DESC
    `, [fileId]);

    res.json({
      ...file,
      versions: versionsResult.rows
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch file details' });
  }
});

// Update file metadata
router.put('/:fileId', authenticate, async (req, res) => {
  try {
    const { fileId } = req.params;
    const { original_name, is_public, metadata_json } = req.body;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (original_name !== undefined) {
      updates.push(`original_name = $${paramCount}`);
      values.push(original_name);
      paramCount++;
    }

    if (is_public !== undefined) {
      updates.push(`is_public = $${paramCount}`);
      values.push(is_public);
      paramCount++;
    }

    if (metadata_json !== undefined) {
      updates.push(`metadata_json = $${paramCount}`);
      values.push(JSON.stringify(metadata_json));
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(fileId, req.user.id);

    const result = await pool.query(`
      UPDATE files 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
      RETURNING *
    `, values);

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'File not found' });
    }

    const updatedFile = result.rows[0];
    
    // If file was made public, include the public URL
    if (is_public === true && updatedFile.is_public) {
      const publicUrl = `${process.env.API_BASE_URL || 'http://localhost:5000'}/cdn/public/${updatedFile.object_key}`;
      updatedFile.public_url = publicUrl;
    }

    res.json(updatedFile);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update file' });
  }
});

// Upload file (legacy endpoint - kept for compatibility) using Large Objects
router.post('/upload', authenticate, express.raw({ type: '*/*', limit: '100mb' }), async (req, res) => {
  const client = await pool.connect();
  
  try {
    if (!req.body || req.body.length === 0) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // For legacy endpoint, expect bucket_id in query params
    const { bucket_id } = req.query;
    
    if (!bucket_id) {
      return res.status(400).json({ error: 'Bucket ID required' });
    }

    await client.query('BEGIN');

    // Get bucket settings
    const bucketResult = await client.query(
      'SELECT is_public_by_default FROM buckets WHERE id = $1 AND user_id = $2',
      [bucket_id, req.user.id]
    );

    if (!bucketResult.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Bucket not found' });
    }

    const isPublic = bucketResult.rows[0].is_public_by_default;

    // Generate file hash
    const crypto = require('crypto');
    const fileHash = crypto.createHash('sha256').update(req.body).digest('hex');
    
    // Store file data in file_data table
    const { storeFileData } = require('../utils/fileStorage');
    await storeFileData(client, req.body, fileHash);
    
    // Get filename from headers or use default
    const originalName = req.headers['x-filename'] || 'uploaded-file';
    const mimeType = req.headers['content-type'] || 'application/octet-stream';
    
    // Validate file size based on media type
    const sizeValidation = validateFileSize(mimeType, req.body.length);
    if (!sizeValidation.isValid) {
      await client.query('ROLLBACK');
      return res.status(413).json({ 
        error: `File too large. Maximum size for ${mimeType} is ${Math.round(sizeValidation.limit / 1024 / 1024)}MB`,
        maxSize: sizeValidation.limit,
        receivedSize: req.body.length
      });
    }
    
    const result = await client.query(`
      INSERT INTO files 
      (bucket_id, user_id, filename, original_name, mime_type, size, object_key, file_hash, is_public, created_by) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
      RETURNING *
    `, [
      bucket_id,
      req.user.id,
      `${fileHash}-${originalName}`,
      originalName,
      mimeType,
      req.body.length,
      `users/${req.user.id}/buckets/${bucket_id}/${Date.now()}-${originalName}`,
      fileHash,
      isPublic,
      req.user.id
    ]);

    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  } finally {
    client.release();
  }
});

// Get signed URL for file download/preview
router.post('/:fileId/signed-url', authenticate, async (req, res) => {
  try {
    const { fileId } = req.params;
    const { expiry = 900, purpose = 'download' } = req.body; // 15 minutes default
    
    const result = await pool.query(`
      SELECT f.*, b.is_public_by_default
      FROM files f
      JOIN buckets b ON f.bucket_id = b.id
      WHERE f.id = $1 AND f.user_id = $2
    `, [fileId, req.user.id]);

    const file = result.rows[0];
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // For public files, return CDN URL directly
    if (file.is_public) {
      const cdnUrl = `${process.env.API_BASE_URL || 'http://localhost:5000'}/cdn/public/${file.object_key}`;
      return res.json({
        url: cdnUrl,
        expiresAt: null, // Public URLs don't expire
        isPublic: true,
        cacheHeaders: {
          'Cache-Control': 'public, max-age=31536000', // 1 year for public files
          'ETag': `"${file.file_hash}"`
        }
      });
    }

    // For private files, generate signed URL
    const expiresAt = new Date(Date.now() + expiry * 1000);
    const signature = require('crypto')
      .createHmac('sha256', process.env.CDN_SECRET || 'default-secret')
      .update(`${file.object_key}:${expiresAt.getTime()}:${purpose}`)
      .digest('hex');

    const signedUrl = `${process.env.API_BASE_URL || 'http://localhost:5000'}/cdn/${file.object_key}?expires=${expiresAt.getTime()}&signature=${signature}&purpose=${purpose}`;

    console.log('Generated signed URL:', signedUrl);
    console.log('File object_key:', file.object_key);
    console.log('File file_hash:', file.file_hash);

    // Determine cache headers based on versioning
    const cacheHeaders = file.version > 1 
      ? { 'Cache-Control': 'private, max-age=86400' } // 24 hours for versioned files
      : { 'Cache-Control': 'private, max-age=900' };   // 15 minutes for current files

    // Track download analytics
    await analyticsService.trackDownload(req.user.id, file.bucket_id, file.size);

    res.json({
      url: signedUrl,
      expiresAt: expiresAt.toISOString(),
      isPublic: false,
      cacheHeaders
    });
  } catch (error) {
    console.error('Signed URL generation error:', error);
    res.status(500).json({ error: 'Failed to generate signed URL' });
  }
});

// Simple preview endpoint for images using file_data table
router.get('/:fileId/preview', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { fileId } = req.params;
    
    // Get token from query or header for image requests
    const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Verify token
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const result = await client.query(
      'SELECT * FROM files WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
      [fileId, decoded.userId]
    );

    const file = result.rows[0];
    if (!file || !file.file_hash) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Read file from file_data table
    const { getFileData } = require('../utils/fileStorage');
    const fileBuffer = await getFileData(client, file.file_hash);

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Content-Type', file.mime_type);
    res.setHeader('Content-Disposition', `inline; filename="${file.original_name}"`);
    res.setHeader('Content-Length', fileBuffer.length);
    res.setHeader('Cache-Control', 'private, max-age=300');
    
    res.send(fileBuffer);
  } catch (error) {
    console.error('Preview error:', error);
    res.status(500).json({ error: 'Failed to serve preview' });
  } finally {
    client.release();
  }
});

// Debug endpoint to list all files for user
router.get('/debug/list', async (req, res) => {
  try {
    const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const result = await pool.query(
      'SELECT id, filename, original_name, size, mime_type, created_at FROM files WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10',
      [decoded.userId]
    );

    res.json({ files: result.rows, userId: decoded.userId });
  } catch (error) {
    console.error('Debug list error:', error);
    res.status(500).json({ error: 'Failed to list files' });
  }
});

// Direct download endpoint using file_data table
router.get('/:fileId/download', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { fileId } = req.params;
    
    // Get token from query or header
    const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Verify token
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const result = await client.query(
      'SELECT * FROM files WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
      [fileId, decoded.userId]
    );

    const file = result.rows[0];
    if (!file || !file.file_hash) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Read file from file_data table
    const { getFileData } = require('../utils/fileStorage');
    const fileBuffer = await getFileData(client, file.file_hash);

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.setHeader('Content-Disposition', `attachment; filename="${file.original_name}"`);
    res.setHeader('Content-Type', file.mime_type);
    res.setHeader('Content-Length', fileBuffer.length);
    
    res.send(fileBuffer);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Failed to download file' });
  } finally {
    client.release();
  }
});

// Move file to trash (soft delete with 7-day restore period)
router.delete('/:fileId', authenticate, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { fileId } = req.params;
    const { permanent = false } = req.query;
    
    // Get file info
    const fileResult = await client.query(
      'SELECT * FROM files WHERE id = $1 AND user_id = $2',
      [fileId, req.user.id]
    );

    const file = fileResult.rows[0];
    if (!file) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'File not found' });
    }

    if (permanent || file.deleted_at) {
      // Permanent delete - cleanup file data
      const derivativesResult = await client.query(
        'SELECT file_hash FROM image_derivatives WHERE file_id = $1',
        [fileId]
      );

      const { deleteFileData } = require('../utils/fileStorage');
      for (const derivative of derivativesResult.rows) {
        if (derivative.file_hash) {
          await deleteFileData(client, derivative.file_hash);
        }
      }

      if (file.file_hash) {
        await deleteFileData(client, file.file_hash);
      }

      const versionsResult = await client.query(
        'SELECT file_hash FROM file_versions WHERE file_id = $1',
        [fileId]
      );
      
      for (const version of versionsResult.rows) {
        if (version.file_hash) {
          await deleteFileData(client, version.file_hash);
        }
      }

      // Delete from database
      await client.query('DELETE FROM files WHERE id = $1', [fileId]);
      
      res.json({ message: 'File permanently deleted' });
    } else {
      // Soft delete - move to trash with 7-day restore period
      await client.query(
        'UPDATE files SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1',
        [fileId]
      );

      // Update bucket stats
      await client.query(
        'UPDATE buckets SET file_count = file_count - 1, storage_used = storage_used - $1 WHERE id = $2',
        [file.size, file.bucket_id]
      );

      res.json({ 
        message: 'File moved to trash. Can be restored within 7 days.'
      });
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  } finally {
    client.release();
  }
});

// Get public CDN URL for public files
router.get('/:fileId/public-url', async (req, res) => {
  try {
    const { fileId } = req.params;
    
    const result = await pool.query(
      'SELECT f.*, b.is_public_by_default FROM files f JOIN buckets b ON f.bucket_id = b.id WHERE f.id = $1 AND f.is_public = true AND f.deleted_at IS NULL',
      [fileId]
    );

    const file = result.rows[0];
    if (!file) {
      return res.status(404).json({ error: 'Public file not found' });
    }

    const cdnUrl = `${process.env.API_BASE_URL || 'http://localhost:5000'}/cdn/public/${file.object_key}`;
    
    res.json({
      url: cdnUrl,
      isPublic: true,
      cacheHeaders: {
        'Cache-Control': 'public, max-age=31536000',
        'ETag': `"${file.file_hash}"`
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get public URL' });
  }
});



// Restore deleted file
router.post('/:fileId/restore', authenticate, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { fileId } = req.params;
    
    const result = await client.query(`
      UPDATE files 
      SET deleted_at = NULL
      WHERE id = $1 AND user_id = $2 AND deleted_at IS NOT NULL 
        AND deleted_at > (CURRENT_TIMESTAMP - INTERVAL '7 days')
      RETURNING *
    `, [fileId, req.user.id]);

    if (!result.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'File not found or restore period expired' });
    }

    const file = result.rows[0];
    
    // Update bucket stats
    await client.query(
      'UPDATE buckets SET file_count = file_count + 1, storage_used = storage_used + $1 WHERE id = $2',
      [file.size, file.bucket_id]
    );

    await client.query('COMMIT');
    
    res.json({ 
      message: 'File restored successfully',
      file
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Restore error:', error);
    res.status(500).json({ error: 'Failed to restore file' });
  } finally {
    client.release();
  }
});

// Get file versions
router.get('/:fileId/versions', authenticate, async (req, res) => {
  try {
    const { fileId } = req.params;
    
    // Verify file access
    const fileResult = await pool.query(
      'SELECT id FROM files WHERE id = $1 AND user_id = $2',
      [fileId, req.user.id]
    );

    if (!fileResult.rows[0]) {
      return res.status(404).json({ error: 'File not found' });
    }

    const versionsResult = await pool.query(`
      SELECT fv.*, u.email as created_by_email,
             CASE WHEN fv.id = f.current_version_id THEN true ELSE false END as is_current
      FROM file_versions fv
      LEFT JOIN users u ON fv.created_by = u.id
      LEFT JOIN files f ON f.id = fv.file_id
      WHERE fv.file_id = $1
      ORDER BY fv.version_number DESC
    `, [fileId]);

    res.json({
      fileId,
      versions: versionsResult.rows
    });
  } catch (error) {
    console.error('Get versions error:', error);
    res.status(500).json({ error: 'Failed to fetch file versions' });
  }
});

// Restore file version
router.post('/:fileId/versions/:versionId/restore', authenticate, async (req, res) => {
  try {
    const { fileId, versionId } = req.params;
    
    // Verify file access
    const fileResult = await pool.query(
      'SELECT * FROM files WHERE id = $1 AND user_id = $2',
      [fileId, req.user.id]
    );

    if (!fileResult.rows[0]) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Get version to restore
    const versionResult = await pool.query(
      'SELECT * FROM file_versions WHERE id = $1 AND file_id = $2',
      [versionId, fileId]
    );

    if (!versionResult.rows[0]) {
      return res.status(404).json({ error: 'Version not found' });
    }

    const version = versionResult.rows[0];
    
    // Get next version number
    const nextVersionResult = await pool.query(
      'SELECT COALESCE(MAX(version_number), 0) + 1 as next_version FROM file_versions WHERE file_id = $1',
      [fileId]
    );
    const nextVersion = nextVersionResult.rows[0].next_version;

    // Create new version from restored version
    const newVersionResult = await pool.query(`
      INSERT INTO file_versions 
      (file_id, version_number, filename, original_name, mime_type, size, object_key, file_hash, metadata_json, created_by, restored_from_version)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      fileId,
      nextVersion,
      version.filename,
      version.original_name,
      version.mime_type,
      version.size,
      version.object_key,
      version.file_hash,
      version.metadata_json,
      req.user.id,
      version.version_number
    ]);

    const newVersion = newVersionResult.rows[0];

    // Update file to point to new version
    await pool.query(`
      UPDATE files 
      SET current_version_id = $1,
          version = $2,
          filename = $3,
          original_name = $4,
          mime_type = $5,
          size = $6,
          object_key = $7,
          file_hash = $8,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $9
    `, [
      newVersion.id,
      nextVersion,
      version.filename,
      version.original_name,
      version.mime_type,
      version.size,
      version.object_key,
      version.file_hash,
      fileId
    ]);

    // Update is_current flags
    await pool.query('UPDATE file_versions SET is_current = false WHERE file_id = $1', [fileId]);
    await pool.query('UPDATE file_versions SET is_current = true WHERE id = $1', [newVersion.id]);

    res.json({
      message: 'Version restored successfully',
      restoredVersion: nextVersion,
      fromVersion: version.version_number
    });
  } catch (error) {
    console.error('Restore version error:', error);
    res.status(500).json({ error: 'Failed to restore version' });
  }
});

// Get file hash
router.get('/:fileId/hash', authenticate, async (req, res) => {
  try {
    const { fileId } = req.params;
    
    const result = await pool.query(
      'SELECT file_hash, original_name, size FROM files WHERE id = $1 AND user_id = $2',
      [fileId, req.user.id]
    );

    const file = result.rows[0];
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.json({
      fileId,
      hash: file.file_hash,
      algorithm: 'SHA-256',
      filename: file.original_name,
      size: file.size
    });
  } catch (error) {
    console.error('Get hash error:', error);
    res.status(500).json({ error: 'Failed to get file hash' });
  }
});

// Verify file integrity using file_data table
router.post('/:fileId/verify', authenticate, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { fileId } = req.params;
    const { clientHash } = req.body;
    
    const result = await client.query(
      'SELECT file_hash, original_name FROM files WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
      [fileId, req.user.id]
    );

    const file = result.rows[0];
    if (!file || !file.file_hash) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Re-compute server-side hash from file_data table
    const { getFileData } = require('../utils/fileStorage');
    const fileBuffer = await getFileData(client, file.file_hash);
    const computedHash = require('crypto')
      .createHash('sha256')
      .update(fileBuffer)
      .digest('hex');

    const storedHashMatches = file.file_hash === computedHash;
    const clientHashMatches = clientHash ? clientHash.toLowerCase() === computedHash.toLowerCase() : null;

    res.json({
      fileId,
      filename: file.original_name,
      storedHash: file.file_hash,
      computedHash,
      clientHash,
      integrity: {
        storedHashValid: storedHashMatches,
        clientHashValid: clientHashMatches,
        overall: storedHashMatches && (clientHashMatches !== false)
      },
      verifiedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Verify integrity error:', error);
    res.status(500).json({ error: 'Failed to verify file integrity' });
  } finally {
    client.release();
  }
});

module.exports = router;