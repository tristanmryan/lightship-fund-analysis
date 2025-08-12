import '@testing-library/jest-dom';

describe('asOfStore', () => {
  const asOfStore = require('../asOfStore').default;

  beforeEach(() => {
    // Reset test dates and active
    asOfStore.__setDbDatesForTest(['2025-07-31', '2025-06-30']);
    asOfStore.setActiveMonth(null);
  });

  test('picks latest when active not in DB', async () => {
    asOfStore.setActiveMonth('2020-01-31');
    const res = await asOfStore.syncWithDb();
    expect(res.active).toBe('2025-07-31');
    expect(res.latest).toBe('2025-07-31');
  });

  test('post-import sets active month', async () => {
    asOfStore.setActiveMonth('2025-06-30');
    await asOfStore.syncWithDb();
    expect(asOfStore.getActiveMonth()).toBe('2025-07-31');
    asOfStore.setActiveMonth('2025-06-30');
    expect(asOfStore.getActiveMonth()).toBe('2025-06-30');
  });
});

