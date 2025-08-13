import '@testing-library/jest-dom';
import React from 'react';
import { render, act } from '@testing-library/react';

jest.mock('../../services/fundService', () => ({
  __esModule: true,
  default: {
    getAllFunds: async () => [],
    batchUpdateFromAPI: async (arr) => (arr || []).map((t) => ({ ticker: t, success: true }))
  }
}));
jest.mock('../../services/asOfStore', () => ({
  __esModule: true,
  default: {
    syncWithDb: async () => ({ active: null, latest: null }),
    getActiveMonth: () => null,
    setActiveMonth: () => {},
    subscribe: () => () => {}
  }
}));
jest.mock('../../services/supabase', () => ({
  __esModule: true,
  supabase: { from: () => ({ select: () => ({ order: () => ({ limit: () => ({ data: [], error: null }) }) }) }) },
  TABLES: { FUND_PERFORMANCE: 'fund_performance' },
  dbUtils: { formatDateOnly: (d) => (typeof d === 'string' ? d : '2025-07-31') }
}));

const { useFundData } = require('../../hooks/useFundData');

// Ensure refreshData guards against non-array inputs and empty states
test('refreshData tolerates empty filters and non-array tickers without throwing', async () => {
  // Bridge component to access hook
  function Bridge({ onReady }) {
    const api = useFundData();
    React.useEffect(() => { onReady(api); }, [onReady, api]);
    return null;
  }

  let api;
  render(<Bridge onReady={(x) => { api = x; }} />);

  // Let effects settle
  await act(async () => {});

  // No throws on null/undefined, string, or object filters
  await act(async () => { await api.refreshData(); });
  await act(async () => { await api.refreshData(undefined); });
  await act(async () => { await api.refreshData(''); });
  await act(async () => { await api.refreshData('growth'); });
  await act(async () => { await api.refreshData({ selectedTickers: undefined, assetClass: '', search: '' }); });
});

