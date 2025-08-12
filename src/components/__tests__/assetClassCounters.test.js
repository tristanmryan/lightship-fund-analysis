import '@testing-library/jest-dom';

function countByClass(funds) {
  const map = new Map();
  for (const f of funds) {
    const label = f.asset_class_name || f.asset_class || f['Asset Class'] || '';
    const key = (!f.asset_class_id && !label) ? 'Unknown' : label;
    map.set(key, (map.get(key) || 0) + 1);
  }
  return map;
}

test('asset-class counters match table grouping logic', () => {
  const funds = [
    { ticker: 'AAA', asset_class_id: 1, asset_class_name: 'Large Cap' },
    { ticker: 'BBB', asset_class_id: null, asset_class_name: 'Large Cap' },
    { ticker: 'CCC', asset_class_id: null, asset_class_name: '' },
    { ticker: 'DDD', asset_class_id: null, asset_class: '' },
    { ticker: 'EEE', asset_class_id: 2, asset_class_name: 'Small Cap' },
  ];
  const counts = countByClass(funds);
  expect(counts.get('Large Cap')).toBe(2);
  expect(counts.get('Small Cap')).toBe(1);
  expect(counts.get('Unknown')).toBe(2);
});

