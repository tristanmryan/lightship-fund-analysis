// Metrics configuration and extraction
//
// How to add or rename a metric (developer notes):
// 1) Add the display label in METRIC_LABELS below and place the metric key in
//    METRIC_ORDER at an appropriate position for UI display.
// 2) Map the metric in extractMetrics():
//    - Provide legacy/CSV aliases (e.g., '1 Year', 'Sharpe Ratio') and the live/Supabase
//      field names (e.g., one_year_return, sharpe_ratio) so both ingestion paths are supported.
// 3) Add a default weight for the new metric in DEFAULT_WEIGHTS (see src/services/metricsRegistry.js).
//    Keep default weight 0 if you want it inert until profiles override it.
// 4) If the metric is derived (e.g., benchmark deltas), gate it behind a feature flag and
//    include defensive null checks to avoid partial-data issues.
// 5) Update tests to cover parsing, mapping, and (if applicable) derived logic.
// 6) If you use scoring profiles, ensure a row exists for this metric in the profile
//    (global/class/fund scope) so resolvers can provide non-zero weights in production.

// Display labels for metrics
export const METRIC_LABELS = {
  ytd: 'YTD Return',
  oneYear: '1-Year Return',
  threeYear: '3-Year Return',
  fiveYear: '5-Year Return',
  tenYear: '10-Year Return',
  sharpeRatio3Y: '3Y Sharpe Ratio',
  stdDev3Y: '3Y Std Deviation',
  stdDev5Y: '5Y Std Deviation',
  upCapture3Y: '3Y Up Capture',
  downCapture3Y: '3Y Down Capture',
  alpha5Y: '5Y Alpha',
  expenseRatio: 'Expense Ratio',
  managerTenure: 'Manager Tenure',
  oneYearDeltaVsBench: '1Y vs Benchmark (delta)'
};

// UI order for metrics
export const METRIC_ORDER = [
  'ytd',
  'oneYear',
  'oneYearDeltaVsBench',
  'threeYear',
  'fiveYear',
  'tenYear',
  'sharpeRatio3Y',
  'stdDev3Y',
  'stdDev5Y',
  'upCapture3Y',
  'downCapture3Y',
  'alpha5Y',
  'expenseRatio',
  'managerTenure'
];

export function parseMetricValue(value) {
  if (value == null || value === '' || value === 'N/A' || value === 'N/A N/A') return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[%,]/g, '').trim();
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

// Extract metrics from a fund record, with optional benchmark map for derived metrics
export function extractMetrics(fundData, benchDataMap = null) {
  const csv = {
    ytd: fundData['YTD'],
    oneYear: fundData['1 Year'],
    threeYear: fundData['3 Year'],
    fiveYear: fundData['5 Year'],
    tenYear: fundData['10 Year'],
    sharpeRatio3Y: fundData['Sharpe Ratio'] || fundData['Sharpe Ratio - 3 Year'],
    stdDev3Y: fundData['StdDev3Y'] || fundData['Standard Deviation - 3 Year'],
    stdDev5Y: fundData['StdDev5Y'] || fundData['Standard Deviation - 5 Year'] || fundData['Standard Deviation'],
    upCapture3Y: fundData['Up Capture Ratio'] || fundData['Up Capture'] || fundData['Up Capture Ratio (Morningstar Standard) - 3 Year'],
    downCapture3Y: fundData['Down Capture Ratio'] || fundData['Down Capture'] || fundData['Down Capture Ratio (Morningstar Standard) - 3 Year'],
    alpha5Y: fundData['Alpha'] || fundData['Alpha (Asset Class) - 5 Year'],
    expenseRatio: fundData['Net Expense Ratio'] || fundData['Net Exp Ratio (%)'],
    managerTenure: fundData['Manager Tenure'] || fundData['Longest Manager Tenure (Years)']
  };
  const live = {
    ytd: fundData.ytd_return,
    oneYear: fundData.one_year_return,
    threeYear: fundData.three_year_return,
    fiveYear: fundData.five_year_return,
    tenYear: fundData.ten_year_return,
    sharpeRatio3Y: fundData.sharpe_ratio,
    stdDev3Y: fundData.standard_deviation_3y,
    stdDev5Y: fundData.standard_deviation_5y,
    upCapture3Y: fundData.up_capture_ratio,
    downCapture3Y: fundData.down_capture_ratio,
    alpha5Y: fundData.alpha,
    expenseRatio: fundData.expense_ratio,
    managerTenure: fundData.manager_tenure
  };

  let oneYearDeltaVsBench = null;
  const ENABLE_BENCH_DELTA = (process.env.REACT_APP_ENABLE_BENCH_DELTA || 'false') === 'true';
  try {
    if (ENABLE_BENCH_DELTA && benchDataMap && typeof benchDataMap.get === 'function') {
      const benchTicker = fundData.primary_benchmark || fundData.benchmark_ticker || null;
      const bench = benchTicker ? benchDataMap.get(String(benchTicker)) : null;
      if (bench && bench.one_year_return != null && (live.oneYear ?? csv.oneYear) != null) {
        const f1y = parseMetricValue(live.oneYear ?? csv.oneYear);
        const b1y = parseMetricValue(bench.one_year_return);
        if (f1y != null && b1y != null) oneYearDeltaVsBench = f1y - b1y;
      }
    }
  } catch {}

  return {
    ytd: parseMetricValue(live.ytd ?? csv.ytd),
    oneYear: parseMetricValue(live.oneYear ?? csv.oneYear),
    threeYear: parseMetricValue(live.threeYear ?? csv.threeYear),
    fiveYear: parseMetricValue(live.fiveYear ?? csv.fiveYear),
    tenYear: parseMetricValue(live.tenYear ?? csv.tenYear),
    sharpeRatio3Y: parseMetricValue(live.sharpeRatio3Y ?? csv.sharpeRatio3Y),
    stdDev3Y: parseMetricValue(live.stdDev3Y ?? csv.stdDev3Y),
    stdDev5Y: parseMetricValue(live.stdDev5Y ?? csv.stdDev5Y),
    upCapture3Y: parseMetricValue(live.upCapture3Y ?? csv.upCapture3Y),
    downCapture3Y: parseMetricValue(live.downCapture3Y ?? csv.downCapture3Y),
    alpha5Y: parseMetricValue(live.alpha5Y ?? csv.alpha5Y),
    expenseRatio: parseMetricValue(live.expenseRatio ?? csv.expenseRatio),
    managerTenure: parseMetricValue(live.managerTenure ?? csv.managerTenure),
    oneYearDeltaVsBench
  };
}

