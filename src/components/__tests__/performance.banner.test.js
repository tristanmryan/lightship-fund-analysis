import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('../../services/preferencesService', () => ({
  __esModule: true,
  default: { getViewDefaults: async () => ({}), saveViewDefaults: async () => {} }
}));
jest.mock('../../services/fundService', () => ({
  __esModule: true,
  default: { listSnapshotMonths: async () => ['2025-07-31'] }
}));
jest.mock('../../services/supabase', () => ({
  __esModule: true,
  supabase: { from: () => ({ select: () => ({ eq: () => ({ data: [] }) }) }) },
  TABLES: { FUND_PERFORMANCE: 'fund_performance', BENCHMARK_PERFORMANCE: 'benchmark_performance' }
}));

import EnhancedPerformanceDashboard from '../../components/Dashboard/EnhancedPerformanceDashboard';
import { waitFor } from '@testing-library/react';

test('shows yellow banner when fund rows are zero and benchmark rows exist', async () => {
  // Override bench query to return rows
  const supa = require('../../services/supabase');
  supa.supabase.from = (t) => ({
    select: () => ({ eq: () => ({ data: t === 'benchmark_performance' ? [{ benchmark_ticker: 'IWF' }] : [] }) })
  });
  render(<EnhancedPerformanceDashboard funds={[]} onRefresh={()=>{}} isLoading={false} asOfMonth={'2025-07-31'} onAsOfMonthChange={()=>{}} />);
  await waitFor(() => {
    expect(screen.getByText(/No fund rows for this month/i)).toBeInTheDocument();
  });
});

test('no banner when fund rows exist', async () => {
  const supa = require('../../services/supabase');
  supa.supabase.from = (t) => ({ select: () => ({ eq: () => ({ data: t === 'fund_performance' ? [{ fund_ticker: 'AAA' }] : [] }) }) });
  render(<EnhancedPerformanceDashboard funds={[]} onRefresh={()=>{}} isLoading={false} asOfMonth={'2025-07-31'} onAsOfMonthChange={()=>{}} />);
  const el = screen.queryByText(/No fund rows for this month/i);
  expect(el).toBeNull();
});

