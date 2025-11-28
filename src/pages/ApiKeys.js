import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Key, 
  Plus, 
  Copy, 
  Trash2, 
  Eye, 
  EyeOff,
  Calendar,
  Shield,
  X,
  CheckCircle
} from 'lucide-react';
import { apiKeysAPI } from '../services/api';

const ApiKeys = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState(['read', 'write']);
  const [createdKey, setCreatedKey] = useState(null);
  const [showCreatedKey, setShowCreatedKey] = useState(false);
  const [keySafely, setKeySafely] = useState(false);
  
  const queryClient = useQueryClient();

  const { data: apiKeys = [], isLoading } = useQuery({
    queryKey: ['apiKeys'],
    queryFn: () => apiKeysAPI.getAll().then(res => res.data)
  });

  const createMutation = useMutation({
    mutationFn: ({ name, scopes }) => apiKeysAPI.create(name, scopes),
    onSuccess: (response) => {
      setCreatedKey(response.data);
      setShowCreateModal(false);
      setNewKeyName('');
      setNewKeyScopes(['read', 'write']);
      queryClient.invalidateQueries(['apiKeys']);
    }
  });

  const revokeMutation = useMutation({
    mutationFn: (keyId) => apiKeysAPI.revoke(keyId),
    onSuccess: () => {
      queryClient.invalidateQueries(['apiKeys']);
    }
  });

  const handleCreate = (e) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    createMutation.mutate({ name: newKeyName, scopes: newKeyScopes });
  };

  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      // TODO: Show toast notification
    } catch (error) {
      console.error('Failed to copy:', error);
    }
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

  const handleKeySafelyStored = () => {
    if (keySafely) {
      setCreatedKey(null);
      setKeySafely(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-text-primary-light dark:text-text-primary-dark mb-2">
            API Keys
          </h1>
          <p className="text-text-secondary-light dark:text-text-secondary-dark">
            Manage API keys for programmatic access to your files
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create API Key
        </button>
      </div>

      {/* API Keys List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="card p-8 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-primary-light border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-text-secondary-light dark:text-text-secondary-dark">Loading API keys...</p>
          </div>
        ) : apiKeys.length === 0 ? (
          <div className="card p-8 text-center">
            <Key className="w-12 h-12 text-text-secondary-light dark:text-text-secondary-dark mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark mb-2">
              No API Keys Yet
            </h3>
            <p className="text-text-secondary-light dark:text-text-secondary-dark mb-4">
              Create your first API key to start using the RemoCloud API
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary"
            >
              Create Your First API Key
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {/* Desktop Table */}
            <div className="hidden md:block card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-surface-variant-light dark:bg-surface-variant-dark">
                    <tr>
                      <th className="text-left p-4 font-medium text-text-primary-light dark:text-text-primary-dark">Name</th>
                      <th className="text-left p-4 font-medium text-text-primary-light dark:text-text-primary-dark">Scopes</th>
                      <th className="text-left p-4 font-medium text-text-primary-light dark:text-text-primary-dark">Created</th>
                      <th className="text-left p-4 font-medium text-text-primary-light dark:text-text-primary-dark">Last Used</th>
                      <th className="text-left p-4 font-medium text-text-primary-light dark:text-text-primary-dark">Status</th>
                      <th className="text-right p-4 font-medium text-text-primary-light dark:text-text-primary-dark">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {apiKeys.map((key) => (
                      <tr key={key.id} className="border-t border-surface-variant-light dark:border-surface-variant-dark">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <Key className="w-4 h-4 text-text-secondary-light dark:text-text-secondary-dark" />
                            <span className="font-medium text-text-primary-light dark:text-text-primary-dark">
                              {key.name}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex gap-1">
                            {key.scopes.map((scope) => (
                              <span
                                key={scope}
                                className="px-2 py-1 text-xs rounded-full bg-primary-light bg-opacity-10 text-primary-light dark:text-primary-dark"
                              >
                                {scope}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-4 text-text-secondary-light dark:text-text-secondary-dark">
                          {formatDate(key.created_at)}
                        </td>
                        <td className="p-4 text-text-secondary-light dark:text-text-secondary-dark">
                          {key.last_used_at ? formatDate(key.last_used_at) : 'Never'}
                        </td>
                        <td className="p-4">
                          {key.revoked_at ? (
                            <span className="px-2 py-1 text-xs rounded-full bg-danger-light bg-opacity-10 text-danger-light">
                              Revoked
                            </span>
                          ) : (
                            <span className="px-2 py-1 text-xs rounded-full bg-accent-light bg-opacity-10 text-accent-light">
                              Active
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="flex justify-end gap-2">
                            {!key.revoked_at && (
                              <button
                                onClick={() => revokeMutation.mutate(key.id)}
                                className="p-2 text-danger-light hover:bg-danger-light hover:bg-opacity-10 rounded-lg transition-colors"
                                title="Revoke key"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-4">
              {apiKeys.map((key) => (
                <div key={key.id} className="card p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <Key className="w-4 h-4 text-text-secondary-light dark:text-text-secondary-dark" />
                      <span className="font-medium text-text-primary-light dark:text-text-primary-dark">
                        {key.name}
                      </span>
                    </div>
                    {key.revoked_at ? (
                      <span className="px-2 py-1 text-xs rounded-full bg-danger-light bg-opacity-10 text-danger-light">
                        Revoked
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs rounded-full bg-accent-light bg-opacity-10 text-accent-light">
                        Active
                      </span>
                    )}
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-text-secondary-light dark:text-text-secondary-dark">Scopes:</span>
                      <div className="flex gap-1">
                        {key.scopes.map((scope) => (
                          <span
                            key={scope}
                            className="px-2 py-1 text-xs rounded-full bg-primary-light bg-opacity-10 text-primary-light dark:text-primary-dark"
                          >
                            {scope}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary-light dark:text-text-secondary-dark">Created:</span>
                      <span className="text-text-primary-light dark:text-text-primary-dark">
                        {formatDate(key.created_at)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary-light dark:text-text-secondary-dark">Last Used:</span>
                      <span className="text-text-primary-light dark:text-text-primary-dark">
                        {key.last_used_at ? formatDate(key.last_used_at) : 'Never'}
                      </span>
                    </div>
                  </div>

                  {!key.revoked_at && (
                    <div className="mt-4 pt-4 border-t border-surface-variant-light dark:border-surface-variant-dark">
                      <button
                        onClick={() => revokeMutation.mutate(key.id)}
                        className="w-full flex items-center justify-center gap-2 py-2 text-danger-light hover:bg-danger-light hover:bg-opacity-10 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        Revoke Key
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Create API Key Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="card p-6 max-w-md w-full"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-text-primary-light dark:text-text-primary-dark">
                  Create API Key
                </h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-2">
                    Key Name
                  </label>
                  <input
                    type="text"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    className="input-field"
                    placeholder="e.g., Production API Key"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-2">
                    Scopes
                  </label>
                  <div className="space-y-2">
                    {['read', 'write', 'delete'].map((scope) => (
                      <label key={scope} className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={newKeyScopes.includes(scope)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewKeyScopes([...newKeyScopes, scope]);
                            } else {
                              setNewKeyScopes(newKeyScopes.filter(s => s !== scope));
                            }
                          }}
                          className="w-4 h-4 text-primary-light focus:ring-primary-light border-surface-variant-light dark:border-surface-variant-dark rounded"
                        />
                        <span className="text-sm text-text-primary-light dark:text-text-primary-dark capitalize">
                          {scope}
                        </span>
                      </label>
                    ))}
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
                    {createMutation.isPending ? 'Creating...' : 'Create Key'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Created Key Modal */}
      <AnimatePresence>
        {createdKey && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="card p-6 max-w-md w-full"
            >
              <div className="text-center mb-6">
                <CheckCircle className="w-12 h-12 text-accent-light mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-text-primary-light dark:text-text-primary-dark mb-2">
                  API Key Created
                </h3>
                <p className="text-text-secondary-light dark:text-text-secondary-dark">
                  Copy your API key now. You won't be able to see it again.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-2">
                    API Key
                  </label>
                  <div className="flex gap-2">
                    <input
                      type={showCreatedKey ? 'text' : 'password'}
                      value={createdKey.key}
                      readOnly
                      className="input-field flex-1 font-mono text-sm"
                    />
                    <button
                      onClick={() => setShowCreatedKey(!showCreatedKey)}
                      className="p-3 rounded-lg border border-surface-variant-light dark:border-surface-variant-dark hover:bg-surface-variant-light dark:hover:bg-surface-variant-dark transition-colors"
                    >
                      {showCreatedKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleCopy(createdKey.key)}
                      className="p-3 rounded-lg border border-surface-variant-light dark:border-surface-variant-dark hover:bg-surface-variant-light dark:hover:bg-surface-variant-dark transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={keySafely}
                    onChange={(e) => setKeySafely(e.target.checked)}
                    className="w-4 h-4 text-primary-light focus:ring-primary-light border-surface-variant-light dark:border-surface-variant-dark rounded"
                  />
                  <span className="text-sm text-text-primary-light dark:text-text-primary-dark">
                    I have stored this API key safely
                  </span>
                </label>

                <button
                  onClick={handleKeySafelyStored}
                  disabled={!keySafely}
                  className="w-full btn-primary disabled:opacity-50"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ApiKeys;