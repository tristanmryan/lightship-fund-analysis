// src/components/Dashboard/ScoreBreakdownChart.jsx
import React, { useMemo, useState } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Info, Target } from 'lucide-react';
import { formatNumber } from '../../utils/formatters';
import { METRICS_CONFIG } from '../../services/scoring';

/**
 * Professional Score Breakdown Chart Component
 * Provides visual representations of metric contributions to final scores
 * Designed for advisor-client meetings with clear, professional styling
 */
const ScoreBreakdownChart = ({ fund, chartType = 'waterfall' }) => {
  const [hoveredMetric, setHoveredMetric] = useState(null);
  const [selectedView, setSelectedView] = useState('contribution'); // 'contribution' | 'zscore' | 'percentile'

  // Extract and process score breakdown data
  const chartData = useMemo(() => {
    if (!fund?.scores?.breakdown) return [];
    
    const breakdown = fund.scores.breakdown;
    const data = Object.entries(breakdown)
      .map(([key, info]) => {
        const label = METRICS_CONFIG.labels[key] || key;
        const contribution = info.reweightedContribution || info.weightedZScore || 0;
        const zScore = info.zScore || 0;
        const percentile = info.percentile || 50;
        const weight = info.weight || 0;
        const coverage = info.coverage || null;
        
        return {
          key,
          label,
          contribution: Math.round(contribution * 1000) / 1000,
          zScore: Math.round(zScore * 1000) / 1000,
          percentile,
          weight,
          coverage,
          isPositive: contribution >= 0,
          absContribution: Math.abs(contribution)
        };
      })
      .filter(item => Number.isFinite(item.contribution))
      .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

    return data;
  }, [fund]);

  // Calculate cumulative score for waterfall chart
  const waterfallData = useMemo(() => {
    if (chartType !== 'waterfall') return [];
    
    let cumulative = 0;
    return chartData.map(item => {
      const start = cumulative;
      cumulative += item.contribution;
      return {
        ...item,
        start,
        end: cumulative
      };
    });
  }, [chartData, chartType]);

  // Chart dimensions and styling
  const chartHeight = 300;
  const chartWidth = 100;
  const barWidth = 20;
  const barSpacing = 8;

  // Color scheme for professional appearance
  const colors = {
    positive: '#059669', // Green for positive contributions
    negative: '#DC2626', // Red for negative contributions
    neutral: '#6B7280', // Gray for neutral
    background: '#F9FAFB',
    border: '#E5E7EB',
    text: '#1F2937',
    textLight: '#6B7280'
  };

  // Render waterfall chart
  const renderWaterfallChart = () => {
    if (waterfallData.length === 0) return null;

    const maxAbs = Math.max(...waterfallData.map(d => Math.abs(d.contribution)));
    const scale = (chartHeight - 40) / (maxAbs * 2);

    return (
      <div style={{ position: 'relative', height: chartHeight, padding: '20px 0' }}>
        {/* Y-axis labels */}
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 60, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: 12, color: colors.textLight }}>
          <span>{formatNumber(maxAbs, 2)}</span>
          <span>0</span>
          <span>{formatNumber(-maxAbs, 2)}</span>
        </div>

        {/* Chart area */}
        <div style={{ marginLeft: 60, position: 'relative', height: '100%' }}>
          {/* Zero line */}
          <div style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: '50%',
            height: 1,
            backgroundColor: colors.border,
            zIndex: 1
          }} />

          {/* Bars */}
          {waterfallData.map((item, index) => {
            const x = index * (barWidth + barSpacing);
            const height = Math.abs(item.contribution) * scale;
            const y = item.contribution >= 0 
              ? (chartHeight / 2) - height 
              : (chartHeight / 2);
            
            const isHovered = hoveredMetric === item.key;
            
            return (
              <g key={item.key}>
                {/* Bar */}
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={height}
                  fill={item.isPositive ? colors.positive : colors.negative}
                  opacity={isHovered ? 0.8 : 0.6}
                  style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
                  onMouseEnter={() => setHoveredMetric(item.key)}
                  onMouseLeave={() => setHoveredMetric(null)}
                />
                
                {/* Value label */}
                <text
                  x={x + barWidth / 2}
                  y={item.contribution >= 0 ? y - 5 : y + height + 15}
                  textAnchor="middle"
                  fontSize="10"
                  fill={colors.text}
                  fontWeight="500"
                >
                  {formatNumber(item.contribution, 2)}
                </text>
                
                {/* Metric label */}
                <text
                  x={x + barWidth / 2}
                  y={chartHeight - 5}
                  textAnchor="middle"
                  fontSize="9"
                  fill={colors.textLight}
                  transform={`rotate(-45 ${x + barWidth / 2} ${chartHeight - 5})`}
                >
                  {item.label}
                </text>
              </g>
            );
          })}
        </div>
      </div>
    );
  };

  // Render horizontal bar chart
  const renderBarChart = () => {
    if (chartData.length === 0) return null;

    const maxAbs = Math.max(...chartData.map(d => d.absContribution));
    const scale = (chartWidth - 40) / maxAbs;

    return (
      <div style={{ padding: '20px 0' }}>
        {chartData.map((item, index) => {
          const barWidth = item.absContribution * scale;
          const isHovered = hoveredMetric === item.key;
          
          return (
            <div key={item.key} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ 
                  fontSize: 12, 
                  color: colors.text, 
                  fontWeight: 500, 
                  width: 80, 
                  textAlign: 'right',
                  marginRight: 12
                }}>
                  {item.label}
                </span>
                <div style={{ 
                  flex: 1, 
                  height: 20, 
                  backgroundColor: colors.background, 
                  borderRadius: 4,
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    position: 'absolute',
                    left: item.isPositive ? 0 : 'auto',
                    right: item.isPositive ? 'auto' : 0,
                    top: 0,
                    width: barWidth,
                    height: '100%',
                    backgroundColor: item.isPositive ? colors.positive : colors.negative,
                    opacity: isHovered ? 0.8 : 0.6,
                    transition: 'opacity 0.2s',
                    borderRadius: item.isPositive ? '0 4px 4px 0' : '4px 0 0 4px'
                  }} />
                </div>
                <span style={{ 
                  fontSize: 12, 
                  color: colors.text, 
                  fontWeight: 600, 
                  width: 50, 
                  textAlign: 'right',
                  marginLeft: 12
                }}>
                  {formatNumber(item.contribution, 2)}
                </span>
              </div>
              
              {/* Coverage indicator */}
              {item.coverage !== null && (
                <div style={{ 
                  fontSize: 10, 
                  color: colors.textLight, 
                  marginLeft: 92,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}>
                  <div style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: item.coverage >= 0.8 ? colors.positive : 
                                   item.coverage >= 0.6 ? '#F59E0B' : colors.negative
                  }} />
                  {Math.round(item.coverage * 100)}% coverage
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Render radar chart
  const renderRadarChart = () => {
    if (chartData.length === 0) return null;

    const centerX = chartWidth / 2;
    const centerY = chartHeight / 2;
    const radius = Math.min(centerX, centerY) - 30;
    
    // Create radar chart points
    const points = chartData.map((item, index) => {
      const angle = (index / chartData.length) * 2 * Math.PI - Math.PI / 2;
      const normalizedValue = Math.max(-1, Math.min(1, item.contribution / 2)); // Normalize to -1 to 1
      const pointRadius = radius * (0.3 + 0.7 * (normalizedValue + 1) / 2);
      
      return {
        ...item,
        x: centerX + pointRadius * Math.cos(angle),
        y: centerY + pointRadius * Math.sin(angle),
        angle
      };
    });

    return (
      <div style={{ position: 'relative', height: chartHeight, padding: '20px' }}>
        <svg width={chartWidth} height={chartHeight} style={{ display: 'block', margin: '0 auto' }}>
          {/* Background circles */}
          {[0.25, 0.5, 0.75, 1].map(scale => (
            <circle
              key={scale}
              cx={centerX}
              cy={centerY}
              r={radius * scale}
              fill="none"
              stroke={colors.border}
              strokeWidth={0.5}
              opacity={0.3}
            />
          ))}
          
          {/* Axis lines */}
          {chartData.map((_, index) => {
            const angle = (index / chartData.length) * 2 * Math.PI - Math.PI / 2;
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);
            
            return (
              <line
                key={index}
                x1={centerX}
                y1={centerY}
                x2={x}
                y2={y}
                stroke={colors.border}
                strokeWidth={0.5}
                opacity={0.3}
              />
            );
          })}
          
          {/* Data points */}
          {points.map((point, index) => {
            const isHovered = hoveredMetric === point.key;
            
            return (
              <g key={point.key}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={isHovered ? 6 : 4}
                  fill={point.isPositive ? colors.positive : colors.negative}
                  opacity={isHovered ? 0.8 : 0.6}
                  style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={() => setHoveredMetric(point.key)}
                  onMouseLeave={() => setHoveredMetric(null)}
                />
                
                {/* Label */}
                <text
                  x={point.x + (point.x > centerX ? 8 : -8)}
                  y={point.y + (point.y > centerY ? 4 : -4)}
                  textAnchor={point.x > centerX ? 'start' : 'end'}
                  fontSize="10"
                  fill={colors.text}
                  fontWeight="500"
                >
                  {point.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  // Render selected chart type
  const renderChart = () => {
    switch (chartType) {
      case 'waterfall':
        return renderWaterfallChart();
      case 'radar':
        return renderRadarChart();
      case 'bars':
      default:
        return renderBarChart();
    }
  };

  // Chart type selector
  const chartTypes = [
    { key: 'bars', label: 'Horizontal Bars', icon: BarChart3 },
    { key: 'waterfall', label: 'Waterfall', icon: TrendingUp },
    { key: 'radar', label: 'Radar', icon: Target }
  ];

  if (!fund?.scores?.breakdown) {
    return (
      <div style={{ 
        padding: 20, 
        textAlign: 'center', 
        color: colors.textLight,
        backgroundColor: colors.background,
        borderRadius: 8,
        border: `1px solid ${colors.border}`
      }}>
        <Info size={24} style={{ marginBottom: 8, opacity: 0.5 }} />
        <div>No score breakdown available for this fund</div>
      </div>
    );
  }

  return (
    <div style={{ 
      backgroundColor: colors.white, 
      borderRadius: 8, 
      border: `1px solid ${colors.border}`,
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{ 
        padding: '16px 20px', 
        borderBottom: `1px solid ${colors.border}`,
        backgroundColor: colors.background
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ 
              margin: 0, 
              fontSize: 16, 
              fontWeight: 600, 
              color: colors.text 
            }}>
              Score Breakdown Analysis
            </h3>
            <p style={{ 
              margin: '4px 0 0 0', 
              fontSize: 12, 
              color: colors.textLight 
            }}>
              Metric contributions to {fund.ticker || fund.Symbol} score: {formatNumber(fund.scores?.final || 0, 1)}
            </p>
          </div>
          
          {/* Chart type selector */}
          <div style={{ display: 'flex', gap: 4 }}>
            {chartTypes.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setSelectedView(key)}
                style={{
                  padding: '6px 12px',
                  border: `1px solid ${selectedView === key ? colors.primary : colors.border}`,
                  borderRadius: 6,
                  backgroundColor: selectedView === key ? colors.primary : colors.white,
                  color: selectedView === key ? colors.white : colors.text,
                  fontSize: 12,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.2s'
                }}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart content */}
      <div style={{ padding: '20px', minHeight: chartHeight }}>
        {renderChart()}
      </div>

      {/* Legend */}
      <div style={{ 
        padding: '12px 20px', 
        borderTop: `1px solid ${colors.border}`,
        backgroundColor: colors.background,
        fontSize: 12,
        color: colors.textLight
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 12, height: 12, backgroundColor: colors.positive, borderRadius: 2 }} />
            <span>Positive contribution</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 12, height: 12, backgroundColor: colors.negative, borderRadius: 2 }} />
            <span>Negative contribution</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 12, height: 12, backgroundColor: colors.neutral, borderRadius: 2 }} />
            <span>Neutral</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScoreBreakdownChart; 