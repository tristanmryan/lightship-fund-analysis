/**
 * Upload Validation Utility
 * Provides comprehensive validation for CSV uploads including EOM validation,
 * required column checks, and data type validation for fund and benchmark performance data.
 */

import Papa from 'papaparse';
import { dbUtils } from '../services/supabase';

// Constants for validation
const FUND_REQUIRED_COLUMNS = ['fund_ticker', 'date'];
const BENCHMARK_REQUIRED_COLUMNS = ['benchmark_ticker', 'date'];

const FUND_OPTIONAL_COLUMNS = [
  'ytd_return', 'one_year_return', 'three_year_return', 'five_year_return', 'ten_year_return',
  'sharpe_ratio', 'standard_deviation_3y', 'standard_deviation_5y', 'expense_ratio',
  'alpha', 'beta', 'manager_tenure', 'up_capture_ratio', 'down_capture_ratio'
];

const BENCHMARK_OPTIONAL_COLUMNS = [
  'ytd_return', 'one_year_return', 'three_year_return', 'five_year_return', 'ten_year_return',
  'sharpe_ratio', 'standard_deviation_3y', 'standard_deviation_5y', 'expense_ratio',
  'alpha', 'beta', 'up_capture_ratio', 'down_capture_ratio'
];

const NUMERIC_COLUMNS = [
  'ytd_return', 'one_year_return', 'three_year_return', 'five_year_return', 'ten_year_return',
  'sharpe_ratio', 'standard_deviation_3y', 'standard_deviation_5y', 'expense_ratio',
  'alpha', 'beta', 'manager_tenure', 'up_capture_ratio', 'down_capture_ratio'
  // Note: asset_class is NOT numeric
];

// Comprehensive column mapping for common CSV variations
const COLUMN_MAPPING = {
  // Ticker columns
  ticker: [
    'fund_ticker', 'benchmark_ticker', 'ticker', 'symbol', 'symbol/cusip', 'fund ticker', 
    'benchmark ticker', 'cusip', 'fund_symbol', 'benchmark_symbol'
  ],
  
  // Date columns - make more specific to avoid false positives
  date: [
    'date', 'asofmonth', 'as_of_month', 'as of month', 'asof_month', 'asof month',
    'report_date', 'data_date'
    // Removed 'month', 'year', 'period' as they can cause false positives with performance metrics
  ],
  
  // Return columns
  ytd_return: [
    'ytd_return', 'ytd', 'ytd return', 'total return - ytd (%)', 'total return ytd',
    'ytd return (%)', 'year to date', 'ytd return', 'ytd_return_pct'
  ],
  
  one_year_return: [
    'one_year_return', '1y', '1 year', '1 year return', 'total return - 1 year (%)',
    'annualized total return - 1 year (%)', '1yr return', 'one year return (%)'
  ],
  
  three_year_return: [
    'three_year_return', '3y', '3 year', '3 year return', 'total return - 3 year (%)',
    'annualized total return - 3 year (%)', '3yr return', 'three year return (%)'
  ],
  
  five_year_return: [
    'five_year_return', '5y', '5 year', '5 year return', 'total return - 5 year (%)',
    'annualized total return - 5 year (%)', '5yr return', 'five year return (%)'
  ],
  
  ten_year_return: [
    'ten_year_return', '10y', '10 year', '10 year return', 'total return - 10 year (%)',
    'annualized total return - 10 year (%)', '10yr return', 'ten year return (%)'
  ],
  
  // Risk metrics
  sharpe_ratio: [
    'sharpe_ratio', 'sharpe', 'sharpe ratio', 'sharpe ratio - 3 year', 'sharpe ratio 3y',
    'sharpe ratio (3 year)', 'sharpe_3y', 'sharpe_ratio_3y'
  ],
  
  standard_deviation_3y: [
    'standard_deviation_3y', 'std_dev_3y', 'standard deviation - 3 year', 'standard deviation 3y',
    'std dev 3y', 'volatility 3y', 'standard deviation (3 year)', 'std_deviation_3y'
  ],
  
  standard_deviation_5y: [
    'standard_deviation_5y', 'std_dev_5y', 'standard deviation - 5 year', 'standard deviation 5y',
    'std dev 5y', 'volatility 5y', 'standard deviation (5 year)', 'std_deviation_5y'
  ],
  
  // Other metrics
  expense_ratio: [
    'expense_ratio', 'expense ratio', 'net exp ratio (%)', 'net expense ratio',
    'expense_ratio_pct', 'expense ratio (%)', 'net expense ratio (%)', 'exp_ratio'
  ],
  
  alpha: [
    'alpha', 'alpha (asset class) - 5 year', 'alpha 5y', 'alpha_5y', 'alpha (5 year)',
    'alpha asset class 5y', 'alpha_asset_class_5y'
  ],
  
  beta: [
    'beta', 'beta 3y', 'beta_3y', 'beta (3 year)', 'beta_3_year', 'beta 3 year'
  ],
  
  manager_tenure: [
    'manager_tenure', 'manager tenure', 'longest manager tenure (years)', 'manager tenure (years)',
    'manager_tenure_years', 'tenure', 'manager_tenure_yrs', 'longest manager tenure'
  ],
  
  up_capture_ratio: [
    'up_capture_ratio', 'up capture ratio', 'up capture ratio (morningstar standard) - 3 year',
    'up capture ratio 3y', 'up_capture_3y', 'up capture 3y', 'up_capture_ratio_3y'
  ],
  
  down_capture_ratio: [
    'down_capture_ratio', 'down capture ratio', 'down capture ratio (morningstar standard) - 3 year',
    'down capture ratio 3y', 'down_capture_3y', 'down capture 3y', 'down_capture_ratio_3y'
  ]
};

