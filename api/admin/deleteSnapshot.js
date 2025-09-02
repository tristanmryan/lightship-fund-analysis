// Admin deletion endpoint: delete holdings snapshot by date and/or trades by month
// POST JSON: { type: 'holdings'|'trades', snapshotDate?: 'YYYY-MM-DD', month?: 'YYYY-MM', advisorId?: string }
import { supabaseServer, envInfo } from '../../src/services/supabaseServer.js';

export default async function handler(req, res) {
  const log = (...args) => { try { console.log('[api/admin/deleteSnapshot]', ...args); } catch {} };
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const { type, snapshotDate, month, advisorId } = body;
    log('start', { env: envInfo(), type, snapshotDate, month, advisorId: advisorId || null });

    if (type !== 'holdings' && type !== 'trades') {
      return res.status(400).json({ error: "type must be 'holdings' or 'trades'" });
    }

    if (type === 'holdings') {
      if (!snapshotDate) return res.status(400).json({ error: 'snapshotDate required (YYYY-MM-DD)' });
      let q = supabaseServer.from('client_holdings').delete();
      q = q.eq('snapshot_date', snapshotDate);
      if (advisorId) q = q.eq('advisor_id', advisorId);
      const { data, error, count } = await q.select('id', { count: 'exact' });
      if (error) throw error;
      // Refresh related MVs
      try { await supabaseServer.rpc('refresh_advisor_metrics_mv'); } catch (e) { log('refresh_advisor_metrics_mv error', e?.message || e); }
      try { await supabaseServer.rpc('refresh_fund_utilization_mv'); } catch (e) { log('refresh_fund_utilization_mv error', e?.message || e); }
      try { await supabaseServer.rpc('refresh_advisor_adoption_mv'); } catch (e) { log('refresh_advisor_adoption_mv error', e?.message || e); }
      return res.status(200).json({ ok: true, deleted: count ?? (data?.length || 0) });
    }

    // trades
    if (!month || !/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: 'month required (YYYY-MM)' });
    const from = month + '-01';
    const parts = month.split('-');
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    const next = new Date(Date.UTC(y, m, 1)); // first of next month
    const to = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-01`;
    let tq = supabaseServer.from('trade_activity').delete().gte('trade_date', from).lt('trade_date', to);
    if (advisorId) tq = tq.eq('advisor_id', advisorId);
    const { data: tdata, error: terror, count: tcount } = await tq.select('id', { count: 'exact' });
    if (terror) throw terror;
    try { await supabaseServer.rpc('refresh_fund_flows_mv'); } catch (e) { log('refresh_fund_flows_mv error', e?.message || e); }
    return res.status(200).json({ ok: true, deleted: tcount ?? (tdata?.length || 0) });
  } catch (e) {
    try { console.error('[api/admin/deleteSnapshot] error', { message: e?.message, code: e?.code, details: e?.details, stack: e?.stack }); } catch {}
    return res.status(500).json({ error: e.message || 'Delete failed', code: e?.code || null, details: e?.details || null });
  }
}

