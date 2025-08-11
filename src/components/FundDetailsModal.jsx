// src/components/FundDetailsModal.jsx
import React from 'react';
import { formatPercent, formatNumber, getMetricDisplayName } from '../utils/dataFormatting';
import ScoreBadge from './ScoreBadge';

const FundDetailsModal = ({ fund, onClose }) => {
  if (!fund) return null;

  const metrics = [
    ['YTD', formatPercent(fund['YTD'])],
    ['1 Year', formatPercent(fund['1 Year'])],
    ['3 Year', formatPercent(fund['3 Year'])],
    ['5 Year', formatPercent(fund['5 Year'])],
    ['10 Year', formatPercent(fund['10 Year'])],
    ['Sharpe Ratio', formatNumber(fund['Sharpe Ratio'])],
    ['StdDev3Y', formatPercent(fund['StdDev3Y'])],
    ['StdDev5Y', formatPercent(fund['StdDev5Y'])],
    ['Net Expense Ratio', formatPercent(fund['Net Expense Ratio'])],
    ['Alpha', formatNumber(fund['Alpha'])],
    ['Up Capture Ratio', formatPercent(fund['Up Capture Ratio'])],
    ['Down Capture Ratio', formatPercent(fund['Down Capture Ratio'])],
    ['Manager Tenure', formatNumber(fund['Manager Tenure'], 1)]
  ];

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          padding: '2rem',
          borderRadius: '0.5rem',
          maxWidth: '600px',
          maxHeight: '80vh',
          overflow: 'auto'
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="fund-details-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="fund-details-title" style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
          {fund.displayName}
        </h3>
        <div style={{ marginBottom: '1rem' }}>
          <strong>Symbol:</strong> {fund.Symbol} |{' '}
          <strong> Asset Class:</strong> {fund['Asset Class']}
        </div>
        {fund.scores && (
          <div style={{ marginBottom: '1rem' }}>
            <strong>Overall Score: </strong>
            <ScoreBadge score={fund.scores.final} size="large" />
            <span style={{ marginLeft: '1rem', color: '#6b7280' }}>
              (Percentile: {fund.scores.percentile}%)
            </span>
          </div>
        )}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
          <tbody>
            {metrics.map(([label, value]) => (
              <tr key={label}>
                <td style={{ padding: '0.5rem', textAlign: 'left' }}>
                  {getMetricDisplayName(label)}
                </td>
                <td style={{ padding: '0.5rem', textAlign: 'right' }}>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          onClick={onClose}
          style={{
            marginTop: '1rem',
            padding: '0.5rem 1rem',
            backgroundColor: '#e5e7eb',
            border: 'none',
            borderRadius: '0.25rem',
            cursor: 'pointer'
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default FundDetailsModal;
