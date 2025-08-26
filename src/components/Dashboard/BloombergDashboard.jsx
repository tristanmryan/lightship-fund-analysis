import React, { useState, useEffect, useMemo } from 'react';
import { useFundData } from '../../hooks/useFundData';
import HeroKPISection from './HeroKPISection';
import LeftSidebar from './LeftSidebar';
import HybridViewSystem from './HybridViewSystem';
import RightSidebar from './RightSidebar';

const BloombergDashboard = () => {
  const { funds, loading, error } = useFundData();
  
  // State management
  const [filters, setFilters] = useState({
    assetClasses: [],
    scoreRange: { min: 0, max: 100 },
    search: '',
    recommended: false,
    performance: null,
    risk: null
  });
  
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false);
  const [selectedFunds, setSelectedFunds] = useState([]);
  const [rightSidebarVisible, setRightSidebarVisible] = useState(false);

  // Derived data
  const assetClasses = useMemo(() => {
    const classes = new Set();
    (funds || []).forEach(fund => {
      const assetClass = fund.asset_class || fund.assetClass;
      if (assetClass) classes.add(assetClass);
    });
    return Array.from(classes).sort();
  }, [funds]);

  const filteredFunds = useMemo(() => {
    if (!funds) return [];
    
    return funds.filter(fund => {
      // Asset class filter
      if (filters.assetClasses.length > 0) {
        const fundAssetClass = fund.asset_class || fund.assetClass;
        if (!filters.assetClasses.includes(fundAssetClass)) return false;
      }
      
      // Score range filter
      if (fund.score != null) {
        if (fund.score < filters.scoreRange.min || fund.score > filters.scoreRange.max) {
          return false;
        }
      }
      
      // Search filter
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        const ticker = (fund.ticker || fund.symbol || '').toLowerCase();
        const name = (fund.name || fund.fund_name || '').toLowerCase();
        if (!ticker.includes(searchTerm) && !name.includes(searchTerm)) {
          return false;
        }
      }
      
      // Recommended filter
      if (filters.recommended && !fund.recommended) {
        return false;
      }
      
      // Performance filters
      if (filters.performance) {
        const performanceMetrics = {
          'YTD': fund.ytd_return,
          '1Y': fund.one_year_return,
          '3Y': fund.three_year_return,
          '5Y': fund.five_year_return
        };
        // Show top 25% performers for selected period
        // This is a simplified implementation - in real app, calculate percentiles
        const value = performanceMetrics[filters.performance];
        if (value == null || value < 5) return false; // Arbitrary threshold
      }
      
      // Risk filters
      if (filters.risk) {
        if (filters.risk === 'Low Volatility' && (fund.three_year_std_dev || 0) > 15) return false;
        if (filters.risk === 'High Sharpe' && (fund.three_year_sharpe || 0) < 1) return false;
        // Add more risk filters as needed
      }
      
      return true;
    });
  }, [funds, filters]);

  // KPI calculations
  const kpiData = useMemo(() => {
    if (!funds || funds.length === 0) {
      return {
        portfolioAvgScore: 0,
        topPerformer: null,
        assetsAnalyzed: 0,
        recommendedCount: 0,
        alertCount: 0
      };
    }

    const validScores = funds.filter(f => f.score != null).map(f => f.score);
    const avgScore = validScores.length > 0 
      ? validScores.reduce((sum, score) => sum + score, 0) / validScores.length 
      : 0;

    const topPerformer = funds.reduce((top, fund) => {
      if (!top || (fund.score || 0) > (top.score || 0)) {
        return fund;
      }
      return top;
    }, null);

    const recommendedCount = funds.filter(f => f.recommended).length;
    
    // Simple alert calculation - funds with score < 30 or missing critical data
    const alertCount = funds.filter(f => 
      (f.score != null && f.score < 30) || 
      f.expense_ratio == null || 
      f.ytd_return == null
    ).length;

    return {
      portfolioAvgScore: avgScore,
      topPerformer,
      assetsAnalyzed: funds.length,
      recommendedCount,
      alertCount
    };
  }, [funds]);

  // Event handlers
  const handleFundSelect = (fund) => {
    setSelectedFunds(prev => {
      const isAlreadySelected = prev.some(f => f.id === fund.id || f.ticker === fund.ticker);
      
      if (isAlreadySelected) {
        // Remove if already selected
        return prev.filter(f => f.id !== fund.id && f.ticker !== fund.ticker);
      } else {
        // Add to selection (max 4 funds for comparison)
        const updated = [...prev, fund];
        if (updated.length > 4) updated.shift(); // Remove oldest if over limit
        return updated;
      }
    });
    
    // Show right sidebar when funds are selected
    if (selectedFunds.length === 0) {
      setRightSidebarVisible(true);
    }
  };

  const handleRemoveFund = (fundToRemove) => {
    setSelectedFunds(prev => 
      prev.filter(f => f.id !== fundToRemove.id && f.ticker !== fundToRemove.ticker)
    );
  };

  const handleCloseFundView = () => {
    setRightSidebarVisible(false);
    setSelectedFunds([]);
  };

  // Auto-show right sidebar when funds are selected
  useEffect(() => {
    if (selectedFunds.length > 0 && !rightSidebarVisible) {
      setRightSidebarVisible(true);
    } else if (selectedFunds.length === 0 && rightSidebarVisible) {
      setRightSidebarVisible(false);
    }
  }, [selectedFunds.length, rightSidebarVisible]);

  if (error) {
    return (
      <div className="bloomberg-dashboard error-state">
        <div className="error-message">
          <h2>Failed to load fund data</h2>
          <p>{error.message || 'An unexpected error occurred'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bloomberg-dashboard ${leftSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Hero KPI Section */}
      <div className="dashboard-hero">
        <HeroKPISection 
          {...kpiData}
          loading={loading}
        />
      </div>

      <div className="dashboard-body">
        {/* Left Sidebar - Quick Filters */}
        <LeftSidebar
          filters={filters}
          onFiltersChange={setFilters}
          assetClasses={assetClasses}
          collapsed={leftSidebarCollapsed}
          onToggleCollapse={() => setLeftSidebarCollapsed(!leftSidebarCollapsed)}
        />

        {/* Main Content - Hybrid View System */}
        <div className="dashboard-main">
          <HybridViewSystem
            funds={filteredFunds}
            onFundSelect={handleFundSelect}
            selectedFunds={selectedFunds}
            loading={loading}
          />
        </div>

        {/* Right Sidebar - Fund Quick View */}
        {rightSidebarVisible && (
          <RightSidebar
            selectedFunds={selectedFunds}
            onClose={handleCloseFundView}
            onRemoveFund={handleRemoveFund}
          />
        )}
      </div>

      {/* Loading overlay */}
      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner large" />
          <p>Loading fund data...</p>
        </div>
      )}
    </div>
  );
};

export default BloombergDashboard;