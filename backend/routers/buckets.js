const express = require('express');
const { pool } = require('../models/database');
const { authenticateUser, authenticateApiKey } = require('../middleware/auth');

const router = express.Router();

// Middleware to handle both auth types
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.includes('rk_')) {
    return authenticateApiKey(req, res, next);
  }
  return authenticateUser(req, res, next);
};

// Helper function to generate slug from name
const generateSlug = (name) => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
};

// Get all buckets for user with stats
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        b.*,
        COALESCE(f.file_count, 0) as file_count,
        COALESCE(f.storage_used, 0) as storage_used
      FROM buckets b
      LEFT JOIN (
        SELECT 
          bucket_id,
          COUNT(*) as file_count,
          SUM(size) as storage_used
        FROM files 
        GROUP BY bucket_id
      ) f ON b.id = f.bucket_id
      WHERE b.user_id = $1 AND b.deleted_at IS NULL
      ORDER BY b.created_at DESC
    `, [req.user.userId]);
    
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch buckets' });
  }
});

// Create new bucket
router.post('/', authenticate, async (req, res) => {
  try {
    const { 
      name, 
      is_public_by_default = false, 
      versioning_enabled = false,
      allowed_types = ['*']
    } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Bucket name required' });
    }

    const slug = generateSlug(name);
    
    const result = await pool.query(`
      INSERT INTO buckets (user_id, name, slug, is_public_by_default, versioning_enabled, allowed_types) 
      VALUES ($1, $2, $3, $4, $5, $6) 
      RETURNING *
    `, [req.user.userId, name, slug, is_public_by_default, versioning_enabled, allowed_types]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Bucket name already exists' });
    }
    res.status(500).json({ error: 'Failed to create bucket' });
  }
});

// Get bucket by ID
router.get('/:bucketId', authenticate, async (req, res) => {
  try {
    const { bucketId } = req.params;
    
    const result = await pool.query(`
      SELECT 
        b.*,
        COALESCE(f.file_count, 0) as file_count,
        COALESCE(f.storage_used, 0) as storage_used
      FROM buckets b
      LEFT JOIN (
        SELECT 
          bucket_id,
          COUNT(*) as file_count,
          SUM(size) as storage_used
        FROM files 
        GROUP BY bucket_id
      ) f ON b.id = f.bucket_id
      WHERE b.id = $1 AND b.user_id = $2 AND b.deleted_at IS NULL
    `, [bucketId, req.user.userId]);

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Bucket not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch bucket' });
  }
});

// Update bucket settings
router.put('/:bucketId', authenticate, async (req, res) => {
  try {
    const { bucketId } = req.params;
    const { 
      name, 
      is_public_by_default, 
      versioning_enabled,
      allowed_types
    } = req.body;
    
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount}, slug = $${paramCount + 1}`);
      values.push(name, generateSlug(name));
      paramCount += 2;
    }
    
    if (is_public_by_default !== undefined) {
      updates.push(`is_public_by_default = $${paramCount}`);
      values.push(is_public_by_default);
      paramCount++;
    }
    
    if (versioning_enabled !== undefined) {
      updates.push(`versioning_enabled = $${paramCount}`);
      values.push(versioning_enabled);
      paramCount++;
    }
    
    if (allowed_types !== undefined) {
      updates.push(`allowed_types = $${paramCount}`);
      values.push(allowed_types);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(bucketId, req.user.userId);

    const result = await pool.query(`
      UPDATE buckets 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount} AND user_id = $${paramCount + 1} AND deleted_at IS NULL
      RETURNING *
    `, values);

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Bucket not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Bucket name already exists' });
    }
    res.status(500).json({ error: 'Failed to update bucket' });
  }
});

// Soft delete bucket
router.delete('/:bucketId', authenticate, async (req, res) => {
  try {
    const { bucketId } = req.params;
    
    const result = await pool.query(`
      UPDATE buckets 
      SET deleted_at = CURRENT_TIMESTAMP 
      WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
      RETURNING id
    `, [bucketId, req.user.userId]);

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Bucket not found' });
    }

    res.json({ message: 'Bucket deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete bucket' });
  }
});

// Get bucket stats
router.get('/:bucketId/stats', authenticate, async (req, res) => {
  try {
    const { bucketId } = req.params;
    
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_files,
        SUM(size) as total_size,
        COUNT(CASE WHEN is_public THEN 1 END) as public_files,
        COUNT(CASE WHEN NOT is_public THEN 1 END) as private_files,
        MAX(created_at) as last_upload
      FROM files 
      WHERE bucket_id = $1 AND user_id = $2
    `, [bucketId, req.user.userId]);

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch bucket stats' });
  }
});

// Check for duplicate files by hash
router.post('/:bucketId/check-duplicate', authenticate, async (req, res) => {
  try {
    const { bucketId } = req.params;
    const { hash } = req.body;
    
    if (!hash) {
      return res.status(400).json({ error: 'Hash required' });
    }

    // Verify bucket access
    const bucketResult = await pool.query(
      'SELECT id FROM buckets WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
      [bucketId, req.user.userId]
    );

    if (!bucketResult.rows[0]) {
      return res.status(404).json({ error: 'Bucket not found' });
    }

    // Check for existing files with same hash
    const duplicateResult = await pool.query(`
      SELECT id, original_name, size, created_at, is_public, version
      FROM files 
      WHERE bucket_id = $1 AND user_id = $2 AND file_hash = $3 AND deleted_at IS NULL
      ORDER BY created_at DESC
    `, [bucketId, req.user.userId, hash.toLowerCase()]);

    const duplicates = duplicateResult.rows;
    
    if (duplicates.length > 0) {
      res.json({
        isDuplicate: true,
        hash,
        existingFiles: duplicates,
        message: `Found ${duplicates.length} existing file(s) with the same content`,
        recommendation: 'Consider using the existing file or uploading with a different name'
      });
    } else {
      res.json({
        isDuplicate: false,
        hash,
        message: 'No duplicate files found'
      });
    }
  } catch (error) {
    console.error('Duplicate check error:', error);
    res.status(500).json({ error: 'Failed to check for duplicates' });
  }
});

module.exports = router;