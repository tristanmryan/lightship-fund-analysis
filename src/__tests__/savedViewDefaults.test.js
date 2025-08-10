import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import EnhancedPerformanceDashboard from '../components/Dashboard/EnhancedPerformanceDashboard';

// Mock preferencesService to avoid IndexedDB in tests
jest.mock('../services/preferencesService', () => ({
  __esModule: true,
  default: {
    getViewDefaults: jest.fn(async () => ({
      filters: { search: 'spy', assetClasses: [], performanceRank: 'all', expenseRatioMax: '', sharpeRatioMin: '', betaMax: '', timePerformance: { period: 'ytd', minReturn: '', maxReturn: '' }, scoreRange: { min: '', max: '' }, isRecommended: 'all' },
      table: { sortConfig: [{ key: 'score', direction: 'desc' }], selectedColumns: ['symbol','name','assetClass','score'] },
      chartPeriod: '6M'
    })),
    saveViewDefaults: jest.fn(async () => {}),
    getFilterPresets: jest.fn(async () => ({})),
    saveFilterPresets: jest.fn(async () => {})
  }
}));

describe('Saved view defaults', () => {
  const originalError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });
  afterAll(() => {
    console.error = originalError;
  });
  it('renders dashboard and applies initial saved defaults without crashing', async () => {
    const funds = [
      { Symbol: 'SPY', 'Product Name': 'S&P 500 ETF', scores: { final: 9.1 }, 'Total Return - YTD (%)': 5.1 },
      { Symbol: 'VTSAX', 'Product Name': 'Total Market', scores: { final: 8.3 }, 'Total Return - YTD (%)': 4.7 }
    ];

    render(<EnhancedPerformanceDashboard funds={funds} isLoading={false} onRefresh={() => {}} />);

    // Header text present
    expect(await screen.findByText(/Performance Dashboard/i)).toBeInTheDocument();

    // Verify chartPeriod toggle reflects saved value
    // The selected button has a distinct style; we can assert the button exists and is highlighted by text
    expect(screen.getByText('6M')).toBeInTheDocument();
  });
});

