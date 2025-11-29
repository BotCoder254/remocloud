const express = require('express');
const { pool, readLargeObject, createLargeObject } = require('../models/database');
const { authenticate } = require('../middleware/auth');
const imageTransform = require('../utils/imageTransform');
const crypto = require('crypto');

const router = express.Router();

// Get transformed image
router.get('/files/:fileId/transform', authenticate, async (req, res) => {
  try {
    const { fileId } = req.params;
    const { w, h, q, format, preset } = req.query;

    // Get file info and verify user access
    const fileResult = await pool.query(`
      SELECT f.*, f.filename, f.object_key, f.mime_type, f.size, f.id as version_id
      FROM files f
      WHERE f.id = $1 AND f.user_id = $2 AND f.deleted_at IS NULL
    `, [fileId, req.user.id]);

    if (fileResult.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = fileResult.rows[0];

    // Check if file is an image
    if (!imageTransform.isImage(file.mime_type)) {
      return res.status(400).json({ error: 'File is not an image' });
    }

    // Get transform parameters (preset or individual params)
    let transformParams;
    if (preset) {
      const presets = imageTransform.getPresets();
      if (!presets[preset]) {
        return res.status(400).json({ error: 'Invalid preset' });
      }
      transformParams = presets[preset];
    } else {
      transformParams = { w, h, q, format };
    }

    // Validate parameters
    const validation = imageTransform.validateParams(transformParams);
    if (!validation.isValid) {
      return res.status(400).json({ error: validation.errors.join(', ') });
    }

    // Generate transform key
    const transformKey = imageTransform.generateTransformKey(transformParams);

    // Check if derivative already exists
    const derivativeResult = await pool.query(`
      SELECT * FROM image_derivatives 
      WHERE file_id = $1 AND transform_key = $2
    `, [file.id, transformKey]);

    let derivative;
    if (derivativeResult.rows.length > 0) {
      derivative = derivativeResult.rows[0];
      
      // Update access time
      await pool.query(`
        UPDATE image_derivatives 
        SET accessed_at = CURRENT_TIMESTAMP 
        WHERE id = $1
      `, [derivative.id]);
    } else {
      // Generate new derivative
      derivative = await generateDerivative(file, transformParams, transformKey);
    }

    // Generate signed URL for the derivative
    const signedUrl = generateSignedUrl(derivative.object_key, 'transform', 900);

    res.json({
      url: signedUrl,
      derivative: {
        id: derivative.id,
        width: derivative.width,
        height: derivative.height,
        format: derivative.format,
        size: derivative.size,
        mimeType: derivative.mime_type
      },
      expiresAt: new Date(Date.now() + 900 * 1000).toISOString(),
      transformSpec: derivative.transform_spec
    });

  } catch (error) {
    console.error('Transform error:', error);
    res.status(500).json({ error: 'Transform failed' });
  }
});

// Get transform presets
router.get('/transform/presets', (req, res) => {
  res.json(imageTransform.getPresets());
});

// Generate srcset for responsive images
router.get('/files/:fileId/srcset', authenticate, async (req, res) => {
  try {
    const { fileId } = req.params;
    const { breakpoints = '300,600,900,1200', format = 'webp' } = req.query;

    const breakpointArray = breakpoints.split(',').map(b => parseInt(b.trim()));
    
    // Get file info and verify user access
    const fileResult = await pool.query(`
      SELECT f.*, f.object_key, f.mime_type
      FROM files f
      WHERE f.id = $1 AND f.user_id = $2 AND f.deleted_at IS NULL
    `, [fileId, req.user.id]);

    if (fileResult.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = fileResult.rows[0];

    if (!imageTransform.isImage(file.mime_type)) {
      return res.status(400).json({ error: 'File is not an image' });
    }

    // Generate srcset entries
    const srcsetEntries = await Promise.all(
      breakpointArray.map(async (width) => {
        const transformParams = { w: width, format };
        const transformKey = imageTransform.generateTransformKey(transformParams);
        
        // Check if derivative exists, create if not
        let derivative = await pool.query(`
          SELECT * FROM image_derivatives 
          WHERE file_id = $1 AND transform_key = $2
        `, [file.id, transformKey]);

        if (derivative.rows.length === 0) {
          derivative = await generateDerivative(file, transformParams, transformKey);
        } else {
          derivative = derivative.rows[0];
        }

        const signedUrl = generateSignedUrl(derivative.object_key, 'transform', 900);
        
        return {
          width,
          url: signedUrl,
          descriptor: `${width}w`
        };
      })
    );

    const srcset = srcsetEntries.map(entry => `${entry.url} ${entry.descriptor}`).join(', ');

    res.json({
      srcset,
      entries: srcsetEntries,
      sizes: '(max-width: 600px) 100vw, (max-width: 900px) 50vw, 33vw'
    });

  } catch (error) {
    console.error('Srcset generation error:', error);
    res.status(500).json({ error: 'Srcset generation failed' });
  }
});

// Helper function to generate derivative using new file storage
async function generateDerivative(file, transformParams, transformKey) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Read original file from file_data table
    const { getFileData } = require('../utils/fileStorage');
    const inputBuffer = await getFileData(client, file.file_hash);

    // Apply transforms
    const result = await imageTransform.transformImage(inputBuffer, transformParams);

    // Generate hash for derivative
    const crypto = require('crypto');
    const derivativeHash = crypto.createHash('sha256').update(result.buffer).digest('hex');
    
    // Store derivative data
    const { storeFileData } = require('../utils/fileStorage');
    await storeFileData(client, result.buffer, derivativeHash);

    // Generate derivative object key
    const derivativeKey = imageTransform.generateDerivativeKey(file.filename, transformKey);

    // Store derivative metadata in database
    const derivativeResult = await client.query(`
      INSERT INTO image_derivatives (
        file_id, transform_spec, transform_key, 
        object_key, file_hash, mime_type, size, width, height, quality, format
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      file.id,
      JSON.stringify(transformParams),
      transformKey,
      derivativeKey,
      derivativeHash,
      result.mimeType,
      result.size,
      result.metadata.width,
      result.metadata.height,
      transformParams.q || 85,
      result.format
    ]);

    await client.query('COMMIT');
    return derivativeResult.rows[0];

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Derivative generation error:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Helper function to generate signed URL
function generateSignedUrl(objectKey, purpose, expiry) {
  const secret = process.env.CDN_SECRET || 'default-secret';
  const expires = Date.now() + (expiry * 1000);
  
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${objectKey}:${expires}:${purpose}`)
    .digest('hex');

  const baseUrl = process.env.API_BASE_URL || 'http://localhost:5000';
  return `${baseUrl}/cdn/${objectKey}?expires=${expires}&signature=${signature}&purpose=${purpose}`;
}

module.exports = router;