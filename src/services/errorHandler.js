// Frontend error handling and retry logic

import { toast } from 'react-hot-toast';

// Error types and their handling strategies
const ERROR_HANDLING = {
  // Authentication errors - redirect to login
  INVALID_API_KEY: {
    type: 'auth',
    severity: 'error',
    action: 'redirect_login',
    showToast: true,
    retryable: false
  },
  INSUFFICIENT_PERMISSIONS: {
    type: 'auth',
    severity: 'error',
    action: 'show_permissions_help',
    showToast: true,
    retryable: false
  },
  BUCKET_ACCESS_DENIED: {
    type: 'auth',
    severity: 'error',
    action: 'show_api_key_help',
    showToast: true,
    retryable: false
  },

  // Validation errors - show inline
  INVALID_FILE_TYPE: {
    type: 'validation',
    severity: 'error',
    action: 'show_inline',
    showToast: false,
    retryable: false
  },
  FILE_TOO_LARGE: {
    type: 'validation',
    severity: 'error',
    action: 'show_inline',
    showToast: false,
    retryable: false
  },
  BUCKET_NAME_TAKEN: {
    type: 'validation',
    severity: 'error',
    action: 'show_inline',
    showToast: false,
    retryable: false
  },

  // Upload errors - retry with backoff
  UPLOAD_FAILED: {
    type: 'upload',
    severity: 'error',
    action: 'retry_with_backoff',
    showToast: true,
    retryable: true,
    maxRetries: 3
  },
  UPLOAD_TIMEOUT: {
    type: 'upload',
    severity: 'warning',
    action: 'retry_with_backoff',
    showToast: true,
    retryable: true,
    maxRetries: 2
  },
  SIGNED_URL_EXPIRED: {
    type: 'upload',
    severity: 'info',
    action: 'restart_upload',
    showToast: true,
    retryable: true,
    maxRetries: 1
  },

  // Service errors - retry with exponential backoff
  STORAGE_ERROR: {
    type: 'service',
    severity: 'error',
    action: 'retry_exponential',
    showToast: true,
    retryable: true,
    maxRetries: 3
  },
  TRANSFORM_FAILED: {
    type: 'service',
    severity: 'error',
    action: 'retry_exponential',
    showToast: true,
    retryable: true,
    maxRetries: 2
  },
  DATABASE_ERROR: {
    type: 'service',
    severity: 'error',
    action: 'retry_exponential',
    showToast: true,
    retryable: true,
    maxRetries: 3
  },

  // Rate limiting - show quota info
  RATE_LIMIT_EXCEEDED: {
    type: 'rate_limit',
    severity: 'warning',
    action: 'show_rate_limit_help',
    showToast: true,
    retryable: true,
    maxRetries: 1
  },
  QUOTA_EXCEEDED: {
    type: 'quota',
    severity: 'error',
    action: 'show_quota_help',
    showToast: true,
    retryable: false
  },

  // Not found errors
  FILE_NOT_FOUND: {
    type: 'not_found',
    severity: 'error',
    action: 'show_inline',
    showToast: false,
    retryable: false
  },
  BUCKET_NOT_FOUND: {
    type: 'not_found',
    severity: 'error',
    action: 'show_inline',
    showToast: false,
    retryable: false
  }
};

// Retry configuration
const RETRY_CONFIG = {
  upload: {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffFactor: 2,
    jitter: true
  },
  api: {
    maxRetries: 3,
    baseDelay: 500,
    maxDelay: 5000,
    backoffFactor: 1.5,
    jitter: true
  },
  transform: {
    maxRetries: 2,
    baseDelay: 2000,
    maxDelay: 8000,
    backoffFactor: 2,
    jitter: false
  }
};

// Calculate retry delay with exponential backoff and jitter
function calculateRetryDelay(attempt, config) {
  const delay = Math.min(
    config.baseDelay * Math.pow(config.backoffFactor, attempt),
    config.maxDelay
  );
  
  if (config.jitter) {
    // Add random jitter (±25%)
    const jitter = delay * 0.25 * (Math.random() * 2 - 1);
    return Math.max(0, delay + jitter);
  }
  
  return delay;
}

// Enhanced error handler class
class ErrorHandler {
  constructor() {
    this.retryAttempts = new Map();
  }

  // Main error handling method
  async handleError(error, context = {}) {
    const errorCode = error?.response?.data?.error?.code || 'INTERNAL_ERROR';
    const errorData = error?.response?.data?.error || {};
    const handling = ERROR_HANDLING[errorCode] || ERROR_HANDLING.INTERNAL_ERROR;

    console.error('Handling error:', {
      code: errorCode,
      message: errorData.message,
      context,
      handling
    });

    // Show toast notification if configured
    if (handling.showToast) {
      this.showToast(errorCode, errorData, handling.severity);
    }

    // Execute specific action
    switch (handling.action) {
      case 'retry_with_backoff':
        return this.handleRetryWithBackoff(error, context, handling);
      
      case 'retry_exponential':
        return this.handleRetryExponential(error, context, handling);
      
      case 'restart_upload':
        return this.handleRestartUpload(error, context);
      
      case 'show_permissions_help':
        return this.showPermissionsHelp(errorData);
      
      case 'show_api_key_help':
        return this.showApiKeyHelp(errorData);
      
      case 'show_rate_limit_help':
        return this.showRateLimitHelp(errorData);
      
      case 'show_quota_help':
        return this.showQuotaHelp(errorData);
      
      case 'redirect_login':
        return this.redirectToLogin();
      
      case 'show_inline':
      default:
        return { success: false, error: errorData, retryable: handling.retryable };
    }
  }

