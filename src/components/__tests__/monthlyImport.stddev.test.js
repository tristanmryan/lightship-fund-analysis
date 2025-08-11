// Basic unit tests for importer mapping decisions
import '@testing-library/jest-dom';

function mapRow(original) {
  // Reuse the mapping logic conceptually (inline copy from MonthlySnapshotUpload)
  const legacy = original.standard_deviation ?? original['Standard Deviation'];
  const s3 = original.standard_deviation_3y ?? original['standard_deviation_3y'] ?? original['Standard Deviation 3Y'] ?? legacy ?? null;
  const s5 = original.standard_deviation_5y ?? original['standard_deviation_5y'] ?? original['Standard Deviation 5Y'] ?? null;
  return { standard_deviation_3y: s3, standard_deviation_5y: s5 };
}

test('legacy-only std dev maps to 3Y', () => {
  const out = mapRow({ standard_deviation: 12.34 });
  expect(out.standard_deviation_3y).toBe(12.34);
  expect(out.standard_deviation_5y).toBeNull();
});

test('both 3Y and 5Y persist', () => {
  const out = mapRow({ standard_deviation_3y: 10.1, standard_deviation_5y: 11.2 });
  expect(out.standard_deviation_3y).toBe(10.1);
  expect(out.standard_deviation_5y).toBe(11.2);
});

test('neither present leaves nulls', () => {
  const out = mapRow({});
  expect(out.standard_deviation_3y).toBeNull();
  expect(out.standard_deviation_5y).toBeNull();
});

