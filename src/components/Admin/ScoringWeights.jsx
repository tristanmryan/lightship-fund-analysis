// src/components/Admin/ScoringWeights.jsx
import React, { useEffect, useMemo, useState } from 'react';
import scoringProfilesService from '../../services/scoringProfilesService';
import { buildWeightsResolver } from '../../services/resolvers/scoringWeightsResolver';
import { computeRuntimeScores } from '../../services/scoring';

const METRICS = [
  { key: 'ytd', label: 'YTD Return' },
  { key: 'oneYear', label: '1-Year Return' },
  { key: 'threeYear', label: '3-Year Return' },
  { key: 'fiveYear', label: '5-Year Return' },
  { key: 'tenYear', label: '10-Year Return' },
  { key: 'sharpeRatio3Y', label: '3Y Sharpe Ratio' },
  { key: 'stdDev3Y', label: '3Y Std Deviation' },
  { key: 'stdDev5Y', label: '5Y Std Deviation' },
  { key: 'upCapture3Y', label: '3Y Up Capture' },
  { key: 'downCapture3Y', label: '3Y Down Capture' },
  { key: 'alpha5Y', label: '5Y Alpha' },
  { key: 'expenseRatio', label: 'Expense Ratio' },
  { key: 'managerTenure', label: 'Manager Tenure' }
];

