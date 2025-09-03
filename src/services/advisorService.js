// src/services/advisorService.js
import { supabase } from './supabase.js';

// Lightweight data-access for Advisor Portfolio features (Phase 2)
// Keeps heavy ops in DB where possible; performs light client aggregation.

function toDateOnly(dateLike) {
  try {
    const d = dateLike instanceof Date ? dateLike : new Date(String(dateLike));
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  } catch {
    return null;
  }
}

const _cache = {
  dates: null,
  advisorsByDate: new Map(), // key: date string -> array
  fundMeta: null // Map ticker -> { is_recommended, asset_class_id, asset_class }
};

async function listSnapshotDates() {
  if (Array.isArray(_cache.dates) && _cache.dates.length > 0) return _cache.dates;
  // Prefer advisor_metrics_mv for snapshot dates
  const { data, error } = await supabase
    .from('advisor_metrics_mv')
    .select('snapshot_date')
    .order('snapshot_date', { ascending: false });
  if (error) throw error;
  const dates = Array.from(new Set((data || []).map(r => r.snapshot_date))).filter(Boolean);
  _cache.dates = dates;
  return dates;
}

async function listAdvisorsForDate(snapshotDate) {
  const d = toDateOnly(snapshotDate);
  if (!d) return [];
  if (_cache.advisorsByDate.has(d)) return _cache.advisorsByDate.get(d);
  // Use MV which already aggregates by advisor
  const { data, error } = await supabase
    .from('advisor_metrics_mv')
    .select('advisor_id, client_count, unique_holdings, aum')
    .eq('snapshot_date', d)
    .order('aum', { ascending: false });
  if (error) throw error;
  const advisors = data || [];
  _cache.advisorsByDate.set(d, advisors);
  return advisors;
}

async function getAdvisorMetrics(snapshotDate, advisorId = null) {
  const d = toDateOnly(snapshotDate);
  const { data, error } = await supabase.rpc('get_advisor_metrics', { p_date: d, p_advisor_id: advisorId });
  if (error) throw error;
  return data || [];
}

async function getAdvisorHoldings(snapshotDate, advisorId) {
  const d = toDateOnly(snapshotDate);
  if (!d || !advisorId) return [];
  // Fetch minimal fields; aggregation will happen client-side
  const { data, error } = await supabase
    .from('client_holdings')
    .select('ticker, market_value')
    .eq('snapshot_date', d)
    .eq('advisor_id', advisorId);
  if (error) throw error;
  return data || [];
}

async function loadFundMeta() {
  if (_cache.fundMeta) return _cache.fundMeta;
  const map = new Map();
  try {
    const { data, error } = await supabase
      .from('funds')
      .select('ticker, is_recommended, asset_class_id, asset_class');
    if (error) throw error;
    (data || []).forEach(r => {
      if (!r?.ticker) return;
      map.set(String(r.ticker).toUpperCase(), {
        is_recommended: !!r.is_recommended,
        asset_class_id: r.asset_class_id || null,
        asset_class: r.asset_class || null
      });
    });
  } catch {
    // leave empty map on failure
  }
  _cache.fundMeta = map;
  return map;
}

function aggregateHoldingsByTicker(rows) {
  const byTicker = new Map();
  let totalAum = 0;
  for (const r of rows || []) {
    const t = (r.ticker || '').toUpperCase();
    const mv = Number(r.market_value) || 0;
    if (!t) continue;
    totalAum += mv;
    byTicker.set(t, (byTicker.get(t) || 0) + mv);
  }
  return { byTicker, totalAum };
}

async function computePortfolioBreakdown(snapshotDate, advisorId) {
  const holdings = await getAdvisorHoldings(snapshotDate, advisorId);
  const { byTicker, totalAum } = aggregateHoldingsByTicker(holdings);
  const fundMeta = await loadFundMeta();

  // Allocation by asset class
  const allocation = new Map(); // key: asset_class (string) -> amount
  let recAum = 0;
  for (const [ticker, amt] of byTicker.entries()) {
    const meta = fundMeta.get(ticker);
    const ac = (meta?.asset_class || 'Unclassified') || 'Unclassified';
    allocation.set(ac, (allocation.get(ac) || 0) + amt);
    if (meta?.is_recommended) recAum += amt;
  }

  // Concentration: positions over 10% of AUM
  const positions = Array.from(byTicker.entries())
    .map(([ticker, amt]) => {
      const meta = fundMeta.get(ticker);
      return { ticker, amount: amt, pct: totalAum > 0 ? amt / totalAum : 0, is_recommended: !!meta?.is_recommended };
    })
    .sort((a, b) => b.amount - a.amount);

  const alerts = positions.filter(p => p.pct >= 0.10);

  return {
    totalAum,
    uniqueHoldings: byTicker.size,
    positions,
    allocation: Array.from(allocation.entries()).map(([asset_class, amount]) => ({ asset_class, amount, pct: totalAum > 0 ? amount / totalAum : 0 })).sort((a, b) => b.amount - a.amount),
    recommendedAum: recAum,
    concentrationAlerts: alerts
  };
}

export default {
  listSnapshotDates,
  listAdvisorsForDate,
  getAdvisorMetrics,
  getAdvisorHoldings,
  async computePortfolioBreakdown(snapshotDate, advisorId) {
    // Try server-side RPCs first, then fallback to client aggregation
    const d = toDateOnly(snapshotDate);
    if (d && advisorId) {
      try {
        const [positionsRes, allocationRes] = await Promise.all([
          supabase.rpc('get_advisor_positions', { p_date: d, p_advisor_id: advisorId, p_limit: 1000 }),
          supabase.rpc('get_advisor_portfolio_allocation', { p_date: d, p_advisor_id: advisorId })
        ]);
        if (positionsRes.error) throw positionsRes.error;
        if (allocationRes.error) throw allocationRes.error;
        const positions = (positionsRes.data || []).map(r => ({
          ticker: r.ticker,
          amount: Number(r.amount) || 0,
          pct: Number(r.pct) || 0,
          is_recommended: !!r.is_recommended
        }));
        const allocation = (allocationRes.data || []).map(r => ({
          asset_class: r.asset_class || 'Unclassified',
          amount: Number(r.amount) || 0,
          pct: Number(r.pct) || 0
        }));
        const totalAum = positions.reduce((s, p) => s + (p.amount || 0), 0);
        const recommendedAum = positions.reduce((s, p) => s + (p.is_recommended ? (p.amount || 0) : 0), 0);
        const concentrationAlerts = positions.filter(p => (p.pct || 0) >= 0.10);
        return {
          totalAum,
          uniqueHoldings: positions.length,
          positions,
          allocation,
          recommendedAum,
          concentrationAlerts
        };
      } catch (e) {
        // fall through to client aggregation
      }
    }
    return computePortfolioBreakdown(snapshotDate, advisorId);
  },
  async getAdvisorAdoptionTrend(advisorId, limitMonths = 12) {
    if (!advisorId) return [];
    const { data, error } = await supabase.rpc('get_advisor_adoption_trend', {
      p_advisor_id: advisorId,
      p_limit_months: limitMonths
    });
    if (error) throw error;
    return (data || []).reverse(); // chronological ascending
  }
};
