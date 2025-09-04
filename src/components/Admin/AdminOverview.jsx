import React, { useEffect, useMemo, useState } from 'react';
import asOfStore from '../../services/asOfStore';
import { supabase, TABLES } from '../../services/supabase';
import fundService from '../../services/fundService';
import { exportRecommendedFundsCSV, exportPrimaryBenchmarkMappingCSV, exportTableCSV } from '../../services/exportService.js';
import { generatePDFReport, downloadPDF } from '../../services/exportService.js';

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
  const [enhanced, setEnhanced] = useState({
    holdingsDate: null,
    advisors: 0,
    aum: 0,
    flowsMonth: null,
    flowsCount: 0
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

        // Enhanced: latest holdings snapshot and flows month from new MVs
        let holdingsDate = null; let advisors = 0; let aum = 0; let flowsMonth = null; let flowsCount = 0;
        try {
          const { data: hdates } = await supabase
            .from('advisor_metrics_mv')
            .select('snapshot_date')
            .order('snapshot_date', { ascending: false })
            .limit(1);
          holdingsDate = hdates?.[0]?.snapshot_date || null;
          if (holdingsDate) {
            const { data: hrows } = await supabase.rpc('get_advisor_metrics', { p_date: holdingsDate, p_advisor_id: null });
            const arr = hrows || [];
            advisors = arr.length;
            aum = arr.reduce((s, r) => s + (r?.aum || 0), 0);
          }
        } catch {}
        try {
          const { data: fmonths } = await supabase
            .from('fund_flows_mv')
            .select('month')
            .order('month', { ascending: false })
            .limit(1);
          flowsMonth = fmonths?.[0]?.month || null;
          const { data: frows } = await supabase.rpc('get_fund_flows', { p_month: flowsMonth, p_ticker: null, p_limit: 1000 });
          flowsCount = (frows || []).length;
        } catch {}

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
        setEnhanced({ holdingsDate, advisors, aum, flowsMonth, flowsCount });
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
      label: 'Holdings / Flows',
      value: `${enhanced.holdingsDate ? enhanced.holdingsDate : 'n/a'} | ${enhanced.flowsMonth ? enhanced.flowsMonth : 'n/a'}`,
      linkText: 'Go to Data Uploads',
      onClick: () => onNavigate('data'),
      note: enhanced.holdingsDate ? `${enhanced.advisors} advisors • AUM ${new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(enhanced.aum || 0)} • ${enhanced.flowsCount} flow tickers` : ''
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
        <div style={{ fontSize: 12, color: '#6b7280', display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
          <span style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 12, padding: '2px 8px' }}>
            Supabase: {(() => { try { return new URL(process.env.REACT_APP_SUPABASE_URL || '').hostname.slice(-12); } catch { return 'n/a'; } })()}
          </span>
          <span style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 12, padding: '2px 8px' }}>
            Active: {asOfStore.getActiveMonth() || '—'}
          </span>
          <span style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 12, padding: '2px 8px' }}>
            Latest: {asOfStore.getLatestMonth() || '—'}
          </span>
          <button className="btn btn-link" onClick={() => asOfStore.setActiveMonth(asOfStore.getLatestMonth())} disabled={!asOfStore.getLatestMonth()}>
            Use Latest
          </button>
        </div>
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
            {/* Consolidated Exports menu */}
            <div style={{ position: 'relative' }}>
              <button className="btn btn-secondary" aria-haspopup="menu" aria-expanded="false" onClick={(e)=>{ const m=e.currentTarget.nextSibling; if (m) m.style.display=(m.style.display==='block')?'none':'block'; }}>Exports</button>
              <div role="menu" style={{ position: 'absolute', background: 'white', border: '1px solid #e5e7eb', borderRadius: 6, minWidth: 240, boxShadow: '0 6px 18px rgba(0,0,0,0.08)', display: 'none', zIndex: 40 }}>
                <button role="menuitem" className="btn btn-link" style={{ display: 'block', width: '100%', textAlign: 'left' }} onClick={() => exportRecommendedFundsCSV()}>Recommended funds (CSV)</button>
                <button role="menuitem" className="btn btn-link" style={{ display: 'block', width: '100%', textAlign: 'left' }} onClick={() => exportPrimaryBenchmarkMappingCSV()}>Primary benchmark mapping (CSV)</button>
                <button role="menuitem" className="btn btn-link" style={{ display: 'block', width: '100%', textAlign: 'left' }} onClick={async () => {
                  try {
                    const { supabase, TABLES } = await import('../../services/supabase');
                    const { data: funds } = await supabase.from(TABLES.FUNDS).select('*').order('ticker');
                    const metadata = {
                      date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
                      totalFunds: (funds || []).length,
                      recommendedFunds: (funds || []).filter(f => f.is_recommended).length,
                      assetClassCount: new Set((funds || []).map(f => f.asset_class).filter(Boolean)).size,
                      averagePerformance: (() => {
                        const vals = (funds || []).map(f => f.ytd_return).filter(v => v != null && !Number.isNaN(v));
                        return vals.length ? (vals.reduce((s,v) => s+v, 0) / vals.length) : null;
                      })(),
                      asOf: asOfStore.getActiveMonth() || null
                    };
                    const pdf = await generatePDFReport({ funds: funds || [], metadata });
                    const { formatExportFilename } = await import('../../services/exportService.js');
                    const name = formatExportFilename({ scope: 'admin_pdf_all', ext: 'pdf' });
                    downloadPDF(pdf, name);
                  } catch (e) { console.error('PDF export failed', e); }
                }}>All funds (PDF)</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

