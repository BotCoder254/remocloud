const { pool } = require('../models/database');
const { deleteFileData } = require('./fileStorage');

class CleanupService {
  // Clean up expired files from trash
  async cleanupExpiredFiles() {
    const client = await pool.connect();
    
    try {
      console.log('Starting cleanup of expired files...');
      
      // Get expired files
      const expiredFiles = await client.query(`
        SELECT f.*, 
               ARRAY_AGG(DISTINCT id.file_hash) FILTER (WHERE id.file_hash IS NOT NULL) as derivative_hashes,
               ARRAY_AGG(DISTINCT fv.file_hash) FILTER (WHERE fv.file_hash IS NOT NULL) as version_hashes
        FROM files f
        LEFT JOIN image_derivatives id ON f.id = id.file_id
        LEFT JOIN file_versions fv ON f.id = fv.file_id
        WHERE f.deleted_at IS NOT NULL 
          AND f.restore_until < CURRENT_TIMESTAMP
        GROUP BY f.id
      `);

      if (expiredFiles.rows.length === 0) {
        console.log('No expired files to clean up');
        return { cleaned: 0 };
      }

      console.log(`Found ${expiredFiles.rows.length} expired files to clean up`);

      await client.query('BEGIN');

      let cleanedCount = 0;
      
      for (const file of expiredFiles.rows) {
        try {
          // Delete file data
          if (file.file_hash) {
            await deleteFileData(client, file.file_hash);
          }

          // Delete derivative data
          if (file.derivative_hashes) {
            for (const hash of file.derivative_hashes) {
              if (hash) {
                await deleteFileData(client, hash);
              }
            }
          }

          // Delete version data
          if (file.version_hashes) {
            for (const hash of file.version_hashes) {
              if (hash) {
                await deleteFileData(client, hash);
              }
            }
          }

          // Delete file record
          await client.query('DELETE FROM files WHERE id = $1', [file.id]);
          
          cleanedCount++;
          console.log(`Cleaned up file: ${file.original_name} (${file.id})`);
        } catch (error) {
          console.error(`Failed to clean up file ${file.id}:`, error);
        }
      }

      await client.query('COMMIT');
      
      console.log(`Cleanup completed. Cleaned ${cleanedCount} files.`);
      return { cleaned: cleanedCount };

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Cleanup failed:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Clean up unused file data (orphaned files)
  async cleanupOrphanedFileData() {
    const client = await pool.connect();
    
    try {
      console.log('Starting cleanup of orphaned file data...');
      
      // Find file data that's not referenced by any file, derivative, or version
      const orphanedData = await client.query(`
        SELECT fd.file_hash
        FROM file_data fd
        LEFT JOIN files f ON fd.file_hash = f.file_hash
        LEFT JOIN image_derivatives id ON fd.file_hash = id.file_hash
        LEFT JOIN file_versions fv ON fd.file_hash = fv.file_hash
        WHERE f.file_hash IS NULL 
          AND id.file_hash IS NULL 
          AND fv.file_hash IS NULL
      `);

      if (orphanedData.rows.length === 0) {
        console.log('No orphaned file data to clean up');
        return { cleaned: 0 };
      }

      console.log(`Found ${orphanedData.rows.length} orphaned file data entries`);

      let cleanedCount = 0;
      
      for (const data of orphanedData.rows) {
        try {
          await deleteFileData(client, data.file_hash);
          cleanedCount++;
        } catch (error) {
          console.error(`Failed to clean up orphaned data ${data.file_hash}:`, error);
        }
      }

      console.log(`Orphaned data cleanup completed. Cleaned ${cleanedCount} entries.`);
      return { cleaned: cleanedCount };

    } catch (error) {
      console.error('Orphaned data cleanup failed:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Run full cleanup
  async runFullCleanup() {
    try {
      const expiredResult = await this.cleanupExpiredFiles();
      const orphanedResult = await this.cleanupOrphanedFileData();
      
      return {
        expiredFiles: expiredResult.cleaned,
        orphanedData: orphanedResult.cleaned,
        totalCleaned: expiredResult.cleaned + orphanedResult.cleaned
      };
    } catch (error) {
      console.error('Full cleanup failed:', error);
      throw error;
    }
  }
}

module.exports = new CleanupService();