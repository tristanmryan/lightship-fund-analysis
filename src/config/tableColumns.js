import React from 'react';
import { TrendingUp, TrendingDown, Star } from 'lucide-react';

/**
 * Unified Table Column Definition System
 * 
 * This module provides standardized column definitions for all fund table components,
 * reducing code duplication and ensuring consistent data access patterns, formatting,
 * and rendering across the application.
 * 
 * Features:
 * - Standardized fallback patterns for fund data fields
 * - Consistent formatting and display logic
 * - Extensible column groups and configurations
 * - Support for custom renderers, tooltips, and sorting
 * - Integration with existing score badges, sparklines, and special formatting
 */

// Visual refresh feature flag
const ENABLE_VISUAL_REFRESH = (process.env.REACT_APP_ENABLE_VISUAL_REFRESH || 'false') === 'true';

/**
 * Base column definition structure
 * @param {Object} config - Column configuration
 * @returns {Object} Standardized column definition
 */
export function createColumnDefinition(config) {
  const {
    key,
    label,
    fallbackKeys = [],
    sortable = true,
    width = null,
    tooltip = null,
    formatter = null,
    renderer = null,
    sortFunction = null,
    exportFormatter = null,
    filterType = 'text',
    alignment = 'left',
    isNumeric = false,
    isPercent = false,
    isCurrency = false,
    decimals = 2,
    showTrend = false,
    customClasses = []
  } = config;

  return {
    key,
    label,
    fallbackKeys,
    sortable,
    width,
    tooltip,
    alignment,
    isNumeric,
    isPercent,
    isCurrency,
    decimals,
    showTrend,
    filterType,
    customClasses,

    // Data accessor with fallback pattern support
    getValue: (fund) => getValueWithFallbacks(fund, key, fallbackKeys),

    // Formatted value for display
    getFormattedValue: (fund) => {
      const rawValue = getValueWithFallbacks(fund, key, fallbackKeys);
      return formatter ? formatter(rawValue, fund) : formatValue(rawValue, config);
    },

    // Custom renderer (JSX component)
    render: renderer,

    // Export-specific formatter
    getExportValue: (fund) => {
      const rawValue = getValueWithFallbacks(fund, key, fallbackKeys);
      return exportFormatter ? exportFormatter(rawValue, fund) : rawValue;
    },

    // Custom sort function
    sort: sortFunction || defaultSortFunction,

    // Column metadata
    meta: {
      type: getColumnType(config),
      category: getColumnCategory(key),
      isSpecial: Boolean(renderer),
      hasCustomSort: Boolean(sortFunction)
    }
  };
}

/**
 * Get value from fund with fallback pattern support
 */
function getValueWithFallbacks(fund, primaryKey, fallbackKeys = []) {
  if (!fund || typeof fund !== 'object') return null;

  // Try primary key first
  if (fund[primaryKey] !== undefined && fund[primaryKey] !== null) {
    return fund[primaryKey];
  }

  // Try fallback keys
  for (const fallbackKey of fallbackKeys) {
    if (fund[fallbackKey] !== undefined && fund[fallbackKey] !== null) {
      return fund[fallbackKey];
    }
  }

  return null;
}

/**
 * Format value based on column configuration
 */
function formatValue(value, config) {
  if (value === null || value === undefined) {
    return config.isNumeric ? '—' : '';
  }

  const { isPercent, isCurrency, decimals, isNumeric } = config;

  if (isNumeric) {
    const numValue = Number(value);
    if (isNaN(numValue)) return '—';

    if (isPercent) {
      return `${numValue.toFixed(decimals)}%`;
    }
    
    if (isCurrency) {
      return `$${numValue.toFixed(decimals)}`;
    }

    return numValue.toFixed(decimals);
  }

  return String(value);
}

/**
 * Default sort function for columns
 */
