// src/components/Analytics/CorrelationMatrix.jsx
import React, { useState, useMemo } from 'react';
import { Activity, Info } from 'lucide-react';
import { calculateCorrelationMatrix } from '../../services/analytics';

/**
 * Correlation Matrix Component
 * Visualizes correlations between funds in a heatmap format
 */
const CorrelationMatrix = ({ funds }) => {
  const [selectedAssetClass, setSelectedAssetClass] = useState('all');
  const [matrixSize, setMatrixSize] = useState(10);
  const [correlationMetric, setCorrelationMetric] = useState('1 Year');

  // Get unique asset classes
  const assetClasses = useMemo(() => {
    if (!funds || !Array.isArray(funds)) {
      return ['all'];
    }
    const classes = new Set(funds.map(f => f['Asset Class'] || 'Unknown'));
    return ['all', ...Array.from(classes).sort()];
  }, [funds]);

  // Filter and limit funds for display
  const displayFunds = useMemo(() => {
    if (!funds || !Array.isArray(funds)) {
      return [];
    }
    
    let filtered = funds;
    
    if (selectedAssetClass !== 'all') {
      filtered = funds.filter(f => f['Asset Class'] === selectedAssetClass);
    }
    
    // Sort by score and take top N
    return filtered
      .filter(f => f[correlationMetric] != null)
      .sort((a, b) => (b.scores?.final || 0) - (a.scores?.final || 0))
      .slice(0, matrixSize);
  }, [funds, selectedAssetClass, matrixSize, correlationMetric]);

  // Calculate correlation matrix
  const correlationMatrix = useMemo(() => {
    return calculateCorrelationMatrix(displayFunds, correlationMetric);
  }, [displayFunds, correlationMetric]);

  // Get color for correlation value
  const getCorrelationColor = (value) => {
    if (value === 1) return '#1e3a8a'; // Perfect correlation (diagonal)
    if (value >= 0.7) return '#2563eb'; // Strong positive
    if (value >= 0.3) return '#60a5fa'; // Moderate positive
    if (value >= -0.3) return '#e5e7eb'; // Weak/no correlation
    if (value >= -0.7) return '#f87171'; // Moderate negative
    return '#dc2626'; // Strong negative
  };

  // Get text color for contrast
  const getTextColor = (value) => {
    return Math.abs(value) > 0.5 ? 'white' : '#374151';
  };

  if (displayFunds.length === 0) {
    return (
      <div style={{
        padding: '3rem',
        textAlign: 'center',
        backgroundColor: '#f9fafb',
        borderRadius: '0.5rem',
        color: '#6b7280'
      }}>
        <Activity size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
        <p>No funds available for correlation analysis</p>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: '2rem' }}>
      <div style={{ marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          Correlation Matrix Analysis
        </h3>
        <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
          Analyze relationships between fund performances
        </p>
      </div>

      {/* Controls */}
      <div style={{
        display: 'flex',
        gap: '1rem',
        marginBottom: '1rem',
        flexWrap: 'wrap'
      }}>
        <select
          value={selectedAssetClass}
          onChange={(e) => setSelectedAssetClass(e.target.value)}
          style={{
            padding: '0.5rem',
            border: '1px solid #d1d5db',
            borderRadius: '0.375rem',
            fontSize: '0.875rem'
          }}
        >
          {assetClasses.map(ac => (
            <option key={ac} value={ac}>
              {ac === 'all' ? 'All Asset Classes' : ac}
            </option>
          ))}
        </select>

        <select
          value={correlationMetric}
          onChange={(e) => setCorrelationMetric(e.target.value)}
          style={{
            padding: '0.5rem',
            border: '1px solid #d1d5db',
            borderRadius: '0.375rem',
            fontSize: '0.875rem'
          }}
        >
          <option value="1 Year">1-Year Returns</option>
          <option value="3 Year">3-Year Returns</option>
          <option value="5 Year">5-Year Returns</option>
        </select>

        <select
          value={matrixSize}
          onChange={(e) => setMatrixSize(Number(e.target.value))}
          style={{
            padding: '0.5rem',
            border: '1px solid #d1d5db',
            borderRadius: '0.375rem',
            fontSize: '0.875rem'
          }}
        >
          <option value={5}>Top 5 Funds</option>
          <option value={10}>Top 10 Funds</option>
          <option value={15}>Top 15 Funds</option>
          <option value={20}>Top 20 Funds</option>
        </select>
      </div>

      {/* Correlation Matrix */}
      <div style={{
        overflowX: 'auto',
        backgroundColor: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '0.5rem'
      }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '0.75rem'
        }}>
          <thead>
            <tr>
              <th style={{
                padding: '0.5rem',
                textAlign: 'left',
                backgroundColor: '#f9fafb',
                position: 'sticky',
                left: 0,
                zIndex: 10
              }}>
                Fund
              </th>
              {displayFunds.map((fund, i) => (
                <th
                  key={i}
                  style={{
                    padding: '0.5rem',
                    textAlign: 'center',
                    backgroundColor: '#f9fafb',
                    writingMode: 'vertical-rl',
                    textOrientation: 'mixed',
                    height: '80px',
                    fontSize: '0.6875rem'
                  }}
                >
                  {fund.Symbol}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayFunds.map((fund1, i) => (
              <tr key={i}>
                <td style={{
                  padding: '0.5rem',
                  fontWeight: '600',
                  backgroundColor: '#f9fafb',
                  position: 'sticky',
                  left: 0,
                  borderRight: '1px solid #e5e7eb'
                }}>
                  <div>{fund1.Symbol}</div>
                  <div style={{ fontSize: '0.6875rem', color: '#6b7280' }}>
                    {fund1.displayName?.substring(0, 20)}...
                  </div>
                </td>
                {displayFunds.map((fund2, j) => {
                  const correlation = correlationMatrix[fund1.Symbol]?.[fund2.Symbol] || 0;
                  const bgColor = getCorrelationColor(correlation);
                  const textColor = getTextColor(correlation);
                  
                  return (
                    <td
                      key={j}
                      style={{
                        padding: '0.5rem',
                        textAlign: 'center',
                        backgroundColor: bgColor,
                        color: textColor,
                        fontWeight: i === j ? 'bold' : 'normal',
                        cursor: i !== j ? 'pointer' : 'default'
                      }}
                      title={i !== j ? `${fund1.Symbol} vs ${fund2.Symbol}: ${correlation.toFixed(3)}` : ''}
                    >
                      {correlation.toFixed(2)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div style={{
        marginTop: '1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        fontSize: '0.75rem',
        color: '#6b7280'
      }}>
        <Info size={16} />
        <span>Correlation Scale:</span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <div style={{ width: '20px', height: '20px', backgroundColor: '#dc2626' }}></div>
            <span>-1.0</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <div style={{ width: '20px', height: '20px', backgroundColor: '#e5e7eb' }}></div>
            <span>0.0</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <div style={{ width: '20px', height: '20px', backgroundColor: '#2563eb' }}></div>
            <span>1.0</span>
          </div>
        </div>
      </div>

      {/* Insights */}
      <div style={{
        marginTop: '1rem',
        padding: '1rem',
        backgroundColor: '#eff6ff',
        borderRadius: '0.375rem',
        fontSize: '0.875rem'
      }}>
        <h4 style={{ fontWeight: '600', marginBottom: '0.5rem' }}>
          Correlation Insights
        </h4>
        <ul style={{ marginLeft: '1.5rem', color: '#1e40af' }}>
          <li>Higher correlation (closer to 1.0) indicates funds tend to move together</li>
          <li>Negative correlation (closer to -1.0) indicates funds move in opposite directions</li>
          <li>Low correlation (near 0.0) suggests funds are relatively independent</li>
          <li>Diversification improves with lower correlations between holdings</li>
        </ul>
      </div>
    </div>
  );
};

export default CorrelationMatrix;