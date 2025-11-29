const FILE_LIMITS = {
  'image/': 20 * 1024 * 1024,      // 20MB for images
  'application/pdf': 50 * 1024 * 1024,  // 50MB for PDFs
  'application/': 50 * 1024 * 1024,     // 50MB for documents
  'text/': 50 * 1024 * 1024,            // 50MB for text files
  'audio/': 100 * 1024 * 1024,          // 100MB for audio
  'video/': 100 * 1024 * 1024,          // 100MB for video
  'default': 20 * 1024 * 1024           // 20MB default
};

const validateFileSize = (mimeType, size) => {
  let limit = FILE_LIMITS.default;
  
  for (const [type, maxSize] of Object.entries(FILE_LIMITS)) {
    if (type !== 'default' && mimeType.startsWith(type)) {
      limit = maxSize;
      break;
    }
  }
  
  return {
    isValid: size <= limit,
    limit,
    size,
    mimeType
  };
};

module.exports = { FILE_LIMITS, validateFileSize };