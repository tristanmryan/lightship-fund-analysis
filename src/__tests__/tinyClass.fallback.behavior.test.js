describe('tiny-class fallback behavior', () => {
  const originalTiny = process.env.REACT_APP_ENABLE_TINY_CLASS_FALLBACK;
  const origMinPeers = process.env.REACT_APP_TINY_CLASS_MIN_PEERS;
  const origNeutral = process.env.REACT_APP_TINY_CLASS_NEUTRAL_THRESHOLD;
  const origShrink = process.env.REACT_APP_TINY_CLASS_SHRINK;

  afterAll(() => {
    process.env.REACT_APP_ENABLE_TINY_CLASS_FALLBACK = originalTiny;
    process.env.REACT_APP_TINY_CLASS_MIN_PEERS = origMinPeers;
    process.env.REACT_APP_TINY_CLASS_NEUTRAL_THRESHOLD = origNeutral;
    process.env.REACT_APP_TINY_CLASS_SHRINK = origShrink;
  });

  test('neutralizes to ~50 when peers <= neutral threshold', () => {
    jest.resetModules();
    process.env.REACT_APP_ENABLE_TINY_CLASS_FALLBACK = 'true';
    process.env.REACT_APP_TINY_CLASS_MIN_PEERS = '5';
    process.env.REACT_APP_TINY_CLASS_NEUTRAL_THRESHOLD = '2';
    process.env.REACT_APP_TINY_CLASS_SHRINK = '0.25';

    const scoring = require('../services/scoring');
    const funds = [
      { ticker: 'A', asset_class_name: 'Sparse', ytd_return: 10, one_year_return: 12, sharpe_ratio: 1.2, standard_deviation_3y: 12 },
      { ticker: 'B', asset_class_name: 'Sparse', ytd_return: -10, one_year_return: -12, sharpe_ratio: 0.8, standard_deviation_3y: 10 }
    ];
    const out = scoring.calculateScores(funds);
    expect(out).toHaveLength(2);
    // Both should be pulled to about neutral when min peer count (2) <= neutral threshold (2)
    for (const f of out) {
      expect(f.scores.final).toBeGreaterThanOrEqual(45);
      expect(f.scores.final).toBeLessThanOrEqual(55);
    }
  });
});

