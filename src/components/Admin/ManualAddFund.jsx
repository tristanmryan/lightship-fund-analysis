// src/components/Admin/ManualAddFund.jsx
import React, { useEffect, useState } from 'react';
import { supabase, TABLES, dbUtils } from '../../services/supabase';
import { invalidateReferenceCaches } from '../../services/resolvers';

const FLAG_ENABLE_MANUAL_ADD = (process.env.REACT_APP_ENABLE_ADMIN_MANUAL_ADD || 'true') === 'true';

const ManualAddFund = () => {
  const [enabled, setEnabled] = useState(FLAG_ENABLE_MANUAL_ADD);
  const [assetClasses, setAssetClasses] = useState([]);
  const [form, setForm] = useState({ ticker: '', name: '', asset_class_id: '', ytd: '', y1: '', y3: '', y5: '', sharpe: '', stdev: '', exp: '' });
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
      const hasPerf = [form.ytd, form.y1, form.y3, form.y5, form.sharpe, form.stdev, form.exp].some(v => String(v || '').trim() !== '');
      if (hasPerf) {
        await supabase.from(TABLES.FUND_PERFORMANCE).upsert({
          fund_ticker: ticker,
          date: new Date().toISOString().slice(0,10),
          ytd_return: dbUtils.parseNumeric(form.ytd),
          one_year_return: dbUtils.parseNumeric(form.y1),
          three_year_return: dbUtils.parseNumeric(form.y3),
          five_year_return: dbUtils.parseNumeric(form.y5),
          ten_year_return: null,
          sharpe_ratio: dbUtils.parseNumeric(form.sharpe),
          standard_deviation: dbUtils.parseNumeric(form.stdev),
          expense_ratio: dbUtils.parseNumeric(form.exp),
          alpha: null,
          beta: null,
          manager_tenure: null
        }, { onConflict: 'fund_ticker,date' });
      }

      invalidateReferenceCaches();
      setSuccess('Fund saved');
      setForm({ ticker: '', name: '', asset_class_id: '', ytd: '', y1: '', y3: '', y5: '', sharpe: '', stdev: '', exp: '' });
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
        <input name="sharpe" placeholder="Sharpe" value={form.sharpe} onChange={onChange} />
        <input name="stdev" placeholder="Std Dev" value={form.stdev} onChange={onChange} />
        <input name="exp" placeholder="Expense %" value={form.exp} onChange={onChange} />
      </div>
      <div style={{ padding: '0 1rem 1rem' }}>
        <button className="btn btn-primary" onClick={onSave} disabled={saving}>Save</button>
        {error && <div className="alert alert-error" style={{ marginTop: 8 }}>{error}</div>}
        {success && <div className="alert alert-success" style={{ marginTop: 8 }}>{success}</div>}
      </div>
    </div>
  );
};

export default ManualAddFund;

