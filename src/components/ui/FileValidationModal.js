import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertTriangle, 
  X, 
  FileX, 
  Shield,
  Info,
  CheckCircle
} from 'lucide-react';

const FileValidationModal = ({ 
  isOpen, 
  onClose, 
  onContinue, 
  validationResult,
  fileName 
}) => {
  if (!validationResult) return null;

  const hasErrors = validationResult.errors && validationResult.errors.length > 0;
  const hasWarnings = validationResult.warnings && validationResult.warnings.length > 0;

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
            className="card max-w-lg w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start gap-3 p-6 border-b border-surface-variant-light dark:border-surface-variant-dark">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                hasErrors 
                  ? 'bg-danger-light bg-opacity-10' 
                  : hasWarnings 
                  ? 'bg-warning-light bg-opacity-10'
                  : 'bg-accent-light bg-opacity-10'
              }`}>
                {hasErrors ? (
                  <FileX className="w-5 h-5 text-danger-light" />
                ) : hasWarnings ? (
                  <AlertTriangle className="w-5 h-5 text-warning-light" />
                ) : (
                  <CheckCircle className="w-5 h-5 text-accent-light" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark mb-1">
                  {hasErrors ? 'File Validation Failed' : hasWarnings ? 'File Validation Warning' : 'File Validation Passed'}
                </h3>
                <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                  {fileName}
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
            <div className="p-6">
              {/* File Information */}
              {validationResult.fileInfo && (
                <div className="mb-6">
                  <h4 className="font-medium text-text-primary-light dark:text-text-primary-dark mb-3">
                    File Information
                  </h4>
                  <div className="bg-surface-variant-light dark:bg-surface-variant-dark rounded-lg p-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-text-secondary-light dark:text-text-secondary-dark">Declared Type:</span>
                      <span className="text-text-primary-light dark:text-text-primary-dark font-mono">
                        {validationResult.fileInfo.declaredMime || 'Unknown'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary-light dark:text-text-secondary-dark">Expected Type:</span>
                      <span className="text-text-primary-light dark:text-text-primary-dark font-mono">
                        {validationResult.fileInfo.expectedMime || 'Unknown'}
                      </span>
                    </div>
                    {validationResult.fileInfo.detectedMime && (
                      <div className="flex justify-between">
                        <span className="text-text-secondary-light dark:text-text-secondary-dark">Detected Type:</span>
                        <span className="text-text-primary-light dark:text-text-primary-dark font-mono">
                          {validationResult.fileInfo.detectedMime}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-text-secondary-light dark:text-text-secondary-dark">Extension:</span>
                      <span className="text-text-primary-light dark:text-text-primary-dark font-mono">
                        .{validationResult.fileInfo.extension || 'none'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Errors */}
              {hasErrors && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-4 h-4 text-danger-light" />
                    <h4 className="font-medium text-danger-light">
                      Validation Errors
                    </h4>
                  </div>
                  <div className="space-y-2">
                    {validationResult.errors.map((error, index) => (
                      <div key={index} className="bg-danger-light bg-opacity-10 border border-danger-light border-opacity-20 rounded-lg p-3">
                        <p className="text-sm text-danger-light">{error}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Warnings */}
              {hasWarnings && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Info className="w-4 h-4 text-warning-light" />
                    <h4 className="font-medium text-warning-light">
                      Validation Warnings
                    </h4>
                  </div>
                  <div className="space-y-2">
                    {validationResult.warnings.map((warning, index) => (
                      <div key={index} className="bg-warning-light bg-opacity-10 border border-warning-light border-opacity-20 rounded-lg p-3">
                        <p className="text-sm text-warning-light">{warning}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Allowed Types */}
              {validationResult.allowedTypes && validationResult.allowedTypes.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-medium text-text-primary-light dark:text-text-primary-dark mb-3">
                    Allowed File Types
                  </h4>
                  <div className="bg-primary-light bg-opacity-10 border border-primary-light border-opacity-20 rounded-lg p-3">
                    <div className="flex flex-wrap gap-2">
                      {validationResult.allowedTypes.map((type, index) => (
                        <span key={index} className="px-2 py-1 text-xs bg-primary-light bg-opacity-20 text-primary-light rounded">
                          {type}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Suggestion */}
              {validationResult.suggestion && (
                <div className="mb-6">
                  <div className="bg-accent-light bg-opacity-10 border border-accent-light border-opacity-20 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <Shield className="w-4 h-4 text-accent-light flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-accent-light mb-1">Suggestion</h4>
                        <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                          {validationResult.suggestion}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 p-6 border-t border-surface-variant-light dark:border-surface-variant-dark">
              <button
                onClick={onClose}
                className="flex-1 btn-secondary"
              >
                {hasErrors ? 'Cancel Upload' : 'Close'}
              </button>
              
              {!hasErrors && onContinue && (
                <button
                  onClick={onContinue}
                  className="flex-1 bg-warning-light hover:bg-opacity-90 text-white px-4 py-2 rounded-lg font-medium transition-opacity"
                >
                  Continue Anyway
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FileValidationModal;