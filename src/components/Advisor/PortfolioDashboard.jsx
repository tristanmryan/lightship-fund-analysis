import React, { useEffect, useMemo, useState } from 'react';
import advisorService from '../../services/advisorService';
import { supabase } from '../../services/supabase';
import { fmt } from '../../utils/formatters';
import { exportAdvisorPortfolioCSV, generateAdvisorPortfolioPDF, exportAdvisorPortfolioExcel, downloadFile, downloadPDF, formatExportFilename } from '../../services/exportService';
import FundUtilization from './FundUtilization.jsx';

export default function PortfolioDashboard() {
  const [dates, setDates] = useState([]);
  const [date, setDate] = useState('');
  const [advisors, setAdvisors] = useState([]);
  const [advisorId, setAdvisorId] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [summary, setSummary] = useState(null); // from get_advisor_metrics for selected advisor
  const [portfolio, setPortfolio] = useState(null); // computed breakdown
  const [adoptionTrend, setAdoptionTrend] = useState([]);

  // Load available snapshot dates
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const ds = await advisorService.listSnapshotDates();
        if (cancel) return;
        setDates(ds);
        if (ds && ds.length > 0) {
          setDate(prev => prev || ds[0]);
        }
      } catch (e) {
        if (!cancel) setError(e.message || String(e));
      }
    })();
    return () => { cancel = true; };
  }, []);

  // Apply preselect if present (deep link from import confirmation)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('advisorDashboard.preselect');
      if (!raw) return;
      const sel = JSON.parse(raw);
      if (sel?.date) setDate(sel.date);
      if (sel?.advisorId) setAdvisorId(sel.advisorId);
      localStorage.removeItem('advisorDashboard.preselect');
    } catch {}
  }, []);

  // Load advisors when date changes
  useEffect(() => {
    if (!date) return;
    let cancel = false;
    (async () => {
      try {
        setError(null);
        const rows = await advisorService.listAdvisorsForDate(date);
        if (cancel) return;
        setAdvisors(rows);
        if (rows && rows.length > 0) {
          setAdvisorId(prev => prev || rows[0].advisor_id);
        }
      } catch (e) {
        if (!cancel) setError(e.message || String(e));
      }
    })();
    return () => { cancel = true; };
  }, [date]);

  // Load portfolio + summary when advisor changes
  useEffect(() => {
    if (!date || !advisorId) return;
    let cancel = false;
    (async () => {
      try {
        console.time && console.time('advisorPortfolioLoad');
        setLoading(true);
        setError(null);
        const [metrics, breakdown, trend] = await Promise.all([
          advisorService.getAdvisorMetrics(date, advisorId),
          advisorService.computePortfolioBreakdown(date, advisorId),
          advisorService.getAdvisorAdoptionTrend(advisorId, 12)
        ]);
        if (cancel) return;
        setSummary((metrics || [])[0] || null);
        setPortfolio(breakdown || null);
        setAdoptionTrend(trend || []);
      } catch (e) {
        if (!cancel) setError(e.message || String(e));
      } finally {
        console.timeEnd && console.timeEnd('advisorPortfolioLoad');
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [date, advisorId]);

  const adoptionPct = useMemo(() => {
    if (!portfolio || !portfolio.totalAum) return 0;
    return portfolio.recommendedAum / portfolio.totalAum;
  }, [portfolio]);

  return (
    <div className="card" style={{ padding: 16, marginTop: 16 }}>
      <div className="card-header">
        <h2 className="card-title">Advisor Portfolio Dashboard</h2>
        <p className="card-subtitle">EOM holdings intelligence with adoption and concentration insights</p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginTop: 8 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 14, color: '#6b7280' }}>Snapshot</label>
          <select value={date} onChange={e => { setDate(e.target.value); setAdvisorId(''); }}>
            {(dates || []).map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 14, color: '#6b7280' }}>Advisor</label>
          <select value={advisorId} onChange={e => setAdvisorId(e.target.value)}>
            {(advisors || []).map(a => <option key={a.advisor_id} value={a.advisor_id}>{a.advisor_id}</option>)}
          </select>
        </div>
        <button className="btn btn-secondary" onClick={() => {
          // Force refresh current advisor/date
          setAdvisorId(prev => prev ? prev + '' : prev);
        }} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>

        <div style={{ marginLeft: 'auto', display: 'inline-flex', gap: 8 }}>
          <button className="btn" onClick={async () => {
            try {
              const blob = exportAdvisorPortfolioCSV({ snapshotDate: date, advisorId, summary, portfolio });
              const name = formatExportFilename({ scope: 'advisor_portfolio', asOf: date, ext: 'csv' });
              downloadFile(blob, name, 'text/csv;charset=utf-8');
            } catch (e) { console.error('Export CSV failed', e); }
          }}>Export CSV</button>
          <button className="btn" onClick={async () => {
            try {
              const blob = exportAdvisorPortfolioExcel({ snapshotDate: date, advisorId, summary, portfolio });
              const name = formatExportFilename({ scope: 'advisor_portfolio', asOf: date, ext: 'xlsx' });
              downloadFile(blob, name, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            } catch (e) { console.error('Export Excel failed', e); }
          }}>Export Excel</button>
          <button className="btn" onClick={async () => {
            try {
              const pdf = await generateAdvisorPortfolioPDF({ snapshotDate: date, advisorId, summary, portfolio });
              const name = formatExportFilename({ scope: 'advisor_portfolio', asOf: date, ext: 'pdf' });
              downloadPDF(pdf, name);
            } catch (e) { console.error('Export PDF failed', e); }
          }}>Export PDF</button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginTop: 8 }}>{error}</div>
      )}

      <div className="kpi-4" style={{ marginTop: 12 }}>
        <KPI title="Advisor AUM" value={portfolio ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(portfolio.totalAum || 0) : '…'} />
        <KPI title="Unique Holdings" value={portfolio ? String(portfolio.uniqueHoldings || 0) : '…'} />
        <KPI title="Clients" value={summary ? String(summary.client_count || 0) : '…'} />
        <KPI title="% In Recommended" value={fmt.percent(adoptionPct * 100, { decimals: 1 })} />
      </div>

      <div className="grid-2" style={{ marginTop: 12 }}>
        <div className="card" style={{ padding: 12 }}>
          <SectionHeader title="Asset Allocation" subtitle="By asset class (based on fund mapping)" />
          <AllocationTable rows={portfolio?.allocation || []} />
        </div>
        <div className="card" style={{ padding: 12 }}>
          <SectionHeader title="Concentration Alerts" subtitle=">= 10% of advisor AUM" />
          <ConcentrationList rows={portfolio?.concentrationAlerts || []} totalAum={portfolio?.totalAum || 0} />
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginTop: 12 }}>
        <SectionHeader title="Adoption Trend" subtitle="% of AUM in recommended funds over time" />
        <AdoptionTrendChart series={adoptionTrend} />
      </div>

      <div className="card" style={{ padding: 12, marginTop: 12 }}>
        <SectionHeader title="Recommendation Gap Analysis" subtitle="Adoption vs. recommended list" />
        <RecommendationGap portfolio={portfolio} />
      </div>

      <FundUtilization />
    </div>
  );
}

