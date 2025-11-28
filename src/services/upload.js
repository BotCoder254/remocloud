import { uploadAPI, bucketsAPI } from './api';
import { HashService } from './hash';

export class UploadService {
  constructor() {
    this.activeUploads = new Map();
  }

  // Main upload method with 3-step process
  async upload(bucketId, file, options = {}) {
    const { onStateChange, onComplete, onError, skipDuplicateCheck = false } = options;
    const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Step 0: Compute client-side hash for small files and check duplicates
      let clientHash = null;
      if (!skipDuplicateCheck && file.size <= 10 * 1024 * 1024) { // 10MB limit for client hashing
        this.updateState(uploadId, { status: 'hashing', progress: 0 }, onStateChange);
        
        try {
          clientHash = await HashService.computeQuickHash(file);
          
          // Check for duplicates
          this.updateState(uploadId, { status: 'checking-duplicates', progress: 5 }, onStateChange);
          const duplicateCheck = await bucketsAPI.checkDuplicate(bucketId, clientHash);
          
          if (duplicateCheck.data.isDuplicate) {
            const duplicateInfo = {
              isDuplicate: true,
              existingFiles: duplicateCheck.data.existingFiles,
              hash: clientHash,
              message: duplicateCheck.data.message
            };
            
            this.updateState(uploadId, { 
              status: 'duplicate-found', 
              progress: 100,
              duplicateInfo 
            }, onStateChange);
            
            if (onComplete) {
              onComplete({ isDuplicate: true, ...duplicateInfo });
            }
            return duplicateInfo;
          }
        } catch (hashError) {
          console.warn('Client-side hashing failed, continuing with upload:', hashError);
          // Continue with upload even if hashing fails
        }
      }

      // Step 1: Initiate upload
      this.updateState(uploadId, { status: 'initiating', progress: 10 }, onStateChange);
      
      const fileMetadata = {
        filename: file.name,
        size: file.size,
        contentType: file.type,
        lastModified: file.lastModified,
        clientHash: clientHash // Include client hash if computed
      };

      const initiateResponse = await uploadAPI.initiate(bucketId, fileMetadata);
      const { uploadId: serverUploadId, signedUrl, headersToInclude, expiresAt } = initiateResponse.data;

      // Store upload info
      this.activeUploads.set(uploadId, {
        serverUploadId,
        file,
        bucketId,
        signedUrl,
        headersToInclude,
        expiresAt
      });

      // Step 2: Upload directly to signed URL
      this.updateState(uploadId, { status: 'uploading', progress: 0 }, onStateChange);
      
      const uploadResponse = await this.uploadDirect(
        signedUrl, 
        file, 
        headersToInclude,
        (progress) => {
          this.updateState(uploadId, { status: 'uploading', progress }, onStateChange);
        }
      );

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.statusText}`);
      }

      // Step 3: Complete upload
      this.updateState(uploadId, { status: 'finalizing', progress: 95 }, onStateChange);
      
      const completeResponse = await uploadAPI.complete(serverUploadId, {
        etag: uploadResponse.headers.get('etag'),
        actualSize: file.size,
        clientHash: clientHash,
        enableVersioning: true // Enable versioning for all uploads
      });

      const result = completeResponse.data;
      
      this.updateState(uploadId, { 
        status: 'completed', 
        progress: 100, 
        result 
      }, onStateChange);

      // Clean up
      this.activeUploads.delete(uploadId);
      
      if (onComplete) {
        onComplete(result);
      }

      return result;
    } catch (error) {
      console.error('Upload failed:', error);
      
      this.updateState(uploadId, { 
        status: 'error', 
        error: error.message || 'Upload failed' 
      }, onStateChange);

      // Clean up
      this.activeUploads.delete(uploadId);
      
      if (onError) {
        onError(error);
      }
      
      throw error;
    }
  }

  // Direct upload to signed URL with progress tracking
  async uploadDirect(signedUrl, file, headers = {}, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Track upload progress
      if (onProgress) {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = (event.loaded / event.total) * 90; // Reserve 10% for finalization
            onProgress(progress);
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

      xhr.addEventListener('abort', () => {
        reject(new Error('Upload cancelled'));
      });

      xhr.open('PUT', signedUrl);
      
      // Set headers
      Object.entries(headers).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value);
      });

      // Set content type if not already set
      if (!headers['Content-Type']) {
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      }

      xhr.send(file);
    });
  }

  // Batch upload multiple files
  async uploadBatch(bucketId, files, options = {}) {
    const { onBatchProgress, onFileComplete, onBatchComplete, onError } = options;
    const results = [];
    let completedCount = 0;

    const fileUploads = files.map((file, index) => {
      return this.upload(bucketId, file, {
        onStateChange: (state) => {
          if (onBatchProgress) {
            const overallProgress = ((completedCount + (state.progress / 100)) / files.length) * 100;
            onBatchProgress(overallProgress, index, state);
          }
        },
        onComplete: (result) => {
          completedCount++;
          results[index] = result;
          
          if (onFileComplete) {
            onFileComplete(result, index);
          }
          
          if (completedCount === files.length && onBatchComplete) {
            onBatchComplete(results);
          }
        },
        onError: (error) => {
          completedCount++;
          results[index] = { error: error.message };
          
          if (onError) {
            onError(error, index);
          }
          
          if (completedCount === files.length && onBatchComplete) {
            onBatchComplete(results);
          }
        }
      });
    });

    return Promise.allSettled(fileUploads);
  }

  // Cancel upload
  async cancelUpload(uploadId) {
    const uploadInfo = this.activeUploads.get(uploadId);
    if (uploadInfo) {
      try {
        await uploadAPI.cancel(uploadInfo.serverUploadId);
      } catch (error) {
        console.warn('Failed to cancel upload on server:', error);
      }
      this.activeUploads.delete(uploadId);
    }
  }

  // Get upload status
  async getUploadStatus(uploadId) {
    const uploadInfo = this.activeUploads.get(uploadId);
    if (uploadInfo) {
      try {
        const response = await uploadAPI.getStatus(uploadInfo.serverUploadId);
        return response.data;
      } catch (error) {
        console.error('Failed to get upload status:', error);
        return null;
      }
    }
    return null;
  }

  // Utility method to update state
  updateState(uploadId, state, onStateChange) {
    if (onStateChange) {
      onStateChange(state);
    }
  }

  // Validate file before upload
  validateFile(file, options = {}) {
    const { maxSize = 100 * 1024 * 1024, allowedTypes = [] } = options; // 100MB default
    
    const errors = [];
    
    if (file.size > maxSize) {
      errors.push(`File size exceeds ${this.formatFileSize(maxSize)} limit`);
    }
    
    if (allowedTypes.length > 0 && !allowedTypes.includes('*')) {
      const fileType = file.type.split('/')[0];
      const isAllowed = allowedTypes.some(type => 
        type === file.type || type === fileType + '/*' || type === '*'
      );
      
      if (!isAllowed) {
        errors.push(`File type ${file.type} is not allowed`);
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Format file size for display
  formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Resume upload (for future implementation)
  async resumeUpload(uploadId) {
    // TODO: Implement resumable uploads
    throw new Error('Resume upload not yet implemented');
  }

  // Get active uploads
  getActiveUploads() {
    return Array.from(this.activeUploads.entries()).map(([id, info]) => ({
      id,
      ...info
    }));
  }

  // Clear completed uploads
  clearCompleted() {
    // This would be handled by the UI component
    // The service doesn't track completed uploads
  }
}

// Export singleton instance
export const uploadService = new UploadService();