// src/components/Admin/DictionaryAdmin.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { supabase, TABLES } from '../../services/supabase';
import { invalidateReferenceCaches } from '../../services/resolvers';

const DictionaryAdmin = () => {
  const [assetClasses, setAssetClasses] = useState([]);
  const [benchmarks, setBenchmarks] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [{ data: ac }, { data: bm }, { data: map }] = await Promise.all([
        supabase.from(TABLES.ASSET_CLASSES).select('*').order('sort_group').order('sort_order'),
        supabase.from(TABLES.BENCHMARKS).select('*').order('ticker'),
        supabase.from(TABLES.ASSET_CLASS_BENCHMARKS).select('id, kind, rank, asset_class_id, benchmark_id')
      ]);
      setAssetClasses(ac || []);
      setBenchmarks(bm || []);
      setMappings(map || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  const byId = useMemo(() => ({
    ac: Object.fromEntries((assetClasses || []).map(a => [a.id, a])),
    bm: Object.fromEntries((benchmarks || []).map(b => [b.id, b])),
  }), [assetClasses, benchmarks]);

  async function savePrimary(assetClassId, benchmarkId) {
    try {
      // Upsert mapping kind='primary', rank=1
      const existing = mappings.find(m => m.asset_class_id === assetClassId && m.kind === 'primary');
      if (existing) {
        await supabase.from(TABLES.ASSET_CLASS_BENCHMARKS).update({ benchmark_id: benchmarkId, rank: 1 }).eq('id', existing.id);
      } else {
        await supabase.from(TABLES.ASSET_CLASS_BENCHMARKS).insert({ asset_class_id: assetClassId, benchmark_id: benchmarkId, kind: 'primary', rank: 1 });
      }
      invalidateReferenceCaches();
      await loadAll();
      alert('Primary benchmark saved');
    } catch (e) {
      alert(`Error saving mapping: ${e.message}`);
    }
  }

  if (loading) return <div>Loading dictionary…</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Asset Class Dictionary (MVP)</h3>
        <p className="card-subtitle">Set primary benchmarks. Alternates in next iteration.</p>
      </div>
      <div style={{ padding: '1rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Group / Class</th>
              <th style={{ textAlign: 'left' }}>Primary Benchmark</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {assetClasses.map(ac => {
              const mapping = mappings.find(m => m.asset_class_id === ac.id && m.kind === 'primary');
              const current = mapping ? byId.bm[mapping.benchmark_id] : null;
              return (
                <tr key={ac.id}>
                  <td>
                    <div><strong>{ac.group_name}</strong></div>
                    <div>{ac.name}</div>
                  </td>
                  <td>
                    <select defaultValue={current?.id || ''} onChange={(e) => savePrimary(ac.id, e.target.value)}>
                      <option value="">Select benchmark…</option>
                      {benchmarks.map(b => (
                        <option key={b.id} value={b.id}>{b.ticker} — {b.name}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button className="btn btn-secondary" onClick={() => savePrimary(ac.id, (current?.id || ''))} disabled={!current}>Save</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DictionaryAdmin;

