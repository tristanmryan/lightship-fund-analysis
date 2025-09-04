// src/components/Recommended/RecommendedList.jsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import UnifiedFundTable from '../common/UnifiedFundTable';
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
        .map(([name, funds]) => (
        <div key={name} className="card" style={{ padding: 12 }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="card-title" style={{ margin: 0 }}>{name}</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" onClick={() => onExport(name, funds)}>Export CSV</button>
            </div>
          </div>
          <UnifiedFundTable
            funds={funds}
            preset="recommended"
            loading={loading}
            chartPeriod="1Y"
            onRowClick={(f) => console.log('select', f?.ticker)}
          />
        </div>
      ))}

      {!rows.length && !loading && (
        <div className="card" style={{ padding: 12, color: '#6b7280' }}>No recommended funds found.</div>
      )}
    </div>
  );
}
