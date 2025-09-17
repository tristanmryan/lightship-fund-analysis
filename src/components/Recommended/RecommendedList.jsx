// src/components/Recommended/RecommendedList.jsx
import React, { useEffect, useMemo, useState } from 'react';
import ProfessionalTable from '../tables/ProfessionalTable';
import ScoreTooltip from '../Dashboard/ScoreTooltip';
import { getScoreColor, getScoreLabel, getScoreBreakdown } from '../../services/scoringService.js';
import { useFundData } from '../../hooks/useFundData';
import { exportAssetClassTableCSV } from '../../services/exportService.js';
import { supabase, TABLES } from '../../services/supabase.js';
import { prefetchBenchmarkMappings, getPrimaryBenchmark } from '../../services/resolvers/benchmarkResolverClient.js';

// Display order to match the Monthly PDF report
const MONTHLY_PDF_GROUP_ORDER = [
  'Large Cap Growth',
  'Large Cap Blend',
  'Large Cap Value',
  'Mid-Cap Growth',
  'Mid-Cap Blend',
  'Mid-Cap Value',
  'Small Cap Growth',
  'Small Cap Core',
  'Small Cap Value',
  'International Stock (Large Cap)',
  'International Stock (Small/Mid Cap)',
  'Emerging Markets',
  'Money Market',
  'Short Term Muni',
  'Intermediate Muni',
  'High Yield Muni',
  'Mass Muni Bonds',
  'Short Term Bonds',
  'Intermediate Term Bonds',
  'High Yield Bonds',
  'Foreign Bonds',
  'Multi Sector Bonds',
  'Non-Traditional Bonds',
  'Convertible Bonds',
  'Multi-Asset Income',
  'Preferred Stock',
  'Long/Short',
  'Real Estate',
  'Hedged/Enhanced',
  'Tactical',
  'Asset Allocation',
  'Sector Funds'
];

const normalizeGroupName = (name) =>
  String(name || '')
    .toLowerCase()
    .replace(/[()]/g, '')
    .replace(/[\s\-_/]+/g, '')
    .trim();

const GROUP_ORDER_INDEX = new Map(
  MONTHLY_PDF_GROUP_ORDER.map((label, i) => [normalizeGroupName(label), i])
);

const compareGroupsByMonthlyOrder = (aName, bName) => {
  const aKey = normalizeGroupName(aName);
  const bKey = normalizeGroupName(bName);
  const aIdx = GROUP_ORDER_INDEX.has(aKey) ? GROUP_ORDER_INDEX.get(aKey) : Number.MAX_SAFE_INTEGER;
  const bIdx = GROUP_ORDER_INDEX.has(bKey) ? GROUP_ORDER_INDEX.get(bKey) : Number.MAX_SAFE_INTEGER;
  if (aIdx !== bIdx) return aIdx - bIdx;
  return String(aName).localeCompare(String(bName));
};

