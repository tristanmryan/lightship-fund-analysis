// src/utils/formatters.js

export function formatPercent(value, digits = 2) {
  if (value == null || isNaN(value)) return '—';
  return `${Number(value).toFixed(digits)}%`;
}

export function formatNumber(value, digits = 2) {
  if (value == null || isNaN(value)) return '—';
  return Number(value).toFixed(digits);
}

