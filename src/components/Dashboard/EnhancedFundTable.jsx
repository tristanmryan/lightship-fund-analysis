// src/components/Dashboard/EnhancedFundTable.jsx
import React, { useState, useMemo, useCallback } from 'react';
import { 
  ArrowUp, ArrowDown, ArrowUpDown, Eye, Star, TrendingUp, 
  TrendingDown, Shield, DollarSign, Calendar, MoreHorizontal,
  ExternalLink, Info
} from 'lucide-react';
import { getScoreColor, getScoreLabel } from '../../services/scoring';
import { computeBenchmarkDelta, resolveAssetClass, getBenchmarkConfigForFund } from './benchmarkUtils';

/**
 * Enhanced Fund Table Component
 * Advanced sortable table with multi-column sorting and detailed fund information
 */
const EnhancedFundTable = ({ funds, onFundSelect, showDetailModal = false }) => {
  const [sortConfig, setSortConfig] = useState([
    { key: 'score', direction: 'desc' }
  ]);
  const [selectedColumns, setSelectedColumns] = useState([
    'symbol', 'name', 'assetClass', 'score', 'ytdReturn', 'oneYearReturn', 
    'threeYearReturn', 'expenseRatio', 'sharpeRatio', 'recommended'
  ]);
  const [columnWidths, setColumnWidths] = useState({});
  const [hoveredFund, setHoveredFund] = useState(null);

  // Column definitions
  const columnDefinitions = useMemo(() => ({
    symbol: {
      label: 'Symbol',
      key: 'symbol',
      getValue: (fund) => fund.ticker || fund.symbol || fund.Symbol,
      sortable: true,
      width: '100px',
      render: (value, fund) => (
        <div style={{ fontWeight: '600', color: '#1f2937' }}>
          {value}
        </div>
      )
    },
    name: {
      label: 'Fund Name',
      key: 'name',
      getValue: (fund) => fund['Product Name'] || fund.name,
      sortable: true,
      width: '250px',
      render: (value) => (
        <div style={{ 
          fontSize: '0.875rem',
          lineHeight: '1.25rem',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {value}
        </div>
      )
    },
    assetClass: {
      label: 'Asset Class',
      key: 'assetClass',
      getValue: (fund) => fund.asset_class_name || fund.asset_class || fund['Asset Class'],
      sortable: true,
      width: '150px',
      render: (value) => (
        <div style={{
          fontSize: '0.75rem',
          padding: '0.25rem 0.5rem',
          backgroundColor: '#f3f4f6',
          borderRadius: '0.375rem',
          textAlign: 'center'
        }}>
          {value}
        </div>
      )
    },
    score: {
      label: 'Score',
      key: 'score',
      getValue: (fund) => fund.scores?.final || fund.score || 0,
      sortable: true,
      width: '80px',
      render: (value) => (
        <div style={{
          padding: '0.25rem 0.5rem',
          borderRadius: '0.375rem',
          textAlign: 'center',
          color: 'white',
          fontWeight: '600',
          backgroundColor: getScoreColor(value)
        }}>
          {value?.toFixed(1) || '0.0'}
        </div>
      )
    },
    ytdReturn: {
      label: 'YTD Return',
      key: 'ytdReturn',
      getValue: (fund) => fund['Total Return - YTD (%)'] || fund.ytd_return || 0,
      sortable: true,
      width: '100px',
      render: (value) => (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.25rem',
          color: value >= 0 ? '#16a34a' : '#dc2626'
        }}>
          {value >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          {value?.toFixed(2)}%
        </div>
      )
    },
    oneYearReturn: {
      label: '1Y Return',
      key: 'oneYearReturn',
      getValue: (fund) => fund['Total Return - 1 Year (%)'] || fund.one_year_return || 0,
      sortable: true,
      width: '100px',
      render: (value, fund, allFunds) => {
        const bench = computeBenchmarkDelta(fund, allFunds, '1y');
        const color = value >= 0 ? '#16a34a' : '#dc2626';
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color }}>
              {value >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {value?.toFixed(2)}%
            </div>
            {bench && bench.delta != null && (
              <div title={`Benchmark: ${bench.benchName} (${bench.benchTicker})\nPeriod: 1-Year Return`}
                style={{
                  fontSize: '0.6875rem',
                  backgroundColor: bench.delta >= 0 ? '#ecfdf5' : '#fef2f2',
                  color: bench.delta >= 0 ? '#065f46' : '#7f1d1d',
                  border: `1px solid ${bench.delta >= 0 ? '#a7f3d0' : '#fecaca'}`,
                  borderRadius: '9999px',
                  padding: '0.125rem 0.375rem'
                }}>
                {bench.delta >= 0 ? '+' : ''}{bench.delta.toFixed(2)}% vs {bench.benchTicker}
              </div>
            )}
          </div>
        );
      }
    },
    threeYearReturn: {
      label: '3Y Return',
      key: 'threeYearReturn',
      getValue: (fund) => fund['Annualized Total Return - 3 Year (%)'] || fund.three_year_return || 0,
      sortable: true,
      width: '100px',
      render: (value) => (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.25rem',
          color: value >= 0 ? '#16a34a' : '#dc2626'
        }}>
          {value >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          {value?.toFixed(2)}%
        </div>
      )
    },
    fiveYearReturn: {
      label: '5Y Return',
      key: 'fiveYearReturn',
      getValue: (fund) => fund['Annualized Total Return - 5 Year (%)'] || fund.five_year_return || 0,
      sortable: true,
      width: '100px',
      render: (value) => (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.25rem',
          color: value >= 0 ? '#16a34a' : '#dc2626'
        }}>
          {value >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          {value?.toFixed(2)}%
        </div>
      )
    },
    expenseRatio: {
      label: 'Expense Ratio',
      key: 'expenseRatio',
      getValue: (fund) => fund['Net Exp Ratio (%)'] || fund.expense_ratio || 0,
      sortable: true,
      width: '120px',
      render: (value) => (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.25rem',
          color: value <= 0.5 ? '#16a34a' : value <= 1.0 ? '#f59e0b' : '#dc2626'
        }}>
          <DollarSign size={14} />
          {value?.toFixed(2)}%
        </div>
      )
    },
    sharpeRatio: {
      label: 'Sharpe Ratio',
      key: 'sharpeRatio',
      getValue: (fund) => fund['Sharpe Ratio - 3 Year'] || fund.sharpe_ratio || 0,
      sortable: true,
      width: '110px',
      render: (value) => (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.25rem',
          color: value >= 1.0 ? '#16a34a' : value >= 0.5 ? '#f59e0b' : '#dc2626'
        }}>
          <Shield size={14} />
          {value?.toFixed(2)}
        </div>
      )
    },
    beta: {
      label: 'Beta',
      key: 'beta',
      getValue: (fund) => fund['Beta - 5 Year'] || fund.beta || 0,
      sortable: true,
      width: '80px',
      render: (value) => (
        <div style={{
          textAlign: 'center',
          color: value <= 0.8 ? '#16a34a' : value <= 1.2 ? '#f59e0b' : '#dc2626'
        }}>
          {value?.toFixed(2)}
        </div>
      )
    },
    standardDeviation: {
      label: 'Std Dev',
      key: 'standardDeviation',
      getValue: (fund) => fund['Standard Deviation - 5 Year'] || fund.standard_deviation || 0,
      sortable: true,
      width: '90px',
      render: (value) => (
        <div style={{ textAlign: 'center' }}>
          {value?.toFixed(2)}%
        </div>
      )
    },
    upCaptureRatio: {
      label: 'Up Capture',
      key: 'upCaptureRatio',
      getValue: (fund) => fund['Up Capture Ratio (Morningstar Standard) - 3 Year'] || fund.up_capture_ratio || 0,
      sortable: true,
      width: '100px',
      render: (value) => (
        <div style={{
          textAlign: 'center',
          color: value >= 100 ? '#16a34a' : '#f59e0b'
        }}>
          {value?.toFixed(1)}%
        </div>
      )
    },
    downCaptureRatio: {
      label: 'Down Capture',
      key: 'downCaptureRatio',
      getValue: (fund) => fund['Down Capture Ratio (Morningstar Standard) - 3 Year'] || fund.down_capture_ratio || 0,
      sortable: true,
      width: '110px',
      render: (value) => (
        <div style={{
          textAlign: 'center',
          color: value <= 100 ? '#16a34a' : '#dc2626'
        }}>
          {value?.toFixed(1)}%
        </div>
      )
    },
    managerTenure: {
      label: 'Manager Tenure',
      key: 'managerTenure',
      getValue: (fund) => fund['Longest Manager Tenure (Years)'] || fund.manager_tenure || 0,
      sortable: true,
      width: '120px',
      render: (value) => (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.25rem'
        }}>
          <Calendar size={14} />
          {value?.toFixed(1)} yrs
        </div>
      )
    },
    recommended: {
      label: 'Recommended',
      key: 'recommended',
      getValue: (fund) => fund.is_recommended || fund.recommended || false,
      sortable: true,
      width: '110px',
      render: (value) => (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {value ? (
            <Star size={16} style={{ color: '#f59e0b', fill: '#f59e0b' }} />
          ) : (
            <Star size={16} style={{ color: '#d1d5db' }} />
          )}
        </div>
      )
    }
  }), []);

  // Multi-column sorting
  const sortedFunds = useMemo(() => {
    if (!funds || funds.length === 0 || sortConfig.length === 0) return funds || [];

    return [...funds].sort((a, b) => {
      for (const { key, direction } of sortConfig) {
        const column = columnDefinitions[key];
        if (!column) continue;

        const aValue = column.getValue(a);
        const bValue = column.getValue(b);

        let comparison = 0;
        if (aValue < bValue) comparison = -1;
        if (aValue > bValue) comparison = 1;

        if (comparison !== 0) {
          return direction === 'desc' ? -comparison : comparison;
        }
      }
      return 0;
    });
  }, [funds, sortConfig, columnDefinitions]);

  // Handle column sorting
  const handleSort = useCallback((columnKey) => {
    setSortConfig(prev => {
      const existingIndex = prev.findIndex(config => config.key === columnKey);
      
      if (existingIndex >= 0) {
        // Column already in sort - cycle through directions or remove
        const currentDirection = prev[existingIndex].direction;
        if (currentDirection === 'asc') {
          // Change to desc
          return prev.map((config, index) => 
            index === existingIndex ? { ...config, direction: 'desc' } : config
          );
        } else {
          // Remove from sort
          return prev.filter((_, index) => index !== existingIndex);
        }
      } else {
        // Add new sort column
        return [{ key: columnKey, direction: 'asc' }, ...prev.slice(0, 2)]; // Max 3 sort columns
      }
    });
  }, []);

  // Get sort indicator for column
  const getSortIndicator = (columnKey) => {
    const sortIndex = sortConfig.findIndex(config => config.key === columnKey);
    if (sortIndex === -1) return <ArrowUpDown size={14} style={{ opacity: 0.3 }} />;
    
    const config = sortConfig[sortIndex];
    const Icon = config.direction === 'asc' ? ArrowUp : ArrowDown;
    
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
        <Icon size={14} />
        {sortConfig.length > 1 && (
          <span style={{ 
            fontSize: '0.75rem', 
            backgroundColor: '#3b82f6', 
            color: 'white',
            borderRadius: '50%',
            width: '16px',
            height: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {sortIndex + 1}
          </span>
        )}
      </div>
    );
  };

  // Column visibility toggle
  const toggleColumn = useCallback((columnKey) => {
    setSelectedColumns(prev => 
      prev.includes(columnKey) 
        ? prev.filter(col => col !== columnKey)
        : [...prev, columnKey]
    );
  }, []);

  if (!funds || funds.length === 0) {
    return (
      <div style={{
        padding: '3rem',
        textAlign: 'center',
        backgroundColor: '#f9fafb',
        borderRadius: '0.5rem',
        border: '1px solid #e5e7eb'
      }}>
        <Eye size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
        <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.5rem', color: '#374151' }}>
          No Funds Found
        </h3>
        <p style={{ color: '#6b7280' }}>
          No funds match your current filter criteria. Try adjusting your filters or clearing them to see more results.
        </p>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: 'white', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
      {/* Table Controls */}
      <div style={{ 
        padding: '1rem', 
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h3 style={{ fontWeight: '600', margin: 0 }}>
            Fund Analysis ({sortedFunds.length} funds)
          </h3>
          
          {sortConfig.length > 0 && (
            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
              Sorted by: {sortConfig.map(config => {
                const column = columnDefinitions[config.key];
                return `${column?.label} (${config.direction})`;
              }).join(', ')}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setSortConfig([])}
            disabled={sortConfig.length === 0}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.375rem',
              backgroundColor: 'white',
              color: sortConfig.length > 0 ? '#374151' : '#9ca3af',
              fontSize: '0.875rem',
              cursor: sortConfig.length > 0 ? 'pointer' : 'not-allowed'
            }}
          >
            Clear Sort
          </button>
          
          <select
            onChange={(e) => {
              if (e.target.value) {
                const columns = e.target.value.split(',');
                setSelectedColumns(columns);
              }
            }}
            style={{
              padding: '0.5rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.375rem',
              fontSize: '0.875rem'
            }}
          >
            <option value="">Column Sets...</option>
            <option value="symbol,name,assetClass,score,ytdReturn,oneYearReturn,expenseRatio,recommended">Basic View</option>
            <option value="symbol,name,score,ytdReturn,oneYearReturn,threeYearReturn,fiveYearReturn,sharpeRatio,expenseRatio">Performance Focus</option>
            <option value="symbol,name,score,expenseRatio,sharpeRatio,beta,standardDeviation,upCaptureRatio,downCaptureRatio">Risk Analysis</option>
            <option value="symbol,name,assetClass,score,ytdReturn,oneYearReturn,threeYearReturn,fiveYearReturn,expenseRatio,sharpeRatio,beta,managerTenure,recommended">Complete View</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f9fafb' }}>
              {selectedColumns.map(columnKey => {
                const column = columnDefinitions[columnKey];
                if (!column) return null;

                return (
                  <th
                    key={columnKey}
                    onClick={() => column.sortable && handleSort(columnKey)}
                    style={{
                      padding: '0.75rem 0.5rem',
                      textAlign: 'left',
                      fontWeight: '600',
                      fontSize: '0.875rem',
                      color: '#374151',
                      cursor: column.sortable ? 'pointer' : 'default',
                      userSelect: 'none',
                      borderBottom: '2px solid #e5e7eb',
                      position: 'sticky',
                      top: 0,
                      backgroundColor: '#f9fafb',
                      minWidth: column.width
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {column.label}
                      {column.sortable && getSortIndicator(columnKey)}
                    </div>
                  </th>
                );
              })}
              <th style={{
                padding: '0.75rem 0.5rem',
                textAlign: 'center',
                fontWeight: '600',
                fontSize: '0.875rem',
                color: '#374151',
                borderBottom: '2px solid #e5e7eb',
                position: 'sticky',
                top: 0,
                backgroundColor: '#f9fafb',
                width: '60px'
              }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedFunds.map((fund, index) => {
              const symbol = fund.Symbol || fund.symbol;
              const isHovered = hoveredFund === symbol;
              
              return (
                <tr
                  key={symbol || index}
                  onMouseEnter={() => setHoveredFund(symbol)}
                  onMouseLeave={() => setHoveredFund(null)}
                  style={{
                    backgroundColor: isHovered ? '#f8fafc' : 'white',
                    borderBottom: '1px solid #e5e7eb',
                    transition: 'background-color 0.2s'
                  }}
                >
                  {selectedColumns.map(columnKey => {
                    const column = columnDefinitions[columnKey];
                    if (!column) return null;

                    const value = column.getValue(fund);

                    return (
                      <td
                        key={columnKey}
                        style={{
                          padding: '0.75rem 0.5rem',
                          fontSize: '0.875rem',
                          verticalAlign: 'middle'
                        }}
                      >
                        {column.render ? column.render(value, fund, sortedFunds) : value}
                      </td>
                    );
                  })}
                  <td style={{
                    padding: '0.75rem 0.5rem',
                    textAlign: 'center',
                    verticalAlign: 'middle'
                  }}>
                    <button
                      onClick={() => onFundSelect && onFundSelect(fund)}
                      style={{
                        padding: '0.25rem',
                        border: 'none',
                        borderRadius: '0.25rem',
                        backgroundColor: 'transparent',
                        color: '#6b7280',
                        cursor: 'pointer'
                      }}
                      title="View fund details"
                    >
                      <MoreHorizontal size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Table Footer */}
      <div style={{ 
        padding: '1rem', 
        borderTop: '1px solid #e5e7eb',
        backgroundColor: '#f9fafb',
        fontSize: '0.875rem',
        color: '#6b7280',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          Showing {sortedFunds.length} funds
        </div>
        
        <div style={{ display: 'flex', gap: '1rem' }}>
          <span>
            Avg Score: {(sortedFunds.reduce((sum, fund) => sum + (fund.scores?.final || fund.score || 0), 0) / sortedFunds.length).toFixed(2)}
          </span>
          <span>
            Recommended: {sortedFunds.filter(fund => fund.is_recommended || fund.recommended).length}
          </span>
        </div>
      </div>
    </div>
  );
};

export default EnhancedFundTable;