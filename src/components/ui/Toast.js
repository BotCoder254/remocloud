import React from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Info, 
  X,
  ExternalLink,
  RefreshCw
} from 'lucide-react';

// Custom toast component with actions
const CustomToast = ({ t, title, message, type, action, onDismiss }) => {
  const icons = {
    success: CheckCircle,
    error: XCircle,
    warning: AlertTriangle,
    info: Info,
    loading: RefreshCw
  };

  const Icon = icons[type] || Info;
  
  const colors = {
    success: 'text-green-600 bg-green-50 border-green-200',
    error: 'text-red-600 bg-red-50 border-red-200',
    warning: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    info: 'text-blue-600 bg-blue-50 border-blue-200',
    loading: 'text-gray-600 bg-gray-50 border-gray-200'
  };

  return (
    <div
      className={`${
        t.visible ? 'animate-enter' : 'animate-leave'
      } max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5 ${colors[type]}`}
    >
      <div className="flex-1 w-0 p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <Icon className={`h-5 w-5 ${type === 'loading' ? 'animate-spin' : ''}`} />
          </div>
          <div className="ml-3 flex-1">
            {title && (
              <p className="text-sm font-medium text-gray-900">
                {title}
              </p>
            )}
            <p className={`text-sm text-gray-500 ${title ? 'mt-1' : ''}`}>
              {message}
            </p>
            {action && (
              <div className="mt-3">
                <button
                  onClick={() => {
                    action.onClick();
                    toast.dismiss(t.id);
                  }}
                  className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-500"
                >
                  {action.label}
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex border-l border-gray-200">
        <button
          onClick={() => {
            toast.dismiss(t.id);
            onDismiss?.();
          }}
          className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-gray-600 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// Enhanced toast functions with better UX
export const showToast = {
  success: (message, options = {}) => {
    return toast.custom((t) => (
      <CustomToast
        t={t}
        type="success"
        message={message}
        {...options}
      />
    ), { duration: 4000, ...options });
  },

  error: (message, options = {}) => {
    return toast.custom((t) => (
      <CustomToast
        t={t}
        type="error"
        message={message}
        {...options}
      />
    ), { duration: 6000, ...options });
  },

  warning: (message, options = {}) => {
    return toast.custom((t) => (
      <CustomToast
        t={t}
        type="warning"
        message={message}
        {...options}
      />
    ), { duration: 5000, ...options });
  },

  info: (message, options = {}) => {
    return toast.custom((t) => (
      <CustomToast
        t={t}
        type="info"
        message={message}
        {...options}
      />
    ), { duration: 4000, ...options });
  },

  loading: (message, options = {}) => {
    return toast.custom((t) => (
      <CustomToast
        t={t}
        type="loading"
        message={message}
        {...options}
      />
    ), { duration: Infinity, ...options });
  },

  // Specialized toasts for common scenarios
  uploadSuccess: (fileName) => {
    return showToast.success(`${fileName} uploaded successfully`);
  },

  uploadError: (fileName, error) => {
    return showToast.error(`Failed to upload ${fileName}`, {
      title: 'Upload Failed',
      action: error.retryable ? {
        label: 'Retry',
        onClick: () => window.location.reload()
      } : null
    });
  },

  networkError: () => {
    return showToast.error('Network connection lost. Please check your internet connection.', {
      title: 'Connection Error',
      action: {
        label: 'Retry',
        onClick: () => window.location.reload()
      }
    });
  },

  quotaExceeded: () => {
    return showToast.error('Storage quota exceeded. Please upgrade your plan or delete some files.', {
      title: 'Quota Exceeded',
      action: {
        label: 'View Usage',
        onClick: () => window.location.href = '/dashboard/analytics'
      }
    });
  },

  rateLimited: (retryAfter) => {
    return showToast.warning(`Rate limit exceeded. Please wait ${retryAfter} seconds before trying again.`, {
      title: 'Rate Limited',
      action: {
        label: 'View Limits',
        onClick: () => window.location.href = '/dashboard/analytics'
      }
    });
  },

  permissionDenied: () => {
    return showToast.error('You don\'t have permission to perform this action.', {
      title: 'Permission Denied',
      action: {
        label: 'Check API Keys',
        onClick: () => window.location.href = '/dashboard/api-keys'
      }
    });
  },

  fileNotFound: (fileName) => {
    return showToast.error(`${fileName} not found. It may have been deleted or moved.`, {
      title: 'File Not Found'
    });
  },

  transformError: (fileName) => {
    return showToast.error(`Failed to process ${fileName}. Please try again with a different image.`, {
      title: 'Processing Failed'
    });
  }
};

// Progress toast for uploads
export const createProgressToast = (fileName) => {
  const toastId = toast.custom((t) => (
    <div className="max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5">
      <div className="flex-1 w-0 p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />
          </div>
          <div className="ml-3 flex-1">
            <p className="text-sm font-medium text-gray-900">
              Uploading {fileName}
            </p>
            <div className="mt-2">
              <div className="bg-gray-200 rounded-full h-2">
                <div 
                  id={`progress-${t.id}`}
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: '0%' }}
                />
              </div>
              <p id={`progress-text-${t.id}`} className="text-xs text-gray-500 mt-1">
                0% complete
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  ), { duration: Infinity });

  return {
    id: toastId,
    updateProgress: (progress) => {
      const progressBar = document.getElementById(`progress-${toastId}`);
      const progressText = document.getElementById(`progress-text-${toastId}`);
      
      if (progressBar) {
        progressBar.style.width = `${progress}%`;
      }
      if (progressText) {
        progressText.textContent = `${Math.round(progress)}% complete`;
      }
    },
    complete: () => {
      toast.dismiss(toastId);
      showToast.success(`${fileName} uploaded successfully`);
    },
    error: (error) => {
      toast.dismiss(toastId);
      showToast.uploadError(fileName, error);
    }
  };
};

// Hook for using toast in components
export const useToast = () => {
  return {
    success: showToast.success,
    error: showToast.error,
    warning: showToast.warning,
    info: showToast.info,
    loading: showToast.loading,
    uploadSuccess: showToast.uploadSuccess,
    uploadError: showToast.uploadError,
    networkError: showToast.networkError,
    quotaExceeded: showToast.quotaExceeded,
    rateLimited: showToast.rateLimited,
    permissionDenied: showToast.permissionDenied,
    fileNotFound: showToast.fileNotFound,
    transformError: showToast.transformError
  };
};

// Toast container component
export const ToastContainer = () => {
  return (
    <Toaster
      position="top-right"
      reverseOrder={false}
      gutter={8}
      containerClassName=""
      containerStyle={{}}
      toastOptions={{
        // Default options for all toasts
        className: '',
        duration: 4000,
        style: {
          background: 'transparent',
          boxShadow: 'none',
          padding: 0,
          margin: 0
        }
      }}
    />
  );
};

export default ToastContainer;