/**
 * Find the best matching column for a given metric
 */
function findBestColumnMatch(header, targetMetric) {
  const headerLower = header.toLowerCase().trim();
  
  // Special handling for specific CSV headers to ensure correct mapping
  if (header === 'Symbol/CUSIP' && targetMetric === 'ticker') {
    return { match: header, confidence: 'exact' };
  }
  if (header === 'Total Return - YTD (%)' && targetMetric === 'ytd_return') {
    return { match: header, confidence: 'exact' };
  }
  if (header === 'Total Return - 1 Year (%)' && targetMetric === 'one_year_return') {
    return { match: header, confidence: 'exact' };
  }
  if (header === 'Annualized Total Return - 3 Year (%)' && targetMetric === 'three_year_return') {
    return { match: header, confidence: 'exact' };
  }
  if (header === 'Annualized Total Return - 5 Year (%)' && targetMetric === 'five_year_return') {
    return { match: header, confidence: 'exact' };
  }
  if (header === 'Annualized Total Return - 10 Year (%)' && targetMetric === 'ten_year_return') {
    return { match: header, confidence: 'exact' };
  }
  if (header === 'Alpha (Asset Class) - 5 Year' && targetMetric === 'alpha') {
    return { match: header, confidence: 'exact' };
  }
  if (header === 'Standard Deviation - 5 Year' && targetMetric === 'standard_deviation_5y') {
    return { match: header, confidence: 'exact' };
  }
  if (header === 'Standard Deviation - 3 Year' && targetMetric === 'standard_deviation_3y') {
    return { match: header, confidence: 'exact' };
  }
  if (header === 'Sharpe Ratio - 3 Year' && targetMetric === 'sharpe_ratio') {
    return { match: header, confidence: 'exact' };
  }
  if (header === 'Net Exp Ratio (%)' && targetMetric === 'expense_ratio') {
    return { match: header, confidence: 'exact' };
  }
  if (header === 'Longest Manager Tenure (Years)' && targetMetric === 'manager_tenure') {
    return { match: header, confidence: 'exact' };
  }
  if (header === 'Up Capture Ratio (Morningstar Standard) - 3 Year' && targetMetric === 'up_capture_ratio') {
    return { match: header, confidence: 'exact' };
  }
  if (header === 'Down Capture Ratio (Morningstar Standard) - 3 Year' && targetMetric === 'down_capture_ratio') {
    return { match: header, confidence: 'exact' };
  }
  
  // Fallback to general mapping logic
  const possibleMatches = COLUMN_MAPPING[targetMetric] || [];
  
  // Exact match first
  if (possibleMatches.includes(headerLower)) {
    return { match: header, confidence: 'exact' };
  }
  
  // For return columns, be very specific to avoid false matches with date columns
  if (targetMetric.includes('return')) {
    // Look for specific return patterns
    if (targetMetric === 'ytd_return' && headerLower.includes('ytd') && headerLower.includes('return')) {
      return { match: header, confidence: 'partial' };
    }
    if (targetMetric === 'one_year_return' && headerLower.includes('1 year') && headerLower.includes('return')) {
      return { match: header, confidence: 'partial' };
    }
    if (targetMetric === 'three_year_return' && headerLower.includes('3 year') && headerLower.includes('return')) {
      return { match: header, confidence: 'partial' };
    }
    if (targetMetric === 'five_year_return' && headerLower.includes('5 year') && headerLower.includes('return')) {
      return { match: header, confidence: 'partial' };
    }
    if (targetMetric === 'ten_year_return' && headerLower.includes('10 year') && headerLower.includes('return')) {
      return { match: header, confidence: 'partial' };
    }
    // If it's a return column but doesn't match specific patterns, don't match
    return null;
  }
  
  // For date columns, be very specific to avoid false matches with performance metrics
  if (targetMetric === 'date') {
    // Only match if the header is clearly a date-related field
    if (headerLower === 'date' || headerLower === 'asofmonth' || headerLower === 'as_of_month' || 
        headerLower === 'as of month' || headerLower === 'asof_month' || headerLower === 'asof month' ||
        headerLower === 'report_date' || headerLower === 'data_date') {
      return { match: header, confidence: 'exact' };
    }
    // Don't match partial patterns for dates to avoid false positives
    return null;
  }
  
  // Partial match for other metrics - be more specific to avoid false positives
  for (const possible of possibleMatches) {
    // For risk metrics, be more specific
    if (targetMetric === 'sharpe_ratio' && headerLower.includes('sharpe')) {
      return { match: header, confidence: 'partial' };
    }
    else if (targetMetric === 'standard_deviation_3y' && headerLower.includes('standard deviation') && headerLower.includes('3 year')) {
      return { match: header, confidence: 'partial' };
    }
    else if (targetMetric === 'standard_deviation_5y' && headerLower.includes('standard deviation') && headerLower.includes('5 year')) {
      return { match: header, confidence: 'partial' };
    }
    
    // For other metrics, use general partial matching
    else if (headerLower.includes(possible) || possible.includes(headerLower)) {
      return { match: header, confidence: 'partial' };
    }
  }
  
  // Fuzzy match for common variations - be more restrictive
  const headerWords = headerLower.split(/[\s\-_()]+/).filter(w => w.length > 2);
  for (const possible of possibleMatches) {
    const possibleWords = possible.split(/[\s\-_()]+/).filter(w => w.length > 2);
    const commonWords = headerWords.filter(w => possibleWords.includes(w));
    // Require at least 3 common words for fuzzy matching to avoid false positives
    if (commonWords.length >= 3) {
      return { match: header, confidence: 'fuzzy' };
    }
  }
  
  return null;
}

