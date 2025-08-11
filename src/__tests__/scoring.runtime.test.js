import { computeRuntimeScores } from '../services/scoring';

function clone(obj) { return JSON.parse(JSON.stringify(obj)); }

describe('Runtime Scoring (flag-independent unit tests)', () => {
  test('two funds same asset class: higher Sharpe and lower expense scores higher', () => {
    const base = {
      asset_class: 'Large Cap Blend',
      isBenchmark: false,
      ytd_return: 5,
      one_year_return: 10,
      three_year_return: 7,
      five_year_return: 6,
      ten_year_return: 5,
      standard_deviation_3y: 15,
      standard_deviation_5y: 16,
      up_capture_ratio: 100,
      down_capture_ratio: 100,
      alpha: 0,
      manager_tenure: 5
    };
    const fundA = { ...clone(base), ticker: 'AAA', sharpe_ratio: 0.8, expense_ratio: 0.50 };
    const fundB = { ...clone(base), ticker: 'BBB', sharpe_ratio: 1.2, expense_ratio: 0.20 };
    const scored = computeRuntimeScores([fundA, fundB]);
    const a = scored.find(f => f.ticker === 'AAA');
    const b = scored.find(f => f.ticker === 'BBB');
    expect(a.scores?.final).toBeGreaterThan(0);
    expect(b.scores?.final).toBeGreaterThan(0);
    expect(b.scores.final).toBeGreaterThan(a.scores.final);
  });

  test('capture mapping affects score direction', () => {
    const f1 = {
      asset_class: 'Asset Allocation', isBenchmark: false, ticker: 'C1',
      ytd_return: 0, one_year_return: 0, three_year_return: 0, five_year_return: 0, ten_year_return: 0,
      sharpe_ratio: 0.5, standard_deviation_3y: 10, standard_deviation_5y: 12, expense_ratio: 0.5, alpha: 0, manager_tenure: 5,
      up_capture_ratio: 120, down_capture_ratio: 80
    };
    const f2 = {
      asset_class: 'Asset Allocation', isBenchmark: false, ticker: 'C2',
      ytd_return: 0, one_year_return: 0, three_year_return: 0, five_year_return: 0, ten_year_return: 0,
      sharpe_ratio: 0.5, standard_deviation_3y: 10, standard_deviation_5y: 12, expense_ratio: 0.5, alpha: 0, manager_tenure: 5,
      up_capture_ratio: 80, down_capture_ratio: 120
    };
    const scored = computeRuntimeScores([f1, f2]);
    const c1 = scored.find(f => f.ticker === 'C1');
    const c2 = scored.find(f => f.ticker === 'C2');
    expect(c1.scores.final).toBeGreaterThan(c2.scores.final);
  });

  test('as-of recompute concept: changing inputs changes score', () => {
    const mk = (oneYear) => ({
      asset_class: 'Large Cap Growth', isBenchmark: false, ticker: `X${oneYear}`,
      ytd_return: 0, one_year_return: oneYear, three_year_return: 0, five_year_return: 0, ten_year_return: 0,
      sharpe_ratio: 0.5, standard_deviation_3y: 10, standard_deviation_5y: 12, expense_ratio: 0.5, alpha: 0, manager_tenure: 5
    });
    const mA = computeRuntimeScores([mk(5), mk(10)]);
    const mB = computeRuntimeScores([mk(10), mk(15)]);
    const scoreA = mA.find(f => f.ticker === 'X10').scores.final;
    const scoreB = mB.find(f => f.ticker === 'X10').scores.final;
    expect(scoreB).not.toBe(scoreA);
  });
});

// Flag OFF behavior (smoke): ensure computeRuntimeScores is not required in UI when flag is off
describe('Runtime Scoring flag OFF (smoke)', () => {
  test('computeRuntimeScores is pure and does not throw with empty', () => {
    expect(computeRuntimeScores([])).toEqual([]);
  });
});

