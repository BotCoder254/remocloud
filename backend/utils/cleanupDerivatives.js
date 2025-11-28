const { pool } = require('../models/database');
const fs = require('fs').promises;
const path = require('path');

class DerivativeCleanup {
  constructor() {
    this.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
    this.batchSize = 100;
  }

  // Clean up old derivatives that haven't been accessed recently
  async cleanupOldDerivatives() {
    try {
      console.log('Starting derivative cleanup...');
      
      const cutoffDate = new Date(Date.now() - this.maxAge);
      
      // Find old derivatives
      const result = await pool.query(`
        SELECT id, object_key, accessed_at
        FROM image_derivatives 
        WHERE accessed_at < $1
        ORDER BY accessed_at ASC
        LIMIT $2
      `, [cutoffDate, this.batchSize]);

      const oldDerivatives = result.rows;
      
      if (oldDerivatives.length === 0) {
        console.log('No old derivatives to clean up');
        return { cleaned: 0, errors: 0 };
      }

      console.log(`Found ${oldDerivatives.length} old derivatives to clean up`);
      
      let cleaned = 0;
      let errors = 0;
      
      for (const derivative of oldDerivatives) {
        try {
          // Delete file from disk
          const filePath = path.join(__dirname, '../uploads', derivative.object_key);
          
          try {
            await fs.unlink(filePath);
          } catch (fileError) {
            if (fileError.code !== 'ENOENT') {
              console.warn(`Failed to delete file ${derivative.object_key}:`, fileError.message);
            }
          }
          
          // Delete from database
          await pool.query('DELETE FROM image_derivatives WHERE id = $1', [derivative.id]);
          
          cleaned++;
          
        } catch (error) {
          console.error(`Failed to clean up derivative ${derivative.id}:`, error);
          errors++;
        }
      }
      
      console.log(`Cleanup completed: ${cleaned} derivatives cleaned, ${errors} errors`);
      
      return { cleaned, errors };
      
    } catch (error) {
      console.error('Derivative cleanup failed:', error);
      throw error;
    }
  }

  // Clean up derivatives for deleted files
  async cleanupOrphanedDerivatives() {
    try {
      console.log('Starting orphaned derivative cleanup...');
      
      // Find derivatives for deleted files
      const result = await pool.query(`
        SELECT d.id, d.object_key
        FROM image_derivatives d
        LEFT JOIN files f ON d.file_id = f.id
        WHERE f.id IS NULL OR f.deleted_at IS NOT NULL
        LIMIT $1
      `, [this.batchSize]);

      const orphanedDerivatives = result.rows;
      
      if (orphanedDerivatives.length === 0) {
        console.log('No orphaned derivatives to clean up');
        return { cleaned: 0, errors: 0 };
      }

      console.log(`Found ${orphanedDerivatives.length} orphaned derivatives to clean up`);
      
      let cleaned = 0;
      let errors = 0;
      
      for (const derivative of orphanedDerivatives) {
        try {
          // Delete file from disk
          const filePath = path.join(__dirname, '../uploads', derivative.object_key);
          
          try {
            await fs.unlink(filePath);
          } catch (fileError) {
            if (fileError.code !== 'ENOENT') {
              console.warn(`Failed to delete file ${derivative.object_key}:`, fileError.message);
            }
          }
          
          // Delete from database
          await pool.query('DELETE FROM image_derivatives WHERE id = $1', [derivative.id]);
          
          cleaned++;
          
        } catch (error) {
          console.error(`Failed to clean up orphaned derivative ${derivative.id}:`, error);
          errors++;
        }
      }
      
      console.log(`Orphaned cleanup completed: ${cleaned} derivatives cleaned, ${errors} errors`);
      
      return { cleaned, errors };
      
    } catch (error) {
      console.error('Orphaned derivative cleanup failed:', error);
      throw error;
    }
  }

  // Get derivative statistics
  async getStats() {
    try {
      const result = await pool.query(`
        SELECT 
          COUNT(*) as total_derivatives,
          SUM(size) as total_size,
          COUNT(CASE WHEN accessed_at < NOW() - INTERVAL '30 days' THEN 1 END) as old_derivatives,
          COUNT(CASE WHEN accessed_at > NOW() - INTERVAL '24 hours' THEN 1 END) as recent_derivatives
        FROM image_derivatives
      `);
      
      return result.rows[0];
    } catch (error) {
      console.error('Failed to get derivative stats:', error);
      throw error;
    }
  }

  // Run full cleanup
  async runCleanup() {
    try {
      console.log('=== Starting Full Derivative Cleanup ===');
      
      const stats = await this.getStats();
      console.log('Current stats:', stats);
      
      const oldResult = await this.cleanupOldDerivatives();
      const orphanedResult = await this.cleanupOrphanedDerivatives();
      
      const finalStats = await this.getStats();
      
      console.log('=== Cleanup Summary ===');
      console.log(`Old derivatives cleaned: ${oldResult.cleaned}`);
      console.log(`Orphaned derivatives cleaned: ${orphanedResult.cleaned}`);
      console.log(`Total errors: ${oldResult.errors + orphanedResult.errors}`);
      console.log('Final stats:', finalStats);
      
      return {
        oldCleaned: oldResult.cleaned,
        orphanedCleaned: orphanedResult.cleaned,
        totalErrors: oldResult.errors + orphanedResult.errors,
        finalStats
      };
      
    } catch (error) {
      console.error('Full cleanup failed:', error);
      throw error;
    }
  }
}

// Export for use in other modules
module.exports = DerivativeCleanup;

// Allow running as standalone script
if (require.main === module) {
  const cleanup = new DerivativeCleanup();
  
  cleanup.runCleanup()
    .then((result) => {
      console.log('Cleanup completed successfully:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('Cleanup failed:', error);
      process.exit(1);
    });
}