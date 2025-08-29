# Custom Table Hooks

This directory contains custom React hooks that extract common table logic for the Lightship Fund Analysis application. These hooks are designed to work with the existing fund data structures and support both `fund.ytd_return` and `fund['Total Return - YTD (%)']` patterns.

## Available Hooks

### 1. `useTableSort` - Sorting State Management

Handles multi-column sorting with stable sort keys and fallback patterns for fund data.

```javascript
import { useTableSort, STANDARD_COLUMNS } from '../hooks';

function FundTable({ funds }) {
  const {
    sortConfig,
    sortedData,
    handleSort,
    clearSort,
    getSortStatus
  } = useTableSort({
    data: funds,
    initialSortConfig: [{ key: 'score', direction: 'desc' }],
    multiColumn: true,
    maxSortColumns: 3,
    columnDefinitions: STANDARD_COLUMNS
  });

  return (
    <table>
      <thead>
        <tr>
          <th onClick={() => handleSort('score')}>
            Score {getSortStatus('score').direction === 'asc' ? '↑' : '↓'}
          </th>
        </tr>
      </thead>
      <tbody>
        {sortedData.map(fund => (
          <tr key={fund.ticker}>
            <td>{fund.scores?.final || fund.score}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

### 2. `useTableFilter` - Filter State and Logic

Provides debounced search and multiple filter types with preset filters.

```javascript
import { useTableFilter, PRESET_FILTERS } from '../hooks';

function FundTable({ funds }) {
  const {
    filteredData,
    searchTerm,
    setSearchTerm,
    filters,
    updateFilter,
    clearFilters,
    hasActiveFilters,
    getFilterStats
  } = useTableFilter({
    data: funds,
    searchableFields: ['name', 'ticker', 'symbol'],
    debounceMs: 300
  });

  const stats = getFilterStats();

  return (
    <div>
      <input
        type="text"
        placeholder="Search funds..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      
      <select onChange={(e) => updateFilter('asset_class', e.target.value)}>
        <option value="">All Asset Classes</option>
        <option value="US Large Cap Equity">Large Cap Equity</option>
      </select>
      
      <button onClick={clearFilters}>Clear Filters</button>
      
      <p>Showing {stats.filtered} of {stats.total} funds</p>
      
      {/* Table with filteredData */}
    </div>
  );
}
```

### 3. `useTableExport` - Export Functionality

Integrates with the existing exportService for CSV, Excel, and PDF exports.

```javascript
import { useTableExport } from '../hooks';

function FundTable({ funds }) {
  const {
    exportCSV,
    exportExcel,
    exportPDF,
    isExporting,
    exportProgress,
    exportStats
  } = useTableExport({
    data: funds,
    columns: STANDARD_COLUMNS,
    metadata: { asOf: new Date() }
  });

  return (
    <div>
      <button 
        onClick={() => exportCSV()} 
        disabled={isExporting}
      >
        Export CSV
      </button>
      
      <button 
        onClick={() => exportExcel()} 
        disabled={isExporting}
      >
        Export Excel
      </button>
      
      {isExporting && (
        <div>Exporting... {exportProgress?.progress}%</div>
      )}
    </div>
  );
}
```

### 4. `useTableSelection` - Row Selection State

Manages row selection for both single and multi-selection patterns.

```javascript
import { useTableSelection, useFundSelection } from '../hooks';