/**
 * Create a comprehensive column mapping for the CSV
 */
function createColumnMapping(headers) {
  const mapping = {};
  const unmapped = [];
  
  // Map each header to the best matching metric
  headers.forEach(header => {
    let mapped = false;
    
    // First, try to map to performance metrics (highest priority)
    const performanceMetrics = [
      'ytd_return', 'one_year_return', 'three_year_return', 'five_year_return', 'ten_year_return',
      'alpha', 'sharpe_ratio', 'standard_deviation_3y', 'standard_deviation_5y',
      'expense_ratio', 'beta', 'manager_tenure', 'up_capture_ratio', 'down_capture_ratio'
    ];
    for (const metric of performanceMetrics) {
      const match = findBestColumnMatch(header, metric);
      if (match) {
        mapping[header] = {
          targetMetric: metric,
          confidence: match.confidence
        };
        mapped = true;
        break;
      }
    }
    
    // If not mapped to performance metrics, try other metrics
    if (!mapped) {
      for (const [metric, possibleMatches] of Object.entries(COLUMN_MAPPING)) {
        // Skip performance metrics as they were already checked
        if (performanceMetrics.includes(metric)) continue;
        
        const match = findBestColumnMatch(header, metric);
        if (match) {
          mapping[header] = {
            targetMetric: metric,
            confidence: match.confidence
          };
          mapped = true;
          break;
        }
      }
    }
    
    if (!mapped) {
      unmapped.push(header);
    }
  });
  
  return { mapping, unmapped };
}

