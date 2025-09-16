// src/services/advisorService.js
import { supabase } from './supabase.js';
import { getAllAdvisorIdsForName, getAdvisorName } from '../config/advisorNames.js';

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

// Enhanced advisor methods - consolidated by default
async function listAdvisorsForDateConsolidated(snapshotDate, consolidateByName = true) {
  const d = toDateOnly(snapshotDate);
  if (!d) return [];
  
  // Get all individual advisor metrics
  const { data, error } = await supabase
    .from('advisor_metrics_mv')
    .select('advisor_id, client_count, unique_holdings, aum')
    .eq('snapshot_date', d)
    .order('aum', { ascending: false });
  if (error) throw error;
  
  if (!consolidateByName) {
    return data || [];
  }
  
  // Consolidate by advisor name
  const consolidated = {};
  (data || []).forEach(advisor => {
    const advisorName = getAdvisorName(advisor.advisor_id);
    if (!consolidated[advisorName]) {
      consolidated[advisorName] = {
        advisor_name: advisorName,
        client_count: 0,
        unique_holdings: new Set(),
        aum: 0
      };
    }
    
    consolidated[advisorName].client_count += advisor.client_count || 0;
    consolidated[advisorName].aum += advisor.aum || 0;
    // Note: unique_holdings needs special handling since we can't just add sets
  });
  
  // For unique holdings, we need to actually query the holdings
  const result = await Promise.all(
    Object.entries(consolidated).map(async ([advisorName, group]) => {
      const advisorIds = getAllAdvisorIdsForName(advisorName);
      const allHoldings = new Set();
      
      for (const advisorId of advisorIds) {
        const holdings = await getAdvisorHoldings(snapshotDate, advisorId);
        holdings.forEach(h => allHoldings.add(h.ticker));
      }
      
      return {
        advisor_name: advisorName,
        advisor_id: advisorName, // Use name as ID for compatibility
        client_count: group.client_count,
        unique_holdings: allHoldings.size,
        aum: group.aum
      };
    })
  );
  
  return result.sort((a, b) => b.aum - a.aum);
}

const advisorService = {
  listSnapshotDates,
  listAdvisorsForDate: listAdvisorsForDateConsolidated,
  getAdvisorMetrics,
  getAdvisorHoldings,
  
  // Consolidated advisor holdings by name
  async getAdvisorHoldingsConsolidated(snapshotDate, advisorName) {
    const advisorIds = getAllAdvisorIdsForName(advisorName);
    if (!advisorIds.length) {
      // Fallback: might be an individual advisor ID
      return await getAdvisorHoldings(snapshotDate, advisorName);
    }

    // Bulk fetch all holdings for these advisor IDs with pagination (Supabase default page cap ~1000)
    const d = toDateOnly(snapshotDate);
    const pageSize = 1000;
    let offset = 0;
    let rawRowsFetched = 0;
    let pagesFetched = 0;
    const consolidatedHoldings = new Map();
    try {
      // optional: get exact row count for debug
      try {
        await supabase
          .from('client_holdings')
          .select('id', { count: 'exact', head: true })
          .eq('snapshot_date', d)
          .in('advisor_id', advisorIds);
      } catch {}

      while (true) {
        const { data, error } = await supabase
          .from('client_holdings')
          .select('id, ticker, market_value, advisor_id')
          .eq('snapshot_date', d)
          .in('advisor_id', advisorIds)
          .order('id', { ascending: true })
          .range(offset, offset + pageSize - 1);
        if (error) throw error;
        const batch = Array.isArray(data) ? data : [];
        rawRowsFetched += batch.length;
        pagesFetched += 1;
        for (const row of batch) {
          const t = row?.ticker;
          if (!t) continue;
          const existing = consolidatedHoldings.get(t) || { ticker: t, market_value: 0 };
          existing.market_value += Number(row.market_value) || 0;
          consolidatedHoldings.set(t, existing);
        }
        if (batch.length < pageSize) break; // last page reached
        offset += batch.length;
      }
      const consolidated = Array.from(consolidatedHoldings.values());
      return consolidated;
    } catch {
      // Fallback to per-ID queries if bulk fails
      const allHoldings = await Promise.all(advisorIds.map(id => getAdvisorHoldings(snapshotDate, id)));
      allHoldings.flat().forEach(holding => {
        const ticker = holding.ticker;
        const existing = consolidatedHoldings.get(ticker) || { ticker, market_value: 0 };
        existing.market_value += Number(holding.market_value) || 0;
        consolidatedHoldings.set(ticker, existing);
      });
      return Array.from(consolidatedHoldings.values());
    }
  },
  
  async computePortfolioBreakdown(snapshotDate, advisorIdentifier) {
    // Determine if this is an advisor name or ID, handle accordingly
    const requestedDate = toDateOnly(snapshotDate);
    const advisorIds = getAllAdvisorIdsForName(advisorIdentifier);
    const isAdvisorName = advisorIds.length > 0;

    // Load holdings for requested snapshot
    let holdings;
    if (isAdvisorName) {
      holdings = await this.getAdvisorHoldingsConsolidated(requestedDate, advisorIdentifier);
    } else {
      holdings = await getAdvisorHoldings(requestedDate, advisorIdentifier);
    }

    // Optional fallback: if no holdings exist for the requested snapshot, use latest available
    let effectiveDate = requestedDate;
    if ((!holdings || holdings.length === 0)) {
      try {
        if (isAdvisorName && advisorIds.length > 0) {
          const { data: latest } = await supabase
            .from('client_holdings')
            .select('snapshot_date')
            .in('advisor_id', advisorIds)
            .order('snapshot_date', { ascending: false })
            .limit(1);
          const fallback = Array.isArray(latest) && latest[0]?.snapshot_date ? latest[0].snapshot_date : null;
          if (fallback && fallback !== requestedDate) {
            effectiveDate = fallback;
            holdings = await this.getAdvisorHoldingsConsolidated(effectiveDate, advisorIdentifier);
          }
        } else if (!isAdvisorName && advisorIdentifier) {
          const { data: latest } = await supabase
            .from('client_holdings')
            .select('snapshot_date')
            .eq('advisor_id', advisorIdentifier)
            .order('snapshot_date', { ascending: false })
            .limit(1);
          const fallback = Array.isArray(latest) && latest[0]?.snapshot_date ? latest[0].snapshot_date : null;
          if (fallback && fallback !== requestedDate) {
            effectiveDate = fallback;
            holdings = await getAdvisorHoldings(effectiveDate, advisorIdentifier);
          }
        }
      } catch (_) {
        // ignore fallback errors; proceed with empty holdings
      }
    }

    const { byTicker, totalAum } = aggregateHoldingsByTicker(holdings);
    const fundMeta = await loadFundMeta();

    // Allocation by asset class
    const allocation = new Map();
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
      concentrationAlerts: alerts,
      advisorName: isAdvisorName ? advisorIdentifier : getAdvisorName(advisorIdentifier),
      usedSnapshotDate: effectiveDate
    };
  },
  
  // Legacy compatibility - keep the original method name
  async computePortfolioBreakdownLegacy(snapshotDate, advisorId) {
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

export default advisorService;
