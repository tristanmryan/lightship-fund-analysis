// Benchmark Phase 4 RPCs: alerts + trend analytics
// Usage: node scripts/benchAlerts.mjs --month=2025-08-01 --runs=10 --ticker=SPY
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

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
    let val = s.slice(1 + idx).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (!process.env[key]) process.env[key] = val;
  }
}

function parseArgs() {
  const args = Object.fromEntries(process.argv.slice(2).map(s => { const [k,v]=s.split('='); return [k.replace(/^--/, ''), v ?? true]; }));
  return args;
}

function stats(arr) {
  const sorted = [...arr].sort((a,b)=>a-b);
  const n = sorted.length;
  const mean = sorted.reduce((s,x)=>s+x,0)/Math.max(1,n);
  const p95 = sorted[Math.max(0, Math.ceil(0.95*n)-1)] ?? 0;
  return { n, mean, p95 };
}

async function timeIt(fn, runs) {
  const times = [];
  for (let i=0;i<runs;i++) {
    const t0 = performance.now();
    await fn();
    times.push(performance.now() - t0);
  }
  return times;
}

async function pickTicker(supabase, month) {
  const { data, error } = await supabase
    .from('fund_flows_mv')
    .select('ticker')
    .eq('month', month)
    .limit(10);
  if (error) throw error;
  const tickers = (data || []).map(r => r.ticker).filter(Boolean);
  return tickers[0] || 'SPY';
}

async function main() {
  loadLocalEnv();
  const { month='2025-08-01', runs='10' } = parseArgs();
  let { ticker } = parseArgs();
  const supabaseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !key) throw new Error('Missing SUPABASE_URL or key');
  const supabase = createClient(supabaseUrl, key, { auth: { persistSession: false } });
  const k = Number(runs) || 10;

  if (!ticker) ticker = await pickTicker(supabase, month);

  console.log('[Bench] Month:', month, 'Ticker:', ticker, 'Runs:', k);

  // Ensure rules exist and generate alerts once (not timed)
  await supabase.rpc('refresh_alerts_for_month', { p_month: month });

  const t1 = await timeIt(async () => {
    await supabase.rpc('get_alerts', { p_status: 'open', p_severity: null, p_asset_class: null, p_min_priority: 0, p_limit: 100 });
  }, k);

  const t2 = await timeIt(async () => {
    await supabase.rpc('get_trend_analytics', { p_ticker: ticker, p_month: month, p_windows: [3,6,12] });
  }, k);

  const t3 = await timeIt(async () => {
    await supabase.rpc('refresh_alerts_for_month', { p_month: month });
  }, k);

  const s1 = stats(t1), s2 = stats(t2), s3 = stats(t3);
  console.log('[Bench] get_alerts          ms -> mean:', s1.mean.toFixed(1), ' p95:', s1.p95.toFixed(1));
  console.log('[Bench] get_trend_analytics ms -> mean:', s2.mean.toFixed(1), ' p95:', s2.p95.toFixed(1));
  console.log('[Bench] refresh_alerts      ms -> mean:', s3.mean.toFixed(1), ' p95:', s3.p95.toFixed(1));
}

main().catch(e => { console.error('Bench failed', e); process.exit(1); });

