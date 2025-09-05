// src/components/Dashboard/EnhancedPerformanceDashboard.jsx
import React, { useState, useMemo, useCallback } from 'react';
import { 
  TrendingUp, BarChart3, Grid, Table, RefreshCw, Download,
  Filter, Target, AlertCircle, Info, Share2
} from 'lucide-react';
import StatusIcon from '../common/StatusIcon';
import AdvancedFilters from './AdvancedFilters';
import ProfessionalTable from '../tables/ProfessionalTable';
import ScoreTooltip from './ScoreTooltip';
import PerformanceHeatmap from './PerformanceHeatmap';
import TopBottomPerformers from './TopBottomPerformers';
import AssetClassOverview from './AssetClassOverview';
import FundDetailsModal from '../FundDetailsModal';
import ComparisonPanel from './ComparisonPanel';
import DrilldownCards from './DrilldownCards';
import preferencesService from '../../services/preferencesService';
import fundService from '../../services/fundService';
import { generatePDFReport, downloadFile, downloadPDF, exportToExcel, formatExportFilename, exportElementToPNG, copyElementPNGToClipboard, exportCurrentView } from '../../services/exportService.js';

const DEFAULT_FILTERS = {
  search: '',
  assetClasses: [],
  performanceRank: null,
  expenseRatioMax: null,
  sharpeRatioMin: null,
  betaMax: null,
  timePerformance: { period: null, minReturn: null, maxReturn: null },
  scoreRange: { min: null, max: null },
  isRecommended: null
};

function sanitizeViewDefaults(view) {
  if (!view || typeof view !== 'object') return { filters: { ...DEFAULT_FILTERS } };
  const safeFilters = {
    ...DEFAULT_FILTERS,
    ...(view.filters || {}),
    assetClasses: Array.isArray(view?.filters?.assetClasses) ? view.filters.assetClasses : [],
    timePerformance: { ...DEFAULT_FILTERS.timePerformance, ...(view?.filters?.timePerformance || {}) },
    scoreRange: { ...DEFAULT_FILTERS.scoreRange, ...(view?.filters?.scoreRange || {}) }
  };
  return { ...view, filters: safeFilters };
}

function sanitizeTableState(saved, validColumnKeys, defaultSelected) {
  const selected = Array.isArray(saved?.selectedColumns) ? saved.selectedColumns : defaultSelected;
  const filteredSelected = (selected || []).filter((k) => validColumnKeys.includes(k));
  const safeSelected = filteredSelected.length ? filteredSelected : defaultSelected;
  const sort = Array.isArray(saved?.sortConfig) ? saved.sortConfig : [];
  const safeSort = sort.filter((s) => s && validColumnKeys.includes(s.key) && (s.direction === 'asc' || s.direction === 'desc'));
  return { selectedColumns: safeSelected, sortConfig: safeSort };
}

/**
 * Enhanced Performance Dashboard
 * Comprehensive dashboard with advanced filtering and multiple view modes
 */
