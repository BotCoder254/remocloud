import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { 
  FolderOpen, 
  Files, 
  Key, 
  Upload,
  Plus,
  ArrowRight,
  CheckCircle,
  X,
  HardDrive,
  Activity,
  Download,
  BarChart3
} from 'lucide-react';
import { bucketsAPI, apiKeysAPI } from '../services/api';
import analyticsService from '../services/analytics';
import StatsCard from '../components/ui/StatsCard';
import AnalyticsChart from '../components/ui/AnalyticsChart';
import { Link } from 'react-router-dom';
import { authService } from '../services/auth';

const Dashboard = () => {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  
  const user = authService.getCurrentUser();

  const { data: buckets = [] } = useQuery({
    queryKey: ['buckets'],
    queryFn: () => bucketsAPI.getAll().then(res => res.data)
  });

  const { data: apiKeys = [] } = useQuery({
    queryKey: ['apiKeys'],
    queryFn: () => apiKeysAPI.getAll().then(res => res.data)
  });

  // Fetch analytics overview for dashboard
  const { data: analytics } = useQuery({
    queryKey: ['dashboard-analytics'],
    queryFn: () => {
      const last7Days = analyticsService.getDateRangePresets().last7days;
      return analyticsService.getOverview(last7Days.startDate, last7Days.endDate);
    },
    staleTime: 5 * 60 * 1000 // 5 minutes
  });

  useEffect(() => {
    // Show onboarding if user has no buckets or API keys
    if (buckets.length === 0 && apiKeys.length === 0) {
      setShowOnboarding(true);
    }
  }, [buckets.length, apiKeys.length]);

  const onboardingSteps = [
    {
      title: 'Create your first bucket',
      description: 'Buckets organize your files and control access',
      icon: FolderOpen,
      action: 'Create Bucket'
    },
    {
      title: 'Generate an API key',
      description: 'API keys allow programmatic access to your files',
      icon: Key,
      action: 'Create API Key'
    },
    {
      title: 'Upload your first file',
      description: 'Start storing files in your new bucket',
      icon: Upload,
      action: 'Upload File'
    }
  ];

  const stats = [
    {
      label: 'Total Buckets',
      value: buckets.length,
      icon: FolderOpen,
      color: 'text-primary-light dark:text-primary-dark'
    },
    {
      label: 'Total Files',
      value: '0', // TODO: Get from API
      icon: Files,
      color: 'text-accent-light dark:text-accent-dark'
    },
    {
      label: 'API Keys',
      value: apiKeys.length,
      icon: Key,
      color: 'text-secondary-light dark:text-secondary-dark'
    },
    {
      label: 'Storage Used',
      value: '0 MB', // TODO: Get from API
      icon: Upload,
      color: 'text-warning-light dark:text-warning-dark'
    }
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-text-primary-light dark:text-text-primary-dark mb-2">
          Welcome back, {user?.email?.split('@')[0]}
        </h1>
        <p className="text-text-secondary-light dark:text-text-secondary-dark">
          Here's what's happening with your cloud storage
        </p>
      </div>

      {/* Analytics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Storage"
          value={analyticsService.formatBytes(analytics?.totals?.storage || 0)}
          icon={HardDrive}
          color="primary"
          onClick={() => window.location.href = '/analytics'}
        />
        
        <StatsCard
          title="Bandwidth (7d)"
          value={analyticsService.formatBytes(analytics?.totals?.bandwidth || 0)}
          icon={Activity}
          color="secondary"
          onClick={() => window.location.href = '/analytics'}
        />
        
        <StatsCard
          title="Uploads (7d)"
          value={analyticsService.formatNumber(analytics?.totals?.uploads || 0)}
          icon={Upload}
          color="accent"
          onClick={() => window.location.href = '/analytics'}
        />
        
        <StatsCard
          title="Downloads (7d)"
          value={analyticsService.formatNumber(analytics?.totals?.downloads || 0)}
          icon={Download}
          color="warning"
          onClick={() => window.location.href = '/analytics'}
        />
      </div>

      {/* Usage Trend Chart */}
      {analytics?.daily && analytics.daily.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AnalyticsChart
            type="line"
            data={analyticsService.processDailyData(analytics.daily, 'uploads')}
            title="Uploads Trend (7 days)"
            color="accent"
            gradient={true}
            height={200}
          />
          
          <AnalyticsChart
            type="line"
            data={analyticsService.processDailyData(analytics.daily, 'downloads')}
            title="Downloads Trend (7 days)"
            color="warning"
            gradient={true}
            height={200}
          />
        </div>
      )}

      {/* Quick Actions */}
      <div className="card p-6">
        <h2 className="text-xl font-semibold text-text-primary-light dark:text-text-primary-dark mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link to="/buckets" className="flex items-center gap-3 p-4 rounded-lg border border-surface-variant-light dark:border-surface-variant-dark hover:bg-surface-variant-light dark:hover:bg-surface-variant-dark transition-colors">
            <Plus className="w-5 h-5 text-primary-light dark:text-primary-dark" />
            <span className="font-medium">Create Bucket</span>
            <ArrowRight className="w-4 h-4 ml-auto" />
          </Link>
          <Link to="/api-keys" className="flex items-center gap-3 p-4 rounded-lg border border-surface-variant-light dark:border-surface-variant-dark hover:bg-surface-variant-light dark:hover:bg-surface-variant-dark transition-colors">
            <Key className="w-5 h-5 text-secondary-light dark:text-secondary-dark" />
            <span className="font-medium">Generate API Key</span>
            <ArrowRight className="w-4 h-4 ml-auto" />
          </Link>
          <Link to="/files" className="flex items-center gap-3 p-4 rounded-lg border border-surface-variant-light dark:border-surface-variant-dark hover:bg-surface-variant-light dark:hover:bg-surface-variant-dark transition-colors">
            <Upload className="w-5 h-5 text-accent-light dark:text-accent-dark" />
            <span className="font-medium">Upload Files</span>
            <ArrowRight className="w-4 h-4 ml-auto" />
          </Link>
        </div>
        
        <div className="mt-4 pt-4 border-t border-surface-variant-light dark:border-surface-variant-dark">
          <Link to="/analytics" className="flex items-center gap-3 p-4 rounded-lg border border-surface-variant-light dark:border-surface-variant-dark hover:bg-surface-variant-light dark:hover:bg-surface-variant-dark transition-colors">
            <BarChart3 className="w-5 h-5 text-primary-light dark:text-primary-dark" />
            <span className="font-medium">View Full Analytics</span>
            <ArrowRight className="w-4 h-4 ml-auto" />
          </Link>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card p-6">
        <h2 className="text-xl font-semibold text-text-primary-light dark:text-text-primary-dark mb-4">
          Recent Activity
        </h2>
        <div className="text-center py-8">
          <Files className="w-12 h-12 text-text-secondary-light dark:text-text-secondary-dark mx-auto mb-4" />
          <p className="text-text-secondary-light dark:text-text-secondary-dark">
            No recent activity to show
          </p>
        </div>
      </div>

      {/* Onboarding Overlay */}
      <AnimatePresence>
        {showOnboarding && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="card p-8 max-w-md w-full"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-text-primary-light dark:text-text-primary-dark">
                  Get Started
                </h3>
                <button
                  onClick={() => setShowOnboarding(false)}
                  className="text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                {onboardingSteps.map((step, index) => {
                  const Icon = step.icon;
                  const isCompleted = index < onboardingStep;
                  const isCurrent = index === onboardingStep;

                  return (
                    <div
                      key={index}
                      className={`flex items-center gap-4 p-4 rounded-lg border ${
                        isCurrent
                          ? 'border-primary-light dark:border-primary-dark bg-primary-light bg-opacity-10'
                          : 'border-surface-variant-light dark:border-surface-variant-dark'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        isCompleted
                          ? 'bg-accent-light text-white'
                          : isCurrent
                          ? 'bg-primary-light text-white'
                          : 'bg-surface-variant-light dark:bg-surface-variant-dark'
                      }`}>
                        {isCompleted ? (
                          <CheckCircle className="w-5 h-5" />
                        ) : (
                          <Icon className="w-5 h-5" />
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-text-primary-light dark:text-text-primary-dark">
                          {step.title}
                        </h4>
                        <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                          {step.description}
                        </p>
                      </div>
                      {isCurrent && (
                        <Link 
                          to={index === 0 ? '/buckets' : index === 1 ? '/api-keys' : '/files'}
                          className="btn-primary text-sm inline-block text-center"
                        >
                          {step.action}
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dashboard;