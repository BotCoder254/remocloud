// Standardized error handling for RemoCloud API

class RemoCloudError extends Error {
  constructor(code, message, details = {}, statusCode = 500) {
    super(message);
    this.name = 'RemoCloudError';
    this.code = code;
    this.details = details;
    this.statusCode = statusCode;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
        timestamp: this.timestamp
      }
    };
  }
}

// Error codes and their configurations
const ERROR_CODES = {
  // Authentication & Authorization (401, 403)
  INVALID_API_KEY: {
    message: 'Invalid API key provided',
    statusCode: 401,
    retryable: false,
    userMessage: 'Your API key is invalid. Please check your credentials.'
  },
  INSUFFICIENT_PERMISSIONS: {
    message: 'Insufficient permissions for this operation',
    statusCode: 403,
    retryable: false,
    userMessage: 'You don\'t have permission to perform this action. Check your API key scopes.'
  },
  BUCKET_ACCESS_DENIED: {
    message: 'Access denied to bucket',
    statusCode: 403,
    retryable: false,
    userMessage: 'This bucket is private. Generate an API key with bucket access.'
  },

  // Validation Errors (400)
  INVALID_FILE_TYPE: {
    message: 'File type not allowed',
    statusCode: 400,
    retryable: false,
    userMessage: 'This file type is not allowed. Please check the allowed file types for this bucket.'
  },
  FILE_TOO_LARGE: {
    message: 'File size exceeds limit',
    statusCode: 413,
    retryable: false,
    userMessage: 'File is too large. Maximum file size is {maxSize}.'
  },
  INVALID_TRANSFORM_PARAMS: {
    message: 'Invalid image transform parameters',
    statusCode: 400,
    retryable: false,
    userMessage: 'Invalid image transform parameters. Please check the documentation.'
  },
  BUCKET_NAME_TAKEN: {
    message: 'Bucket name already exists',
    statusCode: 409,
    retryable: false,
    userMessage: 'This bucket name is already taken. Please choose a different name.'
  },

  // Upload Errors (400, 500)
  UPLOAD_FAILED: {
    message: 'File upload failed',
    statusCode: 500,
    retryable: true,
    userMessage: 'Upload failed. Please try again.'
  },
  UPLOAD_TIMEOUT: {
    message: 'Upload timed out',
    statusCode: 408,
    retryable: true,
    userMessage: 'Upload timed out. Please check your connection and try again.'
  },
  SIGNED_URL_EXPIRED: {
    message: 'Signed URL has expired',
    statusCode: 410,
    retryable: true,
    userMessage: 'Upload link expired. Starting a new upload...'
  },
  UPLOAD_SESSION_NOT_FOUND: {
    message: 'Upload session not found',
    statusCode: 404,
    retryable: false,
    userMessage: 'Upload session expired. Please start a new upload.'
  },

  // Storage & Processing (500, 503)
  STORAGE_ERROR: {
    message: 'Storage service error',
    statusCode: 503,
    retryable: true,
    retryAfter: 30,
    userMessage: 'Storage service temporarily unavailable. Retrying...'
  },
  TRANSFORM_FAILED: {
    message: 'Image transform failed',
    statusCode: 500,
    retryable: true,
    userMessage: 'Image processing failed. Please try again.'
  },
  TRANSFORM_TIMEOUT: {
    message: 'Image transform timed out',
    statusCode: 408,
    retryable: true,
    userMessage: 'Image processing timed out. Please try again with a smaller image.'
  },

  // Database Errors (500, 503)
  DATABASE_ERROR: {
    message: 'Database operation failed',
    statusCode: 503,
    retryable: true,
    retryAfter: 10,
    userMessage: 'Service temporarily unavailable. Please try again.'
  },
  DATABASE_TIMEOUT: {
    message: 'Database query timed out',
    statusCode: 408,
    retryable: true,
    userMessage: 'Request timed out. Please try again.'
  },

  // Rate Limiting (429)
  RATE_LIMIT_EXCEEDED: {
    message: 'Rate limit exceeded',
    statusCode: 429,
    retryable: true,
    retryAfter: 60,
    userMessage: 'Too many requests. Please wait before trying again.'
  },
  QUOTA_EXCEEDED: {
    message: 'Storage quota exceeded',
    statusCode: 429,
    retryable: false,
    userMessage: 'Storage quota exceeded. Please upgrade your plan or delete some files.'
  },

  // Not Found (404)
  FILE_NOT_FOUND: {
    message: 'File not found',
    statusCode: 404,
    retryable: false,
    userMessage: 'File not found. It may have been deleted or moved.'
  },
  BUCKET_NOT_FOUND: {
    message: 'Bucket not found',
    statusCode: 404,
    retryable: false,
    userMessage: 'Bucket not found. Please check the bucket ID.'
  },

  // Generic Errors
  INTERNAL_ERROR: {
    message: 'Internal server error',
    statusCode: 500,
    retryable: true,
    userMessage: 'Something went wrong. Please try again.'
  },
  SERVICE_UNAVAILABLE: {
    message: 'Service temporarily unavailable',
    statusCode: 503,
    retryable: true,
    retryAfter: 30,
    userMessage: 'Service temporarily unavailable. Please try again later.'
  }
};

