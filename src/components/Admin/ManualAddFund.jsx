// src/components/Admin/ManualAddFund.jsx
import React, { useEffect, useState } from 'react';
import { supabase, TABLES, dbUtils } from '../../services/supabase';
import { invalidateReferenceCaches } from '../../services/resolvers';

const FLAG_ENABLE_MANUAL_ADD = (process.env.REACT_APP_ENABLE_ADMIN_MANUAL_ADD || 'true') === 'true';

const ManualAddFund = () => {
  const [enabled, setEnabled] = useState(FLAG_ENABLE_MANUAL_ADD);
  const [assetClasses, setAssetClasses] = useState([]);
  const [form, setForm] = useState({ ticker: '', name: '', asset_class_id: '', ytd: '', y1: '', y3: '', y5: '', y10: '', sharpe: '', stdev: '', exp: '', alpha: '', beta: '' });
  const [overwriteMissing, setOverwriteMissing] = useState(false);
  const [todayRowMeta, setTodayRowMeta] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from(TABLES.ASSET_CLASSES).select('id, name').order('group_name').order('sort_order');
      setAssetClasses(data || []);
    };
    load();
  }, []);

  // Fetch today's row meta when ticker changes
  useEffect(() => {
    const fetchMeta = async () => {
      const t = (form.ticker || '').toUpperCase().trim();
      if (!t) { setTodayRowMeta(null); return; }
      const { data, error } = await supabase
        .from(TABLES.FUND_PERFORMANCE)
        .select('fund_ticker, date, created_at')
        .eq('fund_ticker', t)
        .eq('date', new Date().toISOString().slice(0,10))
        .maybeSingle();
      if (data) setTodayRowMeta(data); else setTodayRowMeta(null);
    };
    fetchMeta();
  }, [form.ticker]);

  if (!enabled) return null;

  const onChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const onSave = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      const ticker = (form.ticker || '').toUpperCase().trim();
      if (!ticker || !form.name || !form.asset_class_id) {
        setError('Ticker, Name, and Asset Class are required');
        setSaving(false);
        return;
      }
      // Upsert fund
      await supabase.from(TABLES.FUNDS).upsert({
        ticker,
        name: form.name,
        asset_class_id: form.asset_class_id,
        asset_class: null,
        is_recommended: false,
        last_updated: dbUtils.formatDate(new Date())
      }, { onConflict: 'ticker' });

      // Upsert performance for today if any numeric input provided
      const hasPerf = [form.ytd, form.y1, form.y3, form.y5, form.y10, form.sharpe, form.stdev, form.exp, form.alpha, form.beta]
        .some(v => String(v || '').trim() !== '');
      if (hasPerf) {
        const today = new Date().toISOString().slice(0,10);
        if (overwriteMissing) {
          // Build a full row with NULLs for unspecified fields
          const row = {
            fund_ticker: ticker,
            date: today,
            ytd_return: form.ytd === '' ? null : dbUtils.parseNumeric(form.ytd),
            one_year_return: form.y1 === '' ? null : dbUtils.parseNumeric(form.y1),
            three_year_return: form.y3 === '' ? null : dbUtils.parseNumeric(form.y3),
            five_year_return: form.y5 === '' ? null : dbUtils.parseNumeric(form.y5),
            ten_year_return: form.y10 === '' ? null : dbUtils.parseNumeric(form.y10),
            sharpe_ratio: form.sharpe === '' ? null : dbUtils.parseNumeric(form.sharpe),
            standard_deviation: form.stdev === '' ? null : dbUtils.parseNumeric(form.stdev),
            expense_ratio: form.exp === '' ? null : dbUtils.parseNumeric(form.exp),
            alpha: form.alpha === '' ? null : dbUtils.parseNumeric(form.alpha),
            beta: form.beta === '' ? null : dbUtils.parseNumeric(form.beta),
            manager_tenure: null
          };
          await supabase.from(TABLES.FUND_PERFORMANCE).upsert(row, { onConflict: 'fund_ticker,date' });
        } else {
          // Merge only provided fields; avoid nulling unspecified fields
          const patch = { fund_ticker: ticker, date: today };
          if (form.ytd !== '') patch.ytd_return = dbUtils.parseNumeric(form.ytd);
          if (form.y1 !== '') patch.one_year_return = dbUtils.parseNumeric(form.y1);
          if (form.y3 !== '') patch.three_year_return = dbUtils.parseNumeric(form.y3);
          if (form.y5 !== '') patch.five_year_return = dbUtils.parseNumeric(form.y5);
          if (form.y10 !== '') patch.ten_year_return = dbUtils.parseNumeric(form.y10);
          if (form.sharpe !== '') patch.sharpe_ratio = dbUtils.parseNumeric(form.sharpe);
          if (form.stdev !== '') patch.standard_deviation = dbUtils.parseNumeric(form.stdev);
          if (form.exp !== '') patch.expense_ratio = dbUtils.parseNumeric(form.exp);
          if (form.alpha !== '') patch.alpha = dbUtils.parseNumeric(form.alpha);
          if (form.beta !== '') patch.beta = dbUtils.parseNumeric(form.beta);
          await supabase.from(TABLES.FUND_PERFORMANCE).upsert(patch, { onConflict: 'fund_ticker,date' });
        }
      }

      invalidateReferenceCaches();
      setSuccess('Fund saved');
      setForm({ ticker: '', name: '', asset_class_id: '', ytd: '', y1: '', y3: '', y5: '', y10: '', sharpe: '', stdev: '', exp: '', alpha: '', beta: '' });
      setTodayRowMeta(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card" style={{ marginTop: '1rem' }}>
      <div className="card-header">
        <h3 className="card-title">Add Fund (manual) — testing only</h3>
        <p className="card-subtitle">Temporarily available while API integration finalizes</p>
      </div>
      <div style={{ padding: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))', gap: '0.75rem' }}>
        <input name="ticker" placeholder="Ticker" value={form.ticker} onChange={onChange} />
        <input name="name" placeholder="Name" value={form.name} onChange={onChange} />
        <select name="asset_class_id" value={form.asset_class_id} onChange={onChange}>
          <option value="">Select Asset Class…</option>
          {assetClasses.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <input name="ytd" placeholder="YTD %" value={form.ytd} onChange={onChange} />
        <input name="y1" placeholder="1Y %" value={form.y1} onChange={onChange} />
        <input name="y3" placeholder="3Y %" value={form.y3} onChange={onChange} />
        <input name="y5" placeholder="5Y %" value={form.y5} onChange={onChange} />
        <input name="y10" placeholder="10Y %" value={form.y10} onChange={onChange} />
        <input name="sharpe" placeholder="Sharpe" value={form.sharpe} onChange={onChange} />
        <input name="stdev" placeholder="Std Dev" value={form.stdev} onChange={onChange} />
        <input name="exp" placeholder="Expense %" value={form.exp} onChange={onChange} />
        <input name="alpha" placeholder="Alpha" value={form.alpha} onChange={onChange} />
        <input name="beta" placeholder="Beta" value={form.beta} onChange={onChange} />
      </div>
      <div style={{ padding: '0 1rem 1rem' }}>
        {todayRowMeta && (
          <div style={{ marginBottom: 8, color: '#6b7280', fontSize: 12 }}>
            Updating today’s row (last updated: {new Date(todayRowMeta.created_at || todayRowMeta.date).toLocaleString()})
          </div>
        )}
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginRight: 12 }}>
          <input type="checkbox" checked={overwriteMissing} onChange={(e) => setOverwriteMissing(e.target.checked)} />
          Overwrite missing fields for today (set unspecified to NULL)
        </label>
        <button className="btn btn-primary" onClick={onSave} disabled={saving}>Save</button>
        {error && <div className="alert alert-error" style={{ marginTop: 8 }}>{error}</div>}
        {success && <div className="alert alert-success" style={{ marginTop: 8 }}>{success}</div>}
      </div>
    </div>
  );
};

export default ManualAddFund;