function defaultSortFunction(a, b, column) {
  const aValue = column.getValue(a);
  const bValue = column.getValue(b);

  // Handle null/undefined values
  if (aValue === null || aValue === undefined) {
    if (bValue === null || bValue === undefined) return 0;
    return 1; // Nulls go to end
  }
  if (bValue === null || bValue === undefined) {
    return -1; // Nulls go to end
  }

  // Numeric comparison for numeric columns
  if (column.isNumeric) {
    const aNum = Number(aValue);
    const bNum = Number(bValue);
    if (!isNaN(aNum) && !isNaN(bNum)) {
      return aNum - bNum;
    }
  }

  // String comparison
  const aStr = String(aValue).toLowerCase();
  const bStr = String(bValue).toLowerCase();
  return aStr.localeCompare(bStr);
}

/**
 * Determine column type based on configuration
 */
function getColumnType(config) {
  if (config.isPercent) return 'percentage';
  if (config.isCurrency) return 'currency';
  if (config.isNumeric) return 'number';
  if (config.renderer) return 'component';
  return 'text';
}

/**
 * Determine column category for grouping
 */
function getColumnCategory(key) {
  const categoryMap = {
    // Basic info
    symbol: 'basic',
    ticker: 'basic', 
    name: 'basic',
    assetClass: 'basic',
    
    // Performance
    ytdReturn: 'performance',
    oneYearReturn: 'performance',
    threeYearReturn: 'performance',
    fiveYearReturn: 'performance',
    tenYearReturn: 'performance',
    sparkline: 'performance',
    
    // Risk metrics
    sharpeRatio: 'risk',
    beta: 'risk',
    alpha: 'risk',
    standardDeviation: 'risk',
    stdDev3Y: 'risk',
    stdDev5Y: 'risk',
    upCaptureRatio: 'risk',
    downCaptureRatio: 'risk',
    
    // Cost metrics
    expenseRatio: 'cost',
    managementFee: 'cost',
    
    // Special/computed
    score: 'special',
    percentile: 'special',
    recommended: 'special',
    managerTenure: 'metadata'
  };

  return categoryMap[key] || 'other';
}

/**
 * Utility functions for score colors and badges
 */
export function getScoreColor(score) {
  if (score >= 8.5) return '#22c55e'; // Green
  if (score >= 7.5) return '#84cc16'; // Light green
  if (score >= 6.5) return '#eab308'; // Yellow
  if (score >= 5.5) return '#f97316'; // Orange
  if (score >= 4.5) return '#ef4444'; // Red
  return '#6b7280'; // Gray for very low scores
}

export function getScoreBadgeStyle(score) {
  return {
    padding: '0.25rem 0.5rem',
    borderRadius: '0.375rem',
    textAlign: 'center',
    color: 'white',
    fontWeight: '600',
    backgroundColor: getScoreColor(score),
    minWidth: '40px',
    fontSize: '0.875rem'
  };
}

/**
 * Trend indicator component
 */
function TrendIndicator({ value, showIcon = true, showValue = true }) {
  const isPositive = value >= 0;
  const color = isPositive ? '#16a34a' : '#dc2626';
  
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.25rem',
      color
    }}>
      {showIcon && (isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />)}
      {showValue && `${value?.toFixed(2)}%`}
    </div>
  );
}

// =============================================================================
// FUND INFO COLUMNS
// =============================================================================

export const SYMBOL_COLUMN = createColumnDefinition({
  key: 'symbol',
  label: 'Symbol',
  fallbackKeys: ['ticker', 'Symbol'],
  width: '80px',
  tooltip: 'Fund ticker symbol',
  alignment: 'center',
  customClasses: ['font-mono', 'font-medium'],
  renderer: (value, fund) => (
    <div style={{ 
      fontFamily: 'monospace', 
      fontWeight: '600',
      textAlign: 'center'
    }}>
      {value || '—'}
    </div>
  )
});

