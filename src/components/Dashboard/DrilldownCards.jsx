// src/components/Dashboard/DrilldownCards.jsx
import React, { useMemo } from 'react';
import { formatPercent, formatNumber } from '../../utils/formatters';
import { getPrimaryBenchmark } from '../../services/resolvers/benchmarkResolverClient';
import NotesPanel from './NotesPanel';

function MetricRow({ label, value, delta, benchTicker, tooltip }) {
  const showDelta = delta != null && !isNaN(delta);
  const positive = showDelta && delta >= 0;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }} title={tooltip || ''}>
      <div style={{ color: '#374151' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div>{value}</div>
        {benchTicker && (
          <div
            style={{ fontSize: 12, background: showDelta ? (positive ? '#ecfdf5' : '#fef2f2') : '#f3f4f6', color: showDelta ? (positive ? '#065f46' : '#7f1d1d') : '#6b7280', border: `1px solid ${showDelta ? (positive ? '#a7f3d0' : '#fecaca') : '#e5e7eb'}`, borderRadius: 12, padding: '2px 6px' }}
            title={`Benchmark: ${benchTicker}`}
          >
            {showDelta ? `${positive ? '+' : ''}${formatNumber(delta, 2)} vs ${benchTicker}` : `vs ${benchTicker}`}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DrilldownCards({ fund, funds }) {
  const benchmark = useMemo(() => {
    try {
      const cfg = getPrimaryBenchmark(fund);
      if (!cfg) return null;
      const bench = (funds || []).find(f => (f.ticker || f.Symbol) === cfg.ticker);
      return bench ? { ticker: cfg.ticker, name: cfg.name, fund: bench } : { ticker: cfg.ticker, name: cfg.name, fund: null };
    } catch { return null; }
  }, [fund, funds]);

  const make = (val, kind = 'num', digits) => {
    if (val == null || isNaN(val)) return '—';
    return kind === 'pct' ? formatPercent(val, digits ?? 2) : formatNumber(val, digits ?? 2);
  };

  const benchFund = benchmark?.fund;

  // Compute deltas where meaningful
  const diff = (fVal, bVal) => {
    if (fVal == null || bVal == null || isNaN(fVal) || isNaN(bVal)) return null;
    return Number(fVal) - Number(bVal);
  };

  const sections = [
    {
      title: 'Risk',
      items: [
        { label: 'Sharpe Ratio', value: make(fund?.sharpe_ratio, 'num', 2), delta: diff(fund?.sharpe_ratio, benchFund?.sharpe_ratio), kind: 'num' },
        { label: 'Std Dev', value: make(fund?.standard_deviation, 'pct', 2), delta: diff(fund?.standard_deviation, benchFund?.standard_deviation), kind: 'pct' },
        { label: 'Beta', value: make(fund?.beta, 'num', 2), delta: diff(fund?.beta, benchFund?.beta), kind: 'num' },
        { label: 'Alpha', value: make(fund?.alpha, 'num', 2), delta: diff(fund?.alpha, benchFund?.alpha), kind: 'num' }
      ]
    },
    {
      title: 'Capture (3Y)',
      items: [
        { label: 'Up Capture', value: make(fund?.up_capture_ratio, 'pct', 1), delta: diff(fund?.up_capture_ratio, benchFund?.up_capture_ratio), kind: 'pct' },
        { label: 'Down Capture', value: make(fund?.down_capture_ratio, 'pct', 1), delta: diff(fund?.down_capture_ratio, benchFund?.down_capture_ratio), kind: 'pct' }
      ]
    },
    {
      title: 'Fees & Other',
      items: [
        { label: 'Expense Ratio', value: make(fund?.expense_ratio, 'pct', 2), delta: diff(fund?.expense_ratio, benchFund?.expense_ratio), kind: 'pct' },
        { label: 'Manager Tenure (yrs)', value: make(fund?.manager_tenure, 'num', 1), delta: null, kind: 'num' }
      ]
    }
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
      {sections.map(sec => (
        <div key={sec.title} className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>{sec.title}</div>
          {sec.items.map(it => (
            <MetricRow key={it.label} label={it.label} value={it.value} delta={it.delta} benchTicker={benchmark?.ticker} />
          ))}
        </div>
      ))}
      <div style={{ gridColumn: '1 / -1' }}>
        <NotesPanel fundId={fund?.id || null} fundTicker={fund?.ticker || fund?.Symbol || null} />
      </div>
    </div>
  );
}

