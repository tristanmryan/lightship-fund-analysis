// Serverless endpoint to trigger monthly alerts refresh (for Vercel cron)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Refresh-Token');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const tokenHeader = req.headers['x-refresh-token'] || req.headers['authorization']?.replace(/^Bearer\s+/i, '');
  const tokenQuery = req.query?.token || req.query?.t;
  const expected = process.env.APP_ALERTS_CRON_TOKEN || '';
  const allowPublic = process.env.APP_ALERTS_CRON_PUBLIC === '1';
  if (!allowPublic) {
    if (!expected || (tokenHeader !== expected && tokenQuery !== expected)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: 'Server not configured' });
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const t0 = Date.now();
    const results = { ok: true, steps: [] };

    // Optional pre-check only
    const precheckOnly = String(req.query?.precheck || '').toLowerCase() === '1';

    // Refresh materialized views first
    try { await supabase.rpc('refresh_advisor_metrics_mv'); results.steps.push({ step: 'refresh_advisor_metrics_mv', ok: true }); } catch (e) { results.steps.push({ step: 'refresh_advisor_metrics_mv', ok: false, error: e?.message }); }
    try { await supabase.rpc('refresh_fund_flows_mv'); results.steps.push({ step: 'refresh_fund_flows_mv', ok: true }); } catch (e) { results.steps.push({ step: 'refresh_fund_flows_mv', ok: false, error: e?.message }); }
    try { await supabase.rpc('refresh_fund_utilization_mv'); results.steps.push({ step: 'refresh_fund_utilization_mv', ok: true }); } catch (e) { results.steps.push({ step: 'refresh_fund_utilization_mv', ok: false, error: e?.message }); }
    try { await supabase.rpc('refresh_advisor_adoption_mv'); results.steps.push({ step: 'refresh_advisor_adoption_mv', ok: true }); } catch (e) { results.steps.push({ step: 'refresh_advisor_adoption_mv', ok: false, error: e?.message }); }

    if (precheckOnly) {
      const ms = Date.now() - t0;
      return res.status(200).json({ ok: true, precheckOnly: true, durationMs: ms, results });
    }

    const { data, error } = await supabase.rpc('refresh_alerts_for_month', { p_month: null });
    if (error) return res.status(500).json({ error: error.message, results });
    const ms = Date.now() - t0;
    return res.status(200).json({ ok: true, inserted: data || 0, durationMs: ms, results });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
