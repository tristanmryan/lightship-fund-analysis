// src/services/scoring.js
import { getConfig, saveConfig } from './dataStore.js';
import { CONFIG_KEYS } from '../data/storage.js';

/**
 * Core Scoring Engine for Lightship Fund Analysis
 * Implements weighted Z-score ranking system within asset classes
 * 
 * SCORING METHODOLOGY:
 * 1. Each fund is compared to peers within its asset class (benchmarks are scored but
 *    excluded from peer statistics)
 * 2. Metrics are standardized to Z-scores using the peer mean and standard deviation
 * 3. Weighted Z-scores are summed to produce a raw score
 * 4. The raw score is scaled using `50 + 10 * rawScore` and clamped to the 0-100 range
 * 5. Scores around 50 are average; strong funds may approach 80-90 in extreme cases
 * 
 * SCORE INTERPRETATION:
 * - 60+: Strong performance
 * - 55-59: Healthy
 * - 45-54: Neutral
 * - 40-44: Caution
 * - Below 40: Weak
*/

// Default metric weights configuration (same as companion app)
export const DEFAULT_WEIGHTS = {
    ytd: 0.025,
    oneYear: 0.05,
    threeYear: 0.10,
    fiveYear: 0.15,
    tenYear: 0.10,
    sharpeRatio3Y: 0.10,
    stdDev3Y: -0.075,
    stdDev5Y: -0.125,
    upCapture3Y: 0.075,
    downCapture3Y: -0.10,
    alpha5Y: 0.05,
    expenseRatio: -0.025,
    managerTenure: 0.025
  };

// Mutable weights used during scoring
let METRIC_WEIGHTS = { ...DEFAULT_WEIGHTS };
  
  // Metric display names for reporting
  const METRIC_LABELS = {
    ytd: 'YTD Return',
    oneYear: '1-Year Return',
    threeYear: '3-Year Return',
    fiveYear: '5-Year Return',
    tenYear: '10-Year Return',
    sharpeRatio3Y: '3Y Sharpe Ratio',
    stdDev3Y: '3Y Std Deviation',
    stdDev5Y: '5Y Std Deviation',
    upCapture3Y: '3Y Up Capture',
    downCapture3Y: '3Y Down Capture',
    alpha5Y: '5Y Alpha',
    expenseRatio: 'Expense Ratio',
    managerTenure: 'Manager Tenure'
  };

  // Order of metrics for UI display
export const METRIC_ORDER = [
    'ytd',
    'oneYear',
    'threeYear',
    'fiveYear',
    'tenYear',
    'sharpeRatio3Y',
    'stdDev3Y',
    'stdDev5Y',
    'upCapture3Y',
    'downCapture3Y',
    'alpha5Y',
    'expenseRatio',
  'managerTenure'
];

// Load stored weights and set METRIC_WEIGHTS
export async function loadMetricWeights() {
  try {
    if (process.env.NODE_ENV === 'test') {
      METRIC_WEIGHTS = { ...DEFAULT_WEIGHTS };
      return;
    }
    const stored = await getConfig(CONFIG_KEYS.SCORING_WEIGHTS);
    if (stored && typeof stored === 'object') {
      METRIC_WEIGHTS = { ...DEFAULT_WEIGHTS, ...stored };
    }
  } catch (err) {
    console.error('Failed to load metric weights', err);
    METRIC_WEIGHTS = { ...DEFAULT_WEIGHTS };
  }
}

// Get current metric weights
export function getMetricWeights() {
  return { ...METRIC_WEIGHTS };
}

