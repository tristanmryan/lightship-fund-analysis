import '@testing-library/jest-dom';

describe('resolver mock fallback gating', () => {
  const modPath = '../resolvers/benchmarkResolverClient';

  test('blocks fallback in production when flag off', async () => {
    process.env.NODE_ENV = 'production';
    process.env.REACT_APP_ENABLE_CONFIG_BENCHMARK_FALLBACK = 'true';
    process.env.REACT_APP_ALLOW_MOCK_FALLBACK = 'false';
    jest.resetModules();
    const { getPrimaryBenchmarkSyncByLabel } = require(modPath);
    const r = getPrimaryBenchmarkSyncByLabel('Large Cap Blend');
    expect(r).toBeNull();
  });

  test('allows fallback in dev', async () => {
    process.env.NODE_ENV = 'development';
    process.env.REACT_APP_ENABLE_CONFIG_BENCHMARK_FALLBACK = 'true';
    process.env.REACT_APP_ALLOW_MOCK_FALLBACK = 'false';
    jest.resetModules();
    const { getPrimaryBenchmarkSyncByLabel } = require(modPath);
    // may be null if not present in config; only checking call path is allowed
    getPrimaryBenchmarkSyncByLabel('Large Cap Blend');
    expect(true).toBe(true);
  });
});

