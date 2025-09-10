// src/components/tables/ProfessionalTable.jsx
import React, { useMemo, useRef, useState } from 'react';
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
  const containerRef = useRef(null);

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
    <div ref={containerRef} className="professional-table-container">
      <div className="professional-table-scroll" style={{ maxHeight }}>
        <table className="professional-table" role="table">
          <thead>
            <tr>
              {columns.map((col) => {
                const isSorted = sortConfig.key === col.key;
                const ariaSort = isSorted ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none';
                return (
                  <th
                    key={col.key}
                    onClick={() => sortable && handleSort(col.key)}
                    aria-sort={ariaSort}
                    data-col-key={col.key}
                    className={`col-${col.key}`}
                    style={{
                      textAlign: col.align || (col.numeric ? 'right' : 'left'),
                      cursor: sortable ? 'pointer' : 'default'
                    }}
                  >
                    {col.label}
                    {isSorted && (
                      <span style={{ marginLeft: 6 }} aria-hidden>
                        {sortConfig.direction === 'asc' ? '▲' : '▼'}
                      </span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row, i) => (
              <tr
                key={row.ticker || i}
                onClick={() => onRowClick?.(row)}
                className={row.is_benchmark ? 'benchmark-row' : ''}
                tabIndex={0}
                role="row"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onRowClick?.(row);
                  }
                }}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={col.numeric ? 'number' : undefined}
                    data-col-key={col.key}
                    className={`col-${col.key} ${col.numeric ? 'number' : ''}`}
                    style={{
                      textAlign: col.align || (col.numeric ? 'right' : 'left')
                    }}
                  >
                    {(() => {
                      const value = typeof col.accessor === 'function' ? col.accessor(row) : undefined;
                      const rendered = col.render ? col.render(value, row) : value;
                      return rendered ?? 'N/A';
                    })()}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ProfessionalTable;
