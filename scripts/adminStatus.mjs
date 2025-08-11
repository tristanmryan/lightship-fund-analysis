import { createClient } from '@supabase/supabase-js';

// Auto-load env from .env.local or .env if present
try {
  const dotenv = await import('dotenv');
  dotenv.config({ path: '.env.local' });
  dotenv.config();
} catch {}

const url = process.env.REACT_APP_SUPABASE_URL;
const key = process.env.REACT_APP_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON;
if (!url || !key) {
  console.error('Missing REACT_APP_SUPABASE_URL or REACT_APP_SUPABASE_ANON_KEY/REACT_APP_SUPABASE_ANON');
  process.exit(1);
}

const s = createClient(url, key);
const pick = (arr, n) => (Array.isArray(arr) ? arr.slice(0, n) : []);

(async () => {
  const [{ count: fundsTotal }, { count: recCount }, recList, { count: nullACCount }] = await Promise.all([
    s.from('funds').select('id', { count: 'exact', head: true }),
    s.from('funds').select('id', { count: 'exact', head: true }).eq('is_recommended', true),
    s.from('funds').select('ticker').eq('is_recommended', true).order('ticker', { ascending: true }).limit(10),
    s.from('funds').select('id', { count: 'exact', head: true }).is('asset_class_id', null),
  ]);

  const [{ data: assetClasses }, { count: benchmarksCount }, benchFirst10] = await Promise.all([
    s.from('asset_classes').select('id, code, name').order('sort_group', { ascending: true }).order('sort_order', { ascending: true }),
    s.from('benchmarks').select('id', { count: 'exact', head: true }),
    s.from('benchmarks').select('ticker').order('ticker', { ascending: true }).limit(10),
  ]);

  const { data: acb } = await s.from('asset_class_benchmarks').select('asset_class_id, kind, rank');
  const primaryIds = new Set((acb || []).filter(r => r?.kind === 'primary' || r?.rank === 1).map(r => r.asset_class_id));
  const unmapped = (assetClasses || []).filter(ac => !primaryIds.has(ac.id));
  const mappedCount = primaryIds.size;
  const assetClassCount = (assetClasses || []).length;

  let snap = [];
  {
    const { data: rpcData, error: rpcErr } = await s.rpc('list_snapshot_counts');
    if (!rpcErr && Array.isArray(rpcData)) snap = rpcData.map(r => ({ date: r.date, rows: Number(r.rows) || 0 }));
    if (!snap.length) {
      const { data } = await s.from('fund_performance').select('date');
      const m = new Map();
      for (const r of data || []) {
        const d = r.date?.slice(0, 10);
        if (d) m.set(d, (m.get(d) || 0) + 1);
      }
      snap = Array.from(m.entries()).map(([date, rows]) => ({ date, rows })).sort((a,b)=>b.date.localeCompare(a.date));
    }
  }
  const snapshotsTop6 = pick(snap, 6);
  const latestSnapshot = snapshotsTop6[0]?.date || null;

  const [{ data: fTickers }, { data: fpTickers }] = await Promise.all([
    s.from('funds').select('ticker'),
    s.from('fund_performance').select('fund_ticker'),
  ]);
  const fundTickerSet = new Set((fTickers || []).map(r => (r.ticker || '').toUpperCase()));
  const orphanSet = new Set((fpTickers || []).map(r => (r.fund_ticker || '').toUpperCase()).filter(t => t && !fundTickerSet.has(t)));

  const { data: fpKeys } = await s.from('fund_performance').select('fund_ticker,date');
  const dupMap = new Map();
  for (const r of fpKeys || []) {
    const k = `${(r.fund_ticker || '').toUpperCase()}|${r.date?.slice(0,10)}`;
    dupMap.set(k, (dupMap.get(k) || 0) + 1);
  }
  const duplicates = Array.from(dupMap.entries()).filter(([, c]) => c > 1).length;

  console.log(JSON.stringify({
    funds: {
      total: fundsTotal ?? 0,
      recommendedCount: recCount ?? 0,
      first10Recommended: (recList?.data || []).map(r => r.ticker),
      nullAssetClassIdCount: nullACCount ?? 0,
    },
    assetClasses: {
      count: assetClassCount,
      names: (assetClasses || []).map(ac => ac.name),
    },
    benchmarks: {
      count: benchmarksCount ?? 0,
      first10Tickers: (benchFirst10?.data || []).map(b => b.ticker),
    },
    mapping: {
      primaryMapped: mappedCount,
      totalAssetClasses: assetClassCount,
      unmappedAssetClasses: unmapped.map(ac => ac.name),
    },
    snapshots: {
      top6: snapshotsTop6,
      latestSnapshotDate: latestSnapshot,
    },
    sanity: {
      orphanFundPerformanceTickersCount: orphanSet.size,
      duplicatesByTickerDate: duplicates,
    }
  }, null, 2));
})();

