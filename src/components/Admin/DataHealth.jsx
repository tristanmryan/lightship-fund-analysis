import React, { useEffect, useState } from 'react';
import { supabase, TABLES, dbUtils } from '../../services/supabase';

export default function DataHealth() {
  const [asOf, setAsOf] = useState('');
  const [fundCount, setFundCount] = useState(0);
  const [benchCount, setBenchCount] = useState(0);
  const [orphans, setOrphans] = useState(0);
  const [coverage, setCoverage] = useState({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Latest month (prefer EOM)
        const { data } = await supabase.from(TABLES.FUND_PERFORMANCE).select('date').order('date', { ascending: false }).limit(1000);
        const dates = (data || []).map(r => String(r.date).slice(0,10));
        const eom = dates.find((d) => {
          const dt = new Date(d + 'T00:00:00Z');
          const end = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0));
          return dt.getUTCDate() === end.getUTCDate();
        }) || dates[0] || '';
        if (cancelled) return;
        setAsOf(eom);

        // Counts
        const [{ data: fRows }, { data: bRows }] = await Promise.all([
          supabase.from(TABLES.FUND_PERFORMANCE).select('fund_ticker').eq('date', eom),
          supabase.from(TABLES.BENCHMARK_PERFORMANCE).select('benchmark_ticker').eq('date', eom)
        ]);
        if (cancelled) return;
        setFundCount((fRows || []).length);
        setBenchCount((bRows || []).length);

        // Orphans: perf rows without matching fund
        const { data: funds } = await supabase.from(TABLES.FUNDS).select('ticker');
        const fundSet = new Set((funds || []).map(r => String(r.ticker || '').toUpperCase()));
        const orphanCount = (fRows || []).filter(r => !fundSet.has(String(r.fund_ticker || '').toUpperCase())).length;
        setOrphans(orphanCount);

        // Coverage per metric
        const metrics = [
          'ytd_return','one_year_return','three_year_return','five_year_return','ten_year_return',
          'sharpe_ratio','standard_deviation_3y','standard_deviation_5y','expense_ratio','alpha','beta','manager_tenure',
          'up_capture_ratio','down_capture_ratio'
        ];
        const cov = {};
        for (const m of metrics) cov[m] = { nonNull: 0, total: 0 };
        for (const r of (fRows || [])) {
          for (const m of metrics) {
            cov[m].total += 1;
            if (r[m] != null) cov[m].nonNull += 1;
          }
        }
        setCoverage(cov);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="card" style={{ padding: 12 }}>
      <div className="card-header">
        <h4 className="card-title">Data Health</h4>
        <p className="card-subtitle">Active month: {asOf || '—'}</p>
      </div>
      <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:12 }}>
        <span className="badge">Fund rows: {fundCount}</span>
        <span className="badge">Benchmark rows: {benchCount}</span>
        <span className="badge" style={{ background:'#fef2f2', color:'#7f1d1d' }}>Orphans: {orphans}</span>
      </div>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign:'left' }}>Metric</th>
              <th style={{ textAlign:'left' }}>Coverage %</th>
              <th style={{ textAlign:'left' }}>Non-null / Total</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(coverage).map(([k,v]) => (
              <tr key={k}>
                <td>{k}</td>
                <td>{v.total > 0 ? Math.round((v.nonNull / v.total) * 100) : 0}%</td>
                <td>{v.nonNull}/{v.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

