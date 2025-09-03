// Benchmark Phase 3 RPCs for a given month
// Usage: node scripts/benchFlows.mjs --month=2025-08-01 --runs=10
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
    let val = s.slice(idx + 1).trim();
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

async function main() {
  loadLocalEnv();
  const { month='2025-08-01', runs='10' } = parseArgs();
  const supabaseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !key) throw new Error('Missing SUPABASE_URL or key');
  const supabase = createClient(supabaseUrl, key, { auth: { persistSession: false } });
  const k = Number(runs) || 10;

  console.log('[Bench] Month:', month, 'Runs:', k);

  const t1 = await timeIt(async () => { await supabase.rpc('get_fund_flows', { p_month: month, p_ticker: null, p_limit: 200 }); }, k);
  const t2 = await timeIt(async () => { await supabase.rpc('get_top_movers', { p_month: month, p_direction: 'inflow', p_asset_class: null, p_limit: 50 }); }, k);
  const t3 = await timeIt(async () => { await supabase.rpc('get_flow_by_asset_class', { p_month: month }); }, k);

  const s1 = stats(t1), s2 = stats(t2), s3 = stats(t3);
  console.log('[Bench] get_fund_flows   ms -> mean:', s1.mean.toFixed(1), ' p95:', s1.p95.toFixed(1));
  console.log('[Bench] get_top_movers   ms -> mean:', s2.mean.toFixed(1), ' p95:', s2.p95.toFixed(1));
  console.log('[Bench] get_flow_by_ac   ms -> mean:', s3.mean.toFixed(1), ' p95:', s3.p95.toFixed(1));
}

main().catch(e => { console.error('Bench failed', e); process.exit(1); });