function FundTable({ funds, onFundSelect }) {
  // For single fund selection (compatible with existing onFundSelect)
  const {
    selectedItems,
    selectFund,
    isSelected,
    clearSelection
  } = useFundSelection({
    data: funds,
    onFundSelect,
    selectionMode: 'single'
  });

  // For multi-row selection
  const {
    selectedItems: multiSelected,
    toggleItem,
    selectAll,
    clearSelection: clearMulti
  } = useTableSelection({
    data: funds,
    selectionMode: 'multiple'
  });

  return (
    <div>
      <button onClick={selectAll}>Select All</button>
      <button onClick={clearMulti}>Clear Selection</button>
      
      <table>
        <tbody>
          {funds.map(fund => (
            <tr 
              key={fund.ticker}
              onClick={() => selectFund(fund)}
              className={isSelected(fund) ? 'selected' : ''}
            >
              <td>{fund.ticker}</td>
              <td>{fund.name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### 5. `useTableHooks` - Combined Hook

Use all table functionality in one hook for convenience.

```javascript
import { useTableHooks, STANDARD_COLUMNS } from '../hooks';

function FundTable({ funds }) {
  const {
    data,           // Processed data (sorted + filtered)
    selectedData,   // Selected items
    stats,          // Combined statistics
    actions,        // All action methods
    sort,           // Sort hook
    filter,         // Filter hook
    selection,      // Selection hook
    export: exportHook // Export hook
  } = useTableHooks({
    data: funds,
    columns: STANDARD_COLUMNS,
    initialSortConfig: [{ key: 'score', direction: 'desc' }],
    selectionMode: 'multiple',
    metadata: { asOf: new Date() }
  });

  return (
    <div>
      {/* Search */}
      <input
        type="text"
        placeholder="Search..."
        value={filter.searchTerm}
        onChange={(e) => actions.search(e.target.value)}
      />
      
      {/* Table */}
      <table>
        <thead>
          <tr>
            <th onClick={() => actions.sort('score')}>
              Score {sort.getSortStatus('score').direction === 'asc' ? '↑' : '↓'}
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map(fund => (
            <tr 
              key={fund.ticker}
              onClick={() => actions.toggle(fund)}
              className={selection.isSelected(fund) ? 'selected' : ''}
            >
              <td>{fund.scores?.final || fund.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {/* Export */}
      <button onClick={() => actions.exportCSV()}>
        Export CSV ({stats.filtered} funds)
      </button>
      
      {/* Stats */}
      <p>
        Showing {stats.filtered} of {stats.total} funds
        {stats.selectionActive && ` (${stats.selected} selected)`}
      </p>
    </div>
  );
}
```

## Data Access Patterns

All hooks support the fallback patterns identified in the audit:

```javascript
// These patterns work automatically:
fund.ytd_return ?? fund['Total Return - YTD (%)'] ?? 0
fund.one_year_return ?? fund['Total Return - 1 Year (%)'] ?? fund['1 Year'] ?? 0
fund.asset_class_name || fund.asset_class || fund['Asset Class']
```

## Standard Column Definitions

Use the predefined column definitions for consistent behavior:

```javascript
import { STANDARD_COLUMNS, createColumnDefinition } from '../hooks';

// Use predefined columns
const columns = STANDARD_COLUMNS;

// Or create custom ones
const customColumn = createColumnDefinition('custom_field', {
  label: 'Custom Field',
  fallbacks: ['fallback1', 'fallback2'],
  isPercent: true,
  decimals: 2
});
```

## Preset Filters and Selection

Use predefined patterns for common use cases:

```javascript
import { PRESET_FILTERS, SELECTION_PRESETS } from '../hooks';

// Apply preset filter
const { applyPreset } = usePresetFilters(filterHook);
applyPreset('recommended'); // Selects only recommended funds

// Apply preset selection
const { applyPreset: applySelectionPreset } = usePresetSelection(selectionHook);
applySelectionPreset('highPerformers'); // Selects high-performing funds
```

## Migration from Existing Code

To migrate existing table components:

1. **Replace sorting logic** with `useTableSort`
2. **Replace filtering logic** with `useTableFilter`
3. **Replace export logic** with `useTableExport`
4. **Add selection logic** with `useTableSelection` (optional)
5. **Or use `useTableHooks`** for all functionality

The hooks maintain compatibility with existing patterns like `onFundSelect` while adding new capabilities. 