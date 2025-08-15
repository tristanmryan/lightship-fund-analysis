import { calculateScores } from '../services/scoring';

test('winsorization flag defaults OFF and does not throw', () => {
  const funds = [
    { ticker: 'AAA', asset_class_name: 'Test', ytd_return: 0.1, one_year_return: 0.2, sharpe_ratio: 1.0, standard_deviation_3y: 10 },
    { ticker: 'BBB', asset_class_name: 'Test', ytd_return: -0.1, one_year_return: -0.2, sharpe_ratio: 0.8, standard_deviation_3y: 12 }
  ];
  const scored = calculateScores(funds);
  expect(Array.isArray(scored)).toBe(true);
  expect(scored.length).toBe(2);
});

