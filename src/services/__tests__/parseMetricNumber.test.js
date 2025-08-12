import '@testing-library/jest-dom';

describe('dbUtils.parseMetricNumber', () => {
  const { dbUtils } = require('../../services/supabase');
  const p = dbUtils.parseMetricNumber;

  test('parses percentages and negatives', () => {
    expect(p('3.5%')).toBeCloseTo(3.5);
    expect(p('-1.2%')).toBeCloseTo(-1.2);
    expect(p('(2.1%)')).toBeCloseTo(-2.1);
  });

  test('parses plain numbers and commas', () => {
    expect(p('1,234.56')).toBeCloseTo(1234.56);
    expect(p('0')).toBe(0);
    expect(p(0)).toBe(0);
  });

  test('returns null for sentinels and invalid', () => {
    expect(p('')).toBeNull();
    expect(p('-')).toBeNull();
    expect(p('—')).toBeNull();
    expect(p('NA')).toBeNull();
    expect(p('N/A')).toBeNull();
    expect(p('abc')).toBeNull();
  });
});

