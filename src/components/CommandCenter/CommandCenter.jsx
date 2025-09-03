import React, { useEffect, useMemo, useState } from 'react';
import alertsService from '../../services/alertsService.js';
import RulesAdmin from './RulesAdmin.jsx';

export default function CommandCenter() {
  const [filters, setFilters] = useState({ status: 'open', severity: '', assetClass: '', minPriority: 50 });
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [detail, setDetail] = useState(null);
  const [detailActions, setDetailActions] = useState([]);
  const [detailTrend, setDetailTrend] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        setLoading(true); setError(null);
        const rows = await alertsService.listAlerts({
          status: filters.status || null,
          severity: filters.severity || null,
          assetClass: filters.assetClass || null,
          minPriority: filters.minPriority || null,
          limit: 200
        });
        if (!cancel) setAlerts(rows);
      } catch (e) {
        if (!cancel) setError(e.message || String(e));
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [filters.status, filters.severity, filters.assetClass, filters.minPriority]);

  // Load audit actions and trend analytics for selected alert
  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!detail) { setDetailActions([]); setDetailTrend([]); return; }
      try {
        setDetailLoading(true);
        const [actions, trend] = await Promise.all([
          alertsService.getAlertActions(detail.id),
          alertsService.getTrendAnalytics({ ticker: detail.ticker, windows: [3,6,12], month: detail.month })
        ]);
        if (!cancel) { setDetailActions(actions || []); setDetailTrend(trend || []); }
      } catch {
        if (!cancel) { setDetailActions([]); setDetailTrend([]); }
      } finally {
        if (!cancel) setDetailLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [detail]);

  const allSelected = useMemo(() => alerts.length > 0 && alerts.every(a => selected.has(a.id)), [alerts, selected]);

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(alerts.map(a => a.id)));
  }

  async function doBulk(action) {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    try {
      for (const id of ids) {
        if (action === 'ack') await alertsService.acknowledgeAlert(id);
        if (action === 'resolve') await alertsService.resolveAlert(id);
      }
      // Refresh
      const rows = await alertsService.listAlerts({
        status: filters.status || null,
        severity: filters.severity || null,
        assetClass: filters.assetClass || null,
        minPriority: filters.minPriority || null,
        limit: 200
      });
      setAlerts(rows);
      setSelected(new Set());
    } catch (e) {
      setError(e.message || String(e));
    }
  }

  async function refreshAlerts() {
    try {
      setRefreshing(true);
      await alertsService.refreshAlertsForMonth(null);
      const rows = await alertsService.listAlerts({
        status: filters.status || null,
        severity: filters.severity || null,
        assetClass: filters.assetClass || null,
        minPriority: filters.minPriority || null,
        limit: 200
      });
      setAlerts(rows);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="card" style={{ padding: 16, marginTop: 16 }}>
      <div className="card-header">
        <h2 className="card-title">Command Center</h2>
        <p className="card-subtitle">Prioritized alerts, filters, and audit-able actions</p>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
        <div>
          <label style={{ fontSize: 12, color: '#6b7280' }}>Status</label><br />
          <select value={filters.status} onChange={e => setFilters(prev => ({ ...prev, status: e.target.value }))}>
            {['open','acknowledged','resolved',''].map(s => <option key={s || 'any'} value={s}>{s || 'Any'}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, color: '#6b7280' }}>Severity</label><br />
          <select value={filters.severity} onChange={e => setFilters(prev => ({ ...prev, severity: e.target.value }))}>
            {['critical','warning','info',''].map(s => <option key={s || 'any'} value={s}>{s || 'Any'}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, color: '#6b7280' }}>Asset Class</label><br />
          <input type="text" placeholder="e.g., Large Cap" value={filters.assetClass}
            onChange={e => setFilters(prev => ({ ...prev, assetClass: e.target.value }))} />
        </div>
        <div>
          <label style={{ fontSize: 12, color: '#6b7280' }}>Min Priority</label><br />
          <input type="number" min={0} max={100} value={filters.minPriority}
            onChange={e => setFilters(prev => ({ ...prev, minPriority: Number(e.target.value) }))} style={{ width: 100 }} />
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <button className="btn" onClick={refreshAlerts} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh Alerts'}</button>
        </div>
      </div>

      {loading && <div style={{ color: '#6b7280', marginTop: 8 }}>Loading…</div>}
      {error && <div className="alert alert-error" style={{ marginTop: 8 }}>{error}</div>}

      <div className="grid-2" style={{ marginTop: 12 }}>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <input type="checkbox" checked={allSelected} onChange={toggleAll} />
            <button className="btn btn-secondary" onClick={() => doBulk('ack')} disabled={selected.size === 0}>Acknowledge</button>
            <button className="btn" onClick={() => doBulk('resolve')} disabled={selected.size === 0} style={{ marginLeft: 6 }}>Resolve</button>
          </div>
          <AlertsTable rows={alerts} selected={selected} setSelected={setSelected} onSelectRow={setDetail} />
        </div>

        <div className="card" style={{ padding: 12 }}>
          <AlertDetail alert={detail} actions={detailActions} trend={detailTrend} loading={detailLoading} onAction={async (type, note) => {
            try {
              if (!detail) return;
              if (type === 'ack') await alertsService.acknowledgeAlert(detail.id, null, note);
              if (type === 'resolve') await alertsService.resolveAlert(detail.id, null, note);
              const rows = await alertsService.listAlerts({
                status: filters.status || null,
                severity: filters.severity || null,
                assetClass: filters.assetClass || null,
                minPriority: filters.minPriority || null,
                limit: 200
              });
              setAlerts(rows);
            } catch (e) {
              setError(e.message || String(e));
            }
          }} />
        </div>
      </div>
    </div>
  );
}

