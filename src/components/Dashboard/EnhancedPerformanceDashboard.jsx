import React, { useState, useMemo } from 'react';
import { useFundData } from '../../hooks/useFundData';
import RealTimeUpdates from './RealTimeUpdates';

const EnhancedPerformanceDashboard = () => {
  const { funds, loading, error, refreshData, lastUpdated } = useFundData();
  const [selectedTimeframe, setSelectedTimeframe] = useState('ytd');
  const [selectedAssetClass, setSelectedAssetClass] = useState('all');
  const [sortBy, setSortBy] = useState('performance');
  const [viewMode, setViewMode] = useState('grid'); // grid, list, chart
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Available timeframes for performance comparison
  const timeframes = useMemo(() => [
    { key: 'ytd', label: 'YTD', field: 'ytd_return' },
    { key: '1m', label: '1 Month', field: 'one_month_return' },
    { key: '3m', label: '3 Month', field: 'three_month_return' },
    { key: '1y', label: '1 Year', field: 'one_year_return' },
    { key: '3y', label: '3 Year', field: 'three_year_return' },
    { key: '5y', label: '5 Year', field: 'five_year_return' }
  ], []);

  // Get unique asset classes
  const assetClasses = useMemo(() => {
    if (!funds || !Array.isArray(funds)) return ['all'];
    const classes = [...new Set(funds.map(fund => fund.asset_class).filter(Boolean))];
    return ['all', ...classes.sort()];
  }, [funds]);

  // Filter and sort funds based on selected criteria
  const filteredFunds = useMemo(() => {
    if (!funds || !Array.isArray(funds)) return [];
    
    let filtered = funds;
    
    // Filter by asset class
    if (selectedAssetClass !== 'all') {
      filtered = filtered.filter(fund => fund.asset_class === selectedAssetClass);
    }
    
    // Sort by selected criteria
    const currentTimeframe = timeframes.find(t => t.key === selectedTimeframe);
    if (currentTimeframe) {
      filtered.sort((a, b) => {
        const aValue = a[currentTimeframe.field] || 0;
        const bValue = b[currentTimeframe.field] || 0;
        
        if (sortBy === 'performance') {
          return bValue - aValue; // Best performers first
        } else if (sortBy === 'name') {
          return a.name.localeCompare(b.name);
        } else if (sortBy === 'ticker') {
          return a.ticker.localeCompare(b.ticker);
        }
        return 0;
      });
    }
    
    return filtered;
  }, [funds, selectedTimeframe, selectedAssetClass, sortBy, timeframes]);

  // Calculate performance statistics
  const performanceStats = useMemo(() => {
    if (!filteredFunds.length) return null;
    
    const currentTimeframe = timeframes.find(t => t.key === selectedTimeframe);
    if (!currentTimeframe) return null;
    
    const values = filteredFunds
      .map(fund => fund[currentTimeframe.field])
      .filter(val => val !== null && val !== undefined);
    
    if (values.length === 0) return null;
    
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    const max = Math.max(...values);
    const min = Math.min(...values);
    const positiveCount = values.filter(val => val > 0).length;
    const negativeCount = values.filter(val => val < 0).length;
    
    return {
      average: avg,
      max,
      min,
      positiveCount,
      negativeCount,
      totalCount: values.length
    };
  }, [filteredFunds, selectedTimeframe, timeframes]);

  // Get color for performance value
  const getPerformanceColor = (value) => {
    if (value === null || value === undefined) return 'var(--color-text-muted)';
    if (value > 0) return 'var(--color-success)';
    if (value < 0) return 'var(--color-danger)';
    return 'var(--color-text-muted)';
  };

  // Format percentage
  const formatPercentage = (value) => {
    if (value === null || value === undefined) return 'N/A';
    return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  // Handle manual refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshData();
    } catch (error) {
      console.error('Failed to refresh data:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-card">
        <div className="loading-spinner"></div>
        <p>Loading performance data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-card">
        <div className="error-message">
          <h3>Error Loading Data</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="enhanced-performance-dashboard">
      {/* Real-Time Updates Status */}
      <RealTimeUpdates
        onRefresh={handleRefresh}
        lastUpdated={lastUpdated}
        isConnected={navigator.onLine}
        isLoading={isRefreshing}
      />

      {/* Header Controls */}
      <div className="dashboard-header">
        <div className="header-left">
          <h2>Performance Dashboard</h2>
          <p className="subtitle">
            Real-time fund performance analysis and comparison
          </p>
        </div>
        <div className="header-controls">
          <div className="control-group">
            <label>Timeframe:</label>
            <select 
              value={selectedTimeframe} 
              onChange={(e) => setSelectedTimeframe(e.target.value)}
              className="select-control"
            >
              {timeframes.map(tf => (
                <option key={tf.key} value={tf.key}>{tf.label}</option>
              ))}
            </select>
          </div>
          
          <div className="control-group">
            <label>Asset Class:</label>
            <select 
              value={selectedAssetClass} 
              onChange={(e) => setSelectedAssetClass(e.target.value)}
              className="select-control"
            >
              {assetClasses.map(ac => (
                <option key={ac} value={ac}>
                  {ac === 'all' ? 'All Asset Classes' : ac}
                </option>
              ))}
            </select>
          </div>
          
          <div className="control-group">
            <label>Sort By:</label>
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)}
              className="select-control"
            >
              <option value="performance">Performance</option>
              <option value="name">Fund Name</option>
              <option value="ticker">Ticker</option>
            </select>
          </div>
          
          <div className="control-group">
            <label>View:</label>
            <div className="view-toggle">
              <button 
                className={`toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
              >
                Grid
              </button>
              <button 
                className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
              >
                List
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Statistics */}
      {performanceStats && (
        <div className="performance-stats">
          <div className="stat-card">
            <div className="stat-value">{formatPercentage(performanceStats.average)}</div>
            <div className="stat-label">Average Return</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{formatPercentage(performanceStats.max)}</div>
            <div className="stat-label">Best Performer</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{formatPercentage(performanceStats.min)}</div>
            <div className="stat-label">Worst Performer</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{performanceStats.positiveCount}/{performanceStats.totalCount}</div>
            <div className="stat-label">Positive Returns</div>
          </div>
        </div>
      )}

      {/* Fund Performance Grid/List */}
      <div className={`funds-container ${viewMode}`}>
        {filteredFunds.length === 0 ? (
          <div className="no-data">
            <p>No funds found matching the selected criteria.</p>
          </div>
        ) : (
          filteredFunds.map(fund => {
            const currentTimeframe = timeframes.find(t => t.key === selectedTimeframe);
            const performanceValue = currentTimeframe ? fund[currentTimeframe.field] : null;
            
            return (
              <div key={fund.ticker} className="fund-card">
                <div className="fund-header">
                  <div className="fund-info">
                    <h3 className="fund-name">{fund.name}</h3>
                    <div className="fund-ticker">{fund.ticker}</div>
                    <div className="fund-asset-class">{fund.asset_class}</div>
                  </div>
                  <div className="fund-performance">
                    <div 
                      className="performance-value"
                      style={{ color: getPerformanceColor(performanceValue) }}
                    >
                      {formatPercentage(performanceValue)}
                    </div>
                    <div className="performance-label">{currentTimeframe?.label} Return</div>
                  </div>
                </div>
                
                <div className="fund-details">
                  <div className="detail-row">
                    <span className="detail-label">Expense Ratio:</span>
                    <span className="detail-value">
                      {fund.expense_ratio ? `${fund.expense_ratio.toFixed(2)}%` : 'N/A'}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Sharpe Ratio:</span>
                    <span className="detail-value">
                      {fund.sharpe_ratio ? fund.sharpe_ratio.toFixed(2) : 'N/A'}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Standard Deviation:</span>
                    <span className="detail-value">
                      {fund.standard_deviation ? `${fund.standard_deviation.toFixed(2)}%` : 'N/A'}
                    </span>
                  </div>
                </div>
                
                {fund.is_recommended && (
                  <div className="recommended-badge">
                    Recommended Fund
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Summary Footer */}
      <div className="dashboard-footer">
        <div className="summary-info">
          <span>Showing {filteredFunds.length} funds</span>
          {selectedAssetClass !== 'all' && (
            <span>• Asset Class: {selectedAssetClass}</span>
          )}
          <span>• Timeframe: {timeframes.find(t => t.key === selectedTimeframe)?.label}</span>
        </div>
        <div className="last-updated">
          Last updated: {new Date().toLocaleString()}
        </div>
      </div>
    </div>
  );
};

export default EnhancedPerformanceDashboard; 