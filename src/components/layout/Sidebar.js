import React from 'react';
import { motion } from 'framer-motion';
import { 
  LayoutDashboard, 
  FolderOpen, 
  Files, 
  Upload, 
  Key, 
  BarChart3, 
  Settings,
  ChevronLeft,
  ChevronRight,
  Book
} from 'lucide-react';
import { useLocation, Link } from 'react-router-dom';

const Sidebar = ({ isCollapsed, onToggle }) => {
  const location = useLocation();

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: FolderOpen, label: 'Buckets', path: '/buckets' },
    { icon: Files, label: 'Files', path: '/files' },
    { icon: Upload, label: 'Uploads', path: '/uploads' },
    { icon: Key, label: 'API Keys', path: '/api-keys' },
    { icon: BarChart3, label: 'Analytics', path: '/analytics' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ];

  const bottomNavItems = [
    { icon: Book, label: 'Documentation', path: '/documentation' },
  ];

  return (
    <motion.div
      initial={false}
      animate={{ width: isCollapsed ? 80 : 280 }}
      className="bg-white dark:bg-surface-dark border-r border-surface-variant-light dark:border-surface-variant-dark h-full flex flex-col"
    >
      {/* Header */}
      <div className="p-4 border-b border-surface-variant-light dark:border-surface-variant-dark">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <motion.h1
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xl font-bold text-primary-light dark:text-primary-dark"
            >
              RemoCloud
            </motion.h1>
          )}
          <button
            onClick={onToggle}
            className="p-2 rounded-lg hover:bg-surface-variant-light dark:hover:bg-surface-variant-dark transition-colors"
          >
            {isCollapsed ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <ChevronLeft className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 flex flex-col">
        <ul className="space-y-2 flex-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`sidebar-item ${isActive ? 'active' : ''}`}
                  title={isCollapsed ? item.label : ''}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {!isCollapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="font-medium"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
        
        {/* Bottom Navigation */}
        <div className="border-t border-surface-variant-light dark:border-surface-variant-dark pt-4 mt-4">
          <ul className="space-y-2">
            {bottomNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`sidebar-item ${isActive ? 'active' : ''}`}
                    title={isCollapsed ? item.label : ''}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {!isCollapsed && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="font-medium"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>
    </motion.div>
  );
};

export default Sidebar;