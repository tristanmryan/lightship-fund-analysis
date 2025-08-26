// src/services/advancedScoring.js
import { calculateMean, calculateStdDev, calculateZScore } from './math.js';

/**
 * Advanced Scoring Engine with Sophisticated Algorithms
 * Extends the base scoring system with enhanced weighting and confidence calculations
 */

/**
 * Sophisticated Weighting Algorithms
 */

// Time-decayed weights (more recent performance weighted higher)
export const TIME_DECAY_WEIGHTS = {
  ytd: 0.040,      // Recent performance gets higher weight
  oneYear: 0.075,  // Increased from 0.05
  threeYear: 0.125, // Increased from 0.10
  fiveYear: 0.125,  // Reduced from 0.15 (less emphasis on very long term)
  tenYear: 0.075,   // Reduced from 0.10
  sharpeRatio3Y: 0.125, // Increased emphasis on risk-adjusted returns
  stdDev3Y: -0.100,     // More penalty for volatility
  stdDev5Y: -0.100,     // Balanced volatility penalty
  upCapture3Y: 0.100,   // Increased reward for up-market capture
  downCapture3Y: -0.125, // Increased penalty for down-market exposure
  alpha5Y: 0.075,       // Increased alpha weight
  expenseRatio: -0.050,  // Doubled penalty for high fees
  managerTenure: 0.050   // Increased stability reward
};

// Risk-adjusted weights (emphasize risk metrics)
export const RISK_FOCUSED_WEIGHTS = {
  ytd: 0.020,
  oneYear: 0.040,
  threeYear: 0.080,
  fiveYear: 0.120,
  tenYear: 0.080,
  sharpeRatio3Y: 0.200,  // Heavy emphasis on Sharpe ratio
  stdDev3Y: -0.150,      // Strong volatility penalty
  stdDev5Y: -0.150,      // Strong volatility penalty
  upCapture3Y: 0.100,
  downCapture3Y: -0.150, // Heavy penalty for downside capture
  alpha5Y: 0.100,        // Strong alpha emphasis
  expenseRatio: -0.030,
  managerTenure: 0.040
};

// Performance-focused weights (emphasize returns over risk)
export const PERFORMANCE_FOCUSED_WEIGHTS = {
  ytd: 0.050,
  oneYear: 0.100,
  threeYear: 0.150,
  fiveYear: 0.200,    // Heavy emphasis on long-term returns
  tenYear: 0.150,
  sharpeRatio3Y: 0.075,
  stdDev3Y: -0.050,   // Reduced volatility penalty
  stdDev5Y: -0.075,   // Reduced volatility penalty
  upCapture3Y: 0.125, // Strong upside capture reward
  downCapture3Y: -0.075, // Moderate downside penalty
  alpha5Y: 0.100,
  expenseRatio: -0.025,
  managerTenure: 0.025
};

/**
 * Asset Class-Specific Scoring Adjustments
 */
