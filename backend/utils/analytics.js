const { pool } = require('../models/database');

class AnalyticsService {
  // Track upload event
  async trackUpload(userId, bucketId, fileSize) {
    try {
      await this.updateDailyStats(userId, bucketId, {
        uploads_count: 1,
        storage_bytes: fileSize
      });
    } catch (error) {
      console.error('Failed to track upload:', error);
    }
  }

  // Track download event
  async trackDownload(userId, bucketId, fileSize) {
    try {
      await this.updateDailyStats(userId, bucketId, {
        downloads_count: 1,
        bandwidth_bytes: fileSize
      });
    } catch (error) {
      console.error('Failed to track download:', error);
    }
  }

  // Track delete event
  async trackDelete(userId, bucketId, fileSize) {
    try {
      await this.updateDailyStats(userId, bucketId, {
        deletes_count: 1,
        storage_bytes: -fileSize // Negative to reduce storage
      });
    } catch (error) {
      console.error('Failed to track delete:', error);
    }
  }

  // Update daily statistics
  async updateDailyStats(userId, bucketId, stats) {
    const today = new Date().toISOString().split('T')[0];
    
    const updateFields = [];
    const values = [userId, bucketId, today];
    let valueIndex = 4;

    Object.entries(stats).forEach(([key, value]) => {
      if (value !== 0) {
        updateFields.push(`${key} = ${key} + $${valueIndex}`);
        values.push(value);
        valueIndex++;
      }
    });

    if (updateFields.length === 0) return;

    const query = `
      INSERT INTO usage_analytics (user_id, bucket_id, date, ${Object.keys(stats).join(', ')})
      VALUES ($1, $2, $3, ${Object.values(stats).map((_, i) => `$${i + 4}`).join(', ')})
      ON CONFLICT (user_id, bucket_id, date)
      DO UPDATE SET
        ${updateFields.join(', ')},
        updated_at = CURRENT_TIMESTAMP
    `;

    await pool.query(query, values);
  }

  // Get overview analytics
  async getOverview(userId, startDate, endDate) {
    const query = `
      SELECT 
        SUM(uploads_count) as total_uploads,
        SUM(downloads_count) as total_downloads,
        SUM(deletes_count) as total_deletes,
        SUM(bandwidth_bytes) as total_bandwidth,
        SUM(CASE WHEN storage_bytes > 0 THEN storage_bytes ELSE 0 END) as total_storage,
        date
      FROM usage_analytics
      WHERE user_id = $1 
        AND date >= $2 
        AND date <= $3
      GROUP BY date
      ORDER BY date ASC
    `;

    const result = await pool.query(query, [userId, startDate, endDate]);
    
    // Calculate totals
    const totals = result.rows.reduce((acc, row) => ({
      uploads: acc.uploads + parseInt(row.total_uploads || 0),
      downloads: acc.downloads + parseInt(row.total_downloads || 0),
      deletes: acc.deletes + parseInt(row.total_deletes || 0),
      bandwidth: acc.bandwidth + parseInt(row.total_bandwidth || 0),
      storage: acc.storage + parseInt(row.total_storage || 0)
    }), { uploads: 0, downloads: 0, deletes: 0, bandwidth: 0, storage: 0 });

    return {
      totals,
      daily: result.rows
    };
  }

  // Get bucket-specific analytics
  async getBucketAnalytics(userId, bucketId, startDate, endDate) {
    const query = `
      SELECT 
        uploads_count,
        downloads_count,
        deletes_count,
        bandwidth_bytes,
        storage_bytes,
        date
      FROM usage_analytics
      WHERE user_id = $1 
        AND bucket_id = $2
        AND date >= $3 
        AND date <= $4
      ORDER BY date ASC
    `;

    const result = await pool.query(query, [userId, bucketId, startDate, endDate]);
    return result.rows;
  }

  // Get current storage usage by bucket
  async getStorageByBucket(userId) {
    const query = `
      SELECT 
        b.id,
        b.name,
        b.storage_used,
        b.file_count,
        COALESCE(SUM(ua.bandwidth_bytes), 0) as total_bandwidth
      FROM buckets b
      LEFT JOIN usage_analytics ua ON b.id = ua.bucket_id 
        AND ua.date >= CURRENT_DATE - INTERVAL '30 days'
      WHERE b.user_id = $1 AND b.deleted_at IS NULL
      GROUP BY b.id, b.name, b.storage_used, b.file_count
      ORDER BY b.storage_used DESC
    `;

    const result = await pool.query(query, [userId]);
    return result.rows;
  }

  // Get top files by downloads
  async getTopFiles(userId, limit = 10) {
    const query = `
      SELECT 
        f.id,
        f.original_name,
        f.size,
        f.mime_type,
        b.name as bucket_name,
        COALESCE(SUM(ua.downloads_count), 0) as download_count,
        COALESCE(SUM(ua.bandwidth_bytes), 0) as bandwidth_used
      FROM files f
      JOIN buckets b ON f.bucket_id = b.id
      LEFT JOIN usage_analytics ua ON b.id = ua.bucket_id 
        AND ua.date >= CURRENT_DATE - INTERVAL '30 days'
      WHERE f.user_id = $1 AND f.deleted_at IS NULL
      GROUP BY f.id, f.original_name, f.size, f.mime_type, b.name
      ORDER BY download_count DESC, bandwidth_used DESC
      LIMIT $2
    `;

    const result = await pool.query(query, [userId, limit]);
    return result.rows;
  }

  // Export analytics data as CSV format
  async exportData(userId, startDate, endDate) {
    const query = `
      SELECT 
        ua.date,
        b.name as bucket_name,
        ua.uploads_count,
        ua.downloads_count,
        ua.deletes_count,
        ua.bandwidth_bytes,
        ua.storage_bytes
      FROM usage_analytics ua
      JOIN buckets b ON ua.bucket_id = b.id
      WHERE ua.user_id = $1 
        AND ua.date >= $2 
        AND ua.date <= $3
      ORDER BY ua.date DESC, b.name ASC
    `;

    const result = await pool.query(query, [userId, startDate, endDate]);
    
    // Convert to CSV format
    const headers = ['Date', 'Bucket', 'Uploads', 'Downloads', 'Deletes', 'Bandwidth (bytes)', 'Storage (bytes)'];
    const csvData = [
      headers.join(','),
      ...result.rows.map(row => [
        row.date,
        `"${row.bucket_name}"`,
        row.uploads_count,
        row.downloads_count,
        row.deletes_count,
        row.bandwidth_bytes,
        row.storage_bytes
      ].join(','))
    ].join('\n');

    return csvData;
  }
}

module.exports = new AnalyticsService();