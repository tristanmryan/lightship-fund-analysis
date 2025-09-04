import React, { useEffect, useMemo, useState } from 'react';
import flowsService from '../../services/flowsService.js';
import fundService from '../../services/fundService.js';
import { exportTradeFlowsCSV, downloadFile, formatExportFilename } from '../../services/exportService.js';

function TradeFlowDashboard() {
  const [months, setMonths] = useState([]);
  const [month, setMonth] = useState('');
  const [assetClass, setAssetClass] = useState('');
  const [topInflows, setTopInflows] = useState([]);
  const [topOutflows, setTopOutflows] = useState([]);
  const [trend, setTrend] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [recommendedSet, setRecommendedSet] = useState(new Set());

  // Load available months
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const ms = await flowsService.listMonths(24);
        if (cancel) return;
        setMonths(ms);
        if (ms && ms.length > 0) setMonth(prev => prev || ms[0]);
      } catch (e) {
        if (!cancel) setError(e.message || String(e));
      }
    })();
    return () => { cancel = true; };
  }, []);

  // Load recommended set for flagging
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const rec = await fundService.getRecommendedFunds();
        if (cancel) return;
        const set = new Set((rec || []).map(r => String(r.ticker || '').toUpperCase()));
        setRecommendedSet(set);
      } catch { setRecommendedSet(new Set()); }
    })();
    return () => { cancel = true; };
  }, []);

  // Load data when filters change
  useEffect(() => {
    if (!month) return;
    let cancel = false;
    (async () => {
      try {
        setLoading(true); setError(null);
        const [inflows, outflows, tr] = await Promise.all([
          flowsService.getTopMovers({ month, direction: 'inflow', assetClass: assetClass || null, ticker: null, limit: 10 }),
          flowsService.getTopMovers({ month, direction: 'outflow', assetClass: assetClass || null, ticker: null, limit: 10 }),
          flowsService.getNetFlowTrend(6)
        ]);
        if (cancel) return;
        setTopInflows(inflows);
        setTopOutflows(outflows);
        setTrend(tr);
      } catch (e) {
        if (!cancel) setError(e.message || String(e));
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [month, assetClass]);

  const inflowRows = useMemo(() => {
    return (topInflows || []).map(r => {
      const t = String(r.ticker || '').toUpperCase();
      const flag = recommendedSet.has(t) ? null : 'NONREC_BUY';
      return { ...r, flag };
    });
  }, [topInflows, recommendedSet]);

  const outflowRows = useMemo(() => {
    return (topOutflows || []).map(r => {
      const t = String(r.ticker || '').toUpperCase();
      const flag = recommendedSet.has(t) ? 'REC_SELL' : null;
      return { ...r, flag };
    });
  }, [topOutflows, recommendedSet]);

  const assetClasses = useMemo(() => {
    const s = new Set([""].concat((inflowRows || []).map(r => r.asset_class || null)).concat((outflowRows || []).map(r => r.asset_class || null)).filter(Boolean));
    return Array.from(s).sort();
  }, [inflowRows, outflowRows]);

  return (
    <div className="card" style={{ padding: 16, marginTop: 16 }}>
      <div className="card-header">
        <h2 className="card-title">Trade Flow Dashboard</h2>
        <p className="card-subtitle">Monthly net flows and top movers</p>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
        <div>
          <label style={{ fontSize: 12, color: '#6b7280' }}>Month</label><br />
          <select value={month} onChange={e => setMonth(e.target.value)}>
            {(months || []).map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, color: '#6b7280' }}>Asset Class</label><br />
          <select value={assetClass} onChange={e => setAssetClass(e.target.value)}>
            {assetClasses.map(ac => <option key={ac || 'all'} value={ac}>{ac || 'All'}</option>)}
          </select>
        </div>
        
        {loading && <div style={{ color: "#6b7280" }}>Loading...</div>}
        {error && <div className="alert alert-error">{error}</div>}
        <div style={{ marginLeft: 'auto' }}>
          <button className="btn" onClick={() => {
            try {
              const blob = exportTradeFlowsCSV({ month, assetClass: assetClass || null, ticker: null, topInflows: inflowRows, topOutflows: outflowRows, heatmap: [], trend, sentiment: null });
              const name = formatExportFilename({ scope: 'trade_flows', asOf: month, ext: 'csv' });
              downloadFile(blob, name, 'text/csv;charset=utf-8');
            } catch (e) { console.error('Export flows CSV failed', e); }
          }}>Export CSV</button>
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginTop: 12 }}>
        <SectionHeader title="Net Flow Trend" subtitle={`Firm-wide net flows (last 6 months)`} />
        <NetFlowChart series={trend} />
      </div>

      <div className="grid-2" style={{ marginTop: 12 }}>
        <div className="card" style={{ padding: 12 }}>
          <SectionHeader title="Top Inflows" subtitle={assetClass ? `Filtered: ${assetClass}` : 'All asset classes'} />
          <TopMoversTable rows={inflowRows} direction="inflow" month={month} />
        </div>
        <div className="card" style={{ padding: 12 }}>
          <SectionHeader title="Top Outflows" subtitle={assetClass ? `Filtered: ${assetClass}` : 'All asset classes'} />
          <TopMoversTable rows={outflowRows} direction="outflow" month={month} />
        </div>
      </div>
    </div>
  );
}

