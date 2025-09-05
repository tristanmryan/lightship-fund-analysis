// src/components/Dashboard/Dashboard.jsx
import React from 'react';
import ProfessionalTable from '../tables/ProfessionalTable';
import fundService from '../../services/fundService';
import './SimplifiedDashboard.css';

function KPICard({ label, value, subtext, format }) {
  const formatValue = (v) => {
    if (v == null) return '—';
    if (format === 'currency') return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(v) || 0);
    if (format === 'score') return Number(v).toFixed(1);
    if (typeof v === 'number') return v.toLocaleString('en-US');
    return String(v);
  };
  return (
    <div className="card" style={{ padding: 12 }}>
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
  const [funds, setFunds] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [summary, setSummary] = React.useState({ totalAUM: 0, totalFunds: 0, recommendedCount: 0, avgScore: 0, monthlyFlows: 0 });

  React.useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        setLoading(true);
        const rows = await fundService.getFundsWithOwnership(null);
        if (cancel) return;
        const fs = Array.isArray(rows) ? rows : [];
        setFunds(fs);
        // compute summary
        const totalFunds = fs.length;
        const recommendedCount = fs.filter((f) => f.is_recommended || f.recommended).length;
        const totalAUM = fs.reduce((s, f) => s + (Number(f.firmAUM || 0)), 0);
        const scores = fs.map((f) => (typeof f?.scores?.final === 'number' ? f.scores.final : (typeof f.score_final === 'number' ? f.score_final : (typeof f.score === 'number' ? f.score : null)))).filter((n) => n != null);
        const avgScore = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
        setSummary({ totalAUM, totalFunds, recommendedCount, avgScore, monthlyFlows: 0 });
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, []);

  const DASHBOARD_COLUMNS = React.useMemo(() => ([
    { key: 'symbol', label: 'Symbol', width: '90px', accessor: (row) => row.ticker || row.symbol || '', render: (v) => <span style={{ fontWeight: 600 }}>{v}</span> },
    { key: 'name', label: 'Fund Name', width: '260px', accessor: (row) => row.name || row.fund_name || '' },
    { key: 'assetClass', label: 'Asset Class', width: '160px', accessor: (row) => row.asset_class_name || row.asset_class || '' },
    { key: 'score', label: 'Score', width: '90px', numeric: true, align: 'right', accessor: (row) => {
        const s = row?.scores?.final ?? row?.score_final ?? row?.score;
        return typeof s === 'number' ? s : (s != null ? Number(s) : null);
      }, render: (v) => (v != null && !Number.isNaN(v)) ? Number(v).toFixed(1) : '—' },
    { key: 'ytd', label: 'YTD', width: '90px', numeric: true, align: 'right', accessor: (row) => row.ytd_return ?? row['Total Return - YTD (%)'] ?? null, render: (v) => v != null ? `${Number(v).toFixed(2)}%` : '—' },
    { key: 'expense', label: 'Expense', width: '90px', numeric: true, align: 'right', accessor: (row) => row.expense_ratio ?? row['Net Expense Ratio'] ?? null, render: (v) => v != null ? `${Number(v).toFixed(2)}%` : '—' },
    { key: 'firmAUM', label: 'Firm AUM', width: '120px', numeric: true, align: 'right', accessor: (row) => row.firmAUM ?? null, render: (v) => v != null ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(v)) : '—' },
    { key: 'advisors', label: '# Advisors', width: '110px', numeric: true, align: 'right', accessor: (row) => row.advisorCount ?? null }
  ]), []);

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

  return (
    <div className="dashboard" style={{ display: 'grid', gap: '1rem' }}>
      <div className="kpi-section" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: '0.75rem' }}>
        <KPICard label="Total AUM" value={summary.totalAUM} format="currency" />
        <KPICard label="Funds Tracked" value={summary.totalFunds} subtext={`${summary.recommendedCount} recommended`} />
        <KPICard label="Avg Score" value={summary.avgScore} format="score" />
        <KPICard label="Net Flows" value={summary.monthlyFlows} format="currency" />
      </div>

      <div className="insights-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
        <InsightCard title="Top Performers">
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {(topPerformers || []).map((f) => (
              <li key={f.ticker}><strong>{f.ticker}</strong> {(f?.scores?.final ?? f?.score_final ?? f?.score)?.toFixed?.(1) || ''}</li>
            ))}
          </ul>
        </InsightCard>
        <InsightCard title="Needs Review">
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {(needsReview || []).map((f) => (
              <li key={f.ticker}><strong>{f.ticker}</strong> {(f?.scores?.final ?? f?.score_final ?? f?.score)?.toFixed?.(1) || ''}</li>
            ))}
          </ul>
        </InsightCard>
        <InsightCard title="New Recommendations">
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {(funds || []).filter(f => f.is_recommended).slice(0, 5).map((f) => (
              <li key={f.ticker}><strong>{f.ticker}</strong> {f.name}</li>
            ))}
          </ul>
        </InsightCard>
      </div>

      <div className="main-table-section card" style={{ padding: 12 }}>
        <div className="table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>Fund Universe</h2>
        </div>
        <ProfessionalTable
          data={funds}
          columns={DASHBOARD_COLUMNS}
          onRowClick={(row) => { try { window.dispatchEvent(new CustomEvent('NAVIGATE_APP', { detail: { tab: 'portfolios' } })); window.history.pushState({}, '', `/portfolios?ticker=${row.ticker}`); } catch {} }}
        />
      </div>
      {loading && <div style={{ color: '#6b7280' }}>Loading…</div>}
    </div>
  );
}

