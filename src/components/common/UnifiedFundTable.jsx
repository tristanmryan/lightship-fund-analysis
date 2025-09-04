// src/components/common/UnifiedFundTable.jsx
import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import DataTable from './DataTable';
import ScoreTooltip from '../Dashboard/ScoreTooltip';
import Sparkline from '../Dashboard/Sparkline';
import {
  getPresetColumns,
  getColumnsByKeys,
  COLUMN_PRESETS
} from '../../config/tableColumns';

/**
 * UnifiedFundTable
 *
 * A thin, opinionated wrapper around the shared DataTable configured for fund rows.
 * Replaces multiple legacy table implementations (Modern/Enhanced/Simple).
 *
 * Props
 * - funds | data: array of fund rows
 * - preset: one of COLUMN_PRESETS keys ('core'|'extended'|'advanced'|'performance'|'risk'|'cost'|'recommended')
 * - columns: optional explicit column keys array to override preset
 * - initialSortConfig: array of { key, direction }
 * - onRowClick: function(fund)
 * - loading, error: state handling
 * - registerExportHandler: function(fn) -> fn(type: 'csv'|'excel'|'pdf', options)
 * - onStateChange: function({ selectedColumns, sortConfig })
 */
const UnifiedFundTable = ({
  funds = [],
  data,
  preset = 'extended',
  columns = null,
  initialSortConfig = [{ key: 'score', direction: 'desc' }],
  onRowClick,
  loading = false,
  error = null,
  registerExportHandler,
  onStateChange,
  // visual defaults
  stickyHeader = true,
  highlightBenchmarks = true,
  highlightRecommended = true,
  enableFiltering = true,
  enableSelection = false,
  className = '',
  maxHeight = '800px',
  chartPeriod = '1Y'
}) => {
  const rows = data || funds || [];
  const tableRef = useRef(null);

  // Column selection state (keys), default from preset
  const [selectedKeys, setSelectedKeys] = useState(() => {
    if (Array.isArray(columns) && columns.length) return columns;
    const presetDef = COLUMN_PRESETS[preset];
    return presetDef ? presetDef.columns : COLUMN_PRESETS.extended.columns;
  });

  const columnObjects = useMemo(() => getColumnsByKeys(selectedKeys), [selectedKeys]);

  // wire export handler to parent if requested
  useEffect(() => {
    if (typeof registerExportHandler === 'function' && tableRef.current) {
      registerExportHandler((type = 'excel', options = {}) => {
        if (!tableRef.current) return;
        if (type === 'csv') return tableRef.current.exportCSV(options);
        if (type === 'pdf') return tableRef.current.exportPDF(options);
        return tableRef.current.exportExcel(options);
      });
    }
  }, [registerExportHandler, tableRef]);

  const handleSortChange = useCallback((sortConfig) => {
    onStateChange?.({ selectedColumns: selectedKeys, sortConfig });
  }, [onStateChange, selectedKeys]);

  const handleFilterChange = useCallback(() => {
    // no-op for now; reserved for future state persistence
  }, []);

  return (
    <div className={`unified-fund-table ${className}`}>
      <DataTable
        ref={tableRef}
        data={rows}
        columns={columnObjects}
        sortConfig={initialSortConfig}
        filterConfig={{ searchableFields: ['name','ticker','symbol','asset_class'] }}
        selectionConfig={{ selectionMode: enableSelection ? 'multiple' : 'none' }}
        enableSorting={true}
        enableFiltering={enableFiltering}
        enableSelection={enableSelection}
        enableExport={true}
        enableVirtualScrolling={rows.length > 150}
        theme="default"
        density="normal"
        stickyHeader={stickyHeader}
        showRowHover={true}
        highlightRecommended={highlightRecommended}
        highlightBenchmarks={highlightBenchmarks}
        benchmarkPositioning="inline"
        loading={loading}
        error={error}
        emptyMessage="No funds to display"
        loadingMessage="Loading funds..."
        ScoreTooltip={ScoreTooltip}
        Sparkline={Sparkline}
        historyCache={{}}
        chartPeriod={chartPeriod}
        onRowClick={onRowClick}
        onSortChange={handleSortChange}
        onFilterChange={handleFilterChange}
        className="bg-white rounded-md shadow-sm"
        maxHeight={maxHeight}
        ariaLabel="Fund analysis table"
      />
    </div>
  );
};

export default UnifiedFundTable;

