# UnifiedFundTable API

A single, reusable fund table component used across Dashboard, Recommended, Portfolios, and other views.

Path: `src/components/common/UnifiedFundTable.jsx`

## Props

- `funds | data` (array): Array of fund rows to render.
- `preset` (string): Column preset key. Common: `core`, `extended`, `advanced`, `performance`, `risk`, `cost`, `recommended`.
- `columns` (string[]): Optional explicit column keys to override preset.
- `initialSortConfig` (Array<{ key, direction }>): Initial sort. Example: `[ { key: 'score', direction: 'desc' } ]`.
- `onRowClick` (fn): `(fund, index, event) => void`.
- `loading` (bool): Shows loading state.
- `error` (string|Error|null): Shows error state.
- `registerExportHandler` (fn): Receives a function to call for CSV/Excel/PDF export.
- `onStateChange` (fn): Receives `{ selectedColumns, sortConfig }` on changes.
- Visual controls: `stickyHeader`, `highlightBenchmarks`, `highlightRecommended`, `enableFiltering`, `enableSelection`, `className`, `maxHeight`, `chartPeriod`.

## Column Registry

Path: `src/config/tableColumns.js`

- Central registry for all columns (labels, accessors, formatting, renderers).
- Ownership columns: `firmAUM`, `advisorCount`.
- Utilities: `getPresetColumns(preset)`, `getColumnsByKeys(keys)`.

## Recommended Preset

Preset name: `recommended`

Columns: `symbol`, `name`, `assetClass`, `score`, `ytdReturn`, `oneYearReturn`, `expenseRatio`, `firmAUM`, `advisorCount`, `recommended`.

## Export Integration

Call `registerExportHandler((type, options) => ...)` to wire table-level exports.

