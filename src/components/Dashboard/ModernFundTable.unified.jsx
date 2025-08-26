import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  Download, Filter, Eye, Target, BarChart3
} from 'lucide-react';
import DataTable from '../common/DataTable';
import { 
  EXTENDED_COLUMNS,
  getColumnsByKeys,
  COLUMN_PRESETS
} from '../../config/tableColumns';
import FundStatusBadge from './FundStatusBadge';

// Feature flag for gradual migration
const USE_UNIFIED_TABLE = (process.env.REACT_APP_USE_UNIFIED_TABLES || 'false') === 'true';

// Import legacy component for fallback
import LegacyModernFundTable from './ModernFundTable.jsx';

/**
 * Modern Fund Table Component - Unified Version
 * Uses the DataTable component with modern theme and clean styling
 * Maintains Tailwind CSS compatibility and professional appearance
 */
const ModernFundTable = ({
  funds = [],
  onFundSelect,
  chartPeriod = '1Y',
  initialSortConfig = null,
  initialSelectedColumns = null,
  onStateChange,
  registerExportHandler
}) => {
  // Feature flag fallback to legacy component
  if (!USE_UNIFIED_TABLE) {
    return (
      <LegacyModernFundTable
        funds={funds}
        onFundSelect={onFundSelect}
        chartPeriod={chartPeriod}
        initialSortConfig={initialSortConfig}
        initialSelectedColumns={initialSelectedColumns}
        onStateChange={onStateChange}
        registerExportHandler={registerExportHandler}
      />
    );
  }

  // State management
  const [selectedColumns, setSelectedColumns] = useState(() => {
    return initialSelectedColumns || [
      'symbol', 'name', 'assetClass', 'score', 'ytdReturn', 'oneYearReturn', 
      'threeYearReturn', 'expenseRatio', 'sharpeRatio', 'beta'
    ];
  });
  
  const [selectedPreset, setSelectedPreset] = useState('extended');
  const [showFilters, setShowFilters] = useState(false);
  const [showColumnOptions, setShowColumnOptions] = useState(false);
  
  // Default sort configuration (single column for modern table)
  const defaultSortConfig = initialSortConfig || [{ key: 'score', direction: 'desc' }];

  // Get current columns
  const currentColumns = useMemo(() => {
    return getColumnsByKeys(selectedColumns).filter(Boolean);
  }, [selectedColumns]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    if (!funds.length) return null;
    
    const totalFunds = funds.length;
    const recommendedCount = funds.filter(f => f.is_recommended || f.recommended).length;
    const avgScore = funds.reduce((sum, f) => sum + (f.score || f.score_final || 0), 0) / totalFunds;
    const avgYTD = funds.reduce((sum, f) => sum + (f.ytd_return || 0), 0) / totalFunds;
    
    return {
      totalFunds,
      recommendedCount,
      avgScore: avgScore.toFixed(1),
      avgYTD: avgYTD.toFixed(2)
    };
  }, [funds]);

  // Emit state changes to parent
  useEffect(() => {
    if (typeof onStateChange === 'function') {
      onStateChange({ selectedColumns, sortConfig: defaultSortConfig });
    }
  }, [selectedColumns, onStateChange, defaultSortConfig]);

  // Register export handler
  useEffect(() => {
    if (typeof registerExportHandler === 'function') {
      registerExportHandler((exportType, options) => {
        console.log('Modern table export requested:', exportType, options);
      });
    }
  }, [registerExportHandler]);

  // Handle column preset changes
  const handlePresetChange = useCallback((presetName) => {
    const preset = COLUMN_PRESETS[presetName];
    if (preset) {
      setSelectedColumns(preset.columns);
      setSelectedPreset(presetName);
    }
  }, []);

  // Modern table header with controls
  const TableHeader = () => (
    <div className="modern-table-header bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-semibold text-gray-900">Fund Analysis</h3>
          
          {/* Preset Selector */}
          <select 
            value={selectedPreset}
            onChange={(e) => handlePresetChange(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1 text-sm bg-white"
          >
            {Object.entries(COLUMN_PRESETS).map(([key, preset]) => (
              <option key={key} value={key}>
                {preset.name}
              </option>
            ))}
          </select>
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center px-3 py-2 border rounded-md text-sm font-medium transition-colors ${
              showFilters 
                ? 'border-blue-500 text-blue-700 bg-blue-50' 
                : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
            }`}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </button>
          
          {/* Column Options */}
          <button
            onClick={() => setShowColumnOptions(!showColumnOptions)}
            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
          >
            <Eye className="w-4 h-4 mr-2" />
            Columns
          </button>
          
          {/* Export Button */}
          <button className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors">
            <Download className="w-4 h-4 mr-2" />
            Export
          </button>
        </div>
      </div>
      
      {/* Summary Statistics */}
      {summaryStats && (
        <div className="mt-4 grid grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <div className="text-lg font-semibold text-gray-900">{summaryStats.totalFunds}</div>
            <div className="text-sm text-gray-600">Total Funds</div>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <div className="text-lg font-semibold text-green-900">{summaryStats.recommendedCount}</div>
            <div className="text-sm text-green-600">Recommended</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <div className="text-lg font-semibold text-blue-900">{summaryStats.avgScore}</div>
            <div className="text-sm text-blue-600">Avg Score</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-3 text-center">
            <div className="text-lg font-semibold text-purple-900">{summaryStats.avgYTD}%</div>
            <div className="text-sm text-purple-600">Avg YTD</div>
          </div>
        </div>
      )}
    </div>
  );

  // Column options panel
  const ColumnOptionsPanel = () => (
    <div className="modern-column-options bg-gray-50 border-b border-gray-200 px-6 py-4">
      <h4 className="text-sm font-medium text-gray-900 mb-3">Customize Columns</h4>
      <div className="grid grid-cols-3 gap-3">
        {Object.entries(COLUMN_PRESETS).map(([key, preset]) => (
          <button
            key={key}
            onClick={() => handlePresetChange(key)}
            className={`text-left p-3 rounded-lg border transition-colors ${
              selectedPreset === key
                ? 'border-blue-500 bg-blue-50 text-blue-900'
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <div className="font-medium text-sm">{preset.name}</div>
            <div className="text-xs text-gray-500">{preset.description}</div>
            <div className="text-xs text-gray-400 mt-1">{preset.columns.length} columns</div>
          </button>
        ))}
      </div>
    </div>
  );

  // Custom row styling for modern theme
  const getRowClassName = useCallback((fund) => {
    let classes = 'transition-all duration-150 ease-in-out';
    
    if (fund.is_recommended || fund.recommended) {
      classes += ' bg-green-50 border-l-4 border-l-green-500';
    }
    
    if (fund.is_benchmark) {
      classes += ' bg-blue-50 border-l-4 border-l-blue-500 italic';
    }
    
    return classes;
  }, []);

  return (
    <div className="modern-fund-table-container bg-white shadow-lg rounded-lg overflow-hidden">
      {/* Modern Header */}
      <TableHeader />
      
      {/* Column Options */}
      {showColumnOptions && <ColumnOptionsPanel />}
      
      {/* Main DataTable */}
      <div className="modern-table-content">
        <DataTable
          // Data
          data={funds}
          columns={currentColumns}
          
          // Modern configuration
          enableSorting={true}
          enableFiltering={showFilters}
          enableSelection={false}
          enableExport={true}
          enableVirtualScrolling={false}
          
          // Visual configuration - Modern theme
          theme="modern"
          density="normal"
          stickyHeader={true}
          showRowHover={true}
          highlightRecommended={true}
          highlightBenchmarks={true}
          benchmarkPositioning="inline"
          
          // Hook configurations
          sortConfig={defaultSortConfig}
          filterConfig={{
            searchableFields: ['name', 'ticker', 'symbol', 'asset_class'],
            debounceMs: 300
          }}
          exportConfig={{
            metadata: {
              chartPeriod,
              selectedColumns,
              selectedPreset,
              summaryStats
            }
          }}
          
          // Event handlers
          onRowClick={onFundSelect}
          onSortChange={(sortConfig) => {
            console.log('Modern table sort changed:', sortConfig);
          }}
          onFilterChange={(filters) => {
            console.log('Modern table filters changed:', filters);
          }}
          
          // Modern styling classes
          className="modern-fund-table"
          headerClassName="bg-gray-50 text-gray-900 font-medium"
          rowClassName={getRowClassName}
          cellClassName="text-gray-900"
          
          // No max height for modern table - let it flow naturally
          style={{
            borderRadius: '0'  // Remove border radius since container handles it
          }}
          
          // Accessibility
          ariaLabel="Modern fund analysis table with professional styling"
        />
      </div>
      
      {/* Modern Footer */}
      <div className="modern-table-footer bg-gray-50 border-t border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center space-x-4">
            <span>Showing {funds.length} funds</span>
            {summaryStats && (
              <span>• {summaryStats.recommendedCount} recommended</span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <Target className="w-4 h-4" />
            <span>Updated: {new Date().toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModernFundTable;