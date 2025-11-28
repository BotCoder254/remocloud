const axios = require('axios');

// Error handling and retry utilities
const ERROR_CODES = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  UPLOAD_FAILED: 'UPLOAD_FAILED',
  SIGNED_URL_EXPIRED: 'SIGNED_URL_EXPIRED',
  RATE_LIMITED: 'RATE_LIMITED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  TRANSFORM_FAILED: 'TRANSFORM_FAILED'
};

const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2,
  retryableErrors: [
    'NETWORK_ERROR',
    'TIMEOUT_ERROR', 
    'UPLOAD_FAILED',
    'SIGNED_URL_EXPIRED',
    'STORAGE_ERROR',
    'TRANSFORM_FAILED'
  ]
};

// Calculate retry delay with exponential backoff
function calculateRetryDelay(attempt, config = RETRY_CONFIG) {
  const delay = Math.min(
    config.baseDelay * Math.pow(config.backoffFactor, attempt),
    config.maxDelay
  );
  // Add jitter (±25%)
  const jitter = delay * 0.25 * (Math.random() * 2 - 1);
  return Math.max(0, delay + jitter);
}

// Enhanced error class
class SDKError extends Error {
  constructor(code, message, details = {}, originalError = null) {
    super(message);
    this.name = 'SDKError';
    this.code = code;
    this.details = details;
    this.originalError = originalError;
    this.retryable = RETRY_CONFIG.retryableErrors.includes(code);
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      retryable: this.retryable,
      timestamp: this.timestamp
    };
  }
}

// Retry wrapper for async operations
async function withRetry(operation, config = RETRY_CONFIG, context = {}) {
  let lastError;
  
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Parse error from response
      const errorCode = error?.response?.data?.error?.code || 
                       (error.code === 'ECONNABORTED' ? 'TIMEOUT_ERROR' : 'NETWORK_ERROR');
      
      const sdkError = new SDKError(
        errorCode,
        error?.response?.data?.error?.message || error.message,
        {
          attempt: attempt + 1,
          maxRetries: config.maxRetries,
          context,
          httpStatus: error?.response?.status
        },
        error
      );
      
      // Don't retry on last attempt or non-retryable errors
      if (attempt === config.maxRetries || !sdkError.retryable) {
        throw sdkError;
      }
      
      // Wait before retry
      const delay = calculateRetryDelay(attempt, config);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      console.warn(`Retrying operation (${attempt + 1}/${config.maxRetries}) after ${delay}ms:`, {
        error: errorCode,
        context
      });
    }
  }
  
  throw lastError;
}

