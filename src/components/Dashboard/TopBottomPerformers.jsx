// src/components/Dashboard/TopBottomPerformers.jsx
import React, { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { getScoreColor, getScoreLabel } from '../../services/scoring';

/**
 * Top and Bottom Performers Component
 * Shows the best and worst performing funds across various metrics
 */
const TopBottomPerformers = ({ funds }) => {
  const [selectedMetric, setSelectedMetric] = useState('score');
  const [filterAssetClass, setFilterAssetClass] = useState('all');
  const [showCount, setShowCount] = useState(5);

  // Get unique asset classes
  const assetClasses = useMemo(() => {
    if (!funds || !Array.isArray(funds)) {
      return ['all'];
    }
    const classes = new Set(funds.map(f => f['Asset Class'] || f.asset_class || 'Unknown'));
    return ['all', ...Array.from(classes).sort()];
  }, [funds]);

  // Filter and sort funds based on selected metric
  const { topFunds, bottomFunds } = useMemo(() => {
    // Defensive check for funds
    if (!funds || !Array.isArray(funds)) {
      return { topFunds: [], bottomFunds: [] };
    }
    
    // Filter by asset class if needed
    let filteredFunds = filterAssetClass === 'all' 
      ? funds 
      : funds.filter(f => (f['Asset Class'] || f.asset_class) === filterAssetClass);

    // Remove funds without the selected metric
    const fundsWithMetric = filteredFunds.filter(fund => {
      switch (selectedMetric) {
        case 'score':
          return fund.scores?.final != null;
        case '1year':
          return fund['1 Year'] != null;
        case '3year':
          return fund['3 Year'] != null;
        case '5year':
          return fund['5 Year'] != null;
        case 'sharpe':
          return fund['Sharpe Ratio'] != null;
        case 'expense':
          return fund['Net Expense Ratio'] != null;
        default:
          return false;
      }
    });

    // Sort based on metric
    const sorted = [...fundsWithMetric].sort((a, b) => {
      let aValue, bValue;
      
      switch (selectedMetric) {
        case 'score':
          aValue = a.scores?.final || 0;
          bValue = b.scores?.final || 0;
          break;
        case '1year':
          aValue = a['1 Year'] || 0;
          bValue = b['1 Year'] || 0;
          break;
        case '3year':
          aValue = a['3 Year'] || 0;
          bValue = b['3 Year'] || 0;
          break;
        case '5year':
          aValue = a['5 Year'] || 0;
          bValue = b['5 Year'] || 0;
          break;
        case 'sharpe':
          aValue = a['Sharpe Ratio'] || 0;
          bValue = b['Sharpe Ratio'] || 0;
          break;
        case 'expense':
          // For expenses, lower is better, so reverse the sort
          aValue = b['Net Expense Ratio'] || 999;
          bValue = a['Net Expense Ratio'] || 999;
          break;
        default:
          aValue = 0;
          bValue = 0;
      }
      
      return bValue - aValue;
    });

    return {
      topFunds: sorted.slice(0, showCount),
      bottomFunds: selectedMetric === 'expense' 
        ? sorted.slice(-showCount).reverse() // For expenses, bottom means highest
        : sorted.slice(-showCount).reverse()
    };
  }, [funds, selectedMetric, filterAssetClass, showCount]);

  // Format metric value for display
  const formatMetricValue = (fund, metric) => {
    switch (metric) {
      case 'score':
        return fund.scores?.final || 0;
      case '1year':
      case '3year':
      case '5year':
        const returnMetric = metric === '1year' ? '1 Year' : 
                           metric === '3year' ? '3 Year' : '5 Year';
        return fund[returnMetric] != null ? `${fund[returnMetric].toFixed(2)}%` : '-';
      case 'sharpe':
        return fund['Sharpe Ratio'] != null ? fund['Sharpe Ratio'].toFixed(2) : '-';
      case 'expense':
        return fund['Net Expense Ratio'] != null ? `${fund['Net Expense Ratio'].toFixed(2)}%` : '-';
      default:
        return '-';
    }
  };

  // Get metric label
  const getMetricLabel = (metric) => {
    const labels = {
      score: 'Overall Score',
      '1year': '1-Year Return',
      '3year': '3-Year Return',
      '5year': '5-Year Return',
      sharpe: 'Sharpe Ratio',
      expense: 'Expense Ratio'
    };
    return labels[metric] || metric;
  };

  // Fund row component
  const FundRow = ({ fund, rank, isTop }) => {
    const metricValue = formatMetricValue(fund, selectedMetric);
    const scoreColor = selectedMetric === 'score' ? getScoreColor(fund.scores?.final || 0) : null;
    
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '0.75rem',
        backgroundColor: 'white',
        borderRadius: '0.375rem',
        border: '1px solid #e5e7eb',
        marginBottom: '0.5rem',
        transition: 'transform 0.1s',
        cursor: 'pointer'
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateX(4px)'; try { window.dispatchEvent(new CustomEvent('HIGHLIGHT_FUND', { detail: { symbol: (fund.Symbol || fund.ticker) } })); } catch {} }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateX(0)'; }}
      >
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          backgroundColor: isTop ? '#f0fdf4' : '#fef2f2',
          color: isTop ? '#16a34a' : '#dc2626',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 'bold',
          fontSize: '0.875rem',
          marginRight: '0.75rem'
        }}>
          {rank}
        </div>
        
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: '600', fontSize: '0.875rem' }}>
            {fund.Symbol}
            {fund.isRecommended && (
              <span style={{
                marginLeft: '0.5rem',
                padding: '0.125rem 0.375rem',
                backgroundColor: '#dbeafe',
                color: '#1e40af',
                borderRadius: '0.25rem',
                fontSize: '0.6875rem',
                fontWeight: 'normal'
              }}>
                REC
              </span>
            )}
            {fund.isBenchmark && (
              <span style={{
                marginLeft: '0.5rem',
                padding: '0.125rem 0.375rem',
                backgroundColor: '#fef3c7',
                color: '#78350f',
                borderRadius: '0.25rem',
                fontSize: '0.6875rem',
                fontWeight: 'normal'
              }}>
                BM
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.125rem' }}>
            {fund.displayName}
          </div>
          <div style={{ fontSize: '0.6875rem', color: '#9ca3af', marginTop: '0.125rem' }}>
            {fund['Asset Class'] || fund.asset_class}
          </div>
        </div>
        
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontSize: '1.125rem',
            fontWeight: 'bold',
            color: selectedMetric === 'score' ? scoreColor : (isTop ? '#16a34a' : '#dc2626')
          }}>
            {metricValue}
          </div>
          {selectedMetric === 'score' && (
            <div style={{ fontSize: '0.6875rem', color: '#6b7280' }}>
              {getScoreLabel(fund.scores?.final || 0)}
            </div>
          )}
        </div>
      </div>
    );
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
          Top & Bottom Performers
        </h3>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <select
            value={filterAssetClass}
            onChange={(e) => setFilterAssetClass(e.target.value)}
            style={{
              padding: '0.375rem 0.5rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.375rem',
              fontSize: '0.875rem'
            }}
          >
            {assetClasses.map(ac => (
              <option key={ac} value={ac}>
                {ac === 'all' ? 'All Classes' : ac}
              </option>
            ))}
          </select>
          
          <select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value)}
            style={{
              padding: '0.375rem 0.5rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.375rem',
              fontSize: '0.875rem'
            }}
          >
            <option value="score">Overall Score</option>
            <option value="1year">1-Year Return</option>
            <option value="3year">3-Year Return</option>
            <option value="5year">5-Year Return</option>
            <option value="sharpe">Sharpe Ratio</option>
            <option value="expense">Expense Ratio</option>
          </select>
          
          <select
            value={showCount}
            onChange={(e) => setShowCount(Number(e.target.value))}
            style={{
              padding: '0.375rem 0.5rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.375rem',
              fontSize: '0.875rem'
            }}
          >
            <option value={3}>Top 3</option>
            <option value={5}>Top 5</option>
            <option value={10}>Top 10</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Top Performers */}
        <div>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center',
            marginBottom: '0.75rem',
            color: '#16a34a'
          }}>
            <TrendingUp size={20} style={{ marginRight: '0.5rem' }} />
            <h4 style={{ fontWeight: '600' }}>
              Top Performers - {getMetricLabel(selectedMetric)}
            </h4>
          </div>
          
          <div>
            {topFunds.map((fund, index) => (
              <FundRow 
                key={fund.Symbol} 
                fund={fund} 
                rank={index + 1} 
                isTop={true} 
              />
            ))}
            
            {topFunds.length === 0 && (
              <div style={{
                padding: '2rem',
                textAlign: 'center',
                color: '#6b7280',
                backgroundColor: '#f9fafb',
                borderRadius: '0.375rem',
                fontSize: '0.875rem'
              }}>
                No funds with {getMetricLabel(selectedMetric)} data
              </div>
            )}
          </div>
        </div>

        {/* Bottom Performers */}
        <div>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center',
            marginBottom: '0.75rem',
            color: '#dc2626'
          }}>
            <TrendingDown size={20} style={{ marginRight: '0.5rem' }} />
            <h4 style={{ fontWeight: '600' }}>
              {selectedMetric === 'expense' ? 'Highest' : 'Bottom'} Performers - {getMetricLabel(selectedMetric)}
            </h4>
          </div>
          
          <div>
            {bottomFunds.map((fund, index) => (
              <FundRow 
                key={fund.Symbol} 
                fund={fund} 
                rank={bottomFunds.length - index} 
                isTop={false} 
              />
            ))}
            
            {bottomFunds.length === 0 && (
              <div style={{
                padding: '2rem',
                textAlign: 'center',
                color: '#6b7280',
                backgroundColor: '#f9fafb',
                borderRadius: '0.375rem',
                fontSize: '0.875rem'
              }}>
                No funds with {getMetricLabel(selectedMetric)} data
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div style={{
        marginTop: '1.5rem',
        padding: '1rem',
        backgroundColor: '#f9fafb',
        borderRadius: '0.375rem',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '1rem',
        fontSize: '0.875rem'
      }}>
        <div>
          <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>Average {getMetricLabel(selectedMetric)}</div>
                     <div style={{ fontWeight: '600', fontSize: '1rem' }}>
             {(() => {
               if (!funds || !Array.isArray(funds)) return '-';
               
               const validFunds = funds.filter(f => {
                 switch (selectedMetric) {
                   case 'score': return f.scores?.final != null;
                   case '1year': return f['1 Year'] != null;
                   case '3year': return f['3 Year'] != null;
                   case '5year': return f['5 Year'] != null;
                   case 'sharpe': return f['Sharpe Ratio'] != null;
                   case 'expense': return f['Net Expense Ratio'] != null;
                   default: return false;
                 }
               });
               
               if (validFunds.length === 0) return '-';
               
               const sum = validFunds.reduce((acc, f) => {
                 let value = 0;
                 switch (selectedMetric) {
                   case 'score': value = f.scores?.final || 0; break;
                   case '1year': value = f['1 Year'] || 0; break;
                   case '3year': value = f['3 Year'] || 0; break;
                   case '5year': value = f['5 Year'] || 0; break;
                   case 'sharpe': value = f['Sharpe Ratio'] || 0; break;
                   case 'expense': value = f['Net Expense Ratio'] || 0; break;
                   default: value = 0; break;
                 }
                 return acc + value;
               }, 0);
               
               const avg = sum / validFunds.length;
               return selectedMetric === 'sharpe' ? avg.toFixed(2) : `${avg.toFixed(2)}${selectedMetric !== 'score' ? '%' : ''}`;
             })()}
           </div>
        </div>
        
                 <div>
           <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>Funds Analyzed</div>
           <div style={{ fontWeight: '600', fontSize: '1rem' }}>
             {(() => {
               if (!funds || !Array.isArray(funds)) return '0 / 0';
               
               const validCount = funds.filter(f => {
                 switch (selectedMetric) {
                   case 'score': return f.scores?.final != null;
                   case '1year': return f['1 Year'] != null;
                   case '3year': return f['3 Year'] != null;
                   case '5year': return f['5 Year'] != null;
                   case 'sharpe': return f['Sharpe Ratio'] != null;
                   case 'expense': return f['Net Expense Ratio'] != null;
                   default: return false;
                 }
               }).length;
               
               return `${validCount} / ${funds.length}`;
             })()}
           </div>
         </div>
        
        <div>
          <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>Spread (Max - Min)</div>
          <div style={{ fontWeight: '600', fontSize: '1rem' }}>
            {(() => {
              if (topFunds.length === 0 || bottomFunds.length === 0) return '-';
              
              const topValue = (() => {
                const fund = topFunds[0];
                switch (selectedMetric) {
                  case 'score': return fund.scores?.final || 0;
                  case '1year': return fund['1 Year'] || 0;
                  case '3year': return fund['3 Year'] || 0;
                  case '5year': return fund['5 Year'] || 0;
                  case 'sharpe': return fund['Sharpe Ratio'] || 0;
                  case 'expense': return fund['Net Expense Ratio'] || 0;
                  default: return 0;
                }
              })();
              
              const bottomValue = (() => {
                const fund = bottomFunds[bottomFunds.length - 1];
                switch (selectedMetric) {
                  case 'score': return fund.scores?.final || 0;
                  case '1year': return fund['1 Year'] || 0;
                  case '3year': return fund['3 Year'] || 0;
                  case '5year': return fund['5 Year'] || 0;
                  case 'sharpe': return fund['Sharpe Ratio'] || 0;
                  case 'expense': return fund['Net Expense Ratio'] || 0;
                  default: return 0;
                }
              })();
              
              const spread = Math.abs(topValue - bottomValue);
              return selectedMetric === 'sharpe' ? spread.toFixed(2) : `${spread.toFixed(2)}${selectedMetric !== 'score' ? '%' : ''}`;
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TopBottomPerformers;