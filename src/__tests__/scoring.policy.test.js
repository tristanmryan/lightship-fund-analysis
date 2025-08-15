import { isWinsorizationEnabled, getAdaptiveWinsorQuantiles, getCoverageThreshold, getZShrinkK, isRobustScalingEnabled } from '../services/scoringPolicy';

test('policy helpers read flags and thresholds with defaults', () => {
  const save = { ...process.env };
  delete process.env.REACT_APP_ENABLE_WINSORIZATION;
  delete process.env.REACT_APP_ENABLE_ADAPTIVE_WINSOR;
  delete process.env.REACT_APP_WINSOR_Q_LO;
  delete process.env.REACT_APP_WINSOR_Q_HI;
  delete process.env.REACT_APP_SCORING_COVERAGE_THRESHOLD;
  delete process.env.REACT_APP_SCORING_Z_SHRINK_K;
  delete process.env.REACT_APP_ENABLE_ROBUST_SCALING;

  expect(isWinsorizationEnabled()).toBe(false);
  expect(isRobustScalingEnabled()).toBe(false);
  const { qLo, qHi } = getAdaptiveWinsorQuantiles();
  expect(qLo).toBeCloseTo(0.01);
  expect(qHi).toBeCloseTo(0.99);
  expect(getCoverageThreshold()).toBeCloseTo(0.4);
  expect(getZShrinkK()).toBe(10);

  process.env = save;
});

