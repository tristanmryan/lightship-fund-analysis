// src/services/flowsService.js
import { supabase } from './supabase.js';

function toMonthStart(dateLike) {
  try {
    const d = dateLike instanceof Date ? dateLike : new Date(String(dateLike));
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  } catch { return null; }
}

async function listMonths(limit = 24) {
  // Distinct months available in fund_flows_mv (descending)
  const { data, error } = await supabase
    .from('fund_flows_mv')
    .select('month')
    .order('month', { ascending: false });
  if (error) throw error;
  const months = Array.from(new Set((data || []).map(r => r.month))).filter(Boolean);
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

async function getTopMovers({ month, direction = 'inflow', assetClass = null, ticker = null, limit = 10 }) {
  const m = month ? toMonthStart(month) : null;
  // Prefer server RPC if available
  try {
    if (!ticker) {
      const { data, error } = await supabase.rpc('get_top_movers', {
        p_month: m,
        p_direction: direction,
        p_asset_class: assetClass,
        p_limit: limit
      });
      if (!error && Array.isArray(data)) return data;
    }
  } catch {}

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

async function getNetFlowTrend(limitMonths = 6) {
  // Aggregate net flows across all tickers by month for the last N months
  const { data, error } = await supabase
    .from('fund_flows_mv')
    .select('month, inflows, outflows')
    .order('month', { ascending: false });
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
    .slice(-Math.max(1, Math.min(limitMonths || 6, 36)));
}

const flowsService = {
  listMonths,
  getFundFlows,
  getTopMovers,
  getAdvisorParticipation,
  getFlowByAssetClass,
  getNetFlowTrend,
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
