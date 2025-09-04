import React, { useEffect, useMemo, useState } from 'react';
import utilizationService from '../../services/utilizationService';
import { exportUtilizationCSV, downloadFile, formatExportFilename } from '../../services/exportService.js';

export default function FundUtilization() {
  const [dates, setDates] = useState([]);
  const [date, setDate] = useState('');
  const [assetClass, setAssetClass] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [trend, setTrend] = useState([]);
  const [query, setQuery] = useState('');
  const [minAdvisors, setMinAdvisors] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // load dates
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const ds = await utilizationService.listSnapshotDates();
        if (cancel) return;
        setDates(ds);
        if (ds && ds.length > 0) setDate(prev => prev || ds[0]);
      } catch (e) { if (!cancel) setError(e.message || String(e)); }
    })();
    return () => { cancel = true; };
  }, []);

  // load rows
  useEffect(() => {
    if (!date) return;
    let cancel = false;
    (async () => {
      try {
        setLoading(true); setError(null);
        const rs = await utilizationService.getFundUtilization(date, assetClass || null, 400);
        if (cancel) return;
        setRows(rs);
        setPage(1);
        if (rs && rs.length > 0) setSelected(prev => prev || rs[0]);
      } catch (e) { if (!cancel) setError(e.message || String(e)); }
      finally { if (!cancel) setLoading(false); }
    })();
    return () => { cancel = true; };
  }, [date, assetClass]);

  // load trend for selected
  useEffect(() => {
    if (!selected?.ticker) { setTrend([]); return; }
    let cancel = false;
    (async () => {
      try {
        const ts = await utilizationService.getAdoptionTrend(selected.ticker, 12);
        if (!cancel) setTrend(ts);
      } catch { if (!cancel) setTrend([]); }
    })();
    return () => { cancel = true; };
  }, [selected?.ticker]);

  const assetClasses = useMemo(() => {
    const s = new Set((rows || []).map(r => r.asset_class).filter(Boolean));
    return [''].concat(Array.from(s).sort());
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    return (rows || []).filter(r => {
      if (minAdvisors && Number(r.advisors_using || 0) < minAdvisors) return false;
      if (!q) return true;
      const t = String(r.ticker || '').toUpperCase();
      const ac = String(r.asset_class || '').toUpperCase();
      return t.includes(q) || ac.includes(q);
    });
  }, [rows, query, minAdvisors]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  useEffect(() => {
    if (page > Math.ceil(filtered.length / pageSize)) setPage(1);
  }, [filtered.length, pageSize]);

  return (
    <div className="card" style={{ padding: 16, marginTop: 16 }}>
      <div className="card-header">
        <h3 className="card-title">Fund Utilization Analytics</h3>
        <p className="card-subtitle">Firm-wide AUM, advisor usage, and adoption trends</p>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
        <div>
          <label style={{ fontSize: 12, color: '#6b7280' }}>Snapshot</label><br />
          <select value={date} onChange={e => { setDate(e.target.value); setSelected(null); }}>
            {(dates || []).map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, color: '#6b7280' }}>Asset Class</label><br />
          <select value={assetClass} onChange={e => { setAssetClass(e.target.value); setSelected(null); }}>
            {assetClasses.map(ac => <option key={ac || 'all'} value={ac}>{ac || 'All'}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, color: '#6b7280' }}>Search</label><br />
          <input type="text" placeholder="Ticker or Asset Class" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: 12, color: '#6b7280' }}>Min Advisors</label><br />
          <input type="number" min={0} value={minAdvisors} onChange={e => setMinAdvisors(Number(e.target.value || 0))} style={{ width: 80 }} />
        </div>
        <div>
          <label style={{ fontSize: 12, color: '#6b7280' }}>Page Size</label><br />
          <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))}>
            {[10,20,50,100].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        {loading && <div style={{ color: '#6b7280' }}>Loading…</div>}
        {error && <div className="alert alert-error">{error}</div>}
        <div style={{ marginLeft: 'auto' }}>
          <button className="btn" onClick={() => {
            try {
              const blob = exportUtilizationCSV({ snapshotDate: date, assetClass, rows: filtered });
              const name = formatExportFilename({ scope: 'fund_utilization', asOf: date, ext: 'csv' });
              downloadFile(blob, name, 'text/csv;charset=utf-8');
            } catch (e) { console.error('Export utilization CSV failed', e); }
          }}>Export CSV</button>
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 12 }}>
        <BubbleChart data={filtered} onSelect={setSelected} selectedTicker={selected?.ticker} />
        <RankingTable rows={paged} onSelect={setSelected} selectedTicker={selected?.ticker} />
      </div>

      <PaginationControls total={filtered.length} page={page} pageSize={pageSize} onPageChange={setPage} />

      <div className="card" style={{ padding: 12, marginTop: 12 }}>
        <TrendChart series={trend} title={selected ? `Adoption Trend: ${selected.ticker}` : 'Adoption Trend'} />
      </div>

      <div className="card" style={{ padding: 12, marginTop: 12 }}>
        <Heatmap rows={rows} />
      </div>
    </div>
  );
}

