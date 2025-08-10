// src/components/Dashboard/ComparisonPanel.jsx
import React, { useState, useMemo, useEffect } from 'react';
import { computeBenchmarkDelta } from './benchmarkUtils';
import { formatPercent, formatNumber } from '../../utils/formatters';
import preferencesService from '../../services/preferencesService';
import { exportCompareCSV, downloadFile, shouldConfirmLargeExport } from '../../services/exportService';

const metricDefs = [
  { key: 'scores.final', label: 'Score', fmt: (v) => (v == null ? '—' : formatNumber(v, 1)) },
  { key: 'ytd', label: 'YTD Return', fmt: (v) => (v == null ? '—' : formatPercent(v)) },
  { key: '1y', label: '1-Year Return', fmt: (v) => (v == null ? '—' : formatPercent(v)) },
  { key: '3y', label: '3-Year Return', fmt: (v) => (v == null ? '—' : formatPercent(v)) },
  { key: '5y', label: '5-Year Return', fmt: (v) => (v == null ? '—' : formatPercent(v)) },
  { key: 'sharpe', label: 'Sharpe Ratio', fmt: (v) => (v == null ? '—' : formatNumber(v, 2)) },
  { key: 'expense', label: 'Expense Ratio', fmt: (v) => (v == null ? '—' : formatPercent(v)) },
  { key: 'beta', label: 'Beta', fmt: (v) => (v == null ? '—' : formatNumber(v, 2)) },
  { key: 'upCapture', label: 'Up Capture (3Y)', fmt: (v) => (v == null ? '—' : formatPercent(v, 1)) },
  { key: 'downCapture', label: 'Down Capture (3Y)', fmt: (v) => (v == null ? '—' : formatPercent(v, 1)) }
];

function getValue(fund, key) {
  switch (key) {
    case 'scores.final': return fund?.scores?.final ?? fund?.score ?? null;
    case 'ytd': return fund?.ytd_return ?? null;
    case '1y': return fund?.one_year_return ?? null;
    case '3y': return fund?.three_year_return ?? null;
    case '5y': return fund?.five_year_return ?? null;
    case 'sharpe': return fund?.sharpe_ratio ?? null;
    case 'expense': return fund?.expense_ratio ?? null;
    case 'beta': return fund?.beta ?? null;
    case 'upCapture': return fund?.up_capture_ratio ?? null;
    case 'downCapture': return fund?.down_capture_ratio ?? null;
    default: return null;
  }
}

