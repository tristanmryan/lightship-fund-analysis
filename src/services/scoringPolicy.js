// Centralized scoring policy and flags

export function isWinsorizationEnabled() {
  return (process.env.REACT_APP_ENABLE_WINSORIZATION || 'false') === 'true';
}

export function isAdaptiveWinsorEnabled() {
  return (process.env.REACT_APP_ENABLE_ADAPTIVE_WINSOR || 'false') === 'true';
}

export function getAdaptiveWinsorQuantiles() {
  const qLo = Number.parseFloat(process.env.REACT_APP_WINSOR_Q_LO || '0.01');
  const qHi = Number.parseFloat(process.env.REACT_APP_WINSOR_Q_HI || '0.99');
  return { qLo, qHi };
}

export function isTinyClassFallbackEnabled() {
  return (process.env.REACT_APP_ENABLE_TINY_CLASS_FALLBACK || 'false') === 'true';
}

export function getTinyClassPolicy() {
  return {
    minPeers: Number.parseInt(process.env.REACT_APP_TINY_CLASS_MIN_PEERS || '5', 10),
    neutralThreshold: Number.parseInt(process.env.REACT_APP_TINY_CLASS_NEUTRAL_THRESHOLD || '2', 10),
    shrink: Number.parseFloat(process.env.REACT_APP_TINY_CLASS_SHRINK || '0.25')
  };
}

export function getCoverageThreshold() {
  return Number.parseFloat(process.env.REACT_APP_SCORING_COVERAGE_THRESHOLD || '0.4');
}

export function getZShrinkK() {
  return Number.parseInt(process.env.REACT_APP_SCORING_Z_SHRINK_K || '10', 10);
}

export function isRobustScalingEnabled() {
  return (process.env.REACT_APP_ENABLE_ROBUST_SCALING || 'false') === 'true';
}

export function getMissingPolicy() {
  const policy = process.env.REACT_APP_MISSING_POLICY || 'reweight';
  const penalty = Number.parseFloat(process.env.REACT_APP_MISSING_PENALTY || '0');
  return { policy, penalty };
}

export const SCORE_BANDS = [
  // Canonical scoring bands used across the app (from Scoring tab)
  { min: 60, label: 'Strong',  color: '#10B981' }, // Emerald
  { min: 55, label: 'Healthy', color: '#34D399' }, // Green
  { min: 45, label: 'Neutral', color: '#FCD34D' }, // Amber (neutral)
  { min: 40, label: 'Caution', color: '#F97316' }, // Orange
  { min: 0,  label: 'Weak',    color: '#EF4444' }  // Red
];

export function getScoreColor(score) {
  const band = SCORE_BANDS.find(b => score >= b.min);
  return band ? band.color : '#000';
}

export function getScoreLabel(score) {
  const band = SCORE_BANDS.find(b => score >= b.min);
  return band ? band.label : '';
}

