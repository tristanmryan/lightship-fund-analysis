// src/components/Dashboard/AdvancedFilters.jsx
import React, { useState, useMemo, useCallback } from 'react';
import { 
  Filter, Search, X, Save, Bookmark, ChevronDown, ChevronUp,
  TrendingUp, DollarSign, Target, Shield, Calendar, Zap
} from 'lucide-react';

/**
 * Advanced Filters Component
 * Comprehensive filtering system for fund data with saved presets
 */
import preferencesService from '../../services/preferencesService';

const AdvancedFilters = ({ funds, onFilterChange, className = '', initialFilters = null }) => {
  // Filter state
  const [filters, setFilters] = useState(() => initialFilters || {
    search: '',
    assetClasses: [],
    performanceRank: 'all',
    expenseRatioMax: '',
    sharpeRatioMin: '',
    betaMax: '',
    timePerformance: {
      period: 'ytd',
      minReturn: '',
      maxReturn: ''
    },
    scoreRange: {
      min: '',
      max: ''
    },
    isRecommended: 'all'
  });

  // UI state
  const [isExpanded, setIsExpanded] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [savedPresets, setSavedPresets] = useState({});

  // Load presets (per-user via preferences) with fallback to localStorage/defaults
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const fromPrefs = await preferencesService.getFilterPresets();
        if (!cancelled && fromPrefs && Object.keys(fromPrefs).length > 0) {
          setSavedPresets(fromPrefs);
          return;
        }
      } catch {}
      if (cancelled) return;
      try {
        const saved = localStorage.getItem('fundFilterPresets');
        setSavedPresets(saved ? JSON.parse(saved) : getDefaultPresets());
      } catch {
        setSavedPresets(getDefaultPresets());
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Get unique asset classes from funds
  const assetClasses = useMemo(() => {
    if (!funds || !Array.isArray(funds)) return [];
    const classes = new Set(funds.map(f => f['Asset Class'] || f.asset_class).filter(Boolean));
    return Array.from(classes).sort();
  }, [funds]);

  // Default filter presets
  function getDefaultPresets() {
    return {
      'High Performers': {
        performanceRank: 'top25',
        sharpeRatioMin: '1.0',
        scoreRange: { min: '7', max: '' }
      },
      'Low Cost': {
        expenseRatioMax: '0.5',
        performanceRank: 'top50'
      },
      'Conservative': {
        betaMax: '0.8',
        expenseRatioMax: '1.0',
        sharpeRatioMin: '0.5'
      },
      'Growth': {
        assetClasses: ['US Large Cap Growth', 'US Small Cap Growth'],
        performanceRank: 'top50'
      },
      'Income': {
        assetClasses: ['Fixed Income', 'High Yield'],
        timePerformance: { period: 'ytd', minReturn: '0' }
      },
      'Recommended Only': {
        isRecommended: 'yes'
      }
    };
  }

  // Apply filters to funds
  const filteredFunds = useMemo(() => {
    if (!funds || !Array.isArray(funds)) return [];

    return funds.filter(fund => {
      // Search filter
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        const symbol = (fund.Symbol || fund.symbol || '').toLowerCase();
        const name = (fund['Product Name'] || fund.name || '').toLowerCase();
        if (!symbol.includes(searchTerm) && !name.includes(searchTerm)) {
          return false;
        }
      }

      // Asset class filter
      if (filters.assetClasses.length > 0) {
        const fundAssetClass = fund['Asset Class'] || fund.asset_class;
        if (!filters.assetClasses.includes(fundAssetClass)) {
          return false;
        }
      }

      // Performance rank filter
      if (filters.performanceRank !== 'all') {
        const score = fund.scores?.final || fund.score || 0;
        const scorePercentile = getScorePercentile(score, funds);
        
        switch (filters.performanceRank) {
          case 'top10':
            if (scorePercentile < 90) return false;
            break;
          case 'top25':
            if (scorePercentile < 75) return false;
            break;
          case 'top50':
            if (scorePercentile < 50) return false;
            break;
          case 'bottom50':
            if (scorePercentile > 50) return false;
            break;
        }
      }

      // Expense ratio filter
      if (filters.expenseRatioMax) {
        const expenseRatio = fund['Net Exp Ratio (%)'] || fund.expense_ratio || 0;
        if (expenseRatio > parseFloat(filters.expenseRatioMax)) {
          return false;
        }
      }

      // Sharpe ratio filter
      if (filters.sharpeRatioMin) {
        const sharpeRatio = fund['Sharpe Ratio - 3 Year'] || fund.sharpe_ratio || 0;
        if (sharpeRatio < parseFloat(filters.sharpeRatioMin)) {
          return false;
        }
      }

      // Beta filter
      if (filters.betaMax) {
        const beta = fund['Beta - 5 Year'] || fund.beta || 0;
        if (beta > parseFloat(filters.betaMax)) {
          return false;
        }
      }

      // Time performance filter
      if (filters.timePerformance.minReturn || filters.timePerformance.maxReturn) {
        const returnValue = getReturnValue(fund, filters.timePerformance.period);
        
        if (filters.timePerformance.minReturn && returnValue < parseFloat(filters.timePerformance.minReturn)) {
          return false;
        }
        
        if (filters.timePerformance.maxReturn && returnValue > parseFloat(filters.timePerformance.maxReturn)) {
          return false;
        }
      }

      // Score range filter
      if (filters.scoreRange.min || filters.scoreRange.max) {
        const score = fund.scores?.final || fund.score || 0;
        
        if (filters.scoreRange.min && score < parseFloat(filters.scoreRange.min)) {
          return false;
        }
        
        if (filters.scoreRange.max && score > parseFloat(filters.scoreRange.max)) {
          return false;
        }
      }

      // Recommended filter
      if (filters.isRecommended !== 'all') {
        const isRecommended = fund.is_recommended || fund.recommended || false;
        if (filters.isRecommended === 'yes' && !isRecommended) {
          return false;
        }
        if (filters.isRecommended === 'no' && isRecommended) {
          return false;
        }
      }

      return true;
    });
  }, [funds, filters]);

  // Helper functions
  const getScorePercentile = (score, allFunds) => {
    const scores = allFunds.map(f => f.scores?.final || f.score || 0).sort((a, b) => a - b);
    const rank = scores.findIndex(s => s >= score);
    return (rank / scores.length) * 100;
  };

  const getReturnValue = (fund, period) => {
    const periodMap = {
      'ytd': fund['Total Return - YTD (%)'] || fund.ytd_return || 0,
      '1y': fund['Total Return - 1 Year (%)'] || fund.one_year_return || 0,
      '3y': fund['Annualized Total Return - 3 Year (%)'] || fund.three_year_return || 0,
      '5y': fund['Annualized Total Return - 5 Year (%)'] || fund.five_year_return || 0
    };
    return periodMap[period] || 0;
  };

  // Filter update handlers
  const updateFilter = useCallback((key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);

  const updateNestedFilter = useCallback((parentKey, childKey, value) => {
    setFilters(prev => ({
      ...prev,
      [parentKey]: {
        ...prev[parentKey],
        [childKey]: value
      }
    }));
  }, []);

  const toggleAssetClass = useCallback((assetClass) => {
    setFilters(prev => ({
      ...prev,
      assetClasses: prev.assetClasses.includes(assetClass)
        ? prev.assetClasses.filter(ac => ac !== assetClass)
        : [...prev.assetClasses, assetClass]
    }));
  }, []);

  // Preset management
  const applyPreset = (presetFilters) => {
    setFilters(prev => ({
      ...prev,
      ...presetFilters
    }));
    setShowPresets(false);
  };

  const savePreset = () => {
    if (!presetName.trim()) return;
    
    const newPresets = {
      ...savedPresets,
      [presetName]: { ...filters }
    };
    
    setSavedPresets(newPresets);
    localStorage.setItem('fundFilterPresets', JSON.stringify(newPresets));
    // Persist per-user as well
    preferencesService.saveFilterPresets(newPresets).catch(() => {});
    setPresetName('');
    setShowPresets(false);
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      assetClasses: [],
      performanceRank: 'all',
      expenseRatioMax: '',
      sharpeRatioMin: '',
      betaMax: '',
      timePerformance: {
        period: 'ytd',
        minReturn: '',
        maxReturn: ''
      },
      scoreRange: {
        min: '',
        max: ''
      },
      isRecommended: 'all'
    });
  };

  // Get active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.assetClasses.length > 0) count++;
    if (filters.performanceRank !== 'all') count++;
    if (filters.expenseRatioMax) count++;
    if (filters.sharpeRatioMin) count++;
    if (filters.betaMax) count++;
    if (filters.timePerformance.minReturn || filters.timePerformance.maxReturn) count++;
    if (filters.scoreRange.min || filters.scoreRange.max) count++;
    if (filters.isRecommended !== 'all') count++;
    return count;
  }, [filters]);

  // Notify parent of changes
  React.useEffect(() => {
    onFilterChange(filteredFunds, filters);
  }, [filteredFunds, filters, onFilterChange]);

  return (
    <div className={`advanced-filters ${className}`} style={{
      backgroundColor: 'white',
      border: '1px solid #e5e7eb',
      borderRadius: '0.5rem',
      marginBottom: '1rem'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1rem',
        borderBottom: isExpanded ? '1px solid #e5e7eb' : 'none',
        cursor: 'pointer'
      }} onClick={() => setIsExpanded(!isExpanded)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Filter size={20} />
          <span style={{ fontWeight: '600' }}>Advanced Filters</span>
          {activeFilterCount > 0 && (
            <span style={{
              backgroundColor: '#3b82f6',
              color: 'white',
              borderRadius: '50%',
              width: '20px',
              height: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem'
            }}>
              {activeFilterCount}
            </span>
          )}
          <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>
            ({filteredFunds.length} of {funds?.length || 0} funds)
          </span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {activeFilterCount > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                clearFilters();
              }}
              style={{
                padding: '0.25rem 0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.25rem',
                backgroundColor: 'white',
                color: '#6b7280',
                fontSize: '0.75rem',
                cursor: 'pointer'
              }}
            >
              Clear
            </button>
          )}
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowPresets(!showPresets);
            }}
            style={{
              padding: '0.25rem 0.5rem',
              border: '1px solid #3b82f6',
              borderRadius: '0.25rem',
              backgroundColor: 'white',
              color: '#3b82f6',
              fontSize: '0.75rem',
              cursor: 'pointer'
            }}
          >
            <Bookmark size={14} style={{ marginRight: '0.25rem' }} />
            Presets
          </button>
          
          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
      </div>

      {/* Preset dropdown */}
      {showPresets && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: '1rem',
          zIndex: 1000,
          backgroundColor: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '0.5rem',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
          minWidth: '200px'
        }}>
          <div style={{ padding: '0.5rem', borderBottom: '1px solid #e5e7eb' }}>
            <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Filter Presets</div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                placeholder="Preset name..."
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                style={{
                  flex: 1,
                  padding: '0.25rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.25rem',
                  fontSize: '0.875rem'
                }}
              />
              <button
                onClick={savePreset}
                disabled={!presetName.trim()}
                style={{
                  padding: '0.25rem 0.5rem',
                  border: 'none',
                  borderRadius: '0.25rem',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  fontSize: '0.75rem',
                  cursor: presetName.trim() ? 'pointer' : 'not-allowed',
                  opacity: presetName.trim() ? 1 : 0.5
                }}
              >
                Save
              </button>
            </div>
          </div>
          
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {Object.entries(savedPresets).map(([name, preset]) => (
              <button
                key={name}
                onClick={() => applyPreset(preset)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: 'none',
                  backgroundColor: 'transparent',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  '&:hover': {
                    backgroundColor: '#f3f4f6'
                  }
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#f3f4f6'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filter panels */}
      {isExpanded && (
        <div style={{ padding: '1rem' }}>
          {/* Search and Quick Filters Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '1rem', marginBottom: '1rem' }}>
            {/* Search */}
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#6b7280'
              }} />
              <input
                type="text"
                placeholder="Search funds by symbol or name..."
                value={filters.search}
                onChange={(e) => updateFilter('search', e.target.value)}
                style={{
                  width: '100%',
                  paddingLeft: '2.5rem',
                  paddingRight: '0.75rem',
                  paddingTop: '0.5rem',
                  paddingBottom: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem'
                }}
              />
              {filters.search && (
                <button
                  onClick={() => updateFilter('search', '')}
                  style={{
                    position: 'absolute',
                    right: '0.5rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    border: 'none',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    color: '#6b7280'
                  }}
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Quick Filter Buttons */}
            <button
              onClick={() => applyPreset(savedPresets['High Performers'])}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #10b981',
                borderRadius: '0.375rem',
                backgroundColor: 'white',
                color: '#10b981',
                fontSize: '0.875rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}
            >
              <TrendingUp size={16} />
              Top Performers
            </button>

            <button
              onClick={() => applyPreset(savedPresets['Low Cost'])}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #3b82f6',
                borderRadius: '0.375rem',
                backgroundColor: 'white',
                color: '#3b82f6',
                fontSize: '0.875rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}
            >
              <DollarSign size={16} />
              Low Cost
            </button>

            <button
              onClick={() => applyPreset(savedPresets['Recommended Only'])}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #f59e0b',
                borderRadius: '0.375rem',
                backgroundColor: 'white',
                color: '#f59e0b',
                fontSize: '0.875rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}
            >
              <Target size={16} />
              Recommended
            </button>
          </div>

          {/* Filter Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
            {/* Asset Classes */}
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                Asset Classes
              </label>
              <div style={{ 
                maxHeight: '120px', 
                overflowY: 'auto',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                padding: '0.5rem'
              }}>
                {assetClasses.map(assetClass => (
                  <label key={assetClass} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginBottom: '0.25rem',
                    fontSize: '0.875rem',
                    cursor: 'pointer'
                  }}>
                    <input
                      type="checkbox"
                      checked={filters.assetClasses.includes(assetClass)}
                      onChange={() => toggleAssetClass(assetClass)}
                    />
                    {assetClass}
                  </label>
                ))}
              </div>
            </div>

            {/* Performance Rank */}
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                Performance Rank
              </label>
              <select
                value={filters.performanceRank}
                onChange={(e) => updateFilter('performanceRank', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem'
                }}
              >
                <option value="all">All Funds</option>
                <option value="top10">Top 10%</option>
                <option value="top25">Top 25%</option>
                <option value="top50">Top 50%</option>
                <option value="bottom50">Bottom 50%</option>
              </select>
            </div>

            {/* Expense Ratio */}
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                Max Expense Ratio (%)
              </label>
              <input
                type="number"
                step="0.1"
                placeholder="e.g., 1.0"
                value={filters.expenseRatioMax}
                onChange={(e) => updateFilter('expenseRatioMax', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem'
                }}
              />
            </div>

            {/* Sharpe Ratio */}
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                Min Sharpe Ratio
              </label>
              <input
                type="number"
                step="0.1"
                placeholder="e.g., 1.0"
                value={filters.sharpeRatioMin}
                onChange={(e) => updateFilter('sharpeRatioMin', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem'
                }}
              />
            </div>

            {/* Beta */}
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                Max Beta
              </label>
              <input
                type="number"
                step="0.1"
                placeholder="e.g., 1.2"
                value={filters.betaMax}
                onChange={(e) => updateFilter('betaMax', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem'
                }}
              />
            </div>

            {/* Score Range */}
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                Score Range
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="number"
                  step="0.1"
                  placeholder="Min"
                  value={filters.scoreRange.min}
                  onChange={(e) => updateNestedFilter('scoreRange', 'min', e.target.value)}
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem'
                  }}
                />
                <input
                  type="number"
                  step="0.1"
                  placeholder="Max"
                  value={filters.scoreRange.max}
                  onChange={(e) => updateNestedFilter('scoreRange', 'max', e.target.value)}
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem'
                  }}
                />
              </div>
            </div>

            {/* Time Performance */}
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                Return Performance
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <select
                  value={filters.timePerformance.period}
                  onChange={(e) => updateNestedFilter('timePerformance', 'period', e.target.value)}
                  style={{
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem'
                  }}
                >
                  <option value="ytd">YTD Return</option>
                  <option value="1y">1-Year Return</option>
                  <option value="3y">3-Year Return</option>
                  <option value="5y">5-Year Return</option>
                </select>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Min %"
                    value={filters.timePerformance.minReturn}
                    onChange={(e) => updateNestedFilter('timePerformance', 'minReturn', e.target.value)}
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem'
                    }}
                  />
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Max %"
                    value={filters.timePerformance.maxReturn}
                    onChange={(e) => updateNestedFilter('timePerformance', 'maxReturn', e.target.value)}
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem'
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Recommended Status */}
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                Recommendation Status
              </label>
              <select
                value={filters.isRecommended}
                onChange={(e) => updateFilter('isRecommended', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem'
                }}
              >
                <option value="all">All Funds</option>
                <option value="yes">Recommended Only</option>
                <option value="no">Not Recommended</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedFilters;