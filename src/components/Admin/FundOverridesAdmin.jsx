// src/components/Admin/FundOverridesAdmin.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { supabase, TABLES } from '../../services/supabase';
import { invalidateReferenceCaches } from '../../services/resolvers';

const FundOverridesAdmin = () => {
  const [funds, setFunds] = useState([]);
  const [assetClasses, setAssetClasses] = useState([]);
  const [benchmarks, setBenchmarks] = useState([]);
  const [overrides, setOverrides] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [{ data: f }, { data: ac }, { data: bm }, { data: ov }] = await Promise.all([
          supabase.from(TABLES.FUNDS).select('ticker, name, asset_class_id').order('ticker'),
          supabase.from(TABLES.ASSET_CLASSES).select('id, name').order('group_name').order('sort_order'),
          supabase.from(TABLES.BENCHMARKS).select('id, ticker, name').order('ticker'),
          supabase.from(TABLES.FUND_OVERRIDES).select('*').order('created_at', { ascending: false })
        ]);
        setFunds(f || []);
        setAssetClasses(ac || []);
        setBenchmarks(bm || []);
        setOverrides(ov || []);
      } catch (e) { setError(e.message); } finally { setLoading(false); }
    })();
  }, []);

  const acById = useMemo(() => Object.fromEntries(assetClasses.map(a => [a.id, a])), [assetClasses]);
  const bmById = useMemo(() => Object.fromEntries(benchmarks.map(b => [b.id, b])), [benchmarks]);

  async function addOverride({ ticker, type, asset_class_id, benchmark_id, reason }) {
    try {
      if (!ticker || !type || !reason) throw new Error('Ticker, type, and reason are required');
      if (type === 'asset_class' && !asset_class_id) throw new Error('Asset class required');
      if (type === 'benchmark' && !benchmark_id) throw new Error('Benchmark required');
      await supabase.from(TABLES.FUND_OVERRIDES).insert({
        fund_ticker: ticker.toUpperCase(),
        override_type: type,
        asset_class_id: type === 'asset_class' ? asset_class_id : null,
        benchmark_id: type === 'benchmark' ? benchmark_id : null,
        reason
      });
      invalidateReferenceCaches();
      const { data } = await supabase.from(TABLES.FUND_OVERRIDES).select('*').order('created_at', { ascending: false });
      setOverrides(data || []);
      alert('Override added');
    } catch (e) { alert(e.message); }
  }

  async function removeOverride(id) {
    try {
      await supabase.from(TABLES.FUND_OVERRIDES).delete().eq('id', id);
      invalidateReferenceCaches();
      setOverrides(prev => prev.filter(o => o.id !== id));
    } catch (e) { alert(e.message); }
  }

  if (loading) return <div>Loading overrides…</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="card" style={{ marginTop: '1rem' }}>
      <div className="card-header">
        <h3 className="card-title">Fund Overrides</h3>
        <p className="card-subtitle">Asset class or benchmark overrides, with reason</p>
      </div>
      <div style={{ padding: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 8, marginBottom: 12 }}>
          <input id="ov_t" placeholder="Ticker" />
          <select id="ov_type" defaultValue="asset_class">
            <option value="asset_class">Asset Class</option>
            <option value="benchmark">Benchmark</option>
          </select>
          <select id="ov_ac" defaultValue="">
            <option value="">Select Asset Class…</option>
            {assetClasses.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select id="ov_bm" defaultValue="">
            <option value="">Select Benchmark…</option>
            {benchmarks.map(b => <option key={b.id} value={b.id}>{b.ticker} — {b.name}</option>)}
          </select>
          <input id="ov_reason" placeholder="Reason" />
          <button className="btn btn-primary" onClick={() => addOverride({
            ticker: document.getElementById('ov_t').value,
            type: document.getElementById('ov_type').value,
            asset_class_id: document.getElementById('ov_ac').value || null,
            benchmark_id: document.getElementById('ov_bm').value || null,
            reason: document.getElementById('ov_reason').value
          })}>Add Override</button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Type</th>
              <th>Value</th>
              <th>Reason</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {overrides.map(o => (
              <tr key={o.id}>
                <td>{o.fund_ticker}</td>
                <td>{o.override_type}</td>
                <td>{o.override_type === 'asset_class' ? (acById[o.asset_class_id]?.name || o.asset_class_id) : (bmById[o.benchmark_id]?.ticker || o.benchmark_id)}</td>
                <td>{o.reason || '—'}</td>
                <td>{new Date(o.created_at).toLocaleString()}</td>
                <td><button className="btn btn-link" onClick={() => removeOverride(o.id)} style={{ color: '#dc2626' }}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FundOverridesAdmin;