export const NAME_COLUMN = createColumnDefinition({
  key: 'name',
  label: 'Fund Name',
  fallbackKeys: ['fund_name', 'Product Name', 'displayName'],
  width: '200px',
  tooltip: 'Full fund name',
  renderer: (value, fund) => {
    const displayName = value || fund.ticker || '—';
    const maxLength = 35;
    const truncated = displayName.length > maxLength 
      ? `${displayName.substring(0, maxLength)}...` 
      : displayName;
    
    return (
      <div title={displayName} style={{ 
        fontWeight: '500',
        lineHeight: '1.2'
      }}>
        {truncated}
      </div>
    );
  }
});

export const ASSET_CLASS_COLUMN = createColumnDefinition({
  key: 'assetClass',
  label: 'Asset Class',
  fallbackKeys: ['asset_class_name', 'asset_class', 'Asset Class'],
  width: '140px',
  tooltip: 'Investment asset class category',
  renderer: (value, fund) => (
    <span style={{
      padding: '0.125rem 0.375rem',
      borderRadius: '0.25rem',
      backgroundColor: ENABLE_VISUAL_REFRESH ? '#f3f4f6' : 'transparent',
      fontSize: '0.8rem',
      color: '#374151',
      border: ENABLE_VISUAL_REFRESH ? 'none' : '1px solid #d1d5db'
    }}>
      {value || 'Unassigned'}
    </span>
  )
});

// =============================================================================
// PERFORMANCE COLUMNS  
// =============================================================================

export const YTD_RETURN_COLUMN = createColumnDefinition({
  key: 'ytdReturn',
  label: 'YTD Return',
  fallbackKeys: ['ytd_return', 'Total Return - YTD (%)'],
  width: '100px',
  tooltip: 'Year-to-date total return',
  isNumeric: true,
  isPercent: true,
  showTrend: true,
  renderer: (value, fund) => <TrendIndicator value={value} />
});

export const ONE_YEAR_RETURN_COLUMN = createColumnDefinition({
  key: 'oneYearReturn', 
  label: '1Y Return',
  fallbackKeys: ['one_year_return', 'Total Return - 1 Year (%)', '1 Year'],
  width: '100px',
  tooltip: 'Total return over the last 12 months',
  isNumeric: true,
  isPercent: true,
  showTrend: true,
  renderer: (value, fund, allFunds) => {
    // Show benchmark delta if available
    const delta = fund.benchmark_delta_1y;
    return (
      <div>
        <TrendIndicator value={value} />
        {delta && (
          <div style={{ 
            fontSize: '0.7rem', 
            color: '#6b7280',
            textAlign: 'center',
            marginTop: '1px'
          }}>
            {delta > 0 ? '+' : ''}{delta.toFixed(1)}
          </div>
        )}
      </div>
    );
  }
});

export const THREE_YEAR_RETURN_COLUMN = createColumnDefinition({
  key: 'threeYearReturn',
  label: '3Y Return',
  fallbackKeys: ['three_year_return', 'Annualized Total Return - 3 Year (%)'],
  width: '100px',
  tooltip: 'Annualized return over 3 years',
  isNumeric: true,
  isPercent: true,
  showTrend: true,
  renderer: (value, fund) => <TrendIndicator value={value} />
});

export const FIVE_YEAR_RETURN_COLUMN = createColumnDefinition({
  key: 'fiveYearReturn',
  label: '5Y Return',
  fallbackKeys: ['five_year_return', 'Annualized Total Return - 5 Year (%)'],
  width: '100px',
  tooltip: 'Annualized return over 5 years',
  isNumeric: true,
  isPercent: true,
  showTrend: true,
  renderer: (value, fund) => <TrendIndicator value={value} />
});

export const TEN_YEAR_RETURN_COLUMN = createColumnDefinition({
  key: 'tenYearReturn',
  label: '10Y Return',
  fallbackKeys: ['ten_year_return', 'Annualized Total Return - 10 Year (%)'],
  width: '100px',
  tooltip: 'Annualized return over 10 years',
  isNumeric: true,
  isPercent: true,
  showTrend: true,
  renderer: (value, fund) => <TrendIndicator value={value} />
});

