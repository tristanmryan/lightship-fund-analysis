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

  test('parseMetricNumber handles common cases', () => {
    const { dbUtils } = require('../../services/supabase');
    const p = dbUtils.parseMetricNumber;
    expect(p('1.2%')).toBeCloseTo(1.2);
    expect(p('(2.1%)')).toBeCloseTo(-2.1);
    expect(p('-1.5%')).toBeCloseTo(-1.5);
    expect(p('1,234.56')).toBeCloseTo(1234.56);
    expect(p('—')).toBeNull();
    expect(p('N/A')).toBeNull();
    expect(p('NA')).toBeNull();
    expect(p('')).toBeNull();
    expect(p(0)).toBe(0);
  });

test('CSV mode accepts YYYY-MM and expands to EOM', () => {
  const s = expandYearMonth('2025-07');
  expect(s).toBe('2025-07-31');
});

