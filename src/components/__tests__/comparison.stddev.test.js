import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ComparisonPanel from '../Dashboard/ComparisonPanel';

test('ComparisonPanel renders Std Dev (3Y) and Std Dev (5Y) in metric column when a fund is selected', () => {
  const funds = [{
    ticker: 'AAA', name: 'Fund A', asset_class: 'LCB',
    standard_deviation_3y: 12.34, standard_deviation_5y: 15.67
  }];
  // Seed a saved set so the panel autoloads selection (matches component behavior)
  const initialSavedSets = { myset: { name: 'myset', tickers: ['AAA'] } };
  render(<ComparisonPanel funds={funds} initialSavedSets={initialSavedSets} />);
  expect(screen.getByText('Std Dev (3Y)')).toBeInTheDocument();
  expect(screen.getByText('Std Dev (5Y)')).toBeInTheDocument();
});

