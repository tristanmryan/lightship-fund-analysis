import '@testing-library/jest-dom';

// Unit-ish tests for mode selection and picker override logic

function detectMode(headers = [], pickerDate = null) {
  const hasAsOf = (headers || []).some(h => String(h).toLowerCase() === 'asofmonth' || String(h).toLowerCase() === 'as_of_month');
  if (pickerDate) return 'picker';
  return hasAsOf ? 'csv' : 'picker';
}

function expandYearMonth(s) {
  let a = String(s||'').trim();
  if (/^\d{4}-\d{2}$/.test(a)) {
    const [yy, mm] = a.split('-').map(n => Number(n));
    const eom = new Date(Date.UTC(yy, mm, 0));
    return eom.toISOString().slice(0,10);
  }
  return a;
}

test('legacy to non-legacy: new file without AsOfMonth with picker set -> picker mode', () => {
  const mode = detectMode(['Ticker','YTD'], '2025-07-31');
  expect(mode).toBe('picker');
});

test('picker overrides CSV even if AsOfMonth exists', () => {
  const mode = detectMode(['Ticker','AsOfMonth'], '2025-07-31');
  expect(mode).toBe('picker');
});

test('CSV mode accepts YYYY-MM and expands to EOM', () => {
  const s = expandYearMonth('2025-07');
  expect(s).toBe('2025-07-31');
});

