// src/components/Recommended/RecommendedList.jsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import ProfessionalTable from '../tables/ProfessionalTable';
import ScoreTooltip from '../Dashboard/ScoreTooltip';
import fundService from '../../services/fundService';
import { exportAssetClassTableCSV } from '../../services/exportService.js';

const DEFAULT_GROUPS = [
  'US Equity',
  'International Equity',
  'Fixed Income',
  'Commodities',
  'Alternatives'
];

export default function RecommendedList({ asOfMonth = null }) {
  const [rows, setRows] = useState([]);
  const [benchmarks, setBenchmarks] = useState(new Map()); // asset_class_id -> benchmark row
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState('All');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fundService.getRecommendedFundsWithOwnership(asOfMonth);
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('RecommendedList: load failed', e);
      setError('Failed to load recommended funds');
    } finally {
      setLoading(false);
    }
  }, [asOfMonth]);

  useEffect(() => { load(); }, [load]);

  // After rows load, fetch benchmarks per asset class
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const byAc = new Map();
        (rows || []).forEach(r => { if (r.asset_class_id) byAc.set(r.asset_class_id, r.asset_class_name || r.asset_class || ''); });
        const entries = Array.from(byAc.keys());
        const results = await Promise.all(entries.map(async (acId) => {
          try {
            const { supabase } = fundService; // reuse client
            // Use new fundDataService instead of deleted get_asset_class_table RPC
            const { getFundsWithPerformance } = await import('../../services/fundDataService.js');
            const data = await getFundsWithPerformance(
              asOfMonth ? new Date(asOfMonth + 'T00:00:00Z').toISOString().slice(0,10) : null,
              acId
            );
            const bench = (data || []).find(r => r.is_benchmark);
            return [acId, bench || null];
          } catch { return [acId, null]; }
        }));
        if (!cancel) setBenchmarks(new Map(results));
      } catch { if (!cancel) setBenchmarks(new Map()); }
    })();
    return () => { cancel = true; };
  }, [rows, asOfMonth]);

  const groups = useMemo(() => {
    const set = new Set(DEFAULT_GROUPS);
    (rows || []).forEach(r => { if (r.asset_class_name) set.add(r.asset_class_name); });
    return ['All', ...Array.from(set).filter(Boolean)];
  }, [rows]);

  const grouped = useMemo(() => {
    const map = new Map();
    (rows || []).forEach(r => {
      const key = r.asset_class_name || r.asset_class || 'Unclassified';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    });
    return map;
  }, [rows]);

  const onExport = (assetClassName, data) => {
    try {
      const blob = exportAssetClassTableCSV(data, assetClassName, asOfMonth);
      const fname = `${assetClassName.replace(/\s+/g, '_').toLowerCase()}_recommended_${(asOfMonth||'latest')}.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = fname; a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export failed', e);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontWeight: 600, fontSize: 18 }}>Recommended Funds</div>
        <div>
          <label htmlFor="acFilter" style={{ fontSize: 12, color: '#6b7280', marginRight: 6 }}>Asset Class</label>
          <select id="acFilter" value={selectedGroup} onChange={(e)=> setSelectedGroup(e.target.value)}>
            {groups.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
      </div>

      {Array.from(grouped.entries())
        .filter(([name]) => selectedGroup === 'All' || name === selectedGroup)
        .map(([name, funds]) => {
          const acId = (funds[0] && funds[0].asset_class_id) || null;
          const bench = acId ? benchmarks.get(acId) : null;
          const data = bench ? [...funds, bench] : funds;
          return (
        <div key={name} className="card" style={{ padding: 12 }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="card-title" style={{ margin: 0 }}>{name}</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" onClick={() => onExport(name, funds)}>Export CSV</button>
            </div>
          </div>
          <ProfessionalTable
            data={data}
            columns={RECOMMENDED_COLUMNS}
            onRowClick={(f) => console.log('select', f?.ticker)}
          />
        </div>
      ); })}

      {!rows.length && !loading && (
        <div className="card" style={{ padding: 12, color: '#6b7280' }}>No recommended funds found.</div>
      )}
    </div>
  );
}

// Simple column set for recommended view
const RECOMMENDED_COLUMNS = [
  { key: 'ticker', label: 'Ticker', width: '80px', accessor: (r) => r.ticker, render: (v) => <span style={{ fontWeight: 600 }}>{v}</span> },
  { key: 'name', label: 'Fund Name', width: '250px', accessor: (r) => r.name || '' },
  { key: 'assetClass', label: 'Asset Class', width: '160px', accessor: (r) => r.asset_class_name || r.asset_class || '' },
  { key: 'score', label: 'Score', width: '70px', numeric: true, align: 'right', accessor: (r) => (r?.scores?.final ?? r?.score_final ?? r?.score) ?? null, render: (v, row) => v != null ? (
    <ScoreTooltip fund={row} score={Number(v)}>
      <span className="number">{Number(v).toFixed(1)}</span>
    </ScoreTooltip>
  ) : '—' },
  { key: 'ytdReturn', label: 'YTD', width: '80px', numeric: true, align: 'right', accessor: (r) => r.ytd_return ?? null, render: (v) => v != null ? `${Number(v).toFixed(2)}%` : '—' },
  { key: 'oneYear', label: '1Y', width: '80px', numeric: true, align: 'right', accessor: (r) => r.one_year_return ?? null, render: (v) => v != null ? `${Number(v).toFixed(2)}%` : '—' },
  { key: 'threeYear', label: '3Y', width: '80px', numeric: true, align: 'right', accessor: (r) => r.three_year_return ?? null, render: (v) => v != null ? `${Number(v).toFixed(2)}%` : '—' },
  { key: 'expense', label: 'Expense', width: '80px', numeric: true, align: 'right', accessor: (r) => r.expense_ratio ?? null, render: (v) => v != null ? `${Number(v).toFixed(2)}%` : '—' },
  { key: 'firmAUM', label: 'Firm AUM', width: '120px', numeric: true, align: 'right', accessor: (r) => r.firmAUM ?? null, render: (v) => v != null ? new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', maximumFractionDigits: 0 }).format(Number(v)) : '—' },
  { key: 'advisors', label: '# Advisors', width: '100px', numeric: true, align: 'right', accessor: (r) => r.advisorCount ?? null }
];