export default function RecommendedList({ asOfMonth = null }) {
  // Use useFundData hook to get funds with scoring
  const { funds, loading, error: fundsError } = useFundData();
  
  const [benchmarks, setBenchmarks] = useState(new Map()); // asset_class_id -> benchmark row
  // const [error, setError] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState('All');

  // Filter for recommended funds from useFundData
  const recommendedFunds = useMemo(() => {
    if (!funds || funds.length === 0) return [];
    return funds.filter(fund => fund.is_recommended || fund.recommended);
  }, [funds]);

  // Set error from useFundData
  useEffect(() => {
    if (fundsError) {
      console.warn('RecommendedList: data error', fundsError);
    }
  }, [fundsError]);

  // After recommendedFunds load, fetch benchmark rows per asset class
  useEffect(() => {
    if (recommendedFunds.length === 0) return;
    let cancel = false;
    (async () => {
      try {
        // Warm benchmark mappings
        await prefetchBenchmarkMappings();

        // Determine target date (prefer perf_date on any fund)
        const targetDate = (() => {
          const d = recommendedFunds.find(f => f?.perf_date)?.perf_date;
          if (d) return d;
          if (asOfMonth) {
            try { return new Date(asOfMonth + '-01T00:00:00Z').toISOString().slice(0,10); } catch {}
          }
          return null;
        })();

        // Create map: asset_class_id -> sample fund
        const byAcId = new Map();
        (recommendedFunds || []).forEach(r => { if (r.asset_class_id) byAcId.set(r.asset_class_id, r); });
        const entries = Array.from(byAcId.entries());

        const results = await Promise.all(entries.map(async ([acId, sampleFund]) => {
          try {
            const benchInfo = getPrimaryBenchmark(sampleFund); // { ticker, name }
            const benchTicker = benchInfo?.ticker || null;
            const benchName = benchInfo?.name || 'Benchmark';
            if (!benchTicker) return [acId, null];

            // Fetch benchmark performance for the date
            let { data } = await supabase
              .from(TABLES.BENCHMARK_PERFORMANCE)
              .select('*')
              .eq('benchmark_ticker', benchTicker)
              .eq('date', targetDate)
              .maybeSingle();

            if (!data) {
              const res = await supabase
                .from(TABLES.BENCHMARK_PERFORMANCE)
                .select('*')
                .eq('benchmark_ticker', benchTicker)
                .order('date', { ascending: false })
                .limit(1);
              data = res?.data?.[0] || null;
            }

            const row = data ? {
              is_benchmark: true,
              ticker: benchTicker,
              name: benchName,
              asset_class_id: acId,
              asset_class_name: sampleFund.asset_class_name || sampleFund.asset_class || '',
              ytd_return: data.ytd_return ?? null,
              one_year_return: data.one_year_return ?? null,
              three_year_return: data.three_year_return ?? null,
              five_year_return: data.five_year_return ?? null,
              expense_ratio: data.expense_ratio ?? null,
              sharpe_ratio: data.sharpe_ratio ?? null,
              standard_deviation_3y: data.standard_deviation_3y ?? null,
              standard_deviation_5y: data.standard_deviation_5y ?? null,
              perf_date: data.date ?? targetDate
            } : null;

            return [acId, row];
          } catch { return [acId, null]; }
        }));

        if (!cancel) setBenchmarks(new Map(results));
      } catch {
        if (!cancel) setBenchmarks(new Map());
      }
    })();
    return () => { cancel = true; };
  }, [recommendedFunds, asOfMonth]);

  const groups = useMemo(() => {
    // Build present group list from data, then order by Monthly PDF sequence
    const present = new Set();
    (recommendedFunds || []).forEach(r => {
      const key = r.asset_class_name || r.asset_class || 'Unclassified';
      if (key) present.add(key);
    });
    const ordered = Array.from(present).sort(compareGroupsByMonthlyOrder);
    return ['All', ...ordered];
  }, [recommendedFunds]);

  const grouped = useMemo(() => {
    const map = new Map();
    (recommendedFunds || []).forEach(r => {
      const key = r.asset_class_name || r.asset_class || 'Unclassified';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    });
    return map;
  }, [recommendedFunds]);

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
        .sort(([aName], [bName]) => compareGroupsByMonthlyOrder(aName, bName))
        .filter(([name]) => selectedGroup === 'All' || name === selectedGroup)
        .map(([name, funds]) => {
          const acId = (funds[0] && funds[0].asset_class_id) || null;
          let bench = acId ? benchmarks.get(acId) : null;

          // If we have a benchmark row, compute its score relative to the funds in class
          if (bench) {
            try {
              const breakdown = getScoreBreakdown(bench, funds);
              const benchScore = Number(breakdown?.finalScore ?? null);
              if (Number.isFinite(benchScore)) {
                bench = {
                  ...bench,
                  score: benchScore,
                  score_final: benchScore,
                  scores: { final: benchScore }
                };
              }
            } catch (e) {
              // Non-fatal; keep benchmark without score
            }
          }

          // Sort funds by score desc (ignoring benchmark) and push benchmark last
          const fundRows = [...funds].sort((a, b) => {
            const sa = (a?.scores?.final ?? a?.score_final ?? a?.score);
            const sb = (b?.scores?.final ?? b?.score_final ?? b?.score);
            const aNum = Number.isFinite(Number(sa)) ? Number(sa) : -Infinity;
            const bNum = Number.isFinite(Number(sb)) ? Number(sb) : -Infinity;
            return bNum - aNum; // descending
          });

          const data = bench ? [...fundRows, bench] : fundRows;
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
            sortable={false}
            onRowClick={(f) => console.log('select', f?.ticker)}
          />
        </div>
      ); })}

      {!recommendedFunds.length && !loading && (
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
  { key: 'score', label: 'Score', width: '90px', numeric: true, align: 'right', accessor: (r) => (r?.scores?.final ?? r?.score_final ?? r?.score) ?? null, render: (v, row) => v != null ? (
    <ScoreTooltip fund={row} score={Number(v)}>
      {(() => {
        const s = Number(v);
        const color = getScoreColor(s);
        const label = getScoreLabel(s);
        return (
          <span
            className="number"
            style={{
              display: 'inline-block',
              padding: '2px 8px',
              borderRadius: 999,
              backgroundColor: '#ffffff',
              color,
              fontWeight: 600,
              minWidth: 54,
              textAlign: 'right',
              border: `1px solid ${color}40`,
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)'
            }}
            title={label}
          >
            {s.toFixed(1)}
          </span>
        );
      })()}
    </ScoreTooltip>
  ) : '—' },
  { key: 'ytdReturn', label: 'YTD', width: '80px', numeric: true, align: 'right', accessor: (r) => r.ytd_return ?? null, render: (v) => v != null ? `${Number(v).toFixed(2)}%` : '—' },
  { key: 'oneYear', label: '1Y', width: '80px', numeric: true, align: 'right', accessor: (r) => r.one_year_return ?? null, render: (v) => v != null ? `${Number(v).toFixed(2)}%` : '—' },
  { key: 'threeYear', label: '3Y', width: '80px', numeric: true, align: 'right', accessor: (r) => r.three_year_return ?? null, render: (v) => v != null ? `${Number(v).toFixed(2)}%` : '—' },
  { key: 'expense', label: 'Expense', width: '80px', numeric: true, align: 'right', accessor: (r) => r.expense_ratio ?? null, render: (v) => v != null ? `${Number(v).toFixed(2)}%` : '—' },
  { key: 'firmAUM', label: 'Firm AUM', width: '120px', numeric: true, align: 'right', accessor: (r) => r.firmAUM ?? null, render: (v) => v != null ? new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', maximumFractionDigits: 0 }).format(Number(v)) : '—' },
  { key: 'advisors', label: '# Advisors', width: '100px', numeric: true, align: 'right', accessor: (r) => r.advisorCount ?? null, render: (v) => v != null ? v : '—' }
];
