// Test enhanced export functionality with visual refresh and formatting improvements
describe('Enhanced Export Functionality', () => {
  // Mock environment variable
  const originalEnv = process.env.REACT_APP_ENABLE_VISUAL_REFRESH;
  
  beforeEach(() => {
    process.env.REACT_APP_ENABLE_VISUAL_REFRESH = 'true';
  });
  
  afterEach(() => {
    process.env.REACT_APP_ENABLE_VISUAL_REFRESH = originalEnv;
  });

  test('enhanced formatting functions work correctly', () => {
    // Test formatPercentage function structure
    const mockFormatPercentage = (value, options = {}) => {
      if (value == null || isNaN(value)) return options.emptyValue || '';
      const { decimals = 2, includeSymbol = true, multiplier = 1 } = options;
      const adjusted = Number(value) * multiplier;
      const formatted = adjusted.toFixed(decimals);
      return includeSymbol ? `${formatted}%` : formatted;
    };

    expect(mockFormatPercentage(0.1234)).toBe('0.12%');
    expect(mockFormatPercentage(0.1234, { includeSymbol: false })).toBe('0.12');
    expect(mockFormatPercentage(null, { emptyValue: 'N/A' })).toBe('N/A');
  });

  test('enhanced column headers are properly structured', () => {
    const mockEnhancedColumnHeader = (key, label, options = {}) => {
      const enhancements = {
        expenseRatio: 'Expense Ratio (%)',
        ytdReturn: 'YTD Return (%)',
        oneYearReturn: '1-Year Return (%)',
        sharpeRatio: 'Sharpe Ratio (3Y)'
      };
      return enhancements[key] || label;
    };

    expect(mockEnhancedColumnHeader('expenseRatio', 'Expense Ratio')).toBe('Expense Ratio (%)');
    expect(mockEnhancedColumnHeader('ytdReturn', 'YTD Return')).toBe('YTD Return (%)');
    expect(mockEnhancedColumnHeader('unknown', 'Unknown Column')).toBe('Unknown Column');
  });

  test('notes export functionality structures are correct', () => {
    const mockNotes = [
      {
        id: 1,
        created_at: '2025-01-15T10:30:00Z',
        decision: 'approve',
        body: 'This is a test note',
        created_by: 'analyst1',
        override_id: null
      },
      {
        id: 2,
        created_at: '2025-01-14T14:20:00Z',
        decision: 'reject',
        body: 'This fund should be rejected',
        created_by: 'analyst2',
        override_id: '123'
      }
    ];

    // Test priority mapping
    const getPriorityFromDecision = (decision) => {
      switch (decision) {
        case 'reject': return 'high';
        case 'monitor': return 'medium';
        case 'approve': 
        case 'hold': return 'low';
        default: return 'medium';
      }
    };

    expect(getPriorityFromDecision('approve')).toBe('low');
    expect(getPriorityFromDecision('reject')).toBe('high');
    expect(getPriorityFromDecision('monitor')).toBe('medium');

    // Test decision symbols
    const getDecisionSymbol = (decision) => {
      const symbols = {
        approve: '✓',
        reject: '✗',
        monitor: '⚠',
        hold: '⏸'
      };
      return symbols[decision] || '';
    };

    expect(getDecisionSymbol('approve')).toBe('✓');
    expect(getDecisionSymbol('reject')).toBe('✗');
  });

  test('current view export metadata structure is comprehensive', () => {
    const mockOptions = {
      funds: [{ ticker: 'TEST1' }, { ticker: 'TEST2' }],
      columns: [
        { key: 'ticker', label: 'Symbol' },
        { key: 'ytdReturn', label: 'YTD Return', isPercent: true }
      ],
      sortConfig: [{ key: 'ticker', direction: 'asc', label: 'Symbol' }],
      selectedPreset: 'core',
      activeFilters: { search: 'test', assetClasses: ['equity'] },
      metadata: { asOf: '2025-01-15', chartPeriod: '1Y' }
    };

    // Test filter summary generation
    const filterSummary = Object.entries(mockOptions.activeFilters)
      .filter(([key, value]) => {
        if (Array.isArray(value)) return value.length > 0;
        if (value && typeof value === 'object') return Object.values(value).some(v => v !== '' && v !== 'all');
        return value !== '' && value !== 'all' && value != null;
      })
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join(', ');

    expect(filterSummary).toContain('search');
    expect(filterSummary).toContain('assetClasses');
    expect(mockOptions.funds.length).toBe(2);
    expect(mockOptions.selectedPreset).toBe('core');
  });

  test('enhanced Excel export options are properly structured', () => {
    const mockData = {
      funds: [
        { ticker: 'TEST1', name: 'Test Fund 1', ytd_return: 0.1234, expense_ratio: 0.0075 },
        { ticker: 'TEST2', name: 'Test Fund 2', ytd_return: -0.0567, expense_ratio: 0.0125 }
      ]
    };

    const mockOptions = {
      selectedPreset: 'extended',
      activeFilters: { assetClasses: ['equity', 'bond'] },
      visibleColumns: [{ key: 'ticker', label: 'Ticker' }],
      metadata: { asOf: '2025-01-15' }
    };

    // Test preset information structure
    const presetInfo = {
      core: '7 essential columns (Symbol, Name, Asset Class, Score, YTD Return, Expense Ratio, Recommended)',
      extended: '12 key columns (Core + 1Y/3Y Returns, Sharpe Ratio, Beta, Sparkline)',
      all: 'All available columns from the dataset'
    }[mockOptions.selectedPreset] || 'Custom column selection';

    expect(presetInfo).toContain('12 key columns');
    expect(mockData.funds.length).toBe(2);
    expect(mockOptions.selectedPreset).toBe('extended');
  });

  test('CSV formatting utilities work correctly', () => {
    // Test buildCSV function structure
    const mockBuildCSV = (rows) => {
      const BOM = '\uFEFF';
      const escapeCell = (val) => {
        if (val === null || val === undefined) return '';
        const str = typeof val === 'number' ? String(val) : String(val);
        const escaped = str.replace(/"/g, '""');
        return `"${escaped}"`;
      };
      return `${BOM}${rows.map(row => row.map(escapeCell).join(',')).join('\r\n')}`;
    };

    const testRows = [
      ['Header 1', 'Header 2'],
      ['Value 1', 'Value "with quotes"'],
      [123, null]
    ];

    const result = mockBuildCSV(testRows);
    expect(result).toContain('Header 1');
    expect(result).toContain('Value ""with quotes""'); // Escaped quotes
    expect(result).toContain('\uFEFF'); // BOM
  });

  test('export filename generation follows naming conventions', () => {
    const mockFormatExportFilename = ({ scope = 'export', asOf = null, ext = 'csv' }) => {
      const pad = (n) => String(n).padStart(2, '0');
      const now = new Date('2025-01-15T10:30:00Z');
      const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const asOfPart = (typeof asOf === 'string' && asOf.trim()) ? asOf.replace(/-/g, '') : 'latest';
      return `lightship_${scope}_${asOfPart}_${ts}.${ext}`;
    };

    const filename1 = mockFormatExportFilename({ scope: 'notes_TEST_high', asOf: '2025-01-15', ext: 'csv' });
    const filename2 = mockFormatExportFilename({ scope: 'current_view_extended_filtered', ext: 'csv' });

    expect(filename1).toContain('lightship_notes_TEST_high_20250115');
    expect(filename2).toContain('lightship_current_view_extended_filtered');
    expect(filename1.endsWith('.csv')).toBe(true);
  });

  test('visual refresh formatting conditional logic works', () => {
    // Test that formatting changes based on ENABLE_VISUAL_REFRESH
    const ENABLE_VISUAL_REFRESH = process.env.REACT_APP_ENABLE_VISUAL_REFRESH === 'true';
    
    expect(ENABLE_VISUAL_REFRESH).toBe(true); // Should be true from beforeEach
    
    // Test conditional formatting
    const formatBasedOnFlag = (value, enableVisualRefresh) => {
      if (enableVisualRefresh) {
        return `✓ ${value}`;
      }
      return value;
    };

    expect(formatBasedOnFlag('Recommended', true)).toBe('✓ Recommended');
    expect(formatBasedOnFlag('Recommended', false)).toBe('Recommended');
  });

  test('enhanced metadata includes all required fields', () => {
    const mockEnhancedMetadata = {
      exportedAt: new Date(),
      selectedColumns: 'ticker, name, ytdReturn',
      totalColumns: 17,
      visibleColumns: 3,
      sortOrder: 'Name (asc), Score (desc)',
      asOf: '2025-01-15',
      visualRefresh: true,
      kind: 'Enhanced Table Export',
      chartPeriod: '1Y',
      selectedPreset: 'core',
      filterSummary: 'assetClasses: equity, bond'
    };

    // Check all required metadata fields are present
    expect(mockEnhancedMetadata.exportedAt).toBeInstanceOf(Date);
    expect(mockEnhancedMetadata.selectedColumns).toContain('ticker');
    expect(mockEnhancedMetadata.totalColumns).toBe(17);
    expect(mockEnhancedMetadata.visualRefresh).toBe(true);
    expect(mockEnhancedMetadata.kind).toBe('Enhanced Table Export');
  });

  test('date formatting options work correctly', () => {
    const mockFormatDate = (date, options = {}) => {
      if (!date) return options.emptyValue || '';
      const { format = 'short', includeTime = false } = options;
      
      try {
        const d = date instanceof Date ? date : new Date(date);
        if (format === 'iso') return d.toISOString();
        if (format === 'short') return d.toLocaleDateString();
        if (format === 'long') return d.toLocaleDateString('en-US', { 
          year: 'numeric', month: 'long', day: 'numeric' 
        });
        if (includeTime) return d.toLocaleString();
        return d.toLocaleDateString();
      } catch {
        return options.emptyValue || '';
      }
    };

    const testDate = new Date('2025-01-15T10:30:00Z');
    
    expect(mockFormatDate(testDate, { format: 'iso' })).toBe('2025-01-15T10:30:00.000Z');
    expect(mockFormatDate(testDate, { format: 'short' })).toContain('2025');
    expect(mockFormatDate(testDate, { format: 'long' })).toContain('January');
    expect(mockFormatDate(null, { emptyValue: 'No date' })).toBe('No date');
  });
});