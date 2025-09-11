/**
 * Clean Scoring Engine for Lightship Fund Analysis
 * 
 * This is a simplified, real-time capable scoring service that replaces
 * the complex existing scoring system with pure calculation functions.
 * 
 * Key features:
 * - Pure functions, no side effects
 * - Real-time synchronous calculations
 * - Asset class grouping
 * - Standard z-score normalization
 * - Weighted sum calculation
 * - Score breakdown for tooltips
 */

// Default metric weights (based on user requirements)
export const DEFAULT_WEIGHTS = {
  ytd_return: 0.15,
  one_year_return: 0.25,
  three_year_return: 0.20,
  sharpe_ratio: 0.15,
  expense_ratio: 0.10, // Negative weight - lower is better
  alpha: 0.10,
  beta: 0.05
};

// Metrics configuration
const METRICS = {
  ytd_return: { isHigherBetter: true },
  one_year_return: { isHigherBetter: true },
  three_year_return: { isHigherBetter: true },
  sharpe_ratio: { isHigherBetter: true },
  expense_ratio: { isHigherBetter: false }, // Lower is better
  alpha: { isHigherBetter: true },
  beta: { isHigherBetter: false }, // Generally prefer lower beta
  up_capture_ratio: { isHigherBetter: true },
  down_capture_ratio: { isHigherBetter: false } // Lower down capture is better
};

// Score interpretation bands
const SCORE_BANDS = [
  { min: 60, color: '#10B981', label: 'Strong' },
  { min: 55, color: '#34D399', label: 'Healthy' },
  { min: 45, color: '#FCD34D', label: 'Neutral' },
  { min: 40, color: '#F97316', label: 'Caution' },
  { min: 0, color: '#EF4444', label: 'Weak' }
];

/**
 * Calculate mean of an array of numbers, ignoring null/undefined values
 * @param {number[]} values - Array of numeric values
 * @returns {number} Mean value
 */
function calculateMean(values) {
  const validValues = values.filter(v => v !== null && v !== undefined && !isNaN(v));
  if (validValues.length === 0) return 0;
  return validValues.reduce((sum, val) => sum + val, 0) / validValues.length;
}

/**
 * Calculate standard deviation of an array of numbers
 * @param {number[]} values - Array of numeric values
 * @param {number} mean - Pre-calculated mean (optional)
 * @returns {number} Standard deviation
 */
