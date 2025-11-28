// File type validation and MIME detection utilities
export class FileValidationService {
  // Common file signatures (magic bytes)
  static FILE_SIGNATURES = {
    // Images
    'image/jpeg': [
      [0xFF, 0xD8, 0xFF],
      [0xFF, 0xD8, 0xFF, 0xE0],
      [0xFF, 0xD8, 0xFF, 0xE1]
    ],
    'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
    'image/gif': [
      [0x47, 0x49, 0x46, 0x38, 0x37, 0x61],
      [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]
    ],
    'image/webp': [[0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50]],
    'image/bmp': [[0x42, 0x4D]],
    'image/tiff': [
      [0x49, 0x49, 0x2A, 0x00],
      [0x4D, 0x4D, 0x00, 0x2A]
    ],

    // Documents
    'application/pdf': [[0x25, 0x50, 0x44, 0x46]],
    'application/zip': [
      [0x50, 0x4B, 0x03, 0x04],
      [0x50, 0x4B, 0x05, 0x06],
      [0x50, 0x4B, 0x07, 0x08]
    ],
    'application/x-rar-compressed': [[0x52, 0x61, 0x72, 0x21, 0x1A, 0x07]],

    // Office documents
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
      [0x50, 0x4B, 0x03, 0x04] // DOCX (ZIP-based)
    ],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
      [0x50, 0x4B, 0x03, 0x04] // XLSX (ZIP-based)
    ],
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': [
      [0x50, 0x4B, 0x03, 0x04] // PPTX (ZIP-based)
    ],

    // Audio
    'audio/mpeg': [
      [0xFF, 0xFB],
      [0xFF, 0xF3],
      [0xFF, 0xF2],
      [0x49, 0x44, 0x33] // ID3 tag
    ],
    'audio/wav': [[0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x41, 0x56, 0x45]],
    'audio/ogg': [[0x4F, 0x67, 0x67, 0x53]],

    // Video
    'video/mp4': [
      [null, null, null, null, 0x66, 0x74, 0x79, 0x70],
      [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6D, 0x70, 0x34, 0x32],
      [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6F, 0x6D]
    ],
    'video/avi': [[0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x41, 0x56, 0x49, 0x20]],
    'video/quicktime': [[0x00, 0x00, 0x00, null, 0x66, 0x74, 0x79, 0x70, 0x71, 0x74]],

    // Text
    'text/plain': [], // No specific signature, will be detected by content
    'text/html': [], // No specific signature
    'text/css': [], // No specific signature
    'application/javascript': [], // No specific signature
    'application/json': [] // No specific signature
  };

  // Get file extension from filename
  static getFileExtension(filename) {
    const lastDot = filename.lastIndexOf('.');
    return lastDot !== -1 ? filename.slice(lastDot + 1).toLowerCase() : '';
  }

  // Get expected MIME type from file extension
  static getMimeFromExtension(extension) {
    const mimeMap = {
      // Images
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'bmp': 'image/bmp',
      'tiff': 'image/tiff',
      'tif': 'image/tiff',
      'svg': 'image/svg+xml',
      'ico': 'image/x-icon',

      // Documents
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'ppt': 'application/vnd.ms-powerpoint',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',

      // Archives
      'zip': 'application/zip',
      'rar': 'application/x-rar-compressed',
      '7z': 'application/x-7z-compressed',
      'tar': 'application/x-tar',
      'gz': 'application/gzip',

      // Audio
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'ogg': 'audio/ogg',
      'flac': 'audio/flac',
      'aac': 'audio/aac',
      'm4a': 'audio/mp4',

      // Video
      'mp4': 'video/mp4',
      'avi': 'video/x-msvideo',
      'mov': 'video/quicktime',
      'wmv': 'video/x-ms-wmv',
      'flv': 'video/x-flv',
      'webm': 'video/webm',
      'mkv': 'video/x-matroska',

      // Text
      'txt': 'text/plain',
      'html': 'text/html',
      'htm': 'text/html',
      'css': 'text/css',
      'js': 'application/javascript',
      'json': 'application/json',
      'xml': 'application/xml',
      'csv': 'text/csv',
      'md': 'text/markdown'
    };

    return mimeMap[extension.toLowerCase()] || 'application/octet-stream';
  }

  // Detect MIME type from file signature
  static async detectMimeFromSignature(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const bytes = new Uint8Array(e.target.result);
        
        for (const [mimeType, signatures] of Object.entries(this.FILE_SIGNATURES)) {
          for (const signature of signatures) {
            if (this.matchesSignature(bytes, signature)) {
              resolve(mimeType);
              return;
            }
          }
        }
        
        // If no signature matches, try to detect text files
        if (this.isTextFile(bytes)) {
          resolve('text/plain');
        } else {
          resolve('application/octet-stream');
        }
      };
      
      reader.onerror = () => resolve('application/octet-stream');
      
      // Read first 32 bytes for signature detection
      const blob = file.slice(0, 32);
      reader.readAsArrayBuffer(blob);
    });
  }

  // Check if bytes match a signature pattern
  static matchesSignature(bytes, signature) {
    if (signature.length > bytes.length) return false;
    
    for (let i = 0; i < signature.length; i++) {
      if (signature[i] !== null && bytes[i] !== signature[i]) {
        return false;
      }
    }
    return true;
  }

  // Check if file appears to be text
  static isTextFile(bytes) {
    // Check first 512 bytes for text content
    const sampleSize = Math.min(512, bytes.length);
    let textBytes = 0;
    
    for (let i = 0; i < sampleSize; i++) {
      const byte = bytes[i];
      // Count printable ASCII characters and common whitespace
      if ((byte >= 32 && byte <= 126) || byte === 9 || byte === 10 || byte === 13) {
        textBytes++;
      }
    }
    
    // If more than 80% are text characters, consider it text
    return (textBytes / sampleSize) > 0.8;
  }

  // Validate file against allowed types
  static validateFileType(file, allowedTypes = ['*']) {
    const errors = [];
    const warnings = [];
    
    // If all types allowed, skip validation
    if (allowedTypes.includes('*')) {
      return { isValid: true, errors, warnings };
    }
    
    const extension = this.getFileExtension(file.name);
    const declaredMime = file.type;
    const expectedMime = this.getMimeFromExtension(extension);
    
    // Check if file type is allowed
    const isAllowed = allowedTypes.some(allowedType => {
      if (allowedType === '*') return true;
      if (allowedType.endsWith('/*')) {
        const category = allowedType.slice(0, -2);
        return declaredMime.startsWith(category + '/') || expectedMime.startsWith(category + '/');
      }
      return allowedType === declaredMime || allowedType === expectedMime || allowedType === extension;
    });
    
    if (!isAllowed) {
      errors.push(`File type not allowed. Allowed types: ${allowedTypes.join(', ')}`);
    }
    
    // Check for MIME/extension mismatch
    if (declaredMime && expectedMime !== 'application/octet-stream') {
      if (!declaredMime.startsWith(expectedMime.split('/')[0])) {
        warnings.push(`File extension (${extension}) doesn't match declared type (${declaredMime})`);
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      declaredMime,
      expectedMime,
      extension
    };
  }

  // Comprehensive file validation
  static async validateFile(file, allowedTypes = ['*'], options = {}) {
    const { checkSignature = true, maxSize = 100 * 1024 * 1024 } = options;
    
    const result = {
      isValid: true,
      errors: [],
      warnings: [],
      fileInfo: {
        name: file.name,
        size: file.size,
        declaredMime: file.type,
        extension: this.getFileExtension(file.name),
        expectedMime: this.getMimeFromExtension(this.getFileExtension(file.name))
      }
    };
    
    // Size validation
    if (file.size > maxSize) {
      result.errors.push(`File size (${this.formatFileSize(file.size)}) exceeds limit (${this.formatFileSize(maxSize)})`);
    }
    
    // Type validation
    const typeValidation = this.validateFileType(file, allowedTypes);
    result.errors.push(...typeValidation.errors);
    result.warnings.push(...typeValidation.warnings);
    
    // Signature validation
    if (checkSignature && result.errors.length === 0) {
      try {
        const detectedMime = await this.detectMimeFromSignature(file);
        result.fileInfo.detectedMime = detectedMime;
        
        // Check if detected MIME matches declared or expected
        if (detectedMime !== 'application/octet-stream' && 
            file.type && 
            !file.type.startsWith(detectedMime.split('/')[0])) {
          result.warnings.push(`File signature suggests ${detectedMime}, but declared as ${file.type}`);
        }
      } catch (error) {
        result.warnings.push('Could not verify file signature');
      }
    }
    
    result.isValid = result.errors.length === 0;
    return result;
  }

  // Format file size for display
  static formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Get user-friendly type description
  static getTypeDescription(mimeType) {
    const descriptions = {
      'image/*': 'Images',
      'video/*': 'Videos', 
      'audio/*': 'Audio files',
      'text/*': 'Text files',
      'application/pdf': 'PDF documents',
      'application/zip': 'ZIP archives',
      'application/json': 'JSON files',
      'application/javascript': 'JavaScript files'
    };
    
    if (descriptions[mimeType]) return descriptions[mimeType];
    
    // Check for wildcard matches
    for (const [pattern, description] of Object.entries(descriptions)) {
      if (pattern.endsWith('/*') && mimeType.startsWith(pattern.slice(0, -1))) {
        return description;
      }
    }
    
    return mimeType;
  }
}

export default FileValidationService;