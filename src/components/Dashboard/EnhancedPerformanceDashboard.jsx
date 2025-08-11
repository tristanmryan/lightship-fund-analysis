// src/components/Dashboard/EnhancedPerformanceDashboard.jsx
import React, { useState, useMemo, useCallback } from 'react';
import { 
  TrendingUp, BarChart3, Grid, Table, RefreshCw, Download,
  Filter, Target, AlertCircle, Info
} from 'lucide-react';
import AdvancedFilters from './AdvancedFilters';
import EnhancedFundTable from './EnhancedFundTable';
import PerformanceHeatmap from './PerformanceHeatmap';
import TopBottomPerformers from './TopBottomPerformers';
import AssetClassOverview from './AssetClassOverview';
import FundDetailsModal from '../FundDetailsModal';
import ComparisonPanel from './ComparisonPanel';
import DrilldownCards from './DrilldownCards';
import preferencesService from '../../services/preferencesService';
import fundService from '../../services/fundService';

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
  const [availableMonths, setAvailableMonths] = useState([]);

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
        setAvailableMonths(months || []);
        // Initialize global endDate for sparklines
        window.__AS_OF_MONTH__ = (asOfMonthProp || '') || null;
      } catch {}
      if (!cancelled) setInitialized(true);
    })();
    return () => { cancelled = true; };
  }, [asOfMonthProp, onAsOfMonthChange]);

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
    const assetClasses = new Set(filteredFunds.map(f => f['Asset Class'] || f.asset_class).filter(Boolean));
    
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

  // Render view mode content
  const renderViewContent = () => {
    switch (viewMode) {
      case 'table':
        // Sanitize any saved/initial table state before passing to table
        const sanitized = sanitizeTableState(
          { sortConfig: initialTableState.sortConfig, selectedColumns: initialTableState.selectedColumns },
          VALID_COLUMN_KEYS,
          DEFAULT_TABLE_COLUMNS
        );
        return (
          <EnhancedFundTable 
            funds={filteredFunds}
            onFundSelect={handleFundSelect}
            chartPeriod={chartPeriod}
            initialSortConfig={sanitized.sortConfig}
            initialSelectedColumns={sanitized.selectedColumns}
            onStateChange={handleTableStateChange}
            registerExportHandler={(fn) => { tableExportRef.current = fn; }}
          />
        );
      
      case 'heatmap':
        return (
          <div className="card">
            <PerformanceHeatmap funds={filteredFunds} />
          </div>
        );
      
      case 'overview':
        return (
          <div className="card">
            <AssetClassOverview funds={filteredFunds} />
          </div>
        );
      
      case 'performers':
        return (
          <div className="card">
            <TopBottomPerformers funds={filteredFunds} />
          </div>
        );
      
      case 'compare':
        return (
          <div className="card">
            <ComparisonPanel funds={filteredFunds} />
          </div>
        );
      case 'details':
        return (
          <div className="card" style={{ padding: 16 }}>
            {selectedFund ? (
              <DrilldownCards fund={selectedFund} funds={filteredFunds} />
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

  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center',
        padding: '3rem',
        backgroundColor: '#f9fafb',
        borderRadius: '0.5rem',
        border: '1px solid #e5e7eb'
      }}>
        <RefreshCw size={48} style={{ animation: 'spin 1s linear infinite', marginBottom: '1rem', color: '#3b82f6' }} />
        <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.5rem', color: '#374151' }}>
          Loading Fund Data
        </h3>
        <p style={{ color: '#6b7280' }}>
          Please wait while we fetch the latest performance data...
        </p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      {/* Header */}
      <div style={{
        backgroundColor: 'white',
        borderBottom: '1px solid #e5e7eb',
        padding: '1.5rem 2rem',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
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
          </div>
          
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
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
                {availableMonths.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <button
              onClick={onRefresh}
              disabled={isLoading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                backgroundColor: 'white',
                color: '#374151',
                fontSize: '0.875rem',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.5 : 1
              }}
            >
              <RefreshCw size={16} style={{ animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
              Refresh Data
            </button>
            
            <button
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
                cursor: filteredFunds.length > 0 && tableExportRef.current ? 'pointer' : 'not-allowed',
                opacity: filteredFunds.length > 0 && tableExportRef.current ? 1 : 0.6
              }}
              onClick={() => tableExportRef.current && filteredFunds.length > 0 && tableExportRef.current()}
              disabled={!tableExportRef.current || filteredFunds.length === 0}
            >
              <Download size={16} />
              Export Results
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding: '2rem' }}>
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

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default EnhancedPerformanceDashboard;