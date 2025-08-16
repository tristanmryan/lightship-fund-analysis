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
];

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
  
  const hasFundTicker = headerSet.has('fund_ticker');
  const hasBenchmarkTicker = headerSet.has('benchmark_ticker');
  
  if (hasFundTicker && !hasBenchmarkTicker) {
    return 'fund';
  } else if (hasBenchmarkTicker && !hasFundTicker) {
    return 'benchmark';
  } else if (hasFundTicker && hasBenchmarkTicker) {
    return 'mixed'; // Not currently supported
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
    if (!headerSet.has(column.toLowerCase())) {
      errors.push(`Missing required column: ${column}`);
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
  
  const tickerColumn = uploadType === 'fund' ? 'fund_ticker' : 'benchmark_ticker';
  const ticker = normalizeTicker(row[tickerColumn]);
  const dateValue = row.date?.trim();
  
  // Validate ticker
  if (!ticker) {
    errors.push(`Row ${rowIndex + 1}: Missing ${tickerColumn}`);
  } else if (!isValidTicker(ticker)) {
    errors.push(`Row ${rowIndex + 1}: Invalid ticker format: "${ticker}"`);
  } else if (knownTickers.size > 0 && !knownTickers.has(ticker)) {
    warnings.push(`Row ${rowIndex + 1}: Unknown ticker: "${ticker}"`);
  }
  
  // Validate date
  if (!dateValue) {
    errors.push(`Row ${rowIndex + 1}: Missing date`);
  } else if (!isValidDateFormat(dateValue)) {
    errors.push(`Row ${rowIndex + 1}: Invalid date format: "${dateValue}". Use YYYY-MM-DD format.`);
  } else if (!isEndOfMonth(dateValue)) {
    warnings.push(`Row ${rowIndex + 1}: Date "${dateValue}" is not end-of-month. Will be converted to EOM.`);
  }
  
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
  
  const tickerColumn = uploadType === 'fund' ? 'fund_ticker' : 'benchmark_ticker';
  
  data.forEach((row, index) => {
    const ticker = normalizeTicker(row[tickerColumn]);
    const date = row.date?.trim();
    
    if (ticker && date) {
      const key = `${ticker}:${date}`;
      if (seen.has(key)) {
        duplicates.push({
          rowIndex: index + 1,
          ticker,
          date,
          firstOccurrence: seen.get(key)
        });
      } else {
        seen.set(key, index + 1);
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
    
    // Determine upload type
    const uploadType = determineUploadType(headers);
    
    if (uploadType === 'unknown') {
      return {
        isValid: false,
        errors: [`Cannot determine upload type. File must contain either 'fund_ticker' or 'benchmark_ticker' column.`],
        warnings: [],
        data: null,
        uploadType: null
      };
    }
    
    if (uploadType === 'mixed' && !allowMixed) {
      return {
        isValid: false,
        errors: [`Mixed fund and benchmark data in single file is not supported. Use separate files.`],
        warnings: [],
        data: null,
        uploadType: null
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
        uploadType
      };
    }
    
    // Check for duplicates
    const duplicates = findDuplicateRows(data, uploadType);
    
    // Validate each row
    const allErrors = [];
    const allWarnings = [];
    const validatedData = [];
    
    for (let i = 0; i < data.length; i++) {
      const validation = validateDataRow(data[i], i, uploadType, knownTickers);
      allErrors.push(...validation.errors);
      allWarnings.push(...validation.warnings);
      
      // Add normalized data
      validatedData.push({
        ...data[i],
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
    const coverage = calculateDataCoverage(data, uploadType);
    
    // Determine if EOM requirement blocks upload
    const eomErrors = [];
    if (requireEOM) {
      data.forEach((row, index) => {
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
      validRows: data.length - finalErrors.length
    };
  } catch (error) {
    return {
      isValid: false,
      errors: [error.message],
      warnings: [],
      data: null,
      uploadType: null
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