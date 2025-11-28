// Client-side file hashing utilities
export class HashService {
  // Compute SHA-256 hash of file content
  static async computeFileHash(file, onProgress = null) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      const chunkSize = 64 * 1024; // 64KB chunks
      let offset = 0;
      let hash = null;

      // Use Web Crypto API for SHA-256
      crypto.subtle.digest('SHA-256', new ArrayBuffer(0)).then(() => {
        // Initialize hash context
        const chunks = [];
        
        const readChunk = () => {
          if (offset >= file.size) {
            // Combine all chunks and compute final hash
            const combinedBuffer = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
            let position = 0;
            
            chunks.forEach(chunk => {
              combinedBuffer.set(chunk, position);
              position += chunk.length;
            });

            crypto.subtle.digest('SHA-256', combinedBuffer.buffer)
              .then(hashBuffer => {
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
                resolve(hashHex);
              })
              .catch(reject);
            return;
          }

          const slice = file.slice(offset, offset + chunkSize);
          reader.readAsArrayBuffer(slice);
        };

        reader.onload = (e) => {
          chunks.push(new Uint8Array(e.target.result));
          offset += chunkSize;
          
          if (onProgress) {
            const progress = Math.min((offset / file.size) * 100, 100);
            onProgress(progress);
          }
          
          readChunk();
        };

        reader.onerror = reject;
        readChunk();
      }).catch(reject);
    });
  }

  // Quick hash for small files (< 1MB)
  static async computeQuickHash(file) {
    if (file.size > 1024 * 1024) {
      throw new Error('File too large for quick hash');
    }

    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Verify file integrity by comparing hashes
  static verifyIntegrity(expectedHash, actualHash) {
    return expectedHash.toLowerCase() === actualHash.toLowerCase();
  }

  // Format hash for display
  static formatHash(hash, length = 16) {
    if (!hash) return '';
    return hash.length > length ? `${hash.substring(0, length)}...` : hash;
  }

  // Copy hash to clipboard
  static async copyHashToClipboard(hash) {
    if (!hash) throw new Error('No hash to copy');
    await navigator.clipboard.writeText(hash);
  }
}

export default HashService;