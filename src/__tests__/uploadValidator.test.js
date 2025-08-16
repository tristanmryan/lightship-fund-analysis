/**
 * Tests for uploadValidator utility
 * Covers CSV parsing, validation, EOM checking, and error handling
 */

import uploadValidator from '../utils/uploadValidator';

describe('uploadValidator', () => {
  describe('isValidDateFormat', () => {
    test('validates correct date formats', () => {
      expect(uploadValidator.isValidDateFormat('2025-01-31')).toBe(true);
      expect(uploadValidator.isValidDateFormat('2024-12-31')).toBe(true);
    });

    test('rejects invalid date formats', () => {
      expect(uploadValidator.isValidDateFormat('2025-1-31')).toBe(false);
      expect(uploadValidator.isValidDateFormat('01-31-2025')).toBe(false);
      expect(uploadValidator.isValidDateFormat('2025/01/31')).toBe(false);
      expect(uploadValidator.isValidDateFormat('invalid')).toBe(false);
      expect(uploadValidator.isValidDateFormat('')).toBe(false);
      expect(uploadValidator.isValidDateFormat(null)).toBe(false);
    });
  });

  describe('isEndOfMonth', () => {
    test('validates end-of-month dates', () => {
      expect(uploadValidator.isEndOfMonth('2025-01-31')).toBe(true);
      expect(uploadValidator.isEndOfMonth('2025-02-28')).toBe(true);
      expect(uploadValidator.isEndOfMonth('2024-02-29')).toBe(true); // Leap year
      expect(uploadValidator.isEndOfMonth('2025-04-30')).toBe(true);
    });

    test('rejects non-end-of-month dates', () => {
      expect(uploadValidator.isEndOfMonth('2025-01-15')).toBe(false);
      expect(uploadValidator.isEndOfMonth('2025-02-15')).toBe(false);
      expect(uploadValidator.isEndOfMonth('2025-12-01')).toBe(false);
    });

    test('handles invalid dates gracefully', () => {
      expect(uploadValidator.isEndOfMonth('invalid')).toBe(false);
      expect(uploadValidator.isEndOfMonth('')).toBe(false);
      expect(uploadValidator.isEndOfMonth(null)).toBe(false);
    });
  });

  describe('convertToEndOfMonth', () => {
    test('converts dates to end-of-month', () => {
      expect(uploadValidator.convertToEndOfMonth('2025-01-15')).toBe('2025-01-31');
      expect(uploadValidator.convertToEndOfMonth('2025-02-15')).toBe('2025-02-28');
      expect(uploadValidator.convertToEndOfMonth('2024-02-15')).toBe('2024-02-29'); // Leap year
      expect(uploadValidator.convertToEndOfMonth('2025-04-15')).toBe('2025-04-30');
    });

    test('leaves end-of-month dates unchanged', () => {
      expect(uploadValidator.convertToEndOfMonth('2025-01-31')).toBe('2025-01-31');
      expect(uploadValidator.convertToEndOfMonth('2025-02-28')).toBe('2025-02-28');
    });

    test('handles invalid dates', () => {
      expect(uploadValidator.convertToEndOfMonth('invalid')).toBe(null);
      expect(uploadValidator.convertToEndOfMonth('')).toBe(null);
    });
  });

  describe('isValidTicker', () => {
    test('validates correct ticker formats', () => {
      expect(uploadValidator.isValidTicker('VTSAX')).toBe(true);
      expect(uploadValidator.isValidTicker('IWF')).toBe(true);
      expect(uploadValidator.isValidTicker('SPY')).toBe(true);
      expect(uploadValidator.isValidTicker('BRK.B')).toBe(false); // Contains period
    });

    test('rejects invalid ticker formats', () => {
      expect(uploadValidator.isValidTicker('')).toBe(false);
      expect(uploadValidator.isValidTicker('   ')).toBe(false);
      expect(uploadValidator.isValidTicker('TOOLONGTICKER123456789')).toBe(false);
      expect(uploadValidator.isValidTicker('INVALID-TICKER')).toBe(false);
      expect(uploadValidator.isValidTicker(null)).toBe(false);
    });
  });

  describe('normalizeTicker', () => {
    test('normalizes tickers to uppercase', () => {
      expect(uploadValidator.normalizeTicker('vtsax')).toBe('VTSAX');
      expect(uploadValidator.normalizeTicker('Spy')).toBe('SPY');
      expect(uploadValidator.normalizeTicker('  iwf  ')).toBe('IWF');
    });

    test('handles invalid inputs', () => {
      expect(uploadValidator.normalizeTicker('')).toBe(null);
      expect(uploadValidator.normalizeTicker(null)).toBe(null);
      expect(uploadValidator.normalizeTicker(undefined)).toBe(null);
    });
  });

  describe('validateNumericValue', () => {
    test('validates numeric values', () => {
      const result1 = uploadValidator.validateNumericValue('12.34', 'ytd_return');
      expect(result1.isValid).toBe(true);
      expect(result1.parsedValue).toBe(12.34);

      const result2 = uploadValidator.validateNumericValue('0', 'expense_ratio');
      expect(result2.isValid).toBe(true);
      expect(result2.parsedValue).toBe(0);
    });

    test('handles null and empty values', () => {
      const result1 = uploadValidator.validateNumericValue(null, 'ytd_return');
      expect(result1.isValid).toBe(true);
      expect(result1.parsedValue).toBe(null);

      const result2 = uploadValidator.validateNumericValue('', 'ytd_return');
      expect(result2.isValid).toBe(true);
      expect(result2.parsedValue).toBe(null);
    });

    test('rejects invalid numeric values', () => {
      const result = uploadValidator.validateNumericValue('invalid', 'ytd_return');
      expect(result.isValid).toBe(false);
      expect(result.parsedValue).toBe(null);
      expect(result.error).toContain('Invalid numeric value');
    });
  });

  describe('determineUploadType', () => {
    test('identifies fund upload type', () => {
      const headers = ['fund_ticker', 'date', 'ytd_return'];
      expect(uploadValidator.determineUploadType(headers)).toBe('fund');
    });

    test('identifies benchmark upload type', () => {
      const headers = ['benchmark_ticker', 'date', 'ytd_return'];
      expect(uploadValidator.determineUploadType(headers)).toBe('benchmark');
    });

    test('identifies mixed upload type', () => {
      const headers = ['fund_ticker', 'benchmark_ticker', 'date', 'ytd_return'];
      expect(uploadValidator.determineUploadType(headers)).toBe('mixed');
    });

    test('identifies unknown upload type', () => {
      const headers = ['ticker', 'date', 'ytd_return'];
      expect(uploadValidator.determineUploadType(headers)).toBe('unknown');
    });
  });

  describe('validateRequiredColumns', () => {
    test('validates fund required columns', () => {
      const headers = ['fund_ticker', 'date', 'ytd_return'];
      const errors = uploadValidator.validateRequiredColumns(headers, 'fund');
      expect(errors).toHaveLength(0);
    });

    test('finds missing fund required columns', () => {
      const headers = ['fund_ticker', 'ytd_return']; // Missing date
      const errors = uploadValidator.validateRequiredColumns(headers, 'fund');
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('Missing required column: date');
    });

    test('validates benchmark required columns', () => {
      const headers = ['benchmark_ticker', 'date', 'ytd_return'];
      const errors = uploadValidator.validateRequiredColumns(headers, 'benchmark');
      expect(errors).toHaveLength(0);
    });

    test('finds missing benchmark required columns', () => {
      const headers = ['benchmark_ticker', 'ytd_return']; // Missing date
      const errors = uploadValidator.validateRequiredColumns(headers, 'benchmark');
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('Missing required column: date');
    });
  });

  describe('validateDataRow', () => {
    const knownTickers = new Set(['VTSAX', 'SPY', 'IWF']);

    test('validates valid fund row', () => {
      const row = {
        fund_ticker: 'VTSAX',
        date: '2025-01-31',
        ytd_return: '12.34'
      };
      
      const result = uploadValidator.validateDataRow(row, 0, 'fund', knownTickers);
      expect(result.errors).toHaveLength(0);
      expect(result.normalizedTicker).toBe('VTSAX');
      expect(result.normalizedDate).toBe('2025-01-31');
    });

    test('validates valid benchmark row', () => {
      const row = {
        benchmark_ticker: 'IWF',
        date: '2025-01-31',
        ytd_return: '15.23'
      };
      
      const result = uploadValidator.validateDataRow(row, 0, 'benchmark', knownTickers);
      expect(result.errors).toHaveLength(0);
      expect(result.normalizedTicker).toBe('IWF');
    });

    test('finds errors in invalid row', () => {
      const row = {
        fund_ticker: '', // Missing ticker
        date: '2025-01-15', // Non-EOM date
        ytd_return: 'invalid' // Invalid numeric
      };
      
      const result = uploadValidator.validateDataRow(row, 0, 'fund', knownTickers);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('Missing fund_ticker'))).toBe(true);
    });

    test('warns about unknown tickers', () => {
      const row = {
        fund_ticker: 'UNKNOWN',
        date: '2025-01-31',
        ytd_return: '12.34'
      };
      
      const result = uploadValidator.validateDataRow(row, 0, 'fund', knownTickers);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('Unknown ticker'))).toBe(true);
    });

    test('warns about non-EOM dates', () => {
      const row = {
        fund_ticker: 'VTSAX',
        date: '2025-01-15', // Non-EOM
        ytd_return: '12.34'
      };
      
      const result = uploadValidator.validateDataRow(row, 0, 'fund', knownTickers);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('not end-of-month'))).toBe(true);
    });
  });

  describe('findDuplicateRows', () => {
    test('finds duplicate fund rows', () => {
      const data = [
        { fund_ticker: 'VTSAX', date: '2025-01-31' },
        { fund_ticker: 'SPY', date: '2025-01-31' },
        { fund_ticker: 'VTSAX', date: '2025-01-31' } // Duplicate
      ];
      
      const duplicates = uploadValidator.findDuplicateRows(data, 'fund');
      expect(duplicates).toHaveLength(1);
      expect(duplicates[0].ticker).toBe('VTSAX');
      expect(duplicates[0].rowIndex).toBe(3);
      expect(duplicates[0].firstOccurrence).toBe(1);
    });

    test('finds no duplicates when none exist', () => {
      const data = [
        { fund_ticker: 'VTSAX', date: '2025-01-31' },
        { fund_ticker: 'SPY', date: '2025-01-31' },
        { fund_ticker: 'VTSAX', date: '2025-02-28' } // Different date
      ];
      
      const duplicates = uploadValidator.findDuplicateRows(data, 'fund');
      expect(duplicates).toHaveLength(0);
    });
  });

  describe('calculateDataCoverage', () => {
    test('calculates coverage for fund data', () => {
      const data = [
        { ytd_return: '12.34', one_year_return: '15.67', sharpe_ratio: null },
        { ytd_return: '10.23', one_year_return: null, sharpe_ratio: '1.2' },
        { ytd_return: null, one_year_return: '8.90', sharpe_ratio: '0.9' }
      ];
      
      const coverage = uploadValidator.calculateDataCoverage(data, 'fund');
      
      expect(coverage.ytd_return.total).toBe(3);
      expect(coverage.ytd_return.nonNull).toBe(2);
      expect(coverage.ytd_return.coverage).toBeCloseTo(0.67, 2);
      
      expect(coverage.one_year_return.total).toBe(3);
      expect(coverage.one_year_return.nonNull).toBe(2);
      
      expect(coverage.sharpe_ratio.total).toBe(3);
      expect(coverage.sharpe_ratio.nonNull).toBe(2);
    });
  });

  describe('generateErrorReport', () => {
    test('generates error report with errors and warnings', () => {
      const validation = {
        errors: ['Missing required column: date', 'Invalid ticker format'],
        warnings: ['Non-EOM date detected'],
        coverage: {
          ytd_return: { nonNull: 8, total: 10, coverage: 0.8 }
        }
      };
      
      const report = uploadValidator.generateErrorReport(validation);
      expect(report).toContain('ERRORS (must be fixed before upload)');
      expect(report).toContain('WARNINGS (recommended to review)');
      expect(report).toContain('DATA COVERAGE SUMMARY');
      expect(report).toContain('ytd_return: 8/10 rows (80%)');
    });

    test('returns null for clean validation', () => {
      const validation = {
        errors: [],
        warnings: [],
        coverage: {}
      };
      
      const report = uploadValidator.generateErrorReport(validation);
      expect(report).toBe(null);
    });
  });
});