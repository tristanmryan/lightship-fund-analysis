import { calculateScores } from '../services/scoring';

// This is a smoke test to ensure fallback code path does not throw when flag is OFF (default)
test('tiny-class fallback flag defaults OFF and does not throw', () => {
  const funds = [
    { ticker: 'X1', asset_class_name: 'Sparse', ytd_return: 0.1, one_year_return: 0.2, sharpe_ratio: 1.0, standard_deviation_3y: 10 },
    { ticker: 'X2', asset_class_name: 'Sparse', ytd_return: -0.1, one_year_return: -0.2, sharpe_ratio: 0.8, standard_deviation_3y: 12 }
  ];
  const scored = calculateScores(funds);
  expect(Array.isArray(scored)).toBe(true);
  expect(scored.length).toBe(2);
});

