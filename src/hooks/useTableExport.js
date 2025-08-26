import { useState, useCallback, useMemo } from 'react';
import { 
  exportToExcel,
  exportToCSV,
  generatePDFReport,
  downloadFile,
  downloadPDF,
  formatExportFilename,
  shouldConfirmLargeExport,
  exportTableCSV,
  exportCompareCSV,
  exportComparePDF,
  exportAssetClassTableCSV,
  exportCurrentView
} from '../services/exportService';

/**
 * Table export hook that works with existing exportService
 * Supports CSV, Excel, and PDF exports with various configurations
 */
export function useTableExport({
  data = [],
  columns = [],
  sortConfig = [],
  filters = {},
  metadata = {},
  onExportStart = null,
  onExportComplete = null,
  onExportError = null
} = {}) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(null);
  const [lastExportInfo, setLastExportInfo] = useState(null);

  const exportStats = useMemo(() => {
    const totalRows = data.length;
    const needsConfirmation = shouldConfirmLargeExport(totalRows);
    const hasFilters = Object.keys(filters).length > 0;
    const hasSorting = sortConfig.length > 0;

    return {
      totalRows,
      needsConfirmation,
      hasFilters,
      hasSorting,
      estimatedFileSize: calculateEstimatedFileSize(totalRows, columns.length)
    };
  }, [data.length, filters, sortConfig, columns.length]);

  const handleExportStart = useCallback((exportType, options = {}) => {
    setIsExporting(true);
    setExportProgress({ type: exportType, status: 'preparing', progress: 0 });
    
    if (onExportStart) {
      onExportStart(exportType, options);
    }
  }, [onExportStart]);

  const handleExportComplete = useCallback((exportType, result, filename) => {
    setIsExporting(false);
    setExportProgress(null);
    setLastExportInfo({
      type: exportType,
      timestamp: new Date(),
      filename,
      rowCount: data.length,
      success: true
    });

    if (onExportComplete) {
      onExportComplete(exportType, result, filename);
    }
  }, [onExportComplete, data.length]);

  const handleExportError = useCallback((exportType, error) => {
    setIsExporting(false);
    setExportProgress(null);
    setLastExportInfo({
      type: exportType,
      timestamp: new Date(),
      error: error.message,
      success: false
    });

    if (onExportError) {
      onExportError(exportType, error);
    }
  }, [onExportError]);

  // CSV Export
  const exportCSV = useCallback(async (options = {}) => {
    const {
      filename = null,
      includeMetadata = true,
      customColumns = null,
      scope = 'table'
    } = options;

    try {
      handleExportStart('csv', options);
      setExportProgress({ type: 'csv', status: 'generating', progress: 25 });

      let blob;
      let exportFilename = filename;

      if (scope === 'current-view') {
        // Export current view with enhanced formatting
        blob = exportCurrentView({
          funds: data,
          columns: customColumns || columns,
          sortConfig,
          selectedPreset: options.selectedPreset || 'core',
          activeFilters: filters,
          metadata: {
            ...metadata,
            exportedAt: new Date(),
            filterSummary: generateFilterSummary(filters),
            kind: 'Current View'
          }
        });
        exportFilename = exportFilename || formatExportFilename({ 
          scope: 'current_view', 
          asOf: metadata.asOf,
          ext: 'csv' 
        });
      } else if (scope === 'table') {
        // Standard table export
        blob = exportTableCSV({
          funds: data,
          columns: customColumns || columns,
          sortConfig,
          metadata: {
            ...metadata,
            exportedAt: new Date(),
            selectedPreset: options.selectedPreset,
            filterSummary: generateFilterSummary(filters),
            chartPeriod: options.chartPeriod,
            kind: 'Table Export'
          }
        });
        exportFilename = exportFilename || formatExportFilename({ 
          scope: 'table', 
          asOf: metadata.asOf,
          ext: 'csv' 
        });
      } else {
        // Legacy simple CSV
        blob = exportToCSV(data);
        exportFilename = exportFilename || formatExportFilename({ 
          scope: 'export',
          ext: 'csv' 
        });
      }

      setExportProgress({ type: 'csv', status: 'downloading', progress: 75 });
      
      downloadFile(blob, exportFilename, 'text/csv');
      
      setExportProgress({ type: 'csv', status: 'complete', progress: 100 });
      handleExportComplete('csv', blob, exportFilename);

    } catch (error) {
      console.error('CSV Export Error:', error);
      handleExportError('csv', error);
      throw error;
    }
  }, [data, columns, sortConfig, filters, metadata, handleExportStart, handleExportComplete, handleExportError]);

  // Excel Export
  const exportExcel = useCallback(async (options = {}) => {
    const {
      filename = null,
      includeAllSheets = true,
      selectedPreset = null,
      visibleColumns = []
    } = options;

    try {
      handleExportStart('excel', options);
      setExportProgress({ type: 'excel', status: 'generating', progress: 25 });

      const exportData = {
        funds: data,
        metadata: {
          ...metadata,
          exportedAt: new Date()
        }
      };

      const exportOptions = {
        selectedPreset,
        activeFilters: filters,
        visibleColumns: visibleColumns.length > 0 ? visibleColumns : columns,
        metadata: exportData.metadata
      };

      setExportProgress({ type: 'excel', status: 'processing', progress: 50 });

      const blob = exportToExcel(exportData, exportOptions);
      
      const exportFilename = filename || formatExportFilename({ 
        scope: 'funds', 
        asOf: metadata.asOf,
        ext: 'xlsx' 
      });

      setExportProgress({ type: 'excel', status: 'downloading', progress: 75 });
      
      downloadFile(blob, exportFilename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      
      setExportProgress({ type: 'excel', status: 'complete', progress: 100 });
      handleExportComplete('excel', blob, exportFilename);

    } catch (error) {
      console.error('Excel Export Error:', error);
      handleExportError('excel', error);
      throw error;
    }
  }, [data, columns, filters, metadata, handleExportStart, handleExportComplete, handleExportError]);

  // PDF Export
  const exportPDF = useCallback(async (options = {}) => {
    const {
      filename = null,
      scope = 'all',
      landscape = true,
      includeTOC = true,
      forceV2 = false
    } = options;

    try {
      handleExportStart('pdf', options);
      setExportProgress({ type: 'pdf', status: 'generating', progress: 25 });

      const exportData = {
        funds: data,
        metadata: {
          ...metadata,
          exportedAt: new Date(),
          scope,
          totalFunds: data.length,
          recommendedFunds: data.filter(f => f.is_recommended).length
        }
      };

      const exportOptions = {
        scope,
        landscape,
        includeTOC,
        forceV2,
        columns: columns.map(col => col.key || col),
        tickers: scope === 'selected' ? data.map(f => f.ticker || f.symbol).filter(Boolean) : null
      };

      setExportProgress({ type: 'pdf', status: 'processing', progress: 50 });

      const pdfResult = await generatePDFReport(exportData, exportOptions);
      
      const exportFilename = filename || formatExportFilename({ 
        scope: 'report', 
        asOf: metadata.asOf,
        ext: 'pdf' 
      });

      setExportProgress({ type: 'pdf', status: 'downloading', progress: 75 });
      
      downloadPDF(pdfResult, exportFilename);
      
      setExportProgress({ type: 'pdf', status: 'complete', progress: 100 });
      handleExportComplete('pdf', pdfResult, exportFilename);

    } catch (error) {
      console.error('PDF Export Error:', error);
      handleExportError('pdf', error);
      throw error;
    }
  }, [data, columns, metadata, handleExportStart, handleExportComplete, handleExportError]);

  // Specialized exports
  const exportCompareData = useCallback(async (options = {}) => {
    const { format = 'csv', filename = null } = options;

    try {
      handleExportStart(`compare-${format}`, options);

      const exportMetadata = {
        ...metadata,
        exportedAt: new Date(),
        asOfDate: metadata.asOf || 'Latest'
      };

      let result, exportFilename;

      if (format === 'csv') {
        result = exportCompareCSV({ 
          funds: data, 
          metadata: exportMetadata 
        });
        exportFilename = filename || formatExportFilename({ 
          scope: 'comparison', 
          asOf: metadata.asOf,
          ext: 'csv' 
        });
        downloadFile(result, exportFilename, 'text/csv');
      } else if (format === 'pdf') {
        result = await exportComparePDF({ 
          funds: data, 
          metadata: exportMetadata 
        });
        exportFilename = filename || formatExportFilename({ 
          scope: 'comparison', 
          asOf: metadata.asOf,
          ext: 'pdf' 
        });
        downloadPDF(result, exportFilename);
      }

      handleExportComplete(`compare-${format}`, result, exportFilename);

    } catch (error) {
      console.error(`Compare ${format.toUpperCase()} Export Error:`, error);
      handleExportError(`compare-${format}`, error);
      throw error;
    }
  }, [data, metadata, handleExportStart, handleExportComplete, handleExportError]);

  const exportAssetClassTable = useCallback(async (options = {}) => {
    const { 
      assetClassName = 'Asset Class',
      filename = null 
    } = options;

    try {
      handleExportStart('asset-class-csv', options);
      
      exportAssetClassTableCSV(
        data, 
        assetClassName, 
        metadata.asOf || null
      );

      handleExportComplete('asset-class-csv', null, 
        filename || `${assetClassName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`
      );

    } catch (error) {
      console.error('Asset Class Table Export Error:', error);
      handleExportError('asset-class-csv', error);
      throw error;
    }
  }, [data, metadata, handleExportStart, handleExportComplete, handleExportError]);

  // Batch export multiple formats
  const exportMultiple = useCallback(async (formats = ['csv'], options = {}) => {
    const { baseFilename = 'export' } = options;
    
    try {
      handleExportStart('batch', { formats, ...options });
      
      const results = [];
      const total = formats.length;
      
      for (let i = 0; i < formats.length; i++) {
        const format = formats[i];
        const progress = Math.round((i / total) * 100);
        
        setExportProgress({ 
          type: 'batch', 
          status: `exporting ${format}`, 
          progress,
          current: format,
          completed: i,
          total 
        });

        const formatOptions = { ...options, filename: `${baseFilename}.${format}` };
        
        switch (format) {
          case 'csv':
            await exportCSV(formatOptions);
            break;
          case 'xlsx':
            await exportExcel(formatOptions);
            break;
          case 'pdf':
            await exportPDF(formatOptions);
            break;
          default:
            console.warn(`Unknown export format: ${format}`);
        }
        
        results.push({ format, success: true });
      }
      
      setExportProgress({ type: 'batch', status: 'complete', progress: 100 });
      handleExportComplete('batch', results, `${baseFilename}_batch`);
      
    } catch (error) {
      console.error('Batch Export Error:', error);
      handleExportError('batch', error);
      throw error;
    }
  }, [exportCSV, exportExcel, exportPDF, handleExportStart, handleExportComplete, handleExportError]);

  return {
    // Export methods
    exportCSV,
    exportExcel,
    exportPDF,
    exportCompareData,
    exportAssetClassTable,
    exportMultiple,

    // State
    isExporting,
    exportProgress,
    lastExportInfo,
    exportStats,

    // Utilities
    generateFilename: (scope, format) => formatExportFilename({ 
      scope, 
      asOf: metadata.asOf, 
      ext: format 
    }),
    shouldConfirmExport: exportStats.needsConfirmation
  };
}