class RemoCloudSDK {
  constructor(apiKey, baseURL = 'http://localhost:5000/api') {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
    this.client = axios.create({
      baseURL,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000, // 30 second timeout
      retry: 3,
      retryDelay: (retryCount) => calculateRetryDelay(retryCount - 1)
    });
    
    // Add request interceptor for retry logic
    this.client.interceptors.request.use(
      (config) => {
        config.metadata = { startTime: new Date() };
        return config;
      },
      (error) => Promise.reject(error)
    );
    
    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        const duration = new Date() - response.config.metadata.startTime;
        console.debug(`API call completed in ${duration}ms:`, {
          url: response.config.url,
          method: response.config.method,
          status: response.status
        });
        return response;
      },
      (error) => {
        const duration = error.config?.metadata ? new Date() - error.config.metadata.startTime : 0;
        console.error(`API call failed after ${duration}ms:`, {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          error: error.message
        });
        return Promise.reject(error);
      }
    );
    
    // Initialize resource namespaces
    this.buckets = new BucketsResource(this.client);
    this.files = new FilesResource(this.client);
    this.analytics = new AnalyticsResource(this.client);
    this.keys = new KeysResource(this.client);
  }

  // Static initialization method
  static init({ baseUrl, apiKey }) {
    return new RemoCloudSDK(apiKey, baseUrl);
  }

  // Upload file with progress tracking and retry logic
  async upload(bucketId, file, options = {}) {
    const { onProgress, onError, onComplete, onRetry } = options;
    const uploadId = `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    return withRetry(async () => {
      try {
        // Step 1: Initiate upload and get signed URL
        const fileMetadata = {
          filename: file.name,
          size: file.size,
          contentType: file.type
        };

        const initiateResponse = await this.client.post(
          `/buckets/${bucketId}/uploads`, 
          fileMetadata
        );

        const { uploadId: serverUploadId, signedUrl, headersToInclude } = initiateResponse.data;

        // Step 2: Upload directly to signed URL with retry
        const uploadResponse = await this.uploadDirectWithRetry(
          signedUrl, 
          file, 
          headersToInclude,
          onProgress,
          { uploadId, bucketId }
        );

        if (!uploadResponse.ok) {
          throw new SDKError(
            'UPLOAD_FAILED',
            `Upload failed: ${uploadResponse.statusText}`,
            { uploadId, bucketId, status: uploadResponse.status }
          );
        }

        // Step 3: Complete upload
        const completeResponse = await this.client.post(
          `/uploads/${serverUploadId}/complete`,
          {
            etag: uploadResponse.headers.get('etag'),
            actualSize: file.size
          }
        );

        const result = completeResponse.data;
        
        if (onComplete) {
          onComplete(result);
        }

        return result;
      } catch (error) {
        // Handle specific upload errors
        if (error.response?.status === 410) {
          throw new SDKError(
            'SIGNED_URL_EXPIRED',
            'Upload URL expired, restarting upload',
            { uploadId, bucketId }
          );
        }
        
        if (error.response?.status === 413) {
          throw new SDKError(
            'FILE_TOO_LARGE',
            'File size exceeds limit',
            { uploadId, bucketId, fileSize: file.size }
          );
        }
        
        if (onError) {
          onError(error);
        }
        throw error;
      }
    }, RETRY_CONFIG, { operation: 'upload', uploadId, bucketId });
  }

  // Direct upload to signed URL with progress and retry
  async uploadDirectWithRetry(signedUrl, file, headers = {}, onProgress, context = {}) {
    return withRetry(async () => {
      return this.uploadDirect(signedUrl, file, headers, onProgress);
    }, {
      maxRetries: 2,
      baseDelay: 2000,
      retryableErrors: ['NETWORK_ERROR', 'TIMEOUT_ERROR']
    }, context);
  }

  // Direct upload to signed URL with progress
  async uploadDirect(signedUrl, file, headers = {}, onProgress) {
    // Check if we're in browser or Node.js environment
    if (typeof XMLHttpRequest !== 'undefined') {
      // Browser environment
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        // Track upload progress
        if (onProgress) {
          xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
              const progress = (event.loaded / event.total) * 100;
              onProgress(progress, event.loaded, event.total);
            }
          });
        }

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve({
              ok: true,
              status: xhr.status,
              headers: {
                get: (name) => xhr.getResponseHeader(name)
              }
            });
          } else {
            reject(new Error(`Upload failed: ${xhr.statusText}`));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new SDKError(
            'NETWORK_ERROR',
            'Network error during upload',
            { url: signedUrl }
          ));
        });
        
        xhr.addEventListener('timeout', () => {
          reject(new SDKError(
            'TIMEOUT_ERROR',
            'Upload timed out',
            { url: signedUrl, timeout: xhr.timeout }
          ));
        });
        
        // Set timeout
        xhr.timeout = 300000; // 5 minutes

        xhr.open('PUT', signedUrl);
        
        // Set headers
        Object.entries(headers).forEach(([key, value]) => {
          xhr.setRequestHeader(key, value);
        });

        // Handle different file types
      if (file.buffer) {
        // Node.js Buffer
        xhr.send(file.buffer);
      } else if (file.stream && typeof file.stream === 'function') {
        // Node.js Stream
        const stream = file.stream();
        const chunks = [];
        stream.on('data', chunk => chunks.push(chunk));
        stream.on('end', () => {
          const buffer = Buffer.concat(chunks);
          xhr.send(buffer);
        });
        stream.on('error', reject);
        return; // Don't send immediately
      } else {
        // Browser File object
        xhr.send(file);
      }
      });
    } else {
      // Node.js environment - use fetch or axios
      const response = await axios.put(signedUrl, file, {
        headers,
        onUploadProgress: onProgress ? (progressEvent) => {
          const progress = (progressEvent.loaded / progressEvent.total) * 100;
          onProgress(progress, progressEvent.loaded, progressEvent.total);
        } : undefined
      });
      
      return {
        ok: response.status >= 200 && response.status < 300,
        status: response.status,
        headers: {
          get: (name) => response.headers[name.toLowerCase()]
        }
      };
    }
  }

  // Get upload status
  async getUploadStatus(uploadId) {
    const response = await this.client.get(`/uploads/${uploadId}`);
    return response.data;
  }

  // Cancel upload
  async cancelUpload(uploadId) {
    const response = await this.client.delete(`/uploads/${uploadId}`);
    return response.data;
  }

  // Get secure download URL with caching and retry
  async getDownloadUrl(fileId, options = {}) {
    const { expiry = 900, purpose = 'download', forceRefresh = false } = options;
    
    // Simple cache for URLs
    const cacheKey = `${fileId}-${purpose}`;
    if (!forceRefresh && this._urlCache && this._urlCache[cacheKey]) {
      const cached = this._urlCache[cacheKey];
      if (new Date() < new Date(cached.expiresAt)) {
        return cached;
      }
    }

    return withRetry(async () => {
      const response = await this.client.post(`/files/${fileId}/signed-url`, {
        expiry,
        purpose
      });
      
      // Cache the result
      if (!this._urlCache) this._urlCache = {};
      this._urlCache[cacheKey] = response.data;
      
      return response.data;
    }, RETRY_CONFIG, { operation: 'getDownloadUrl', fileId, purpose });
  }

  // Get preview URL (shorter expiry, optimized for viewing)
  async getPreviewUrl(fileId, options = {}) {
    return this.getDownloadUrl(fileId, { 
      ...options, 
      purpose: 'preview',
      expiry: options.expiry || 300 // 5 minutes for preview
    });
  }

  // Get streaming URL for media files
  async getStreamUrl(fileId, options = {}) {
    return this.getDownloadUrl(fileId, { 
      ...options, 
      purpose: 'stream',
      expiry: options.expiry || 1800 // 30 minutes for streaming
    });
  }

  // Download file with secure URL handling
  async downloadFile(fileId, filename, options = {}) {
    const urlData = await this.getDownloadUrl(fileId, { 
      ...options, 
      purpose: 'download' 
    });

    if (typeof window !== 'undefined') {
      // Browser environment
      if (urlData.isPublic || options.direct) {
        // Direct download for public files
        const link = document.createElement('a');
        link.href = urlData.url;
        link.download = filename;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }

      // For private files, fetch and create blob URL
      const response = await fetch(urlData.url, {
        headers: urlData.cacheHeaders || {}
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up blob URL
      window.URL.revokeObjectURL(blobUrl);
    } else {
      // Node.js environment - return stream
      const response = await axios.get(urlData.url, {
        responseType: 'stream',
        headers: urlData.cacheHeaders || {}
      });
      return response.data;
    }
  }

  // Download file stream
  async downloadStream(fileId, options = {}) {
    const urlData = await this.getDownloadUrl(fileId, options);
    
    if (typeof fetch !== 'undefined') {
      // Browser environment
      const response = await fetch(urlData.url, {
        headers: urlData.cacheHeaders || {}
      });
      
      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }
      
      return response.body;
    } else {
      // Node.js environment
      const response = await axios.get(urlData.url, {
        responseType: 'stream',
        headers: urlData.cacheHeaders || {}
      });
      return response.data;
    }
  }

  // Get public URL for public files
  async getPublicUrl(fileId) {
    const response = await this.client.get(`/files/${fileId}/public-url`);
    return response.data;
  }

  // Copy URL to clipboard
  async copyUrlToClipboard(fileId, options = {}) {
    const urlData = await this.getDownloadUrl(fileId, options);
    
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(urlData.url);
      return urlData.url;
    } else {
      throw new Error('Clipboard API not available');
    }
  }

  // Preload URLs for better UX
  async preloadUrls(fileIds, purpose = 'preview') {
    const promises = fileIds.map(fileId => 
      this.getDownloadUrl(fileId, { purpose }).catch(error => {
        console.warn(`Failed to preload URL for file ${fileId}:`, error);
        return null;
      })
    );
    
    return Promise.allSettled(promises);
  }

  // Clear URL cache
  clearUrlCache(fileId = null) {
    if (!this._urlCache) return;
    
    if (fileId) {
      // Clear specific file cache
      Object.keys(this._urlCache).forEach(key => {
        if (key.startsWith(`${fileId}-`)) {
          delete this._urlCache[key];
        }
      });
    } else {
      // Clear all cache
      this._urlCache = {};
    }
  }

  // Get file hash
  async getFileHash(fileId) {
    const response = await this.client.get(`/files/${fileId}/hash`);
    return response.data;
  }

  // Verify file integrity
  async verifyIntegrity(fileId, clientHash = null) {
    const response = await this.client.post(`/files/${fileId}/verify`, {
      clientHash
    });
    return response.data;
  }

  // Check for duplicate files
  async checkDuplicate(bucketId, hash) {
    const response = await this.client.post(`/buckets/${bucketId}/check-duplicate`, {
      hash
    });
    return response.data;
  }

  // Compute file hash (client-side)
  async computeFileHash(file, onProgress = null) {
    // Simple hash computation for Node.js environment
    if (typeof window === 'undefined') {
      const crypto = require('crypto');
      const hash = crypto.createHash('sha256');
      
      if (file.buffer) {
        hash.update(file.buffer);
        return hash.digest('hex');
      } else if (file.stream && typeof file.stream === 'function') {
        return new Promise((resolve, reject) => {
          const stream = file.stream();
          stream.on('data', chunk => hash.update(chunk));
          stream.on('end', () => resolve(hash.digest('hex')));
          stream.on('error', reject);
        });
      }
    }
    
    // For browser environment, would need Web Crypto API
    throw new Error('Client-side hashing not implemented for browser environment in SDK');
  }

  // Bucket operations
  async getBuckets() {
    const response = await this.client.get('/buckets');
    return response.data;
  }

  async createBucket(bucketData) {
    const response = await this.client.post('/buckets', bucketData);
    return response.data;
  }

  async getBucket(bucketId) {
    const response = await this.client.get(`/buckets/${bucketId}`);
    return response.data;
  }

  // File operations
  async getFiles(bucketId) {
    const response = await this.client.get('/files', {
      params: { bucket_id: bucketId }
    });
    return response.data;
  }

  async downloadFile(fileId) {
    const response = await this.client.get(`/files/${fileId}/download`, {
      responseType: 'blob'
    });
    return response.data;
  }

  async deleteFile(fileId) {
    const response = await this.client.delete(`/files/${fileId}`);
    return response.data;
  }

  // Validate file type (client-side)
  validateFileType(file, allowedTypes = ['*']) {
    const errors = [];
    const warnings = [];
    
    if (allowedTypes.includes('*')) {
      return { isValid: true, errors, warnings };
    }
    
    const extension = file.name.split('.').pop().toLowerCase();
    const declaredMime = file.type;
    
    // Simple extension-based validation for SDK
    const isAllowed = allowedTypes.some(allowedType => {
      if (allowedType === '*') return true;
      if (allowedType.endsWith('/*')) {
        const category = allowedType.slice(0, -2);
        return declaredMime.startsWith(category + '/');
      }
      return allowedType === declaredMime || allowedType === extension;
    });
    
    if (!isAllowed) {
      errors.push(`File type not allowed. Allowed types: ${allowedTypes.join(', ')}`);
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      fileInfo: {
        name: file.name,
        size: file.size,
        declaredMime,
        extension
      }
    };
  }

  // Get bucket allowed types
  async getBucketAllowedTypes(bucketId) {
    try {
      const bucket = await this.getBucket(bucketId);
      return bucket.allowed_types || ['*'];
    } catch (error) {
      console.warn('Could not fetch bucket allowed types:', error);
      return ['*'];
    }
  }

  // Image transform methods with retry
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

    return withRetry(async () => {
      const response = await this.client.get(`/files/${fileId}/transform?${params}`);
      return response.data;
    }, {
      maxRetries: 2,
      baseDelay: 2000,
      retryableErrors: ['NETWORK_ERROR', 'TIMEOUT_ERROR', 'TRANSFORM_FAILED']
    }, { operation: 'transform', fileId, options });
  }

  // Get srcset for responsive images
  async getSrcSet(fileId, options = {}) {
    const { breakpoints = '300,600,900,1200', format = 'webp' } = options;
    
    const params = new URLSearchParams();
    params.append('breakpoints', breakpoints);
    params.append('format', format);

    const response = await this.client.get(`/files/${fileId}/srcset?${params}`);
    return response.data;
  }

  // Get transform presets
  async getTransformPresets() {
    const response = await this.client.get('/transform/presets');
    return response.data;
  }

  // Generate srcset string for responsive images
  generateSrcSetString(fileId, breakpoints = [300, 600, 900, 1200], format = 'webp') {
    return breakpoints.map(width => {
      const params = new URLSearchParams({ w: width, format });
      return `${this.baseURL}/api/files/${fileId}/transform?${params} ${width}w`;
    }).join(', ');
  }

  // Check if file is an image
  isImageFile(mimeType) {
    return mimeType && mimeType.startsWith('image/');
  }

  // Get common transform presets
  getCommonPresets() {
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
}

// Resource classes for better organization
class BucketsResource {
  constructor(client) {
    this.client = client;
  }

  async list() {
    const response = await this.client.get('/buckets');
    return response.data;
  }

  async create(bucketData) {
    const response = await this.client.post('/buckets', bucketData);
    return response.data;
  }

  async get(bucketId) {
    const response = await this.client.get(`/buckets/${bucketId}`);
    return response.data;
  }

  async update(bucketId, updates) {
    const response = await this.client.put(`/buckets/${bucketId}`, updates);
    return response.data;
  }

  async delete(bucketId) {
    const response = await this.client.delete(`/buckets/${bucketId}`);
    return response.data;
  }
}

class FilesResource {
  constructor(client) {
    this.client = client;
  }

  async list(bucketId, params = {}) {
    const response = await this.client.get('/files', {
      params: { bucket_id: bucketId, ...params }
    });
    return response.data;
  }

  async get(fileId) {
    const response = await this.client.get(`/files/${fileId}`);
    return response.data;
  }

  async upload(bucketId, file, options = {}) {
    // Use the main SDK upload method
    return this.client.sdk.upload(bucketId, file, options);
  }

  async getDownloadUrl(fileId, options = {}) {
    return this.client.sdk.getDownloadUrl(fileId, options);
  }

  async getTransformedUrl(fileId, transformSpec) {
    return this.client.sdk.getTransformedUrl(fileId, transformSpec);
  }

  async delete(fileId) {
    const response = await this.client.delete(`/files/${fileId}`);
    return response.data;
  }
}

class AnalyticsResource {
  constructor(client) {
    this.client = client;
  }

  async overview(startDate, endDate) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    const response = await this.client.get(`/analytics/overview?${params}`);
    return response.data;
  }

  async bucket(bucketId, startDate, endDate) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    const response = await this.client.get(`/analytics/buckets/${bucketId}?${params}`);
    return response.data;
  }

  async storage() {
    const response = await this.client.get('/analytics/storage');
    return response.data;
  }

  async topFiles(limit = 10) {
    const response = await this.client.get(`/analytics/top-files?limit=${limit}`);
    return response.data;
  }

  async export(startDate, endDate) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    const response = await this.client.get(`/analytics/export?${params}`, {
      responseType: 'blob'
    });
    return response.data;
  }
}

class KeysResource {
  constructor(client) {
    this.client = client;
  }

  async list() {
    const response = await this.client.get('/keys');
    return response.data;
  }

  async create(name, scopes = ['read', 'write']) {
    const response = await this.client.post('/keys', { name, scopes });
    return response.data;
  }

  async revoke(keyId) {
    const response = await this.client.delete(`/keys/${keyId}`);
    return response.data;
  }
}

// Export error classes and utilities
RemoCloudSDK.SDKError = SDKError;
RemoCloudSDK.ERROR_CODES = ERROR_CODES;
RemoCloudSDK.RETRY_CONFIG = RETRY_CONFIG;
RemoCloudSDK.withRetry = withRetry;

module.exports = RemoCloudSDK;