export const SPARKLINE_COLUMN = createColumnDefinition({
  key: 'sparkline',
  label: 'Trend',
  sortable: false,
  width: '120px',
  tooltip: 'Performance trend chart',
  renderer: (_, fund, allFunds, { historyCache, chartPeriod, Sparkline }) => {
    // This renderer requires context from the parent component
    // Implementation would be provided by the component using this column
    if (!Sparkline) return <div style={{ textAlign: 'center', color: '#9ca3af' }}>—</div>;
    
    const key = fund.ticker || fund.Symbol;
    const rows = historyCache?.[key] || [];
    let picked = rows;
    
    // Filter data based on chart period
    const clamp = (arr, n) => arr.slice(Math.max(0, arr.length - n));
    switch (chartPeriod) {
      case '1M': picked = clamp(rows, 21); break;
      case '3M': picked = clamp(rows, 63); break;
      case '6M': picked = clamp(rows, 126); break;
      case 'YTD': {
        const year = new Date().getFullYear();
        picked = rows.filter(r => new Date(r.date).getFullYear() === year);
        break;
      }
      case '1Y':
      default: picked = clamp(rows, 252); break;
    }
    
    const values = picked.map(r => r.one_year_return ?? r.ytd_return ?? null);
    return React.createElement(Sparkline, { values });
  }
});

// =============================================================================
// RISK METRICS COLUMNS
// =============================================================================

export const SHARPE_RATIO_COLUMN = createColumnDefinition({
  key: 'sharpeRatio',
  label: 'Sharpe Ratio',
  fallbackKeys: ['sharpe_ratio', 'Sharpe Ratio - 3 Year'],
  width: '100px',
  tooltip: 'Risk-adjusted return measure (higher is better)',
  isNumeric: true,
  decimals: 2,
  renderer: (value, fund) => (
    <div style={{ textAlign: 'center', fontWeight: '500' }}>
      {value?.toFixed(2) || '—'}
    </div>
  )
});

export const BETA_COLUMN = createColumnDefinition({
  key: 'beta',
  label: 'Beta',
  fallbackKeys: ['beta', 'Beta - 5 Year'],
  width: '80px',
  tooltip: 'Market sensitivity measure (1.0 = market level)',
  isNumeric: true,
  decimals: 2,
  renderer: (value, fund) => {
    const betaValue = Number(value);
    let color = '#6b7280';
    if (betaValue > 1.2) color = '#ef4444'; // High risk
    else if (betaValue > 0.8) color = '#22c55e'; // Normal
    else if (betaValue > 0) color = '#3b82f6'; // Low risk
    
    return (
      <div style={{ textAlign: 'center', color, fontWeight: '500' }}>
        {value?.toFixed(2) || '—'}
      </div>
    );
  }
});

export const ALPHA_COLUMN = createColumnDefinition({
  key: 'alpha',
  label: 'Alpha',
  fallbackKeys: ['alpha', 'Alpha - 5 Year'],
  width: '80px',
  tooltip: 'Excess return vs benchmark',
  isNumeric: true,
  decimals: 2,
  showTrend: true,
  renderer: (value, fund) => {
    if (value === null || value === undefined) return <div style={{ textAlign: 'center' }}>—</div>;
    return <TrendIndicator value={value} showIcon={false} />;
  }
});

export const STD_DEV_3Y_COLUMN = createColumnDefinition({
  key: 'stdDev3Y',
  label: 'Std Dev (3Y)',
  fallbackKeys: ['standard_deviation_3y', 'standard_deviation', 'Standard Deviation'],
  width: '100px',
  tooltip: '3-year standard deviation (volatility measure)',
  isNumeric: true,
  isPercent: true,
  decimals: 2
});

