// src/services/flowsService.js
import { supabase } from './supabase.js';
import fundService from './fundService.js';
import { getAllAdvisorIdsForName, getAdvisorName } from '../config/advisorNames.js';

function toMonthStart(dateLike) {
  try {
    const d = dateLike instanceof Date ? dateLike : new Date(String(dateLike));
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  } catch { return null; }
}

async function listMonths(limit = 24) {
  const monthsSet = new Set();

  try {
    const { data, error } = await supabase
      .from('fund_flows_mv')
      .select('month')
      .order('month', { ascending: false })
      .limit(limit * 4);
    if (error) throw error;
    (data || []).forEach((row) => {
      if (row?.month) monthsSet.add(row.month);
    });
  } catch (error) {
    console.warn('flowsService.listMonths base query failed', error);
  }

  if (monthsSet.size < limit) {
    try {
      const { data: tradeRows, error: tradeError } = await supabase
        .from('trade_activity')
        .select('trade_date')
        .order('trade_date', { ascending: false })
        .limit(limit * 500);
      if (tradeError) throw tradeError;
      (tradeRows || []).forEach((row) => {
        if (!row?.trade_date) return;
        const monthKey = toMonthStart(row.trade_date);
        if (monthKey) monthsSet.add(monthKey);
      });
    } catch (error) {
      console.warn('flowsService.listMonths trade fallback failed', error);
    }
  }

  const months = Array.from(monthsSet.values())
    .filter(Boolean)
    .sort((a, b) => new Date(b) - new Date(a));

  return months.slice(0, limit);
}

async function getFundFlows(month, ticker = null, limit = 200) {
  const m = month ? toMonthStart(month) : null;
  const { data, error } = await supabase.rpc('get_fund_flows', {
    p_month: m,
    p_ticker: ticker,
    p_limit: limit
  });
  if (error) throw error;
  return data || [];
}

