describe('robust scaling mapping (flag-controlled)', () => {
  const orig = process.env.REACT_APP_ENABLE_ROBUST_SCALING;
  afterAll(() => { process.env.REACT_APP_ENABLE_ROBUST_SCALING = orig; });

  test('enabling robust scaling changes final scores for the same inputs', () => {
    // Build a class with 20 funds with varying sharpe_ratio to produce spread
    const mk = (i) => ({
      ticker: `F${i}`,
      asset_class: 'RobustClass',
      isBenchmark: false,
      ytd_return: 0,
      one_year_return: 0,
      three_year_return: 0,
      five_year_return: 0,
      ten_year_return: 0,
      sharpe_ratio: (i - 10) * 0.1, // -1.0 .. +0.9
      standard_deviation_3y: 10,
      standard_deviation_5y: 12,
      expense_ratio: 0.5,
      alpha: 0,
      manager_tenure: 5,
      up_capture_ratio: 100,
      down_capture_ratio: 100
    });
    const funds = Array.from({ length: 20 }, (_, i) => mk(i));

    // OFF
    jest.resetModules();
    process.env.REACT_APP_ENABLE_ROBUST_SCALING = 'false';
    const scoringA = require('../services/scoring');
    const outA = scoringA.calculateScores(funds);
    const finalsA = outA.map(f => f.scores.final);

    // ON
    jest.resetModules();
    process.env.REACT_APP_ENABLE_ROBUST_SCALING = 'true';
    const scoringB = require('../services/scoring');
    const outB = scoringB.calculateScores(funds);
    const finalsB = outB.map(f => f.scores.final);

    // Expect some difference in mapping
    const anyDiff = finalsA.some((v, idx) => v !== finalsB[idx]);
    expect(anyDiff).toBe(true);
  });
});

