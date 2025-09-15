import '@testing-library/jest-dom';

// Mock Supabase module with an in-memory table to verify persistence of zero weights
jest.mock('../supabase.js', () => {
  const db = { rows: [] };
  const resolved = (data = null) => Promise.resolve({ data, error: null });
  const supabase = {
    from: (table) => ({
      select: () => ({
        eq: (field, val) => {
          if (table !== 'scoring_weights_simple') return resolved([]);
          const data = db.rows
            .filter((r) => r.asset_class_id === val)
            .map(({ metric_key, weight }) => ({ metric_key, weight }));
          return resolved(data);
        },
        in: () => resolved([]),
      }),
      delete: () => ({
        eq: (field, val) => {
          if (table === 'scoring_weights_simple') {
            db.rows = db.rows.filter((r) => r.asset_class_id !== val);
          }
          return resolved();
        },
      }),
      insert: (records) => {
        if (table === 'scoring_weights_simple') {
          db.rows.push(...records);
        }
        return resolved();
      },
      update: () => resolved(),
    }),
    rpc: () => resolved([]),
  };
  return { supabase };
});

import { getWeightsForAssetClass, saveAssetClassWeights, getGlobalDefaultWeights } from '../weightService.js';

describe('weightService zero-weight persistence', () => {
  const ASSET_CLASS_ID = 'ac_equity_large_growth';

  test('persists zero weights and returns them on load', async () => {
    const defaults = getGlobalDefaultWeights();
    // Sanity checks from registry
    expect(defaults.one_year_return).toBeGreaterThan(0);
    expect(defaults.alpha).toBeGreaterThan(0);

    // Create overrides that explicitly set previously non-zero metrics to zero
    const overrides = { ...defaults, one_year_return: 0, alpha: 0 };

    // Save to DB
    await expect(saveAssetClassWeights(ASSET_CLASS_ID, overrides)).resolves.toBe(true);

    // Load back
    const loaded = await getWeightsForAssetClass(ASSET_CLASS_ID);

    // Expect zeros to be preserved as explicit overrides
    expect(loaded.one_year_return).toBe(0);
    expect(loaded.alpha).toBe(0);

    // Unchanged metrics should match defaults
    expect(loaded.sharpe_ratio).toBe(defaults.sharpe_ratio);
  });
});

