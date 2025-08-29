import React from 'react';

const SimpleKPIHeader = ({ 
  portfolioAvgScore = 0, 
  totalFunds = 0, 
  recommendedCount = 0, 
  loading = false 
}) => {
  const formatScore = (score) => {
    if (loading || score == null) return '—';
    return score.toFixed(1);
  };

  const getScoreColor = (score) => {
    if (score >= 70) return '#059669'; // Green
    if (score >= 50) return '#D97706'; // Orange
    return '#DC2626'; // Red
  };

  const kpis = [
    {
      label: 'Portfolio Avg Score',
      value: formatScore(portfolioAvgScore),
      color: getScoreColor(portfolioAvgScore)
    },
    {
      label: 'Total Funds',
      value: loading ? '—' : totalFunds.toLocaleString(),
      color: '#002D72'
    },
    {
      label: 'Recommended',
      value: loading ? '—' : recommendedCount.toLocaleString(),
      color: '#059669'
    },
    {
      label: 'Recommended %',
      value: loading ? '—' : totalFunds > 0 ? `${((recommendedCount / totalFunds) * 100).toFixed(0)}%` : '0%',
      color: '#6B7280'
    }
  ];

  return (
    <div className="simple-kpi-header">
      {kpis.map((kpi, index) => (
        <div key={index} className="kpi-metric">
          <div 
            className="kpi-value" 
            style={{ color: kpi.color }}
          >
            {kpi.value}
          </div>
          <div className="kpi-label">{kpi.label}</div>
        </div>
      ))}
    </div>
  );
};

export default SimpleKPIHeader;