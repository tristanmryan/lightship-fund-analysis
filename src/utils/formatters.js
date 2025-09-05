// src/utils/formatters.js
// Consistent formatting utility (Phase 4C)

export const formatters = {
  currency(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
    const n = Number(value);
    const abs = Math.abs(n);
    if (abs >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
    if (abs >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
  },

  number(value, { decimals = 0 } = {}) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
    return Number(value).toFixed(decimals);
  },

  percent(value, { decimals = 2 } = {}) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
    return `${Number(value).toFixed(decimals)}%`;
  },

  expense(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
    return `${Number(value).toFixed(2)}%`;
  },

  score(value, { decimals = 1 } = {}) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
    return Number(value).toFixed(decimals);
  },
};

export default formatters;

