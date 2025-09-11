// src/components/Dashboard/Home.jsx
import React from 'react';
import asOfStore from '../../services/asOfStore';
import dashboardService from '../../services/dashboardService';
import preferencesService from '../../services/preferencesService';
import fundService from '../../services/fundService';
import { useFundData } from '../../hooks/useFundData';
import { computeRuntimeScores, loadEffectiveWeightsResolver } from '../../services/scoring.js';
import PerformanceHeatmap from './PerformanceHeatmap';
import TopBottomPerformers from './TopBottomPerformers';
import AssetClassOverview from './AssetClassOverview';
import researchNotesService from '../../services/researchNotesService';
import { exportToExcel, downloadFile, formatExportFilename } from '../../services/exportService.js';
import SimplifiedDashboard from './SimplifiedDashboard';
import './SimplifiedDashboard.css';

// Original dashboard component
function OriginalHome() {
  // Use useFundData hook for funds with scoring
  const { funds } = useFundData();
  
  const [asOf, setAsOf] = React.useState(asOfStore.getActiveMonth() || null);
  const [kpis, setKpis] = React.useState({ funds: 0, recommended: 0, minCoverage: 0, alertsCount: 0, snapshotDate: null, freshnessDays: null });
  const [triage, setTriage] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [deltas, setDeltas] = React.useState({ moversUp: [], moversDown: [], newlyRecommended: [], dropped: [], stats: { avgYtdDelta: 0, advancers: 0, decliners: 0 } });
  const [widgets, setWidgets] = React.useState({ heatmap: true, topBottom: true, assetMini: true });
  const [notes, setNotes] = React.useState([]);

  const load = React.useCallback(async (date) => {
    setLoading(true);
    try {
      const [k, t, d] = await Promise.all([
        dashboardService.getKpis(date),
        dashboardService.getTriage(date),
        dashboardService.getDeltas(date)
      ]);
      setKpis(k);
      setTriage(t);
      setDeltas(d);
      // Funds are now loaded via useFundData hook with scoring
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    (async () => {
      await asOfStore.syncWithDb();
      const active = asOfStore.getActiveMonth();
      setAsOf(active);
      try {
        const saved = await preferencesService.getDashboardWidgets?.();
        if (saved && typeof saved === 'object') setWidgets((w) => ({ ...w, ...saved }));
      } catch {}
      // Optional notes feed
      try {
        if ((process.env.REACT_APP_ENABLE_NOTES || 'false') === 'true') {
          const latest = await researchNotesService.listNotes({});
          setNotes(Array.isArray(latest) ? latest.slice(0,5) : []);
        }
      } catch {}
      await load(active);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  React.useEffect(() => {
    const unsub = asOfStore.subscribe(({ activeMonth }) => {
      if (!activeMonth) return;
      setAsOf(activeMonth);
      load(activeMonth);
    });
    return () => unsub();
  }, [load]);

  return (
    <div style={{ padding: '1.5rem', display: 'grid', gap: '1rem' }} role="region" aria-labelledby="home-heading">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 id="home-heading" style={{ margin: 0 }}>Home</h2>
          <div style={{ color: '#6b7280' }}>As of {kpis.snapshotDate || asOf || 'Latest'} â€¢ {kpis.freshnessDays != null ? `${kpis.freshnessDays}d old` : ''}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" aria-label="Import CSV" onClick={() => { window.dispatchEvent(new CustomEvent('NAVIGATE_APP', { detail: { tab: 'admin' } })); window.dispatchEvent(new CustomEvent('NAVIGATE_ADMIN', { detail: { subtab: 'data' } })); }}>Import CSV</button>
          <button className="btn btn-secondary" aria-label="Open Data Health" onClick={() => { window.dispatchEvent(new CustomEvent('NAVIGATE_APP', { detail: { tab: 'admin' } })); window.dispatchEvent(new CustomEvent('NAVIGATE_ADMIN', { detail: { subtab: 'health' } })); }}>Open Data Health</button>
          <button className="btn btn-secondary" aria-label="Open Compare view" onClick={() => { window.dispatchEvent(new CustomEvent('NAVIGATE_APP', { detail: { tab: 'performance' } })); }}>Compare</button>
          <button className="btn" aria-label="Export to Excel" onClick={() => { try { const blob = exportToExcel({ funds }); const name = formatExportFilename({ scope: 'excel', asOf: kpis.snapshotDate, ext: 'xlsx' }) || `dashboard_export_${new Date().toISOString().slice(0,10)}.xlsx`; downloadFile(blob, name); } catch (e) { console.error('Export failed', e); } }}>Export</button>
        </div>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
        {[
          { label: 'Funds', value: loading ? 'â€¦' : kpis.funds },
          { label: 'Recommended', value: loading ? 'â€¦' : kpis.recommended },
          { label: 'Min Coverage', value: loading ? 'â€¦' : `${kpis.minCoverage}%` },
          { label: 'Alerts', value: loading ? 'â€¦' : kpis.alertsCount },
          { label: 'Snapshot', value: loading ? 'â€¦' : (kpis.snapshotDate || 'Latest') }
        ].map((c, idx) => (
          <div key={idx} className="card" style={{ padding: 12 }}>
            <div style={{ fontSize: 12, color: '#6b7280' }}>{c.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Triage */}
      <div className="card" style={{ padding: 12 }} role="region" aria-labelledby="triage-heading">
        <div className="card-header"><h3 id="triage-heading" className="card-title" style={{ margin: 0 }}>Triage</h3></div>
        <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
          {(loading ? [] : triage).map((t, i) => (
            <div key={i} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 8, background: t.severity === 'critical' ? '#fef2f2' : t.severity === 'warning' ? '#fffbeb' : '#eff6ff' }}>
              <div style={{ fontWeight: 600 }}>{t.title}</div>
              {t.detail && <div style={{ fontSize: 12, color: '#374151' }}>{t.detail}</div>}
              {t.action && <button className="btn btn-secondary" onClick={(e)=>{ e.preventDefault(); window.dispatchEvent(new CustomEvent('NAVIGATE_APP', { detail: { tab: t.action.ev.tab } })); if (t.action.ev.subtab) window.dispatchEvent(new CustomEvent('NAVIGATE_ADMIN', { detail: { subtab: t.action.ev.subtab, focus: t.action.ev.focus } })); }} style={{ marginTop: 6 }}>{t.action.label}</button>}
            </div>
          ))}
          {(!loading && triage.length === 0) && <div style={{ color: '#6b7280', fontSize: 12 }}>No issues detected</div>}
        </div>
      </div>

      {/* Widgets Row */}
      <div className="card" style={{ padding: 12 }} role="region" aria-labelledby="widgets-heading">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 id="widgets-heading" className="card-title" style={{ margin: 0 }}>Widgets</h3>
          <fieldset style={{ display: 'flex', gap: 8, alignItems: 'center', border: 'none', margin: 0, padding: 0 }}>
            <legend className="sr-only">Toggle dashboard widgets</legend>
            {Object.entries(widgets).map(([key, val]) => (
              <label key={key} style={{ fontSize: 12, color: '#374151' }}>
                <input
                  type="checkbox"
                  role="switch"
                  aria-checked={!!val}
                  aria-label={`Toggle ${key} widget`}
                  checked={!!val}
                  onChange={async (e) => {
                    const next = { ...widgets, [key]: e.target.checked };
                    setWidgets(next);
                    try { await preferencesService.saveDashboardWidgets?.(next); } catch {}
                  }}
                />{' '}
                {key}
              </label>
            ))}
          </fieldset>
        </div>
        <div style={{ display: 'grid', gap: 12, marginTop: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {loading ? (
            // Widget skeletons while loading
            <>
              <div className="card" aria-hidden="true" style={{ padding: 8 }}>
                <div className="card-header"><div style={{ width: 120, height: 14, background: '#e5e7eb', borderRadius: 4 }} /></div>
                <div style={{ marginTop: 6 }}>
                  <div style={{ height: 120, background: '#f3f4f6', borderRadius: 8 }} />
                </div>
              </div>
              <div className="card" aria-hidden="true" style={{ padding: 8 }}>
                <div className="card-header"><div style={{ width: 140, height: 14, background: '#e5e7eb', borderRadius: 4 }} /></div>
                <div style={{ marginTop: 6, display: 'grid', gap: 8 }}>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} style={{ height: 28, background: '#f3f4f6', borderRadius: 6 }} />
                  ))}
                </div>
              </div>
              <div className="card" aria-hidden="true" style={{ padding: 8 }}>
                <div className="card-header"><div style={{ width: 160, height: 14, background: '#e5e7eb', borderRadius: 4 }} /></div>
                <div style={{ marginTop: 6 }}>
                  <div style={{ height: 120, background: '#f3f4f6', borderRadius: 8 }} />
                </div>
              </div>
              {(process.env.REACT_APP_ENABLE_NOTES === 'true') && (
                <div className="card" aria-hidden="true" style={{ padding: 8 }}>
                  <div className="card-header"><div style={{ width: 120, height: 14, background: '#e5e7eb', borderRadius: 4 }} /></div>
                  <div style={{ marginTop: 6 }}>
                    <div style={{ height: 80, background: '#f3f4f6', borderRadius: 8 }} />
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {widgets.heatmap && (
                <div className="card" style={{ padding: 8 }}>
                  <div className="card-header"><h4 className="card-title" style={{ margin: 0 }}>Mini Heatmap</h4></div>
                  <div style={{ marginTop: 6 }}>
                    <PerformanceHeatmap funds={funds} />
                  </div>
                </div>
              )}
              {widgets.topBottom && (
                <div className="card" style={{ padding: 8 }}>
                  <div className="card-header"><h4 className="card-title" style={{ margin: 0 }}>Top & Bottom</h4></div>
                  <div style={{ marginTop: 6 }}>
                    <TopBottomPerformers funds={funds} />
                  </div>
                </div>
              )}
              {widgets.assetMini && (
                <div className="card" style={{ padding: 8 }}>
                  <div className="card-header"><h4 className="card-title" style={{ margin: 0 }}>Asset Class Overview</h4></div>
                  <div style={{ marginTop: 6 }}>
                    <AssetClassOverview funds={funds} />
                  </div>
                </div>
              )}
              {(process.env.REACT_APP_ENABLE_NOTES === 'true') && (
                <div className="card" style={{ padding: 8 }}>
                  <div className="card-header"><h4 className="card-title" style={{ margin: 0 }}>Recent Notes</h4></div>
                  {notes.length === 0 ? (
                    <div style={{ marginTop: 6, fontSize: 12, color: '#6b7280' }}>No notes yet.</div>
                  ) : (
                    <ul style={{ marginTop: 6, paddingLeft: 18, fontSize: 12 }}>
                      {notes.map((n) => (
                        <li key={n.id}>
                          <span style={{ color: '#6b7280' }}>{new Date(n.created_at).toLocaleDateString()}</span> â€” {n.decision ? `[${n.decision}] ` : ''}{n.body?.slice(0, 120)}{(n.body?.length || 0) > 120 ? 'â€¦' : ''}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* What Changed */}
      <div className="card" style={{ padding: 12 }} role="region" aria-labelledby="changed-heading">
        <div className="card-header"><h3 id="changed-heading" className="card-title" style={{ margin: 0 }}>What Changed</h3></div>
        {loading ? (
          <div style={{ color: '#6b7280', fontSize: 12 }}>Loadingâ€¦</div>
        ) : (deltas.moversUp.length === 0 && deltas.moversDown.length === 0) ? (
          <div style={{ color: '#6b7280', fontSize: 12 }}>Not enough history to compute changes (need a prior snapshot).</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Top movers (score)</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {deltas.moversUp.map((m, i) => (
                  <li key={`up-${i}`}><strong>{m.ticker}</strong> +{m.delta.toFixed(2)}</li>
                ))}
              </ul>
            </div>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Bottom movers (score)</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {deltas.moversDown.map((m, i) => (
                  <li key={`down-${i}`}><strong>{m.ticker}</strong> {m.delta.toFixed(2)}</li>
                ))}
              </ul>
            </div>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Newly recommended</div>
              <div style={{ fontSize: 12, color: '#374151' }}>{deltas.newlyRecommended.length} funds</div>
            </div>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Dropped from recommended</div>
              <div style={{ fontSize: 12, color: '#374151' }}>{deltas.dropped.length} funds</div>
            </div>
            <div style={{ gridColumn: '1 / -1', fontSize: 12, color: '#6b7280' }}>
              Breadth: {deltas.stats.advancers} advancers / {deltas.stats.decliners} decliners â€¢ Avg YTD delta: {deltas.stats.avgYtdDelta?.toFixed(2)}%
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Main export function that handles feature flag routing
export default function Home() {
  // Check for visual refresh feature flag
  const enableVisualRefresh = process.env.REACT_APP_ENABLE_VISUAL_REFRESH === 'true';
  
  // If visual refresh is enabled, use the simplified dashboard
  if (enableVisualRefresh) {
    return <SimplifiedDashboard />;
  }

  // Otherwise, use the original dashboard
  return <OriginalHome />;
}