/**
 * Normalize CSV data using the column mapping
 */
function normalizeCSVData(data, columnMapping) {
  return data.map(row => {
    const normalized = {};
    
    // Map each column to its target metric
    Object.entries(columnMapping.mapping).forEach(([header, mapping]) => {
      const targetMetric = mapping.targetMetric;
      normalized[targetMetric] = row[header];
    });
    
    // Preserve original data for debugging
    normalized._originalRow = row;
    normalized._columnMapping = columnMapping.mapping;
    
    return normalized;
  });
}

/**
 * Validation error types
 */
export const ValidationErrorTypes = {
  INVALID_FILE_FORMAT: 'INVALID_FILE_FORMAT',
  MISSING_REQUIRED_COLUMNS: 'MISSING_REQUIRED_COLUMNS',
  INVALID_DATE_FORMAT: 'INVALID_DATE_FORMAT',
  NON_EOM_DATE: 'NON_EOM_DATE',
  INVALID_TICKER: 'INVALID_TICKER',
  INVALID_NUMERIC_VALUE: 'INVALID_NUMERIC_VALUE',
  EMPTY_FILE: 'EMPTY_FILE',
  DUPLICATE_ROWS: 'DUPLICATE_ROWS'
};

/**
 * Check if a string is a valid date format (YYYY-MM-DD)
 */
export function isValidDateFormat(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim());
}

/**
 * Check if a date is end-of-month
 */
export function isEndOfMonth(dateStr) {
  try {
    const date = new Date(dateStr + 'T00:00:00Z');
    const nextMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
    return date.getUTCDate() === nextMonth.getUTCDate();
  } catch {
    return false;
  }
}

/**
 * Convert date to end-of-month
 */
export function convertToEndOfMonth(dateStr) {
  try {
    const date = new Date(dateStr + 'T00:00:00Z');
    const eom = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
    return eom.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

/**
 * Validate ticker format
 */
export function isValidTicker(ticker) {
  if (!ticker || typeof ticker !== 'string') return false;
  const clean = ticker.trim().toUpperCase();
  return /^[A-Z0-9]{1,20}$/.test(clean) && clean.length > 0;
}

/**
 * Normalize ticker to uppercase and trim
 */
export function normalizeTicker(ticker) {
  if (!ticker || typeof ticker !== 'string') return null;
  return ticker.trim().toUpperCase();
}

/**
 * Validate numeric value using existing parseMetricNumber utility
 */
export function validateNumericValue(value, columnName) {
  if (value === null || value === undefined || value === '') {
    return { isValid: true, parsedValue: null, error: null };
  }
  
  const parsed = dbUtils.parseMetricNumber(value);
  if (parsed === null && value !== null && value !== undefined && value !== '') {
    return {
      isValid: false,
      parsedValue: null,
      error: `Invalid numeric value for ${columnName}: "${value}"`
    };
  }
  
  return { isValid: true, parsedValue: parsed, error: null };
}

/**
 * Parse CSV file with validation
 */
export async function parseCSVFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No file provided'));
      return;
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      reject(new Error('File must be a CSV (.csv) file'));
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(), // Clean up headers
      complete: (results) => {
        if (results.errors.length > 0) {
          reject(new Error(`CSV parsing error: ${results.errors[0].message}`));
          return;
        }

        if (!results.data || results.data.length === 0) {
          reject(new Error('CSV file is empty or contains no valid data rows'));
          return;
        }

        resolve({
          headers: results.meta.fields || [],
          data: results.data,
          meta: results.meta
        });
      },
      error: (error) => {
        reject(new Error(`Failed to parse CSV: ${error.message}`));
      }
    });
  });
}

