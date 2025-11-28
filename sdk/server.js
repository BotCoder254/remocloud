const RemoCloudSDK = require('./index');
const fs = require('fs');
const path = require('path');

// Example usage demonstrating all SDK features
const main = async () => {
  // Initialize SDK with API key
  const sdk = new RemoCloudSDK('your-api-key-here', 'http://localhost:5000/api');

  try {
    console.log('🚀 RemoCloud SDK Demo');
    console.log('====================\n');

    // 1. Get buckets
    console.log('📁 Fetching buckets...');
    const buckets = await sdk.getBuckets();
    console.log(`Found ${buckets.length} buckets:`);
    buckets.forEach(bucket => {
      console.log(`  - ${bucket.name} (${bucket.file_count || 0} files, ${bucket.is_public_by_default ? 'public' : 'private'})`);
    });
    console.log();

    // 2. Create a test bucket if none exist
    let testBucket = buckets.find(b => b.name === 'sdk-test-bucket');
    if (!testBucket) {
      console.log('🆕 Creating test bucket...');
      testBucket = await sdk.createBucket({
        name: 'sdk-test-bucket',
        is_public_by_default: false,
        versioning_enabled: true
      });
      console.log(`Created bucket: ${testBucket.name}`);
      console.log();
    }

    // 3. Example file upload (Node.js environment)
    console.log('📤 Testing file upload...');
    
    // Create a test file
    const testContent = `Hello from RemoCloud SDK!
Timestamp: ${new Date().toISOString()}
Random: ${Math.random()}`;
    const testFileName = 'sdk-test-file.txt';
    
    // In Node.js, we need to create a File-like object
    const testFile = {
      name: testFileName,
      size: Buffer.byteLength(testContent, 'utf8'),
      type: 'text/plain',
      lastModified: Date.now(),
      // For Node.js, we'll use a Buffer as the file content
      buffer: Buffer.from(testContent, 'utf8')
    };

    try {
      const uploadResult = await sdk.upload(testBucket.id, testFile, {
        onProgress: (progress, loaded, total) => {
          process.stdout.write(`\r  Upload progress: ${Math.round(progress)}% (${loaded}/${total} bytes)`);
        }
      });
      console.log('\n  ✅ Upload completed!');
      console.log(`  File ID: ${uploadResult.id}`);
      console.log(`  File URL: ${uploadResult.object_key}`);
      console.log();

      // 4. Get secure download URL
      console.log('🔗 Getting secure download URL...');
      const downloadUrl = await sdk.getDownloadUrl(uploadResult.id, {
        expiry: 3600, // 1 hour
        purpose: 'download'
      });
      console.log(`  Download URL: ${downloadUrl.url}`);
      console.log(`  Expires at: ${downloadUrl.expiresAt}`);
      console.log(`  Is public: ${downloadUrl.isPublic}`);
      console.log();

      // 5. Get preview URL
      console.log('👁️  Getting preview URL...');
      const previewUrl = await sdk.getPreviewUrl(uploadResult.id);
      console.log(`  Preview URL: ${previewUrl.url}`);
      console.log(`  Expires at: ${previewUrl.expiresAt}`);
      console.log();

      // 6. Get public URL (if file is public)
      if (uploadResult.is_public) {
        console.log('🌐 Getting public URL...');
        const publicUrl = await sdk.getPublicUrl(uploadResult.id);
        console.log(`  Public URL: ${publicUrl.url}`);
        console.log();
      }

      // 7. Download file stream
      console.log('⬇️  Testing file download...');
      try {
        const stream = await sdk.downloadStream(uploadResult.id);
        console.log('  ✅ Download stream obtained successfully');
        console.log();
      } catch (downloadError) {
        console.log(`  ⚠️  Download failed: ${downloadError.message}`);
        console.log();
      }

      // 8. List files in bucket
      console.log('📋 Listing files in bucket...');
      const files = await sdk.getFiles(testBucket.id);
      console.log(`Found ${files.files ? files.files.length : 0} files:`);
      if (files.files) {
        files.files.forEach(file => {
          console.log(`  - ${file.original_name} (${file.size} bytes, ${file.is_public ? 'public' : 'private'})`);
        });
      }
      console.log();

      // 9. URL caching demonstration
      console.log('🗄️  Testing URL caching...');
      const cachedUrl1 = await sdk.getDownloadUrl(uploadResult.id);
      const cachedUrl2 = await sdk.getDownloadUrl(uploadResult.id);
      console.log(`  First call: ${cachedUrl1.url.substring(0, 50)}...`);
      console.log(`  Second call (cached): ${cachedUrl2.url.substring(0, 50)}...`);
      console.log(`  URLs match: ${cachedUrl1.url === cachedUrl2.url}`);
      console.log();

      // 10. Clear cache
      console.log('🧹 Clearing URL cache...');
      sdk.clearUrlCache(uploadResult.id);
      console.log('  ✅ Cache cleared');
      console.log();

      // 11. Preload URLs for better UX
      console.log('⚡ Preloading URLs...');
      const fileIds = files.files ? files.files.map(f => f.id) : [];
      if (fileIds.length > 0) {
        await sdk.preloadUrls(fileIds, 'preview');
        console.log(`  ✅ Preloaded URLs for ${fileIds.length} files`);
      }
      console.log();

    } catch (uploadError) {
      console.log(`\n  ❌ Upload failed: ${uploadError.message}`);
      console.log();
    }

    // 12. Batch upload example (if we had multiple files)
    console.log('📦 Batch upload capabilities:');
    console.log('  - Multiple file upload with progress tracking');
    console.log('  - Individual file completion callbacks');
    console.log('  - Overall batch progress monitoring');
    console.log('  - Error handling per file');
    console.log();

    console.log('✨ SDK Demo completed successfully!');
    console.log('\nAvailable SDK methods:');
    console.log('  - upload(bucketId, file, options)');
    console.log('  - getDownloadUrl(fileId, options)');
    console.log('  - getPreviewUrl(fileId, options)');
    console.log('  - getStreamUrl(fileId, options)');
    console.log('  - downloadFile(fileId)');
    console.log('  - downloadStream(fileId, options)');
    console.log('  - getPublicUrl(fileId)');
    console.log('  - copyUrlToClipboard(fileId, options)');
    console.log('  - preloadUrls(fileIds, purpose)');
    console.log('  - clearUrlCache(fileId)');
    console.log('  - getBuckets()');
    console.log('  - createBucket(bucketData)');
    console.log('  - getBucket(bucketId)');
    console.log('  - getFiles(bucketId)');
    console.log('  - deleteFile(fileId)');
    console.log('  - getUploadStatus(uploadId)');
    console.log('  - cancelUpload(uploadId)');

  } catch (error) {
    console.error('❌ SDK Error:', error.message);
    console.error('Stack:', error.stack);
  }
};

// Helper function to create a proper File object in Node.js
const createNodeFile = (content, filename, mimeType = 'text/plain') => {
  const buffer = Buffer.from(content, 'utf8');
  return {
    name: filename,
    size: buffer.length,
    type: mimeType,
    lastModified: Date.now(),
    buffer: buffer,
    // Add stream method for compatibility
    stream: () => {
      const { Readable } = require('stream');
      return Readable.from(buffer);
    }
  };
};

// Run example if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { RemoCloudSDK, createNodeFile };