// src/components/tables/ProfessionalTable.jsx
import React, { useMemo, useState } from 'react';
import './ProfessionalTable.css';

// Simple, professional table that JUST WORKS
export function ProfessionalTable({
  data,
  columns,
  onRowClick,
  sortable = true,
  maxHeight = '600px' // Fixed, scrollable height
}) {
  const [sortConfig, setSortConfig] = useState({ key: 'score', direction: 'desc' });

  const handleSort = (key) => {
    if (!sortable) return;
    setSortConfig((prev) => {
      if (!prev || prev.key !== key) return { key, direction: 'asc' };
      return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
    });
  };

  const sortedData = useMemo(() => {
    if (!sortable || !Array.isArray(data)) return data || [];
    const col = columns.find((c) => c.key === sortConfig.key);
    if (!col || typeof col.accessor !== 'function') return [...(data || [])];
    return [...data].sort((a, b) => {
      const aVal = col.accessor(a);
      const bVal = col.accessor(b);
      // Handle null/undefined
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      // Numeric-aware compare
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      const cmp = aStr.localeCompare(bStr);
      return sortConfig.direction === 'asc' ? cmp : -cmp;
    });
  }, [data, sortConfig, columns, sortable]);

  return (
    <div className="professional-table-container">
      <table className="professional-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={() => sortable && handleSort(col.key)}
                style={{
                  width: col.width,
                  textAlign: col.align || (col.numeric ? 'right' : 'left'),
                  cursor: sortable ? 'pointer' : 'default',
                }}
              >
                {col.label}
                {sortConfig.key === col.key && (
                  <span style={{ marginLeft: 6 }}>{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody style={{ maxHeight, overflowY: 'auto', display: 'block' }}>
          {sortedData.map((row, i) => (
            <tr
              key={row.ticker || i}
              onClick={() => onRowClick?.(row)}
              className={row.is_benchmark ? 'benchmark-row' : ''}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={col.numeric ? 'number' : undefined}
                  style={{
                    width: col.width,
                    textAlign: col.align || (col.numeric ? 'right' : 'left'),
                  }}
                >
                  {col.render ? col.render(col.accessor(row), row) : col.accessor(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ProfessionalTable;
