import { authAPI } from './api';

export const authService = {
  // Get current user from localStorage
  getCurrentUser: () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },

  // Get auth token
  getToken: () => localStorage.getItem('token'),

  // Check if user is authenticated
  isAuthenticated: () => !!localStorage.getItem('token'),

  // Login user
  login: async (email, password) => {
    try {
      const response = await authAPI.login(email, password);
      const { user, token } = response.data;
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      return { user, token };
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  },

  // Register user
  register: async (email, password) => {
    try {
      const response = await authAPI.register(email, password);
      const { user, token } = response.data;
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      return { user, token };
    } catch (error) {
      console.error('Register error:', error);
      throw error;
    }
  },

  // Logout user
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  // Verify token
  verify: async () => {
    try {
      const response = await authAPI.verify();
      const { user } = response.data;
      localStorage.setItem('user', JSON.stringify(user));
      return user;
    } catch (error) {
      // Don't call logout here to avoid redirect loops
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      throw error;
    }
  },
};