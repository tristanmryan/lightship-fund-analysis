import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import EnhancedFundTable from '../components/Dashboard/EnhancedFundTable';

test('table shows positive reasons and one negative chip for low-score fund', () => {
  const funds = [
    {
      Symbol: 'LOW', name: 'Low Score Fund', asset_class_name: 'Test',
      scores: {
        final: 40.0,
        breakdown: {
          ytd: { reweightedContribution: 0.50 },
          oneYear: { reweightedContribution: 0.40 },
          expenseRatio: { reweightedContribution: -0.60 },
          stdDev3Y: { reweightedContribution: -0.20 }
        }
      }
    }
  ];

  render(
    <EnhancedFundTable
      funds={funds}
      onFundSelect={() => {}}
      chartPeriod="1Y"
      initialSortConfig={[{ key: 'score', direction: 'desc' }]}
    />
  );

  // Positive reasons
  expect(screen.getByText('+0.50 YTD Return')).toBeInTheDocument();
  expect(screen.getByText('+0.40 1-Year Return')).toBeInTheDocument();
  // One negative chip rendered (either expense or std dev depending on ordering)
  const negChips = screen.getAllByText(/−0\.(60|20) /);
  expect(negChips.length).toBeGreaterThanOrEqual(1);
});

