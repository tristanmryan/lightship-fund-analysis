import { calculateScores } from '../services/scoring';

test('Reweighting: missing a metric redistributes absolute weights over present ones', () => {
  const baseA = {
    asset_class: 'Test Class', isBenchmark: false, ticker: 'A',
    ytd_return: 10, one_year_return: 10, three_year_return: 10, five_year_return: 10, ten_year_return: 10,
    sharpe_ratio: 1.0, standard_deviation_3y: 10, standard_deviation_5y: 10, up_capture_ratio: 100, down_capture_ratio: 100,
    alpha: 0.0, expense_ratio: 0.5, manager_tenure: 5
  };
  // Fund B missing std dev 5y and captures
  const baseB = {
    ...baseA,
    ticker: 'B',
    standard_deviation_5y: null,
    up_capture_ratio: null,
    down_capture_ratio: null
  };
  const [a, b] = calculateScores([baseA, baseB]);
  expect(a.scores.final).toBeGreaterThan(0);
  expect(b.scores.final).toBeGreaterThan(0);
  // With reweighting, B should still have a reasonable score and not be zero due to missing metrics
});

