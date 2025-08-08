// src/components/Dashboard/HealthCheck.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useFundData } from '../../hooks/useFundData';
import { getPrimaryBenchmark } from '../../services/resolvers/benchmarkResolverClient';

const HealthCheck = () => {
  const { funds, loading, error } = useFundData();
  const [summary, setSummary] = useState({ unresolvedFunds: [], classesMissingBench: [] });

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

  if (loading) return <div>Health Check: loading…</div>;
  if (error) return <div>Health Check error: {error}</div>;

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Dictionary Health Check</h3>
        <p className="card-subtitle">Unresolved funds and classes missing benchmarks</p>
      </div>
      <div style={{ padding: '1rem' }}>
        <div style={{ marginBottom: '1rem', fontSize: 12, color: '#6b7280' }}>
          Legacy check: If any UI still imports ['Asset Class'], normalization is pending in the next PR.
        </div>
        <h4>Unresolved Funds ({summary.unresolvedFunds.length})</h4>
        {summary.unresolvedFunds.length === 0 ? (
          <div>None</div>
        ) : (
          <ul>
            {summary.unresolvedFunds.map(f => (
              <li key={f.ticker}>{f.ticker} — {f.name}</li>
            ))}
          </ul>
        )}
        <h4 style={{ marginTop: '1rem' }}>Classes Missing Benchmarks ({summary.classesMissingBench.length})</h4>
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
  );
};

export default HealthCheck;

