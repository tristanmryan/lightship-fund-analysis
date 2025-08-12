import '@testing-library/jest-dom';

import React from 'react';
import { render, act } from '@testing-library/react';

test('refresh in production does not write or create snapshots', async () => {
  process.env.REACT_APP_ENABLE_REFRESH = 'false';
  jest.doMock('../../services/fundService', () => ({
    __esModule: true,
    default: {
      getAllFunds: async () => [],
      batchUpdateFromAPI: async () => { throw new Error('Should not be called'); }
    }
  }));
  jest.doMock('../../services/supabase', () => ({
    __esModule: true,
    supabase: { from: () => ({ select: () => ({ order: () => ({ limit: () => ({ data: [], error: null }) }) }) }) },
    TABLES: { FUND_PERFORMANCE: 'fund_performance' },
    dbUtils: { formatDateOnly: (d) => (typeof d === 'string' ? d : '2025-07-31') }
  }));
  jest.doMock('../../services/asOfStore', () => ({
    __esModule: true,
    default: {
      syncWithDb: async () => ({ active: null, latest: null }),
      getActiveMonth: () => '2025-07-31',
      setActiveMonth: () => {}
    }
  }));
  // React already imported above
  const { useFundData } = require('../../hooks/useFundData');
  function Bridge({ onReady }) {
    const api = useFundData();
    React.useEffect(() => { onReady(api); }, [api, onReady]);
    return null;
  }
  let api;
  render(<Bridge onReady={(x)=>{ api = x; }} />);
  await act(async () => {});
  await act(async () => { await api.refreshData(); });
});

