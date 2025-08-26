import React, { useState } from 'react';
import { Grid, List, Star, ArrowUpDown, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import ScoringTrends from './ScoringTrends.jsx';

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

const formatPercentage = (value) => {
  if (value == null || isNaN(value)) return 'N/A';
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
};

const FundTableView = ({ funds, onSort, sortColumn, sortDirection, onTrendsClick }) => {
  const SortHeader = ({ column, children, numeric = false }) => (
    <th 
      className={`sortable ${numeric ? 'numeric' : ''} ${sortColumn === column ? 'sorted' : ''}`}
      onClick={() => onSort(column)}
    >
      <div className="sort-header">
        {children}
        <ArrowUpDown size={14} className="sort-icon" />
        {sortColumn === column && (
          <span className="sort-direction">
            {sortDirection === 'asc' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          </span>
        )}
      </div>
    </th>
  );

  return (
    <div className="table-view-simple">
      <table className="funds-table-simple">
        <thead>
          <tr>
            <SortHeader column="ticker">Fund</SortHeader>
            <SortHeader column="asset_class">Asset Class</SortHeader>
            <SortHeader column="score" numeric>Score</SortHeader>
            <SortHeader column="ytd_return" numeric>YTD Return</SortHeader>
            <SortHeader column="one_year_return" numeric>1Y Return</SortHeader>
            <SortHeader column="three_year_return" numeric>3Y Return</SortHeader>
            <SortHeader column="three_year_sharpe" numeric>Sharpe Ratio</SortHeader>
            <SortHeader column="expense_ratio" numeric>Expense Ratio</SortHeader>
            <th className="text-center">Rec.</th>
            <th className="text-center">Trends</th>
          </tr>
        </thead>
        <tbody>
          {funds.map((fund, index) => (
            <tr key={fund.id || fund.ticker || index} className="fund-row">
              <td>
                <div className="fund-cell">
                  <div className="fund-ticker">{fund.ticker || fund.symbol}</div>
                  <div className="fund-name">{fund.name || fund.fund_name}</div>
                </div>
              </td>
              <td>{fund.asset_class || fund.assetClass}</td>
              <td className="text-center">
                <ScoreBadge 
                  score={fund.score} 
                  confidence={fund.scores?.confidence}
                  weightsSource={fund.scores?.weightsSource}
                  title={`${fund.ticker} Score`}
                />
              </td>
              <td className={`numeric ${(fund.ytd_return || 0) >= 0 ? 'positive' : 'negative'}`}>
                {formatPercentage(fund.ytd_return)}
              </td>
              <td className={`numeric ${(fund.one_year_return || 0) >= 0 ? 'positive' : 'negative'}`}>
                {formatPercentage(fund.one_year_return)}
              </td>
              <td className={`numeric ${(fund.three_year_return || 0) >= 0 ? 'positive' : 'negative'}`}>
                {formatPercentage(fund.three_year_return)}
              </td>
              <td className="numeric">
                {fund.three_year_sharpe?.toFixed(2) || 'N/A'}
              </td>
              <td className="numeric">
                {fund.expense_ratio ? `${(fund.expense_ratio * 100).toFixed(2)}%` : 'N/A'}
              </td>
              <td className="text-center">
                {fund.recommended && <Star size={16} className="recommended-star" />}
              </td>
              <td className="text-center">
                <button
                  className="trends-btn"
                  onClick={() => onTrendsClick(fund)}
                  title={`View scoring trends for ${fund.ticker}`}
                >
                  <BarChart3 size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const FundCard = ({ fund, onTrendsClick }) => (
  <div className="fund-card-simple">
    <div className="fund-card-header">
      <div className="fund-info">
        <div className="fund-ticker">{fund.ticker || fund.symbol}</div>
        <div className="fund-name">{fund.name || fund.fund_name}</div>
        <div className="fund-asset-class">{fund.asset_class || fund.assetClass}</div>
      </div>
      <div className="fund-score-container">
        <ScoreBadge 
          score={fund.score} 
          confidence={fund.scores?.confidence}
          weightsSource={fund.scores?.weightsSource}
          title={`${fund.ticker} Score`}
        />
        {fund.recommended && <Star size={16} className="recommended-star" />}
      </div>
    </div>
    
    <div className="fund-metrics">
      <div className="metric-row">
        <span className="metric-label">YTD Return</span>
        <span className={`metric-value ${(fund.ytd_return || 0) >= 0 ? 'positive' : 'negative'}`}>
          {formatPercentage(fund.ytd_return)}
        </span>
      </div>
      <div className="metric-row">
        <span className="metric-label">1Y Return</span>
        <span className={`metric-value ${(fund.one_year_return || 0) >= 0 ? 'positive' : 'negative'}`}>
          {formatPercentage(fund.one_year_return)}
        </span>
      </div>
      <div className="metric-row">
        <span className="metric-label">3Y Return</span>
        <span className={`metric-value ${(fund.three_year_return || 0) >= 0 ? 'positive' : 'negative'}`}>
          {formatPercentage(fund.three_year_return)}
        </span>
      </div>
      <div className="metric-row">
        <span className="metric-label">Sharpe Ratio</span>
        <span className="metric-value">
          {fund.three_year_sharpe?.toFixed(2) || 'N/A'}
        </span>
      </div>
      <div className="metric-row">
        <span className="metric-label">Expense Ratio</span>
        <span className="metric-value">
          {fund.expense_ratio ? `${(fund.expense_ratio * 100).toFixed(2)}%` : 'N/A'}
        </span>
      </div>
    </div>
    
    <div className="card-actions">
      <button
        className="trends-btn card-trends-btn"
        onClick={() => onTrendsClick(fund)}
        title={`View scoring trends for ${fund.ticker}`}
      >
        <BarChart3 size={16} />
        View Trends
      </button>
    </div>
  </div>
);

const FundCardsView = ({ funds, onTrendsClick }) => (
  <div className="cards-view-simple">
    {funds.map((fund, index) => (
      <FundCard key={fund.id || fund.ticker || index} fund={fund} onTrendsClick={onTrendsClick} />
    ))}
  </div>
);

const SimpleFundViews = ({ funds = [], loading = false }) => {
  const [currentView, setCurrentView] = useState('table');
  const [sortColumn, setSortColumn] = useState('score');
  const [sortDirection, setSortDirection] = useState('desc');
  const [selectedFundForTrends, setSelectedFundForTrends] = useState(null);

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const getSortedFunds = () => {
    if (!sortColumn || !funds.length) return funds;
    
    return [...funds].sort((a, b) => {
      let aVal = a[sortColumn];
      let bVal = b[sortColumn];
      
      // Handle null/undefined values
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      
      // Convert to numbers if numeric
      if (typeof aVal === 'string' && !isNaN(aVal)) aVal = parseFloat(aVal);
      if (typeof bVal === 'string' && !isNaN(bVal)) bVal = parseFloat(bVal);
      
      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  };

  const sortedFunds = getSortedFunds();

  if (loading) {
    return (
      <div className="loading-state">
        <div className="loading-spinner" />
        <p>Loading fund data...</p>
      </div>
    );
  }

  if (!funds.length) {
    return (
      <div className="empty-state">
        <p>No funds match your current filters.</p>
      </div>
    );
  }

  return (
    <div className="simple-fund-views">
      <div className="view-header">
        <div className="view-info">
          <h3>Fund Analysis</h3>
          <p>{funds.length} funds displayed</p>
        </div>
        <ViewToggle currentView={currentView} onViewChange={setCurrentView} />
      </div>
      
      <div className="view-content">
        {currentView === 'table' && (
          <FundTableView 
            funds={sortedFunds} 
            onSort={handleSort}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onTrendsClick={setSelectedFundForTrends}
          />
        )}
        {currentView === 'cards' && (
          <FundCardsView funds={sortedFunds} onTrendsClick={setSelectedFundForTrends} />
        )}
      </div>

      {selectedFundForTrends && (
        <ScoringTrends
          fund={selectedFundForTrends}
          onClose={() => setSelectedFundForTrends(null)}
        />
      )}
    </div>
  );
};

export default SimpleFundViews;