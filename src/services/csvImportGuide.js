// src/services/csvImportGuide.js
/**
 * CSV Import Guide for Recommended/Non-Recommended Fund Classification
 * Provides documentation and helpers for proper fund import
 */

export const CSV_IMPORT_GUIDE = {
  recommendedField: {
    name: 'is_recommended',
    description: 'Boolean field to classify funds as recommended (true) or non-recommended (false)',
    acceptedValues: {
      recommended: ['true', 'TRUE', 'yes', 'YES', 'y', 'Y', '1', 'recommended'],
      nonRecommended: ['false', 'FALSE', 'no', 'NO', 'n', 'N', '0', 'non-recommended', '']
    },
    examples: [
      { ticker: 'VTIAX', name: 'Vanguard Total International Stock', is_recommended: 'true' },
      { ticker: 'RERGX', name: 'T. Rowe Price Equity Income', is_recommended: 'false' },
      { ticker: 'VXUS', name: 'Vanguard Total International Stock ETF', is_recommended: 'yes' }
    ]
  },
  
  requiredFields: [
    'ticker',
    'name',
    'asset_class',
    'is_recommended'
  ],
  
  optionalPerformanceFields: [
    'ytd_return',
    'one_year_return', 
    'three_year_return',
    'five_year_return',
    'ten_year_return',
    'sharpe_ratio',
    'standard_deviation_3y',
    'standard_deviation_5y', 
    'expense_ratio',
    'alpha',
    'beta',
    'manager_tenure',
    'up_capture_ratio',
    'down_capture_ratio'
  ],

  recommendations: {
    fundClassification: {
      title: 'Fund Classification Best Practices',
      items: [
        'Use 107 recommended funds and 42 non-recommended funds for comprehensive analysis',
        'Recommended funds should represent the firm\'s top choices in each asset class',
        'Non-recommended funds provide comparison benchmarks and alternative options',
        'Update recommended status based on investment committee decisions',
        'Document reasons for recommendation changes in fund management notes'
      ]
    },
    dataQuality: {
      title: 'Data Quality Guidelines', 
      items: [
        'Ensure all ticker symbols are valid and consistent',
        'Use standard asset class names across all funds',
        'Provide performance data for at least YTD, 1-year, and 3-year periods',
        'Include expense ratios for cost analysis',
        'Verify Sharpe ratios and risk metrics are reasonable'
      ]
    },
    csvStructure: {
      title: 'CSV File Structure',
      items: [
        'Include header row with exact field names',
        'Use UTF-8 encoding for special characters',
        'Separate fund data and benchmark data into different files if needed',
        'Test with small sample before importing full dataset',
        'Backup existing data before major imports'
      ]
    }
  },

  exampleCsvContent: `ticker,name,asset_class,is_recommended,ytd_return,one_year_return,three_year_return,expense_ratio,sharpe_ratio
VTIAX,Vanguard Total International Stock Index Admiral,International Equity,true,12.5,15.2,8.9,0.11,1.15
RERGX,T. Rowe Price Equity Income,Large Cap Value,false,8.3,11.7,9.2,0.63,0.98
VXUS,Vanguard Total International Stock ETF,International Equity,true,12.8,15.5,9.1,0.08,1.18
SCHB,Schwab U.S. Broad Market ETF,Large Cap Blend,false,22.1,28.4,12.3,0.03,1.32`
};

/**
 * Validate is_recommended field value
 */
export function validateRecommendedField(value) {
  if (value === null || value === undefined) {
    return { isValid: false, error: 'is_recommended field is required' };
  }

  const strValue = String(value).toLowerCase().trim();
  const { recommended, nonRecommended } = CSV_IMPORT_GUIDE.recommendedField.acceptedValues;
  
  if (recommended.map(v => v.toLowerCase()).includes(strValue)) {
    return { isValid: true, parsedValue: true };
  }
  
  if (nonRecommended.map(v => v.toLowerCase()).includes(strValue)) {
    return { isValid: true, parsedValue: false };
  }
  
  return { 
    isValid: false, 
    error: `Invalid is_recommended value: "${value}". Use true/false, yes/no, or 1/0` 
  };
}

/**
 * Get human-readable import summary
 */
export function getImportSummary(funds) {
  const recommended = funds.filter(f => f.is_recommended).length;
  const nonRecommended = funds.length - recommended;
  
  return {
    total: funds.length,
    recommended,
    nonRecommended,
    assetClasses: [...new Set(funds.map(f => f.asset_class))].length,
    message: `Ready to import ${funds.length} funds (${recommended} recommended, ${nonRecommended} non-recommended) across ${[...new Set(funds.map(f => f.asset_class))].length} asset classes`
  };
}

export default CSV_IMPORT_GUIDE;