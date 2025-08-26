import { useState, useMemo, useCallback } from 'react';

/**
 * Table sorting hook with multi-column support and stable sort keys
 * Supports both fund.ytd_return and fund['Total Return - YTD (%)'] patterns
 */
export function useTableSort({
  data = [],
  initialSortConfig = null,
  multiColumn = false,
  maxSortColumns = 3,
  columnDefinitions = {},
  onSortChange = null
} = {}) {
  const [sortConfig, setSortConfig] = useState(() => {
    if (initialSortConfig) {
      return Array.isArray(initialSortConfig) ? initialSortConfig : [initialSortConfig];
    }
    return [];
  });

  const handleSort = useCallback((key, direction = null) => {
    setSortConfig(prevConfig => {
      let newConfig;

      if (!multiColumn) {
        // Single column sorting
        const currentSort = prevConfig.find(sort => sort.key === key);
        const nextDirection = direction || getNextDirection(currentSort?.direction);
        
        if (nextDirection === null) {
          // Remove sorting
          newConfig = [];
        } else {
          newConfig = [{ key, direction: nextDirection }];
        }
      } else {
        // Multi-column sorting
        const existingIndex = prevConfig.findIndex(sort => sort.key === key);
        
        if (existingIndex >= 0) {
          // Update existing sort
          const currentSort = prevConfig[existingIndex];
          const nextDirection = direction || getNextDirection(currentSort.direction);
          
          if (nextDirection === null) {
            // Remove this sort column
            newConfig = prevConfig.filter((_, index) => index !== existingIndex);
          } else {
            // Update direction
            newConfig = [...prevConfig];
            newConfig[existingIndex] = { key, direction: nextDirection };
          }
        } else {
          // Add new sort column
          const nextDirection = direction || 'asc';
          newConfig = [...prevConfig, { key, direction: nextDirection }];
          
          // Limit number of sort columns
          if (newConfig.length > maxSortColumns) {
            newConfig = newConfig.slice(-maxSortColumns);
          }
        }
      }

      // Trigger callback if provided
      if (onSortChange) {
        onSortChange(newConfig);
      }

      return newConfig;
    });
  }, [multiColumn, maxSortColumns, onSortChange]);

  const clearSort = useCallback(() => {
    setSortConfig([]);
    if (onSortChange) {
      onSortChange([]);
    }
  }, [onSortChange]);

  const getSortedData = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0 || sortConfig.length === 0) {
      return data;
    }

    return [...data].sort((a, b) => {
      for (const { key, direction } of sortConfig) {
        const columnDef = columnDefinitions[key];
        let aValue, bValue;

        if (columnDef && typeof columnDef.getValue === 'function') {
          // Use column definition accessor
          aValue = columnDef.getValue(a);
          bValue = columnDef.getValue(b);
        } else {
          // Use fallback patterns for fund data
          aValue = getValueWithFallback(a, key);
          bValue = getValueWithFallback(b, key);
        }

        const comparison = compareValues(aValue, bValue, direction);
        if (comparison !== 0) {
          return comparison;
        }
      }
      return 0; // Stable sort - maintain original order for equal values
    });
  }, [data, sortConfig, columnDefinitions]);

  const getSortStatus = useCallback((key) => {
    const sortIndex = sortConfig.findIndex(sort => sort.key === key);
    if (sortIndex === -1) {
      return { direction: null, priority: null };
    }
    return {
      direction: sortConfig[sortIndex].direction,
      priority: multiColumn ? sortIndex + 1 : null
    };
  }, [sortConfig, multiColumn]);

  return {
    sortConfig,
    sortedData: getSortedData,
    handleSort,
    clearSort,
    getSortStatus,
    setSortConfig
  };
}

/**
 * Get next direction in sort cycle: null -> asc -> desc -> null
 */
function getNextDirection(currentDirection) {
  switch (currentDirection) {
    case null:
    case undefined:
      return 'asc';
    case 'asc':
      return 'desc';
    case 'desc':
      return null;
    default:
      return 'asc';
  }
}

/**
 * Get value from fund data with fallback patterns
 * Handles both fund.ytd_return and fund['Total Return - YTD (%)'] patterns
 */
