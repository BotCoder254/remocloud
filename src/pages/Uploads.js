import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { 
  Upload as UploadIcon, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Pause,
  Play,
  X
} from 'lucide-react';
import { bucketsAPI } from '../services/api';
import UploadZone from '../components/ui/UploadZone';

const Uploads = () => {
  const [selectedBucket, setSelectedBucket] = useState('');
  const [uploadHistory, setUploadHistory] = useState([]);

  const { data: buckets = [] } = useQuery({
    queryKey: ['buckets'],
    queryFn: () => bucketsAPI.getAll().then(res => res.data)
  });

  const handleUploadComplete = (result) => {
    setUploadHistory(prev => [...prev, {
      id: Date.now(),
      file: result.file,
      completedAt: new Date(),
      status: 'completed'
    }]);
  };

  const handleUploadError = (error, file) => {
    setUploadHistory(prev => [...prev, {
      id: Date.now(),
      file: { original_name: file.name, size: file.size },
      completedAt: new Date(),
      status: 'error',
      error: error.message
    }]);
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-text-primary-light dark:text-text-primary-dark mb-2">
          Upload Center
        </h1>
        <p className="text-text-secondary-light dark:text-text-secondary-dark">
          Upload files with real-time progress tracking
        </p>
      </div>

      {/* Bucket Selection */}
      <div className="card p-6">
        <label className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-2">
          Select Destination Bucket
        </label>
        <select
          value={selectedBucket}
          onChange={(e) => setSelectedBucket(e.target.value)}
          className="input-field max-w-md"
        >
          <option value="">Choose a bucket...</option>
          {buckets.map((bucket) => (
            <option key={bucket.id} value={bucket.id}>
              {bucket.name}
            </option>
          ))}
        </select>
      </div>

      {/* Upload Zone */}
      {selectedBucket ? (
        <div className="card p-6">
          <UploadZone
            bucketId={selectedBucket}
            onUploadComplete={handleUploadComplete}
            onUploadError={handleUploadError}
          />
        </div>
      ) : (
        <div className="card p-12 text-center">
          <UploadIcon className="w-16 h-16 text-text-secondary-light dark:text-text-secondary-dark mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-text-primary-light dark:text-text-primary-dark mb-2">
            Select a Bucket
          </h3>
          <p className="text-text-secondary-light dark:text-text-secondary-dark">
            Choose a destination bucket to start uploading files
          </p>
        </div>
      )}

      {/* Upload History */}
      {uploadHistory.length > 0 && (
        <div className="card p-6">
          <h2 className="text-xl font-semibold text-text-primary-light dark:text-text-primary-dark mb-4">
            Recent Uploads
          </h2>
          <div className="space-y-3">
            {uploadHistory.slice(-10).reverse().map((upload) => (
              <motion.div
                key={upload.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between p-4 rounded-lg border border-surface-variant-light dark:border-surface-variant-dark"
              >
                <div className="flex items-center gap-3">
                  {upload.status === 'completed' ? (
                    <CheckCircle className="w-5 h-5 text-accent-light" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-danger-light" />
                  )}
                  <div>
                    <h4 className="font-medium text-text-primary-light dark:text-text-primary-dark">
                      {upload.file.original_name}
                    </h4>
                    <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                      {formatFileSize(upload.file.size)} • {formatTime(upload.completedAt)}
                      {upload.error && ` • ${upload.error}`}
                    </p>
                  </div>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  upload.status === 'completed'
                    ? 'bg-accent-light bg-opacity-10 text-accent-light'
                    : 'bg-danger-light bg-opacity-10 text-danger-light'
                }`}>
                  {upload.status === 'completed' ? 'Completed' : 'Failed'}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Uploads;