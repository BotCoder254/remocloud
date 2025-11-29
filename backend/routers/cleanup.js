const express = require('express');
const { authenticate } = require('../middleware/auth');
const cleanupService = require('../utils/cleanup');

const router = express.Router();

// Manual cleanup endpoint (admin only)
router.post('/cleanup', authenticate, async (req, res) => {
  try {
    // Only allow admin users (you can implement proper admin check)
    const result = await cleanupService.runFullCleanup();
    
    res.json({
      message: 'Cleanup completed successfully',
      ...result
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({ error: 'Cleanup failed' });
  }
});

// Get cleanup stats
router.get('/cleanup/stats', authenticate, async (req, res) => {
  try {
    const { pool } = require('../models/database');
    
    const stats = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE deleted_at IS NOT NULL AND restore_until > CURRENT_TIMESTAMP) as in_trash,
        COUNT(*) FILTER (WHERE deleted_at IS NOT NULL AND restore_until <= CURRENT_TIMESTAMP) as expired,
        COUNT(*) FILTER (WHERE deleted_at IS NULL) as active
      FROM files
      WHERE user_id = $1
    `, [req.user.id]);

    res.json(stats.rows[0]);
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

module.exports = router;