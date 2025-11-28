import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { 
  BarChart3, 
  Upload, 
  Download, 
  HardDrive, 
  Activity,
  Calendar,
  Filter,
  Download as DownloadIcon,
  TrendingUp,
  Users,
  FolderOpen,
  ChevronDown
} from 'lucide-react';
import analyticsService from '../services/analytics';
import { bucketsAPI } from '../services/api';
import StatsCard from '../components/ui/StatsCard';
import AnalyticsChart from '../components/ui/AnalyticsChart';
import useResponsive from '../hooks/useResponsive';

const Analytics = () => {
  const [dateRange, setDateRange] = useState('last30days');
  const [selectedBucket, setSelectedBucket] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const { isMobile } = useResponsive();

  const dateRangePresets = analyticsService.getDateRangePresets();
  const currentRange = dateRangePresets[dateRange];

  // Fetch buckets for filter
  const { data: buckets = [] } = useQuery({
    queryKey: ['buckets'],
    queryFn: () => bucketsAPI.getAll().then(res => res.data)
  });

  // Fetch analytics overview
  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['analytics-overview', currentRange.startDate, currentRange.endDate],
    queryFn: () => analyticsService.getOverview(currentRange.startDate, currentRange.endDate),
    staleTime: 5 * 60 * 1000 // 5 minutes
  });

  // Fetch storage by bucket
  const { data: storageData, isLoading: storageLoading } = useQuery({
    queryKey: ['analytics-storage'],
    queryFn: () => analyticsService.getStorageByBucket(),
    staleTime: 10 * 60 * 1000 // 10 minutes
  });

  // Fetch top files
  const { data: topFiles, isLoading: topFilesLoading } = useQuery({
    queryKey: ['analytics-top-files'],
    queryFn: () => analyticsService.getTopFiles(5),
    staleTime: 10 * 60 * 1000
  });

  // Process chart data
  const chartData = useMemo(() => {
    if (!overview?.daily) return null;

    return {
      uploads: analyticsService.processDailyData(overview.daily, 'uploads'),
      downloads: analyticsService.processDailyData(overview.daily, 'downloads'),
      bandwidth: analyticsService.processDailyData(overview.daily, 'bandwidth'),
      storage: analyticsService.processDailyData(overview.daily, 'storage')
    };
  }, [overview]);

  // Calculate trends (mock for now - would need previous period data)
  const trends = useMemo(() => {
    if (!overview?.totals) return {};

    return {
      uploads: { value: 12.5, direction: 'up' },
      downloads: { value: 8.3, direction: 'up' },
      bandwidth: { value: -2.1, direction: 'down' },
      storage: { value: 15.7, direction: 'up' }
    };
  }, [overview]);

  const handleExport = async () => {
    try {
      await analyticsService.exportData(currentRange.startDate, currentRange.endDate);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-text-primary-light dark:text-text-primary-dark mb-2">
            Analytics
          </h1>
          <p className="text-text-secondary-light dark:text-text-secondary-dark">
            Track your storage usage, bandwidth, and file operations
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn-secondary flex items-center gap-2"
          >
            <Filter className="w-4 h-4" />
            Filters
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
          
          <button
            onClick={handleExport}
            className="btn-primary flex items-center gap-2"
          >
            <DownloadIcon className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="card p-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-2">
                  Date Range
                </label>
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="input-field"
                >
                  {Object.entries(dateRangePresets).map(([key, preset]) => (
                    <option key={key} value={key}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-2">
                  Bucket Filter
                </label>
                <select
                  value={selectedBucket}
                  onChange={(e) => setSelectedBucket(e.target.value)}
                  className="input-field"
                >
                  <option value="">All Buckets</option>
                  {buckets.map((bucket) => (
                    <option key={bucket.id} value={bucket.id}>
                      {bucket.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Storage"
          value={analyticsService.formatBytes(overview?.totals?.storage || 0)}
          icon={HardDrive}
          trend={trends.storage?.direction}
          trendValue={trends.storage?.value}
          color="primary"
          loading={overviewLoading}
        />
        
        <StatsCard
          title="Bandwidth (30d)"
          value={analyticsService.formatBytes(overview?.totals?.bandwidth || 0)}
          icon={Activity}
          trend={trends.bandwidth?.direction}
          trendValue={trends.bandwidth?.value}
          color="secondary"
          loading={overviewLoading}
        />
        
        <StatsCard
          title="Uploads"
          value={analyticsService.formatNumber(overview?.totals?.uploads || 0)}
          icon={Upload}
          trend={trends.uploads?.direction}
          trendValue={trends.uploads?.value}
          color="accent"
          loading={overviewLoading}
        />
        
        <StatsCard
          title="Downloads"
          value={analyticsService.formatNumber(overview?.totals?.downloads || 0)}
          icon={Download}
          trend={trends.downloads?.direction}
          trendValue={trends.downloads?.value}
          color="warning"
          loading={overviewLoading}
        />
      </div>

      {/* Charts */}
      <div className="space-y-6">
        {/* Mobile: Single column, Desktop: Two columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AnalyticsChart
            type="line"
            data={chartData?.uploads}
            title="Uploads Over Time"
            color="accent"
            gradient={true}
            loading={overviewLoading}
            height={isMobile ? 200 : 300}
          />
          
          <AnalyticsChart
            type="line"
            data={chartData?.downloads}
            title="Downloads Over Time"
            color="warning"
            gradient={true}
            loading={overviewLoading}
            height={isMobile ? 200 : 300}
          />
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AnalyticsChart
            type="bar"
            data={chartData?.bandwidth}
            title="Bandwidth Usage"
            color="secondary"
            loading={overviewLoading}
            height={isMobile ? 200 : 300}
          />
          
          <AnalyticsChart
            type="line"
            data={chartData?.storage}
            title="Storage Growth"
            color="primary"
            gradient={true}
            loading={overviewLoading}
            height={isMobile ? 200 : 300}
          />
        </div>
      </div>

      {/* Storage by Bucket & Top Files */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Storage by Bucket */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark flex items-center gap-2">
              <FolderOpen className="w-5 h-5" />
              Storage by Bucket
            </h3>
          </div>
          
          {storageLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-text-secondary-light dark:bg-text-secondary-dark opacity-20 rounded mb-2"></div>
                  <div className="h-2 bg-text-secondary-light dark:bg-text-secondary-dark opacity-20 rounded"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {storageData?.slice(0, 5).map((bucket) => (
                <motion.div
                  key={bucket.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center justify-between p-3 rounded-lg bg-surface-variant-light dark:bg-surface-variant-dark"
                >
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-text-primary-light dark:text-text-primary-dark">
                        {bucket.name}
                      </span>
                      <span className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                        {analyticsService.formatBytes(bucket.storage_used)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-text-secondary-light dark:text-text-secondary-dark">
                      <span>{bucket.file_count} files</span>
                      <span>•</span>
                      <span>{analyticsService.formatBytes(bucket.total_bandwidth)} bandwidth</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Top Files */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Top Downloaded Files
            </h3>
          </div>
          
          {topFilesLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-text-secondary-light dark:bg-text-secondary-dark opacity-20 rounded mb-2"></div>
                  <div className="h-3 bg-text-secondary-light dark:bg-text-secondary-dark opacity-20 rounded w-2/3"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {topFiles?.map((file, index) => (
                <motion.div
                  key={file.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center gap-3 p-3 rounded-lg bg-surface-variant-light dark:bg-surface-variant-dark"
                >
                  <div className="flex-shrink-0 w-8 h-8 bg-primary-light bg-opacity-10 rounded-full flex items-center justify-center">
                    <span className="text-sm font-bold text-primary-light">
                      {index + 1}
                    </span>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-text-primary-light dark:text-text-primary-dark truncate">
                      {file.original_name}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-text-secondary-light dark:text-text-secondary-dark">
                      <span>{file.bucket_name}</span>
                      <span>•</span>
                      <span>{analyticsService.formatBytes(file.size)}</span>
                      <span>•</span>
                      <span>{file.download_count} downloads</span>
                    </div>
                  </div>
                  
                  <div className="flex-shrink-0">
                    <AnalyticsChart
                      type="line"
                      data={{ labels: ['', '', '', ''], data: [1, 3, 2, 4] }}
                      sparkline={true}
                      color="primary"
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Analytics;