import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DrilldownCards from '../components/Dashboard/DrilldownCards';

jest.mock('../services/resolvers/benchmarkResolverClient', () => ({
  getPrimaryBenchmark: () => ({ ticker: 'IWF', name: 'Russell 1000 Growth' })
}));

test('DrilldownCards renders placeholders for missing and values for present metrics', () => {
  const fund = {
    ticker: 'JQUA', sharpe_ratio: 0.9, standard_deviation: 18.8, beta: 0.95, alpha: 0.1,
    up_capture_ratio: null, down_capture_ratio: 96.1, expense_ratio: 0.12, manager_tenure: 1.27
  };
  const bench = { ticker: 'IWF', sharpe_ratio: 0.8, standard_deviation: 19.3, beta: 1.02, alpha: 0.0, up_capture_ratio: 104.5, down_capture_ratio: 98.1, expense_ratio: 0.19 };
  const funds = [bench];

  render(<DrilldownCards fund={fund} funds={funds} />);
  expect(screen.getByText('Risk')).toBeInTheDocument();
  expect(screen.getByText('Capture (3Y)')).toBeInTheDocument();
  expect(screen.getByText('Fees & Other')).toBeInTheDocument();
  // Present metric rendered (e.g., Sharpe)
  expect(screen.getByText('0.90')).toBeInTheDocument();
  // Placeholder for missing (Up Capture)
  expect(screen.getAllByText('—').length).toBeGreaterThan(0);
});