function getValueWithFallback(fund, key) {
  if (!fund || typeof fund !== 'object') {
    return null;
  }

  // Direct property access first
  if (fund[key] !== undefined) {
    return fund[key];
  }

  // Common fallback patterns based on audit findings
  const fallbackMap = {
    ytdReturn: ['ytd_return', 'Total Return - YTD (%)', 'YTD Return'],
    ytd_return: ['ytd_return', 'Total Return - YTD (%)', 'YTD Return'],
    oneYearReturn: ['one_year_return', 'Total Return - 1 Year (%)', '1 Year', 'One Year Return'],
    one_year_return: ['one_year_return', 'Total Return - 1 Year (%)', '1 Year'],
    threeYearReturn: ['three_year_return', 'Annualized Total Return - 3 Year (%)', '3 Year'],
    three_year_return: ['three_year_return', 'Annualized Total Return - 3 Year (%)', '3 Year'],
    fiveYearReturn: ['five_year_return', 'Annualized Total Return - 5 Year (%)', '5 Year'],
    five_year_return: ['five_year_return', 'Annualized Total Return - 5 Year (%)', '5 Year'],
    tenYearReturn: ['ten_year_return', 'Annualized Total Return - 10 Year (%)', '10 Year'],
    ten_year_return: ['ten_year_return', 'Annualized Total Return - 10 Year (%)', '10 Year'],
    expenseRatio: ['expense_ratio', 'Net Exp Ratio (%)', 'Expense Ratio'],
    expense_ratio: ['expense_ratio', 'Net Exp Ratio (%)', 'Expense Ratio'],
    sharpeRatio: ['sharpe_ratio', 'Sharpe Ratio - 3 Year', 'Sharpe Ratio'],
    sharpe_ratio: ['sharpe_ratio', 'Sharpe Ratio - 3 Year', 'Sharpe Ratio'],
    standardDeviation: ['standard_deviation', 'standard_deviation_3y', 'Standard Deviation'],
    standard_deviation: ['standard_deviation', 'standard_deviation_3y', 'Standard Deviation'],
    standard_deviation_3y: ['standard_deviation_3y', 'Standard Deviation - 3 Year'],
    standard_deviation_5y: ['standard_deviation_5y', 'Standard Deviation - 5 Year'],
    beta: ['beta', 'Beta - 5 Year', 'Beta'],
    alpha: ['alpha', 'Alpha - 5 Year', 'Alpha'],
    upCaptureRatio: ['up_capture_ratio', 'Up Capture Ratio (Morningstar Standard) - 3 Year'],
    up_capture_ratio: ['up_capture_ratio', 'Up Capture Ratio (Morningstar Standard) - 3 Year'],
    downCaptureRatio: ['down_capture_ratio', 'Down Capture Ratio (Morningstar Standard) - 3 Year'],
    down_capture_ratio: ['down_capture_ratio', 'Down Capture Ratio (Morningstar Standard) - 3 Year'],
    managerTenure: ['manager_tenure', 'Manager Tenure', 'Tenure'],
    manager_tenure: ['manager_tenure', 'Manager Tenure', 'Tenure'],
    assetClass: ['asset_class', 'asset_class_name', 'Asset Class', 'assetClass'],
    asset_class: ['asset_class', 'asset_class_name', 'Asset Class'],
    asset_class_name: ['asset_class_name', 'asset_class', 'Asset Class'],
    symbol: ['ticker', 'symbol', 'Symbol'],
    ticker: ['ticker', 'symbol', 'Symbol'],
    name: ['name', 'fund_name', 'Fund Name'],
    fund_name: ['fund_name', 'name', 'Fund Name'],
    score: ['score_final', 'score', 'final_score'],
    score_final: ['score_final', 'score', 'final_score'],
    final_score: ['final_score', 'score_final', 'score'],
    recommended: ['is_recommended', 'recommended'],
    is_recommended: ['is_recommended', 'recommended']
  };

  const fallbacks = fallbackMap[key] || [key];
  
  for (const fallbackKey of fallbacks) {
    if (fund[fallbackKey] !== undefined) {
      return fund[fallbackKey];
    }
  }

  return null;
}

/**
 * Compare two values for sorting
 */