function AlertsTable({ rows, selected, setSelected, onSelectRow }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ padding: 6, textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}></th>
            <th style={{ padding: 6, textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Priority</th>
            <th style={{ padding: 6, textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Severity</th>
            <th style={{ padding: 6, textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Month</th>
            <th style={{ padding: 6, textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Ticker</th>
            <th style={{ padding: 6, textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Asset Class</th>
            <th style={{ padding: 6, textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Title</th>
            <th style={{ padding: 6, textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Net Flow</th>
            <th style={{ padding: 6, textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Advisors</th>
          </tr>
        </thead>
        <tbody>
          {(rows || []).map((r) => (
            <tr key={r.id} onClick={() => onSelectRow(r)} style={{ cursor: 'pointer', background: selected.has(r.id) ? '#f3f4f6' : 'transparent' }}>
              <td style={{ padding: 6, borderBottom: '1px solid #f3f4f6' }} onClick={(e) => e.stopPropagation()}>
                <input type="checkbox" checked={selected.has(r.id)} onChange={(e) => {
                  const next = new Set(selected);
                  if (e.target.checked) next.add(r.id); else next.delete(r.id);
                  setSelected(next);
                }} />
              </td>
              <td style={{ padding: 6, borderBottom: '1px solid #f3f4f6', fontWeight: 600 }}>{r.priority}</td>
              <td style={{ padding: 6, borderBottom: '1px solid #f3f4f6', color: sevColor(r.severity) }}>{r.severity}</td>
              <td style={{ padding: 6, borderBottom: '1px solid #f3f4f6' }}>{r.month}</td>
              <td style={{ padding: 6, borderBottom: '1px solid #f3f4f6' }}>{r.ticker}</td>
              <td style={{ padding: 6, borderBottom: '1px solid #f3f4f6' }}>{r.asset_class}</td>
              <td style={{ padding: 6, borderBottom: '1px solid #f3f4f6' }}>{r.title}</td>
              <td style={{ padding: 6, borderBottom: '1px solid #f3f4f6', textAlign: 'right' }}>{fmtCurrency(r.net_flow)}</td>
              <td style={{ padding: 6, borderBottom: '1px solid #f3f4f6', textAlign: 'right' }}>{r.advisors_trading}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {(!rows || rows.length === 0) && (
        <div style={{ color: '#6b7280', padding: 8 }}>No alerts match the filters.</div>
      )}
    </div>
  );
}

function AlertDetail({ alert, actions = [], trend = [], loading = false, onAction }) {
  const [note, setNote] = useState('');
  if (!alert) return <div style={{ color: '#6b7280' }}>Select an alert to review details and take actions.</div>;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{alert.title}</div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>{alert.summary}</div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <button className="btn btn-secondary" onClick={() => onAction && onAction('ack', note)}>Acknowledge</button>
          <button className="btn" onClick={() => onAction && onAction('resolve', note)} style={{ marginLeft: 8 }}>Resolve</button>
          <button className="btn btn-secondary" style={{ marginLeft: 8 }} onClick={() => {
            try {
              window.dispatchEvent(new CustomEvent('NAVIGATE_APP', { detail: { tab: 'flows' } }));
              setTimeout(() => {
                try {
                  window.dispatchEvent(new CustomEvent('NAVIGATE_FLOWS', { detail: { month: alert.month, ticker: alert.ticker } }));
                } catch {}
              }, 100);
            } catch {}
          }}>Open in Flows</button>
        </div>
      </div>
      <div style={{ marginTop: 8 }}>
        <KeyValue label="Month" value={alert.month} />
        <KeyValue label="Ticker" value={alert.ticker} />
        <KeyValue label="Asset Class" value={alert.asset_class} />
        <KeyValue label="Severity" value={alert.severity} />
        <KeyValue label="Priority" value={alert.priority} />
        <KeyValue label="Net Flow" value={fmtCurrency(alert.net_flow)} />
        <KeyValue label="Advisors Trading" value={String(alert.advisors_trading || 0)} />
      </div>
      <div style={{ marginTop: 8 }}>
        <label style={{ fontSize: 12, color: '#6b7280' }}>Action Note (optional)</label>
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} style={{ width: '100%' }} placeholder="Add a comment for the audit log" />
      </div>
      <div style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Audit Log</div>
        {loading && <div style={{ color: '#6b7280' }}>Loading…</div>}
        {(!loading && actions.length === 0) ? (
          <div style={{ color: '#6b7280' }}>No actions yet.</div>
        ) : (
          <div style={{ maxHeight: 160, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 6 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid #e5e7eb' }}>Time</th>
                  <th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid #e5e7eb' }}>Action</th>
                  <th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid #e5e7eb' }}>Actor</th>
                  <th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid #e5e7eb' }}>Note</th>
                </tr>
              </thead>
              <tbody>
                {(actions || []).map((a) => (
                  <tr key={a.id}>
                    <td style={{ padding: 6, borderBottom: '1px solid #f3f4f6' }}>{new Date(a.created_at).toLocaleString()}</td>
                    <td style={{ padding: 6, borderBottom: '1px solid #f3f4f6' }}>{a.action}</td>
                    <td style={{ padding: 6, borderBottom: '1px solid #f3f4f6' }}>{a.actor || '-'}</td>
                    <td style={{ padding: 6, borderBottom: '1px solid #f3f4f6' }}>{a.note || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Trend Analytics (3/6/12M)</div>
        {loading && <div style={{ color: '#6b7280' }}>Loading…</div>}
        {(!loading && trend.length === 0) ? (
          <div style={{ color: '#6b7280' }}>No trend data.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid #e5e7eb' }}>Window</th>
                <th style={{ textAlign: 'right', padding: 6, borderBottom: '1px solid #e5e7eb' }}>Net Flow Sum</th>
                <th style={{ textAlign: 'right', padding: 6, borderBottom: '1px solid #e5e7eb' }}>Advisors StdDev</th>
              </tr>
            </thead>
            <tbody>
              {(trend || []).map((t, i) => (
                <tr key={i}>
                  <td style={{ padding: 6, borderBottom: '1px solid #f3f4f6' }}>{t.window_months}M</td>
                  <td style={{ padding: 6, borderBottom: '1px solid #f3f4f6', textAlign: 'right' }}>{fmtCurrency(t.net_flow_sum)}</td>
                  <td style={{ padding: 6, borderBottom: '1px solid #f3f4f6', textAlign: 'right' }}>{Number(t.advisors_trading_stddev || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div style={{ marginTop: 12 }}>
        <RulesAdmin />
      </div>
    </div>
  );
}

function KeyValue({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 8, fontSize: 13, marginBottom: 4 }}>
      <div style={{ width: 140, color: '#6b7280' }}>{label}</div>
      <div>{value}</div>
    </div>
  );
}

function fmtCurrency(v) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(v || 0));
}

function sevColor(s) {
  if (s === 'critical') return '#7f1d1d';
  if (s === 'warning') return '#92400e';
  return '#1f2937';
}
