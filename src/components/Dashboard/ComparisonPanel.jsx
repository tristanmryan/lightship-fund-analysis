// src/components/Dashboard/ComparisonPanel.jsx
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, X, TrendingUp, TrendingDown, Minus, Download, BarChart3 } from 'lucide-react';
import { computeBenchmarkDelta } from './benchmarkUtils';
import { formatPercent, formatNumber } from '../../utils/formatters';
import preferencesService from '../../services/preferencesService';
import { exportCompareCSV, downloadFile, shouldConfirmLargeExport, formatExportFilename } from '../../services/exportService';
import fundService from '../../services/fundService';
import { useFundData } from '../../hooks/useFundData';

const metricDefs = [
  { key: 'scores.final', label: 'Score', tooltip: '0–100 weighted Z-score within asset class', fmt: (v) => (v == null ? '—' : formatNumber(v, 1)) },
  { key: 'ytd', label: 'YTD Return', tooltip: 'Year-to-date total return', fmt: (v) => (v == null ? '—' : formatPercent(v)) },
  { key: '1y', label: '1-Year Return', tooltip: 'Total return over the last 12 months', fmt: (v) => (v == null ? '—' : formatPercent(v)) },
  { key: '3y', label: '3-Year Return', tooltip: 'Annualized return over the last 3 years', fmt: (v) => (v == null ? '—' : formatPercent(v)) },
  { key: '5y', label: '5-Year Return', tooltip: 'Annualized return over the last 5 years', fmt: (v) => (v == null ? '—' : formatPercent(v)) },
  { key: '10y', label: '10-Year Return', tooltip: 'Annualized return over the last 10 years', fmt: (v) => (v == null ? '—' : formatPercent(v)) },
  { key: 'sharpe', label: 'Sharpe Ratio', tooltip: 'Risk-adjusted return: higher is better', fmt: (v) => (v == null ? '—' : formatNumber(v, 2)) },
  { key: 'stdDev3Y', label: 'Std Dev (3Y)', tooltip: 'Volatility (3-year): lower is better', fmt: (v) => (v == null ? '—' : formatPercent(v, 2)) },
  { key: 'stdDev5Y', label: 'Std Dev (5Y)', tooltip: 'Volatility (5-year): lower is better', fmt: (v) => (v == null ? '—' : formatPercent(v, 2)) },
  { key: 'expense', label: 'Expense Ratio', tooltip: 'Annual fund costs: lower is better', fmt: (v) => (v == null ? '—' : formatPercent(v)) },
  { key: 'alpha', label: 'Alpha', tooltip: 'Excess return vs benchmark', fmt: (v) => (v == null ? '—' : formatNumber(v, 2)) },
  { key: 'beta', label: 'Beta', tooltip: 'Market sensitivity: 1.0 ≈ market risk', fmt: (v) => (v == null ? '—' : formatNumber(v, 2)) },
  { key: 'upCapture', label: 'Up Capture (3Y)', tooltip: 'Capture in up markets: higher is better', fmt: (v) => (v == null ? '—' : formatPercent(v, 1)) },
  { key: 'downCapture', label: 'Down Capture (3Y)', tooltip: 'Capture in down markets: lower is better', fmt: (v) => (v == null ? '—' : formatPercent(v, 1)) }
];

function getValue(fund, key) {
  switch (key) {
    case 'scores.final': return fund?.scores?.final ?? fund?.score_final ?? fund?.score ?? null;
    case 'ytd': return fund?.ytd_return ?? null;
    case '1y': return fund?.one_year_return ?? null;
    case '3y': return fund?.three_year_return ?? null;
    case '5y': return fund?.five_year_return ?? null;
    case '10y': return fund?.ten_year_return ?? null;
    case 'sharpe': return fund?.sharpe_ratio ?? null;
    case 'expense': return fund?.expense_ratio ?? null;
    case 'alpha': return fund?.alpha ?? null;
    case 'stdDev3Y': return fund?.standard_deviation_3y ?? fund?.standard_deviation ?? null;
    case 'stdDev5Y': return fund?.standard_deviation_5y ?? null;
    case 'beta': return fund?.beta ?? null;
    case 'upCapture': return fund?.up_capture_ratio ?? null;
    case 'downCapture': return fund?.down_capture_ratio ?? null;
    default: return null;
  }
}

