// src/services/scoringHistory.js
import { supabase, TABLES } from './supabase.js';
import { calculateScores } from './scoring.js';

/**
 * Scoring History Tracking Service
 * Tracks how fund scores change over time for trend analysis
 */

/**
 * Get available snapshot months from the database
 */
async function getAvailableSnapshots() {
  try {
    // Get unique dates from fund_performance table, ordered by date desc
    const { data, error } = await supabase
      .from(TABLES.FUND_PERFORMANCE)
      .select('date')
      .order('date', { ascending: false });
    
    if (error) throw error;
    
    // Get unique dates and convert to YYYY-MM-DD format
    const uniqueDates = [...new Set((data || []).map(row => row.date))];
    return uniqueDates.slice(0, 24); // Last 24 months max
  } catch (error) {
    console.warn('Failed to get snapshots, using mock data:', error);
    // Return mock dates for last 12 months
    const dates = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      dates.push(date.toISOString().split('T')[0]);
    }
    return dates;
  }
}

/**
 * Get fund data for a specific date
 */
async function getFundsAsOfDate(date) {
  try {
    // Use the existing RPC function to get funds as of a specific date
    const { data: rows, error } = await supabase.rpc('get_funds_as_of', { p_date: date });
    if (error) throw error;
    
    // Transform to the expected format
    const funds = (rows || []).map(r => ({
      ticker: r.ticker,
      name: r.name,
      asset_class: r.asset_class,
      asset_class_name: r.asset_class_name || r.asset_class,
      ytd_return: r.ytd_return,
      one_year_return: r.one_year_return,
      three_year_return: r.three_year_return,
      five_year_return: r.five_year_return,
      ten_year_return: r.ten_year_return,
      three_year_sharpe: r.sharpe_ratio,
      standard_deviation_3y: r.standard_deviation_3y,
      standard_deviation_5y: r.standard_deviation_5y,
      up_capture_ratio: r.up_capture_ratio,
      down_capture_ratio: r.down_capture_ratio,
      alpha: r.alpha,
      expense_ratio: r.expense_ratio,
      manager_tenure: r.manager_tenure,
      is_recommended: r.is_recommended
    }));
    
    // Calculate scores using the existing scoring engine
    return calculateScores(funds);
    
  } catch (error) {
    console.warn(`Failed to get funds for ${date}, generating mock data:`, error);
    return generateMockFundData(date);
  }
}

/**
 * Generate mock fund data for testing when real data is unavailable
 */
function generateMockFundData(date) {
  const mockFunds = [
    { ticker: 'VTIAX', name: 'Vanguard Total International Stock', asset_class: 'International' },
    { ticker: 'VTSAX', name: 'Vanguard Total Stock Market', asset_class: 'Large Cap Blend' },
    { ticker: 'VBTLX', name: 'Vanguard Total Bond Market', asset_class: 'Fixed Income' },
    { ticker: 'VTIAX', name: 'Vanguard Total International Stock', asset_class: 'International' },
    { ticker: 'VSMAX', name: 'Vanguard Small-Cap', asset_class: 'Small Cap' }
  ];
  
  return mockFunds.map(fund => ({
    ...fund,
    scores: {
      final: 45 + Math.random() * 40, // Random score between 45-85
      percentile: Math.floor(Math.random() * 100),
      breakdown: {},
      confidence: {
        overall: 70 + Math.floor(Math.random() * 30),
        level: ['Medium', 'High'][Math.floor(Math.random() * 2)]
      }
    }
  }));
}

/**
 * Get scoring history for a specific fund
 */