export default React.memo(TradeFlowDashboard);

function SectionHeader({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontWeight: 600 }}>{title}</div>
      <div style={{ fontSize: 12, color: '#6b7280' }}>{subtitle}</div>
    </div>
  );
}

function NetFlowChart({ series }) {
  const [w, h, pad] = [700, 220, 40];
  const points = (series || []).map(r => ({ x: new Date(r.month).getTime(), y: Number(r.net_flow || 0) }));
  if (points.length === 0) return <div style={{ color: '#6b7280', fontSize: 12 }}>No trend data.</div>;
  const minX = Math.min(...points.map(p => p.x));
  const maxX = Math.max(...points.map(p => p.x));
  const minY = Math.min(0, ...points.map(p => p.y));
  const maxY = Math.max(0, ...points.map(p => p.y));
  const scaleX = (v) => pad + ((v - minX) / (maxX - minX || 1)) * (w - pad * 2);
  const scaleY = (v) => (h - pad) - ((v - minY) / ((maxY - minY) || 1)) * (h - pad * 2);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.x)} ${scaleY(p.y)}`).join(' ');
  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="auto" role="img" aria-label="Net flow trend chart">
        <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="#9ca3af" />
        <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="#9ca3af" />
        <path d={path} fill="none" stroke="#0ea5e9" strokeWidth={2} />
        {points.map((p, i) => (
          <circle key={i} cx={scaleX(p.x)} cy={scaleY(p.y)} r={3} fill={p.y >= 0 ? '#10b981' : '#ef4444'} />
        ))}
      </svg>
    </div>
  );
}

function TopMoversTable({ rows, direction, month }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid #e5e7eb' }}>Ticker</th>
            <th style={{ textAlign: 'right', padding: 6, borderBottom: '1px solid #e5e7eb' }}>Inflows</th>
            <th style={{ textAlign: 'right', padding: 6, borderBottom: '1px solid #e5e7eb' }}>Outflows</th>
            <th style={{ textAlign: 'right', padding: 6, borderBottom: '1px solid #e5e7eb' }}>Net</th>
            <th style={{ textAlign: 'right', padding: 6, borderBottom: '1px solid #e5e7eb' }}>Advisors</th>
            <th style={{ textAlign: 'center', padding: 6, borderBottom: '1px solid #e5e7eb' }}>Flag</th>
          </tr>
        </thead>
        <tbody>
          {(rows || []).map((r, i) => (
            <tr key={i}>
              <td style={{ padding: 6, borderBottom: '1px solid #f3f4f6' }}>{r.ticker}</td>
              <td style={{ padding: 6, borderBottom: '1px solid #f3f4f6', textAlign: 'right' }}>{fmtCurrency(r.inflows)}</td>
              <td style={{ padding: 6, borderBottom: '1px solid #f3f4f6', textAlign: 'right' }}>{fmtCurrency(r.outflows)}</td>
              <td style={{ padding: 6, borderBottom: '1px solid #f3f4f6', textAlign: 'right', color: Number(r.net_flow || 0) >= 0 ? '#065f46' : '#7f1d1d' }}>{fmtCurrency(r.net_flow)}</td>
              <td style={{ padding: 6, borderBottom: '1px solid #f3f4f6', textAlign: 'right' }}>{r.advisors_trading}</td>
              <td style={{ padding: 6, borderBottom: '1px solid #f3f4f6', textAlign: 'center' }}>
                {r.flag === 'REC_SELL' && <span title="Selling recommended" style={{ color: '#b91c1c', fontWeight: 700 }}>!</span>}
                {r.flag === 'NONREC_BUY' && <span title="Buying non-recommended" style={{ color: '#b45309', fontWeight: 700 }}>!</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function fmtCurrency(v) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(v || 0));
}

// Removed heatmaps, sentiment gauge, advisor modal for simplicity per v3 spec