function compareValues(a, b, direction) {
  const multiplier = direction === 'desc' ? -1 : 1;

  // Handle null/undefined values
  if (a === null || a === undefined) {
    if (b === null || b === undefined) return 0;
    return 1 * multiplier; // Nulls go to end
  }
  if (b === null || b === undefined) {
    return -1 * multiplier; // Nulls go to end
  }

  // Handle boolean values
  if (typeof a === 'boolean' && typeof b === 'boolean') {
    return (a === b) ? 0 : (a ? -1 : 1) * multiplier;
  }

  // Convert to numbers if both can be converted
  const aNum = Number(a);
  const bNum = Number(b);
  
  if (!isNaN(aNum) && !isNaN(bNum)) {
    return (aNum - bNum) * multiplier;
  }

  // String comparison
  const aStr = String(a).toLowerCase();
  const bStr = String(b).toLowerCase();
  
  if (aStr < bStr) return -1 * multiplier;
  if (aStr > bStr) return 1 * multiplier;
  return 0;
}

/**
 * Create a column definition for common fund fields
 */
export function createColumnDefinition(key, options = {}) {
  const {
    label = key,
    isPercent = false,
    decimals = 2,
    fallbacks = []
  } = options;

  return {
    key,
    label,
    getValue: (fund) => {
      const allKeys = [key, ...fallbacks];
      for (const k of allKeys) {
        if (fund[k] !== undefined) {
          return fund[k];
        }
      }
      return null;
    },
    isPercent,
    decimals
  };
}

/**
 * Standard column definitions for fund tables
 */
export const STANDARD_COLUMNS = {
  symbol: createColumnDefinition('symbol', {
    label: 'Symbol',
    fallbacks: ['ticker', 'Symbol']
  }),
  name: createColumnDefinition('name', {
    label: 'Fund Name',
    fallbacks: ['fund_name', 'Fund Name']
  }),
  assetClass: createColumnDefinition('asset_class', {
    label: 'Asset Class',
    fallbacks: ['asset_class_name', 'Asset Class', 'assetClass']
  }),
  score: createColumnDefinition('score_final', {
    label: 'Score',
    fallbacks: ['score', 'final_score'],
    decimals: 1
  }),
  ytdReturn: createColumnDefinition('ytd_return', {
    label: 'YTD Return',
    fallbacks: ['Total Return - YTD (%)', 'YTD Return'],
    isPercent: true
  }),
  oneYearReturn: createColumnDefinition('one_year_return', {
    label: '1Y Return',
    fallbacks: ['Total Return - 1 Year (%)', '1 Year'],
    isPercent: true
  }),
  threeYearReturn: createColumnDefinition('three_year_return', {
    label: '3Y Return',
    fallbacks: ['Annualized Total Return - 3 Year (%)', '3 Year'],
    isPercent: true
  }),
  fiveYearReturn: createColumnDefinition('five_year_return', {
    label: '5Y Return',
    fallbacks: ['Annualized Total Return - 5 Year (%)', '5 Year'],
    isPercent: true
  }),
  expenseRatio: createColumnDefinition('expense_ratio', {
    label: 'Expense Ratio',
    fallbacks: ['Net Exp Ratio (%)', 'Expense Ratio'],
    isPercent: true,
    decimals: 3
  }),
  sharpeRatio: createColumnDefinition('sharpe_ratio', {
    label: 'Sharpe Ratio',
    fallbacks: ['Sharpe Ratio - 3 Year', 'Sharpe Ratio']
  }),
  beta: createColumnDefinition('beta', {
    label: 'Beta',
    fallbacks: ['Beta - 5 Year']
  }),
  standardDeviation: createColumnDefinition('standard_deviation', {
    label: 'Std Dev',
    fallbacks: ['standard_deviation_3y', 'Standard Deviation'],
    isPercent: true
  }),
  managerTenure: createColumnDefinition('manager_tenure', {
    label: 'Manager Tenure',
    fallbacks: ['Manager Tenure', 'Tenure'],
    decimals: 1
  }),
  recommended: createColumnDefinition('is_recommended', {
    label: 'Recommended',
    fallbacks: ['recommended']
  })
};