export const ASSET_CLASS_ADJUSTMENTS = {
  'Fixed Income': {
    weights: {
      sharpeRatio3Y: 0.150,    // More important for bonds
      stdDev3Y: -0.125,        // Volatility very important for bonds
      stdDev5Y: -0.125,
      expenseRatio: -0.075,    // Fees very important for bonds
      upCapture3Y: 0.050,      // Less important for bonds
      downCapture3Y: -0.150    // Very important - capital preservation
    },
    benchmarkAdjustment: 0.95  // Slightly lower expectations
  },
  'Large Cap Growth': {
    weights: {
      threeYear: 0.125,
      fiveYear: 0.175,         // Emphasize longer-term growth
      tenYear: 0.125,
      sharpeRatio3Y: 0.100,
      upCapture3Y: 0.125,      // Important for growth funds
      downCapture3Y: -0.075,   // Growth funds expected to be more volatile
      alpha5Y: 0.100           // Alpha very important for growth
    },
    benchmarkAdjustment: 1.05  // Higher expectations for growth
  },
  'Large Cap Value': {
    weights: {
      fiveYear: 0.175,         // Value plays out over time
      tenYear: 0.125,
      sharpeRatio3Y: 0.125,    // Risk-adjusted returns important
      stdDev3Y: -0.100,        // Moderate volatility penalty
      downCapture3Y: -0.125,   // Should protect in downturns
      expenseRatio: -0.050,    // Fees important for value
      managerTenure: 0.075     // Experience valued in value investing
    },
    benchmarkAdjustment: 1.00
  },
  'Small Cap': {
    weights: {
      oneYear: 0.075,
      threeYear: 0.125,
      fiveYear: 0.150,
      stdDev3Y: -0.050,        // Accept higher volatility
      stdDev5Y: -0.075,
      upCapture3Y: 0.125,      // Should capture upside
      alpha5Y: 0.125,          // Alpha very important for small cap
      managerTenure: 0.050     // Experience important
    },
    benchmarkAdjustment: 1.00
  },
  'International': {
    weights: {
      threeYear: 0.125,
      fiveYear: 0.150,
      tenYear: 0.100,
      sharpeRatio3Y: 0.125,
      stdDev3Y: -0.075,        // Accept some currency volatility
      alpha5Y: 0.100,          // Manager skill important internationally
      expenseRatio: -0.040,    // Fees somewhat important
      managerTenure: 0.075     // Experience with international markets
    },
    benchmarkAdjustment: 0.98  // Slightly lower expectations
  },
  'Emerging Markets': {
    weights: {
      threeYear: 0.100,
      fiveYear: 0.150,
      tenYear: 0.100,
      sharpeRatio3Y: 0.150,    // Very important given volatility
      stdDev3Y: -0.025,        // Accept high volatility
      stdDev5Y: -0.050,
      upCapture3Y: 0.150,      // Should capture emerging market upside
      alpha5Y: 0.125,          // Manager skill crucial
      managerTenure: 0.075     // Experience with EM important
    },
    benchmarkAdjustment: 0.95  // Lower expectations due to volatility
  },
  'Real Estate': {
    weights: {
      fiveYear: 0.175,         // Real estate is long-term
      tenYear: 0.125,
      sharpeRatio3Y: 0.125,
      stdDev3Y: -0.075,
      downCapture3Y: -0.100,   // Should provide diversification
      expenseRatio: -0.050,
      managerTenure: 0.050
    },
    benchmarkAdjustment: 1.00
  }
};

/**
 * Calculate Scoring Confidence Indicators
 */
export function calculateScoringConfidence(fund, assetClassPeers = []) {
  const confidenceFactors = {
    dataCompleteness: 0,
    dataRecency: 0,
    peerGroupSize: 0,
    historicalConsistency: 0
  };

  // Data Completeness (0-100)
  const requiredMetrics = [
    'ytd_return', 'one_year_return', 'three_year_return', 
    'five_year_return', 'three_year_sharpe', 'expense_ratio'
  ];
  
  const availableMetrics = requiredMetrics.filter(metric => 
    fund[metric] != null && !isNaN(fund[metric])
  ).length;
  
  confidenceFactors.dataCompleteness = (availableMetrics / requiredMetrics.length) * 100;

  // Data Recency (0-100) - based on last update
  const lastUpdate = fund.last_updated || fund.created_at;
  if (lastUpdate) {
    const daysSinceUpdate = (Date.now() - new Date(lastUpdate)) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate <= 30) {
      confidenceFactors.dataRecency = 100;
    } else if (daysSinceUpdate <= 90) {
      confidenceFactors.dataRecency = 80;
    } else if (daysSinceUpdate <= 180) {
      confidenceFactors.dataRecency = 60;
    } else {
      confidenceFactors.dataRecency = 40;
    }
  } else {
    confidenceFactors.dataRecency = 50; // Unknown, assume moderate
  }

  // Peer Group Size (0-100)
  const peerCount = assetClassPeers.length;
  if (peerCount >= 20) {
    confidenceFactors.peerGroupSize = 100;
  } else if (peerCount >= 10) {
    confidenceFactors.peerGroupSize = 80;
  } else if (peerCount >= 5) {
    confidenceFactors.peerGroupSize = 60;
  } else {
    confidenceFactors.peerGroupSize = 30;
  }

  // Historical Consistency (0-100) - based on performance volatility
  if (fund.three_year_std_dev != null && fund.five_year_std_dev != null) {
    const avgStdDev = (fund.three_year_std_dev + fund.five_year_std_dev) / 2;
    if (avgStdDev <= 10) {
      confidenceFactors.historicalConsistency = 100;
    } else if (avgStdDev <= 15) {
      confidenceFactors.historicalConsistency = 80;
    } else if (avgStdDev <= 20) {
      confidenceFactors.historicalConsistency = 60;
    } else {
      confidenceFactors.historicalConsistency = 40;
    }
  } else {
    confidenceFactors.historicalConsistency = 50;
  }

  // Calculate overall confidence (weighted average)
  const overallConfidence = (
    confidenceFactors.dataCompleteness * 0.35 +
    confidenceFactors.dataRecency * 0.25 +
    confidenceFactors.peerGroupSize * 0.25 +
    confidenceFactors.historicalConsistency * 0.15
  );

  return {
    overall: Math.round(overallConfidence),
    factors: confidenceFactors,
    level: overallConfidence >= 80 ? 'High' : 
           overallConfidence >= 60 ? 'Medium' : 'Low'
  };
}

