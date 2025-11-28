import { filesAPI } from './api';

export class DownloadService {
  constructor() {
    this.urlCache = new Map();
    this.refreshTimers = new Map();
  }

  // Get download URL with automatic refresh for signed URLs
  async getDownloadUrl(fileId, options = {}) {
    const { expiry = 900, purpose = 'download', forceRefresh = false } = options;
    
    try {
      // Check cache first
      const cacheKey = `${fileId}-${purpose}`;
      const cached = this.urlCache.get(cacheKey);
      
      if (cached && !forceRefresh && new Date() < new Date(cached.expiresAt)) {
        return cached;
      }

      // Get new signed URL
      const response = await filesAPI.getSignedUrl(fileId, { expiry, purpose });
      const urlData = response.data;

      // Cache the URL
      this.urlCache.set(cacheKey, urlData);

      // Set up auto-refresh for signed URLs
      if (!urlData.isPublic && urlData.expiresAt) {
        this.scheduleRefresh(fileId, purpose, urlData.expiresAt);
      }

      return urlData;
    } catch (error) {
      console.error('Failed to get download URL:', error);
      throw error;
    }
  }

  // Get preview URL (shorter expiry, optimized for viewing)
  async getPreviewUrl(fileId, options = {}) {
    return this.getDownloadUrl(fileId, { 
      ...options, 
      purpose: 'preview',
      expiry: options.expiry || 300 // 5 minutes for preview
    });
  }

  // Download file using direct endpoint
  async downloadFile(fileId, filename, options = {}) {
    try {
      // Use direct download endpoint with token in URL
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const downloadUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/files/${fileId}/download?token=${encodeURIComponent(token)}`;
      
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Download failed:', error);
      throw error;
    }
  }

  // Get streaming URL for media files
  async getStreamUrl(fileId, options = {}) {
    return this.getDownloadUrl(fileId, { 
      ...options, 
      purpose: 'stream',
      expiry: options.expiry || 1800 // 30 minutes for streaming
    });
  }

  // Schedule URL refresh before expiry
  scheduleRefresh(fileId, purpose, expiresAt) {
    const cacheKey = `${fileId}-${purpose}`;
    
    // Clear existing timer
    if (this.refreshTimers.has(cacheKey)) {
      clearTimeout(this.refreshTimers.get(cacheKey));
    }

    // Calculate refresh time (refresh 2 minutes before expiry)
    const expiryTime = new Date(expiresAt).getTime();
    const refreshTime = expiryTime - Date.now() - (2 * 60 * 1000);

    if (refreshTime > 0) {
      const timer = setTimeout(async () => {
        try {
          await this.getDownloadUrl(fileId, { purpose, forceRefresh: true });
        } catch (error) {
          console.error('Failed to refresh URL:', error);
        }
      }, refreshTime);

      this.refreshTimers.set(cacheKey, timer);
    }
  }

  // Clear cache and timers
  clearCache(fileId = null) {
    if (fileId) {
      // Clear specific file cache
      const keysToDelete = [];
      for (const key of this.urlCache.keys()) {
        if (key.startsWith(`${fileId}-`)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => {
        this.urlCache.delete(key);
        if (this.refreshTimers.has(key)) {
          clearTimeout(this.refreshTimers.get(key));
          this.refreshTimers.delete(key);
        }
      });
    } else {
      // Clear all cache
      this.urlCache.clear();
      this.refreshTimers.forEach(timer => clearTimeout(timer));
      this.refreshTimers.clear();
    }
  }

  // Get public CDN URL for public files
  async getPublicUrl(fileId) {
    try {
      const response = await filesAPI.getPublicUrl(fileId);
      return response.data;
    } catch (error) {
      console.error('Failed to get public URL:', error);
      throw error;
    }
  }

  // Copy URL to clipboard
  async copyUrlToClipboard(fileId, options = {}) {
    try {
      const urlData = await this.getDownloadUrl(fileId, options);
      await navigator.clipboard.writeText(urlData.url);
      return urlData.url;
    } catch (error) {
      console.error('Failed to copy URL:', error);
      throw error;
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
}

// Export singleton instance
export const downloadService = new DownloadService();