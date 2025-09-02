// Vercel serverless: POST JSON with { snapshotDate: 'YYYY-MM-DD', rows: [...]} or { csv: '...', snapshotDate }
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
    const { snapshotDate, rows, csv, dryRun, refresh } = payload;
    if (!snapshotDate) return res.status(400).json({ error: 'snapshotDate is required (YYYY-MM-DD)' });

    const dataRows = Array.isArray(rows) ? rows : (csv ? parseCsv(csv) : []);
    if (!Array.isArray(dataRows) || dataRows.length === 0) {
      return res.status(400).json({ error: 'Provide rows[] or csv text with headers' });
    }

    const mapped = dataRows.map(r => map.holding(r, snapshotDate)).filter(Boolean);
    if (mapped.length === 0) return res.status(422).json({ error: 'No valid holdings rows after normalization' });

    if (!dryRun) {
      // Upsert on unique composite key
      const { error } = await supabaseServer
        .from('client_holdings')
        .upsert(mapped, { onConflict: 'snapshot_date,advisor_id,client_id,ticker' });
      if (error) throw error;

      // Refresh advisor metrics/utilization/adoption MVs once per batch when requested
      if (refresh !== false) {
        await supabaseServer.rpc('refresh_advisor_metrics_mv').catch(() => {});
        await supabaseServer.rpc('refresh_fund_utilization_mv').catch(() => {});
        await supabaseServer.rpc('refresh_advisor_adoption_mv').catch(() => {});
      }
    }

    const advisors = new Set(mapped.map(x => x.advisor_id)).size;
    const tickers = new Set(mapped.map(x => x.ticker)).size;
    const totalAUM = mapped.reduce((s, r) => s + (r.market_value || 0), 0);
    return res.status(200).json({ ok: true, snapshotDate, rows: mapped.length, advisors, tickers, totalAUM, dryRun: Boolean(dryRun) });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Import failed' });
  }
}
