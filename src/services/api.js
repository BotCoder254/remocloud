import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (email, password) => api.post('/auth/register', { email, password }),
  login: (email, password) => api.post('/auth/login', { email, password }),
  verify: () => api.get('/auth/verify'),
};

// API Keys API
export const apiKeysAPI = {
  getAll: () => api.get('/keys'),
  create: (name, scopes) => api.post('/keys', { name, scopes }),
  revoke: (keyId) => api.delete(`/keys/${keyId}`),
};

// Buckets API
export const bucketsAPI = {
  getAll: () => api.get('/buckets'),
  create: (bucketData) => api.post('/buckets', bucketData),
  getById: (bucketId) => api.get(`/buckets/${bucketId}`),
  update: (bucketId, updates) => api.put(`/buckets/${bucketId}`, updates),
  delete: (bucketId) => api.delete(`/buckets/${bucketId}`),
  getStats: (bucketId) => api.get(`/buckets/${bucketId}/stats`),
};

// Upload API
export const uploadAPI = {
  initiate: (bucketId, fileMetadata) => api.post(`/buckets/${bucketId}/uploads`, fileMetadata),
  complete: (uploadId, completionData) => api.post(`/uploads/${uploadId}/complete`, completionData),
  getStatus: (uploadId) => api.get(`/uploads/${uploadId}`),
  cancel: (uploadId) => api.delete(`/uploads/${uploadId}`),
  uploadDirect: async (signedUrl, file, headers = {}) => {
    // Direct upload to signed URL (bypasses our API)
    const response = await fetch(signedUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
        'Content-Length': file.size.toString(),
        ...headers
      }
    });
    return response;
  }
};

// Files API
export const filesAPI = {
  getAll: (params = {}) => api.get('/files', { params }),
  getTrash: (params = {}) => api.get('/files/trash', { params }),
  getBucketFiles: (bucketId, params = {}) => api.get(`/files/buckets/${bucketId}`, { params }),
  getById: (fileId) => api.get(`/files/${fileId}`),
  update: (fileId, updates) => api.put(`/files/${fileId}`, updates),
  getSignedUrl: (fileId, options = {}) => api.post(`/files/${fileId}/signed-url`, options),
  getPublicUrl: (fileId) => api.get(`/files/${fileId}/public-url`),
  upload: (file, bucketId) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('bucket_id', bucketId);
    return api.post('/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  download: (fileId) => api.get(`/files/${fileId}/download`, { responseType: 'blob' }),
  delete: (fileId, permanent = false) => api.delete(`/files/${fileId}`, { params: { permanent } }),
  restore: (fileId) => api.post(`/files/${fileId}/restore`),
  getVersions: (fileId) => api.get(`/files/${fileId}/versions`),
  restoreVersion: (fileId, versionId) => api.post(`/files/${fileId}/versions/${versionId}/restore`),
  getHash: (fileId) => api.get(`/files/${fileId}/hash`),
  verifyIntegrity: (fileId) => api.post(`/files/${fileId}/verify`),
  checkDuplicate: (bucketId, hash) => api.post(`/buckets/${bucketId}/check-duplicate`, { hash }),
  validateFile: (file, allowedTypes) => {
    // Client-side validation helper
    return import('../services/fileValidation').then(({ FileValidationService }) => 
      FileValidationService.validateFile(file, allowedTypes)
    );
  },
};

export default api;