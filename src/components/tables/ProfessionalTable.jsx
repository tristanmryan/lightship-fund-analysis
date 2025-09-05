// src/components/tables/ProfessionalTable.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  const tbodyRef = useRef(null);

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

  // One-time per render: log first row snapshot for debugging
  try {
    if (typeof window !== 'undefined' && Array.isArray(sortedData) && sortedData.length > 0) {
      const row0 = sortedData[0];
      const scoreCol = columns.find((c) => c.key === 'score');
      const scoreVal = scoreCol && typeof scoreCol.accessor === 'function' ? scoreCol.accessor(row0) : undefined;
      console.log('[ProfessionalTable] first row snapshot', {
        ticker: row0?.ticker,
        name: row0?.name,
        score_accessor_value: scoreVal,
        scores_final: row0?.scores?.final,
        score_final: row0?.score_final,
        score: row0?.score
      });
    }
  } catch {}

  // Debug/layout diagnostics
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const containerEl = containerRef.current;
      const tbodyEl = tbodyRef.current;
      if (!containerEl || !tbodyEl) return;
      const tableEl = containerEl.querySelector('table.professional-table');
      const log = () => {
        const containerRect = containerEl.getBoundingClientRect();
        const tableRect = tableEl?.getBoundingClientRect?.() || { height: null };
        const tbodyRect = tbodyEl.getBoundingClientRect();
        const tbodyStyles = window.getComputedStyle(tbodyEl);
        const domRowCount = tbodyEl.querySelectorAll('tr').length;
        // 1. Actual heights
        console.log('[ProfessionalTable] container height (px):', containerRect.height, 'table height (px):', tableRect.height, 'tbody height (px):', tbodyRect.height);
        // 2. Number of rows
        console.log('[ProfessionalTable] rows rendered (prop vs DOM):', (sortedData?.length ?? 0), domRowCount);
        // 3. overflow-y value
        console.log('[ProfessionalTable] tbody overflowY:', tbodyStyles.overflowY);
        // 4. Computed styles for tbody
        console.log('tbody styles:', tbodyStyles);
        // Extra: max-height details
        console.log('[ProfessionalTable] tbody max-height (computed vs prop):', tbodyStyles.maxHeight, maxHeight);
      };
      const id = window.requestAnimationFrame(log);
      return () => window.cancelAnimationFrame(id);
    } catch (err) {
      console.warn('[ProfessionalTable] diagnostics failed:', err);
    }
  }, [sortedData, maxHeight]);

  return (
    <div ref={containerRef} className="professional-table-container">
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
        <tbody ref={tbodyRef} style={{ maxHeight, overflowY: 'auto', display: 'block' }}>
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
                  {(() => {
                    const value = typeof col.accessor === 'function' ? col.accessor(row) : undefined;
                    if (col.key === 'score') {
                      try {
                        // 5. Score column detailed logging
                        console.log('Score render:', value, row?.score, row?.score_final);
                      } catch {}
                    }
                    const rendered = col.render ? col.render(value, row) : value;
                    if (col.key === 'score') {
                      try {
                        const isElement = React.isValidElement(rendered);
                        const typeName = isElement ? (rendered.type?.displayName || rendered.type?.name || '') : '';
                        const isScoreTooltip = isElement && /ScoreTooltip/.test(String(typeName));
                        console.log('[ProfessionalTable] score tooltip created:', isScoreTooltip, '(type:', typeName || typeof rendered, ')');
                      } catch {}
                    }
                    return rendered;
                  })()}
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
