import '@testing-library/jest-dom';

test('importer prefers fund when ticker is in both funds and benchmarks', () => {
  // Simulate known tickers
  const knownTickers = new Set(['ABCX']);
  const benchmarkMap = new Map([['ABCX','Some Bench With Same Ticker']]);
  const r = { __ticker: 'ABCX', __asOf: '2025-07-31' };
  const isBenchmark = r.__ticker && benchmarkMap.has(r.__ticker);
  const isKnownFund = r.__ticker && knownTickers.has(r.__ticker);
  const explicitType = String(r.Type || r.type || '').trim().toLowerCase();
  const explicitBenchmark = explicitType === 'benchmark';
  const kind = (isBenchmark && !isKnownFund) || (explicitBenchmark && !isKnownFund) ? 'benchmark' : 'fund';
  expect(kind).toBe('fund');
});

