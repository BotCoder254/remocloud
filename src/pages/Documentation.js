import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Book, 
  Code, 
  Copy, 
  Check,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  Download,
  Zap,
  Layers,
  BarChart3,
  Upload,
  Image,
  Shield,
  Hash,
  Key,
  Database,
  Settings
} from 'lucide-react';

const Documentation = () => {
  const [activeSection, setActiveSection] = useState('getting-started');
  const [copiedCode, setCopiedCode] = useState(null);
  const [expandedSections, setExpandedSections] = useState({
    'getting-started': true,
    'react-hooks': false,
    'api-reference': false,
    'uploads': false,
    'transforms': false,
    'security': false,
    'analytics': false,
    'examples': false
  });

  const copyToClipboard = async (code, id) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(id);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const CodeBlock = ({ code, language = 'javascript', id }) => (
    <div className="relative bg-gray-900 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <span className="text-xs text-gray-400 uppercase font-medium">{language}</span>
        <button
          onClick={() => copyToClipboard(code, id)}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors"
        >
          {copiedCode === id ? (
            <>
              <Check className="w-3 h-3" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              Copy
            </>
          )}
        </button>
      </div>
      <pre className="p-4 text-sm text-gray-100 overflow-x-auto">
        <code>{code}</code>
      </pre>
    </div>
  );

  const Sidebar = () => (
    <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 h-full overflow-y-auto">
      <div className="p-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Documentation</h2>
        <nav className="space-y-1">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${
                  activeSection === section.id
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {section.title}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );

  const sections = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      icon: Zap,
      content: (
        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-semibold mb-4">Installation</h3>
            <CodeBlock
              id="install"
              language="bash"
              code="npm install @remocloud/sdk"
            />
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-4">Quick Start</h3>
            <CodeBlock
              id="quickstart"
              code={`import RemoCloudSDK from '@remocloud/sdk';

// Initialize the SDK
const sdk = RemoCloudSDK.init({
  baseUrl: 'https://api.remocloud.dev',
  apiKey: 'your-api-key'
});

// Upload a file
const file = document.getElementById('fileInput').files[0];
const result = await sdk.files.upload('bucket-id', file, {
  onProgress: (progress) => console.log(\`Upload: \${progress}%\`)
});

// Get files
const files = await sdk.files.list('bucket-id');

// Download a file
const { url } = await sdk.files.getDownloadUrl('file-id');`}
            />
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-4">Environment Setup</h3>
            <CodeBlock
              id="env"
              language="bash"
              code={`# .env
REMOCLOUD_API_KEY=your-api-key
REMOCLOUD_BASE_URL=https://api.remocloud.dev`}
            />
          </div>
        </div>
      )
    },
    {
      id: 'uploads',
      title: 'File Uploads',
      icon: Upload,
      content: (
        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-semibold mb-4">Direct Upload with Progress</h3>
            <CodeBlock
              id="direct-upload"
              code={`// Direct upload with progress tracking
const file = document.getElementById('fileInput').files[0];

const result = await sdk.upload('bucket-id', file, {
  onProgress: (progress, loaded, total) => {
    console.log(\`Upload: \${progress}% (\${loaded}/\${total} bytes)\`);
    updateProgressBar(progress);
  },
  onError: (error) => {
    console.error('Upload failed:', error);
  },
  onComplete: (result) => {
    console.log('Upload completed:', result);
  }
});

console.log('File uploaded:', result.file);`}
            />
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-4">Upload Session Management</h3>
            <CodeBlock
              id="upload-session"
              code={`// Get upload status
const status = await sdk.getUploadStatus('upload-id');
console.log('Status:', status.status); // 'pending', 'uploading', 'completed', 'failed'

// Cancel upload
await sdk.cancelUpload('upload-id');

// File validation before upload
const validation = sdk.validateFileType(file, ['image/*', 'video/*']);
if (!validation.isValid) {
  console.error('Validation errors:', validation.errors);
  return;
}

// Check for duplicates
const hash = await sdk.computeFileHash(file);
const duplicate = await sdk.checkDuplicate('bucket-id', hash);
if (duplicate.exists) {
  console.log('File already exists:', duplicate.file);
}`}
            />
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-4">Batch Upload</h3>
            <CodeBlock
              id="batch-upload"
              code={`// Upload multiple files
const files = Array.from(document.getElementById('multipleFiles').files);
const uploads = [];

for (const file of files) {
  const upload = sdk.upload('bucket-id', file, {
    onProgress: (progress) => {
      updateFileProgress(file.name, progress);
    }
  });
  uploads.push(upload);
}

// Wait for all uploads to complete
const results = await Promise.allSettled(uploads);
const successful = results.filter(r => r.status === 'fulfilled');
const failed = results.filter(r => r.status === 'rejected');

console.log(\`\${successful.length} uploaded, \${failed.length} failed\`);`}
            />
          </div>
        </div>
      )
    },
    {
      id: 'transforms',
      title: 'Image Transforms',
      icon: Image,
      content: (
        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-semibold mb-4">Basic Transforms</h3>
            <CodeBlock
              id="basic-transforms"
              code={`// Resize and optimize image
const { url } = await sdk.getTransformedUrl('file-id', {
  w: 300,
  h: 300,
  q: 85,
  format: 'webp'
});

// Use preset transforms
const { url: thumbnail } = await sdk.getTransformedUrl('file-id', {
  preset: 'thumbnail'
});

// Available presets
const presets = sdk.getCommonPresets();
/*
{
  thumbnail: { w: 150, h: 150, q: 80, format: 'webp' },
  small: { w: 300, h: 300, q: 85, format: 'webp' },
  medium: { w: 600, h: 600, q: 85, format: 'webp' },
  large: { w: 1200, h: 1200, q: 90, format: 'webp' }
}
*/`}
            />
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-4">Responsive Images</h3>
            <CodeBlock
              id="responsive-images"
              code={`// Generate responsive srcset
const { srcset, entries } = await sdk.getSrcSet('file-id', {
  breakpoints: '300,600,900,1200',
  format: 'webp'
});

// Use in HTML
const img = document.createElement('img');
img.src = entries[0]?.url; // Fallback
img.srcset = srcset;
img.sizes = '(max-width: 600px) 100vw, 50vw';

// Generate srcset string programmatically
const srcsetString = sdk.generateSrcSetString('file-id', [300, 600, 900, 1200], 'webp');
// Returns: "https://api.../transform?w=300&format=webp 300w, ..."`}
            />
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-4">Transform Presets</h3>
            <CodeBlock
              id="transform-presets"
              code={`// Get available presets from server
const serverPresets = await sdk.getTransformPresets();

// Check if file is transformable
const isImage = sdk.isImageFile('image/jpeg'); // true
const isVideo = sdk.isImageFile('video/mp4'); // false

// Custom transform with multiple options
const { url, derivative } = await sdk.getTransformedUrl('file-id', {
  w: 800,
  h: 600,
  q: 90,
  format: 'webp',
  fit: 'cover', // crop to fit dimensions
  position: 'center' // crop position
});

console.log('Derivative info:', derivative);
// { id, width, height, format, size, mimeType }`}
            />
          </div>
        </div>
      )
    },
    {
      id: 'security',
      title: 'Security & Access',
      icon: Shield,
      content: (
        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-semibold mb-4">Secure Downloads</h3>
            <CodeBlock
              id="secure-downloads"
              code={`// Get signed download URL
const { url, expiresAt } = await sdk.getDownloadUrl('file-id', {
  expiry: 3600, // 1 hour
  purpose: 'download'
});

// Get preview URL (shorter expiry)
const previewUrl = await sdk.getPreviewUrl('file-id', {
  expiry: 300 // 5 minutes
});

// Get streaming URL for media
const streamUrl = await sdk.getStreamUrl('file-id', {
  expiry: 1800 // 30 minutes
});

// Download file directly
await sdk.downloadFile('file-id', 'document.pdf', {
  expiry: 900
});

// Copy URL to clipboard
const copiedUrl = await sdk.copyUrlToClipboard('file-id');`}
            />
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-4">Public vs Private Files</h3>
            <CodeBlock
              id="public-private"
              code={`// Get public URL (no expiry)
const { url, isPublic } = await sdk.getPublicUrl('file-id');
if (isPublic) {
  // Direct CDN access
  console.log('Public URL:', url);
}

// Preload URLs for better UX
const fileIds = ['file-1', 'file-2', 'file-3'];
await sdk.preloadUrls(fileIds, 'preview');

// Clear URL cache
sdk.clearUrlCache('file-id'); // Clear specific file
sdk.clearUrlCache(); // Clear all cached URLs`}
            />
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-4">API Key Management</h3>
            <CodeBlock
              id="api-keys"
              code={`// List API keys
const keys = await sdk.keys.list();

// Create new API key
const newKey = await sdk.keys.create('My App Key', ['read', 'write']);
console.log('API Key:', newKey.key);
console.log('Scopes:', newKey.scopes);

// Revoke API key
await sdk.keys.revoke('key-id');

// Initialize SDK with different key
const readOnlySDK = RemoCloudSDK.init({
  baseUrl: 'https://api.remocloud.dev',
  apiKey: 'read-only-key'
});`}
            />
          </div>
        </div>
      )
    },
    {
      id: 'integrity',
      title: 'File Integrity',
      icon: Hash,
      content: (
        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-semibold mb-4">Hash Verification</h3>
            <CodeBlock
              id="hash-verification"
              code={`// Get file hash from server
const { hash, algorithm } = await sdk.getFileHash('file-id');
console.log(\`File hash (\${algorithm}): \${hash}\`);

// Compute client-side hash (Node.js only)
const clientHash = await sdk.computeFileHash(file);

// Verify file integrity
const verification = await sdk.verifyIntegrity('file-id', clientHash);
if (verification.isValid) {
  console.log('File integrity verified');
} else {
  console.error('File integrity check failed:', verification.error);
}

// Check for duplicate before upload
const duplicate = await sdk.checkDuplicate('bucket-id', clientHash);
if (duplicate.exists) {
  console.log('Duplicate file found:', duplicate.file);
  // Option to link to existing file instead of uploading
}`}
            />
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-4">File Validation</h3>
            <CodeBlock
              id="file-validation"
              code={`// Validate file type
const validation = sdk.validateFileType(file, ['image/*', 'video/*']);
if (!validation.isValid) {
  console.error('Validation errors:', validation.errors);
  console.warn('Warnings:', validation.warnings);
}

console.log('File info:', validation.fileInfo);
// { name, size, declaredMime, extension }

// Get bucket allowed types
const allowedTypes = await sdk.getBucketAllowedTypes('bucket-id');
console.log('Bucket allows:', allowedTypes);

// Validate against bucket restrictions
const bucketValidation = sdk.validateFileType(file, allowedTypes);`}
            />
          </div>
        </div>
      )
    },
    {
      id: 'analytics',
      title: 'Analytics',
      icon: BarChart3,
      content: (
        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-semibold mb-4">Overview Analytics</h3>
            <CodeBlock
              id="overview-analytics"
              code={`// Get overview analytics for date range
const analytics = await sdk.analytics.overview('2024-01-01', '2024-01-31');

console.log('Totals:', analytics.totals);
// { uploads: 150, downloads: 1200, bandwidth: 5242880, storage: 10485760 }

console.log('Daily data:', analytics.daily);
// [{ date: '2024-01-01', uploads: 5, downloads: 45, ... }, ...]

// Get current month analytics
const now = new Date();
const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
const currentMonth = await sdk.analytics.overview(
  startOfMonth.toISOString().split('T')[0],
  now.toISOString().split('T')[0]
);`}
            />
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-4">Bucket Analytics</h3>
            <CodeBlock
              id="bucket-analytics"
              code={`// Get analytics for specific bucket
const bucketStats = await sdk.analytics.bucket('bucket-id', '2024-01-01', '2024-01-31');

// Get storage breakdown
const storage = await sdk.analytics.storage();
console.log('Storage by bucket:', storage.byBucket);
console.log('Storage by type:', storage.byType);

// Get top files by downloads
const topFiles = await sdk.analytics.topFiles(10);
topFiles.forEach(file => {
  console.log(\`\${file.name}: \${file.downloads} downloads\`);
});

// Export analytics data
const csvBlob = await sdk.analytics.export('2024-01-01', '2024-01-31');
// Returns CSV blob for download`}
            />
          </div>
        </div>
      )
    },
    {
      id: 'react-hooks',
      title: 'React Hooks',
      icon: Layers,
      content: (
        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-semibold mb-4">Setup Hooks</h3>
            <CodeBlock
              id="hooks-setup"
              code={`import React from 'react';
import RemoCloudSDK, { createRemoCloudHooks } from '@remocloud/sdk';

const sdk = RemoCloudSDK.init({
  baseUrl: 'https://api.remocloud.dev',
  apiKey: 'your-api-key'
});

const hooks = createRemoCloudHooks(sdk);

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <FilesList bucketId="your-bucket-id" />
    </QueryClientProvider>
  );
}`}
            />
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-4">File Upload with Progress</h3>
            <CodeBlock
              id="upload-hook"
              code={`function FileUpload({ bucketId }) {
  const upload = hooks.useUpload(bucketId);
  const { uploadProgress } = upload;

  const handleUpload = (file) => {
    upload.mutate({ file });
  };

  return (
    <div>
      <input 
        type="file" 
        onChange={(e) => handleUpload(e.target.files[0])} 
      />
      
      {Object.entries(uploadProgress).map(([fileId, progress]) => (
        <div key={fileId} className="progress-bar">
          <div 
            className="progress-fill"
            style={{ width: \`\${progress.progress}%\` }}
          />
          <span>{progress.progress}% - {progress.status}</span>
        </div>
      ))}
    </div>
  );
}`}
            />
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-4">Files List</h3>
            <CodeBlock
              id="files-list"
              code={`function FilesList({ bucketId }) {
  const { data: files, isLoading, error } = hooks.useFiles(bucketId);
  const deleteFile = hooks.useDeleteFile();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {files.map(file => (
        <div key={file.id} className="file-item">
          <span>{file.name}</span>
          <button onClick={() => deleteFile.mutate(file.id)}>
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}`}
            />
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-4">Responsive Images</h3>
            <CodeBlock
              id="responsive-images"
              code={`function ResponsiveImage({ fileId, alt }) {
  const { data: srcset } = hooks.useSrcSet(fileId, {
    breakpoints: '300,600,900,1200',
    format: 'webp'
  });

  if (!srcset) return <div>Loading...</div>;

  return (
    <img
      src={srcset.entries[0]?.url}
      srcSet={srcset.srcset}
      sizes="(max-width: 600px) 100vw, 50vw"
      alt={alt}
    />
  );
}`}
            />
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-4">Analytics Hooks</h3>
            <CodeBlock
              id="analytics-hooks"
              code={`function AnalyticsDashboard() {
  const { data: analytics, isLoading } = hooks.useAnalytics(
    '2024-01-01', 
    '2024-01-31'
  );
  
  const { data: bucketStats } = hooks.useBucketAnalytics(
    'bucket-id',
    '2024-01-01',
    '2024-01-31'
  );

  if (isLoading) return <div>Loading analytics...</div>;

  return (
    <div>
      <h2>Total Uploads: {analytics.totals.uploads}</h2>
      <h2>Total Downloads: {analytics.totals.downloads}</h2>
      <h2>Bandwidth Used: {formatBytes(analytics.totals.bandwidth)}</h2>
    </div>
  );
}`}
            />
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-4">File Integrity Hooks</h3>
            <CodeBlock
              id="integrity-hooks"
              code={`function FileIntegrityChecker({ fileId }) {
  const { data: hash } = hooks.useFileHash(fileId);
  const verifyIntegrity = hooks.useVerifyIntegrity();

  const handleVerify = async () => {
    try {
      const result = await verifyIntegrity.mutateAsync({
        fileId,
        clientHash: hash?.hash
      });
      
      if (result.isValid) {
        alert('File integrity verified!');
      } else {
        alert('File integrity check failed!');
      }
    } catch (error) {
      console.error('Verification error:', error);
    }
  };

  return (
    <div>
      <p>File Hash: {hash?.hash}</p>
      <button onClick={handleVerify} disabled={verifyIntegrity.isPending}>
        {verifyIntegrity.isPending ? 'Verifying...' : 'Verify Integrity'}
      </button>
    </div>
  );
}`}
            />
          </div>
        </div>
      )
    },
    {
      id: 'api-reference',
      title: 'API Reference',
      icon: Code,
      content: (
        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-semibold mb-4">Buckets API</h3>
            <CodeBlock
              id="buckets-api"
              code={`// List buckets
const buckets = await sdk.buckets.list();

// Create bucket
const bucket = await sdk.buckets.create({
  name: 'my-bucket',
  isPublicByDefault: false,
  versioningEnabled: true,
  allowedTypes: ['image/*', 'video/*']
});

// Get bucket
const bucket = await sdk.buckets.get('bucket-id');

// Update bucket
const updated = await sdk.buckets.update('bucket-id', { 
  name: 'new-name' 
});

// Delete bucket
await sdk.buckets.delete('bucket-id');`}
            />
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-4">Files API</h3>
            <CodeBlock
              id="files-api"
              code={`// List files with pagination
const files = await sdk.files.list('bucket-id', {
  limit: 20,
  cursor: 'next-page-cursor',
  q: 'search-term',
  type: 'image',
  sortBy: 'created_at',
  sortOrder: 'DESC'
});

// Get file details
const file = await sdk.files.get('file-id');

// Get download URL
const { url, expiresAt } = await sdk.files.getDownloadUrl('file-id', {
  expiry: 3600, // 1 hour
  purpose: 'download'
});

// Delete file (soft delete)
await sdk.files.delete('file-id');

// Permanent delete
await sdk.files.delete('file-id', { permanent: true });`}
            />
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-4">Image Transforms</h3>
            <CodeBlock
              id="transforms-api"
              code={`// Transform with parameters
const { url } = await sdk.files.getTransformedUrl('file-id', {
  w: 300,
  h: 300,
  q: 85,
  format: 'webp'
});

// Use preset
const { url } = await sdk.files.getTransformedUrl('file-id', {
  preset: 'thumbnail'
});

// Get responsive srcset
const { srcset, entries } = await sdk.getSrcSet('file-id', {
  breakpoints: '300,600,900,1200',
  format: 'webp'
});

// Available presets
const presets = sdk.getCommonPresets();
// Returns: thumbnail, small, medium, large, etc.`}
            />
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-4">Analytics API</h3>
            <CodeBlock
              id="analytics-api"
              code={`// Get overview analytics
const analytics = await sdk.analytics.overview('2024-01-01', '2024-01-31');
// Returns: { totals: { uploads, downloads, bandwidth, storage }, daily: [...] }

// Get bucket analytics
const bucketStats = await sdk.analytics.bucket('bucket-id', '2024-01-01', '2024-01-31');

// Get storage usage by bucket
const storage = await sdk.analytics.storage();

// Get top downloaded files
const topFiles = await sdk.analytics.topFiles(10);

// Export analytics as CSV
const csvBlob = await sdk.analytics.export('2024-01-01', '2024-01-31');`}
            />
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-4">File Integrity API</h3>
            <CodeBlock
              id="integrity-api"
              code={`// Get file hash
const { hash, algorithm } = await sdk.getFileHash('file-id');

// Verify integrity
const verification = await sdk.verifyIntegrity('file-id', clientHash);

// Check for duplicates
const duplicate = await sdk.checkDuplicate('bucket-id', hash);

// Compute client-side hash (Node.js)
const clientHash = await sdk.computeFileHash(file);`}
            />
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-4">Upload Management API</h3>
            <CodeBlock
              id="upload-management-api"
              code={`// Get upload status
const status = await sdk.getUploadStatus('upload-id');

// Cancel upload
await sdk.cancelUpload('upload-id');

// Validate file type
const validation = sdk.validateFileType(file, allowedTypes);

// Get bucket allowed types
const allowedTypes = await sdk.getBucketAllowedTypes('bucket-id');`}
            />
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-4">URL Management API</h3>
            <CodeBlock
              id="url-management-api"
              code={`// Get preview URL
const previewUrl = await sdk.getPreviewUrl('file-id');

// Get streaming URL
const streamUrl = await sdk.getStreamUrl('file-id');

// Download file stream
const stream = await sdk.downloadStream('file-id');

// Copy URL to clipboard
const url = await sdk.copyUrlToClipboard('file-id');

// Preload URLs
await sdk.preloadUrls(['file-1', 'file-2'], 'preview');

// Clear URL cache
sdk.clearUrlCache('file-id');`}
            />
          </div>
        </div>
      )
    },
    {
      id: 'error-handling',
      title: 'Error Handling',
      icon: Shield,
      content: (
        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-semibold mb-4">Error Types & Codes</h3>
            <CodeBlock
              id="error-types"
              code={`// Common error codes and their meanings
const ERROR_CODES = {
  // Authentication (401, 403)
  INVALID_API_KEY: 'API key is invalid or expired',
  INSUFFICIENT_PERMISSIONS: 'API key lacks required permissions',
  BUCKET_ACCESS_DENIED: 'Bucket is private, need proper API key',
  
  // Validation (400)
  INVALID_FILE_TYPE: 'File type not allowed in bucket',
  FILE_TOO_LARGE: 'File exceeds size limit',
  BUCKET_NAME_TAKEN: 'Bucket name already exists',
  
  // Upload Errors (400, 500)
  UPLOAD_FAILED: 'File upload failed',
  UPLOAD_TIMEOUT: 'Upload timed out',
  SIGNED_URL_EXPIRED: 'Upload URL expired',
  
  // Service Errors (500, 503)
  STORAGE_ERROR: 'Storage service unavailable',
  TRANSFORM_FAILED: 'Image processing failed',
  DATABASE_ERROR: 'Database temporarily unavailable',
  
  // Rate Limiting (429)
  RATE_LIMIT_EXCEEDED: 'Too many requests',
  QUOTA_EXCEEDED: 'Storage quota exceeded'
};`}
            />
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-4">SDK Error Handling</h3>
            <CodeBlock
              id="sdk-error-handling"
              code={`// SDK automatically handles retries for transient errors
try {
  const result = await sdk.upload('bucket-id', file, {
    onProgress: (progress) => console.log(\`\${progress}%\`),
    onRetry: (attempt) => console.log(\`Retry \${attempt}/3\`)
  });
  
  console.log('Upload successful:', result);
} catch (error) {
  // Error object contains structured information
  console.error('Error code:', error.code);
  console.error('Message:', error.message);
  console.error('Retryable:', error.retryable);
  console.error('Details:', error.details);
  
  // Handle specific error types
  switch (error.code) {
    case 'FILE_TOO_LARGE':
      alert(\`File too large. Max size: \${error.details.maxSize} bytes\`);
      break;
    case 'INVALID_FILE_TYPE':
      alert(\`Invalid file type. Allowed: \${error.details.allowedTypes.join(', ')}\`);
      break;
    case 'QUOTA_EXCEEDED':
      window.location.href = '/dashboard/analytics'; // Redirect to usage page
      break;
    case 'RATE_LIMIT_EXCEEDED':
      setTimeout(() => retry(), error.details.retryAfter * 1000);
      break;
    default:
      alert('Upload failed. Please try again.');
  }
}`}
            />
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-4">React Hooks Error Handling</h3>
            <CodeBlock
              id="hooks-error-handling"
              code={`// Hooks provide built-in error handling and retry logic
function FileUploader({ bucketId }) {
  const upload = hooks.useUpload(bucketId, {
    onError: (error) => {
      // Custom error handling
      if (error.code === 'QUOTA_EXCEEDED') {
        showQuotaExceededModal();
      } else if (error.retryable) {
        showRetryButton();
      }
    },
    onSuccess: (result) => {
      showToast.success(\`\${result.file.name} uploaded successfully\`);
    }
  });
  
  const { data: files, error, isError, refetch } = hooks.useFiles(bucketId);
  
  // Handle query errors
  if (isError) {
    return (
      <div className="error-state">
        <p>Failed to load files: {error.message}</p>
        <button onClick={() => refetch()}>Retry</button>
      </div>
    );
  }
  
  return (
    <div>
      {/* Upload progress with error states */}
      {Object.entries(upload.uploadProgress).map(([fileId, progress]) => (
        <div key={fileId}>
          {progress.status === 'error' ? (
            <div className="error">
              <span>Upload failed: {progress.error}</span>
              <button onClick={() => upload.retryUpload(fileId)}>Retry</button>
            </div>
          ) : (
            <div className="progress">
              <div style={{ width: \`\${progress.progress}%\` }} />
              <span>{progress.status === 'retrying' ? 'Retrying...' : \`\${progress.progress}%\`}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}`}
            />
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-4">Network & Retry Configuration</h3>
            <CodeBlock
              id="retry-config"
              code={`// SDK retry configuration
const sdk = RemoCloudSDK.init({
  baseUrl: 'https://api.remocloud.dev',
  apiKey: 'your-api-key',
  retryConfig: {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffFactor: 2
  }
});

// TanStack Query retry configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Don't retry on client errors (4xx)
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
          return false;
        }
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000)
    }
  }
});

// Manual retry with exponential backoff
const retryWithBackoff = async (operation, maxRetries = 3) => {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries || !error.retryable) {
        throw error;
      }
      
      const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};`}
            />
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-4">User-Friendly Error Messages</h3>
            <CodeBlock
              id="user-messages"
              code={`// Toast notifications for different error types
import { showToast } from './components/ui/Toast';

// Success messages
showToast.uploadSuccess('document.pdf');
showToast.success('File deleted successfully');

// Error messages with actions
showToast.quotaExceeded(); // Links to usage page
showToast.rateLimited(60); // Shows retry time
showToast.permissionDenied(); // Links to API keys
showToast.networkError(); // Retry button

// Upload-specific errors
showToast.uploadError('document.pdf', {
  retryable: true,
  code: 'NETWORK_ERROR'
});

// Custom error with action
showToast.error('Custom error message', {
  action: {
    label: 'View Details',
    onClick: () => window.open('/help/errors')
  }
});

// Progress toast for long operations
const progressToast = createProgressToast('large-file.zip');
progressToast.updateProgress(45);
progressToast.complete(); // or progressToast.error(error)`}
            />
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-4">Error Boundary Usage</h3>
            <CodeBlock
              id="error-boundary"
              code={`import ErrorBoundary, { withErrorBoundary } from './components/ui/ErrorBoundary';

// Wrap entire app
function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Router>
          <Routes>...</Routes>
        </Router>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

// Wrap specific components
const SafeFileUploader = withErrorBoundary(FileUploader, {
  fallback: <div>Upload component failed to load</div>
});

// Manual error reporting
function MyComponent() {
  const { reportError } = useErrorHandler();
  
  const handleRiskyOperation = async () => {
    try {
      await riskyOperation();
    } catch (error) {
      reportError(error, {
        component: 'MyComponent',
        operation: 'riskyOperation',
        userId: user.id
      });
      throw error; // Re-throw to trigger error boundary
    }
  };
}`}
            />
          </div>
        </div>
      )
    },
    {
      id: 'examples',
      title: 'Complete Examples',
      icon: Code,
      content: (
        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-semibold mb-4">File Upload Component</h3>
            <CodeBlock
              id="upload-component"
              code={`import React, { useState } from 'react';
import RemoCloudSDK, { createRemoCloudHooks } from '@remocloud/sdk';

const sdk = RemoCloudSDK.init({
  baseUrl: 'https://api.remocloud.dev',
  apiKey: process.env.REACT_APP_REMOCLOUD_API_KEY
});

const hooks = createRemoCloudHooks(sdk);

function FileUploadComponent({ bucketId }) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const upload = hooks.useUpload(bucketId);
  const { data: files, refetch } = hooks.useFiles(bucketId);

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    setSelectedFiles(files);
  };

  const handleUpload = async () => {
    for (const file of selectedFiles) {
      // Validate file
      const validation = sdk.validateFileType(file, ['image/*', 'video/*']);
      if (!validation.isValid) {
        alert(\`Invalid file: \${validation.errors.join(', ')}\`);
        continue;
      }

      // Check for duplicates
      try {
        const hash = await sdk.computeFileHash(file);
        const duplicate = await sdk.checkDuplicate(bucketId, hash);
        if (duplicate.exists) {
          const useExisting = confirm(\`File \${file.name} already exists. Use existing?\`);
          if (useExisting) continue;
        }
      } catch (error) {
        console.warn('Could not check for duplicates:', error);
      }

      // Upload file
      upload.mutate({ file });
    }
    
    setSelectedFiles([]);
  };

  return (
    <div className="space-y-4">
      <div>
        <input
          type="file"
          multiple
          onChange={handleFileSelect}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
        
        {selectedFiles.length > 0 && (
          <button
            onClick={handleUpload}
            disabled={upload.isPending}
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            Upload {selectedFiles.length} file(s)
          </button>
        )}
      </div>

      {/* Upload Progress */}
      {Object.entries(upload.uploadProgress).map(([fileId, progress]) => (
        <div key={fileId} className="bg-gray-100 rounded-lg p-3">
          <div className="flex justify-between text-sm mb-1">
            <span>Uploading...</span>
            <span>{progress.progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: \`\${progress.progress}%\` }}
            />
          </div>
        </div>
      ))}

      {/* Files List */}
      <div className="space-y-2">
        {files?.files?.map(file => (
          <FileItem key={file.id} file={file} />
        ))}
      </div>
    </div>
  );
}`}
            />
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-4">Image Gallery with Transforms</h3>
            <CodeBlock
              id="image-gallery"
              code={`function ImageGallery({ bucketId }) {
  const { data: files } = hooks.useFiles(bucketId, {
    type: 'image',
    sortBy: 'created_at',
    sortOrder: 'DESC'
  });

  const [selectedImage, setSelectedImage] = useState(null);

  return (
    <div>
      {/* Thumbnail Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {files?.files?.map(file => (
          <ImageThumbnail
            key={file.id}
            file={file}
            onClick={() => setSelectedImage(file)}
          />
        ))}
      </div>

      {/* Lightbox Modal */}
      {selectedImage && (
        <ImageLightbox
          file={selectedImage}
          onClose={() => setSelectedImage(null)}
        />
      )}
    </div>
  );
}

function ImageThumbnail({ file, onClick }) {
  const { data: thumbnail } = hooks.useTransformedUrl(file.id, {
    preset: 'thumbnail'
  });

  return (
    <div 
      className="aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
      onClick={onClick}
    >
      {thumbnail && (
        <img
          src={thumbnail.url}
          alt={file.original_name}
          className="w-full h-full object-cover"
        />
      )}
    </div>
  );
}

function ImageLightbox({ file, onClose }) {
  const { data: large } = hooks.useTransformedUrl(file.id, {
    preset: 'large'
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="max-w-4xl max-h-full p-4">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white text-xl"
        >
          ×
        </button>
        {large && (
          <img
            src={large.url}
            alt={file.original_name}
            className="max-w-full max-h-full object-contain"
          />
        )}
      </div>
    </div>
  );
}`}
            />
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-4">Analytics Dashboard</h3>
            <CodeBlock
              id="analytics-dashboard"
              code={`function AnalyticsDashboard() {
  const [dateRange, setDateRange] = useState({
    start: '2024-01-01',
    end: '2024-01-31'
  });

  const { data: analytics, isLoading } = hooks.useAnalytics(
    dateRange.start,
    dateRange.end
  );

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (isLoading) return <div>Loading analytics...</div>;

  return (
    <div className="space-y-6">
      {/* Date Range Selector */}
      <div className="flex gap-4">
        <input
          type="date"
          value={dateRange.start}
          onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
          className="border rounded px-3 py-2"
        />
        <input
          type="date"
          value={dateRange.end}
          onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
          className="border rounded px-3 py-2"
        />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Uploads"
          value={analytics.totals.uploads}
          icon="📤"
        />
        <StatCard
          title="Total Downloads"
          value={analytics.totals.downloads}
          icon="📥"
        />
        <StatCard
          title="Bandwidth Used"
          value={formatBytes(analytics.totals.bandwidth)}
          icon="🌐"
        />
        <StatCard
          title="Storage Used"
          value={formatBytes(analytics.totals.storage)}
          icon="💾"
        />
      </div>

      {/* Daily Chart */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Daily Activity</h3>
        <DailyChart data={analytics.daily} />
      </div>
    </div>
  );
}

function StatCard({ title, value, icon }) {
  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
        <span className="text-2xl">{icon}</span>
      </div>
    </div>
  );
}`}
            />
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="min-h-screen bg-surface-light dark:bg-surface-dark">
      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 bg-white dark:bg-gray-800 border-r border-surface-variant-light dark:border-surface-variant-dark">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-8">
              <Book className="w-8 h-8 text-primary-light" />
              <h1 className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark">
                Documentation
              </h1>
            </div>

            <nav className="space-y-2">
              {sections.map((section) => {
                const Icon = section.icon;
                const isExpanded = expandedSections[section.id];
                
                return (
                  <div key={section.id}>
                    <button
                      onClick={() => {
                        setActiveSection(section.id);
                        toggleSection(section.id);
                      }}
                      className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors ${
                        activeSection === section.id
                          ? 'bg-primary-light bg-opacity-10 text-primary-light'
                          : 'text-text-secondary-light dark:text-text-secondary-dark hover:bg-surface-variant-light dark:hover:bg-surface-variant-dark'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="w-5 h-5" />
                        <span className="font-medium">{section.title}</span>
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                );
              })}
            </nav>

            <div className="mt-8 pt-6 border-t border-surface-variant-light dark:border-surface-variant-dark">
              <div className="space-y-3">
                <a
                  href="https://github.com/remocloud/sdk"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-text-secondary-light dark:text-text-secondary-dark hover:text-primary-light transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  GitHub Repository
                </a>
                <a
                  href="https://npmjs.com/package/@remocloud/sdk"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-text-secondary-light dark:text-text-secondary-dark hover:text-primary-light transition-colors"
                >
                  <Download className="w-4 h-4" />
                  NPM Package
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-8">
          <div className="max-w-4xl">
            {sections.map((section) => (
              <motion.div
                key={section.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ 
                  opacity: activeSection === section.id ? 1 : 0,
                  y: activeSection === section.id ? 0 : 20,
                  display: activeSection === section.id ? 'block' : 'none'
                }}
                transition={{ duration: 0.3 }}
              >
                <div className="mb-8">
                  <div className="flex items-center gap-3 mb-6">
                    <section.icon className="w-8 h-8 text-primary-light" />
                    <h2 className="text-3xl font-bold text-text-primary-light dark:text-text-primary-dark">
                      {section.title}
                    </h2>
                  </div>
                  {section.content}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Documentation;