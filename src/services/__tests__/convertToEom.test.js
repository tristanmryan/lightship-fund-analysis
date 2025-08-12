import '@testing-library/jest-dom';

test('convert-to-EOM merges when target exists', async () => {
  const movedRows = [];
  jest.resetModules();
  jest.doMock('../supabase', () => ({
    __esModule: true,
    TABLES: { FUND_PERFORMANCE: 'fund_performance' },
    dbUtils: { formatDateOnly: (d) => (typeof d === 'string' ? d : '2025-07-31') },
    supabase: {
      from: (table) => ({
        select: function() {
          return {
            eq: (col, val) => ({
              limit: (n) => ({ data: (col === 'date' && val === '2025-07-31') ? [{ fund_ticker: 'AAA' }] : [] }),
              then: (res) => res({ data: (col === 'date' && val === '2025-07-12') ? [{ id: '1', fund_ticker: 'BBB', date: '2025-07-12' }] : [] })
            }),
            maybeSingle: async () => ({ data: { fund_ticker: 'AAA' } })
          };
        },
        upsert: async (payload) => { movedRows.push(...payload); return { error: null }; },
        delete: function() { return { eq: async () => ({ error: null }) }; }
      })
    },
    handleSupabaseError: (e) => { throw e; }
  }));
  const fundService = require('../fundService').default;
  const res = await fundService.convertSnapshotToEom('2025-07-12');
  expect(res.merged).toBe(true);
  expect(movedRows.length).toBe(1);
  expect(movedRows[0].date).toBe('2025-07-31');
});

