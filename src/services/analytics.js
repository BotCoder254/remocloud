import api from './api';

class AnalyticsService {
  // Get analytics overview
  async getOverview(startDate, endDate) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const response = await api.get(`/analytics/overview?${params}`);
    return response.data;
  }

  // Get bucket-specific analytics
  async getBucketAnalytics(bucketId, startDate, endDate) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const response = await api.get(`/analytics/buckets/${bucketId}?${params}`);
    return response.data;
  }

  // Get storage usage by bucket
  async getStorageByBucket() {
    const response = await api.get('/analytics/storage');
    return response.data;
  }

  // Get top files by downloads
  async getTopFiles(limit = 10) {
    const response = await api.get(`/analytics/top-files?limit=${limit}`);
    return response.data;
  }

  // Export analytics data as CSV
  async exportData(startDate, endDate) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const response = await api.get(`/analytics/export?${params}`, {
      responseType: 'blob'
    });

    // Create download link
    const blob = new Blob([response.data], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `analytics-${startDate || 'all'}-${endDate || 'all'}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  // Format bytes for display
  formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Format numbers with commas
  formatNumber(num) {
    if (!num) return '0';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  // Get date range presets
  getDateRangePresets() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return {
      today: {
        label: 'Today',
        startDate: today.toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0]
      },
      yesterday: {
        label: 'Yesterday',
        startDate: new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      },
      last7days: {
        label: 'Last 7 days',
        startDate: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0]
      },
      last30days: {
        label: 'Last 30 days',
        startDate: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0]
      },
      thisMonth: {
        label: 'This month',
        startDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0]
      },
      lastMonth: {
        label: 'Last month',
        startDate: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0],
        endDate: new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]
      }
    };
  }

  // Generate chart colors
  getChartColors() {
    return {
      primary: 'rgb(59, 130, 246)',
      secondary: 'rgb(16, 185, 129)',
      accent: 'rgb(245, 158, 11)',
      danger: 'rgb(239, 68, 68)',
      warning: 'rgb(245, 158, 11)',
      info: 'rgb(59, 130, 246)',
      success: 'rgb(16, 185, 129)',
      gradient: {
        primary: 'linear-gradient(180deg, rgba(59, 130, 246, 0.2) 0%, rgba(59, 130, 246, 0.05) 100%)',
        secondary: 'linear-gradient(180deg, rgba(16, 185, 129, 0.2) 0%, rgba(16, 185, 129, 0.05) 100%)',
        accent: 'linear-gradient(180deg, rgba(245, 158, 11, 0.2) 0%, rgba(245, 158, 11, 0.05) 100%)'
      }
    };
  }

  // Process daily data for charts
  processDailyData(dailyData, metric = 'uploads') {
    if (!dailyData || dailyData.length === 0) return { labels: [], data: [] };

    const labels = dailyData.map(item => {
      const date = new Date(item.date);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    const data = dailyData.map(item => {
      switch (metric) {
        case 'uploads':
          return parseInt(item.total_uploads || 0);
        case 'downloads':
          return parseInt(item.total_downloads || 0);
        case 'bandwidth':
          return parseInt(item.total_bandwidth || 0);
        case 'storage':
          return parseInt(item.total_storage || 0);
        default:
          return 0;
      }
    });

    return { labels, data };
  }

  // Calculate percentage change
  calculatePercentageChange(current, previous) {
    if (!previous || previous === 0) {
      return current > 0 ? 100 : 0;
    }
    return ((current - previous) / previous) * 100;
  }

  // Get trend direction
  getTrendDirection(percentageChange) {
    if (percentageChange > 0) return 'up';
    if (percentageChange < 0) return 'down';
    return 'neutral';
  }
}

export default new AnalyticsService();