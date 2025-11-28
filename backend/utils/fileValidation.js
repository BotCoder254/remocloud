const fs = require('fs');

class FileValidationService {
  // File signatures (magic bytes) for server-side validation
  static FILE_SIGNATURES = {
    // Images
    'image/jpeg': [
      Buffer.from([0xFF, 0xD8, 0xFF]),
      Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]),
      Buffer.from([0xFF, 0xD8, 0xFF, 0xE1])
    ],
    'image/png': [Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])],
    'image/gif': [
      Buffer.from([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]),
      Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
    ],
    'image/webp': [Buffer.from([0x52, 0x49, 0x46, 0x46])], // Simplified check
    'image/bmp': [Buffer.from([0x42, 0x4D])],

    // Documents
    'application/pdf': [Buffer.from([0x25, 0x50, 0x44, 0x46])],
    'application/zip': [
      Buffer.from([0x50, 0x4B, 0x03, 0x04]),
      Buffer.from([0x50, 0x4B, 0x05, 0x06])
    ],

    // Audio
    'audio/mpeg': [
      Buffer.from([0xFF, 0xFB]),
      Buffer.from([0xFF, 0xF3]),
      Buffer.from([0x49, 0x44, 0x33])
    ],
    'audio/wav': [Buffer.from([0x52, 0x49, 0x46, 0x46])], // Simplified

    // Video
    'video/mp4': [Buffer.from([0x00, 0x00, 0x00])], // Simplified check
    'video/avi': [Buffer.from([0x52, 0x49, 0x46, 0x46])] // Simplified
  };

  // Get MIME type from file extension
  static getMimeFromExtension(filename) {
    const ext = filename.toLowerCase().split('.').pop();
    const mimeMap = {
      // Images
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'bmp': 'image/bmp',
      'svg': 'image/svg+xml',

      // Documents
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

      // Archives
      'zip': 'application/zip',
      'rar': 'application/x-rar-compressed',

      // Audio
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'ogg': 'audio/ogg',

      // Video
      'mp4': 'video/mp4',
      'avi': 'video/x-msvideo',
      'mov': 'video/quicktime',

      // Text
      'txt': 'text/plain',
      'html': 'text/html',
      'css': 'text/css',
      'js': 'application/javascript',
      'json': 'application/json'
    };

    return mimeMap[ext] || 'application/octet-stream';
  }

  // Detect MIME type from file signature
  static detectMimeFromFile(filePath) {
    try {
      const buffer = fs.readFileSync(filePath, { start: 0, end: 32 });
      
      for (const [mimeType, signatures] of Object.entries(this.FILE_SIGNATURES)) {
        for (const signature of signatures) {
          if (buffer.subarray(0, signature.length).equals(signature)) {
            return mimeType;
          }
        }
      }
      
      // Check if it's a text file
      if (this.isTextFile(buffer)) {
        return 'text/plain';
      }
      
      return 'application/octet-stream';
    } catch (error) {
      return 'application/octet-stream';
    }
  }

  // Check if file appears to be text
  static isTextFile(buffer) {
    const sampleSize = Math.min(512, buffer.length);
    let textBytes = 0;
    
    for (let i = 0; i < sampleSize; i++) {
      const byte = buffer[i];
      if ((byte >= 32 && byte <= 126) || byte === 9 || byte === 10 || byte === 13) {
        textBytes++;
      }
    }
    
    return (textBytes / sampleSize) > 0.8;
  }

  // Validate file type against allowed types
  static validateFileType(filename, declaredMime, allowedTypes = ['*']) {
    const errors = [];
    const warnings = [];
    
    if (allowedTypes.includes('*')) {
      return { isValid: true, errors, warnings };
    }
    
    const expectedMime = this.getMimeFromExtension(filename);
    const extension = filename.toLowerCase().split('.').pop();
    
    // Check if type is allowed
    const isAllowed = allowedTypes.some(allowedType => {
      if (allowedType === '*') return true;
      if (allowedType.endsWith('/*')) {
        const category = allowedType.slice(0, -2);
        return declaredMime.startsWith(category + '/') || expectedMime.startsWith(category + '/');
      }
      return allowedType === declaredMime || allowedType === expectedMime || allowedType === extension;
    });
    
    if (!isAllowed) {
      errors.push(`File type '${declaredMime}' not allowed. Allowed types: ${allowedTypes.join(', ')}`);
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      expectedMime,
      extension
    };
  }

  // Comprehensive file validation
  static validateUploadedFile(filePath, filename, declaredMime, allowedTypes = ['*']) {
    const result = {
      isValid: true,
      errors: [],
      warnings: [],
      fileInfo: {
        filename,
        declaredMime,
        expectedMime: this.getMimeFromExtension(filename),
        detectedMime: null
      }
    };
    
    // Type validation
    const typeValidation = this.validateFileType(filename, declaredMime, allowedTypes);
    result.errors.push(...typeValidation.errors);
    result.warnings.push(...typeValidation.warnings);
    
    // Signature validation
    if (result.errors.length === 0) {
      const detectedMime = this.detectMimeFromFile(filePath);
      result.fileInfo.detectedMime = detectedMime;
      
      // Check for signature mismatch
      if (detectedMime !== 'application/octet-stream' && 
          declaredMime && 
          !this.mimeTypesCompatible(declaredMime, detectedMime)) {
        result.errors.push(`File signature mismatch: declared as '${declaredMime}' but appears to be '${detectedMime}'`);
      }
    }
    
    result.isValid = result.errors.length === 0;
    return result;
  }

  // Check if MIME types are compatible
  static mimeTypesCompatible(declared, detected) {
    if (declared === detected) return true;
    
    // Allow some flexibility for similar types
    const declaredCategory = declared.split('/')[0];
    const detectedCategory = detected.split('/')[0];
    
    return declaredCategory === detectedCategory;
  }

  // Get user-friendly error message
  static formatValidationError(validation, allowedTypes) {
    if (validation.isValid) return null;
    
    const typeDescriptions = allowedTypes.map(type => {
      if (type.endsWith('/*')) {
        const category = type.slice(0, -2);
        return category === 'image' ? 'images' : 
               category === 'video' ? 'videos' :
               category === 'audio' ? 'audio files' :
               category === 'text' ? 'text files' : `${category} files`;
      }
      return type;
    });
    
    return {
      message: validation.errors[0],
      allowedTypes: typeDescriptions,
      suggestion: `Please upload ${typeDescriptions.join(', ')} only.`
    };
  }
}

module.exports = FileValidationService;