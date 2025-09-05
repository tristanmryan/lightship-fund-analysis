// scripts/traceDashboardFlow.mjs
// ESM script to trace Dashboard data flow without running the UI
// - Loads env from .env.local/.env
// - Imports fundService and calls getFundsWithOwnership(null)
// - Logs RPCs invoked (best effort based on service code) and first-row samples

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

// Simple .env loader (supports KEY=VALUE lines, ignores comments)
function loadEnv(filePath) {
  try {
    const txt = fs.readFileSync(filePath, 'utf8');
    for (const line of txt.split(/\r?\n/)) {
      if (!line || /^\s*#/.test(line)) continue;
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const key = m[1];
      let val = m[2];
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch {}
}

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
loadEnv(path.join(root, '.env.local'));
loadEnv(path.join(root, '.env'));

// Ensure defaults helpful for local tracing
if (!process.env.NODE_ENV) process.env.NODE_ENV = 'development';

// Import service after env is in place
const fundServicePath = path.join(root, 'src', 'services', 'fundService.js');
const fundServiceMod = await import(url.pathToFileURL(fundServicePath).href);
const fundService = fundServiceMod.default;

function previewRow(label, row) {
  const pick = (obj, keys) => keys.reduce((acc, k) => (acc[k] = obj?.[k], acc), {});
  const fields = [
    'ticker','name','asset_class','asset_class_name','asset_class_id','is_recommended',
    'ytd_return','expense_ratio','scores','score','score_final','score_breakdown',
    'firmAUM','advisorCount','percentile'
  ];
  // eslint-disable-next-line no-console
  console.log(`\n[Sample ${label}]`, JSON.stringify(pick(row || {}, fields), null, 2));
}

// Monkey-patch supabase.rpc to log calls (best effort)
const supabase = fundService.supabase;
const originalRpc = supabase.rpc?.bind(supabase);
const rpcCalls = [];
if (originalRpc) {
  supabase.rpc = async (fnName, params) => {
    const started = Date.now();
    try {
      const res = await originalRpc(fnName, params);
      const dur = Date.now() - started;
      rpcCalls.push({ fn: fnName, params, count: Array.isArray(res?.data) ? res.data.length : (res?.data ? 1 : 0), ms: dur });
      return res;
    } catch (e) {
      const dur = Date.now() - started;
      rpcCalls.push({ fn: fnName, params, error: e?.message || String(e), ms: dur });
      throw e;
    }
  };
}

// Run the flow
(async () => {
  // eslint-disable-next-line no-console
  console.log(`[Trace] NODE_ENV=${process.env.NODE_ENV}, DB_SCORES=${process.env.REACT_APP_DB_SCORES}`);

  const funds = await fundService.getFundsWithOwnership(null);
  // eslint-disable-next-line no-console
  console.log(`[Trace] getFundsWithOwnership returned ${Array.isArray(funds) ? funds.length : 0} rows`);
  if (Array.isArray(funds) && funds.length > 0) {
    previewRow('funds[0]', funds[0]);

    // Also fetch the asset class table for funds[0] to sample a scored row
    try {
      const acId = funds[0]?.asset_class_id;
      if (acId) {
        const { data: acRows } = await supabase.rpc('get_asset_class_table', {
          p_date: null,
          p_asset_class_id: acId,
          p_include_benchmark: false
        });
        if (Array.isArray(acRows) && acRows.length > 0) {
          // eslint-disable-next-line no-console
          console.log(`\n[Sample get_asset_class_table first row for acId=${acId}]`, JSON.stringify(acRows[0], null, 2));
        }
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Asset class table sample failed:', e?.message || e);
    }
  }

  // Summarize RPC calls observed
  // eslint-disable-next-line no-console
  console.log('\n[RPC Calls Observed]');
  for (const c of rpcCalls) {
    // eslint-disable-next-line no-console
    console.log(`- ${c.fn}(${JSON.stringify(c.params)}) -> ${c.count ?? 'err'} items in ${c.ms}ms`);
  }
})();
