// src/components/Admin/ResetAndSeedUtilities.jsx
import React, { useState } from 'react';
import DataHealth from './DataHealth';
import RealDataImporter from './RealDataImporter';
import Papa from 'papaparse';
import { supabase, TABLES } from '../../services/supabase';
import { buildCSV, downloadFile } from '../../services/exportService.js';
import databaseResetService from '../../services/databaseResetService';

export default function ResetAndSeedUtilities() {
  const isProd = process.env.NODE_ENV === 'production';
  const [benchFile, setBenchFile] = useState(null);
  const [fundsFile, setFundsFile] = useState(null);
  const [drySummary, setDrySummary] = useState(null);
  const [busy, setBusy] = useState(false);
  const [eomSource, setEomSource] = useState('');
  const [eomResult, setEomResult] = useState(null);

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

  const [tab, setTab] = useState('import');
  const [rcDate, setRcDate] = useState('');
  const [rcDry, setRcDry] = useState(null);
  const [professionalReset, setProfessionalReset] = useState({ inProgress: false, result: null });
  return (
    <div className="card" style={{ padding: 16, marginTop: 16 }}>
      <div className="card-header">
        <h3 className="card-title">Utilities</h3>
        <p className="card-subtitle">Dangerous operations are disabled in production. Data Health is for dev-only diagnostics.</p>
      </div>
      <div style={{ display:'flex', gap:8, margin:'8px 0' }}>
        <button className={`btn ${tab==='import'?'btn-primary':'btn-secondary'}`} onClick={()=>setTab('import')}>Real Data Import</button>
        <button className={`btn ${tab==='reset'?'btn-primary':'btn-secondary'}`} onClick={()=>setTab('reset')}>Professional Reset</button>
        <button className={`btn ${tab==='seed'?'btn-primary':'btn-secondary'}`} onClick={()=>setTab('seed')}>Seed</button>
        <button className={`btn ${tab==='health'?'btn-primary':'btn-secondary'}`} onClick={()=>setTab('health')}>Data Health</button>
      </div>
      {tab === 'import' && (
        <RealDataImporter />
      )}
      {tab === 'reset' && (
        <ProfessionalResetTab professionalReset={professionalReset} setProfessionalReset={setProfessionalReset} />
      )}
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

        {/* Convert Non-EOM to EOM */}
        <div className="card" style={{ padding:12 }}>
          <div style={{ fontWeight:600, marginBottom:8 }}>Convert Snapshot to EOM</div>
          <div style={{ color:'#6b7280', marginBottom:8 }}>If a snapshot was imported mid-month, convert all fund rows to the month's end date. Existing EOM rows will be merged.</div>
          <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', marginBottom:8 }}>
            <label>Source date <input value={eomSource} onChange={(e)=>setEomSource(e.target.value)} placeholder="YYYY-MM-DD" style={{ width:140 }} /></label>
            <button className="btn btn-secondary" disabled={busy || !eomSource} onClick={async ()=>{
              try {
                setBusy(true); setEomResult(null);
                const svc = (await import('../../services/fundService')).default;
                const res = await svc.convertSnapshotToEom(eomSource);
                setEomResult(res);
              } catch (e) {
                setEomResult({ error: e.message || String(e) });
              } finally {
                setBusy(false);
              }
            }}>Convert</button>
          </div>
          {eomResult && (
            <div className="alert" style={{ background:'#ecfdf5', border:'1px solid #a7f3d0', color:'#065f46', borderRadius:6, padding:8 }}>
              {eomResult.error ? `Error: ${eomResult.error}` : `Moved ${eomResult.moved || 0} rows${eomResult.merged ? ' (merged with existing EOM)' : ''}.`}
            </div>
          )}
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

function ProfessionalResetTab({ professionalReset, setProfessionalReset }) {
  const isProd = process.env.NODE_ENV === 'production';

  const handleProfessionalReset = async () => {
    const confirmText = 'PROFESSIONAL RESET';
    const userInput = window.prompt(
      `WARNING: This will clear all sample data while preserving asset class groups, benchmark mappings, and scoring weights.\n\nType "${confirmText}" to confirm:`
    );

    if (userInput !== confirmText) {
      return;
    }

    setProfessionalReset({ inProgress: true, result: null });

    try {
      const result = await databaseResetService.performProfessionalReset();
      setProfessionalReset({ inProgress: false, result });
    } catch (error) {
      setProfessionalReset({ 
        inProgress: false, 
        result: { 
          success: false, 
          errors: [error.message],
          completed: new Date().toISOString()
        }
      });
    }
  };

  return (
    <div>
      {/* Professional Reset Section */}
      <div className="card" style={{ 
        padding: '1.5rem', 
        marginBottom: '1rem',
        border: '2px solid #3b82f6',
        backgroundColor: '#eff6ff'
      }}>
        <div style={{ marginBottom: '1rem' }}>
          <h3 style={{ 
            fontSize: '1.25rem', 
            fontWeight: '600', 
            color: '#1e40af',
            marginBottom: '0.5rem' 
          }}>
            Professional Database Reset
          </h3>
          <p style={{ color: '#1e40af', margin: 0 }}>
            Clean reset for production-ready deployment with real fund data
          </p>
        </div>

        <div style={{ 
          backgroundColor: '#fef3c7', 
          border: '1px solid #f59e0b',
          borderRadius: '0.5rem',
          padding: '1rem',
          marginBottom: '1rem'
        }}>
          <h4 style={{ fontSize: '0.875rem', fontWeight: '600', margin: '0 0 0.5rem 0' }}>
            What will be cleared:
          </h4>
          <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.875rem' }}>
            <li>All sample fund performance data</li>
            <li>Historical snapshots and user data</li>
            <li>Research notes and activity logs</li>
            <li>Local IndexedDB cache</li>
          </ul>
        </div>

        <div style={{ 
          backgroundColor: '#d1fae5', 
          border: '1px solid #10b981',
          borderRadius: '0.5rem',
          padding: '1rem',
          marginBottom: '1rem'
        }}>
          <h4 style={{ fontSize: '0.875rem', fontWeight: '600', margin: '0 0 0.5rem 0' }}>
            What will be preserved:
          </h4>
          <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.875rem' }}>
            <li>Asset class groups and definitions</li>
            <li>Benchmark mappings and configurations</li>
            <li>Scoring weights and methodology</li>
            <li>Database schema and structure</li>
          </ul>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            className="btn btn-primary"
            disabled={isProd || professionalReset.inProgress}
            onClick={handleProfessionalReset}
            style={{
              backgroundColor: professionalReset.inProgress ? '#6b7280' : '#dc2626',
              borderColor: professionalReset.inProgress ? '#6b7280' : '#dc2626'
            }}
          >
            {professionalReset.inProgress ? 'Resetting...' : 'Professional Reset'}
          </button>
          
          {isProd && (
            <span style={{ color: '#dc2626', fontSize: '0.875rem' }}>
              Disabled in production
            </span>
          )}
        </div>

        {/* Reset Results */}
        {professionalReset.result && (
          <div style={{ 
            marginTop: '1rem',
            padding: '1rem',
            backgroundColor: professionalReset.result.success ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${professionalReset.result.success ? '#16a34a' : '#dc2626'}`,
            borderRadius: '0.5rem'
          }}>
            <h4 style={{ 
              fontSize: '0.875rem', 
              fontWeight: '600', 
              margin: '0 0 0.5rem 0',
              color: professionalReset.result.success ? '#16a34a' : '#dc2626'
            }}>
              {professionalReset.result.success ? 'Reset Completed Successfully' : 'Reset Failed'}
            </h4>
            
            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
              <div>IndexedDB: {professionalReset.result.indexedDbCleared ? '✅ Cleared' : '❌ Failed'}</div>
              <div>Supabase: {professionalReset.result.supabaseCleared ? '✅ Cleared' : '❌ Failed'}</div>
              <div>Benchmarks: {professionalReset.result.benchmarksPreserved ? '✅ Preserved' : '❌ Failed'}</div>
              <div>Asset Classes: {professionalReset.result.assetClassesPreserved ? '✅ Preserved' : '❌ Failed'}</div>
            </div>

            {professionalReset.result.errors && professionalReset.result.errors.length > 0 && (
              <div style={{ marginTop: '0.5rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#dc2626' }}>Errors:</div>
                <ul style={{ margin: '0.25rem 0 0 1rem', fontSize: '0.75rem', color: '#dc2626' }}>
                  {professionalReset.result.errors.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ 
              marginTop: '0.75rem',
              paddingTop: '0.75rem',
              borderTop: '1px solid #e5e7eb',
              fontSize: '0.75rem',
              color: '#6b7280'
            }}>
              Completed: {new Date(professionalReset.result.completed).toLocaleString()}
            </div>
          </div>
        )}
      </div>
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

