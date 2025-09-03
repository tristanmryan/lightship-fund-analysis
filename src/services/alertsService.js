// src/services/alertsService.js
import { supabase } from './supabase.js';

function toMonthStart(dateLike) {
  try {
    const d = dateLike instanceof Date ? dateLike : new Date(String(dateLike));
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  } catch { return null; }
}

export async function refreshAlertsForMonth(month = null) {
  const m = month ? toMonthStart(month) : null;
  const t0 = performance.now();
  const { data, error } = await supabase.rpc('refresh_alerts_for_month', { p_month: m });
  fireMetric('alerts.refresh', performance.now() - t0, { month: m });
  if (error) throw error;
  return data || 0;
}

export async function listAlerts({ status = 'open', severity = null, assetClass = null, minPriority = null, limit = 100, afterId = null } = {}) {
  try {
    const t0 = performance.now();
    const { data, error } = await supabase.rpc('get_alerts', {
      p_status: status,
      p_severity: severity,
      p_asset_class: assetClass,
      p_min_priority: minPriority,
      p_limit: limit,
      p_after_id: afterId
    });
    fireMetric('alerts.list', performance.now() - t0, { status, severity, assetClass });
    if (error) throw error;
    return data || [];
  } catch (e) {
    // degrade gracefully
    return [];
  }
}

export async function getAlertActions(alertId) {
  try {
    const { data, error } = await supabase
      .from('alert_actions')
      .select('id, action, actor, note, created_at')
      .eq('alert_id', alertId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch {
    return [];
  }
}

export async function acknowledgeAlert(id, actor = null, note = null) {
  const { data, error } = await supabase.rpc('acknowledge_alert', { p_alert_id: id, p_actor: actor, p_note: note });
  if (error) throw error;
  return !!data;
}

export async function resolveAlert(id, actor = null, note = null) {
  const { data, error } = await supabase.rpc('resolve_alert', { p_alert_id: id, p_actor: actor, p_note: note });
  if (error) throw error;
  return !!data;
}

export async function getTrendAnalytics({ ticker, windows = [3,6,12], month = null }) {
  if (!ticker) return [];
  const m = month ? toMonthStart(month) : null;
  const t0 = performance.now();
  const { data, error } = await supabase.rpc('get_trend_analytics', {
    p_month: m,
    p_ticker: String(ticker).toUpperCase(),
    p_windows: windows
  });
  fireMetric('analytics.trend', performance.now() - t0, { ticker: String(ticker).toUpperCase() });
  if (error) throw error;
  return data || [];
}

export default {
  refreshAlertsForMonth,
  listAlerts,
  getAlertActions,
  acknowledgeAlert,
  resolveAlert,
  getTrendAnalytics,
  async listRules() {
    try {
      const { data, error } = await supabase
        .from('alert_rules')
        .select('id, name, description, rule_type, scope, severity_default, is_active, params, created_at, created_by')
        .order('id');
      if (error) throw error;
      return data || [];
    } catch { return []; }
  },
  async updateRule(id, patch) {
    const { data, error } = await supabase
      .from('alert_rules')
      .update(patch)
      .eq('id', id)
      .select('id')
      .single();
    if (error) throw error;
    return data;
  },
  async createRule(rule) {
    const payload = {
      name: rule.name,
      description: rule.description || null,
      rule_type: rule.rule_type,
      scope: rule.scope || 'ticker',
      severity_default: rule.severity_default || 'warning',
      params: rule.params || {},
      is_active: rule.is_active !== false
    };
    const { data, error } = await supabase
      .from('alert_rules')
      .insert([payload])
      .select('id')
      .single();
    if (error) throw error;
    return data;
  },
  async deleteRule(id) {
    const { error } = await supabase.from('alert_rules').delete().eq('id', id);
    if (error) throw error;
    return true;
  }
};

function fireMetric(name, durationMs, labels) {
  try {
    if (typeof window === 'undefined') return;
    if (process.env.REACT_APP_METRICS_ENABLED !== '1') return;
    fetch('/api/metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, durationMs: Number(durationMs || 0), labels: labels || null })
    }).catch(() => {});
  } catch {}
}
