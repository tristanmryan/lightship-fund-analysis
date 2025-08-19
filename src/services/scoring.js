// src/services/scoring.js
import { getConfig, saveConfig } from './dataStore.js';
import { CONFIG_KEYS } from '../data/storage.js';
import { buildWeightsResolver } from './resolvers/scoringWeightsResolver.js';
import { calculateMean, calculateStdDev, calculateZScore, quantile, erf, erfinv } from './math.js';
import {
  isWinsorizationEnabled,
  isAdaptiveWinsorEnabled,
  getAdaptiveWinsorQuantiles,
  isTinyClassFallbackEnabled,
  getTinyClassPolicy,
  getCoverageThreshold,
  getZShrinkK,
  isRobustScalingEnabled,
  getMissingPolicy,
  SCORE_BANDS,
  getScoreColor as getScoreColorPolicy,
  getScoreLabel as getScoreLabelPolicy
} from './scoringPolicy.js';
import { METRIC_LABELS, METRIC_ORDER } from './metrics.js';

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
    managerTenure: 0.025,
    // Derived metric (optional, default 0 weight). Set via flag/profile to enable
    oneYearDeltaVsBench: 0
  };

// Mutable weights used during scoring (legacy/local storage fallback only)
let METRIC_WEIGHTS = { ...DEFAULT_WEIGHTS };
// Canonical metric keys ordered for iteration
  const METRIC_KEYS = Object.keys(DEFAULT_WEIGHTS);
// Active resolver loaded from Supabase (null means fallback to METRIC_WEIGHTS)
let CURRENT_WEIGHTS_RESOLVER = null;
  
  // Metric display names for reporting
  // import { METRIC_LABELS } from './metrics.js'; // Moved to top

  // Order of metrics for UI display
  // export { METRIC_ORDER } from './metrics.js'; // Moved to top

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
 * Load effective weights resolver from Supabase with precedence rules.
 * Falls back to defaults if DB empty/unavailable.
 */
