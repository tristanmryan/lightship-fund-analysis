import React, { useState, useMemo, useCallback } from 'react';
import { 
  Download, Filter, Eye, Star, TrendingUp, TrendingDown, 
  Shield, DollarSign, Calendar, BarChart3, Target
} from 'lucide-react';
import FundTableHeader from './FundTableHeader';
import FundTableRow from './FundTableRow';
import FundStatusBadge from './FundStatusBadge';
import { getScoreColor } from '../../services/scoring';
import { exportTableCSV, downloadFile, formatExportFilename } from '../../services/exportService';

/**
 * Modern Fund Table Component
 * Provides clean, professional fund display with modern visual indicators
 */
const ModernFundTable = ({
  funds = [],
  onFundSelect,
  chartPeriod = '1Y',
  initialSortConfig = null,
  initialSelectedColumns = null,
  onStateChange,
  registerExportHandler
}) => {
  // State management
  const [sortConfig, setSortConfig] = useState(() => initialSortConfig || [
    { key: 'score', direction: 'desc' }
  ]);
  const [selectedColumns, setSelectedColumns] = useState(() => initialSelectedColumns || [
    'symbol', 'name', 'assetClass', 'score', 'ytdReturn', 'oneYearReturn', 
    'threeYearReturn', 'expenseRatio', 'sharpeRatio'
  ]);
  const [hoveredFund, setHoveredFund] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  // Default and valid column configurations
  const DEFAULT_TABLE_COLUMNS = [
    'symbol', 'name', 'assetClass', 'score', 'ytdReturn', 'oneYearReturn', 
    'threeYearReturn', 'expenseRatio', 'sharpeRatio'
  ];

  const VALID_COLUMN_KEYS = [
    'symbol', 'name', 'assetClass', 'score', 'ytdReturn', 'oneYearReturn', 
    'threeYearReturn', 'fiveYearReturn', 'expenseRatio', 'sharpeRatio', 
    'beta', 'standardDeviation', 'upCaptureRatio', 'downCaptureRatio', 
    'managerTenure'
  ];

  // Column definitions with modern rendering
  const columnDefinitions = useMemo(() => ({
    symbol: {
      label: 'Symbol',
      key: 'symbol',
      getValue: (fund) => fund.ticker || fund.symbol || fund.Symbol,
      sortable: true,
      width: '120px',
      tooltip: 'Fund ticker symbol'
    },
    name: {
      label: 'Fund Name',
      key: 'name',
      getValue: (fund) => fund.name || fund['Product Name'] || fund.displayName || fund.ticker,
      sortable: true,
      width: '280px',
      tooltip: 'Official fund name'
    },
    assetClass: {
      label: 'Asset Class',
      key: 'assetClass',
      getValue: (fund) => fund.asset_class_name || fund.asset_class || fund['Asset Class'],
      sortable: true,
      width: '160px',
      tooltip: 'Normalized asset class',
      render: (value) => (
        <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          {value}
        </div>
      )
    },
    score: {
      label: 'Score',
      key: 'score',
      getValue: (fund) => fund.scores?.final || fund.score || 0,
      sortable: true,
      width: '100px',
      tooltip: '0–100 weighted Z-score within asset class',
      render: (value) => (
        <div
          className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-sm font-semibold text-white"
          style={{ backgroundColor: getScoreColor(value) }}
        >
          {value?.toFixed(1) || '0.0'}
        </div>
      )
    },
    ytdReturn: {
      label: 'YTD Return',
      key: 'ytdReturn',
      getValue: (fund) => (fund.ytd_return ?? fund['Total Return - YTD (%)'] ?? 0),
      sortable: true,
      width: '120px',
      tooltip: 'Year-to-date total return',
      render: (value) => (
        <div className="flex items-center justify-center gap-1 text-sm font-medium">
          {value >= 0 ? (
            <TrendingUp size={14} className="text-green-600" />
          ) : (
            <TrendingDown size={14} className="text-red-600" />
          )}
          <span className={value >= 0 ? 'text-green-700' : 'text-red-700'}>
            {value?.toFixed(2)}%
          </span>
        </div>
      )
    },
    oneYearReturn: {
      label: '1Y Return',
      key: 'oneYearReturn',
      getValue: (fund) => (fund.one_year_return ?? fund['Total Return - 1 Year (%)'] ?? fund['1 Year'] ?? 0),
      sortable: true,
      width: '120px',
      tooltip: 'Total return over the last 12 months',
      render: (value) => (
        <div className="flex items-center justify-center gap-1 text-sm font-medium">
          {value >= 0 ? (
            <TrendingUp size={14} className="text-green-600" />
          ) : (
            <TrendingDown size={14} className="text-red-600" />
          )}
          <span className={value >= 0 ? 'text-green-700' : 'text-red-700'}>
            {value?.toFixed(2)}%
          </span>
        </div>
      )
    },
    threeYearReturn: {
      label: '3Y Return',
      key: 'threeYearReturn',
      getValue: (fund) => (fund.three_year_return ?? fund['Annualized Total Return - 3 Year (%)'] ?? fund['3 Year'] ?? 0),
      sortable: true,
      width: '120px',
      tooltip: 'Annualized return over the last 3 years',
      render: (value) => (
        <div className="flex items-center justify-center gap-1 text-sm font-medium">
          {value >= 0 ? (
            <TrendingUp size={14} className="text-green-600" />
          ) : (
            <TrendingDown size={14} className="text-red-600" />
          )}
          <span className={value >= 0 ? 'text-green-700' : 'text-red-700'}>
            {value?.toFixed(2)}%
          </span>
        </div>
      )
    },
    fiveYearReturn: {
      label: '5Y Return',
      key: 'fiveYearReturn',
      getValue: (fund) => (fund.five_year_return ?? fund['Annualized Total Return - 5 Year (%)'] ?? fund['5 Year'] ?? 0),
      sortable: true,
      width: '120px',
      tooltip: 'Annualized return over the last 5 years',
      render: (value) => (
        <div className="flex items-center justify-center gap-1 text-sm font-medium">
          {value >= 0 ? (
            <TrendingUp size={14} className="text-green-600" />
          ) : (
            <TrendingDown size={14} className="text-red-600" />
          )}
          <span className={value >= 0 ? 'text-green-700' : 'text-red-700'}>
            {value?.toFixed(2)}%
          </span>
        </div>
      )
    },
    expenseRatio: {
      label: 'Expense Ratio',
      key: 'expenseRatio',
      getValue: (fund) => (fund.expense_ratio ?? fund['Net Exp Ratio (%)'] ?? 0),
      sortable: true,
      width: '140px',
      tooltip: 'Annual fund costs: lower is better',
      render: (value) => (
        <div className="flex items-center justify-center gap-1 text-sm font-medium">
          <DollarSign size={14} className="text-gray-600" />
          <span className={
            value <= 0.5 ? 'text-green-700' : 
            value <= 1.0 ? 'text-yellow-700' : 'text-red-700'
          }>
            {value?.toFixed(2)}%
          </span>
        </div>
      )
    },
    sharpeRatio: {
      label: 'Sharpe Ratio',
      key: 'sharpeRatio',
      getValue: (fund) => (fund.sharpe_ratio ?? fund['Sharpe Ratio - 3 Year'] ?? fund['Sharpe Ratio'] ?? 0),
      sortable: true,
      width: '130px',
      tooltip: 'Risk-adjusted return: higher is better',
      render: (value) => (
        <div className="flex items-center justify-center gap-1 text-sm font-medium">
          <Shield size={14} className="text-gray-600" />
          <span className={
            value >= 1.0 ? 'text-green-700' : 
            value >= 0.5 ? 'text-yellow-700' : 'text-red-700'
          }>
            {value?.toFixed(2)}
          </span>
        </div>
      )
    },
    beta: {
      label: 'Beta',
      key: 'beta',
      getValue: (fund) => (fund.beta ?? fund['Beta - 5 Year'] ?? 0),
      sortable: true,
      width: '100px',
      tooltip: 'Market sensitivity: 1.0 ≈ market risk',
      render: (value) => (
        <div className="text-center text-sm font-medium">
          <span className={
            value <= 0.8 ? 'text-green-700' : 
            value <= 1.2 ? 'text-yellow-700' : 'text-red-700'
          }>
            {value?.toFixed(2)}
          </span>
        </div>
      )
    },
    standardDeviation: {
      label: 'Std Dev (3Y)',
      key: 'standardDeviation',
      getValue: (fund) => fund.standard_deviation_3y ?? null,
      sortable: true,
      width: '120px',
      tooltip: 'Volatility (3-year): lower is better',
      render: (value) => (
        <div className="text-center text-sm font-medium text-gray-700">
          {value == null ? '—' : `${value.toFixed(2)}%`}
        </div>
      )
    },
    upCaptureRatio: {
      label: 'Up Capture',
      key: 'upCaptureRatio',
      getValue: (fund) => (fund.up_capture_ratio ?? fund['Up Capture Ratio (Morningstar Standard) - 3 Year'] ?? fund['Up Capture Ratio'] ?? 0),
      sortable: true,
      width: '120px',
      tooltip: 'Capture in up markets: higher is better',
      render: (value) => (
        <div className="text-center text-sm font-medium">
          <span className={value >= 100 ? 'text-green-700' : 'text-yellow-700'}>
            {value?.toFixed(1)}%
          </span>
        </div>
      )
    },
    downCaptureRatio: {
      label: 'Down Capture',
      key: 'downCaptureRatio',
      getValue: (fund) => (fund.down_capture_ratio ?? fund['Down Capture Ratio (Morningstar Standard) - 3 Year'] ?? fund['Down Capture Ratio'] ?? 0),
      sortable: true,
      width: '140px',
      tooltip: 'Capture in down markets: lower is better',
      render: (value) => (
        <div className="text-center text-sm font-medium">
          <span className={value <= 100 ? 'text-green-700' : 'text-red-700'}>
            {value?.toFixed(1)}%
          </span>
        </div>
      )
    },
    managerTenure: {
      label: 'Manager Tenure',
      key: 'managerTenure',
      getValue: (fund) => fund['Longest Manager Tenure (Years)'] || fund.manager_tenure || 0,
      sortable: true,
      width: '140px',
      tooltip: 'Longest manager tenure (years)',
      render: (value) => (
        <div className="flex items-center justify-center gap-1 text-sm font-medium text-gray-700">
          <Calendar size={14} />
          {value?.toFixed(1)} yrs
        </div>
      )
    }
  }), []);

  // Multi-column sorting
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

  // Handle column sorting
  const handleSort = useCallback((columnKey) => {
    setSortConfig(prev => {
      const existingIndex = prev.findIndex(config => config.key === columnKey);
      
      if (existingIndex >= 0) {
        const currentDirection = prev[existingIndex].direction;
        if (currentDirection === 'asc') {
          return prev.map((config, index) => 
            index === existingIndex ? { ...config, direction: 'desc' } : config
          );
        } else {
          return prev.filter((_, index) => index !== existingIndex);
        }
      } else {
        return [{ key: columnKey, direction: 'asc' }, ...prev.slice(0, 2)];
      }
    });
  }, []);

  // Export functionality
  const exportCSV = useCallback(() => {
    const exportColumns = selectedColumns
      .filter(key => columnDefinitions[key])
      .map(key => ({
        key,
        label: columnDefinitions[key].label,
        valueGetter: (fund) => columnDefinitions[key].getValue(fund)
      }));

    const blob = exportTableCSV({
      funds: sortedFunds,
      columns: exportColumns,
      sortConfig,
      metadata: { exportedAt: new Date() }
    });

    const filename = formatExportFilename({ scope: 'table', ext: 'csv' });
    downloadFile(blob, filename, 'text/csv;charset=utf-8');
  }, [sortedFunds, selectedColumns, sortConfig, columnDefinitions]);

  // Register export handler
  React.useEffect(() => {
    if (typeof registerExportHandler === 'function') {
      registerExportHandler(exportCSV);
    }
  }, [registerExportHandler, exportCSV]);

  // Emit state changes
  React.useEffect(() => {
    if (typeof onStateChange === 'function') {
      onStateChange({ sortConfig, selectedColumns });
    }
  }, [sortConfig, selectedColumns, onStateChange]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    if (!sortedFunds || sortedFunds.length === 0) return null;

    const scores = sortedFunds.map(f => f.scores?.final || f.score || 0).filter(s => s > 0);
    const recommendedCount = sortedFunds.filter(f => f.is_recommended || f.recommended || f.isRecommended).length;
    const benchmarkCount = sortedFunds.filter(f => f.isBenchmark || f.is_benchmark).length;
    const avgScore = scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;

    return {
      totalFunds: sortedFunds.length,
      recommendedCount,
      benchmarkCount,
      avgScore
    };
  }, [sortedFunds]);

  if (!funds || funds.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <Eye className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No Funds Found</h3>
        <p className="mt-1 text-sm text-gray-500">
          No funds match your current filter criteria.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* Table Controls */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Fund Analysis ({sortedFunds.length} funds)
            </h3>
            
            {summaryStats && (
              <div className="flex items-center gap-6 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-emerald-600" />
                  <span>{summaryStats.recommendedCount} recommended</span>
                </div>
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-blue-600" />
                  <span>{summaryStats.benchmarkCount} benchmarks</span>
                </div>
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-gray-600" />
                  <span>Avg Score: {summaryStats.avgScore.toFixed(1)}</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Filter className="h-4 w-4" />
              Filters
            </button>
            
            <button
              onClick={exportCSV}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Sort Summary */}
        {sortConfig.length > 0 && (
          <div className="mt-3 text-sm text-gray-600">
            Sorted by: {sortConfig.map((config, index) => {
              const column = columnDefinitions[config.key];
              return (
                <span key={config.key} className="inline-flex items-center gap-1">
                  {index > 0 && <span>, </span>}
                  <span className="font-medium">{column?.label}</span>
                  <span className="text-gray-500">({config.direction})</span>
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <FundTableHeader
            columns={selectedColumns}
            columnDefinitions={columnDefinitions}
            sortConfig={sortConfig}
            onSort={handleSort}
          />
          
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedFunds.map((fund, index) => (
              <FundTableRow
                key={fund.ticker || fund.Symbol || fund.symbol || index}
                fund={fund}
                columns={selectedColumns}
                columnDefinitions={columnDefinitions}
                isHovered={hoveredFund === (fund.ticker || fund.Symbol || fund.symbol)}
                onFundSelect={onFundSelect}
                onMouseEnter={() => setHoveredFund(fund.ticker || fund.Symbol || fund.symbol)}
                onMouseLeave={() => setHoveredFund(null)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Table Footer */}
      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div>
            Showing {sortedFunds.length} funds
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSortConfig([])}
              disabled={sortConfig.length === 0}
              className="text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              Clear Sort
            </button>
            
            <select
              value={selectedColumns.join(',')}
              onChange={(e) => {
                if (e.target.value) {
                  const columns = e.target.value.split(',');
                  setSelectedColumns(columns);
                }
              }}
              className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white"
            >
              <option value="symbol,name,assetClass,score,ytdReturn,oneYearReturn,expenseRatio">Basic View</option>
              <option value="symbol,name,score,ytdReturn,oneYearReturn,threeYearReturn,fiveYearReturn,sharpeRatio,expenseRatio">Performance Focus</option>
              <option value="symbol,name,score,expenseRatio,sharpeRatio,beta,standardDeviation,upCaptureRatio,downCaptureRatio">Risk Analysis</option>
              <option value="symbol,name,assetClass,score,ytdReturn,oneYearReturn,threeYearReturn,fiveYearReturn,expenseRatio,sharpeRatio,beta,managerTenure">Complete View</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModernFundTable; 