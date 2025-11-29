import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, RotateCcw, AlertTriangle, Clock, FileText, Image, Video, Music, Archive } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import api from '../services/api';

const Trash = () => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const queryClient = useQueryClient();

  const { data: trashData, isLoading, error } = useQuery({
    queryKey: ['trash'],
    queryFn: () => api.get('/files/trash').then(res => res.data)
  });

  const restoreMutation = useMutation({
    mutationFn: (fileId) => api.post(`/files/${fileId}/restore`),
    onSuccess: () => {
      queryClient.invalidateQueries(['trash']);
      queryClient.invalidateQueries(['files']);
      setSelectedFiles([]);
    }
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: (fileId) => api.delete(`/files/${fileId}?permanent=true`),
    onSuccess: () => {
      queryClient.invalidateQueries(['trash']);
      setSelectedFiles([]);
    }
  });

  const getFileIcon = (mimeType) => {
    if (mimeType?.startsWith('image/')) return <Image className="w-5 h-5 text-blue-500" />;
    if (mimeType?.startsWith('video/')) return <Video className="w-5 h-5 text-purple-500" />;
    if (mimeType?.startsWith('audio/')) return <Music className="w-5 h-5 text-green-500" />;
    if (mimeType?.includes('zip') || mimeType?.includes('rar')) return <Archive className="w-5 h-5 text-orange-500" />;
    return <FileText className="w-5 h-5 text-gray-500" />;
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleSelectFile = (fileId) => {
    setSelectedFiles(prev => 
      prev.includes(fileId) 
        ? prev.filter(id => id !== fileId)
        : [...prev, fileId]
    );
  };

  const handleSelectAll = () => {
    if (selectedFiles.length === trashData?.files?.length) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(trashData?.files?.map(file => file.id) || []);
    }
  };

  const handleRestore = (fileId) => {
    restoreMutation.mutate(fileId);
  };

  const handlePermanentDelete = (fileId) => {
    if (window.confirm('Are you sure you want to permanently delete this file? This action cannot be undone.')) {
      permanentDeleteMutation.mutate(fileId);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="mx-auto h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Error loading trash</h3>
        <p className="text-gray-500 dark:text-gray-400">{error.message}</p>
      </div>
    );
  }

  const files = trashData?.files || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Trash</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Files will be permanently deleted after 7 days
          </p>
        </div>
        
        {files.length > 0 && (
          <div className="flex items-center space-x-3">
            <button
              onClick={handleSelectAll}
              className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              {selectedFiles.length === files.length ? 'Deselect All' : 'Select All'}
            </button>
            
            {selectedFiles.length > 0 && (
              <>
                <button
                  onClick={() => selectedFiles.forEach(handleRestore)}
                  disabled={restoreMutation.isPending}
                  className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  <RotateCcw className="w-4 h-4 mr-2 inline" />
                  Restore Selected
                </button>
                <button
                  onClick={() => {
                    if (window.confirm('Permanently delete selected files? This cannot be undone.')) {
                      selectedFiles.forEach(handlePermanentDelete);
                    }
                  }}
                  disabled={permanentDeleteMutation.isPending}
                  className="px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4 mr-2 inline" />
                  Delete Forever
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {files.length === 0 ? (
        <div className="text-center py-12">
          <Trash2 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Trash is empty</h3>
          <p className="text-gray-500 dark:text-gray-400">Deleted files will appear here</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <input
                      type="checkbox"
                      checked={selectedFiles.length === files.length}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Size
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Deleted
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Expires
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {files.map((file) => (
                  <tr key={file.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedFiles.includes(file.id)}
                        onChange={() => handleSelectFile(file.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getFileIcon(file.mime_type)}
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {file.original_name}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {file.bucket_name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatFileSize(file.size)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatDistanceToNow(new Date(file.deleted_at), { addSuffix: true })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {file.expired ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Expired
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                            <Clock className="w-3 h-3 mr-1" />
                            {formatDistanceToNow(new Date(file.restore_until))}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        {!file.expired && (
                          <button
                            onClick={() => handleRestore(file.id)}
                            disabled={restoreMutation.isPending}
                            className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50"
                            title="Restore file"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handlePermanentDelete(file.id)}
                          disabled={permanentDeleteMutation.isPending}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
                          title="Delete permanently"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Trash;