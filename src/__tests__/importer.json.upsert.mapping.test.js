import '@testing-library/jest-dom';

test('JSON upsert uses normalized keys and includes ytd_return in payload', async () => {
  const upserts = { fund: [], bench: [] };
  jest.resetModules();
  jest.doMock('../services/supabase', () => ({
    __esModule: true,
    TABLES: {
      FUND_PERFORMANCE: 'fund_performance',
      BENCHMARK_PERFORMANCE: 'benchmark_performance'
    },
    toNumberStrict: (v) => {
      if (v === null || v === undefined) return null;
      if (typeof v === 'number') return Number.isFinite(v) ? v : null;
      const s = String(v).trim();
      if (s === '' || /^(-|n\/a|na|null|—|–)$/i.test(s)) return null;
      const isParenNegative = /^\(.*\)$/.test(s);
      let t = s.replace(/^\(|\)$/g, '');
      t = t.replace(/%/g, '').replace(/,/g, '');
      const n = Number(t);
      if (!Number.isFinite(n)) return null;
      return isParenNegative ? -n : n;
    },
    dbUtils: {
      cleanSymbol: (s) => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''),
      formatDateOnly: (d) => (typeof d === 'string' ? d : '2025-07-31'),
      parseMetricNumber: (v) => {
        if (v === null || v === undefined) return null;
        if (typeof v === 'number') return Number.isFinite(v) ? v : null;
        const s = String(v).trim();
        if (s === '' || /^(-|n\/a|na|null|—|–)$/i.test(s)) return null;
        const isParenNegative = /^\(.*\)$/.test(s);
        let t = s.replace(/^\(|\)$/g, '');
        t = t.replace(/%/g, '').replace(/,/g, '');
        const n = Number(t);
        if (!Number.isFinite(n)) return null;
        return isParenNegative ? -n : n;
      }
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

  const fundService = require('../services/fundService').default;

  const rows = [
    { ticker: 'AAA', date: '2025-07-31', ytd_return: '10%', kind: 'fund' }
  ];

  const res = await fundService.bulkUpsertFundPerformance(rows, 100);
  expect(res.success).toBe(1);
  expect(upserts.fund.length).toBe(1);
  expect(upserts.fund[0].fund_ticker).toBe('AAA');
  expect(upserts.fund[0].ytd_return).toBe(10);
});

