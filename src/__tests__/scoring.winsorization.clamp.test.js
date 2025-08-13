describe('winsorization reduces extreme score spread when enabled', () => {
  const original = process.env.REACT_APP_ENABLE_WINSORIZATION;
  afterAll(() => { process.env.REACT_APP_ENABLE_WINSORIZATION = original; });

  test('enabled vs disabled comparison', () => {
    jest.resetModules();
    process.env.REACT_APP_ENABLE_WINSORIZATION = 'false';
    const scoringOff = require('../services/scoring');
    const funds = [
      { ticker: 'A', asset_class_name: 'Clamp', ytd_return: 1000, one_year_return: 1000, sharpe_ratio: 10, standard_deviation_3y: 1 },
      { ticker: 'B', asset_class_name: 'Clamp', ytd_return: -1000, one_year_return: -1000, sharpe_ratio: -10, standard_deviation_3y: 1 }
    ];
    const offScores = scoringOff.calculateScores(funds);

    jest.resetModules();
    process.env.REACT_APP_ENABLE_WINSORIZATION = 'true';
    const scoringOn = require('../services/scoring');
    const onScores = scoringOn.calculateScores(funds);

    const spreadOff = Math.abs((offScores[0].scores.final || 0) - (offScores[1].scores.final || 0));
    const spreadOn = Math.abs((onScores[0].scores.final || 0) - (onScores[1].scores.final || 0));
    expect(spreadOn).toBeLessThanOrEqual(spreadOff);
  });
});

