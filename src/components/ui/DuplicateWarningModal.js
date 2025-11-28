import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertTriangle, 
  Files, 
  Calendar, 
  HardDrive,
  Eye,
  EyeOff,
  Upload,
  X,
  Hash
} from 'lucide-react';
import HashDisplay from './HashDisplay';

const DuplicateWarningModal = ({ 
  isOpen, 
  onClose, 
  onContinue, 
  onUseExisting,
  duplicateInfo,
  fileName 
}) => {
  if (!duplicateInfo || !duplicateInfo.isDuplicate) return null;

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="card max-w-2xl w-full max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start gap-3 p-6 border-b border-surface-variant-light dark:border-surface-variant-dark">
              <div className="w-10 h-10 bg-warning-light bg-opacity-10 rounded-lg flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-warning-light" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark mb-1">
                  Duplicate File Detected
                </h3>
                <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                  A file with identical content already exists in this bucket
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-1 text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto">
              {/* File Being Uploaded */}
              <div className="mb-6">
                <h4 className="font-medium text-text-primary-light dark:text-text-primary-dark mb-3">
                  File you're uploading:
                </h4>
                <div className="bg-surface-variant-light dark:bg-surface-variant-dark rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Files className="w-5 h-5 text-primary-light" />
                    <span className="font-medium text-text-primary-light dark:text-text-primary-dark">
                      {fileName}
                    </span>
                  </div>
                  
                  <HashDisplay 
                    hash={duplicateInfo.hash}
                    compact={true}
                    className="mb-2"
                  />
                </div>
              </div>

              {/* Existing Files */}
              <div className="mb-6">
                <h4 className="font-medium text-text-primary-light dark:text-text-primary-dark mb-3">
                  Existing files with identical content:
                </h4>
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {duplicateInfo.existingFiles.map((file) => (
                    <motion.div
                      key={file.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-surface-variant-light dark:bg-surface-variant-dark rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <Files className="w-4 h-4 text-text-secondary-light dark:text-text-secondary-dark flex-shrink-0" />
                          <div className="min-w-0">
                            <div className="font-medium text-text-primary-light dark:text-text-primary-dark truncate">
                              {file.original_name}
                              {file.version > 1 && (
                                <span className="ml-2 px-1 py-0.5 text-xs rounded bg-secondary-light bg-opacity-10 text-secondary-light">
                                  v{file.version}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-xs text-text-secondary-light dark:text-text-secondary-dark mt-1">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDate(file.created_at)}
                              </div>
                              <div className="flex items-center gap-1">
                                <HardDrive className="w-3 h-3" />
                                {formatFileSize(file.size)}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {file.is_public ? (
                            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-warning-light bg-opacity-10 text-warning-light">
                              <Eye className="w-3 h-3" />
                              <span className="text-xs font-medium">Public</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-accent-light bg-opacity-10 text-accent-light">
                              <EyeOff className="w-3 h-3" />
                              <span className="text-xs font-medium">Private</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {onUseExisting && (
                        <button
                          onClick={() => onUseExisting(file)}
                          className="w-full mt-2 py-2 text-sm bg-accent-light bg-opacity-10 text-accent-light hover:bg-opacity-20 rounded-lg transition-colors"
                        >
                          Use this existing file
                        </button>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Recommendation */}
              <div className="bg-primary-light bg-opacity-10 border border-primary-light border-opacity-20 rounded-lg p-4 mb-6">
                <h4 className="font-medium text-primary-light mb-2">
                  Recommendation
                </h4>
                <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                  {duplicateInfo.recommendation || 
                   'Consider using one of the existing files to save storage space, or upload with a different name if this is intentionally a separate copy.'}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 p-6 border-t border-surface-variant-light dark:border-surface-variant-dark">
              <button
                onClick={onClose}
                className="flex-1 btn-secondary"
              >
                Cancel Upload
              </button>
              
              {onContinue && (
                <button
                  onClick={onContinue}
                  className="flex-1 flex items-center justify-center gap-2 bg-warning-light hover:bg-opacity-90 text-white px-4 py-2 rounded-lg font-medium transition-opacity"
                >
                  <Upload className="w-4 h-4" />
                  Upload Anyway
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default DuplicateWarningModal;