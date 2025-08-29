import { exportCompareCSV } from '../../services/exportService';

function blobToText(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsText(blob);
  });
}

test('Compare export includes Std Dev (3Y) and Std Dev (5Y) columns', async () => {
  const funds = [{
    ticker: 'AAA', name: 'Fund A', asset_class: 'LCB',
    standard_deviation_3y: 12.34, standard_deviation_5y: 15.67
  }];
  const blob = exportCompareCSV({ funds, metadata: {} });
  const text = await blobToText(blob);
  expect(text.includes('Std Dev 3Y (%)')).toBe(true);
  expect(text.includes('Std Dev 5Y (%)')).toBe(true);
});

