import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import ProfessionalTable from '../tables/ProfessionalTable';
import { getAdvisorName, getAdvisorOptions } from '../../config/advisorNames';
import ScoreTooltip from '../Dashboard/ScoreTooltip';
import fundService from '../../services/fundService.js';
import advisorService from '../../services/advisorService.js';
import flowsService from '../../services/flowsService.js';
import { supabase } from '../../services/supabase.js';

export default function Portfolios() {
  const [view, setView] = useState('advisor'); // 'advisor' | 'fund' | 'gaps'
  const location = useLocation();

  // Auto-open By Fund when deep linked with ?ticker=
  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search);
      if (params.get('ticker')) setView('fund');
    } catch {}
  }, [location.search]);

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="card" style={{ padding: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>Portfolios</div>
          <div style={{ display: 'inline-flex', gap: 6 }} role="tablist" aria-label="Portfolios view">
            <button role="tab" aria-selected={view === 'advisor'} className={view === 'advisor' ? 'btn' : 'btn btn-secondary'} onClick={() => setView('advisor')}>By Advisor</button>
            <button role="tab" aria-selected={view === 'fund'} className={view === 'fund' ? 'btn' : 'btn btn-secondary'} onClick={() => setView('fund')}>By Fund</button>
            <button role="tab" aria-selected={view === 'gaps'} className={view === 'gaps' ? 'btn' : 'btn btn-secondary'} onClick={() => setView('gaps')}>Gap Analysis</button>
          </div>
        </div>
      </div>

      {view === 'advisor' && <ByAdvisorView />}
      {view === 'fund' && <ByFundView />}
      {view === 'gaps' && <GapAnalysisView />}
    </div>
  );
}

