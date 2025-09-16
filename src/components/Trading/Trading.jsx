// src/components/Trading/Trading.jsx
import React from 'react';
import ProfessionalTable from '../tables/ProfessionalTable';
import flowsService from '../../services/flowsService';
import fundService from '../../services/fundService';
import { getAdvisorOptions } from '../../config/advisorNames';

function SimpleLineChart({ data = [], xKey = 'month', yKey = 'net_flow', height = 200 }) {
  if (!Array.isArray(data) || data.length === 0) return <div style={{ height, background: '#f3f4f6', borderRadius: 8 }} />;
  const width = 600;
  const pad = 24;
  const xs = data.map((d) => new Date(d[xKey]).getTime());
  const ys = data.map((d) => Number(d[yKey]) || 0);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const xScale = (v) => pad + ((v - minX) / (maxX - minX || 1)) * (width - 2 * pad);
  const yScale = (v) => pad + (1 - ((v - minY) / (maxY - minY || 1))) * (height - 2 * pad);
  const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${xScale(x)} ${yScale(ys[i])}`).join(' ');
  return (
    <svg width={width} height={height} role="img" aria-label="Net flows line chart">
      <rect x="0" y="0" width={width} height={height} fill="#ffffff" stroke="#e5e7eb" />
      <path d={path} stroke="#3b82f6" strokeWidth="2" fill="none" />
    </svg>
  );
}

export default function Trading() {
  const [month, setMonth] = React.useState('');
  const [months, setMonths] = React.useState([]);
  const [advisorName, setAdvisorName] = React.useState(''); // Advisor filter
  const [topBuys, setTopBuys] = React.useState([]);
  const [topSells, setTopSells] = React.useState([]);
  const [flowTrend, setFlowTrend] = React.useState([]);
  const [alerts, setAlerts] = React.useState([]);

  React.useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const ms = await flowsService.listMonths(12);
        if (cancel) return;
        setMonths(ms);
        if (ms && ms.length > 0) setMonth(ms[0]);
      } catch {}
    })();
    return () => { cancel = true; };
  }, []);

  React.useEffect(() => {
    if (!month) return;
    let cancel = false;
    (async () => {
      try {
        // Note: Current flow service doesn't support advisor filtering 
        // For now, showing firm-wide data with advisor context in alerts
        const [buys, sells, trend] = await Promise.all([
          flowsService.getTopMovers({ month, direction: 'inflow', limit: 10 }),
          flowsService.getTopMovers({ month, direction: 'outflow', limit: 10 }),
          flowsService.getNetFlowTrend(8)
        ]);
        if (cancel) return;
        setTopBuys(buys || []);
        setTopSells(sells || []);
        setFlowTrend(trend || []);

        // Simple alerts: selling recommended funds or buying non-recommended
        const base = await fundService.getAllFundsWithScoring(null);
        const meta = new Map((base || []).map(f => [String(f.ticker).toUpperCase(), !!f.is_recommended]));
        const alertsList = [];
        (sells || []).slice(0,5).forEach(r => { if (meta.get(String(r.ticker).toUpperCase())) alertsList.push({ id: `sell-${r.ticker}`, type: 'warning', message: `${advisorName ? `${advisorName} context: ` : ''}Firm selling recommended ${r.ticker}` }); });
        (buys || []).slice(0,5).forEach(r => { if (!meta.get(String(r.ticker).toUpperCase())) alertsList.push({ id: `buy-${r.ticker}`, type: 'info', message: `${advisorName ? `${advisorName} context: ` : ''}Firm buying non-recommended ${r.ticker}` }); });
        setAlerts(alertsList);
      } catch {}
    })();
    return () => { cancel = true; };
  }, [month, advisorName]);

  const FLOWS_COLUMNS = [
    { key: 'ticker', label: 'Ticker', width: '90px', accessor: (r) => r.ticker, render: (v) => <span style={{ fontWeight: 600 }}>{v}</span> },
    { key: 'name', label: 'Fund', width: '220px', accessor: (r) => r.name || '' },
    { key: 'amount', label: 'Net Flow', width: '120px', numeric: true, align: 'right', accessor: (r) => r.net_flow ?? r.amount ?? null, render: (v) => v != null ? new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', maximumFractionDigits: 0 }).format(Number(v)) : '—' },
    { key: 'advisorCount', label: '# Advisors', width: '110px', numeric: true, align: 'right', accessor: (r) => r.advisors_trading ?? r.advisorCount ?? null }
  ];

  return (
    <div className="trading-page" style={{ display: 'grid', gap: '1rem' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Trading Activity</h1>
        <div className="filters" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div>
            <label style={{ fontSize: 12, color: '#6b7280' }}>Month</label><br />
            <select value={month} onChange={(e) => setMonth(e.target.value)}>
              {(months || []).map((m) => (<option key={m} value={m}>{m}</option>))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#6b7280' }}>Advisor</label><br />
            <select value={advisorName} onChange={(e) => setAdvisorName(e.target.value)}>
              <option value="">All Advisors</option>
              {getAdvisorOptions().map(option => (
                <option key={option.value} value={option.value} disabled={option.disabled}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 12 }}>
        <h3 className="card-title" style={{ marginTop: 0 }}>Key Alerts</h3>
        {(alerts || []).length === 0 ? (
          <div style={{ color: '#6b7280' }}>No actionable alerts.</div>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {alerts.map((a) => (<li key={a.id}>{a.message}</li>))}
          </ul>
        )}
      </div>

      <div className="trading-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="trading-card card" style={{ padding: 12 }}>
          <h3>Top Buys</h3>
          <ProfessionalTable data={topBuys} columns={FLOWS_COLUMNS} />
        </div>
        <div className="trading-card card" style={{ padding: 12 }}>
          <h3>Top Sells</h3>
          <ProfessionalTable data={topSells} columns={FLOWS_COLUMNS} />
        </div>
      </div>

      <div className="chart-section card" style={{ padding: 12 }}>
        <h3>Net Flows Trend</h3>
        <SimpleLineChart data={flowTrend} xKey="month" yKey="net_flow" height={260} />
      </div>
    </div>
  );
}

