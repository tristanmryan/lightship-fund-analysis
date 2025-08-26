import { useTableSort } from './useTableSort';
import { useTableFilter } from './useTableFilter';
import { useTableExport } from './useTableExport';
import { useTableSelection } from './useTableSelection';

/**
 * Combined hook that provides all table functionality
 * This is a convenience hook for components that need all table features
 */
export function useTableHooks({
  data = [],
  columns = [],
  initialSortConfig = null,
  initialFilters = {},
  selectionMode = 'single',
  onSelectionChange = null,
  onExportStart = null,
  onExportComplete = null,
  onExportError = null,
  metadata = {}
} = {}) {
  // Initialize all hooks
  const sortHook = useTableSort({
    data,
    initialSortConfig,
    multiColumn: true,
    columnDefinitions: columns.reduce((acc, col) => {
      acc[col.key] = col;
      return acc;
    }, {})
  });

  const filterHook = useTableFilter({
    data: sortHook.sortedData,
    searchableFields: ['name', 'ticker', 'symbol'],
    initialFilters
  });

  const selectionHook = useTableSelection({
    data: filterHook.filteredData,
    selectionMode,
    onSelectionChange
  });

  const exportHook = useTableExport({
    data: filterHook.filteredData,
    columns,
    sortConfig: sortHook.sortConfig,
    filters: filterHook.filters,
    metadata,
    onExportStart,
    onExportComplete,
    onExportError
  });

  // Combined data flow: data -> sort -> filter -> selection
  const processedData = filterHook.filteredData;
  const selectedData = selectionHook.selectedItems;

  // Combined stats
  const tableStats = {
    total: data.length,
    filtered: processedData.length,
    selected: selectedData.length,
    sortActive: sortHook.sortConfig.length > 0,
    filtersActive: filterHook.hasActiveFilters,
    selectionActive: selectionHook.hasSelection
  };

  // Combined actions
  const actions = {
    // Sorting
    sort: sortHook.handleSort,
    clearSort: sortHook.clearSort,
    
    // Filtering
    search: filterHook.setSearchTerm,
    filter: filterHook.updateFilter,
    clearFilters: filterHook.clearFilters,
    
    // Selection
    select: selectionHook.selectItem,
    deselect: selectionHook.deselectItem,
    toggle: selectionHook.toggleItem,
    clearSelection: selectionHook.clearSelection,
    
    // Export
    exportCSV: exportHook.exportCSV,
    exportExcel: exportHook.exportExcel,
    exportPDF: exportHook.exportPDF
  };

  return {
    // Data
    data: processedData,
    selectedData,
    originalData: data,
    
    // Hooks (for advanced usage)
    sort: sortHook,
    filter: filterHook,
    selection: selectionHook,
    export: exportHook,
    
    // Combined state
    stats: tableStats,
    actions,
    
    // Quick access to common values
    sortConfig: sortHook.sortConfig,
    filters: filterHook.filters,
    searchTerm: filterHook.searchTerm,
    selectedItems: selectionHook.selectedItems,
    isExporting: exportHook.isExporting
  };
} 