export async function getFundScoringHistory(fundTicker, months = 12) {
  try {
    // Get available snapshot dates
    const snapshots = await getAvailableSnapshots();
    
    if (!snapshots || snapshots.length === 0) {
      console.warn('No snapshots available, returning mock data');
      return generateMockHistory(fundTicker, months);
    }
    
    // Limit to requested number of months
    const recentSnapshots = snapshots.slice(0, months);
    
    // Get fund data for each snapshot
    const historyPromises = recentSnapshots.map(async (date) => {
      try {
        const funds = await getFundsAsOfDate(date);
        const fund = funds.find(f => 
          (f.ticker || f.symbol) === fundTicker
        );
        
        if (fund && fund.scores?.final != null) {
          return {
            date,
            score: fund.scores.final,
            rank: calculateRankInAssetClass(fund, funds),
            assetClass: fund.asset_class_name || fund.asset_class,
            totalFundsInClass: countFundsInAssetClass(fund.asset_class_name || fund.asset_class, funds),
            metrics: extractKeyMetrics(fund)
          };
        }
        return null;
      } catch (error) {
        console.warn(`Failed to get fund data for ${date}:`, error);
        return null;
      }
    });
    
    const history = await Promise.all(historyPromises);
    const validHistory = history.filter(h => h != null);
    
    if (validHistory.length === 0) {
      console.warn('No valid history found, returning mock data');
      return generateMockHistory(fundTicker, months);
    }
    
    return validHistory.sort((a, b) => new Date(a.date) - new Date(b.date));
    
  } catch (error) {
    console.error('Failed to get scoring history:', error);
    return generateMockHistory(fundTicker, months);
  }
}

/**
 * Generate mock scoring history for testing
 */
function generateMockHistory(fundTicker, months = 12) {
  const history = [];
  const baseScore = 55 + Math.random() * 20; // Base score between 55-75
  const trend = (Math.random() - 0.5) * 0.5; // Small trend up or down
  
  for (let i = 0; i < months; i++) {
    const date = new Date();
    date.setMonth(date.getMonth() - (months - 1 - i));
    
    // Add some variation and trend
    const variation = (Math.random() - 0.5) * 8; // ±4 point variation
    const trendEffect = trend * i;
    const score = Math.max(20, Math.min(90, baseScore + variation + trendEffect));
    
    history.push({
      date: date.toISOString().split('T')[0],
      score: Math.round(score * 10) / 10,
      rank: Math.floor(Math.random() * 50) + 1,
      assetClass: 'Large Cap Blend',
      totalFundsInClass: 45 + Math.floor(Math.random() * 20),
      metrics: {
        ytdReturn: (Math.random() - 0.3) * 20,
        oneYearReturn: (Math.random() - 0.2) * 25,
        threeYearReturn: Math.random() * 15,
        sharpeRatio: Math.random() * 2,
        expenseRatio: 0.03 + Math.random() * 0.05
      }
    });
  }
  
  return history;
}

/**
 * Get scoring history for multiple funds
 */
export async function getMultipleFundsHistory(fundTickers, months = 12) {
  const historyPromises = fundTickers.map(ticker => 
    getFundScoringHistory(ticker, months)
  );
  
  const histories = await Promise.all(historyPromises);
  
  // Combine into a single object keyed by ticker
  const result = {};
  fundTickers.forEach((ticker, index) => {
    result[ticker] = histories[index];
  });
  
  return result;
}

/**
 * Analyze scoring trends for a fund
 */
export function analyzeScoringTrends(history) {
  if (!history || history.length < 2) {
    return {
      trend: 'insufficient_data',
      direction: null,
      magnitude: 0,
      consistency: 0,
      recentChange: 0
    };
  }
  
  // Calculate trend direction and magnitude
  const scores = history.map(h => h.score);
  const dates = history.map(h => new Date(h.date));
  
  // Linear regression to determine trend
  const { slope, rSquared } = calculateLinearRegression(
    dates.map((d, i) => i), // Use index as x-values
    scores
  );
  
  // Recent change (last 3 months if available)
  const recentHistory = history.slice(-3);
  const recentChange = recentHistory.length >= 2 
    ? recentHistory[recentHistory.length - 1].score - recentHistory[0].score
    : 0;
  
  // Consistency (how much scores vary around the trend line)
  const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  const variance = scores.reduce((sum, s) => sum + Math.pow(s - avgScore, 2), 0) / scores.length;
  const consistency = Math.max(0, 100 - Math.sqrt(variance));
  
  return {
    trend: slope > 0.5 ? 'improving' : slope < -0.5 ? 'declining' : 'stable',
    direction: slope > 0 ? 'up' : slope < 0 ? 'down' : 'flat',
    magnitude: Math.abs(slope),
    consistency: Math.round(consistency),
    recentChange: Math.round(recentChange * 10) / 10,
    rSquared: Math.round(rSquared * 100) / 100
  };
}

