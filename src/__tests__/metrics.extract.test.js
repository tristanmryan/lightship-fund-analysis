import { extractMetrics, parseMetricValue } from '../services/metrics';

test('parseMetricValue handles numbers, percents, commas, and N/A', () => {
  expect(parseMetricValue(1.23)).toBe(1.23);
  expect(parseMetricValue('12.34%')).toBeCloseTo(12.34);
  expect(parseMetricValue('1,234.56')).toBeCloseTo(1234.56);
  expect(parseMetricValue('N/A')).toBeNull();
  expect(parseMetricValue('')).toBeNull();
});

test('extractMetrics maps legacy CSV and live fields', () => {
  const csvRow = {
    '1 Year': '12.3%', 'YTD': '3.2%', 'Sharpe Ratio': '0.9', 'Standard Deviation - 3 Year': '10.5',
    'Up Capture Ratio': '102', 'Down Capture Ratio': '98', 'Net Exp Ratio (%)': '0.50', 'Manager Tenure': '5'
  };
  const liveRow = {
    one_year_return: 11.1, ytd_return: 2.2, sharpe_ratio: 0.8, standard_deviation_3y: 9.9,
    up_capture_ratio: 101, down_capture_ratio: 97, expense_ratio: 0.49, manager_tenure: 6
  };
  const outCsv = extractMetrics(csvRow);
  const outLive = extractMetrics(liveRow);
  expect(outCsv.oneYear).toBeCloseTo(12.3);
  expect(outLive.oneYear).toBeCloseTo(11.1);
  expect(outCsv.sharpeRatio3Y).toBeCloseTo(0.9);
  expect(outLive.sharpeRatio3Y).toBeCloseTo(0.8);
  expect(outCsv.stdDev3Y).toBeCloseTo(10.5);
  expect(outLive.stdDev3Y).toBeCloseTo(9.9);
  expect(outCsv.upCapture3Y).toBeCloseTo(102);
  expect(outCsv.downCapture3Y).toBeCloseTo(98);
  expect(outCsv.expenseRatio).toBeCloseTo(0.50);
  expect(outCsv.managerTenure).toBeCloseTo(5);
});

test('derived oneYearDeltaVsBench computes when enabled and benchmark present', () => {
  const orig = process.env.REACT_APP_ENABLE_BENCH_DELTA;
  process.env.REACT_APP_ENABLE_BENCH_DELTA = 'true';
  const bench = new Map();
  bench.set('SPY', { ticker: 'SPY', one_year_return: 10 });
  const fund = { one_year_return: 12, primary_benchmark: 'SPY' };
  const out = extractMetrics(fund, bench);
  expect(out.oneYearDeltaVsBench).toBeCloseTo(2);
  process.env.REACT_APP_ENABLE_BENCH_DELTA = orig;
});