/**
 * Hook for export confirmation dialogs
 */
export function useExportConfirmation() {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationData, setConfirmationData] = useState(null);

  const requestConfirmation = useCallback((exportType, stats, onConfirm) => {
    setConfirmationData({ exportType, stats, onConfirm });
    setShowConfirmation(true);
  }, []);

  const handleConfirm = useCallback(() => {
    if (confirmationData?.onConfirm) {
      confirmationData.onConfirm();
    }
    setShowConfirmation(false);
    setConfirmationData(null);
  }, [confirmationData]);

  const handleCancel = useCallback(() => {
    setShowConfirmation(false);
    setConfirmationData(null);
  }, []);

  return {
    showConfirmation,
    confirmationData,
    requestConfirmation,
    handleConfirm,
    handleCancel
  };
}

/**
 * Generate filter summary for export metadata
 */
function generateFilterSummary(filters) {
  return Object.entries(filters)
    .filter(([key, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      if (value && typeof value === 'object') return Object.values(value).some(v => v !== '' && v !== 'all');
      return value !== '' && value !== 'all' && value != null;
    })
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join(', ') || 'None applied';
}

/**
 * Calculate estimated file size based on rows and columns
 */
function calculateEstimatedFileSize(rows, columns) {
  const avgCellSize = 15; // Average bytes per cell
  const bytesEstimate = rows * columns * avgCellSize;
  
  // Convert to human readable format
  if (bytesEstimate < 1024) return `${bytesEstimate} bytes`;
  if (bytesEstimate < 1024 * 1024) return `${Math.round(bytesEstimate / 1024)} KB`;
  return `${Math.round(bytesEstimate / (1024 * 1024))} MB`;
}

/**
 * Export format configurations
 */
export const EXPORT_FORMATS = {
  csv: {
    name: 'CSV',
    description: 'Comma-separated values for spreadsheet applications',
    extension: 'csv',
    mimeType: 'text/csv',
    supportsLargeDatasets: true
  },
  excel: {
    name: 'Excel',
    description: 'Microsoft Excel workbook with multiple sheets',
    extension: 'xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    supportsLargeDatasets: true
  },
  pdf: {
    name: 'PDF',
    description: 'Formatted PDF report for presentation',
    extension: 'pdf',
    mimeType: 'application/pdf',
    supportsLargeDatasets: false
  }
};

/**
 * Export scope configurations
 */
export const EXPORT_SCOPES = {
  all: {
    name: 'All Data',
    description: 'Export all available data regardless of current filters'
  },
  filtered: {
    name: 'Filtered Data',
    description: 'Export only data matching current filters'
  },
  selected: {
    name: 'Selected Rows',
    description: 'Export only selected table rows'
  },
  recommended: {
    name: 'Recommended Only',
    description: 'Export only recommended funds'
  },
  'current-view': {
    name: 'Current View',
    description: 'Export data exactly as shown in current table view'
  }
};