  // Retry with backoff for uploads
  async handleRetryWithBackoff(error, context, handling) {
    const { operation, operationId } = context;
    const retryKey = `${operation}-${operationId}`;
    const attempts = this.retryAttempts.get(retryKey) || 0;

    if (attempts >= handling.maxRetries) {
      this.retryAttempts.delete(retryKey);
      toast.error('Upload failed after multiple attempts. Please try again.');
      return { success: false, error: error.response?.data?.error, retryable: false };
    }

    const config = RETRY_CONFIG.upload;
    const delay = calculateRetryDelay(attempts, config);
    
    this.retryAttempts.set(retryKey, attempts + 1);

    toast.loading(`Retrying upload... (${attempts + 1}/${handling.maxRetries})`, {
      id: `retry-${retryKey}`
    });

    await new Promise(resolve => setTimeout(resolve, delay));
    
    return { success: false, shouldRetry: true, retryDelay: delay };
  }

  // Retry with exponential backoff for API calls
  async handleRetryExponential(error, context, handling) {
    const { operation } = context;
    const retryKey = `api-${operation}`;
    const attempts = this.retryAttempts.get(retryKey) || 0;

    if (attempts >= handling.maxRetries) {
      this.retryAttempts.delete(retryKey);
      return { success: false, error: error.response?.data?.error, retryable: false };
    }

    const config = RETRY_CONFIG.api;
    const delay = calculateRetryDelay(attempts, config);
    
    this.retryAttempts.set(retryKey, attempts + 1);

    await new Promise(resolve => setTimeout(resolve, delay));
    
    return { success: false, shouldRetry: true, retryDelay: delay };
  }

  // Handle upload restart for expired URLs
  async handleRestartUpload(error, context) {
    toast.info('Upload link expired. Starting a new upload...');
    
    // Clear any existing retry attempts
    const { operationId } = context;
    this.retryAttempts.delete(`upload-${operationId}`);
    
    return { success: false, shouldRestart: true };
  }

  // Show toast notifications
  showToast(errorCode, errorData, severity) {
    const message = errorData.userMessage || errorData.message || 'An error occurred';
    
    switch (severity) {
      case 'error':
        toast.error(message, { duration: 5000 });
        break;
      case 'warning':
        toast.error(message, { duration: 4000, icon: '⚠️' });
        break;
      case 'info':
        toast(message, { duration: 3000, icon: 'ℹ️' });
        break;
      default:
        toast.error(message);
    }
  }

  // Show permissions help modal
  showPermissionsHelp(errorData) {
    toast.error(
      'Insufficient permissions. Check your API key scopes.',
      {
        duration: 6000,
        action: {
          label: 'View API Keys',
          onClick: () => window.location.href = '/dashboard/api-keys'
        }
      }
    );
    return { success: false, retryable: false };
  }

  // Show API key help
  showApiKeyHelp(errorData) {
    toast.error(
      'This bucket is private. Generate an API key with bucket access.',
      {
        duration: 6000,
        action: {
          label: 'Generate Key',
          onClick: () => window.location.href = '/dashboard/api-keys'
        }
      }
    );
    return { success: false, retryable: false };
  }

  // Show rate limit help
  showRateLimitHelp(errorData) {
    const retryAfter = errorData.retryAfter || 60;
    toast.error(
      `Rate limit exceeded. Please wait ${retryAfter} seconds.`,
      {
        duration: 6000,
        action: {
          label: 'View Usage',
          onClick: () => window.location.href = '/dashboard/analytics'
        }
      }
    );
    return { success: false, retryable: true, retryAfter };
  }

  // Show quota help
  showQuotaHelp(errorData) {
    toast.error(
      'Storage quota exceeded. Please upgrade your plan or delete some files.',
      {
        duration: 8000,
        action: {
          label: 'View Usage',
          onClick: () => window.location.href = '/dashboard/analytics'
        }
      }
    );
    return { success: false, retryable: false };
  }

  // Redirect to login
  redirectToLogin() {
    toast.error('Authentication required. Redirecting to login...');
    setTimeout(() => {
      window.location.href = '/login';
    }, 2000);
    return { success: false, retryable: false };
  }

  // Clear retry attempts for an operation
  clearRetryAttempts(operationId) {
    const keysToDelete = [];
    for (const key of this.retryAttempts.keys()) {
      if (key.includes(operationId)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.retryAttempts.delete(key));
  }

  // Get retry status
  getRetryStatus(operationId) {
    const uploadKey = `upload-${operationId}`;
    const apiKey = `api-${operationId}`;
    
    return {
      uploadAttempts: this.retryAttempts.get(uploadKey) || 0,
      apiAttempts: this.retryAttempts.get(apiKey) || 0
    };
  }
}

// Create singleton instance
const errorHandler = new ErrorHandler();

// Export error handling utilities
export {
  errorHandler,
  ERROR_HANDLING,
  RETRY_CONFIG,
  calculateRetryDelay
};

export default errorHandler;