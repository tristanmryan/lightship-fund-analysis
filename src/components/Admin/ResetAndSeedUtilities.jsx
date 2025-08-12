// src/components/Admin/ResetAndSeedUtilities.jsx
import React, { useMemo, useState } from 'react';
import DataHealth from './DataHealth';
import Papa from 'papaparse';
import { supabase, TABLES } from '../../services/supabase';
import { buildCSV, downloadFile } from '../../services/exportService';

export default function ResetAndSeedUtilities() {
  const isProd = process.env.NODE_ENV === 'production';
  const [benchFile, setBenchFile] = useState(null);
  const [fundsFile, setFundsFile] = useState(null);
  const [drySummary, setDrySummary] = useState(null);
  const [busy, setBusy] = useState(false);

  async function exportFundsCatalog() {
    const { data } = await supabase
      .from(TABLES.FUNDS)
      .select('ticker,name,asset_class_id,asset_class,is_recommended,last_updated')
      .order('ticker');
    const rows = [
      ['Ticker','Name','Asset Class ID','Legacy Asset Class','Is Recommended','Last Updated'],
      ...((data || []).map(r => [r.ticker||'', r.name||'', r.asset_class_id||'', r.asset_class||'', r.is_recommended? 'true':'false', r.last_updated||'']))
    ];
    const csv = buildCSV(rows);
    downloadFile(csv, 'funds_catalog.csv', 'text/csv;charset=utf-8');
  }

  async function exportBenchmarksCatalog() {
    const { data } = await supabase
      .from(TABLES.BENCHMARKS)
      .select('ticker,name')
      .order('ticker');
    const rows = [ ['Ticker','Name'], ...((data||[]).map(r => [r.ticker||'', r.name||''])) ];
    const csv = buildCSV(rows);
    downloadFile(csv, 'benchmarks_catalog.csv', 'text/csv;charset=utf-8');
  }

  async function resetFunds() {
    if (isProd) { alert('Reset disabled in production.'); return; }
    const typed = window.prompt('Type RESET FUNDS to delete ALL rows in the Funds catalog. This does not touch snapshots.');
    if ((typed||'').trim().toUpperCase() !== 'RESET FUNDS') return;
    console.log('[Admin] Reset Funds: exporting current catalog then deleting…');
    await exportFundsCatalog();
    const { error } = await supabase.from(TABLES.FUNDS).delete().not('ticker', 'is', null);
    if (error) { alert(`Delete failed: ${error.message}`); return; }
    alert('Funds catalog reset complete.');
  }

  async function resetBenchmarks() {
    if (isProd) { alert('Reset disabled in production.'); return; }
    const typed = window.prompt('Type RESET BENCHMARKS to delete ALL rows in the Benchmarks catalog and mappings.');
    if ((typed||'').trim().toUpperCase() !== 'RESET BENCHMARKS') return;
    console.log('[Admin] Reset Benchmarks: exporting current catalog then deleting…');
    await exportBenchmarksCatalog();
    try {
      const delMap = await supabase.from(TABLES.ASSET_CLASS_BENCHMARKS).delete().not('asset_class_id', 'is', null);
      if (delMap.error) throw delMap.error;
      const delBm = await supabase.from(TABLES.BENCHMARKS).delete().not('ticker', 'is', null);
      if (delBm.error) throw delBm.error;
      alert('Benchmarks catalog and mappings reset complete.');
    } catch (e) {
      alert(`Delete failed: ${e.message}`);
    }
  }

  function parseCsv(file) {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => resolve(res.data || []),
        error: (err) => reject(err)
      });
    });
  }

  async function seedAllDryRun() {
    setBusy(true); setDrySummary(null);
    try {
      if (!benchFile || !fundsFile) { alert('Choose both CSV files first.'); setBusy(false); return; }
      const [benchRowsRaw, fundRowsRaw] = await Promise.all([parseCsv(benchFile), parseCsv(fundsFile)]);
      const benchRows = benchRowsRaw.map(r => ({ assetClass: String(r.AssetClass||'').trim(), ticker: String(r.BenchmarkTicker||'').toUpperCase().trim(), name: String(r.Name||'').trim() })).filter(r => r.ticker && r.assetClass);
      const fundRows = fundRowsRaw.map(r => ({ ticker: String(r.Ticker||'').toUpperCase().trim(), assetClass: String(r.AssetClass||'').trim(), name: String(r.Name||'').trim() })).filter(r => r.ticker);

      const { data: acs } = await supabase.from(TABLES.ASSET_CLASSES).select('id,name');
      const nameToAc = new Map((acs||[]).map(a => [a.name.toLowerCase(), a]));

      // Benchmarks validate-only counts
      let bmInserted = 0, bmUpdated = 0, bmSkipped = 0, mappings = 0;
      for (const r of benchRows) {
        const ac = nameToAc.get(r.assetClass.toLowerCase());
        if (!ac) { bmSkipped++; continue; }
        const { data: existing } = await supabase.from(TABLES.BENCHMARKS).select('id').eq('ticker', r.ticker).maybeSingle();
        if (existing) bmUpdated++; else bmInserted++;
        mappings++;
      }
      // Funds validate-only counts
      let fInserted = 0, fUpdated = 0, fSkipped = 0;
      for (const r of fundRows) {
        const ac = nameToAc.get(r.assetClass.toLowerCase());
        if (!ac) { fSkipped++; continue; }
        const { data: existing } = await supabase.from(TABLES.FUNDS).select('ticker').eq('ticker', r.ticker).maybeSingle();
        if (existing) fUpdated++; else fInserted++;
      }

      setDrySummary({ bmInserted, bmUpdated, bmSkipped, mappings, fInserted, fUpdated, fSkipped });
    } finally {
      setBusy(false);
    }
  }

  async function seedAllImport() {
    if (!drySummary) { alert('Run Dry-run first.'); return; }
    if (!window.confirm('Proceed with Import? Benchmarks then Recommended Funds will be upserted.')) return;
    setBusy(true);
    try {
      // Parse again (simplify)
      const [benchRowsRaw, fundRowsRaw] = await Promise.all([parseCsv(benchFile), parseCsv(fundsFile)]);
      const benchRows = benchRowsRaw.map(r => ({ assetClass: String(r.AssetClass||'').trim(), ticker: String(r.BenchmarkTicker||'').toUpperCase().trim(), name: String(r.Name||'').trim() })).filter(r => r.ticker && r.assetClass);
      const fundRows = fundRowsRaw.map(r => ({ ticker: String(r.Ticker||'').toUpperCase().trim(), assetClass: String(r.AssetClass||'').trim(), name: String(r.Name||'').trim() })).filter(r => r.ticker);
      const { data: acs } = await supabase.from(TABLES.ASSET_CLASSES).select('id,name');
      const nameToAc = new Map((acs||[]).map(a => [a.name.toLowerCase(), a]));

      // Import benchmarks and mappings
      for (const r of benchRows) {
        const ac = nameToAc.get(r.assetClass.toLowerCase());
        if (!ac) continue;
        const up = await supabase.from(TABLES.BENCHMARKS).upsert({ ticker: r.ticker, name: r.name || r.ticker, is_active: true }, { onConflict: 'ticker' }).select().maybeSingle();
        const bm = up?.data; if (!bm) continue;
        const { data: existingMap } = await supabase
          .from(TABLES.ASSET_CLASS_BENCHMARKS)
          .select('id')
          .eq('asset_class_id', ac.id)
          .eq('kind', 'primary')
          .maybeSingle();
        if (existingMap) {
          await supabase.from(TABLES.ASSET_CLASS_BENCHMARKS).update({ benchmark_id: bm.id, rank: 1 }).eq('id', existingMap.id);
        } else {
          await supabase.from(TABLES.ASSET_CLASS_BENCHMARKS).insert({ asset_class_id: ac.id, benchmark_id: bm.id, kind: 'primary', rank: 1 });
        }
      }

      // Import recommended funds
      for (const r of fundRows) {
        const ac = nameToAc.get(r.assetClass.toLowerCase());
        if (!ac) continue;
        await supabase.from(TABLES.FUNDS).upsert({
          ticker: r.ticker,
          name: r.name || r.ticker,
          asset_class_id: ac.id,
          asset_class: null,
          is_recommended: true,
          last_updated: new Date().toISOString()
        }, { onConflict: 'ticker' });
      }
      alert('Seed All import completed.');
    } catch (e) {
      alert(`Import failed: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  const [tab, setTab] = useState('seed');
  const [rcDate, setRcDate] = useState('');
  const [rcDry, setRcDry] = useState(null);
  return (
    <div className="card" style={{ padding: 16, marginTop: 16 }}>
      <div className="card-header">
        <h3 className="card-title">Utilities</h3>
        <p className="card-subtitle">Dangerous operations are disabled in production. Data Health is for dev-only diagnostics.</p>
      </div>
      <div style={{ display:'flex', gap:8, margin:'8px 0' }}>
        <button className={`btn ${tab==='seed'?'btn-primary':'btn-secondary'}`} onClick={()=>setTab('seed')}>Seed</button>
        <button className={`btn ${tab==='health'?'btn-primary':'btn-secondary'}`} onClick={()=>setTab('health')}>Data Health</button>
      </div>
      {tab === 'health' && (
        <DataHealth />
      )}
      {tab === 'health' && (
        <div className="card" style={{ padding:12, marginTop:12 }}>
          <div style={{ fontWeight:600, marginBottom:8 }}>Inspect row (dev)</div>
          <RowInspector />
        </div>
      )}
      {tab === 'seed' && (
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        {/* Reset Funds */}
        <div className="card" style={{ padding:12 }}>
          <div style={{ fontWeight:600, marginBottom:8 }}>Reset Fund Catalog</div>
          <div style={{ color:'#6b7280', marginBottom:8 }}>Deletes all rows in <code>public.funds</code>. Snapshots not touched.</div>
          <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
            <button className="btn btn-secondary" onClick={exportFundsCatalog}>Export funds CSV</button>
            <button className="btn btn-danger" disabled={isProd || busy} title={isProd ? 'Disabled in production' : ''} onClick={resetFunds}>Reset Funds</button>
          </div>
        </div>

        {/* Reset Benchmarks */}
        <div className="card" style={{ padding:12 }}>
          <div style={{ fontWeight:600, marginBottom:8 }}>Reset Benchmarks Catalog</div>
          <div style={{ color:'#6b7280', marginBottom:8 }}>Deletes all rows in <code>public.benchmarks</code> and <code>public.asset_class_benchmarks</code>.</div>
          <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
            <button className="btn btn-secondary" onClick={exportBenchmarksCatalog}>Export benchmarks CSV</button>
            <button className="btn btn-danger" disabled={isProd || busy} title={isProd ? 'Disabled in production' : ''} onClick={resetBenchmarks}>Reset Benchmarks</button>
          </div>
        </div>
      </div>
      )}

      {tab === 'health' && (
        <div className="card" style={{ padding:12, marginTop:12 }}>
          <div style={{ fontWeight:600, marginBottom:8 }}>Reclassify Misfiled Benchmarks (dev-only)</div>
          <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', marginBottom:8 }}>
            <label>Date (YYYY-MM-DD): <input value={rcDate} onChange={(e)=>setRcDate(e.target.value)} placeholder="2025-07-31" style={{ width:140 }} /></label>
            <button className="btn btn-secondary" onClick={async ()=>{
              if (!rcDate) return;
              const { data: funds } = await supabase.from(TABLES.FUNDS).select('ticker');
              const setFunds = new Set((funds||[]).map(f=>String(f.ticker||'').toUpperCase()));
              const { data: bench } = await supabase.from(TABLES.BENCHMARK_PERFORMANCE).select('benchmark_ticker,date').eq('date', rcDate);
              const { data: perf } = await supabase.from(TABLES.FUND_PERFORMANCE).select('fund_ticker,date').eq('date', rcDate);
              const setPerf = new Set((perf||[]).map(p=>`${p.fund_ticker}::${p.date}`));
              const candidates = (bench||[]).filter(b=> setFunds.has(String(b.benchmark_ticker||'').toUpperCase()) && !setPerf.has(`${String(b.benchmark_ticker||'').toUpperCase()}::${rcDate}`));
              setRcDry({ count: candidates.length, sample: candidates.slice(0,10).map(c=>c.benchmark_ticker) });
            }}>Dry Run</button>
            <button className="btn btn-primary" disabled={!rcDry || (rcDry?.count||0)===0} onClick={async ()=>{
              if (!rcDate || !rcDry) return;
              const { data: benchRows } = await supabase.from(TABLES.BENCHMARK_PERFORMANCE).select('*').eq('date', rcDate);
              const { data: funds } = await supabase.from(TABLES.FUNDS).select('ticker');
              const setFunds = new Set((funds||[]).map(f=>String(f.ticker||'').toUpperCase()));
              const toMove = (benchRows||[]).filter(b=> setFunds.has(String(b.benchmark_ticker||'').toUpperCase()));
              if (toMove.length === 0) { alert('Nothing to reclassify.'); return; }
              const payload = toMove.map(b=>({
                fund_ticker: String(b.benchmark_ticker||'').toUpperCase(),
                date: rcDate,
                ytd_return: b.ytd_return,
                one_year_return: b.one_year_return,
                three_year_return: b.three_year_return,
                five_year_return: b.five_year_return,
                ten_year_return: b.ten_year_return,
                sharpe_ratio: b.sharpe_ratio,
                standard_deviation: b.standard_deviation,
                standard_deviation_3y: b.standard_deviation_3y,
                standard_deviation_5y: b.standard_deviation_5y,
                expense_ratio: b.expense_ratio,
                alpha: b.alpha,
                beta: b.beta,
                manager_tenure: b.manager_tenure,
                up_capture_ratio: b.up_capture_ratio,
                down_capture_ratio: b.down_capture_ratio
              }));
              await supabase.from(TABLES.FUND_PERFORMANCE).upsert(payload, { onConflict: 'fund_ticker,date' });
              // Delete originals
              for (const row of toMove) {
                await supabase.from(TABLES.BENCHMARK_PERFORMANCE).delete().eq('benchmark_ticker', row.benchmark_ticker).eq('date', rcDate);
              }
              alert(`Reclassified ${toMove.length} rows.`);
              setRcDry(null);
            }}>Apply</button>
          </div>
          {rcDry && (
            <div className="alert alert-warning">Candidates: {rcDry.count}. Sample: {rcDry.sample.join(', ')}</div>
          )}
        </div>
      )}

      {tab === 'seed' && (
      <div className="card" style={{ padding:12, marginTop:12 }}>
        <div style={{ fontWeight:600, marginBottom:8 }}>Seed All (Benchmarks → Recommended Funds)</div>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', marginBottom:8 }}>
          <label>Benchmarks CSV:<input type="file" accept=".csv,text/csv" onChange={(e)=>setBenchFile(e.target.files?.[0]||null)} /></label>
          <label>Recommended Funds CSV:<input type="file" accept=".csv,text/csv" onChange={(e)=>setFundsFile(e.target.files?.[0]||null)} /></label>
          <button className="btn btn-secondary" disabled={busy} onClick={seedAllDryRun}>Dry-run</button>
          <button className="btn btn-primary" disabled={busy || !drySummary} onClick={seedAllImport}>Import</button>
        </div>
        {drySummary && (
          <div className="alert alert-success">
            Benchmarks → Inserted: {drySummary.bmInserted}, Updated: {drySummary.bmUpdated}, Mappings: {drySummary.mappings}, Skipped: {drySummary.bmSkipped} | Funds → Inserted: {drySummary.fInserted}, Updated: {drySummary.fUpdated}, Skipped: {drySummary.fSkipped}
          </div>
        )}
      </div>
      )}
    </div>
  );
}

function RowInspector() {
  const [ticker, setTicker] = React.useState('');
  const [date, setDate] = React.useState('');
  const [json, setJson] = React.useState(null);
  async function inspect(table) {
    try {
      const col = table === TABLES.FUND_PERFORMANCE ? 'fund_ticker' : 'benchmark_ticker';
      const { data } = await supabase.from(table).select('*').eq(col, ticker.toUpperCase()).eq('date', date).limit(1);
      // eslint-disable-next-line no-console
      console.log(`[Inspect] ${table} ${ticker} ${date}`, data?.[0] || null);
      setJson(data?.[0] || null);
    } catch (e) {
      setJson({ error: e.message || String(e) });
    }
  }
  return (
    <div>
      <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', marginBottom:8 }}>
        <label>Ticker <input value={ticker} onChange={(e)=>setTicker(e.target.value)} placeholder="CMNIX" style={{ width:120 }} /></label>
        <label>Date <input value={date} onChange={(e)=>setDate(e.target.value)} placeholder="2025-07-31" style={{ width:120 }} /></label>
        <button className="btn btn-secondary" onClick={()=>inspect(TABLES.FUND_PERFORMANCE)}>Inspect fund_performance</button>
        <button className="btn btn-secondary" onClick={()=>inspect(TABLES.BENCHMARK_PERFORMANCE)}>Inspect benchmark_performance</button>
      </div>
      {json && (
        <pre style={{ background:'#f3f4f6', padding:8, borderRadius:6, maxHeight:180, overflow:'auto' }}>{JSON.stringify(json, null, 2)}</pre>
      )}
    </div>
  );
}

