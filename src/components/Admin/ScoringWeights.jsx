// src/components/Admin/ScoringWeights.jsx
import React, { useEffect, useMemo, useState } from 'react';
import scoringProfilesService from '../../services/scoringProfilesService';
import { computeRuntimeScores, DEFAULT_WEIGHTS, calculateScores } from '../../services/scoring.js';

const METRICS = [
  { key: 'ytd', label: 'YTD Return' },
  { key: 'oneYear', label: '1-Year Return' },
  { key: 'oneYearDeltaVsBench', label: '1Y vs Benchmark (delta)' },
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
  const [weights, setWeights] = useState([]); // saved rows (from DB)
  const [staged, setStaged] = useState({ global: {}, class: {}, fund: {} }); // unsaved overlay
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
    setStaged({ global: {}, class: {}, fund: {} });
  }

  function getGlobalWeight(metric) {
    const stagedVal = staged.global?.[metric];
    if (stagedVal !== undefined) return stagedVal;
    const row = (weights || []).find(w => w.metric_key === metric && w.scope === 'global' && (w.scope_value == null));
    return row ? Number(row.weight) : '';
  }

  function stageGlobalWeight(metric, value) {
    const n = Number(value);
    setStaged(prev => ({ ...prev, global: { ...(prev.global || {}), [metric]: Number.isFinite(n) ? n : '' } }));
  }

  async function saveGlobalWeight(metric) {
    if (!activeProfileId) return;
    const weight = Number(staged.global?.[metric]);
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

  // Build a temporary resolver from saved rows overlaid with staged edits
  function buildOverlayResolver() {
    const combined = [...(weights || [])];
    // Global overlay
    Object.entries(staged.global || {}).forEach(([metric_key, weight]) => {
      if (weight === '' || weight === undefined) return;
      combined.push({ scope: 'global', scope_value: null, metric_key, weight: Number(weight), enabled: true });
    });
    // Class overlay
    Object.entries(staged.class || {}).forEach(([ac, m]) => {
      Object.entries(m || {}).forEach(([metric_key, weight]) => {
        if (weight === '' || weight === undefined) return;
        combined.push({ scope: 'asset_class', scope_value: ac, metric_key, weight: Number(weight), enabled: true });
      });
    });
    // Fund overlay
    Object.entries(staged.fund || {}).forEach(([ticker, m]) => {
      Object.entries(m || {}).forEach(([metric_key, weight]) => {
        if (weight === '' || weight === undefined) return;
        combined.push({ scope: 'fund', scope_value: ticker, metric_key, weight: Number(weight), enabled: true });
      });
    });

    const global = new Map();
    const byClass = new Map();
    const byFund = new Map();
    for (const r of combined) {
      if (!r?.enabled) continue;
      const metric = String(r.metric_key);
      const w = Number(r.weight);
      if (!Number.isFinite(w)) continue;
      if (r.scope === 'global') {
        global.set(metric, w);
      } else if (r.scope === 'asset_class') {
        const key = `${r.scope_value}::${metric}`;
        byClass.set(key, w);
      } else if (r.scope === 'fund') {
        const key = `${String(r.scope_value || '').toUpperCase()}::${metric}`;
        byFund.set(key, w);
      }
    }
    function getWeightFor(fund, metricKey) {
      const ticker = String(fund?.ticker || fund?.Symbol || '').toUpperCase();
      const ac = fund?.asset_class_name || fund?.asset_class || fund?.['Asset Class'] || '';
      const fk = ticker ? `${ticker}::${metricKey}` : null;
      if (fk && byFund.has(fk)) return byFund.get(fk);
      const ck = ac ? `${ac}::${metricKey}` : null;
      if (ck && byClass.has(ck)) return byClass.get(ck);
      if (global.has(metricKey)) return global.get(metricKey);
      return DEFAULT_WEIGHTS[metricKey];
    }
    return { getWeightFor };
  }

  const previewScores = useMemo(() => {
    if (tab !== 'preview' || selected.length === 0) return [];
    try {
      const resolver = buildOverlayResolver();
      return calculateScores(selected, resolver);
    } catch { return []; }
  }, [selected, tab, staged, weights]);

  const classOverrides = useMemo(() => (weights || []).filter(w => w.scope === 'asset_class'), [weights]);
  const fundOverrides = useMemo(() => (weights || []).filter(w => w.scope === 'fund'), [weights]);

  function sumEnabledWeights(scope) {
    if (scope === 'global') {
      let sum = 0;
      METRICS.forEach(m => {
        const v = staged.global?.[m.key];
        if (v !== undefined && v !== '') sum += Number(v);
        else {
          const row = (weights || []).find(w => w.scope==='global' && w.metric_key===m.key && (w.scope_value==null));
          if (row) sum += Number(row.weight) || 0;
        }
      });
      return sum;
    }
    if (scope === 'class') {
      if (!assetClass) return 0;
      let sum = 0;
      METRICS.forEach(m => {
        const stagedRow = staged.class?.[assetClass]?.[m.key];
        if (stagedRow !== undefined && stagedRow !== '') sum += Number(stagedRow);
        else {
          const row = (weights || []).find(w => w.scope==='asset_class' && w.metric_key===m.key && String(w.scope_value||'')===String(assetClass));
          if (row) sum += Number(row.weight) || 0;
        }
      });
      return sum;
    }
    if (scope === 'fund') {
      const lone = filteredFunds.length === 1 ? (filteredFunds[0].ticker || filteredFunds[0].Symbol) : null;
      if (!lone) return 0;
      let sum = 0;
      METRICS.forEach(m => {
        const stagedRow = staged.fund?.[lone]?.[m.key];
        if (stagedRow !== undefined && stagedRow !== '') sum += Number(stagedRow);
        else {
          const row = (weights || []).find(w => w.scope==='fund' && w.metric_key===m.key && String(w.scope_value||'').toUpperCase()===String(lone).toUpperCase());
          if (row) sum += Number(row.weight) || 0;
        }
      });
      return sum;
    }
    return 0;
  }

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
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ color: '#6b7280' }}>
            Enabled weight sum: {tab==='global' ? sumEnabledWeights('global').toFixed(3) : tab==='class' ? (assetClass ? sumEnabledWeights('class').toFixed(3) : 'â€”') : tab==='fund' ? (filteredFunds.length===1 ? sumEnabledWeights('fund').toFixed(3) : 'â€”') : 'â€”'}
          </div>
          {['global','class','fund','preview'].map(k => (
            <button key={k} className={`btn ${tab===k?'btn-primary':'btn-secondary'}`} onClick={() => setTab(k)}>{k.charAt(0).toUpperCase()+k.slice(1)}</button>
          ))}
        </div>
      </div>

      {tab === 'global' && (
        <div style={{ overflowX: 'auto' }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom: 8 }}>
            <div style={{ color:'#6b7280' }}>Tip: values are staged on change; click outside the input to save.</div>
            <button className="btn btn-secondary" onClick={() => {
              if (window.confirm('Reset staged global weights to defaults (not saved)?')) {
                const next = {};
                METRICS.forEach(m => { next[m.key] = DEFAULT_WEIGHTS[m.key]; });
                setStaged(prev => ({ ...prev, global: next }));
              }
            }}>Reset to defaults</button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: 8 }}>Metric</th>
                <th style={{ textAlign: 'left', padding: 8 }}>Weight</th>
                <th style={{ padding: 8 }}>Save</th>
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
                      onChange={(e) => stageGlobalWeight(m.key, e.target.value)}
                      onBlur={() => saveGlobalWeight(m.key)}
                      style={{ width: 120 }}
                    />
                  </td>
                  <td style={{ padding: 8 }}>
                    <button className="btn btn-secondary" onClick={() => saveGlobalWeight(m.key)}>Save</button>
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
              <option value="">Chooseâ€¦</option>
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
                          <input type="number" step="0.001" defaultValue={existing? Number(existing.weight) : ''}
                            onChange={(e) => setStaged(prev => ({ ...prev, class: { ...(prev.class||{}), [assetClass]: { ...(prev.class?.[assetClass]||{}), [m.key]: e.target.value } } }))}
                            onBlur={(e) => upsertOverride('asset_class', assetClass, m.key, e.target.value, true)} style={{ width: 120 }} />
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
                          <input type="number" step="0.001" defaultValue={existing? Number(existing.weight) : ''}
                            onChange={(e) => setStaged(prev => ({ ...prev, fund: { ...(prev.fund||{}), [f.ticker||f.Symbol]: { ...(prev.fund?.[f.ticker||f.Symbol]||{}), [m.key]: e.target.value } } }))}
                            onBlur={(e) => upsertOverride('fund', f.ticker || f.Symbol, m.key, e.target.value, true)} style={{ width: 120 }} />
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
            <button className="btn btn-secondary" onClick={() => {/* no-op: preview auto-updates from staged */}}>Refresh Weights</button>
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
                      <td style={{ padding: 8 }}>{f.name || f['Fund Name'] || 'â€”'}</td>
                      <td style={{ padding: 8 }}>{f.scores?.final?.toFixed(1) || 'â€”'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {process.env.NODE_ENV !== 'production' && (
        <div className="card" style={{ marginTop: 12, padding: 12 }}>
          <div style={{ fontWeight:600, marginBottom: 8 }}>Inspector (dev-only)</div>
          <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:8 }}>
            <span>Asset Class:</span>
            <select value={assetClass} onChange={e => setAssetClass(e.target.value)}>
              <option value="">Chooseâ€¦</option>
              {assetClasses.map(ac => <option key={ac} value={ac}>{ac}</option>)}
            </select>
            <span>Ticker:</span>
            <select value={(filteredFunds[0]?.ticker || filteredFunds[0]?.Symbol) || ''} onChange={() => { /* hint: narrow search above */ }}>
              <option value="">Type in search to narrow</option>
              {filteredFunds.slice(0, 20).map(f => (
                <option key={f.ticker || f.Symbol} value={f.ticker || f.Symbol}>{f.ticker || f.Symbol}</option>
              ))}
            </select>
            <span style={{ color:'#6b7280' }}>Tip: type a ticker in the search box to narrow to one fund.</span>
          </div>
          {assetClass && filteredFunds.length >= 1 && (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr><th style={{ textAlign:'left', padding:8 }}>Metric</th><th style={{ textAlign:'left', padding:8 }}>Effective Weight</th></tr></thead>
                <tbody>
                  {METRICS.map(m => {
                    const resolver = buildOverlayResolver();
                    const fund = { ticker: filteredFunds[0].ticker || filteredFunds[0].Symbol, asset_class_name: assetClass };
                    const w = resolver.getWeightFor(fund, m.key);
                    return (
                      <tr key={m.key}><td style={{ padding:8 }}>{m.label}</td><td style={{ padding:8 }}>{Number.isFinite(w) ? w : 'â€”'}</td></tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


