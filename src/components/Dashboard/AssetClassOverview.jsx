// src/components/Dashboard/AssetClassOverview.jsx
import React, { useState, useMemo } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Activity, DollarSign } from 'lucide-react';
import { getScoreColor } from '../../services/scoring';

/**
 * Asset Class Overview Component
 * Provides a comprehensive view of performance across all asset classes
 */
const AssetClassOverview = ({ funds, classSummaries, benchmarkData }) => {
  const [sortBy, setSortBy] = useState('avgScore');
  const [expandedClass, setExpandedClass] = useState(null);

  // Calculate enhanced statistics for each asset class
  const classStats = useMemo(() => {
    const stats = {};
    
    // Group funds by asset class
    const fundsByClass = {};
    funds.forEach(fund => {
      const assetClass = fund['Asset Class'] || 'Unknown';
      if (!fundsByClass[assetClass]) {
        fundsByClass[assetClass] = [];
      }
      fundsByClass[assetClass].push(fund);
    });

    // Calculate stats for each class
    Object.entries(fundsByClass).forEach(([assetClass, classFunds]) => {
      const benchmark = benchmarkData[assetClass];
      const recommendedFunds = classFunds.filter(f => f.isRecommended && !f.isBenchmark);
      const nonRecommendedFunds = classFunds.filter(f => !f.isRecommended && !f.isBenchmark);
      
      // Calculate various averages
      const scores = classFunds.map(f => f.scores?.final || 0).filter(s => s > 0);
      const returns1Y = classFunds.map(f => f['1 Year']).filter(r => r != null);
      const returns3Y = classFunds.map(f => f['3 Year']).filter(r => r != null);
      const sharpeRatios = classFunds.map(f => f['Sharpe Ratio']).filter(r => r != null);
      const expenses = classFunds.map(f => f['Net Expense Ratio']).filter(r => r != null);
      
      // Recommended funds performance
      const recScores = recommendedFunds.map(f => f.scores?.final || 0).filter(s => s > 0);
      const recAvgScore = recScores.length > 0 
        ? recScores.reduce((a, b) => a + b, 0) / recScores.length 
        : null;
      
      stats[assetClass] = {
        totalFunds: classFunds.length,
        recommendedCount: recommendedFunds.length,
        avgScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
        avgReturn1Y: returns1Y.length > 0 ? returns1Y.reduce((a, b) => a + b, 0) / returns1Y.length : null,
        avgReturn3Y: returns3Y.length > 0 ? returns3Y.reduce((a, b) => a + b, 0) / returns3Y.length : null,
        avgSharpe: sharpeRatios.length > 0 ? sharpeRatios.reduce((a, b) => a + b, 0) / sharpeRatios.length : null,
        avgExpense: expenses.length > 0 ? expenses.reduce((a, b) => a + b, 0) / expenses.length : null,
        benchmarkScore: benchmark?.scores?.final,
        benchmarkReturn1Y: benchmark?.['1 Year'],
        benchmarkSharpe: benchmark?.['Sharpe Ratio'],
        recommendedAvgScore: recAvgScore,
        topFund: classFunds.reduce((best, fund) => 
          (fund.scores?.final || 0) > (best.scores?.final || 0) ? fund : best, 
          classFunds[0]
        ),
        bottomFund: classFunds.reduce((worst, fund) => 
          (fund.scores?.final || 0) < (worst.scores?.final || 0) ? fund : worst, 
          classFunds[0]
        ),
        distribution: classSummaries[assetClass]?.distribution || { excellent: 0, good: 0, poor: 0 }
      };
    });

    return stats;
  }, [funds, classSummaries, benchmarkData]);

  // Sort asset classes based on selected criteria
  const sortedClasses = useMemo(() => {
    const classes = Object.entries(classStats);
    
    classes.sort((a, b) => {
      const [classA, statsA] = a;
      const [classB, statsB] = b;
      
      switch (sortBy) {
        case 'avgScore':
          return (statsB.avgScore || 0) - (statsA.avgScore || 0);
        case 'fundCount':
          return statsB.totalFunds - statsA.totalFunds;
        case 'return1Y':
          return (statsB.avgReturn1Y || -999) - (statsA.avgReturn1Y || -999);
        case 'sharpe':
          return (statsB.avgSharpe || -999) - (statsA.avgSharpe || -999);
        case 'alpha':
          // Compare average score vs benchmark
          const alphaA = (statsA.avgScore || 0) - (statsA.benchmarkScore || 50);
          const alphaB = (statsB.avgScore || 0) - (statsB.benchmarkScore || 50);
          return alphaB - alphaA;
        default:
          return 0;
      }
    });
    
    return classes;
  }, [classStats, sortBy]);

  // Calculate portfolio-wide statistics
  const portfolioStats = useMemo(() => {
    const allScores = funds.map(f => f.scores?.final || 0).filter(s => s > 0);
    const allReturns1Y = funds.map(f => f['1 Year']).filter(r => r != null);
    const allExpenses = funds.map(f => f['Net Expense Ratio']).filter(r => r != null);
    const recommendedFunds = funds.filter(f => f.isRecommended && !f.isBenchmark);
    
    return {
      totalFunds: funds.length,
      totalRecommended: recommendedFunds.length,
      avgScore: allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0,
      avgReturn1Y: allReturns1Y.length > 0 ? allReturns1Y.reduce((a, b) => a + b, 0) / allReturns1Y.length : 0,
      avgExpense: allExpenses.length > 0 ? allExpenses.reduce((a, b) => a + b, 0) / allExpenses.length : 0,
      totalAssetClasses: Object.keys(classStats).length
    };
  }, [funds, classStats]);

  // Determine best and worst performing asset classes by average score
  const bestWorstClasses = useMemo(() => {
    const entries = Object.entries(classStats);
    if (entries.length === 0) return { best: null, worst: null };
    const sorted = [...entries].sort((a, b) => (b[1].avgScore || 0) - (a[1].avgScore || 0));
    return {
      best: sorted[0],
      worst: sorted[sorted.length - 1]
    };
  }, [classStats]);

  return (
    <div style={{ marginBottom: '2rem' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '1rem' 
      }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
          Asset Class Overview
        </h3>
        
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          style={{
            padding: '0.375rem 0.5rem',
            border: '1px solid #d1d5db',
            borderRadius: '0.375rem',
            fontSize: '0.875rem'
          }}
        >
          <option value="avgScore">Average Score</option>
          <option value="fundCount">Fund Count</option>
          <option value="return1Y">1-Year Return</option>
          <option value="sharpe">Sharpe Ratio</option>
          <option value="alpha">Score vs Benchmark</option>
        </select>
      </div>

      {/* Portfolio Summary Card */}
      <div style={{
        padding: '1rem',
        backgroundColor: '#f0f9ff',
        border: '1px solid #bfdbfe',
        borderRadius: '0.5rem',
        marginBottom: '1rem'
      }}>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '1rem',
          textAlign: 'center'
        }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#1e40af', marginBottom: '0.25rem' }}>
              Total Funds
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1e3a8a' }}>
              {portfolioStats.totalFunds}
            </div>
            <div style={{ fontSize: '0.6875rem', color: '#3730a3' }}>
              {portfolioStats.totalRecommended} recommended
            </div>
          </div>
          
          <div>
            <div style={{ fontSize: '0.75rem', color: '#1e40af', marginBottom: '0.25rem' }}>
              Avg Score
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: getScoreColor(portfolioStats.avgScore) }}>
              {portfolioStats.avgScore.toFixed(0)}
            </div>
            <div style={{ fontSize: '0.6875rem', color: '#3730a3' }}>
              Across all funds
            </div>
          </div>
          
          <div>
            <div style={{ fontSize: '0.75rem', color: '#1e40af', marginBottom: '0.25rem' }}>
              Avg 1Y Return
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: portfolioStats.avgReturn1Y >= 0 ? '#16a34a' : '#dc2626' }}>
              {portfolioStats.avgReturn1Y.toFixed(1)}%
            </div>
            <div style={{ fontSize: '0.6875rem', color: '#3730a3' }}>
              Portfolio average
            </div>
          </div>
          
          <div>
            <div style={{ fontSize: '0.75rem', color: '#1e40af', marginBottom: '0.25rem' }}>
              Asset Classes
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1e3a8a' }}>
              {portfolioStats.totalAssetClasses}
            </div>
            <div style={{ fontSize: '0.6875rem', color: '#3730a3' }}>
              Diversified
            </div>
          </div>
        </div>
      </div>

      {/* Best and Worst Asset Classes */}
      {bestWorstClasses.best && bestWorstClasses.worst && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '1rem'
        }}>
          <div style={{
            padding: '0.75rem',
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '0.5rem',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '0.75rem', color: '#16a34a', marginBottom: '0.25rem' }}>
              Best Performing Class
            </div>
            <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
              {bestWorstClasses.best[0]}
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: getScoreColor(bestWorstClasses.best[1].avgScore) }}>
              {bestWorstClasses.best[1].avgScore.toFixed(0)}
            </div>
          </div>

          <div style={{
            padding: '0.75rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '0.5rem',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '0.75rem', color: '#dc2626', marginBottom: '0.25rem' }}>
              Worst Performing Class
            </div>
            <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
              {bestWorstClasses.worst[0]}
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: getScoreColor(bestWorstClasses.worst[1].avgScore) }}>
              {bestWorstClasses.worst[1].avgScore.toFixed(0)}
            </div>
          </div>
        </div>
      )}

      {/* Asset Class Cards */}
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        {sortedClasses.map(([assetClass, stats]) => {
          const isExpanded = expandedClass === assetClass;
          const hasRecommended = stats.recommendedCount > 0;
          const benchmarkDiff = stats.benchmarkScore ? stats.avgScore - stats.benchmarkScore : null;
          
          return (
            <div
              key={assetClass}
              style={{
                padding: '1rem',
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onClick={() => setExpandedClass(isExpanded ? null : assetClass)}
            >
              {/* Header Row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ flex: 1 }}>
                  <h4 style={{ 
                    fontWeight: '600', 
                    fontSize: '1rem',
                    marginBottom: '0.25rem'
                  }}>
                    {assetClass}
                  </h4>
                  <div style={{ 
                    display: 'flex', 
                    gap: '1rem', 
                    fontSize: '0.75rem',
                    color: '#6b7280'
                  }}>
                    <span>{stats.totalFunds} funds</span>
                    {hasRecommended && (
                      <span style={{ color: '#3b82f6' }}>
                        {stats.recommendedCount} recommended
                      </span>
                    )}
                  </div>
                </div>

                {/* Key Metrics */}
                <div style={{ 
                  display: 'flex', 
                  gap: '1.5rem',
                  alignItems: 'center'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.6875rem', color: '#6b7280' }}>Avg Score</div>
                    <div style={{ 
                      fontSize: '1.25rem', 
                      fontWeight: 'bold',
                      color: getScoreColor(stats.avgScore)
                    }}>
                      {stats.avgScore.toFixed(0)}
                    </div>
                  </div>
                  
                  {stats.avgReturn1Y != null && (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.6875rem', color: '#6b7280' }}>1Y Return</div>
                      <div style={{ 
                        fontSize: '1.25rem', 
                        fontWeight: 'bold',
                        color: stats.avgReturn1Y >= 0 ? '#16a34a' : '#dc2626'
                      }}>
                        {stats.avgReturn1Y.toFixed(1)}%
                      </div>
                    </div>
                  )}
                  
                  {benchmarkDiff != null && (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.6875rem', color: '#6b7280' }}>vs Benchmark</div>
                      <div style={{ 
                        fontSize: '1.25rem', 
                        fontWeight: 'bold',
                        color: benchmarkDiff >= 0 ? '#16a34a' : '#dc2626',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}>
                        {benchmarkDiff >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                        {Math.abs(benchmarkDiff).toFixed(0)}
                      </div>
                    </div>
                  )}

                  {/* Distribution Bar */}
                  <div style={{ width: '120px' }}>
                    <div style={{ fontSize: '0.6875rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                      Distribution
                    </div>
                    <div style={{ 
                      display: 'flex', 
                      height: '20px',
                      borderRadius: '0.25rem',
                      overflow: 'hidden',
                      border: '1px solid #e5e7eb'
                    }}>
                      {stats.distribution.excellent > 0 && (
                        <div style={{
                          width: `${(stats.distribution.excellent / stats.totalFunds) * 100}%`,
                          backgroundColor: '#16a34a',
                          minWidth: stats.distribution.excellent > 0 ? '4px' : '0'
                        }} />
                      )}
                      {stats.distribution.good > 0 && (
                        <div style={{
                          width: `${(stats.distribution.good / stats.totalFunds) * 100}%`,
                          backgroundColor: '#eab308',
                          minWidth: stats.distribution.good > 0 ? '4px' : '0'
                        }} />
                      )}
                      {stats.distribution.poor > 0 && (
                        <div style={{
                          width: `${(stats.distribution.poor / stats.totalFunds) * 100}%`,
                          backgroundColor: '#dc2626',
                          minWidth: stats.distribution.poor > 0 ? '4px' : '0'
                        }} />
                      )}
                    </div>
                  </div>
                  
                  <div style={{
                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s'
                  }}>
                    ▼
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div style={{ 
                  marginTop: '1rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid #e5e7eb'
                }}>
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '1rem',
                    marginBottom: '1rem'
                  }}>
                    {/* Additional Metrics */}
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Average Sharpe Ratio</div>
                      <div style={{ fontWeight: '600' }}>
                        {stats.avgSharpe != null ? stats.avgSharpe.toFixed(2) : '-'}
                      </div>
                    </div>
                    
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Average Expense Ratio</div>
                      <div style={{ fontWeight: '600' }}>
                        {stats.avgExpense != null ? `${stats.avgExpense.toFixed(2)}%` : '-'}
                      </div>
                    </div>
                    
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>3-Year Return</div>
                      <div style={{ fontWeight: '600' }}>
                        {stats.avgReturn3Y != null ? `${stats.avgReturn3Y.toFixed(1)}%` : '-'}
                      </div>
                    </div>
                    
                    {stats.recommendedAvgScore != null && (
                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Recommended Avg Score</div>
                        <div style={{ fontWeight: '600', color: getScoreColor(stats.recommendedAvgScore) }}>
                          {stats.recommendedAvgScore.toFixed(0)}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Top and Bottom Funds */}
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 1fr',
                    gap: '1rem',
                    fontSize: '0.875rem'
                  }}>
                    <div style={{ 
                      padding: '0.75rem',
                      backgroundColor: '#f0fdf4',
                      borderRadius: '0.375rem'
                    }}>
                      <div style={{ fontWeight: '600', color: '#16a34a', marginBottom: '0.25rem' }}>
                        Top Performer
                      </div>
                      <div>{stats.topFund?.Symbol} - {stats.topFund?.['Fund Name']}</div>
                      <div style={{ color: '#059669', fontWeight: '600' }}>
                        Score: {stats.topFund?.scores?.final || '-'}
                      </div>
                    </div>
                    
                    <div style={{ 
                      padding: '0.75rem',
                      backgroundColor: '#fef2f2',
                      borderRadius: '0.375rem'
                    }}>
                      <div style={{ fontWeight: '600', color: '#dc2626', marginBottom: '0.25rem' }}>
                        Bottom Performer
                      </div>
                      <div>{stats.bottomFund?.Symbol} - {stats.bottomFund?.['Fund Name']}</div>
                      <div style={{ color: '#dc2626', fontWeight: '600' }}>
                        Score: {stats.bottomFund?.scores?.final || '-'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AssetClassOverview;