import { computeRuntimeScores, loadEffectiveWeightsResolver } from '../services/scoring';
import scoringProfilesService from '../services/scoringProfilesService';

jest.mock('../services/scoringProfilesService');

describe('scoring uses resolver weights and preserves reweighting', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    scoringProfilesService.getProfileByNameOrId.mockResolvedValue({ id: 'p1', name: 'Default' });
    scoringProfilesService.getDefaultProfile.mockResolvedValue({ id: 'p1', name: 'Default' });
  });

  test('changing oneYear weight via resolver changes scores', async () => {
    scoringProfilesService.listWeights.mockResolvedValue([
      { profile_id: 'p1', metric_key: 'oneYear', scope: 'global', scope_value: null, weight: 0.5, enabled: true }
    ]);
    await loadEffectiveWeightsResolver();

    const mk = (one) => ({ asset_class: 'LCG', isBenchmark: false, ticker: `T${one}`,
      ytd_return: 0, one_year_return: one, three_year_return: 0, five_year_return: 0, ten_year_return: 0,
      sharpe_ratio: 0.5, standard_deviation_3y: 10, standard_deviation_5y: 12, expense_ratio: 0.5, alpha: 0, manager_tenure: 5 });
    const s1 = computeRuntimeScores([mk(5), mk(10)]);
    const f1 = s1.find(f => f.ticker === 'T10');
    const w1 = f1.scores.breakdown.oneYear.weight;

    scoringProfilesService.listWeights.mockResolvedValue([
      { profile_id: 'p1', metric_key: 'oneYear', scope: 'global', scope_value: null, weight: 0.1, enabled: true }
    ]);
    await loadEffectiveWeightsResolver();
    const s2 = computeRuntimeScores([mk(5), mk(10)]);
    const f2 = s2.find(f => f.ticker === 'T10');
    const w2 = f2.scores.breakdown.oneYear.weight;
    expect(w1).toBe(0.5);
    expect(w2).toBe(0.1);
  });

  test('reweighting still applies with resolver present', async () => {
    scoringProfilesService.listWeights.mockResolvedValue([]);
    await loadEffectiveWeightsResolver();

    const baseA = { asset_class: 'X', isBenchmark: false, ticker: 'A',
      ytd_return: 10, one_year_return: 10, three_year_return: 10, five_year_return: 10, ten_year_return: 10,
      sharpe_ratio: 1.0, standard_deviation_3y: 10, standard_deviation_5y: 10, up_capture_ratio: 100, down_capture_ratio: 100,
      alpha: 0.0, expense_ratio: 0.5, manager_tenure: 5 };
    const baseB = { ...baseA, ticker: 'B', standard_deviation_5y: null, up_capture_ratio: null, down_capture_ratio: null };
    const [a, b] = computeRuntimeScores([baseA, baseB]);
    expect(a.scores.final).toBeGreaterThan(0);
    expect(b.scores.final).toBeGreaterThan(0);
  });
});

