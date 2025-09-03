import React, { useEffect, useMemo, useState } from 'react';
import alertsService from '../../services/alertsService.js';
import RulesAdmin from './RulesAdmin.jsx';
import metricsService from '../../services/metricsService.js';
import authService from '../../services/authService.js';

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
  const [afterId, setAfterId] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [assignee, setAssignee] = useState('');
  const [p95, setP95] = useState({});

  // Load alerts for current filters (cursor reset)
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        setLoading(true); setError(null);
        setAfterId(null); setHasMore(false); setSelected(new Set());
        const rows = await alertsService.listAlerts({
          status: filters.status || null,
          severity: filters.severity || null,
          assetClass: filters.assetClass || null,
          minPriority: filters.minPriority || null,
          limit: 200,
          afterId: null
        });
        if (!cancel) {
          setAlerts(rows || []);
          if (rows && rows.length > 0) {
            setAfterId(rows[rows.length - 1].id);
            setHasMore(rows.length === 200);
          }
        }
      } catch (e) {
        if (!cancel) setError(e.message || String(e));
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [filters.status, filters.severity, filters.assetClass, filters.minPriority]);

  async function loadMore() {
    if (!hasMore || loading) return;
    setLoading(true);
    try {
      const rows = await alertsService.listAlerts({
        status: filters.status || null,
        severity: filters.severity || null,
        assetClass: filters.assetClass || null,
        minPriority: filters.minPriority || null,
        limit: 200,
        afterId
      });
      const next = [...alerts, ...(rows || [])];
      setAlerts(next);
      if (rows && rows.length > 0) {
        setAfterId(rows[rows.length - 1].id);
        setHasMore(rows.length === 200);
      } else {
        setHasMore(false);
      }
    } finally {
      setLoading(false);
    }
  }

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
        if (action === 'assign') await alertsService.assignAlert(id, assignee || 'unassigned');
      }
      // Refresh current page
      const rows = await alertsService.listAlerts({
        status: filters.status || null,
        severity: filters.severity || null,
        assetClass: filters.assetClass || null,
        minPriority: filters.minPriority || null,
        limit: 200,
        afterId: null
      });
      setAlerts(rows || []);
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
        limit: 200,
        afterId: null
      });
      setAlerts(rows || []);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setRefreshing(false);
    }
  }

  // Load P95 metrics for key RPCs (admin-only surface)
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const names = ['alerts.list', 'analytics.trend', 'alerts.refresh'];
        const stats = await Promise.all(names.map(n => metricsService.getRpcP95(n)));
        if (!cancel) {
          const m = {};
          for (const s of stats) m[s.name] = s;
          setP95(m);
        }
      } catch {}
    })();
    return () => { cancel = true; };
  }, []);

  return (
    <div className="card" style={{ padding: 16, marginTop: 16 }}>
      <div className="card-header">
        <h2 className="card-title">Command Center</h2>
        <p className="card-subtitle">Prioritized alerts, filters, and audit-able actions</p>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>Presets:</span>
          <button className="btn btn-secondary" onClick={() => setFilters(prev => ({ ...prev, status: 'open', severity: 'critical', minPriority: 50 }))}>Critical Only</button>
          <button className="btn btn-secondary" onClick={() => setFilters(prev => ({ ...prev, status: 'open', severity: '', minPriority: 80 }))}>High Priority</button>
          <button className="btn btn-secondary" onClick={() => setFilters(prev => ({ ...prev, status: 'open', severity: '' }))}>Open</button>
          <button className="btn btn-secondary" onClick={() => setFilters({ status: '', severity: '', assetClass: '', minPriority: null })}>All</button>
        </div>
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
          <input type="text" placeholder="e.g., Large Cap" value={filters.assetClass} onChange={e => setFilters(prev => ({ ...prev, assetClass: e.target.value }))} />
        </div>
        <div>
          <label style={{ fontSize: 12, color: '#6b7280' }}>Min Priority</label><br />
          <input type="number" min={0} max={100} value={filters.minPriority} onChange={e => setFilters(prev => ({ ...prev, minPriority: Number(e.target.value) || 0 }))} style={{ width: 100 }} />
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn" onClick={refreshAlerts} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh Alerts'}</button>
          <button className="btn btn-secondary" onClick={() => exportAlertsCsv(alerts)} title="Export visible to CSV">Export CSV</button>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginTop: 8 }}>{String(error)}</div>}
      {loading && <div style={{ color: '#6b7280', marginTop: 8 }}>Loading…</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr', gap: 12, marginTop: 12 }}>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <input type="checkbox" checked={allSelected} onChange={toggleAll} />
            <button className="btn btn-secondary" onClick={() => doBulk('ack')} disabled={selected.size === 0}>Acknowledge</button>
            <button className="btn" onClick={() => doBulk('resolve')} disabled={selected.size === 0}>Resolve</button>
            <input type="text" placeholder="Assignee" value={assignee} onChange={e => setAssignee(e.target.value)} style={{ marginLeft: 'auto', minWidth: 140 }} />
            <button className="btn btn-secondary" onClick={() => doBulk('assign')} disabled={selected.size === 0 || !assignee}>Assign</button>
          </div>
          <AlertsTable rows={alerts} selected={selected} setSelected={setSelected} onSelectRow={setDetail} />
          <div style={{ marginTop: 8, display: 'flex', justifyContent: 'center' }}>
            {hasMore && (
              <button className="btn" disabled={loading} onClick={loadMore}>
                {loading ? 'Loading…' : 'Load More'}
              </button>
            )}
          </div>
        </div>

        <div className="card" style={{ padding: 12 }}>
          <AlertDetail
            alert={detail}
            actions={detailActions}
            trend={detailTrend}
            loading={detailLoading}
            assignee={assignee}
            onAction={async (type, note) => {
              try {
                if (!detail) return;
                if (type === 'ack') await alertsService.acknowledgeAlert(detail.id, null, note);
                if (type === 'resolve') await alertsService.resolveAlert(detail.id, null, note);
                if (type === 'assign') await alertsService.assignAlert(detail.id, assignee || 'unassigned', null, note);
                const rows = await alertsService.listAlerts({
                  status: filters.status || null,
                  severity: filters.severity || null,
                  assetClass: filters.assetClass || null,
                  minPriority: filters.minPriority || null,
                  limit: 200,
                  afterId: null
                });
                setAlerts(rows || []);
              } catch (e) {
                setError(e.message || String(e));
              }
            }}
          />
        </div>

        {authService?.isAdmin?.() && (
          <div className="card" style={{ padding: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>RPC P95 (7d)</div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {['alerts.list','analytics.trend','alerts.refresh'].map(name => (
                <div key={name} style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: 8, minWidth: 160 }}>
                  <div style={{ color: '#6b7280', fontSize: 12 }}>{name}</div>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>{p95?.[name]?.p95_ms != null ? `${Number(p95[name].p95_ms).toFixed(0)} ms` : '—'}</div>
                  <div style={{ color: '#6b7280', fontSize: 12 }}>n={p95?.[name]?.n || 0}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 12 }}>
        <RulesAdmin />
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
            <th style={{ padding: 6, textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Assigned To</th>
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
              <td style={{ padding: 6, borderBottom: '1px solid #f3f4f6' }}>{r.assigned_to || ''}</td>
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

function AlertDetail({ alert, actions = [], trend = [], loading = false, assignee = '', onAction }) {
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
          <button className="btn btn-secondary" onClick={() => onAction && onAction('assign', note)} style={{ marginLeft: 8 }} disabled={!assignee}>Assign</button>
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
        <KeyValue label="Assigned To" value={alert.assigned_to || '—'} />
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

function exportAlertsCsv(rows) {
  const headers = ['ID','Month','Ticker','Asset Class','Severity','Priority','Status','Title','Summary','Net Flow','Advisors','Assigned To'];
  const lines = [headers.join(',')];
  (rows || []).forEach(r => {
    const vals = [
      r.id,
      r.month,
      r.ticker || '',
      r.asset_class || '',
      r.severity || '',
      r.priority != null ? String(r.priority) : '',
      r.status || '',
      csvSafe(r.title || ''),
      csvSafe(r.summary || ''),
      r.net_flow != null ? String(Number(r.net_flow).toFixed(2)) : '',
      r.advisors_trading != null ? String(r.advisors_trading) : '',
      csvSafe(r.assigned_to || '')
    ];
    lines.push(vals.join(','));
  });
  const bom = '\uFEFF';
  const csv = bom + lines.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `alerts_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function csvSafe(s) {
  const needsQuote = /[",\n]/.test(s);
  let t = String(s).replace(/"/g, '""');
  return needsQuote ? `"${t}"` : t;
}

