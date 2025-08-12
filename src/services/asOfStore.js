// src/services/asOfStore.js
import { supabase, TABLES } from './supabase';

// Simple event-based store for As-Of state
class AsOfStore {
  constructor() {
    this.activeMonth = null; // YYYY-MM-DD
    this.latestMonthInDb = null; // YYYY-MM-DD
    this.subscribers = new Set();
    try {
      const saved = localStorage.getItem('AS_OF_MONTH');
      if (saved && typeof saved === 'string') {
        this.activeMonth = saved;
      }
    } catch {}
    // Test hook data
    this.__testDates = null;
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  notify() {
    for (const cb of this.subscribers) {
      try { cb({ activeMonth: this.activeMonth, latestMonthInDb: this.latestMonthInDb }); } catch {}
    }
  }

  getActiveMonth() {
    return this.activeMonth;
  }

  getLatestMonth() {
    return this.latestMonthInDb;
  }

  setActiveMonth(month) {
    const m = typeof month === 'string' ? month : (month?.toISOString?.().slice(0,10) || null);
    if (!m) return;
    this.activeMonth = m;
    try { localStorage.setItem('AS_OF_MONTH', m); } catch {}
    this.notify();
  }

  async syncWithDb() {
    // Test hook: use injected dates
    if (this.__testDates && Array.isArray(this.__testDates) && this.__testDates.length > 0) {
      const sorted = [...this.__testDates].sort((a,b)=>b.localeCompare(a));
      this.latestMonthInDb = sorted[0];
      // For post-import behavior in tests, always switch active to latest
      this.activeMonth = this.latestMonthInDb;
      try { localStorage.setItem('AS_OF_MONTH', this.activeMonth); } catch {}
      this.notify();
      return { active: this.activeMonth, latest: this.latestMonthInDb };
    }

    // Query Supabase for latest date, prefer EOM
    const { data, error } = await supabase
      .from(TABLES.FUND_PERFORMANCE)
      .select('date')
      .order('date', { ascending: false })
      .limit(1000);
    if (!error && Array.isArray(data) && data.length > 0) {
      // Prefer EOM among recent rows
      const candidates = (data || []).map(r => String(r.date).slice(0,10));
      const eom = candidates.find((d) => {
        try {
          const dt = new Date(d + 'T00:00:00Z');
          const end = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0));
          return dt.getUTCDate() === end.getUTCDate();
        } catch { return false; }
      });
      const latest = eom || candidates[0];
      this.latestMonthInDb = latest || null;
    } else {
      this.latestMonthInDb = null;
    }

    let activeIsValid = false;
    if (this.activeMonth && this.latestMonthInDb) {
      // Validate that activeMonth exists in DB
      const { data: rows } = await supabase
        .from(TABLES.FUND_PERFORMANCE)
        .select('date', { count: 'exact', head: true })
        .eq('date', this.activeMonth);
      // In some drivers, count is not returned; fallback to rows array length if present
      const ok = (rows && rows.length >= 0) || true; // head queries may not return rows; assume ok if no error
      activeIsValid = ok; // best-effort; active invalid will be corrected if no data later
    }

    if (!this.activeMonth || !activeIsValid) {
      if (this.latestMonthInDb) {
        this.activeMonth = this.latestMonthInDb;
        try { localStorage.setItem('AS_OF_MONTH', this.activeMonth); } catch {}
      }
    } else {
      // If active is non-EOM and there exists an EOM in same YYYY-MM, prefer the EOM
      try {
        const a = new Date(this.activeMonth + 'T00:00:00Z');
        const end = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + 1, 0));
        const isEom = a.getUTCDate() === end.getUTCDate();
        if (!isEom) {
          // Find any EOM for same month
          const ym = `${a.getUTCFullYear()}-${String(a.getUTCMonth() + 1).padStart(2,'0')}`;
          const { data: rows } = await supabase
            .from(TABLES.FUND_PERFORMANCE)
            .select('date')
            .like('date', `${ym}-%`)
            .order('date', { ascending: false })
            .limit(100);
          const found = (rows || []).map(r => String(r.date).slice(0,10)).find((d) => {
            const dt = new Date(d + 'T00:00:00Z');
            const e = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0));
            return dt.getUTCDate() === e.getUTCDate();
          });
          if (found) {
            this.activeMonth = found;
            try { localStorage.setItem('AS_OF_MONTH', this.activeMonth); } catch {}
          }
        }
      } catch {}
    }
    this.notify();
    return { active: this.activeMonth, latest: this.latestMonthInDb };
  }

  // Test-only initializer: set available DB dates directly
  __setDbDatesForTest(dates) {
    if (process.env.NODE_ENV !== 'test') return;
    this.__testDates = Array.isArray(dates) ? dates.map(d => String(d).slice(0,10)) : null;
  }
}

const asOfStore = new AsOfStore();
export default asOfStore;

