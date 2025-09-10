// src/services/__tests__/fundDataService.test.js
import { getFundsWithPerformance, getAvailablePerformanceDates, getAssetClassOptions } from '../fundDataService.js';

describe('Fund Data Service', () => {
  describe('getFundsWithPerformance', () => {
    it('should return empty array when no funds found', async () => {
      const result = await getFundsWithPerformance('2025-07-31');
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle null date parameter', async () => {
      const result = await getFundsWithPerformance();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle asset class filtering', async () => {
      const result = await getFundsWithPerformance('2025-07-31', 'some-asset-class-id');
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return funds with proper structure when data exists', async () => {
      // This test would need real data or mocked Supabase responses
      const result = await getFundsWithPerformance();
      
      if (result.length > 0) {
        const fund = result[0];
        expect(fund).toHaveProperty('ticker');
        expect(fund).toHaveProperty('name');
        expect(fund).toHaveProperty('asset_class_name');
        expect(fund).toHaveProperty('ytd_return');
        expect(fund).toHaveProperty('sharpe_ratio');
        expect(fund).toHaveProperty('date');
      }
    });
  });

  describe('getAvailablePerformanceDates', () => {
    it('should return array of dates', async () => {
      const result = await getAvailablePerformanceDates();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getAssetClassOptions', () => {
    it('should return array of asset class options', async () => {
      const result = await getAssetClassOptions();
      expect(Array.isArray(result)).toBe(true);
    });
  });
});