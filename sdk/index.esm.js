import axios from 'axios';

class RemoCloudSDK {
  constructor(apiKey, baseURL = 'http://localhost:5000/api') {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
    this.client = axios.create({
      baseURL,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
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

  // Upload file with progress tracking
  async upload(bucketId, file, options = {}) {
    const { onProgress, onError, onComplete } = options;
    
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

      const { uploadId, signedUrl, headersToInclude } = initiateResponse.data;

      // Step 2: Upload directly to signed URL
      const uploadResponse = await this.uploadDirect(
        signedUrl, 
        file, 
        headersToInclude,
        onProgress
      );

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.statusText}`);
      }

      // Step 3: Complete upload
      const completeResponse = await this.client.post(
        `/uploads/${uploadId}/complete`,
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
      if (onError) {
        onError(error);
      }
      throw error;
    }
  }

  // Direct upload to signed URL with progress
  async uploadDirect(signedUrl, file, headers = {}, onProgress) {
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
        reject(new Error('Upload failed'));
      });

      xhr.open('PUT', signedUrl);
      
      // Set headers
      Object.entries(headers).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value);
      });

      xhr.send(file);
    });
  }

  // Get secure download URL with caching
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

    const response = await this.client.post(`/files/${fileId}/signed-url`, {
      expiry,
      purpose
    });
    
    // Cache the result
    if (!this._urlCache) this._urlCache = {};
    this._urlCache[cacheKey] = response.data;
    
    return response.data;
  }

  // Image transform methods
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

    const response = await this.client.get(`/files/${fileId}/transform?${params}`);
    return response.data;
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

export default RemoCloudSDK;
export { createRemoCloudHooks } from './hooks.js';