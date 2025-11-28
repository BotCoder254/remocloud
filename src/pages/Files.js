import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Files as FilesIcon, 
  Upload, 
  Download, 
  Trash2, 
  Eye,
  EyeOff,
  Filter,
  Search,
  FolderOpen,
  Image,
  Video,
  Music,
  FileText,
  File,
  MoreVertical,
  ChevronDown,
  SortAsc,
  SortDesc,
  Loader,
  Link as LinkIcon,
  Copy,
  History,
  RotateCcw,
  Clock
} from 'lucide-react';
import { filesAPI, bucketsAPI } from '../services/api';
import { useQuery } from '@tanstack/react-query';
import UploadZone from '../components/ui/UploadZone';
import FilePreviewModal from '../components/ui/FilePreviewModal';
import VersionHistoryModal from '../components/ui/VersionHistoryModal';
import DeleteConfirmModal from '../components/ui/DeleteConfirmModal';
import ImageTransformModal from '../components/ui/ImageTransformModal';
import { downloadService } from '../services/download';
import transformService from '../services/transforms';
import { useToast } from '../components/ui/Toast';

const Files = () => {
  const toast = useToast();
  const [selectedBucket, setSelectedBucket] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showUploadZone, setShowUploadZone] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showImageTransform, setShowImageTransform] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [filters, setFilters] = useState({
    type: '',
    sortBy: 'created_at',
    sortOrder: 'DESC'
  });
  const [showFilters, setShowFilters] = useState(false);
  
  const queryClient = useQueryClient();

  // Listen for events from preview modal
  React.useEffect(() => {
    const handleVersionHistoryEvent = (event) => {
      setSelectedFile(event.detail);
      setShowPreview(false);
      setShowVersionHistory(true);
    };

    const handleImageTransformEvent = (event) => {
      setSelectedImageFile(event.detail);
      setShowPreview(false);
      setShowImageTransform(true);
    };

    window.addEventListener('openVersionHistory', handleVersionHistoryEvent);
    window.addEventListener('openImageTransform', handleImageTransformEvent);
    
    return () => {
      window.removeEventListener('openVersionHistory', handleVersionHistoryEvent);
      window.removeEventListener('openImageTransform', handleImageTransformEvent);
    };
  }, []);

  const { data: buckets = [] } = useQuery({
    queryKey: ['buckets'],
    queryFn: () => bucketsAPI.getAll().then(res => res.data)
  });

  // Infinite query for files with pagination
  const {
    data: filesData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch
  } = useInfiniteQuery({
    queryKey: ['files', selectedBucket, searchQuery, filters],
    queryFn: ({ pageParam }) => {
      const params = {
        cursor: pageParam,
        limit: 20,
        q: searchQuery || undefined,
        type: filters.type || undefined,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder
      };
      
      return selectedBucket 
        ? filesAPI.getBucketFiles(selectedBucket, params).then(res => res.data)
        : filesAPI.getAll(params).then(res => res.data);
    },
    getNextPageParam: (lastPage) => lastPage.pagination.nextCursor,
    enabled: !!selectedBucket
  });

  // Flatten files from all pages
  const files = useMemo(() => {
    return filesData?.pages?.flatMap(page => page.files) || [];
  }, [filesData]);

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
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleUploadComplete = (result) => {
    queryClient.invalidateQueries(['files', selectedBucket]);
    queryClient.invalidateQueries(['buckets']);
  };

  const handleDownload = async (file) => {
    try {
      await downloadService.downloadFile(file.id, file.original_name);
      toast.success(`Downloading ${file.original_name}`);
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Download failed');
    }
  };

  const handleCopyLink = async (file) => {
    try {
      if (file.is_public) {
        const urlData = await downloadService.getPublicUrl(file.id);
        await navigator.clipboard.writeText(urlData.url);
      } else {
        await downloadService.copyUrlToClipboard(file.id, { expiry: 3600 }); // 1 hour
      }
      toast.success(file.is_public ? 'Public link copied!' : 'Private link copied!');
    } catch (error) {
      console.error('Failed to copy link:', error);
      toast.error('Failed to copy link');
    }
  };

  const handleDeleteClick = (file) => {
    setFileToDelete(file);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!fileToDelete) return;
    
    setIsDeleting(true);
    try {
      const response = await filesAPI.delete(fileToDelete.id);
      queryClient.invalidateQueries(['files', selectedBucket]);
      queryClient.invalidateQueries(['buckets']);
      
      if (response.data.retentionDays) {
        toast.success(`File moved to trash. Recoverable for ${response.data.retentionDays} days.`);
      } else {
        toast.success('File deleted successfully');
      }
      
      setShowDeleteConfirm(false);
      setFileToDelete(null);
    } catch (error) {
      console.error('Delete failed:', error);
      toast.error('Failed to delete file');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleVersionHistory = (file) => {
    setSelectedFile(file);
    setShowVersionHistory(true);
  };

  const handleImageTransform = (file) => {
    setSelectedImageFile(file);
    setShowImageTransform(true);
  };

  const handleRestore = async (fileId) => {
    try {
      await filesAPI.restore(fileId);
      queryClient.invalidateQueries(['files', selectedBucket]);
      queryClient.invalidateQueries(['buckets']);
      toast.success('File restored successfully');
    } catch (error) {
      console.error('Restore failed:', error);
      toast.error('Failed to restore file');
    }
  };

  const handleFileClick = async (file) => {
    try {
      const detailedFile = await filesAPI.getById(file.id);
      setSelectedFile(detailedFile.data);
      setShowPreview(true);
    } catch (error) {
      console.error('Failed to fetch file details:', error);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const fileTypeOptions = [
    { value: '', label: 'All Types' },
    { value: 'image', label: 'Images' },
    { value: 'video', label: 'Videos' },
    { value: 'audio', label: 'Audio' },
    { value: 'text', label: 'Documents' },
    { value: 'application', label: 'Applications' }
  ];

  const sortOptions = [
    { value: 'created_at', label: 'Date Created' },
    { value: 'original_name', label: 'Name' },
    { value: 'size', label: 'Size' },
    { value: 'mime_type', label: 'Type' }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-text-primary-light dark:text-text-primary-dark mb-2">
            Files
          </h1>
          <p className="text-text-secondary-light dark:text-text-secondary-dark">
            Manage and organize your uploaded files
          </p>
        </div>
        
        {selectedBucket && (
          <button
            onClick={() => setShowUploadZone(!showUploadZone)}
            className="btn-primary flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Upload Files
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="card p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Bucket Selection */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-2">
              Select Bucket
            </label>
            <select
              value={selectedBucket}
              onChange={(e) => setSelectedBucket(e.target.value)}
              className="input-field"
            >
              <option value="">Choose a bucket...</option>
              {buckets.map((bucket) => (
                <option key={bucket.id} value={bucket.id}>
                  {bucket.name} ({bucket.file_count || 0} files)
                </option>
              ))}
            </select>
          </div>
          
          {/* Search */}
          {selectedBucket && (
            <div className="flex-1">
              <label className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-2">
                Search Files
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-text-secondary-light dark:text-text-secondary-dark" />
                <input
                  type="text"
                  placeholder="Search files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-field pl-10"
                />
              </div>
            </div>
          )}

          {/* Filters */}
          {selectedBucket && (
            <div className="flex-shrink-0">
              <label className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-2">
                Filters
              </label>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="btn-secondary flex items-center gap-2"
              >
                <Filter className="w-4 h-4" />
                Filters
                <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
              </button>
            </div>
          )}
        </div>

        {/* Filter Panel */}
        <AnimatePresence>
          {showFilters && selectedBucket && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 pt-4 border-t border-surface-variant-light dark:border-surface-variant-dark"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-2">
                    File Type
                  </label>
                  <select
                    value={filters.type}
                    onChange={(e) => handleFilterChange('type', e.target.value)}
                    className="input-field"
                  >
                    {fileTypeOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-2">
                    Sort By
                  </label>
                  <select
                    value={filters.sortBy}
                    onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                    className="input-field"
                  >
                    {sortOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-2">
                    Sort Order
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleFilterChange('sortOrder', 'ASC')}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border transition-colors ${
                        filters.sortOrder === 'ASC'
                          ? 'border-primary-light bg-primary-light bg-opacity-10 text-primary-light'
                          : 'border-surface-variant-light dark:border-surface-variant-dark text-text-secondary-light dark:text-text-secondary-dark'
                      }`}
                    >
                      <SortAsc className="w-4 h-4" />
                      Asc
                    </button>
                    <button
                      onClick={() => handleFilterChange('sortOrder', 'DESC')}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border transition-colors ${
                        filters.sortOrder === 'DESC'
                          ? 'border-primary-light bg-primary-light bg-opacity-10 text-primary-light'
                          : 'border-surface-variant-light dark:border-surface-variant-dark text-text-secondary-light dark:text-text-secondary-dark'
                      }`}
                    >
                      <SortDesc className="w-4 h-4" />
                      Desc
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Upload Zone */}
      <AnimatePresence>
        {showUploadZone && selectedBucket && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="card p-6"
          >
            <UploadZone
              bucketId={selectedBucket}
              onUploadComplete={handleUploadComplete}
              onUploadError={(error) => console.error('Upload error:', error)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Files List */}
      {!selectedBucket ? (
        <div className="card p-12 text-center">
          <FolderOpen className="w-16 h-16 text-text-secondary-light dark:text-text-secondary-dark mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-text-primary-light dark:text-text-primary-dark mb-2">
            Select a Bucket
          </h3>
          <p className="text-text-secondary-light dark:text-text-secondary-dark">
            Choose a bucket to view and manage your files
          </p>
        </div>
      ) : isLoading ? (
        <div className="card p-8 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary-light border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-text-secondary-light dark:text-text-secondary-dark">Loading files...</p>
        </div>
      ) : files.length === 0 ? (
        <div className="card p-12 text-center">
          <FilesIcon className="w-16 h-16 text-text-secondary-light dark:text-text-secondary-dark mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-text-primary-light dark:text-text-primary-dark mb-2">
            {searchQuery ? 'No files found' : 'No files yet'}
          </h3>
          <p className="text-text-secondary-light dark:text-text-secondary-dark mb-6">
            {searchQuery 
              ? 'Try adjusting your search terms or filters'
              : 'Upload your first file to get started'
            }
          </p>
          {!searchQuery && (
            <button
              onClick={() => setShowUploadZone(true)}
              className="btn-primary"
            >
              Upload Files
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Desktop Table */}
          <div className="hidden md:block card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-surface-variant-light dark:bg-surface-variant-dark">
                  <tr>
                    <th className="text-left p-4 font-medium text-text-primary-light dark:text-text-primary-dark">Name</th>
                    <th className="text-left p-4 font-medium text-text-primary-light dark:text-text-primary-dark">Size</th>
                    <th className="text-left p-4 font-medium text-text-primary-light dark:text-text-primary-dark">Type</th>
                    <th className="text-left p-4 font-medium text-text-primary-light dark:text-text-primary-dark">Visibility</th>
                    <th className="text-left p-4 font-medium text-text-primary-light dark:text-text-primary-dark">Uploaded</th>
                    <th className="text-right p-4 font-medium text-text-primary-light dark:text-text-primary-dark">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file) => {
                    const FileIcon = getFileIcon(file.mime_type);
                    
                    return (
                      <tr key={file.id} className="border-t border-surface-variant-light dark:border-surface-variant-dark hover:bg-surface-variant-light dark:hover:bg-surface-variant-dark transition-colors">
                        <td className="p-4">
                          <button
                            onClick={() => handleFileClick(file)}
                            className="flex items-center gap-3 text-left hover:text-primary-light dark:hover:text-primary-dark transition-colors"
                          >
                            <FileIcon className="w-5 h-5 text-text-secondary-light dark:text-text-secondary-dark" />
                            <div>
                              <span className={`font-medium ${
                                file.is_deleted 
                                  ? 'text-text-secondary-light dark:text-text-secondary-dark line-through'
                                  : 'text-text-primary-light dark:text-text-primary-dark'
                              }`}>
                                {file.original_name}
                              </span>
                              {file.version > 1 && (
                                <span className="ml-2 px-1 py-0.5 text-xs rounded bg-secondary-light bg-opacity-10 text-secondary-light">
                                  v{file.version}
                                </span>
                              )}
                              {file.is_deleted && (
                                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-danger-light bg-opacity-10 text-danger-light flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  Deleted
                                </span>
                              )}
                            </div>
                          </button>
                        </td>
                        <td className="p-4 text-text-secondary-light dark:text-text-secondary-dark">
                          {formatFileSize(file.size)}
                        </td>
                        <td className="p-4 text-text-secondary-light dark:text-text-secondary-dark">
                          {file.mime_type}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1">
                            {file.is_public ? (
                              <div 
                                className="flex items-center gap-1 px-2 py-1 rounded-full bg-warning-light bg-opacity-10 text-warning-light cursor-pointer hover:bg-opacity-20 transition-colors"
                                onClick={() => handleCopyLink(file)}
                                title="Click to copy public link"
                              >
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
                        </td>
                        <td className="p-4 text-text-secondary-light dark:text-text-secondary-dark">
                          {formatDate(file.created_at)}
                        </td>
                        <td className="p-4">
                          <div className="flex justify-end gap-2">
                            {file.is_deleted ? (
                              <>
                                <button
                                  onClick={() => handleRestore(file.id)}
                                  className="p-2 text-accent-light hover:bg-accent-light hover:bg-opacity-10 rounded-lg transition-colors"
                                  title="Restore file"
                                >
                                  <RotateCcw className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteClick(file)}
                                  className="p-2 text-danger-light hover:bg-danger-light hover:bg-opacity-10 rounded-lg transition-colors"
                                  title="Delete permanently"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            ) : (
                              <>
                                {transformService.isImage(file.mime_type) && (
                                  <button
                                    onClick={() => handleImageTransform(file)}
                                    className="p-2 text-accent-light hover:bg-accent-light hover:bg-opacity-10 rounded-lg transition-colors"
                                    title="Transform image"
                                  >
                                    <Image className="w-4 h-4" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleVersionHistory(file)}
                                  className="p-2 text-secondary-light hover:bg-secondary-light hover:bg-opacity-10 rounded-lg transition-colors"
                                  title="Version history"
                                >
                                  <History className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleCopyLink(file)}
                                  className="p-2 text-secondary-light hover:bg-secondary-light hover:bg-opacity-10 rounded-lg transition-colors"
                                  title="Copy link"
                                >
                                  <LinkIcon className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDownload(file)}
                                  className="p-2 text-primary-light hover:bg-primary-light hover:bg-opacity-10 rounded-lg transition-colors"
                                  title="Download"
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteClick(file)}
                                  className="p-2 text-danger-light hover:bg-danger-light hover:bg-opacity-10 rounded-lg transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-4">
            {files.map((file) => {
              const FileIcon = getFileIcon(file.mime_type);
              
              return (
                <div key={file.id} className="card p-4">
                  <button
                    onClick={() => handleFileClick(file)}
                    className="w-full text-left"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <FileIcon className="w-5 h-5 text-text-secondary-light dark:text-text-secondary-dark flex-shrink-0" />
                        <div className="min-w-0">
                          <h3 className={`font-medium truncate ${
                            file.is_deleted 
                              ? 'text-text-secondary-light dark:text-text-secondary-dark line-through'
                              : 'text-text-primary-light dark:text-text-primary-dark'
                          }`}>
                            {file.original_name}
                            {file.version > 1 && (
                              <span className="ml-2 px-1 py-0.5 text-xs rounded bg-secondary-light bg-opacity-10 text-secondary-light">
                                v{file.version}
                              </span>
                            )}
                            {file.is_deleted && (
                              <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-danger-light bg-opacity-10 text-danger-light">
                                Deleted
                              </span>
                            )}
                          </h3>
                          <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                            {formatFileSize(file.size)} • {formatDate(file.created_at)}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {file.is_public ? (
                          <div 
                            className="flex items-center gap-1 px-2 py-1 rounded-full bg-warning-light bg-opacity-10 text-warning-light cursor-pointer hover:bg-opacity-20 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyLink(file);
                            }}
                            title="Tap to copy public link"
                          >
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
                  </button>
                  
                  <div className={`${file.is_deleted ? 'grid-cols-2' : transformService.isImage(file.mime_type) ? 'grid-cols-5' : 'grid-cols-4'} grid gap-2 pt-3 border-t border-surface-variant-light dark:border-surface-variant-dark`}>
                    {file.is_deleted ? (
                      <>
                        <button
                          onClick={() => handleRestore(file.id)}
                          className="flex items-center justify-center gap-2 py-2 text-accent-light hover:bg-accent-light hover:bg-opacity-10 rounded-lg transition-colors"
                        >
                          <RotateCcw className="w-4 h-4" />
                          Restore
                        </button>
                        <button
                          onClick={() => handleDeleteClick(file)}
                          className="flex items-center justify-center gap-2 py-2 text-danger-light hover:bg-danger-light hover:bg-opacity-10 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </>
                    ) : (
                      <>
                        {transformService.isImage(file.mime_type) && (
                          <button
                            onClick={() => handleImageTransform(file)}
                            className="flex items-center justify-center gap-2 py-2 text-accent-light hover:bg-accent-light hover:bg-opacity-10 rounded-lg transition-colors"
                          >
                            <Image className="w-4 h-4" />
                            Transform
                          </button>
                        )}
                        <button
                          onClick={() => handleVersionHistory(file)}
                          className="flex items-center justify-center gap-2 py-2 text-secondary-light hover:bg-secondary-light hover:bg-opacity-10 rounded-lg transition-colors"
                        >
                          <History className="w-4 h-4" />
                          Versions
                        </button>
                        <button
                          onClick={() => handleCopyLink(file)}
                          className="flex items-center justify-center gap-2 py-2 text-secondary-light hover:bg-secondary-light hover:bg-opacity-10 rounded-lg transition-colors"
                        >
                          <LinkIcon className="w-4 h-4" />
                          Copy
                        </button>
                        <button
                          onClick={() => handleDownload(file)}
                          className="flex items-center justify-center gap-2 py-2 text-primary-light hover:bg-primary-light hover:bg-opacity-10 rounded-lg transition-colors"
                        >
                          <Download className="w-4 h-4" />
                          Download
                        </button>
                        <button
                          onClick={() => handleDeleteClick(file)}
                          className="flex items-center justify-center gap-2 py-2 text-danger-light hover:bg-danger-light hover:bg-opacity-10 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Load More Button */}
          {hasNextPage && (
            <div className="text-center">
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="btn-secondary flex items-center gap-2 mx-auto"
              >
                {isFetchingNextPage ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Load More Files'
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* File Preview Modal */}
      <FilePreviewModal
        file={selectedFile}
        isOpen={showPreview}
        onClose={() => {
          setShowPreview(false);
          setSelectedFile(null);
        }}
        onUpdate={() => {
          refetch();
          queryClient.invalidateQueries(['files', selectedBucket]);
        }}
      />

      {/* Version History Modal */}
      <VersionHistoryModal
        file={selectedFile}
        isOpen={showVersionHistory}
        onClose={() => {
          setShowVersionHistory(false);
          setSelectedFile(null);
        }}
        onUpdate={() => {
          refetch();
          queryClient.invalidateQueries(['files', selectedBucket]);
        }}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        file={fileToDelete}
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setFileToDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleting}
        retentionDays={7}
      />

      {/* Image Transform Modal */}
      <ImageTransformModal
        file={selectedImageFile}
        isOpen={showImageTransform}
        onClose={() => {
          setShowImageTransform(false);
          setSelectedImageFile(null);
        }}
      />
    </div>
  );
};

export default Files;