// Vercel serverless: POST JSON with { rows: [...]} or { csv: '...' }
import { supabaseServer } from '../../src/services/supabaseServer.js';
import { parseCsv, map } from '../../src/utils/importUtils.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const { rows, csv, dryRun, refresh } = payload;
    const dataRows = Array.isArray(rows) ? rows : (csv ? parseCsv(csv) : []);
    if (!Array.isArray(dataRows) || dataRows.length === 0) {
      return res.status(400).json({ error: 'Provide rows[] or csv text with headers' });
    }

    const mapped = dataRows.map(r => map.trade(r)).filter(Boolean);
    if (mapped.length === 0) return res.status(422).json({ error: 'No valid trade rows after normalization' });

    // Upsert by external_trade_id when present; otherwise insert
    const withExtId = mapped.filter(r => r.external_trade_id);
    const withoutExtId = mapped.filter(r => !r.external_trade_id);

    if (!dryRun) {
      if (withExtId.length) {
        const { error } = await supabaseServer
          .from('trade_activity')
          .upsert(withExtId, { onConflict: 'external_trade_id' });
        if (error) throw error;
      }
      if (withoutExtId.length) {
        const { error } = await supabaseServer
          .from('trade_activity')
          .insert(withoutExtId);
        if (error) throw error;
      }

      // Refresh flows MV when requested
      if (refresh !== false) {
        await supabaseServer.rpc('refresh_fund_flows_mv').catch(() => {});
      }
    }

    const advisors = new Set(mapped.map(x => x.advisor_id)).size;
    const tickers = new Set(mapped.map(x => x.ticker).filter(Boolean)).size;
    const buys = mapped.filter(x => x.trade_type === 'BUY').length;
    const sells = mapped.filter(x => x.trade_type === 'SELL').length;
    const net = mapped.reduce((s, r) => s + (r.principal_amount || 0), 0);
    return res.status(200).json({ ok: true, rows: mapped.length, advisors, tickers, buys, sells, net, dryRun: Boolean(dryRun) });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Import failed' });
  }
}
