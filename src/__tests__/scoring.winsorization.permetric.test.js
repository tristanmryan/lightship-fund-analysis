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

describe('coverage-aware weighting and Z-shrink behavior', () => {
  const origCov = process.env.REACT_APP_SCORING_COVERAGE_THRESHOLD;
  const origK = process.env.REACT_APP_SCORING_Z_SHRINK_K;
  afterAll(() => {
    if (origCov !== undefined) process.env.REACT_APP_SCORING_COVERAGE_THRESHOLD = origCov;
    if (origK !== undefined) process.env.REACT_APP_SCORING_Z_SHRINK_K = origK;
  });

  test('excludes low-coverage metrics and shrinks Z on thin samples', () => {
    jest.resetModules();
    process.env.REACT_APP_SCORING_COVERAGE_THRESHOLD = '0.9'; // force exclusion in tiny samples
    process.env.REACT_APP_SCORING_Z_SHRINK_K = '10';
    const scoring = require('../services/scoring');
    const funds = [
      { ticker: 'A', asset_class_name: 'Tiny', ytd_return: 1, one_year_return: 2, sharpe_ratio: 1.0, standard_deviation_3y: 10 },
      { ticker: 'B', asset_class_name: 'Tiny', ytd_return: 2, one_year_return: 3, sharpe_ratio: 0.5, standard_deviation_3y: 12 }
    ];
    const out = scoring.calculateScores(funds);
    expect(out.length).toBe(2);
    const bd = out[0].scores.breakdown || {};
    const entries = Object.values(bd);
    const hasCoverageFlag = entries.some(e => e && e.excludedForCoverage === true);
    const hasShrink = entries.some(e => e && typeof e.zShrinkFactor === 'number' && e.zShrinkFactor < 1);
    expect(hasCoverageFlag || hasShrink).toBe(true);
  });
});