export async function loadEffectiveWeightsResolver() {
  try {
    CURRENT_WEIGHTS_RESOLVER = await buildWeightsResolver();
    return CURRENT_WEIGHTS_RESOLVER;
  } catch (e) {
    // keep resolver null to use METRIC_WEIGHTS
    CURRENT_WEIGHTS_RESOLVER = null;
    return null;
  }
}
  
  /**
   * Calculate Z-score for a value within a distribution
   * @param {number} value - The value to calculate Z-score for
   * @param {number} mean - Mean of the distribution
   * @param {number} stdDev - Standard deviation of the distribution
   * @returns {number} Z-score
   */
  // calculateZScore moved to math
  
  /**
   * Calculate mean of an array of numbers, ignoring null/undefined
   * @param {Array<number>} values - Array of values
   * @returns {number} Mean value
   */
  // calculateMean moved to math
  
  /**
   * Calculate standard deviation of an array of numbers
   * @param {Array<number>} values - Array of values
   * @param {number} mean - Pre-calculated mean
   * @returns {number} Standard deviation
   */
  // calculateStdDev moved to math

  // Phase 2 scaffold: Winsorization (disabled by default)
  const ENABLE_WINSORIZATION = isWinsorizationEnabled();
  const ENABLE_ADAPTIVE_WINSOR = isAdaptiveWinsorEnabled();
  const WINSOR_LIMIT = 0.98; // global default clamp
  const WINSOR_LIMITS_BY_METRIC = {
    ytd: 0.99,
    oneYear: 0.99,
    threeYear: 0.985,
    fiveYear: 0.985,
    tenYear: 0.985,
    sharpeRatio3Y: 0.98,
    stdDev3Y: 0.975,
    stdDev5Y: 0.975,
    upCapture3Y: 0.98,
    downCapture3Y: 0.98,
    alpha5Y: 0.98,
    expenseRatio: 0.98,
    managerTenure: 0.99
  };

  // quantile moved to math

  function winsorizeZ(z, metric) {
    // simple clamp equivalent; full percentile-based clamp can be added later
    const p = (metric && WINSOR_LIMITS_BY_METRIC[metric]) || WINSOR_LIMIT;
    const limit = Math.sqrt(2) * erfinv(2 * p - 1) || 2.326;
    if (z > limit) return limit;
    if (z < -limit) return -limit;
    return z;
  }

  // Approximate inverse error function for winsorization clamp
  // erfinv moved to math

  // Phase 2 scaffold: Tiny-class fallback rules (disabled by default)
  const ENABLE_TINY_CLASS_FALLBACK = (process.env.REACT_APP_ENABLE_TINY_CLASS_FALLBACK || 'false') === 'true';
  const TINY_CLASS_MIN_PEERS = Number.parseInt(process.env.REACT_APP_TINY_CLASS_MIN_PEERS || '5', 10);
  const TINY_CLASS_NEUTRAL_THRESHOLD = Number.parseInt(process.env.REACT_APP_TINY_CLASS_NEUTRAL_THRESHOLD || '2', 10);
  const TINY_CLASS_SHRINK = Number.parseFloat(process.env.REACT_APP_TINY_CLASS_SHRINK || '0.25');
  
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

  // Optional robust scaling flag (per-class quantile anchors)
  const ENABLE_ROBUST_SCALING = (process.env.REACT_APP_ENABLE_ROBUST_SCALING || 'false') === 'true';
  function scaleScoreRobust(raw, anchors) {
    // anchors: { q05, median, q95 }
    const { q05, median, q95 } = anchors || {};
    if (![q05, median, q95].every(v => Number.isFinite(v))) return scaleScore(raw);
    // Map q05→40, median→50, q95→60, and linearly extend; clamp 0..100
    let y;
    if (raw <= q05) {
      const m = (40 - 0) / (q05 - (q05 - (q95 - q05))); // extend slope; coarse
      y = 40 + m * (raw - q05);
    } else if (raw >= q95) {
      const m = (100 - 60) / ((q95 + (q95 - q05)) - q95);
      y = 60 + m * (raw - q95);
    } else if (raw <= median) {
      const m = (50 - 40) / (median - q05);
      y = 40 + m * (raw - q05);
    } else {
      const m = (60 - 50) / (q95 - median);
      y = 50 + m * (raw - median);
    }
    return Math.max(0, Math.min(100, Math.round(y * 10) / 10));
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
  function extractMetrics(fundData, benchDataMap = null) {
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
    // Optional: 1Y delta vs benchmark (derived) when enabled and benchmark present
    let oneYearDeltaVsBench = null;
    const ENABLE_BENCH_DELTA = (process.env.REACT_APP_ENABLE_BENCH_DELTA || 'false') === 'true';
    try {
      if (ENABLE_BENCH_DELTA && benchDataMap && typeof benchDataMap.get === 'function') {
        const benchTicker = fundData.primary_benchmark || fundData.benchmark_ticker || null;
        const bench = benchTicker ? benchDataMap.get(String(benchTicker)) : null;
        if (bench && bench.one_year_return != null && (live.oneYear ?? csv.oneYear) != null) {
          const f1y = parseMetricValue(live.oneYear ?? csv.oneYear);
          const b1y = parseMetricValue(bench.one_year_return);
          if (f1y != null && b1y != null) oneYearDeltaVsBench = f1y - b1y;
        }
      }
    } catch {}

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
      managerTenure: parseMetricValue(live.managerTenure ?? csv.managerTenure),
      oneYearDeltaVsBench
    };
  }
  
  /**
   * Calculate distribution statistics for each metric within an asset class
   * @param {Array<Object>} funds - Funds in the same asset class
   * @returns {Object} Statistics for each metric
   */
  function calculateMetricStatistics(funds) {
    const stats = {};
    const total = (funds || []).length;
    
    METRIC_KEYS.forEach(metric => {
      const values = funds.map(fund => fund.metrics?.[metric]).filter(v => v != null);
      const mean = calculateMean(values);
      const stdDev = calculateStdDev(values, mean);
      const count = values.length;
      const coverage = total > 0 ? (count / total) : 0;
      // Adaptive winsorization anchors (empirical quantiles), only when enabled and sample reasonably large
      let qLo = null;
      let qHi = null;
      if (ENABLE_ADAPTIVE_WINSOR && count >= 20) {
        const sorted = values.slice().sort((a,b)=>a-b);
        const { qLo: ql, qHi: qh } = getAdaptiveWinsorQuantiles();
        qLo = quantile(sorted, Math.max(0, Math.min(ql, 0.49)));
        qHi = quantile(sorted, Math.min(1, Math.max(qh, 0.51)));
      }
      
      stats[metric] = {
        mean,
        stdDev,
        count,
        coverage,
        qLo,
        qHi,
        min: count > 0 ? Math.min(...values) : 0,
        max: count > 0 ? Math.max(...values) : 0
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
  function calculateFundScore(fund, statistics, resolverOverride = null) {
    const scoreBreakdown = {};
    let weightedSum = 0;
    let observedPeerCounts = [];
    const resolver = resolverOverride || CURRENT_WEIGHTS_RESOLVER;
    const COVERAGE_THRESHOLD = getCoverageThreshold();
    const Z_SHRINK_K = getZShrinkK();
    
    METRIC_KEYS.forEach((metric) => {
      const weight = resolver ? resolver.getWeightFor(fund, metric) : (METRIC_WEIGHTS[metric]);
      if (!Number.isFinite(weight) || weight === 0) return; // skip zero/invalid weights
      const value = fund.metrics?.[metric];
      const stats = statistics[metric];
      
      // Allow scoring when at least a benchmark and one fund are present
      // (two values). Previously required >2 which skipped small asset
      // classes entirely.
      if (value != null && stats && stats.stdDev > 0 && stats.count >= 2) {
        // Coverage-aware exclusion
        if (stats.coverage < COVERAGE_THRESHOLD) {
          scoreBreakdown[metric] = {
            value,
            zScore: 0,
            weight: 0,
            weightedZScore: 0,
            percentile: null,
            excludedForCoverage: true
          };
          return;
        }
        observedPeerCounts.push(stats.count);
        let zScore = calculateZScore(value, stats.mean, stats.stdDev);
        // Adaptive winsorization: clamp by empirical quantiles when available
        if (ENABLE_WINSORIZATION && ENABLE_ADAPTIVE_WINSOR && Number.isFinite(stats.mean) && Number.isFinite(stats.stdDev) && stats.qLo != null && stats.qHi != null) {
          const zLo = calculateZScore(stats.qLo, stats.mean, stats.stdDev);
          const zHi = calculateZScore(stats.qHi, stats.mean, stats.stdDev);
          if (zScore < zLo) zScore = zLo;
          if (zScore > zHi) zScore = zHi;
        }
        // Fixed winsorization clamp (apply before z-shrink)
        if (ENABLE_WINSORIZATION && !(ENABLE_ADAPTIVE_WINSOR && stats.qLo != null && stats.qHi != null)) {
          zScore = winsorizeZ(zScore, metric);
        }
        // Z-shrink for thin samples (apply after winsor).
        // Behavior:
        // - When winsorization is OFF: always apply shrink for thin samples
        // - When winsorization is ON: apply shrink only on very tiny samples (<=3) to avoid overwhelming clamps
        const shouldShrink = (!ENABLE_WINSORIZATION && Number.isFinite(Z_SHRINK_K) && Z_SHRINK_K > 1 && stats.count < Z_SHRINK_K)
          || (ENABLE_WINSORIZATION && stats.count <= 3 && Number.isFinite(Z_SHRINK_K) && Z_SHRINK_K > 1);
        if (shouldShrink) {
          const lambda = Math.max(0, Math.min(1, (stats.count - 1) / (Z_SHRINK_K - 1)));
          zScore = zScore * lambda;
        }
        const weightedZScore = zScore * weight;
        
        const sourceInfo = resolver?.getWeightSource ? resolver.getWeightSource(fund, metric) : null;
        scoreBreakdown[metric] = {
          value,
          zScore: Math.round(zScore * 1000) / 1000, // Round to 3 decimals for fidelity
          weight,
          weightedZScore: Math.round(weightedZScore * 1000) / 1000, // Round to 3 decimals
          percentile: calculatePercentile(value, stats, metric, weight),
          zShrinkFactor: (shouldShrink)
            ? Math.max(0, Math.min(1, (stats.count - 1) / (Z_SHRINK_K - 1)))
            : 1,
          weightSource: sourceInfo?.source || 'resolved',
          weightSourceKey: sourceInfo?.key || null,
          coverage: typeof stats.coverage === 'number' ? stats.coverage : null
        };
        
        weightedSum += weightedZScore;
      }
    });
    
    // Reweighting for missing metrics: adjust contributions proportionally
    const present = Object.keys(scoreBreakdown);
    let reweightedSum = 0;
    if (present.length > 0) {
      const totalAbs = present.reduce((s, m) => s + Math.abs(scoreBreakdown[m]?.weight || 0), 0);
      present.forEach((m) => {
        const w = scoreBreakdown[m]?.weight || 0;
        const z = scoreBreakdown[m].zScore;
        const proportional = (Math.abs(w) / totalAbs) * Math.sign(w);
        const contrib = z * proportional;
        scoreBreakdown[m].reweightedContribution = Math.round(contrib * 1000) / 1000;
        reweightedSum += contrib;
      });
    }

    // Future policy: small penalty per missing metric
    if (SCORING_MISSING_POLICY === 'penalty' && MISSING_METRIC_PENALTY > 0) {
      const missingCount = Object.keys(METRIC_WEIGHTS).length - present.length;
      reweightedSum -= (MISSING_METRIC_PENALTY * missingCount);
    }

    return {
      raw: weightedSum,
      rawReweighted: Math.round(reweightedSum * 1000) / 1000,
      breakdown: scoreBreakdown,
      metricsUsed: Object.keys(scoreBreakdown).length,
      totalPossibleMetrics: METRIC_KEYS.length,
      peerCountMin: observedPeerCounts.length ? Math.min(...observedPeerCounts) : 0
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
  // erf moved to math
  
  /**
   * Main scoring function - calculates scores for all funds
   * @param {Array<Object>} funds - All funds with asset class assignments
   * @returns {Array<Object>} Funds with calculated scores
   */
  export function calculateScores(funds, resolverOverride = null) {
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
      
      // Build quick map of benchmarks for derived metrics
      const ENABLE_BENCH_DELTA = (process.env.REACT_APP_ENABLE_BENCH_DELTA || 'false') === 'true';
      const benchByTicker = new Map();
      if (ENABLE_BENCH_DELTA) {
        classFunds.forEach(f => { if (f && f.isBenchmark) benchByTicker.set(String(f.ticker || f.Symbol || ''), f); });
      }
      // Extract and standardize metrics for all funds (with optional bench deltas)
      const fundsWithMetrics = classFunds.map(fund => ({
        ...fund,
        metrics: extractMetrics(fund, ENABLE_BENCH_DELTA ? benchByTicker : null)
      }));
      
      // Calculate statistics for the asset class using peer funds only
      const peerFunds = fundsWithMetrics.filter(f => !f.isBenchmark);
      const statistics = calculateMetricStatistics(peerFunds);
      
      // Calculate raw scores for all funds
      const fundsWithRawScores = fundsWithMetrics.map(fund => {
        const scoreData = calculateFundScore(fund, statistics, resolverOverride);
        return {
          ...fund,
          scoreData
        };
      });
      
      // Get all raw scores for scaling (use reweighted if available)
      const rawScores = fundsWithRawScores.map(f => (Number.isFinite(f.scoreData.rawReweighted) ? f.scoreData.rawReweighted : f.scoreData.raw));
      let anchors = null;
      if (ENABLE_ROBUST_SCALING && rawScores.length >= 10) {
        const sorted = rawScores.slice().sort((a,b)=>a-b);
        const q05 = quantile(sorted, 0.05);
        const median = quantile(sorted, 0.5);
        const q95 = quantile(sorted, 0.95);
        anchors = { q05, median, q95 };
      }

      // Scale scores to 0-100 and calculate final percentiles
      fundsWithRawScores.forEach((fund, index) => {
        let base = Number.isFinite(fund.scoreData.rawReweighted) ? fund.scoreData.rawReweighted : fund.scoreData.raw;
        // Tiny-class fallback: shrink extreme values and bias toward neutral when peer samples are thin
        if (ENABLE_TINY_CLASS_FALLBACK) {
          const minPeers = fund.scoreData.peerCountMin || 0;
          if (minPeers > 0 && minPeers < TINY_CLASS_MIN_PEERS) {
            if (minPeers <= TINY_CLASS_NEUTRAL_THRESHOLD) {
              base = 0; // neutral contribution when peers are extremely few
            } else {
              base = base * TINY_CLASS_SHRINK; // shrink raw effect
            }
          }
        }
        const finalScore = anchors ? scaleScoreRobust(base, anchors) : scaleScore(base);
        
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
export { SCORE_BANDS } from './scoringPolicy.js';
export function getScoreColor(score) { return getScoreColorPolicy(score); }
export function getScoreLabel(score) { return getScoreLabelPolicy(score); }
  
  // Export all metric information for UI use
export const METRICS_CONFIG = {
  get weights() {
    return METRIC_WEIGHTS;
  },
  labels: METRIC_LABELS
};

// Missing data policy scaffold
export const SCORING_MISSING_POLICY = (process.env.REACT_APP_MISSING_POLICY || 'reweight'); // legacy export
export const MISSING_METRIC_PENALTY = Number.parseFloat(process.env.REACT_APP_MISSING_PENALTY || '0'); // legacy export

 
