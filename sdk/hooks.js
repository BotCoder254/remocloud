import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback } from 'react';

// React hooks for RemoCloud SDK
export const createRemoCloudHooks = (sdk) => {
  // Buckets hooks
  const useBuckets = (options = {}) => {
    return useQuery({
      queryKey: ['remocloud', 'buckets'],
      queryFn: () => sdk.getBuckets(),
      staleTime: 5 * 60 * 1000, // 5 minutes
      ...options
    });
  };

  const useCreateBucket = (options = {}) => {
    const queryClient = useQueryClient();
    
    return useMutation({
      mutationFn: (bucketData) => sdk.createBucket(bucketData),
      onSuccess: () => {
        queryClient.invalidateQueries(['remocloud', 'buckets']);
      },
      ...options
    });
  };

  // Files hooks with error handling
  const useFiles = (bucketId, params = {}, options = {}) => {
    return useQuery({
      queryKey: ['remocloud', 'files', bucketId, params],
      queryFn: () => sdk.files.list(bucketId, params),
      enabled: !!bucketId,
      staleTime: 2 * 60 * 1000, // 2 minutes
      retry: (failureCount, error) => {
        const errorCode = error?.response?.data?.error?.code;
        const retryableErrors = ['NETWORK_ERROR', 'TIMEOUT_ERROR', 'DATABASE_ERROR'];
        return failureCount < 3 && retryableErrors.includes(errorCode);
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      ...options
    });
  };

  const useFile = (fileId, options = {}) => {
    return useQuery({
      queryKey: ['remocloud', 'file', fileId],
      queryFn: () => sdk.getFile(fileId),
      enabled: !!fileId,
      staleTime: 5 * 60 * 1000,
      ...options
    });
  };

  // Upload hook with progress tracking and error handling
  const useUpload = (bucketId, options = {}) => {
    const queryClient = useQueryClient();
    const [uploadProgress, setUploadProgress] = useState({});

    const uploadMutation = useMutation({
      mutationFn: async ({ file, uploadOptions = {} }) => {
        const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Initialize progress
        setUploadProgress(prev => ({
          ...prev,
          [fileId]: { 
            progress: 0, 
            status: 'uploading',
            fileName: file.name,
            retryCount: 0
          }
        }));

        const uploadWithRetry = async (retryCount = 0) => {
          try {
            const result = await sdk.upload(bucketId, file, {
              ...uploadOptions,
              onProgress: (progress, loaded, total) => {
                setUploadProgress(prev => ({
                  ...prev,
                  [fileId]: { 
                    ...prev[fileId],
                    progress: Math.round(progress), 
                    loaded, 
                    total, 
                    status: retryCount > 0 ? 'retrying' : 'uploading'
                  }
                }));
              },
              onRetry: (attempt) => {
                setUploadProgress(prev => ({
                  ...prev,
                  [fileId]: { 
                    ...prev[fileId],
                    status: 'retrying',
                    retryCount: attempt
                  }
                }));
              }
            });

            // Mark as complete
            setUploadProgress(prev => ({
              ...prev,
              [fileId]: { 
                ...prev[fileId], 
                status: 'completed' 
              }
            }));
            
            return { ...result, fileId };
            
          } catch (error) {
            const errorCode = error?.code || error?.response?.data?.error?.code;
            const retryableErrors = ['UPLOAD_FAILED', 'NETWORK_ERROR', 'TIMEOUT_ERROR', 'SIGNED_URL_EXPIRED'];
            
            if (retryableErrors.includes(errorCode) && retryCount < 3) {
              setUploadProgress(prev => ({
                ...prev,
                [fileId]: { 
                  ...prev[fileId],
                  status: 'retrying',
                  retryCount: retryCount + 1
                }
              }));
              
              const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
              await new Promise(resolve => setTimeout(resolve, delay));
              return uploadWithRetry(retryCount + 1);
            }
            
            // Mark as error
            setUploadProgress(prev => ({
              ...prev,
              [fileId]: { 
                ...prev[fileId], 
                status: 'error',
                error: error.message || 'Upload failed'
              }
            }));
            
            throw error;
          }
        };
        
        return uploadWithRetry();
      },
      onSuccess: (result) => {
        queryClient.invalidateQueries(['remocloud', 'files', bucketId]);
        queryClient.invalidateQueries(['remocloud', 'buckets']);
        
        // Clean up progress after delay
        setTimeout(() => {
          clearProgress(result.fileId);
        }, 3000);
      },
      onError: (error, variables) => {
        console.error('Upload mutation error:', error);
      },
      ...options
    });

    const clearProgress = useCallback((fileId) => {
      setUploadProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[fileId];
        return newProgress;
      });
    }, []);

    const retryUpload = useCallback((fileId) => {
      const progress = uploadProgress[fileId];
      if (progress && progress.status === 'error') {
        setUploadProgress(prev => ({
          ...prev,
          [fileId]: { 
            ...prev[fileId],
            status: 'uploading',
            progress: 0,
            error: null
          }
        }));
      }
    }, [uploadProgress]);

    return {
      ...uploadMutation,
      uploadProgress,
      clearProgress,
      retryUpload
    };
  };

  // Download hook
  const useDownload = (options = {}) => {
    return useMutation({
      mutationFn: ({ fileId, filename, downloadOptions = {} }) => 
        sdk.downloadFile(fileId, filename, downloadOptions),
      ...options
    });
  };

  // Delete file hook with error handling
  const useDeleteFile = (options = {}) => {
    const queryClient = useQueryClient();
    
    return useMutation({
      mutationFn: async (fileId) => {
        try {
          return await sdk.files.delete(fileId);
        } catch (error) {
          const errorCode = error?.response?.data?.error?.code;
          const retryableErrors = ['NETWORK_ERROR', 'TIMEOUT_ERROR'];
          
          if (retryableErrors.includes(errorCode)) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            return await sdk.files.delete(fileId);
          }
          
          throw error;
        }
      },
      onSuccess: (_, fileId) => {
        queryClient.invalidateQueries(['remocloud', 'files']);
        queryClient.removeQueries(['remocloud', 'file', fileId]);
      },
      onError: (error, fileId) => {
        console.error('Delete file error:', error);
      },
      ...options
    });
  };

  // Image transforms hooks with error handling
  const useTransformedUrl = (fileId, transformOptions = {}, options = {}) => {
    return useQuery({
      queryKey: ['remocloud', 'transform', fileId, transformOptions],
      queryFn: () => sdk.getTransformedUrl(fileId, transformOptions),
      enabled: !!fileId,
      staleTime: 10 * 60 * 1000, // 10 minutes for transforms
      retry: (failureCount, error) => {
        const errorCode = error?.response?.data?.error?.code;
        const retryableErrors = ['TRANSFORM_FAILED', 'NETWORK_ERROR', 'TIMEOUT_ERROR'];
        return failureCount < 2 && retryableErrors.includes(errorCode);
      },
      retryDelay: (attemptIndex) => Math.min(2000 * 2 ** attemptIndex, 8000),
      ...options
    });
  };

  const useSrcSet = (fileId, srcSetOptions = {}, options = {}) => {
    return useQuery({
      queryKey: ['remocloud', 'srcset', fileId, srcSetOptions],
      queryFn: () => sdk.getSrcSet(fileId, srcSetOptions),
      enabled: !!fileId,
      staleTime: 10 * 60 * 1000,
      ...options
    });
  };

  // Analytics hooks
  const useAnalytics = (startDate, endDate, options = {}) => {
    return useQuery({
      queryKey: ['remocloud', 'analytics', startDate, endDate],
      queryFn: () => sdk.analytics.overview(startDate, endDate),
      staleTime: 5 * 60 * 1000,
      ...options
    });
  };

  const useBucketAnalytics = (bucketId, startDate, endDate, options = {}) => {
    return useQuery({
      queryKey: ['remocloud', 'analytics', 'bucket', bucketId, startDate, endDate],
      queryFn: () => sdk.analytics.bucket(bucketId, startDate, endDate),
      enabled: !!bucketId,
      staleTime: 5 * 60 * 1000,
      ...options
    });
  };

  // File integrity hooks
  const useFileHash = (fileId, options = {}) => {
    return useQuery({
      queryKey: ['remocloud', 'hash', fileId],
      queryFn: () => sdk.getFileHash(fileId),
      enabled: !!fileId,
      staleTime: 30 * 60 * 1000, // 30 minutes for hashes
      ...options
    });
  };

  const useVerifyIntegrity = (options = {}) => {
    return useMutation({
      mutationFn: ({ fileId, clientHash }) => 
        sdk.verifyIntegrity(fileId, clientHash),
      ...options
    });
  };

  return {
    // Buckets
    useBuckets,
    useCreateBucket,
    
    // Files
    useFiles,
    useFile,
    useUpload,
    useDownload,
    useDeleteFile,
    
    // Transforms
    useTransformedUrl,
    useSrcSet,
    
    // Analytics
    useAnalytics,
    useBucketAnalytics,
    
    // Integrity
    useFileHash,
    useVerifyIntegrity
  };
};

// Default export for convenience
export default createRemoCloudHooks;