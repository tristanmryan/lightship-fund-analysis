import React, { useCallback, useEffect, useState } from 'react';
import Papa from 'papaparse';
import { supabase, TABLES } from '../../services/supabase';

export default function SeedBenchmarks() {
  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [rows, setRows] = useState([]);
  const [result, setResult] = useState(null);
  const [assetClasses, setAssetClasses] = useState([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from(TABLES.ASSET_CLASSES).select('id,name');
      setAssetClasses(data || []);
    })();
  }, []);

  const onFileChange = (e) => {
    setFile(e.target.files?.[0] || null);
    setRows([]);
    setResult(null);
  };

  const parse = useCallback(() => {
    if (!file) return;
    setParsing(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const cleaned = (res.data || []).map(r => ({
          assetClass: String(r.AssetClass || '').trim(),
          ticker: String(r.BenchmarkTicker || '').toUpperCase().trim(),
          name: String(r.Name || '').trim()
        })).filter(r => r.ticker && r.assetClass);
        setRows(cleaned);
        setParsing(false);
      },
      error: () => setParsing(false)
    });
  }, [file]);

  const downloadTemplate = () => {
    const header = '"AssetClass","BenchmarkTicker","Name"\r\n';
    const blob = new Blob([new Uint8Array([0xEF,0xBB,0xBF]), header], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'seed-benchmarks.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const runImport = async () => {
    if (rows.length === 0) return;
    const byName = new Map(assetClasses.map(a => [a.name.toLowerCase(), a]));
    let inserted = 0, updated = 0, skipped = 0, mappings = 0;
    const errors = [];

    for (const r of rows) {
      try {
        const ac = byName.get(r.assetClass.toLowerCase());
        if (!ac) { skipped++; errors.push(`AC invalid: '${r.assetClass}'`); continue; }

        // Upsert benchmark by ticker
        const { data: existingBm } = await supabase
          .from(TABLES.BENCHMARKS)
          .select('id')
          .eq('ticker', r.ticker)
          .maybeSingle();
        const { data: bm, error: bmErr } = await supabase
          .from(TABLES.BENCHMARKS)
          .upsert({ ticker: r.ticker, name: r.name || r.ticker, is_active: true }, { onConflict: 'ticker' })
          .select()
          .single();
        if (bmErr) throw bmErr;
        if (existingBm) updated++; else inserted++;

        // Upsert mapping as primary (rank=1)
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
        mappings++;
      } catch (e) {
        skipped++;
        errors.push(`${r.assetClass}/${r.ticker}: ${e.message}`);
      }
    }

    setResult({ inserted, updated, skipped, mappings, errors });
  };

  return (
    <div className="card" style={{ padding: 16, marginTop: 16 }}>
      <div className="card-header">
        <h3 className="card-title">Seed Benchmarks</h3>
        <p className="card-subtitle">Import benchmark tickers and map as primary per asset class</p>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-secondary" onClick={downloadTemplate}>Download Template</button>
        <input type="file" accept=".csv,text/csv" onChange={onFileChange} />
        <button className="btn btn-primary" onClick={parse} disabled={!file || parsing}>{parsing ? 'Parsing…' : 'Parse'}</button>
        <button className="btn btn-primary" onClick={runImport} disabled={rows.length === 0}>Import</button>
      </div>
      {rows.length > 0 && (
        <div style={{ marginTop: 8, color: '#6b7280' }}>Rows parsed: {rows.length}</div>
      )}
      {result && (
        <div style={{ marginTop: 12 }}>
          <div className="alert alert-success">Inserted: {result.inserted}, Updated: {result.updated}, Mapped: {result.mappings}, Skipped: {result.skipped}</div>
          {result.errors && result.errors.length > 0 && (
            <details style={{ marginTop: 8 }}>
              <summary>Errors ({result.errors.length})</summary>
              <ul>
                {result.errors.map((e, i) => <li key={i} style={{ color: '#7f1d1d' }}>{e}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

