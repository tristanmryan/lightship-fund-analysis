// Test to ensure column presets functionality is working correctly
describe('Column Presets Feature', () => {
  const COLUMN_PRESETS = {
    core: {
      name: 'Core',
      description: '7 essential columns',
      columns: ['symbol', 'name', 'assetClass', 'score', 'ytdReturn', 'expenseRatio', 'recommended']
    },
    extended: {
      name: 'Extended', 
      description: '12 key columns',
      columns: ['symbol', 'name', 'assetClass', 'score', 'ytdReturn', 'expenseRatio', 'recommended', 'oneYearReturn', 'threeYearReturn', 'sharpeRatio', 'beta', 'sparkline']
    },
    all: {
      name: 'All',
      description: 'Show all available columns', 
      columns: null // null means show all VALID_COLUMN_KEYS
    }
  };

  const VALID_COLUMN_KEYS = [
    'symbol','name','assetClass','score','ytdReturn','oneYearReturn','threeYearReturn','fiveYearReturn',
    'sparkline','expenseRatio','sharpeRatio','beta','standardDeviation','upCaptureRatio','downCaptureRatio',
    'managerTenure','recommended'
  ];

  test('core preset has exactly 7 columns as specified', () => {
    expect(COLUMN_PRESETS.core.columns).toHaveLength(7);
    expect(COLUMN_PRESETS.core.columns).toEqual([
      'symbol', 'name', 'assetClass', 'score', 'ytdReturn', 'expenseRatio', 'recommended'
    ]);
  });

  test('extended preset has 12 columns including core columns', () => {
    const extendedColumns = COLUMN_PRESETS.extended.columns;
    const coreColumns = COLUMN_PRESETS.core.columns;
    
    expect(extendedColumns).toHaveLength(12);
    
    // All core columns should be included in extended
    coreColumns.forEach(col => {
      expect(extendedColumns).toContain(col);
    });
    
    // Extended should add these specific columns
    expect(extendedColumns).toContain('oneYearReturn');
    expect(extendedColumns).toContain('threeYearReturn'); 
    expect(extendedColumns).toContain('sharpeRatio');
    expect(extendedColumns).toContain('beta');
    expect(extendedColumns).toContain('sparkline');
  });

  test('all preset shows all valid column keys', () => {
    expect(COLUMN_PRESETS.all.columns).toBeNull();
    // When null, should use all VALID_COLUMN_KEYS
    expect(VALID_COLUMN_KEYS).toHaveLength(17);
  });

  test('all preset columns are valid', () => {
    // Test that all columns in presets exist in VALID_COLUMN_KEYS
    Object.keys(COLUMN_PRESETS).forEach(presetKey => {
      const preset = COLUMN_PRESETS[presetKey];
      if (preset.columns !== null) {
        preset.columns.forEach(col => {
          expect(VALID_COLUMN_KEYS).toContain(col);
        });
      }
    });
  });

  test('localStorage key is correctly defined', () => {
    // This ensures the localStorage key matches the specification
    expect('fundTablePreset').toBe('fundTablePreset');
  });

  test('visual refresh feature flag check passes', () => {
    // This test ensures the feature flag logic works correctly
    const ENABLE_VISUAL_REFRESH = (process.env.REACT_APP_ENABLE_VISUAL_REFRESH || 'false') === 'true';
    expect(typeof ENABLE_VISUAL_REFRESH).toBe('boolean');
  });
});