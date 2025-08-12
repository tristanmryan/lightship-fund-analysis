import { buildWeightsResolver } from '../services/resolvers/scoringWeightsResolver';
import scoringProfilesService from '../services/scoringProfilesService';

jest.mock('../services/scoringProfilesService');

describe('scoringWeightsResolver precedence', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('falls back to defaults when no DB rows', async () => {
    scoringProfilesService.getProfileByNameOrId.mockResolvedValue(null);
    scoringProfilesService.getDefaultProfile.mockResolvedValue(null);
    scoringProfilesService.listWeights.mockResolvedValue([]);

    const resolver = await buildWeightsResolver();
    const fund = { ticker: 'ABC', asset_class_name: 'Large Cap Growth' };
    expect(typeof resolver.getWeightFor(fund, 'oneYear')).toBe('number');
  });

  test('precedence: fund > class > global > default', async () => {
    scoringProfilesService.getProfileByNameOrId.mockResolvedValue({ id: 'p1', name: 'Default' });
    scoringProfilesService.getDefaultProfile.mockResolvedValue({ id: 'p1', name: 'Default' });
    scoringProfilesService.listWeights.mockResolvedValue([
      { profile_id: 'p1', metric_key: 'oneYear', scope: 'global', scope_value: null, weight: 0.11, enabled: true },
      { profile_id: 'p1', metric_key: 'oneYear', scope: 'asset_class', scope_value: 'Large Cap Growth', weight: 0.22, enabled: true },
      { profile_id: 'p1', metric_key: 'oneYear', scope: 'fund', scope_value: 'ABC', weight: 0.33, enabled: true }
    ]);

    const resolver = await buildWeightsResolver();
    const fundA = { ticker: 'ABC', asset_class_name: 'Large Cap Growth' };
    const fundB = { ticker: 'XYZ', asset_class_name: 'Large Cap Growth' };
    const fundC = { ticker: 'ZZZ', asset_class_name: 'Small Cap Growth' };

    expect(resolver.getWeightFor(fundA, 'oneYear')).toBe(0.33);
    expect(resolver.getWeightFor(fundB, 'oneYear')).toBe(0.22);
    expect(resolver.getWeightFor(fundC, 'oneYear')).toBe(0.11);
  });
});

