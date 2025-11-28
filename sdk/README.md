# RemoCloud SDK

Official JavaScript/React SDK for RemoCloud - Modern cloud file storage with image transforms and analytics.

## Features

- 🚀 **Direct Uploads** - Bypass your server with signed URL uploads
- 🖼️ **Image Transforms** - Resize, optimize, and convert images on-the-fly
- ⚛️ **React Hooks** - Built-in TanStack Query integration
- 📊 **Analytics** - Track uploads, downloads, bandwidth, and storage
- 🔒 **Security** - File integrity verification and secure access
- 🎯 **TypeScript Ready** - Full type definitions included
- 📱 **Responsive Images** - Automatic srcset generation
- 🔄 **Progress Tracking** - Real-time upload progress
- 🗂️ **File Management** - Complete CRUD operations
- 🎨 **Presets** - Pre-configured image transform presets

## Installation

```bash
npm install @remocloud/sdk
```

## Quick Start

```javascript
import RemoCloudSDK from '@remocloud/sdk';

// Initialize the SDK
const sdk = RemoCloudSDK.init({
  baseUrl: 'https://api.remocloud.dev',
  apiKey: 'your-api-key'
});

// Upload a file
const file = document.getElementById('fileInput').files[0];
const result = await sdk.upload('bucket-id', file, {
  onProgress: (progress) => console.log(`Upload: ${progress}%`)
});

// Get files
const files = await sdk.files.list('bucket-id');

// Transform an image
const { url } = await sdk.getTransformedUrl('file-id', {
  w: 300,
  h: 300,
  format: 'webp'
});
```

## React Hooks

```javascript
import RemoCloudSDK, { createRemoCloudHooks } from '@remocloud/sdk';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const sdk = RemoCloudSDK.init({
  baseUrl: 'https://api.remocloud.dev',
  apiKey: 'your-api-key'
});

const hooks = createRemoCloudHooks(sdk);
const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <FileUploader bucketId="your-bucket-id" />
    </QueryClientProvider>
  );
}

function FileUploader({ bucketId }) {
  const upload = hooks.useUpload(bucketId);
  const { data: files } = hooks.useFiles(bucketId);

  const handleUpload = (file) => {
    upload.mutate({ file });
  };

  return (
    <div>
      <input 
        type="file" 
        onChange={(e) => handleUpload(e.target.files[0])} 
      />
      
      {/* Upload Progress */}
      {Object.entries(upload.uploadProgress).map(([fileId, progress]) => (
        <div key={fileId}>
          <div style={{ width: `${progress.progress}%` }} />
          <span>{progress.progress}% - {progress.status}</span>
        </div>
      ))}

      {/* Files List */}
      {files?.files?.map(file => (
        <div key={file.id}>{file.original_name}</div>
      ))}
    </div>
  );
}
```

## API Reference

### Initialization

```javascript
const sdk = RemoCloudSDK.init({
  baseUrl: 'https://api.remocloud.dev',
  apiKey: 'your-api-key'
});
```

### Buckets

```javascript
// List buckets
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
await sdk.buckets.delete('bucket-id');
```

### File Uploads

```javascript
// Direct upload with progress
const result = await sdk.upload('bucket-id', file, {
  onProgress: (progress, loaded, total) => {
    console.log(`Upload: ${progress}% (${loaded}/${total} bytes)`);
  },
  onError: (error) => {
    console.error('Upload failed:', error);
  },
  onComplete: (result) => {
    console.log('Upload completed:', result);
  }
});

// Upload session management
const status = await sdk.getUploadStatus('upload-id');
await sdk.cancelUpload('upload-id');

// File validation
const validation = sdk.validateFileType(file, ['image/*', 'video/*']);
if (!validation.isValid) {
  console.error('Validation errors:', validation.errors);
}

// Check for duplicates
const hash = await sdk.computeFileHash(file);
const duplicate = await sdk.checkDuplicate('bucket-id', hash);
```

### File Management

```javascript
// List files with pagination and filtering
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

// Delete file (soft delete)
await sdk.files.delete('file-id');

// Permanent delete
await sdk.files.delete('file-id', { permanent: true });
```

### Secure Downloads

```javascript
// Get signed download URL
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
await sdk.downloadFile('file-id', 'document.pdf');

// Get public URL (for public files)
const { url, isPublic } = await sdk.getPublicUrl('file-id');

// Copy URL to clipboard
const copiedUrl = await sdk.copyUrlToClipboard('file-id');
```

### Image Transforms

```javascript
// Basic transforms
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
*/

// Get server presets
const serverPresets = await sdk.getTransformPresets();

// Check if file is transformable
const isImage = sdk.isImageFile('image/jpeg'); // true
```

### Responsive Images

```javascript
// Generate responsive srcset
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
```

### File Integrity

```javascript
// Get file hash from server
const { hash, algorithm } = await sdk.getFileHash('file-id');

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
}
```

### Analytics

```javascript
// Get overview analytics
const analytics = await sdk.analytics.overview('2024-01-01', '2024-01-31');
console.log('Totals:', analytics.totals);
// { uploads: 150, downloads: 1200, bandwidth: 5242880, storage: 10485760 }

// Get bucket analytics
const bucketStats = await sdk.analytics.bucket('bucket-id', '2024-01-01', '2024-01-31');

// Get storage breakdown
const storage = await sdk.analytics.storage();

// Get top files by downloads
const topFiles = await sdk.analytics.topFiles(10);

// Export analytics data
const csvBlob = await sdk.analytics.export('2024-01-01', '2024-01-31');
```

