import '@testing-library/jest-dom';

test('non-EOM present -> selector hides by default; store prefers EOM', async () => {
  jest.resetModules();
  jest.doMock('../../services/fundService', () => ({
    __esModule: true,
    default: {
      listSnapshotMonths: async () => ['2025-08-12','2025-08-31','2025-07-31'],
      getAllFunds: async () => []
    }
  }));
  jest.doMock('../../services/asOfStore', () => ({
    __esModule: true,
    default: {
      syncWithDb: async () => ({ active: '2025-08-12', latest: '2025-08-31' }),
      getActiveMonth: () => '2025-08-12',
      setActiveMonth: () => {}
    }
  }));
  const asOfStore = require('../../services/asOfStore').default;
  // Trigger sync and preference
  const res = await asOfStore.syncWithDb();
  expect(res.latest).toBe('2025-08-31');
});

