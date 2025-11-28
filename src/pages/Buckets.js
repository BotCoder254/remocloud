import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  FolderOpen, 
  Plus, 
  Lock, 
  Unlock, 
  Settings, 
  Trash2, 
  Files,
  HardDrive,
  Eye,
  EyeOff,
  X,
  MoreVertical,
  Edit,
  GitBranch
} from 'lucide-react';
import { bucketsAPI } from '../services/api';
import Modal from '../components/ui/Modal';

const Buckets = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedBucket, setSelectedBucket] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [bucketToDelete, setBucketToDelete] = useState(null);
  const [activeDropdown, setActiveDropdown] = useState(null);
  
  const [newBucket, setNewBucket] = useState({
    name: '',
    is_public_by_default: false,
    versioning_enabled: false,
    allowed_types: ['*']
  });

  const queryClient = useQueryClient();

  const { data: buckets = [], isLoading } = useQuery({
    queryKey: ['buckets'],
    queryFn: () => bucketsAPI.getAll().then(res => res.data)
  });

  const createMutation = useMutation({
    mutationFn: (bucketData) => bucketsAPI.create(bucketData),
    onSuccess: () => {
      queryClient.invalidateQueries(['buckets']);
      setShowCreateModal(false);
      setNewBucket({
        name: '',
        is_public_by_default: false,
        versioning_enabled: false,
        allowed_types: ['*']
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ bucketId, updates }) => bucketsAPI.update(bucketId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries(['buckets']);
      setShowSettingsModal(false);
      setSelectedBucket(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (bucketId) => bucketsAPI.delete(bucketId),
    onSuccess: () => {
      queryClient.invalidateQueries(['buckets']);
      setShowDeleteConfirm(false);
      setBucketToDelete(null);
    }
  });

  const handleCreate = (e) => {
    e.preventDefault();
    if (!newBucket.name.trim()) return;
    createMutation.mutate(newBucket);
  };

  const handleUpdate = (e) => {
    e.preventDefault();
    if (!selectedBucket) return;
    updateMutation.mutate({
      bucketId: selectedBucket.id,
      updates: {
        name: selectedBucket.name,
        is_public_by_default: selectedBucket.is_public_by_default,
        versioning_enabled: selectedBucket.versioning_enabled,
        allowed_types: selectedBucket.allowed_types
      }
    });
  };

  const handleDelete = (bucket) => {
    setBucketToDelete(bucket);
    setShowDeleteConfirm(true);
    setActiveDropdown(null);
  };

  const confirmDelete = () => {
    if (bucketToDelete) {
      deleteMutation.mutate(bucketToDelete.id);
    }
  };

  const openSettings = (bucket) => {
    setSelectedBucket({ ...bucket });
    setShowSettingsModal(true);
    setActiveDropdown(null);
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-text-primary-light dark:text-text-primary-dark mb-2">
            Buckets
          </h1>
          <p className="text-text-secondary-light dark:text-text-secondary-dark">
            Organize your files in logical containers
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Bucket
        </button>
      </div>

      {/* Buckets Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="h-4 bg-surface-variant-light dark:bg-surface-variant-dark rounded mb-4"></div>
              <div className="h-3 bg-surface-variant-light dark:bg-surface-variant-dark rounded mb-2"></div>
              <div className="h-3 bg-surface-variant-light dark:bg-surface-variant-dark rounded w-2/3"></div>
            </div>
          ))}
        </div>
      ) : buckets.length === 0 ? (
        <div className="card p-12 text-center">
          <FolderOpen className="w-16 h-16 text-text-secondary-light dark:text-text-secondary-dark mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-text-primary-light dark:text-text-primary-dark mb-2">
            No Buckets Yet
          </h3>
          <p className="text-text-secondary-light dark:text-text-secondary-dark mb-6">
            Create your first bucket to start organizing your files
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary"
          >
            Create Your First Bucket
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {buckets.map((bucket) => (
            <motion.div
              key={bucket.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="card p-6 hover:shadow-lg transition-shadow relative"
            >
              {/* Dropdown Menu */}
              <div className="absolute top-4 right-4">
                <button
                  onClick={() => setActiveDropdown(activeDropdown === bucket.id ? null : bucket.id)}
                  className="p-2 rounded-lg hover:bg-surface-variant-light dark:hover:bg-surface-variant-dark transition-colors"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
                
                <AnimatePresence>
                  {activeDropdown === bucket.id && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute right-0 mt-2 w-48 card p-2 z-10"
                    >
                      <button
                        onClick={() => openSettings(bucket)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-variant-light dark:hover:bg-surface-variant-dark transition-colors text-left"
                      >
                        <Settings className="w-4 h-4" />
                        Settings
                      </button>
                      <button
                        onClick={() => handleDelete(bucket)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-variant-light dark:hover:bg-surface-variant-dark transition-colors text-left text-danger-light dark:text-danger-dark"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Bucket Header */}
              <div className="flex items-start gap-3 mb-4">
                <div className="w-12 h-12 bg-primary-light bg-opacity-10 rounded-xl flex items-center justify-center">
                  <FolderOpen className="w-6 h-6 text-primary-light dark:text-primary-dark" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-text-primary-light dark:text-text-primary-dark truncate">
                    {bucket.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    {bucket.is_public_by_default ? (
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-warning-light bg-opacity-10 text-warning-light">
                        <Unlock className="w-3 h-3" />
                        <span className="text-xs font-medium">Public Default</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-light bg-opacity-10 text-accent-light">
                        <Lock className="w-3 h-3" />
                        <span className="text-xs font-medium">Private Default</span>
                      </div>
                    )}
                    {bucket.versioning_enabled && (
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-light bg-opacity-10 text-secondary-light">
                        <GitBranch className="w-3 h-3" />
                        <span className="text-xs font-medium">Versioned</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 text-sm text-text-secondary-light dark:text-text-secondary-dark">
                    <Files className="w-4 h-4" />
                    Files
                  </div>
                  <span className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
                    {bucket.file_count || 0}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 text-sm text-text-secondary-light dark:text-text-secondary-dark">
                    <HardDrive className="w-4 h-4" />
                    Storage
                  </div>
                  <span className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
                    {formatBytes(bucket.storage_used)}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-6 pt-4 border-t border-surface-variant-light dark:border-surface-variant-dark">
                <button className="w-full btn-secondary text-sm">
                  Open Bucket
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Bucket Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Bucket"
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleCreate} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-2">
              Bucket Name
            </label>
            <input
              type="text"
              value={newBucket.name}
              onChange={(e) => setNewBucket({ ...newBucket, name: e.target.value })}
              className="input-field"
              placeholder="e.g., my-project-files"
              required
            />
            <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-1">
              Bucket names must be unique and will be used in URLs
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="font-medium text-text-primary-light dark:text-text-primary-dark">
              Default Settings
            </h4>
            
            <label className="flex items-center justify-between p-3 rounded-lg border border-surface-variant-light dark:border-surface-variant-dark hover:bg-surface-variant-light dark:hover:bg-surface-variant-dark transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  newBucket.is_public_by_default 
                    ? 'bg-warning-light bg-opacity-10' 
                    : 'bg-accent-light bg-opacity-10'
                }`}>
                  {newBucket.is_public_by_default ? (
                    <Unlock className="w-4 h-4 text-warning-light" />
                  ) : (
                    <Lock className="w-4 h-4 text-accent-light" />
                  )}
                </div>
                <div>
                  <span className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
                    {newBucket.is_public_by_default ? 'Public by Default' : 'Private by Default'}
                  </span>
                  <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                    {newBucket.is_public_by_default 
                      ? 'New files will be publicly accessible via CDN'
                      : 'New files will require authentication to access'
                    }
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={newBucket.is_public_by_default}
                onChange={(e) => setNewBucket({ ...newBucket, is_public_by_default: e.target.checked })}
                className="w-4 h-4 text-primary-light focus:ring-primary-light border-surface-variant-light dark:border-surface-variant-dark rounded"
              />
            </label>

            <label className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <GitBranch className="w-4 h-4 text-text-secondary-light dark:text-text-secondary-dark" />
                <div>
                  <span className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
                    Enable Versioning
                  </span>
                  <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                    Keep multiple versions of files
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={newBucket.versioning_enabled}
                onChange={(e) => setNewBucket({ ...newBucket, versioning_enabled: e.target.checked })}
                className="w-4 h-4 text-primary-light focus:ring-primary-light border-surface-variant-light dark:border-surface-variant-dark rounded"
              />
            </label>

            <div>
              <label className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-2">
                Allowed File Types
              </label>
              <select
                value={newBucket.allowed_types[0] || '*'}
                onChange={(e) => setNewBucket({ ...newBucket, allowed_types: [e.target.value] })}
                className="input-field"
              >
                <option value="*">All file types</option>
                <option value="image/*">Images only</option>
                <option value="video/*">Videos only</option>
                <option value="audio/*">Audio only</option>
                <option value="text/*">Text files only</option>
                <option value="application/pdf">PDF documents only</option>
              </select>
              <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-1">
                Restrict what file types can be uploaded to this bucket
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="flex-1 btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex-1 btn-primary disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Bucket'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Settings Modal */}
      <Modal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        title="Bucket Settings"
        maxWidth="max-w-lg"
      >
        {selectedBucket && (
          <form onSubmit={handleUpdate} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-2">
                Bucket Name
              </label>
              <input
                type="text"
                value={selectedBucket.name}
                onChange={(e) => setSelectedBucket({ ...selectedBucket, name: e.target.value })}
                className="input-field"
                required
              />
            </div>

            <div className="space-y-4">
              <h4 className="font-medium text-text-primary-light dark:text-text-primary-dark">
                Settings
              </h4>
              
              <label className="flex items-center justify-between p-3 rounded-lg border border-surface-variant-light dark:border-surface-variant-dark hover:bg-surface-variant-light dark:hover:bg-surface-variant-dark transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    selectedBucket.is_public_by_default 
                      ? 'bg-warning-light bg-opacity-10' 
                      : 'bg-accent-light bg-opacity-10'
                  }`}>
                    {selectedBucket.is_public_by_default ? (
                      <Unlock className="w-4 h-4 text-warning-light" />
                    ) : (
                      <Lock className="w-4 h-4 text-accent-light" />
                    )}
                  </div>
                  <div>
                    <span className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
                      {selectedBucket.is_public_by_default ? 'Public by Default' : 'Private by Default'}
                    </span>
                    <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                      {selectedBucket.is_public_by_default 
                        ? 'New files will be publicly accessible via CDN'
                        : 'New files will require authentication to access'
                      }
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={selectedBucket.is_public_by_default}
                  onChange={(e) => setSelectedBucket({ ...selectedBucket, is_public_by_default: e.target.checked })}
                  className="w-4 h-4 text-primary-light focus:ring-primary-light border-surface-variant-light dark:border-surface-variant-dark rounded"
                />
              </label>

              <label className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <GitBranch className="w-4 h-4 text-text-secondary-light dark:text-text-secondary-dark" />
                  <div>
                    <span className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
                      Enable Versioning
                    </span>
                    <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                      Keep multiple versions of files
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={selectedBucket.versioning_enabled}
                  onChange={(e) => setSelectedBucket({ ...selectedBucket, versioning_enabled: e.target.checked })}
                  className="w-4 h-4 text-primary-light focus:ring-primary-light border-surface-variant-light dark:border-surface-variant-dark rounded"
                />
              </label>

              <div>
                <label className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-2">
                  Allowed File Types
                </label>
                <select
                  value={selectedBucket.allowed_types?.[0] || '*'}
                  onChange={(e) => setSelectedBucket({ ...selectedBucket, allowed_types: [e.target.value] })}
                  className="input-field"
                >
                  <option value="*">All file types</option>
                  <option value="image/*">Images only</option>
                  <option value="video/*">Videos only</option>
                  <option value="audio/*">Audio only</option>
                  <option value="text/*">Text files only</option>
                  <option value="application/pdf">PDF documents only</option>
                </select>
                <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-1">
                  Restrict what file types can be uploaded to this bucket
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="flex-1 btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updateMutation.isPending}
                className="flex-1 btn-primary disabled:opacity-50"
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Bucket"
        maxWidth="max-w-md"
      >
        {bucketToDelete && (
          <div className="space-y-4">
            <p className="text-text-secondary-light dark:text-text-secondary-dark">
              Are you sure you want to delete the bucket "{bucketToDelete.name}"? 
              This action cannot be undone and will delete all files in the bucket.
            </p>
            
            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteMutation.isPending}
                className="flex-1 bg-danger-light hover:bg-opacity-90 text-white px-4 py-2 rounded-lg font-medium transition-opacity disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete Bucket'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Buckets;