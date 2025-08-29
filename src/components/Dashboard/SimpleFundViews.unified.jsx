import React, { useState } from 'react';
import { Grid, List, Star, BarChart3 } from 'lucide-react';
import DataTable from '../common/DataTable';
import { BASIC_COLUMNS, createColumnDefinition } from '../../config/tableColumns';
import ScoringTrends from './ScoringTrends.jsx';

// Feature flag for gradual migration
const USE_UNIFIED_TABLE = (process.env.REACT_APP_USE_UNIFIED_TABLES || 'false') === 'true';

// Import legacy component for fallback
import LegacySimpleFundViews from './SimpleFundViews.jsx';

const ViewToggle = ({ currentView, onViewChange }) => (
  <div className="view-toggle-simple">
    <button 
      className={`view-btn ${currentView === 'table' ? 'active' : ''}`}
      onClick={() => onViewChange('table')}
    >
      <List size={16} />
      Table
    </button>
    <button 
      className={`view-btn ${currentView === 'cards' ? 'active' : ''}`}
      onClick={() => onViewChange('cards')}
    >
      <Grid size={16} />
      Cards
    </button>
  </div>
);

// Custom Score Badge component with confidence indicators
const ScoreBadge = ({ score, confidence, weightsSource, title }) => {
  if (score == null || isNaN(score)) {
    return <span className="score-badge score-unknown">N/A</span>;
  }

  let className = 'score-badge ';
  if (score >= 70) className += 'score-excellent';
  else if (score >= 50) className += 'score-good';
  else className += 'score-poor';

  // Add confidence indicator class
  if (confidence) {
    className += ` confidence-${confidence.level?.toLowerCase() || 'medium'}`;
  }

  // Add advanced weighting indicator
  if (weightsSource === 'advanced') {
    className += ' advanced-weighted';
  }

  // Build tooltip content
  const tooltipContent = [
    title || 'Fund Score',
    confidence ? `Confidence: ${confidence.level} (${confidence.overall}%)` : null,
    weightsSource ? `Weights: ${weightsSource}` : null
  ].filter(Boolean).join('\n');

  return (
    <span className={className} title={tooltipContent}>
      {score.toFixed(1)}
      {confidence && confidence.level === 'Low' && (
        <span className="confidence-warning" aria-label="Low confidence score">⚠</span>
      )}
      {weightsSource === 'advanced' && (
        <span className="advanced-indicator" aria-label="Advanced weighting applied">⭐</span>
      )}
    </span>
  );
};

