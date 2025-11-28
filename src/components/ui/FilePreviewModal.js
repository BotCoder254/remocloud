import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Download, 
  Eye, 
  EyeOff, 
  Edit3, 
  Calendar, 
  HardDrive, 
  Hash,
  User,
  FolderOpen,
  Image,
  Video,
  Music,
  FileText,
  File,
  Link as LinkIcon,
  Copy,
  AlertTriangle,
  Check,
  Globe,
  Lock,
  History
} from 'lucide-react';
import { filesAPI } from '../../services/api';
import { downloadService } from '../../services/download';
import transformService from '../../services/transforms';
import { useToast } from './Toast';
import HashDisplay from './HashDisplay';

const FilePreviewModal = ({ file, isOpen, onClose, onUpdate }) => {
  const toast = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isTogglingVisibility, setIsTogglingVisibility] = useState(false);
  const [showVisibilityConfirm, setShowVisibilityConfirm] = useState(false);
  const [pendingVisibility, setPendingVisibility] = useState(null);
  const [publicUrl, setPublicUrl] = useState(null);
  const [editData, setEditData] = useState({
    original_name: file?.original_name || '',
    is_public: file?.is_public || false
  });

  // Update edit data when file changes
  useEffect(() => {
    if (file) {
      setEditData({
        original_name: file.original_name || '',
        is_public: file.is_public || false
      });
    }
  }, [file]);

  // Load preview URL when file changes
  useEffect(() => {
    if (file && isOpen) {
      loadPreviewUrl();
    }
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [file, isOpen]);

  const loadPreviewUrl = async () => {
    if (!file) return;
    
    setIsLoadingPreview(true);
    try {
      const urlData = await downloadService.getPreviewUrl(file.id);
      
      if (urlData.isPublic) {
        setPreviewUrl(urlData.url);
      } else {
        // For private files, create a blob URL for security
        const response = await fetch(urlData.url, {
          headers: urlData.cacheHeaders || {}
        });
        
        if (response.ok) {
          const blob = await response.blob();
          const blobUrl = URL.createObjectURL(blob);
          setPreviewUrl(blobUrl);
        }
      }
    } catch (error) {
      console.error('Failed to load preview:', error);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const getFileIcon = (mimeType) => {
    if (!mimeType) return File;
    const type = mimeType.split('/')[0];
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

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleSave = async () => {
    try {
      await filesAPI.update(file.id, editData);
      if (onUpdate) onUpdate();
      setIsEditing(false);
      toast.success('File updated successfully');
    } catch (error) {
      console.error('Failed to update file:', error);
      toast.error('Failed to update file');
    }
  };

  const handleVisibilityToggle = (newVisibility) => {
    if (newVisibility === file.is_public) return;
    
    setPendingVisibility(newVisibility);
    setShowVisibilityConfirm(true);
  };

  const confirmVisibilityChange = async () => {
    if (pendingVisibility === null) return;
    
    setIsTogglingVisibility(true);
    try {
      const response = await filesAPI.update(file.id, { is_public: pendingVisibility });
      
      // If making public, get the public URL
      if (pendingVisibility && response.data) {
        try {
          const urlData = await downloadService.getPublicUrl(response.data.id);
          setPublicUrl(urlData.url);
        } catch (error) {
          console.warn('Failed to get public URL:', error);
        }
      }
      
      if (onUpdate) onUpdate();
      setShowVisibilityConfirm(false);
      setPendingVisibility(null);
      toast.success(`File is now ${pendingVisibility ? 'public' : 'private'}`);
    } catch (error) {
      console.error('Failed to update visibility:', error);
      toast.error('Failed to update file visibility');
    } finally {
      setIsTogglingVisibility(false);
    }
  };

  const handleDownload = async () => {
    try {
      await downloadService.downloadFile(file.id, file.original_name);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const handleCopyLink = async () => {
    try {
      let url;
      if (file.is_public) {
        const urlData = await downloadService.getPublicUrl(file.id);
        url = urlData.url;
      } else {
        url = await downloadService.copyUrlToClipboard(file.id, { expiry: 3600 }); // 1 hour
      }
      
      // Copy to clipboard
      await navigator.clipboard.writeText(url);
      toast.success(file.is_public ? 'Public link copied!' : 'Private link copied!');
    } catch (error) {
      console.error('Failed to copy link:', error);
      toast.error('Failed to copy link to clipboard');
    }
  };

  const copyPublicUrl = async () => {
    if (publicUrl) {
      try {
        await navigator.clipboard.writeText(publicUrl);
        toast.success('Public URL copied!');
      } catch (error) {
        toast.error('Failed to copy public URL');
      }
    }
  };

  const isImage = file?.mime_type?.startsWith('image/');
  const FileIcon = getFileIcon(file?.mime_type);

  if (!file) return null;

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
            className="card max-w-4xl w-full h-full md:h-auto md:max-h-[90vh] overflow-hidden md:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-surface-variant-light dark:border-surface-variant-dark">
              <div className="flex items-center gap-3">
                <FileIcon className="w-6 h-6 text-primary-light dark:text-primary-dark" />
                {isEditing ? (
                  <input
                    type="text"
                    value={editData.original_name}
                    onChange={(e) => setEditData({ ...editData, original_name: e.target.value })}
                    className="text-xl font-semibold bg-transparent border-b border-primary-light dark:border-primary-dark focus:outline-none text-text-primary-light dark:text-text-primary-dark"
                  />
                ) : (
                  <h2 className="text-xl font-semibold text-text-primary-light dark:text-text-primary-dark">
                    {file.original_name}
                  </h2>
                )}
                {file.version > 1 && (
                  <span className="px-2 py-1 text-xs rounded-full bg-secondary-light bg-opacity-10 text-secondary-light">
                    v{file.version}
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="p-2 text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      className="btn-primary text-sm"
                    >
                      Save
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="p-2 text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark"
                      title="Edit file"
                    >
                      <Edit3 className="w-5 h-5" />
                    </button>
                    {transformService.isImage(file.mime_type) && (
                      <button
                        onClick={() => window.dispatchEvent(new CustomEvent('openImageTransform', { detail: file }))}
                        className="p-2 text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark"
                        title="Transform image"
                      >
                        <Image className="w-5 h-5" />
                      </button>
                    )}
                    <button
                      onClick={() => window.dispatchEvent(new CustomEvent('openVersionHistory', { detail: file }))}
                      className="p-2 text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark"
                      title="Version history"
                    >
                      <History className="w-5 h-5" />
                    </button>
                    <button
                      onClick={handleCopyLink}
                      className="p-2 text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark"
                      title="Copy link"
                    >
                      <LinkIcon className="w-5 h-5" />
                    </button>
                    <button
                      onClick={handleDownload}
                      className="p-2 text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark"
                      title="Download file"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                  </>
                )}
                <button
                  onClick={onClose}
                  className="p-2 text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row h-full lg:h-auto">
              {/* Preview Area */}
              <div className="flex-1 p-4 md:p-6 flex items-center justify-center bg-surface-light dark:bg-surface-dark min-h-[200px] md:min-h-[300px]">
                {isLoadingPreview ? (
                  <div className="text-center">
                    <div className="animate-spin w-8 h-8 border-2 border-primary-light border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-text-secondary-light dark:text-text-secondary-dark">
                      Loading preview...
                    </p>
                  </div>
                ) : isImage && previewUrl ? (
                  <motion.img
                    key={previewUrl}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    src={previewUrl}
                    alt={file.original_name}
                    className="max-w-full max-h-full object-contain rounded-lg"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="text-center">
                    <FileIcon className="w-24 h-24 text-text-secondary-light dark:text-text-secondary-dark mx-auto mb-4" />
                    <p className="text-text-secondary-light dark:text-text-secondary-dark">
                      {isImage ? 'Preview not available' : 'Preview not available for this file type'}
                    </p>
                  </div>
                )}
              </div>

              {/* Metadata Panel */}
              <div className="w-full lg:w-80 p-4 md:p-6 bg-surface-variant-light dark:bg-surface-variant-dark border-t lg:border-t-0 lg:border-l border-surface-variant-light dark:border-surface-variant-dark overflow-y-auto">
                <h3 className="font-semibold text-text-primary-light dark:text-text-primary-dark mb-4">
                  File Details
                </h3>
                
                <div className="space-y-4">
                  {/* Visibility Toggle */}
                  <div className="p-4 rounded-lg border border-surface-variant-light dark:border-surface-variant-dark">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {file.is_public ? (
                          <Globe className="w-4 h-4 text-warning-light" />
                        ) : (
                          <Lock className="w-4 h-4 text-accent-light" />
                        )}
                        <span className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
                          Visibility
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleVisibilityToggle(false)}
                          className={`px-3 py-1 text-xs rounded-full transition-colors ${
                            !file.is_public
                              ? 'bg-accent-light text-white'
                              : 'bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark hover:bg-accent-light hover:bg-opacity-10'
                          }`}
                        >
                          Private
                        </button>
                        <button
                          onClick={() => handleVisibilityToggle(true)}
                          className={`px-3 py-1 text-xs rounded-full transition-colors ${
                            file.is_public
                              ? 'bg-warning-light text-white'
                              : 'bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark hover:bg-warning-light hover:bg-opacity-10'
                          }`}
                        >
                          Public
                        </button>
                      </div>
                    </div>
                    
                    <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                      {file.is_public 
                        ? 'Anyone with the link can access this file'
                        : 'Only you and authorized users can access this file'
                      }
                    </p>
                    
                    {file.is_public && (
                      <button
                        onClick={handleCopyLink}
                        className="mt-2 w-full flex items-center justify-center gap-2 py-2 text-xs bg-warning-light bg-opacity-10 text-warning-light rounded-lg hover:bg-opacity-20 transition-colors"
                      >
                        <Copy className="w-3 h-3" />
                        Copy Public Link
                      </button>
                    )}
                  </div>

                  {/* Basic Info */}
                  <div>
                    <label className="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wide">
                      File Name
                    </label>
                    <p className="text-sm text-text-primary-light dark:text-text-primary-dark mt-1 break-all">
                      {file.original_name}
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wide">
                      Size
                    </label>
                    <p className="text-sm text-text-primary-light dark:text-text-primary-dark mt-1">
                      {formatFileSize(file.size)}
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wide">
                      Type
                    </label>
                    <p className="text-sm text-text-primary-light dark:text-text-primary-dark mt-1">
                      {file.mime_type}
                    </p>
                  </div>

                  {/* Dates */}
                  <div>
                    <label className="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wide">
                      <Calendar className="w-3 h-3 inline mr-1" />
                      Created
                    </label>
                    <p className="text-sm text-text-primary-light dark:text-text-primary-dark mt-1">
                      {formatDate(file.created_at)}
                    </p>
                  </div>

                  {file.updated_at && file.updated_at !== file.created_at && (
                    <div>
                      <label className="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wide">
                        Last Modified
                      </label>
                      <p className="text-sm text-text-primary-light dark:text-text-primary-dark mt-1">
                        {formatDate(file.updated_at)}
                      </p>
                    </div>
                  )}

                  {/* Bucket Info */}
                  {file.bucket_name && (
                    <div>
                      <label className="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wide">
                        <FolderOpen className="w-3 h-3 inline mr-1" />
                        Bucket
                      </label>
                      <p className="text-sm text-text-primary-light dark:text-text-primary-dark mt-1">
                        {file.bucket_name}
                      </p>
                    </div>
                  )}

                  {/* File Hash */}
                  {file.file_hash && (
                    <div>
                      <label className="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wide mb-2 block">
                        File Hash
                      </label>
                      <HashDisplay 
                        hash={file.file_hash}
                        fileId={file.id}
                        filename={file.original_name}
                        onVerify={async (fileId) => {
                          const response = await filesAPI.verifyIntegrity(fileId);
                          return response.data;
                        }}
                      />
                    </div>
                  )}

                  {/* Created By */}
                  {file.created_by_email && (
                    <div>
                      <label className="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wide">
                        <User className="w-3 h-3 inline mr-1" />
                        Created By
                      </label>
                      <p className="text-sm text-text-primary-light dark:text-text-primary-dark mt-1">
                        {file.created_by_email}
                      </p>
                    </div>
                  )}

                  {/* Version History */}
                  {file.versions && file.versions.length > 0 && (
                    <div>
                      <label className="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wide mb-2 block">
                        Version History
                      </label>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {file.versions.map((version) => (
                          <div key={version.id} className="flex items-center justify-between text-xs p-2 rounded bg-surface-light dark:bg-surface-dark">
                            <span className="text-text-primary-light dark:text-text-primary-dark">
                              v{version.version_number}
                            </span>
                            <span className="text-text-secondary-light dark:text-text-secondary-dark">
                              {formatDate(version.created_at)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Metadata JSON */}
                  {file.metadata_json && Object.keys(JSON.parse(file.metadata_json || '{}')).length > 0 && (
                    <div>
                      <label className="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wide mb-2 block">
                        Custom Metadata
                      </label>
                      <div className="text-xs font-mono bg-surface-light dark:bg-surface-dark p-2 rounded max-h-32 overflow-y-auto">
                        <pre className="text-text-secondary-light dark:text-text-secondary-dark whitespace-pre-wrap">
                          {JSON.stringify(JSON.parse(file.metadata_json), null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Visibility Confirmation Modal */}
          <AnimatePresence>
            {showVisibilityConfirm && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-60 p-4"
                onClick={() => setShowVisibilityConfirm(false)}
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="card max-w-md w-full p-6"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-start gap-3 mb-4">
                    {pendingVisibility ? (
                      <AlertTriangle className="w-6 h-6 text-warning-light flex-shrink-0 mt-0.5" />
                    ) : (
                      <Lock className="w-6 h-6 text-accent-light flex-shrink-0 mt-0.5" />
                    )}
                    <div>
                      <h3 className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark mb-2">
                        {pendingVisibility ? 'Make File Public?' : 'Make File Private?'}
                      </h3>
                      <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                        {pendingVisibility 
                          ? 'This file will be accessible by anyone with the link. This action can be reversed.'
                          : 'This file will only be accessible to authorized users. Public links will stop working.'
                        }
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowVisibilityConfirm(false)}
                      className="flex-1 btn-secondary"
                      disabled={isTogglingVisibility}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmVisibilityChange}
                      disabled={isTogglingVisibility}
                      className={`flex-1 px-4 py-2 rounded-lg font-medium transition-opacity disabled:opacity-50 ${
                        pendingVisibility 
                          ? 'bg-warning-light hover:bg-opacity-90 text-white'
                          : 'bg-accent-light hover:bg-opacity-90 text-white'
                      }`}
                    >
                      {isTogglingVisibility ? 'Updating...' : `Make ${pendingVisibility ? 'Public' : 'Private'}`}
                    </button>
                  </div>

                  {/* Show public URL after making public */}
                  {publicUrl && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-4 p-3 bg-warning-light bg-opacity-10 rounded-lg border border-warning-light border-opacity-20"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Check className="w-4 h-4 text-warning-light" />
                        <span className="text-sm font-medium text-warning-light">
                          File is now public
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={publicUrl}
                          readOnly
                          className="flex-1 text-xs bg-surface-light dark:bg-surface-dark border border-surface-variant-light dark:border-surface-variant-dark rounded px-2 py-1"
                        />
                        <button
                          onClick={copyPublicUrl}
                          className="p-1 text-warning-light hover:bg-warning-light hover:bg-opacity-10 rounded"
                          title="Copy URL"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FilePreviewModal;