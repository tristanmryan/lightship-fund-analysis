import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  ArrowUp, ArrowDown, Download, Eye, MoreHorizontal,
  ChevronUp, ChevronDown, Settings
} from 'lucide-react';
import DataTable from '../common/DataTable';
import { 
  EXTENDED_COLUMNS,
  ADVANCED_COLUMNS, 
  COLUMN_REGISTRY,
  getColumnsByKeys,
  COLUMN_PRESETS
} from '../../config/tableColumns';
import ScoreTooltip from './ScoreTooltip';
import Sparkline from './Sparkline';
import fundService from '../../services/fundService';

// Feature flag for gradual migration
const USE_UNIFIED_TABLE = (process.env.REACT_APP_USE_UNIFIED_TABLES || 'false') === 'true';

// Import legacy component for fallback
import LegacyEnhancedFundTable from './EnhancedFundTable.jsx';

/**
 * Enhanced Fund Table Component - Unified Version
 * Uses the DataTable component with advanced sorting, filtering, and export features
 * Maintains all existing functionality including preset column selection and sparkline integration
 */
const EnhancedFundTable = ({
  funds = [],
  onFundSelect,
  showDetailModal = false,
  chartPeriod = '1Y',
  initialSortConfig = null,
  initialSelectedColumns = null,
  onStateChange,
  registerExportHandler,
  presetSelector = null
}) => {
  // Feature flag fallback to legacy component
  if (!USE_UNIFIED_TABLE) {
    return (
      <LegacyEnhancedFundTable
        funds={funds}
        onFundSelect={onFundSelect}
        showDetailModal={showDetailModal}
        chartPeriod={chartPeriod}
        initialSortConfig={initialSortConfig}
        initialSelectedColumns={initialSelectedColumns}
        onStateChange={onStateChange}
        registerExportHandler={registerExportHandler}
        presetSelector={presetSelector}
      />
    );
  }

  // State management
  const [selectedColumns, setSelectedColumns] = useState(() => {
    return initialSelectedColumns || [
      'symbol', 'name', 'assetClass', 'score', 'ytdReturn', 'oneYearReturn', 
      'threeYearReturn', 'expenseRatio', 'sharpeRatio', 'recommended'
    ];
  });
  
  const [selectedPreset, setSelectedPreset] = useState('extended');
  const [historyCache, setHistoryCache] = useState({});
  const [hoveredFund, setHoveredFund] = useState(null);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);
  
  // Default sort configuration
  const defaultSortConfig = initialSortConfig || [{ key: 'score', direction: 'desc' }];

  // Get current columns based on selection
  const currentColumns = useMemo(() => {
    const columnObjects = getColumnsByKeys(selectedColumns);
    return columnObjects.filter(Boolean); // Remove any undefined columns
  }, [selectedColumns]);

  // Preload sparkline history data
  const preloadSparklineData = useCallback(async (currentSortedFunds, currentHistoryCache) => {
    if (!selectedColumns.includes('sparkline')) return;
    
    const needed = new Set((currentSortedFunds || []).map(f => (f.ticker || f.Symbol)).filter(Boolean));
    const missing = Array.from(needed).filter(ticker => !currentHistoryCache[ticker]);
    
    if (missing.length === 0) return;

    try {
      console.log(`📊 Preloading sparkline data for ${missing.length} funds...`);
      const results = await Promise.allSettled(
        missing.map(async (ticker) => {
          const historyRows = await fundService.getFundHistory(ticker);
          return { ticker, historyRows };
        })
      );

      const newCache = { ...currentHistoryCache };
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const { ticker, historyRows } = result.value;
          newCache[ticker] = historyRows || [];
        } else {
          console.warn(`Failed to load history for ${missing[index]}:`, result.reason);
          newCache[missing[index]] = [];
        }
      });

      setHistoryCache(newCache);
    } catch (error) {
      console.error('Error preloading sparkline data:', error);
    }
  }, [selectedColumns]);

  // Emit state changes to parent
  useEffect(() => {
    if (typeof onStateChange === 'function') {
      onStateChange({ selectedColumns, sortConfig: defaultSortConfig });
    }
  }, [selectedColumns, onStateChange, defaultSortConfig]);

  // Register export handler with parent
  useEffect(() => {
    if (typeof registerExportHandler === 'function') {
      registerExportHandler((exportType, options) => {
        // This will be handled by the DataTable's export hook
        console.log('Export requested:', exportType, options);
      });
    }
  }, [registerExportHandler]);

  // Handle column selection
  const handleColumnToggle = useCallback((columnKey) => {
    setSelectedColumns(prev => {
      if (prev.includes(columnKey)) {
        return prev.filter(key => key !== columnKey);
      } else {
        return [...prev, columnKey];
      }
    });
  }, []);

  // Handle preset selection
  const handlePresetChange = useCallback((presetName) => {
    const preset = COLUMN_PRESETS[presetName];
    if (preset) {
      setSelectedColumns(preset.columns);
      setSelectedPreset(presetName);
    }
  }, []);

  // Column selector component
  const ColumnSelector = () => (
    <div className="enhanced-table-column-selector">
      <div className="column-selector-header">
        <h4>Column Selection</h4>
        <button 
          onClick={() => setShowColumnSelector(false)}
          className="close-button"
        >
          ×
        </button>
      </div>
      
      {/* Preset Selection */}
      <div className="preset-selection">
        <label>Preset:</label>
        <select 
          value={selectedPreset}
          onChange={(e) => handlePresetChange(e.target.value)}
        >
          {Object.entries(COLUMN_PRESETS).map(([key, preset]) => (
            <option key={key} value={key}>
              {preset.name} ({preset.columns.length} columns)
            </option>
          ))}
        </select>
      </div>

      {/* Individual Column Selection */}
      <div className="column-checkboxes">
        {Object.entries(COLUMN_REGISTRY).map(([key, column]) => (
          <label key={key} className="column-checkbox">
            <input
              type="checkbox"
              checked={selectedColumns.includes(key)}
              onChange={() => handleColumnToggle(key)}
            />
            <span>{column.label}</span>
          </label>
        ))}
      </div>
    </div>
  );

  // Table controls
  const TableControls = () => (
    <div className="enhanced-table-controls">
      {presetSelector && (
        <div className="preset-selector-container">
          {presetSelector}
        </div>
      )}
      
      <div className="table-actions">
        <button
          className="control-button"
          onClick={() => setShowColumnSelector(!showColumnSelector)}
          title="Configure columns"
        >
          <Settings size={16} />
          Columns
        </button>
        
        <button
          className="control-button"
          onClick={() => setShowExportOptions(!showExportOptions)}
          title="Export options"
        >
          <Download size={16} />
          Export
        </button>
        
        <button
          className="control-button"
          title="More options"
        >
          <MoreHorizontal size={16} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="enhanced-fund-table-container">
      {/* Table Controls */}
      <TableControls />
      
      {/* Column Selector */}
      {showColumnSelector && <ColumnSelector />}
      
      {/* Main DataTable */}
      <DataTable
        // Data
        data={funds}
        columns={currentColumns}
        
        // Enhanced features configuration
        enableSorting={true}
        enableFiltering={true}
        enableSelection={true}
        enableExport={true}
        enableVirtualScrolling={funds.length > 100}
        
        // Visual configuration
        theme="default"
        density="normal"
        stickyHeader={true}
        showRowHover={true}
        highlightRecommended={true}
        highlightBenchmarks={true}
        benchmarkPositioning="inline"
        
        // Hook configurations
        sortConfig={defaultSortConfig}
        selectionConfig={{
          selectionMode: 'multiple',
          maxSelection: null
        }}
        filterConfig={{
          searchableFields: ['name', 'ticker', 'symbol', 'asset_class'],
          debounceMs: 300
        }}
        exportConfig={{
          metadata: { 
            chartPeriod,
            selectedColumns: selectedColumns,
            selectedPreset
          },
          onExportStart: (type) => console.log(`Starting ${type} export...`),
          onExportComplete: (type, result, filename) => {
            console.log(`Export completed: ${filename}`);
          }
        }}
        
        // Component dependencies for custom renderers
        ScoreTooltip={ScoreTooltip}
        Sparkline={Sparkline}
        historyCache={historyCache}
        chartPeriod={chartPeriod}
        
        // Event handlers
        onRowClick={onFundSelect}
        onRowSelect={(selectedIds, selectedData) => {
          console.log('Selection changed:', selectedData.length, 'funds selected');
        }}
        onSortChange={(sortConfig) => {
          console.log('Sort changed:', sortConfig);
          // Trigger sparkline preload when sorting changes
          if (selectedColumns.includes('sparkline')) {
            preloadSparklineData(funds, historyCache);
          }
        }}
        onFilterChange={(filters) => {
          console.log('Filters changed:', filters);
        }}
        
        // Styling
        className="enhanced-fund-table"
        rowClassName={(fund) => {
          let classes = '';
          if (hoveredFund?.ticker === fund.ticker) {
            classes += ' fund-hovered';
          }
          return classes;
        }}
        
        // Advanced options
        maxHeight="800px"
        preserveScrollPosition={true}
        
        // Accessibility
        ariaLabel="Enhanced fund analysis table with multi-column sorting and advanced features"
      />
    </div>
  );
};

export default EnhancedFundTable;