// src/components/Dashboard/Dashboard.jsx
import React from 'react';
import ProfessionalTable from '../tables/ProfessionalTable';
import fundService from '../../services/fundService';
import { useFundData } from '../../hooks/useFundData';
import './SimplifiedDashboard.css';
import ScoreTooltip from './ScoreTooltip';
import ScoreBadge from '../ScoreBadge';
import flowsService from '../../services/flowsService';
import { runDiagnostics } from '../../utils/diagnostics';

function KPICard({ label, value, subtext, format }) {
  const formatValue = (v) => {
    if (v == null) return 'N/A';
    if (format === 'currency') return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(v) || 0);
    if (format === 'score') return Number(v).toFixed(1);
    if (typeof v === 'number') return v.toLocaleString('en-US');
    return String(v);
  };
  return (
    <div className="kpi-card">
      <div style={{ fontSize: 12, color: '#6b7280' }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: 20 }}>{formatValue(value)}</div>
      {subtext && <div style={{ fontSize: 12, color: '#6b7280' }}>{subtext}</div>}
    </div>
  );
}

function InsightCard({ title, children }) {
  return (
    <div className="card" style={{ padding: 12 }}>
      <div className="card-header"><h3 className="card-title" style={{ margin: 0 }}>{title}</h3></div>
      <div>{children || <div style={{ color: '#6b7280', fontSize: 12 }}>No data yet.</div>}</div>
    </div>
  );
}

