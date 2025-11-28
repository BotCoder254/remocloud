import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trash2, 
  AlertTriangle, 
  Clock, 
  RotateCcw,
  X
} from 'lucide-react';

const DeleteConfirmModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  file, 
  isDeleting = false,
  retentionDays = 7 
}) => {
  if (!file) return null;

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
            className="card max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 bg-danger-light bg-opacity-10 rounded-lg flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-danger-light" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark mb-2">
                  Delete File?
                </h3>
                <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mb-3">
                  Are you sure you want to delete "{file.original_name}"?
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-1 text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Soft Delete Info */}
            <div className="bg-warning-light bg-opacity-10 border border-warning-light border-opacity-20 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-warning-light flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-warning-light mb-1">
                    Recoverable for {retentionDays} days
                  </h4>
                  <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                    This file will be moved to trash and can be restored within {retentionDays} days. 
                    After that, it will be permanently deleted.
                  </p>
                </div>
              </div>
            </div>

            {/* File Info */}
            <div className="bg-surface-variant-light dark:bg-surface-variant-dark rounded-lg p-3 mb-6">
              <div className="text-sm">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-text-secondary-light dark:text-text-secondary-dark">File:</span>
                  <span className="text-text-primary-light dark:text-text-primary-dark font-medium">
                    {file.original_name}
                  </span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-text-secondary-light dark:text-text-secondary-dark">Size:</span>
                  <span className="text-text-primary-light dark:text-text-primary-dark">
                    {formatFileSize(file.size)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-secondary-light dark:text-text-secondary-dark">Type:</span>
                  <span className="text-text-primary-light dark:text-text-primary-dark">
                    {file.mime_type}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 btn-secondary"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={isDeleting}
                className="flex-1 bg-danger-light hover:bg-opacity-90 text-white px-4 py-2 rounded-lg font-medium transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                    Moving to Trash...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Move to Trash
                  </>
                )}
              </button>
            </div>

            {/* Recovery Info */}
            <div className="mt-4 pt-4 border-t border-surface-variant-light dark:border-surface-variant-dark">
              <div className="flex items-center gap-2 text-xs text-text-secondary-light dark:text-text-secondary-dark">
                <RotateCcw className="w-3 h-3" />
                <span>You can restore deleted files from the trash within {retentionDays} days</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Helper function
const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export default DeleteConfirmModal;