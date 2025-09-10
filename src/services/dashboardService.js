// src/services/dashboardService.js
import { supabase, TABLES } from './supabase.js';
import fundService from './fundService.js';
import { computeRuntimeScores, loadEffectiveWeightsResolver } from './scoring.js';
import asOfStore from './asOfStore.js';

// Utilities
const toDateOnly = (d) => (typeof d === 'string' ? d.slice(0,10) : (d ? new Date(d).toISOString().slice(0,10) : null));

async function getLatestSnapshotDate() {
  const { data, error } = await supabase
    .from(TABLES.FUND_PERFORMANCE)
    .select('date')
    .order('date', { ascending: false })
    .limit(1);
  if (error) return null;
  return (data?.[0]?.date ? String(data[0].date).slice(0,10) : null);
}

export async function getKpis(asOf = null) {
  const active = toDateOnly(asOf) || asOfStore.getActiveMonth() || await getLatestSnapshotDate();
  let funds = 0;
  let recommended = 0;
  let minCoverage = 0;
  let alertsCount = 0;
  let snapshotDate = active || null;
  let freshnessDays = null;

  try {
    // Counts
    const [{ count: fundCount }, { count: recCount }] = await Promise.all([
      supabase.from(TABLES.FUNDS).select('id', { count: 'exact', head: true }),
      supabase.from(TABLES.FUNDS).select('id', { count: 'exact', head: true }).eq('is_recommended', true)
    ]);
    funds = fundCount ?? 0;
    recommended = recCount ?? 0;

    // Coverage estimate for key metrics at active date
    if (active) {
      const fields = 'ytd_return,one_year_return,sharpe_ratio,standard_deviation_3y,standard_deviation';
      const { data: rows } = await supabase
        .from(TABLES.FUND_PERFORMANCE)
        .select(fields)
        .eq('date', active)
        .limit(5000);
      const total = rows?.length || 0;
      const nz = (arr) => arr.filter(v => v != null && !Number.isNaN(v)).length;
      if (total > 0) {
        const ytd = nz(rows.map(r => r.ytd_return));
        const oneY = nz(rows.map(r => r.one_year_return));
        const sharpe = nz(rows.map(r => r.sharpe_ratio));
        const sd3 = nz(rows.map(r => (r.standard_deviation_3y ?? r.standard_deviation)));
        const covs = [ytd, oneY, sharpe, sd3].map(n => Math.round((n / total) * 100));
        minCoverage = covs.length ? Math.min(...covs) : 0;
      }
    }

    // Snapshot freshness
    if (snapshotDate) {
      const d = new Date(snapshotDate + 'T00:00:00Z');
      const now = new Date();
      freshnessDays = Math.max(0, Math.floor((now - d) / (24 * 3600 * 1000)));
    }
  } catch {}

  // Alerts count is derived from triage
  try {
    const triage = await getTriage(active);
    alertsCount = triage.length;
  } catch { alertsCount = 0; }

  return { funds, recommended, minCoverage, alertsCount, snapshotDate, freshnessDays };
}

export async function getTriage(asOf = null) {
  const active = toDateOnly(asOf) || asOfStore.getActiveMonth();
  const items = [];
  try {
    // Non-EOM & zero rows
    let fundRows = 0; let benchRows = 0;
    if (active) {
      const [{ data: f }, { data: b }] = await Promise.all([
        supabase.from(TABLES.FUND_PERFORMANCE).select('fund_ticker').eq('date', active).limit(10000),
        supabase.from(TABLES.BENCHMARK_PERFORMANCE).select('benchmark_ticker').eq('date', active).limit(10000)
      ]);
      fundRows = (f || []).length; benchRows = (b || []).length;
      if (fundRows === 0 && benchRows > 0) items.push({ severity: 'critical', title: 'Missing fund rows for active month', detail: `Funds: 0, Benchmarks: ${benchRows}`, action: { label: 'Open Importer', ev: { tab: 'admin', subtab: 'data' } } });
      if (fundRows === 0 && benchRows === 0) items.push({ severity: 'warning', title: 'No data for active month', detail: `${active}`, action: { label: 'Open Importer', ev: { tab: 'admin', subtab: 'data' } } });

      // Non-EOM
      try {
        const a = new Date(active + 'T00:00:00Z');
        const e = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + 1, 0));
        if (a.getUTCDate() !== e.getUTCDate()) {
          items.push({ severity: 'info', title: 'Active month is not end-of-month', detail: `${active}`, action: { label: 'Open Utilities', ev: { tab: 'admin', subtab: 'utilities' } } });
        }
      } catch {}

      // Coverage & unresolved/class mapping
      // Coverage
      const fields = 'ytd_return,one_year_return,sharpe_ratio,standard_deviation_3y,standard_deviation';
      const { data: rows } = await supabase
        .from(TABLES.FUND_PERFORMANCE)
        .select(fields)
        .eq('date', active)
        .limit(5000);
      const total = rows?.length || 0;
      if (total > 0) {
        const nz = (arr) => arr.filter(v => v != null && !Number.isNaN(v)).length;
        const cov = {
          ytd: total ? Math.round((nz(rows.map(r => r.ytd_return)) / total) * 100) : 0,
          oneY: total ? Math.round((nz(rows.map(r => r.one_year_return)) / total) * 100) : 0,
          sharpe: total ? Math.round((nz(rows.map(r => r.sharpe_ratio)) / total) * 100) : 0,
          sd3y: total ? Math.round((nz(rows.map(r => (r.standard_deviation_3y ?? r.standard_deviation))) / total) * 100) : 0
        };
        const low = Object.entries(cov).filter(([,v]) => v > 0 && v < 50);
        if (low.length > 0) {
          items.push({ severity: 'warning', title: 'Low metric coverage', detail: low.map(([k,v]) => `${k}: ${v}%`).join(', '), action: { label: 'Open Importer', ev: { tab: 'admin', subtab: 'data' } } });
        }
      }

      // Unresolved funds & classes missing primary benchmark
      const { getFundsWithPerformance } = await import('./fundDataService.js');
      const fundsAsOf = await getFundsWithPerformance(active);
      const unresolved = (fundsAsOf || []).filter(r => (!r.asset_class_id && !r.asset_class));
      if (unresolved.length > 0) {
        items.push({ severity: 'info', title: 'Unresolved funds (missing asset class)', detail: `${unresolved.length} fund${unresolved.length === 1 ? '' : 's'}`, action: { label: 'Open Catalogs', ev: { tab: 'admin', subtab: 'catalogs', focus: 'classes' } } });
      }

      // Classes missing primary benchmark mapping among classes in view
      const [{ data: ac }, { data: acb }] = await Promise.all([
        supabase.from(TABLES.ASSET_CLASSES).select('id, name'),
        supabase.from(TABLES.ASSET_CLASS_BENCHMARKS).select('asset_class_id, kind, rank')
      ]);
      const primarySet = new Set((acb || []).filter(r => r?.kind === 'primary' || r?.rank === 1).map(r => r.asset_class_id));
      const classesInView = new Set((fundsAsOf || []).map(r => r.asset_class_id).filter(Boolean));
      const missing = Array.from(classesInView).filter(id => !primarySet.has(id));
      if (missing.length > 0) {
        items.push({ severity: 'critical', title: 'Classes missing primary benchmarks', detail: `${missing.length} class${missing.length === 1 ? '' : 'es'}`, action: { label: 'Open Benchmarks', ev: { tab: 'admin', subtab: 'catalogs', focus: 'benchmarks' } } });
      }
    }
  } catch {}
  // Order: critical → warning → info
  const weight = { critical: 0, warning: 1, info: 2 };
  return items.sort((a,b) => (weight[a.severity] ?? 3) - (weight[b.severity] ?? 3));
}

