import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from '../App';

// Minimal mock for useFundData to control inputs
jest.mock('../hooks/useFundData', () => ({
  useFundData: () => ({
    funds: [
      { ticker: 'JQUA', name: 'JPM US Quality', asset_class_name: 'Large Cap Growth', ytd_return: 2.5, one_year_return: 15.1, three_year_return: 12.2, five_year_return: 13.3, ten_year_return: 11.1, sharpe_ratio: 0.9, alpha: 0.1, is_recommended: false },
      { ticker: 'AOM', name: 'iShares Moderate Allocation', asset_class_name: 'Asset Allocation', ytd_return: 1.9, one_year_return: 7.6, three_year_return: 6.1, five_year_return: 5.2, ten_year_return: 4.9, sharpe_ratio: 0.7, alpha: 0.0, is_recommended: false }
    ],
    loading: false,
    error: null,
    refreshData: jest.fn(),
    addFund: jest.fn(),
    removeFund: jest.fn(),
    assetClasses: ['Large Cap Growth','Asset Allocation'],
    fundCount: 2,
    recommendedCount: 0
  })
}));

test('Scores table renders normalized fields', async () => {
  render(<App />);
  // Switch to Funds tab (Enhanced Performance Dashboard)
  screen.getByText('Funds').click();
  // Verify tickers and normalized fields appear
  expect(await screen.findByText('JQUA')).toBeInTheDocument();
  expect(screen.getByText('JPM US Quality')).toBeInTheDocument();
  expect(screen.getByText('Large Cap Growth')).toBeInTheDocument();
  // Returns present
  expect(screen.getAllByText(/%$/).length).toBeGreaterThan(0);
});

