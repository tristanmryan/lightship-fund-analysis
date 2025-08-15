describe('adaptive winsorization (flag-controlled)', () => {
  const env = { ...process.env };
  afterAll(() => { process.env = env; });

  test('adaptive winsor with qHi=0.95 clamps outlier more than static 0.99', () => {
    jest.resetModules();
    process.env.REACT_APP_ENABLE_WINSORIZATION = 'true';
    process.env.REACT_APP_ENABLE_ADAPTIVE_WINSOR = 'true';
    process.env.REACT_APP_WINSOR_Q_LO = '0.01';
    process.env.REACT_APP_WINSOR_Q_HI = '0.95';

    const scoring = require('../services/scoring');

    // Construct a class with many near-0 YTD returns and one very large outlier
    const peers = Array.from({ length: 50 }, (_, i) => ({
      ticker: `P${i}`,
      asset_class_name: 'Adaptive',
      isBenchmark: false,
      ytd_return: (i % 2 === 0) ? 0.1 : -0.1,
      one_year_return: 0, three_year_return: 0, five_year_return: 0, ten_year_return: 0,
      sharpe_ratio: 0.5, standard_deviation_3y: 10, standard_deviation_5y: 12, expense_ratio: 0.5, alpha: 0,
      manager_tenure: 5, up_capture_ratio: 100, down_capture_ratio: 100
    }));
    const outlier = {
      ticker: 'OUT', asset_class_name: 'Adaptive', isBenchmark: false,
      ytd_return: 10, // extreme outlier
      one_year_return: 0, three_year_return: 0, five_year_return: 0, ten_year_return: 0,
      sharpe_ratio: 0.5, standard_deviation_3y: 10, standard_deviation_5y: 12, expense_ratio: 0.5, alpha: 0,
      manager_tenure: 5, up_capture_ratio: 100, down_capture_ratio: 100
    };

    const funds = [...peers, outlier];
    const scoredAdaptive = scoring.calculateScores(funds);
    const outA = scoredAdaptive.find(f => f.ticker === 'OUT');

    // Static (adaptive OFF, still winsor ON with 0.99 qHi per metric default for YTD)
    jest.resetModules();
    process.env.REACT_APP_ENABLE_WINSORIZATION = 'true';
    process.env.REACT_APP_ENABLE_ADAPTIVE_WINSOR = 'false';
    const scoringStatic = require('../services/scoring');
    const scoredStatic = scoringStatic.calculateScores(funds);
    const outS = scoredStatic.find(f => f.ticker === 'OUT');

    // Expect adaptive (qHi=0.95) to clamp more -> final score lower than static 0.99 clamp
    expect(outA.scores.final).toBeLessThan(outS.scores.final);
  });
});

