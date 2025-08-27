// src/components/Dashboard/AssetClassTable.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Shield, Calendar, BarChart3, Target, Star } from 'lucide-react';
import fundService from '../../services/fundService';
import asOfStore from '../../services/asOfStore';
import scoringProfilesService from '../../services/scoringProfilesService';
import { fmt } from '../../utils/formatters';
import './AssetClassTable.css';

/**
 * Modern Asset Class Table Component
 * Redesigned to match 2025 financial dashboard design trends
 * Features clean aesthetics, modern status indicators, and professional styling
 */
const AssetClassTable = ({ 
  assetClassId, 
  assetClassName = 'Asset Class',
  onExport 
}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [asOfMonth, setAsOfMonth] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'score_final', direction: 'desc' });

  // Load profiles and data
  useEffect(() => {
    const loadProfiles = async () => {
      try {
        const profileList = await scoringProfilesService.listProfiles();
        setProfiles(profileList);
        
        // Get default profile
        const defaultProfile = await scoringProfilesService.getDefaultProfile();
        setSelectedProfile(defaultProfile);
      } catch (err) {
        console.error('Error loading scoring profiles:', err);
      }
    };

    loadProfiles();
  }, []);

  // Subscribe to asOfStore changes
  useEffect(() => {
    const unsubscribe = asOfStore.subscribe(() => {
      setAsOfMonth(asOfStore.activeMonth);
    });

    // Set initial value
    setAsOfMonth(asOfStore.activeMonth);

    return unsubscribe;
  }, []);

  // Load asset class data
  useEffect(() => {
    const loadData = async () => {
      if (!asOfMonth) return;

      // Handle case where asset class ID is missing (legacy data)
      if (!assetClassId) {
        console.warn('AssetClassTable: missing assetClassId', { assetClassName });
        setLoading(false);
        setError(`Asset class "${assetClassName}" is not configured in the database yet. Please import data using the Admin tab to set up this asset class.`);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        console.log('AssetClassTable: requesting table data', {
          asOfMonth,
          assetClassId,
          includeBenchmark: true
        });

        const tableData = await fundService.getAssetClassTable(
          asOfMonth,
          assetClassId,
          true // include benchmark
        );

        console.log('AssetClassTable: raw data received', tableData);
        console.log('AssetClassTable: raw row count', tableData ? tableData.length : 0);

        // Clean corrupted ticker data by removing appended labels
        const cleanedData = (tableData || []).map(row => {
          const originalTicker = row.ticker;
          const cleanedTicker = cleanTicker(row.ticker);

          const transformedRow = {
            ...row,
            ticker: cleanedTicker,
            is_recommended: row.is_recommended || isRecommendedTicker(row.ticker),
            isBenchmark: row.is_benchmark || isBenchmarkTicker(row.ticker)
          };

          console.log('AssetClassTable: transformed row', { original: row, transformed: transformedRow });
          return transformedRow;
        });

        console.log('AssetClassTable: cleaned data', cleanedData);
        console.log('AssetClassTable: cleaned row count', cleanedData.length);

        setData(cleanedData);
      } catch (err) {
        console.error('AssetClassTable: error loading asset class table', err);
        setError('Failed to load asset class data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [assetClassId, assetClassName, asOfMonth, selectedProfile]);

  // Clean corrupted ticker data
  const cleanTicker = (ticker) => {
    if (!ticker) return ticker;
    return ticker
      .replace(/Recommended$/i, '')
      .replace(/Benchmark$/i, '')
      .trim();
  };

  // Check if ticker indicates recommended status (legacy data)
  const isRecommendedTicker = (ticker) => {
    if (!ticker) return false;
    return ticker.toLowerCase().includes('recommended');
  };

  // Check if ticker indicates benchmark status (legacy data)
  const isBenchmarkTicker = (ticker) => {
    if (!ticker) return false;
    return ticker.toLowerCase().includes('benchmark');
  };

  // Modern score badge with CSS classes
  const renderScoreBadge = (score) => {
    if (score == null) return <span className="text-gray-400">—</span>;
    
    let badgeClass = '';
    if (score >= 60) {
      badgeClass = 'score-badge-excellent';
    } else if (score >= 50) {
      badgeClass = 'score-badge-good';
    } else if (score >= 40) {
      badgeClass = 'score-badge-fair';
    } else if (score >= 30) {
      badgeClass = 'score-badge-poor';
    } else {
      badgeClass = 'score-badge-very-poor';
    }

    return (
      <div className={`score-badge ${badgeClass}`}>
        <span>{score.toFixed(1)}</span>
      </div>
    );
  };

  // Modern return display without arrows
  const renderReturn = (value, period) => {
    if (value == null) return <span className="text-gray-400">—</span>;
    
    const isPositive = value >= 0;
    const colorClass = isPositive ? 'text-emerald-700' : 'text-red-700';
    
    return (
      <div className={`numeric-value text-right text-sm font-medium ${colorClass}`}>
        {value.toFixed(2)}%
      </div>
    );
  };

  // Modern expense ratio display
  const renderExpenseRatio = (value) => {
    if (value == null) return <span className="text-gray-400">—</span>;
    
    let colorClass = 'text-gray-700';
    if (value <= 0.5) colorClass = 'text-emerald-700';
    else if (value <= 1.0) colorClass = 'text-amber-700';
    else colorClass = 'text-red-700';
    
    return (
      <div className="numeric-value text-right text-sm font-medium">
        <span className={colorClass}>{value.toFixed(2)}%</span>
      </div>
    );
  };

  // Modern Sharpe ratio display
  const renderSharpeRatio = (value) => {
    if (value == null) return <span className="text-gray-400">—</span>;
    
    let colorClass = 'text-gray-700';
    if (value >= 1.0) colorClass = 'text-emerald-700';
    else if (value >= 0.5) colorClass = 'text-amber-700';
    else colorClass = 'text-red-700';
    
    return (
      <div className="numeric-value text-right text-sm font-medium">
        <span className={colorClass}>{value.toFixed(2)}</span>
      </div>
    );
  };

  // Sort data
  const sortedData = useMemo(() => {
    if (!data.length) {
      console.log('AssetClassTable: no data available for sorting');
      return [];
    }

    console.log('AssetClassTable: sorting data', { sortConfig, rowCount: data.length, data });
    const sorted = [...data].sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];
      
      // Handle numeric sorting
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        if (sortConfig.direction === 'desc') {
          return bValue - aValue;
        }
        return aValue - bValue;
      }
      
      // Handle string sorting
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        if (sortConfig.direction === 'desc') {
          return bValue.localeCompare(aValue);
        }
        return aValue.localeCompare(bValue);
      }
      
      return 0;
    });
    
    // Always keep benchmark at bottom
    const benchmark = sorted.find(row => row.isBenchmark);
    let finalSorted = sorted;
    if (benchmark) {
      const nonBenchmark = sorted.filter(row => !row.isBenchmark);
      finalSorted = [...nonBenchmark, benchmark];
    }

    console.log('AssetClassTable: sorted data result', finalSorted);
    return finalSorted;
  }, [data, sortConfig]);

  // Helper function to get the correct field value with fallbacks
  const getFieldValue = (row, fieldName, fallbacks = []) => {
    if (row[fieldName] != null) return row[fieldName];
    
    for (const fallback of fallbacks) {
      if (row[fallback] != null) return row[fallback];
    }
    
    return null;
  };

  // Handle sorting
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };


  if (loading) {
    return (
      <div className="asset-class-table">
        <div className="loading-state flex items-center justify-center p-12">
          <div className="text-gray-500 text-lg">Loading asset class data...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="asset-class-table">
        <div className="error-state bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="text-red-700 text-center">{error}</div>
        </div>
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="asset-class-table">
        <div className="empty-state bg-gray-50 border border-gray-200 rounded-xl p-12 text-center">
          <div className="text-gray-500 text-lg">No data available for this asset class</div>
        </div>
      </div>
    );
  }

  const nonBenchmarkCount = data.filter(r => !r.isBenchmark).length;
  const benchmarkCount = data.filter(r => r.isBenchmark).length;
  console.log('AssetClassTable: final data counts', {
    total: data.length,
    nonBenchmark: nonBenchmarkCount,
    benchmark: benchmarkCount
  });

  return (
    <div className="asset-class-table space-y-6">
      {/* Simple Clean Header */}
      <div className="header-container bg-white rounded-lg border border-gray-200 shadow-sm">
        {/* Title Row */}
        <div className="title-row flex items-center justify-between">
          <div className="title-section">
            <h1 className="primary-title text-3xl font-bold text-gray-900">{assetClassName}</h1>
            <p className="title-subtitle text-sm text-gray-600 mt-1">Performance Analysis</p>
          </div>
          
          {profiles.length > 0 && (
            <div className="controls">
              <select
                value={selectedProfile?.id || ''}
                onChange={(e) => {
                  const profile = profiles.find(p => p.id === e.target.value);
                  setSelectedProfile(profile);
                }}
                className="px-3 py-1.5 border border-gray-300 rounded text-sm bg-white focus:ring-2 focus:ring-blue-500"
              >
                {profiles.map(profile => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Metadata */}
        <div className="metadata text-sm text-gray-600">
          As of {fmt.date(asOfMonth)}
          {selectedProfile && ` • ${selectedProfile.name} Profile`}
        </div>

        {/* Modern KPI Cards */}
        <div className="kpi-section">
          <div className="kpi-grid grid grid-cols-4 gap-4">
            {/* Total Funds KPI */}
            <div className="kpi-card kpi-card--blue">
              <div className="kpi-header">
                <div className="kpi-icon">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div className="kpi-trend">
                  <span className="trend-label">FUNDS</span>
                </div>
              </div>
              <div className="kpi-content">
                <div className="kpi-value">{nonBenchmarkCount}</div>
                <div className="kpi-label">Total Funds</div>
              </div>
            </div>

            {/* Recommended Funds KPI */}
            <div className="kpi-card kpi-card--green kpi-card--highlight">
              <div className="kpi-header">
                <div className="kpi-icon">
                  <Star className="w-5 h-5" />
                </div>
                <div className="kpi-trend">
                  <span className="trend-percentage">
                    {nonBenchmarkCount > 0 ? Math.round((data.filter(r => r.is_recommended).length / nonBenchmarkCount) * 100) : 0}%
                  </span>
                </div>
              </div>
              <div className="kpi-content">
                <div className="kpi-value">{data.filter(r => r.is_recommended).length}</div>
                <div className="kpi-label">Recommended</div>
              </div>
            </div>

            {/* Benchmarks KPI */}
            <div className="kpi-card kpi-card--amber">
              <div className="kpi-header">
                <div className="kpi-icon">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div className="kpi-trend">
                  <span className="trend-label">BENCH</span>
                </div>
              </div>
              <div className="kpi-content">
                <div className="kpi-value">{benchmarkCount}</div>
                <div className="kpi-label">Benchmarks</div>
              </div>
            </div>

            {/* Average Score KPI */}
            <div className="kpi-card kpi-card--purple kpi-card--highlight">
              <div className="kpi-header">
                <div className="kpi-icon">
                  <Target className="w-5 h-5" />
                </div>
                <div className="kpi-trend">
                  {(() => {
                    const avgScore = nonBenchmarkCount > 0 
                      ? (data.filter(r => !r.isBenchmark).reduce((sum, r) => sum + (getFieldValue(r, 'score_final', ['score', 'final_score']) || 0), 0) / nonBenchmarkCount)
                      : 0;
                    return (
                      <span className={`trend-indicator ${avgScore >= 60 ? 'trend-up' : avgScore >= 40 ? 'trend-neutral' : 'trend-down'}`}>
                        {avgScore >= 60 ? '↗' : avgScore >= 40 ? '→' : '↘'}
                      </span>
                    );
                  })()}
                </div>
              </div>
              <div className="kpi-content">
                <div className="kpi-value">
                  {nonBenchmarkCount > 0 ? (data.filter(r => !r.isBenchmark).reduce((sum, r) => sum + (getFieldValue(r, 'score_final', ['score', 'final_score']) || 0), 0) / nonBenchmarkCount).toFixed(1) : '0.0'}
                </div>
                <div className="kpi-label">Portfolio Score</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modern Table */}
      <div className="modern-card bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="table-header bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fund
                </th>
                <th 
                  className="sortable px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 transition-colors"
                  onClick={() => handleSort('score_final')}
                >
                  <div className="flex items-center justify-center space-x-1">
                    <span>Score</span>
                    {sortConfig.key === 'score_final' && (
                      <span className="text-blue-600">
                        {sortConfig.direction === 'desc' ? '↓' : '↑'}
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  className="sortable px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 transition-colors"
                  onClick={() => handleSort('ytd_return')}
                >
                  <div className="flex items-center justify-center space-x-1">
                    <span>YTD</span>
                    {sortConfig.key === 'ytd_return' && (
                      <span className="text-blue-600">
                        {sortConfig.direction === 'desc' ? '↓' : '↑'}
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  className="sortable px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 transition-colors"
                  onClick={() => handleSort('one_year_return')}
                >
                  <div className="flex items-center justify-center space-x-1">
                    <span>1Y</span>
                    {sortConfig.key === 'one_year_return' && (
                      <span className="text-blue-600">
                        {sortConfig.direction === 'desc' ? '↓' : '↑'}
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  className="sortable px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 transition-colors"
                  onClick={() => handleSort('three_year_return')}
                >
                  <div className="flex items-center justify-center space-x-1">
                    <span>3Y</span>
                    {sortConfig.key === 'three_year_return' && (
                      <span className="text-blue-600">
                        {sortConfig.direction === 'desc' ? '↓' : '↑'}
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  className="sortable px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 transition-colors"
                  onClick={() => handleSort('expense_ratio')}
                >
                  <div className="flex items-center justify-center space-x-1">
                    <span>Expense</span>
                    {sortConfig.key === 'expense_ratio' && (
                      <span className="text-blue-600">
                        {sortConfig.direction === 'desc' ? '↓' : '↑'}
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  className="sortable px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 transition-colors"
                  onClick={() => handleSort('sharpe_ratio')}
                >
                  <div className="flex items-center justify-center space-x-1">
                    <span>Sharpe</span>
                    {sortConfig.key === 'sharpe_ratio' && (
                      <span className="text-blue-600">
                        {sortConfig.direction === 'desc' ? '↓' : '↑'}
                      </span>
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {(() => {
                console.log('AssetClassTable: rendering table rows', sortedData.length);
                return sortedData.map((row, index) => {
                  try {
                    console.log('AssetClassTable: rendering row', index, row);
                    const isRecommended = row.is_recommended;
                    const isBenchmark = row.isBenchmark;

                    return (
                      <tr
                        key={row.ticker || index}
                        className={`
                      table-row transition-all duration-200 hover:bg-gray-50
                      ${isBenchmark ? 'benchmark-row' : ''}
                      ${isRecommended ? 'recommended-row' : ''}
                    `}
                      >
                        {/* Fund Column */}
                        <td className="table-cell px-6 py-4">
                          <div className="fund-info-container">
                            {/* Status Indicator Container - Fixed width */}
                            <div className="status-indicator-container">
                              {isRecommended && (
                                <div className="status-dot recommended" title="Recommended Fund" />
                              )}
                              {isBenchmark && (
                                <div className="status-dot benchmark" title="Benchmark Fund" />
                              )}
                              {!isRecommended && !isBenchmark && (
                                <div className="status-dot regular" title="Regular Fund" />
                              )}
                            </div>

                            {/* Fund Info Container */}
                            <div className="fund-text-container">
                              <div className="fund-ticker">
                                {row.ticker}
                              </div>
                              <div className="fund-name">
                                {row.name}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Score Column */}
                        <td className="table-cell px-6 py-4 text-center">
                          {renderScoreBadge(getFieldValue(row, 'score_final', ['score', 'final_score']))}
                        </td>

                        {/* Return Columns */}
                        <td className="table-cell px-6 py-4 text-center">
                          {renderReturn(getFieldValue(row, 'ytd_return', ['ytd', 'Total Return - YTD (%)']), 'YTD')}
                        </td>
                        <td className="table-cell px-6 py-4 text-center">
                          {renderReturn(getFieldValue(row, 'one_year_return', ['1 Year', 'Total Return - 1 Year (%)']), '1Y')}
                        </td>
                        <td className="table-cell px-6 py-4 text-center">
                          {renderReturn(getFieldValue(row, 'three_year_return', ['3 Year', 'Annualized Total Return - 3 Year (%)']), '3Y')}
                        </td>

                        {/* Expense Ratio */}
                        <td className="table-cell px-6 py-4 text-center">
                          {renderExpenseRatio(getFieldValue(row, 'expense_ratio', ['Net Exp Ratio (%)']))}
                        </td>

                        {/* Sharpe Ratio */}
                        <td className="table-cell px-6 py-4 text-center">
                          {renderSharpeRatio(getFieldValue(row, 'sharpe_ratio', ['Sharpe Ratio - 3 Year', 'Sharpe Ratio']))}
                        </td>
                      </tr>
                    );
                  } catch (renderError) {
                    console.error('AssetClassTable: error rendering row', index, renderError, row);
                    return null;
                  }
                });
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-sm text-gray-600 bg-gray-50 rounded-lg p-4">
        Showing {nonBenchmarkCount} funds
        {benchmarkCount > 0 && ` with ${benchmarkCount} benchmark${benchmarkCount > 1 ? 's' : ''}`}
      </div>
    </div>
  );
};

export default AssetClassTable;