// Persist and update metric weights
export async function setMetricWeights(weights) {
  METRIC_WEIGHTS = { ...METRIC_WEIGHTS, ...weights };
  try {
    await saveConfig(CONFIG_KEYS.SCORING_WEIGHTS, METRIC_WEIGHTS);
  } catch (err) {
    console.error('Failed to save metric weights', err);
  }
}
  
  /**
   * Calculate Z-score for a value within a distribution
   * @param {number} value - The value to calculate Z-score for
   * @param {number} mean - Mean of the distribution
   * @param {number} stdDev - Standard deviation of the distribution
   * @returns {number} Z-score
   */
  function calculateZScore(value, mean, stdDev) {
    if (stdDev === 0 || isNaN(stdDev)) return 0;
    return (value - mean) / stdDev;
  }
  
  /**
   * Calculate mean of an array of numbers, ignoring null/undefined
   * @param {Array<number>} values - Array of values
   * @returns {number} Mean value
   */
  function calculateMean(values) {
    const validValues = values.filter(v => v != null && !isNaN(v));
    if (validValues.length === 0) return 0;
    return validValues.reduce((sum, val) => sum + val, 0) / validValues.length;
  }
  
  /**
   * Calculate standard deviation of an array of numbers
   * @param {Array<number>} values - Array of values
   * @param {number} mean - Pre-calculated mean
   * @returns {number} Standard deviation
   */
  function calculateStdDev(values, mean) {
    const validValues = values.filter(v => v != null && !isNaN(v));
    if (validValues.length <= 1) return 0;
    
    const squaredDiffs = validValues.map(val => Math.pow(val - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / validValues.length;
    return Math.sqrt(avgSquaredDiff);
  }
  
  /**
   * Transform raw weighted Z-score sum to the final 0-100 range used in the UI.
   * The scaling mirrors the approach used in the companion application.
   * @param {number} rawScore - Sum of weighted Z-scores
   * @returns {number} Scaled score between 0 and 100
   */
  function scaleScore(rawScore) {
    let scaled = 50 + 10 * rawScore;
    if (scaled < 0) return 0;
    if (scaled > 100) return 100;
    return Math.round(scaled * 10) / 10;
  }
  
  /**
   * Parse metric value from Excel data
   * Handles percentage strings and various formats
   * @param {any} value - Raw value from Excel
   * @returns {number|null} Parsed numeric value
   */
  function parseMetricValue(value) {
    if (value == null || value === '' || value === 'N/A' || value === 'N/A N/A') return null;
    
    // If already a number, return it
    if (typeof value === 'number') return value;
    
    // Convert string to number
    if (typeof value === 'string') {
      // Remove percentage sign and commas
      const cleaned = value.replace(/[%,]/g, '').trim();
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? null : parsed;
    }
    
    return null;
  }
  
  /**
   * Extract metrics from fund data based on column mappings
   * @param {Object} fundData - Raw fund data from Excel
   * @returns {Object} Standardized metrics object
   */
  function extractMetrics(fundData) {
    // Map both legacy CSV-derived keys and live Supabase keys to engine metrics
    // Legacy/CSV keys
    const csv = {
      ytd: fundData['YTD'],
      oneYear: fundData['1 Year'],
      threeYear: fundData['3 Year'],
      fiveYear: fundData['5 Year'],
      tenYear: fundData['10 Year'],
      sharpeRatio3Y: fundData['Sharpe Ratio'] || fundData['Sharpe Ratio - 3 Year'],
      stdDev3Y: fundData['StdDev3Y'] || fundData['Standard Deviation - 3 Year'],
      stdDev5Y: fundData['StdDev5Y'] || fundData['Standard Deviation - 5 Year'] || fundData['Standard Deviation'],
      upCapture3Y: fundData['Up Capture Ratio'] || fundData['Up Capture'] || fundData['Up Capture Ratio (Morningstar Standard) - 3 Year'],
      downCapture3Y: fundData['Down Capture Ratio'] || fundData['Down Capture'] || fundData['Down Capture Ratio (Morningstar Standard) - 3 Year'],
      alpha5Y: fundData['Alpha'] || fundData['Alpha (Asset Class) - 5 Year'],
      expenseRatio: fundData['Net Expense Ratio'] || fundData['Net Exp Ratio (%)'],
      managerTenure: fundData['Manager Tenure'] || fundData['Longest Manager Tenure (Years)']
    };
    // Live/Supabase keys
    const live = {
      ytd: fundData.ytd_return,
      oneYear: fundData.one_year_return,
      threeYear: fundData.three_year_return,
      fiveYear: fundData.five_year_return,
      tenYear: fundData.ten_year_return,
      sharpeRatio3Y: fundData.sharpe_ratio,
      stdDev3Y: fundData.standard_deviation_3y,
      stdDev5Y: fundData.standard_deviation_5y,
      upCapture3Y: fundData.up_capture_ratio,
      downCapture3Y: fundData.down_capture_ratio,
      alpha5Y: fundData.alpha,
      expenseRatio: fundData.expense_ratio,
      managerTenure: fundData.manager_tenure
    };
    return {
      ytd: parseMetricValue(live.ytd ?? csv.ytd),
      oneYear: parseMetricValue(live.oneYear ?? csv.oneYear),
      threeYear: parseMetricValue(live.threeYear ?? csv.threeYear),
      fiveYear: parseMetricValue(live.fiveYear ?? csv.fiveYear),
      tenYear: parseMetricValue(live.tenYear ?? csv.tenYear),
      sharpeRatio3Y: parseMetricValue(live.sharpeRatio3Y ?? csv.sharpeRatio3Y),
      stdDev3Y: parseMetricValue(live.stdDev3Y ?? csv.stdDev3Y),
      stdDev5Y: parseMetricValue(live.stdDev5Y ?? csv.stdDev5Y),
      upCapture3Y: parseMetricValue(live.upCapture3Y ?? csv.upCapture3Y),
      downCapture3Y: parseMetricValue(live.downCapture3Y ?? csv.downCapture3Y),
      alpha5Y: parseMetricValue(live.alpha5Y ?? csv.alpha5Y),
      expenseRatio: parseMetricValue(live.expenseRatio ?? csv.expenseRatio),
      managerTenure: parseMetricValue(live.managerTenure ?? csv.managerTenure)
    };
  }
  
  /**
   * Calculate distribution statistics for each metric within an asset class
   * @param {Array<Object>} funds - Funds in the same asset class
   * @returns {Object} Statistics for each metric
   */
  function calculateMetricStatistics(funds) {
    const stats = {};
    
    Object.keys(METRIC_WEIGHTS).forEach(metric => {
      const values = funds.map(fund => fund.metrics?.[metric]).filter(v => v != null);
      const mean = calculateMean(values);
      const stdDev = calculateStdDev(values, mean);
      
      stats[metric] = {
        mean,
        stdDev,
        count: values.length,
        min: values.length > 0 ? Math.min(...values) : 0,
        max: values.length > 0 ? Math.max(...values) : 0
      };
    });
    
    return stats;
  }
  
  /**
   * Calculate weighted Z-score for a single fund
   * @param {Object} fund - Fund with metrics
   * @param {Object} statistics - Metric statistics for the asset class
   * @returns {Object} Score details including breakdown
   */
  function calculateFundScore(fund, statistics) {
    const scoreBreakdown = {};
    let weightedSum = 0;
    
    Object.entries(METRIC_WEIGHTS).forEach(([metric, weight]) => {
      const value = fund.metrics?.[metric];
      const stats = statistics[metric];
      
      // Allow scoring when at least a benchmark and one fund are present
      // (two values). Previously required >2 which skipped small asset
      // classes entirely.
      if (value != null && stats && stats.stdDev > 0 && stats.count >= 2) {
        const zScore = calculateZScore(value, stats.mean, stats.stdDev);
        const weightedZScore = zScore * weight;
        
        scoreBreakdown[metric] = {
          value,
          zScore: Math.round(zScore * 100) / 100, // Round to 2 decimals
          weight,
          weightedZScore: Math.round(weightedZScore * 1000) / 1000, // Round to 3 decimals
          percentile: calculatePercentile(value, stats, metric, weight)
        };
        
        weightedSum += weightedZScore;
      }
    });
    
    // Reweighting for missing metrics: adjust contributions proportionally
    const present = Object.keys(scoreBreakdown);
    let reweightedSum = 0;
    if (present.length > 0) {
      const totalAbs = present.reduce((s, m) => s + Math.abs(METRIC_WEIGHTS[m] || 0), 0);
      present.forEach((m) => {
        const w = METRIC_WEIGHTS[m] || 0;
        const z = scoreBreakdown[m].zScore;
        const proportional = (Math.abs(w) / totalAbs) * Math.sign(w);
        const contrib = z * proportional;
        scoreBreakdown[m].reweightedContribution = Math.round(contrib * 1000) / 1000;
        reweightedSum += contrib;
      });
    }

    return {
      raw: weightedSum,
      rawReweighted: Math.round(reweightedSum * 1000) / 1000,
      breakdown: scoreBreakdown,
      metricsUsed: Object.keys(scoreBreakdown).length,
      totalPossibleMetrics: Object.keys(METRIC_WEIGHTS).length
    };
  }
  
  /**
   * Calculate percentile rank for a value within distribution
   * @param {number} value - Value to rank
   * @param {Object} stats - Distribution statistics
   * @param {string} metric - Metric name
   * @param {number} weight - Metric weight (for determining direction)
   * @returns {number} Percentile (0-100)
   */
  function calculatePercentile(value, stats, metric, weight) {
    // For negative weight metrics (like expense ratio), lower is better
    // So we need to invert the percentile
    const zScore = calculateZScore(value, stats.mean, stats.stdDev);
    
    // Using normal distribution approximation
    let percentile = (1 + erf(zScore / Math.sqrt(2))) / 2 * 100;
    
    // If negative weight, invert percentile (lower values get higher percentiles)
    if (weight < 0) {
      percentile = 100 - percentile;
    }
    
    return Math.round(percentile);
  }
  
  // Error function approximation for percentile calculation
  function erf(x) {
    // Abramowitz and Stegun approximation
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;
  
    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);
  
    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  
    return sign * y;
  }
  
  /**
   * Main scoring function - calculates scores for all funds
   * @param {Array<Object>} funds - All funds with asset class assignments
   * @returns {Array<Object>} Funds with calculated scores
   */
  export function calculateScores(funds) {
    // Group funds by asset class
    const fundsByClass = {};
    funds.forEach(fund => {
      const assetClass = fund.asset_class_name || fund.asset_class || fund['Asset Class'] || 'Unknown';
      if (!fundsByClass[assetClass]) {
        fundsByClass[assetClass] = [];
      }
      fundsByClass[assetClass].push(fund);
    });
    
    // Calculate scores within each asset class
    const scoredFunds = [];
    
    Object.entries(fundsByClass).forEach(([assetClass, classFunds]) => {
      // Log asset class composition for debugging
      const benchmarkCount = classFunds.filter(f => f.isBenchmark).length;
      const recommendedCount = classFunds.filter(f => f.isRecommended).length;
      console.log(`Scoring ${assetClass}: ${classFunds.length} funds (${benchmarkCount} benchmarks, ${recommendedCount} recommended)`);
      
      // Skip if only one fund in class (can't calculate meaningful statistics)
      if (classFunds.length < 2) {
        classFunds.forEach(fund => {
          scoredFunds.push({
            ...fund,
            metrics: extractMetrics(fund),
            scores: {
              raw: 0,
              final: 50, // Default to middle score
              percentile: 50,
              breakdown: {},
              metricsUsed: 0,
              totalPossibleMetrics: Object.keys(METRIC_WEIGHTS).length,
              note: 'Insufficient funds in asset class for scoring'
            }
          });
        });
        return;
      }
      
      // Extract and standardize metrics for all funds
      const fundsWithMetrics = classFunds.map(fund => ({
        ...fund,
        metrics: extractMetrics(fund)
      }));
      
      // Calculate statistics for the asset class using peer funds only
      const peerFunds = fundsWithMetrics.filter(f => !f.isBenchmark);
      const statistics = calculateMetricStatistics(peerFunds);
      
      // Calculate raw scores for all funds
      const fundsWithRawScores = fundsWithMetrics.map(fund => {
        const scoreData = calculateFundScore(fund, statistics);
        return {
          ...fund,
          scoreData
        };
      });
      
      // Get all raw scores for scaling (use reweighted if available)
      const rawScores = fundsWithRawScores.map(f => (Number.isFinite(f.scoreData.rawReweighted) ? f.scoreData.rawReweighted : f.scoreData.raw));

      // Scale scores to 0-100 and calculate final percentiles
      fundsWithRawScores.forEach((fund, index) => {
        const base = Number.isFinite(fund.scoreData.rawReweighted) ? fund.scoreData.rawReweighted : fund.scoreData.raw;
        const finalScore = scaleScore(base);
        
        // Calculate percentile within asset class
        const betterThanCount = rawScores.filter(s => s < fund.scoreData.raw).length;
        const percentile = Math.round((betterThanCount / rawScores.length) * 100);
        
        scoredFunds.push({
          ...fund,
          scores: {
            raw: Math.round(base * 1000) / 1000, // Round to 3 decimals
            final: finalScore,
            percentile,
            breakdown: fund.scoreData.breakdown,
            metricsUsed: fund.scoreData.metricsUsed,
            totalPossibleMetrics: fund.scoreData.totalPossibleMetrics,
            assetClassSize: classFunds.length // Add for transparency
          }
        });
      });
    });
    
    return scoredFunds;
  }

  /**
   * Convenience helper for runtime scoring of live Supabase funds.
   * Accepts array of funds in live shape and returns the enriched scored array.
   */
  export function computeRuntimeScores(funds) {
    if (!Array.isArray(funds) || funds.length === 0) return funds || [];
    try {
      return calculateScores(funds);
    } catch (e) {
      console.error('Runtime scoring failed:', e);
      return funds;
    }
  }
  
  /**
   * Generate score summary report for an asset class
   * @param {Array<Object>} funds - Scored funds in the asset class
   * @returns {Object} Summary statistics
   */
  export function generateClassSummary(funds) {
    const scores = funds.map(f => f.scores?.final || 0);
    const benchmarkFund = funds.find(f => f.isBenchmark);
    
    const sortedScores = [...scores].sort((a, b) => a - b);
    const medianIndex = Math.floor(sortedScores.length / 2);
    
    return {
      fundCount: funds.length,
      averageScore: Math.round(calculateMean(scores)),
      medianScore: sortedScores[medianIndex] || 0,
      topPerformer: funds.reduce((best, fund) => 
        (fund.scores?.final || 0) > (best.scores?.final || 0) ? fund : best, funds[0]
      ),
      bottomPerformer: funds.reduce((worst, fund) => 
        (fund.scores?.final || 0) < (worst.scores?.final || 0) ? fund : worst, funds[0]
      ),
      benchmarkScore: benchmarkFund?.scores?.final,
      distribution: {
        strong: scores.filter(s => s >= 60).length,
        healthy: scores.filter(s => s >= 55 && s < 60).length,
        neutral: scores.filter(s => s >= 45 && s < 55).length,
        caution: scores.filter(s => s >= 40 && s < 45).length,
        weak: scores.filter(s => s < 40).length
      }
    };
  }
  
  /**
   * Identify funds that need review based on scores and rules
   * @param {Array<Object>} funds - Scored funds
   * @returns {Array<Object>} Funds flagged for review with reasons
   */
  export function identifyReviewCandidates(funds) {
    const reviewCandidates = [];
    
    funds.forEach(fund => {
      const reasons = [];
      
      // Skip if no scores calculated
      if (!fund.scores) return;
      
      // Check various conditions - adjusted for new scoring scale
      if (fund.scores.final < 45) {
        reasons.push('Below average score (<45)');
      }
      
      if (fund.scores.percentile < 25) {
        reasons.push('Bottom quartile in asset class');
      }
      
      const breakdown = fund.scores.breakdown || {};
      
      if (breakdown.sharpeRatio3Y?.percentile < 30) {
        reasons.push('Poor risk-adjusted returns');
      }
      
      if (breakdown.expenseRatio?.percentile < 25) {
        reasons.push('High expense ratio (bottom quartile)');
      }
      
      if (breakdown.downCapture3Y?.value > 110) {
        reasons.push('High downside capture (>110%)');
      }
      
      // Flag recommended funds that are below average
      if (fund.isRecommended && fund.scores.final < 50) {
        reasons.push('Recommended fund performing below average');
      }
      
      // Flag if significantly underperforming benchmark
      if (fund.benchmarkScore && fund.scores.final < fund.benchmarkScore - 5) {
        reasons.push('Underperforming benchmark by 5+ points');
      }
      
      if (reasons.length > 0) {
        reviewCandidates.push({
          ...fund,
          reviewReasons: reasons
        });
      }
    });
    
    return reviewCandidates;
  }
  
  /**
   * Get score color based on value
   * @param {number} score - Score value (0-100)
   * @returns {string} Color hex code
   */
  export const SCORE_BANDS = [
    { min: 60, label: 'Strong',  color: '#16a34a' },
    { min: 55, label: 'Healthy', color: '#22c55e' },
    { min: 45, label: 'Neutral', color: '#6b7280' },
    { min: 40, label: 'Caution', color: '#eab308' },
    { min: 0,  label: 'Weak',    color: '#dc2626' }
  ];

  export function getScoreColor(score) {
    const band = SCORE_BANDS.find(b => score >= b.min);
    return band ? band.color : '#000';
  }
  
  /**
   * Get score label based on value
   * @param {number} score - Score value (0-100)
   * @returns {string} Performance label
   */
  export function getScoreLabel(score) {
    const band = SCORE_BANDS.find(b => score >= b.min);
    return band ? band.label : '';
  }
  
  // Export all metric information for UI use
export const METRICS_CONFIG = {
  get weights() {
    return METRIC_WEIGHTS;
  },
  labels: METRIC_LABELS
};

 
