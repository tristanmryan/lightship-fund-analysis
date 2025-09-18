import React, { useEffect, useState } from 'react';
import fundService from '../../services/fundService';
import { createMonthlyTemplateCSV } from '../../services/csvTemplate';
import asOfStore from '../../services/asOfStore';

export default function SnapshotManager() {
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [convertBusy, setConvertBusy] = useState(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const rows = await fundService.listSnapshotsWithCounts();
      setSnapshots(rows);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);
  function isEom(dateStr) {
    try {
      const dt = new Date(dateStr + 'T00:00:00Z');
      const end = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0));
      return dt.getUTCDate() === end.getUTCDate();
    } catch { return false; }
  }

  async function convertToEom(dateStr) {
    const dt = new Date(dateStr + 'T00:00:00Z');
    const target = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).toISOString().slice(0,10);
    if (target === dateStr) return;
    const confirmText = `${dateStr} -> ${target}`;
    const input = window.prompt(`Type to confirm conversion (SET date = last_day_of_month):\n${confirmText}`);
    if (!input || input.trim() !== confirmText) return;
    setConvertBusy(dateStr);
    try {
      const res = await fundService.convertSnapshotToEom(dateStr);
      if (res?.merged) {
        alert(`Converted ${dateStr} to ${target} and merged ${res.moved} rows into existing EOM.`);
      } else {
        alert(`Converted ${dateStr} to ${target}.`);
      }
      await load();
    } catch (e) {
      alert(e.message || String(e));
    } finally {
      setConvertBusy(null);
    }
  }

  const handleDelete = async (date) => {
    if (!window.confirm(`Delete all performance rows for ${date}? This cannot be undone.`)) return;
    try {
      await fundService.deleteSnapshotMonth(date);
      await load();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleDownloadTemplate = (date) => {
    try {
      const blob = createMonthlyTemplateCSV();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fund-monthly-template.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  const handleSetActive = async (date) => {
    try {
      asOfStore.setActiveMonth(date);
      alert(`Active month set to ${date}`);
    } catch {}
  };

  return (
    <div className="card" style={{ padding: 16, marginTop: 16 }}>
      <div className="card-header">
        <h3 className="card-title">Snapshot Manager</h3>
        <p className="card-subtitle">Manage monthly snapshots present in fund_performance</p>
      </div>
      {loading ? (
        <div>Loading snapshots…</div>
      ) : error ? (
        <div className="alert alert-error">{error}</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Date</th>
                <th style={{ textAlign: 'left' }}>Rows</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(snapshots || []).map((s) => (
                <tr key={s.date}>
                  <td>
                    {s.date}
                    <span style={{ marginLeft: 8, fontSize: 12, padding: '2px 6px', borderRadius: 9999, border: '1px solid',
                      borderColor: isEom(s.date) ? '#86efac' : '#fde68a',
                      background: isEom(s.date) ? '#ecfdf5' : '#fffbeb',
                      color: isEom(s.date) ? '#166534' : '#92400e' }}>
                      {isEom(s.date) ? 'EOM' : 'Non-EOM'}
                    </span>
                  </td>
                  <td>{s.rows}</td>
                  <td style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button className="btn btn-secondary" onClick={() => handleDownloadTemplate(s.date)}>Download Template</button>
                    <button className="btn btn-secondary" onClick={() => handleSetActive(s.date)}>Set Active Month</button>
                    {!isEom(s.date) && (
                      <button className="btn btn-warning" disabled={convertBusy === s.date} onClick={() => convertToEom(s.date)}>
                        {convertBusy === s.date ? 'Converting…' : 'Convert to EOM…'}
                      </button>
                    )}
                    <button className="btn btn-danger" onClick={() => handleDelete(s.date)}>Delete</button>
                  </td>
                </tr>
              ))}
              {snapshots.length === 0 && (
                <tr><td colSpan={3} style={{ color: '#6b7280' }}>No snapshots found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

