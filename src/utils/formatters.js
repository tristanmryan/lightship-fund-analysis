// src/utils/formatters.js

export function formatPercent(value, digits = 2) {
  if (value == null || isNaN(value)) return '—';
  return `${Number(value).toFixed(digits)}%`;
}

export function formatNumber(value, digits = 2) {
  if (value == null || isNaN(value)) return '—';
  return Number(value).toFixed(digits);
}

export function toISODateTime(dateLike) {
  try {
    const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
    return d.toISOString();
  } catch {
    return '';
  }
}

// Unified formatting object for consistency across components
export const fmt = {
  percent(value, opts = {}) {
    const { decimals = 2, sign = false } = opts;
    if (value == null || Number.isNaN(value)) return '—';
    const s = sign && value > 0 ? '+' : '';
    return `${s}${Number(value).toFixed(decimals)}%`;
  },
  
  number(value, opts = {}) {
    const { decimals = 2 } = opts;
    if (value == null || Number.isNaN(value)) return '—';
    return Number(value).toFixed(decimals);
  },
  
  date(value) {
    try {
      const d = value instanceof Date ? value : new Date(String(value));
      if (!Number.isFinite(d.getTime())) return '—';
      return d.toISOString().slice(0, 10);
    } catch {
      return '—';
    }
  }
};