/**
 * Enhanced Scoring Algorithm Selection
 */
export function selectOptimalWeighting(fund, assetClass, userPreferences = {}) {
  // Default to time-decayed weights
  let baseWeights = { ...TIME_DECAY_WEIGHTS };
  
  // Apply user preferences
  if (userPreferences.focusArea === 'risk') {
    baseWeights = { ...RISK_FOCUSED_WEIGHTS };
  } else if (userPreferences.focusArea === 'performance') {
    baseWeights = { ...PERFORMANCE_FOCUSED_WEIGHTS };
  }

  // Apply asset class adjustments
  const assetClassKey = normalizeAssetClassName(assetClass);
  if (ASSET_CLASS_ADJUSTMENTS[assetClassKey]) {
    const adjustments = ASSET_CLASS_ADJUSTMENTS[assetClassKey];
    
    // Merge weights
    Object.keys(adjustments.weights).forEach(metric => {
      if (baseWeights[metric] !== undefined) {
        baseWeights[metric] = adjustments.weights[metric];
      }
    });
  }

  return baseWeights;
}

/**
 * Normalize asset class names for consistency
 */
function normalizeAssetClassName(assetClass) {
  if (!assetClass) return 'Other';
  
  const normalized = assetClass.toLowerCase();
  
  // Map common variations to standard names
  if (normalized.includes('large') && normalized.includes('growth')) {
    return 'Large Cap Growth';
  } else if (normalized.includes('large') && normalized.includes('value')) {
    return 'Large Cap Value';
  } else if (normalized.includes('small')) {
    return 'Small Cap';
  } else if (normalized.includes('international') || normalized.includes('foreign')) {
    return 'International';
  } else if (normalized.includes('emerging')) {
    return 'Emerging Markets';
  } else if (normalized.includes('real estate') || normalized.includes('reit')) {
    return 'Real Estate';
  } else if (normalized.includes('bond') || normalized.includes('fixed')) {
    return 'Fixed Income';
  }
  
  return assetClass; // Return original if no match
}

/**
 * Calculate Dynamic Score Adjustments
 */
export function calculateDynamicAdjustments(fund, assetClassPeers, marketConditions = {}) {
  let adjustments = {
    marketCycleAdjustment: 0,
    volatilityRegimeAdjustment: 0,
    sizeAdjustment: 0
  };

  // Market Cycle Adjustment
  if (marketConditions.marketTrend) {
    if (marketConditions.marketTrend === 'bull' && fund.up_capture_ratio > 1.1) {
      adjustments.marketCycleAdjustment = 2; // Bonus for high up capture in bull market
    } else if (marketConditions.marketTrend === 'bear' && fund.down_capture_ratio < 0.9) {
      adjustments.marketCycleAdjustment = 3; // Bonus for downside protection in bear market
    }
  }

  // Volatility Regime Adjustment
  if (marketConditions.volatilityRegime === 'high' && fund.three_year_std_dev < 15) {
    adjustments.volatilityRegimeAdjustment = 1; // Bonus for low volatility in high-vol periods
  }

  // Size-based Adjustment (for smaller funds that may be more nimble)
  const avgAssets = calculateMean(assetClassPeers.map(p => p.net_assets).filter(a => a != null));
  if (fund.net_assets && fund.net_assets < avgAssets * 0.5) {
    adjustments.sizeAdjustment = 0.5; // Small bonus for smaller, potentially more nimble funds
  }

  return adjustments;
}

