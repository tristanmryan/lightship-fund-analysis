// src/services/analytics.js

/**
 * Advanced Analytics Service
 * Provides correlation analysis, risk/return calculations, and portfolio analytics
 */

/**
 * Calculate correlation between two arrays of values
 * @param {Array<number>} x - First array
 * @param {Array<number>} y - Second array
 * @returns {number} Correlation coefficient (-1 to 1)
 */
export function calculateCorrelation(x, y) {
    if (!x || !y || x.length !== y.length || x.length < 2) {
      return null;
    }
    
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((total, xi, i) => total + xi * y[i], 0);
    const sumX2 = x.reduce((total, xi) => total + xi * xi, 0);
    const sumY2 = y.reduce((total, yi) => total + yi * yi, 0);
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
    if (denominator === 0) return 0;
    
    return numerator / denominator;
  }
  
  /**
   * Calculate correlation matrix for multiple funds
   * @param {Array<Object>} funds - Fund data with return history
   * @param {string} metric - Metric to correlate (e.g., '1 Year', '3 Year')
   * @returns {Object} Correlation matrix
   */
  export function calculateCorrelationMatrix(funds, metric = '1 Year') {
    const matrix = {};
    const validFunds = funds.filter(f => f[metric] != null);
    
    validFunds.forEach((fund1, i) => {
      matrix[fund1.Symbol] = {};
      
      validFunds.forEach((fund2, j) => {
        if (i === j) {
          matrix[fund1.Symbol][fund2.Symbol] = 1; // Self-correlation is always 1
        } else if (i < j) {
          // For now, we'll use a simplified correlation based on similarity of metrics
          // In a real implementation, you'd use historical price data
          const correlation = calculateMetricSimilarity(fund1, fund2);
          matrix[fund1.Symbol][fund2.Symbol] = correlation;
          
          // Correlation is symmetric
          if (!matrix[fund2.Symbol]) matrix[fund2.Symbol] = {};
          matrix[fund2.Symbol][fund1.Symbol] = correlation;
        }
      });
    });
    
    return matrix;
  }
  
  /**
   * Calculate similarity between funds based on multiple metrics
   * @param {Object} fund1 - First fund
   * @param {Object} fund2 - Second fund
   * @returns {number} Similarity score (0 to 1)
   */
  function calculateMetricSimilarity(fund1, fund2) {
    const metrics = ['1 Year', '3 Year', '5 Year', 'Sharpe Ratio', 'StdDev3Y'];
    let validMetrics = 0;
    let totalDifference = 0;
    
    metrics.forEach(metric => {
      if (fund1[metric] != null && fund2[metric] != null) {
        validMetrics++;
        const diff = Math.abs(fund1[metric] - fund2[metric]);
        const avg = (Math.abs(fund1[metric]) + Math.abs(fund2[metric])) / 2;
        const normalizedDiff = avg > 0 ? diff / avg : 0;
        totalDifference += Math.min(normalizedDiff, 1);
      }
    });
    
    if (validMetrics === 0) return 0;
    
    const avgDifference = totalDifference / validMetrics;
    return Math.max(0, 1 - avgDifference);
  }
  
  /**
   * Calculate risk-return metrics for funds
   * @param {Array<Object>} funds - Fund data
   * @returns {Array<Object>} Funds with risk-return metrics
   */
  export function calculateRiskReturnMetrics(funds) {
    return funds.map(fund => {
      // Use 3-year return as primary return metric
      const returnMetric = fund['3 Year'] || fund['1 Year'] || 0;
      
      // Use standard deviation as risk metric
      const riskMetric = (fund['StdDev3Y'] ?? fund['Standard Deviation']) || 0;
      
      // Calculate risk-adjusted return (similar to Sharpe but simplified)
      const riskAdjustedReturn = riskMetric > 0 ? returnMetric / riskMetric : 0;
      
      // Calculate efficiency score (return per unit of risk)
      const efficiencyScore = riskMetric > 0 ? (returnMetric / riskMetric) * 100 : 0;
      
      return {
        ...fund,
        riskReturnMetrics: {
          return: returnMetric,
          risk: riskMetric,
          riskAdjustedReturn,
          efficiencyScore,
          sharpeRatio: fund['Sharpe Ratio'] || 0
        }
      };
    });
  }
  
  /**
   * Identify efficient frontier funds
   * @param {Array<Object>} funds - Funds with risk-return metrics
   * @returns {Array<Object>} Funds on the efficient frontier
   */
  export function findEfficientFrontier(funds) {
    const fundsWithMetrics = funds.filter(f => 
      f.riskReturnMetrics && 
      f.riskReturnMetrics.return != null && 
      f.riskReturnMetrics.risk != null
    );
    
    // Sort by risk (ascending)
    const sortedByRisk = [...fundsWithMetrics].sort((a, b) => 
      a.riskReturnMetrics.risk - b.riskReturnMetrics.risk
    );
    
    const efficientFrontier = [];
    let maxReturnSoFar = -Infinity;
    
    // A fund is on the efficient frontier if it has the highest return for its risk level
    sortedByRisk.forEach(fund => {
      if (fund.riskReturnMetrics.return > maxReturnSoFar) {
        efficientFrontier.push(fund);
        maxReturnSoFar = fund.riskReturnMetrics.return;
      }
    });
    
    return efficientFrontier;
  }
  
  /**
   * Calculate portfolio statistics
   * @param {Array<Object>} funds - Portfolio funds
   * @param {Object} weights - Fund weights (optional)
   * @returns {Object} Portfolio statistics
   */
  export function calculatePortfolioStatistics(funds, weights = {}) {
    // If no weights provided, assume equal weighting
    const defaultWeight = 1 / funds.length;
    
    let portfolioReturn = 0;
    let portfolioRisk = 0;
    let totalWeight = 0;
    
    // Calculate weighted returns
    funds.forEach(fund => {
      const weight = weights[fund.Symbol] || defaultWeight;
      const fundReturn = fund['3 Year'] || fund['1 Year'] || 0;
      const fundRisk = (fund['StdDev3Y'] ?? fund['Standard Deviation']) || 0;
      
      portfolioReturn += fundReturn * weight;
      portfolioRisk += fundRisk * weight; // Simplified - doesn't account for correlation
      totalWeight += weight;
    });
    
    // Normalize if weights don't sum to 1
    if (totalWeight > 0 && totalWeight !== 1) {
      portfolioReturn /= totalWeight;
      portfolioRisk /= totalWeight;
    }
    
    // Calculate other portfolio metrics
    const avgExpenseRatio = funds.reduce((sum, fund) => {
      const weight = weights[fund.Symbol] || defaultWeight;
      return sum + (fund['Net Expense Ratio'] || 0) * weight;
    }, 0) / (totalWeight || 1);
    
    const avgScore = funds.reduce((sum, fund) => {
      const weight = weights[fund.Symbol] || defaultWeight;
      return sum + (fund.scores?.final || 0) * weight;
    }, 0) / (totalWeight || 1);
    
    return {
      expectedReturn: portfolioReturn,
      risk: portfolioRisk,
      sharpeRatio: portfolioRisk > 0 ? portfolioReturn / portfolioRisk : 0,
      avgExpenseRatio,
      avgScore,
      fundCount: funds.length,
  assetClasses: [...new Set(funds.map(f => f.asset_class_name || f.asset_class || f['Asset Class']))].length
    };
  }
  
  /**
   * Perform attribution analysis
   * @param {Array<Object>} funds - Fund data
   * @param {string} groupBy - Attribute to group by (e.g., 'Asset Class')
   * @returns {Object} Attribution analysis results
   */
  export function performAttribution(funds, groupBy = 'Asset Class') {
    const groups = {};
    
    // Group funds
    funds.forEach(fund => {
      const group = fund[groupBy] || 'Unknown';
      if (!groups[group]) {
        groups[group] = {
          funds: [],
          totalReturn: 0,
          totalWeight: 0,
          avgScore: 0,
          count: 0
        };
      }
      
      groups[group].funds.push(fund);
      groups[group].count++;
      
      const fundReturn = fund['1 Year'] || 0;
      groups[group].totalReturn += fundReturn;
      groups[group].avgScore += fund.scores?.final || 0;
    });
    
    // Calculate group statistics
    const attribution = {};
    let portfolioReturn = 0;
    let totalFunds = 0;
    
    Object.entries(groups).forEach(([groupName, groupData]) => {
      const avgReturn = groupData.totalReturn / groupData.count;
      const avgScore = groupData.avgScore / groupData.count;
      const weight = groupData.count / funds.length;
      
      attribution[groupName] = {
        avgReturn,
        avgScore,
        weight,
        contribution: avgReturn * weight,
        fundCount: groupData.count,
        topPerformer: groupData.funds.reduce((best, fund) => 
          (fund['1 Year'] || 0) > (best['1 Year'] || 0) ? fund : best
        ),
        bottomPerformer: groupData.funds.reduce((worst, fund) => 
          (fund['1 Year'] || 0) < (worst['1 Year'] || 0) ? fund : worst
        )
      };
      
      portfolioReturn += avgReturn * weight;
      totalFunds += groupData.count;
    });
    
    return {
      groups: attribution,
      portfolioReturn,
      totalFunds
    };
  }
  
  /**
   * Calculate diversification metrics
   * @param {Array<Object>} funds - Fund data
   * @returns {Object} Diversification metrics
   */