// Create standardized error
function createError(code, details = {}, customMessage = null) {
  const errorConfig = ERROR_CODES[code];
  if (!errorConfig) {
    throw new Error(`Unknown error code: ${code}`);
  }

  const message = customMessage || errorConfig.message;
  return new RemoCloudError(code, message, details, errorConfig.statusCode);
}

// Error middleware for Express
function errorHandler(err, req, res, next) {
  // Log error with context
  console.error('API Error:', {
    error: err.message,
    code: err.code,
    stack: err.stack,
    url: req.url,
    method: req.method,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  // Handle RemoCloudError
  if (err instanceof RemoCloudError) {
    const response = err.toJSON();
    const errorConfig = ERROR_CODES[err.code];
    
    // Add retry information
    if (errorConfig?.retryable) {
      response.error.retryable = true;
      if (errorConfig.retryAfter) {
        res.set('Retry-After', errorConfig.retryAfter);
        response.error.retryAfter = errorConfig.retryAfter;
      }
    }

    // Add user-friendly message
    if (errorConfig?.userMessage) {
      response.error.userMessage = errorConfig.userMessage.replace(
        '{maxSize}', 
        details?.maxSize || '100MB'
      );
    }

    return res.status(err.statusCode).json(response);
  }

  // Handle validation errors
  if (err.name === 'ValidationError') {
    const error = createError('INVALID_REQUEST', {
      fields: Object.keys(err.errors)
    }, 'Validation failed');
    return res.status(400).json(error.toJSON());
  }

  // Handle database errors
  if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
    const error = createError('DATABASE_ERROR');
    return res.status(503).json(error.toJSON());
  }

  // Handle file size errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    const error = createError('FILE_TOO_LARGE', {
      maxSize: err.limit,
      receivedSize: err.received
    });
    return res.status(413).json(error.toJSON());
  }

  // Generic error fallback
  const error = createError('INTERNAL_ERROR');
  res.status(500).json(error.toJSON());
}

// Async error wrapper
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Retry configuration for different operations
const RETRY_CONFIG = {
  upload: {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffFactor: 2
  },
  transform: {
    maxRetries: 2,
    baseDelay: 2000,
    maxDelay: 8000,
    backoffFactor: 2
  },
  database: {
    maxRetries: 3,
    baseDelay: 500,
    maxDelay: 5000,
    backoffFactor: 1.5
  },
  storage: {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 15000,
    backoffFactor: 2
  }
};

module.exports = {
  RemoCloudError,
  ERROR_CODES,
  createError,
  errorHandler,
  asyncHandler,
  RETRY_CONFIG
};