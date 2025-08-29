import React, { useState } from 'react';
import { X, Star, TrendingUp, BarChart3, AlertTriangle, Info, ExternalLink } from 'lucide-react';

const RightSidebar = ({ selectedFunds = [], onClose, onRemoveFund }) => {
  const [activeTab, setActiveTab] = useState('overview');

  if (selectedFunds.length === 0) {
    return (
      <div className="right-sidebar empty">
        <div className="sidebar-header">
          <h3>Fund Quick View</h3>
          <button className="close-button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="empty-state">
          <BarChart3 size={48} className="empty-icon" />
          <p>Select funds to view detailed information and comparisons</p>
        </div>
      </div>
    );
  }

  const formatPercentage = (value) => {
    if (value == null || isNaN(value)) return 'N/A';
    return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const getScoreColor = (score) => {
    if (score >= 70) return '#10B981';
    if (score >= 50) return '#F59E0B';
    return '#EF4444';
  };

  const getScoreCategory = (score) => {
    if (score >= 70) return 'Excellent';
    if (score >= 50) return 'Good';
    return 'Review';
  };

  const renderOverview = () => {
    if (selectedFunds.length === 1) {
      const fund = selectedFunds[0];
      return (
        <div className="fund-overview">
          <div className="fund-header">
            <div className="fund-identity">
              <h4>{fund.ticker || fund.symbol}</h4>
              <p className="fund-name">{fund.name || fund.fund_name}</p>
              <span className="asset-class-badge">{fund.asset_class || fund.assetClass}</span>
            </div>
            <div className="fund-score-large" style={{ '--score-color': getScoreColor(fund.score) }}>
              <div className="score-value">{fund.score?.toFixed(1) || 'N/A'}</div>
              <div className="score-category">{getScoreCategory(fund.score)}</div>
            </div>
          </div>

          {fund.recommended && (
            <div className="recommended-banner">
              <Star size={16} />
              <span>Recommended Fund</span>
            </div>
          )}

          <div className="key-metrics">
            <h5>Performance Metrics</h5>
            <div className="metrics-grid">
              <div className="metric-item">
                <span className="metric-label">YTD Return</span>
                <span className={`metric-value ${(fund.ytd_return || 0) >= 0 ? 'positive' : 'negative'}`}>
                  {formatPercentage(fund.ytd_return)}
                </span>
              </div>
              <div className="metric-item">
                <span className="metric-label">1 Year</span>
                <span className={`metric-value ${(fund.one_year_return || 0) >= 0 ? 'positive' : 'negative'}`}>
                  {formatPercentage(fund.one_year_return)}
                </span>
              </div>
              <div className="metric-item">
                <span className="metric-label">3 Year</span>
                <span className={`metric-value ${(fund.three_year_return || 0) >= 0 ? 'positive' : 'negative'}`}>
                  {formatPercentage(fund.three_year_return)}
                </span>
              </div>
              <div className="metric-item">
                <span className="metric-label">5 Year</span>
                <span className={`metric-value ${(fund.five_year_return || 0) >= 0 ? 'positive' : 'negative'}`}>
                  {formatPercentage(fund.five_year_return)}
                </span>
              </div>
            </div>
          </div>

          <div className="risk-metrics">
            <h5>Risk Metrics</h5>
            <div className="metrics-grid">
              <div className="metric-item">
                <span className="metric-label">3Y Sharpe</span>
                <span className="metric-value">{Number.isFinite(fund.three_year_sharpe ?? fund.sharpe_ratio) ? Number(fund.three_year_sharpe ?? fund.sharpe_ratio).toFixed(2) : 'N/A'}</span>
              </div>
              <div className="metric-item">
                <span className="metric-label">3Y Std Dev</span>
                <span className="metric-value">{fund.three_year_std_dev?.toFixed(2) || 'N/A'}</span>
              </div>
              <div className="metric-item">
                <span className="metric-label">Up Capture</span>
                <span className="metric-value">{fund.up_capture_ratio?.toFixed(1) || 'N/A'}%</span>
              </div>
              <div className="metric-item">
                <span className="metric-label">Down Capture</span>
                <span className="metric-value">{fund.down_capture_ratio?.toFixed(1) || 'N/A'}%</span>
              </div>
            </div>
          </div>

          <div className="fund-details">
            <h5>Fund Details</h5>
            <div className="detail-list">
              <div className="detail-item">
                <span className="detail-label">Expense Ratio</span>
                <span className="detail-value">
                  {Number.isFinite(fund.expense_ratio) ? (Number(fund.expense_ratio).toFixed(2) + '%') : 'N/A'}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Manager Tenure</span>
                <span className="detail-value">
                  {fund.manager_tenure ? `${fund.manager_tenure} years` : 'N/A'}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">5Y Alpha</span>
                <span className="detail-value">{fund.five_year_alpha?.toFixed(2) || 'N/A'}</span>
              </div>
            </div>
          </div>

          {fund.alerts && fund.alerts.length > 0 && (
            <div className="fund-alerts">
              <h5>
                <AlertTriangle size={16} />
                Alerts
              </h5>
              {fund.alerts.map((alert, index) => (
                <div key={index} className={`alert-item ${alert.severity}`}>
                  <span>{alert.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    // Multiple funds comparison
    return (
      <div className="funds-comparison">
        <h5>Comparison ({selectedFunds.length} funds)</h5>
        <div className="comparison-table">
          <table>
            <thead>
              <tr>
                <th>Fund</th>
                <th>Score</th>
                <th>YTD</th>
                <th>1Y</th>
                <th>Sharpe</th>
              </tr>
            </thead>
            <tbody>
              {selectedFunds.map(fund => (
                <tr key={fund.id || fund.ticker}>
                  <td>
                    <div className="fund-cell-compact">
                      <span className="ticker">{fund.ticker}</span>
                      <button 
                        className="remove-fund-btn"
                        onClick={() => onRemoveFund(fund)}
                        title="Remove from comparison"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </td>
                  <td>
                    <span 
                      className="score-badge-small"
                      style={{ backgroundColor: getScoreColor(fund.score) }}
                    >
                      {fund.score?.toFixed(1) || 'N/A'}
                    </span>
                  </td>
                  <td className={`numeric ${(fund.ytd_return || 0) >= 0 ? 'positive' : 'negative'}`}>
                    {formatPercentage(fund.ytd_return)}
                  </td>
                  <td className={`numeric ${(fund.one_year_return || 0) >= 0 ? 'positive' : 'negative'}`}>
                    {formatPercentage(fund.one_year_return)}
                  </td>
                  <td className="numeric">{Number.isFinite(fund.three_year_sharpe ?? fund.sharpe_ratio) ? Number(fund.three_year_sharpe ?? fund.sharpe_ratio).toFixed(2) : 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderAnalysis = () => (
    <div className="fund-analysis">
      <h5>Analysis & Insights</h5>
      {selectedFunds.map(fund => (
        <div key={fund.id || fund.ticker} className="fund-analysis-item">
          <h6>{fund.ticker}</h6>
          <div className="analysis-points">
            <div className={`analysis-point ${fund.score >= 70 ? 'positive' : fund.score >= 50 ? 'neutral' : 'negative'}`}>
              <TrendingUp size={14} />
              <span>
                Score of {fund.score?.toFixed(1)} indicates {getScoreCategory(fund.score).toLowerCase()} performance
              </span>
            </div>
            
            {(fund.ytd_return || 0) > 10 && (
              <div className="analysis-point positive">
                <TrendingUp size={14} />
                <span>Strong YTD performance at {formatPercentage(fund.ytd_return)}</span>
              </div>
            )}
            
            {Number(fund.three_year_sharpe ?? fund.sharpe_ratio || 0) > 1 && (
              <div className="analysis-point positive">
                <BarChart3 size={14} />
                <span>Excellent risk-adjusted returns (Sharpe: {Number.isFinite(fund.three_year_sharpe ?? fund.sharpe_ratio) ? Number(fund.three_year_sharpe ?? fund.sharpe_ratio).toFixed(2) : 'N/A'})</span>
              </div>
            )}
            
            {(Number(fund.expense_ratio || 0)) > 0.01 && (
              <div className="analysis-point negative">
                <AlertTriangle size={14} />
                <span>Higher expense ratio at {Number.isFinite(fund.expense_ratio) ? Number(fund.expense_ratio).toFixed(2) + '%' : 'N/A'}</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="right-sidebar">
      <div className="sidebar-header">
        <div className="sidebar-title">
          <h3>Fund Quick View</h3>
          <span className="fund-count">{selectedFunds.length} selected</span>
        </div>
        <button className="close-button" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      <div className="sidebar-tabs">
        <button 
          className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <Info size={16} />
          Overview
        </button>
        <button 
          className={`tab-button ${activeTab === 'analysis' ? 'active' : ''}`}
          onClick={() => setActiveTab('analysis')}
        >
          <BarChart3 size={16} />
          Analysis
        </button>
      </div>

      <div className="sidebar-content">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'analysis' && renderAnalysis()}
      </div>

      {selectedFunds.length > 0 && (
        <div className="sidebar-footer">
          <button className="btn btn-secondary full-width">
            <ExternalLink size={16} />
            View Full Comparison
          </button>
        </div>
      )}
    </div>
  );
};

export default RightSidebar;
