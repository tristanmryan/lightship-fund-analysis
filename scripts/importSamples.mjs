// Import RJ sample holdings and trade CSVs directly into Supabase using server-side client
// Usage: node scripts/importSamples.mjs --snapshot=YYYY-MM-DD [--holdings=path] [--trades=path] [--dry]
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabaseServer } from '../src/services/supabaseServer.js';
import { parseCsv, map } from '../src/utils/importUtils.js';

function parseArgs() {
  const args = Object.fromEntries(process.argv.slice(2).map(s => {
    const [k,v] = s.split('=');
    return [k.replace(/^--/, ''), v === undefined ? true : v];
  }));
  return args;
}

function chunk(arr, size) { const out=[]; for (let i=0;i<arr.length;i+=size) out.push(arr.slice(i,i+size)); return out; }

async function importHoldings(filePath, snapshotDate, dryRun=false) {
  const csv = fs.readFileSync(filePath, 'utf8');
  const rows = parseCsv(csv);
  const mapped = rows.map(r => map.holding(r, snapshotDate)).filter(Boolean);
  console.log(`[Holdings] Parsed ${rows.length}, mapped valid ${mapped.length}`);
  if (dryRun) return { ok: true, rows: mapped.length, advisors: new Set(mapped.map(x=>x.advisor_id)).size, tickers: new Set(mapped.map(x=>x.ticker)).size };
  for (const part of chunk(mapped, 1000)) {
    const { error } = await supabaseServer.from('client_holdings').upsert(part, { onConflict: 'snapshot_date,advisor_id,client_id,ticker' });
    if (error) throw error;
  }
  await supabaseServer.rpc('refresh_advisor_metrics_mv').catch(()=>{});
  return { ok: true, rows: mapped.length };
}

async function importTrades(filePath, dryRun=false) {
  const csv = fs.readFileSync(filePath, 'utf8');
  const rows = parseCsv(csv);
  const mapped = rows.map(r => map.trade(r)).filter(Boolean);
  console.log(`[Trades] Parsed ${rows.length}, mapped valid ${mapped.length}`);
  if (dryRun) return { ok: true, rows: mapped.length };
  const withExtId = mapped.filter(r => r.external_trade_id);
  const withoutExtId = mapped.filter(r => !r.external_trade_id);
  for (const part of chunk(withExtId, 1000)) {
    const { error } = await supabaseServer.from('trade_activity').upsert(part, { onConflict: 'external_trade_id' });
    if (error) throw error;
  }
  for (const part of chunk(withoutExtId, 1000)) {
    const { error } = await supabaseServer.from('trade_activity').insert(part);
    if (error) throw error;
  }
  await supabaseServer.rpc('refresh_fund_flows_mv').catch(()=>{});
  return { ok: true, rows: mapped.length };
}

async function main() {
  const args = parseArgs();
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const root = path.resolve(__dirname, '..');
  const holdingsPath = path.resolve(root, args.holdings || 'docs/plan/appV2/Holdings_Data_Example.csv');
  const tradesPath = path.resolve(root, args.trades || 'docs/plan/appV2/August2025TradeData.csv');
  const snapshot = args.snapshot || (() => {
    // Default to last day of previous month UTC
    const now = new Date();
    const lastDayPrev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
    const y = lastDayPrev.getUTCFullYear();
    const m = String(lastDayPrev.getUTCMonth() + 1).padStart(2, '0');
    const d = String(lastDayPrev.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  })();
  const dryRun = Boolean(args.dry);

  console.log('[Import Samples] Using SUPABASE_URL:', process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL);
  console.log('[Import Samples] Snapshot date:', snapshot);
  console.log('[Import Samples] Holdings file:', holdingsPath);
  console.log('[Import Samples] Trades file:', tradesPath);
  if (dryRun) console.log('[Import Samples] DRY RUN — will not write to DB');

  const h = fs.existsSync(holdingsPath) ? await importHoldings(holdingsPath, snapshot, dryRun) : { skipped: true };
  console.log('[Holdings] Result:', h);
  const t = fs.existsSync(tradesPath) ? await importTrades(tradesPath, dryRun) : { skipped: true };
  console.log('[Trades] Result:', t);
}

main().catch((e) => { console.error('Import failed', e); process.exit(1); });