function calculateStdDev(values, mean = null) {
  const validValues = values.filter(v => v !== null && v !== undefined && !isNaN(v));
  if (validValues.length <= 1) return 0;
  
  const avg = mean !== null ? mean : calculateMean(validValues);
  const squaredDiffs = validValues.map(val => Math.pow(val - avg, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / (validValues.length - 1);
  
  return Math.sqrt(variance);
}

/**
 * Calculate z-score for a value given mean and standard deviation
 * @param {number} value - The value to score
 * @param {number} mean - Mean of the distribution
 * @param {number} stdDev - Standard deviation of the distribution
 * @param {boolean} isHigherBetter - Whether higher values are better
 * @returns {number} Z-score
 */
function calculateZScore(value, mean, stdDev, isHigherBetter = true) {
  if (stdDev === 0 || value === null || value === undefined || isNaN(value)) {
    return 0;
  }
  
  const rawZScore = (value - mean) / stdDev;
  return isHigherBetter ? rawZScore : -rawZScore;
}

/**
 * Calculate statistics (mean, stdDev) for each metric within an asset class
 * @param {Object[]} funds - Array of funds in the same asset class
 * @param {string[]} metrics - Array of metric names to calculate stats for
 * @returns {Object} Statistics object with mean and stdDev for each metric
 */
function calculateAssetClassStatistics(funds, metrics) {
  const statistics = {};
  
  metrics.forEach(metric => {
    const values = funds.map(fund => fund[metric]);
    const mean = calculateMean(values);
    const stdDev = calculateStdDev(values, mean);
    
    statistics[metric] = {
      mean,
      stdDev,
      count: values.filter(v => v !== null && v !== undefined && !isNaN(v)).length
    };
  });
  
  return statistics;
}

/**
 * Get the asset class name for a fund, handling various field formats
 * @param {Object} fund - Fund object
 * @returns {string} Asset class name
 */
function getAssetClassName(fund) {
  return fund.asset_class_name || fund.asset_class || fund['Asset Class'] || 'Unknown';
}

/**
 * Main scoring function - calculates scores for all funds
 * @param {Object[]} funds - Array of fund objects with metrics
 * @param {Object} weightsByAssetClass - Optional per-asset-class weights override
 * @returns {Object[]} Array of funds with calculated scores and breakdown
 */
export function calculateScores(funds, weightsByAssetClass = {}) {
  if (!funds || funds.length === 0) {
    return [];
  }

  // Group funds by asset class
  const fundsByAssetClass = {};
  funds.forEach(fund => {
    const assetClass = getAssetClassName(fund);
    if (!fundsByAssetClass[assetClass]) {
      fundsByAssetClass[assetClass] = [];
    }
    fundsByAssetClass[assetClass].push(fund);
  });

  // Calculate scores within each asset class
  const scoredFunds = [];

  Object.entries(fundsByAssetClass).forEach(([assetClass, classFunds]) => {
    // Get weights for this asset class (use default if not specified)
    const weights = weightsByAssetClass[assetClass] || DEFAULT_WEIGHTS;
    const metrics = Object.keys(weights).filter(metric => weights[metric] !== 0);
    
    // Calculate statistics for this asset class
    const statistics = calculateAssetClassStatistics(classFunds, metrics);
    
    // Score each fund in this asset class
    classFunds.forEach(fund => {
      const scoreData = calculateFundScore(fund, statistics, weights);
      scoredFunds.push({
        ...fund,
        score_final: scoreData.score,
        score_breakdown: scoreData.breakdown,
        asset_class_stats: {
          assetClass,
          totalFundsInClass: classFunds.length,
          metricsWithData: Object.keys(statistics).filter(m => statistics[m].count > 0).length
        }
      });
    });
  });

  return scoredFunds;
}

/**
 * Calculate score for a single fund within its asset class
 * @param {Object} fund - Fund object with metrics
 * @param {Object} statistics - Pre-calculated statistics for the asset class
 * @param {Object} weights - Metric weights to apply
 * @returns {Object} Score data with final score and breakdown
 */
function calculateFundScore(fund, statistics, weights) {
  const breakdown = {};
  let weightedZScoreSum = 0;
  let totalWeight = 0;

  // Calculate weighted z-scores for each metric
  Object.entries(weights).forEach(([metric, weight]) => {
    if (weight === 0) return;
    
    const value = fund[metric];
    const stats = statistics[metric];
    
    if (value !== null && value !== undefined && !isNaN(value) && stats && stats.count > 1) {
      const metricConfig = METRICS[metric] || { isHigherBetter: true };
      const zScore = calculateZScore(value, stats.mean, stats.stdDev, metricConfig.isHigherBetter);
      const weightedZScore = zScore * Math.abs(weight);
      
      breakdown[metric] = {
        value: value,
        zScore: Math.round(zScore * 1000) / 1000, // Round to 3 decimals
        weight: weight,
        weightedScore: Math.round(weightedZScore * 1000) / 1000,
        mean: stats.mean,
        stdDev: stats.stdDev
      };
      
      weightedZScoreSum += weightedZScore;
      totalWeight += Math.abs(weight);
    }
  });

  // Transform to 0-100 scale: 50 + (weightedZScore * 10), clamped to [0, 100]
  const rawScore = totalWeight > 0 ? weightedZScoreSum : 0;
  const transformedScore = Math.max(0, Math.min(100, 50 + (rawScore * 10)));
  
  return {
    score: Math.round(transformedScore * 10) / 10, // Round to 1 decimal
    breakdown: breakdown,
    rawWeightedSum: rawScore,
    metricsUsed: Object.keys(breakdown).length
  };
}

/**
 * Real-time calculation for admin interface (same as main function but optimized for speed)
 * @param {Object[]} funds - Array of fund objects
 * @param {Object} weights - Metric weights to apply globally
 * @returns {Object[]} Funds with calculated scores
 */
export function calculateAssetClassScores(funds, weights) {
  if (!funds || funds.length === 0) return [];

  // Get unique asset class names from the funds
  const assetClassNames = [...new Set(
    funds.map(fund => getAssetClassName(fund))
  )];
  
  // Create weightsByAssetClass object with the same weights for each asset class
  const weightsByAssetClass = {};
  assetClassNames.forEach(assetClass => {
    weightsByAssetClass[assetClass] = weights;
  });
  
  return calculateScores(funds, weightsByAssetClass);
}

/**
 * Get detailed score breakdown for a single fund (for tooltips)
 * @param {Object} fund - Fund object
 * @param {Object[]} assetClassFunds - All funds in the same asset class
 * @param {Object} weights - Metric weights to apply
 * @returns {Object} Detailed breakdown of score components
 */
export function getScoreBreakdown(fund, assetClassFunds, weights = DEFAULT_WEIGHTS) {
  const metrics = Object.keys(weights).filter(metric => weights[metric] !== 0);
  const statistics = calculateAssetClassStatistics(assetClassFunds, metrics);
  const scoreData = calculateFundScore(fund, statistics, weights);
  
  return {
    finalScore: scoreData.score,
    rawWeightedSum: scoreData.rawWeightedSum,
    metricsBreakdown: scoreData.breakdown,
    assetClassContext: {
      name: getAssetClassName(fund),
      totalFunds: assetClassFunds.length,
      metricsWithData: Object.keys(statistics).filter(m => statistics[m].count > 0)
    }
  };
}

/**
 * Get score color based on score value
 * @param {number} score - Score value (0-100)
 * @returns {string} Hex color code
 */
export function getScoreColor(score) {
  if (score === null || score === undefined || isNaN(score)) {
    return '#9CA3AF'; // Gray for missing scores
  }
  
  const band = SCORE_BANDS.find(b => score >= b.min);
  return band ? band.color : '#EF4444'; // Default to red if somehow below all bands
}

/**
 * Get score label based on score value
 * @param {number} score - Score value (0-100)
 * @returns {string} Human-readable score label
 */
export function getScoreLabel(score) {
  if (score === null || score === undefined || isNaN(score)) {
    return 'N/A';
  }
  
  const band = SCORE_BANDS.find(b => score >= b.min);
  return band ? band.label : 'Weak';
}

/**
 * Utility function to get available metrics from a dataset
 * @param {Object[]} funds - Array of fund objects
 * @returns {string[]} Array of metric names that have data
 */
export function getAvailableMetrics(funds) {
  if (!funds || funds.length === 0) return [];
  
  const allMetrics = Object.keys(METRICS);
  const availableMetrics = [];
  
  allMetrics.forEach(metric => {
    const hasData = funds.some(fund => 
      fund[metric] !== null && fund[metric] !== undefined && !isNaN(fund[metric])
    );
    if (hasData) {
      availableMetrics.push(metric);
    }
  });
  
  return availableMetrics;
}