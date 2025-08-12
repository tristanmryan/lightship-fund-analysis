// src/services/supabase.js
import { createClient } from '@supabase/supabase-js';

// Environment variables for Supabase configuration
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
// Harden: Support legacy alias REACT_APP_SUPABASE_ANON
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON;

// Dev-only init log (sanitized)
(() => {
  try {
    if (process.env.NODE_ENV !== 'production') {
      const host = (() => {
        try { return new URL(supabaseUrl || '').hostname || (supabaseUrl || ''); } catch { return supabaseUrl || ''; }
      })();
      const hasKey = Boolean(supabaseAnonKey && String(supabaseAnonKey).length > 0);
      // Log once on module init
      // eslint-disable-next-line no-console
      console.log(`[Init] Supabase host: ${host || 'n/a'} (anon key present: ${hasKey ? 'yes' : 'no'})`);
    }
  } catch {}
})();

if (!supabaseUrl || !supabaseAnonKey) {
  if (process.env.NODE_ENV !== 'test') {
    // eslint-disable-next-line no-console
    console.error('Missing Supabase environment variables. Please set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY (or REACT_APP_SUPABASE_ANON)');
  }
}

// In tests or when env is missing, provide a no-op stub to avoid crashes
const shouldStub = process.env.NODE_ENV === 'test' || !supabaseUrl || !supabaseAnonKey;

function createStubClient() {
  const resolved = (data = null) => Promise.resolve({ data, error: null });

  const makeFilterBuilder = () => {
    const fb = {
      select: () => fb,
      eq: () => fb,
      is: () => fb,
      or: () => fb,
      order: () => resolved([]),
      limit: () => resolved([]),
      range: () => resolved([]),
      single: () => resolved(null),
      maybeSingle: () => resolved(null)
    };
    return fb;
  };

  const fromBuilder = {
    select: () => makeFilterBuilder(),
    insert: () => resolved(null),
    upsert: () => resolved(null),
    delete: () => resolved(null),
    update: () => resolved(null),
    order: () => resolved([]),
    range: () => resolved([]),
    single: () => resolved(null),
    maybeSingle: () => resolved(null),
    limit: () => resolved([])
  };
  return {
    from: () => fromBuilder,
    auth: {
      getUser: async () => ({ data: { user: null }, error: null })
    }
  };
}

// Create Supabase client or stub
export const supabase = shouldStub ? createStubClient() : createClient(supabaseUrl, supabaseAnonKey);

// Strict numeric parser for importer paths
export function toNumberStrict(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (s === '' || /^(-|n\/a|na|null|—|–)$/i.test(s)) return null;
  const isParenNegative = /^\(.*\)$/.test(s);
  let t = s.replace(/^\(|\)$/g, '');
  t = t.replace(/%/g, '').replace(/,/g, '');
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return isParenNegative ? -n : n;
}

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
  BENCHMARK_HISTORY: 'benchmark_history',
  FUND_RESEARCH_NOTES: 'fund_research_notes',
  BENCHMARK_PERFORMANCE: 'benchmark_performance',
  // Phase 4 Scoring governance tables
  SCORING_PROFILES: 'scoring_profiles',
  SCORING_WEIGHTS: 'scoring_weights',
  SCORING_WEIGHTS_AUDIT: 'scoring_weights_audit'
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

  /**
   * Robust parser for metric numbers coming from CSVs or user input.
   * - Trims whitespace
   * - Removes commas
   * - Strips trailing %
   * - Treats parentheses as negative (e.g., (2.1%) => -2.1)
   * - Recognizes '-', '—', '', 'N/A', 'NA' as null (case-insensitive)
   * - Returns number or null; never coerces non-numeric to 0
   */
  parseMetricNumber: (raw) => {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'number') {
      // Preserve numeric, including 0
      return Number.isFinite(raw) ? raw : null;
    }
    let s = String(raw).trim();
    if (s === '') return null;
    const nullSentinels = new Set(['-', '—', 'n/a', 'na']);
    if (nullSentinels.has(s.toLowerCase())) return null;

    // Detect parentheses indicating negative
    let isParenNegative = false;
    if (s.startsWith('(') && s.endsWith(')')) {
      isParenNegative = true;
      s = s.slice(1, -1).trim();
    }

    // Remove percent and commas, optional leading +
    s = s.replace(/,/g, '').replace(/%/g, '').replace(/^\+/, '').trim();
    if (s === '') return null;

    const n = parseFloat(s);
    if (!Number.isFinite(n)) return null;
    return isParenNegative ? -n : n;
  },
  
  // Format date for database
  formatDate: (date) => {
    if (date instanceof Date) return date.toISOString();
    if (typeof date === 'string') return new Date(date).toISOString();
    return new Date().toISOString();
  },

  // Format to date-only string (YYYY-MM-DD) for DATE columns
  formatDateOnly: (date) => {
    try {
      const d = date instanceof Date ? date : new Date(date);
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    } catch {
      const now = new Date();
      const y = now.getUTCFullYear();
      const m = String(now.getUTCMonth() + 1).padStart(2, '0');
      const day = String(now.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
  }
};

// Error handling wrapper
export const handleSupabaseError = (error, operation = 'database operation') => {
  console.error(`Supabase error during ${operation}:`, error);
  throw new Error(`Database error: ${error.message}`);
};

export default supabase; 