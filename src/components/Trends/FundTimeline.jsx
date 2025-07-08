// src/components/Trends/FundTimeline.jsx
import React, { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Calendar, Info, LineChart } from 'lucide-react';
import { getScoreColor } from '../../services/scoring';

/**
 * Fund Timeline Component
 * Displays historical performance trends for funds over time
 */
const FundTimeline = ({ snapshots, currentFunds }) => {
  const [selectedFund, setSelectedFund] = useState('');
  const [selectedMetric, setSelectedMetric] = useState('score');
  const [timeRange, setTimeRange] = useState('all');
  const [compareMode, setCompareMode] = useState(false);
  const [compareFunds, setCompareFunds] = useState([]);

  // Get unique fund symbols across all snapshots
  const availableFunds = useMemo(() => {
    const fundSet = new Set();
    
    // Add current funds
    currentFunds.forEach(fund => {
      if (fund.Symbol) fundSet.add(fund.Symbol);
    });
    
    // Add funds from snapshots
    snapshots.forEach(snapshot => {
      snapshot.funds.forEach(fund => {
        if (fund.Symbol) fundSet.add(fund.Symbol);
      });
    });
    
    return Array.from(fundSet).sort();
  }, [snapshots, currentFunds]);

  // Filter snapshots based on time range
  const filteredSnapshots = useMemo(() => {
    if (timeRange === 'all') return snapshots;
    
    const now = new Date();
    const cutoffDate = new Date();
    
    switch (timeRange) {
      case '3m':
        cutoffDate.setMonth(now.getMonth() - 3);
        break;
      case '6m':
        cutoffDate.setMonth(now.getMonth() - 6);
        break;
      case '1y':
        cutoffDate.setFullYear(now.getFullYear() - 1);
        break;
      case '2y':
        cutoffDate.setFullYear(now.getFullYear() - 2);
        break;
    }
    
    return snapshots.filter(s => new Date(s.date) >= cutoffDate);
  }, [snapshots, timeRange]);

  // Get historical data for selected fund(s)
  const timelineData = useMemo(() => {
    const fundsToShow = compareMode && compareFunds.length > 0 
      ? compareFunds 
      : (selectedFund ? [selectedFund] : []);
    
    if (fundsToShow.length === 0) return [];
    
    const data = fundsToShow.map(fundSymbol => {
      const fundData = {
        symbol: fundSymbol,
        name: '',
        dataPoints: []
      };
      
      // Get data from each snapshot
      filteredSnapshots.forEach(snapshot => {
        const fund = snapshot.funds.find(f => f.Symbol === fundSymbol);
        if (fund) {
          fundData.name = fund.displayName || fund['Fund Name'] || fundSymbol;
          
          let value = null;
          switch (selectedMetric) {
            case 'score':
              value = fund.scores?.final;
              break;
            case '1year':
              value = fund['1 Year'];
              break;
            case '3year':
              value = fund['3 Year'];
              break;
            case 'sharpe':
              value = fund['Sharpe Ratio'];
              break;
            case 'expense':
              value = fund['Net Expense Ratio'];
              break;
            case 'percentile':
              value = fund.scores?.percentile;
              break;
          }
          
          if (value != null) {
            fundData.dataPoints.push({
              date: new Date(snapshot.date),
              value: value,
              snapshot: snapshot
            });
          }
        }
      });
      
      // Sort by date
      fundData.dataPoints.sort((a, b) => a.date - b.date);
      
      return fundData;
    });
    
    return data.filter(d => d.dataPoints.length > 0);
  }, [selectedFund, compareFunds, compareMode, filteredSnapshots, selectedMetric]);

  // Calculate statistics for the timeline
  const timelineStats = useMemo(() => {
    if (timelineData.length === 0 || timelineData[0].dataPoints.length === 0) {
      return null;
    }
    
    const mainFund = timelineData[0];
    const values = mainFund.dataPoints.map(dp => dp.value);
    const firstValue = values[0];
    const lastValue = values[values.length - 1];
    const change = lastValue - firstValue;
    const changePercent = firstValue !== 0 ? (change / firstValue) * 100 : 0;
    
    return {
      firstValue,
      lastValue,
      change,
      changePercent,
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      trend: change > 0 ? 'up' : change < 0 ? 'down' : 'flat'
    };
  }, [timelineData]);

  // Simple line chart rendering
  const renderChart = () => {
    if (timelineData.length === 0) return null;
    
    // Calculate chart dimensions
    const width = 800;
    const height = 300;
    const padding = { top: 20, right: 60, bottom: 40, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    
    // Find min/max values across all funds
    let minValue = Infinity;
    let maxValue = -Infinity;
    let minDate = null;
    let maxDate = null;
    
    timelineData.forEach(fund => {
      fund.dataPoints.forEach(dp => {
        if (dp.value < minValue) minValue = dp.value;
        if (dp.value > maxValue) maxValue = dp.value;
        if (!minDate || dp.date < minDate) minDate = dp.date;
        if (!maxDate || dp.date > maxDate) maxDate = dp.date;
      });
    });
    
    // Add padding to value range
    const valueRange = maxValue - minValue;
    minValue -= valueRange * 0.1;
    maxValue += valueRange * 0.1;
    
    // Scale functions
    const xScale = (date) => {
      const msRange = maxDate - minDate;
      const msFromStart = date - minDate;
      return padding.left + (msFromStart / msRange) * chartWidth;
    };
    
    const yScale = (value) => {
      return padding.top + chartHeight - ((value - minValue) / (maxValue - minValue)) * chartHeight;
    };
    
    // Colors for multiple lines
    const colors = ['#3b82f6', '#16a34a', '#eab308', '#dc2626', '#8b5cf6'];
    
    return (
      <svg width={width} height={height} style={{ backgroundColor: '#fafafa', borderRadius: '0.5rem' }}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(i => {
          const y = padding.top + i * chartHeight;
          const value = maxValue - i * (maxValue - minValue);
          return (
            <g key={i}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="#e5e7eb"
                strokeDasharray={i === 0 || i === 1 ? "0" : "2,2"}
              />
              <text
                x={padding.left - 10}
                y={y + 4}
                textAnchor="end"
                fontSize="12"
                fill="#6b7280"
              >
                {selectedMetric === 'score' || selectedMetric === 'percentile' 
                  ? value.toFixed(0) 
                  : value.toFixed(2)}
                {selectedMetric !== 'score' && selectedMetric !== 'percentile' && selectedMetric !== 'sharpe' ? '%' : ''}
              </text>
            </g>
          );
        })}
        
        {/* Date labels */}
        {timelineData[0].dataPoints.map((dp, i) => {
          if (i % Math.ceil(timelineData[0].dataPoints.length / 5) !== 0) return null;
          const x = xScale(dp.date);
          return (
            <text
              key={i}
              x={x}
              y={height - padding.bottom + 20}
              textAnchor="middle"
              fontSize="12"
              fill="#6b7280"
            >
              {dp.date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
            </text>
          );
        })}
        
        {/* Lines and points */}
        {timelineData.map((fund, fundIndex) => {
          const color = colors[fundIndex % colors.length];
          
          // Create path
          const pathData = fund.dataPoints
            .map((dp, i) => {
              const x = xScale(dp.date);
              const y = yScale(dp.value);
              return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
            })
            .join(' ');
          
          return (
            <g key={fund.symbol}>
              {/* Line */}
              <path
                d={pathData}
                fill="none"
                stroke={color}
                strokeWidth="2"
              />
              
              {/* Points */}
              {fund.dataPoints.map((dp, i) => (
                <circle
                  key={i}
                  cx={xScale(dp.date)}
                  cy={yScale(dp.value)}
                  r="4"
                  fill={color}
                  stroke="white"
                  strokeWidth="2"
                  style={{ cursor: 'pointer' }}
                >
                  <title>
                    {dp.date.toLocaleDateString()}: {dp.value.toFixed(2)}
                    {selectedMetric !== 'score' && selectedMetric !== 'percentile' && selectedMetric !== 'sharpe' ? '%' : ''}
                  </title>
                </circle>
              ))}
            </g>
          );
        })}
        
        {/* Legend */}
        {timelineData.length > 1 && (
          <g>
            {timelineData.map((fund, i) => (
              <g key={fund.symbol} transform={`translate(${padding.left}, ${padding.top + i * 20})`}>
                <rect
                  x="0"
                  y="0"
                  width="15"
                  height="3"
                  fill={colors[i % colors.length]}
                />
                <text
                  x="20"
                  y="3"
                  fontSize="12"
                  fill="#374151"
                >
                  {fund.symbol}
                </text>
              </g>
            ))}
          </g>
        )}
      </svg>
    );
  };

  const getMetricLabel = (metric) => {
    const labels = {
      score: 'Overall Score',
      '1year': '1-Year Return',
      '3year': '3-Year Return',
      sharpe: 'Sharpe Ratio',
      expense: 'Expense Ratio',
      percentile: 'Percentile Rank'
    };
    return labels[metric] || metric;
  };

  return (
    <div style={{ marginBottom: '2rem' }}>
      <div style={{ marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          Fund Performance Timeline
        </h3>
        <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
          Track fund metrics over time across historical snapshots
        </p>
      </div>

      {/* Controls */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.875rem', color: '#374151', marginBottom: '0.25rem' }}>
            Select Fund
          </label>
          <select
            value={selectedFund}
            onChange={(e) => setSelectedFund(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.375rem',
              fontSize: '0.875rem'
            }}
          >
            <option value="">-- Select a fund --</option>
            {availableFunds.map(symbol => (
              <option key={symbol} value={symbol}>{symbol}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label style={{ display: 'block', fontSize: '0.875rem', color: '#374151', marginBottom: '0.25rem' }}>
            Metric
          </label>
          <select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.375rem',
              fontSize: '0.875rem'
            }}
          >
            <option value="score">Overall Score</option>
            <option value="percentile">Percentile Rank</option>
            <option value="1year">1-Year Return</option>
            <option value="3year">3-Year Return</option>
            <option value="sharpe">Sharpe Ratio</option>
            <option value="expense">Expense Ratio</option>
          </select>
        </div>
        
        <div>
          <label style={{ display: 'block', fontSize: '0.875rem', color: '#374151', marginBottom: '0.25rem' }}>
            Time Range
          </label>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.375rem',
              fontSize: '0.875rem'
            }}
          >
            <option value="all">All Time</option>
            <option value="3m">Last 3 Months</option>
            <option value="6m">Last 6 Months</option>
            <option value="1y">Last Year</option>
            <option value="2y">Last 2 Years</option>
          </select>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button
            onClick={() => {
              setCompareMode(!compareMode);
              setCompareFunds([]);
            }}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: compareMode ? '#3b82f6' : '#e5e7eb',
              color: compareMode ? 'white' : '#374151',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <LineChart size={16} />
            {compareMode ? 'Exit Compare' : 'Compare Funds'}
          </button>
        </div>
      </div>

      {/* Compare mode fund selector */}
      {compareMode && (
        <div style={{
          marginBottom: '1rem',
          padding: '1rem',
          backgroundColor: '#f3f4f6',
          borderRadius: '0.5rem'
        }}>
          <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
            Select up to 5 funds to compare:
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {availableFunds.map(symbol => {
              const isSelected = compareFunds.includes(symbol);
              return (
                <button
                  key={symbol}
                  onClick={() => {
                    if (isSelected) {
                      setCompareFunds(compareFunds.filter(s => s !== symbol));
                    } else if (compareFunds.length < 5) {
                      setCompareFunds([...compareFunds, symbol]);
                    }
                  }}
                  disabled={!isSelected && compareFunds.length >= 5}
                  style={{
                    padding: '0.25rem 0.75rem',
                    backgroundColor: isSelected ? '#3b82f6' : 'white',
                    color: isSelected ? 'white' : '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    cursor: compareFunds.length >= 5 && !isSelected ? 'not-allowed' : 'pointer',
                    fontSize: '0.75rem',
                    opacity: !isSelected && compareFunds.length >= 5 ? 0.5 : 1
                  }}
                >
                  {symbol}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Chart */}
      {(selectedFund || (compareMode && compareFunds.length > 0)) && timelineData.length > 0 ? (
        <>
          <div style={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '0.5rem',
            padding: '1rem',
            overflowX: 'auto'
          }}>
            {renderChart()}
          </div>

          {/* Statistics */}
          {!compareMode && timelineStats && (
            <div style={{
              marginTop: '1rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '1rem'
            }}>
              <div style={{
                padding: '1rem',
                backgroundColor: '#f9fafb',
                borderRadius: '0.375rem',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Current Value</div>
                <div style={{ 
                  fontSize: '1.5rem', 
                  fontWeight: 'bold',
                  color: selectedMetric === 'score' ? getScoreColor(timelineStats.lastValue) : '#111827'
                }}>
                  {timelineStats.lastValue.toFixed(selectedMetric === 'score' || selectedMetric === 'percentile' ? 0 : 2)}
                  {selectedMetric !== 'score' && selectedMetric !== 'percentile' && selectedMetric !== 'sharpe' ? '%' : ''}
                </div>
              </div>
              
              <div style={{
                padding: '1rem',
                backgroundColor: '#f9fafb',
                borderRadius: '0.375rem',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Change</div>
                <div style={{ 
                  fontSize: '1.5rem', 
                  fontWeight: 'bold',
                  color: timelineStats.trend === 'up' ? '#16a34a' : timelineStats.trend === 'down' ? '#dc2626' : '#6b7280',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.25rem'
                }}>
                  {timelineStats.trend === 'up' ? <TrendingUp size={20} /> : 
                   timelineStats.trend === 'down' ? <TrendingDown size={20} /> : <span>→</span>}
                  {Math.abs(timelineStats.change).toFixed(2)}
                </div>
              </div>
              
              <div style={{
                padding: '1rem',
                backgroundColor: '#f9fafb',
                borderRadius: '0.375rem',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Average</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                  {timelineStats.avg.toFixed(selectedMetric === 'score' || selectedMetric === 'percentile' ? 0 : 2)}
                  {selectedMetric !== 'score' && selectedMetric !== 'percentile' && selectedMetric !== 'sharpe' ? '%' : ''}
                </div>
              </div>
              
              <div style={{
                padding: '1rem',
                backgroundColor: '#f9fafb',
                borderRadius: '0.375rem',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Range</div>
                <div style={{ fontSize: '0.875rem', fontWeight: '600' }}>
                  {timelineStats.min.toFixed(1)} - {timelineStats.max.toFixed(1)}
                  {selectedMetric !== 'score' && selectedMetric !== 'percentile' && selectedMetric !== 'sharpe' ? '%' : ''}
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div style={{
          padding: '3rem',
          backgroundColor: '#f9fafb',
          borderRadius: '0.5rem',
          textAlign: 'center',
          color: '#6b7280'
        }}>
          <Calendar size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
          <p>
            {snapshots.length === 0 
              ? 'No historical data available. Upload fund data to build history.'
              : compareMode 
                ? 'Select funds to compare their performance over time'
                : 'Select a fund to view its performance timeline'}
          </p>
        </div>
      )}

      {/* Info note */}
      <div style={{
        marginTop: '1rem',
        padding: '0.75rem',
        backgroundColor: '#eff6ff',
        borderRadius: '0.375rem',
        fontSize: '0.75rem',
        color: '#1e40af',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.5rem'
      }}>
        <Info size={16} style={{ flexShrink: 0, marginTop: '0.125rem' }} />
        <div>
          <strong>Note:</strong> Timeline shows data from {snapshots.length} historical snapshot{snapshots.length !== 1 ? 's' : ''}.
          Gaps in the chart indicate months where fund data was not available or not uploaded.
        </div>
      </div>
    </div>
  );
};

export default FundTimeline;