describe('winsorization per-metric limits produce different clamps', () => {
  const orig = process.env.REACT_APP_ENABLE_WINSORIZATION;
  afterAll(() => { process.env.REACT_APP_ENABLE_WINSORIZATION = orig; });

  test('stdDev3Y clamps (~1.96) while upCapture3Y can remain ~2.00 for the same outlier', () => {
    jest.resetModules();
    process.env.REACT_APP_ENABLE_WINSORIZATION = 'true';
    const scoring = require('../services/scoring');

    // Five funds: one outlier, four near 0 so z ≈ 2.0 for the outlier
    const base = { asset_class_name: 'ClampDiff', up_capture_ratio: 0, standard_deviation_3y: 0 };
    const funds = [
      { ticker: 'X1', ...base, up_capture_ratio: 1000, standard_deviation_3y: 1000 }, // outlier
      { ticker: 'X2', ...base },
      { ticker: 'X3', ...base },
      { ticker: 'X4', ...base },
      { ticker: 'X5', ...base }
    ];

    const out = scoring.calculateScores(funds);
    // Find breakdown for first fund (positive extremes)
    const b0 = out[0].scores.breakdown || {};
    const upZ = b0.upCapture3Y?.zScore || 0;
    const sdZ = b0.stdDev3Y?.zScore || 0;
    // Expect std dev z to clamp to ~1.96 (p=0.975), while up-capture remains ~2.00 (p=0.98 allows >2)
    expect(sdZ).toBeLessThan(upZ);
    expect(sdZ).toBeGreaterThan(1.90);
    expect(upZ).toBeGreaterThanOrEqual(2.0);
  });
});