export default function Dashboard() {
  // Use the useFundData hook for funds with scoring
  const { funds, loading: fundsLoading, assetClasses } = useFundData();
  
  const [summary, setSummary] = React.useState({ totalAUM: 0, totalFunds: 0, recommendedCount: 0, avgScore: 0, monthlyFlows: null, ownershipAvailable: false });
  const [newRecommendations, setNewRecommendations] = React.useState([]);
  // Table search and filters
  const [searchQuery, setSearchQuery] = React.useState('');
  const [assetClassFilter, setAssetClassFilter] = React.useState('all');
  const [recommendedOnly, setRecommendedOnly] = React.useState(false);

  // Run database diagnostics on mount (dev only)
  React.useEffect(() => {
    try {
      if (process.env.REACT_APP_DEBUG_MODE === 'true' || process.env.NODE_ENV === 'development') {
        runDiagnostics();
      }
    } catch (e) {
      // ignore in production
    }
  }, []);

  // Update summary when funds data changes
  React.useEffect(() => {
    if (!funds || funds.length === 0) return;
    
    const fs = Array.isArray(funds) ? funds : [];
    // compute summary
    const totalFunds = fs.length;
    const recommendedCount = fs.filter((f) => f.is_recommended || f.recommended).length;
    const aumValues = fs.map((f) => Number(f.firmAUM || 0));
    const totalAUM = aumValues.reduce((s, v) => s + v, 0);
    const ownershipAvailable = aumValues.some((v) => v > 0);
    const scores = fs.map((f) => (typeof f?.scores?.final === 'number' ? f.scores.final : (typeof f.score_final === 'number' ? f.score_final : (typeof f.score === 'number' ? f.score : null)))).filter((n) => n != null);
    const avgScore = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    
    setSummary(prevSummary => ({ 
      ...prevSummary, 
      totalAUM, 
      totalFunds, 
      recommendedCount, 
      avgScore, 
      ownershipAvailable 
    }));
  }, [funds]);

  // Load latest net flows KPI
  React.useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const months = await flowsService.listMonths(12);
        const latest = Array.isArray(months) && months.length > 0 ? months[0] : null;
        if (!latest) return;
        const rows = await flowsService.getFundFlows(latest, null, 5000);
        const net = (rows || []).reduce((s, r) => s + Number(r?.net_flow || 0), 0);
        if (!cancel) setSummary((s) => ({ ...s, monthlyFlows: Number.isFinite(net) ? net : null }));
      } catch {
        // leave null when unavailable
      }
    })();
    return () => { cancel = true; };
  }, []);

  // Compute newly recommended funds vs prior snapshot
  React.useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const months = await fundService.listSnapshotMonths(24);
        if (!Array.isArray(months) || months.length < 2) {
          const latestRecs = (funds || []).filter(f => f.is_recommended).slice(0, 5);
          if (!cancel) setNewRecommendations(latestRecs);
          return;
        }
        const prev = months[1];
        const prevRecs = await fundService.getRecommendedFundsWithOwnership(prev);
        const prevSet = new Set((prevRecs || []).map(r => r.ticker));
        const latestRecs = (funds || []).filter(f => f.is_recommended);
        const newly = latestRecs.filter(f => !prevSet.has(f.ticker));
        newly.sort((a, b) => ((b?.scores?.final ?? b?.score_final ?? b?.score) || 0) - ((a?.scores?.final ?? a?.score_final ?? a?.score) || 0));
        if (!cancel) setNewRecommendations(newly.slice(0, 5));
      } catch {
        const fallback = (funds || []).filter(f => f.is_recommended).slice(0, 5);
        if (!cancel) setNewRecommendations(fallback);
      }
    })();
    return () => { cancel = true; };
  }, [funds]);

  const DASHBOARD_COLUMNS = React.useMemo(() => ([
    { key: 'symbol', label: 'Symbol', accessor: (row) => row.ticker || row.symbol || '', render: (v) => <span style={{ fontWeight: 600 }}>{v}</span> },
    { key: 'name', label: 'Fund Name', accessor: (row) => row.name || row.fund_name || '', render: (v) => <span title={v}>{v}</span> },
    { key: 'assetClass', label: 'Asset Class', accessor: (row) => row.asset_class_name || row.asset_class || '' },
    { key: 'status', label: 'Status', accessor: (row) => row, render: (_v, row) => (
        <div style={{ display: 'flex', justifyContent: 'flex-start', gap: 6 }}>
          {row.is_recommended && <span className="status-recommended">REC</span>}
          {row.is_benchmark && <span className="benchmark-indicator">BM</span>}
        </div>
      ) },
    { key: 'score', label: 'Score', width: '90px', numeric: true, align: 'right', accessor: (row) => {
        const s = row?.scores?.final ?? row?.score_final ?? row?.score;
        return typeof s === 'number' ? s : (s != null ? Number(s) : null);
      }, render: (v, row) => (v != null && !Number.isNaN(v)) ? (
        <ScoreTooltip fund={row} score={Number(v)}>
          <span className="number">{Number(v).toFixed(1)}</span>
        </ScoreTooltip>
      ) : 'N/A' },
    { key: 'ytd', label: 'YTD', numeric: true, align: 'right', accessor: (row) => row.ytd_return ?? row['Total Return - YTD (%)'] ?? null, render: (v) => v != null ? `${Number(v).toFixed(2)}%` : 'N/A' },
    { key: 'expense', label: 'Expense', numeric: true, align: 'right', accessor: (row) => row.expense_ratio ?? row['Net Expense Ratio'] ?? null, render: (v) => v != null ? `${Number(v).toFixed(2)}%` : 'N/A' },
    { key: 'firmAUM', label: 'Firm AUM', numeric: true, align: 'right', accessor: (row) => row.firmAUM ?? null, render: (v) => v != null ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(v)) : 'N/A' },
    { key: 'advisors', label: '# Advisors', numeric: true, align: 'right', accessor: (row) => row.advisorCount ?? null }
  ]), []);

  // Apply search and filters to funds for the table view
  const filteredFunds = React.useMemo(() => {
    const q = String(searchQuery || '').trim().toLowerCase();
    const ac = String(assetClassFilter || 'all').toLowerCase();
    const out = (funds || []).filter((f) => {
      if (recommendedOnly && !f.is_recommended) return false;
      if (ac !== 'all') {
        const fac = String(f.asset_class_name || f.asset_class || '').toLowerCase();
        if (fac !== ac) return false;
      }
      if (q) {
        const t = String(f.ticker || f.symbol || '').toLowerCase();
        const n = String(f.name || '').toLowerCase();
        const fac = String(f.asset_class_name || f.asset_class || '').toLowerCase();
        if (!t.includes(q) && !n.includes(q) && !fac.includes(q)) return false;
      }
      return true;
    });
    return out;
  }, [funds, searchQuery, assetClassFilter, recommendedOnly]);

  const topPerformers = React.useMemo(() => {
    const arr = [...(funds || [])];
    arr.sort((a, b) => {
      const av = (a?.scores?.final ?? a?.score_final ?? a?.score) || 0;
      const bv = (b?.scores?.final ?? b?.score_final ?? b?.score) || 0;
      return bv - av;
    });
    return arr.slice(0, 5);
  }, [funds]);

  const needsReview = React.useMemo(() => {
    const arr = [...(funds || [])];
    arr.sort((a, b) => {
      const av = (a?.scores?.final ?? a?.score_final ?? a?.score) || 0;
      const bv = (b?.scores?.final ?? b?.score_final ?? b?.score) || 0;
      return av - bv;
    });
    return arr.slice(0, 5);
  }, [funds]);

  const renderInsightItem = (f) => {
    const score = f?.scores?.final ?? f?.score_final ?? f?.score ?? null;
    return (
      <div key={f.ticker} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{ width: 68, fontWeight: 600, flex: '0 0 auto' }}>{f.ticker}</div>
          {/* Omit long fund name to keep cards tight */}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '0 0 auto' }}>
          <ScoreBadge score={typeof score === 'number' ? score : null} fund={f} size="small" />
          {f.is_recommended && (
            <span className="status-recommended">REC</span>
          )}
          {f.is_benchmark && (
            <span className="benchmark-indicator">BM</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="dashboard" style={{ display: 'grid', gap: '1rem' }}>
      <div className="kpi-section" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: '0.75rem' }}>
        <KPICard label="Total AUM" value={summary.ownershipAvailable ? summary.totalAUM : null} format="currency" subtext={summary.ownershipAvailable ? undefined : 'Ownership data unavailable'} />
        <KPICard label="Funds Tracked" value={summary.totalFunds} subtext={`${summary.recommendedCount} recommended`} />
        <KPICard label="Avg Score" value={summary.avgScore} format="score" />
        {summary.monthlyFlows != null && (
          <KPICard label="Net Flows" value={summary.monthlyFlows} format="currency" />
        )}
      </div>

      <div className="insights-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
        <InsightCard title="Top Performers">
          <div>
            {(topPerformers || []).slice(0,5).map(renderInsightItem)}
          </div>
        </InsightCard>
        <InsightCard title="Needs Review">
          <div>
            {(needsReview || []).slice(0,5).map(renderInsightItem)}
          </div>
        </InsightCard>
        <InsightCard title="New Recommendations">
          <div>
            {(newRecommendations || []).map(renderInsightItem)}
          </div>
        </InsightCard>
      </div>

      <div className="main-table-section card" style={{ padding: 12 }}>
        <div className="table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>Fund Universe</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ticker, name, asset class"
              aria-label="Search funds"
              style={{ padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: 6, minWidth: 220 }}
            />
            <select
              aria-label="Filter by asset class"
              value={assetClassFilter}
              onChange={(e) => setAssetClassFilter(e.target.value)}
              style={{ padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: 6 }}
            >
              <option value="all">All Classes</option>
              {(assetClasses || []).map((ac) => (
                <option key={ac} value={ac}>{ac}</option>
              ))}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#374151' }}>
              <input type="checkbox" checked={recommendedOnly} onChange={(e) => setRecommendedOnly(e.target.checked)} />
              Recommended only
            </label>
          </div>
        </div>
        <ProfessionalTable
          data={filteredFunds}
          columns={DASHBOARD_COLUMNS}
          onRowClick={(row) => { try { window.dispatchEvent(new CustomEvent('NAVIGATE_APP', { detail: { tab: 'portfolios' } })); window.history.pushState({}, '', `/portfolios?ticker=${row.ticker}`); } catch {} }}
        />
      </div>
      {fundsLoading && <div style={{ color: '#6b7280' }}>Loading...</div>}
    </div>
  );
}
