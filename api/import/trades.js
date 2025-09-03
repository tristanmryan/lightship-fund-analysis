// Vercel serverless: POST JSON with { rows: [...] } or { csv: '...' }
import { supabaseServer, envInfo } from '../../src/services/supabaseServer.js';
import { parseCsv, map } from '../../src/utils/importUtils.js';

export default async function handler(req, res) {
  const log = (...args) => { try { console.log('[api/import/trades]', ...args); } catch {} };
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const { rows, csv, dryRun, refresh } = payload;
    log('start', {
      region: process.env.VERCEL_REGION || null,
      env: envInfo(),
      dryRun: Boolean(dryRun),
      rowsLen: Array.isArray(rows) ? rows.length : 0,
      csvLen: typeof csv === 'string' ? csv.length : 0,
      refresh: refresh !== false
    });

    const dataRows = Array.isArray(rows) ? rows : (csv ? parseCsv(csv) : []);
    log('parsed rows', { rows: Array.isArray(dataRows) ? dataRows.length : 0, sampleHeaders: dataRows[0] ? Object.keys(dataRows[0]).slice(0, 10) : [] });
    if (!Array.isArray(dataRows) || dataRows.length === 0) {
      return res.status(400).json({ error: 'Provide rows[] or csv text with headers' });
    }

    const mapped = dataRows.map(r => map.trade(r)).filter(Boolean);
    log('mapped', { mapped: mapped.length });
    if (mapped.length === 0) return res.status(422).json({ error: 'No valid trade rows after normalization' });

    // Upsert by external_trade_id when present; otherwise insert
    const withExtId = mapped.filter(r => r.external_trade_id);
    const withoutExtId = mapped.filter(r => !r.external_trade_id);

    // Deduplicate by external_trade_id within this batch to avoid
    // Postgres error: "ON CONFLICT DO UPDATE command cannot affect row a second time"
    // Keep the last occurrence (assumes later row is the latest state)
    let upsertRows = withExtId;
    if (withExtId.length > 0) {
      const byId = new Map();
      for (const row of withExtId) {
        byId.set(row.external_trade_id, row);
      }
      upsertRows = Array.from(byId.values());
      const dropped = withExtId.length - upsertRows.length;
      if (dropped > 0) log('deduped external_trade_id within batch', { before: withExtId.length, after: upsertRows.length, dropped });
    }

    if (!dryRun) {
      if (upsertRows.length) {
        log('upserting by external id', { count: upsertRows.length });
        const { error } = await supabaseServer
          .from('trade_activity')
          .upsert(upsertRows, { onConflict: 'external_trade_id' });
        if (error) { log('upsert extId error', { message: error.message, details: error.details, code: error.code }); throw error; }
      }
      if (withoutExtId.length) {
        log('inserting trades without external id', { count: withoutExtId.length });
        const { error } = await supabaseServer
          .from('trade_activity')
          .insert(withoutExtId);
        if (error) { log('insert error', { message: error.message, details: error.details, code: error.code }); throw error; }
      }

      // Refresh flows MV when requested
      if (refresh !== false) {
        log('refresh flows mv');
        try { await supabaseServer.rpc('refresh_fund_flows_mv'); } catch (e) { log('refresh_fund_flows_mv error', e?.message || e); }
      }
    }

    const advisors = new Set(mapped.map(x => x.advisor_id)).size;
    const tickers = new Set(mapped.map(x => x.ticker).filter(Boolean)).size;
    const buys = mapped.filter(x => x.trade_type === 'BUY').length;
    const sells = mapped.filter(x => x.trade_type === 'SELL').length;
    const net = mapped.reduce((s, r) => s + (r.principal_amount || 0), 0);
    log('success', { rows: mapped.length, advisors, tickers, buys, sells, net });
    return res.status(200).json({ ok: true, rows: mapped.length, advisors, tickers, buys, sells, net, dryRun: Boolean(dryRun) });
  } catch (e) {
    try { console.error('[api/import/trades] error', { message: e?.message, stack: e?.stack, code: e?.code, details: e?.details }); } catch {}
    return res.status(500).json({ error: e.message || 'Import failed', code: e?.code || null, details: e?.details || null });
  }
}
