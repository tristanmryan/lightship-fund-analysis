import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import UnifiedFundTable from '../components/common/UnifiedFundTable';

test('shows a negative contributor badge when score < 45', () => {
  const funds = [{
    ticker: 'NEG', name: 'Negative Fund', asset_class_name: 'Test',
    scores: {
      final: 40,
      breakdown: {
        expenseRatio: { reweightedContribution: -0.75 },
        sharpeRatio3Y: { reweightedContribution: 0.25 }
      }
    }
  }];
  render(<UnifiedFundTable funds={funds} />);
  expect(screen.getByText(/Negative Fund/)).toBeInTheDocument();
  // look for a chip with a leading minus sign
  expect(screen.getByText(/−0\.75/)).toBeInTheDocument();
});

