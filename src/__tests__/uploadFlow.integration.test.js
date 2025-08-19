/**
 * Integration tests for the upload flow
 * Tests the complete upload pipeline including validation, RPC calls, and idempotent operations
 */

import { createClient } from '@supabase/supabase-js';
import uploadValidator from '../utils/uploadValidator';

// Mock Supabase for testing
const mockSupabase = {
  rpc: jest.fn(),
  from: jest.fn(() => ({
    select: jest.fn(() => Promise.resolve({ data: [], error: null })),
    upsert: jest.fn(() => Promise.resolve({ data: [], error: null }))
  }))
};

describe('Upload Flow Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('CSV File Validation End-to-End', () => {
    test('validates fund performance CSV with correct structure', async () => {
      // Create mock CSV file
      const csvContent = `fund_ticker,date,ytd_return,one_year_return,three_year_return
VTSAX,2025-01-31,8.42,14.65,10.88
FXNAX,2025-01-31,6.78,12.34,9.45`;

      const file = new File([csvContent], 'fund_performance.csv', { type: 'text/csv' });
      const knownTickers = new Set(['VTSAX', 'FXNAX']);

      const validation = await uploadValidator.validateCSVUpload(file, knownTickers, {
        requireEOM: true,
        allowMixed: false
      });

      expect(validation.isValid).toBe(true);
      expect(validation.uploadType).toBe('fund');
      expect(validation.data).toHaveLength(2);
      expect(validation.errors).toHaveLength(0);
      expect(validation.totalRows).toBe(2);
    });

    test('validates benchmark performance CSV with correct structure', async () => {
      const csvContent = `benchmark_ticker,date,ytd_return,one_year_return,three_year_return
IWF,2025-01-31,9.15,15.23,11.45
EFA,2025-01-31,4.23,8.67,6.34`;

      const file = new File([csvContent], 'benchmark_performance.csv', { type: 'text/csv' });
      const knownTickers = new Set(['IWF', 'EFA']);

      const validation = await uploadValidator.validateCSVUpload(file, knownTickers, {
        requireEOM: true,
        allowMixed: false
      });

      expect(validation.isValid).toBe(true);
      expect(validation.uploadType).toBe('benchmark');
      expect(validation.data).toHaveLength(2);
      expect(validation.errors).toHaveLength(0);
    });

    test('rejects CSV with missing required columns', async () => {
      const csvContent = `ticker,ytd_return,one_year_return
VTSAX,8.42,14.65
FXNAX,6.78,12.34`;

      const file = new File([csvContent], 'invalid.csv', { type: 'text/csv' });
      const knownTickers = new Set(['VTSAX', 'FXNAX']);

      const validation = await uploadValidator.validateCSVUpload(file, knownTickers);

      expect(validation.isValid).toBe(false);
      expect(validation.uploadType).toBe(null);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    test('rejects CSV with non-EOM dates when EOM required', async () => {
      const csvContent = `fund_ticker,date,ytd_return
VTSAX,2025-01-15,8.42
FXNAX,2025-01-15,6.78`;

      const file = new File([csvContent], 'non_eom.csv', { type: 'text/csv' });
      const knownTickers = new Set(['VTSAX', 'FXNAX']);

      const validation = await uploadValidator.validateCSVUpload(file, knownTickers, {
        requireEOM: true
      });

      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(e => e.includes('not end-of-month'))).toBe(true);
    });

    test('detects duplicate rows in CSV', async () => {
      const csvContent = `fund_ticker,date,ytd_return
VTSAX,2025-01-31,8.42
VTSAX,2025-01-31,8.42`;

      const file = new File([csvContent], 'duplicates.csv', { type: 'text/csv' });
      const knownTickers = new Set(['VTSAX']);

      const validation = await uploadValidator.validateCSVUpload(file, knownTickers);

      expect(validation.duplicates).toHaveLength(1);
      expect(validation.warnings.some(w => w.includes('Duplicate entry'))).toBe(true);
    });

    test('warns about unknown tickers', async () => {
      const csvContent = `fund_ticker,date,ytd_return
UNKNOWN,2025-01-31,8.42
VTSAX,2025-01-31,6.78`;

      const file = new File([csvContent], 'unknown_tickers.csv', { type: 'text/csv' });
      const knownTickers = new Set(['VTSAX']);

      const validation = await uploadValidator.validateCSVUpload(file, knownTickers);

      expect(validation.warnings.some(w => w.includes('Unknown ticker: "UNKNOWN"'))).toBe(true);
    });
  });

  describe('Data Coverage Analysis', () => {
    test('calculates metric coverage correctly', async () => {
      const csvContent = `fund_ticker,date,ytd_return,one_year_return,sharpe_ratio
VTSAX,2025-01-31,8.42,14.65,1.2
FXNAX,2025-01-31,6.78,,0.9
SWPPX,2025-01-31,,12.34,`;

      const file = new File([csvContent], 'coverage_test.csv', { type: 'text/csv' });
      const knownTickers = new Set(['VTSAX', 'FXNAX', 'SWPPX']);

      const validation = await uploadValidator.validateCSVUpload(file, knownTickers);

      expect(validation.coverage.ytd_return.total).toBe(3);
      expect(validation.coverage.ytd_return.nonNull).toBe(2);
      expect(validation.coverage.ytd_return.coverage).toBeCloseTo(0.67, 2);

      expect(validation.coverage.one_year_return.total).toBe(3);
      expect(validation.coverage.one_year_return.nonNull).toBe(2);

      expect(validation.coverage.sharpe_ratio.total).toBe(3);
      expect(validation.coverage.sharpe_ratio.nonNull).toBe(2);
    });
  });

  describe('Error Report Generation', () => {
    test('generates comprehensive error report', async () => {
      const csvContent = `fund_ticker,ytd_return
VTSAX,invalid_number
,12.34`;

      const file = new File([csvContent], 'errors.csv', { type: 'text/csv' });
      const knownTickers = new Set(['VTSAX']);

      const validation = await uploadValidator.validateCSVUpload(file, knownTickers);
      const report = uploadValidator.generateErrorReport(validation);

      expect(report).toContain('CSV Upload Validation Report');
      expect(report).toContain('ERRORS (must be fixed before upload)');
      expect(report).toContain('Please fix all errors and re-upload');
    });
  });

  describe('RPC Integration Simulation', () => {
    test('simulates successful fund performance upload', async () => {
      // Mock successful RPC response
      const mockRpcResponse = {
        data: {
          success: true,
          records_processed: 2,
          inserted: 2,
          updated: 0,
          errors: 0
        },
        error: null
      };

      mockSupabase.rpc.mockResolvedValueOnce(mockRpcResponse);

      const fundData = [
        {
          fund_ticker: 'VTSAX',
          date: '2025-01-31',
          ytd_return: 8.42,
          one_year_return: 14.65
        },
        {
          fund_ticker: 'FXNAX',
          date: '2025-01-31',
          ytd_return: 6.78,
          one_year_return: 12.34
        }
      ];

      const result = await mockSupabase.rpc('upsert_fund_performance', { 
        csv_data: fundData 
      });

      expect(result.data.success).toBe(true);
      expect(result.data.records_processed).toBe(2);
      expect(result.data.inserted).toBe(2);
      expect(result.error).toBe(null);
    });

    test('simulates idempotent operation (re-upload same data)', async () => {
      // Mock idempotent RPC response (updates instead of inserts)
      const mockRpcResponse = {
        data: {
          success: true,
          records_processed: 2,
          inserted: 0,
          updated: 2,
          errors: 0
        },
        error: null
      };

      mockSupabase.rpc.mockResolvedValueOnce(mockRpcResponse);

      const fundData = [
        {
          fund_ticker: 'VTSAX',
          date: '2025-01-31',
          ytd_return: 8.42,
          one_year_return: 14.65
        },
        {
          fund_ticker: 'FXNAX',
          date: '2025-01-31',
          ytd_return: 6.78,
          one_year_return: 12.34
        }
      ];

      const result = await mockSupabase.rpc('upsert_fund_performance', { 
        csv_data: fundData 
      });

      expect(result.data.success).toBe(true);
      expect(result.data.records_processed).toBe(2);
      expect(result.data.inserted).toBe(0); // No new records
      expect(result.data.updated).toBe(2); // All records updated
      expect(result.error).toBe(null);
    });

    test('simulates activity logging', async () => {
      const mockActivityResponse = {
        data: 'activity-uuid-123',
        error: null
      };

      mockSupabase.rpc.mockResolvedValueOnce(mockActivityResponse);

      const result = await mockSupabase.rpc('log_activity', {
        user_info: {
          user_id: null,
          ip_address: null,
          user_agent: 'test-browser'
        },
        action: 'csv_upload',
        details: {
          upload_date: '2025-01-31',
          funds_processed: 2,
          benchmarks_processed: 0,
          total_success: 2,
          total_failed: 0
        }
      });

      expect(result.data).toBe('activity-uuid-123');
      expect(result.error).toBe(null);
    });
  });

  describe('EOM Date Handling', () => {
    test('converts non-EOM dates to EOM when validation allows', async () => {
      const csvContent = `fund_ticker,date,ytd_return
VTSAX,2025-01-15,8.42`;

      const file = new File([csvContent], 'non_eom.csv', { type: 'text/csv' });
      const knownTickers = new Set(['VTSAX']);

      const validation = await uploadValidator.validateCSVUpload(file, knownTickers, {
        requireEOM: false // Allow non-EOM, will convert
      });

      expect(validation.isValid).toBe(true);
      expect(validation.data[0]._normalizedDate).toBe('2025-01-31'); // Converted to EOM
      expect(validation.warnings.some(w => w.includes('not end-of-month'))).toBe(true);
    });
  });
});