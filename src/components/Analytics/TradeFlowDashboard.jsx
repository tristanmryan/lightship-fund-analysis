import React, { useEffect, useMemo, useState } from 'react';
import flowsService from '../../services/flowsService.js';
import { exportTradeFlowsCSV, downloadFile, formatExportFilename } from '../../services/exportService.js';

export default function TradeFlowDashboard() {
  const [months, setMonths] = useState([]);
  const [month, setMonth] = useState('');
  const [assetClass, setAssetClass] = useState('');
  const [ticker, setTicker] = useState('');
  const [topInflows, setTopInflows] = useState([]);
  const [topOutflows, setTopOutflows] = useState([]);
  const [heatmap, setHeatmap] = useState([]);
  const [trend, setTrend] = useState([]);
  const [sentiment, setSentiment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

  // Load data when month/assetClass changes
  useEffect(() => {
    if (!month) return;
    let cancel = false;
    (async () => {
      try {
        setLoading(true); setError(null);
        const [inflows, outflows, hm, tr, ap] = await Promise.all([
          flowsService.getTopMovers({ month, direction: 'inflow', assetClass: assetClass || null, ticker: ticker?.trim() ? ticker.trim().toUpperCase() : null, limit: 10 }),
          flowsService.getTopMovers({ month, direction: 'outflow', assetClass: assetClass || null, ticker: ticker?.trim() ? ticker.trim().toUpperCase() : null, limit: 10 }),
          flowsService.getFlowByAssetClass({ month }),
          flowsService.getNetFlowTrend(6),
          flowsService.getAdvisorParticipation({ month, ticker: ticker?.trim() ? ticker.trim().toUpperCase() : null })
        ]);
        if (cancel) return;
        setTopInflows(inflows);
        setTopOutflows(outflows);
        setHeatmap(hm);
        setTrend(tr);
        setSentiment(ap);
      } catch (e) {
        if (!cancel) setError(e.message || String(e));
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [month, assetClass]);

  const assetClasses = useMemo(() => {
    const s = new Set((heatmap || []).map(r => r.asset_class).filter(Boolean));
    return [''].concat(Array.from(s).sort());
  }, [heatmap]);

  return (
    <div className="card" style={{ padding: 16, marginTop: 16 }}>
      <div className="card-header">
        <h2 className="card-title">Trade Flow Dashboard</h2>
        <p className="card-subtitle">Monthly net flows, advisor sentiment, and top movers</p>
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
        <div>
          <label style={{ fontSize: 12, color: '#6b7280' }}>Ticker (optional)</label><br />
          <input type="text" placeholder="e.g., SPY" value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())} style={{ width: 120 }} />
        </div>
        {loading && <div style={{ color: '#6b7280' }}>Loading…</div>}
        {error && <div className="alert alert-error">{error}</div>}
        <div style={{ marginLeft: 'auto' }}>
          <button className="btn" onClick={() => {
            try {
              const blob = exportTradeFlowsCSV({ month, assetClass: assetClass || null, ticker: ticker?.trim() || null, topInflows, topOutflows, heatmap, trend, sentiment });
              const name = formatExportFilename({ scope: 'trade_flows', asOf: month, ext: 'csv' });
              downloadFile(blob, name, 'text/csv;charset=utf-8');
            } catch (e) { console.error('Export flows CSV failed', e); }
          }}>Export CSV</button>
          <button className="btn" onClick={async () => {
            try {
              const { generateTradeFlowsPDF, downloadPDF } = await import('../../services/exportService.js');
              const pdf = await generateTradeFlowsPDF({ month, assetClass: assetClass || null, ticker: ticker?.trim() || null, topInflows, topOutflows, heatmap, trend, sentiment });
              const name = formatExportFilename({ scope: 'trade_flows', asOf: month, ext: 'pdf' });
              downloadPDF(pdf, name);
            } catch (e) { console.error('Export flows PDF failed', e); }
          }}>Export PDF</button>
        </div>
      </div>

      <div className="grid-3" style={{ marginTop: 12 }}>
        <div className="card" style={{ padding: 12 }}>
          <SectionHeader title="Net Flow Trend" subtitle="Firm-wide net flows (last 6 months)" />
          <NetFlowChart series={trend} />
        </div>
        <div className="card" style={{ padding: 12 }}>
          <SectionHeader title="Advisor Sentiment" subtitle="Buying vs. selling participation" />
          <AdvisorSentimentGauge data={sentiment} />
        </div>
        <div className="card" style={{ padding: 12 }}>
          <SectionHeader title="Asset Class Flow Heatmap" subtitle="Aggregated by asset class" />
          <FlowHeatmap rows={heatmap} />
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 12 }}>
        <div className="card" style={{ padding: 12 }}>
          <SectionHeader title="Top Inflows" subtitle={assetClass ? `Filtered: ${assetClass}` : 'All asset classes'} />
          <TopMoversTable rows={topInflows} direction="inflow" />
        </div>
        <div className="card" style={{ padding: 12 }}>
          <SectionHeader title="Top Outflows" subtitle={assetClass ? `Filtered: ${assetClass}` : 'All asset classes'} />
          <TopMoversTable rows={topOutflows} direction="outflow" />
        </div>
      </div>
    </div>
  );
}

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

function AdvisorSentimentGauge({ data }) {
  const buying = Number(data?.advisors_buying || 0);
  const selling = Number(data?.advisors_selling || 0);
  const total = Number(data?.advisors_total || (buying + selling)) || 0;
  const pct = total > 0 ? buying / total : 0;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 160, height: 12, background: '#f3f4f6', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ width: `${Math.round(pct * 100)}%`, height: '100%', background: '#10b981' }} />
        </div>
        <div style={{ fontSize: 12 }}>
          {Math.round(pct * 100)}% buying
        </div>
      </div>
      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
        Advisors buying: {buying} · Selling: {selling} · Total: {total}
      </div>
    </div>
  );
}

function TopMoversTable({ rows, direction }) {
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FlowHeatmap({ rows }) {
  const entries = (rows || []).slice().sort((a, b) => b.net_flow - a.net_flow);
  const maxAbs = Math.max(1, ...entries.map(e => Math.abs(e.net_flow)));
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
      {entries.map((e, i) => (
        <div key={i} className="card" style={{ padding: 10, background: heatColor(e.net_flow / maxAbs) }}>
          <div style={{ fontWeight: 600 }}>{e.asset_class}</div>
          <div style={{ fontSize: 12, color: '#111827' }}>Inflows: {fmtCurrency(e.inflows)}</div>
          <div style={{ fontSize: 12, color: '#111827' }}>Outflows: {fmtCurrency(e.outflows)}</div>
          <div style={{ fontSize: 12, color: '#111827' }}>Net: {fmtCurrency(e.net_flow)}</div>
          <div style={{ fontSize: 12, color: '#111827' }}>Funds traded: {e.funds_traded}</div>
        </div>
      ))}
    </div>
  );
}

function fmtCurrency(v) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(v || 0));
}

function heatColor(x) {
  // diverging palette: red (-) to green (+)
  const t = Math.max(-1, Math.min(1, x));
  if (t >= 0) {
    const g = Math.floor(255 * (0.6 + 0.4 * t));
    const r = Math.floor(255 * (1 - t * 0.7));
    return `rgb(${r}, ${g}, 180)`;
  } else {
    const u = Math.abs(t);
    const r = Math.floor(255 * (0.6 + 0.4 * u));
    const g = Math.floor(255 * (1 - u * 0.7));
    return `rgb(${r}, ${g}, 180)`;
  }
}
