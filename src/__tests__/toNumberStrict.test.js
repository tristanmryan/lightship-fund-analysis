import { toNumberStrict } from '../services/supabase';

test('toNumberStrict parses zeros correctly', () => {
  expect(toNumberStrict('0')).toBe(0);
  expect(toNumberStrict('0.00%')).toBe(0);
});

test('toNumberStrict handles parentheses negatives', () => {
  expect(toNumberStrict('(1.2)')).toBe(-1.2);
});

test('toNumberStrict returns null for N/A-like values', () => {
  expect(toNumberStrict('N/A')).toBeNull();
});

test('toNumberStrict parses comma numbers', () => {
  expect(toNumberStrict('1,234.56')).toBe(1234.56);
});

