import React, { useState } from 'react';
import { supabase } from '../../services/supabase';

export default function MVRefreshControl() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const refresh = async (which) => {
    try {
      setBusy(true);
      setMsg('');
      if (which === 'advisor') {
        const { error } = await supabase.rpc('refresh_advisor_metrics_mv');
        if (error) throw error;
        setMsg('Refreshed advisor_metrics_mv');
      } else if (which === 'flows') {
        const { error } = await supabase.rpc('refresh_fund_flows_mv');
        if (error) throw error;
        setMsg('Refreshed fund_flows_mv');
      } else {
        const { error: e1 } = await supabase.rpc('refresh_advisor_metrics_mv');
        if (e1) throw e1;
        const { error: e2 } = await supabase.rpc('refresh_fund_flows_mv');
        if (e2) throw e2;
        setMsg('Refreshed both materialized views');
      }
    } catch (e) {
      setMsg(`Refresh failed: ${e.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card" style={{ padding: 12, marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 style={{ margin: 0 }}>Materialized Views</h4>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => refresh('advisor')} disabled={busy}>Refresh Advisor</button>
          <button className="btn btn-secondary" onClick={() => refresh('flows')} disabled={busy}>Refresh Flows</button>
          <button className="btn btn-primary" onClick={() => refresh('both')} disabled={busy}>Refresh All</button>
        </div>
      </div>
      {msg && <div style={{ marginTop: 8, fontSize: 12, color: msg.startsWith('Refresh failed') ? '#b91c1c' : '#065f46' }}>{msg}</div>}
    </div>
  );
}

