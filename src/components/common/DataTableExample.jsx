import React, { useState } from 'react';
import DataTable from './DataTable';
import { 
  BASIC_COLUMNS, 
  EXTENDED_COLUMNS, 
  ADVANCED_COLUMNS,
  getPresetColumns 
} from '../../config/tableColumns';

/**
 * Example usage of the unified DataTable component
 * Shows how it can replace EnhancedFundTable, ModernFundTable, and SimpleFundViews
 * while maintaining their unique styling characteristics
 */

// Example: Enhanced Fund Table replacement
export const EnhancedFundTableReplacement = ({ 
  funds, 
  onFundSelect, 
  chartPeriod = '1Y',
  ScoreTooltip,
  Sparkline,
  historyCache = {}
}) => {
  const [selectedPreset, setSelectedPreset] = useState('extended');
  
  return (
    <DataTable
      // Data
      data={funds}
      columns={getPresetColumns(selectedPreset)}
      
      // Enable all features for enhanced experience
      enableSorting={true}
      enableFiltering={true}
      enableSelection={true}
      enableExport={true}
      enableVirtualScrolling={funds.length > 100}
      
      // Visual styling to match EnhancedFundTable
      theme="default"
      density="normal"
      stickyHeader={true}
      showRowHover={true}
      highlightRecommended={true}
      highlightBenchmarks={true}
      
      // Hook configurations
      sortConfig={[{ key: 'score', direction: 'desc' }]}
      selectionConfig={{
        selectionMode: 'multiple',
        maxSelection: null
      }}
      exportConfig={{
        metadata: { chartPeriod }
      }}
      
      // Component dependencies
      ScoreTooltip={ScoreTooltip}
      Sparkline={Sparkline}
      historyCache={historyCache}
      chartPeriod={chartPeriod}
      
      // Event handlers
      onRowClick={(fund) => onFundSelect?.(fund)}
      onSortChange={(config) => console.log('Sort changed:', config)}
      onFilterChange={(filters) => console.log('Filters changed:', filters)}
      
      // Accessibility
      ariaLabel="Enhanced fund performance table"
      
      className="enhanced-fund-table"
    />
  );
};

// Example: Modern Fund Table replacement
export const ModernFundTableReplacement = ({ 
  funds, 
  onFundSelect 
}) => {
  return (
    <DataTable
      // Data
      data={funds}
      columns={EXTENDED_COLUMNS}
      
      // Modern styling approach
      theme="modern"
      density="normal"
      stickyHeader={true}
      showRowHover={true}
      highlightRecommended={true}
      
      // Simplified feature set
      enableSorting={true}
      enableFiltering={false}
      enableSelection={false}
      enableExport={true}
      
      // Single column sorting only
      sortConfig={[{ key: 'score', direction: 'desc' }]}
      
      // Event handlers
      onRowClick={(fund) => onFundSelect?.(fund)}
      
      // Tailwind-compatible styling
      className="modern-fund-table bg-white shadow-lg rounded-lg"
      headerClassName="bg-gray-50"
      rowClassName="hover:bg-gray-50 transition-colors"
      
      ariaLabel="Modern fund analysis table"
    />
  );
};

// Example: Simple Fund Views replacement
export const SimpleFundViewsReplacement = ({ 
  funds, 
  onFundSelect 
}) => {
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'cards'
  
  if (viewMode === 'cards') {
    // Card view implementation would go here
    return <div>Card view not implemented in this example</div>;
  }
  
  return (
    <DataTable
      // Data
      data={funds}
      columns={BASIC_COLUMNS}
      
      // Simplified styling
      theme="default"
      density="compact"
      stickyHeader={false}
      showRowHover={true}
      highlightRecommended={true}
      
      // Minimal features
      enableSorting={true}
      enableFiltering={false}
      enableSelection={false}
      enableExport={false}
      
      // Simple single column sorting
      sortConfig={[{ key: 'score', direction: 'desc' }]}
      
      // Event handlers
      onRowClick={(fund) => onFundSelect?.(fund)}
      
      // Lightweight styling
      className="simple-fund-table"
      style={{ maxHeight: '400px' }}
      
      ariaLabel="Simple fund overview table"
    />
  );
};