/**
 * Enhanced Score Calculation with All Advanced Features
 */
export function calculateAdvancedScore(fund, assetClassPeers, userPreferences = {}, marketConditions = {}) {
  // Get optimal weighting
  const weights = selectOptimalWeighting(fund, fund.asset_class, userPreferences);
  
  // Calculate base score (simplified version of main scoring logic)
  const baseScore = calculateBaseScore(fund, assetClassPeers, weights);
  
  // Calculate confidence
  const confidence = calculateScoringConfidence(fund, assetClassPeers);
  
  // Apply dynamic adjustments
  const dynamicAdjustments = calculateDynamicAdjustments(fund, assetClassPeers, marketConditions);
  
  // Apply adjustments
  let adjustedScore = baseScore;
  Object.values(dynamicAdjustments).forEach(adj => {
    adjustedScore += adj;
  });
  
  // Apply asset class benchmark adjustment
  const assetClassKey = normalizeAssetClassName(fund.asset_class);
  if (ASSET_CLASS_ADJUSTMENTS[assetClassKey]) {
    adjustedScore *= ASSET_CLASS_ADJUSTMENTS[assetClassKey].benchmarkAdjustment;
  }
  
  // Ensure score stays within bounds
  adjustedScore = Math.max(0, Math.min(100, adjustedScore));
  
  return {
    score: Math.round(adjustedScore * 10) / 10,
    confidence,
    components: {
      baseScore,
      adjustments: dynamicAdjustments,
      weightsUsed: weights
    }
  };
}

/**
 * Simplified base score calculation for advanced scoring
 */
function calculateBaseScore(fund, peers, weights) {
  // This is a simplified version - in practice would use the full scoring algorithm
  // For now, return the existing score or calculate a basic weighted score
  if (fund.score != null) {
    return fund.score;
  }
  
  // Basic weighted score calculation
  let weightedSum = 0;
  let totalWeight = 0;
  
  const metrics = {
    ytd: fund.ytd_return,
    oneYear: fund.one_year_return,
    threeYear: fund.three_year_return,
    fiveYear: fund.five_year_return,
    tenYear: fund.ten_year_return,
    sharpeRatio3Y: fund.three_year_sharpe,
    stdDev3Y: fund.three_year_std_dev,
    stdDev5Y: fund.five_year_std_dev,
    upCapture3Y: fund.up_capture_ratio,
    downCapture3Y: fund.down_capture_ratio,
    alpha5Y: fund.five_year_alpha,
    expenseRatio: fund.expense_ratio,
    managerTenure: fund.manager_tenure
  };
  
  Object.entries(metrics).forEach(([key, value]) => {
    if (value != null && weights[key] != null) {
      // Simple normalization (would be replaced with proper Z-score calculation)
      const normalizedValue = Math.max(-3, Math.min(3, value / 10));
      weightedSum += normalizedValue * weights[key];
      totalWeight += Math.abs(weights[key]);
    }
  });
  
  if (totalWeight === 0) return 50; // Default score if no metrics
  
  // Scale to 0-100 range
  const rawScore = (weightedSum / totalWeight) * 10 + 50;
  return Math.max(0, Math.min(100, rawScore));
}

export default {
  calculateAdvancedScore,
  calculateScoringConfidence,
  selectOptimalWeighting,
  TIME_DECAY_WEIGHTS,
  RISK_FOCUSED_WEIGHTS,
  PERFORMANCE_FOCUSED_WEIGHTS,
  ASSET_CLASS_ADJUSTMENTS
};