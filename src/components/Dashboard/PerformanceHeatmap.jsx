// src/components/Dashboard/PerformanceHeatmap.jsx
import React, { useState, useMemo } from 'react';
import { Info } from 'lucide-react';
import { getScoreColor } from '../../services/scoring';

/**
 * Performance Heatmap Component
 * Displays fund scores in a visual grid organized by asset class
 */
const PerformanceHeatmap = ({ funds }) => {
  const [selectedMetric, setSelectedMetric] = useState('score');
  const [hoveredFund, setHoveredFund] = useState(null);

  // Group funds by asset class
  const fundsByClass = useMemo(() => {
    const grouped = {};
    if (Array.isArray(funds)) {
      funds.forEach(fund => {
        const assetClass = fund['Asset Class'] || 'Unknown';
        if (!grouped[assetClass]) {
          grouped[assetClass] = [];
        }
        grouped[assetClass].push(fund);
      });
      // Sort funds within each class by score
      Object.keys(grouped).forEach(assetClass => {
        grouped[assetClass].sort((a, b) => (b.scores?.final || 0) - (a.scores?.final || 0));
      });
    }
    return grouped;
  }, [funds]);

  // Defensive: If funds is not an array or is empty, show a message
  if (!Array.isArray(funds) || funds.length === 0) {
    return (
      <div className="card" style={{ marginBottom: '2rem', padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Performance Heatmap</h3>
        <div>No fund data available. Please upload and import a valid fund data file.</div>
      </div>
    );
  }

  // Calculate color based on metric value
  const getMetricColor = (fund, metric) => {
    if (!fund) return '#e5e7eb';
    
    switch (metric) {
      case 'score':
        return fund.scores ? getScoreColor(fund.scores.final) : '#e5e7eb';
      
      case '1year':
        const oneYear = fund['1 Year'];
        if (oneYear == null) return '#e5e7eb';
        if (oneYear >= 15) return '#16a34a';
        if (oneYear >= 5) return '#eab308';
        if (oneYear >= 0) return '#f59e0b';
        return '#dc2626';
      
      case '3year':
        const threeYear = fund['3 Year'];
        if (threeYear == null) return '#e5e7eb';
        if (threeYear >= 12) return '#16a34a';
        if (threeYear >= 7) return '#eab308';
        if (threeYear >= 3) return '#f59e0b';
        return '#dc2626';
      
      case 'sharpe':
        const sharpe = fund['Sharpe Ratio'];
        if (sharpe == null) return '#e5e7eb';
        if (sharpe >= 1.0) return '#16a34a';
        if (sharpe >= 0.7) return '#eab308';
        if (sharpe >= 0.4) return '#f59e0b';
        return '#dc2626';
      
      case 'expense':
        const expense = fund['Net Expense Ratio'];
        if (expense == null) return '#e5e7eb';
        // Lower is better for expenses
        if (expense <= 0.5) return '#16a34a';
        if (expense <= 0.75) return '#eab308';
        if (expense <= 1.0) return '#f59e0b';
        return '#dc2626';
      
      default:
        return '#e5e7eb';
    }
  };

  // Get display value for metric
  const getMetricValue = (fund, metric) => {
    if (!fund) return '-';
    
    switch (metric) {
      case 'score':
        return fund.scores?.final || '-';
      case '1year':
        return fund['1 Year'] != null ? `${fund['1 Year'].toFixed(1)}%` : '-';
      case '3year':
        return fund['3 Year'] != null ? `${fund['3 Year'].toFixed(1)}%` : '-';
      case 'sharpe':
        return fund['Sharpe Ratio'] != null ? fund['Sharpe Ratio'].toFixed(2) : '-';
      case 'expense':
        return fund['Net Expense Ratio'] != null ? `${fund['Net Expense Ratio'].toFixed(2)}%` : '-';
      default:
        return '-';
    }
  };



  return (
    <div style={{ marginBottom: '2rem' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '1rem' 
      }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
          Performance Heatmap
        </h3>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value)}
            style={{
              padding: '0.5rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.375rem',
              fontSize: '0.875rem'
            }}
          >
            <option value="score">Overall Score</option>
            <option value="1year">1-Year Return</option>
            <option value="3year">3-Year Return</option>
            <option value="sharpe">Sharpe Ratio</option>
            <option value="expense">Expense Ratio</option>
          </select>
          
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem',
            fontSize: '0.75rem',
            color: '#6b7280'
          }}>
            <span>Poor</span>
            <div style={{ display: 'flex', gap: '2px' }}>
              <div style={{ width: '20px', height: '20px', backgroundColor: '#dc2626' }}></div>
              <div style={{ width: '20px', height: '20px', backgroundColor: '#f59e0b' }}></div>
              <div style={{ width: '20px', height: '20px', backgroundColor: '#eab308' }}></div>
              <div style={{ width: '20px', height: '20px', backgroundColor: '#16a34a' }}></div>
            </div>
            <span>Excellent</span>
          </div>
        </div>
      </div>

      <div style={{
        overflowX: 'auto',
        border: '1px solid #e5e7eb',
        borderRadius: '0.5rem'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '1rem'
        }}>
          {Object.entries(fundsByClass).map(([assetClass, classFunds]) => (
            <div key={assetClass} style={{ borderBottom: '1px solid #e5e7eb' }}>
              <div style={{
                padding: '0.75rem',
                backgroundColor: '#f9fafb',
                fontWeight: '600',
                fontSize: '0.875rem',
              position: 'sticky',
              left: 0
            }}>
              {assetClass} ({classFunds.length} funds)
            </div>
            
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: `repeat(auto-fill, minmax(80px, 1fr))`,
              gap: '4px',
              padding: '0.5rem'
            }}>
              {classFunds.map((fund, index) => {
                const color = getMetricColor(fund, selectedMetric);
                const value = getMetricValue(fund, selectedMetric);
                const isBenchmark = fund.isBenchmark;
                const isRecommended = fund.isRecommended;
                
                return (
                  <div
                    key={index}
                    style={{
                      backgroundColor: color,
                      color: 'white',
                      padding: '0.5rem',
                      borderRadius: '0.25rem',
                      textAlign: 'center',
                      cursor: 'pointer',
                      position: 'relative',
                      border: isBenchmark ? '2px solid #1f2937' : 
                              isRecommended ? '2px solid #3b82f6' : 'none',
                      transition: 'transform 0.1s',
                      transform: hoveredFund === fund ? 'scale(1.05)' : 'scale(1)'
                    }}
                    onMouseEnter={() => setHoveredFund(fund)}
                    onMouseLeave={() => setHoveredFund(null)}
                  >
                    <div style={{ 
                      fontSize: '0.75rem', 
                      fontWeight: '500',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {fund.Symbol}
                    </div>
                    <div style={{ 
                      fontSize: '0.875rem', 
                      fontWeight: 'bold',
                      marginTop: '0.125rem'
                    }}>
                      {value}
                    </div>
                    
                    {isBenchmark && (
                      <div style={{
                        position: 'absolute',
                        top: '2px',
                        right: '2px',
                        width: '12px',
                        height: '12px',
                        backgroundColor: '#1f2937',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '8px',
                        fontWeight: 'bold'
                      }}>
                        B
                      </div>
                    )}
                  </div>
                );
              })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hover tooltip */}
      {hoveredFund && (
        <div style={{
          position: 'fixed',
          bottom: '2rem',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '0.5rem',
          padding: '1rem',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
          zIndex: 1000,
          maxWidth: '400px'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
            {hoveredFund.displayName}
          </div>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr',
            gap: '0.5rem',
            fontSize: '0.875rem'
          }}>
            <div>
              <span style={{ color: '#6b7280' }}>Symbol:</span>{' '}
              <strong>{hoveredFund.Symbol}</strong>
            </div>
            <div>
              <span style={{ color: '#6b7280' }}>Score:</span>{' '}
              <strong>{hoveredFund.scores?.final || '-'}</strong>
            </div>
            <div>
              <span style={{ color: '#6b7280' }}>1Y Return:</span>{' '}
              <strong>{hoveredFund['1 Year']?.toFixed(2) || '-'}%</strong>
            </div>
            <div>
              <span style={{ color: '#6b7280' }}>Expense:</span>{' '}
              <strong>{hoveredFund['Net Expense Ratio']?.toFixed(2) || '-'}%</strong>
            </div>
          </div>
          {hoveredFund.isBenchmark && (
            <div style={{ 
              marginTop: '0.5rem',
              fontSize: '0.75rem',
              color: '#6b7280',
              fontStyle: 'italic'
            }}>
              Benchmark for {hoveredFund.benchmarkForClass}
            </div>
          )}
        </div>
      )}

      <div style={{ 
        marginTop: '0.75rem',
        fontSize: '0.75rem',
        color: '#6b7280',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
        <Info size={14} />
        <span>
          Hover over tiles for details. 
          Outlined tiles: <span style={{ fontWeight: 'bold' }}>Black = Benchmark</span>, 
          <span style={{ fontWeight: 'bold', color: '#3b82f6' }}> Blue = Recommended</span>
        </span>
      </div>
    </div>
  );
};

export default PerformanceHeatmap;