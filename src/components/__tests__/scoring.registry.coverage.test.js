import '@testing-library/jest-dom';
import { METRICS as REGISTRY } from '../../services/metricsRegistry.js';

describe('metricsRegistry coverage-driven selector logic', () => {
  test('filters options to metrics with non-zero coverage', () => {
    // Simulate coverage map and weights
    const weights = Object.fromEntries(Object.keys(REGISTRY).map(k => [k, 0]));
    const coverageMap = Object.fromEntries(Object.keys(REGISTRY).map(k => [k, 0]));
    coverageMap.one_year_return = 0.75; // available
    coverageMap.expense_ratio = 0; // no data

    const options = Object.keys(REGISTRY)
      .filter((k) => (weights?.[k] ?? 0) === 0)
      .map((k) => ({ key: k, label: REGISTRY[k].label, coverage: coverageMap?.[k] ?? 0 }))
      .filter((o) => o.coverage > 0)
      .sort((a, b) => b.coverage - a.coverage || a.label.localeCompare(b.label));

    const keys = options.map(o => o.key);
    expect(keys).toContain('one_year_return');
    // A metric with zero coverage should not be present
    expect(keys).not.toContain('expense_ratio');
  });
});

