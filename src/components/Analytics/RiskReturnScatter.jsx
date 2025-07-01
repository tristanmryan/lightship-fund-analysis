// src/components/Analytics/RiskReturnScatter.jsx
import React, { useState, useMemo } from 'react';
import { TrendingUp, Target, Info } from 'lucide-react';
import { 
  calculateRiskReturnMetrics, 
  findEfficientFrontier,
  calculatePortfolioStatistics 
} from '../../services/analytics';

/**
 * Risk-Return Scatter Plot Component
 * Visualizes funds on a risk vs return chart with efficient frontier
 */
const RiskReturnScatter = ({ funds }) => {
  const [selectedAssetClass, setSelectedAssetClass] = useState('all');
  const [returnMetric, setReturnMetric] = useState('3 Year');
  const [highlightRecommended, setHighlightRecommended] = useState(true);
  const [showLabels, setShowLabels] = useState(false);
  const [hoveredFund, setHoveredFund] = useState(null);

  // Get unique asset classes
  const assetClasses = useMemo(() => {
    const classes = new Set(funds.map(f => f['Asset Class'] || 'Unknown'));
    return ['all', ...Array.from(classes).sort()];
  }, [funds]);

  // Filter funds and calculate metrics
  const { displayFunds, efficientFrontier, portfolioStats } = useMemo(() => {
    let filtered = funds;
    
    if (selectedAssetClass !== 'all') {
      filtered = funds.filter(f => f['Asset Class'] === selectedAssetClass);
    }
    
    // Calculate risk-return metrics
    const fundsWithMetrics = calculateRiskReturnMetrics(
      filtered.map(f => ({
        ...f,
        // Override return metric based on selection
        '3 Year': returnMetric === '1 Year' ? f['1 Year'] : f['3 Year']
      }))
    );
    
    // Filter funds with valid metrics
    const validFunds = fundsWithMetrics.filter(f => 
      f.riskReturnMetrics.return != null && 
      f.riskReturnMetrics.risk != null &&
      f.riskReturnMetrics.risk > 0
    );
    
    // Find efficient frontier
    const frontier = findEfficientFrontier(validFunds);
    
    // Calculate portfolio statistics
    const recommendedFunds = validFunds.filter(f => f.isRecommended);
    const stats = calculatePortfolioStatistics(recommendedFunds);
    
    return {
      displayFunds: validFunds,
      efficientFrontier: frontier,
      portfolioStats: stats
    };
  }, [funds, selectedAssetClass, returnMetric]);

  // Calculate chart bounds
  const chartBounds = useMemo(() => {
    if (displayFunds.length === 0) {
      return { minX: 0, maxX: 20, minY: -10, maxY: 30 };
    }
    
    const risks = displayFunds.map(f => f.riskReturnMetrics.risk);
    const returns = displayFunds.map(f => f.riskReturnMetrics.return);
    
    const minX = Math.max(0, Math.min(...risks) - 2);
    const maxX = Math.max(...risks) + 2;
    const minY = Math.min(...returns) - 2;
    const maxY = Math.max(...returns) + 2;
    
    return { minX, maxX, minY, maxY };
  }, [displayFunds]);

  // Scale functions for SVG
  const scaleX = (value) => {
    const { minX, maxX } = chartBounds;
    return 60 + ((value - minX) / (maxX - minX)) * 520;
  };
  
  const scaleY = (value) => {
    const { minY, maxY } = chartBounds;
    return 340 - ((value - minY) / (maxY - minY)) * 320;
  };

  // Get fund color
  const getFundColor = (fund) => {
    if (fund.isBenchmark) return '#fbbf24';
    if (fund.isRecommended) return '#3b82f6';
    if (fund.scores?.final >= 70) return '#16a34a';
    if (fund.scores?.final >= 50) return '#eab308';
    return '#dc2626';
  };

  return (
    <div style={{ marginBottom: '2rem' }}>
      <div style={{ marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          Risk-Return Analysis
        </h3>
        <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
          Evaluate fund efficiency and identify optimal risk-return combinations
        </p>
      </div>

      {/* Controls */}
      <div style={{
        display: 'flex',
        gap: '1rem',
        marginBottom: '1rem',
        flexWrap: 'wrap',
        alignItems: 'center'
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
          value={returnMetric}
          onChange={(e) => setReturnMetric(e.target.value)}
          style={{
            padding: '0.5rem',
            border: '1px solid #d1d5db',
            borderRadius: '0.375rem',
            fontSize: '0.875rem'
          }}
        >
          <option value="3 Year">3-Year Return</option>
          <option value="1 Year">1-Year Return</option>
        </select>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
          <input
            type="checkbox"
            checked={highlightRecommended}
            onChange={(e) => setHighlightRecommended(e.target.checked)}
          />
          Highlight Recommended
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
          <input
            type="checkbox"
            checked={showLabels}
            onChange={(e) => setShowLabels(e.target.checked)}
          />
          Show Labels
        </label>
      </div>

      {/* Portfolio Summary */}
      {portfolioStats.fundCount > 0 && (
        <div style={{
          marginBottom: '1rem',
          padding: '1rem',
          backgroundColor: '#f0f9ff',
          border: '1px solid #bfdbfe',
          borderRadius: '0.5rem',
          fontSize: '0.875rem'
        }}>
          <strong>Recommended Portfolio Summary:</strong>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '1rem',
            marginTop: '0.5rem'
          }}>
            <div>
              <span style={{ color: '#6b7280' }}>Expected Return:</span>{' '}
              <strong>{portfolioStats.expectedReturn.toFixed(2)}%</strong>
            </div>
            <div>
              <span style={{ color: '#6b7280' }}>Portfolio Risk:</span>{' '}
              <strong>{portfolioStats.risk.toFixed(2)}%</strong>
            </div>
            <div>
              <span style={{ color: '#6b7280' }}>Sharpe Ratio:</span>{' '}
              <strong>{portfolioStats.sharpeRatio.toFixed(2)}</strong>
            </div>
            <div>
              <span style={{ color: '#6b7280' }}>Avg Expense:</span>{' '}
              <strong>{portfolioStats.avgExpenseRatio.toFixed(2)}%</strong>
            </div>
          </div>
        </div>
      )}

      {/* Scatter Plot */}
      <div style={{
        backgroundColor: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '0.5rem',
        padding: '1rem'
      }}>
        <svg width="600" height="400" style={{ width: '100%', maxWidth: '600px' }}>
          {/* Grid lines */}
          <g>
            {[0, 5, 10, 15, 20, 25, 30].map(risk => {
              const x = scaleX(risk);
              if (x >= 60 && x <= 580) {
                return (
                  <g key={`vline-${risk}`}>
                    <line
                      x1={x} y1={20}
                      x2={x} y2={340}
                      stroke="#e5e7eb"
                      strokeDasharray="2,2"
                    />
                    <text
                      x={x} y={355}
                      textAnchor="middle"
                      fontSize="11"
                      fill="#6b7280"
                    >
                      {risk}%
                    </text>
                  </g>
                );
              }
              return null;
            })}
            
            {[-10, -5, 0, 5, 10, 15, 20, 25, 30].map(ret => {
              const y = scaleY(ret);
              if (y >= 20 && y <= 340) {
                return (
                  <g key={`hline-${ret}`}>
                    <line
                      x1={60} y1={y}
                      x2={580} y2={y}
                      stroke="#e5e7eb"
                      strokeDasharray="2,2"
                    />
                    <text
                      x={45} y={y + 4}
                      textAnchor="end"
                      fontSize="11"
                      fill="#6b7280"
                    >
                      {ret}%
                    </text>
                  </g>
                );
              }
              return null;
            })}
          </g>

          {/* Axes */}
          <line x1={60} y1={340} x2={580} y2={340} stroke="#374151" strokeWidth="2" />
          <line x1={60} y1={20} x2={60} y2={340} stroke="#374151" strokeWidth="2" />
          
          {/* Axis labels */}
          <text x={320} y={385} textAnchor="middle" fontSize="12" fontWeight="600" fill="#374151">
            Risk (Standard Deviation %)
          </text>
          <text
            x={25} y={180}
            textAnchor="middle"
            fontSize="12"
            fontWeight="600"
            fill="#374151"
            transform="rotate(-90 25 180)"
          >
            Return ({returnMetric} %)
          </text>

          {/* Efficient Frontier Line */}
          {efficientFrontier.length > 1 && (
            <path
              d={efficientFrontier
                .sort((a, b) => a.riskReturnMetrics.risk - b.riskReturnMetrics.risk)
                .map((fund, i) => {
                  const x = scaleX(fund.riskReturnMetrics.risk);
                  const y = scaleY(fund.riskReturnMetrics.return);
                  return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                })
                .join(' ')}
              stroke="#16a34a"
              strokeWidth="2"
              fill="none"
              strokeDasharray="4,2"
            />
          )}

          {/* Fund Points */}
          {displayFunds.map((fund, i) => {
            const x = scaleX(fund.riskReturnMetrics.risk);
            const y = scaleY(fund.riskReturnMetrics.return);
            const color = getFundColor(fund);
            const isOnFrontier = efficientFrontier.some(f => f.Symbol === fund.Symbol);
            const radius = fund.isBenchmark ? 8 : 
                          (highlightRecommended && fund.isRecommended) ? 7 : 5;
            
            return (
              <g key={i}>
                <circle
                  cx={x}
                  cy={y}
                  r={radius}
                  fill={color}
                  stroke={isOnFrontier ? '#16a34a' : 'white'}
                  strokeWidth={isOnFrontier ? 3 : 1}
                  opacity={highlightRecommended && !fund.isRecommended && !fund.isBenchmark ? 0.3 : 1}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredFund(fund)}
                  onMouseLeave={() => setHoveredFund(null)}
                />
                {(showLabels || fund.isBenchmark) && (
                  <text
                    x={x + 10}
                    y={y + 4}
                    fontSize="10"
                    fill="#374151"
                  >
                    {fund.Symbol}
                  </text>
                )}
              </g>
            );
          })}

          {/* Legend */}
          <g transform="translate(420, 30)">
            <rect x={0} y={0} width={150} height={120} fill="white" stroke="#e5e7eb" rx={4} />
            <text x={10} y={20} fontSize="12" fontWeight="600" fill="#374151">Legend</text>
            
            <circle cx={20} cy={40} r={5} fill="#3b82f6" />
            <text x={30} y={44} fontSize="11" fill="#374151">Recommended</text>
            
            <circle cx={20} cy={60} r={5} fill="#fbbf24" />
            <text x={30} y={64} fontSize="11" fill="#374151">Benchmark</text>
            
            <line x1={10} y1={80} x2={30} y2={80} stroke="#16a34a" strokeWidth="2" strokeDasharray="4,2" />
            <text x={35} y={84} fontSize="11" fill="#374151">Efficient Frontier</text>
            
            <circle cx={20} cy={100} r={3} fill="#16a34a" />
            <text x={30} y={104} fontSize="11" fill="#374151">Score 70+</text>
          </g>
        </svg>
      </div>

      {/* Hover tooltip */}
      {hoveredFund && (
        <div style={{
          position: 'fixed',
          backgroundColor: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '0.5rem',
          padding: '0.75rem',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          zIndex: 1000,
          pointerEvents: 'none',
          left: '50%',
          bottom: '2rem',
          transform: 'translateX(-50%)',
          maxWidth: '300px'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
            {hoveredFund.Symbol} - {hoveredFund['Fund Name']}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
            <div>Return: {hoveredFund.riskReturnMetrics.return.toFixed(2)}%</div>
            <div>Risk: {hoveredFund.riskReturnMetrics.risk.toFixed(2)}%</div>
            <div>Sharpe: {hoveredFund.riskReturnMetrics.sharpeRatio.toFixed(2)}</div>
            <div>Score: {hoveredFund.scores?.final || 'N/A'}</div>
          </div>
        </div>
      )}

      {/* Insights */}
      <div style={{
        marginTop: '1rem',
        padding: '1rem',
        backgroundColor: '#f0fdf4',
        borderRadius: '0.375rem',
        fontSize: '0.875rem'
      }}>
        <h4 style={{ fontWeight: '600', marginBottom: '0.5rem', color: '#16a34a' }}>
          <Target size={16} style={{ display: 'inline', marginRight: '0.25rem' }} />
          Efficient Frontier Analysis
        </h4>
        <p style={{ color: '#047857', marginBottom: '0.5rem' }}>
          {efficientFrontier.length} funds lie on the efficient frontier, offering the best return for their level of risk.
        </p>
        {efficientFrontier.length > 0 && (
          <div style={{ fontSize: '0.75rem' }}>
            <strong>Frontier Funds:</strong>{' '}
            {efficientFrontier.slice(0, 5).map(f => f.Symbol).join(', ')}
            {efficientFrontier.length > 5 && ` and ${efficientFrontier.length - 5} more`}
          </div>
        )}
      </div>
    </div>
  );
};

export default RiskReturnScatter;