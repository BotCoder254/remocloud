import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const StatsCard = ({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  trendValue, 
  trendLabel = 'vs last period',
  color = 'primary',
  loading = false,
  onClick
}) => {
  const getTrendIcon = () => {
    if (!trend || trend === 'neutral') return Minus;
    return trend === 'up' ? TrendingUp : TrendingDown;
  };

  const getTrendColor = () => {
    if (!trend || trend === 'neutral') return 'text-text-secondary-light dark:text-text-secondary-dark';
    return trend === 'up' ? 'text-accent-light' : 'text-danger-light';
  };

  const getColorClasses = () => {
    const colors = {
      primary: 'text-primary-light dark:text-primary-dark bg-primary-light bg-opacity-10',
      secondary: 'text-secondary-light dark:text-secondary-dark bg-secondary-light bg-opacity-10',
      accent: 'text-accent-light dark:text-accent-dark bg-accent-light bg-opacity-10',
      warning: 'text-warning-light dark:text-warning-dark bg-warning-light bg-opacity-10',
      danger: 'text-danger-light dark:text-danger-dark bg-danger-light bg-opacity-10'
    };
    return colors[color] || colors.primary;
  };

  const TrendIcon = getTrendIcon();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className={`card p-6 transition-all duration-200 ${onClick ? 'cursor-pointer hover:shadow-lg' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-lg ${getColorClasses()}`}>
          {loading ? (
            <div className="w-6 h-6 animate-pulse bg-current opacity-20 rounded"></div>
          ) : (
            <Icon className="w-6 h-6" />
          )}
        </div>
        
        {trend && trendValue !== undefined && (
          <div className={`flex items-center space-x-1 ${getTrendColor()}`}>
            <TrendIcon className="w-4 h-4" />
            <span className="text-sm font-medium">
              {Math.abs(trendValue).toFixed(1)}%
            </span>
          </div>
        )}
      </div>

      <div className="space-y-1">
        <h3 className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">
          {title}
        </h3>
        
        {loading ? (
          <div className="h-8 bg-text-secondary-light dark:bg-text-secondary-dark opacity-20 rounded animate-pulse"></div>
        ) : (
          <p className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">
            {value}
          </p>
        )}
        
        {trend && trendValue !== undefined && (
          <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
            {trendLabel}
          </p>
        )}
      </div>
    </motion.div>
  );
};

export default StatsCard;