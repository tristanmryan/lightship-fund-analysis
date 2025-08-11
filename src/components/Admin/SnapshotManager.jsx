import React, { useEffect, useState } from 'react';
import fundService from '../../services/fundService';
import { createMonthlyTemplateCSV } from '../../services/csvTemplate';

export default function SnapshotManager() {
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
      a.download = `fund-monthly-template-${date}.csv`;
      a.click();
      URL.revokeObjectURL(url);
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
                  <td>{s.date}</td>
                  <td>{s.rows}</td>
                  <td style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary" onClick={() => handleDownloadTemplate(s.date)}>Download Template</button>
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