function ByAdvisorView() {
  const [dates, setDates] = useState([]);
  const [date, setDate] = useState('');
  const [advisors, setAdvisors] = useState([]);
  const [advisorName, setAdvisorName] = useState(''); // Always work with advisor names
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [portfolio, setPortfolio] = useState(null);
  const [fundsWithOwnership, setFundsWithOwnership] = useState([]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const ds = await advisorService.listSnapshotDates();
        if (cancel) return;
        setDates(ds);
        if (ds && ds.length > 0) setDate(prev => prev || ds[0]);
      } catch (e) { if (!cancel) setError(e.message || String(e)); }
    })();
    return () => { cancel = true; };
  }, []);

  useEffect(() => {
    if (!date) return;
    let cancel = false;
    (async () => {
      try {
        setError(null);
        // Always get consolidated advisor list (consolidateByName = true)
        const rows = await advisorService.listAdvisorsForDate(date, true);
        if (cancel) return;
        setAdvisors(rows);
        if (rows && rows.length > 0) setAdvisorName(prev => prev || rows[0].advisor_name);
      } catch (e) { if (!cancel) setError(e.message || String(e)); }
    })();
    return () => { cancel = true; };
  }, [date]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const data = await fundService.getFundsWithOwnership(date);
        if (!cancel) setFundsWithOwnership(Array.isArray(data) ? data : []);
      } catch { if (!cancel) setFundsWithOwnership([]); }
    })();
    return () => { cancel = true; };
  }, [date]);

  useEffect(() => {
    if (!date || !advisorName) return;
    let cancel = false;
    (async () => {
      try {
        setLoading(true); setError(null);
        // The service now handles both advisor names and IDs transparently
        const breakdown = await advisorService.computePortfolioBreakdown(date, advisorName);
        if (!cancel) setPortfolio(breakdown || null);
      } catch (e) { if (!cancel) setError(e.message || String(e)); }
      finally { if (!cancel) setLoading(false); }
    })();
    return () => { cancel = true; };
  }, [date, advisorName]);

  const fundsMap = useMemo(() => {
    const m = new Map();
    (fundsWithOwnership || []).forEach(f => m.set(String(f.ticker || '').toUpperCase(), f));
    return m;
  }, [fundsWithOwnership]);

  // Get ownership data for all tickers in portfolio
  const [ownershipData, setOwnershipData] = useState(new Map());

  useEffect(() => {
    if (!date) return;
    let cancel = false;
    (async () => {
      try {
        const ownership = await fundService.getOwnershipSummary(date);
        if (!cancel) setOwnershipData(ownership);
      } catch { if (!cancel) setOwnershipData(new Map()); }
    })();
    return () => { cancel = true; };
  }, [date]);

  const tableRows = useMemo(() => {
    const positions = portfolio?.positions || [];
    return positions.map(p => {
      const ticker = String(p.ticker || '').toUpperCase();
      const meta = fundsMap.get(ticker) || {};
      const ownership = ownershipData.get(ticker) || {};
      
      return {
        ticker: p.ticker,
        symbol: p.ticker,
        name: meta.name || p.ticker,
        // Prefer normalized asset_class_name, then legacy string, then Unclassified
        asset_class_name: meta.asset_class_name || meta.asset_class || 'Unclassified',
        asset_class: meta.asset_class || meta.asset_class_name || 'Unclassified',
        advisorAUM: Number(p.amount || 0), // Scott's personal position
        firmAUM: Number(ownership.firm_aum || 0), // Total firm-wide AUM
        advisorCount: Number(ownership.advisor_count || 0),
        is_recommended: !!meta.is_recommended,
        is_benchmark: !!meta.is_benchmark,
        score_final: (meta?.scores?.final ?? meta?.score_final ?? meta?.score ?? null),
        scores: meta.scores
      };
    });
  }, [portfolio, fundsMap, ownershipData]);

  // Apply search filter to table rows
  const filteredTableRows = useMemo(() => {
    const q = String(searchQuery || '').trim().toLowerCase();
    if (!q) return tableRows;
    
    return tableRows.filter((row) => {
      const t = String(row.ticker || '').toLowerCase();
      const n = String(row.name || '').toLowerCase();
      const ac = String(row.asset_class_name || row.asset_class || '').toLowerCase();
      return t.includes(q) || n.includes(q) || ac.includes(q);
    });
  }, [tableRows, searchQuery]);

  const alignmentPct = useMemo(() => {
    if (!portfolio || !portfolio.totalAum) return 0;
    return (Number(portfolio.recommendedAum || 0) / Number(portfolio.totalAum || 1)) * 100;
  }, [portfolio]);

  const concentrationCount = useMemo(() => (portfolio?.concentrationAlerts || []).length, [portfolio]);

  const advisorOptions = getAdvisorOptions();

  return (
    <div className="card" style={{ padding: 12 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: 12, color: '#6b7280' }}>Snapshot</label><br />
          <select value={date} onChange={e => { setDate(e.target.value); setAdvisorName(''); }}>
            {(dates || []).map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, color: '#6b7280' }}>Advisor</label><br />
          <select value={advisorName} onChange={e => setAdvisorName(e.target.value)}>
            <option value="">Select Advisor</option>
            {advisorOptions.map(option => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="card" style={{ padding: 8, display: 'inline-flex', gap: 12, alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: '#6b7280' }}>% in Recommended</div>
          <div style={{ fontWeight: 700 }}>{alignmentPct.toFixed(1)}%</div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Concentration Flags</div>
          <div style={{ fontWeight: 700 }}>{concentrationCount}</div>
          {portfolio?.totalAum && (
            <>
              <div style={{ fontSize: 12, color: '#6b7280' }}>Total AUM</div>
              <div style={{ fontWeight: 700 }}>{fmtUSD(portfolio.totalAum)}</div>
            </>
          )}
          {portfolio?.usedSnapshotDate && (
            <>
              <div style={{ fontSize: 12, color: '#6b7280' }}>Snapshot Used</div>
              <div style={{ fontWeight: 700 }}>
                {portfolio.usedSnapshotDate}
                {date && portfolio.usedSnapshotDate !== date ? ' (fallback)' : ''}
              </div>
            </>
          )}
        </div>
        {loading && <div style={{ color: '#6b7280' }}>Loading...</div>}
        {error && <div className="alert alert-error">{error}</div>}
      </div>

      <div style={{ marginTop: 12 }}>
        <div className="table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>Portfolio Holdings</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ticker, name, asset class"
              aria-label="Search portfolio holdings"
              style={{ padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: 6, minWidth: 220 }}
            />
          </div>
        </div>
        <ProfessionalTable
          data={filteredTableRows}
          columns={ADVISOR_FUNDS_COLUMNS}
          onRowClick={(f) => console.log('select', f?.ticker)}
        />
      </div>
    </div>
  );
}

