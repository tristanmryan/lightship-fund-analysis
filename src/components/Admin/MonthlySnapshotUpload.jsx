// src/components/Admin/MonthlySnapshotUpload.jsx
import React, { useCallback, useMemo, useState } from 'react';
import Papa from 'papaparse';
import { supabase, TABLES, dbUtils } from '../../services/supabase';
import { createFundPerformanceTemplateCSV, createBenchmarkPerformanceTemplateCSV } from '../../services/csvTemplate';

function Field({ label, children }) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <span style={{ fontSize: 12, color: '#6b7280' }}>{label}</span>
      {children}
    </label>
  );
}

function Preview({ rows = [], kind = 'fund' }) {
  const head = useMemo(() => (rows[0] ? Object.keys(rows[0]) : []), [rows]);
  const first = rows.slice(0, 10);
  if (first.length === 0) return null;
  return (
    <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 6 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} style={{ padding: 8, borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {first.map((r, i) => (
            <tr key={i}>
              {head.map((h) => (
                <td key={h} style={{ padding: 8, borderBottom: '1px solid #f3f4f6', fontSize: 12 }}>{String(r[h] ?? '')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > first.length && (
        <div style={{ padding: 8, color: '#6b7280' }}>Showing first {first.length} of {rows.length} rows.</div>
      )}
    </div>
  );
}

export default function MonthlySnapshotUpload() {
  const [asOf, setAsOf] = useState(''); // YYYY-MM-DD
  const [fundFile, setFundFile] = useState(null);
  const [benchFile, setBenchFile] = useState(null);
  const [fundRows, setFundRows] = useState([]);
  const [benchRows, setBenchRows] = useState([]);
  const [valid, setValid] = useState({ fund: 0, bench: 0 });
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);

  const parseCsv = useCallback(async (file) => {
    if (!file) return [];
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => resolve(Array.isArray(res.data) ? res.data : []),
        error: (err) => reject(err)
      });
    });
  }, []);

  const handleValidate = useCallback(async () => {
    try {
      setErrors([]);
      const [fRows, bRows] = await Promise.all([
        parseCsv(fundFile),
        parseCsv(benchFile)
      ]);

      setFundRows(fRows);
      setBenchRows(bRows);

      // Minimal validation: require ticker column
      const fundOk = fRows.filter(r => r.fund_ticker || r.ticker).length;
      const benchOk = bRows.filter(r => r.benchmark_ticker || r.ticker).length;
      setValid({ fund: fundOk, bench: benchOk });

      if (!fundOk && !benchOk) setErrors((e) => [...e, 'No recognizable ticker columns found (fund_ticker/ticker, benchmark_ticker/ticker).']);
      if (asOf && !/^\d{4}-\d{2}-\d{2}$/.test(asOf)) setErrors((e) => [...e, 'As-of date must be YYYY-MM-DD.']);
    } catch (e) {
      setErrors([e?.message || String(e)]);
    }
  }, [parseCsv, fundFile, benchFile, asOf]);

  const asOfDate = useMemo(() => {
    if (!asOf) return null;
    try { return dbUtils.formatDateOnly(asOf); } catch { return null; }
  }, [asOf]);

  const normalizeFundRow = (r) => ({
    fund_ticker: String(r.fund_ticker || r.ticker || '').toUpperCase(),
    date: asOfDate,
    ytd_return: dbUtils.parseMetricNumber(r.ytd_return ?? r.ytd),
    one_year_return: dbUtils.parseMetricNumber(r.one_year_return ?? r.one_year ?? r['1y'] ?? r['1 Year']),
    three_year_return: dbUtils.parseMetricNumber(r.three_year_return ?? r['3y'] ?? r['3 Year']),
    five_year_return: dbUtils.parseMetricNumber(r.five_year_return ?? r['5y'] ?? r['5 Year']),
    ten_year_return: dbUtils.parseMetricNumber(r.ten_year_return ?? r['10y'] ?? r['10 Year']),
    sharpe_ratio: dbUtils.parseMetricNumber(r.sharpe_ratio ?? r['sharpe'] ?? r['sharpe_3y']),
    standard_deviation_3y: dbUtils.parseMetricNumber(r.standard_deviation_3y ?? r['std_dev_3y'] ?? r['std_deviation_3y']),
    standard_deviation_5y: dbUtils.parseMetricNumber(r.standard_deviation_5y ?? r['std_dev_5y'] ?? r['std_deviation_5y']),
    expense_ratio: dbUtils.parseMetricNumber(r.expense_ratio),
    alpha: dbUtils.parseMetricNumber(r.alpha ?? r['alpha_5y']),
    beta: dbUtils.parseMetricNumber(r.beta ?? r['beta_3y']),
    manager_tenure: dbUtils.parseMetricNumber(r.manager_tenure)
  });

  const normalizeBenchRow = (r) => ({
    benchmark_ticker: String(r.benchmark_ticker || r.ticker || '').toUpperCase(),
    date: asOfDate,
    ytd_return: dbUtils.parseMetricNumber(r.ytd_return ?? r.ytd),
    one_year_return: dbUtils.parseMetricNumber(r.one_year_return ?? r.one_year ?? r['1y'] ?? r['1 Year']),
    three_year_return: dbUtils.parseMetricNumber(r.three_year_return ?? r['3y'] ?? r['3 Year']),
    five_year_return: dbUtils.parseMetricNumber(r.five_year_return ?? r['5y'] ?? r['5 Year']),
    ten_year_return: dbUtils.parseMetricNumber(r.ten_year_return ?? r['10y'] ?? r['10 Year']),
    sharpe_ratio: dbUtils.parseMetricNumber(r.sharpe_ratio ?? r['sharpe']),
    standard_deviation_3y: dbUtils.parseMetricNumber(r.standard_deviation_3y ?? r['std_dev_3y'] ?? r['std_deviation_3y']),
    standard_deviation_5y: dbUtils.parseMetricNumber(r.standard_deviation_5y ?? r['std_dev_5y'] ?? r['std_deviation_5y']),
    expense_ratio: dbUtils.parseMetricNumber(r.expense_ratio),
    alpha: dbUtils.parseMetricNumber(r.alpha),
    beta: dbUtils.parseMetricNumber(r.beta)
  });

  const handleDownloadFundTemplate = useCallback(() => {
    try {
      const blob = createFundPerformanceTemplateCSV();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'fund-performance-template.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to download fund template:', e);
    }
  }, []);

  const handleDownloadBenchmarkTemplate = useCallback(() => {
    try {
      const blob = createBenchmarkPerformanceTemplateCSV();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'benchmark-performance-template.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to download benchmark template:', e);
    }
  }, []);

  const handleImport = useCallback(async () => {
    const errs = [];
    if (!asOfDate) errs.push('Please enter a valid As-of date (YYYY-MM-DD).');
    if (errs.length) { setErrors(errs); return; }

    try {
      setBusy(true);
      setErrors([]);
      let imported = { fund: 0, bench: 0 };

      if (fundRows.length > 0) {
        const rows = fundRows
          .filter(r => r.fund_ticker || r.ticker)
          .map(normalizeFundRow)
          .filter(r => r.fund_ticker && r.date);
        if (rows.length > 0) {
          const { error } = await supabase.from(TABLES.FUND_PERFORMANCE).upsert(rows, { onConflict: 'fund_ticker,date' });
          if (error) throw error;
          imported.fund = rows.length;
        }
      }

      if (benchRows.length > 0) {
        const rows = benchRows
          .filter(r => r.benchmark_ticker || r.ticker)
          .map(normalizeBenchRow)
          .filter(r => r.benchmark_ticker && r.date);
        if (rows.length > 0) {
          const { error } = await supabase.from(TABLES.BENCHMARK_PERFORMANCE).upsert(rows, { onConflict: 'benchmark_ticker,date' });
          if (error) throw error;
          imported.bench = rows.length;
        }
      }

      alert(`Import complete. Funds: ${imported.fund}, Benchmarks: ${imported.bench}`);
    } catch (e) {
      setErrors([e?.message || String(e)]);
    } finally {
      setBusy(false);
    }
  }, [fundRows, benchRows, asOfDate]);

  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="card-header">
        <h3 className="card-title">Monthly Snapshot Import</h3>
        <p className="card-subtitle">Upload CSVs for fund and benchmark performance at a selected month-end date.</p>
      </div>

      <div style={{ display: 'grid', gap: 12, marginTop: 8 }}>
        <Field label="As-of Date (YYYY-MM-DD)">
          <input type="text" value={asOf} onChange={(e) => setAsOf(e.target.value)} placeholder="2025-01-31" style={{ width: 200 }} />
        </Field>

        <div style={{ display: 'grid', gap: 8 }}>
          <Field label="Fund Performance CSV">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="file" accept=".csv,text/csv" onChange={(e) => setFundFile(e.target.files?.[0] || null)} />
              <button className="btn btn-secondary" onClick={handleDownloadFundTemplate} style={{ fontSize: 12 }}>
                Download Template
              </button>
            </div>
          </Field>
          {fundRows.length > 0 && (
            <Preview rows={fundRows} kind="fund" />
          )}
        </div>

        <div style={{ display: 'grid', gap: 8 }}>
          <Field label="Benchmark Performance CSV (optional)">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="file" accept=".csv,text/csv" onChange={(e) => setBenchFile(e.target.files?.[0] || null)} />
              <button className="btn btn-secondary" onClick={handleDownloadBenchmarkTemplate} style={{ fontSize: 12 }}>
                Download Template
              </button>
            </div>
          </Field>
          {benchRows.length > 0 && (
            <Preview rows={benchRows} kind="bench" />
          )}
        </div>

        {!!errors.length && (
          <div className="alert alert-error" style={{ whiteSpace: 'pre-wrap' }}>
            {errors.join('\n')}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={handleValidate} disabled={busy}>Validate</button>
          <button className="btn" onClick={handleImport} disabled={busy || (!valid.fund && !valid.bench) || !asOfDate}>Import</button>
        </div>
      </div>
    </div>
  );
}

