// src/components/Trading/Trading.jsx
import React from 'react';
import ProfessionalTable from '../tables/ProfessionalTable';
import flowsService from '../../services/flowsService';
import fundService from '../../services/fundService';
import { getAdvisorOptions } from '../../config/advisorNames';
import { buildCSV, formatExportFilename, downloadFile } from '../../services/exportService';

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

function MiniBarChart({ data = [], labelKey = 'ticker', valueKey = 'value', width = 600, height = 180, color = '#10b981' }) {
  if (!Array.isArray(data) || data.length === 0) return <div style={{ height, background: '#f3f4f6', borderRadius: 8 }} />;
  const padX = 120;
  const padY = 12;
  const innerW = width - padX - 16;
  const barH = Math.max(16, Math.floor((height - padY * 2) / data.length) - 6);
  const maxVal = Math.max(1, ...data.map(d => Math.abs(Number(d[valueKey]) || 0)));
  const rows = data.slice(0, Math.min(10, data.length));
  return (
    <svg width={width} height={height} role="img" aria-label="Bars">
      <rect x="0" y="0" width={width} height={height} fill="#ffffff" stroke="#e5e7eb" />
      {rows.map((d, i) => {
        const v = Math.abs(Number(d[valueKey]) || 0);
        const w = Math.max(1, Math.round((v / maxVal) * innerW));
        const y = padY + i * (barH + 6);
        return (
          <g key={`${d[labelKey]}-${i}`}> 
            <text x={8} y={y + barH * 0.75} fontSize={12} fill="#374151">{d[labelKey]}</text>
            <rect x={padX} y={y} width={w} height={barH} fill={color} rx={3} ry={3} />
            <text x={padX + w + 8} y={y + barH * 0.75} fontSize={12} fill="#111827">{new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', maximumFractionDigits: 0 }).format(v)}</text>
          </g>
        );
      })}
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
  const [kpis, setKpis] = React.useState({ total_inflows: 0, total_outflows: 0, net_flow: 0, distinct_tickers: 0, advisors_trading: 0 });
  const [drillFor, setDrillFor] = React.useState(null); // ticker or null
  const [drillData, setDrillData] = React.useState({ rows: [], summary: null, loading: false });

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
        const [buys, sells, trend, k] = await Promise.all([
          flowsService.getTopMovers({ month, advisorNameOrTeam: advisorName, direction: 'inflow', limit: 10 }),
          flowsService.getTopMovers({ month, advisorNameOrTeam: advisorName, direction: 'outflow', limit: 10 }),
          flowsService.getNetFlowTrend(advisorName, 8),
          flowsService.getMonthKPIs({ month, advisorNameOrTeam: advisorName })
        ]);
        if (cancel) return;
        setTopBuys(buys || []);
        setTopSells(sells || []);
        setFlowTrend(trend || []);
        setKpis(k || { total_inflows: 0, total_outflows: 0, net_flow: 0, distinct_tickers: 0, advisors_trading: 0 });

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
    { key: 'asset_class', label: 'Asset Class', width: '120px', accessor: (r) => r.asset_class || '' },
    { key: 'is_recommended', label: 'Recommended', width: '120px', accessor: (r) => r.is_recommended ? 'Yes' : 'No' },
    { key: 'amount', label: 'Net Flow', width: '120px', numeric: true, align: 'right', accessor: (r) => r.net_flow ?? r.amount ?? null, render: (v) => v != null ? new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', maximumFractionDigits: 0 }).format(Number(v)) : '—' },
    { key: 'advisorCount', label: '# Advisors', width: '110px', numeric: true, align: 'right', accessor: (r) => r.advisors_trading ?? r.advisorCount ?? null },
    { key: 'firmAUM', label: 'Firm AUM', width: '120px', numeric: true, align: 'right', accessor: (r) => r.firmAUM ?? null, render: (v) => v != null ? new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', maximumFractionDigits: 0 }).format(Number(v)) : '—' }
  ];

  function exportTop(kind) {
    const rows = kind === 'buys' ? topBuys : topSells;
    const header = ['Ticker','Fund','Asset Class','Recommended','Net Flow','Advisors Trading','Firm AUM'];
    const body = (rows || []).map(r => [r.ticker, r.name || '', r.asset_class || '', r.is_recommended ? 'Yes' : 'No', Number(r.net_flow || 0), Number(r.advisors_trading || 0), Number(r.firmAUM || 0)]);
    const csv = buildCSV([header, ...body]);
    const filename = formatExportFilename({ scope: `trading_${kind}`, asOf: month, ext: 'csv' });
    downloadFile(csv, filename, 'text/csv;charset=utf-8');
  }

  React.useEffect(() => {
    if (!drillFor || !month) return;
    let cancel = false;
    (async () => {
      try {
        setDrillData(d => ({ ...d, loading: true }));
        const data = await flowsService.getTickerDrilldown({ month, advisorNameOrTeam: advisorName, ticker: drillFor });
        if (!cancel) setDrillData({ ...(data || { rows: [], summary: null }), loading: false });
      } catch {
        if (!cancel) setDrillData({ rows: [], summary: null, loading: false });
      }
    })();
    return () => { cancel = true; };
  }, [drillFor, month, advisorName]);

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

      <div className="card" style={{ padding: 12, display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="card-title" style={{ marginTop: 0 }}>Key Alerts</h3>
          <div style={{ display: 'inline-flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => exportTop('buys')}>Download Top Buys CSV</button>
            <button className="btn btn-secondary" onClick={() => exportTop('sells')}>Download Top Sells CSV</button>
          </div>
        </div>
        {(alerts || []).length === 0 ? (
          <div style={{ color: '#6b7280' }}>No actionable alerts.</div>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {alerts.map((a) => (<li key={a.id}>{a.message}</li>))}
          </ul>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 12 }}>
          <KPI label="Inflows" value={kpis.total_inflows} currency />
          <KPI label="Outflows" value={kpis.total_outflows} currency />
          <KPI label="Net Flow" value={kpis.net_flow} currency strong />
          <KPI label="Tickers Traded" value={kpis.distinct_tickers} />
          <KPI label="Advisors Trading" value={kpis.advisors_trading} />
        </div>
      </div>

      <div className="trading-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="trading-card card" style={{ padding: 12 }}>
          <h3>Top Buys</h3>
          <ProfessionalTable data={topBuys} columns={FLOWS_COLUMNS} onRowClick={(r) => setDrillFor(String(r?.ticker || '').toUpperCase())} />
        </div>
        <div className="trading-card card" style={{ padding: 12 }}>
          <h3>Top Sells</h3>
          <ProfessionalTable data={topSells} columns={FLOWS_COLUMNS} onRowClick={(r) => setDrillFor(String(r?.ticker || '').toUpperCase())} />
        </div>
      </div>

      <div className="chart-section card" style={{ padding: 12 }}>
        <h3>Net Flows Trend</h3>
        <SimpleLineChart data={flowTrend} xKey="month" yKey="net_flow" height={260} />
      </div>

      <div className="chart-section card" style={{ padding: 12 }}>
        <h3>Top Inflows and Outflows</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Top Inflows</div>
            <MiniBarChart data={(topBuys || []).map(r => ({ ticker: r.ticker, value: Number(r.net_flow || 0) })).filter(r => r.value > 0)} color="#10b981" />
          </div>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Top Outflows</div>
            <MiniBarChart data={(topSells || []).map(r => ({ ticker: r.ticker, value: Math.abs(Number(r.net_flow || 0)) })).filter(r => r.value > 0)} color="#ef4444" />
          </div>
        </div>
      </div>

      {drillFor && (
        <div className="card" style={{ padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Details · {drillFor} · {month}{advisorName ? ` · ${advisorName}` : ''}</h3>
            <div style={{ display: 'inline-flex', gap: 8 }}>
              <a className="btn" href={`/portfolios?ticker=${encodeURIComponent(drillFor)}`} target="_self" rel="noreferrer">Open Portfolios ByFund</a>
              <button className="btn btn-secondary" onClick={() => setDrillFor(null)}>Close</button>
            </div>
          </div>
          {drillData.loading ? (
            <div style={{ color: '#6b7280' }}>Loading...</div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {drillData.summary && (
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                  <KPI label="Buy Trades" value={drillData.summary.buy_trades} />
                  <KPI label="Sell Trades" value={drillData.summary.sell_trades} />
                  <KPI label="Buy Amount" value={drillData.summary.buy_amount} currency />
                  <KPI label="Sell Amount" value={drillData.summary.sell_amount} currency />
                  <KPI label="Net Flow" value={drillData.summary.net_flow} currency strong />
                </div>
              )}
              <ProfessionalTable
                data={drillData.rows}
                columns={[
                  { key: 'advisor_id', label: 'Advisor', width: '120px', accessor: (r) => r.advisor_id },
                  { key: 'buy_trades', label: 'Buy Trades', width: '110px', numeric: true, align: 'right', accessor: (r) => r.buy_trades },
                  { key: 'sell_trades', label: 'Sell Trades', width: '110px', numeric: true, align: 'right', accessor: (r) => r.sell_trades },
                  { key: 'buy_amount', label: 'Buy Amount', width: '140px', numeric: true, align: 'right', accessor: (r) => r.buy_amount, render: (v) => v != null ? new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', maximumFractionDigits: 0 }).format(Number(v)) : '—' },
                  { key: 'sell_amount', label: 'Sell Amount', width: '140px', numeric: true, align: 'right', accessor: (r) => r.sell_amount, render: (v) => v != null ? new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', maximumFractionDigits: 0 }).format(Number(v)) : '—' },
                  { key: 'net_flow', label: 'Net Flow', width: '140px', numeric: true, align: 'right', accessor: (r) => r.net_flow, render: (v) => v != null ? new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', maximumFractionDigits: 0 }).format(Number(v)) : '—' }
                ]}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function KPI({ label, value, currency = false, strong = false }) {
  const fmt = (v) => {
    if (v == null) return '—';
    if (currency) return new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', maximumFractionDigits: 0 }).format(Number(v));
    return String(v);
  };
  return (
    <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, minWidth: 120 }}>
      <div style={{ fontSize: 12, color: '#6b7280' }}>{label}</div>
      <div style={{ fontWeight: strong ? 800 : 700 }}>{fmt(value)}</div>
    </div>
  );
}