const ComparisonPanel = ({ funds = [], initialSavedSets = null }) => {
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState('');
  const [setName, setSetName] = useState('');
  const [savedSets, setSavedSets] = useState({});
  const [currentLoaded, setCurrentLoaded] = useState('');
  const [notice, setNotice] = useState('');

  // Load saved compare sets
  useEffect(() => {
    (async () => {
      const sets = await preferencesService.getCompareSets();
      setSavedSets(sets || {});
    })();
  }, []);

  // Allow tests to seed saved sets synchronously
  useEffect(() => {
    if (initialSavedSets && Object.keys(initialSavedSets).length > 0) {
      setSavedSets(initialSavedSets);
    }
  }, [initialSavedSets]);

  // Auto-load single saved set if present and nothing selected yet (helps SSR/tests)
  useEffect(() => {
    if (!savedSets || Object.keys(savedSets).length !== 1) return;
    if (selected.length > 0 || currentLoaded) return;
    const [key, entry] = Object.entries(savedSets)[0];
    const tickerSet = new Set(normalizedTickers(entry.tickers));
    const found = (funds || []).filter(f => tickerSet.has(getTicker(f))).slice(0, 4);
    const missing = tickerSet.size - found.length;
    setSelected(found);
    setCurrentLoaded(entry.name || key);
    setSetName(entry.name || key);
    setNotice(missing > 0 ? `${missing} tickers not found, loaded the rest.` : '');
  }, [savedSets, selected.length, currentLoaded, funds]);

  const options = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (funds || []).filter(f => {
      if (!needle) return true;
      const sym = (f.Symbol || f.ticker || '').toLowerCase();
      const name = (f['Fund Name'] || f.name || '').toLowerCase();
      return sym.includes(needle) || name.includes(needle);
    });
  }, [funds, search]);

  const addFund = (fund) => {
    if (!fund) return;
    if (selected.find(s => (s.Symbol || s.ticker) === (fund.Symbol || fund.ticker))) return;
    setSelected(prev => [...prev, fund].slice(0, 4));
  };

  const removeFund = (symbol) => {
    setSelected(prev => prev.filter(f => (f.Symbol || f.ticker) !== symbol));
  };

  const normalizedTickers = (arr) => (arr || []).map(t => String(t).toUpperCase());
  const getTicker = (f) => (f.Symbol || f.ticker || '').toUpperCase();

  async function handleSave() {
    const name = setName.trim();
    if (!name || selected.length === 0) return;
    const key = name.toLowerCase();
    const existing = savedSets[key];
    if (existing && !window.confirm(`A set named "${name}" exists. Overwrite?`)) return;
    const next = { ...savedSets };
    next[key] = {
      tickers: normalizedTickers(selected.map(getTicker)),
      created_at: existing?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      name // store display name
    };
    setSavedSets(next);
    await preferencesService.saveCompareSets(next);
    setCurrentLoaded(name);
  }

  async function handleLoad(nameKey) {
    if (!nameKey) return;
    const entry = savedSets[nameKey];
    if (!entry) return;
    const tickerSet = new Set(normalizedTickers(entry.tickers));
    const found = (funds || []).filter(f => tickerSet.has(getTicker(f))).slice(0, 4);
    const missing = tickerSet.size - found.length;
    setSelected(found);
    setCurrentLoaded(entry.name || nameKey);
    setSetName(entry.name || nameKey);
    setNotice(missing > 0 ? `${missing} tickers not found, loaded the rest.` : '');
  }

  async function handleDelete() {
    const name = setName.trim().toLowerCase() || currentLoaded.toLowerCase();
    if (!name || !savedSets[name]) return;
    if (!window.confirm(`Delete compare set "${savedSets[name].name || name}"?`)) return;
    const next = { ...savedSets };
    delete next[name];
    setSavedSets(next);
    await preferencesService.saveCompareSets(next);
    setCurrentLoaded('');
  }

  function handleExport() {
    const count = selected.length;
    if (shouldConfirmLargeExport(count)) {
      const proceed = window.confirm(`You are exporting ${count.toLocaleString()} rows. Continue?`);
      if (!proceed) return;
    }

    // Compute benchmark info for 1Y, matching UI
    const withBench = selected.map(f => {
      const bench = computeBenchmarkDelta(f, funds, '1y') || {};
      return {
        ...f,
        exportDelta1y: bench.delta == null ? '' : bench.delta,
        exportBenchTicker: bench.benchTicker || '',
        exportBenchName: bench.benchName || ''
      };
    });
    const blob = exportCompareCSV({
      funds: withBench,
      metadata: { exportedAt: new Date() }
    });
    const now = new Date();
    const ts = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}`;
    downloadFile(blob, `compare_export_${ts}.csv`, 'text/csv;charset=utf-8');
  }

  return (
    <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 8 }}>
      <div style={{ padding: 16, borderBottom: '1px solid #e5e7eb', display: 'flex', gap: 8, alignItems: 'center' }}>
        <strong>Compare Funds</strong>
        <input
          placeholder="Search symbol or name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }}
        />
        <select onChange={(e) => addFund(options.find(o => (o.Symbol || o.ticker) === e.target.value))} style={{ padding: 8 }}>
          <option value="">Select fund…</option>
          {options.slice(0, 50).map(f => (
            <option key={f.Symbol || f.ticker} value={f.Symbol || f.ticker}>
              {(f.Symbol || f.ticker)} — {(f['Fund Name'] || f.name)}
            </option>
          ))}
        </select>
        {/* Saved sets toolbar */}
        <input
          placeholder="Set name"
          value={setName}
          onChange={(e) => setSetName(e.target.value)}
          style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6, width: 160 }}
        />
        <button
          onClick={handleSave}
          disabled={selected.length === 0 || !setName.trim()}
          className="btn btn-primary"
        >Save</button>
        <select
          value={currentLoaded ? (currentLoaded.toLowerCase()) : ''}
          onChange={(e) => handleLoad(e.target.value)}
          style={{ padding: 8 }}
        >
          <option value="">Load set…</option>
          {Object.entries(savedSets)
            .sort((a,b) => (a[0].localeCompare(b[0])))
            .map(([key, val]) => (
              <option key={key} value={key}>{val?.name || key}</option>
            ))}
        </select>
        <button onClick={handleDelete} className="btn btn-secondary" disabled={!setName.trim() && !currentLoaded}>Delete</button>
        <button
          onClick={handleExport}
          disabled={selected.length === 0}
          className="btn btn-primary"
        >Export CSV</button>
      </div>

      {notice && (
        <div style={{ padding: 8, color: '#6b7280' }}>{notice}</div>
      )}

      {selected.length === 0 ? (
        <div style={{ padding: 24, color: '#6b7280' }}>Select up to 4 funds to compare.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ padding: 12, textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Metric</th>
                {selected.map(f => (
                  <th key={f.Symbol || f.ticker} style={{ padding: 12, textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600 }}>{f.Symbol || f.ticker}</span>
                      <span style={{ color: '#6b7280' }}>{f['Fund Name'] || f.name}</span>
                      <button onClick={() => removeFund(f.Symbol || f.ticker)} style={{ marginLeft: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444' }}>✕</button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metricDefs.map(m => (
                <tr key={m.key}>
                  <td style={{ padding: 12, borderBottom: '1px solid #f3f4f6', fontWeight: 600 }}>{m.label}</td>
                  {selected.map(f => {
                    const val = getValue(f, m.key);
                     const bench = m.key === '1y' ? computeBenchmarkDelta(f, funds, '1y') : null;
                    return (
                      <td key={(f.Symbol || f.ticker) + m.key} style={{ padding: 12, borderBottom: '1px solid #f3f4f6' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                          <div>{m.fmt(val)}</div>
                          {bench && bench.benchTicker && (
                            <div
                              title={`Benchmark: ${bench.benchName} (${bench.benchTicker})\nPeriod: 1-Year Return`}
                              style={{
                                fontSize: 12,
                                backgroundColor: bench.delta != null && bench.delta >= 0 ? '#ecfdf5' : '#fef2f2',
                                color: bench.delta != null && bench.delta >= 0 ? '#065f46' : '#7f1d1d',
                                border: `1px solid ${bench.delta != null && bench.delta >= 0 ? '#a7f3d0' : '#fecaca'}`,
                                borderRadius: 12,
                                padding: '2px 6px'
                              }}
                            >
                              {bench.delta == null ? `vs ${bench.benchTicker}` : `${bench.delta >= 0 ? '+' : ''}${bench.delta.toFixed(2)}% vs ${bench.benchTicker}`}
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ComparisonPanel;