export async function getDeltas(currAsOf = null, prevAsOf = null) {
  const current = toDateOnly(currAsOf) || asOfStore.getActiveMonth() || await getLatestSnapshotDate();
  // Find previous EOM date if not provided
  let previous = toDateOnly(prevAsOf);
  if (!previous) {
    const { data: dates } = await supabase
      .from(TABLES.FUND_PERFORMANCE)
      .select('date')
      .lt('date', current)
      .order('date', { ascending: false })
      .limit(200);
    previous = (dates || []).map(r => String(r.date).slice(0,10)).find(d => {
      try { const a = new Date(d + 'T00:00:00Z'); const e = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + 1, 0)); return a.getUTCDate() === e.getUTCDate(); } catch { return false; }
    }) || (dates?.[0] ? String(dates[0].date).slice(0,10) : null);
  }
  if (!previous) return { moversUp: [], moversDown: [], newlyRecommended: [], dropped: [], stats: { avgYtdDelta: 0, advancers: 0, decliners: 0 } };

  const [currFunds, prevFunds] = await Promise.all([
    fundService.getAllFunds(current),
    fundService.getAllFunds(previous)
  ]);
  await loadEffectiveWeightsResolver();
  const currScored = computeRuntimeScores(currFunds || []);
  const prevScored = computeRuntimeScores(prevFunds || []);
  const prevMap = new Map((prevScored || []).map(f => [String(f.ticker || f.symbol || '').toUpperCase(), f]));
  const changes = [];
  let ytdSum = 0; let ytdCount = 0; let adv = 0; let dec = 0;
  for (const f of (currScored || [])) {
    const t = String(f.ticker || f.symbol || '').toUpperCase();
    const p = prevMap.get(t);
    if (!p) continue;
    const sCurr = f.scores?.final ?? f.score ?? 0;
    const sPrev = p.scores?.final ?? p.score ?? 0;
    changes.push({ ticker: t, name: f.name, delta: sCurr - sPrev, curr: sCurr, prev: sPrev });
    const yCurr = f.ytd_return; const yPrev = p.ytd_return;
    if (Number.isFinite(yCurr) && Number.isFinite(yPrev)) {
      const d = yCurr - yPrev; ytdSum += d; ytdCount += 1; if (d > 0) adv++; else if (d < 0) dec++;
    }
  }
  changes.sort((a,b) => b.delta - a.delta);
  const moversUp = changes.slice(0, 5);
  const moversDown = changes.slice(-5).reverse();

  const currRec = new Set((currScored || []).filter(f => f.is_recommended || f.recommended).map(f => String(f.ticker || f.symbol || '').toUpperCase()));
  const prevRec = new Set((prevScored || []).filter(f => f.is_recommended || f.recommended).map(f => String(f.ticker || f.symbol || '').toUpperCase()));
  const newlyRecommended = Array.from(currRec).filter(t => !prevRec.has(t));
  const dropped = Array.from(prevRec).filter(t => !currRec.has(t));

  const stats = { avgYtdDelta: ytdCount ? (ytdSum / ytdCount) : 0, advancers: adv, decliners: dec, previous };
  return { moversUp, moversDown, newlyRecommended, dropped, stats };
}

const dashboardService = { getKpis, getTriage, getDeltas };
export default dashboardService;

