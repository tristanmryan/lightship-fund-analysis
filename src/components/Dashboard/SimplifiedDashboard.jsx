import React, { useState, useMemo } from 'react';
import { useFundData } from '../../hooks/useFundData';
import SimpleKPIHeader from './SimpleKPIHeader';
import SimpleFilterBar from './SimpleFilterBar';
import SimpleFundViews from './SimpleFundViews';
import DashboardDebugPanel from './DashboardDebugPanel';

const SimplifiedDashboard = () => {
  const { funds, loading, error } = useFundData();
  const showDebug =
    process.env.REACT_APP_ENVIRONMENT === 'development' ||
    process.env.REACT_APP_DEBUG_MODE === 'true';
  
  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAssetClass, setSelectedAssetClass] = useState('');
  const [showRecommendedOnly, setShowRecommendedOnly] = useState(false);
  const [scoreRange, setScoreRange] = useState({ min: 0, max: 100 });

  // Derived data
  const assetClasses = useMemo(() => {
    const classes = new Set();
    (funds || []).forEach(fund => {
      const assetClass = fund.asset_class || fund.assetClass;
      if (assetClass) classes.add(assetClass);
    });
    return Array.from(classes).sort();
  }, [funds]);

  // Filtered funds
  const filteredFunds = useMemo(() => {
    if (!funds) return [];
    
    return funds.filter(fund => {
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const ticker = (fund.ticker || fund.symbol || '').toLowerCase();
        const name = (fund.name || fund.fund_name || '').toLowerCase();
        if (!ticker.includes(search) && !name.includes(search)) {
          return false;
        }
      }
      
      // Asset class filter
      if (selectedAssetClass) {
        const fundAssetClass = fund.asset_class || fund.assetClass;
        if (fundAssetClass !== selectedAssetClass) {
          return false;
        }
      }
      
      // Recommended only filter
      if (showRecommendedOnly && !fund.recommended) {
        return false;
      }
      
      // Score range filter
      if (fund.score != null) {
        if (fund.score < scoreRange.min || fund.score > scoreRange.max) {
          return false;
        }
      }
      
      return true;
    });
  }, [funds, searchTerm, selectedAssetClass, showRecommendedOnly, scoreRange]);

  // KPI calculations
  const kpiData = useMemo(() => {
    if (!funds || funds.length === 0) {
      return {
        portfolioAvgScore: 0,
        totalFunds: 0,
        recommendedCount: 0
      };
    }

    const validScores = funds.filter(f => f.score != null).map(f => f.score);
    const avgScore = validScores.length > 0 
      ? validScores.reduce((sum, score) => sum + score, 0) / validScores.length 
      : 0;

    const recommendedCount = funds.filter(f => f.recommended).length;

    return {
      portfolioAvgScore: avgScore,
      totalFunds: funds.length,
      recommendedCount
    };
  }, [funds]);

  // Clear all filters
  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedAssetClass('');
    setShowRecommendedOnly(false);
    setScoreRange({ min: 0, max: 100 });
  };

  if (error) {
    return (
      <div className="simplified-dashboard">
        <div className="error-message">
          <h2>Failed to load fund data</h2>
          <p>{error.message || 'An unexpected error occurred'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="simplified-dashboard">
      {/* KPI Header */}
      <SimpleKPIHeader 
        {...kpiData}
        loading={loading}
      />

      {/* Filter Bar */}
      <SimpleFilterBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        selectedAssetClass={selectedAssetClass}
        onAssetClassChange={setSelectedAssetClass}
        assetClasses={assetClasses}
        showRecommendedOnly={showRecommendedOnly}
        onRecommendedOnlyChange={setShowRecommendedOnly}
        scoreRange={scoreRange}
        onScoreRangeChange={setScoreRange}
        onClearFilters={handleClearFilters}
      />

      {/* Main Content */}
      <SimpleFundViews
        funds={filteredFunds}
        loading={loading}
      />

      {showDebug && (
        <DashboardDebugPanel funds={funds} loading={loading} />
      )}
    </div>
  );
};

export default SimplifiedDashboard;