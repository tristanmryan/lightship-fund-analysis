// Vercel serverless: POST JSON with { snapshotDate: 'YYYY-MM-DD', rows: [...] } or { csv: '...', snapshotDate }
import { supabaseServer, envInfo } from '../../src/services/supabaseServer.js';
import { parseCsv, map } from '../../src/utils/importUtils.js';

export default async function handler(req, res) {
  const log = (...args) => { try { console.log('[api/import/holdings]', ...args); } catch {} };
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const { snapshotDate, rows, csv, dryRun, refresh } = payload;
    log('start', {
      region: process.env.VERCEL_REGION || null,
      env: envInfo(),
      snapshotDate,
      dryRun: Boolean(dryRun),
      rowsLen: Array.isArray(rows) ? rows.length : 0,
      csvLen: typeof csv === 'string' ? csv.length : 0,
      refresh: refresh !== false
    });
    if (!snapshotDate) return res.status(400).json({ error: 'snapshotDate is required (YYYY-MM-DD)' });

    const dataRows = Array.isArray(rows) ? rows : (csv ? parseCsv(csv) : []);
    log('parsed rows', { rows: Array.isArray(dataRows) ? dataRows.length : 0, sampleHeaders: dataRows[0] ? Object.keys(dataRows[0]).slice(0, 10) : [] });
    if (!Array.isArray(dataRows) || dataRows.length === 0) {
      return res.status(400).json({ error: 'Provide rows[] or csv text with headers' });
    }

    const mapped = dataRows.map(r => map.holding(r, snapshotDate)).filter(Boolean);
    log('mapped', { mapped: mapped.length });
    if (mapped.length === 0) return res.status(422).json({ error: 'No valid holdings rows after normalization' });

    if (!dryRun) {
      // Upsert on unique composite key
      log('upserting', { count: mapped.length });
      const { error } = await supabaseServer
        .from('client_holdings')
        .upsert(mapped, { onConflict: 'snapshot_date,advisor_id,client_id,ticker' });
      if (error) {
        log('upsert error', { message: error.message, details: error.details, code: error.code });
        throw error;
      }

      // Refresh advisor metrics and fund utilization MVs (flows MV depends on trades)
      if (refresh !== false) {
        log('refreshing materialized views');
        await supabaseServer.rpc('refresh_advisor_metrics_mv').catch(e => log('refresh_advisor_metrics_mv error', e?.message || e));
        await supabaseServer.rpc('refresh_fund_utilization_mv').catch(e => log('refresh_fund_utilization_mv error', e?.message || e));
        await supabaseServer.rpc('refresh_advisor_adoption_mv').catch(e => log('refresh_advisor_adoption_mv error', e?.message || e));
      }
    }

    const advisors = new Set(mapped.map(x => x.advisor_id)).size;
    const tickers = new Set(mapped.map(x => x.ticker)).size;
    const totalAUM = mapped.reduce((s, r) => s + (r.market_value || 0), 0);
    log('success', { advisors, tickers, rows: mapped.length, totalAUM });
    return res.status(200).json({ ok: true, snapshotDate, rows: mapped.length, advisors, tickers, totalAUM, dryRun: Boolean(dryRun) });
  } catch (e) {
    try { console.error('[api/import/holdings] error', { message: e?.message, stack: e?.stack, code: e?.code, details: e?.details }); } catch {}
    return res.status(500).json({ error: e.message || 'Import failed', code: e?.code || null, details: e?.details || null });
  }
}

