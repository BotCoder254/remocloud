import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Upload, 
  User, 
  Key, 
  LogOut, 
  Moon, 
  Sun,
  Menu,
  X
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { authService } from '../../services/auth';

const Header = ({ onMobileMenuToggle, isMobileMenuOpen, isDark, onThemeToggle }) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const user = authService.getCurrentUser();

  const handleLogout = () => {
    authService.logout();
  };

  return (
    <header className="bg-white dark:bg-surface-dark border-b border-surface-variant-light dark:border-surface-variant-dark px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Mobile menu button */}
        <button
          onClick={onMobileMenuToggle}
          className="lg:hidden p-2 rounded-lg hover:bg-surface-variant-light dark:hover:bg-surface-variant-dark transition-colors"
        >
          {isMobileMenuOpen ? (
            <X className="w-5 h-5" />
          ) : (
            <Menu className="w-5 h-5" />
          )}
        </button>

        {/* Search */}
        <div className="flex-1 max-w-md mx-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-text-secondary-light dark:text-text-secondary-dark" />
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-surface-variant-light dark:border-surface-variant-dark bg-surface-light dark:bg-surface-dark text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary-light dark:focus:ring-primary-dark"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {/* Upload button */}
          <Link to="/files" className="btn-primary flex items-center gap-2">
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Upload</span>
          </Link>

          {/* Theme toggle */}
          <button
            onClick={onThemeToggle}
            className="p-2 rounded-lg hover:bg-surface-variant-light dark:hover:bg-surface-variant-dark transition-colors"
          >
            {isDark ? (
              <Sun className="w-5 h-5" />
            ) : (
              <Moon className="w-5 h-5" />
            )}
          </button>

          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-surface-variant-light dark:hover:bg-surface-variant-dark transition-colors"
            >
              <div className="w-8 h-8 bg-primary-light dark:bg-primary-dark rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              <span className="hidden sm:inline text-sm font-medium">
                {user?.email}
              </span>
            </button>

            <AnimatePresence>
              {showUserMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute right-0 mt-2 w-48 card p-2 z-50"
                >
                  <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-variant-light dark:hover:bg-surface-variant-dark transition-colors text-left">
                    <Key className="w-4 h-4" />
                    API Keys
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-variant-light dark:hover:bg-surface-variant-dark transition-colors text-left text-danger-light dark:text-danger-dark"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;