function KPI({ title, value }) {
  return (
    <div className="card" style={{ padding: 12 }}>
      <div style={{ fontSize: 12, color: '#6b7280' }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function SectionHeader({ title, subtitle }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
      <div style={{ fontWeight: 600 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12, color: '#6b7280' }}>{subtitle}</div>}
    </div>
  );
}

function AllocationTable({ rows }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid #e5e7eb' }}>Asset Class</th>
            <th style={{ textAlign: 'right', padding: 6, borderBottom: '1px solid #e5e7eb' }}>Amount</th>
            <th style={{ textAlign: 'right', padding: 6, borderBottom: '1px solid #e5e7eb' }}>% of AUM</th>
          </tr>
        </thead>
        <tbody>
          {(rows || []).map((r, i) => (
            <tr key={i}>
              <td style={{ padding: 6, borderBottom: '1px solid #f3f4f6' }}>{r.asset_class}</td>
              <td style={{ padding: 6, borderBottom: '1px solid #f3f4f6', textAlign: 'right' }}>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(r.amount || 0)}</td>
              <td style={{ padding: 6, borderBottom: '1px solid #f3f4f6', textAlign: 'right' }}>{fmt.percent((r.pct || 0) * 100, { decimals: 1 })}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {(!rows || rows.length === 0) && (
        <div style={{ fontSize: 12, color: '#6b7280', padding: 6 }}>No allocation data. Select a snapshot and advisor.</div>
      )}
    </div>
  );
}

function ConcentrationList({ rows, totalAum }) {
  return (
    <div>
      {(rows || []).length === 0 && (
        <div style={{ fontSize: 12, color: '#6b7280' }}>No positions >= 10%.</div>
      )}
      {(rows || []).map((r, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 600 }}>{r.ticker}</span>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
            <span style={{ color: '#b45309', fontWeight: 600 }}>{fmt.percent((r.pct || 0) * 100, { decimals: 1 })}</span>
            <span>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(r.amount || 0)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function RecommendationGap({ portfolio }) {
  const positions = portfolio?.positions || [];
  const heldSet = useMemo(() => new Set(positions.map(p => p.ticker)), [positions]);
  const [recommendedTickers, setRecommendedTickers] = useState([]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('funds')
          .select('ticker')
          .eq('is_recommended', true);
        if (error) throw error;
        if (!cancel) setRecommendedTickers((data || []).map(r => String(r.ticker || '').toUpperCase()).filter(Boolean));
      } catch (e) {
        // ignore; keep empty recommendations on failure
        if (!cancel) setRecommendedTickers([]);
      }
    })();
    return () => { cancel = true; };
  }, []);

  const heldNonRecommended = useMemo(() => positions.filter(p => !p.is_recommended).slice(0, 10), [positions]);
  const recNotHeld = useMemo(() => {
    const recSet = new Set((recommendedTickers || []).filter(Boolean));
    return Array.from(recSet).filter(t => !heldSet.has(t)).slice(0, 10);
  }, [recommendedTickers, heldSet]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Top Non-Recommended Exposures</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid #e5e7eb' }}>Ticker</th>
                <th style={{ textAlign: 'right', padding: 6, borderBottom: '1px solid #e5e7eb' }}>Amount</th>
                <th style={{ textAlign: 'right', padding: 6, borderBottom: '1px solid #e5e7eb' }}>% of AUM</th>
              </tr>
            </thead>
            <tbody>
              {heldNonRecommended.map((p, i) => (
                <tr key={i}>
                  <td style={{ padding: 6, borderBottom: '1px solid #f3f4f6' }}>{p.ticker}</td>
                  <td style={{ padding: 6, borderBottom: '1px solid #f3f4f6', textAlign: 'right' }}>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(p.amount || 0)}</td>
                  <td style={{ padding: 6, borderBottom: '1px solid #f3f4f6', textAlign: 'right' }}>{fmt.percent((p.pct || 0) * 100, { decimals: 1 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {heldNonRecommended.length === 0 && (
            <div style={{ fontSize: 12, color: '#6b7280', padding: 6 }}>All top holdings are on the recommended list.</div>
          )}
        </div>
      </div>
      <div>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Recommended Not Held</div>
        {(recNotHeld || []).length === 0 && (
          <div style={{ fontSize: 12, color: '#6b7280' }}>No gaps. All recommended funds are represented.</div>
        )}
        {(recNotHeld || []).map((t, i) => (
          <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>{t}</div>
        ))}
      </div>
    </div>
  );
}

function AdoptionTrendChart({ series }) {
  const [w, h, pad] = [780, 260, 40];
  const points = (series || []).map(r => ({ x: new Date(r.snapshot_date).getTime(), y: Number((r.adoption_pct || 0) * 100) }));
  if (points.length === 0) return <div style={{ color: '#6b7280', fontSize: 12 }}>No trend data.</div>;
  const minX = Math.min(...points.map(p => p.x));
  const maxX = Math.max(...points.map(p => p.x));
  const minY = 0;
  const maxY = 100;
  const scaleX = (v) => pad + ((v - minX) / (maxX - minX || 1)) * (w - pad * 2);
  const scaleY = (v) => (h - pad) - ((v - minY) / (maxY - minY || 1)) * (h - pad * 2);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.x)} ${scaleY(p.y)}`).join(' ');
  return (
    <svg width={w} height={h} role="img" aria-label="Advisor adoption trend">
      <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="#9ca3af" />
      <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="#9ca3af" />
      <path d={path} fill="none" stroke="#22c55e" strokeWidth={2} />
      {points.map((p, i) => (
        <circle key={i} cx={scaleX(p.x)} cy={scaleY(p.y)} r={3} fill="#22c55e" />
      ))}
    </svg>
  );
}
