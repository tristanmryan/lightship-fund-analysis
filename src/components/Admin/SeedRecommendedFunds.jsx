import React, { useCallback, useEffect, useState } from 'react';
import Papa from 'papaparse';
import { supabase, TABLES } from '../../services/supabase';

export default function SeedRecommendedFunds() {
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
          ticker: String(r.Ticker || '').toUpperCase().trim(),
          assetClass: String(r.AssetClass || '').trim(),
          name: String(r.Name || '').trim()
        })).filter(r => r.ticker);
        setRows(cleaned);
        setParsing(false);
      },
      error: () => setParsing(false)
    });
  }, [file]);

  const downloadTemplate = () => {
    const header = '"Ticker","AssetClass","Name"\r\n';
    const blob = new Blob([new Uint8Array([0xEF,0xBB,0xBF]), header], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'seed-recommended-funds.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const runImport = async () => {
    if (rows.length === 0) return;
    const byName = new Map(assetClasses.map(a => [a.name.toLowerCase(), a]));
    let inserted = 0, updated = 0, skipped = 0;
    const errors = [];

    for (const r of rows) {
      try {
        const ac = byName.get(r.assetClass.toLowerCase());
        if (!ac) { skipped++; errors.push(`${r.ticker}: invalid AssetClass '${r.assetClass}'`); continue; }
        const { data: existing } = await supabase
          .from(TABLES.FUNDS)
          .select('ticker')
          .eq('ticker', r.ticker)
          .maybeSingle();
        const payload = {
          ticker: r.ticker,
          name: r.name || r.ticker,
          asset_class_id: ac.id,
          asset_class: null,
          is_recommended: true,
          last_updated: new Date().toISOString()
        };
        const { data, error } = await supabase
          .from(TABLES.FUNDS)
          .upsert(payload, { onConflict: 'ticker' })
          .select()
          .single();
        if (error) throw error;
        if (existing) updated++; else inserted++;
      } catch (e) {
        skipped++;
        errors.push(`${r.ticker}: ${e.message}`);
      }
    }

    setResult({ inserted, updated, skipped, errors });
  };

  return (
    <div className="card" style={{ padding: 16, marginTop: 16 }}>
      <div className="card-header">
        <h3 className="card-title">Seed Recommended Funds</h3>
        <p className="card-subtitle">Import recommended funds and their asset classes</p>
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
          <div className="alert alert-success">Inserted: {result.inserted}, Updated: {result.updated}, Skipped: {result.skipped}</div>
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

