// src/services/supabase.js
import { createClient } from '@supabase/supabase-js';

// Environment variables for Supabase configuration
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables. Please set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY');
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database table names
export const TABLES = {
  FUNDS: 'funds',
  FUND_PERFORMANCE: 'fund_performance',
  USERS: 'users',
  USER_SESSIONS: 'user_sessions',
  ACTIVITY_LOGS: 'activity_logs',
  SNAPSHOTS: 'snapshots',
  BENCHMARKS: 'benchmarks',
  ASSET_CLASSES: 'asset_classes',
  ASSET_CLASS_SYNONYMS: 'asset_class_synonyms',
  ASSET_CLASS_BENCHMARKS: 'asset_class_benchmarks',
  FUND_OVERRIDES: 'fund_overrides',
  BENCHMARK_HISTORY: 'benchmark_history'
};

// Utility functions for database operations
export const dbUtils = {
  // Clean fund symbols consistently
  cleanSymbol: (symbol) => symbol?.toUpperCase().trim().replace(/[^A-Z0-9]/g, ''),
  
  // Parse numeric values safely
  parseNumeric: (value) => {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const cleaned = value.replace(/[%,$]/g, '').trim();
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  },
  
  // Format date for database
  formatDate: (date) => {
    if (date instanceof Date) return date.toISOString();
    if (typeof date === 'string') return new Date(date).toISOString();
    return new Date().toISOString();
  }
};

// Error handling wrapper
export const handleSupabaseError = (error, operation = 'database operation') => {
  console.error(`Supabase error during ${operation}:`, error);
  throw new Error(`Database error: ${error.message}`);
};

export default supabase; 