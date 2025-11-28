const crypto = require('crypto');

// Validate CDN signed URLs
const validateSignedUrl = (req, res, next) => {
  try {
    const { expires, signature, purpose } = req.query;
    const objectKey = req.params.objectKey || req.path.substring(1);

    if (!expires || !signature) {
      return res.status(401).json({ error: 'Missing signature or expiry' });
    }

    // Check if URL has expired
    const expiryTime = parseInt(expires);
    if (Date.now() > expiryTime) {
      return res.status(401).json({ error: 'URL has expired' });
    }

    // Validate signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.CDN_SECRET || 'default-secret')
      .update(`${objectKey}:${expiryTime}:${purpose || 'download'}`)
      .digest('hex');

    if (signature !== expectedSignature) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Add validated data to request
    req.cdnAuth = {
      objectKey,
      purpose: purpose || 'download',
      expiresAt: new Date(expiryTime)
    };

    next();
  } catch (error) {
    console.error('CDN validation error:', error);
    res.status(500).json({ error: 'CDN validation failed' });
  }
};

// Generate CDN cache headers
const setCacheHeaders = (req, res, next) => {
  const { purpose } = req.cdnAuth || {};
  
  // Set appropriate cache headers based on purpose
  switch (purpose) {
    case 'preview':
      res.set('Cache-Control', 'private, max-age=300'); // 5 minutes
      break;
    case 'stream':
      res.set('Cache-Control', 'private, max-age=1800'); // 30 minutes
      break;
    case 'download':
    default:
      res.set('Cache-Control', 'private, max-age=900'); // 15 minutes
      break;
  }

  // Security headers
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  
  next();
};

module.exports = {
  validateSignedUrl,
  setCacheHeaders
};