// src/components/Dashboard/DrilldownCards.jsx
import React, { useMemo } from 'react';
import { formatPercent, formatNumber } from '../../utils/formatters';
import { getPrimaryBenchmark } from '../../services/resolvers/benchmarkResolverClient';
import NotesPanel from './NotesPanel';
import ScoreAnalysisSection from './ScoreAnalysisSection';
import { METRICS_CONFIG } from '../../services/scoring';

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
    if (!fund) return null;
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

  const scoreValue = fund?.scores?.final;

  const topReasons = useMemo(() => {
    if (!fund) return [];
    try {
      const breakdown = fund?.scores?.breakdown || {};
      const rows = Object.keys(breakdown).map((k) => {
        const row = breakdown[k] || {};
        const contrib = (typeof row.reweightedContribution === 'number') ? row.reweightedContribution : (row.weightedZScore || 0);
        return { key: k, label: METRICS_CONFIG.labels[k] || k, contrib };
      }).filter(r => Number.isFinite(r.contrib));
      rows.sort((a, b) => Math.abs(b.contrib) - Math.abs(a.contrib));
      return rows.slice(0, 3);
    } catch { return []; }
  }, [fund]);

  if (!fund) {
    return (
      <div className="card" style={{ padding: 16, border: '1px solid #e5e7eb', background: '#f9fafb', borderRadius: 8, textAlign: 'center' }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>No fund selected</div>
        <div style={{ fontSize: 12, color: '#6b7280' }}>Choose a fund from the table to view details and score breakdown.</div>
      </div>
    );
  }

  // Compute deltas where meaningful
  const diff = (fVal, bVal) => {
    if (fVal == null || bVal == null || isNaN(fVal) || isNaN(bVal)) return null;
    return Number(fVal) - Number(bVal);
  };

  const sections = [
    {
      title: 'Performance',
      items: [
        { label: '1Y Return', value: make(fund?.one_year_return, 'pct', 2), delta: diff(fund?.one_year_return, benchFund?.one_year_return), kind: 'pct', tooltip: 'Total return over the last 12 months' },
        { label: '3Y Return', value: make(fund?.three_year_return, 'pct', 2), delta: diff(fund?.three_year_return, benchFund?.three_year_return), kind: 'pct', tooltip: 'Annualized return over the last 3 years' }
      ]
    },
    {
      title: 'Risk',
      items: [
        { label: 'Sharpe Ratio', value: make(fund?.sharpe_ratio, 'num', 2), delta: diff(fund?.sharpe_ratio, benchFund?.sharpe_ratio), kind: 'num', tooltip: 'Risk-adjusted return: higher is better' },
        { label: 'Std Dev (3Y)', value: make(fund?.standard_deviation_3y, 'pct', 2), delta: diff(fund?.standard_deviation_3y, benchFund?.standard_deviation_3y ?? benchFund?.standard_deviation), kind: 'pct', tooltip: 'Volatility (3-year): lower is better' },
        { label: 'Std Dev (5Y)', value: make(fund?.standard_deviation_5y, 'pct', 2), delta: diff(fund?.standard_deviation_5y, benchFund?.standard_deviation_5y ?? benchFund?.standard_deviation), kind: 'pct', tooltip: 'Volatility (5-year): lower is better' },
        { label: 'Beta', value: make(fund?.beta, 'num', 2), delta: diff(fund?.beta, benchFund?.beta), kind: 'num', tooltip: 'Market sensitivity: 1.0 ≈ market risk' },
        { label: 'Alpha', value: make(fund?.alpha, 'num', 2), delta: diff(fund?.alpha, benchFund?.alpha), kind: 'num', tooltip: 'Excess return vs risk expectation' }
      ]
    },
    {
      title: 'Capture (3Y)',
      items: [
        { label: 'Up Capture', value: make(fund?.up_capture_ratio, 'pct', 1), delta: diff(fund?.up_capture_ratio, benchFund?.up_capture_ratio), kind: 'pct', tooltip: 'Capture in up markets: higher is better' },
        { label: 'Down Capture', value: make(fund?.down_capture_ratio, 'pct', 1), delta: diff(fund?.down_capture_ratio, benchFund?.down_capture_ratio), kind: 'pct', tooltip: 'Capture in down markets: lower is better' }
      ]
    },
    {
      title: 'Fees & Other',
      items: [
        { label: 'Expense Ratio', value: make(fund?.expense_ratio, 'pct', 2), delta: diff(fund?.expense_ratio, benchFund?.expense_ratio), kind: 'pct', tooltip: 'Annual fund costs: lower is better' },
        { label: 'Manager Tenure (yrs)', value: make(fund?.manager_tenure, 'num', 1), delta: null, kind: 'num', tooltip: 'Longest manager tenure, in years' }
      ]
    }
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
      <div className="card" style={{ padding: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Overview</div>
        <MetricRow label="Score" value={scoreValue == null ? '—' : formatNumber(scoreValue, 1)} />
        {topReasons.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Top reasons (impact within asset class)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {topReasons.map((r) => {
                const positive = r.contrib >= 0;
                return (
                  <span key={r.key} style={{ fontSize: 12, background: positive ? '#ecfdf5' : '#fef2f2', color: positive ? '#065f46' : '#7f1d1d', border: `1px solid ${positive ? '#a7f3d0' : '#fecaca'}`, borderRadius: 9999, padding: '2px 8px' }}>
                    {positive ? '+' : ''}{formatNumber(r.contrib, 2)} {r.label}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>
      {!benchmark || !benchFund ? (
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Benchmark mapping missing</div>
          <div style={{ fontSize: 12, color:'#6b7280', marginBottom: 6 }}>Add a primary benchmark for this fund’s asset class to see deltas.</div>
          <button className="btn btn-secondary" onClick={(e)=>{ e.preventDefault(); window.dispatchEvent(new CustomEvent('NAVIGATE_APP', { detail: { tab: 'admin' } })); window.dispatchEvent(new CustomEvent('NAVIGATE_ADMIN', { detail: { subtab: 'catalogs' } })); }}>Open Benchmarks</button>
        </div>
      ) : null}
      {sections.map(sec => (
        <div key={sec.title} className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>{sec.title}</div>
          {sec.items.map(it => (
            <MetricRow key={it.label} label={it.label} value={it.value} delta={it.delta} benchTicker={benchmark?.ticker} tooltip={it.tooltip} />
          ))}
        </div>
      ))}
      <div className="card" style={{ padding: 12, gridColumn: '1 / -1' }}>
        <details>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Weights & coverage</summary>
          <div style={{ marginTop: 8, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>Metric</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>Weight</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>Source</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(fund?.scores?.breakdown || {}).map(([key, info]) => {
                  const label = METRICS_CONFIG.labels[key] || key;
                  const notes = [];
                  if (info?.excludedForCoverage) notes.push('excluded: low coverage');
                  if (typeof info?.zShrinkFactor === 'number' && info.zShrinkFactor < 1) notes.push(`z-shrink x${info.zShrinkFactor}`);
                  if (typeof info?.coverage === 'number') notes.push(`coverage ${(info.coverage*100).toFixed(0)}%`);
                  return (
                    <tr key={key}>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>{label}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #f3f4f6' }}>{Number.isFinite(info?.weight) ? info.weight : '-'}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>{info?.weightSource || '—'}</td>
                      <td style={{ padding: '6px 8px', color: '#6b7280', borderBottom: '1px solid #f3f4f6' }}>{notes.join(' • ') || '—'}</td>
                    </tr>
                  );
                })}
                {Object.keys(fund?.scores?.breakdown || {}).length === 0 && (
                  <tr><td colSpan={4} style={{ padding: '6px 8px', color:'#6b7280' }}>No scoring metrics available.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </details>
      </div>
      <div style={{ gridColumn: '1 / -1' }}>
        <ScoreAnalysisSection fund={fund} benchmark={benchmark} funds={funds} />
      </div>
      <div style={{ gridColumn: '1 / -1' }}>
        <NotesPanel fundId={fund?.id || null} fundTicker={fund?.ticker || fund?.Symbol || null} />
      </div>
    </div>
  );
}

