// Validate fund_flows_mv against a trades CSV by recomputing flows client-side
// Usage: node scripts/validateFlows.mjs --month=2025-08-01 --trades=docs/plan/appV2/August2025TradeData.csv [--limit=20]
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { parseCsv, map } from '../src/utils/importUtils.js';

function loadLocalEnv() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const root = path.resolve(__dirname, '..');
  const envPath = path.resolve(root, '.env.local');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const s = line.trim();
    if (!s || s.startsWith('#')) continue;
    const idx = s.indexOf('=');
    if (idx <= 0) continue;
    const key = s.slice(0, idx).trim();
    let val = s.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function parseArgs() {
  const args = Object.fromEntries(process.argv.slice(2).map(s => {
    const [k, v] = s.split('=');
    return [k.replace(/^--/, ''), v === undefined ? true : v];
  }));
  return args;
}

function toMonthStart(d) {
  const dt = new Date(d);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

function sum(a) { return a.reduce((s, v) => s + (Number(v) || 0), 0); }

async function main() {
  loadLocalEnv();
  const args = parseArgs();
  const month = toMonthStart(args.month || new Date());
  const tradesPath = path.resolve(process.cwd(), args.trades || 'docs/plan/appV2/August2025TradeData.csv');
  const limit = Number(args.limit || 20);

  const supabaseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env (.env.local not loaded?)');
  }
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  console.log('[Validate] Month:', month);
  console.log('[Validate] Trades file:', tradesPath);

  const csv = fs.readFileSync(tradesPath, 'utf8');
  const rows = parseCsv(csv);
  const mapped = rows.map(r => map.trade(r)).filter(Boolean);
  // Restrict to month
  const monthKey = (d) => { const t = new Date(d); return `${t.getUTCFullYear()}-${t.getUTCMonth()}`; };
  const targetKey = monthKey(month);
  const inMonth = mapped.filter(r => monthKey(r.trade_date) === targetKey);

  // Aggregate expected flows by ticker
  const byTicker = new Map();
  for (const r of inMonth) {
    if (!r.ticker || r.cancelled) continue;
    const cur = byTicker.get(r.ticker) || { inflows: 0, outflows: 0, net: 0, advisors: new Set() };
    const amt = Number(r.principal_amount || 0);
    if (r.trade_type === 'BUY') { cur.inflows += Math.abs(amt); }
    if (r.trade_type === 'SELL') { cur.outflows += Math.abs(amt); }
    cur.net += amt;
    cur.advisors.add(r.advisor_id);
    byTicker.set(r.ticker, cur);
  }
  const expected = Array.from(byTicker.entries()).map(([t, v]) => ({
    ticker: t,
    inflows: v.inflows,
    outflows: v.outflows,
    net_flow: v.net,
    advisors_trading: v.advisors.size
  })).sort((a, b) => Math.abs(b.net_flow) - Math.abs(a.net_flow)).slice(0, limit);

  // Query DB RPC for actual
  const { data: actual, error } = await supabase.rpc('get_fund_flows', {
    p_month: month, p_ticker: null, p_limit: limit
  });
  if (error) throw error;

  // Compare
  const indexActual = new Map((actual || []).map(r => [r.ticker, r]));
  const deltas = expected.map(e => {
    const a = indexActual.get(e.ticker) || { inflows: 0, outflows: 0, net_flow: 0, advisors_trading: 0 };
    return {
      ticker: e.ticker,
      expected_inflows: e.inflows,
      actual_inflows: Number(a.inflows || 0),
      expected_outflows: e.outflows,
      actual_outflows: Number(a.outflows || 0),
      expected_net: e.net_flow,
      actual_net: Number(a.net_flow || 0),
      expected_advisors: e.advisors_trading,
      actual_advisors: Number(a.advisors_trading || 0)
    };
  });

  const penny = (x) => Math.round(Number(x || 0) * 100);
  const mismatches = deltas.filter(d => penny(d.expected_inflows) !== penny(d.actual_inflows) || penny(d.expected_outflows) !== penny(d.actual_outflows) || penny(d.expected_net) !== penny(d.actual_net));

  console.log('[Validate] Top', limit, 'tickers by |net| in CSV (expected) vs DB (actual):');
  for (const d of deltas) {
    console.log(`${d.ticker.padEnd(8)} | inflows E/A: ${d.expected_inflows.toFixed(2)} / ${d.actual_inflows.toFixed(2)} | outflows E/A: ${d.expected_outflows.toFixed(2)} / ${d.actual_outflows.toFixed(2)} | net E/A: ${d.expected_net.toFixed(2)} / ${d.actual_net.toFixed(2)} | advisors E/A: ${d.expected_advisors} / ${d.actual_advisors}`);
  }

  console.log('[Validate] Mismatches (penny-level):', mismatches.length);
  if (mismatches.length > 0) {
    console.log(JSON.stringify(mismatches.slice(0, 10), null, 2));
    process.exitCode = 2;
  } else {
    console.log('OK: Penny-accurate for top', limit, 'tickers.');
  }
}

main().catch((e) => { console.error('Validate failed', e); process.exit(1); });

