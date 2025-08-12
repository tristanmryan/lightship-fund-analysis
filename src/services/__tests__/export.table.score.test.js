import { exportTableCSV } from '../../services/exportService';

function blobToText(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsText(blob);
  });
}

test('Table export writes Score as plain number with one decimal (not percent)', async () => {
  const funds = [{ ticker: 'AAA', name: 'A', scores: { final: 67.4 }, standard_deviation_3y: 10, standard_deviation_5y: 12 }];
  const columns = [
    { key: 'symbol', label: 'Symbol', isPercent: false, valueGetter: (f) => f.ticker },
    { key: 'score', label: 'Score', isPercent: false, valueGetter: (f) => Number(f.scores?.final?.toFixed(1)) }
  ];
  const blob = exportTableCSV({ funds, columns, sortConfig: [], metadata: {} });
  const text = await blobToText(blob);
  const lines = text.split(/\r?\n/).filter(Boolean);
  const headerIdx = lines.findIndex(l => /(^|,)"Symbol"/.test(l) && l.includes('"Score"'));
  // Data row will be after a blank separator line and the header row
  const row = lines[headerIdx + 1] && lines[headerIdx + 1].trim() !== ''
    ? lines[headerIdx + 1]
    : lines[headerIdx + 2];
  expect(row).toContain('"67.4"');
});