export const STD_DEV_5Y_COLUMN = createColumnDefinition({
  key: 'stdDev5Y',
  label: 'Std Dev (5Y)',
  fallbackKeys: ['standard_deviation_5y', 'Standard Deviation - 5 Year'],
  width: '100px', 
  tooltip: '5-year standard deviation (volatility measure)',
  isNumeric: true,
  isPercent: true,
  decimals: 2
});

export const UP_CAPTURE_COLUMN = createColumnDefinition({
  key: 'upCaptureRatio',
  label: 'Up Capture',
  fallbackKeys: ['up_capture_ratio', 'Up Capture Ratio (Morningstar Standard) - 3 Year'],
  width: '100px',
  tooltip: 'Percentage of up-market returns captured',
  isNumeric: true,
  isPercent: true,
  decimals: 1
});

export const DOWN_CAPTURE_COLUMN = createColumnDefinition({
  key: 'downCaptureRatio',
  label: 'Down Capture', 
  fallbackKeys: ['down_capture_ratio', 'Down Capture Ratio (Morningstar Standard) - 3 Year'],
  width: '100px',
  tooltip: 'Percentage of down-market losses captured (lower is better)',
  isNumeric: true,
  isPercent: true,
  decimals: 1
});

// =============================================================================
// COST METRICS COLUMNS
// =============================================================================

export const EXPENSE_RATIO_COLUMN = createColumnDefinition({
  key: 'expenseRatio',
  label: 'Expense Ratio',
  fallbackKeys: ['expense_ratio', 'Net Exp Ratio (%)', 'Expense Ratio'],
  width: '110px',
  tooltip: 'Annual fund costs (lower is better)',
  isNumeric: true,
  isPercent: true,
  decimals: 3,
  renderer: (value, fund) => {
    const expenseValue = Number(value);
    let color = '#6b7280';
    let indicator = '';
    
    if (expenseValue <= 0.25) {
      color = '#22c55e';
      indicator = '●'; // Low cost
    } else if (expenseValue <= 0.75) {
      color = '#eab308';
      indicator = '●'; // Medium cost
    } else if (expenseValue > 0.75) {
      color = '#ef4444';
      indicator = '●'; // High cost
    }
    
    return (
      <div style={{ 
        textAlign: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.25rem'
      }}>
        <span style={{ color }}>{indicator}</span>
        <span>{value?.toFixed(3)}%</span>
      </div>
    );
  }
});

export const MANAGER_TENURE_COLUMN = createColumnDefinition({
  key: 'managerTenure',
  label: 'Manager Tenure',
  fallbackKeys: ['manager_tenure', 'Manager Tenure', 'Tenure'],
  width: '120px',
  tooltip: 'Years of current manager experience',
  isNumeric: true,
  decimals: 1,
  formatter: (value) => value ? `${Number(value).toFixed(1)} years` : '—'
});

// =============================================================================
// SPECIAL COLUMNS
// =============================================================================

export const SCORE_COLUMN = createColumnDefinition({
  key: 'score',
  label: 'Score',
  fallbackKeys: ['score_final', 'scores.final', 'final_score'],
  width: '80px',
  tooltip: 'Composite quality score (0-100)',
  isNumeric: true,
  decimals: 1,
  getValue: (fund) => {
    // Handle nested score objects
    if (fund.scores?.final !== undefined) return fund.scores.final;
    return getValueWithFallbacks(fund, 'score_final', ['score', 'final_score']);
  },
  renderer: (value, fund, allFunds, { ScoreTooltip }) => {
    const scoreValue = Number(value) || 0;
    
    const badge = (
      <div style={getScoreBadgeStyle(scoreValue)}>
        {scoreValue.toFixed(1)}
      </div>
    );

    // If ScoreTooltip component is provided, wrap the badge
    if (ScoreTooltip) {
      return React.createElement(ScoreTooltip, { fund, score: scoreValue }, badge);
    }
    
    return badge;
  }
});

