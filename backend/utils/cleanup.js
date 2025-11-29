const { pool, deleteLargeObject } = require('../models/database');

// Cleanup expired upload sessions and orphaned Large Objects
const cleanupExpiredSessions = async () => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Get expired sessions with Large Objects
    const expiredSessions = await client.query(`
      SELECT metadata_json->>'lo_oid' as lo_oid
      FROM upload_sessions 
      WHERE expires_at < CURRENT_TIMESTAMP 
      AND completed_at IS NULL 
      AND metadata_json->>'lo_oid' IS NOT NULL
    `);
    
    // Delete Large Objects for expired sessions
    for (const session of expiredSessions.rows) {
      if (session.lo_oid) {
        await deleteLargeObject(client, parseInt(session.lo_oid));
      }
    }
    
    // Delete expired session records
    await client.query(`
      DELETE FROM upload_sessions 
      WHERE expires_at < CURRENT_TIMESTAMP 
      AND completed_at IS NULL
    `);
    
    await client.query('COMMIT');
    console.log(`Cleaned up ${expiredSessions.rows.length} expired upload sessions`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Cleanup error:', error);
  } finally {
    client.release();
  }
};

module.exports = { cleanupExpiredSessions };