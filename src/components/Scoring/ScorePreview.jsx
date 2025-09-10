/**
 * ScorePreview.jsx - Real-time score preview component
 * 
 * This component shows live fund scores and distribution charts
 * that update immediately as weight sliders are adjusted.
 */

import React, { useMemo, useState } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Eye, List, PieChart } from 'lucide-react';
import { getScoreColor, getScoreLabel } from '../../services/scoringService.js';

const ScorePreview = ({ funds, assetClassName, weights, loading }) => {
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'distribution' | 'chart'
  const [sortBy, setSortBy] = useState('score_final'); // 'score_final' | 'ticker' | 'name'
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' | 'desc'
  
  // Calculate score statistics
  const scoreStats = useMemo(() => {
    if (!funds || funds.length === 0) return null;
    
    const scores = funds.map(f => f.score_final || 0).filter(s => !isNaN(s));
    if (scores.length === 0) return null;
    
    const sorted = [...scores].sort((a, b) => a - b);
    const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    const median = sorted.length % 2 === 0 
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];
    
    // Score distribution by bands
    const distribution = {
      strong: scores.filter(s => s >= 60).length,
      healthy: scores.filter(s => s >= 55 && s < 60).length,
      neutral: scores.filter(s => s >= 45 && s < 55).length,
      caution: scores.filter(s => s >= 40 && s < 45).length,
      weak: scores.filter(s => s < 40).length
    };
    
    return {
      count: scores.length,
      min: Math.min(...scores),
      max: Math.max(...scores),
      mean,
      median,
      distribution
    };
  }, [funds]);
  
  // Sort funds
  const sortedFunds = useMemo(() => {
    if (!funds) return [];
    
    const sorted = [...funds].sort((a, b) => {
      let valueA, valueB;
      
      switch (sortBy) {
        case 'score_final':
          valueA = a.score_final || 0;
          valueB = b.score_final || 0;
          break;
        case 'ticker':
          valueA = a.ticker || '';
          valueB = b.ticker || '';
          break;
        case 'name':
          valueA = a.name || '';
          valueB = b.name || '';
          break;
        default:
          valueA = a.score_final || 0;
          valueB = b.score_final || 0;
      }
      
      if (typeof valueA === 'string') {
        return sortOrder === 'asc' 
          ? valueA.localeCompare(valueB)
          : valueB.localeCompare(valueA);
      }
      
      return sortOrder === 'asc' ? valueA - valueB : valueB - valueA;
    });
    
    return sorted;
  }, [funds, sortBy, sortOrder]);
  
  // Format score for display
  const formatScore = (score) => {
    if (score === null || score === undefined || isNaN(score)) return 'N/A';
    return score.toFixed(1);
  };
  
  // Get performance impact (mock calculation for demo)
  const getPerformanceMetrics = () => {
    if (!funds || funds.length === 0) return null;
    
    const calculationStart = performance.now();
    // Simulate the calculation timing
    setTimeout(() => {}, 0);
    const calculationEnd = performance.now();
    
    return {
      calculationTime: calculationEnd - calculationStart,
      fundsProcessed: funds.length,
      metricsEvaluated: Object.keys(weights).filter(k => weights[k] !== 0).length
    };
  };
  
  const performanceMetrics = getPerformanceMetrics();
  
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '200px',
        color: '#6B7280'
      }}>
        Loading preview...
      </div>
    );
  }
  
  if (!funds || funds.length === 0) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '200px',
        color: '#6B7280',
        textAlign: 'center'
      }}>
        <div>
          <Eye size={48} style={{ marginBottom: '12px', opacity: 0.5 }} />
          <div>Select an asset class to see real-time score preview</div>
        </div>
      </div>
    );
  }
  
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%',
      gap: '16px'
    }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start',
        gap: '16px'
      }}>
        <div>
          <h2 style={{ 
            margin: 0, 
            fontSize: '18px', 
            fontWeight: '600', 
            color: '#111827' 
          }}>
            Live Score Preview
          </h2>
          <p style={{ 
            margin: '4px 0 0 0', 
            fontSize: '14px', 
            color: '#6B7280' 
          }}>
            {assetClassName} • {funds.length} funds
          </p>
        </div>
        
        {/* View Mode Selector */}
        <div style={{ 
          display: 'flex', 
          border: '1px solid #E5E7EB', 
          borderRadius: '6px',
          backgroundColor: '#F9FAFB'
        }}>
          {[
            { key: 'table', icon: List, label: 'Table' },
            { key: 'distribution', icon: BarChart3, label: 'Chart' },
            { key: 'chart', icon: PieChart, label: 'Stats' }
          ].map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setViewMode(key)}
              style={{
                padding: '6px 12px',
                border: 'none',
                backgroundColor: viewMode === key ? '#3B82F6' : 'transparent',
                color: viewMode === key ? 'white' : '#6B7280',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                borderRadius: viewMode === key ? '4px' : 'none'
              }}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>
      
      {/* Performance Metrics */}
      {performanceMetrics && (
        <div style={{
          padding: '8px 12px',
          backgroundColor: '#F0FDF4',
          border: '1px solid #BBF7D0',
          borderRadius: '4px',
          fontSize: '12px',
          color: '#166534',
          display: 'flex',
          justifyContent: 'space-between'
        }}>
          <span>{performanceMetrics.fundsProcessed} funds • {performanceMetrics.metricsEvaluated} metrics</span>
          <span>{performanceMetrics.calculationTime.toFixed(1)}ms calc time</span>
        </div>
      )}
      
      {/* Content based on view mode */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {viewMode === 'table' && (
          <div style={{ flex: 1, overflow: 'auto' }}>
            {/* Table Controls */}
            <div style={{ 
              display: 'flex', 
              gap: '12px', 
              marginBottom: '12px',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', color: '#6B7280' }}>Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  style={{
                    padding: '4px 8px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '4px',
                    fontSize: '12px'
                  }}
                >
                  <option value="score_final">Score</option>
                  <option value="ticker">Ticker</option>
                  <option value="name">Name</option>
                </select>
              </div>
              
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                style={{
                  padding: '4px 8px',
                  border: '1px solid #D1D5DB',
                  borderRadius: '4px',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                {sortOrder === 'asc' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {sortOrder.toUpperCase()}
              </button>
            </div>
            
            {/* Score Table */}
            <div style={{ 
              border: '1px solid #E5E7EB', 
              borderRadius: '6px',
              overflow: 'hidden'
            }}>
              <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F9FAFB' }}>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>
                      Fund
                    </th>
                    <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>
                      Score
                    </th>
                    <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#374151' }}>
                      Rating
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedFunds.map((fund, index) => {
                    const score = fund.score_final || 0;
                    const scoreColor = getScoreColor(score);
                    const scoreLabel = getScoreLabel(score);
                    
                    return (
                      <tr 
                        key={fund.ticker || index}
                        style={{ 
                          borderTop: index > 0 ? '1px solid #F3F4F6' : 'none',
                          backgroundColor: index % 2 === 0 ? '#FEFEFE' : '#FAFBFC'
                        }}
                      >
                        <td style={{ padding: '12px' }}>
                          <div>
                            <div style={{ fontWeight: '500', color: '#111827' }}>
                              {fund.ticker}
                            </div>
                            <div style={{ 
                              fontSize: '12px', 
                              color: '#6B7280',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: '200px'
                            }}>
                              {fund.name}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          <div style={{ 
                            fontWeight: '600', 
                            color: scoreColor,
                            fontSize: '16px'
                          }}>
                            {formatScore(score)}
                          </div>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <span style={{
                            padding: '4px 8px',
                            backgroundColor: scoreColor + '20',
                            color: scoreColor,
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: '500'
                          }}>
                            {scoreLabel}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {viewMode === 'distribution' && scoreStats && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Score Distribution Chart */}
            <div>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600' }}>
                Score Distribution
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Object.entries(scoreStats.distribution).map(([band, count]) => {
                  const percentage = (count / scoreStats.count) * 100;
                  const colors = {
                    strong: '#10B981',
                    healthy: '#34D399', 
                    neutral: '#FCD34D',
                    caution: '#F97316',
                    weak: '#EF4444'
                  };
                  
                  return (
                    <div key={band} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ minWidth: '80px', fontSize: '14px', textTransform: 'capitalize' }}>
                        {band}:
                      </div>
                      <div style={{ flex: 1, height: '20px', backgroundColor: '#E5E7EB', borderRadius: '10px', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${percentage}%`,
                          backgroundColor: colors[band],
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                      <div style={{ minWidth: '60px', fontSize: '14px', textAlign: 'right' }}>
                        {count} ({percentage.toFixed(1)}%)
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Distribution Summary */}
            <div style={{
              padding: '16px',
              backgroundColor: '#F9FAFB',
              border: '1px solid #E5E7EB',
              borderRadius: '6px'
            }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600' }}>
                Summary Statistics
              </h4>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px' }}>
                <div>Mean: <strong>{scoreStats.mean.toFixed(1)}</strong></div>
                <div>Median: <strong>{scoreStats.median.toFixed(1)}</strong></div>
                <div>Min: <strong>{scoreStats.min.toFixed(1)}</strong></div>
                <div>Max: <strong>{scoreStats.max.toFixed(1)}</strong></div>
              </div>
            </div>
          </div>
        )}
        
        {viewMode === 'chart' && scoreStats && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
              Weight Impact Analysis
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', flex: 1 }}>
              {/* Active Weights */}
              <div style={{
                padding: '16px',
                border: '1px solid #E5E7EB',
                borderRadius: '6px'
              }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600' }}>
                  Active Weights
                </h4>
                
                {Object.entries(weights)
                  .filter(([_, weight]) => weight > 0)
                  .sort(([,a], [,b]) => b - a)
                  .map(([metric, weight]) => (
                    <div key={metric} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '6px 0',
                      borderBottom: '1px solid #F3F4F6'
                    }}>
                      <span style={{ fontSize: '13px' }}>
                        {metric.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                      <span style={{ fontWeight: '600' }}>
                        {(weight * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
              </div>
              
              {/* Score Range */}
              <div style={{
                padding: '16px',
                border: '1px solid #E5E7EB',
                borderRadius: '6px'
              }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600' }}>
                  Score Range
                </h4>
                
                <div style={{ fontSize: '24px', fontWeight: '700', color: '#111827', textAlign: 'center' }}>
                  {scoreStats.min.toFixed(1)} - {scoreStats.max.toFixed(1)}
                </div>
                
                <div style={{ textAlign: 'center', marginTop: '8px', color: '#6B7280' }}>
                  Spread: {(scoreStats.max - scoreStats.min).toFixed(1)} points
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScorePreview;