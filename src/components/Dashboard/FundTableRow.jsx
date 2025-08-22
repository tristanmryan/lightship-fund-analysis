import React from 'react';
import { TrendingUp, TrendingDown, DollarSign, Shield, Calendar } from 'lucide-react';
import FundStatusBadge from './FundStatusBadge';
import { getScoreColor } from '../../services/scoring';

/**
 * Fund Table Row Component
 * Displays a single fund row with modern styling and status indicators
 */
const FundTableRow = ({ 
  fund, 
  columns, 
  columnDefinitions, 
  isHovered = false,
  onFundSelect,
  className = ''
}) => {
  const getRowStyle = () => {
    const baseStyle = {
      backgroundColor: isHovered ? '#f8fafc' : 'white',
      borderBottom: '1px solid #e5e7eb',
      transition: 'all 0.2s ease-in-out'
    };

    // Add subtle background tint for recommended funds
    if (fund.is_recommended || fund.recommended || fund.isRecommended) {
      baseStyle.backgroundColor = isHovered ? '#f0fdf4' : '#fafafa';
      baseStyle.borderLeft = '3px solid #10b981';
    }

    // Add distinct styling for benchmark funds
    if (fund.isBenchmark || fund.is_benchmark) {
      baseStyle.backgroundColor = isHovered ? '#eff6ff' : '#f8fafc';
      baseStyle.borderLeft = '3px solid #3b82f6';
      baseStyle.fontStyle = 'italic';
    }

    return baseStyle;
  };

  const renderCell = (columnKey) => {
    const column = columnDefinitions[columnKey];
    if (!column) return null;

    const value = column.getValue(fund);
    
    // Special handling for symbol column to include status badge
    if (columnKey === 'symbol') {
      return (
        <div className="flex items-center gap-2">
          <div className="font-semibold text-gray-900 text-sm">
            {value}
          </div>
          <FundStatusBadge fund={fund} size="small" showText={false} />
        </div>
      );
    }

    // Special handling for name column to include status badge
    if (columnKey === 'name') {
      return (
        <div className="space-y-1">
          <div className="text-sm text-gray-900 leading-tight">
            {value}
          </div>
          <FundStatusBadge fund={fund} size="small" />
        </div>
      );
    }

    // Use column's render function if available
    if (column.render) {
      return column.render(value, fund);
    }

    return (
      <div className="text-sm text-gray-700">
        {value}
      </div>
    );
  };

  return (
    <tr 
      className={`hover:bg-gray-50 ${className}`}
      style={getRowStyle()}
      onClick={() => onFundSelect && onFundSelect(fund)}
    >
      {columns.map(columnKey => (
        <td
          key={columnKey}
          className="px-4 py-3 text-sm align-middle"
        >
          {renderCell(columnKey)}
        </td>
      ))}
      
      {/* Actions column */}
      <td className="px-4 py-3 text-center align-middle">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onFundSelect && onFundSelect(fund);
          }}
          className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
          title="View fund details"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
          </svg>
        </button>
      </td>
    </tr>
  );
};

export default FundTableRow; 