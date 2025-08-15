describe('robust scaling with band anchors preserves order and compresses extremes', () => {
  const env = { ...process.env };
  afterAll(() => { process.env = env; });

  test('scores remain monotonic with robust scaling', () => {
    jest.resetModules();
    process.env.REACT_APP_ENABLE_ROBUST_SCALING = 'true';
    const scoring = require('../services/scoring');
    // Straightforward monotone raw: use sharpe ratio as only differentiator
    const mk = (v) => ({
      ticker: `F${v}`,
      asset_class: 'Monotone', isBenchmark: false,
      ytd_return: 0, one_year_return: 0, three_year_return: 0, five_year_return: 0, ten_year_return: 0,
      sharpe_ratio: v,
      standard_deviation_3y: 10, standard_deviation_5y: 12, expense_ratio: 0.5, alpha: 0, manager_tenure: 5,
      up_capture_ratio: 100, down_capture_ratio: 100
    });
    const funds = Array.from({ length: 20 }, (_, i) => mk(i * 0.1));
    const out = scoring.calculateScores(funds);
    for (let i = 1; i < out.length; i++) {
      expect(out[i].scores.final).toBeGreaterThanOrEqual(out[i-1].scores.final);
    }
  });
});

