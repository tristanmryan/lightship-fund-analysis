// src/utils/sparklineUtils.js

export function pickHistoryValues(rows = [], period = '1Y') {
  const sorted = (rows || []).slice().sort((a, b) => new Date(a.date) - new Date(b.date));
  const clamp = (arr, n) => arr.slice(Math.max(0, arr.length - n));
  let picked = sorted;
  switch (period) {
    case '1M': picked = clamp(sorted, 21); break; // ~21 trading days
    case '3M': picked = clamp(sorted, 63); break;
    case '6M': picked = clamp(sorted, 126); break;
    case 'YTD': {
      const year = new Date().getFullYear();
      picked = sorted.filter(r => new Date(r.date).getFullYear() === year);
      break;
    }
    case '1Y':
    default: picked = clamp(sorted, 252); break; // ~252 trading days
  }
  return picked.map(r => r.one_year_return ?? r.ytd_return ?? null);
}

