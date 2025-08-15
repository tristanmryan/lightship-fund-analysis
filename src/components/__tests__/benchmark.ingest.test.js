import '@testing-library/jest-dom';

test('fund vs benchmark rows route to respective tables', async () => {
  const upserts = { fund: [], bench: [] };
  jest.resetModules();
  jest.doMock('../../services/supabase', () => ({
    __esModule: true,
    TABLES: {
      FUND_PERFORMANCE: 'fund_performance',
      BENCHMARK_PERFORMANCE: 'benchmark_performance'
    },
    dbUtils: {
      cleanSymbol: (s) => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''),
      formatDateOnly: (d) => (typeof d === 'string' ? d : '2025-07-31'),
      parseMetricNumber: (v) => (v == null || v === '' ? null : Number(String(v).replace(/[%]/g, '')))
    },
    supabase: {
      from: (table) => ({
        upsert: async (rows) => {
          if (table === 'fund_performance') upserts.fund.push(...rows);
          if (table === 'benchmark_performance') upserts.bench.push(...rows);
          return { error: null };
        },
        select: () => ({
          eq: () => ({
            limit: async () => ({ data: [], error: null })
          })
        })
      })
    },
    handleSupabaseError: (e) => { throw e; }
  }));

  const fundService = require('../../services/fundService').default;

  const rows = [
    { ticker: 'ABCX', date: '2025-07-31', ytd_return: '10%' , kind: 'fund' },
    { ticker: 'IWF', kind: 'benchmark', date: '2025-07-31', ytd_return: '12%' }
  ];

  const res = await fundService.bulkUpsertFundPerformance(rows, 100);
  expect(res.success).toBe(2);
  expect(upserts.fund.length).toBe(1);
  expect(upserts.fund[0].fund_ticker).toBe('ABCX');
  expect(upserts.bench.length).toBe(1);
  expect(upserts.bench[0].benchmark_ticker).toBe('IWF');
});

