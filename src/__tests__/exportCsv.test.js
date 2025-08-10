import '@testing-library/jest-dom';
import { buildCSV, exportTableCSV, exportCompareCSV, shouldConfirmLargeExport } from '../services/exportService';

function decodeBlobText(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsText(blob);
  });
}

test('buildCSV adds BOM, CRLF, and quotes all fields', () => {
  const rows = [["a,b", 'x"y', 123], [null, '', 'z']];
  const csv = buildCSV(rows);
  expect(csv.charCodeAt(0)).toBe(0xFEFF); // BOM
  expect(csv).toContain('"a,b"');
  expect(csv).toContain('"x""y"');
  expect(csv).toContain('"123"');
  expect(csv).toContain('\r\n');
});

test('exportTableCSV respects visible columns and sort', async () => {
  const funds = [
    { ticker: 'B', name: 'Bravo', ytd_return: 10 },
    { ticker: 'A', name: 'Alpha', ytd_return: 20 }
  ];
  const columns = [
    { key: 'symbol', label: 'Symbol', valueGetter: (f) => f.ticker },
    { key: 'name', label: 'Name', valueGetter: (f) => f.name },
    { key: 'ytdReturn', label: 'YTD', isPercent: true, valueGetter: (f) => f.ytd_return }
  ];
  const blob = exportTableCSV({
    funds: funds, // assume already sorted in UI order (B then A)
    columns,
    sortConfig: [{ key: 'symbol', direction: 'asc', label: 'Symbol' }],
    metadata: { chartPeriod: '1Y', exportedAt: new Date('2025-01-01T00:00:00Z') }
  });
  const text = await decodeBlobText(blob);
  const lines = text.split('\r\n');
  // header row should appear after a blank line
  const headerIndex = lines.findIndex(l => l.includes('"Symbol"') && l.includes('"Name"') && l.includes('"YTD"'));
  expect(headerIndex).toBeGreaterThan(0);
  // next two rows reflect B then A (UI order) and percent as decimals
  expect(lines[headerIndex + 1]).toContain('"B"');
  expect(lines[headerIndex + 1]).toContain('"0.1"');
  expect(lines[headerIndex + 2]).toContain('"A"');
  expect(lines[headerIndex + 2]).toContain('"0.2"');
});

test('exportCompareCSV includes benchmark delta fields and raw numbers', async () => {
  const funds = [{
    ticker: 'AAA', name: 'Alpha', asset_class: 'LCG',
    score: 8.2, ytd_return: 12.34, one_year_return: 9.87, three_year_return: 5.5, five_year_return: 4.4,
    sharpe_ratio: 1.11, expense_ratio: 0.22, beta: 0.9, up_capture_ratio: 102.5, down_capture_ratio: 95.1,
    exportDelta1y: 1.23, exportBenchTicker: 'SPY', exportBenchName: 'S&P 500'
  }];
  const blob = exportCompareCSV({ funds, metadata: { exportedAt: new Date('2025-02-02T00:00:00Z') } });
  const text = await decodeBlobText(blob);
  const lines = text.split('\r\n');
  const headerIndex = lines.findIndex(l => l.includes('"Ticker"') && l.includes('"1Y vs Benchmark (delta)"'));
  expect(headerIndex).toBeGreaterThan(0);
  const data = lines[headerIndex + 1];
  expect(data).toContain('"0.0987"'); // 9.87% => 0.0987
  expect(data).toContain('"0.0123"'); // delta 1.23% => 0.0123
  expect(data).toContain('"SPY"');
  expect(data).toContain('"S&P 500"');
});

test('shouldConfirmLargeExport triggers at > 50k', () => {
  expect(shouldConfirmLargeExport(50000)).toBe(false);
  expect(shouldConfirmLargeExport(50001)).toBe(true);
});