function BubbleChart({ data, onSelect, selectedTicker }) {
  const [w, h, pad] = [800, 420, 50];
  const points = (data || []).map(r => ({
    x: Number(r.advisors_using || 0),
    y: Number(r.total_aum || 0),
    z: Number(r.avg_position_usd || 0),
    t: r.ticker,
    c: r.asset_class
  }));
  const maxX = Math.max(10, ...points.map(p => p.x));
  const maxY = Math.max(1, ...points.map(p => p.y));
  const maxZ = Math.max(1, ...points.map(p => p.z));
  const scaleX = (v) => pad + (v / (maxX || 1)) * (w - pad * 2);
  const scaleY = (v) => (h - pad) - (Math.log10(Math.max(1, v)) / Math.log10(Math.max(10, maxY))) * (h - pad * 2);
  const scaleR = (v) => 4 + (v / (maxZ || 1)) * 14;
  const color = (cls) => hashColor(cls);

  return (
    <div className="card" style={{ padding: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>AUM vs. Advisors (bubble size = avg position, log AUM scale)</div>
      <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="auto" role="img" aria-label="Utilization bubble chart">
        {/* axes */}
        <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="#9ca3af" />
        <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="#9ca3af" />
        {/* labels */}
        <text x={w/2} y={h - 10} textAnchor="middle" fontSize={12} fill="#6b7280">Advisors Using</text>
        <text x={14} y={h/2} transform={`rotate(-90, 14, ${h/2})`} fontSize={12} fill="#6b7280">Total AUM (USD, log)</text>
        {/* points */}
        {points.map((p, i) => (
          <g key={i} onClick={() => onSelect && onSelect({ ticker: p.t, total_aum: p.y })} style={{ cursor: 'pointer' }}>
            <circle cx={scaleX(p.x)} cy={scaleY(p.y)} r={scaleR(p.z)} fill={color(p.c)} fillOpacity={selectedTicker === p.t ? 0.9 : 0.6} stroke={selectedTicker === p.t ? '#111827' : 'none'} />
            {selectedTicker === p.t && (
              <text x={scaleX(p.x)} y={scaleY(p.y) - scaleR(p.z) - 4} textAnchor="middle" fontSize={11} fill="#111827">{p.t}</text>
            )}
          </g>
        ))}
      </svg>
      </div>
    </div>
  );
}

function RankingTable({ rows, onSelect, selectedTicker }) {
  const top = rows || [];
  return (
    <div className="card" style={{ padding: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>Top Utilized Funds (by AUM)</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid #e5e7eb' }}>Ticker</th>
              <th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid #e5e7eb' }}>Asset Class</th>
              <th style={{ textAlign: 'right', padding: 6, borderBottom: '1px solid #e5e7eb' }}>AUM</th>
              <th style={{ textAlign: 'right', padding: 6, borderBottom: '1px solid #e5e7eb' }}>Advisors</th>
              <th style={{ textAlign: 'right', padding: 6, borderBottom: '1px solid #e5e7eb' }}>Clients</th>
              <th style={{ textAlign: 'right', padding: 6, borderBottom: '1px solid #e5e7eb' }}>Avg Position</th>
            </tr>
          </thead>
          <tbody>
            {top.map((r, i) => (
              <tr key={i} onClick={() => onSelect && onSelect(r)} style={{ cursor: 'pointer', background: selectedTicker === r.ticker ? '#eef2ff' : 'transparent' }}>
                <td style={{ padding: 6, borderBottom: '1px solid #f3f4f6' }}>{r.ticker}</td>
                <td style={{ padding: 6, borderBottom: '1px solid #f3f4f6' }}>{r.asset_class}</td>
                <td style={{ padding: 6, borderBottom: '1px solid #f3f4f6', textAlign: 'right' }}>{fmtCurrency(r.total_aum)}</td>
                <td style={{ padding: 6, borderBottom: '1px solid #f3f4f6', textAlign: 'right' }}>{r.advisors_using}</td>
                <td style={{ padding: 6, borderBottom: '1px solid #f3f4f6', textAlign: 'right' }}>{r.clients_using}</td>
                <td style={{ padding: 6, borderBottom: '1px solid #f3f4f6', textAlign: 'right' }}>{fmtCurrency(r.avg_position_usd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PaginationControls({ total, page, pageSize, onPageChange }) {
  const totalPages = Math.max(1, Math.ceil((total || 0) / (pageSize || 1)));
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginTop: 8 }}>
      <span style={{ fontSize: 12, color: '#6b7280' }}>Rows: {total}</span>
      <button className="btn btn-secondary" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Prev</button>
      <span style={{ fontSize: 12 }}>Page {page} / {totalPages}</span>
      <button className="btn btn-secondary" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>Next</button>
    </div>
  );
}

function TrendChart({ series, title }) {
  const [w, h, pad] = [800, 260, 40];
  const points = (series || []).map(r => ({ x: new Date(r.snapshot_date).getTime(), y: Number(r.total_aum || 0), adv: r.advisors_using }));
  if (points.length === 0) return (
    <div>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{title}</div>
      <div style={{ color: '#6b7280', fontSize: 12 }}>No trend data.</div>
    </div>
  );
  const minX = Math.min(...points.map(p => p.x));
  const maxX = Math.max(...points.map(p => p.x));
  const maxY = Math.max(1, ...points.map(p => p.y));
  const scaleX = (v) => pad + ((v - minX) / (maxX - minX || 1)) * (w - pad * 2);
  const scaleY = (v) => (h - pad) - (v / (maxY || 1)) * (h - pad * 2);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.x)} ${scaleY(p.y)}`).join(' ');

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{title}</div>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="auto" role="img" aria-label="Adoption trend chart">
        <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="#9ca3af" />
        <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="#9ca3af" />
        <path d={path} fill="none" stroke="#0ea5e9" strokeWidth={2} />
        {points.map((p, i) => (
          <circle key={i} cx={scaleX(p.x)} cy={scaleY(p.y)} r={3} fill="#0ea5e9" />
        ))}
      </svg>
    </div>
  );
}

function Heatmap({ rows }) {
  const byClass = new Map();
  for (const r of rows || []) {
    const ac = r.asset_class || 'Unclassified';
    const cur = byClass.get(ac) || { funds: 0, aum: 0 };
    cur.funds += 1;
    cur.aum += Number(r.total_aum || 0);
    byClass.set(ac, cur);
  }
  const entries = Array.from(byClass.entries()).sort((a, b) => b[1].aum - a[1].aum);
  const maxAum = Math.max(1, ...entries.map(e => e[1].aum));

  return (
    <div>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>Asset Class Heatmap (by total AUM)</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
        {entries.map(([ac, v], i) => (
          <div key={i} className="card" style={{ padding: 10, background: heatColor(v.aum / maxAum) }}>
            <div style={{ fontWeight: 600 }}>{ac}</div>
            <div style={{ fontSize: 12, color: '#111827' }}>Funds: {v.funds}</div>
            <div style={{ fontSize: 12, color: '#111827' }}>AUM: {fmtCurrency(v.aum)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function fmtCurrency(v) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(v || 0));
}

function heatColor(x) {
  // x in [0,1]
  const t = Math.max(0, Math.min(1, x));
  const r = Math.floor(255 * (1 - t*0.2));
  const g = Math.floor(255 * (1 - t*0.6));
  const b = Math.floor(255 * (1 - t));
  return `rgb(${r}, ${g}, ${b})`;
}

function hashColor(s) {
  if (!s) return '#64748b';
  let h = 0; for (let i = 0; i < s.length; i++) h = ((h<<5) - h) + s.charCodeAt(i);
  const hue = Math.abs(h) % 360;
  return `hsl(${hue}, 60%, 60%)`;
}
