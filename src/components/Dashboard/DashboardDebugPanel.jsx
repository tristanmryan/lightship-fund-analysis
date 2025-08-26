import React, { useEffect, useMemo, useRef, useState } from 'react';

/**
 * DashboardDebugPanel
 * Development-only debug panel for inspecting scoring details and performance.
 *
 * Props:
 *  - funds: array of fund objects
 *  - loading: boolean loading state
 */
const DashboardDebugPanel = ({ funds, loading }) => {
  const loadStartRef = useRef(null);
  const [loadTime, setLoadTime] = useState(null);

  // Track load time whenever loading toggles
  useEffect(() => {
    if (loading) {
      loadStartRef.current = performance.now();
    } else if (!loading && loadStartRef.current != null) {
      setLoadTime(performance.now() - loadStartRef.current);
      loadStartRef.current = null;
    }
  }, [loading]);

  // Compute score statistics
  const scoreStats = useMemo(() => {
    const scores = (funds || [])
      .map(f => (typeof f.score === 'number' ? f.score : null))
      .filter(n => n != null);

    const totalFunds = Array.isArray(funds) ? funds.length : 0;
    if (!scores.length) {
      return {
        totalFunds,
        min: null,
        max: null,
        avg: null,
        distribution: [0, 0, 0, 0, 0]
      };
    }

    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;

    const distribution = [0, 0, 0, 0, 0]; // 0-19,20-39,40-59,60-79,80-100
    scores.forEach(s => {
      const idx = Math.min(4, Math.floor(s / 20));
      distribution[idx]++;
    });

    return { totalFunds, min, max, avg, distribution };
  }, [funds]);

  // Sample of first few scores
  const sampleScores = useMemo(() => {
    return (funds || []).slice(0, 10).map(f => ({
      ticker: f.ticker || f.symbol || 'N/A',
      score: typeof f.score === 'number' ? f.score.toFixed(2) : 'N/A'
    }));
  }, [funds]);

  // Determine scoring source (server vs client)
  const scoringSource = useMemo(() => {
    if (!funds || !funds.length) return 'unknown';
    const clientSide = funds.some(f => f?.scores?.assetClassSize != null || f?.scores?.confidence != null);
    return clientSide ? 'client-side' : 'server-side';
  }, [funds]);

  const containerStyle = {
    marginTop: '1rem',
    padding: '1rem',
    border: '2px dashed #f59e0b',
    background: '#fef9c3',
    fontFamily: 'monospace',
    fontSize: '0.9rem'
  };

  return (
    <div className="dashboard-debug-panel" style={containerStyle}>
      <h3>Debug Panel</h3>
      <div><strong>Total funds loaded:</strong> {scoreStats.totalFunds}</div>
      <div>
        <strong>Score stats:</strong>
        {' '}
        min {scoreStats.min != null ? scoreStats.min.toFixed(2) : 'N/A'},
        {' '}max {scoreStats.max != null ? scoreStats.max.toFixed(2) : 'N/A'},
        {' '}avg {scoreStats.avg != null ? scoreStats.avg.toFixed(2) : 'N/A'}
      </div>
      <div>
        <strong>Distribution (0-100):</strong>
        {' '}
        {['0-19', '20-39', '40-59', '60-79', '80-100'].map((label, i) => (
          <span key={label} style={{ marginRight: '0.5rem' }}>
            {label}: {scoreStats.distribution[i]}
          </span>
        ))}
      </div>
      <div>
        <strong>Sample scores:</strong>
        <ul>
          {sampleScores.map((s, i) => (
            <li key={i}>{s.ticker}: {s.score}</li>
          ))}
        </ul>
      </div>
      <div>
        <strong>Performance:</strong>
        <div>Load time: {loadTime != null ? `${Math.round(loadTime)} ms` : 'N/A'}</div>
        <div>RPC time: {loadTime != null ? `${Math.round(loadTime)} ms` : 'N/A'}</div>
      </div>
      <div>
        <strong>Scoring source:</strong> {scoringSource}
        {process.env.REACT_APP_DB_SCORES === 'true' && scoringSource === 'client-side' ? ' (fallback)' : ''}
      </div>
    </div>
  );
};

export default DashboardDebugPanel;
