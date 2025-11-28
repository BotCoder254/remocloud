import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import useResponsive from '../../hooks/useResponsive';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const AnalyticsChart = ({ 
  type = 'line',
  data,
  title,
  height = 300,
  loading = false,
  color = 'primary',
  gradient = false,
  sparkline = false
}) => {
  const chartRef = useRef();
  const { isMobile } = useResponsive();

  const getColor = () => {
    const colors = {
      primary: 'rgb(59, 130, 246)',
      secondary: 'rgb(16, 185, 129)',
      accent: 'rgb(245, 158, 11)',
      warning: 'rgb(245, 158, 11)',
      danger: 'rgb(239, 68, 68)'
    };
    return colors[color] || colors.primary;
  };

  const createGradient = (ctx, color) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, color.replace('rgb', 'rgba').replace(')', ', 0.2)'));
    gradient.addColorStop(1, color.replace('rgb', 'rgba').replace(')', ', 0.05)'));
    return gradient;
  };

  const chartData = {
    labels: data?.labels || [],
    datasets: [
      {
        label: title,
        data: data?.data || [],
        borderColor: getColor(),
        backgroundColor: gradient && chartRef.current 
          ? createGradient(chartRef.current.ctx, getColor())
          : getColor().replace('rgb', 'rgba').replace(')', ', 0.1)'),
        borderWidth: sparkline ? 1 : 2,
        pointRadius: sparkline ? 0 : 4,
        pointHoverRadius: sparkline ? 0 : 6,
        pointBackgroundColor: getColor(),
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        fill: gradient || sparkline,
        tension: 0.4
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: !sparkline,
        position: isMobile ? 'bottom' : 'top',
        labels: {
          usePointStyle: true,
          padding: isMobile ? 10 : 20,
          color: 'rgb(107, 114, 128)',
          font: {
            size: isMobile ? 10 : 12
          }
        }
      },
      tooltip: {
        enabled: !sparkline,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        borderColor: getColor(),
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: false,
        callbacks: {
          title: (context) => {
            return context[0].label;
          },
          label: (context) => {
            return `${title}: ${context.parsed.y.toLocaleString()}`;
          }
        }
      }
    },
    scales: sparkline ? {} : {
      x: {
        display: true,
        grid: {
          display: false
        },
        ticks: {
          color: 'rgb(107, 114, 128)',
          maxTicksLimit: isMobile ? 4 : 8,
          font: {
            size: isMobile ? 10 : 12
          }
        }
      },
      y: {
        display: true,
        beginAtZero: true,
        grid: {
          color: 'rgba(107, 114, 128, 0.1)',
          drawBorder: false
        },
        ticks: {
          color: 'rgb(107, 114, 128)',
          font: {
            size: isMobile ? 10 : 12
          },
          callback: function(value) {
            if (value >= 1000000) {
              return (value / 1000000).toFixed(1) + 'M';
            } else if (value >= 1000) {
              return (value / 1000).toFixed(1) + 'K';
            }
            return value;
          }
        }
      }
    },
    interaction: {
      intersect: false,
      mode: 'index'
    },
    elements: {
      point: {
        hoverBackgroundColor: getColor()
      }
    }
  };

  if (loading) {
    return (
      <div className={`${sparkline ? 'h-16' : 'card p-6'}`}>
        {!sparkline && (
          <div className="mb-4">
            <div className="h-6 bg-text-secondary-light dark:bg-text-secondary-dark opacity-20 rounded animate-pulse w-32"></div>
          </div>
        )}
        <div 
          className="bg-text-secondary-light dark:bg-text-secondary-dark opacity-20 rounded animate-pulse"
          style={{ height: sparkline ? '100%' : height }}
        ></div>
      </div>
    );
  }

  const ChartComponent = type === 'bar' ? Bar : Line;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={sparkline ? 'h-full' : 'card p-6'}
    >
      {!sparkline && title && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark">
            {title}
          </h3>
        </div>
      )}
      
      <div style={{ height: sparkline ? '100%' : height }}>
        <ChartComponent
          ref={chartRef}
          data={chartData}
          options={options}
        />
      </div>
    </motion.div>
  );
};

export default AnalyticsChart;