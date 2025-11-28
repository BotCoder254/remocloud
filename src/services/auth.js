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
    const response = await authAPI.login(email, password);
    const { user, token } = response.data;
    
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    
    return { user, token };
  },

  // Register user
  register: async (email, password) => {
    const response = await authAPI.register(email, password);
    const { user, token } = response.data;
    
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    
    return { user, token };
  },

  // Logout user
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  },

  // Verify token
  verify: async () => {
    try {
      const response = await authAPI.verify();
      const { user } = response.data;
      localStorage.setItem('user', JSON.stringify(user));
      return user;
    } catch (error) {
      authService.logout();
      throw error;
    }
  },
};