import { useState, useMemo, useCallback, useEffect, useRef } from 'react';

/**
 * Table filtering hook with debounced search and multiple filter types
 * Supports search, asset class, recommendation status, and custom filters
 */
export function useTableFilter({
  data = [],
  searchableFields = ['name', 'ticker', 'symbol'],
  debounceMs = 300,
  onFilterChange = null,
  initialFilters = {}
} = {}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [filters, setFilters] = useState(initialFilters);
  
  const debounceRef = useRef();

  // Debounce search term
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, debounceMs);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchTerm, debounceMs]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const updateFilter = useCallback((key, value) => {
    setFilters(prevFilters => {
      const newFilters = { ...prevFilters };
      
      if (value === null || value === undefined || value === '' || value === 'all') {
        delete newFilters[key];
      } else {
        newFilters[key] = value;
      }

      if (onFilterChange) {
        onFilterChange({ ...newFilters, search: debouncedSearchTerm });
      }

      return newFilters;
    });
  }, [onFilterChange, debouncedSearchTerm]);

  const clearFilters = useCallback(() => {
    setSearchTerm('');
    setDebouncedSearchTerm('');
    setFilters({});
    
    if (onFilterChange) {
      onFilterChange({});
    }
  }, [onFilterChange]);

  const clearFilter = useCallback((key) => {
    setFilters(prevFilters => {
      const newFilters = { ...prevFilters };
      delete newFilters[key];

      if (onFilterChange) {
        onFilterChange({ ...newFilters, search: debouncedSearchTerm });
      }

      return newFilters;
    });
  }, [onFilterChange, debouncedSearchTerm]);

  const filteredData = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) {
      return data;
    }

    let filtered = [...data];

    // Apply search filter
    if (debouncedSearchTerm.trim()) {
      const searchLower = debouncedSearchTerm.toLowerCase().trim();
      
      filtered = filtered.filter(item => {
        return searchableFields.some(field => {
          const value = getValueWithFallback(item, field);
          if (value === null || value === undefined) return false;
          return String(value).toLowerCase().includes(searchLower);
        });
      });
    }

    // Apply other filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '' || value === 'all') {
        return;
      }

      filtered = filtered.filter(item => {
        const itemValue = getValueWithFallback(item, key);
        
        // Handle array values (multi-select)
        if (Array.isArray(value)) {
          return value.length === 0 || value.includes(itemValue);
        }

        // Handle boolean filters (recommended, etc.)
        if (typeof value === 'boolean') {
          return Boolean(itemValue) === value;
        }

        // Handle range filters
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          const numValue = Number(itemValue);
          if (!isNaN(numValue)) {
            if (value.min !== undefined && numValue < value.min) return false;
            if (value.max !== undefined && numValue > value.max) return false;
            return true;
          }
          return false;
        }

        // Handle string/exact matches
        return itemValue === value;
      });
    });

    return filtered;
  }, [data, debouncedSearchTerm, filters, searchableFields]);

  const getFilterStats = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) {
      return { total: 0, filtered: 0, percentage: 0 };
    }

    const total = data.length;
    const filtered = filteredData.length;
    const percentage = total > 0 ? Math.round((filtered / total) * 100) : 0;

    return { total, filtered, percentage };
  }, [data, filteredData]);

  const getAvailableValues = useCallback((field) => {
    if (!Array.isArray(data) || data.length === 0) {
      return [];
    }

    const values = new Set();
    
    data.forEach(item => {
      const value = getValueWithFallback(item, field);
      if (value !== null && value !== undefined && value !== '') {
        values.add(value);
      }
    });

    return Array.from(values).sort((a, b) => {
      if (typeof a === 'string' && typeof b === 'string') {
        return a.localeCompare(b);
      }
      return a < b ? -1 : a > b ? 1 : 0;
    });
  }, [data]);

  const hasActiveFilters = useMemo(() => {
    return debouncedSearchTerm.trim() !== '' || Object.keys(filters).length > 0;
  }, [debouncedSearchTerm, filters]);

  // Callback to trigger filter change notification
  useEffect(() => {
    if (onFilterChange) {
      onFilterChange({ ...filters, search: debouncedSearchTerm });
    }
  }, [debouncedSearchTerm, filters, onFilterChange]);

  return {
    // Data
    filteredData,
    
    // Search
    searchTerm,
    setSearchTerm,
    debouncedSearchTerm,
    
    // Filters
    filters,
    updateFilter,
    clearFilter,
    clearFilters,
    
    // Stats and helpers
    getFilterStats,
    getAvailableValues,
    hasActiveFilters,
    
    // Quick filter methods
    setAssetClassFilter: (value) => updateFilter('asset_class', value),
    setRecommendedFilter: (value) => updateFilter('is_recommended', value),
    setScoreRangeFilter: (min, max) => updateFilter('score_final', { min, max }),
    setExpenseRatioFilter: (max) => updateFilter('expense_ratio', { max }),
    setReturnRangeFilter: (field, min, max) => updateFilter(field, { min, max })
  };
}

/**
 * Get value from fund data with fallback patterns
 * Handles both fund.ytd_return and fund['Total Return - YTD (%)'] patterns
 */
