import React, { useEffect, useMemo, useState } from 'react';
import { supabase, TABLES } from '../../services/supabase';
import fundService from '../../services/fundService';
import { exportRecommendedFundsCSV, exportPrimaryBenchmarkMappingCSV } from '../../services/exportService';

export default function AdminOverview({ onNavigate = () => {} }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [state, setState] = useState({
    fundsTotal: 0,
    recommendedCount: 0,
    nullAssetClassIdCount: 0,
    assetClassCount: 0,
    mappedPrimaryCount: 0,
    unmappedCount: 0,
    latestSnapshot: null,
    latestSnapshotRows: 0
  });

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);

        const [fundsTotalRes, recCountRes, nullAcRes] = await Promise.all([
          supabase.from(TABLES.FUNDS).select('id', { count: 'exact', head: true }),
          supabase.from(TABLES.FUNDS).select('id', { count: 'exact', head: true }).eq('is_recommended', true),
          supabase.from(TABLES.FUNDS).select('id', { count: 'exact', head: true }).is('asset_class_id', null)
        ]);

        const [{ data: assetClasses }, { data: mappings }] = await Promise.all([
          supabase.from(TABLES.ASSET_CLASSES).select('id, code, name'),
          supabase.from(TABLES.ASSET_CLASS_BENCHMARKS).select('asset_class_id, kind, rank')
        ]);

        const primarySet = new Set((mappings || []).filter(r => r?.kind === 'primary' || r?.rank === 1).map(r => r.asset_class_id));
        const assetClassCount = (assetClasses || []).length;
        const mappedPrimaryCount = Array.from(primarySet).filter(id => (assetClasses || []).some(ac => ac.id === id)).length;
        const unmappedCount = Math.max(0, assetClassCount - mappedPrimaryCount);

        const snapshots = await fundService.listSnapshotsWithCounts();
        const latest = Array.isArray(snapshots) && snapshots.length > 0 ? snapshots[0] : null;

        setState({
          fundsTotal: fundsTotalRes?.count ?? 0,
          recommendedCount: recCountRes?.count ?? 0,
          nullAssetClassIdCount: nullAcRes?.count ?? 0,
          assetClassCount,
          mappedPrimaryCount,
          unmappedCount,
          latestSnapshot: latest?.date || null,
          latestSnapshotRows: latest?.rows || 0
        });
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const rows = useMemo(() => ([
    {
      label: 'Asset Classes',
      value: String(state.assetClassCount),
      linkText: 'Go to Catalogs',
      onClick: () => onNavigate('catalogs'),
      note: ''
    },
    {
      label: 'Benchmark Mapping',
      value: `${state.mappedPrimaryCount}/${state.assetClassCount}`,
      linkText: 'Go to Mappings',
      onClick: () => onNavigate('mappings'),
      note: state.unmappedCount > 0 ? `${state.unmappedCount} unmapped` : ''
    },
    {
      label: 'Recommended Funds',
      value: String(state.recommendedCount),
      linkText: 'Go to Catalogs',
      onClick: () => onNavigate('catalogs'),
      note: state.nullAssetClassIdCount > 0 ? `${state.nullAssetClassIdCount} without asset_class_id` : ''
    },
    {
      label: 'Snapshots',
      value: state.latestSnapshot ? `${state.latestSnapshot} (${state.latestSnapshotRows} rows)` : 'none',
      linkText: 'Go to Data Uploads',
      onClick: () => onNavigate('data'),
      note: ''
    }
  ]), [state, onNavigate]);

  return (
    <div className="card" style={{ padding: 16, marginTop: 16 }}>
      <div className="card-header">
        <h3 className="card-title">Admin Overview</h3>
        <p className="card-subtitle">Setup checklist and quick exports</p>
      </div>
      {loading ? (
        <div>Loading…</div>
      ) : error ? (
        <div className="alert alert-error">{error}</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {rows.map((r) => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #e5e7eb' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{r.label}</div>
                  <div style={{ color: '#111827' }}>{r.value}</div>
                  {r.note && <div style={{ color: '#6b7280', fontSize: 12 }}>{r.note}</div>}
                </div>
                <button className="btn btn-secondary" onClick={r.onClick}>{r.linkText}</button>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={() => exportRecommendedFundsCSV()}>Export Recommended Funds</button>
            <button className="btn btn-secondary" onClick={() => exportPrimaryBenchmarkMappingCSV()}>Export Primary Benchmark Mapping</button>
          </div>
        </>
      )}
    </div>
  );
}

