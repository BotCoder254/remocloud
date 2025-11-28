import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Hash, 
  Copy, 
  Check, 
  Shield, 
  AlertTriangle,
  Loader,
  Eye,
  EyeOff
} from 'lucide-react';
import { HashService } from '../../services/hash';
import { useToast } from './Toast';

const HashDisplay = ({ 
  hash, 
  fileId, 
  filename, 
  onVerify, 
  className = '',
  compact = false 
}) => {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showFullHash, setShowFullHash] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);

  const handleCopyHash = async () => {
    if (!hash) return;
    
    try {
      await HashService.copyHashToClipboard(hash);
      setCopied(true);
      toast.success('Hash copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy hash');
    }
  };

  const handleVerifyIntegrity = async () => {
    if (!fileId || !onVerify) return;
    
    setIsVerifying(true);
    try {
      const result = await onVerify(fileId);
      setVerificationResult(result);
      
      if (result.integrity.overall) {
        toast.success('File integrity verified successfully');
      } else {
        toast.error('File integrity verification failed');
      }
    } catch (error) {
      toast.error('Failed to verify file integrity');
      setVerificationResult({ error: error.message });
    } finally {
      setIsVerifying(false);
    }
  };

  const displayHash = showFullHash ? hash : HashService.formatHash(hash, compact ? 12 : 16);

  if (!hash) {
    return (
      <div className={`flex items-center gap-2 text-text-secondary-light dark:text-text-secondary-dark ${className}`}>
        <Hash className="w-4 h-4" />
        <span className="text-sm">No hash available</span>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Hash Display */}
      <div className="flex items-center gap-2">
        <Hash className="w-4 h-4 text-text-secondary-light dark:text-text-secondary-dark flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <code className={`font-mono text-xs bg-surface-variant-light dark:bg-surface-variant-dark px-2 py-1 rounded ${
              compact ? 'text-xs' : 'text-sm'
            } break-all`}>
              {displayHash}
            </code>
            
            {hash.length > (compact ? 12 : 16) && (
              <button
                onClick={() => setShowFullHash(!showFullHash)}
                className="p-1 text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark transition-colors"
                title={showFullHash ? 'Show less' : 'Show full hash'}
              >
                {showFullHash ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </button>
            )}
          </div>
          
          {!compact && (
            <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-1">
              SHA-256 • {filename || 'File hash'}
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleCopyHash}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-surface-variant-light dark:bg-surface-variant-dark hover:bg-primary-light hover:bg-opacity-10 hover:text-primary-light rounded transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3" />
              Copied
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              Copy Hash
            </>
          )}
        </button>

        {fileId && onVerify && (
          <button
            onClick={handleVerifyIntegrity}
            disabled={isVerifying}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-surface-variant-light dark:bg-surface-variant-dark hover:bg-accent-light hover:bg-opacity-10 hover:text-accent-light rounded transition-colors disabled:opacity-50"
          >
            {isVerifying ? (
              <>
                <Loader className="w-3 h-3 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <Shield className="w-3 h-3" />
                Verify Integrity
              </>
            )}
          </button>
        )}
      </div>

      {/* Verification Result */}
      {verificationResult && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className={`p-3 rounded-lg border text-sm ${
            verificationResult.error
              ? 'border-danger-light bg-danger-light bg-opacity-10 text-danger-light'
              : verificationResult.integrity?.overall
              ? 'border-accent-light bg-accent-light bg-opacity-10 text-accent-light'
              : 'border-warning-light bg-warning-light bg-opacity-10 text-warning-light'
          }`}
        >
          <div className="flex items-start gap-2">
            {verificationResult.error ? (
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            ) : verificationResult.integrity?.overall ? (
              <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            )}
            
            <div className="flex-1">
              <div className="font-medium mb-1">
                {verificationResult.error
                  ? 'Verification Error'
                  : verificationResult.integrity?.overall
                  ? 'Integrity Verified'
                  : 'Integrity Check Failed'
                }
              </div>
              
              {verificationResult.error ? (
                <p className="text-xs opacity-90">{verificationResult.error}</p>
              ) : (
                <div className="space-y-1 text-xs opacity-90">
                  <div>Stored hash: {verificationResult.integrity.storedHashValid ? '✓ Valid' : '✗ Invalid'}</div>
                  {verificationResult.clientHash && (
                    <div>Client hash: {verificationResult.integrity.clientHashValid ? '✓ Matches' : '✗ Mismatch'}</div>
                  )}
                  <div className="text-xs opacity-75">
                    Verified at {new Date(verificationResult.verifiedAt).toLocaleTimeString()}
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default HashDisplay;