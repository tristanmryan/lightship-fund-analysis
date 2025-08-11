import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DrilldownCards from '../Dashboard/DrilldownCards';

jest.mock('../../services/resolvers/benchmarkResolverClient', () => ({
  getPrimaryBenchmark: () => ({ ticker: 'BENCH', name: 'Bench' })
}));

test('Drilldown shows Std Dev (3Y) and Std Dev (5Y), with em dashes for missing', () => {
  const fund = {
    ticker: 'AAA',
    sharpe_ratio: 0.8,
    standard_deviation_3y: 12.34,
    standard_deviation_5y: null,
    beta: 1.0,
    alpha: 0.1
  };
  const bench = { ticker: 'BENCH', standard_deviation_3y: 13.0, standard_deviation_5y: 14.0 };
  render(<DrilldownCards fund={fund} funds={[bench]} />);
  expect(screen.getByText('Std Dev (3Y)')).toBeInTheDocument();
  expect(screen.getByText('12.34%')).toBeInTheDocument();
  expect(screen.getByText('Std Dev (5Y)')).toBeInTheDocument();
  // em dash should appear for missing 5Y
  expect(screen.getAllByText('—').length).toBeGreaterThan(0);
});