function toMonthEnd(dateLike) {
  try {
    const d = dateLike instanceof Date ? dateLike : new Date(String(dateLike));
    const eom = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
    const y = eom.getUTCFullYear();
    const m = String(eom.getUTCMonth() + 1).padStart(2, '0');
    const day = String(eom.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  } catch { return null; }
}

function resolveAdvisorIds(advisorNameOrTeam) {
  const name = (advisorNameOrTeam || '').trim();
  if (!name) return null; // null => all advisors
  const ids = getAllAdvisorIdsForName(name);
  return Array.isArray(ids) && ids.length > 0 ? ids : [name];
}

async function enrichWithFundMeta(rows, asOfEom) {
  try {
    const metaRows = await fundService.getFundsWithOwnership(asOfEom);
    const meta = new Map((metaRows || []).map(f => [String(f.ticker).toUpperCase(), f]));
    return (rows || []).map(r => {
      const key = String(r.ticker || '').toUpperCase();
      const m = meta.get(key) || {};
      return {
        ...r,
        name: m.name || r.name || r.ticker,
        asset_class: m.asset_class || m.asset_class_name || null,
        is_recommended: !!m.is_recommended,
        firmAUM: Number(m.firmAUM || 0),
        advisorCount: Number(m.advisorCount || 0)
      };
    });
  } catch {
    return rows || [];
  }
}

async function getTopMovers({ month, advisorNameOrTeam = '', direction = 'inflow', assetClass = null, ticker = null, limit = 10 }) {
  const m = month ? toMonthStart(month) : null;
  const eom = month ? toMonthEnd(month) : null;
  const advisorIds = resolveAdvisorIds(advisorNameOrTeam);
  // Advisor-specific path
  if (advisorIds && !ticker) {
    try {
      const { data, error } = await supabase.rpc('get_advisor_flows', {
        p_month: m,
        p_advisor_ids: advisorIds,
        p_limit: Math.max(1, Math.min(limit || 10, 1000))
      });
      if (!error && Array.isArray(data)) {
        let rows = data.map(r => ({
          month: m,
          ticker: r.ticker,
          inflows: Number(r.inflows || 0),
          outflows: Number(r.outflows || 0),
          net_flow: Number(r.net_flow || 0),
          advisors_trading: Number(r.advisors_trading || 0)
        }));
        // Sort by direction
        rows.sort((a, b) => direction === 'outflow' ? (a.net_flow - b.net_flow) : (b.net_flow - a.net_flow));
        // Optional assetClass filter via enrichment
        rows = await enrichWithFundMeta(rows, eom);
        if (assetClass) rows = rows.filter(r => (r.asset_class || 'Unclassified') === assetClass);
        return rows.slice(0, Math.max(1, Math.min(limit || 10, 100)));
      }
    } catch {}
  }

  // Fallback: client-side from get_fund_flows + join to funds
  if (ticker) {
    const flows = await getFundFlows(m, ticker, 1);
    return flows.map(r => ({
      month: r.month,
      ticker: r.ticker,
      inflows: Number(r.inflows || 0),
      outflows: Number(r.outflows || 0),
      net_flow: Number(r.net_flow || 0),
      advisors_trading: Number(r.advisors_trading || 0)
    }));
  }
  const flows = await getFundFlows(m, null, 1000);
  let rows = flows.map(r => ({
    month: r.month,
    ticker: r.ticker,
    inflows: Number(r.inflows || 0),
    outflows: Number(r.outflows || 0),
    net_flow: Number(r.net_flow || 0),
    advisors_trading: Number(r.advisors_trading || 0)
  }));
  if (assetClass) {
    try {
      const { data: fundMeta } = await supabase
        .from('funds')
        .select('ticker, asset_class')
        .in('ticker', rows.map(r => r.ticker));
      const acMap = new Map((fundMeta || []).map(f => [String(f.ticker).toUpperCase(), f.asset_class || null]));
      rows = rows.filter(r => (acMap.get(String(r.ticker).toUpperCase()) || null) === assetClass);
    } catch {}
  }
  rows.sort((a, b) => direction === 'outflow' ? (a.net_flow - b.net_flow) : (b.net_flow - a.net_flow));
  // Enrich for consistency
  rows = await enrichWithFundMeta(rows, eom);
  return rows.slice(0, Math.max(1, Math.min(limit || 10, 100)));
}

async function getAdvisorParticipation({ month, ticker = null }) {
  const m = month ? toMonthStart(month) : null;
  // Prefer server RPC if available
  try {
    const { data, error } = await supabase.rpc('get_advisor_participation', {
      p_month: m,
      p_ticker: ticker
    });
    if (!error && data) return data;
  } catch {}

  // Fallback: approximate using trade_activity directly
  // Count distinct advisors who are net buyers vs net sellers for the period
  // Note: This may be heavy; acceptable for small local datasets. UI will degrade gracefully.
  try {
    const { data: trades, error } = await supabase
      .from('trade_activity')
      .select('advisor_id, trade_type, principal_amount, trade_date, ticker')
      .is('cancelled', false);
    if (error) throw error;
    const monthStr = m || null;
    const targetMonth = monthStr ? new Date(monthStr).getUTCMonth() : null;
    const targetYear = monthStr ? new Date(monthStr).getUTCFullYear() : null;
    const key = (d) => {
      const dt = new Date(d);
      return `${dt.getUTCFullYear()}-${dt.getUTCMonth()}`;
    };
    const targetKey = monthStr ? `${targetYear}-${targetMonth}` : null;
    const byAdvisor = new Map(); // advisor_id -> signed principal
    for (const t of trades || []) {
      if (ticker && String(t.ticker || '').toUpperCase() !== String(ticker).toUpperCase()) continue;
      if (monthStr) {
        if (key(t.trade_date) !== targetKey) continue;
      } else {
        // if no month passed, include all; but fallback is approximate
      }
      const id = t.advisor_id;
      const amt = Number(t.principal_amount || 0) * (t.trade_type === 'SELL' ? -1 : 1);
      byAdvisor.set(id, (byAdvisor.get(id) || 0) + amt);
    }
    let buying = 0, selling = 0, neutral = 0;
    for (const v of byAdvisor.values()) {
      if (v > 0) buying++; else if (v < 0) selling++; else neutral++;
    }
    return { advisors_buying: buying, advisors_selling: selling, advisors_neutral: neutral, advisors_total: buying + selling + neutral };
  } catch {
    return { advisors_buying: 0, advisors_selling: 0, advisors_neutral: 0, advisors_total: 0 };
  }
}

async function getFlowByAssetClass({ month }) {
  const m = month ? toMonthStart(month) : null;
  // Prefer server RPC if available
  try {
    const { data, error } = await supabase.rpc('get_flow_by_asset_class', { p_month: m });
    if (!error && Array.isArray(data)) return data;
  } catch {}
  // Fallback: join fund_flows_mv with funds
  const { data: fdata, error } = await supabase
    .from('fund_flows_mv')
    .select('month, ticker, inflows, outflows, advisors_trading')
    .eq('month', m);
  if (error) throw error;
  const tickers = (fdata || []).map(r => r.ticker);
  const { data: meta } = await supabase
    .from('funds')
    .select('ticker, asset_class')
    .in('ticker', tickers);
  const acMap = new Map((meta || []).map(f => [String(f.ticker).toUpperCase(), f.asset_class || 'Unclassified']));
  const agg = new Map();
  for (const r of fdata || []) {
    const ac = acMap.get(String(r.ticker).toUpperCase()) || 'Unclassified';
    const cur = agg.get(ac) || { asset_class: ac, inflows: 0, outflows: 0, net_flow: 0, advisors_trading: 0, funds_traded: 0 };
    cur.inflows += Number(r.inflows || 0);
    cur.outflows += Number(r.outflows || 0);
    cur.net_flow = cur.inflows - cur.outflows;
    cur.advisors_trading += Number(r.advisors_trading || 0);
    cur.funds_traded += 1;
    agg.set(ac, cur);
  }
  return Array.from(agg.values());
}

async function getTopAdvisorActivity({ month, advisorNameOrTeam = '', limit = 4 }) {
  const start = month ? toMonthStart(month) : null;
  const end = month ? toMonthEnd(month) : null;
  if (!start || !end) return [];

  const advisorIds = resolveAdvisorIds(advisorNameOrTeam);

  try {
    let query = supabase
      .from('trade_activity')
      .select('advisor_id, trade_type, principal_amount, ticker')
      .is('cancelled', false)
      .gte('trade_date', start)
      .lte('trade_date', end);

    if (advisorIds && advisorIds.length > 0) {
      query = query.in('advisor_id', advisorIds);
    }

    const rowLimit = Math.max(1000, Math.min((limit || 4) * 2500, 15000));
    const { data, error } = await query.limit(rowLimit);
    if (error) throw error;

    const aggregated = new Map();
    for (const row of data || []) {
      const advisorId = row.advisor_id;
      if (!advisorId) continue;
      const principal = Number(row.principal_amount || 0);
      const signed = row.trade_type === 'SELL' ? -principal : principal;

      const current = aggregated.get(advisorId) || {
        advisor_id: advisorId,
        net_flow: 0,
        buy_volume: 0,
        sell_volume: 0,
        total_volume: 0,
        trades: 0,
        tickers: new Set()
      };

      current.net_flow += signed;
      current.total_volume += Math.abs(principal);
      if (row.trade_type === 'BUY') current.buy_volume += Math.abs(principal);
      if (row.trade_type === 'SELL') current.sell_volume += Math.abs(principal);
      current.trades += 1;
      if (row.ticker) current.tickers.add(String(row.ticker).toUpperCase());
      aggregated.set(advisorId, current);
    }

    const byDisplay = new Map();
    for (const entry of aggregated.values()) {
      const displayName = getAdvisorName(entry.advisor_id) || entry.advisor_id;
      const current = byDisplay.get(displayName) || {
        displayName,
        advisor_ids: new Set(),
        net_flow: 0,
        buy_volume: 0,
        sell_volume: 0,
        total_volume: 0,
        trades: 0,
        tickers: new Set()
      };
      current.advisor_ids.add(entry.advisor_id);
      current.net_flow += entry.net_flow;
      current.buy_volume += entry.buy_volume;
      current.sell_volume += entry.sell_volume;
      current.total_volume += entry.total_volume;
      current.trades += entry.trades;
      for (const ticker of entry.tickers) current.tickers.add(ticker);
      byDisplay.set(displayName, current);
    }

    return Array.from(byDisplay.values())
      .map((entry) => ({
        advisor_id: Array.from(entry.advisor_ids).join(','),
        displayName: entry.displayName,
        net_flow: entry.net_flow,
        buy_volume: entry.buy_volume,
        sell_volume: entry.sell_volume,
        total_volume: entry.total_volume,
        trades: entry.trades,
        distinct_tickers: entry.tickers.size,
        tickers: Array.from(entry.tickers),
        direction: entry.net_flow >= 0 ? 'inflow' : 'outflow',
        avg_trade: entry.trades > 0 ? entry.total_volume / entry.trades : 0
      }))
      .sort((a, b) => b.total_volume - a.total_volume);
  } catch (error) {
    console.warn('flowsService.getTopAdvisorActivity failed', error);
    return [];
  }
}

async function getNetFlowTrend(arg1 = 6, arg2) {
  // Support both signatures: getNetFlowTrend(limitMonths) and getNetFlowTrend(advisorNameOrTeam, limitMonths)
  let advisorNameOrTeam = '';
  let limitMonths = 6;
  if (typeof arg1 === 'string' || arg1 === null || arg1 === undefined) {
    advisorNameOrTeam = arg1 || '';
    limitMonths = typeof arg2 === 'number' ? arg2 : 6;
  } else {
    limitMonths = typeof arg1 === 'number' ? arg1 : 6;
  }

  const advisorIds = resolveAdvisorIds(advisorNameOrTeam);
  if (advisorIds) {
    try {
      const { data, error } = await supabase.rpc('get_advisor_flow_trend', {
        p_advisor_ids: advisorIds,
        p_limit_months: Math.max(1, Math.min(limitMonths || 6, 60))
      });
      if (error) throw error;
      return (data || []).map(r => ({
        month: r.month,
        inflows: Number(r.inflows || 0),
        outflows: Number(r.outflows || 0),
        net_flow: Number(r.net_flow || 0)
      }));
    } catch {}
  }

  const cappedLimit = Math.max(1, Math.min(limitMonths || 6, 60));

  // Prefer server aggregation to avoid REST row limits when grouping by month
  try {
    const { data: firmTrend, error: firmTrendError } = await supabase.rpc('get_firm_flow_trend', {
      p_limit_months: cappedLimit
    });
    if (firmTrendError) throw firmTrendError;
    if (Array.isArray(firmTrend) && firmTrend.length > 0) {
      return firmTrend
        .map((r) => ({
          month: r.month,
          inflows: Number(r.inflows || 0),
          outflows: Number(r.outflows || 0),
          net_flow: Number(r.net_flow || 0)
        }))
        .sort((a, b) => new Date(a.month) - new Date(b.month));
    }
  } catch (rpcError) {
    console.warn('flowsService.getNetFlowTrend firm RPC failed', rpcError);
  }

  // Fallback: aggregate client-side if RPC unavailable
  const { data, error } = await supabase
    .from('fund_flows_mv')
    .select('month, inflows, outflows')
    .order('month', { ascending: false })
    .limit(cappedLimit * 600);
  if (error) throw error;
  const byMonth = new Map();
  for (const r of data || []) {
    const m = r.month;
    const cur = byMonth.get(m) || { month: m, inflows: 0, outflows: 0, net_flow: 0 };
    cur.inflows += Number(r.inflows || 0);
    cur.outflows += Number(r.outflows || 0);
    cur.net_flow = cur.inflows - cur.outflows;
    byMonth.set(m, cur);
  }
  return Array.from(byMonth.values())
    .sort((a, b) => new Date(a.month) - new Date(b.month))
    .slice(-cappedLimit);
}

const flowsService = {
  listMonths,
  getFundFlows,
  getTopMovers,
  getAdvisorParticipation,
  getFlowByAssetClass,
  getTopAdvisorActivity,
  getNetFlowTrend,
  async getMonthKPIs({ month, advisorNameOrTeam = '' }) {
    const m = month ? toMonthStart(month) : null;
    const advisorIds = resolveAdvisorIds(advisorNameOrTeam);
    if (advisorIds) {
      try {
        const { data, error } = await supabase.rpc('get_advisor_month_kpis', {
          p_month: m,
          p_advisor_ids: advisorIds
        });
        if (error) throw error;
        const r = (Array.isArray(data) ? data[0] : data) || {};
        return {
          total_inflows: Number(r.total_inflows || 0),
          total_outflows: Number(r.total_outflows || 0),
          net_flow: Number(r.net_flow || 0),
          distinct_tickers: Number(r.distinct_tickers || 0),
          advisors_trading: Number(r.advisors_trading || 0)
        };
      } catch {}
    }
    // Firm-wide fallback
    const rows = await getFundFlows(m, null, 5000);
    const totals = rows.reduce((acc, r) => {
      acc.in += Number(r.inflows || 0);
      acc.out += Number(r.outflows || 0);
      return acc;
    }, { in: 0, out: 0 });
    return {
      total_inflows: totals.in,
      total_outflows: totals.out,
      net_flow: totals.in - totals.out,
      distinct_tickers: (rows || []).length,
      advisors_trading: rows.reduce((s, r) => s + Number(r.advisors_trading || 0), 0)
    };
  },
  async getTickerDrilldown({ month, advisorNameOrTeam = '', ticker }) {
    const m = month ? toMonthStart(month) : null;
    const t = (ticker || '').trim().toUpperCase();
    if (!m || !t) return { rows: [], summary: null };
    const advisorIds = resolveAdvisorIds(advisorNameOrTeam);
    try {
      const { data, error } = await supabase.rpc('get_advisor_ticker_breakdown', {
        p_month: m,
        p_advisor_ids: advisorIds || null,
        p_ticker: t
      });
      if (error) throw error;
      const rows = (data || []).filter(r => !r.is_summary).map(r => ({
        advisor_id: r.advisor_id,
        buy_trades: Number(r.buy_trades || 0),
        sell_trades: Number(r.sell_trades || 0),
        buy_amount: Number(r.buy_amount || 0),
        sell_amount: Number(r.sell_amount || 0),
        net_flow: Number(r.net_flow || 0)
      }));
      const summaryRow = (data || []).find(r => r.is_summary) || null;
      const summary = summaryRow ? {
        buy_trades: Number(summaryRow.buy_trades || 0),
        sell_trades: Number(summaryRow.sell_trades || 0),
        buy_amount: Number(summaryRow.buy_amount || 0),
        sell_amount: Number(summaryRow.sell_amount || 0),
        net_flow: Number(summaryRow.net_flow || 0)
      } : null;
      return { rows, summary };
    } catch {
      return { rows: [], summary: null };
    }
  },
  async getAdvisorBreakdown({ month, ticker, limit = 200 }) {
    const m = month ? toMonthStart(month) : null;
    const t = (ticker || '').trim().toUpperCase();
    if (!m || !t) return [];
    // Prefer RPC
    try {
      const { data, error } = await supabase.rpc('get_advisor_breakdown', {
        p_month: m,
        p_ticker: t,
        p_limit: limit
      });
      if (!error && Array.isArray(data)) return data;
    } catch {}
    // Fallback: query trades filtered server-side and aggregate client-side
    const { data: trades, error } = await supabase
      .from('trade_activity')
      .select('advisor_id, trade_type, principal_amount, trade_date, cancelled')
      .eq('ticker', t);
    if (error) throw error;
    const targetKey = (() => { const d = new Date(m); return `${d.getUTCFullYear()}-${d.getUTCMonth()}`; })();
    const monthKey = (d) => { const dt = new Date(d); return `${dt.getUTCFullYear()}-${dt.getUTCMonth()}`; };
    const map = new Map();
    for (const r of trades || []) {
      if (r.cancelled) continue;
      if (monthKey(r.trade_date) !== targetKey) continue;
      const id = r.advisor_id;
      const cur = map.get(id) || { advisor_id: id, buy_trades: 0, sell_trades: 0, net_principal: 0 };
      if (r.trade_type === 'BUY') cur.buy_trades += 1; else if (r.trade_type === 'SELL') cur.sell_trades += 1;
      const signed = Number(r.principal_amount || 0) * (r.trade_type === 'SELL' ? -1 : 1);
      cur.net_principal += signed;
      map.set(id, cur);
    }
    return Array.from(map.values()).sort((a, b) => Math.abs(b.net_principal) - Math.abs(a.net_principal)).slice(0, limit);
  },
  async getFundFlowsMap(month, limit = 1000) {
    const rows = await getFundFlows(month, null, limit);
    const map = new Map();
    for (const r of rows || []) map.set(String(r.ticker).toUpperCase(), r);
    return map;
  },
  monthOffset(month, offset = -1) {
    try {
      const d = month ? new Date(month) : new Date();
      const y = d.getUTCFullYear();
      const m = d.getUTCMonth();
      const nd = new Date(Date.UTC(y, m + offset, 1));
      const yy = nd.getUTCFullYear();
      const mm = String(nd.getUTCMonth() + 1).padStart(2, '0');
      return `${yy}-${mm}-01`;
    } catch { return null; }
  }
};

export default flowsService;