function ByFundView() {
  const location = useLocation();
  const [months, setMonths] = useState([]);
  const [month, setMonth] = useState('');
  const [ticker, setTicker] = useState('');
  const [fundRow, setFundRow] = useState(null);
  const [holders, setHolders] = useState([]);
  const [flows, setFlows] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // parse ?ticker=
  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search);
      const t = params.get('ticker');
      if (t) setTicker(String(t).toUpperCase());
    } catch {}
  }, [location.search]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const ms = await fundService.listSnapshotMonths(24);
        if (cancel) return;
        setMonths(ms);
        if (ms && ms.length > 0) setMonth(prev => prev || ms[0]);
      } catch (e) { if (!cancel) setError(e.message || String(e)); }
    })();
    return () => { cancel = true; };
  }, []);

  const loadData = useCallback(async (m, t) => {
    if (!m || !t) return;
    setLoading(true); setError(null);
    try {
      // fund row with ownership
      const rows = await fundService.getFundsWithOwnership(m);
      const map = new Map((rows || []).map(r => [String(r.ticker).toUpperCase(), r]));
      const fr = map.get(String(t).toUpperCase()) || null;
      setFundRow(fr);
      // holders by advisor - consolidated by advisor name
      try {
        const { data, error } = await supabase
          .from('client_holdings')
          .select('advisor_id, market_value')
          .eq('snapshot_date', m)
          .eq('ticker', t);
        if (error) throw error;
        
        // Group by advisor name instead of advisor ID
        const consolidatedByName = new Map();
        for (const r of data || []) {
          const advisorName = getAdvisorName(r.advisor_id);
          const amt = Number(r.market_value || 0);
          consolidatedByName.set(advisorName, (consolidatedByName.get(advisorName) || 0) + amt);
        }
        
        const rows2 = Array.from(consolidatedByName.entries()).map(([advisor_name, amount]) => ({ advisor_name, amount }))
          .sort((a,b) => b.amount - a.amount)
          .slice(0, 200);
        setHolders(rows2);
      } catch { setHolders([]); }
      // flows for this ticker/month
      try {
        const [row] = await flowsService.getTopMovers({ month: m, ticker: t, limit: 1 });
        setFlows(row || null);
      } catch { setFlows(null); }
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (month && ticker) loadData(month, ticker); }, [month, ticker, loadData]);

  return (
    <div className="card" style={{ padding: 12 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: 12, color: '#6b7280' }}>Month</label><br />
          <select value={month} onChange={e => setMonth(e.target.value)}>
            {(months || []).map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, color: '#6b7280' }}>Fund</label><br />
          <input type="text" placeholder="Ticker (e.g., SPY)" value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())} />
        </div>
        {loading && <div style={{ color: '#6b7280' }}>Loading...</div>}
        {error && <div className="alert alert-error">{error}</div>}
      </div>

      {fundRow && (
        <div className="card" style={{ padding: 12, marginTop: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Firm Position</div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <Metric label="Ticker" value={fundRow.ticker} />
            <Metric label="Name" value={fundRow.name || fundRow.ticker} />
            <Metric label="Asset Class" value={fundRow.asset_class_name || fundRow.asset_class || 'Unclassified'} />
            <Metric label="Firm AUM" value={fmtUSD(fundRow.firmAUM)} />
            <Metric label="# Advisors" value={String(fundRow.advisorCount || 0)} />
            {typeof fundRow?.scores?.final === 'number' && (
              <Metric label="Score" value={fundRow.scores.final.toFixed(1)} />
            )}
          </div>
        </div>
      )}

      {flows && (
        <div className="card" style={{ padding: 12, marginTop: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Recent Trading Activity ({month})</div>
          <div style={{ display: 'flex', gap: 16 }}>
            <Metric label="Inflows" value={fmtUSD(flows.inflows)} />
            <Metric label="Outflows" value={fmtUSD(flows.outflows)} />
            <Metric label="Net" value={fmtUSD(flows.net_flow)} />
            <Metric label="Advisors Trading" value={String(flows.advisors_trading || 0)} />
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 12, marginTop: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Advisors Holding {ticker || ''}</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid #e5e7eb' }}>Advisor</th>
                <th style={{ textAlign: 'right', padding: 6, borderBottom: '1px solid #e5e7eb' }}>Total Amount</th>
              </tr>
            </thead>
            <tbody>
                {(holders || []).map((r, i) => (
                  <tr key={i}>
                    <td style={{ padding: 6, borderBottom: '1px solid #f3f4f6' }}>{r.advisor_name}</td>
                    <td style={{ padding: 6, borderBottom: '1px solid #f3f4f6', textAlign: 'right' }}>{fmtUSD(r.amount)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          {(!holders || holders.length === 0) && (
            <div style={{ fontSize: 12, color: '#6b7280' }}>No advisors currently holding this fund for {month}.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function GapAnalysisView() {
  const [dates, setDates] = useState([]);
  const [date, setDate] = useState('');
  const [advisors, setAdvisors] = useState([]);
  const [advisorName, setAdvisorName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [portfolio, setPortfolio] = useState(null);
  const [recommended, setRecommended] = useState([]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const ds = await advisorService.listSnapshotDates();
        if (cancel) return;
        setDates(ds);
        if (ds && ds.length > 0) setDate(prev => prev || ds[0]);
      } catch (e) { if (!cancel) setError(e.message || String(e)); }
    })();
    return () => { cancel = true; };
  }, []);

  useEffect(() => {
    if (!date) return;
    let cancel = false;
    (async () => {
      try {
        setError(null);
        const rows = await advisorService.listAdvisorsForDate(date, true);
        if (cancel) return;
        setAdvisors(rows);
        if (rows && rows.length > 0) setAdvisorName(prev => prev || rows[0].advisor_name);
      } catch (e) { if (!cancel) setError(e.message || String(e)); }
    })();
    return () => { cancel = true; };
  }, [date]);

  useEffect(() => {
    if (!date || !advisorName) return;
    let cancel = false;
    (async () => {
      try {
        setLoading(true); setError(null);
        const [breakdown, rec] = await Promise.all([
          advisorService.computePortfolioBreakdown(date, advisorName),
          fundService.getRecommendedFundsWithOwnership(date)
        ]);
        if (cancel) return;
        setPortfolio(breakdown || null);
        setRecommended(rec || []);
      } catch (e) { if (!cancel) setError(e.message || String(e)); }
      finally { if (!cancel) setLoading(false); }
    })();
    return () => { cancel = true; };
  }, [date, advisorName]);

  const heldSet = useMemo(() => new Set((portfolio?.positions || []).map(p => String(p.ticker || '').toUpperCase())), [portfolio]);
  const recSet = useMemo(() => new Set((recommended || []).map(f => String(f.ticker || '').toUpperCase())), [recommended]);

  const recommendedNotHeld = useMemo(() => Array.from(recSet).filter(t => !heldSet.has(t)).slice(0, 50), [recSet, heldSet]);
  const underOwned = useMemo(() => {
    // heuristic: among held recommended, sort by pct ascending and pick bottom 10
    const positions = (portfolio?.positions || []).filter(p => p.is_recommended);
    return positions.slice().sort((a, b) => (a.pct || 0) - (b.pct || 0)).slice(0, 10);
  }, [portfolio]);
  const nonRecommendedPositions = useMemo(() => (portfolio?.positions || []).filter(p => !p.is_recommended).slice(0, 20), [portfolio]);

  const advisorOptions = getAdvisorOptions();

  return (
    <div className="card" style={{ padding: 12 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: 12, color: '#6b7280' }}>Snapshot</label><br />
          <select value={date} onChange={e => { setDate(e.target.value); setAdvisorName(''); }}>
            {(dates || []).map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, color: '#6b7280' }}>Advisor</label><br />
          <select value={advisorName} onChange={e => setAdvisorName(e.target.value)}>
            <option value="">Select Advisor</option>
            {advisorOptions.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        {loading && <div style={{ color: '#6b7280' }}>Loading...</div>}
        {error && <div className="alert alert-error">{error}</div>}
      </div>

      <div className="grid-3" style={{ marginTop: 12 }}>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Recommended Not Held</div>
          {(recommendedNotHeld || []).length === 0 && (
            <div style={{ fontSize: 12, color: '#6b7280' }}>No gaps detected.</div>
          )}
          {(recommendedNotHeld || []).map((t, i) => (
            <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>{t}</div>
          ))}
        </div>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Under-Owned Recommended</div>
          {(underOwned || []).length === 0 && (
            <div style={{ fontSize: 12, color: '#6b7280' }}>No under-owned recommended positions.</div>
          )}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid #e5e7eb' }}>Ticker</th>
                  <th style={{ textAlign: 'right', padding: 6, borderBottom: '1px solid #e5e7eb' }}>% of AUM</th>
                </tr>
              </thead>
              <tbody>
                {(underOwned || []).map((p, i) => (
                  <tr key={i}>
                    <td style={{ padding: 6, borderBottom: '1px solid #f3f4f6' }}>{p.ticker}</td>
                    <td style={{ padding: 6, textAlign: 'right', borderBottom: '1px solid #f3f4f6' }}>{(Number(p.pct || 0) * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Non-Recommended Positions</div>
          {(nonRecommendedPositions || []).length === 0 && (
            <div style={{ fontSize: 12, color: '#6b7280' }}>No non-recommended positions.</div>
          )}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid #e5e7eb' }}>Ticker</th>
                  <th style={{ textAlign: 'right', padding: 6, borderBottom: '1px solid #e5e7eb' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {(nonRecommendedPositions || []).map((p, i) => (
                  <tr key={i}>
                    <td style={{ padding: 6, borderBottom: '1px solid #f3f4f6' }}>{p.ticker}</td>
                    <td style={{ padding: 6, textAlign: 'right', borderBottom: '1px solid #f3f4f6' }}>{fmtUSD(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

const ADVISOR_FUNDS_COLUMNS = [
  { key: 'ticker', label: 'Ticker', width: '90px', accessor: (r) => r.ticker, render: (v) => <span style={{ fontWeight: 600 }}>{v}</span> },
  { key: 'name', label: 'Fund Name', width: '240px', accessor: (r) => r.name || '' },
  { key: 'assetClass', label: 'Asset Class', width: '160px', accessor: (r) => r.asset_class_name || r.asset_class || '' },
  { key: 'advisorAUM', label: 'Position', width: '120px', numeric: true, align: 'right', accessor: (r) => r.advisorAUM ?? null, render: (v) => v != null ? new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', maximumFractionDigits: 0 }).format(Number(v)) : '—' },
  { key: 'score', label: 'Score', width: '80px', numeric: true, align: 'right', accessor: (r) => (r?.scores?.final ?? r?.score_final ?? r?.score) ?? null, render: (v, row) => v != null ? (
    <ScoreTooltip fund={row} score={Number(v)}>
      <span className="number">{Number(v).toFixed(1)}</span>
    </ScoreTooltip>
  ) : '—' },
  { key: 'firmAUM', label: 'Firm AUM', width: '120px', numeric: true, align: 'right', accessor: (r) => r.firmAUM ?? null, render: (v) => v != null ? new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', maximumFractionDigits: 0 }).format(Number(v)) : '—' },
  { key: 'advisors', label: '# Advisors', width: '110px', numeric: true, align: 'right', accessor: (r) => r.advisorCount ?? null }
];

function Metric({ label, value }) {
  return (
    <div style={{ minWidth: 140 }}>
      <div style={{ fontSize: 12, color: '#6b7280' }}>{label}</div>
      <div style={{ fontWeight: 700 }}>{value ?? '–'}</div>
    </div>
  );
}

function fmtUSD(v) {
  const n = Number(v || 0);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}