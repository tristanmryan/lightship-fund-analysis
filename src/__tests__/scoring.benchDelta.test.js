describe('benchmark-delta derived metric (flag-controlled)', () => {
  const origEnable = process.env.REACT_APP_ENABLE_BENCH_DELTA;
  afterAll(() => { process.env.REACT_APP_ENABLE_BENCH_DELTA = origEnable; });

  test('when enabled and weighted, positive 1Y delta vs benchmark improves score', async () => {
    jest.resetModules();
    process.env.REACT_APP_ENABLE_BENCH_DELTA = 'true';
    const scoring = require('../services/scoring');
    // Increase weight for the derived delta metric for this test only
    await scoring.setMetricWeights({ oneYearDeltaVsBench: 0.05 });

    // Benchmark (class-level row)
    const bench = {
      ticker: 'SPY', isBenchmark: true, asset_class: 'LCB',
      one_year_return: 10,
      ytd_return: 0, three_year_return: 0, five_year_return: 0, ten_year_return: 0,
      sharpe_ratio: 0.5, standard_deviation_3y: 10, standard_deviation_5y: 12, expense_ratio: 0.5, alpha: 0, manager_tenure: 5,
      up_capture_ratio: 100, down_capture_ratio: 100
    };

    // Two funds identical except one has higher 1Y than benchmark
    const base = {
      asset_class: 'LCB', isBenchmark: false, primary_benchmark: 'SPY',
      ytd_return: 0, three_year_return: 0, five_year_return: 0, ten_year_return: 0,
      sharpe_ratio: 0.5, standard_deviation_3y: 10, standard_deviation_5y: 12, expense_ratio: 0.5, alpha: 0, manager_tenure: 5,
      up_capture_ratio: 100, down_capture_ratio: 100
    };
    const fNeg = { ...base, ticker: 'NEG', one_year_return: 8 };  // -2% delta vs bench
    const fPos = { ...base, ticker: 'POS', one_year_return: 12 }; // +2% delta vs bench

    const out = scoring.calculateScores([bench, fNeg, fPos]);
    const sNeg = out.find(f => f.ticker === 'NEG').scores.final;
    const sPos = out.find(f => f.ticker === 'POS').scores.final;
    expect(sPos).toBeGreaterThan(sNeg);
  });
});

