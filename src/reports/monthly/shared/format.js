// src/reports/monthly/shared/format.js

export function formatPercentDisplay(value, decimals = 2) {
  if (value == null || isNaN(Number(value))) return 'N/A';
  const n = Number(value);
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n).toFixed(decimals);
  return `${sign}${abs}%`;
}

export function formatNumberDisplay(value, decimals = 2) {
  if (value == null || isNaN(Number(value))) return 'N/A';
  return Number(value).toFixed(decimals);
}

export function toEomDate(input) {
  try {
    if (!input) return formatDateOnly(endOfMonth(new Date()));
    const d = new Date(input);
    if (isNaN(d.getTime())) return formatDateOnly(endOfMonth(new Date()));
    return formatDateOnly(endOfMonth(d));
  } catch {
    return formatDateOnly(endOfMonth(new Date()));
  }
}

function endOfMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

function formatDateOnly(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
