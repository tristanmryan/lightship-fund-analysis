// src/services/csvTemplate.js
// CSV Template Service for Monthly Snapshot Uploads
// Provides downloadable templates for fund and benchmark performance data

/**
 * Creates a fund performance CSV template
 * Note: Date column is excluded as it's provided by the UI date picker
 */
export function createFundPerformanceTemplateCSV() {
  const header = [
    "fund_ticker",
    "ytd_return",
    "one_year_return", 
    "three_year_return",
    "five_year_return",
    "ten_year_return",
    "sharpe_ratio",
    "standard_deviation_3y",
    "standard_deviation_5y",
    "expense_ratio",
    "alpha",
    "beta",
    "manager_tenure",
    "up_capture_ratio",
    "down_capture_ratio"
  ];
  
  // Add sample data rows
  const sampleRows = [
    ["VTSAX", "8.42", "14.65", "10.88", "11.32", "9.87", "1.24", "15.82", "14.97", "0.03", "0.12", "1.02", "12.50", "102.3", "97.8"],
    ["FXNAX", "6.78", "12.34", "9.45", "10.67", "8.93", "1.18", "14.23", "13.45", "0.025", "-0.08", "0.98", "8.75", "99.7", "101.2"],
    ["SWPPX", "7.89", "13.89", "10.12", "11.08", "9.45", "1.21", "15.34", "14.78", "0.02", "0.23", "1.01", "15.25", "103.1", "96.4"]
  ];
  
  const BOM = new Uint8Array([0xEF, 0xBB, 0xBF]);
  const csvContent = [
    `"${header.join('","')}"`,
    ...sampleRows.map(row => `"${row.join('","')}"`)
  ].join('\r\n');
  
  return new Blob([BOM, csvContent], { type: 'text/csv;charset=utf-8' });
}

/**
 * Creates a benchmark performance CSV template
 * Note: Date column is excluded as it's provided by the UI date picker
 * Note: manager_tenure is excluded as benchmarks don't have managers
 */
export function createBenchmarkPerformanceTemplateCSV() {
  const header = [
    "benchmark_ticker",
    "ytd_return",
    "one_year_return",
    "three_year_return", 
    "five_year_return",
    "ten_year_return",
    "sharpe_ratio",
    "standard_deviation_3y",
    "standard_deviation_5y",
    "expense_ratio",
    "alpha",
    "beta",
    "up_capture_ratio",
    "down_capture_ratio"
  ];
  
  // Add sample data rows
  const sampleRows = [
    ["IWF", "9.15", "15.23", "11.45", "11.87", "10.23", "1.28", "16.12", "15.34", "0.19", "0.00", "1.00", "100.0", "100.0"],
    ["IWD", "6.87", "11.98", "8.76", "9.45", "8.12", "1.05", "13.45", "12.89", "0.20", "0.00", "1.00", "100.0", "100.0"],
    ["EFA", "4.23", "8.67", "6.34", "7.12", "5.89", "0.78", "18.23", "17.45", "0.32", "0.00", "1.00", "100.0", "100.0"],
    ["AGG", "1.45", "3.12", "2.87", "3.23", "2.98", "0.45", "4.12", "3.89", "0.05", "0.00", "1.00", "100.0", "100.0"]
  ];
  
  const BOM = new Uint8Array([0xEF, 0xBB, 0xBF]);
  const csvContent = [
    `"${header.join('","')}"`,
    ...sampleRows.map(row => `"${row.join('","')}"`)
  ].join('\r\n');
  
  return new Blob([BOM, csvContent], { type: 'text/csv;charset=utf-8' });
}

// Legacy functions for backward compatibility
export function createMonthlyTemplateCSV() {
  return createFundPerformanceTemplateCSV();
}

export function createLegacyMonthlyTemplateCSV() {
  const header = [
    "Ticker","AsOfMonth","ytd_return","one_year_return","three_year_return","five_year_return","ten_year_return",
    "sharpe_ratio","standard_deviation_3y","standard_deviation_5y","expense_ratio","alpha","beta","manager_tenure","up_capture_ratio","down_capture_ratio",
    "name","asset_class","is_recommended"
  ];
  const BOM = new Uint8Array([0xEF, 0xBB, 0xBF]);
  const line = `"${header.join('","')}"\r\n`;
  return new Blob([BOM, line], { type: 'text/csv;charset=utf-8' });
}

