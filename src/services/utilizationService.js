// src/services/utilizationService.js
import { supabase } from './supabase.js';

function toDateOnly(dateLike) {
  try {
    const d = dateLike instanceof Date ? dateLike : new Date(String(dateLike));
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  } catch { return null; }
}

async function listSnapshotDates() {
  // Prefer fund_utilization_mv dates; fallback to advisor_metrics_mv
  const { data, error } = await supabase
    .from('fund_utilization_mv')
    .select('snapshot_date')
    .order('snapshot_date', { ascending: false });
  if (error) throw error;
  const dates = Array.from(new Set((data || []).map(r => r.snapshot_date))).filter(Boolean);
  if (dates.length) return dates;
  const { data: data2 } = await supabase
    .from('advisor_metrics_mv')
    .select('snapshot_date')
    .order('snapshot_date', { ascending: false });
  return Array.from(new Set((data2 || []).map(r => r.snapshot_date))).filter(Boolean);
}

async function getFundUtilization(date, assetClass = null, limit = 200) {
  const d = toDateOnly(date);
  const { data, error } = await supabase.rpc('get_fund_utilization', {
    p_date: d,
    p_asset_class: assetClass,
    p_limit: limit
  });
  if (error) throw error;
  return data || [];
}

async function getAdoptionTrend(ticker, limitMonths = 12) {
  const { data, error } = await supabase.rpc('get_fund_adoption_trend', {
    p_ticker: ticker,
    p_limit_months: limitMonths
  });
  if (error) throw error;
  return (data || []).reverse(); // chronological ascending for charting
}

export default {
  listSnapshotDates,
  getFundUtilization,
  getAdoptionTrend
};

