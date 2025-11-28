import api from './api';

class TransformService {
  // Get transformed image URL
  async getTransformedUrl(fileId, options = {}) {
    const { w, h, q, format, preset } = options;
    
    const params = new URLSearchParams();
    if (preset) {
      params.append('preset', preset);
    } else {
      if (w) params.append('w', w);
      if (h) params.append('h', h);
      if (q) params.append('q', q);
      if (format) params.append('format', format);
    }

    const response = await api.get(`/files/${fileId}/transform?${params}`);
    return response.data;
  }

  // Get srcset for responsive images
  async getSrcSet(fileId, options = {}) {
    const { breakpoints = '300,600,900,1200', format = 'webp' } = options;
    
    const params = new URLSearchParams();
    params.append('breakpoints', breakpoints);
    params.append('format', format);

    const response = await api.get(`/files/${fileId}/srcset?${params}`);
    return response.data;
  }

  // Get available presets
  async getPresets() {
    const response = await api.get('/transform/presets');
    return response.data;
  }

  // Generate transform URL with parameters
  generateTransformUrl(fileId, params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        searchParams.append(key, value);
      }
    });
    
    return `/api/files/${fileId}/transform?${searchParams}`;
  }

  // Get common presets for UI
  getCommonPresets() {
    return {
      thumbnail: { w: 150, h: 150, q: 80, format: 'webp', label: 'Thumbnail' },
      small: { w: 300, h: 300, q: 85, format: 'webp', label: 'Small' },
      medium: { w: 600, h: 600, q: 85, format: 'webp', label: 'Medium' },
      large: { w: 1200, h: 1200, q: 90, format: 'webp', label: 'Large' },
      'thumbnail-jpg': { w: 150, h: 150, q: 80, format: 'jpeg', label: 'Thumbnail (JPG)' },
      'small-jpg': { w: 300, h: 300, q: 85, format: 'jpeg', label: 'Small (JPG)' },
      'medium-jpg': { w: 600, h: 600, q: 85, format: 'jpeg', label: 'Medium (JPG)' },
      'large-jpg': { w: 1200, h: 1200, q: 90, format: 'jpeg', label: 'Large (JPG)' }
    };
  }

  // Check if file is an image
  isImage(mimeType) {
    return mimeType && mimeType.startsWith('image/');
  }

  // Get responsive image sizes attribute
  getResponsiveSizes() {
    return '(max-width: 600px) 100vw, (max-width: 900px) 50vw, 33vw';
  }

  // Generate srcset string from breakpoints
  generateSrcSetString(fileId, breakpoints = [300, 600, 900, 1200], format = 'webp') {
    return breakpoints.map(width => {
      const url = this.generateTransformUrl(fileId, { w: width, format });
      return `${url} ${width}w`;
    }).join(', ');
  }

  // Validate transform parameters
  validateParams(params) {
    const errors = [];
    const { w, h, q, format } = params;

    if (w && (isNaN(w) || w < 1 || w > 2048)) {
      errors.push('Width must be between 1 and 2048');
    }

    if (h && (isNaN(h) || h < 1 || h > 2048)) {
      errors.push('Height must be between 1 and 2048');
    }

    if (q && (isNaN(q) || q < 1 || q > 100)) {
      errors.push('Quality must be between 1 and 100');
    }

    const allowedFormats = ['jpeg', 'jpg', 'png', 'webp', 'avif'];
    if (format && !allowedFormats.includes(format.toLowerCase())) {
      errors.push(`Format must be one of: ${allowedFormats.join(', ')}`);
    }

    return { isValid: errors.length === 0, errors };
  }
}

export default new TransformService();