// Example: Asset Class Table replacement
export const AssetClassTableReplacement = ({ 
  funds, 
  onFundSelect,
  assetClassName = 'Asset Class' 
}) => {
  // Filter for specific asset class and add benchmark positioning
  const assetClassFunds = funds.filter(fund => 
    fund.asset_class === assetClassName || fund.is_benchmark
  );
  
  return (
    <DataTable
      // Data
      data={assetClassFunds}
      columns={[
        ...BASIC_COLUMNS.slice(0, 3), // symbol, name, assetClass
        ...BASIC_COLUMNS.slice(3) // score and metrics
      ]}
      
      // Asset class specific styling
      theme="default"
      density="normal"
      stickyHeader={true}
      showRowHover={true}
      highlightRecommended={true}
      highlightBenchmarks={true}
      benchmarkPositioning="top" // Show benchmarks first
      
      // Standard features
      enableSorting={true}
      enableFiltering={true}
      enableSelection={false}
      enableExport={true}
      
      // Event handlers
      onRowClick={(fund) => onFundSelect?.(fund)}
      
      // Export configuration for asset class
      exportConfig={{
        metadata: { 
          assetClassName,
          exportType: 'Asset Class Analysis'
        }
      }}
      
      className="asset-class-table"
      ariaLabel={`${assetClassName} fund analysis table`}
    />
  );
};

// Example: Custom configuration for different use cases
export const CustomDataTableExample = ({ funds }) => {
  const [config, setConfig] = useState({
    theme: 'default',
    density: 'normal',
    columns: 'basic',
    features: {
      sorting: true,
      filtering: false,
      selection: false,
      export: false,
      virtualScrolling: false
    }
  });
  
  const getColumns = () => {
    switch (config.columns) {
      case 'basic': return BASIC_COLUMNS;
      case 'extended': return EXTENDED_COLUMNS;
      case 'advanced': return ADVANCED_COLUMNS;
      default: return BASIC_COLUMNS;
    }
  };
  
  return (
    <div className="space-y-4">
      {/* Configuration Controls */}
      <div className="flex flex-wrap gap-4 p-4 bg-gray-50 rounded-lg">
        <div>
          <label className="block text-sm font-medium mb-1">Theme:</label>
          <select 
            value={config.theme} 
            onChange={(e) => setConfig(prev => ({ ...prev, theme: e.target.value }))}
            className="border rounded px-2 py-1"
          >
            <option value="default">Default</option>
            <option value="modern">Modern</option>
            <option value="enhanced">Enhanced</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Density:</label>
          <select 
            value={config.density} 
            onChange={(e) => setConfig(prev => ({ ...prev, density: e.target.value }))}
            className="border rounded px-2 py-1"
          >
            <option value="compact">Compact</option>
            <option value="normal">Normal</option>
            <option value="comfortable">Comfortable</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Columns:</label>
          <select 
            value={config.columns} 
            onChange={(e) => setConfig(prev => ({ ...prev, columns: e.target.value }))}
            className="border rounded px-2 py-1"
          >
            <option value="basic">Basic (7 columns)</option>
            <option value="extended">Extended (12 columns)</option>
            <option value="advanced">Advanced (All columns)</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Features:</label>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(config.features).map(([feature, enabled]) => (
              <label key={feature} className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    features: { ...prev.features, [feature]: e.target.checked }
                  }))}
                />
                {feature}
              </label>
            ))}
          </div>
        </div>
      </div>
      
      {/* DataTable with dynamic configuration */}
      <DataTable
        data={funds}
        columns={getColumns()}
        
        theme={config.theme}
        density={config.density}
        
        enableSorting={config.features.sorting}
        enableFiltering={config.features.filtering}
        enableSelection={config.features.selection}
        enableExport={config.features.export}
        enableVirtualScrolling={config.features.virtualScrolling}
        
        stickyHeader={true}
        showRowHover={true}
        highlightRecommended={true}
        highlightBenchmarks={true}
        
        onRowClick={(fund) => console.log('Row clicked:', fund)}
        onSortChange={(sortConfig) => console.log('Sort changed:', sortConfig)}
        onFilterChange={(filters) => console.log('Filters changed:', filters)}
        
        ariaLabel="Configurable fund data table"
      />
    </div>
  );
};

export default {
  EnhancedFundTableReplacement,
  ModernFundTableReplacement,
  SimpleFundViewsReplacement,
  AssetClassTableReplacement,
  CustomDataTableExample
};