/**
 * Get asset class scoring trends
 */
export async function getAssetClassTrends(assetClass, months = 12) {
  try {
    const snapshots = await fundService.listSnapshotMonths();
    const recentSnapshots = snapshots.slice(0, months);
    
    const trendsPromises = recentSnapshots.map(async (date) => {
      try {
        const funds = await fundService.getAllFunds(date);
        const assetClassFunds = funds.filter(f => 
          (f.asset_class || f.assetClass) === assetClass && 
          f.score != null
        );
        
        if (assetClassFunds.length === 0) return null;
        
        const scores = assetClassFunds.map(f => f.score);
        return {
          date,
          avgScore: scores.reduce((sum, s) => sum + s, 0) / scores.length,
          medianScore: calculateMedian(scores),
          topScore: Math.max(...scores),
          bottomScore: Math.min(...scores),
          fundCount: assetClassFunds.length,
          scoreDistribution: calculateScoreDistribution(scores)
        };
      } catch (error) {
        console.warn(`Failed to get asset class data for ${date}:`, error);
        return null;
      }
    });
    
    const trends = await Promise.all(trendsPromises);
    return trends.filter(t => t != null).sort((a, b) => new Date(a.date) - new Date(b.date));
    
  } catch (error) {
    console.error('Failed to get asset class trends:', error);
    return [];
  }
}

/**
 * Calculate comparative performance vs peers over time
 */
export function calculatePeerPerformance(fundHistory, assetClassTrends) {
  if (!fundHistory || !assetClassTrends || fundHistory.length === 0) {
    return [];
  }
  
  return fundHistory.map(fundData => {
    const matching = assetClassTrends.find(trend => trend.date === fundData.date);
    if (!matching) return null;
    
    return {
      date: fundData.date,
      fundScore: fundData.score,
      assetClassAvg: matching.avgScore,
      assetClassMedian: matching.medianScore,
      percentileRank: calculatePercentileRank(fundData.score, matching),
      outperformance: fundData.score - matching.avgScore
    };
  }).filter(p => p != null);
}

/**
 * Generate scoring insights for advisors
 */
export function generateScoringInsights(fundTicker, history, trends, peerPerformance) {
  const insights = [];
  
  if (!history || history.length === 0) {
    insights.push({
      type: 'warning',
      title: 'Insufficient Historical Data',
      message: 'Not enough historical scoring data available for meaningful trend analysis.'
    });
    return insights;
  }
  
  // Trend insights
  if (trends.trend === 'improving') {
    insights.push({
      type: 'positive',
      title: 'Improving Trend',
      message: `${fundTicker} shows a consistent improvement trend with ${trends.consistency}% consistency over the analyzed period.`
    });
  } else if (trends.trend === 'declining') {
    insights.push({
      type: 'warning',
      title: 'Declining Trend',
      message: `${fundTicker} shows a declining score trend. Recent change: ${trends.recentChange} points.`
    });
  }
  
  // Recent performance insights
  if (Math.abs(trends.recentChange) > 5) {
    const direction = trends.recentChange > 0 ? 'improved' : 'declined';
    insights.push({
      type: trends.recentChange > 0 ? 'positive' : 'warning',
      title: 'Significant Recent Change',
      message: `Score has ${direction} by ${Math.abs(trends.recentChange)} points in recent months.`
    });
  }
  
  // Peer comparison insights
  if (peerPerformance && peerPerformance.length > 0) {
    const recentPeer = peerPerformance[peerPerformance.length - 1];
    if (recentPeer.percentileRank > 75) {
      insights.push({
        type: 'positive',
        title: 'Top Quartile Performance',
        message: `Currently ranked in the top 25% of ${history[0]?.assetClass || 'peer'} funds.`
      });
    } else if (recentPeer.percentileRank < 25) {
      insights.push({
        type: 'warning',
        title: 'Bottom Quartile Performance',
        message: `Currently ranked in the bottom 25% of ${history[0]?.assetClass || 'peer'} funds.`
      });
    }
  }
  
  // Consistency insights
  if (trends.consistency > 80) {
    insights.push({
      type: 'positive',
      title: 'Consistent Performance',
      message: `Shows high consistency (${trends.consistency}%) in scoring patterns.`
    });
  } else if (trends.consistency < 50) {
    insights.push({
      type: 'info',
      title: 'Variable Performance',
      message: `Performance shows higher variability (${trends.consistency}% consistency).`
    });
  }
  
  return insights;
}

// Helper Functions

function calculateRankInAssetClass(fund, allFunds) {
  const assetClassFunds = allFunds.filter(f => 
    (f.asset_class || f.assetClass) === (fund.asset_class || fund.assetClass) &&
    f.score != null
  ).sort((a, b) => b.score - a.score);
  
  const rank = assetClassFunds.findIndex(f => 
    (f.ticker || f.symbol || f.fund_ticker) === (fund.ticker || fund.symbol || fund.fund_ticker)
  ) + 1;
  
  return rank || null;
}

function countFundsInAssetClass(assetClass, allFunds) {
  return allFunds.filter(f => 
    (f.asset_class || f.assetClass) === assetClass && f.score != null
  ).length;
}

function extractKeyMetrics(fund) {
  return {
    ytdReturn: fund.ytd_return,
    oneYearReturn: fund.one_year_return,
    threeYearReturn: fund.three_year_return,
    fiveYearReturn: fund.five_year_return,
    sharpeRatio: fund.three_year_sharpe,
    expenseRatio: fund.expense_ratio
  };
}

function calculateLinearRegression(xValues, yValues) {
  const n = xValues.length;
  if (n < 2) return { slope: 0, rSquared: 0 };
  
  const sumX = xValues.reduce((a, b) => a + b, 0);
  const sumY = yValues.reduce((a, b) => a + b, 0);
  const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
  const sumXX = xValues.reduce((sum, x) => sum + x * x, 0);
  const sumYY = yValues.reduce((sum, y) => sum + y * y, 0);
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  
  // Calculate R-squared
  const yMean = sumY / n;
  const ssTotal = yValues.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0);
  const ssResidual = yValues.reduce((sum, y, i) => {
    const predicted = slope * xValues[i] + (sumY - slope * sumX) / n;
    return sum + Math.pow(y - predicted, 2);
  }, 0);
  
  const rSquared = ssTotal === 0 ? 0 : 1 - (ssResidual / ssTotal);
  
  return { slope, rSquared: Math.max(0, rSquared) };
}

function calculateMedian(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 
    ? (sorted[mid - 1] + sorted[mid]) / 2 
    : sorted[mid];
}

function calculateScoreDistribution(scores) {
  const bins = { excellent: 0, good: 0, fair: 0, poor: 0 };
  
  scores.forEach(score => {
    if (score >= 70) bins.excellent++;
    else if (score >= 50) bins.good++;
    else if (score >= 30) bins.fair++;
    else bins.poor++;
  });
  
  return bins;
}

function calculatePercentileRank(score, assetClassData) {
  // Simple approximation - in practice would need full score distribution
  const { avgScore, topScore, bottomScore } = assetClassData;
  
  if (score >= avgScore) {
    // Above average - interpolate between 50th and 100th percentile
    const ratio = (score - avgScore) / (topScore - avgScore);
    return 50 + (ratio * 50);
  } else {
    // Below average - interpolate between 0th and 50th percentile
    const ratio = (score - bottomScore) / (avgScore - bottomScore);
    return ratio * 50;
  }
}

export default {
  getFundScoringHistory,
  getMultipleFundsHistory,
  analyzeScoringTrends,
  getAssetClassTrends,
  calculatePeerPerformance,
  generateScoringInsights
};