const sharp = require('sharp');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;

class ImageTransform {
  constructor() {
    this.maxWidth = 2048;
    this.maxHeight = 2048;
    this.maxQuality = 100;
    this.minQuality = 1;
    this.allowedFormats = ['jpeg', 'jpg', 'png', 'webp', 'avif'];
  }

  // Validate transform parameters
  validateParams(params) {
    const errors = [];
    const { w, h, q, format } = params;

    if (w && (isNaN(w) || w < 1 || w > this.maxWidth)) {
      errors.push(`Width must be between 1 and ${this.maxWidth}`);
    }

    if (h && (isNaN(h) || h < 1 || h > this.maxHeight)) {
      errors.push(`Height must be between 1 and ${this.maxHeight}`);
    }

    if (q && (isNaN(q) || q < this.minQuality || q > this.maxQuality)) {
      errors.push(`Quality must be between ${this.minQuality} and ${this.maxQuality}`);
    }

    if (format && !this.allowedFormats.includes(format.toLowerCase())) {
      errors.push(`Format must be one of: ${this.allowedFormats.join(', ')}`);
    }

    return { isValid: errors.length === 0, errors };
  }

  // Generate transform key for caching
  generateTransformKey(params) {
    const normalized = {
      w: params.w ? parseInt(params.w) : null,
      h: params.h ? parseInt(params.h) : null,
      q: params.q ? parseInt(params.q) : null,
      format: params.format ? params.format.toLowerCase() : null
    };

    // Remove null values
    Object.keys(normalized).forEach(key => {
      if (normalized[key] === null) delete normalized[key];
    });

    const keyString = JSON.stringify(normalized);
    return crypto.createHash('md5').update(keyString).digest('hex');
  }

  // Check if file is an image
  isImage(mimeType) {
    return mimeType && mimeType.startsWith('image/');
  }

  // Get output format and mime type
  getOutputFormat(inputMimeType, requestedFormat) {
    if (requestedFormat) {
      const format = requestedFormat.toLowerCase();
      if (format === 'jpg') return { format: 'jpeg', mimeType: 'image/jpeg' };
      return { format, mimeType: `image/${format}` };
    }

    // Default to WebP for better compression
    if (inputMimeType === 'image/png') {
      return { format: 'webp', mimeType: 'image/webp' };
    }
    
    return { format: 'jpeg', mimeType: 'image/jpeg' };
  }

  // Apply transforms to image buffer
  async transformImage(inputBuffer, params) {
    const { w, h, q, format } = params;
    
    let pipeline = sharp(inputBuffer);
    
    // Get original metadata
    const metadata = await pipeline.metadata();
    
    // Apply resize if specified
    if (w || h) {
      const width = w ? parseInt(w) : null;
      const height = h ? parseInt(h) : null;
      
      pipeline = pipeline.resize(width, height, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }

    // Get output format
    const outputFormat = this.getOutputFormat(metadata.format, format);
    
    // Apply format and quality
    switch (outputFormat.format) {
      case 'jpeg':
        pipeline = pipeline.jpeg({ 
          quality: q ? parseInt(q) : 85,
          progressive: true
        });
        break;
      case 'png':
        pipeline = pipeline.png({ 
          quality: q ? parseInt(q) : 85,
          progressive: true
        });
        break;
      case 'webp':
        pipeline = pipeline.webp({ 
          quality: q ? parseInt(q) : 85
        });
        break;
      case 'avif':
        pipeline = pipeline.avif({ 
          quality: q ? parseInt(q) : 85
        });
        break;
    }

    const outputBuffer = await pipeline.toBuffer();
    const outputMetadata = await sharp(outputBuffer).metadata();

    return {
      buffer: outputBuffer,
      metadata: outputMetadata,
      mimeType: outputFormat.mimeType,
      format: outputFormat.format,
      size: outputBuffer.length
    };
  }

  // Generate derivative object key
  generateDerivativeKey(originalKey, transformKey) {
    const ext = path.extname(originalKey);
    const base = originalKey.replace(ext, '');
    return `${base}_${transformKey}${ext}`;
  }

  // Get common transform presets
  getPresets() {
    return {
      thumbnail: { w: 150, h: 150, q: 80, format: 'webp' },
      small: { w: 300, h: 300, q: 85, format: 'webp' },
      medium: { w: 600, h: 600, q: 85, format: 'webp' },
      large: { w: 1200, h: 1200, q: 90, format: 'webp' },
      'thumbnail-jpg': { w: 150, h: 150, q: 80, format: 'jpeg' },
      'small-jpg': { w: 300, h: 300, q: 85, format: 'jpeg' },
      'medium-jpg': { w: 600, h: 600, q: 85, format: 'jpeg' },
      'large-jpg': { w: 1200, h: 1200, q: 90, format: 'jpeg' }
    };
  }

  // Generate srcset for responsive images
  generateSrcSet(baseUrl, breakpoints = [300, 600, 900, 1200]) {
    return breakpoints.map(width => {
      const url = `${baseUrl}?w=${width}&format=webp`;
      return `${url} ${width}w`;
    }).join(', ');
  }
}

module.exports = new ImageTransform();