export const PERCENTILE_COLUMN = createColumnDefinition({
  key: 'percentile',
  label: 'Percentile',
  fallbackKeys: ['score_percentile', 'percentile_rank'],
  width: '90px',
  tooltip: 'Percentile ranking within asset class',
  isNumeric: true,
  decimals: 0,
  renderer: (value, fund) => {
    if (!value) return <div style={{ textAlign: 'center' }}>—</div>;
    
    const percentileValue = Number(value);
    let color = '#6b7280';
    let suffix = '';
    
    if (percentileValue >= 90) {
      color = '#22c55e';
      suffix = 'th'; // Top 10%
    } else if (percentileValue >= 75) {
      color = '#84cc16';
      suffix = 'th'; // Top 25%
    } else if (percentileValue >= 50) {
      color = '#eab308';
      suffix = 'th'; // Above median
    } else {
      color = '#f97316';
      suffix = 'th'; // Below median
    }
    
    return (
      <div style={{ 
        textAlign: 'center',
        color,
        fontWeight: '500'
      }}>
        {Math.round(percentileValue)}{suffix}
      </div>
    );
  }
});

export const RECOMMENDED_COLUMN = createColumnDefinition({
  key: 'recommended',
  label: 'Recommended',
  fallbackKeys: ['is_recommended'],
  width: '110px',
  tooltip: 'Firm-designated recommended fund',
  renderer: (value, fund) => {
    const isRecommended = value || fund.is_recommended;
    
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.25rem'
      }}>
        {isRecommended ? (
          <>
            <Star size={16} style={{ color: '#f59e0b', fill: '#f59e0b' }} />
            <span style={{ 
              fontSize: '0.75rem', 
              color: '#f59e0b',
              fontWeight: '600'
            }}>
              YES
            </span>
          </>
        ) : (
          <span style={{ 
            fontSize: '0.75rem', 
            color: '#9ca3af'
          }}>
            —
          </span>
        )}
      </div>
    );
  }
});

// =============================================================================
// COLUMN GROUPS AND CONFIGURATIONS
// =============================================================================

export const BASIC_COLUMNS = [
  SYMBOL_COLUMN,
  NAME_COLUMN, 
  ASSET_CLASS_COLUMN,
  SCORE_COLUMN,
  YTD_RETURN_COLUMN,
  EXPENSE_RATIO_COLUMN,
  RECOMMENDED_COLUMN
];

export const EXTENDED_COLUMNS = [
  ...BASIC_COLUMNS,
  ONE_YEAR_RETURN_COLUMN,
  THREE_YEAR_RETURN_COLUMN,
  SHARPE_RATIO_COLUMN,
  BETA_COLUMN,
  SPARKLINE_COLUMN
];

export const ADVANCED_COLUMNS = [
  ...EXTENDED_COLUMNS,
  FIVE_YEAR_RETURN_COLUMN,
  TEN_YEAR_RETURN_COLUMN,
  ALPHA_COLUMN,
  STD_DEV_3Y_COLUMN,
  STD_DEV_5Y_COLUMN,
  UP_CAPTURE_COLUMN,
  DOWN_CAPTURE_COLUMN,
  PERCENTILE_COLUMN,
  MANAGER_TENURE_COLUMN
];

// Column registry for easy lookup
export const COLUMN_REGISTRY = {
  // Basic info
  symbol: SYMBOL_COLUMN,
  name: NAME_COLUMN,
  assetClass: ASSET_CLASS_COLUMN,
  
  // Performance
  ytdReturn: YTD_RETURN_COLUMN,
  oneYearReturn: ONE_YEAR_RETURN_COLUMN,
  threeYearReturn: THREE_YEAR_RETURN_COLUMN,
  fiveYearReturn: FIVE_YEAR_RETURN_COLUMN,
  tenYearReturn: TEN_YEAR_RETURN_COLUMN,
  sparkline: SPARKLINE_COLUMN,
  
  // Risk metrics
  sharpeRatio: SHARPE_RATIO_COLUMN,
  beta: BETA_COLUMN,
  alpha: ALPHA_COLUMN,
  stdDev3Y: STD_DEV_3Y_COLUMN,
  stdDev5Y: STD_DEV_5Y_COLUMN,
  upCaptureRatio: UP_CAPTURE_COLUMN,
  downCaptureRatio: DOWN_CAPTURE_COLUMN,
  
  // Cost metrics
  expenseRatio: EXPENSE_RATIO_COLUMN,
  managerTenure: MANAGER_TENURE_COLUMN,
  
  // Special columns
  score: SCORE_COLUMN,
  percentile: PERCENTILE_COLUMN,
  recommended: RECOMMENDED_COLUMN
};