// Custom columns for SimpleFundViews with scoring confidence and trends
const createSimpleFundColumns = (onTrendsClick) => [
  // Fund symbol and name combined
  createColumnDefinition({
    key: 'symbol',
    label: 'Fund',
    fallbackKeys: ['ticker', 'Symbol'],
    width: '180px',
    renderer: (value, fund) => (
      <div className="fund-cell">
        <div className="fund-ticker">{value}</div>
        <div className="fund-name">{fund.name || fund.fund_name}</div>
      </div>
    )
  }),
  
  // Asset class
  createColumnDefinition({
    key: 'assetClass',
    label: 'Asset Class',
    fallbackKeys: ['asset_class', 'Asset Class'],
    width: '120px'
  }),
  
  // Score with confidence indicators
  createColumnDefinition({
    key: 'score',
    label: 'Score',
    fallbackKeys: ['score_final', 'scores.final'],
    width: '90px',
    getValue: (fund) => fund.scores?.final || fund.score_final || fund.score,
    renderer: (value, fund) => (
      <ScoreBadge 
        score={value}
        confidence={fund.scores?.confidence}
        weightsSource={fund.scores?.weightsSource}
        title={`${fund.ticker} Score`}
      />
    )
  }),
  
  // YTD Return
  createColumnDefinition({
    key: 'ytdReturn',
    label: 'YTD Return',
    fallbackKeys: ['ytd_return', 'Total Return - YTD (%)'],
    width: '100px',
    isNumeric: true,
    isPercent: true,
    renderer: (value) => {
      const className = `numeric ${(value || 0) >= 0 ? 'positive' : 'negative'}`;
      return (
        <span className={className}>
          {value != null ? `${value > 0 ? '+' : ''}${value.toFixed(2)}%` : 'N/A'}
        </span>
      );
    }
  }),
  
  // 1Y Return
  createColumnDefinition({
    key: 'oneYearReturn',
    label: '1Y Return', 
    fallbackKeys: ['one_year_return', 'Total Return - 1 Year (%)'],
    width: '100px',
    isNumeric: true,
    isPercent: true,
    renderer: (value) => {
      const className = `numeric ${(value || 0) >= 0 ? 'positive' : 'negative'}`;
      return (
        <span className={className}>
          {value != null ? `${value > 0 ? '+' : ''}${value.toFixed(2)}%` : 'N/A'}
        </span>
      );
    }
  }),
  
  // 3Y Return
  createColumnDefinition({
    key: 'threeYearReturn',
    label: '3Y Return',
    fallbackKeys: ['three_year_return', 'Annualized Total Return - 3 Year (%)'],
    width: '100px',
    isNumeric: true,
    isPercent: true,
    renderer: (value) => {
      const className = `numeric ${(value || 0) >= 0 ? 'positive' : 'negative'}`;
      return (
        <span className={className}>
          {value != null ? `${value > 0 ? '+' : ''}${value.toFixed(2)}%` : 'N/A'}
        </span>
      );
    }
  }),
  
  // Sharpe Ratio
  createColumnDefinition({
    key: 'sharpeRatio',
    label: 'Sharpe Ratio',
  fallbackKeys: ['three_year_sharpe', 'sharpe_ratio'],
    width: '100px',
    isNumeric: true,
    renderer: (value) => (
      <span className="numeric">
        {value?.toFixed(2) || 'N/A'}
      </span>
    )
  }),
  
  // Expense Ratio
  createColumnDefinition({
    key: 'expenseRatio',
    label: 'Expense Ratio',
    fallbackKeys: ['expense_ratio', 'Net Exp Ratio (%)'],
    width: '110px',
    isNumeric: true,
    renderer: (value) => (
      <span className="numeric">
        {value ? `${(value * 100).toFixed(2)}%` : 'N/A'}
      </span>
    )
  }),
  
  // Recommended status
  createColumnDefinition({
    key: 'recommended',
    label: 'Rec.',
    fallbackKeys: ['is_recommended'],
    width: '60px',
    alignment: 'center',
    renderer: (value, fund) => (
      fund.recommended && <Star size={16} className="recommended-star" />
    )
  }),
  
  // Trends button
  createColumnDefinition({
    key: 'trends',
    label: 'Trends',
    sortable: false,
    width: '70px',
    alignment: 'center',
    renderer: (_, fund) => (
      <button
        className="trends-btn"
        onClick={() => onTrendsClick?.(fund)}
        title={`View scoring trends for ${fund.ticker}`}
      >
        <BarChart3 size={16} />
      </button>
    )
  })
];

// Card view component (unchanged from original)
const FundCardsView = ({ funds, onTrendsClick }) => (
  <div className="cards-view-simple">
    {funds.map((fund, index) => (
      <div key={fund.id || fund.ticker || index} className="fund-card-simple">
        <div className="fund-header">
          <div className="fund-ticker">{fund.ticker || fund.symbol}</div>
          <div className="fund-actions">
            {fund.recommended && <Star size={16} className="recommended-star" />}
            <button
              className="trends-btn"
              onClick={() => onTrendsClick?.(fund)}
              title={`View scoring trends for ${fund.ticker}`}
            >
              <BarChart3 size={16} />
            </button>
          </div>
        </div>
        <div className="fund-name">{fund.name || fund.fund_name}</div>
        <div className="fund-asset-class">{fund.asset_class || fund.assetClass}</div>
        
        <div className="fund-metrics">
          <div className="metric-row">
            <span className="metric-label">Score:</span>
            <ScoreBadge 
              score={fund.scores?.final || fund.score}
              confidence={fund.scores?.confidence}
              weightsSource={fund.scores?.weightsSource}
              title={`${fund.ticker} Score`}
            />
          </div>
          
          <div className="metric-row">
            <span className="metric-label">YTD:</span>
            <span className={`metric-value ${(fund.ytd_return || 0) >= 0 ? 'positive' : 'negative'}`}>
              {fund.ytd_return != null ? `${fund.ytd_return > 0 ? '+' : ''}${fund.ytd_return.toFixed(2)}%` : 'N/A'}
            </span>
          </div>
          
          <div className="metric-row">
            <span className="metric-label">1Y:</span>
            <span className={`metric-value ${(fund.one_year_return || 0) >= 0 ? 'positive' : 'negative'}`}>
              {fund.one_year_return != null ? `${fund.one_year_return > 0 ? '+' : ''}${fund.one_year_return.toFixed(2)}%` : 'N/A'}
            </span>
          </div>
          
          <div className="metric-row">
            <span className="metric-label">3Y:</span>
            <span className={`metric-value ${(fund.three_year_return || 0) >= 0 ? 'positive' : 'negative'}`}>
              {fund.three_year_return != null ? `${fund.three_year_return > 0 ? '+' : ''}${fund.three_year_return.toFixed(2)}%` : 'N/A'}
            </span>
          </div>
          
          <div className="metric-row">
            <span className="metric-label">Sharpe:</span>
            <span className="metric-value">
            {Number.isFinite(fund.three_year_sharpe ?? fund.sharpe_ratio) ? Number(fund.three_year_sharpe ?? fund.sharpe_ratio).toFixed(2) : 'N/A'}
            </span>
          </div>
          
          <div className="metric-row">
            <span className="metric-label">Expense:</span>
            <span className="metric-value">
            {Number.isFinite(fund.expense_ratio) ? (Number(fund.expense_ratio).toFixed(2) + '%') : 'N/A'}
            </span>
          </div>
        </div>
      </div>
    ))}
  </div>
);