const EnhancedPerformanceDashboard = ({ funds, onRefresh, isLoading = false, asOfMonth: asOfMonthProp = '', onAsOfMonthChange = null }) => {
  // State management
  const [filteredFunds, setFilteredFunds] = useState(funds || []);
  const [activeFilters, setActiveFilters] = useState({});
  const [viewMode, setViewMode] = useState('table'); // 'table', 'heatmap', 'overview', 'performers', 'compare'
  const [selectedFund, setSelectedFund] = useState(null);
  const [chartPeriod, setChartPeriod] = useState('1Y'); // '1M','3M','6M','1Y','YTD'
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [initialFilters, setInitialFilters] = useState(null);
  const [initialTableState, setInitialTableState] = useState({ sortConfig: null, selectedColumns: null });
  const [tableState, setTableState] = useState({ sortConfig: null, selectedColumns: null });
  const tableExportRef = React.useRef(null);
  const clearAllFiltersRef = React.useRef(null);
  const [availableMonths, setAvailableMonths] = useState([]);
  const [showNonEom, setShowNonEom] = useState(false);
  const [allMonths, setAllMonths] = useState([]);
  const [nonEomSample, setNonEomSample] = useState(null);
  const ENABLE_REFRESH = (process.env.REACT_APP_ENABLE_REFRESH || 'false') === 'true';
  const [guard, setGuard] = useState({ fund: null, bench: null });
  // Data Health badge based on filtered set coverage
  const dataHealth = useMemo(() => {
    const total = (filteredFunds || []).length;
    const nz = (arr) => arr.filter(v => v != null && !Number.isNaN(v)).length;
    const ytd = nz((filteredFunds || []).map(f => f.ytd_return));
    const oneY = nz((filteredFunds || []).map(f => f.one_year_return));
    const sharpe = nz((filteredFunds || []).map(f => f.sharpe_ratio));
    const sd3 = nz((filteredFunds || []).map(f => (f.standard_deviation_3y ?? f.standard_deviation)));
    const covs = [ytd, oneY, sharpe, sd3].map(n => total ? Math.round((n / total) * 100) : 0);
    const minCov = covs.length ? Math.min(...covs) : 0;
    const label = minCov >= 80 ? 'Good' : minCov >= 50 ? 'Fair' : 'Poor';
    const color = minCov >= 80 ? '#16a34a' : minCov >= 50 ? '#f59e0b' : '#dc2626';
    return { minCov, label, color };
  }, [filteredFunds]);

  // Load saved view defaults on mount
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const defaults = sanitizeViewDefaults(await preferencesService.getViewDefaults());
        const months = await fundService.listSnapshotMonths();
        if (cancelled) return;
        if (defaults) {
          setInitialFilters(defaults.filters || null);
          setInitialTableState({
            sortConfig: defaults.table?.sortConfig || null,
            selectedColumns: defaults.table?.selectedColumns || null
          });
          if (defaults.chartPeriod && ['1M','3M','6M','1Y','YTD'].includes(defaults.chartPeriod)) {
            setChartPeriod(defaults.chartPeriod);
          }
          if (defaults.asOfMonth && typeof defaults.asOfMonth === 'string' && typeof onAsOfMonthChange === 'function') {
            onAsOfMonthChange(defaults.asOfMonth);
          }
        }
        // Filter EOM by default
        const onlyEom = (months || []).filter((d) => {
          try {
            const dt = new Date(d + 'T00:00:00Z');
            const end = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0));
            return dt.getUTCDate() === end.getUTCDate();
          } catch { return false; }
        });
        setAllMonths(months || []);
        setAvailableMonths(onlyEom);
        const firstNonEom = (months || []).find((d) => {
          try {
            const dt = new Date(d + 'T00:00:00Z');
            const end = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0));
            return dt.getUTCDate() !== end.getUTCDate();
          } catch { return false; }
        });
        setNonEomSample(firstNonEom || null);
        // Initialize global endDate for sparklines
        window.__AS_OF_MONTH__ = (asOfMonthProp || '') || null;
      } catch {}
      if (!cancelled) setInitialized(true);
    })();
    return () => { cancelled = true; };
  }, [asOfMonthProp, onAsOfMonthChange]);

  // Skeleton loading states for key sections
  const isLoadingAny = isLoading || !initialized;
  const Skeleton = ({ height = 140 }) => (
    <div style={{ background:'#f3f4f6', borderRadius:8, height, width:'100%', animation:'pulse 1.2s ease-in-out infinite' }} />
  );
  const SectionSkeleton = () => (
    <div className="card">
      <div className="card-header">
        <div className="card-title" style={{ opacity: 0.6 }}>Loading…</div>
      </div>
      <Skeleton height={180} />
    </div>
  );

  // Note: render skeleton within main return to preserve hook order

  // Guardrails: when month changes, refresh counts (dev-only hint; safe if fails)
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!asOfMonthProp) return;
        const d = asOfMonthProp;
        const { supabase, TABLES } = await import('../../services/supabase');
        const [{ data: fRows }, { data: bRows }] = await Promise.all([
          supabase.from(TABLES.FUND_PERFORMANCE).select('fund_ticker').eq('date', d),
          supabase.from(TABLES.BENCHMARK_PERFORMANCE).select('benchmark_ticker').eq('date', d)
        ]);
        if (!cancelled) setGuard({ fund: (fRows || []).length, bench: (bRows || []).length });
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [asOfMonthProp]);

  // Handle filter changes
  const handleFilterChange = useCallback((filtered, filters) => {
    setFilteredFunds(filtered);
    setActiveFilters(filters);
  }, []);

  // Persist view defaults when filters or table state change
  const handleTableStateChange = useCallback(async (state) => {
    setTableState(state);
    try {
      await preferencesService.saveViewDefaults({
        filters: activeFilters,
        table: {
          sortConfig: state.sortConfig,
          selectedColumns: state.selectedColumns
        },
        chartPeriod,
        asOfMonth: asOfMonthProp
      });
    } catch {}
  }, [activeFilters, chartPeriod, asOfMonthProp]);

  // Persist when filters change too
  React.useEffect(() => {
    if (!initialized) return;
    (async () => {
      try {
        await preferencesService.saveViewDefaults({
          filters: activeFilters,
          table: {
            sortConfig: tableState.sortConfig,
            selectedColumns: tableState.selectedColumns
          },
          chartPeriod,
          asOfMonth: asOfMonthProp
        });
      } catch {}
    })();
  }, [activeFilters, initialized, tableState, chartPeriod, asOfMonthProp]);

  // Persist when chartPeriod changes independently
  React.useEffect(() => {
    if (!initialized) return;
    (async () => {
      try {
        await preferencesService.saveViewDefaults({
          filters: activeFilters,
          table: {
            sortConfig: tableState.sortConfig,
            selectedColumns: tableState.selectedColumns
          },
          chartPeriod,
          asOfMonth: asOfMonthProp
        });
      } catch {}
    })();
  }, [chartPeriod, initialized, activeFilters, tableState, asOfMonthProp]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    if (!filteredFunds || filteredFunds.length === 0) {
      return {
        totalFunds: 0,
        recommendedFunds: 0,
        averageScore: 0,
        averageYTD: 0,
        averageExpenseRatio: 0,
        topPerformer: null,
        assetClassCount: 0
      };
    }

    const scores = filteredFunds.map(f => f.scores?.final || f.score || 0);
    const ytdReturns = filteredFunds.map(f => f['Total Return - YTD (%)'] || f.ytd_return || 0);
    const expenseRatios = filteredFunds.map(f => f['Net Exp Ratio (%)'] || f.expense_ratio || 0);
    const recommendedCount = filteredFunds.filter(f => f.is_recommended || f.recommended).length;
    const assetClasses = new Set(
      filteredFunds.map(f => {
        const label = f.asset_class_name || f.asset_class || f['Asset Class'] || '';
        return (!f.asset_class_id && !label) ? 'Unknown' : label;
      }).filter(Boolean)
    );
    
    const topPerformer = filteredFunds.reduce((top, fund) => {
      const score = fund.scores?.final || fund.score || 0;
      const topScore = top?.scores?.final || top?.score || 0;
      return score > topScore ? fund : top;
    }, null);

    return {
      totalFunds: filteredFunds.length,
      recommendedFunds: recommendedCount,
      averageScore: scores.reduce((sum, score) => sum + score, 0) / scores.length,
      averageYTD: ytdReturns.reduce((sum, ret) => sum + ret, 0) / ytdReturns.length,
      averageExpenseRatio: expenseRatios.reduce((sum, ratio) => sum + ratio, 0) / expenseRatios.length,
      topPerformer,
      assetClassCount: assetClasses.size
    };
  }, [filteredFunds]);

  // Handle fund selection
  const handleFundSelect = useCallback((fund) => {
    setSelectedFund(fund);
    setShowDetailsModal(false);
    setViewMode('details');
  }, []);

  // Column presets for progressive disclosure
  const COLUMN_PRESETS = {
    core: {
      name: 'Core',
      description: '7 essential columns',
      columns: ['symbol', 'name', 'assetClass', 'score', 'ytdReturn', 'expenseRatio', 'recommended']
    },
    extended: {
      name: 'Extended', 
      description: '12 key columns',
      columns: ['symbol', 'name', 'assetClass', 'score', 'ytdReturn', 'expenseRatio', 'recommended', 'oneYearReturn', 'threeYearReturn', 'sharpeRatio', 'beta', 'sparkline']
    },
    all: {
      name: 'All',
      description: 'Show all available columns', 
      columns: null // null means show all VALID_COLUMN_KEYS
    }
  };

  // Valid table column keys and defaults (must match EnhancedFundTable)
  const DEFAULT_TABLE_COLUMNS = [
    'symbol', 'name', 'assetClass', 'score', 'ytdReturn', 'oneYearReturn',
    'threeYearReturn', 'expenseRatio', 'sharpeRatio', 'recommended'
  ];

  // This list should align with EnhancedFundTable's definitions
  const VALID_COLUMN_KEYS = [
    'symbol','name','assetClass','score','ytdReturn','oneYearReturn','threeYearReturn','fiveYearReturn',
    'sparkline','expenseRatio','sharpeRatio','beta','standardDeviation','upCaptureRatio','downCaptureRatio',
    'managerTenure','recommended'
  ];

  // Column preset state
  const [selectedPreset, setSelectedPreset] = useState(() => {
    const saved = localStorage.getItem('fundTablePreset');
    return (saved && Object.keys(COLUMN_PRESETS).includes(saved)) ? saved : 'core';
  });

  const ENABLE_VISUAL_REFRESH = (process.env.REACT_APP_ENABLE_VISUAL_REFRESH || 'false') === 'true';

  // Loading state for preset changes
  const [presetLoading, setPresetLoading] = useState(false);

  // Sync preset with table state when columns change externally 
  React.useEffect(() => {
    if (!tableState.selectedColumns) return;
    
    // Check if current columns match any preset
    for (const [key, preset] of Object.entries(COLUMN_PRESETS)) {
      const presetColumns = preset.columns === null ? VALID_COLUMN_KEYS : preset.columns;
      if (JSON.stringify(tableState.selectedColumns.sort()) === JSON.stringify(presetColumns.sort())) {
        if (selectedPreset !== key) {
          setSelectedPreset(key);
          localStorage.setItem('fundTablePreset', key);
        }
        return;
      }
    }
    
    // If no preset matches, set to custom (or keep current if not changing)
    // This handles cases where user manually changes columns
  }, [tableState.selectedColumns, selectedPreset]);

  // Get columns for current preset
  const getPresetColumns = useCallback((preset) => {
    const presetConfig = COLUMN_PRESETS[preset];
    if (!presetConfig) return DEFAULT_TABLE_COLUMNS;
    if (presetConfig.columns === null) return VALID_COLUMN_KEYS; // 'all' preset
    return presetConfig.columns.filter(col => VALID_COLUMN_KEYS.includes(col));
  }, []);

  // Handle preset change with smooth loading animation
  const handlePresetChange = useCallback(async (preset) => {
    if (presetLoading) return; // Prevent multiple simultaneous changes
    
    setPresetLoading(true);
    
    // Small delay to show loading state and allow CSS transitions
    await new Promise(resolve => setTimeout(resolve, 150));
    
    setSelectedPreset(preset);
    localStorage.setItem('fundTablePreset', preset);
    
    // Update selected columns based on preset
    const newColumns = getPresetColumns(preset);
    const newState = { ...tableState, selectedColumns: newColumns };
    setTableState(newState);
    
    // Notify parent of state change for persistence
    if (typeof handleTableStateChange === 'function') {
      handleTableStateChange(newState);
    }
    
    // Allow animation to complete before clearing loading
    setTimeout(() => setPresetLoading(false), 200);
  }, [getPresetColumns, tableState, handleTableStateChange, presetLoading]);

  // Render view mode content
  const renderViewContent = () => {
    switch (viewMode) {
      case 'table':
        // Use preset columns if no initial columns are set, otherwise use saved state
        const effectiveColumns = initialTableState.selectedColumns || getPresetColumns(selectedPreset);
        const sanitized = sanitizeTableState(
          { sortConfig: initialTableState.sortConfig, selectedColumns: effectiveColumns },
          VALID_COLUMN_KEYS,
          DEFAULT_TABLE_COLUMNS
        );
        
        // Create preset selector component to pass to table
        const presetSelectorComponent = ENABLE_VISUAL_REFRESH ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{
              fontSize: '0.875rem',
              fontWeight: '600',
              color: '#374151',
              whiteSpace: 'nowrap'
            }}>Presets:</span>
            <div style={{ display: 'flex', gap: '0.375rem' }}>
              {Object.entries(COLUMN_PRESETS).map(([key, preset]) => {
                const isActive = selectedPreset === key;
                const isLoading = presetLoading && isActive;
                
                return (
                  <button
                    key={key}
                    onClick={() => handlePresetChange(key)}
                    disabled={presetLoading}
                    style={{
                      padding: '0.375rem 0.75rem',
                      border: isActive ? '2px solid #3b82f6' : '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      backgroundColor: isActive ? '#eff6ff' : 'white',
                      color: isActive ? '#3b82f6' : '#374151',
                      fontSize: '0.8125rem',
                      fontWeight: isActive ? '600' : '500',
                      cursor: presetLoading ? 'wait' : 'pointer',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      position: 'relative',
                      opacity: presetLoading && !isActive ? 0.6 : 1,
                      transform: isLoading ? 'scale(0.98)' : 'scale(1)',
                      whiteSpace: 'nowrap',
                      minWidth: '60px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title={`${preset.description} (${preset.columns ? preset.columns.length : VALID_COLUMN_KEYS.length} columns)`}
                  >
                    {isLoading ? (
                      <div style={{
                        width: '14px',
                        height: '14px',
                        border: '2px solid #3b82f6',
                        borderTop: '2px solid transparent',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }} />
                    ) : (
                      <>
                        <span>{preset.name}</span>
                        <span style={{
                          fontSize: '0.6875rem',
                          opacity: 0.7,
                          marginLeft: '0.25rem'
                        }}>
                          ({preset.columns ? preset.columns.length : VALID_COLUMN_KEYS.length})
                        </span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null;
        
        // Simple professional table (Phase 4A)
        const columns = [
          {
            key: 'symbol',
            label: 'Symbol',
            width: '90px',
            accessor: (row) => row.ticker || row.symbol || '',
            render: (v) => <span style={{ fontWeight: 600 }}>{v}</span>,
          },
          {
            key: 'name',
            label: 'Fund Name',
            width: '260px',
            accessor: (row) => row.name || row.fund_name || row['Fund Name'] || '',
          },
          {
            key: 'assetClass',
            label: 'Asset Class',
            width: '160px',
            accessor: (row) => row.asset_class_name || row.asset_class || '',
          },
          {
            key: 'score',
            label: 'Score',
            width: '90px',
            numeric: true,
            align: 'right',
            accessor: (row) => {
              const s = row?.scores?.final ?? row?.score_final ?? row?.score;
              return typeof s === 'number' ? s : (s != null ? Number(s) : null);
            },
            render: (val, row) => (val != null && !Number.isNaN(val)) ? (
              <ScoreTooltip fund={row} score={Number(val)}>
                <span className="number">{Number(val).toFixed(1)}</span>
              </ScoreTooltip>
            ) : '—',
          },
          {
            key: 'ytd',
            label: 'YTD',
            width: '90px',
            numeric: true,
            align: 'right',
            accessor: (row) => row['Total Return - YTD (%)'] ?? row.ytd_return ?? null,
            render: (val) => (val != null && !Number.isNaN(val)) ? `${Number(val).toFixed(2)}%` : '—',
          },
          {
            key: 'expense',
            label: 'Expense',
            width: '100px',
            numeric: true,
            align: 'right',
            accessor: (row) => row.expense_ratio ?? row['Net Expense Ratio'] ?? null,
            render: (val) => (val != null && !Number.isNaN(val)) ? `${Number(val).toFixed(2)}%` : '—',
          },
          {
            key: 'recommended',
            label: 'Rec',
            width: '70px',
            accessor: (row) => row.is_recommended || row.recommended || false,
            render: (val) => val ? <span className="status-recommended">Yes</span> : <span style={{ color: '#9ca3af' }}>—</span>,
          },
        ];

        return (
          <div>
            <ProfessionalTable
              data={filteredFunds}
              columns={columns}
              onRowClick={handleFundSelect}
              sortable={true}
              maxHeight="600px"
            />
          </div>
        );
      
      case 'heatmap':
        if (!filteredFunds || filteredFunds.length === 0) {
          return (
            <div className="card" style={{ padding: 16 }}>
              <div style={{ color: '#6b7280', marginBottom: 8, display:'flex', alignItems:'center', gap:8 }}>
                <AlertCircle size={16} aria-hidden />
                <span>No data to display yet. Import a CSV or try sample data.</span>
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                <a className="btn" href="#" onClick={(e)=>{ e.preventDefault(); window.dispatchEvent(new CustomEvent('NAVIGATE_APP', { detail: { tab: 'admin' } })); }}>Go to Importer</a>
                <a className="btn btn-secondary" href="#" onClick={(e)=>{ e.preventDefault(); window.dispatchEvent(new CustomEvent('NAVIGATE_APP', { detail: { tab: 'admin' } })); window.dispatchEvent(new CustomEvent('NAVIGATE_ADMIN', { detail: { subtab: 'data' } })); setTimeout(()=>{ try { window.dispatchEvent(new CustomEvent('LOAD_SAMPLE_DATA')); } catch {} }, 300); }}>Use sample data</a>
              </div>
            </div>
          );
        }
        return (
          <>
            <div className="card" ref={(el)=>{ window.__HEATMAP_NODE__ = el; }}>
              <div className="card-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <h3 className="card-title chart-title" style={{ margin:0 }}>Performance Heatmap</h3>
                <div style={{ display:'flex', gap:8 }}>
                  <button className="btn btn-secondary" onClick={(e)=>{ e.preventDefault(); try { window.dispatchEvent(new CustomEvent('OPEN_METHODOLOGY')); } catch {} }} title="How to read the heatmap">i</button>
                  <button className="btn" onClick={async (e)=>{ e.preventDefault(); const node = window.__HEATMAP_NODE__; await exportElementToPNG(node, 'heatmap.png'); }} title="Export heatmap as PNG">Export PNG</button>
                  <button className="btn btn-secondary" onClick={async (e)=>{ e.preventDefault(); const node = window.__HEATMAP_NODE__; const ok = await copyElementPNGToClipboard(node); if (!ok) alert('Copy not supported in this browser.'); }} title="Copy heatmap to clipboard">Copy</button>
                </div>
              </div>
              <div className="chart-container">
                <PerformanceHeatmap funds={filteredFunds} />
              </div>
            </div>
            {asOfMonthProp && (guard.fund === 0 || guard.fund === null) && (guard.bench > 0) && (
              <div style={{ background:'#fffbeb', border:'1px solid #fde68a', color:'#92400e', borderRadius:6, padding:'8px 12px', marginTop: 8 }}>
                No fund rows for this month. Benchmarks exist for {asOfMonthProp}. Import fund rows or adjust classification. View Data Health.
                <div style={{ marginTop:6, display:'flex', gap:8 }}>
                  <a className="btn btn-secondary" href="#" onClick={(e)=>{ e.preventDefault(); document.querySelector('.card-title')?.scrollIntoView({ behavior:'smooth' }); }}>Open Data Health</a>
                  <a className="btn btn-secondary" href="#" onClick={(e)=>{ e.preventDefault(); }}>Go to Import</a>
                </div>
              </div>
            )}
            {asOfMonthProp && guard.fund === 0 && guard.bench === 0 && (
              <div style={{ background:'#f3f4f6', border:'1px solid #e5e7eb', color:'#374151', borderRadius:6, padding:'8px 12px', marginTop: 8, display:'flex', alignItems:'center', gap:8 }}>
                <AlertCircle size={16} aria-hidden />
                <span>No data for {asOfMonthProp}.</span>
              </div>
            )}
          </>
        );
      
      case 'overview':
        if (!filteredFunds || filteredFunds.length === 0) {
          return (
            <div className="card" style={{ padding: 16 }}>
              <div style={{ color: '#6b7280', marginBottom: 8, display:'flex', alignItems:'center', gap:8 }}>
                <AlertCircle size={16} aria-hidden />
                <span>No data to display yet. Import a CSV or try sample data.</span>
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                <a className="btn" href="#" onClick={(e)=>{ e.preventDefault(); window.dispatchEvent(new CustomEvent('NAVIGATE_APP', { detail: { tab: 'admin' } })); }}>Go to Importer</a>
                <a className="btn btn-secondary" href="#" onClick={(e)=>{ e.preventDefault(); window.dispatchEvent(new CustomEvent('NAVIGATE_APP', { detail: { tab: 'admin' } })); window.dispatchEvent(new CustomEvent('NAVIGATE_ADMIN', { detail: { subtab: 'data' } })); setTimeout(()=>{ try { window.dispatchEvent(new CustomEvent('LOAD_SAMPLE_DATA')); } catch {} }, 300); }}>Use sample data</a>
              </div>
            </div>
          );
        }
        return (
          <div className="card" ref={(el)=>{ window.__OVERVIEW_NODE__ = el; }}>
            <div className="card-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h3 className="card-title chart-title" style={{ margin:0 }}>Asset Class Overview</h3>
              <div style={{ display:'flex', gap:8 }}>
                <button className="btn btn-secondary" onClick={(e)=>{ e.preventDefault(); try { window.dispatchEvent(new CustomEvent('OPEN_METHODOLOGY')); } catch {} }} title="How class metrics are computed">i</button>
                <button className="btn" onClick={async (e)=>{ e.preventDefault(); const node = window.__OVERVIEW_NODE__; await exportElementToPNG(node, 'class-overview.png'); }} title="Export overview as PNG">Export PNG</button>
                <button className="btn btn-secondary" onClick={async (e)=>{ e.preventDefault(); const node = window.__OVERVIEW_NODE__; const ok = await copyElementPNGToClipboard(node); if (!ok) alert('Copy not supported in this browser.'); }} title="Copy overview to clipboard">Copy</button>
              </div>
            </div>
            <div className="chart-container">
              <AssetClassOverview funds={filteredFunds} />
            </div>
          </div>
        );
      
      case 'performers':
        if (!filteredFunds || filteredFunds.length === 0) {
          return (
            <div className="card" style={{ padding: 16 }}>
              <div style={{ color: '#6b7280', marginBottom: 8, display:'flex', alignItems:'center', gap:8 }}>
                <AlertCircle size={16} aria-hidden />
                <span>No data to display yet. Import a CSV or try sample data.</span>
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                <a className="btn" href="#" onClick={(e)=>{ e.preventDefault(); window.dispatchEvent(new CustomEvent('NAVIGATE_APP', { detail: { tab: 'admin' } })); }}>Go to Importer</a>
                <a className="btn btn-secondary" href="#" onClick={(e)=>{ e.preventDefault(); window.dispatchEvent(new CustomEvent('NAVIGATE_APP', { detail: { tab: 'admin' } })); window.dispatchEvent(new CustomEvent('NAVIGATE_ADMIN', { detail: { subtab: 'data' } })); setTimeout(()=>{ try { window.dispatchEvent(new CustomEvent('LOAD_SAMPLE_DATA')); } catch {} }, 300); }}>Use sample data</a>
              </div>
            </div>
          );
        }
        return (
          <div className="card" ref={(el)=>{ window.__PERFORMERS_NODE__ = el; }}>
            <div className="card-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h3 className="card-title chart-title" style={{ margin:0 }}>Top & Bottom Performers</h3>
              <div style={{ display:'flex', gap:8 }}>
                <button className="btn btn-secondary" onClick={(e)=>{ e.preventDefault(); try { window.dispatchEvent(new CustomEvent('OPEN_METHODOLOGY')); } catch {} }} title="How performers are ranked">i</button>
                <button className="btn" onClick={async (e)=>{ e.preventDefault(); const node = window.__PERFORMERS_NODE__; await exportElementToPNG(node, 'performers.png'); }} title="Export performers as PNG">Export PNG</button>
                <button className="btn btn-secondary" onClick={async (e)=>{ e.preventDefault(); const node = window.__PERFORMERS_NODE__; const ok = await copyElementPNGToClipboard(node); if (!ok) alert('Copy not supported in this browser.'); }} title="Copy performers to clipboard">Copy</button>
              </div>
            </div>
            <div className="chart-container">
              <TopBottomPerformers funds={filteredFunds} />
            </div>
          </div>
        );
      
      case 'compare':
        if (!filteredFunds || filteredFunds.length === 0) {
          return (
            <div className="card" style={{ padding: 16 }}>
              <div style={{ color: '#6b7280', marginBottom: 8, display:'flex', alignItems:'center', gap:8 }}>
                <AlertCircle size={16} aria-hidden />
                <span>No data to display yet. Import a CSV or try sample data.</span>
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                <a className="btn" href="#" onClick={(e)=>{ e.preventDefault(); window.dispatchEvent(new CustomEvent('NAVIGATE_APP', { detail: { tab: 'admin' } })); }}>Go to Importer</a>
                <a className="btn btn-secondary" href="#" onClick={(e)=>{ e.preventDefault(); window.dispatchEvent(new CustomEvent('NAVIGATE_APP', { detail: { tab: 'admin' } })); window.dispatchEvent(new CustomEvent('NAVIGATE_ADMIN', { detail: { subtab: 'data' } })); setTimeout(()=>{ try { window.dispatchEvent(new CustomEvent('LOAD_SAMPLE_DATA')); } catch {} }, 300); }}>Use sample data</a>
              </div>
            </div>
          );
        }
        return (
          <div className="card" ref={(el)=>{ window.__COMPARE_NODE__ = el; }}>
            <div className="card-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h3 className="card-title chart-title" style={{ margin:0 }}>Compare Funds</h3>
              <div style={{ display:'flex', gap:8 }}>
                <button className="btn btn-secondary" onClick={(e)=>{ e.preventDefault(); try { window.dispatchEvent(new CustomEvent('OPEN_METHODOLOGY')); } catch {} }} title="How comparison works">i</button>
                <button className="btn" onClick={async (e)=>{ e.preventDefault(); const node = window.__COMPARE_NODE__; await exportElementToPNG(node, 'compare.png'); }} title="Export compare as PNG">Export PNG</button>
                <button className="btn btn-secondary" onClick={async (e)=>{ e.preventDefault(); const node = window.__COMPARE_NODE__; const ok = await copyElementPNGToClipboard(node); if (!ok) alert('Copy not supported in this browser.'); }} title="Copy compare to clipboard">Copy</button>
              </div>
            </div>
            <div className="chart-container">
              <ComparisonPanel funds={filteredFunds} />
            </div>
          </div>
        );
      case 'details':
        return (
          <div className="card" style={{ padding: 16 }}>
            {selectedFund ? (
              <div className="chart-container">
                <DrilldownCards fund={selectedFund} funds={filteredFunds} />
              </div>
            ) : (
              <div style={{ color: '#6b7280' }}>Select a fund to view drilldown details.</div>
            )}
          </div>
        );
      
      default:
        return null;
    }
  };

  // Get active filter summary (null-safe)
  const getFilterSummary = () => {
    const obj = activeFilters ?? {};
    const activeCount = Object.values(obj).filter(value => {
      if (Array.isArray(value)) return value.length > 0;
      if (value && typeof value === 'object') return Object.values(value ?? {}).some(v => v !== '' && v !== 'all');
      return value !== '' && value !== 'all';
    }).length;
    return activeCount;
  };
  // ref moved up to keep hooks before any return

  // Copy link to current view (share filters + asOf month via hash)
  const copyShareLink = React.useCallback(async () => {
    try {
      const data = {
        asOf: asOfMonthProp || null,
        viewMode,
        filters: activeFilters || null,
        // Compare selection tickers via event query (best-effort)
        compareTickers: (() => {
          try {
            const cells = document.querySelectorAll('[data-compare-export] th div span');
            const syms = Array.from(cells).slice(0, 8).map(n => (n?.textContent || '').trim()).filter(Boolean);
            return syms.length ? syms : null;
          } catch { return null; }
        })()
      };
      const hash = encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(data)))));
      const url = `${window.location.origin}${window.location.pathname}#s=${hash}`;
      await navigator.clipboard.writeText(url);
      alert('Link copied to clipboard');
    } catch (e) {
      console.error('Failed to copy link', e);
    }
  }, [asOfMonthProp, viewMode, activeFilters]);

  // Density control state
  const [density, setDensity] = React.useState(() => localStorage.getItem('tableDensity') || 'comfortable');
  React.useEffect(() => {
    document.documentElement.classList.toggle('density-compact', density === 'compact');
    localStorage.setItem('tableDensity', density);
  }, [density]);

  // On load, parse share hash if present
  React.useEffect(() => {
    try {
      const m = window.location.hash.match(/#s=(.+)$/);
      if (!m) return;
      const parsed = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(m[1])))));
      if (parsed?.asOf && typeof onAsOfMonthChange === 'function') onAsOfMonthChange(parsed.asOf);
      if (parsed?.viewMode && ['table','heatmap','overview','performers','compare','details'].includes(parsed.viewMode)) setViewMode(parsed.viewMode);
      if (parsed?.filters && typeof parsed.filters === 'object') setActiveFilters(parsed.filters);
      if (Array.isArray(parsed?.compareTickers) && parsed.compareTickers.length > 0) {
        setViewMode('compare');
        setTimeout(()=>{ try { window.dispatchEvent(new CustomEvent('LOAD_COMPARE_SELECTION', { detail: { tickers: parsed.compareTickers } })); } catch {} }, 0);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Loader handled via isLoadingAny skeleton inside main return

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      {isLoadingAny ? (
        <div className="enhanced-performance-dashboard">
          <div className="dashboard-header">
            <div className="header-left">
              <h2>Performance</h2>
              <p className="subtitle">Preparing your view…</p>
            </div>
          </div>
          <div style={{ display:'grid', gap: 'var(--spacing-lg)' }}>
            <SectionSkeleton />
            <SectionSkeleton />
            <SectionSkeleton />
          </div>
        </div>
      ) : (
        <>
      {/* Header */}
      <header className="dashboard-header">
        <div className="toolbar">
          {/* left: title + subtitle */}
          <div className="title-group">
            <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#1f2937', margin: 0 }}>
              Performance Dashboard
            </h1>
            <p style={{ color: '#6b7280', fontSize: '1rem', margin: '0.25rem 0 0 0' }}>
              Advanced fund analysis with comprehensive filtering and sorting
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, color: '#6b7280', fontSize: '0.875rem' }}>
              <Info size={14} />
              Benchmark deltas require same-day performance rows to exist for both the fund and its benchmark ticker.
            </div>
            
            {/* KPI Metrics Strip */}
            <div className="kpi-strip" role="list">
              <div className="kpi-chip" role="listitem">
                <span className="label">Funds</span>
                <span className="value">{filteredFunds.length}</span>
              </div>
              <div className="kpi-chip" role="listitem">
                <span className="label">Asset Classes</span>
                <span className="value">
                  {(() => {
                    const classes = new Set(filteredFunds.map(f => f.asset_class).filter(Boolean));
                    return classes.size || '—';
                  })()}
                </span>
              </div>
              <div className="kpi-chip" role="listitem">
                <span className="label">Avg Expense</span>
                <span className="value">
                  {(() => {
                    const expenses = filteredFunds
                      .map(f => f.expense_ratio)
                      .filter(v => v != null && !Number.isNaN(v) && v > 0);
                    if (expenses.length === 0) return '—';
                    const avg = expenses.reduce((sum, exp) => sum + exp, 0) / expenses.length;
                    return `${avg.toFixed(2)}%`;
                  })()}
                </span>
              </div>
              <div className="kpi-chip" role="listitem">
                <span className="label">Avg Z‑Score</span>
                <span className="value">
                  {(() => {
                    const scores = filteredFunds
                      .map(f => f.z_score)
                      .filter(v => v != null && !Number.isNaN(v));
                    if (scores.length === 0) return '—';
                    const avg = scores.reduce((sum, score) => sum + score, 0) / scores.length;
                    return avg.toFixed(2);
                  })()}
                </span>
              </div>
            </div>
          </div>
          
          {/* right: as-of selector + Refresh/Export/Help/Methodology buttons */}
          <div className="actions">
            {/* As-of month selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: '0.875rem', color: '#6b7280' }}>As of</label>
              <select
                value={asOfMonthProp || ''}
                onChange={async (e) => {
                  const val = e.target.value || '';
                  if (typeof onAsOfMonthChange === 'function') {
                    onAsOfMonthChange(val);
                  }
                  window.__AS_OF_MONTH__ = val || null;
                  try {
                    await preferencesService.saveViewDefaults({
                      filters: activeFilters,
                      table: {
                        sortConfig: tableState.sortConfig,
                        selectedColumns: tableState.selectedColumns
                      },
                      chartPeriod,
                      asOfMonth: val
                    });
                  } catch {}
                }}
                style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 6 }}
                title="Switch dataset to a specific month snapshot"
              >
                <option value="">Latest</option>
                {(showNonEom ? allMonths : availableMonths).map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <button className="btn btn-secondary" onClick={copyShareLink} title="Copy link to this view" style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
              <Share2 size={16} aria-hidden />
              <span>Share</span>
            </button>
            {/* Non-EOM pill and toggle */}
            {nonEomSample && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', padding: '2px 6px', borderRadius: 9999 }}>
                  This month isn't end‑of‑month; values may be incomplete
                </span>
                <label style={{ fontSize: 12, color: '#374151' }}>
                  <input type="checkbox" checked={showNonEom} onChange={(e) => setShowNonEom(e.target.checked)} /> Show non-EOM
                </label>
              </div>
            )}
            {/* Data Health badge with icon */}
            <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
              <div title={`Minimum coverage across key metrics`} style={{ background: dataHealth.color, color: 'white', borderRadius: 9999, padding: '4px 10px', fontWeight: 600, fontSize: 12, display:'inline-flex', alignItems:'center', gap:6 }}>
                <StatusIcon level={dataHealth.minCov >= 80 ? 'good' : dataHealth.minCov >= 50 ? 'fair' : 'poor'} />
                <span>Data Health: {dataHealth.label} • {dataHealth.minCov}%</span>
              </div>
              <a href="#" className="btn btn-secondary" onClick={(e)=>{ e.preventDefault(); window.dispatchEvent(new CustomEvent('NAVIGATE_APP', { detail: { tab: 'admin' } })); window.dispatchEvent(new CustomEvent('NAVIGATE_ADMIN', { detail: { subtab: 'health' } })); }} style={{ fontSize: 12 }}>Open Data Health</a>
            </div>
            <button
              className="btn"
              onClick={onRefresh}
              disabled={isLoading || (process.env.REACT_APP_ENABLE_REFRESH || 'false') !== 'true'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                backgroundColor: (process.env.REACT_APP_ENABLE_REFRESH || 'false') === 'true' ? 'white' : '#fee2e2',
                color: (process.env.REACT_APP_ENABLE_REFRESH || 'false') === 'true' ? '#374151' : '#991b1b',
                fontSize: '0.875rem',
                cursor: (isLoading || (process.env.REACT_APP_ENABLE_REFRESH || 'false') !== 'true') ? 'not-allowed' : 'pointer',
                opacity: (isLoading || (process.env.REACT_APP_ENABLE_REFRESH || 'false') !== 'true') ? 0.6 : 1
              }}
            >
              <RefreshCw size={16} style={{ animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
              {(process.env.REACT_APP_ENABLE_REFRESH || 'false') === 'true' ? 'Refresh Data' : 'Refresh Disabled'}
            </button>
            {(process.env.REACT_APP_ENABLE_REFRESH || 'false') !== 'true' && (
              <div style={{ color:'#991b1b', background:'#fee2e2', border:'1px solid #fecaca', borderRadius:6, padding:'2px 6px', fontSize:12 }}>
                Refresh is disabled in production
              </div>
            )}
            
            {/* Export menu */}
            <div style={{ position: 'relative' }}>
              <button
                className="btn"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 1rem',
                  border: '1px solid #3b82f6',
                  borderRadius: '0.375rem',
                  backgroundColor: filteredFunds.length > 0 ? '#3b82f6' : '#93c5fd',
                  color: 'white',
                  fontSize: '0.875rem',
                  cursor: filteredFunds.length > 0 ? 'pointer' : 'not-allowed',
                  opacity: filteredFunds.length > 0 ? 1 : 0.6
                }}
                aria-haspopup="menu"
                aria-expanded="false"
                disabled={filteredFunds.length === 0}
                onClick={(e) => {
                  const menu = e.currentTarget.nextSibling;
                  if (menu) menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
                }}
                title="Export options"
              >
                <Download size={16} />
                Export
              </button>
              <div role="menu" style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', background: 'white', border: '1px solid #e5e7eb', borderRadius: 6, minWidth: 200, boxShadow: '0 6px 18px rgba(0,0,0,0.08)', display: 'none', zIndex: 50 }}>
                {viewMode === 'compare' ? (
                  <button role="menuitem" style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'white', border: 'none', cursor: 'pointer' }} onClick={() => {
                    try {
                      const panel = document.querySelector('[data-compare-export]');
                      if (panel) panel.dispatchEvent(new CustomEvent('COMPARE_EXPORT', { bubbles: true }));
                    } catch {}
                  }}>
                    Compare (CSV)
                  </button>
                ) : (
                  <button role="menuitem" style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'white', border: 'none', cursor: 'pointer' }} onClick={() => { if (tableExportRef.current) tableExportRef.current(); }}>
                    Table (CSV)
                  </button>
                  <button role="menuitem" style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'white', border: 'none', cursor: 'pointer', borderTop: '1px solid #e5e7eb', fontWeight: '600', color: '#3b82f6' }} onClick={() => {
                    try {
                      // Get current columns from table state
                      const currentColumns = tableState.selectedColumns || getPresetColumns(selectedPreset);
                      const columns = currentColumns.map(key => ({
                        key,
                        label: key,
                        isPercent: ['ytdReturn', 'oneYearReturn', 'threeYearReturn', 'fiveYearReturn', 'expenseRatio', 'standardDeviation'].includes(key),
                        valueGetter: (fund) => fund[key]
                      }));
                      
                      const filterSummary = Object.entries(activeFilters || {})
                        .filter(([key, value]) => {
                          if (Array.isArray(value)) return value.length > 0;
                          if (value && typeof value === 'object') return Object.values(value).some(v => v !== '' && v !== 'all');
                          return value !== '' && value !== 'all' && value != null;
                        })
                        .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : JSON.stringify(value)}`)
                        .join('; ');
                      
                      const blob = exportCurrentView({
                        funds: filteredFunds,
                        columns,
                        sortConfig: tableState.sortConfig || [],
                        selectedPreset,
                        activeFilters: activeFilters || {},
                        metadata: {
                          asOf: asOfMonthProp || window.__AS_OF_MONTH__ || null,
                          chartPeriod,
                          filterSummary,
                          exportedAt: new Date()
                        }
                      });
                      
                      const name = formatExportFilename({ 
                        scope: `current_view_${selectedPreset}${filterSummary ? '_filtered' : ''}`, 
                        asOf: asOfMonthProp || window.__AS_OF_MONTH__ || null, 
                        ext: 'csv' 
                      });
                      downloadFile(blob, name, 'text/csv;charset=utf-8');
                    } catch (e) { console.error('Current view export failed', e); }
                  }}>
                    ✨ Export Current View (Enhanced)
                  </button>
                )}
                <button role="menuitem" style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'white', border: 'none', cursor: 'pointer' }} onClick={() => {
                  try {
                    // Get current filter summary
                    const filterSummary = Object.entries(activeFilters || {})
                      .filter(([key, value]) => {
                        if (Array.isArray(value)) return value.length > 0;
                        if (value && typeof value === 'object') return Object.values(value).some(v => v !== '' && v !== 'all');
                        return value !== '' && value !== 'all' && value != null;
                      })
                      .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : JSON.stringify(value)}`)
                      .join('; ');
                    
                    const wbBlob = exportToExcel({ funds: filteredFunds }, {
                      selectedPreset,
                      activeFilters: activeFilters || {},
                      visibleColumns: tableState.selectedColumns ? tableState.selectedColumns.map(key => ({ key, label: key })) : [],
                      metadata: {
                        asOf: asOfMonthProp || window.__AS_OF_MONTH__ || null,
                        filterSummary,
                        chartPeriod
                      }
                    });
                    const name = formatExportFilename({ scope: 'excel_enhanced', asOf: (asOfMonthProp || window.__AS_OF_MONTH__ || null), ext: 'xlsx' });
                    downloadFile(wbBlob, name);
                  } catch (e) { /* eslint-disable no-console */ console.error('Excel export failed', e); }
                }}>
                  Excel workbook (.xlsx)
                </button>
                <button role="menuitem" style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'white', border: 'none', cursor: 'pointer' }} onClick={async () => {
                  try {
                    const metadata = {
                      date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
                      totalFunds: filteredFunds.length,
                      recommendedFunds: filteredFunds.filter(f => f.is_recommended || f.recommended).length,
                      assetClassCount: new Set(filteredFunds.map(f => f.asset_class_name || f.asset_class || f['Asset Class']).filter(Boolean)).size,
                      averagePerformance: (() => {
                        const vals = filteredFunds.map(f => f.ytd_return).filter(v => v != null && !Number.isNaN(v));
                        return vals.length ? (vals.reduce((s,v) => s+v, 0) / vals.length) : null;
                      })(),
                      asOf: asOfMonthProp || (typeof window !== 'undefined' ? (window.__AS_OF_MONTH__ || null) : null)
                    };
                    console.log('🚀 Starting PDF generation for all funds...');
                    const pdf = await generatePDFReport({ funds: filteredFunds, metadata }, { forceV2: true });
                    const name = formatExportFilename({ scope: 'pdf', asOf: (asOfMonthProp || window.__AS_OF_MONTH__ || null), ext: 'pdf' });
                    downloadPDF(pdf, name);
                  } catch (e) { /* eslint-disable no-console */ console.error('PDF export failed', e); }
                }}>
                  PDF Report (.pdf)
                </button>
              </div>
            </div>

            {/* Density Toggle */}
            <div className="density-toggle" aria-label="Table density">
              <button
                className={`btn-secondary ${density === 'comfortable' ? 'active' : ''}`}
                onClick={() => setDensity('comfortable')}
                type="button"
              >Comfort</button>
              <button
                className={`btn-secondary ${density === 'compact' ? 'active' : ''}`}
                onClick={() => setDensity('compact')}
                type="button"
              >Compact</button>
            </div>
          </div>
        </div>
      </header>
      {/* Empty-month guardrail banners (table/overview views) */}
      {viewMode !== 'heatmap' && asOfMonthProp && (guard.fund === 0 || guard.fund === null) && (guard.bench > 0) && (
        <div style={{ background:'#fffbeb', border:'1px solid #fde68a', color:'#92400e', borderRadius:6, padding:'8px 12px', margin:'8px 16px' }}>
          No fund rows for this month. Benchmarks exist for {asOfMonthProp}. Import fund rows or adjust classification. View Data Health.
        </div>
      )}
      {viewMode !== 'heatmap' && asOfMonthProp && guard.fund === 0 && guard.bench === 0 && (
        <div style={{ background:'#f3f4f6', border:'1px solid #e5e7eb', color:'#374151', borderRadius:6, padding:'8px 12px', margin:'8px 16px', display:'flex', alignItems:'center', gap:8 }}>
          <AlertCircle size={16} aria-hidden />
          <span>No data for {asOfMonthProp}.</span>
        </div>
      )}

      <div className="content-card" style={{ padding: '2rem' }}>
        {/* Summary Statistics Cards */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
          gap: '1rem', 
          marginBottom: '2rem' 
        }}>
          <div className="card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0, color: '#1f2937' }}>
                  {summaryStats.totalFunds}
                </h3>
                <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0.25rem 0 0 0' }}>
                  Total Funds
                </p>
              </div>
              <Target size={24} style={{ color: '#3b82f6' }} />
            </div>
          </div>

          <div className="card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0, color: '#1f2937' }}>
                  {summaryStats.recommendedFunds}
                </h3>
                <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0.25rem 0 0 0' }}>
                  Recommended
                </p>
              </div>
              <TrendingUp size={24} style={{ color: '#10b981' }} />
            </div>
          </div>

          <div className="card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0, color: '#1f2937' }}>
                  {summaryStats.averageScore.toFixed(1)}
                </h3>
                <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0.25rem 0 0 0' }}>
                  Average Score
                </p>
              </div>
              <BarChart3 size={24} style={{ color: '#f59e0b' }} />
            </div>
          </div>

          <div className="card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0, color: '#1f2937' }}>
                  {summaryStats.averageYTD.toFixed(1)}%
                </h3>
                <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0.25rem 0 0 0' }}>
                  Average YTD Return
                </p>
              </div>
              <TrendingUp size={24} style={{ color: summaryStats.averageYTD >= 0 ? '#10b981' : '#ef4444' }} />
            </div>
          </div>
        </div>

        {/* Advanced Filters */}
          {initialized && (
          <AdvancedFilters 
            funds={funds}
            onFilterChange={handleFilterChange}
            initialFilters={initialFilters}
          />)}

        {/* View Mode Selector */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem'
        }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {[
              { key: 'table', label: 'Table View', icon: Table },
              { key: 'heatmap', label: 'Heatmap', icon: Grid },
              { key: 'overview', label: 'Asset Classes', icon: BarChart3 },
              { key: 'performers', label: 'Top/Bottom', icon: TrendingUp },
              { key: 'compare', label: 'Compare', icon: Info },
              { key: 'details', label: 'Drilldown', icon: Info }
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                className="btn-secondary"
                onClick={() => setViewMode(key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 1rem',
                  border: viewMode === key ? '2px solid #3b82f6' : '1px solid #d1d5db',
                  borderRadius: '0.375rem',
                  backgroundColor: viewMode === key ? '#eff6ff' : 'white',
                  color: viewMode === key ? '#3b82f6' : '#374151',
                  fontSize: '0.875rem',
                  cursor: 'pointer'
                }}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>

          {/* Mini-chart period toggles */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {['1M','3M','6M','1Y','YTD'].map(p => (
              <button
                key={p}
                className="btn-secondary"
                onClick={() => setChartPeriod(p)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: chartPeriod === p ? '2px solid #3b82f6' : '1px solid #d1d5db',
                  background: chartPeriod === p ? '#eff6ff' : 'white',
                  color: chartPeriod === p ? '#3b82f6' : '#374151',
                  fontSize: 12,
                  cursor: 'pointer'
                }}
                title={`Sparkline period: ${p}`}
              >{p}</button>
            ))}
          </div>

          {getFilterSummary() > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 0.75rem',
              backgroundColor: '#eff6ff',
              border: '1px solid #3b82f6',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              color: '#3b82f6'
            }}>
              <Filter size={16} />
              {getFilterSummary()} filter{getFilterSummary() !== 1 ? 's' : ''} active
              <button className="btn-secondary" onClick={()=> window.location.reload()} style={{ marginLeft: 8, background: 'transparent', border: 'none', color: '#1d4ed8', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.875rem' }}>Clear all</button>
            </div>
          )}
        </div>

        {/* Top Performer Highlight */}
        {summaryStats.topPerformer && (
          <div style={{
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '0.5rem',
            padding: '1rem',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <TrendingUp size={24} style={{ color: '#10b981' }} />
              <div>
                <h4 style={{ margin: 0, color: '#065f46', fontWeight: '600' }}>
                  Top Performer: {summaryStats.topPerformer.Symbol || summaryStats.topPerformer.symbol}
                </h4>
                <p style={{ margin: '0.25rem 0 0 0', color: '#047857', fontSize: '0.875rem' }}>
                  Score: {(summaryStats.topPerformer.scores?.final || summaryStats.topPerformer.score || 0).toFixed(1)} | 
                  YTD: {(summaryStats.topPerformer['Total Return - YTD (%)'] || summaryStats.topPerformer.ytd_return || 0).toFixed(2)}%
                </p>
              </div>
            </div>
            <button
              className="btn-secondary"
              onClick={() => handleFundSelect(summaryStats.topPerformer)}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #10b981',
                borderRadius: '0.375rem',
                backgroundColor: 'white',
                color: '#10b981',
                fontSize: '0.875rem',
                cursor: 'pointer'
              }}
            >
              View Details
            </button>
          </div>
        )}

        {/* Main Content Area */}
        {filteredFunds.length === 0 ? (
          <div style={{
            padding: '3rem',
            textAlign: 'center',
            backgroundColor: 'white',
            borderRadius: '0.5rem',
            border: '1px solid #e5e7eb'
          }}>
            <AlertCircle size={48} style={{ margin: '0 auto 1rem', opacity: 0.3, color: '#f59e0b' }} />
            <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.5rem', color: '#374151' }}>
              No Funds Match Your Filters
            </h3>
            <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
              Try adjusting your filter criteria or clearing some filters to see more results.
            </p>
            <button
              className="btn-secondary"
              onClick={() => window.location.reload()} // This would clear filters in a real implementation
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #3b82f6',
                borderRadius: '0.375rem',
                backgroundColor: '#3b82f6',
                color: 'white',
                fontSize: '0.875rem',
                cursor: 'pointer'
              }}
            >
              Clear All Filters
            </button>
          </div>
        ) : (
          renderViewContent()
        )}

        {/* Fund Details Modal */}
        {showDetailsModal && selectedFund && (
          <FundDetailsModal
            fund={selectedFund}
            onClose={() => {
              setShowDetailsModal(false);
              setSelectedFund(null);
            }}
          />
        )}
      </div>
      </>
      )}

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        /* Column transition animations - only apply when visual refresh is enabled */
        .column-transition-enter {
          opacity: 0;
          transform: translateX(-20px) scale(0.95);
        }
        
        .column-transition-enter-active {
          opacity: 1;
          transform: translateX(0) scale(1);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .column-transition-exit {
          opacity: 1;
          transform: translateX(0) scale(1);
        }
        
        .column-transition-exit-active {
          opacity: 0;
          transform: translateX(20px) scale(0.95);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        /* Performance optimizations for large tables */
        .fund-table-optimized {
          contain: layout style;
          will-change: transform;
        }
        
        .fund-table-optimized th,
        .fund-table-optimized td {
          contain: layout;
        }
      `}</style>
    </div>
  );
};

export default EnhancedPerformanceDashboard;
