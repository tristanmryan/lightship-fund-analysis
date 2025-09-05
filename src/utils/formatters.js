// src/utils/formatters.js
// Consistent formatting utility (Phase 4C)

export function formatCurrency(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  const n = Number(value);
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

export function formatNumber(value, decimals = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return Number(value).toFixed(decimals);
}

export function formatPercent(value, decimals = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return `${Number(value).toFixed(decimals)}%`;
}

export function formatExpense(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return `${Number(value).toFixed(2)}%`;
}

export function formatScore(value, decimals = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return Number(value).toFixed(decimals);
}

export function toISODateTime(dateLike) {
  try {
    const d = dateLike instanceof Date ? dateLike : new Date(String(dateLike));
    return d.toISOString();
  } catch {
    return '';
  }
}

export const fmt = {
  currency: formatCurrency,
  percent(value, opts = {}) {
    // Support both number decimals or { decimals, sign }
    const decimals = typeof opts === 'number' ? opts : (opts.decimals ?? 2);
    const s = formatPercent(value, decimals);
    if (s === '—') return s;
    if (typeof opts === 'object' && opts.sign) {
      const n = Number(value);
      if (!Number.isNaN(n) && n > 0) return `+${s}`;
    }
    return s;
  },
  number(value, opts = {}) {
    const decimals = typeof opts === 'number' ? opts : (opts.decimals ?? 2);
    return formatNumber(value, decimals);
  },
  expense: formatExpense,
  score(value, opts = {}) {
    const decimals = typeof opts === 'number' ? opts : (opts.decimals ?? 1);
    return formatScore(value, decimals);
  }
};

export const formatters = {
  currency: formatCurrency,
  number(value, { decimals = 0 } = {}) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
    return Number(value).toFixed(decimals);
  },
  percent(value, { decimals = 2 } = {}) { return formatPercent(value, decimals); },
  expense(value) { return formatExpense(value); },
  score(value, { decimals = 1 } = {}) { return formatScore(value, decimals); },
};

export default formatters;
