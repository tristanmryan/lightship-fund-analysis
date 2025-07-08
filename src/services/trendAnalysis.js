// src/services/trendAnalysis.js

/**
 * Trend Analysis Service
 * Provides analytical functions for historical fund performance
 */

/**
 * Calculate trend direction and strength
 * @param {Array<number>} values - Array of values over time
 * @returns {Object} Trend analysis results
 */
export function analyzeTrend(values) {
    if (!values || values.length < 2) {
      return { direction: 'flat', strength: 0, slope: 0 };
    }
    
    // Calculate linear regression
    const n = values.length;
    const xSum = (n * (n - 1)) / 2; // Sum of 0,1,2,...,n-1
    const xSquaredSum = (n * (n - 1) * (2 * n - 1)) / 6;
    
    let ySum = 0;
    let xySum = 0;
    
    values.forEach((y, x) => {
      ySum += y;
      xySum += x * y;
    });
    
    // Calculate slope
    const slope = (n * xySum - xSum * ySum) / (n * xSquaredSum - xSum * xSum);
    
    // Calculate R-squared for trend strength
    const yMean = ySum / n;
    let ssTotal = 0;
    let ssResidual = 0;
    
    values.forEach((y, x) => {
      const yPredicted = (slope * x) + (yMean - slope * (xSum / n));
      ssTotal += Math.pow(y - yMean, 2);
      ssResidual += Math.pow(y - yPredicted, 2);
    });
    
    const rSquared = 1 - (ssResidual / ssTotal);
    
    // Determine direction and strength
    let direction = 'flat';
    if (Math.abs(slope) > 0.1) {
      direction = slope > 0 ? 'up' : 'down';
    }
    
    return {
      direction,
      strength: Math.abs(rSquared),
      slope: slope
    };
  }
  
  /**
   * Identify significant changes in fund performance
   * @param {Array<Object>} dataPoints - Array of {date, value} objects
   * @param {number} threshold - Percentage threshold for significant change
   * @returns {Array<Object>} Significant changes
   */
  export function identifySignificantChanges(dataPoints, threshold = 10) {
    const changes = [];
    
    for (let i = 1; i < dataPoints.length; i++) {
      const prevPoint = dataPoints[i - 1];
      const currPoint = dataPoints[i];
      
      const change = currPoint.value - prevPoint.value;
      const changePercent = prevPoint.value !== 0 
        ? (change / prevPoint.value) * 100 
        : 0;
      
      if (Math.abs(changePercent) >= threshold) {
        changes.push({
          fromDate: prevPoint.date,
          toDate: currPoint.date,
          fromValue: prevPoint.value,
          toValue: currPoint.value,
          change: change,
          changePercent: changePercent,
          direction: change > 0 ? 'increase' : 'decrease'
        });
      }
    }
    
    return changes;
  }
  
  /**
   * Calculate volatility of fund performance
   * @param {Array<number>} values - Array of values
   * @returns {number} Volatility (standard deviation)
   */
  export function calculateVolatility(values) {
    if (!values || values.length < 2) return 0;
    
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    
    return Math.sqrt(variance);
  }
  
  /**
   * Compare fund performance to benchmark over time
   * @param {Array<Object>} fundData - Fund data points
   * @param {Array<Object>} benchmarkData - Benchmark data points
   * @returns {Object} Comparison results
   */
  export function compareToBenchmark(fundData, benchmarkData) {
    // Align data points by date
    const comparison = {
      outperformancePeriods: 0,
      underperformancePeriods: 0,
      averageOutperformance: 0,
      dataPoints: []
    };
    
    fundData.forEach(fundPoint => {
      const benchmarkPoint = benchmarkData.find(bp => 
        bp.date.getTime() === fundPoint.date.getTime()
      );
      
      if (benchmarkPoint) {
        const difference = fundPoint.value - benchmarkPoint.value;
        comparison.dataPoints.push({
          date: fundPoint.date,
          fundValue: fundPoint.value,
          benchmarkValue: benchmarkPoint.value,
          difference: difference
        });
        
        if (difference > 0) {
          comparison.outperformancePeriods++;
        } else if (difference < 0) {
          comparison.underperformancePeriods++;
        }
      }
    });
    
    if (comparison.dataPoints.length > 0) {
      const totalDifference = comparison.dataPoints.reduce((sum, dp) => sum + dp.difference, 0);
      comparison.averageOutperformance = totalDifference / comparison.dataPoints.length;
    }
    
    return comparison;
  }
  
  /**
   * Identify funds with consistent performance
   * @param {Array<Object>} snapshots - Historical snapshots
   * @param {string} metric - Metric to analyze
   * @param {number} consistencyThreshold - Max deviation allowed
   * @returns {Array<Object>} Consistent performers
   */
  export function findConsistentPerformers(snapshots, metric = 'score', consistencyThreshold = 10) {
    const fundPerformance = {};
    
    // Collect performance data for each fund
    snapshots.forEach(snapshot => {
      snapshot.funds.forEach(fund => {
        if (!fundPerformance[fund.Symbol]) {
          fundPerformance[fund.Symbol] = {
            symbol: fund.Symbol,
            name: fund.displayName || fund['Fund Name'],
            values: []
          };
        }
        
        let value = null;
        switch (metric) {
          case 'score':
            value = fund.scores?.final;
            break;
          case '1year':
            value = fund['1 Year'];
            break;
          case 'sharpe':
            value = fund['Sharpe Ratio'];
            break;
        }
        
        if (value != null) {
          fundPerformance[fund.Symbol].values.push(value);
        }
      });
    });
    
    // Analyze consistency
    const consistentFunds = [];
    
    Object.values(fundPerformance).forEach(fund => {
      if (fund.values.length >= 3) { // Need at least 3 data points
        const volatility = calculateVolatility(fund.values);
        const mean = fund.values.reduce((a, b) => a + b, 0) / fund.values.length;
        const coefficientOfVariation = mean !== 0 ? (volatility / Math.abs(mean)) * 100 : 0;
        
        if (coefficientOfVariation <= consistencyThreshold) {
          consistentFunds.push({
            ...fund,
            volatility,
            mean,
            coefficientOfVariation,
            dataPoints: fund.values.length
          });
        }
      }
    });
    
    // Sort by consistency (lower CV is better)
    consistentFunds.sort((a, b) => a.coefficientOfVariation - b.coefficientOfVariation);
    
    return consistentFunds;
  }
  
  /**
   * Predict next value using simple moving average
   * @param {Array<number>} values - Historical values
   * @param {number} periods - Number of periods for moving average
   * @returns {number} Predicted next value
   */
  export function predictNextValue(values, periods = 3) {
    if (!values || values.length === 0) return null;
    
    const recentValues = values.slice(-periods);
    return recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
  }
  
  /**
   * Calculate momentum score
   * @param {Array<Object>} dataPoints - Array of {date, value} objects
   * @returns {number} Momentum score (-100 to 100)
   */
  export function calculateMomentum(dataPoints) {
    if (!dataPoints || dataPoints.length < 2) return 0;
    
    // Sort by date
    const sorted = [...dataPoints].sort((a, b) => a.date - b.date);
    
    // Calculate short-term and long-term averages
    const recentPeriods = Math.min(3, Math.floor(sorted.length / 2));
    const recentValues = sorted.slice(-recentPeriods).map(dp => dp.value);
    const olderValues = sorted.slice(0, sorted.length - recentPeriods).map(dp => dp.value);
    
    const recentAvg = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
    const olderAvg = olderValues.reduce((a, b) => a + b, 0) / olderValues.length;
    
    // Calculate momentum as percentage difference
    if (olderAvg === 0) return 0;
    const momentum = ((recentAvg - olderAvg) / olderAvg) * 100;
    
    // Cap at ±100
    return Math.max(-100, Math.min(100, momentum));
  }
  
  /**
   * Find turning points in performance
   * @param {Array<Object>} dataPoints - Array of {date, value} objects
   * @param {number} sensitivity - Minimum change to consider a turning point
   * @returns {Array<Object>} Turning points
   */
  export function findTurningPoints(dataPoints, sensitivity = 5) {
    if (!dataPoints || dataPoints.length < 3) return [];
    
    const turningPoints = [];
    
    for (let i = 1; i < dataPoints.length - 1; i++) {
      const prev = dataPoints[i - 1].value;
      const curr = dataPoints[i].value;
      const next = dataPoints[i + 1].value;
      
      const prevChange = ((curr - prev) / prev) * 100;
      const nextChange = ((next - curr) / curr) * 100;
      
      // Peak: going up then down
      if (prevChange > sensitivity && nextChange < -sensitivity) {
        turningPoints.push({
          type: 'peak',
          date: dataPoints[i].date,
          value: curr,
          index: i
        });
      }
      // Trough: going down then up
      else if (prevChange < -sensitivity && nextChange > sensitivity) {
        turningPoints.push({
          type: 'trough',
          date: dataPoints[i].date,
          value: curr,
          index: i
        });
      }
    }
    
    return turningPoints;
  }
  
  /**
   * Generate performance summary for a fund
   * @param {Array<Object>} dataPoints - Historical data points
   * @returns {Object} Performance summary
   */
  export function generatePerformanceSummary(dataPoints) {
    if (!dataPoints || dataPoints.length === 0) {
      return null;
    }
    
    const values = dataPoints.map(dp => dp.value);
    const dates = dataPoints.map(dp => dp.date);
    
    const summary = {
      currentValue: values[values.length - 1],
      startValue: values[0],
      highValue: Math.max(...values),
      lowValue: Math.min(...values),
      averageValue: values.reduce((a, b) => a + b, 0) / values.length,
      volatility: calculateVolatility(values),
      trend: analyzeTrend(values),
      momentum: calculateMomentum(dataPoints),
      totalChange: values[values.length - 1] - values[0],
      totalChangePercent: values[0] !== 0 
        ? ((values[values.length - 1] - values[0]) / values[0]) * 100 
        : 0,
      timeSpan: {
        start: dates[0],
        end: dates[dates.length - 1],
        months: Math.round((dates[dates.length - 1] - dates[0]) / (1000 * 60 * 60 * 24 * 30))
      },
      dataPoints: dataPoints.length
    };
    
    // Find when high and low occurred
    summary.highDate = dates[values.indexOf(summary.highValue)];
    summary.lowDate = dates[values.indexOf(summary.lowValue)];
    
    // Add significant changes
    summary.significantChanges = identifySignificantChanges(dataPoints);
    
    // Add turning points
    summary.turningPoints = findTurningPoints(dataPoints);
    
    return summary;
  }
  
  export default {
    analyzeTrend,
    identifySignificantChanges,
    calculateVolatility,
    compareToBenchmark,
    findConsistentPerformers,
    predictNextValue,
    calculateMomentum,
    findTurningPoints,
    generatePerformanceSummary
  };