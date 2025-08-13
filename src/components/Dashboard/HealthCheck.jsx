// src/components/Dashboard/HealthCheck.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useFundData } from '../../hooks/useFundData';
import { getPrimaryBenchmark } from '../../services/resolvers/benchmarkResolverClient';
import { supabase, TABLES } from '../../services/supabase';

const HealthCheck = () => {
  const { funds, loading, error, asOfMonth } = useFundData();
  const [summary, setSummary] = useState({ unresolvedFunds: [], classesMissingBench: [] });
  const [monthStats, setMonthStats] = useState({ fundRows: 0, benchRows: 0 });
  const [coverage, setCoverage] = useState({ ytd: 0, oneY: 0, sharpe: 0, sd3y: 0 });

  const unresolvedFunds = useMemo(() => {
    if (!funds) return [];
    return funds.filter(f => !f.asset_class_id && !(f.asset_class_name || f.asset_class || f['Asset Class']));
  }, [funds]);

  const classesMissingBench = useMemo(() => {
    const set = new Set();
    const missing = new Set();
    (funds || []).forEach(f => {
      const label = f.asset_class_name || f.asset_class || f['Asset Class'];
      if (!label) return;
      if (set.has(label)) return;
      set.add(label);
      const bench = getPrimaryBenchmark(f);
      if (!bench) missing.add(label);
    });
    return Array.from(missing);
  }, [funds]);

  useEffect(() => {
    setSummary({ unresolvedFunds, classesMissingBench });
  }, [unresolvedFunds, classesMissingBench]);

  // Load month row counts
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = asOfMonth || null;
        if (!d) { setMonthStats({ fundRows: 0, benchRows: 0 }); return; }
        const [{ data: fRows }, { data: bRows }] = await Promise.all([
          supabase.from(TABLES.FUND_PERFORMANCE).select('fund_ticker').eq('date', d).limit(10000),
          supabase.from(TABLES.BENCHMARK_PERFORMANCE).select('benchmark_ticker').eq('date', d).limit(10000)
        ]);
        if (!cancelled) setMonthStats({ fundRows: (fRows || []).length, benchRows: (bRows || []).length });
      } catch {
        if (!cancelled) setMonthStats({ fundRows: 0, benchRows: 0 });
      }
    })();
    return () => { cancelled = true; };
  }, [asOfMonth]);

  // Compute coverage for key metrics across current funds
  useEffect(() => {
    const total = (funds || []).length;
    const nz = (arr) => arr.filter(v => v != null && !Number.isNaN(v)).length;
    const ytdOk = nz((funds || []).map(f => f.ytd_return));
    const oneYOk = nz((funds || []).map(f => f.one_year_return));
    const sharpeOk = nz((funds || []).map(f => f.sharpe_ratio));
    const sd3Ok = nz((funds || []).map(f => (f.standard_deviation_3y ?? f.standard_deviation)));
    setCoverage({
      ytd: total ? Math.round((ytdOk / total) * 100) : 0,
      oneY: total ? Math.round((oneYOk / total) * 100) : 0,
      sharpe: total ? Math.round((sharpeOk / total) * 100) : 0,
      sd3y: total ? Math.round((sd3Ok / total) * 100) : 0
    });
  }, [funds]);

  if (loading) return <div>Health Check: loading…</div>;
  if (error) return <div>Health Check error: {error}</div>;

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Data Health</h3>
        <p className="card-subtitle">As of {asOfMonth || 'Latest'} — coverage and benchmark readiness</p>
      </div>
      <div style={{ padding: '1rem', display: 'grid', gap: '1rem' }}>
        {/* Month snapshot counts */}
        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Fund rows</div>
            <div style={{ fontWeight: 700, fontSize: '1.25rem' }}>{monthStats.fundRows}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Benchmark rows</div>
            <div style={{ fontWeight: 700, fontSize: '1.25rem' }}>{monthStats.benchRows}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Funds in view</div>
            <div style={{ fontWeight: 700, fontSize: '1.25rem' }}>{(funds || []).length}</div>
          </div>
        </div>

        {/* Coverage bars */}
        <div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Metric coverage</div>
          {[
            { key: 'ytd', label: 'YTD Return', val: coverage.ytd },
            { key: 'oneY', label: '1-Year Return', val: coverage.oneY },
            { key: 'sharpe', label: 'Sharpe Ratio (3Y)', val: coverage.sharpe },
            { key: 'sd3y', label: 'Std Deviation (3Y)', val: coverage.sd3y }
          ].map(m => (
            <div key={m.key} style={{ marginBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#374151' }}>
                <span>{m.label}</span>
                <span>{m.val}%</span>
              </div>
              <div style={{ height: 8, background: '#e5e7eb', borderRadius: 9999 }}>
                <div style={{ width: `${m.val}%`, height: 8, background: m.val >= 80 ? '#16a34a' : m.val >= 50 ? '#f59e0b' : '#dc2626', borderRadius: 9999 }} />
              </div>
            </div>
          ))}
        </div>

        {/* Dictionary readiness */}
        <div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Dictionary readiness</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Unresolved funds and classes missing a primary benchmark.</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>Unresolved Funds</div>
              {summary.unresolvedFunds.length === 0 ? (
                <div>None</div>
              ) : (
                <ul>
                  {summary.unresolvedFunds.map(f => (
                    <li key={f.ticker}>{f.ticker} — {f.name}</li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>Classes Missing Benchmarks</div>
              {summary.classesMissingBench.length === 0 ? (
                <div>None</div>
              ) : (
                <ul>
                  {summary.classesMissingBench.map(c => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
          <a href="#" onClick={(e)=>{ e.preventDefault(); window.dispatchEvent(new CustomEvent('NAVIGATE_APP', { detail: { tab: 'admin' } })); }} className="btn btn-secondary">Go to Importer</a>
          <a href="#" onClick={(e)=>{ e.preventDefault(); window.dispatchEvent(new CustomEvent('NAVIGATE_APP', { detail: { tab: 'admin' } })); window.dispatchEvent(new CustomEvent('NAVIGATE_ADMIN', { detail: { subtab: 'catalogs' } })); }} className="btn btn-secondary">Open Benchmarks Dictionary</a>
        </div>
      </div>
    </div>
  );
};

export default HealthCheck;

