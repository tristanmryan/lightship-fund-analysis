// src/components/Dashboard/EnhancedPerformanceDashboard.jsx
import React, { useState, useMemo, useCallback } from 'react';
import { 
  TrendingUp, BarChart3, Grid, Table, RefreshCw, Download,
  Filter, Eye, Target, AlertCircle, Info
} from 'lucide-react';
import AdvancedFilters from './AdvancedFilters';
import EnhancedFundTable from './EnhancedFundTable';
import PerformanceHeatmap from './PerformanceHeatmap';
import TopBottomPerformers from './TopBottomPerformers';
import AssetClassOverview from './AssetClassOverview';
import FundDetailsModal from '../FundDetailsModal';
import ComparisonPanel from './ComparisonPanel';

/**
 * Enhanced Performance Dashboard
 * Comprehensive dashboard with advanced filtering and multiple view modes
 */
const EnhancedPerformanceDashboard = ({ funds, onRefresh, isLoading = false }) => {
  // State management
  const [filteredFunds, setFilteredFunds] = useState(funds || []);
  const [activeFilters, setActiveFilters] = useState({});
  const [viewMode, setViewMode] = useState('table'); // 'table', 'heatmap', 'overview', 'performers', 'compare'
  const [selectedFund, setSelectedFund] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Handle filter changes
  const handleFilterChange = useCallback((filtered, filters) => {
    setFilteredFunds(filtered);
    setActiveFilters(filters);
  }, []);

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
    setShowDetailsModal(true);
  }, []);

  // Render view mode content
  const renderViewContent = () => {
    switch (viewMode) {
      case 'table':
        return (
          <EnhancedFundTable 
            funds={filteredFunds}
            onFundSelect={handleFundSelect}
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
      
      default:
        return null;
    }
  };

  // Get active filter summary
  const getFilterSummary = () => {
    const activeCount = Object.values(activeFilters).filter(value => {
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === 'object') return Object.values(value).some(v => v !== '' && v !== 'all');
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
          </div>
          
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
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
                backgroundColor: '#3b82f6',
                color: 'white',
                fontSize: '0.875rem',
                cursor: 'pointer'
              }}
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
        <AdvancedFilters 
          funds={funds}
          onFilterChange={handleFilterChange}
        />

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
              { key: 'compare', label: 'Compare', icon: Info }
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