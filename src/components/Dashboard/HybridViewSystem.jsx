import React, { useState } from 'react';
import { Grid, List, LayoutGrid, Star, TrendingUp, TrendingDown, ArrowUpDown } from 'lucide-react';

const ViewToggle = ({ currentView, onViewChange }) => (
  <div className="view-toggle">
    <button 
      className={`view-button ${currentView === 'table' ? 'active' : ''}`}
      onClick={() => onViewChange('table')}
      title="Table View"
    >
      <List size={16} />
      <span>Table</span>
    </button>
    <button 
      className={`view-button ${currentView === 'cards' ? 'active' : ''}`}
      onClick={() => onViewChange('cards')}
      title="Card View"
    >
      <Grid size={16} />
      <span>Cards</span>
    </button>
    <button 
      className={`view-button ${currentView === 'hybrid' ? 'active' : ''}`}
      onClick={() => onViewChange('hybrid')}
      title="Hybrid View"
    >
      <LayoutGrid size={16} />
      <span>Hybrid</span>
    </button>
  </div>
);

const FundCard = ({ fund, onSelect, isSelected }) => {
  const getScoreColor = (score) => {
    if (score >= 70) return '#10B981';
    if (score >= 50) return '#F59E0B';
    return '#EF4444';
  };

  const formatPercentage = (value) => {
    if (value == null || isNaN(value)) return 'N/A';
    return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  return (
    <div 
      className={`fund-card ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect(fund)}
    >
      <div className="fund-card-header">
        <div className="fund-identity">
          <div className="fund-ticker">{fund.ticker || fund.symbol}</div>
          <div className="fund-name">{fund.name || fund.fund_name}</div>
          <div className="fund-asset-class">{fund.asset_class || fund.assetClass}</div>
        </div>
        <div className="fund-score" style={{ '--score-color': getScoreColor(fund.score) }}>
          {fund.score?.toFixed(1) || 'N/A'}
        </div>
      </div>
      
      <div className="fund-card-metrics">
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
          <span className="metric-label">3Y Sharpe</span>
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
      
      {fund.recommended && (
        <div className="recommended-badge">
          <Star size={12} />
          Recommended
        </div>
      )}
    </div>
  );
};

const FundTableRow = ({ fund, onSelect, isSelected }) => {
  const formatPercentage = (value) => {
    if (value == null || isNaN(value)) return 'N/A';
    return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const getScoreColor = (score) => {
    if (score >= 70) return '#10B981';
    if (score >= 50) return '#F59E0B';
    return '#EF4444';
  };

  return (
    <tr 
      className={`fund-table-row ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect(fund)}
    >
      <td>
        <div className="fund-cell">
          <div className="fund-ticker">{fund.ticker || fund.symbol}</div>
          <div className="fund-name-small">{fund.name || fund.fund_name}</div>
        </div>
      </td>
      <td>{fund.asset_class || fund.assetClass}</td>
      <td>
        <div 
          className="score-badge" 
          style={{ 
            backgroundColor: getScoreColor(fund.score),
            color: 'white',
            padding: '4px 8px',
            borderRadius: '12px',
            fontWeight: '600',
            fontSize: '12px'
          }}
        >
          {fund.score?.toFixed(1) || 'N/A'}
        </div>
      </td>
      <td className={`numeric ${(fund.ytd_return || 0) >= 0 ? 'positive' : 'negative'}`}>
        {formatPercentage(fund.ytd_return)}
      </td>
      <td className={`numeric ${(fund.one_year_return || 0) >= 0 ? 'positive' : 'negative'}`}>
        {formatPercentage(fund.one_year_return)}
      </td>
      <td className="numeric">{fund.three_year_return ? formatPercentage(fund.three_year_return) : 'N/A'}</td>
      <td className="numeric">{fund.five_year_return ? formatPercentage(fund.five_year_return) : 'N/A'}</td>
      <td className="numeric">{fund.three_year_sharpe?.toFixed(2) || 'N/A'}</td>
      <td className="numeric">{fund.expense_ratio ? `${(fund.expense_ratio * 100).toFixed(2)}%` : 'N/A'}</td>
      <td className="text-center">
        {fund.recommended && <Star size={16} className="recommended-icon" />}
      </td>
    </tr>
  );
};

const HybridViewSystem = ({ funds = [], onFundSelect, selectedFunds = [] }) => {
  const [currentView, setCurrentView] = useState('hybrid');
  const [sortColumn, setSortColumn] = useState('score');
  const [sortDirection, setSortDirection] = useState('desc');

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const getSortedFunds = () => {
    if (!sortColumn) return funds;
    
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

  const SortHeader = ({ column, children }) => (
    <th 
      className={`sortable ${sortColumn === column ? 'sorted' : ''}`}
      onClick={() => handleSort(column)}
    >
      <div className="sort-header">
        {children}
        <div className="sort-indicators">
          <ArrowUpDown size={14} className="sort-icon" />
          {sortColumn === column && (
            <div className={`sort-direction ${sortDirection}`}>
              {sortDirection === 'asc' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            </div>
          )}
        </div>
      </div>
    </th>
  );

  const renderTableView = () => (
    <div className="table-view">
      <div className="table-container">
        <table className="funds-table">
          <thead>
            <tr>
              <SortHeader column="ticker">Fund</SortHeader>
              <SortHeader column="asset_class">Asset Class</SortHeader>
              <SortHeader column="score">Score</SortHeader>
              <SortHeader column="ytd_return">YTD</SortHeader>
              <SortHeader column="one_year_return">1Y</SortHeader>
              <SortHeader column="three_year_return">3Y</SortHeader>
              <SortHeader column="five_year_return">5Y</SortHeader>
              <SortHeader column="three_year_sharpe">Sharpe</SortHeader>
              <SortHeader column="expense_ratio">Expense</SortHeader>
              <th className="text-center">Rec.</th>
            </tr>
          </thead>
          <tbody>
            {sortedFunds.map(fund => (
              <FundTableRow
                key={fund.id || fund.ticker}
                fund={fund}
                onSelect={onFundSelect}
                isSelected={selectedFunds.some(f => f.id === fund.id)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderCardView = () => (
    <div className="card-view">
      <div className="cards-grid">
        {sortedFunds.map(fund => (
          <FundCard
            key={fund.id || fund.ticker}
            fund={fund}
            onSelect={onFundSelect}
            isSelected={selectedFunds.some(f => f.id === fund.id)}
          />
        ))}
      </div>
    </div>
  );

  const renderHybridView = () => (
    <div className="hybrid-view">
      <div className="hybrid-header">
        <h3>Top Performers</h3>
        <div className="hybrid-cards-compact">
          {sortedFunds.slice(0, 6).map(fund => (
            <FundCard
              key={fund.id || fund.ticker}
              fund={fund}
              onSelect={onFundSelect}
              isSelected={selectedFunds.some(f => f.id === fund.id)}
            />
          ))}
        </div>
      </div>
      
      <div className="hybrid-table">
        <h3>All Funds</h3>
        {renderTableView()}
      </div>
    </div>
  );

  return (
    <div className="hybrid-view-system">
      <div className="view-system-header">
        <div className="view-info">
          <h2>Fund Analysis</h2>
          <p>{funds.length} funds analyzed</p>
        </div>
        <ViewToggle currentView={currentView} onViewChange={setCurrentView} />
      </div>
      
      <div className="view-content">
        {currentView === 'table' && renderTableView()}
        {currentView === 'cards' && renderCardView()}
        {currentView === 'hybrid' && renderHybridView()}
      </div>
    </div>
  );
};

export default HybridViewSystem;