import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import AdvancedFilters from '../components/Dashboard/AdvancedFilters';

test('renders when initialFilters is undefined', async () => {
  render(<AdvancedFilters funds={[]} onFilterChange={() => {}} initialFilters={undefined} />);
  expect(await screen.findByText(/Advanced Filters/i)).toBeInTheDocument();
});

test('renders when nested objects are missing', async () => {
  const partial = { search: 'spy' }; // missing timePerformance and scoreRange
  render(<AdvancedFilters funds={[]} onFilterChange={() => {}} initialFilters={partial} />);
  expect(await screen.findByText(/Advanced Filters/i)).toBeInTheDocument();
});

test('chip/count guards do not crash with empty filters', async () => {
  render(<AdvancedFilters funds={[]} onFilterChange={() => {}} initialFilters={{}} />);
  // the count badge may be absent (0), but header text should still render
  expect(await screen.findByText(/Advanced Filters/i)).toBeInTheDocument();
});

