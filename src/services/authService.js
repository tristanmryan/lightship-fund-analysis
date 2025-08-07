// src/services/authService.js
import { supabase, TABLES, handleSupabaseError } from './supabase';

class AuthService {
  constructor() {
    this.currentUser = null;
    this.sessionToken = null;
    this.isAuthenticated = false;
  }

  // Simple password authentication (Phase 1)
  async login(password) {
    try {
      // For now, use a simple password check
      // In the future, this will be replaced with proper Supabase auth
      const correctPassword = process.env.REACT_APP_APP_PASSWORD || 'lightship2024';
      
      if (password === correctPassword) {
        // Create a simple session
        this.isAuthenticated = true;
        this.sessionToken = this.generateSessionToken();
        this.currentUser = {
          id: 'admin',
          email: 'admin@lightship.com',
          role: 'admin',
          name: 'Administrator'
        };

        // Store session in localStorage for persistence
        localStorage.setItem('lightship_session', JSON.stringify({
          token: this.sessionToken,
          user: this.currentUser,
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
        }));

        // Log the login activity
        await this.logActivity('login', { user_id: this.currentUser.id });

        return { success: true, user: this.currentUser };
      } else {
        throw new Error('Invalid password');
      }
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }

  // Logout user
  async logout() {
    try {
      if (this.currentUser) {
        await this.logActivity('logout', { user_id: this.currentUser.id });
      }

      this.isAuthenticated = false;
      this.currentUser = null;
      this.sessionToken = null;

      // Clear session from localStorage
      localStorage.removeItem('lightship_session');

      return { success: true };
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    }
  }

  // Check if user is authenticated
  async checkAuth() {
    try {
      // Check for existing session in localStorage
      const sessionData = localStorage.getItem('lightship_session');
      if (sessionData) {
        const session = JSON.parse(sessionData);
        const expires = new Date(session.expires);
        
        if (expires > new Date()) {
          // Session is still valid
          this.isAuthenticated = true;
          this.currentUser = session.user;
          this.sessionToken = session.token;
          return { success: true, user: this.currentUser };
        } else {
          // Session expired
          localStorage.removeItem('lightship_session');
        }
      }

      return { success: false, user: null };
    } catch (error) {
      console.error('Auth check failed:', error);
      return { success: false, user: null };
    }
  }

  // Get current user
  getCurrentUser() {
    return this.currentUser;
  }

  // Check if user has permission
  hasPermission(permission) {
    if (!this.isAuthenticated || !this.currentUser) return false;
    
    // For now, admin has all permissions
    if (this.currentUser.role === 'admin') return true;
    
    // Future: implement role-based permissions
    return false;
  }

  // Generate session token
  generateSessionToken() {
    return 'session_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
  }

                // Log activity
              async logActivity(action, details = {}) {
                try {
                  const activity = {
                    user_id: this.currentUser?.id || 'unknown',
                    action: action,
                    details: details,
                    timestamp: new Date().toISOString(),
                    ip_address: null, // Changed from 'unknown' to null to avoid type issues
                    user_agent: navigator.userAgent
                  };

                  const { error } = await supabase
                    .from(TABLES.ACTIVITY_LOGS)
                    .insert(activity);

                  if (error) {
                    console.error('Failed to log activity:', error);
                  }
                } catch (error) {
                  console.error('Activity logging failed:', error);
                }
              }

  // Get activity logs (admin only)
  async getActivityLogs(limit = 100, offset = 0) {
    try {
      if (!this.hasPermission('view_activity_logs')) {
        throw new Error('Insufficient permissions');
      }

      const { data, error } = await supabase
        .from(TABLES.ACTIVITY_LOGS)
        .select('*')
        .order('timestamp', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return data || [];
    } catch (error) {
      handleSupabaseError(error, 'getActivityLogs');
      return [];
    }
  }

  // Future: Multi-user support methods
  async createUser(userData) {
    // This will be implemented when we add multi-user support
    throw new Error('Multi-user support not yet implemented');
  }

  async updateUser(userId, userData) {
    // This will be implemented when we add multi-user support
    throw new Error('Multi-user support not yet implemented');
  }

  async deleteUser(userId) {
    // This will be implemented when we add multi-user support
    throw new Error('Multi-user support not yet implemented');
  }

  async getAllUsers() {
    // This will be implemented when we add multi-user support
    throw new Error('Multi-user support not yet implemented');
  }
}

// Create singleton instance
const authService = new AuthService();

export default authService; 