/**
 * Unified SimpleFundViews Component
 * Uses the DataTable component with BASIC_COLUMNS configuration
 * Maintains all existing functionality including trends integration and confidence indicators
 */
const SimpleFundViews = ({ 
  funds = [], 
  showTrends = true,
  initialView = 'table',
  onFundSelect,
  className = '',
  style = {}
}) => {
  const [view, setView] = useState(initialView);
  const [selectedFund, setSelectedFund] = useState(null);
  
  // Feature flag fallback to legacy component
  if (!USE_UNIFIED_TABLE) {
    return (
      <LegacySimpleFundViews 
        funds={funds}
        showTrends={showTrends}
        initialView={initialView}
        onFundSelect={onFundSelect}
        className={className}
        style={style}
      />
    );
  }

  const handleTrendsClick = (fund) => {
    if (showTrends) {
      setSelectedFund(selectedFund?.ticker === fund.ticker ? null : fund);
    }
  };

  const handleRowClick = (fund) => {
    onFundSelect?.(fund);
  };

  // Create columns with trends click handler
  const columns = createSimpleFundColumns(handleTrendsClick);

  return (
    <div className={`simple-fund-views ${className}`} style={style}>
      {/* View Toggle */}
      <ViewToggle currentView={view} onViewChange={setView} />
      
      {/* Main Content */}
      <div className="view-content">
        {view === 'table' ? (
          <DataTable
            // Data
            data={funds}
            columns={columns}
            
            // Configuration for SimpleFundViews
            theme="default"
            density="compact"
            
            // Features
            enableSorting={true}
            enableFiltering={false}
            enableSelection={false}
            enableExport={false}
            enableVirtualScrolling={false}
            
            // Visual options
            stickyHeader={false}
            showRowHover={true}
            highlightRecommended={true}
            highlightBenchmarks={false}
            
            // Initial sort by score descending
            sortConfig={[{ key: 'score', direction: 'desc' }]}
            
            // Event handlers
            onRowClick={handleRowClick}
            
            // Styling
            className="simple-fund-table"
            style={{ maxHeight: '600px' }}
            
            // Accessibility
            ariaLabel="Simple fund overview table with scoring trends"
          />
        ) : (
          <FundCardsView 
            funds={funds}
            onTrendsClick={handleTrendsClick}
          />
        )}
      </div>
      
      {/* Trends Panel */}
      {showTrends && selectedFund && (
        <div className="trends-panel">
          <div className="trends-header">
            <h3>Scoring Trends: {selectedFund.ticker}</h3>
            <button 
              className="close-trends"
              onClick={() => setSelectedFund(null)}
              aria-label="Close trends panel"
            >
              ×
            </button>
          </div>
          <ScoringTrends 
            fund={selectedFund}
            onClose={() => setSelectedFund(null)}
          />
        </div>
      )}
    </div>
  );
};

export default SimpleFundViews;
