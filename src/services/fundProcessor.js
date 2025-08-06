import { calculateScores, generateClassSummary } from './scoring';

/**
 * Enhanced fund data processor with validation
 */
export function processRawFunds(rawFunds, options = {}) {
  const { recommendedFunds = [], benchmarks = {} } = options;
  
  // Data validation
  const validationErrors = [];
  const validFunds = [];
  
  rawFunds.forEach((fund, index) => {
    const errors = [];
    
    // Required fields
    if (!fund.Symbol) {
      errors.push('Missing Symbol');
    }
    
    // Numeric validation
    const numericFields = ['YTD', '1 Year', '3 Year', '5 Year', '10 Year', 'Sharpe Ratio', 'Net Expense Ratio'];
    numericFields.forEach(field => {
      if (fund[field] !== null && fund[field] !== undefined && isNaN(fund[field])) {
        errors.push(`Invalid ${field}: ${fund[field]}`);
      }
    });
    
    // Range validation
    if (fund['Net Expense Ratio'] !== null && fund['Net Expense Ratio'] < 0) {
      errors.push('Expense ratio cannot be negative');
    }
    
    if (fund['Sharpe Ratio'] !== null && (fund['Sharpe Ratio'] < -5 || fund['Sharpe Ratio'] > 5)) {
      errors.push('Sharpe ratio out of reasonable range');
    }
    
    if (errors.length > 0) {
      validationErrors.push({
        row: index + 1,
        symbol: fund.Symbol || 'Unknown',
        errors
      });
    } else {
      validFunds.push(fund);
    }
  });
  
  // Log validation errors
  if (validationErrors.length > 0) {
    console.warn('Data validation errors:', validationErrors);
  }
  
  // Clean and enhance fund data
  const enhancedFunds = validFunds.map(fund => {
    const clean = (s) => s?.toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
    const cleanSymbol = clean(fund.Symbol);
    
    // Find matching recommended fund
    const recommendedFund = recommendedFunds.find(rf => 
      clean(rf.symbol) === cleanSymbol
    );
    
    // Find matching benchmark
    const benchmark = Object.entries(benchmarks).find(([className, bench]) => 
      clean(bench.ticker) === cleanSymbol
    );
    
    return {
      ...fund,
      cleanSymbol,
      displayName: recommendedFund?.name || fund['Fund Name'] || fund.Symbol,
      isRecommended: !!recommendedFund,
      isBenchmark: !!benchmark,
      assetClass: recommendedFund?.assetClass || fund['Asset Class'] || 'Unknown',
      autoTags: generateAutoTags(fund, recommendedFund, benchmark)
    };
  });
  
  // Calculate scores
  const scoredFunds = calculateScores(enhancedFunds);
  
  // Generate class summaries
  const classSummaries = generateClassSummary(scoredFunds);
  
  // Extract benchmark data
  const benchmarkData = {};
  Object.entries(benchmarks).forEach(([assetClass, { ticker, name }]) => {
    const clean = (s) => s?.toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
    const match = scoredFunds.find(f => f.cleanSymbol === clean(ticker));
    if (match) {
      benchmarkData[assetClass] = { ...match, name };
    }
  });
  
  return {
    scoredFunds,
    classSummaries,
    benchmarks: benchmarkData,
    validationErrors,
    processedCount: validFunds.length,
    totalCount: rawFunds.length
  };
}

/**
 * Generate automatic tags based on fund characteristics
 */
function generateAutoTags(fund, recommendedFund, benchmark) {
  const tags = [];
  
  // Performance tags
  if (fund['1 Year'] !== null) {
    if (fund['1 Year'] >= 20) tags.push({ name: 'High Performer', color: '#16a34a' });
    else if (fund['1 Year'] <= -10) tags.push({ name: 'Underperformer', color: '#dc2626' });
  }
  
  // Risk tags
  if (fund['Sharpe Ratio'] !== null) {
    if (fund['Sharpe Ratio'] >= 1.0) tags.push({ name: 'Low Risk', color: '#16a34a' });
    else if (fund['Sharpe Ratio'] <= 0) tags.push({ name: 'High Risk', color: '#dc2626' });
  }
  
  // Expense tags
  if (fund['Net Expense Ratio'] !== null) {
    if (fund['Net Expense Ratio'] <= 0.5) tags.push({ name: 'Low Cost', color: '#16a34a' });
    else if (fund['Net Expense Ratio'] >= 1.5) tags.push({ name: 'High Cost', color: '#dc2626' });
  }
  
  // Fund type tags
  if (recommendedFund) tags.push({ name: 'Recommended', color: '#3b82f6' });
  if (benchmark) tags.push({ name: 'Benchmark', color: '#f59e0b' });
  
  return tags;
}
