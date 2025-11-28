const express = require('express');
const { authenticateApiKey } = require('../middleware/auth');
const analyticsService = require('../utils/analytics');

const router = express.Router();

// Get analytics overview
router.get('/analytics/overview', authenticateApiKey, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const userId = req.user.id;
    
    // Default to last 30 days if no dates provided
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const overview = await analyticsService.getOverview(
      userId,
      start.toISOString().split('T')[0],
      end.toISOString().split('T')[0]
    );

    res.json(overview);
  } catch (error) {
    console.error('Analytics overview error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics overview' });
  }
});

// Get bucket-specific analytics
router.get('/analytics/buckets/:bucketId', authenticateApiKey, async (req, res) => {
  try {
    const { bucketId } = req.params;
    const { startDate, endDate } = req.query;
    const userId = req.user.id;
    
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const analytics = await analyticsService.getBucketAnalytics(
      userId,
      bucketId,
      start.toISOString().split('T')[0],
      end.toISOString().split('T')[0]
    );

    res.json(analytics);
  } catch (error) {
    console.error('Bucket analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch bucket analytics' });
  }
});

// Get storage usage by bucket
router.get('/analytics/storage', authenticateApiKey, async (req, res) => {
  try {
    const userId = req.user.id;
    const storage = await analyticsService.getStorageByBucket(userId);
    res.json(storage);
  } catch (error) {
    console.error('Storage analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch storage analytics' });
  }
});

// Get top files by downloads
router.get('/analytics/top-files', authenticateApiKey, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 10 } = req.query;
    const topFiles = await analyticsService.getTopFiles(userId, parseInt(limit));
    res.json(topFiles);
  } catch (error) {
    console.error('Top files analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch top files' });
  }
});

// Export analytics data
router.get('/analytics/export', authenticateApiKey, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const userId = req.user.id;
    
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const csvData = await analyticsService.exportData(
      userId,
      start.toISOString().split('T')[0],
      end.toISOString().split('T')[0]
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="analytics-${start.toISOString().split('T')[0]}-${end.toISOString().split('T')[0]}.csv"`);
    res.send(csvData);
  } catch (error) {
    console.error('Analytics export error:', error);
    res.status(500).json({ error: 'Failed to export analytics data' });
  }
});

module.exports = router;