/**
 * Determine upload type (fund or benchmark) based on headers
 */
export function determineUploadType(headers) {
  const headerSet = new Set(headers.map(h => h.toLowerCase()));
  
  // Look for ticker columns using the comprehensive mapping
  const tickerHeaders = COLUMN_MAPPING.ticker;
  const hasTickerColumn = tickerHeaders.some(header => headerSet.has(header));
  
  // Look for specific fund/benchmark indicators
  const hasFundTicker = headerSet.has('fund_ticker') || 
                       headerSet.has('fund ticker') || 
                       headerSet.has('fund_symbol');
  const hasBenchmarkTicker = headerSet.has('benchmark_ticker') || 
                            headerSet.has('benchmark ticker') || 
                            headerSet.has('benchmark_symbol');
  
  // If we have a ticker column but no specific fund/benchmark indicator, assume it's fund data
  if (hasTickerColumn && !hasBenchmarkTicker) {
    return 'fund';
  } else if (hasBenchmarkTicker && !hasFundTicker) {
    return 'benchmark';
  } else if (hasFundTicker && hasBenchmarkTicker) {
    return 'mixed'; // Not currently supported
  } else if (hasTickerColumn) {
    // Default to fund if we have ticker data but can't determine type
    return 'fund';
  } else {
    return 'unknown';
  }
}

/**
 * Validate required columns are present
 */
export function validateRequiredColumns(headers, uploadType) {
  const errors = [];
  const requiredColumns = uploadType === 'fund' ? FUND_REQUIRED_COLUMNS : BENCHMARK_REQUIRED_COLUMNS;
  const headerSet = new Set(headers.map(h => h.toLowerCase()));
  
  for (const column of requiredColumns) {
    if (column === 'fund_ticker' || column === 'benchmark_ticker') {
      // Check for any ticker column using the mapping
      const tickerHeaders = COLUMN_MAPPING.ticker;
      const hasTickerColumn = tickerHeaders.some(header => headerSet.has(header));
      if (!hasTickerColumn) {
        errors.push(`Missing required ticker column. Found: ${Array.from(headerSet).join(', ')}. Expected one of: ${tickerHeaders.join(', ')}`);
      }
    } else if (column === 'date') {
      // Skip date validation since CSV files don't have date columns
      // The date is provided by the UI picker in MonthlySnapshotUpload
      continue;
    } else {
      // For other required columns, check exact match
      if (!headerSet.has(column.toLowerCase())) {
        errors.push(`Missing required column: ${column}`);
      }
    }
  }
  
  return errors;
}

/**
 * Validate a single data row
 */
