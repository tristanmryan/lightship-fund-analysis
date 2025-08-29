// src/components/Dashboard/EnhancedFundTable.jsx
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  ArrowUp, ArrowDown, ArrowUpDown, Eye, Star, TrendingUp, 
  TrendingDown, Shield, DollarSign, Calendar, MoreHorizontal, 
  ChevronUp, ChevronDown, Info
} from 'lucide-react';
import { getScoreColor, METRICS_CONFIG } from '../../services/scoring';
import { computeBenchmarkDelta } from './benchmarkUtils';
import Sparkline from './Sparkline';
import ScoreTooltip from './ScoreTooltip';
import fundService from '../../services/fundService';
import { exportTableCSV, downloadFile, shouldConfirmLargeExport, formatExportFilename } from '../../services/exportService';

/**
 * Enhanced Fund Table Component
 * Advanced sortable table with multi-column sorting and detailed fund information
 */
const EnhancedFundTable = ({
  funds,
  onFundSelect,
  showDetailModal = false,
  chartPeriod = '1Y',
  initialSortConfig = null,
  initialSelectedColumns = null,
  onStateChange,
  registerExportHandler,
  presetSelector = null // Optional preset selector component to render with table controls
}) => {
  const [sortConfig, setSortConfig] = useState(() => initialSortConfig || [
    { key: 'score', direction: 'desc' }
  ]);
  const DEFAULT_TABLE_COLUMNS = useMemo(() => ([
    'symbol', 'name', 'assetClass', 'score', 'ytdReturn', 'oneYearReturn', 
    'threeYearReturn', 'expenseRatio', 'sharpeRatio', 'recommended'
  ]), []);
  const [selectedColumns, setSelectedColumns] = useState(() => initialSelectedColumns || [
    'symbol', 'name', 'assetClass', 'score', 'ytdReturn', 'oneYearReturn', 
    'threeYearReturn', 'expenseRatio', 'sharpeRatio', 'recommended'
  ]);
  // const [columnWidths, setColumnWidths] = useState({});
  const [hoveredFund, setHoveredFund] = useState(null);
  const [historyCache, setHistoryCache] = useState({}); // stores sorted history rows per symbol

  // Emit state changes to parent for persistence
  useEffect(() => {
    if (typeof onStateChange === 'function') {
      onStateChange({ sortConfig, selectedColumns });
    }
  }, [sortConfig, selectedColumns, onStateChange]);

  // Preload sparkline history rows for visible funds when the sparkline column is selected
  const preloadSparklineData = useCallback(async (currentSortedFunds, currentHistoryCache) => {
    const needed = new Set((currentSortedFunds || []).map(f => (f.ticker || f.Symbol)).filter(Boolean));
    const toLoad = Array.from(needed).filter(sym => !(sym in currentHistoryCache));
    if (toLoad.length === 0) return;
    try {
      const results = await Promise.all(toLoad.map(async (sym) => {
        try {
          const rows = await fundService.getFundPerformanceHistory(sym, null, (window.__AS_OF_MONTH__ || null));
          const sorted = (rows || []).slice().sort((a,b) => new Date(a.date) - new Date(b.date));
          return [sym, sorted];
        } catch {
          return null;
        }
      }));
      const updates = {};
      for (const entry of results) {
        if (entry && entry[0]) updates[entry[0]] = entry[1];
      }
      if (Object.keys(updates).length > 0) {
        setHistoryCache(prev => ({ ...prev, ...updates }));
      }
    } catch {
      // ignore batch failures
    }
  }, []);

  // Helpers
  const getTopPositiveReasons = useCallback((fund, limit = 2) => {
    try {
      const breakdown = fund?.scores?.breakdown || {};
      const rows = Object.keys(breakdown).map((k) => {
        const row = breakdown[k] || {};
        const contrib = (typeof row.reweightedContribution === 'number') ? row.reweightedContribution : (row.weightedZScore || 0);
        return { key: k, label: (METRICS_CONFIG?.labels?.[k] || k), contrib };
      }).filter(r => Number.isFinite(r.contrib) && r.contrib > 0);
      rows.sort((a, b) => b.contrib - a.contrib);
      return rows.slice(0, limit);
    } catch {
      return [];
    }
  }, []);

  const getTopNegativeReasons = useCallback((fund, limit = 1) => {
    try {
      const breakdown = fund?.scores?.breakdown || {};
      const rows = Object.keys(breakdown).map((k) => {
        const row = breakdown[k] || {};
        const contrib = (typeof row.reweightedContribution === 'number') ? row.reweightedContribution : (row.weightedZScore || 0);
        return { key: k, label: (METRICS_CONFIG?.labels?.[k] || k), contrib };
      }).filter(r => Number.isFinite(r.contrib) && r.contrib < 0);
      rows.sort((a, b) => a.contrib - b.contrib); // most negative first
      return rows.slice(0, limit);
    } catch {
      return [];
    }
  }, []);

  const formatTopReasonsTooltip = useCallback((fund) => {
    try {
      const breakdown = fund?.scores?.breakdown || {};
      const rows = Object.keys(breakdown).map((k) => {
        const row = breakdown[k] || {};
        const contrib = (typeof row.reweightedContribution === 'number') ? row.reweightedContribution : (row.weightedZScore || 0);
        return { key: k, label: (METRICS_CONFIG?.labels?.[k] || k), contrib };
      }).filter(r => Number.isFinite(r.contrib));
      rows.sort((a,b) => Math.abs(b.contrib) - Math.abs(a.contrib));
      const top = rows.slice(0, 3).map(r => `${r.contrib >= 0 ? '+' : '−'}${Math.abs(r.contrib).toFixed(2)} ${r.label}`);
      if (top.length === 0) return 'Why this fund: no scoring contributors available';
      return `Why this fund: ${top.join(', ')}`;
    } catch {
      return 'Why this fund: rationale unavailable';
    }
  }, []);

  // Column definitions
  const columnDefinitions = useMemo(() => ({
    symbol: {
      label: 'Symbol',
      key: 'symbol',
      getValue: (fund) => fund.ticker || fund.symbol || fund.Symbol,
      sortable: true,
      width: '100px',
      tooltip: 'Fund ticker symbol',
      render: (value, fund) => (
        <div style={{ fontWeight: '600', color: '#1f2937' }}>
          {value}
        </div>
      )
    },
    name: {
      label: 'Fund Name',
      key: 'name',
      getValue: (fund) => fund.name || fund['Product Name'] || fund.displayName || fund.ticker,
      sortable: true,
      width: '250px',
      tooltip: 'Official fund name',
      render: (value, fund) => {
        const positive = getTopPositiveReasons(fund, 2);
        const negative = (fund?.scores?.final != null && fund.scores.final < 45) ? getTopNegativeReasons(fund, 1) : [];
        return (
          <div>
            <div
              title={String(value || '')}
              style={{ 
                fontSize: '0.875rem',
                lineHeight: '1.25rem',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {value}
            </div>
            {(positive.length > 0 || negative.length > 0) && (
              <div
                title={formatTopReasonsTooltip(fund)}
                style={{ marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap' }}
              >
                {positive.map(r => (
                  <span
                    key={r.key}
                    style={{
                      fontSize: '0.6875rem',
                      background: '#ecfdf5',
                      color: '#065f46',
                      border: '1px solid #a7f3d0',
                      borderRadius: 9999,
                      padding: '2px 6px'
                    }}
                    title={`Contributes +${r.contrib.toFixed(2)} to score`}
                  >
                    +{r.contrib.toFixed(2)} {r.label}
                  </span>
                ))}
                {negative.map(r => (
                  <span
                    key={`neg-${r.key}`}
                    style={{
                      fontSize: '0.6875rem',
                      background: '#fef2f2',
                      color: '#7f1d1d',
                      border: '1px solid #fecaca',
                      borderRadius: 9999,
                      padding: '2px 6px'
                    }}
                    title={`Drags −${Math.abs(r.contrib).toFixed(2)} from score`}
                  >
                    −{Math.abs(r.contrib).toFixed(2)} {r.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      }
    },
    assetClass: {
      label: 'Asset Class',
      key: 'assetClass',
      getValue: (fund) => fund.asset_class_name || fund.asset_class || fund['Asset Class'],
      sortable: true,
      width: '150px',
      tooltip: 'Normalized asset class',
      render: (value) => (
        <div style={{
          fontSize: '0.75rem',
          padding: '0.25rem 0.5rem',
          backgroundColor: '#f3f4f6',
          borderRadius: '0.375rem',
          textAlign: 'center'
        }}>
          {value}
        </div>
      )
    },
    score: {
      label: 'Score',
      key: 'score',
      getValue: (fund) => fund.scores?.final || fund.score || 0,
      sortable: true,
      width: '80px',
      tooltip: '0–100 weighted Z-score within asset class',
      render: (value, fund) => (
        <ScoreTooltip fund={fund} score={value}>
          <div
            style={{
              padding: '0.25rem 0.5rem',
              borderRadius: '0.375rem',
              textAlign: 'center',
              color: 'white',
              fontWeight: '600',
              backgroundColor: getScoreColor(value),
              cursor: 'help'
            }}
          >
            {value?.toFixed(1) || '0.0'}
          </div>
        </ScoreTooltip>
      )
    },
    ytdReturn: {
      label: 'YTD Return',
      key: 'ytdReturn',
      getValue: (fund) => (fund.ytd_return ?? fund['Total Return - YTD (%)'] ?? 0),
      sortable: true,
      width: '100px',
      tooltip: 'Year-to-date total return',
      render: (value) => (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.25rem',
          color: value >= 0 ? '#16a34a' : '#dc2626'
        }}>
          {value >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          {value?.toFixed(2)}%
        </div>
      )
    },
    oneYearReturn: {
      label: '1Y Return',
      key: 'oneYearReturn',
      getValue: (fund) => (fund.one_year_return ?? fund['Total Return - 1 Year (%)'] ?? fund['1 Year'] ?? 0),
      sortable: true,
      width: '100px',
      tooltip: 'Total return over the last 12 months',
      render: (value, fund, allFunds) => {
        const bench = computeBenchmarkDelta(fund, allFunds, '1y');
        const color = value >= 0 ? '#16a34a' : '#dc2626';
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color }}>
              {value >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {value?.toFixed(2)}%
            </div>
            {bench && bench.delta != null && (
              <div title={`Benchmark: ${bench.benchName} (${bench.benchTicker})\nPeriod: 1-Year Return`}
                style={{
                  fontSize: '0.6875rem',
                  backgroundColor: bench.delta >= 0 ? '#ecfdf5' : '#fef2f2',
                  color: bench.delta >= 0 ? '#065f46' : '#7f1d1d',
                  border: `1px solid ${bench.delta >= 0 ? '#a7f3d0' : '#fecaca'}`,
                  borderRadius: '9999px',
                  padding: '0.125rem 0.375rem'
                }}>
                {bench.delta >= 0 ? '+' : ''}{bench.delta.toFixed(2)}% vs {bench.benchTicker}
              </div>
            )}
          </div>
        );
      }
    },
    threeYearReturn: {
      label: '3Y Return',
      key: 'threeYearReturn',
      getValue: (fund) => (fund.three_year_return ?? fund['Annualized Total Return - 3 Year (%)'] ?? fund['3 Year'] ?? 0),
      sortable: true,
      width: '100px',
      tooltip: 'Annualized return over the last 3 years',
      render: (value) => (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.25rem',
          color: value >= 0 ? '#16a34a' : '#dc2626'
        }}>
          {value >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          {value?.toFixed(2)}%
        </div>
      )
    },
    fiveYearReturn: {
      label: '5Y Return',
      key: 'fiveYearReturn',
      getValue: (fund) => (fund.five_year_return ?? fund['Annualized Total Return - 5 Year (%)'] ?? fund['5 Year'] ?? 0),
      sortable: true,
      width: '100px',
      tooltip: 'Annualized return over the last 5 years',
      render: (value) => (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.25rem',
          color: value >= 0 ? '#16a34a' : '#dc2626'
        }}>
          {value >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          {value?.toFixed(2)}%
        </div>
      )
    },
    sparkline: {
      label: 'Trend',
      key: 'sparkline',
      getValue: () => null,
      sortable: false,
      width: '180px',
      render: (_, fund) => {
        const key = fund.ticker || fund.Symbol;
        const rows = historyCache[key] || [];
        let picked = rows;
        const clamp = (arr, n) => arr.slice(Math.max(0, arr.length - n));
        switch (chartPeriod) {
          case '1M': picked = clamp(rows, 21); break; // ~21 trading days
          case '3M': picked = clamp(rows, 63); break;
          case '6M': picked = clamp(rows, 126); break;
          case 'YTD': {
            const year = new Date().getFullYear();
            picked = rows.filter(r => new Date(r.date).getFullYear() === year);
            break;
          }
          case '1Y':
          default: picked = clamp(rows, 252); break; // ~252 trading days
        }
        const values = picked.map(r => r.one_year_return ?? r.ytd_return ?? null);
        return <Sparkline values={values} />;
      }
    },
    expenseRatio: {
      label: 'Expense Ratio',
      key: 'expenseRatio',
      getValue: (fund) => (fund.expense_ratio ?? fund['Net Exp Ratio (%)'] ?? 0),
      sortable: true,
      width: '120px',
      tooltip: 'Annual fund costs: lower is better',
      render: (value) => (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.25rem',
          color: value <= 0.5 ? '#16a34a' : value <= 1.0 ? '#f59e0b' : '#dc2626'
        }}>
          <DollarSign size={14} />
          {value?.toFixed(2)}%
        </div>
      )
    },
    sharpeRatio: {
      label: 'Sharpe Ratio',
      key: 'sharpeRatio',
      getValue: (fund) => (fund.sharpe_ratio ?? fund['Sharpe Ratio - 3 Year'] ?? fund['Sharpe Ratio'] ?? 0),
      sortable: true,
      width: '110px',
      tooltip: 'Risk-adjusted return: higher is better',
      render: (value) => (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.25rem',
          color: value >= 1.0 ? '#16a34a' : value >= 0.5 ? '#f59e0b' : '#dc2626'
        }}>
          <Shield size={14} />
          {value?.toFixed(2)}
        </div>
      )
    },
    beta: {
      label: 'Beta',
      key: 'beta',
      getValue: (fund) => (fund.beta ?? fund['Beta - 5 Year'] ?? 0),
      sortable: true,
      width: '80px',
      tooltip: 'Market sensitivity: 1.0 ≈ market risk',
      render: (value) => (
        <div style={{
          textAlign: 'center',
          color: value <= 0.8 ? '#16a34a' : value <= 1.2 ? '#f59e0b' : '#dc2626'
        }}>
          {value?.toFixed(2)}
        </div>
      )
    },
    stdDev3Y: {
      label: 'Std Dev (3Y)',
      key: 'stdDev3Y',
      getValue: (fund) => fund.standard_deviation_3y ?? null,
      sortable: true,
      width: '100px',
      tooltip: 'Volatility (3-year): lower is better',
      render: (value) => (
        <div style={{ textAlign: 'center' }}>
          {value == null ? '—' : `${value.toFixed(2)}%`}
        </div>
      )
    },
    stdDev5Y: {
      label: 'Std Dev (5Y)',
      key: 'stdDev5Y',
      getValue: (fund) => fund.standard_deviation_5y ?? null,
      sortable: true,
      width: '100px',
      tooltip: 'Volatility (5-year): lower is better',
      render: (value) => (
        <div style={{ textAlign: 'center' }}>
          {value == null ? '—' : `${value.toFixed(2)}%`}
        </div>
      )
    },
    upCaptureRatio: {
      label: 'Up Capture',
      key: 'upCaptureRatio',
      getValue: (fund) => (fund.up_capture_ratio ?? fund['Up Capture Ratio (Morningstar Standard) - 3 Year'] ?? fund['Up Capture Ratio'] ?? 0),
      sortable: true,
      width: '100px',
      tooltip: 'Capture in up markets: higher is better',
      render: (value) => (
        <div style={{
          textAlign: 'center',
          color: value >= 100 ? '#16a34a' : '#f59e0b'
        }}>
          {value?.toFixed(1)}%
        </div>
      )
    },
    downCaptureRatio: {
      label: 'Down Capture',
      key: 'downCaptureRatio',
      getValue: (fund) => (fund.down_capture_ratio ?? fund['Down Capture Ratio (Morningstar Standard) - 3 Year'] ?? fund['Down Capture Ratio'] ?? 0),
      sortable: true,
      width: '110px',
      tooltip: 'Capture in down markets: lower is better',
      render: (value) => (
        <div style={{
          textAlign: 'center',
          color: value <= 100 ? '#16a34a' : '#dc2626'
        }}>
          {value?.toFixed(1)}%
        </div>
      )
    },
    managerTenure: {
      label: 'Manager Tenure',
      key: 'managerTenure',
      getValue: (fund) => fund['Longest Manager Tenure (Years)'] || fund.manager_tenure || 0,
      sortable: true,
      width: '120px',
      tooltip: 'Longest manager tenure (years)',
      render: (value) => (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.25rem'
        }}>
          <Calendar size={14} />
          {value?.toFixed(1)} yrs
        </div>
      )
    },
    recommended: {
      label: 'Recommended',
      key: 'recommended',
      getValue: (fund) => fund.is_recommended || fund.recommended || false,
      sortable: true,
      width: '110px',
      tooltip: 'Firm-designated recommended fund',
      render: (value) => (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.25rem'
        }}>
          {value ? (
            <>
              <Star size={16} style={{ color: '#f59e0b', fill: '#f59e0b' }} />
              <span style={{ 
                fontSize: '0.75rem', 
                fontWeight: '600', 
                color: '#f59e0b',
                textTransform: 'uppercase',
                letterSpacing: '0.025em'
              }}>
                REC
              </span>
            </>
          ) : (
            <span style={{ 
              fontSize: '0.75rem', 
              color: '#9ca3af',
              textTransform: 'uppercase',
              letterSpacing: '0.025em'
            }}>
              --
            </span>
          )}
        </div>
      )
    }
  }), [historyCache, chartPeriod]);

  // Table-side safety: if selectedColumns is empty or contains unknown keys, fall back to defaults
  React.useEffect(() => {
    const validKeys = Object.keys(columnDefinitions);
    const filtered = (selectedColumns || []).filter(k => validKeys.includes(k));
    if (filtered.length === 0) {
      setSelectedColumns(DEFAULT_TABLE_COLUMNS.filter(k => validKeys.includes(k)));
    } else if (filtered.length !== (selectedColumns || []).length) {
      setSelectedColumns(filtered);
    }
  }, [selectedColumns, columnDefinitions, DEFAULT_TABLE_COLUMNS]);

  // Multi-column sorting
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sortedFunds = useMemo(() => {
    if (!funds || funds.length === 0 || sortConfig.length === 0) return funds || [];

    return [...funds].sort((a, b) => {
      for (const { key, direction } of sortConfig) {
        const column = columnDefinitions[key];
        if (!column) continue;

        const aValue = column.getValue(a);
        const bValue = column.getValue(b);

        let comparison = 0;
        if (aValue < bValue) comparison = -1;
        if (aValue > bValue) comparison = 1;

        if (comparison !== 0) {
          return direction === 'desc' ? -comparison : comparison;
        }
      }
      return 0;
    });
  }, [funds, sortConfig, columnDefinitions]);

  // Kick off preload when sparkline column is visible
  useEffect(() => {
    if (!selectedColumns.includes('sparkline')) return;
    preloadSparklineData(sortedFunds, historyCache);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedColumns, sortedFunds]);

  // Handle column sorting
  const handleSort = useCallback((columnKey) => {
    setSortConfig(prev => {
      const existingIndex = prev.findIndex(config => config.key === columnKey);
      
      if (existingIndex >= 0) {
        // Column already in sort - cycle through directions or remove
        const currentDirection = prev[existingIndex].direction;
        if (currentDirection === 'asc') {
          // Change to desc
          return prev.map((config, index) => 
            index === existingIndex ? { ...config, direction: 'desc' } : config
          );
        } else {
          // Remove from sort
          return prev.filter((_, index) => index !== existingIndex);
        }
      } else {
        // Add new sort column
        return [{ key: columnKey, direction: 'asc' }, ...prev.slice(0, 2)]; // Max 3 sort columns
      }
    });
  }, []);

  // Get sort indicator for column
  const getSortIndicator = (columnKey) => {
    const sortIndex = sortConfig.findIndex(config => config.key === columnKey);
    if (sortIndex === -1) return <ArrowUpDown size={14} style={{ opacity: 0.3 }} />;

    const config = sortConfig[sortIndex];
    const Icon = config.direction === 'asc' ? ChevronUp : ChevronDown;

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
        <Icon size={14} aria-hidden />
        {sortConfig.length > 1 && (
          <span style={{
            fontSize: '0.75rem',
            backgroundColor: '#3b82f6',
            color: 'white',
            borderRadius: '50%',
            width: '16px',
            height: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {sortIndex + 1}
          </span>
        )}
      </div>
    );
  };

  // Column visibility toggle
  // const toggleColumn = useCallback((columnKey) => {
  //   setSelectedColumns(prev => 
  //     prev.includes(columnKey) 
  //       ? prev.filter(col => col !== columnKey)
  //       : [...prev, columnKey]
  //   );
  // }, []);

  const percentColumnKeys = useMemo(() => new Set([
    'ytdReturn', 'oneYearReturn', 'threeYearReturn', 'fiveYearReturn',
    'expenseRatio', 'standardDeviation', 'upCaptureRatio', 'downCaptureRatio'
  ]), []);

  const buildExportColumns = useCallback(() => {
    return selectedColumns
      .filter((key) => key !== 'sparkline')
      .map((key) => {
        const def = columnDefinitions[key];
        if (!def) return null;
        return {
          key,
          label: def.label,
          isPercent: percentColumnKeys.has(key),
          valueGetter: (fund) => def.getValue?.(fund)
        };
      })
      .filter(Boolean);
  }, [selectedColumns, columnDefinitions, percentColumnKeys]);

  const exportCSV = useCallback(() => {
    const rowsCount = sortedFunds?.length || 0;
    if (shouldConfirmLargeExport(rowsCount)) {
      const proceed = window.confirm(`You are exporting ${rowsCount.toLocaleString()} rows. Continue?`);
      if (!proceed) return;
    }
    const cols = buildExportColumns();
    const metaSort = (sortConfig || []).map(cfg => ({
      key: cfg.key,
      direction: cfg.direction,
      label: columnDefinitions[cfg.key]?.label || cfg.key
    }));
    
    // Enhanced metadata for export
    const enhancedMetadata = {
      chartPeriod,
      exportedAt: new Date(),
      selectedColumns: selectedColumns.join(', '),
      totalColumns: Object.keys(columnDefinitions).length,
      visibleColumns: selectedColumns.length,
      sortOrder: metaSort.map(s => `${s.label} (${s.direction})`).join(', ') || 'Default',
      asOf: window.__AS_OF_MONTH__ || 'Latest',
      visualRefresh: ENABLE_VISUAL_REFRESH,
      kind: 'Enhanced Table Export'
    };
    
    const blob = exportTableCSV({
      funds: sortedFunds,
      columns: cols,
      sortConfig: metaSort,
      metadata: enhancedMetadata
    });
    const filename = formatExportFilename({ scope: 'table_enhanced', asOf: (window.__AS_OF_MONTH__ || null), ext: 'csv' });
    downloadFile(blob, filename, 'text/csv;charset=utf-8');
  }, [sortedFunds, sortConfig, chartPeriod, columnDefinitions, buildExportColumns, selectedColumns]);

  useEffect(() => {
    if (typeof registerExportHandler === 'function') {
      registerExportHandler(() => exportCSV());
    }
  }, [registerExportHandler, exportCSV]);

  if (!funds || funds.length === 0) {
    return (
      <div style={{
        padding: '3rem',
        textAlign: 'center',
        backgroundColor: '#f9fafb',
        borderRadius: '0.5rem',
        border: '1px solid #e5e7eb'
      }}>
        <Eye size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
        <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.5rem', color: '#374151' }}>
          No Funds Found
        </h3>
        <p style={{ color: '#6b7280' }} title="Empty state guidance">
          No funds match your current filter criteria. Adjust filters, clear them, or seed missing funds via Admin.
        </p>
        <div style={{ marginTop: '0.75rem', display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap' }}>
          <button
            onClick={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent('NAVIGATE_APP', { detail: { tab: 'admin' } })); }}
            style={{ padding: '0.5rem 1rem', border: '1px solid #3b82f6', borderRadius: '0.375rem', backgroundColor: 'white', color: '#3b82f6', fontSize: '0.875rem', cursor: 'pointer' }}
          >
            Go to Importer
          </button>
          <button
            onClick={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent('NAVIGATE_APP', { detail: { tab: 'admin' } })); window.dispatchEvent(new CustomEvent('NAVIGATE_ADMIN', { detail: { subtab: 'data' } })); setTimeout(()=>{ try { window.dispatchEvent(new CustomEvent('LOAD_SAMPLE_DATA')); } catch {} }, 300); }}
            style={{ padding: '0.5rem 1rem', border: '1px solid #6b7280', borderRadius: '0.375rem', backgroundColor: 'white', color: '#374151', fontSize: '0.875rem', cursor: 'pointer' }}
          >
            Use sample data
          </button>
          </div>
        </div>
      </div>
    );
  }

  const ENABLE_VISUAL_REFRESH = (process.env.REACT_APP_ENABLE_VISUAL_REFRESH || 'false') === 'true';
  const isLargeTable = sortedFunds.length > 100;
  
  return (
    <div 
      className={ENABLE_VISUAL_REFRESH && isLargeTable ? 'fund-table-optimized' : ''}
      style={{ backgroundColor: 'white', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}
    >
      {/* Table Controls */}
      <div style={{ 
        padding: '1rem', 
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h3 style={{ fontWeight: '600', margin: 0 }}>
            Fund Analysis ({sortedFunds.length} funds)
          </h3>
          
          {sortConfig.length > 0 && (
            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
              Sorted by: {sortConfig.map(config => {
                const column = columnDefinitions[config.key];
                return `${column?.label} (${config.direction})`;
              }).join(', ')}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Render preset selector if provided */}
          {presetSelector}
          
          <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={exportCSV}
            disabled={sortedFunds.length === 0}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid #3b82f6',
              borderRadius: '0.375rem',
              backgroundColor: sortedFunds.length > 0 ? '#3b82f6' : '#93c5fd',
              color: 'white',
              fontSize: '0.875rem',
              cursor: sortedFunds.length > 0 ? 'pointer' : 'not-allowed'
            }}
          >
            Export CSV
          </button>
          <button
            onClick={() => {
              const rec = sortedFunds.filter(f => f.is_recommended || f.recommended);
              if (rec.length === 0) return;
              const keys = ['symbol','name','assetClass','score','oneYearReturn','expenseRatio'];
              const cols = keys.filter(k => columnDefinitions[k]).map(k => ({
                key: k,
                label: columnDefinitions[k].label,
                isPercent: false,
                valueGetter: (fund) => columnDefinitions[k].getValue(fund)
              }));
              const blob = exportTableCSV({ funds: rec, columns: cols, sortConfig: [], metadata: { exportedAt: new Date(), kind: 'recommended_list' } });
              const filename = formatExportFilename({ scope: 'table_recommended', asOf: (window.__AS_OF_MONTH__ || null), ext: 'csv' });
              downloadFile(blob, filename, 'text/csv;charset=utf-8');
            }}
            disabled={sortedFunds.filter(f => f.is_recommended || f.recommended).length === 0}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid #10b981',
              borderRadius: '0.375rem',
              backgroundColor: (sortedFunds.filter(f => f.is_recommended || f.recommended).length > 0) ? '#10b981' : '#a7f3d0',
              color: 'white',
              fontSize: '0.875rem',
              cursor: (sortedFunds.filter(f => f.is_recommended || f.recommended).length > 0) ? 'pointer' : 'not-allowed'
            }}
            title="Export Recommended List"
          >
            Export Recommended
          </button>
          <button
            onClick={() => setSortConfig([])}
            disabled={sortConfig.length === 0}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.375rem',
              backgroundColor: 'white',
              color: sortConfig.length > 0 ? '#374151' : '#9ca3af',
              fontSize: '0.875rem',
              cursor: sortConfig.length > 0 ? 'pointer' : 'not-allowed'
            }}
          >
            Clear Sort
          </button>
          
          <select
            onChange={(e) => {
              if (e.target.value) {
                const columns = e.target.value.split(',');
                setSelectedColumns(columns);
              }
            }}
            style={{
              padding: '0.5rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.375rem',
              fontSize: '0.875rem'
            }}
          >
            <option value="">Column Sets...</option>
            <option value="symbol,name,assetClass,score,ytdReturn,oneYearReturn,expenseRatio,recommended">Basic View</option>
            <option value="symbol,name,score,ytdReturn,oneYearReturn,threeYearReturn,fiveYearReturn,sharpeRatio,expenseRatio">Performance Focus</option>
            <option value="symbol,name,score,expenseRatio,sharpeRatio,beta,standardDeviation,upCaptureRatio,downCaptureRatio">Risk Analysis</option>
            <option value="symbol,name,assetClass,score,ytdReturn,oneYearReturn,threeYearReturn,fiveYearReturn,expenseRatio,sharpeRatio,beta,managerTenure,recommended">Complete View</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f9fafb' }}>
              {selectedColumns.map(columnKey => {
                const column = columnDefinitions[columnKey];
                if (!column) return null;

                return (
                  <th
                    key={columnKey}
                    onClick={() => column.sortable && handleSort(columnKey)}
                    style={{
                      padding: '0.75rem 0.5rem',
                      textAlign: 'left',
                      fontWeight: '600',
                      fontSize: '0.875rem',
                      color: '#374151',
                      cursor: column.sortable ? 'pointer' : 'default',
                      userSelect: 'none',
                      borderBottom: '2px solid #e5e7eb',
                      position: 'sticky',
                      top: 0,
                      backgroundColor: '#f9fafb',
                      minWidth: column.width,
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      transform: 'translateX(0)',
                      opacity: 1
                    }}
                    title={column.tooltip || ''}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {column.label}
                      {['score','sharpeRatio','standardDeviation','expenseRatio','upCaptureRatio','downCaptureRatio'].includes(columnKey) && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); try { window.dispatchEvent(new CustomEvent('OPEN_METHODOLOGY')); } catch {} }}
                          title="What is this metric?"
                          style={{ border:'none', background:'transparent', cursor:'pointer', color:'#6b7280' }}
                        >
                          <Info size={14} aria-hidden />
                        </button>
                      )}
                      {column.sortable && getSortIndicator(columnKey)}
                    </div>
                  </th>
                );
              })}
              <th style={{
                padding: '0.75rem 0.5rem',
                textAlign: 'center',
                fontWeight: '600',
                fontSize: '0.875rem',
                color: '#374151',
                borderBottom: '2px solid #e5e7eb',
                position: 'sticky',
                top: 0,
                backgroundColor: '#f9fafb',
                width: '60px'
              }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedFunds.map((fund, index) => {
              const symbol = fund.Symbol || fund.symbol;
              const isHovered = hoveredFund === symbol;
              
              return (
                <tr
                  key={symbol || index}
                  onMouseEnter={() => setHoveredFund(symbol)}
                  onMouseLeave={() => setHoveredFund(null)}
                  style={{
                    backgroundColor: isHovered ? '#f8fafc' : 'white',
                    borderBottom: '1px solid #e5e7eb',
                    transition: 'background-color 0.2s'
                  }}
                >
                  {selectedColumns.map(columnKey => {
                    const column = columnDefinitions[columnKey];
                    if (!column) return null;

                    const value = column.getValue(fund);

                    return (
                      <td
                        key={columnKey}
                        style={{
                          padding: '0.75rem 0.5rem',
                          fontSize: '0.875rem',
                          verticalAlign: 'middle',
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          transform: 'translateX(0)',
                          opacity: 1
                        }}
                      >
                        {column.render ? column.render(value, fund, sortedFunds) : value}
                      </td>
                    );
                  })}
                  <td style={{
                    padding: '0.75rem 0.5rem',
                    textAlign: 'center',
                    verticalAlign: 'middle'
                  }}>
                    <button
                      onClick={() => onFundSelect && onFundSelect(fund)}
                      style={{
                        padding: '0.25rem',
                        border: 'none',
                        borderRadius: '0.25rem',
                        backgroundColor: 'transparent',
                        color: '#6b7280',
                        cursor: 'pointer'
                      }}
                      title="View fund details"
                    >
                      <MoreHorizontal size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Table Footer */}
      <div style={{ 
        padding: '1rem', 
        borderTop: '1px solid #e5e7eb',
        backgroundColor: '#f9fafb',
        fontSize: '0.875rem',
        color: '#6b7280',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          Showing {sortedFunds.length} funds
        </div>
        
        <div style={{ display: 'flex', gap: '1rem' }}>
          <span>
            Avg Score: {(sortedFunds.reduce((sum, fund) => sum + (fund.scores?.final || fund.score || 0), 0) / sortedFunds.length).toFixed(2)}
          </span>
          <span>
            Recommended: {sortedFunds.filter(fund => fund.is_recommended || fund.recommended).length}
          </span>
        </div>
      </div>
    </div>
  );
};

export default EnhancedFundTable;