// Preset configurations
export const COLUMN_PRESETS = {
  core: {
    name: 'Core View',
    description: '7 essential columns for basic analysis',
    columns: BASIC_COLUMNS.map(col => col.key)
  },
  extended: {
    name: 'Extended View',
    description: '12 key columns including performance trends',
    columns: EXTENDED_COLUMNS.map(col => col.key)
  },
  advanced: {
    name: 'Advanced View',
    description: 'Comprehensive view with all metrics',
    columns: ADVANCED_COLUMNS.map(col => col.key)
  },
  performance: {
    name: 'Performance Focus',
    description: 'Performance and returns focused view',
    columns: ['symbol', 'name', 'assetClass', 'ytdReturn', 'oneYearReturn', 'threeYearReturn', 'fiveYearReturn', 'sparkline', 'recommended']
  },
  risk: {
    name: 'Risk Analysis',
    description: 'Risk metrics and volatility focus',
    columns: ['symbol', 'name', 'assetClass', 'score', 'sharpeRatio', 'beta', 'alpha', 'stdDev3Y', 'stdDev5Y', 'upCaptureRatio', 'downCaptureRatio']
  },
  cost: {
    name: 'Cost Analysis',
    description: 'Cost-focused metrics and efficiency',
    columns: ['symbol', 'name', 'assetClass', 'expenseRatio', 'ytdReturn', 'sharpeRatio', 'score', 'recommended']
  }
};

// Category groupings for column selection UI
export const COLUMN_CATEGORIES = {
  basic: {
    name: 'Basic Info',
    columns: ['symbol', 'name', 'assetClass']
  },
  performance: {
    name: 'Performance',
    columns: ['ytdReturn', 'oneYearReturn', 'threeYearReturn', 'fiveYearReturn', 'tenYearReturn', 'sparkline']
  },
  risk: {
    name: 'Risk Metrics', 
    columns: ['sharpeRatio', 'beta', 'alpha', 'stdDev3Y', 'stdDev5Y', 'upCaptureRatio', 'downCaptureRatio']
  },
  cost: {
    name: 'Cost & Efficiency',
    columns: ['expenseRatio', 'managerTenure']
  },
  special: {
    name: 'Special Metrics',
    columns: ['score', 'percentile', 'recommended']
  }
};

/**
 * Utility functions for working with column definitions
 */

export function getColumnByKey(key) {
  return COLUMN_REGISTRY[key] || null;
}

export function getColumnsByKeys(keys) {
  return keys.map(key => COLUMN_REGISTRY[key]).filter(Boolean);
}

export function getColumnsByCategory(category) {
  const categoryConfig = COLUMN_CATEGORIES[category];
  return categoryConfig ? getColumnsByKeys(categoryConfig.columns) : [];
}

export function getPresetColumns(presetName) {
  const preset = COLUMN_PRESETS[presetName];
  return preset ? getColumnsByKeys(preset.columns) : [];
}

/**
 * Export default configuration
 */
export default {
  COLUMN_REGISTRY,
  COLUMN_PRESETS,
  COLUMN_CATEGORIES,
  BASIC_COLUMNS,
  EXTENDED_COLUMNS,
  ADVANCED_COLUMNS,
  createColumnDefinition,
  getColumnByKey,
  getColumnsByKeys,
  getColumnsByCategory,
  getPresetColumns,
  getScoreColor,
  getScoreBadgeStyle
};