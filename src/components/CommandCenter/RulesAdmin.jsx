import React, { useEffect, useState } from 'react';
import alertsService from '../../services/alertsService.js';
import authService from '../../services/authService.js';

export default function RulesAdmin() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ severity_default: 'warning', is_active: true, paramsText: '{}' });
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', description: '', rule_type: 'NET_FLOW_SIGMA', scope: 'ticker', severity_default: 'warning', is_active: true, paramsText: '{\n  "window_months": 12,\n  "sigma_threshold": 2.0\n}' });
  const [inlineError, setInlineError] = useState('');

  const isAdmin = authService?.isAdmin?.() === true;

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        setLoading(true); setError(null);
        const rs = await alertsService.listRules();
        if (!cancel) setRules(rs);
      } catch (e) { if (!cancel) setError(e.message || String(e)); }
      finally { if (!cancel) setLoading(false); }
    })();
    return () => { cancel = true; };
  }, []);

  function startEdit(rule) {
    setEditing(rule);
    setForm({
      severity_default: rule.severity_default || 'warning',
      is_active: !!rule.is_active,
      paramsText: JSON.stringify(rule.params || {}, null, 2)
    });
    setInlineError('');
  }

  async function save() {
    try {
      setInlineError('');
      const params = JSON.parse(form.paramsText || '{}');
      const type = editing.rule_type;
      const err = validateParams(type, params);
      if (err) { setInlineError(err); return; }
      if (editing.severity_default === 'critical' && editing.is_active !== form.is_active) {
        const proceed = window.confirm('This is a high-impact (critical) rule. Confirm change to Active state.');
        if (!proceed) return;
      }
      const patch = { severity_default: form.severity_default, is_active: form.is_active, params };
      await alertsService.updateRule(editing.id, patch);
      const rs = await alertsService.listRules();
      setRules(rs); setEditing(null);
    } catch (e) { setError(e.message || String(e)); }
  }

  return (
    <div className="card" style={{ padding: 12 }}>
      <div className="card-header">
        <h3 className="card-title">Rules Admin (MVP)</h3>
        <p className="card-subtitle">Toggle rules and adjust parameters</p>
      </div>
      {loading && <div style={{ color: '#6b7280' }}>Loading…</div>}
      {error && <div className="alert alert-error">{error}</div>}
      <div style={{ overflowX: 'auto', marginTop: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid #e5e7eb' }}>ID</th>
              <th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid #e5e7eb' }}>Name</th>
              <th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid #e5e7eb' }}>Type</th>
              <th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid #e5e7eb' }}>Severity</th>
              <th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid #e5e7eb' }}>Active</th>
              <th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid #e5e7eb' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(rules || []).map(r => (
              <tr key={r.id}>
                <td style={{ padding: 6, borderBottom: '1px solid #f3f4f6' }}>{r.id}</td>
                <td style={{ padding: 6, borderBottom: '1px solid #f3f4f6' }}>{r.name}</td>
                <td style={{ padding: 6, borderBottom: '1px solid #f3f4f6' }}>{r.rule_type}</td>
                <td style={{ padding: 6, borderBottom: '1px solid #f3f4f6' }}>{r.severity_default}</td>
                <td style={{ padding: 6, borderBottom: '1px solid #f3f4f6' }}>{r.is_active ? 'Yes' : 'No'}</td>
                <td style={{ padding: 6, borderBottom: '1px solid #f3f4f6' }}>
                  <button className="btn btn-secondary" onClick={() => startEdit(r)}>Edit</button>
                  <button className="btn" style={{ marginLeft: 6 }} onClick={async () => {
                    if (!window.confirm(`Delete rule "${r.name}"? This removes related alerts on cascade.`)) return;
                    try {
                      await alertsService.deleteRule(r.id);
                      const rs = await alertsService.listRules();
                      setRules(rs);
                    } catch (e) { setError(e.message || String(e)); }
                  }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Rule */}
      {!isAdmin && (
        <div className="alert alert-error" style={{ marginTop: 8 }}>
          Admins only: You do not have permission to manage alert rules.
        </div>
      )}

      <div className="card" style={{ padding: 12, marginTop: 12, opacity: isAdmin ? 1 : 0.6, pointerEvents: isAdmin ? 'auto' : 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Add Rule</div>
          <div style={{ marginLeft: 'auto' }}>
            <button className="btn" onClick={() => setAdding(a => !a)}>{adding ? 'Hide' : 'Show'}</button>
          </div>
        </div>
        {adding && (
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: '#6b7280' }}>Name</label>
                <input type="text" value={addForm.name} onChange={e => setAddForm(prev => ({ ...prev, name: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#6b7280' }}>Type</label>
                <select value={addForm.rule_type} onChange={e => setAddForm(prev => ({ ...prev, rule_type: e.target.value }))}>
                  {['NET_FLOW_SIGMA','ADVISOR_SPIKE_RATIO','REDEMPTION_STREAK'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#6b7280' }}>Scope</label>
                <select value={addForm.scope} onChange={e => setAddForm(prev => ({ ...prev, scope: e.target.value }))}>
                  {['ticker','asset_class','global'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#6b7280' }}>Severity</label>
                <select value={addForm.severity_default} onChange={e => setAddForm(prev => ({ ...prev, severity_default: e.target.value }))}>
                  {['critical','warning','info'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#6b7280' }}>Active</label>
                <input type="checkbox" checked={addForm.is_active} onChange={e => setAddForm(prev => ({ ...prev, is_active: e.target.checked }))} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#6b7280' }}>Description (optional)</label>
                <input type="text" value={addForm.description} onChange={e => setAddForm(prev => ({ ...prev, description: e.target.value }))} />
              </div>
            </div>
            <div style={{ marginTop: 8 }}>
              <label style={{ fontSize: 12, color: '#6b7280' }}>Params (JSON)</label>
              <textarea rows={8} style={{ width: '100%', fontFamily: 'monospace' }} value={addForm.paramsText} onChange={e => setAddForm(prev => ({ ...prev, paramsText: e.target.value }))} />
            </div>
            <div style={{ marginTop: 8 }}>
              <button className="btn" onClick={async () => {
                try {
                  setInlineError('');
                  const params = JSON.parse(addForm.paramsText || '{}');
                  const err = validateParams(addForm.rule_type, params);
                  if (err) { setInlineError(err); return; }
                  if (!addForm.name || !addForm.rule_type) throw new Error('Name and type are required');
                  await alertsService.createRule({
                    name: addForm.name,
                    description: addForm.description,
                    rule_type: addForm.rule_type,
                    scope: addForm.scope,
                    severity_default: addForm.severity_default,
                    is_active: addForm.is_active,
                    params
                  });
                  const rs = await alertsService.listRules();
                  setRules(rs); setAdding(false);
                } catch (e) { setError(e.message || String(e)); }
              }}>Create Rule</button>
            </div>
          </div>
        )}
      </div>
      {editing && (
        <div className="card" style={{ padding: 12, marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Edit Rule: {editing.name}</div>
            <div style={{ marginLeft: 'auto' }}>
              <button className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn" style={{ marginLeft: 6 }} onClick={save}>Save</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
            <div>
              <label style={{ fontSize: 12, color: '#6b7280' }}>Severity</label><br />
              <select value={form.severity_default} onChange={e => setForm(prev => ({ ...prev, severity_default: e.target.value }))}>
                {['critical','warning','info'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#6b7280' }}>Active</label><br />
              <input type="checkbox" checked={form.is_active} onChange={e => setForm(prev => ({ ...prev, is_active: e.target.checked }))} />
            </div>
          </div>
          <div style={{ marginTop: 8 }}>
            <label style={{ fontSize: 12, color: '#6b7280' }}>Params (JSON)</label>
            <textarea rows={10} style={{ width: '100%', fontFamily: 'monospace' }} value={form.paramsText} onChange={e => setForm(prev => ({ ...prev, paramsText: e.target.value }))} />
            {inlineError && <div className="alert alert-error" style={{ marginTop: 6 }}>{inlineError}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function validateParams(type, params) {
  try {
    if (type === 'NET_FLOW_SIGMA') {
      const wm = Number(params.window_months ?? 12);
      const st = Number(params.sigma_threshold ?? 2.0);
      if (!Number.isFinite(wm) || wm < 3) return 'window_months must be an integer >= 3';
      if (!Number.isFinite(st) || st < 1 || st > 5) return 'sigma_threshold must be between 1 and 5';
    } else if (type === 'ADVISOR_SPIKE_RATIO') {
      const wm = Number(params.window_months ?? 6);
      const mr = Number(params.min_ratio ?? 1.5);
      const ma = Number(params.min_advisors ?? 5);
      if (!Number.isFinite(wm) || wm < 3) return 'window_months must be an integer >= 3';
      if (!Number.isFinite(mr) || mr < 1) return 'min_ratio must be >= 1';
      if (!Number.isFinite(ma) || ma < 1) return 'min_advisors must be >= 1';
    } else if (type === 'REDEMPTION_STREAK') {
      const sm = Number(params.streak_months ?? 3);
      const mto = Number(params.min_total_outflow ?? 1000000);
      if (!Number.isFinite(sm) || sm < 2) return 'streak_months must be >= 2';
      if (!Number.isFinite(mto) || mto < 0) return 'min_total_outflow must be >= 0';
    }
    return '';
  } catch (e) {
    return e?.message || 'Invalid parameters';
  }
}
