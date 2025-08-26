import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus, Info, Calendar } from 'lucide-react';
import { getFundScoringHistory, analyzeScoringTrends, generateScoringInsights } from '../../services/scoringHistory.js';

const TrendIcon = ({ trend }) => {
  if (trend === 'improving') return <TrendingUp size={16} className="trend-up" />;
  if (trend === 'declining') return <TrendingDown size={16} className="trend-down" />;
  return <Minus size={16} className="trend-stable" />;
};

const TrendChart = ({ history }) => {
  if (!history || history.length < 2) {
    return <div className="trend-chart-empty">Insufficient data for trend visualization</div>;
  }

  // Simple ASCII-style chart for now (could be replaced with proper chart library)
  const scores = history.map(h => h.score);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const range = maxScore - minScore || 1;

  return (
    <div className="trend-chart">
      <div className="chart-header">
        <span className="chart-label">Score History ({history.length} months)</span>
        <div className="score-range">
          <span className="score-min">{minScore.toFixed(1)}</span>
          <span className="score-separator">—</span>
          <span className="score-max">{maxScore.toFixed(1)}</span>
        </div>
      </div>
      <div className="chart-bars">
        {history.slice(-12).map((point, index) => {
          const height = ((point.score - minScore) / range) * 100;
          const isRecent = index >= history.length - 3;
          return (
            <div
              key={point.date}
              className={`chart-bar ${isRecent ? 'recent' : ''}`}
              style={{ height: `${Math.max(height, 5)}%` }}
              title={`${point.date}: ${point.score.toFixed(1)}`}
            />
          );
        })}
      </div>
    </div>
  );
};

const InsightCard = ({ insight }) => {
  const getInsightIcon = (type) => {
    switch (type) {
      case 'positive': return '✓';
      case 'warning': return '⚠';
      case 'info': return 'ℹ';
      default: return '•';
    }
  };

  return (
    <div className={`insight-card insight-${insight.type}`}>
      <div className="insight-icon">{getInsightIcon(insight.type)}</div>
      <div className="insight-content">
        <div className="insight-title">{insight.title}</div>
        <div className="insight-message">{insight.message}</div>
      </div>
    </div>
  );
};

const ScoringTrends = ({ fund, onClose }) => {
  const [history, setHistory] = useState([]);
  const [trends, setTrends] = useState(null);
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!fund?.ticker) return;

    const loadScoringHistory = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get 12 months of scoring history
        const fundHistory = await getFundScoringHistory(fund.ticker, 12);
        
        if (fundHistory.length === 0) {
          setError('No historical scoring data available');
          return;
        }

        setHistory(fundHistory);

        // Analyze trends
        const trendAnalysis = analyzeScoringTrends(fundHistory);
        setTrends(trendAnalysis);

        // Generate insights
        const fundInsights = generateScoringInsights(fund.ticker, fundHistory, trendAnalysis);
        setInsights(fundInsights);

      } catch (err) {
        console.error('Failed to load scoring history:', err);
        setError('Failed to load scoring history');
      } finally {
        setLoading(false);
      }
    };

    loadScoringHistory();
  }, [fund?.ticker]);

  if (loading) {
    return (
      <div className="scoring-trends-panel loading">
        <div className="panel-header">
          <h3>Scoring Trends - {fund?.ticker}</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="loading-content">
          <div className="loading-spinner" />
          <p>Loading scoring history...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="scoring-trends-panel error">
        <div className="panel-header">
          <h3>Scoring Trends - {fund?.ticker}</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="error-content">
          <Info size={24} className="error-icon" />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="scoring-trends-panel">
      <div className="panel-header">
        <h3>Scoring Trends - {fund?.ticker}</h3>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>

      <div className="panel-content">
        {/* Current Score & Trend Summary */}
        <div className="trend-summary">
          <div className="current-score">
            <span className="score-label">Current Score</span>
            <span className="score-value">{fund?.score?.toFixed(1) || 'N/A'}</span>
          </div>
          
          {trends && (
            <div className="trend-info">
              <div className="trend-indicator">
                <TrendIcon trend={trends.trend} />
                <span className={`trend-label trend-${trends.trend}`}>
                  {trends.trend.charAt(0).toUpperCase() + trends.trend.slice(1)}
                </span>
              </div>
              <div className="trend-details">
                <span className="trend-change">
                  Recent Change: {trends.recentChange > 0 ? '+' : ''}{trends.recentChange}
                </span>
                <span className="trend-consistency">
                  Consistency: {trends.consistency}%
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Trend Chart */}
        <TrendChart history={history} />

        {/* Historical Data Table */}
        <div className="history-table-container">
          <h4>Historical Scores</h4>
          <div className="history-table">
            <div className="table-header">
              <span>Date</span>
              <span>Score</span>
              <span>Rank</span>
              <span>Asset Class Size</span>
            </div>
            {history.slice(0, 6).map((point) => (
              <div key={point.date} className="table-row">
                <span className="date">{new Date(point.date).toLocaleDateString()}</span>
                <span className={`score ${point.score >= 60 ? 'good' : point.score >= 40 ? 'medium' : 'poor'}`}>
                  {point.score.toFixed(1)}
                </span>
                <span className="rank">
                  {point.rank ? `#${point.rank}` : 'N/A'}
                  {point.totalFundsInClass ? ` of ${point.totalFundsInClass}` : ''}
                </span>
                <span className="class-size">{point.totalFundsInClass || 'N/A'} funds</span>
              </div>
            ))}
          </div>
        </div>

        {/* Insights */}
        {insights.length > 0 && (
          <div className="insights-section">
            <h4>Advisor Insights</h4>
            <div className="insights-list">
              {insights.map((insight, index) => (
                <InsightCard key={index} insight={insight} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScoringTrends;