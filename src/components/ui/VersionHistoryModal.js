import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  X, 
  History, 
  RotateCcw, 
  Calendar, 
  User, 
  HardDrive,
  Check,
  Clock,
  ArrowRight,
  AlertCircle
} from 'lucide-react';
import { filesAPI } from '../../services/api';
import { useToast } from './Toast';

const VersionHistoryModal = ({ file, isOpen, onClose, onUpdate }) => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [versionToRestore, setVersionToRestore] = useState(null);

  const { data: versionsData, isLoading } = useQuery({
    queryKey: ['file-versions', file?.id],
    queryFn: () => filesAPI.getVersions(file.id).then(res => res.data),
    enabled: isOpen && !!file?.id
  });

  const restoreMutation = useMutation({
    mutationFn: ({ fileId, versionId }) => filesAPI.restoreVersion(fileId, versionId),
    onSuccess: (data) => {
      queryClient.invalidateQueries(['files']);
      queryClient.invalidateQueries(['file-versions', file.id]);
      if (onUpdate) onUpdate();
      setShowRestoreConfirm(false);
      setVersionToRestore(null);
      toast.success(`Restored to version ${data.data.restoredVersion}`);
    },
    onError: (error) => {
      toast.error('Failed to restore version');
      console.error('Restore error:', error);
    }
  });

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

  const handleRestoreClick = (version) => {
    if (version.is_current) return;
    setVersionToRestore(version);
    setShowRestoreConfirm(true);
  };

  const confirmRestore = () => {
    if (versionToRestore) {
      restoreMutation.mutate({
        fileId: file.id,
        versionId: versionToRestore.id
      });
    }
  };

  const getSizeDiff = (currentSize, previousSize) => {
    if (!previousSize) return null;
    const diff = currentSize - previousSize;
    if (diff === 0) return null;
    const sign = diff > 0 ? '+' : '';
    return `${sign}${formatFileSize(Math.abs(diff))}`;
  };

  if (!file) return null;

  const versions = versionsData?.versions || [];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 md:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="card max-w-2xl w-full h-full md:h-auto md:max-h-[80vh] overflow-hidden md:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-surface-variant-light dark:border-surface-variant-dark">
              <div className="flex items-center gap-3">
                <History className="w-6 h-6 text-primary-light dark:text-primary-dark" />
                <div>
                  <h2 className="text-xl font-semibold text-text-primary-light dark:text-text-primary-dark">
                    Version History
                  </h2>
                  <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                    {file.original_name}
                  </p>
                </div>
              </div>
              
              <button
                onClick={onClose}
                className="p-2 text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin w-8 h-8 border-2 border-primary-light border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p className="text-text-secondary-light dark:text-text-secondary-dark">
                    Loading version history...
                  </p>
                </div>
              ) : versions.length === 0 ? (
                <div className="text-center py-8">
                  <History className="w-16 h-16 text-text-secondary-light dark:text-text-secondary-dark mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark mb-2">
                    No Version History
                  </h3>
                  <p className="text-text-secondary-light dark:text-text-secondary-dark">
                    This file doesn't have any previous versions yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {versions.map((version, index) => {
                    const previousVersion = versions[index + 1];
                    const sizeDiff = getSizeDiff(version.size, previousVersion?.size);
                    
                    return (
                      <motion.div
                        key={version.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className={`relative p-4 rounded-lg border transition-colors ${
                          version.is_current
                            ? 'border-primary-light bg-primary-light bg-opacity-5'
                            : 'border-surface-variant-light dark:border-surface-variant-dark hover:bg-surface-variant-light dark:hover:bg-surface-variant-dark'
                        }`}
                      >
                        {/* Version Header */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                              version.is_current
                                ? 'bg-primary-light text-white'
                                : 'bg-surface-variant-light dark:bg-surface-variant-dark text-text-secondary-light dark:text-text-secondary-dark'
                            }`}>
                              v{version.version_number}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-text-primary-light dark:text-text-primary-dark">
                                  Version {version.version_number}
                                </span>
                                {version.is_current && (
                                  <span className="px-2 py-0.5 text-xs rounded-full bg-primary-light text-white">
                                    Current
                                  </span>
                                )}
                                {version.restored_from_version && (
                                  <span className="px-2 py-0.5 text-xs rounded-full bg-secondary-light bg-opacity-10 text-secondary-light">
                                    Restored from v{version.restored_from_version}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-4 text-xs text-text-secondary-light dark:text-text-secondary-dark mt-1">
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {formatDate(version.created_at)}
                                </div>
                                {version.created_by_email && (
                                  <div className="flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    {version.created_by_email}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {!version.is_current && (
                            <button
                              onClick={() => handleRestoreClick(version)}
                              disabled={restoreMutation.isPending}
                              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-accent-light text-white rounded-lg hover:bg-opacity-90 transition-opacity disabled:opacity-50"
                            >
                              <RotateCcw className="w-3 h-3" />
                              Restore
                            </button>
                          )}
                        </div>

                        {/* Version Details */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <label className="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wide">
                              Size
                            </label>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-text-primary-light dark:text-text-primary-dark">
                                {formatFileSize(version.size)}
                              </span>
                              {sizeDiff && (
                                <span className={`text-xs px-1 py-0.5 rounded ${
                                  sizeDiff.startsWith('+') 
                                    ? 'bg-warning-light bg-opacity-10 text-warning-light'
                                    : 'bg-accent-light bg-opacity-10 text-accent-light'
                                }`}>
                                  {sizeDiff}
                                </span>
                              )}
                            </div>
                          </div>

                          <div>
                            <label className="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wide">
                              Type
                            </label>
                            <p className="text-text-primary-light dark:text-text-primary-dark mt-1">
                              {version.mime_type}
                            </p>
                          </div>

                          <div>
                            <label className="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wide">
                              Hash
                            </label>
                            <p className="text-text-secondary-light dark:text-text-secondary-dark font-mono text-xs mt-1">
                              {version.file_hash?.substring(0, 12)}...
                            </p>
                          </div>
                        </div>

                        {/* Connection line to next version */}
                        {index < versions.length - 1 && (
                          <div className="absolute left-8 -bottom-4 w-0.5 h-8 bg-surface-variant-light dark:bg-surface-variant-dark"></div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>

          {/* Restore Confirmation Modal */}
          <AnimatePresence>
            {showRestoreConfirm && versionToRestore && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-60 p-4"
                onClick={() => setShowRestoreConfirm(false)}
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="card max-w-md w-full p-6"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-start gap-3 mb-4">
                    <RotateCcw className="w-6 h-6 text-accent-light flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark mb-2">
                        Restore Version {versionToRestore.version_number}?
                      </h3>
                      <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mb-3">
                        This will create a new version based on version {versionToRestore.version_number}. 
                        The current version will be preserved in history.
                      </p>
                      
                      <div className="flex items-center gap-2 text-xs text-text-secondary-light dark:text-text-secondary-dark">
                        <span>v{file.version}</span>
                        <ArrowRight className="w-3 h-3" />
                        <span>v{(versions[0]?.version_number || 0) + 1}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowRestoreConfirm(false)}
                      className="flex-1 btn-secondary"
                      disabled={restoreMutation.isPending}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmRestore}
                      disabled={restoreMutation.isPending}
                      className="flex-1 bg-accent-light hover:bg-opacity-90 text-white px-4 py-2 rounded-lg font-medium transition-opacity disabled:opacity-50"
                    >
                      {restoreMutation.isPending ? 'Restoring...' : 'Restore Version'}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default VersionHistoryModal;