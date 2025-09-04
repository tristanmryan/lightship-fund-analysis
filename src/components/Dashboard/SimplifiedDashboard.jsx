import React, { useState, useMemo } from 'react';
import { useFundData } from '../../hooks/useFundData';
import SimpleKPIHeader from './SimpleKPIHeader';
import { supabase } from '../../services/supabase';
import SimpleFilterBar from './SimpleFilterBar';
import UnifiedFundTable from '../common/UnifiedFundTable';
import DashboardDebugPanel from './DashboardDebugPanel';

const SimplifiedDashboard = () => {
  const { funds, loading, error } = useFundData();
  const showDebug =
    process.env.REACT_APP_ENVIRONMENT === 'development' ||
    process.env.REACT_APP_DEBUG_MODE === 'true';
  
  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAssetClass, setSelectedAssetClass] = useState('');
  const [showRecommendedOnly, setShowRecommendedOnly] = useState(false);
  const [scoreRange, setScoreRange] = useState({ min: 0, max: 100 });

  // Derived data
  const assetClasses = useMemo(() => {
    const classes = new Set();
    (funds || []).forEach(fund => {
      const assetClass = fund.asset_class || fund.assetClass;
      if (assetClass) classes.add(assetClass);
    });
    return Array.from(classes).sort();
  }, [funds]);

  // Filtered funds
  const filteredFunds = useMemo(() => {
    if (!funds) return [];
    
    return funds.filter(fund => {
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const ticker = (fund.ticker || fund.symbol || '').toLowerCase();
        const name = (fund.name || fund.fund_name || '').toLowerCase();
        if (!ticker.includes(search) && !name.includes(search)) {
          return false;
        }
      }
      
      // Asset class filter
      if (selectedAssetClass) {
        const fundAssetClass = fund.asset_class || fund.assetClass;
        if (fundAssetClass !== selectedAssetClass) {
          return false;
        }
      }
      
      // Recommended only filter
      if (showRecommendedOnly && !fund.recommended) {
        return false;
      }
      
      // Score range filter
      if (fund.score != null) {
        if (fund.score < scoreRange.min || fund.score > scoreRange.max) {
          return false;
        }
      }
      
      return true;
    });
  }, [funds, searchTerm, selectedAssetClass, showRecommendedOnly, scoreRange]);

  // KPI calculations
  const kpiData = useMemo(() => {
    if (!funds || funds.length === 0) {
      return {
        portfolioAvgScore: 0,
        totalFunds: 0,
        recommendedCount: 0
      };
    }

    const validScores = funds.filter(f => f.score != null).map(f => f.score);
    const avgScore = validScores.length > 0 
      ? validScores.reduce((sum, score) => sum + score, 0) / validScores.length 
      : 0;

    const recommendedCount = funds.filter(f => f.recommended).length;

    return {
      portfolioAvgScore: avgScore,
      totalFunds: funds.length,
      recommendedCount
    };
  }, [funds]);

  // Live MV KPIs (latest holdings AUM and latest flows month)
  const [mvKpis, setMvKpis] = React.useState({ aum: null, flowsMonth: null, flowsTickers: 0 });
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: hdates } = await supabase
          .from('advisor_metrics_mv')
          .select('snapshot_date')
          .order('snapshot_date', { ascending: false })
          .limit(1);
        const holdingsDate = hdates?.[0]?.snapshot_date || null;
        let aum = 0; let flowsMonth = null; let flowsTickers = 0;
        if (holdingsDate) {
          const { data: rows } = await supabase.rpc('get_advisor_metrics', { p_date: holdingsDate, p_advisor_id: null });
          aum = (rows || []).reduce((s, r) => s + (r?.aum || 0), 0);
        }
        const { data: fmonths } = await supabase
          .from('fund_flows_mv')
          .select('month')
          .order('month', { ascending: false })
          .limit(1);
        flowsMonth = fmonths?.[0]?.month || null;
        if (flowsMonth) {
          const { data: flows } = await supabase.rpc('get_fund_flows', { p_month: flowsMonth, p_ticker: null, p_limit: 1000 });
          flowsTickers = (flows || []).length;
        }
        if (!cancelled) setMvKpis({ aum, flowsMonth, flowsTickers });
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  // Clear all filters
  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedAssetClass('');
    setShowRecommendedOnly(false);
    setScoreRange({ min: 0, max: 100 });
  };

  if (error) {
    return (
      <div className="simplified-dashboard">
        <div className="error-message">
          <h2>Failed to load fund data</h2>
          <p>{error.message || 'An unexpected error occurred'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="simplified-dashboard">
      {/* KPI Header */}
      <SimpleKPIHeader 
        {...kpiData}
        loading={loading}
      />
      {/* MV KPIs row */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '8px 0 12px' }}>
        <div className="kpi-metric" style={{ minWidth: 160 }}>
          <div className="kpi-value" style={{ color: '#002D72' }}>
            {mvKpis.aum == null ? '—' : new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(mvKpis.aum)}
          </div>
          <div className="kpi-label">Firm AUM (latest holdings)</div>
        </div>
        <div className="kpi-metric" style={{ minWidth: 160 }}>
          <div className="kpi-value" style={{ color: '#6B7280' }}>
            {mvKpis.flowsMonth || '—'}
          </div>
          <div className="kpi-label">Flows Month (tickers {mvKpis.flowsTickers || 0})</div>
        </div>
      </div>

      {/* Filter Bar */}
      <SimpleFilterBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        selectedAssetClass={selectedAssetClass}
        onAssetClassChange={setSelectedAssetClass}
        assetClasses={assetClasses}
        showRecommendedOnly={showRecommendedOnly}
        onRecommendedOnlyChange={setShowRecommendedOnly}
        scoreRange={scoreRange}
        onScoreRangeChange={setScoreRange}
        onClearFilters={handleClearFilters}
      />

      {/* Main Content */}
      <div className="card" style={{ padding: 8 }}>
        <div className="card-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h3 className="card-title" style={{ margin: 0 }}>Fund Overview</h3>
        </div>
        <UnifiedFundTable
          funds={filteredFunds}
          loading={loading}
          preset="core"
          initialSortConfig={[{ key: 'score', direction: 'desc' }]}
          chartPeriod="1Y"
        />
      </div>

      {showDebug && (
        <DashboardDebugPanel funds={funds} loading={loading} />
      )}
    </div>
  );
};

export default SimplifiedDashboard;
