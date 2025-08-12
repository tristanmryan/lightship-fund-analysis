// src/components/Admin/MonthlySnapshotUpload.jsx
import React, { useState, useEffect, useCallback } from 'react';
import Papa from 'papaparse';
import fundService from '../../services/fundService';
import { dbUtils } from '../../services/supabase';
import { createMonthlyTemplateCSV, createLegacyMonthlyTemplateCSV } from '../../services/csvTemplate';

const FLAG_ENABLE_IMPORT = (process.env.REACT_APP_ENABLE_IMPORT || 'false') === 'true';

function isValidDateOnly(str) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(str || '').trim());
}

function isEndOfMonth(dateStr) {
  try {
    const d = new Date(dateStr + 'T00:00:00Z');
    const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
    return d.getUTCDate() === next.getUTCDate();
  } catch {
    return false;
  }
}

function PreviewTable({ rows }) {
  const shown = rows.slice(0, 20);
  return (
    <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 6 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ padding: 8, borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>Ticker</th>
            <th style={{ padding: 8, borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>AsOfMonth</th>
            <th style={{ padding: 8, borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>Type</th>
            <th style={{ padding: 8, borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>EOM</th>
            <th style={{ padding: 8, borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>Action</th>
            <th style={{ padding: 8, borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>Reason</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r, i) => (
            <tr key={i}>
              <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{r.ticker}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{r.asOf}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{r.kind}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{r.eom ? 'Yes' : 'Warn'}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{r.willImport ? 'Import' : 'Skip'}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6', color: '#6b7280' }}>{r.reason || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > shown.length && (
        <div style={{ padding: 8, color: '#6b7280' }}>Showing first {shown.length} of {rows.length} rows…</div>
      )}
    </div>
  );
}

export default function MonthlySnapshotUpload() {
  const [knownTickers, setKnownTickers] = useState(new Set());
  const [benchmarkMap, setBenchmarkMap] = useState(new Map()); // ticker -> name
  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [parsedRows, setParsedRows] = useState([]);
  const [preview, setPreview] = useState([]);
  const [counts, setCounts] = useState({ parsed: 0, willImport: 0, skipped: 0, eomWarnings: 0 });
  const [monthsInFile, setMonthsInFile] = useState([]);
  const [mode, setMode] = useState('csv'); // 'csv' | 'picker'
  const [hasAsOfColumn, setHasAsOfColumn] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [month, setMonth] = useState(''); // 1-12 as string
  const [year, setYear] = useState(''); // YYYY as string

  useEffect(() => {
    let mounted = true;
    (async () => {
      const fundTickers = await fundService.listFundTickers();
      const benchList = await fundService.listBenchmarkTickers();
      if (!mounted) return;
      setKnownTickers(new Set(fundTickers.map((t) => String(t || '').toUpperCase())));
      const bm = new Map();
      (benchList || []).forEach(({ ticker, name }) => {
        bm.set(String(ticker || '').toUpperCase(), name || '');
      });
      setBenchmarkMap(bm);
    })();
    return () => { mounted = false; };
  }, []);

  const handleFileChange = (e) => {
    setFile(e.target.files?.[0] || null);
    setParsedRows([]);
    setPreview([]);
    setCounts({ parsed: 0, willImport: 0, skipped: 0, eomWarnings: 0 });
    setResult(null);
    setMonthsInFile([]);
    setMode('csv');
    setHasAsOfColumn(false);
  };

  const handleDownloadTemplate = useCallback(() => {
    try {
      const blob = createMonthlyTemplateCSV();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'fund-monthly-template.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  }, []);

  const handleDownloadLegacyTemplate = useCallback(() => {
    try {
      const blob = createLegacyMonthlyTemplateCSV();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'fund-monthly-template-legacy.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  }, []);

  const parseCsv = useCallback(() => {
    if (!file) return;
    setParsing(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const headers = (res.meta && res.meta.fields) || [];
        const hasAsOf = headers.some(h => String(h).toLowerCase() === 'asofmonth' || String(h).toLowerCase() === 'as_of_month');
        setHasAsOfColumn(hasAsOf);
        // Deterministic mode: if picker has values, picker wins; else if AsOfMonth exists, csv; else picker if picker values present later
        setMode((() => {
          const pickerDate = computePickerDate();
          if (pickerDate) return 'picker';
          return hasAsOf ? 'csv' : 'picker';
        })());
        const rows = (res.data || []).map((r) => {
          // Normalize keys to our expectations but keep original
          const ticker = dbUtils.cleanSymbol(r.Ticker || r.ticker || r.SYMBOL);
          let a = String(r.AsOfMonth || r.as_of_month || '').trim();
          // Accept YYYY-MM or YYYY-MM-DD; expand YYYY-MM to last day
          if (/^\d{4}-\d{2}$/.test(a)) {
            try {
              const [yy, mm] = a.split('-').map(n => Number(n));
              const eom = new Date(Date.UTC(yy, mm, 0));
              a = eom.toISOString().slice(0,10);
            } catch {}
          }
          const asOf = a;
          return { ...r, __ticker: ticker, __asOf: asOf };
        });
        setParsedRows(rows);
        setParsing(false);
      },
      error: () => setParsing(false)
    });
  }, [file]);

  useEffect(() => {
    if (!parsedRows || parsedRows.length === 0) {
      setPreview([]);
      setCounts({ parsed: 0, willImport: 0, skipped: 0, eomWarnings: 0 });
      setMonthsInFile([]);
      return;
    }
    const seenMonths = new Set();
    const pickerDate = computePickerDate();
    // Picker always wins if present
    const activeMode = pickerDate ? 'picker' : (hasAsOfColumn ? 'csv' : 'picker');
    setMode(activeMode);
    const rows = parsedRows.map((r) => {
      const ticker = r.__ticker;
      const asOf = activeMode === 'picker' ? pickerDate : r.__asOf;
      let reason = '';
      let willImport = true;
      if (!ticker) { willImport = false; reason = 'Missing Ticker'; }
      if (!asOf || !isValidDateOnly(asOf)) { willImport = false; reason = reason ? reason + '; invalid AsOfMonth' : 'Invalid AsOfMonth'; }
      let eom = false;
      if (asOf && isValidDateOnly(asOf)) {
        eom = isEndOfMonth(asOf);
        seenMonths.add(asOf);
      }
      const isBenchmark = ticker && benchmarkMap.has(ticker);
      const isKnownFund = ticker && knownTickers.has(ticker);
      // Only import if ticker exists in funds (FK). Benchmarks are labeled but must also exist in funds to import.
      if (ticker && !isKnownFund) { willImport = false; reason = reason ? reason + '; unknown ticker' : 'Unknown ticker'; }
      const kind = isBenchmark ? 'benchmark' : 'fund';
      return { ticker, asOf, kind, willImport, reason, eom };
    });
    const parsed = rows.length;
    const willImport = rows.filter(r => r.willImport).length;
    const skipped = parsed - willImport;
    const eomWarnings = rows.filter(r => r.willImport && !r.eom).length;
    setMonthsInFile(Array.from(seenMonths).sort((a,b) => b.localeCompare(a)));
    setPreview(rows);
    setCounts({ parsed, willImport, skipped, eomWarnings });
  }, [parsedRows, knownTickers, benchmarkMap]);

  function computePickerDate() {
    if (!year || !month) return null;
    const y = Number(String(year).trim());
    const m = Number(String(month).trim());
    if (!y || !m || m < 1 || m > 12) return null;
    // Compute end-of-month in UTC
    const eom = new Date(Date.UTC(y, m, 0));
    return eom.toISOString().slice(0, 10);
  }

  const handleImport = async () => {
    if (preview.length === 0) return;
    const pickerDate = computePickerDate();
    if (!pickerDate) {
      alert('Please select Month and Year. The picker is required and overrides CSV dates.');
      return;
    }
    setImporting(true);
    setResult(null);
    try {
      const rowsToImport = preview.filter(r => r.willImport).map((r) => {
        const original = parsedRows.find(pr => pr.__ticker === r.ticker && pr.__asOf === r.asOf) || {};
          // Picker overrides CSV AsOfMonth
          return {
          ticker: r.ticker,
          date: pickerDate,
          ytd_return: original.ytd_return ?? original.YTD,
          one_year_return: original.one_year_return ?? original['1 Year'],
          three_year_return: original.three_year_return ?? original['3 Year'],
          five_year_return: original.five_year_return ?? original['5 Year'],
          ten_year_return: original.ten_year_return ?? original['10 Year'],
          sharpe_ratio: original.sharpe_ratio ?? original['Sharpe Ratio'],
            standard_deviation: original.standard_deviation ?? original['Standard Deviation'],
            standard_deviation_3y: (() => {
              const v = original.standard_deviation_3y ?? original['standard_deviation_3y'] ?? original['Standard Deviation 3Y'];
              if (v != null) return v;
              const legacy = original.standard_deviation ?? original['Standard Deviation'];
              if (legacy != null) {
                // legacy fallback mapping notice
                // eslint-disable-next-line no-console
                console.warn('[Importer] Legacy "standard_deviation" mapped to 3Y. Please switch to "standard_deviation_3y".');
                return legacy;
              }
              return null;
            })(),
            standard_deviation_5y: original.standard_deviation_5y ?? original['standard_deviation_5y'] ?? original['Standard Deviation 5Y'],
          expense_ratio: original.expense_ratio ?? original['Net Expense Ratio'],
            alpha: original.alpha ?? original.alpha_5y ?? original['Alpha'],
            beta: original.beta ?? original.beta_3y ?? original['Beta'],
            manager_tenure: original.manager_tenure ?? original['Manager Tenure'],
            up_capture_ratio: original.up_capture_ratio ?? original.up_capture_ratio_3y ?? original['Up Capture Ratio'] ?? original['Up Capture Ratio (Morningstar Standard) - 3 Year'],
            down_capture_ratio: original.down_capture_ratio ?? original.down_capture_ratio_3y ?? original['Down Capture Ratio'] ?? original['Down Capture Ratio (Morningstar Standard) - 3 Year']
        };
      });
      const { success, failed } = await fundService.bulkUpsertFundPerformance(rowsToImport, 500);
      const uniqueMonths = new Set(rowsToImport.map(r => r.date));
      setResult({ success, failed, months: Array.from(uniqueMonths).sort((a,b) => b.localeCompare(a)) });
    } catch (error) {
      setResult({ error: error.message || String(error) });
    } finally {
      setImporting(false);
    }
  };

  if (!FLAG_ENABLE_IMPORT) {
    return null;
  }

  return (
    <div className="card" style={{ padding: 16, marginTop: 16 }}>
      <h3 style={{ marginTop: 0 }}>Monthly Snapshot Upload (CSV)</h3>
      <p style={{ color: '#6b7280', marginTop: 4 }}>Upload → Preview → Import. One CSV per month. Month/Year picker is required; it overrides any CSV dates.</p>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <button onClick={handleDownloadTemplate} className="btn btn-secondary" title="Download a blank monthly snapshot CSV template">
          Download CSV Template
        </button>
        <button onClick={handleDownloadLegacyTemplate} className="btn btn-link" title="Download legacy CSV template that includes AsOfMonth">
          Legacy template (includes AsOfMonth)
        </button>
        <input type="file" accept=".csv,text/csv" onChange={handleFileChange} />
        <button onClick={parseCsv} disabled={!file || parsing} className="btn btn-primary">
          {parsing ? 'Parsing…' : 'Parse CSV'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: '#6b7280' }}>Month *</label>
          <select value={month} onChange={(e) => setMonth(e.target.value)}>
            <option value="">Select…</option>
            {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: '#6b7280' }}>Year *</label>
          <input value={year} onChange={(e) => setYear(e.target.value)} placeholder="YYYY" style={{ width: 100 }} />
        </div>
        <div style={{ color: '#6b7280', fontSize: 12 }}>Picker overrides CSV dates.</div>
        {preview.length > 0 && (
          <div style={{ fontSize: 12, background:'#f3f4f6', border:'1px solid #e5e7eb', padding:'2px 6px', borderRadius:12 }}>
            Mode: {mode === 'picker' ? `Picker (${String(month).padStart(2,'0')}/${year})` : 'CSV date'}
          </div>
        )}
      </div>

      {preview.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
            <div><strong>Parsed:</strong> {counts.parsed}</div>
            <div><strong>Will import:</strong> {counts.willImport}</div>
            <div><strong>Skipped:</strong> {counts.skipped}</div>
            <div title="Rows with non end-of-month AsOfMonth; you can proceed but recommended to fix."><strong>EOM warnings:</strong> {counts.eomWarnings}</div>
            <div><strong>AsOfMonth column detected:</strong> {hasAsOfColumn ? 'Yes' : 'No'}</div>
            <div><strong>Active mode:</strong> {mode === 'picker' ? 'Picker' : 'CSV'}</div>
            <div><strong>AsOfMonth in file:</strong> {monthsInFile.length === 1 ? monthsInFile[0] : monthsInFile.join(', ')}</div>
          </div>
          {counts.eomWarnings > 0 && (
            <div style={{ padding: 8, background: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412', borderRadius: 6, marginBottom: 8 }}>
              Some CSV rows are not end-of-month. The picker will auto-correct to end-of-month.
            </div>
          )}
          <PreviewTable rows={preview} />
          <div style={{ marginTop: 12 }}>
            <button onClick={handleImport} disabled={importing || counts.willImport === 0} className="btn btn-primary">
              {importing ? 'Importing…' : 'Import'}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div style={{ marginTop: 12 }}>
          {result.error ? (
            <div style={{ padding: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#7f1d1d', borderRadius: 6 }}>
              Import failed: {result.error}
            </div>
          ) : (
            <div style={{ padding: 8, background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', borderRadius: 6 }}>
              Imported: {result.success}, Failed: {result.failed}. AsOfMonth: {result.months?.length === 1 ? result.months[0] : (result.months || []).join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

