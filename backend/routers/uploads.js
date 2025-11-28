const express = require('express');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../models/database');
const { authenticate } = require('../middleware/auth');
const FileValidationService = require('../utils/fileValidation');
const analyticsService = require('../utils/analytics');
const { createError, asyncHandler } = require('../utils/errors');

const router = express.Router();

// Generate signed URL for direct upload
router.post('/buckets/:bucketId/uploads', authenticate, asyncHandler(async (req, res) => {
  const { bucketId } = req.params;
  const { 
    filename, 
    size, 
    contentType, 
    checksum 
  } = req.body;

  if (!filename || !size || !contentType) {
    throw createError('INVALID_REQUEST', {
      missingFields: ['filename', 'size', 'contentType'].filter(field => !req.body[field])
    }, 'Missing required fields');
  }

  // Validate file size (100MB limit for MVP)
  if (size > 100 * 1024 * 1024) {
    throw createError('FILE_TOO_LARGE', {
      maxSize: 100 * 1024 * 1024,
      receivedSize: size
    });
  }

    // Get bucket and validate permissions
    const bucketResult = await pool.query(`
      SELECT * FROM buckets 
      WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
    `, [bucketId, req.user.id]);

  const bucket = bucketResult.rows[0];
  if (!bucket) {
    throw createError('BUCKET_NOT_FOUND', { bucketId });
  }

    // Validate file type against bucket policy
    const allowedTypes = bucket.allowed_types || ['*'];
    const typeValidation = FileValidationService.validateFileType(filename, contentType, allowedTypes);
    
  if (!typeValidation.isValid) {
    const errorInfo = FileValidationService.formatValidationError(typeValidation, allowedTypes);
    throw createError('INVALID_FILE_TYPE', {
      allowedTypes: errorInfo.allowedTypes,
      suggestion: errorInfo.suggestion,
      validationErrors: typeValidation.errors,
      receivedType: contentType
    }, errorInfo.message);
  }

    // Generate object key
    const timestamp = Date.now();
    const randomId = uuidv4().split('-')[0];
    let objectKey = `users/${req.user.id}/buckets/${bucket.slug}/${timestamp}-${randomId}-${filename}`;
    
    // Add version if versioning enabled
    if (bucket.versioning_enabled) {
      const versionId = uuidv4().split('-')[0];
      objectKey += `?versionId=${versionId}`;
    }

    // Generate upload session ID
    const uploadId = uuidv4();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    
    // For MVP, we'll create a mock signed URL that points to our server
    // In production, this would be a real signed URL from AWS S3, Google Cloud Storage, etc.
    const signedUrl = `${process.env.API_BASE_URL || 'http://localhost:5000'}/api/storage/upload/${uploadId}`;

    // Store upload session
    await pool.query(`
      INSERT INTO upload_sessions 
      (id, bucket_id, user_id, filename, original_name, mime_type, size, object_key, signed_url, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      uploadId,
      bucketId,
      req.user.id,
      filename,
      filename,
      contentType,
      size,
      objectKey,
      signedUrl,
      expiresAt
    ]);

  res.json({
    uploadId,
    signedUrl,
    objectKey,
    expiresAt: expiresAt.toISOString(),
    headersToInclude: {
      'Content-Type': contentType,
      'Content-Length': size.toString()
    }
  });
}));

// Complete upload and finalize file metadata
router.post('/uploads/:uploadId/complete', authenticate, asyncHandler(async (req, res) => {
  const { uploadId } = req.params;
  const { etag, actualSize, clientHash } = req.body;

  // Get upload session
  const sessionResult = await pool.query(`
    SELECT us.*, b.is_public_by_default, b.versioning_enabled
    FROM upload_sessions us
    JOIN buckets b ON us.bucket_id = b.id
    WHERE us.id = $1 AND us.user_id = $2 AND us.completed_at IS NULL
  `, [uploadId, req.user.id]);

  const session = sessionResult.rows[0];
  if (!session) {
    throw createError('UPLOAD_SESSION_NOT_FOUND', { uploadId });
  }

  // Check if upload session expired
  if (new Date() > new Date(session.expires_at)) {
    throw createError('SIGNED_URL_EXPIRED', { uploadId, expiresAt: session.expires_at });
  }

  // Verify file exists on disk
  const filePath = require('path').join(__dirname, '../uploads', uploadId);
  if (!require('fs').existsSync(filePath)) {
    throw createError('UPLOAD_FAILED', {
      uploadId,
      reason: 'File not found on server'
    }, 'Upload failed - file not received');
  }

    // Get actual file size and validate
    const fileStats = require('fs').statSync(filePath);
    const actualFileSize = fileStats.size;
    
  if (actualSize && actualSize !== actualFileSize) {
    throw createError('UPLOAD_FAILED', {
      expectedSize: actualSize,
      actualSize: actualFileSize,
      uploadId
    }, 'File size mismatch');
  }

    // Generate file hash from actual file content
    const fileBuffer = require('fs').readFileSync(filePath);
    const fileHash = crypto
      .createHash('sha256')
      .update(fileBuffer)
      .digest('hex');
    
    // Verify client hash if provided
    let hashVerification = null;
    if (clientHash) {
      hashVerification = {
        clientHash: clientHash.toLowerCase(),
        serverHash: fileHash,
        matches: clientHash.toLowerCase() === fileHash
      };
      
      if (!hashVerification.matches) {
        console.warn(`Hash mismatch for upload ${uploadId}: client=${clientHash}, server=${fileHash}`);
      }
    }

    // Check for existing file with same name for versioning
    let version = 1;
    let existingFileId = null;
    
    if (session.versioning_enabled) {
      const existingResult = await pool.query(`
        SELECT id, version FROM files 
        WHERE bucket_id = $1 AND original_name = $2 AND deleted_at IS NULL
        ORDER BY version DESC LIMIT 1
      `, [session.bucket_id, session.original_name]);
      
      if (existingResult.rows[0]) {
        existingFileId = existingResult.rows[0].id;
        version = existingResult.rows[0].version + 1;
      }
    }

    // Validate uploaded file signature
    const fileValidation = FileValidationService.validateUploadedFile(
      filePath, 
      session.original_name, 
      session.mime_type, 
      session.versioning_enabled ? ['*'] : (await pool.query('SELECT allowed_types FROM buckets WHERE id = $1', [session.bucket_id])).rows[0]?.allowed_types || ['*']
    );
    
    if (!fileValidation.isValid) {
      // Delete the invalid file
      require('fs').unlinkSync(filePath);
      
      const errorInfo = FileValidationService.formatValidationError(fileValidation, session.allowed_types || ['*']);
      return res.status(400).json({
        error: errorInfo.message,
        allowedTypes: errorInfo.allowedTypes,
        suggestion: errorInfo.suggestion,
        validationErrors: fileValidation.errors,
        fileInfo: fileValidation.fileInfo
      });
    }

    // Move file to final location with proper filename
    const finalPath = require('path').join(__dirname, '../uploads', `${fileHash}-${session.original_name}`);
    require('fs').renameSync(filePath, finalPath);

    let fileResult;
    
    if (existingFileId && version > 1) {
      // Update existing file for new version
      fileResult = await pool.query(`
        UPDATE files 
        SET filename = $1, mime_type = $2, size = $3, object_key = $4, file_hash = $5, 
            version = $6, updated_at = CURRENT_TIMESTAMP
        WHERE id = $7
        RETURNING *
      `, [
        `${fileHash}-${session.original_name}`,
        session.mime_type,
        actualFileSize,
        session.object_key,
        fileHash,
        version,
        existingFileId
      ]);
      
      // Create version history record
      await pool.query(`
        INSERT INTO file_versions 
        (file_id, version_number, filename, original_name, mime_type, size, object_key, file_hash, metadata_json, created_by, is_current)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
      `, [
        existingFileId,
        version,
        `${fileHash}-${session.original_name}`,
        session.original_name,
        session.mime_type,
        actualFileSize,
        session.object_key,
        fileHash,
        '{}',
        session.user_id
      ]);
      
      // Mark previous versions as not current
      await pool.query(`
        UPDATE file_versions 
        SET is_current = false 
        WHERE file_id = $1 AND version_number < $2
      `, [existingFileId, version]);
      
    } else {
      // Create new file record
      fileResult = await pool.query(`
        INSERT INTO files 
        (bucket_id, user_id, upload_session_id, filename, original_name, mime_type, size, object_key, file_hash, is_public, version, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `, [
        session.bucket_id,
        session.user_id,
        uploadId,
        `${fileHash}-${session.original_name}`,
        session.original_name,
        session.mime_type,
        actualFileSize,
        session.object_key,
        fileHash,
        session.is_public_by_default,
        version,
        session.user_id
      ]);
      
      // Create initial version record
      await pool.query(`
        INSERT INTO file_versions 
        (file_id, version_number, filename, original_name, mime_type, size, object_key, file_hash, metadata_json, created_by, is_current)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
      `, [
        fileResult.rows[0].id,
        version,
        `${fileHash}-${session.original_name}`,
        session.original_name,
        session.mime_type,
        actualFileSize,
        session.object_key,
        fileHash,
        '{}',
        session.user_id
      ]);
    }

    // Mark upload session as completed
    await pool.query(`
      UPDATE upload_sessions 
      SET completed_at = CURRENT_TIMESTAMP 
      WHERE id = $1
    `, [uploadId]);

    // Update bucket stats
    await pool.query(`
      UPDATE buckets 
      SET file_count = file_count + 1, storage_used = storage_used + $1
      WHERE id = $2
    `, [actualFileSize, session.bucket_id]);

    // Track analytics
    await analyticsService.trackUpload(session.user_id, session.bucket_id, actualFileSize);

  res.json({
    file: fileResult.rows[0],
    hashVerification,
    message: 'Upload completed successfully'
  });
}));

// Get upload progress/status
router.get('/uploads/:uploadId', authenticate, asyncHandler(async (req, res) => {
  const { uploadId } = req.params;
  
  const result = await pool.query(`
    SELECT us.*, f.id as file_id
    FROM upload_sessions us
    LEFT JOIN files f ON us.id = f.upload_session_id
    WHERE us.id = $1 AND us.user_id = $2
  `, [uploadId, req.user.id]);

  const session = result.rows[0];
  if (!session) {
    throw createError('UPLOAD_SESSION_NOT_FOUND', { uploadId });
  }

    const status = session.completed_at ? 'completed' : 
                  new Date() > new Date(session.expires_at) ? 'expired' : 'pending';

  res.json({
    uploadId: session.id,
    status,
    filename: session.original_name,
    size: session.size,
    expiresAt: session.expires_at,
    completedAt: session.completed_at,
    fileId: session.file_id
  });
}));

// Cancel upload session
router.delete('/uploads/:uploadId', authenticate, asyncHandler(async (req, res) => {
  const { uploadId } = req.params;
  
  const result = await pool.query(`
    DELETE FROM upload_sessions 
    WHERE id = $1 AND user_id = $2 AND completed_at IS NULL
    RETURNING id
  `, [uploadId, req.user.id]);

  if (!result.rows[0]) {
    throw createError('UPLOAD_SESSION_NOT_FOUND', { uploadId });
  }

  res.json({ message: 'Upload session cancelled' });
}));

module.exports = router;