export function calculateDiversification(funds, groupBy = 'Asset Class') {
  // Asset class or group concentration
  const assetClassCounts = {};
  funds.forEach(fund => {
    const ac = fund[groupBy] || 'Unknown';
    assetClassCounts[ac] = (assetClassCounts[ac] || 0) + 1;
  });
    
    // Calculate Herfindahl Index (concentration measure)
    const totalFunds = funds.length;
    const herfindahlIndex = Object.values(assetClassCounts).reduce((sum, count) => {
      const share = count / totalFunds;
      return sum + (share * share);
    }, 0);
    
    // Effective number of asset classes (inverse of Herfindahl)
    const effectiveAssetClasses = 1 / herfindahlIndex;
    
    // Score concentration
    const scoreDistribution = {
      excellent: funds.filter(f => f.scores?.final >= 70).length,
      good: funds.filter(f => f.scores?.final >= 50 && f.scores?.final < 70).length,
      poor: funds.filter(f => f.scores?.final < 50).length
    };
    
    // Geographic diversification (if available)
    const geographicDiversity = calculateGeographicDiversity(funds);
    
    return {
      assetClassCount: Object.keys(assetClassCounts).length,
      effectiveAssetClasses: effectiveAssetClasses.toFixed(2),
      herfindahlIndex: herfindahlIndex.toFixed(4),
      largestAssetClass: Object.entries(assetClassCounts)
        .sort((a, b) => b[1] - a[1])[0],
      scoreDistribution,
      concentrationRisk: herfindahlIndex > 0.3 ? 'High' : 
                        herfindahlIndex > 0.2 ? 'Medium' : 'Low',
      geographicDiversity
    };
  }
  
  /**
   * Calculate geographic diversity based on fund names and types
   * @param {Array<Object>} funds - Fund data
   * @returns {Object} Geographic diversity metrics
   */
  function calculateGeographicDiversity(funds) {
    const geographic = {
      domestic: 0,
      international: 0,
      emerging: 0,
      global: 0
    };
    
    funds.forEach(fund => {
      const name = (fund.displayName || fund['Fund Name'])?.toLowerCase() || '';
  const assetClass = (fund.asset_class_name || fund.asset_class || fund['Asset Class'] || '')?.toLowerCase() || '';
      
      if (name.includes('international') || name.includes('foreign') || 
          assetClass.includes('international')) {
        geographic.international++;
      } else if (name.includes('emerging') || assetClass.includes('emerging')) {
        geographic.emerging++;
      } else if (name.includes('global') || name.includes('world')) {
        geographic.global++;
      } else {
        geographic.domestic++;
      }
    });
    
    return geographic;
  }
  
  /**
   * Identify outlier funds
   * @param {Array<Object>} funds - Fund data
   * @param {number} threshold - Standard deviations from mean to consider outlier
   * @returns {Object} Outlier analysis
   */
  export function identifyOutliers(funds, threshold = 2) {
    const outliers = {
      performance: [],
      risk: [],
      expense: [],
      score: []
    };
    
    // Calculate means and standard deviations
    const metrics = {
      performance: funds.map(f => f['1 Year']).filter(v => v != null),
      risk: funds.map(f => f['StdDev3Y'] ?? f['Standard Deviation']).filter(v => v != null),
      expense: funds.map(f => f['Net Expense Ratio']).filter(v => v != null),
      score: funds.map(f => f.scores?.final).filter(v => v != null)
    };
    
    Object.entries(metrics).forEach(([metric, values]) => {
      if (values.length < 3) return;
      
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const stdDev = Math.sqrt(
        values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
      );
      
      funds.forEach(fund => {
        let value;
        switch (metric) {
          case 'performance':
            value = fund['1 Year'];
            break;
          case 'risk':
            value = fund['StdDev3Y'] ?? fund['Standard Deviation'];
            break;
          case 'expense':
            value = fund['Net Expense Ratio'];
            break;
          case 'score':
            value = fund.scores?.final;
            break;
          default:
            value = null;
            break;
        }
        
        if (value != null) {
          const zScore = Math.abs((value - mean) / stdDev);
          if (zScore > threshold) {
            outliers[metric].push({
              fund,
              value,
              zScore: zScore.toFixed(2),
              direction: value > mean ? 'above' : 'below'
            });
          }
        }
      });
    });
    
    return outliers;
  }
  
const analytics = {
  calculateCorrelation,
  calculateCorrelationMatrix,
  calculateRiskReturnMetrics,
  findEfficientFrontier,
  calculatePortfolioStatistics,
  performAttribution,
  calculateDiversification,
  identifyOutliers
};

export default analytics;