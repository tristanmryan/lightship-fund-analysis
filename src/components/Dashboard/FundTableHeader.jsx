import React from 'react';
import { ChevronUp, ChevronDown, ArrowUpDown, Info } from 'lucide-react';

/**
 * Fund Table Header Component
 * Displays table headers with modern styling and sort indicators
 */
const FundTableHeader = ({ 
  columns, 
  columnDefinitions, 
  sortConfig, 
  onSort,
  className = ''
}) => {
  const getSortIndicator = (columnKey) => {
    const sortIndex = sortConfig.findIndex(config => config.key === columnKey);
    if (sortIndex === -1) {
      return <ArrowUpDown size={14} className="text-gray-400" />;
    }

    const config = sortConfig[sortIndex];
    const Icon = config.direction === 'asc' ? ChevronUp : ChevronDown;

    return (
      <div className="flex items-center gap-1">
        <Icon size={14} className="text-blue-600" />
        {sortConfig.length > 1 && (
          <span className="text-xs bg-blue-600 text-white rounded-full w-4 h-4 flex items-center justify-center">
            {sortIndex + 1}
          </span>
        )}
      </div>
    );
  };

  const renderHeaderCell = (columnKey) => {
    const column = columnDefinitions[columnKey];
    if (!column) return null;

    const isSortable = column.sortable !== false;
    const hasInfo = ['score', 'sharpeRatio', 'standardDeviation', 'expenseRatio', 'upCaptureRatio', 'downCaptureRatio'].includes(columnKey);

    return (
      <th
        key={columnKey}
        onClick={() => isSortable && onSort(columnKey)}
        className={`
          px-4 py-3 text-left font-semibold text-sm text-gray-700 
          border-b-2 border-gray-200 bg-gray-50 sticky top-0 z-10
          ${isSortable ? 'cursor-pointer hover:bg-gray-100 transition-colors' : 'cursor-default'}
          ${className}
        `}
        style={{ minWidth: column.width }}
        title={column.tooltip || ''}
      >
        <div className="flex items-center gap-2">
          <span>{column.label}</span>
          
          {hasInfo && (
            <button
              type="button"
              onClick={(e) => { 
                e.stopPropagation(); 
                try { 
                  window.dispatchEvent(new CustomEvent('OPEN_METHODOLOGY')); 
                } catch {} 
              }}
              title="What is this metric?"
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <Info size={14} />
            </button>
          )}
          
          {isSortable && getSortIndicator(columnKey)}
        </div>
      </th>
    );
  };

  return (
    <thead className="bg-gray-50">
      <tr>
        {columns.map(columnKey => renderHeaderCell(columnKey))}
        
        {/* Actions header */}
        <th className="px-4 py-3 text-center font-semibold text-sm text-gray-700 border-b-2 border-gray-200 bg-gray-50 sticky top-0 z-10 w-16">
          Actions
        </th>
      </tr>
    </thead>
  );
};

export default FundTableHeader; 