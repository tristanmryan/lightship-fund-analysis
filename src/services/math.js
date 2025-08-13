// Math helpers extracted for scoring

export function calculateMean(values) {
  const validValues = (values || []).filter(v => v != null && !isNaN(v));
  if (validValues.length === 0) return 0;
  return validValues.reduce((sum, val) => sum + val, 0) / validValues.length;
}

export function calculateStdDev(values, mean) {
  const validValues = (values || []).filter(v => v != null && !isNaN(v));
  if (validValues.length <= 1) return 0;
  const squaredDiffs = validValues.map(val => Math.pow(val - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / validValues.length;
  return Math.sqrt(avgSquaredDiff);
}

export function calculateZScore(value, mean, stdDev) {
  if (stdDev === 0 || isNaN(stdDev)) return 0;
  return (value - mean) / stdDev;
}

export function quantile(sortedValues, q) {
  if (!Array.isArray(sortedValues) || sortedValues.length === 0) return null;
  const n = sortedValues.length;
  if (n === 1) return sortedValues[0];
  const pos = (n - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if ((sortedValues[base + 1] !== undefined)) {
    return sortedValues[base] + rest * (sortedValues[base + 1] - sortedValues[base]);
  } else {
    return sortedValues[base];
  }
}

// Error function approximations
export function erf(x) {
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;
  const sign = x >= 0 ? 1 : -1;
  x = Math.abs(x);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}

export function erfinv(x) {
  const a = 0.147;
  const ln = Math.log(1 - x * x);
  const s = (2 / (Math.PI * a)) + (ln / 2);
  const inside = (s * s) - (ln / a);
  const sign = x < 0 ? -1 : 1;
  return sign * Math.sqrt(Math.sqrt(inside) - s);
}

