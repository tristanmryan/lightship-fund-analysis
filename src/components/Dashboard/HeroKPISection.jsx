import React from 'react';
import { TrendingUp, Award, BarChart3, AlertTriangle } from 'lucide-react';

const HeroKPISection = ({ 
  portfolioAvgScore = 0, 
  topPerformer = null, 
  assetsAnalyzed = 0, 
  recommendedCount = 0, 
  alertCount = 0,
  loading = false 
}) => {
  const kpis = [
    {
      label: 'Portfolio Avg Score',
      value: loading ? 'N/A' : portfolioAvgScore.toFixed(1),
      icon: TrendingUp,
      color: portfolioAvgScore >= 70 ? '#10B981' : portfolioAvgScore >= 50 ? '#F59E0B' : '#EF4444',
      trend: null
    },
    {
      label: 'Top Performer',
      value: loading ? 'N/A' : (topPerformer?.ticker || 'N/A'),
      subValue: loading ? '' : (topPerformer?.score ? `${topPerformer.score.toFixed(1)}` : ''),
      icon: Award,
      color: '#C9B037',
      trend: null
    },
    {
      label: 'Assets Analyzed',
      value: loading ? 'N/A' : assetsAnalyzed.toLocaleString(),
      icon: BarChart3,
      color: '#3B82F6',
      trend: null
    },
    {
      label: 'Recommended',
      value: loading ? 'N/A' : recommendedCount.toLocaleString(),
      subValue: loading ? '' : `${assetsAnalyzed > 0 ? ((recommendedCount / assetsAnalyzed) * 100).toFixed(0) : 0}%`,
      icon: Award,
      color: '#10B981',
      trend: null
    },
    {
      label: 'Alerts',
      value: loading ? 'N/A' : alertCount.toLocaleString(),
      icon: AlertTriangle,
      color: alertCount > 0 ? '#EF4444' : '#6B7280',
      trend: null
    }
  ];

  return (
    <div className="hero-kpi-section">
      <div className="kpi-grid">
        {kpis.map((kpi, index) => (
          <div key={index} className="kpi-card" style={{ '--kpi-color': kpi.color }}>
            <div className="kpi-icon">
              <kpi.icon size={24} />
            </div>
            <div className="kpi-content">
              <div className="kpi-value">
                {kpi.value}
                {kpi.subValue && <span className="kpi-subvalue">{kpi.subValue}</span>}
              </div>
              <div className="kpi-label">{kpi.label}</div>
            </div>
            {loading && <div className="kpi-loading-overlay" />}
          </div>
        ))}
      </div>
    </div>
  );
};

export default HeroKPISection;

