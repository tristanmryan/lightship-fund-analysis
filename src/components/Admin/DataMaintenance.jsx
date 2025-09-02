import React, { useState } from 'react';

export default function DataMaintenance() {
  const [holdingsDate, setHoldingsDate] = useState('');
  const [holdingsAdvisor, setHoldingsAdvisor] = useState('');
  const [tradesMonth, setTradesMonth] = useState('');
  const [tradesAdvisor, setTradesAdvisor] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function callDelete(payload) {
    setBusy(true); setResult(null); setError(null);
    try {
      const resp = await fetch('/api/admin/deleteSnapshot', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || 'Delete failed');
      setResult(json);
    } catch (e) {
      setError(e.message || String(e));
    } finally { setBusy(false); }
  }

  const deleteHoldings = async () => {
    if (!holdingsDate) return;
    const confirmText = `DELETE HOLDINGS ${holdingsDate}${holdingsAdvisor ? ' ' + holdingsAdvisor : ''}`;
    const input = window.prompt(`Type to confirm:\n${confirmText}`);
    if (input !== confirmText) return;
    await callDelete({ type: 'holdings', snapshotDate: holdingsDate, advisorId: holdingsAdvisor || undefined });
  };

  const deleteTrades = async () => {
    if (!tradesMonth) return;
    const confirmText = `DELETE TRADES ${tradesMonth}${tradesAdvisor ? ' ' + tradesAdvisor : ''}`;
    const input = window.prompt(`Type to confirm:\n${confirmText}`);
    if (input !== confirmText) return;
    await callDelete({ type: 'trades', month: tradesMonth, advisorId: tradesAdvisor || undefined });
  };

  return (
    <div className="card" style={{ padding: 16, marginTop: 16 }}>
      <div className="card-header">
        <h3 className="card-title">Data Maintenance</h3>
        <p className="card-subtitle">Delete holdings snapshots or trade months, and refresh analytics automatically</p>
      </div>

      <div className="card" style={{ padding: 12, marginTop: 8 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <strong>Delete Holdings Snapshot</strong>
          <label>Date</label>
          <input type="date" value={holdingsDate} onChange={e => setHoldingsDate(e.target.value)} />
          <label>Advisor (optional)</label>
          <input type="text" value={holdingsAdvisor} onChange={e => setHoldingsAdvisor(e.target.value)} placeholder="e.g. 70YU" />
          <button className="btn btn-danger" onClick={deleteHoldings} disabled={busy || !holdingsDate}>
            {busy ? 'Working…' : 'Delete Holdings Snapshot'}
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginTop: 8 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <strong>Delete Trades Month</strong>
          <label>Month</label>
          <input type="month" value={tradesMonth} onChange={e => setTradesMonth(e.target.value)} />
          <label>Advisor (optional)</label>
          <input type="text" value={tradesAdvisor} onChange={e => setTradesAdvisor(e.target.value)} placeholder="e.g. 70YU" />
          <button className="btn btn-danger" onClick={deleteTrades} disabled={busy || !tradesMonth}>
            {busy ? 'Working…' : 'Delete Trades Month'}
          </button>
        </div>
      </div>

      {result && (
        <div className="alert alert-success" style={{ marginTop: 8 }}>
          Deleted rows: {result.deleted ?? 'n/a'}
        </div>
      )}
      {error && (
        <div className="alert alert-error" style={{ marginTop: 8 }}>{error}</div>
      )}
    </div>
  );
}