### API Key Management

```javascript
// List API keys
const keys = await sdk.keys.list();

// Create new API key
const newKey = await sdk.keys.create('My App Key', ['read', 'write']);
console.log('API Key:', newKey.key);

// Revoke API key
await sdk.keys.revoke('key-id');
```

## React Hooks Reference

### File Hooks

```javascript
// Files list with auto-refresh
const { data: files, isLoading, error } = hooks.useFiles(bucketId, {
  limit: 20,
  type: 'image'
});

// Single file details
const { data: file } = hooks.useFile(fileId);

// Upload with progress tracking
const upload = hooks.useUpload(bucketId);
const { uploadProgress } = upload;

// Delete file
const deleteFile = hooks.useDeleteFile();
deleteFile.mutate(fileId);

// Download file
const download = hooks.useDownload();
download.mutate({ fileId, filename: 'document.pdf' });
```

### Transform Hooks

```javascript
// Transformed image URL
const { data: transformed } = hooks.useTransformedUrl(fileId, {
  w: 300,
  h: 300,
  format: 'webp'
});

// Responsive srcset
const { data: srcset } = hooks.useSrcSet(fileId, {
  breakpoints: '300,600,900,1200',
  format: 'webp'
});
```

### Analytics Hooks

```javascript
// Overview analytics
const { data: analytics } = hooks.useAnalytics('2024-01-01', '2024-01-31');

// Bucket analytics
const { data: bucketStats } = hooks.useBucketAnalytics(
  'bucket-id',
  '2024-01-01',
  '2024-01-31'
);
```

### Integrity Hooks

```javascript
// File hash
const { data: hash } = hooks.useFileHash(fileId);

// Verify integrity
const verifyIntegrity = hooks.useVerifyIntegrity();
const result = await verifyIntegrity.mutateAsync({
  fileId,
  clientHash: hash?.hash
});
```

### Bucket Hooks

```javascript
// List buckets
const { data: buckets } = hooks.useBuckets();

// Create bucket
const createBucket = hooks.useCreateBucket();
createBucket.mutate({
  name: 'my-bucket',
  isPublicByDefault: false
});
```

## Environment Variables

```bash
# .env
REACT_APP_REMOCLOUD_API_KEY=your-api-key
REACT_APP_REMOCLOUD_BASE_URL=https://api.remocloud.dev
```

## Error Handling

```javascript
try {
  const result = await sdk.upload('bucket-id', file);
  console.log('Upload successful:', result);
} catch (error) {
  if (error.response?.status === 413) {
    console.error('File too large');
  } else if (error.response?.status === 415) {
    console.error('File type not allowed');
  } else {
    console.error('Upload failed:', error.message);
  }
}

// With React hooks
const upload = hooks.useUpload(bucketId, {
  onError: (error) => {
    console.error('Upload failed:', error);
    // Show user-friendly error message
  },
  onSuccess: (result) => {
    console.log('Upload successful:', result);
    // Show success message
  }
});
```

## Performance Optimization

```javascript
// Preload URLs for better UX
const fileIds = ['file-1', 'file-2', 'file-3'];
await sdk.preloadUrls(fileIds, 'preview');

// Clear URL cache when needed
sdk.clearUrlCache('file-id'); // Clear specific file
sdk.clearUrlCache(); // Clear all cached URLs

// Use appropriate cache times
const { data: files } = hooks.useFiles(bucketId, {}, {
  staleTime: 5 * 60 * 1000, // 5 minutes
  cacheTime: 10 * 60 * 1000 // 10 minutes
});
```

## Browser vs Node.js

The SDK works in both browser and Node.js environments:

### Browser Features
- File upload with XMLHttpRequest progress tracking
- Drag & drop file handling
- Clipboard URL copying
- Blob URL generation for downloads

### Node.js Features
- Stream-based file handling
- Server-side file hash computation
- Buffer support for file operations
- Stream downloads

## TypeScript Support

```typescript
import RemoCloudSDK, { 
  FileUploadOptions, 
  TransformOptions, 
  AnalyticsData 
} from '@remocloud/sdk';

const sdk = RemoCloudSDK.init({
  baseUrl: 'https://api.remocloud.dev',
  apiKey: 'your-api-key'
});

const uploadOptions: FileUploadOptions = {
  onProgress: (progress: number) => console.log(progress),
  onError: (error: Error) => console.error(error)
};

const transformOptions: TransformOptions = {
  w: 300,
  h: 300,
  format: 'webp'
};
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

- 📖 [Documentation](https://docs.remocloud.dev)
- 🐛 [Issues](https://github.com/remocloud/sdk/issues)
- 💬 [Discussions](https://github.com/remocloud/sdk/discussions)
- 📧 [Email Support](mailto:support@remocloud.dev)

## Changelog

### v1.0.0
- Initial release
- Direct upload with signed URLs
- Image transforms and responsive images
- React hooks integration
- Analytics and file integrity
- Complete TypeScript support