function getValueWithFallback(item, key) {
  if (!item || typeof item !== 'object') {
    return null;
  }

  // Direct property access first
  if (item[key] !== undefined) {
    return item[key];
  }

  // Common fallback patterns
  const fallbackMap = {
    // Search fields
    name: ['name', 'fund_name', 'Fund Name'],
    ticker: ['ticker', 'symbol', 'Symbol'],
    symbol: ['symbol', 'ticker', 'Symbol'],
    
    // Filter fields
    asset_class: ['asset_class', 'asset_class_name', 'Asset Class', 'assetClass'],
    assetClass: ['asset_class', 'asset_class_name', 'Asset Class'],
    is_recommended: ['is_recommended', 'recommended'],
    recommended: ['is_recommended', 'recommended'],
    
    // Performance fields
    ytd_return: ['ytd_return', 'Total Return - YTD (%)', 'YTD Return'],
    one_year_return: ['one_year_return', 'Total Return - 1 Year (%)', '1 Year'],
    three_year_return: ['three_year_return', 'Annualized Total Return - 3 Year (%)', '3 Year'],
    five_year_return: ['five_year_return', 'Annualized Total Return - 5 Year (%)', '5 Year'],
    
    // Score fields
    score_final: ['score_final', 'score', 'final_score'],
    score: ['score_final', 'score', 'final_score'],
    
    // Other common fields
    expense_ratio: ['expense_ratio', 'Net Exp Ratio (%)', 'Expense Ratio'],
    sharpe_ratio: ['sharpe_ratio', 'Sharpe Ratio - 3 Year', 'Sharpe Ratio'],
    manager_tenure: ['manager_tenure', 'Manager Tenure', 'Tenure']
  };

  const fallbacks = fallbackMap[key] || [key];
  
  for (const fallbackKey of fallbacks) {
    if (item[fallbackKey] !== undefined) {
      return item[fallbackKey];
    }
  }

  return null;
}

/**
 * Create preset filters for common use cases
 */
export const PRESET_FILTERS = {
  recommended: {
    name: 'Recommended Only',
    filters: { is_recommended: true }
  },
  
  highPerformers: {
    name: 'High Performers',
    filters: { 
      ytd_return: { min: 0.05 }, // 5% YTD minimum
      score_final: { min: 7 } // Score 7+ minimum
    }
  },
  
  lowCost: {
    name: 'Low Cost Funds',
    filters: { 
      expense_ratio: { max: 0.01 } // 1% expense ratio maximum
    }
  },
  
  largeCapEquity: {
    name: 'Large Cap Equity',
    filters: { 
      asset_class: ['US Large Cap Equity', 'Large Cap Growth', 'Large Cap Value', 'Large Cap Blend'] 
    }
  },
  
  fixedIncome: {
    name: 'Fixed Income',
    filters: { 
      asset_class: ['US Fixed Income', 'Corporate Bond', 'Government Bond', 'Municipal Bond'] 
    }
  }
};

/**
 * Hook for managing multiple preset filters
 */
export function usePresetFilters(filterHook) {
  const [activePreset, setActivePreset] = useState(null);

  const applyPreset = useCallback((presetKey) => {
    const preset = PRESET_FILTERS[presetKey];
    if (!preset) return;

    // Clear existing filters first
    filterHook.clearFilters();
    
    // Apply preset filters
    Object.entries(preset.filters).forEach(([key, value]) => {
      filterHook.updateFilter(key, value);
    });

    setActivePreset(presetKey);
  }, [filterHook]);

  const clearPreset = useCallback(() => {
    filterHook.clearFilters();
    setActivePreset(null);
  }, [filterHook]);

  return {
    activePreset,
    applyPreset,
    clearPreset,
    availablePresets: PRESET_FILTERS
  };
}

/**
 * Advanced filter builder for complex queries
 */
export function useAdvancedFilter(baseFilterHook) {
  const [advancedFilters, setAdvancedFilters] = useState([]);

  const addAdvancedFilter = useCallback((field, operator, value) => {
    const filter = { id: Date.now(), field, operator, value };
    setAdvancedFilters(prev => [...prev, filter]);
  }, []);

  const removeAdvancedFilter = useCallback((id) => {
    setAdvancedFilters(prev => prev.filter(f => f.id !== id));
  }, []);

  const clearAdvancedFilters = useCallback(() => {
    setAdvancedFilters([]);
  }, []);

  const filteredData = useMemo(() => {
    if (advancedFilters.length === 0) {
      return baseFilterHook.filteredData;
    }

    return baseFilterHook.filteredData.filter(item => {
      return advancedFilters.every(filter => {
        const itemValue = getValueWithFallback(item, filter.field);
        return applyAdvancedFilter(itemValue, filter.operator, filter.value);
      });
    });
  }, [baseFilterHook.filteredData, advancedFilters]);

  return {
    advancedFilters,
    filteredData,
    addAdvancedFilter,
    removeAdvancedFilter,
    clearAdvancedFilters
  };
}

/**
 * Apply advanced filter operation
 */
function applyAdvancedFilter(value, operator, filterValue) {
  const numValue = Number(value);
  const numFilterValue = Number(filterValue);

  switch (operator) {
    case 'equals':
      return value === filterValue;
    case 'not_equals':
      return value !== filterValue;
    case 'contains':
      return String(value).toLowerCase().includes(String(filterValue).toLowerCase());
    case 'not_contains':
      return !String(value).toLowerCase().includes(String(filterValue).toLowerCase());
    case 'greater_than':
      return !isNaN(numValue) && !isNaN(numFilterValue) && numValue > numFilterValue;
    case 'less_than':
      return !isNaN(numValue) && !isNaN(numFilterValue) && numValue < numFilterValue;
    case 'greater_equal':
      return !isNaN(numValue) && !isNaN(numFilterValue) && numValue >= numFilterValue;
    case 'less_equal':
      return !isNaN(numValue) && !isNaN(numFilterValue) && numValue <= numFilterValue;
    case 'starts_with':
      return String(value).toLowerCase().startsWith(String(filterValue).toLowerCase());
    case 'ends_with':
      return String(value).toLowerCase().endsWith(String(filterValue).toLowerCase());
    case 'is_null':
      return value === null || value === undefined || value === '';
    case 'is_not_null':
      return value !== null && value !== undefined && value !== '';
    default:
      return true;
  }
}