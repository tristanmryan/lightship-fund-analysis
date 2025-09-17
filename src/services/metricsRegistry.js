// Centralized Metric Registry for Scoring UI + Engine

// Categories: Returns | Risk | Cost | Management

export const METRICS = {
  ytd_return: {
    label: 'YTD Return',
    description: 'Year-to-date total return (%)',
    category: 'Returns',
    isHigherBetter: true
  },
  one_year_return: {
    label: '1-Year Return',
    description: 'Trailing 1-year total return (%)',
    category: 'Returns',
    isHigherBetter: true
  },
  three_year_return: {
    label: '3-Year Return',
    description: 'Trailing 3-year annualized return (%)',
    category: 'Returns',
    isHigherBetter: true
  },
  five_year_return: {
    label: '5-Year Return',
    description: 'Trailing 5-year annualized return (%)',
    category: 'Returns',
    isHigherBetter: true
  },
  ten_year_return: {
    label: '10-Year Return',
    description: 'Trailing 10-year annualized return (%)',
    category: 'Returns',
    isHigherBetter: true
  },
  sharpe_ratio: {
    label: 'Sharpe Ratio (3Y)',
    description: 'Risk-adjusted return efficiency (3y)',
    category: 'Risk',
    isHigherBetter: true
  },
  standard_deviation_3y: {
    label: 'Std Deviation (3Y)',
    description: 'Total volatility over 3 years',
    category: 'Risk',
    isHigherBetter: false
  },
  standard_deviation_5y: {
    label: 'Std Deviation (5Y)',
    description: 'Total volatility over 5 years',
    category: 'Risk',
    isHigherBetter: false
  },
  up_capture_ratio: {
    label: 'Up Capture (3Y)',
    description: 'Percent of market gains captured (3y)',
    category: 'Risk',
    isHigherBetter: true
  },
  down_capture_ratio: {
    label: 'Down Capture (3Y)',
    description: 'Percent of market losses captured (3y)',
    category: 'Risk',
    isHigherBetter: false
  },
  alpha: {
    label: 'Alpha (5Y)',
    description: 'Excess return vs benchmark (5y)',
    category: 'Risk',
    isHigherBetter: true
  },
  beta: {
    label: 'Beta',
    description: 'Market sensitivity (1.0 = market)',
    category: 'Risk',
    isHigherBetter: false
  },
  expense_ratio: {
    label: 'Expense Ratio',
    description: 'Annual fund expenses (% of assets)',
    category: 'Cost',
    isHigherBetter: false
  },
  manager_tenure: {
    label: 'Manager Tenure',
    description: 'Longest manager tenure (years)',
    category: 'Management',
    isHigherBetter: true
  }
};

// Default weights for clean scoring engine.
// Updated to match new global defaults set by user
export const DEFAULT_WEIGHTS = {
  ytd_return: 0.02,           // 2% - Year-to-date return
  one_year_return: 0.05,       // 5% - One-year return
  three_year_return: 0.10,     // 10% - Three-year return
  five_year_return: 0.15,      // 15% - Five-year return
  ten_year_return: 0.10,       // 10% - Ten-year return
  sharpe_ratio: 0.10,          // 10% - Sharpe ratio (3Y)
  standard_deviation_3y: 0.08, // 8% - Standard deviation (3Y)
  standard_deviation_5y: 0.12, // 12% - Standard deviation (5Y)
  up_capture_ratio: 0.07,      // 7% - Up capture (3Y)
  down_capture_ratio: 0.10,    // 10% - Down capture (3Y)
  alpha: 0.05,                 // 5% - Alpha (5Y)
  beta: 0.00,                  // 0% - Beta (not used in new defaults)
  expense_ratio: 0.04,         // 4% - Expense ratio
  manager_tenure: 0.02         // 2% - Manager tenure
};

export function listMetricsByCategory() {
  const groups = {};
  Object.entries(METRICS).forEach(([key, def]) => {
    const cat = def.category || 'Other';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push({ key, ...def });
  });
  return groups;
}

