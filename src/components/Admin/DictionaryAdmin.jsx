// src/components/Admin/DictionaryAdmin.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { supabase, TABLES } from '../../services/supabase';
import { invalidateReferenceCaches } from '../../services/resolvers';

const DictionaryAdmin = () => {
  const [assetClasses, setAssetClasses] = useState([]);
  const [benchmarks, setBenchmarks] = useState([]);
  const [mappings, setMappings] = useState([]);
  // const [alternates, setAlternates] = useState({}); // reserved for future use
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newClass, setNewClass] = useState({ code: '', name: '', group_name: '', sort_group: 0, sort_order: 0 });
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({ code: '', name: '', group_name: '', sort_group: 0, sort_order: 0 });

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [{ data: ac }, { data: bm }, { data: map }] = await Promise.all([
        supabase.from(TABLES.ASSET_CLASSES).select('*').order('sort_group').order('sort_order'),
        supabase.from(TABLES.BENCHMARKS).select('*').order('ticker'),
        supabase.from(TABLES.ASSET_CLASS_BENCHMARKS).select('id, kind, rank, asset_class_id, benchmark_id').order('rank')
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

  async function addAlternate(assetClassId, benchmarkId) {
    try {
      const existing = mappings.filter(m => m.asset_class_id === assetClassId && m.kind === 'alternate');
      const nextRank = (existing.sort((a,b) => (a.rank||0)-(b.rank||0)).slice(-1)[0]?.rank || 0) + 1;
      await supabase.from(TABLES.ASSET_CLASS_BENCHMARKS).insert({ asset_class_id: assetClassId, benchmark_id: benchmarkId, kind: 'alternate', rank: nextRank });
      invalidateReferenceCaches();
      await loadAll();
      alert('Alternate benchmark added');
    } catch (e) {
      alert(`Error adding alternate: ${e.message}`);
    }
  }

  async function removeMapping(mappingId) {
    try {
      await supabase.from(TABLES.ASSET_CLASS_BENCHMARKS).delete().eq('id', mappingId);
      invalidateReferenceCaches();
      await loadAll();
    } catch (e) {
      alert(`Error removing mapping: ${e.message}`);
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
        {/* Create Asset Class */}
        <div style={{ marginBottom: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 8 }}>
          <input placeholder="Code" value={newClass.code} onChange={(e)=>setNewClass(v=>({ ...v, code: e.target.value.toUpperCase() }))} />
          <input placeholder="Name" value={newClass.name} onChange={(e)=>setNewClass(v=>({ ...v, name: e.target.value }))} />
          <input placeholder="Group" value={newClass.group_name} onChange={(e)=>setNewClass(v=>({ ...v, group_name: e.target.value }))} />
          <input placeholder="Group Sort" type="number" value={newClass.sort_group} onChange={(e)=>setNewClass(v=>({ ...v, sort_group: Number(e.target.value||0) }))} />
          <input placeholder="Class Sort" type="number" value={newClass.sort_order} onChange={(e)=>setNewClass(v=>({ ...v, sort_order: Number(e.target.value||0) }))} />
          <button className="btn btn-primary" onClick={async ()=>{
            try {
              if (!newClass.code || !newClass.name || !newClass.group_name) { alert('Code, Name, Group required'); return; }
              await supabase.from(TABLES.ASSET_CLASSES).insert({ ...newClass, code: newClass.code.toUpperCase() });
              setNewClass({ code: '', name: '', group_name: '', sort_group: 0, sort_order: 0 });
              invalidateReferenceCaches();
              await loadAll();
            } catch(e) { alert(e.message); }
          }}>Add Class</button>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Group / Class</th>
              <th style={{ textAlign: 'left' }}>Code</th>
              <th style={{ textAlign: 'left' }}>Sorts</th>
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
                    {editingId === ac.id ? (
                      <>
                        <input style={{ width: '100%' }} value={editValues.group_name} onChange={(e)=>setEditValues(v=>({ ...v, group_name: e.target.value }))} />
                        <input style={{ width: '100%' }} value={editValues.name} onChange={(e)=>setEditValues(v=>({ ...v, name: e.target.value }))} />
                      </>
                    ) : (
                      <>
                        <div><strong>{ac.group_name}</strong></div>
                        <div>{ac.name}</div>
                      </>
                    )}
                  </td>
                  <td>
                    {editingId === ac.id ? (
                      <input value={editValues.code} onChange={(e)=>setEditValues(v=>({ ...v, code: e.target.value.toUpperCase() }))} />
                    ) : ac.code}
                  </td>
                  <td>
                    {editingId === ac.id ? (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input type="number" style={{ width: 90 }} value={editValues.sort_group} onChange={(e)=>setEditValues(v=>({ ...v, sort_group: Number(e.target.value||0) }))} />
                        <input type="number" style={{ width: 90 }} value={editValues.sort_order} onChange={(e)=>setEditValues(v=>({ ...v, sort_order: Number(e.target.value||0) }))} />
                      </div>
                    ) : (
                      <div>Group {ac.sort_group} / Class {ac.sort_order}</div>
                    )}
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
                    {editingId === ac.id ? (
                      <>
                        <button className="btn btn-primary" onClick={async ()=>{
                          try {
                            if (!editValues.code || !editValues.name || !editValues.group_name) { alert('Code, Name, Group required'); return; }
                            await supabase.from(TABLES.ASSET_CLASSES).update({
                              code: editValues.code.toUpperCase(), name: editValues.name, group_name: editValues.group_name,
                              sort_group: editValues.sort_group, sort_order: editValues.sort_order
                            }).eq('id', ac.id);
                            setEditingId(null);
                            invalidateReferenceCaches();
                            await loadAll();
                          } catch(e) { alert(e.message); }
                        }}>Save</button>
                        <button className="btn btn-secondary" style={{ marginLeft: 6 }} onClick={()=> setEditingId(null)}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button className="btn btn-secondary" onClick={() => savePrimary(ac.id, (current?.id || ''))} disabled={!current}>Save Primary</button>
                        <button className="btn btn-link" style={{ marginLeft: 6 }} onClick={()=> { setEditingId(ac.id); setEditValues({ code: ac.code, name: ac.name, group_name: ac.group_name, sort_group: ac.sort_group||0, sort_order: ac.sort_order||0 }); }}>Edit</button>
                        <button className="btn btn-link" style={{ marginLeft: 6, color: '#dc2626' }} onClick={async ()=>{
                          if (!window.confirm(`Delete ${ac.name}?`)) return;
                          await supabase.from(TABLES.ASSET_CLASSES).delete().eq('id', ac.id);
                          invalidateReferenceCaches();
                          await loadAll();
                        }}>Delete</button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ marginTop: '1rem' }}>
          <h4>Alternates</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Class</th>
                <th style={{ textAlign: 'left' }}>Add Alternate</th>
                <th style={{ textAlign: 'left' }}>Existing Alternates</th>
              </tr>
            </thead>
            <tbody>
              {assetClasses.map(ac => {
                const alts = mappings.filter(m => m.asset_class_id === ac.id && m.kind === 'alternate').sort((a,b)=> (a.rank||0)-(b.rank||0));
                return (
                  <tr key={`alt-${ac.id}`}>
                    <td>{ac.name}</td>
                    <td>
                      <select onChange={(e) => addAlternate(ac.id, e.target.value)} defaultValue="">
                        <option value="">Select benchmark…</option>
                        {benchmarks.map(b => (
                          <option key={b.id} value={b.id}>{b.ticker} — {b.name}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {(alts.length === 0) ? '—' : (
                        <ul style={{ margin: 0, paddingLeft: 16 }}>
                          {alts.map(m => (
                            <li key={m.id}>
                              {byId.bm[m.benchmark_id]?.ticker} — {byId.bm[m.benchmark_id]?.name} (rank {m.rank})
                              <button className="btn btn-link" onClick={() => removeMapping(m.id)} style={{ marginLeft: 8 }}>Remove</button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DictionaryAdmin;

