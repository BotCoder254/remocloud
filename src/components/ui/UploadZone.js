import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, 
  File, 
  Image, 
  Video, 
  Music, 
  FileText,
  X,
  Check,
  AlertCircle,
  Pause,
  Play,
  RotateCcw,
  Hash,
  AlertTriangle
} from 'lucide-react';
import DuplicateWarningModal from './DuplicateWarningModal';
import FileValidationModal from './FileValidationModal';
import { FileValidationService } from '../../services/fileValidation';

const UploadZone = ({ 
  bucketId, 
  onUploadComplete, 
  onUploadError,
  className = '',
  multiple = true,
  accept = '*/*'
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploads, setUploads] = useState([]);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState(null);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);
  const fileInputRef = useRef(null);

  const getFileIcon = (file) => {
    const type = file.type.split('/')[0];
    switch (type) {
      case 'image': return Image;
      case 'video': return Video;
      case 'audio': return Music;
      case 'text': return FileText;
      default: return File;
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    handleFiles(files);
    e.target.value = ''; // Reset input
  };

  const handleFiles = async (files) => {
    const { bucketsAPI } = await import('../../services/api');
    
    // Get bucket info for validation
    let allowedTypes = ['*'];
    try {
      const bucketResponse = await bucketsAPI.getById(bucketId);
      allowedTypes = bucketResponse.data.allowed_types || ['*'];
    } catch (error) {
      console.warn('Could not fetch bucket info for validation:', error);
    }
    
    for (const file of files) {
      // Client-side validation
      const validation = await FileValidationService.validateFile(file, allowedTypes, {
        checkSignature: true,
        maxSize: 100 * 1024 * 1024 // 100MB
      });
      
      const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const uploadState = {
        id: uploadId,
        file,
        status: validation.isValid ? 'pending' : 'validation-failed',
        progress: 0,
        error: validation.isValid ? null : validation.errors[0],
        result: null,
        validation
      };

      setUploads(prev => [...prev, uploadState]);
      
      // Show validation modal for failed or warning files
      if (!validation.isValid || validation.warnings.length > 0) {
        setValidationResult(validation);
        setPendingFile({ file, uploadId });
        setShowValidationModal(true);
        continue; // Don't start upload yet
      }

      // Start upload immediately for valid files
      startUpload(file, uploadId);
    }
  };

  const removeUpload = (uploadId) => {
    setUploads(prev => prev.filter(upload => upload.id !== uploadId));
  };

  const retryUpload = async (uploadId) => {
    const upload = uploads.find(u => u.id === uploadId);
    if (!upload) return;

    const { uploadService } = await import('../../services/upload');
    
    setUploads(prev => prev.map(u => 
      u.id === uploadId ? { ...u, status: 'pending', progress: 0, error: null } : u
    ));

    uploadService.upload(bucketId, upload.file, {
      skipDuplicateCheck: true, // Skip duplicate check on retry
      onStateChange: (state) => {
        setUploads(prev => prev.map(u => 
          u.id === uploadId ? { ...u, ...state } : u
        ));
      },
      onComplete: (result) => {
        if (onUploadComplete) onUploadComplete(result);
      },
      onError: (error) => {
        if (onUploadError) onUploadError(error, upload.file);
      }
    });
  };

  const handleContinueUpload = async () => {
    if (!pendingFile) return;
    
    const { uploadService } = await import('../../services/upload');
    
    setShowDuplicateModal(false);
    setUploads(prev => prev.map(u => 
      u.id === pendingFile.uploadId ? { ...u, status: 'pending', progress: 0 } : u
    ));

    uploadService.upload(bucketId, pendingFile.file, {
      skipDuplicateCheck: true, // Skip duplicate check when continuing
      onStateChange: (state) => {
        setUploads(prev => prev.map(u => 
          u.id === pendingFile.uploadId ? { ...u, ...state } : u
        ));
      },
      onComplete: (result) => {
        if (onUploadComplete) onUploadComplete(result);
      },
      onError: (error) => {
        if (onUploadError) onUploadError(error, pendingFile.file);
      }
    });
    
    setPendingFile(null);
    setDuplicateInfo(null);
  };

  const handleUseExisting = (existingFile) => {
    if (!pendingFile) return;
    
    // Remove the pending upload from the list
    setUploads(prev => prev.filter(u => u.id !== pendingFile.uploadId));
    
    // Notify parent that we're using an existing file
    if (onUploadComplete) {
      onUploadComplete({
        ...existingFile,
        isExisting: true,
        message: 'Using existing file with identical content'
      });
    }
    
    setShowDuplicateModal(false);
    setPendingFile(null);
    setDuplicateInfo(null);
  };

  const handleCancelDuplicate = () => {
    if (pendingFile) {
      // Remove the pending upload
      setUploads(prev => prev.filter(u => u.id !== pendingFile.uploadId));
    }
    
    setShowDuplicateModal(false);
    setPendingFile(null);
    setDuplicateInfo(null);
  };

  const handleValidationContinue = async () => {
    if (!pendingFile) return;
    
    setShowValidationModal(false);
    
    // Update upload status to pending and start upload
    setUploads(prev => prev.map(u => 
      u.id === pendingFile.uploadId ? { ...u, status: 'pending', error: null } : u
    ));
    
    startUpload(pendingFile.file, pendingFile.uploadId);
    
    setPendingFile(null);
    setValidationResult(null);
  };

  const handleValidationCancel = () => {
    if (pendingFile) {
      // Remove the failed upload
      setUploads(prev => prev.filter(u => u.id !== pendingFile.uploadId));
    }
    
    setShowValidationModal(false);
    setPendingFile(null);
    setValidationResult(null);
  };

  const startUpload = async (file, uploadId) => {
    const { uploadService } = await import('../../services/upload');
    
    // Start upload with a small delay to show the pending state
    setTimeout(() => {
      uploadService.upload(bucketId, file, {
        onStateChange: (state) => {
          setUploads(prev => prev.map(upload => 
            upload.id === uploadId ? { ...upload, ...state } : upload
          ));
          
          // Handle duplicate detection
          if (state.status === 'duplicate-found' && state.duplicateInfo) {
            setDuplicateInfo(state.duplicateInfo);
            setPendingFile({ file, uploadId });
            setShowDuplicateModal(true);
          }
        },
        onComplete: (result) => {
          if (result.isDuplicate) {
            // Duplicate was handled, don't call onUploadComplete
            return;
          }
          if (onUploadComplete) onUploadComplete(result);
        },
        onError: (error) => {
          if (onUploadError) onUploadError(error, file);
        }
      });
    }, 100);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Drop Zone */}
      <motion.div
        className={`
          border-2 border-dashed rounded-2xl p-8 text-center transition-colors cursor-pointer
          ${isDragOver 
            ? 'border-primary-light dark:border-primary-dark bg-primary-light bg-opacity-5' 
            : 'border-surface-variant-light dark:border-surface-variant-dark hover:border-primary-light dark:hover:border-primary-dark'
          }
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <Upload className={`w-12 h-12 mx-auto mb-4 ${
          isDragOver ? 'text-primary-light dark:text-primary-dark' : 'text-text-secondary-light dark:text-text-secondary-dark'
        }`} />
        
        <h3 className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark mb-2">
          {isDragOver ? 'Drop files here' : 'Upload Files'}
        </h3>
        
        <p className="text-text-secondary-light dark:text-text-secondary-dark mb-4">
          Drag and drop files here, or click to select files
        </p>
        
        <button className="btn-primary">
          Select Files
        </button>
        
        <input
          ref={fileInputRef}
          type="file"
          multiple={multiple}
          accept={accept}
          onChange={handleFileSelect}
          className="hidden"
        />
      </motion.div>

      {/* Upload Queue */}
      <AnimatePresence>
        {uploads.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3"
          >
            <h4 className="font-medium text-text-primary-light dark:text-text-primary-dark">
              Upload Queue ({uploads.length})
            </h4>
            
            {uploads.map((upload) => {
              const FileIcon = getFileIcon(upload.file);
              
              return (
                <motion.div
                  key={upload.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="card p-4"
                >
                  <div className="flex items-center gap-4">
                    {/* File Icon */}
                    <div className="w-10 h-10 bg-surface-variant-light dark:bg-surface-variant-dark rounded-lg flex items-center justify-center">
                      <FileIcon className="w-5 h-5 text-text-secondary-light dark:text-text-secondary-dark" />
                    </div>

                    {/* File Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h5 className="font-medium text-text-primary-light dark:text-text-primary-dark truncate">
                          {upload.file.name}
                        </h5>
                        <span className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                          {formatFileSize(upload.file.size)}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-surface-variant-light dark:bg-surface-variant-dark rounded-full h-2 mb-2">
                        <motion.div
                          className={`h-2 rounded-full ${
                            upload.status === 'error' 
                              ? 'bg-danger-light' 
                              : upload.status === 'completed'
                              ? 'bg-accent-light'
                              : 'bg-primary-light dark:bg-primary-dark'
                          }`}
                          initial={{ width: 0 }}
                          animate={{ width: `${upload.progress}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>

                      {/* Status */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {upload.status === 'completed' && (
                            <Check className="w-4 h-4 text-accent-light" />
                          )}
                          {upload.status === 'error' && (
                            <AlertCircle className="w-4 h-4 text-danger-light" />
                          )}
                          <span className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                            {upload.status === 'pending' && 'Waiting...'}
                            {upload.status === 'validation-failed' && (
                              <span className="flex items-center gap-1 text-danger-light">
                                <AlertTriangle className="w-3 h-3" />
                                Validation failed
                              </span>
                            )}
                            {upload.status === 'hashing' && 'Computing hash...'}
                            {upload.status === 'checking-duplicates' && 'Checking for duplicates...'}
                            {upload.status === 'duplicate-found' && (
                              <span className="flex items-center gap-1 text-warning-light">
                                <AlertTriangle className="w-3 h-3" />
                                Duplicate detected
                              </span>
                            )}
                            {upload.status === 'initiating' && 'Preparing...'}
                            {upload.status === 'uploading' && `Uploading... ${Math.round(upload.progress)}%`}
                            {upload.status === 'finalizing' && 'Finalizing...'}
                            {upload.status === 'completed' && 'Completed'}
                            {upload.status === 'error' && upload.error}
                          </span>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          {upload.status === 'error' && (
                            <button
                              onClick={() => retryUpload(upload.id)}
                              className="p-1 text-primary-light dark:text-primary-dark hover:bg-primary-light hover:bg-opacity-10 rounded"
                              title="Retry upload"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}
                          
                          {(upload.status === 'completed' || upload.status === 'error') && (
                            <button
                              onClick={() => removeUpload(upload.id)}
                              className="p-1 text-text-secondary-light dark:text-text-secondary-dark hover:text-danger-light hover:bg-danger-light hover:bg-opacity-10 rounded"
                              title="Remove from queue"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Duplicate Warning Modal */}
      <DuplicateWarningModal
        isOpen={showDuplicateModal}
        onClose={handleCancelDuplicate}
        onContinue={handleContinueUpload}
        onUseExisting={handleUseExisting}
        duplicateInfo={duplicateInfo}
        fileName={pendingFile?.file?.name}
      />

      {/* File Validation Modal */}
      <FileValidationModal
        isOpen={showValidationModal}
        onClose={handleValidationCancel}
        onContinue={validationResult?.isValid === false ? null : handleValidationContinue}
        validationResult={validationResult}
        fileName={pendingFile?.file?.name}
      />
    </div>
  );
};

export default UploadZone;