export function validateDataRow(row, rowIndex, uploadType, knownTickers = new Set()) {
  const errors = [];
  const warnings = [];
  
  // Find the ticker column using the mapping
  const tickerHeaders = COLUMN_MAPPING.ticker;
  let ticker = null;
  let tickerColumn = null;
  
  for (const header of tickerHeaders) {
    if (row.hasOwnProperty(header)) {
      ticker = normalizeTicker(row[header]);
      tickerColumn = header;
      break;
    }
  }
  
  // If no ticker found, try to find any column that might contain ticker data
  if (!ticker) {
    for (const [header, value] of Object.entries(row)) {
      if (value && typeof value === 'string' && value.length <= 10 && /^[A-Z0-9]+$/.test(value.toUpperCase())) {
        ticker = normalizeTicker(value);
        tickerColumn = header;
        break;
      }
    }
  }
  
  // Validate ticker
  if (!ticker) {
    errors.push(`Row ${rowIndex + 1}: Missing ticker. Available columns: ${Object.keys(row).join(', ')}`);
  } else if (!isValidTicker(ticker)) {
    errors.push(`Row ${rowIndex + 1}: Invalid ticker format: "${ticker}"`);
  } else if (knownTickers.size > 0 && !knownTickers.has(ticker)) {
    warnings.push(`Row ${rowIndex + 1}: Unknown ticker: "${ticker}"`);
  }
  
  // Skip date validation since CSV files don't have date columns
  // The date is provided by the UI picker in MonthlySnapshotUpload
  const dateValue = null;
  
  // Validate numeric columns
  const numericColumns = uploadType === 'fund' ? FUND_OPTIONAL_COLUMNS : BENCHMARK_OPTIONAL_COLUMNS;
  for (const column of numericColumns) {
    if (NUMERIC_COLUMNS.includes(column) && row[column] !== undefined) {
      const validation = validateNumericValue(row[column], column);
      if (!validation.isValid) {
        errors.push(`Row ${rowIndex + 1}: ${validation.error}`);
      }
    }
  }
  
  return {
    errors,
    warnings,
    normalizedTicker: ticker,
    normalizedDate: dateValue ? convertToEndOfMonth(dateValue) : null
  };
}

/**
 * Check for duplicate rows based on ticker and date
 */
export function findDuplicateRows(data, uploadType) {
  const seen = new Map();
  const duplicates = [];
  
  data.forEach((row, index) => {
    const ticker = row._normalizedTicker || normalizeTicker(row.ticker) || normalizeTicker(row.fund_ticker) || normalizeTicker(row.benchmark_ticker);
    
    // Since CSV files don't have date columns, only check for duplicate tickers
    if (ticker) {
      if (seen.has(ticker)) {
        duplicates.push({
          ticker,
          date: 'N/A', // No date column in CSV
          rowIndex: index + 1,
          firstOccurrence: seen.get(ticker) + 1
        });
      } else {
        seen.set(ticker, index);
      }
    }
  });
  
  return duplicates;
}

/**
 * Calculate data coverage for metrics
 */
export function calculateDataCoverage(data, uploadType) {
  const coverage = {};
  const numericColumns = uploadType === 'fund' ? FUND_OPTIONAL_COLUMNS : BENCHMARK_OPTIONAL_COLUMNS;
  
  for (const column of numericColumns) {
    if (NUMERIC_COLUMNS.includes(column)) {
      let total = 0;
      let nonNull = 0;
      
      for (const row of data) {
        if (row[column] !== undefined) {
          total++;
          const validation = validateNumericValue(row[column], column);
          if (validation.isValid && validation.parsedValue !== null) {
            nonNull++;
          }
        }
      }
      
      coverage[column] = {
        total,
        nonNull,
        coverage: total > 0 ? nonNull / total : 0
      };
    }
  }
  
  return coverage;
}

/**
 * Main validation function for CSV uploads
 */
