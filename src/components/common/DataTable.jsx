import React, { 
  useState, 
  useMemo, 
  useCallback, 
  useEffect, 
  useRef, 
  forwardRef,
  useImperativeHandle
} from 'react';
import { 
  ArrowUp, 
  ArrowDown, 
  ArrowUpDown, 
  Download,
  Filter,
  MoreHorizontal,
  ChevronUp,
  ChevronDown,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { FixedSizeList as List } from 'react-window';

// Import styles
import './DataTable.css';

// Import table hooks
import { useTableSort } from '../../hooks/useTableSort';
import { useTableFilter } from '../../hooks/useTableFilter';
import { useTableSelection } from '../../hooks/useTableSelection';
import { useTableExport } from '../../hooks/useTableExport';

/**
 * Unified DataTable Component
 * 
 * A flexible, high-performance table component that consolidates common table logic
 * while maintaining styling flexibility for different use cases. Uses the unified
 * table hooks and column definitions for consistent behavior.
 * 
 * Features:
 * - Configurable sorting, filtering, selection, and export
 * - Virtual scrolling for large datasets
 * - Sticky headers and responsive design
 * - Accessibility support with keyboard navigation
 * - Visual refresh styling support
 * - Benchmark and recommended fund highlighting
 */
const DataTable = forwardRef(({
  // Data and columns
  data = [],
  columns = [],
  
  // Hook configurations
  sortConfig: initialSortConfig = null,
  filterConfig = {},
  selectionConfig = {},
  exportConfig = {},
  
  // Table behavior
  enableSorting = true,
  enableFiltering = false,
  enableSelection = false,
  enableExport = false,
  enableVirtualScrolling = false,
  virtualRowHeight = 60,
  virtualOverscan = 10,
  
  // Visual options
  stickyHeader = true,
  showRowHover = true,
  highlightRecommended = true,
  highlightBenchmarks = true,
  density = 'normal', // 'compact', 'normal', 'comfortable'
  theme = 'default', // 'default', 'modern', 'enhanced'
  
  // State management
  loading = false,
  error = null,
  emptyMessage = 'No data available',
  loadingMessage = 'Loading...',
  
  // Event handlers
  onRowClick = null,
  onRowDoubleClick = null,
  onRowSelect = null,
  onSortChange = null,
  onFilterChange = null,
  onExportComplete = null,
  
  // Component dependencies
  ScoreTooltip = null,
  Sparkline = null,
  historyCache = {},
  chartPeriod = '1Y',
  
  // Custom styling
  className = '',
  style = {},
  rowClassName = '',
  headerClassName = '',
  cellClassName = '',
  
  // Accessibility
  ariaLabel = 'Data table',
  
  // Advanced options
  maxHeight = null,
  minHeight = null,
  preserveScrollPosition = false,
  benchmarkPositioning = 'inline' // 'inline', 'top', 'bottom'
}, ref) => {
  
  const tableRef = useRef(null);
  const headerRef = useRef(null);
  const virtualListRef = useRef(null);
  const [focusedRowIndex, setFocusedRowIndex] = useState(-1);
  
  // Visual refresh feature flag
  const ENABLE_VISUAL_REFRESH = (process.env.REACT_APP_ENABLE_VISUAL_REFRESH || 'false') === 'true';
  
  // Initialize table hooks
  const sortHook = useTableSort({
    data,
    initialSortConfig,
    multiColumn: true,
    columnDefinitions: columns.reduce((acc, col) => ({ ...acc, [col.key]: col }), {}),
    onSortChange: (config) => {
      onSortChange?.(config);
    }
  });

  const filterHook = useTableFilter({
    data: enableSorting ? sortHook.sortedData : data,
    ...filterConfig,
    onFilterChange: (filters) => {
      onFilterChange?.(filters);
    }
  });

  const selectionHook = useTableSelection({
    data: enableFiltering ? filterHook.filteredData : (enableSorting ? sortHook.sortedData : data),
    ...selectionConfig,
    onSelectionChange: (selectedIds, selectedData) => {
      onRowSelect?.(selectedIds, selectedData);
    }
  });

  const exportHook = useTableExport({
    data: enableFiltering ? filterHook.filteredData : (enableSorting ? sortHook.sortedData : data),
    columns,
    sortConfig: sortHook.sortConfig,
    filters: filterHook.filters,
    metadata: { chartPeriod, ...exportConfig.metadata },
    ...exportConfig,
    onExportComplete: (type, result, filename) => {
      onExportComplete?.(type, result, filename);
    }
  });

  // Get final processed data
  const processedData = useMemo(() => {
    let result = data;
    
    if (enableSorting) {
      result = sortHook.sortedData;
    }
    
    if (enableFiltering) {
      result = filterHook.filteredData;
    }
    
    // Handle benchmark positioning
    if (benchmarkPositioning !== 'inline' && result.some(item => item.is_benchmark)) {
      const benchmarks = result.filter(item => item.is_benchmark);
      const funds = result.filter(item => !item.is_benchmark);
      
      if (benchmarkPositioning === 'top') {
        result = [...benchmarks, ...funds];
      } else if (benchmarkPositioning === 'bottom') {
        result = [...funds, ...benchmarks];
      }
    }
    
    return result;
  }, [data, sortHook.sortedData, filterHook.filteredData, enableSorting, enableFiltering, benchmarkPositioning]);

  // Expose methods through ref
  useImperativeHandle(ref, () => ({
    // Data access
    getData: () => processedData,
    getSelectedData: () => selectionHook.selectedData,
    getFilterStats: () => filterHook.getFilterStats,
    
    // Actions
    clearFilters: () => filterHook.clearFilters(),
    clearSelection: () => selectionHook.clearSelection(),
    selectAll: () => selectionHook.selectAll(),
    
    // Export
    exportCSV: (options) => exportHook.exportCSV(options),
    exportExcel: (options) => exportHook.exportExcel(options),
    exportPDF: (options) => exportHook.exportPDF(options),
    
    // Focus management
    focusRow: (index) => setFocusedRowIndex(index),
    scrollToRow: (index) => {
      if (virtualListRef.current) {
        virtualListRef.current.scrollToItem(index);
      }
    }
  }));

  // Keyboard navigation
  const handleKeyDown = useCallback((event) => {
    if (!processedData.length) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setFocusedRowIndex(prev => Math.min(prev + 1, processedData.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setFocusedRowIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Home':
        event.preventDefault();
        setFocusedRowIndex(0);
        break;
      case 'End':
        event.preventDefault();
        setFocusedRowIndex(processedData.length - 1);
        break;
      case 'Enter':
      case ' ':
        if (focusedRowIndex >= 0) {
          event.preventDefault();
          const row = processedData[focusedRowIndex];
          if (enableSelection) {
            selectionHook.toggleItem(row, focusedRowIndex);
          }
          if (onRowClick) {
            onRowClick(row, focusedRowIndex);
          }
        }
        break;
      case 'Escape':
        event.preventDefault();
        setFocusedRowIndex(-1);
        break;
    }
  }, [processedData, focusedRowIndex, enableSelection, selectionHook, onRowClick]);

  // Sort handler
  const handleSort = useCallback((columnKey, event) => {
    if (!enableSorting) return;
    
    const isMultiSort = event?.shiftKey || event?.ctrlKey || event?.metaKey;
    sortHook.handleSort(columnKey, null);
  }, [enableSorting, sortHook]);

  // Get row styling
  const getRowClassName = useCallback((rowData, index) => {
    const classes = ['datatable-row'];
    
    if (rowClassName) {
      classes.push(typeof rowClassName === 'function' ? rowClassName(rowData, index) : rowClassName);
    }
    
    if (showRowHover) {
      classes.push('datatable-row-hover');
    }
    
    if (highlightRecommended && (rowData.is_recommended || rowData.recommended)) {
      classes.push('datatable-row-recommended');
    }
    
    if (highlightBenchmarks && rowData.is_benchmark) {
      classes.push('datatable-row-benchmark');
    }
    
    if (enableSelection && selectionHook.isSelected(rowData, index)) {
      classes.push('datatable-row-selected');
    }
    
    if (focusedRowIndex === index) {
      classes.push('datatable-row-focused');
    }
    
    classes.push(`datatable-density-${density}`);
    classes.push(`datatable-theme-${theme}`);
    
    if (ENABLE_VISUAL_REFRESH) {
      classes.push('datatable-visual-refresh');
    }
    
    return classes.join(' ');
  }, [
    rowClassName, showRowHover, highlightRecommended, highlightBenchmarks,
    enableSelection, selectionHook, focusedRowIndex, density, theme, ENABLE_VISUAL_REFRESH
  ]);

  // Render table header
  const renderHeader = () => (
    <thead 
      ref={headerRef}
      className={`datatable-header ${headerClassName} ${stickyHeader ? 'datatable-header-sticky' : ''}`}
    >
      <tr className="datatable-header-row">
        {enableSelection && (
          <th className="datatable-header-cell datatable-selection-header">
            <input
              type="checkbox"
              checked={selectionHook.selectionStats.allSelected}
              onChange={selectionHook.selectionStats.allSelected ? selectionHook.clearSelection : selectionHook.selectAll}
              aria-label="Select all rows"
            />
          </th>
        )}
        
        {columns.map((column) => (
          <th
            key={column.key}
            className={`datatable-header-cell ${column.sortable && enableSorting ? 'datatable-sortable' : ''}`}
            style={{ 
              width: column.width,
              textAlign: column.alignment || 'left',
              ...column.headerStyle
            }}
            onClick={(e) => column.sortable && handleSort(column.key, e)}
            title={column.tooltip}
            aria-sort={
              enableSorting && column.sortable
                ? getSortAriaLabel(sortHook.getSortStatus(column.key).direction)
                : 'none'
            }
          >
            <div className="datatable-header-content">
              <span className="datatable-header-label">{column.label}</span>
              
              {enableSorting && column.sortable && (
                <span className="datatable-sort-indicator">
                  {renderSortIndicator(sortHook.getSortStatus(column.key))}
                </span>
              )}
            </div>
          </th>
        ))}
      </tr>
    </thead>
  );

  // Render sort indicator
  const renderSortIndicator = (sortStatus) => {
    const { direction, priority } = sortStatus;
    
    if (!direction) {
      return <ArrowUpDown size={14} className="datatable-sort-icon-neutral" />;
    }
    
    const Icon = direction === 'asc' ? ArrowUp : ArrowDown;
    
    return (
      <span className="datatable-sort-indicator-active">
        <Icon size={14} className="datatable-sort-icon" />
        {priority && priority > 1 && (
          <span className="datatable-sort-priority">{priority}</span>
        )}
      </span>
    );
  };

  // Render table cell
  const renderCell = (column, rowData, rowIndex) => {
    const cellProps = {
      className: `datatable-cell ${cellClassName}`,
      style: { 
        textAlign: column.alignment || 'left',
        width: column.width,
        ...column.cellStyle
      },
      'data-column': column.key
    };

    // Use custom renderer if provided
    if (column.render) {
      const context = {
        ScoreTooltip,
        Sparkline,
        historyCache,
        chartPeriod
      };
      
      const content = column.render(
        column.getValue(rowData),
        rowData,
        processedData,
        context
      );
      
      return <td {...cellProps}>{content}</td>;
    }

    // Use formatted value
    const value = column.getFormattedValue ? column.getFormattedValue(rowData) : column.getValue(rowData);
    
    return (
      <td {...cellProps}>
        <span className="datatable-cell-content">
          {value ?? '—'}
        </span>
      </td>
    );
  };

  // Render table row
  const renderRow = (rowData, index) => (
    <tr
      key={getRowKey(rowData, index)}
      className={getRowClassName(rowData, index)}
      onClick={(e) => {
        setFocusedRowIndex(index);
        onRowClick?.(rowData, index, e);
      }}
      onDoubleClick={(e) => onRowDoubleClick?.(rowData, index, e)}
      tabIndex={focusedRowIndex === index ? 0 : -1}
      role="row"
      aria-rowindex={index + 1}
      aria-selected={enableSelection ? selectionHook.isSelected(rowData, index) : undefined}
    >
      {enableSelection && (
        <td className="datatable-cell datatable-selection-cell">
          <input
            type="checkbox"
            checked={selectionHook.isSelected(rowData, index)}
            onChange={() => selectionHook.toggleItem(rowData, index)}
            aria-label={`Select row ${index + 1}`}
          />
        </td>
      )}
      
      {columns.map((column) => renderCell(column, rowData, index))}
    </tr>
  );

  // Virtual row renderer for react-window
  const VirtualRow = ({ index, style }) => {
    const rowData = processedData[index];
    if (!rowData) return null;

    return (
      <div style={style} className="datatable-virtual-row">
        {renderRow(rowData, index)}
      </div>
    );
  };

  // Get unique row key
  const getRowKey = (rowData, index) => {
    // Try common unique identifiers
    return rowData.id || rowData.ticker || rowData.symbol || rowData.fund_id || index;
  };

  // Get ARIA sort label
  const getSortAriaLabel = (direction) => {
    if (!direction) return 'none';
    return direction === 'asc' ? 'ascending' : 'descending';
  };

  // Loading state
  if (loading) {
    return (
      <div className="datatable-loading">
        <Loader2 className="datatable-loading-spinner" />
        <span className="datatable-loading-text">{loadingMessage}</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="datatable-error">
        <AlertCircle className="datatable-error-icon" />
        <span className="datatable-error-text">
          {typeof error === 'string' ? error : 'An error occurred while loading data'}
        </span>
      </div>
    );
  }

  // Empty state
  if (!processedData.length) {
    return (
      <div className="datatable-empty">
        <span className="datatable-empty-text">{emptyMessage}</span>
      </div>
    );
  }

  // Calculate table height for virtual scrolling
  const tableHeight = maxHeight || (enableVirtualScrolling ? Math.min(virtualRowHeight * Math.min(processedData.length, 20), 800) : 'auto');

  return (
    <div
      ref={tableRef}
      className={`datatable ${className} datatable-theme-${theme} datatable-density-${density} ${ENABLE_VISUAL_REFRESH ? 'datatable-visual-refresh' : ''}`}
      style={{ 
        ...style, 
        height: tableHeight,
        minHeight,
        maxHeight
      }}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="table"
      aria-label={ariaLabel}
      aria-rowcount={processedData.length}
    >
      {/* Table controls */}
      <div className="datatable-controls">
        {/* Filtering controls would go here */}
        {/* Export controls would go here */}
      </div>

      {/* Main table */}
      {enableVirtualScrolling && processedData.length > 50 ? (
        <div className="datatable-virtual-container">
          <table className="datatable-table datatable-table-virtual">
            {renderHeader()}
          </table>
          
          <List
            ref={virtualListRef}
            height={typeof tableHeight === 'number' ? tableHeight - 40 : 400} // Account for header
            itemCount={processedData.length}
            itemSize={virtualRowHeight}
            overscanCount={virtualOverscan}
            className="datatable-virtual-list"
          >
            {VirtualRow}
          </List>
        </div>
      ) : (
        <div className="datatable-scroll-container">
          <table className="datatable-table">
            {renderHeader()}
            <tbody className="datatable-body" role="rowgroup">
              {processedData.map((rowData, index) => renderRow(rowData, index))}
            </tbody>
          </table>
        </div>
      )}

      {/* Table footer */}
      <div className="datatable-footer">
        <div className="datatable-stats">
          Showing {processedData.length} of {data.length} items
          {enableFiltering && filterHook.hasActiveFilters && (
            <span className="datatable-filter-indicator"> (filtered)</span>
          )}
          {enableSelection && selectionHook.selectedItems.length > 0 && (
            <span className="datatable-selection-indicator">
              {selectionHook.selectedItems.length} selected
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

DataTable.displayName = 'DataTable';

export default DataTable;