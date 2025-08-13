import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Info, AlertTriangle, CheckCircle2 } from 'lucide-react';
import asOfStore from '../../services/asOfStore';
import { supabase, TABLES } from '../../services/supabase';
import fundService from '../../services/fundService';
import { buildCSV, downloadFile } from '../../services/exportService';

export default function DataDiagnostics() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [validateOnly, setValidateOnly] = useState(true);
  const [backfillResult, setBackfillResult] = useState(null);
  const [previewRows, setPreviewRows] = useState([]);
  const [counts, setCounts] = useState({
    totalFunds: 0,
    recommendedFunds: 0,
    missingAssetClassId: 0,
    unmappedUsEquity: 0,
    unmappedNames: [],
    snapshots: []
  });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setBackfillResult(null);
      const [total, rec, missing] = await Promise.all([
        supabase.from(TABLES.FUNDS).select('id', { count: 'exact', head: true }),
        supabase.from(TABLES.FUNDS).select('id', { count: 'exact', head: true }).eq('is_recommended', true),
        supabase.from(TABLES.FUNDS).select('id', { count: 'exact', head: true }).is('asset_class_id', null)
      ]);

      const [{ data: acs }, { data: maps }] = await Promise.all([
        supabase.from(TABLES.ASSET_CLASSES).select('id,name,group_name,sort_group,sort_order'),
        supabase.from(TABLES.ASSET_CLASS_BENCHMARKS).select('asset_class_id,kind,rank')
      ]);
      const primarySet = new Set((maps || []).filter(m => m?.kind === 'primary' || m?.rank === 1).map(m => m.asset_class_id));
      const unmapped = (acs || [])
        .filter(ac => ac.group_name === 'U.S. Equity' && !primarySet.has(ac.id))
        .sort((a,b) => (a.sort_group - b.sort_group) || (a.sort_order - b.sort_order) || a.name.localeCompare(b.name));

      const snaps = await fundService.listSnapshotsWithCounts();

      setCounts({
        totalFunds: total?.count ?? 0,
        recommendedFunds: rec?.count ?? 0,
        missingAssetClassId: missing?.count ?? 0,
        unmappedUsEquity: unmapped.length,
        unmappedNames: unmapped.map(u => u.name),
        snapshots: (snaps || []).slice(0, 6)
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleExportMissing = async () => {
    try {
      const { data } = await supabase
        .from(TABLES.FUNDS)
        .select('ticker,name,asset_class')
        .is('asset_class_id', null)
        .order('ticker');
      const rows = [
        ['Ticker','Name','Legacy Asset Class'],
        ...((data || []).map(r => [r.ticker || '', r.name || '', r.asset_class || '']))
      ];
      const csv = buildCSV(rows);
      downloadFile(csv, 'funds-missing-asset-class-id.csv', 'text/csv;charset=utf-8');
    } catch (e) {
      alert(`Export failed: ${e.message}`);
    }
  };

  const handleBackfill = async () => {
    try {
      setBackfillResult(null);
      setPreviewRows([]);
      // Fetch candidate funds and asset classes
      const [{ data: funds }, { data: acs }] = await Promise.all([
        supabase.from(TABLES.FUNDS).select('ticker,name,asset_class,asset_class_id').is('asset_class_id', null),
        supabase.from(TABLES.ASSET_CLASSES).select('id,name')
      ]);
      const nameToId = new Map((acs || []).map(a => [String(a.name || '').toLowerCase(), a.id]));
      const idToName = new Map((acs || []).map(a => [a.id, a.name]));
      const toUpdate = [];
      const unmatched = [];
      for (const f of funds || []) {
        const key = String(f.asset_class || '').toLowerCase();
        const acId = nameToId.get(key);
        if (acId) toUpdate.push({ ticker: f.ticker, name: f.name, legacy: f.asset_class, asset_class_id: acId, newName: idToName.get(acId) }); else unmatched.push(f);
      }

      if (validateOnly) {
        setBackfillResult({ wouldUpdate: toUpdate.length, unmatched: unmatched.length, updated: 0 });
        setPreviewRows(toUpdate.slice(0, 10));
        return;
      }

      // Live mode: confirm before applying
      const pendingCount = toUpdate.length || 'unknown';
      // Production guard: disable if not allowed
      const isProd = process.env.NODE_ENV === 'production';
      const allowWrites = (process.env.REACT_APP_ALLOW_ADMIN_WRITES || '').toString() === 'true';
      if (isProd && !allowWrites) {
        alert('Live writes disabled in production (set REACT_APP_ALLOW_ADMIN_WRITES=true to enable).');
        return;
      }
      const typed = window.prompt(`Are you sure you want to update asset_class_id for ${pendingCount} fund(s)? Type CONFIRM to proceed.`);
      if ((typed || '').trim().toUpperCase() !== 'CONFIRM') {
        return;
      }

      let updated = 0;
      for (const u of toUpdate) {
        const { error } = await supabase
          .from(TABLES.FUNDS)
          .update({ asset_class_id: u.asset_class_id })
          .eq('ticker', u.ticker);
        if (!error) updated += 1;
      }
      setBackfillResult({ wouldUpdate: 0, unmatched: unmatched.length, updated });
      await load();
    } catch (e) {
      alert(`Backfill failed: ${e.message}`);
    }
  };

  const snapshotsText = useMemo(() => {
    return (counts.snapshots || []).map(s => `${s.date}: ${s.rows}`).join(', ');
  }, [counts.snapshots]);

  return (
    <div className="card" style={{ padding: 16, marginTop: 16 }}>
      <div className="card-header">
        <h3 className="card-title">Data Diagnostics</h3>
        <p className="card-subtitle">Quick counts and safe backfill</p>
        <div style={{ fontSize: 12, color: '#6b7280', display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
          <span style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 12, padding: '2px 8px' }}>
            Data mode: {(process.env.NODE_ENV === 'production' && (process.env.REACT_APP_ALLOW_MOCK_FALLBACK || 'false') !== 'true') ? 'Supabase' : 'Mock'}
          </span>
          <span style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 12, padding: '2px 8px' }}>
            Active: {asOfStore.getActiveMonth() || '—'}
          </span>
          <span style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 12, padding: '2px 8px' }}>
            Latest: {asOfStore.getLatestMonth() || '—'}
          </span>
          <button className="btn btn-link" onClick={() => asOfStore.setActiveMonth(asOfStore.getLatestMonth())} disabled={!asOfStore.getLatestMonth()}>Use Latest</button>
        </div>
      </div>
      {loading ? (
        <div style={{ display:'flex', alignItems:'center', gap:8, color:'#6b7280' }}>
          <Info size={16} aria-hidden />
          <span>Loading…</span>
        </div>
      ) : error ? (
        <div className="alert alert-error" style={{ display:'flex', alignItems:'center', gap:8 }}>
          <AlertTriangle size={16} aria-hidden />
          <span>{error}</span>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{ padding: '8px 0', borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ fontWeight: 600 }}>Total funds</div>
              <div>{counts.totalFunds}</div>
            </div>
            <div style={{ padding: '8px 0', borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ fontWeight: 600 }}>Recommended funds</div>
              <div>{counts.recommendedFunds}</div>
            </div>
            <div style={{ padding: '8px 0', borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ fontWeight: 600 }}>Funds missing asset_class_id</div>
              <div>{counts.missingAssetClassId}</div>
            </div>
            <div style={{ padding: '8px 0', borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ fontWeight: 600 }}>Unmapped U.S. Equity classes</div>
              <div>{counts.unmappedUsEquity}{counts.unmappedUsEquity > 0 ? ` (${counts.unmappedNames.join(', ')})` : ''}</div>
            </div>
            <div style={{ gridColumn: '1 / -1', padding: '8px 0', borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ fontWeight: 600 }}>Snapshot months (top 6)</div>
              <div style={{ color: '#111827' }}>{snapshotsText || 'none'}</div>
            </div>
          </div>

          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={handleExportMissing}>Export missing asset_class_id</button>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={validateOnly} onChange={(e) => setValidateOnly(e.target.checked)} />
              Validate only (no writes)
            </label>
            {(() => {
              const isProd = process.env.NODE_ENV === 'production';
              const allowWrites = (process.env.REACT_APP_ALLOW_ADMIN_WRITES || '').toString() === 'true';
              const liveDisabled = !validateOnly && isProd && !allowWrites;
              const title = liveDisabled ? 'Live writes disabled in production (set REACT_APP_ALLOW_ADMIN_WRITES=true to enable).' : undefined;
              return (
                <button className="btn btn-primary" onClick={handleBackfill} disabled={liveDisabled} title={title}>Backfill asset_class_id</button>
              );
            })()}
          </div>

          {backfillResult && (
            <div style={{ marginTop: 12 }}>
              <div className="alert alert-success" style={{ display:'flex', alignItems:'center', gap:8 }}>
                <CheckCircle2 size={16} aria-hidden />
                {validateOnly ? (
                  <span>Would update: {backfillResult.wouldUpdate}; Unmatched: {backfillResult.unmatched}</span>
                ) : (
                  <span>Updated: {backfillResult.updated}; Unmatched: {backfillResult.unmatched}</span>
                )}
              </div>
              {validateOnly && previewRows && previewRows.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Preview (first 10)</div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb', padding: 6 }}>Ticker</th>
                          <th style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb', padding: 6 }}>Name</th>
                          <th style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb', padding: 6 }}>Legacy Asset Class</th>
                          <th style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb', padding: 6 }}>New Asset Class</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((r) => (
                          <tr key={r.ticker}>
                            <td style={{ padding: 6, borderBottom: '1px solid #f3f4f6' }}>{r.ticker}</td>
                            <td style={{ padding: 6, borderBottom: '1px solid #f3f4f6' }}>{r.name}</td>
                            <td style={{ padding: 6, borderBottom: '1px solid #f3f4f6' }}>{r.legacy || ''}</td>
                            <td style={{ padding: 6, borderBottom: '1px solid #f3f4f6' }}>{r.newName || ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