export default function ScoringWeights({ funds = [] }) {
  const [profiles, setProfiles] = useState([]);
  const [activeProfileId, setActiveProfileId] = useState('');
  const [weights, setWeights] = useState([]); // full rows
  const [tab, setTab] = useState('global'); // global | class | fund | preview
  const [assetClass, setAssetClass] = useState('');
  const [fundSearch, setFundSearch] = useState('');
  const [selected, setSelected] = useState([]); // preview funds
  const assetClasses = useMemo(() => Array.from(new Set((funds || []).map(f => f.asset_class_name || f.asset_class).filter(Boolean))).sort(), [funds]);

  useEffect(() => {
    (async () => {
      const profs = await scoringProfilesService.listProfiles();
      setProfiles(profs || []);
      const def = (profs || []).find(p => p.is_default) || (profs || [])[0] || null;
      if (def?.id) {
        setActiveProfileId(def.id);
        const rows = await scoringProfilesService.listWeights(def.id);
        setWeights(rows || []);
      }
    })();
  }, []);

  async function handleProfileChange(id) {
    setActiveProfileId(id);
    const rows = await scoringProfilesService.listWeights(id);
    setWeights(rows || []);
  }

  function getGlobalWeight(metric) {
    const row = (weights || []).find(w => w.metric_key === metric && w.scope === 'global' && (w.scope_value == null));
    return row ? Number(row.weight) : '';
  }

  async function setGlobalWeight(metric, value) {
    if (!activeProfileId) return;
    const weight = Number(value);
    if (!Number.isFinite(weight)) return;
    const row = await scoringProfilesService.upsertWeight({ profile_id: activeProfileId, metric_key: metric, scope: 'global', scope_value: null, weight, enabled: true });
    const next = (weights || []).filter(w => !(w.metric_key === metric && w.scope === 'global' && (w.scope_value == null)));
    setWeights([...next, row]);
  }

  async function upsertOverride(scope, scope_value, metric, value, enabled = true) {
    if (!activeProfileId) return;
    const weight = Number(value);
    if (!Number.isFinite(weight)) return;
    const row = await scoringProfilesService.upsertWeight({ profile_id: activeProfileId, metric_key: metric, scope, scope_value, weight, enabled });
    const next = (weights || []).filter(w => !(w.metric_key === metric && w.scope === scope && (String(w.scope_value || '') === String(scope_value || ''))));
    setWeights([...next, row]);
  }

  async function removeOverride(scope, scope_value, metric) {
    if (!activeProfileId) return;
    await scoringProfilesService.deleteWeight({ profile_id: activeProfileId, metric_key: metric, scope, scope_value });
    const next = (weights || []).filter(w => !(w.metric_key === metric && w.scope === scope && (String(w.scope_value || '') === String(scope_value || ''))));
    setWeights(next);
  }

  const filteredFunds = useMemo(() => {
    const needle = fundSearch.trim().toLowerCase();
    return (funds || []).filter(f => {
      if (assetClass && (f.asset_class_name || f.asset_class) !== assetClass) return false;
      if (!needle) return true;
      const t = (f.ticker || f.Symbol || '').toLowerCase();
      const n = (f.name || f['Fund Name'] || '').toLowerCase();
      return t.includes(needle) || n.includes(needle);
    });
  }, [funds, assetClass, fundSearch]);

  const previewScores = useMemo(() => {
    if (tab !== 'preview' || selected.length === 0) return [];
    try {
      return computeRuntimeScores(selected);
    } catch { return []; }
  }, [selected, tab]);

  const classOverrides = useMemo(() => (weights || []).filter(w => w.scope === 'asset_class'), [weights]);
  const fundOverrides = useMemo(() => (weights || []).filter(w => w.scope === 'fund'), [weights]);

  return (
    <div className="card" style={{ padding: 16, marginTop: 16 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <strong>Scoring Weights</strong>
        <span style={{ color: '#6b7280' }}>Active profile:</span>
        <select value={activeProfileId} onChange={e => handleProfileChange(e.target.value)}>
          {(profiles || []).map(p => (
            <option key={p.id} value={p.id}>{p.name}{p.is_default ? ' (default)' : ''}</option>
          ))}
        </select>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {['global','class','fund','preview'].map(k => (
            <button key={k} className={`btn ${tab===k?'btn-primary':'btn-secondary'}`} onClick={() => setTab(k)}>{k.charAt(0).toUpperCase()+k.slice(1)}</button>
          ))}
        </div>
      </div>

      {tab === 'global' && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: 8 }}>Metric</th>
                <th style={{ textAlign: 'left', padding: 8 }}>Weight</th>
              </tr>
            </thead>
            <tbody>
              {METRICS.map(m => (
                <tr key={m.key}>
                  <td style={{ padding: 8 }}>{m.label}</td>
                  <td style={{ padding: 8 }}>
                    <input
                      type="number"
                      step="0.001"
                      value={getGlobalWeight(m.key)}
                      onChange={(e) => setGlobalWeight(m.key, e.target.value)}
                      style={{ width: 120 }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'class' && (
        <div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <span>Asset Class:</span>
            <select value={assetClass} onChange={e => setAssetClass(e.target.value)}>
              <option value="">Choose…</option>
              {assetClasses.map(ac => <option key={ac} value={ac}>{ac}</option>)}
            </select>
          </div>
          {assetClass && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr><th style={{ textAlign: 'left', padding: 8 }}>Metric</th><th style={{ textAlign: 'left', padding: 8 }}>Weight</th><th style={{ padding: 8 }}>Actions</th></tr>
                </thead>
                <tbody>
                  {METRICS.map(m => {
                    const existing = (weights || []).find(w => w.scope==='asset_class' && w.metric_key===m.key && String(w.scope_value||'')===String(assetClass));
                    return (
                      <tr key={m.key}>
                        <td style={{ padding: 8 }}>{m.label}</td>
                        <td style={{ padding: 8 }}>
                          <input type="number" step="0.001" defaultValue={existing? Number(existing.weight) : ''} onBlur={(e) => upsertOverride('asset_class', assetClass, m.key, e.target.value, true)} style={{ width: 120 }} />
                        </td>
                        <td style={{ padding: 8 }}>
                          {existing && (
                            <button className="btn btn-secondary" onClick={() => removeOverride('asset_class', assetClass, m.key)}>Remove</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'fund' && (
        <div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <input placeholder="Search ticker or name" value={fundSearch} onChange={e => setFundSearch(e.target.value)} style={{ padding: 6, border: '1px solid #e5e7eb', borderRadius: 6 }} />
          </div>
          <div style={{ maxHeight: 260, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 6 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={{ textAlign: 'left', padding: 8 }}>Fund</th><th style={{ textAlign: 'left', padding: 8 }}>Metric</th><th style={{ textAlign: 'left', padding: 8 }}>Weight</th><th style={{ padding: 8 }}>Actions</th></tr></thead>
              <tbody>
                {filteredFunds.slice(0, 50).map(f => (
                  METRICS.map(m => {
                    const existing = (weights || []).find(w => w.scope==='fund' && w.metric_key===m.key && String(w.scope_value||'') === String((f.ticker || f.Symbol || '').toUpperCase()));
                    return (
                      <tr key={(f.ticker||f.Symbol)+m.key}>
                        <td style={{ padding: 8 }}><strong>{f.ticker || f.Symbol}</strong> <span style={{ color:'#6b7280' }}>{f.name || f['Fund Name']}</span></td>
                        <td style={{ padding: 8 }}>{m.label}</td>
                        <td style={{ padding: 8 }}>
                          <input type="number" step="0.001" defaultValue={existing? Number(existing.weight) : ''} onBlur={(e) => upsertOverride('fund', f.ticker || f.Symbol, m.key, e.target.value, true)} style={{ width: 120 }} />
                        </td>
                        <td style={{ padding: 8 }}>
                          {existing && (
                            <button className="btn btn-secondary" onClick={() => removeOverride('fund', f.ticker || f.Symbol, m.key)}>Remove</button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'preview' && (
        <div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
            <span>Asset Class:</span>
            <select value={assetClass} onChange={e => setAssetClass(e.target.value)}>
              <option value="">Any</option>
              {assetClasses.map(ac => <option key={ac} value={ac}>{ac}</option>)}
            </select>
            <input placeholder="Search fund..." value={fundSearch} onChange={e => setFundSearch(e.target.value)} style={{ padding: 6, border: '1px solid #e5e7eb', borderRadius: 6 }} />
            <button className="btn btn-secondary" onClick={async () => { await buildWeightsResolver(); }}>Refresh Weights</button>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {filteredFunds.slice(0, 12).map(f => (
              <button key={f.ticker || f.Symbol} className={`btn ${selected.find(s => (s.ticker||s.Symbol) === (f.ticker||f.Symbol)) ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSelected(prev => {
                const exists = prev.find(s => (s.ticker||s.Symbol) === (f.ticker||f.Symbol));
                if (exists) return prev.filter(s => (s.ticker||s.Symbol)!==(f.ticker||f.Symbol));
                const next = [...prev, f];
                return next.slice(0,4);
              })}>
                {(f.ticker || f.Symbol)}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 12 }}>
            {selected.length === 0 ? <div style={{ color:'#6b7280' }}>Select up to 4 funds to preview scores.</div> : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={{ textAlign: 'left', padding: 8 }}>Ticker</th><th style={{ textAlign: 'left', padding: 8 }}>Name</th><th style={{ padding: 8 }}>Score</th></tr></thead>
                <tbody>
                  {previewScores.map(f => (
                    <tr key={f.ticker || f.Symbol}>
                      <td style={{ padding: 8 }}><strong>{f.ticker || f.Symbol}</strong></td>
                      <td style={{ padding: 8 }}>{f.name || f['Fund Name'] || '—'}</td>
                      <td style={{ padding: 8 }}>{f.scores?.final?.toFixed(1) || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

