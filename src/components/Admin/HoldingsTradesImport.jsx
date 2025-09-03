import React, { useMemo, useState } from 'react';
import Papa from 'papaparse';
import { supabase } from '../../services/supabase';
import { parseCurrency, parseNumber, isCashHoldingRow } from '../../utils/importParsing.js';

function parsePreview(file, setPreview, setHeaders) {
  if (!file) return;
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (res) => {
      const rows = Array.isArray(res.data) ? res.data : [];
      setHeaders(res.meta?.fields || []);
      setPreview(rows.slice(0, 10));
    },
    error: () => {
      setPreview([]);
      setHeaders([]);
    }
  });
}

async function fileToText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
}

function Summary({ title, result }) {
  if (!result) return null;
  return (
    <div className="card" style={{ padding: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{title}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, color: '#111827' }}>
        {Object.entries(result).map(([k, v]) => (
          <div key={k} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 10px' }}>
            <span style={{ color: '#6b7280', marginRight: 6 }}>{k}:</span>
            <span>{String(v)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function downloadJson(obj, filename) {
  try {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) { /* noop */ }
}

export default function HoldingsTradesImport() {
  // Holdings state
  const [holdingsDate, setHoldingsDate] = useState('');
  const [holdingsFile, setHoldingsFile] = useState(null);
  const [holdingsPreview, setHoldingsPreview] = useState([]);
  const [holdingsHeaders, setHoldingsHeaders] = useState([]);
  const [holdingsResult, setHoldingsResult] = useState(null);
  const [holdingsBusy, setHoldingsBusy] = useState(false);
  const [allowNonEom, setAllowNonEom] = useState(false);

  // Trades state
  const [tradesFile, setTradesFile] = useState(null);
  const [tradesPreview, setTradesPreview] = useState([]);
  const [tradesHeaders, setTradesHeaders] = useState([]);
  const [tradesResult, setTradesResult] = useState(null);
  const [tradesBusy, setTradesBusy] = useState(false);

  const isEndOfMonth = (dateStr) => {
    try {
      if (!dateStr) return false;
      const d = new Date(dateStr + 'T00:00:00Z');
      const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
      return d.getUTCDate() === last.getUTCDate();
    } catch { return false; }
  };

  const isEom = isEndOfMonth(holdingsDate);
  const canImportHoldings = useMemo(() => Boolean(holdingsDate && holdingsFile && (isEom || allowNonEom)), [holdingsDate, holdingsFile, isEom, allowNonEom]);
  const canImportTrades = useMemo(() => Boolean(tradesFile), [tradesFile]);
  const [holdingsErrors, setHoldingsErrors] = useState([]);
  const [tradesErrors, setTradesErrors] = useState([]);

  const analyzeHoldings = async () => {
    setHoldingsErrors([]);
    if (!holdingsFile) return;
    const text = await fileToText(holdingsFile);
    const res = Papa.parse(text, { header: true, skipEmptyLines: true });
    const rows = Array.isArray(res.data) ? res.data : [];
    const errs = [];
    rows.forEach((row, idx) => {
      const rowNum = idx + 2; // 1-based + header
      if (isCashHoldingRow(row)) return;
      const advisor = String(row['FA #'] || '').trim();
      const account = String(row['Account #'] || '').trim();
      const symbol = String(row['Symbol'] || '').trim();
      if (!advisor) errs.push({ row: rowNum, field: 'FA #', issue: 'Missing advisor' });
      if (!account) errs.push({ row: rowNum, field: 'Account #', issue: 'Missing account' });
      if (!symbol) errs.push({ row: rowNum, field: 'Symbol', issue: 'Missing symbol (cash rows auto-skipped)' });
      const qty = parseNumber(row['Quantity']);
      if (qty === null) errs.push({ row: rowNum, field: 'Quantity', issue: 'Not numeric' });
      const mv = parseCurrency(row['Current Value']);
      if (mv === null) errs.push({ row: rowNum, field: 'Current Value', issue: 'Invalid currency/format' });
    });
    setHoldingsErrors(errs);
  };

  const analyzeTrades = async () => {
    setTradesErrors([]);
    if (!tradesFile) return;
    const text = await fileToText(tradesFile);
    const res = Papa.parse(text, { header: true, skipEmptyLines: true });
    const rows = Array.isArray(res.data) ? res.data : [];
    const errs = [];
    rows.forEach((row, idx) => {
      const rowNum = idx + 2;
      const advisor = String(row['FA'] || '').trim();
      const account = String(row['Account'] || '').trim();
      const type = String(row['Transaction Type'] || '').trim().toUpperCase();
      if (!advisor) errs.push({ row: rowNum, field: 'FA', issue: 'Missing advisor' });
      if (!account) errs.push({ row: rowNum, field: 'Account', issue: 'Missing account' });
      if (!['PURCHASE', 'SALE'].includes(type)) errs.push({ row: rowNum, field: 'Transaction Type', issue: 'Must be Purchase or Sale' });
      const tdate = row['Trade Date'];
      if (!tdate || Number.isNaN(new Date(tdate).getTime())) errs.push({ row: rowNum, field: 'Trade Date', issue: 'Invalid date' });
      const amt = parseCurrency(row['Amount']);
      if (amt === null) errs.push({ row: rowNum, field: 'Amount', issue: 'Invalid currency/format' });
      const shares = row['Shares'];
      if (shares != null && String(shares).trim() !== '') {
        const sn = parseNumber(shares);
        if (sn === null) errs.push({ row: rowNum, field: 'Shares', issue: 'Not numeric' });
      }
    });
    setTradesErrors(errs);
  };

  function downloadErrorsCsv(errs, filename) {
    const header = 'row,field,issue\n';
    const body = (errs || []).map(e => `${e.row},${JSON.stringify(e.field)},${JSON.stringify(e.issue)}`).join('\n');
    const blob = new Blob([header + body], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const doImportHoldings = async (dryRun = false) => {
    if (!canImportHoldings) return;
    try {
      setHoldingsBusy(true);
      setHoldingsResult(null);
      const text = await fileToText(holdingsFile);
      // Parse CSV client-side to avoid Vercel 4.5MB body limit; send in chunks
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
      const allRows = Array.isArray(parsed.data) ? parsed.data : [];
      if (dryRun) {
        // Small sample dry-run using server CSV parsing if file is small; otherwise send first 200 rows
        const sampleRows = allRows.slice(0, 200);
        const resp = await fetch('/api/import/holdings', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ snapshotDate: holdingsDate, rows: sampleRows, dryRun: true })
        });
        const json = await resp.json();
        if (!resp.ok) throw new Error(json.error || 'Import (dry-run) failed');
        setHoldingsResult(json);
      } else {
        const chunkSize = 1000;
        let total = 0;
        for (let i = 0; i < allRows.length; i += chunkSize) {
          const chunk = allRows.slice(i, i + chunkSize);
          const isLast = i + chunkSize >= allRows.length;
          const resp = await fetch('/api/import/holdings', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ snapshotDate: holdingsDate, rows: chunk, refresh: isLast })
          });
          const json = await resp.json();
          if (!resp.ok) throw new Error(json.error || 'Import failed');
          total += json?.rows || 0;
          setHoldingsResult({ ok: true, snapshotDate: holdingsDate, rows: total, partial: !isLast });
        }
      }
    } catch (e) {
      setHoldingsResult({ error: e.message || String(e) });
    } finally {
      setHoldingsBusy(false);
    }
  };

  const doImportTrades = async (dryRun = false) => {
    if (!canImportTrades) return;
    try {
      setTradesBusy(true);
      setTradesResult(null);
      const text = await fileToText(tradesFile);
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
      const allRows = Array.isArray(parsed.data) ? parsed.data : [];
      if (dryRun) {
        const sampleRows = allRows.slice(0, 200);
        const resp = await fetch('/api/import/trades', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: sampleRows, dryRun: true })
        });
        const json = await resp.json();
        if (!resp.ok) throw new Error(json.error || 'Import (dry-run) failed');
        setTradesResult(json);
      } else {
        const chunkSize = 1000;
        let total = 0;
        for (let i = 0; i < allRows.length; i += chunkSize) {
          const chunk = allRows.slice(i, i + chunkSize);
          const isLast = i + chunkSize >= allRows.length;
          const resp = await fetch('/api/import/trades', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rows: chunk, refresh: isLast })
          });
          const json = await resp.json();
          if (!resp.ok) throw new Error(json.error || 'Import failed');
          total += json?.rows || 0;
          setTradesResult({ ok: true, rows: total, partial: !isLast });
        }
      }
    } catch (e) {
      setTradesResult({ error: e.message || String(e) });
    } finally {
      setTradesBusy(false);
    }
  };

  return (
    <div className="card" style={{ padding: 16, marginTop: 16 }}>
      <div className="card-header">
        <h3 className="card-title">Holdings & Trades Import</h3>
        <p className="card-subtitle">Upload RJ CSVs. We hash client IDs and refresh analytics automatically.</p>
      </div>

      {/* Holdings */}
      <div className="card" style={{ padding: 12, marginTop: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ margin: 0 }}>Holdings (EOM snapshot)</h4>
          <div style={{ fontSize: 12, color: isEom ? '#6b7280' : '#b45309' }}>
            {isEom ? 'Required: snapshot date (EOM)' : 'Warning: selected date is not end-of-month'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <button className="btn btn-secondary" onClick={analyzeHoldings} disabled={!holdingsFile || holdingsBusy}>Analyze Rows</button>
          {holdingsErrors.length > 0 && (
            <button className="btn btn-link" onClick={() => downloadErrorsCsv(holdingsErrors, 'holdings_errors.csv')}>Download error report</button>
          )}
        </div>
        {holdingsErrors.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Validation: {holdingsErrors.length} issues (showing first 10)</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid #e5e7eb' }}>Row</th>
                  <th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid #e5e7eb' }}>Field</th>
                  <th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid #e5e7eb' }}>Issue</th>
                </tr>
              </thead>
              <tbody>
                {holdingsErrors.slice(0, 10).map((e, i) => (
                  <tr key={i}>
                    <td style={{ padding: 6, borderBottom: '1px solid #f3f4f6' }}>{e.row}</td>
                    <td style={{ padding: 6, borderBottom: '1px solid #f3f4f6' }}>{e.field}</td>
                    <td style={{ padding: 6, borderBottom: '1px solid #f3f4f6' }}>{e.issue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 14 }}>Snapshot Date</label>
          <input type="date" value={holdingsDate} onChange={e => setHoldingsDate(e.target.value)} />
          <input type="file" accept=".csv" onChange={(e) => { const f = e.target.files?.[0]; setHoldingsFile(f || null); setHoldingsResult(null); if (f) parsePreview(f, setHoldingsPreview, setHoldingsHeaders); }} />
          {!isEom && (
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#b45309', fontSize: 12 }}>
              <input type="checkbox" checked={allowNonEom} onChange={e => setAllowNonEom(e.target.checked)} />
              Allow non-EOM import
            </label>
          )}
          <button className="btn btn-primary" onClick={() => doImportHoldings(false)} disabled={!canImportHoldings || holdingsBusy}>
            {holdingsBusy ? 'Importing...' : 'Import Holdings'}
          </button>
          <button className="btn btn-secondary" onClick={() => doImportHoldings(true)} disabled={!canImportHoldings || holdingsBusy}>
            {holdingsBusy ? 'Validating...' : 'Validate (Dry Run)'}
          </button>
        </div>
        {holdingsBusy && (
          <div style={{ marginTop: 8, background: '#e5e7eb', borderRadius: 6, height: 6, overflow: 'hidden' }}>
            <div style={{ width: '60%', height: 6, background: 'linear-gradient(90deg, #0ea5e9, #22c55e)' }} />
          </div>
        )}
        {holdingsPreview.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Preview (first 10 rows)</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {holdingsHeaders.map(h => <th key={h} style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid #e5e7eb' }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {holdingsPreview.map((r, i) => (
                    <tr key={i}>
                      {holdingsHeaders.map(h => <td key={h} style={{ padding: 6, borderBottom: '1px solid #f3f4f6' }}>{String(r[h] ?? '')}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <Summary title="Holdings Import Result" result={holdingsResult} />
        {holdingsResult && (
          <div style={{ marginTop: 8 }}>
            <button className="btn btn-link" onClick={() => downloadJson(holdingsResult, 'holdings_import_result.json')}>Download result</button>
          </div>
        )}
      </div>

      {/* Trades */}
      <div className="card" style={{ padding: 12, marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ margin: 0 }}>Trades (monthly export)</h4>
          <div style={{ fontSize: 12, color: '#6b7280' }}>We normalize amounts and signs automatically</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
          <input type="file" accept=".csv" onChange={(e) => { const f = e.target.files?.[0]; setTradesFile(f || null); setTradesResult(null); if (f) parsePreview(f, setTradesPreview, setTradesHeaders); }} />
          <button className="btn btn-primary" onClick={() => doImportTrades(false)} disabled={!canImportTrades || tradesBusy}>
            {tradesBusy ? 'Importing...' : 'Import Trades'}
          </button>
          <button className="btn btn-secondary" onClick={() => doImportTrades(true)} disabled={!canImportTrades || tradesBusy}>
            {tradesBusy ? 'Validating...' : 'Validate (Dry Run)'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <button className="btn btn-secondary" onClick={analyzeTrades} disabled={!tradesFile || tradesBusy}>Analyze Rows</button>
          {tradesErrors.length > 0 && (
            <button className="btn btn-link" onClick={() => downloadErrorsCsv(tradesErrors, 'trades_errors.csv')}>Download error report</button>
          )}
        </div>
        {tradesErrors.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Validation: {tradesErrors.length} issues (showing first 10)</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid #e5e7eb' }}>Row</th>
                  <th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid #e5e7eb' }}>Field</th>
                  <th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid #e5e7eb' }}>Issue</th>
                </tr>
              </thead>
              <tbody>
                {tradesErrors.slice(0, 10).map((e, i) => (
                  <tr key={i}>
                    <td style={{ padding: 6, borderBottom: '1px solid #f3f4f6' }}>{e.row}</td>
                    <td style={{ padding: 6, borderBottom: '1px solid #f3f4f6' }}>{e.field}</td>
                    <td style={{ padding: 6, borderBottom: '1px solid #f3f4f6' }}>{e.issue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tradesBusy && (
          <div style={{ marginTop: 8, background: '#e5e7eb', borderRadius: 6, height: 6, overflow: 'hidden' }}>
            <div style={{ width: '60%', height: 6, background: 'linear-gradient(90deg, #0ea5e9, #22c55e)' }} />
          </div>
        )}
        {tradesPreview.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Preview (first 10 rows)</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {tradesHeaders.map(h => <th key={h} style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid #e5e7eb' }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {tradesPreview.map((r, i) => (
                    <tr key={i}>
                      {tradesHeaders.map(h => <td key={h} style={{ padding: 6, borderBottom: '1px solid #f3f4f6' }}>{String(r[h] ?? '')}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <Summary title="Trades Import Result" result={tradesResult} />
        {tradesResult && (
          <div style={{ marginTop: 8 }}>
            <button className="btn btn-link" onClick={() => downloadJson(tradesResult, 'trades_import_result.json')}>Download result</button>
          </div>
        )}
      </div>

      <ImportConfirmation holdingsDate={holdingsResult?.snapshotDate || holdingsDate || null} />
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button className="btn btn-secondary" onClick={() => { try { window.dispatchEvent(new CustomEvent('NAVIGATE_APP', { detail: { tab: 'dashboard' } })); } catch {} }}>Go to Dashboard</button>
        <button className="btn btn-secondary" onClick={() => { try { window.dispatchEvent(new CustomEvent('NAVIGATE_ADMIN', { detail: { subtab: 'data' } })); } catch {} }}>Admin Overview</button>
      </div>
    </div>
  );
}

function ImportConfirmation({ holdingsDate }) {
  const [loading, setLoading] = useState(false);
  const [advisors, setAdvisors] = useState([]);
  const [flows, setFlows] = useState([]);
  const [error, setError] = useState(null);

  const refresh = async () => {
    try {
      setLoading(true);
      setError(null);
      const results = await Promise.all([
        (async () => {
          if (!holdingsDate) return [];
          const { data, error } = await supabase.rpc('get_advisor_metrics', { p_date: holdingsDate, p_advisor_id: null });
          if (error) throw error;
          return data || [];
        })(),
        (async () => {
          const { data, error } = await supabase.rpc('get_fund_flows', { p_month: null, p_ticker: null, p_limit: 100 });
          if (error) throw error;
          return data || [];
        })()
      ]);
      setAdvisors(results[0] || []);
      setFlows(results[1] || []);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ padding: 12, marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 style={{ margin: 0 }}>Import Confirmation</h4>
        <button className="btn btn-secondary" onClick={refresh} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
      {error && <div className="alert alert-error" style={{ marginTop: 8 }}>{error}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
          <div className="card" style={{ padding: 10 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Top Advisors by AUM {holdingsDate ? `(${holdingsDate})` : ''}</div>
            <MiniTable rows={(advisors || []).slice(0, 10)} columns={[{ key: 'advisor_id', label: 'Advisor' }, { key: 'client_count', label: 'Clients' }, { key: 'unique_holdings', label: 'Holdings' }, { key: 'aum', label: 'AUM' }]} />
            {(advisors || []).length > 0 && holdingsDate && (
              <div style={{ marginTop: 8 }}>
                <button className="btn btn-secondary" onClick={() => {
                  try {
                    const adv = (advisors || [])[0]?.advisor_id;
                    if (!adv) return;
                    localStorage.setItem('advisorDashboard.preselect', JSON.stringify({ date: holdingsDate, advisorId: adv }));
                    window.dispatchEvent(new CustomEvent('NAVIGATE_APP', { detail: { tab: 'advisors' } }));
                  } catch {}
                }}>Open Advisors (top advisor)</button>
              </div>
            )}
          </div>
        <div className="card" style={{ padding: 10 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Top Net Flows (latest month)</div>
          <MiniTable rows={flows.sort((a, b) => Math.abs((b.net_flow || 0)) - Math.abs((a.net_flow || 0))).slice(0, 10)} columns={[{ key: 'ticker', label: 'Ticker' }, { key: 'inflows', label: 'Inflows' }, { key: 'outflows', label: 'Outflows' }, { key: 'net_flow', label: 'Net' }]} />
        </div>
      </div>
    </div>
  );
}

function MiniTable({ rows, columns }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {columns.map(c => <th key={c.key} style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid #e5e7eb' }}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {(rows || []).map((r, i) => (
            <tr key={i}>
              {columns.map(c => <td key={c.key} style={{ padding: 6, borderBottom: '1px solid #f3f4f6' }}>{formatCell(r[c.key])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {(!rows || rows.length === 0) && (
        <div style={{ fontSize: 12, color: '#6b7280', padding: 6 }}>No data yet. Run an import and click Refresh.</div>
      )}
    </div>
  );
}

function formatCell(v) {
  if (v == null) return '';
  if (typeof v === 'number') {
    if (Math.abs(v) >= 1000) return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(v);
    return String(v);
  }
  return String(v);
}
