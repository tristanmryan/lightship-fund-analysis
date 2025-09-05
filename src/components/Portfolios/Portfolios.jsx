import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import ProfessionalTable from '../tables/ProfessionalTable';
import { getAdvisorName } from '../../config/advisorNames';
import fundService from '../../services/fundService.js';
import advisorService from '../../services/advisorService.js';
import flowsService from '../../services/flowsService.js';
import { supabase } from '../../services/supabase.js';

export default function Portfolios() {
  const [view, setView] = useState('advisor'); // 'advisor' | 'fund' | 'gaps'

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
  const [advisorId, setAdvisorId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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
        const rows = await advisorService.listAdvisorsForDate(date);
        if (cancel) return;
        setAdvisors(rows);
        if (rows && rows.length > 0) setAdvisorId(prev => prev || rows[0].advisor_id);
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
    if (!date || !advisorId) return;
    let cancel = false;
    (async () => {
      try {
        setLoading(true); setError(null);
        const breakdown = await advisorService.computePortfolioBreakdown(date, advisorId);
        if (!cancel) setPortfolio(breakdown || null);
      } catch (e) { if (!cancel) setError(e.message || String(e)); }
      finally { if (!cancel) setLoading(false); }
    })();
    return () => { cancel = true; };
  }, [date, advisorId]);

  const fundsMap = useMemo(() => {
    const m = new Map();
    (fundsWithOwnership || []).forEach(f => m.set(String(f.ticker || '').toUpperCase(), f));
    return m;
  }, [fundsWithOwnership]);

  const tableRows = useMemo(() => {
    const positions = portfolio?.positions || [];
    return positions.map(p => {
      const meta = fundsMap.get(String(p.ticker || '').toUpperCase());
      return meta ? meta : { ticker: p.ticker, symbol: p.ticker, name: p.ticker, asset_class: 'Unclassified', firmAUM: 0, advisorCount: 0 };
    });
  }, [portfolio, fundsMap]);

  const alignmentPct = useMemo(() => {
    if (!portfolio || !portfolio.totalAum) return 0;
    return (Number(portfolio.recommendedAum || 0) / Number(portfolio.totalAum || 1)) * 100;
  }, [portfolio]);

  const concentrationCount = useMemo(() => (portfolio?.concentrationAlerts || []).length, [portfolio]);

  return (
    <div className="card" style={{ padding: 12 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: 12, color: '#6b7280' }}>Snapshot</label><br />
          <select value={date} onChange={e => { setDate(e.target.value); setAdvisorId(''); }}>
            {(dates || []).map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, color: '#6b7280' }}>Advisor</label><br />
          <select value={advisorId} onChange={e => setAdvisorId(e.target.value)}>
            {(advisors || []).map(a => <option key={a.advisor_id} value={a.advisor_id}>{getAdvisorName(a.advisor_id)}</option>)}
          </select>
        </div>
        <div className="card" style={{ padding: 8, display: 'inline-flex', gap: 12, alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: '#6b7280' }}>% in Recommended</div>
          <div style={{ fontWeight: 700 }}>{alignmentPct.toFixed(1)}%</div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Concentration Flags</div>
          <div style={{ fontWeight: 700 }}>{concentrationCount}</div>
        </div>
        {loading && <div style={{ color: '#6b7280' }}>Loading...</div>}
        {error && <div className="alert alert-error">{error}</div>}
      </div>

      <div style={{ marginTop: 12 }}>
        <ProfessionalTable
          data={tableRows}
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
      // holders by advisor
      try {
        const { data, error } = await supabase
          .from('client_holdings')
          .select('advisor_id, market_value')
          .eq('snapshot_date', m)
          .eq('ticker', t);
        if (error) throw error;
        const agg = new Map();
        for (const r of data || []) {
          const id = r.advisor_id; const amt = Number(r.market_value || 0);
          agg.set(id, (agg.get(id) || 0) + amt);
        }
        const rows2 = Array.from(agg.entries()).map(([advisor_id, amount]) => ({ advisor_id, amount }))
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
                <th style={{ textAlign: 'right', padding: 6, borderBottom: '1px solid #e5e7eb' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
                {(holders || []).map((r, i) => {
                  const id = r.advisor_id;
                  const name = getAdvisorName(id);
                  return (
                    <tr key={i}>
                      <td style={{ padding: 6, borderBottom: '1px solid #f3f4f6' }}>{name}</td>
                      <td style={{ padding: 6, borderBottom: '1px solid #f3f4f6', textAlign: 'right' }}>{fmtUSD(r.amount)}</td>
                    </tr>
                  );
                })}
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
  const [advisorId, setAdvisorId] = useState('');
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
        const rows = await advisorService.listAdvisorsForDate(date);
        if (cancel) return;
        setAdvisors(rows);
        if (rows && rows.length > 0) setAdvisorId(prev => prev || rows[0].advisor_id);
      } catch (e) { if (!cancel) setError(e.message || String(e)); }
    })();
    return () => { cancel = true; };
  }, [date]);

  useEffect(() => {
    if (!date || !advisorId) return;
    let cancel = false;
    (async () => {
      try {
        setLoading(true); setError(null);
        const [breakdown, rec] = await Promise.all([
          advisorService.computePortfolioBreakdown(date, advisorId),
          fundService.getRecommendedFundsWithOwnership(date)
        ]);
        if (cancel) return;
        setPortfolio(breakdown || null);
        setRecommended(rec || []);
      } catch (e) { if (!cancel) setError(e.message || String(e)); }
      finally { if (!cancel) setLoading(false); }
    })();
    return () => { cancel = true; };
  }, [date, advisorId]);

  const heldSet = useMemo(() => new Set((portfolio?.positions || []).map(p => String(p.ticker || '').toUpperCase())), [portfolio]);
  const recSet = useMemo(() => new Set((recommended || []).map(f => String(f.ticker || '').toUpperCase())), [recommended]);

  const recommendedNotHeld = useMemo(() => Array.from(recSet).filter(t => !heldSet.has(t)).slice(0, 50), [recSet, heldSet]);
  const underOwned = useMemo(() => {
    // heuristic: among held recommended, sort by pct ascending and pick bottom 10
    const positions = (portfolio?.positions || []).filter(p => p.is_recommended);
    return positions.slice().sort((a, b) => (a.pct || 0) - (b.pct || 0)).slice(0, 10);
  }, [portfolio]);
  const nonRecommendedPositions = useMemo(() => (portfolio?.positions || []).filter(p => !p.is_recommended).slice(0, 20), [portfolio]);

  return (
    <div className="card" style={{ padding: 12 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: 12, color: '#6b7280' }}>Snapshot</label><br />
          <select value={date} onChange={e => { setDate(e.target.value); setAdvisorId(''); }}>
            {(dates || []).map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, color: '#6b7280' }}>Advisor</label><br />
          <select value={advisorId} onChange={e => setAdvisorId(e.target.value)}>
            {(advisors || []).map(a => <option key={a.advisor_id} value={a.advisor_id}>{getAdvisorName(a.advisor_id)}</option>)}
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
  { key: 'score', label: 'Score', width: '80px', numeric: true, align: 'right', accessor: (r) => (r?.scores?.final ?? r?.score_final ?? r?.score) ?? null, render: (v) => v != null ? Number(v).toFixed(1) : '—' },
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