export async function validateCSVUpload(file, knownTickers = new Set(), options = {}) {
  const {
    requireEOM = true,
    allowMixed = false
  } = options;
  
  try {
    // Parse CSV
    const { headers, data } = await parseCSVFile(file);
    
    // Create column mapping
    const columnMapping = createColumnMapping(headers);
    
    // Log column mapping for debugging
    console.log('CSV Column Mapping:', columnMapping);
    console.log('Unmapped columns:', columnMapping.unmapped);
    
    // Determine upload type
    const uploadType = determineUploadType(headers);
    
    if (uploadType === 'unknown') {
      return {
        isValid: false,
        errors: [`Cannot determine upload type. File must contain a ticker column. Found columns: ${headers.join(', ')}`],
        warnings: [],
        data: null,
        uploadType: null,
        columnMapping
      };
    }
    
    if (uploadType === 'mixed' && !allowMixed) {
      return {
        isValid: false,
        errors: [`Mixed fund and benchmark data in single file is not supported. Use separate files.`],
        warnings: [],
        data: null,
        uploadType: null,
        columnMapping
      };
    }
    
    // Validate required columns
    const columnErrors = validateRequiredColumns(headers, uploadType);
    if (columnErrors.length > 0) {
      return {
        isValid: false,
        errors: columnErrors,
        warnings: [],
        data: null,
        uploadType,
        columnMapping
      };
    }
    
    // Normalize the data using the column mapping
    const normalizedData = normalizeCSVData(data, columnMapping);
    
    // Check for duplicates
    const duplicates = findDuplicateRows(normalizedData, uploadType);
    
    // Validate each row
    const allErrors = [];
    const allWarnings = [];
    const validatedData = [];
    
    for (let i = 0; i < normalizedData.length; i++) {
      const validation = validateDataRow(normalizedData[i], i, uploadType, knownTickers);
      allErrors.push(...validation.errors);
      allWarnings.push(...validation.warnings);
      
      // Add normalized data
      validatedData.push({
        ...normalizedData[i],
        _normalizedTicker: validation.normalizedTicker,
        _normalizedDate: validation.normalizedDate,
        _rowIndex: i + 1
      });
    }
    
    // Add duplicate warnings
    if (duplicates.length > 0) {
      duplicates.forEach(dup => {
        allWarnings.push(`Row ${dup.rowIndex}: Duplicate entry for ${dup.ticker} on ${dup.date} (first seen at row ${dup.firstOccurrence})`);
      });
    }
    
    // Calculate coverage
    const coverage = calculateDataCoverage(normalizedData, uploadType);
    
    // Determine if EOM requirement blocks upload
    const eomErrors = [];
    if (requireEOM) {
      normalizedData.forEach((row, index) => {
        const dateValue = row.date?.trim();
        if (dateValue && isValidDateFormat(dateValue) && !isEndOfMonth(dateValue)) {
          eomErrors.push(`Row ${index + 1}: Date "${dateValue}" is not end-of-month and EOM is required`);
        }
      });
    }
    
    const finalErrors = [...allErrors, ...eomErrors];
    
    return {
      isValid: finalErrors.length === 0,
      errors: finalErrors,
      warnings: allWarnings,
      data: validatedData,
      uploadType,
      coverage,
      duplicates,
      totalRows: data.length,
      validRows: data.length - finalErrors.length,
      columnMapping
    };
  } catch (error) {
    return {
      isValid: false,
      errors: [error.message],
      warnings: [],
      data: null,
      uploadType: null,
      columnMapping: null
    };
  }
}

/**
 * Generate downloadable error report
 */
export function generateErrorReport(validationResult) {
  if (!validationResult || (!validationResult.errors.length && !validationResult.warnings.length)) {
    return null;
  }
  
  const lines = [];
  lines.push('CSV Upload Validation Report');
  lines.push('Generated: ' + new Date().toISOString());
  lines.push('');
  
  if (validationResult.errors.length > 0) {
    lines.push('ERRORS (must be fixed before upload):');
    validationResult.errors.forEach((error, index) => {
      lines.push(`${index + 1}. ${error}`);
    });
    lines.push('');
  }
  
  if (validationResult.warnings.length > 0) {
    lines.push('WARNINGS (recommended to review):');
    validationResult.warnings.forEach((warning, index) => {
      lines.push(`${index + 1}. ${warning}`);
    });
    lines.push('');
  }
  
  if (validationResult.coverage) {
    lines.push('DATA COVERAGE SUMMARY:');
    Object.entries(validationResult.coverage).forEach(([metric, stats]) => {
      const percentage = Math.round(stats.coverage * 100);
      lines.push(`${metric}: ${stats.nonNull}/${stats.total} rows (${percentage}%)`);
    });
    lines.push('');
  }
  
  lines.push('Please fix all errors and re-upload the file.');
  
  return lines.join('\n');
}

export default {
  validateCSVUpload,
  parseCSVFile,
  determineUploadType,
  validateRequiredColumns,
  validateDataRow,
  findDuplicateRows,
  calculateDataCoverage,
  generateErrorReport,
  isValidDateFormat,
  isEndOfMonth,
  convertToEndOfMonth,
  isValidTicker,
  normalizeTicker,
  validateNumericValue,
  ValidationErrorTypes
};