// Delta formatting with visual indicators
function formatDelta(value, type = 'percent') {
  if (value == null) return '—';
  
  const isPositive = value >= 0;
  const icon = isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />;
  const color = isPositive ? '#16a34a' : '#dc2626';
  const formatted = type === 'percent' ? formatPercent(Math.abs(value)) : formatNumber(Math.abs(value), 2);
  
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4, color }}>
      {icon}
      {isPositive ? '+' : '-'}{formatted}
    </span>
  );
}

const ComparisonPanel = ({ funds = [], initialSavedSets = null }) => {
  const { asOfMonth } = useFundData();
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState('');
  const [setName, setSetName] = useState('');
  const [savedSets, setSavedSets] = useState({});
  const [currentLoaded, setCurrentLoaded] = useState('');
  const [notice, setNotice] = useState('');
  const [compareData, setCompareData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedBenchmark, setSelectedBenchmark] = useState(null);
  const [availableBenchmarks, setAvailableBenchmarks] = useState([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchContainerRef = useRef(null);

  // Click outside handler for search dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setShowSearchDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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

  // Load available benchmarks
  useEffect(() => {
    const loadBenchmarks = async () => {
      try {
        const data = await fundService.getAllBenchmarks();
        setAvailableBenchmarks(data || []);
      } catch (error) {
        console.error('Failed to load benchmarks:', error);
      }
    };
    loadBenchmarks();
  }, []);

  // Enhanced options that include both funds and benchmarks
  const options = useMemo(() => {
    const needle = search.trim().toLowerCase();
    
    // Filter funds
    const fundOptions = (funds || []).filter(f => {
      if (!needle) return true;
      const sym = (f.Symbol || f.ticker || '').toLowerCase();
      const name = (f['Fund Name'] || f.name || '').toLowerCase();
      return sym.includes(needle) || name.includes(needle);
    }).map(f => ({
      ...f,
      type: 'fund',
      ticker: f.Symbol || f.ticker,
      displayName: f['Fund Name'] || f.name
    }));

    // Filter benchmarks
    const benchmarkOptions = availableBenchmarks.filter(b => {
      if (!needle) return true;
      const sym = (b.ticker || '').toLowerCase();
      const name = (b.name || '').toLowerCase();
      return sym.includes(needle) || name.includes(needle);
    }).map(b => ({
      ...b,
      type: 'benchmark',
      displayName: b.name
    }));

    return [...fundOptions, ...benchmarkOptions];
  }, [funds, availableBenchmarks, search]);

  // Fetch comparison data using enhanced RPC
  const fetchCompareData = async (tickers) => {
    if (!tickers || tickers.length === 0) {
      setCompareData([]);
      return;
    }

    setLoading(true);
    try {
      const asOf = asOfMonth || null;
      const data = await fundService.getCompareDataset(asOf, tickers, selectedBenchmark);
      setCompareData(data || []);
    } catch (error) {
      console.error('Failed to fetch compare data:', error);
      setNotice('Failed to load comparison data');
      setCompareData([]);
    } finally {
      setLoading(false);
    }
  };

  // Update comparison data when selections change
  useEffect(() => {
    const tickers = selected.map(s => s.ticker || s.Symbol).filter(Boolean);
    fetchCompareData(tickers);
  }, [selected, asOfMonth, selectedBenchmark]);

  // Allow external deep-link to seed selection via event { tickers: [] }
  useEffect(() => {
    const handler = (ev) => {
      try {
        const tickers = Array.isArray(ev?.detail?.tickers) ? ev.detail.tickers.map(t => String(t).toUpperCase()) : [];
        if (tickers.length === 0) return;
        const found = (funds || []).filter(f => tickers.includes(getTicker(f))).slice(0, 4);
        if (found.length > 0) setSelected(found);
      } catch {}
    };
    window.addEventListener('LOAD_COMPARE_SELECTION', handler);
    return () => window.removeEventListener('LOAD_COMPARE_SELECTION', handler);
  }, [funds]);

  const addItem = (item) => {
    if (!item) return;
    const ticker = item.ticker || item.Symbol;
    if (selected.find(s => (s.ticker || s.Symbol) === ticker)) return;
    if (selected.length >= 4) {
      setNotice('Maximum 4 items can be compared at once');
      return;
    }
    setSelected(prev => [...prev, item]);
    setNotice('');
  };

  const removeItem = (ticker) => {
    setSelected(prev => prev.filter(f => (f.ticker || f.Symbol) !== ticker));
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
    setNotice(existing ? `Updated set "${name}".` : `Saved set "${name}".`);
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
    setSetName('');
    setNotice(`Deleted set "${savedSets[name]?.name || name}".`);
  }

  function handleExport(format = 'csv') {
    const count = compareData.length || selected.length;
    if (shouldConfirmLargeExport(count)) {
      const proceed = window.confirm(`You are exporting ${count.toLocaleString()} rows. Continue?`);
      if (!proceed) return;
    }

    const exportData = compareData.length > 0 ? compareData : selected;
    const metadata = {
      exportedAt: new Date(),
      asOfDate: asOfMonth,
      benchmarkTicker: selectedBenchmark
    };

    // PDF export disabled in minimal system; only CSV available
    handleCSVExport(exportData, metadata);
  }

  function handleCSVExport(data, metadata) {
    const blob = exportCompareCSV({
      funds: data,
      metadata
    });
    const filename = formatExportFilename({ scope: 'compare', ext: 'csv' });
    downloadFile(blob, filename, 'text/csv;charset=utf-8');
  }

  // PDF export removed in minimal system

  return (
    <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 8 }} data-compare-export>
      {/* Header */}
      <div style={{ padding: 16, borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#1f2937' }}>
              <BarChart3 size={20} style={{ marginRight: 8, verticalAlign: 'middle' }} />
              Compare Funds & Benchmarks
            </h2>
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#6b7280' }}>
                <div style={{ width: 16, height: 16, border: '2px solid #e5e7eb', borderTop: '2px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                Loading...
              </div>
            )}
          </div>
          <button 
            onClick={() => setShowAdvanced(!showAdvanced)}
            style={{ 
              padding: '6px 12px', 
              fontSize: '0.875rem', 
              color: '#6b7280', 
              border: '1px solid #d1d5db', 
              borderRadius: 6, 
              background: 'white', 
              cursor: 'pointer' 
            }}
          >
            {showAdvanced ? 'Hide' : 'Show'} Advanced
          </button>
        </div>

        {currentLoaded && (
          <div style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: 12 }}>
            Loaded set: <strong>{currentLoaded}</strong>
          </div>
        )}

        {/* Search and Selection */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }} ref={searchContainerRef}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
            <input
              placeholder="Search funds and benchmarks..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setShowSearchDropdown(e.target.value.trim().length > 0);
              }}
              onFocus={() => setShowSearchDropdown(search.trim().length > 0)}
              style={{ 
                width: '100%', 
                padding: '8px 8px 8px 36px', 
                border: '1px solid #d1d5db', 
                borderRadius: 6,
                fontSize: '0.875rem'
              }}
            />
            {/* Search Results Dropdown */}
            {showSearchDropdown && search.trim() && options.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                background: 'white',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                maxHeight: 200,
                overflowY: 'auto',
                zIndex: 1000,
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}>
                {options.slice(0, 20).map((item, index) => {
                  const ticker = item.ticker || item.Symbol;
                  const name = item.displayName || item['Fund Name'] || item.name;
                  const isBenchmark = item.type === 'benchmark' || item.is_benchmark;
                  
                  return (
                    <div
                      key={ticker + index}
                      onClick={() => {
                        addItem(item);
                        setSearch('');
                        setShowSearchDropdown(false);
                      }}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        borderBottom: '1px solid #f3f4f6',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        background: index % 2 === 0 ? 'white' : '#f9fafb'
                      }}
                      onMouseEnter={(e) => e.target.style.background = '#f3f4f6'}
                      onMouseLeave={(e) => e.target.style.background = index % 2 === 0 ? 'white' : '#f9fafb'}
                    >
                      <span style={{ 
                        fontWeight: 600, 
                        color: isBenchmark ? '#f59e0b' : '#3b82f6',
                        minWidth: 60
                      }}>
                        {ticker}
                      </span>
                      <span style={{ 
                        fontSize: '0.75rem',
                        background: isBenchmark ? '#fef3c7' : '#dbeafe',
                        color: isBenchmark ? '#92400e' : '#1e40af',
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontWeight: 500
                      }}>
                        {isBenchmark ? 'BM' : 'FUND'}
                      </span>
                      <span style={{ 
                        color: '#6b7280',
                        fontSize: '0.875rem',
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {name}
                      </span>
                    </div>
                  );
                })}
                {options.length > 20 && (
                  <div style={{
                    padding: '8px 12px',
                    textAlign: 'center',
                    color: '#6b7280',
                    fontSize: '0.75rem',
                    background: '#f9fafb',
                    borderTop: '1px solid #e5e7eb'
                  }}>
                    Showing first 20 results. Refine your search for more.
                  </div>
                )}
              </div>
            )}
          </div>
          <select 
            onChange={(e) => {
              const item = options.find(o => (o.ticker || o.Symbol) === e.target.value);
              if (item) addItem(item);
              e.target.value = '';
            }} 
            style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.875rem', minWidth: 200 }}
          >
            <option value="">Select item...</option>
            {options.slice(0, 50).map(item => (
              <option key={item.ticker || item.Symbol} value={item.ticker || item.Symbol}>
                [{item.type === 'benchmark' ? 'BM' : 'FUND'}] {item.ticker || item.Symbol} — {item.displayName}
              </option>
            ))}
          </select>
        </div>

        {/* Advanced Options */}
        {showAdvanced && (
          <div style={{ marginTop: 16, padding: 16, background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: 4 }}>
                  Comparison Benchmark
                </label>
                <select
                  value={selectedBenchmark || ''}
                  onChange={(e) => setSelectedBenchmark(e.target.value || null)}
                  style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem' }}
                >
                  <option value="">Use asset class primary</option>
                  {availableBenchmarks.map(b => (
                    <option key={b.ticker} value={b.ticker}>{b.ticker} - {b.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
        {/* Saved sets toolbar */}
        <div style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            placeholder="Set name"
            value={setName}
            onChange={(e) => setSetName(e.target.value)}
            style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', width: 160 }}
          />
          <button
            onClick={handleSave}
            disabled={selected.length === 0 || !setName.trim()}
            style={{ 
              padding: '6px 12px', 
              backgroundColor: selected.length > 0 && setName.trim() ? '#3b82f6' : '#9ca3af',
              color: 'white', 
              border: 'none', 
              borderRadius: 4, 
              fontSize: '0.875rem',
              cursor: selected.length > 0 && setName.trim() ? 'pointer' : 'not-allowed'
            }}
          >Save</button>
          <select
            value={currentLoaded ? (currentLoaded.toLowerCase()) : ''}
            onChange={(e) => handleLoad(e.target.value)}
            style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem' }}
          >
            <option value="">Load set…</option>
            {Object.entries(savedSets)
              .sort((a,b) => {
                const an = a[1]?.name || a[0];
                const bn = b[1]?.name || b[0];
                return an.localeCompare(bn);
              })
              .map(([key, val]) => (
                <option key={key} value={key}>{val?.name || key}</option>
              ))}
          </select>
          <button 
            onClick={handleDelete} 
            disabled={!setName.trim() && !currentLoaded}
            style={{ 
              padding: '6px 12px', 
              backgroundColor: setName.trim() || currentLoaded ? '#dc2626' : '#9ca3af',
              color: 'white', 
              border: 'none', 
              borderRadius: 4, 
              fontSize: '0.875rem',
              cursor: setName.trim() || currentLoaded ? 'pointer' : 'not-allowed'
            }}
          >Delete</button>
          <button 
            onClick={() => { setSelected([]); setNotice('Selection cleared.'); }} 
            disabled={selected.length === 0}
            style={{ 
              padding: '6px 12px', 
              backgroundColor: selected.length > 0 ? '#6b7280' : '#9ca3af',
              color: 'white', 
              border: 'none', 
              borderRadius: 4, 
              fontSize: '0.875rem',
              cursor: selected.length > 0 ? 'pointer' : 'not-allowed'
            }}
          >Clear</button>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => handleExport('csv')}
              disabled={selected.length === 0}
              style={{ 
                padding: '6px 12px', 
                backgroundColor: selected.length > 0 ? '#059669' : '#9ca3af',
                color: 'white', 
                border: 'none', 
                borderRadius: 4, 
                fontSize: '0.875rem',
                cursor: selected.length > 0 ? 'pointer' : 'not-allowed',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              <Download size={14} />
              CSV
            </button>
            {/* PDF button removed in minimal system */}
          </div>
        </div>
      </div>

      {/* Selected Items Display */}
      {selected.length > 0 && (
        <div style={{ padding: 16, borderBottom: '1px solid #e5e7eb', background: '#f8fafc' }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: 8 }}>
            Selected for Comparison ({selected.length}/4)
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {selected.map(item => {
              const ticker = item.ticker || item.Symbol;
              const name = item.displayName || item['Fund Name'] || item.name;
              const isBenchmark = item.type === 'benchmark' || item.is_benchmark;
              return (
                <div 
                  key={ticker}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 6,
                    padding: '6px 10px',
                    background: isBenchmark ? '#fef3c7' : '#dbeafe',
                    border: `1px solid ${isBenchmark ? '#f59e0b' : '#3b82f6'}`,
                    borderRadius: 16,
                    fontSize: '0.875rem'
                  }}
                >
                  <span style={{ fontWeight: 500 }}>{ticker}</span>
                  <span style={{ color: '#6b7280' }}>({isBenchmark ? 'Benchmark' : 'Fund'})</span>
                  <button
                    onClick={() => removeItem(ticker)}
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      cursor: 'pointer', 
                      color: '#6b7280',
                      display: 'flex',
                      alignItems: 'center',
                      padding: 2
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {notice && (
        <div style={{ padding: 8, color: '#6b7280' }}>{notice}</div>
      )}

      {selected.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>
          <BarChart3 size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
          <div style={{ fontSize: '1.125rem', fontWeight: 500, marginBottom: 8 }}>Select items to compare</div>
          <div style={{ fontSize: '0.875rem' }}>Choose up to 4 funds and benchmarks to compare side-by-side</div>
        </div>
      ) : compareData.length === 0 && !loading ? (
        <div style={{ padding: 24, textAlign: 'center', color: '#dc2626' }}>
          <div style={{ fontSize: '1.125rem', fontWeight: 500, marginBottom: 8 }}>No data available</div>
          <div style={{ fontSize: '0.875rem' }}>Unable to load comparison data for the selected items</div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ 
                  padding: '12px 16px', 
                  textAlign: 'left', 
                  borderBottom: '2px solid #e5e7eb',
                  fontWeight: 600,
                  color: '#374151',
                  position: 'sticky',
                  left: 0,
                  background: '#f8fafc',
                  zIndex: 1
                }}>
                  Metric
                </th>
                {(compareData.length > 0 ? compareData : selected).map((item, index) => {
                  const ticker = item.ticker || item.Symbol;
                  const name = item.name || item.displayName || item['Fund Name'];
                  const isBenchmark = item.is_benchmark || item.type === 'benchmark';
                  
                  return (
                    <th key={ticker + index} style={{ 
                      padding: '12px 16px', 
                      textAlign: 'left', 
                      borderBottom: '2px solid #e5e7eb',
                      minWidth: 160
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ 
                            fontWeight: 600, 
                            color: isBenchmark ? '#f59e0b' : '#3b82f6' 
                          }}>
                            {ticker}
                          </span>
                          {isBenchmark && (
                            <span style={{ 
                              fontSize: '0.75rem',
                              background: '#fef3c7',
                              color: '#92400e',
                              padding: '2px 6px',
                              borderRadius: 4,
                              fontWeight: 500
                            }}>
                              BM
                            </span>
                          )}
                        </div>
                        <div style={{ 
                          fontSize: '0.75rem', 
                          color: '#6b7280',
                          fontWeight: 400,
                          lineHeight: 1.2,
                          maxWidth: 140,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {name}
                        </div>
                        {item.asset_class && (
                          <div style={{ 
                            fontSize: '0.75rem', 
                            color: '#9ca3af',
                            fontWeight: 400
                          }}>
                            {item.asset_class}
                          </div>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {metricDefs.map((m, metricIndex) => (
                <tr key={m.key} style={{ 
                  background: metricIndex % 2 === 0 ? 'white' : '#fafbfc'
                }}>
                  <td style={{ 
                    padding: '12px 16px', 
                    borderBottom: '1px solid #f3f4f6', 
                    fontWeight: 600,
                    color: '#374151',
                    position: 'sticky',
                    left: 0,
                    background: metricIndex % 2 === 0 ? 'white' : '#fafbfc',
                    zIndex: 1
                  }}>
                    <div title={m.tooltip}>{m.label}</div>
                  </td>
                  {(compareData.length > 0 ? compareData : selected).map((item, index) => {
                    const ticker = item.ticker || item.Symbol;
                    const val = getValue(item, m.key);
                    
                    // Get delta values for return metrics
                    let deltaValue = null;
                    if (m.key === 'ytd' && item.delta_ytd != null) deltaValue = item.delta_ytd;
                    else if (m.key === '1y' && item.delta_1y != null) deltaValue = item.delta_1y;
                    else if (m.key === '3y' && item.delta_3y != null) deltaValue = item.delta_3y;
                    else if (m.key === '5y' && item.delta_5y != null) deltaValue = item.delta_5y;
                    
                    return (
                      <td key={ticker + m.key + index} style={{ 
                        padding: '12px 16px', 
                        borderBottom: '1px solid #f3f4f6',
                        verticalAlign: 'top'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ fontWeight: 500, color: '#1f2937' }}>
                            {m.fmt(val)}
                          </div>
                          {deltaValue != null && item.benchmark_ticker && !item.is_benchmark && (
                            <div
                              title={`vs ${item.benchmark_name || item.benchmark_ticker}: ${deltaValue >= 0 ? '+' : ''}${deltaValue.toFixed(2)}%`}
                              style={{
                                fontSize: '0.75rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                color: deltaValue >= 0 ? '#059669' : '#dc2626',
                                background: deltaValue >= 0 ? '#ecfdf5' : '#fef2f2',
                                border: `1px solid ${deltaValue >= 0 ? '#a7f3d0' : '#fecaca'}`,
                                borderRadius: 4,
                                padding: '2px 6px',
                                fontWeight: 500
                              }}
                            >
                              {deltaValue >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                              {deltaValue >= 0 ? '+' : ''}{deltaValue.toFixed(2)}%
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

