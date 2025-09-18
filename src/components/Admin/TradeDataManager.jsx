import React, { useEffect, useState } from 'react';
import fundService from '../../services/fundService';

export default function TradeDataManager() {
  const [tradeData, setTradeData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const rows = await fundService.listTradeDataCounts();
      setTradeData(rows);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const handleDelete = async (month) => {
    if (!window.confirm(`Delete all trade data for ${month}? This cannot be undone.`)) return;
    try {
      // Delete trades for the entire month
      const startDate = month;
      const endDate = new Date(new Date(month).getFullYear(), new Date(month).getMonth() + 1, 1).toISOString().slice(0, 10);
      
      const { error } = await fundService.supabase
        .from('trade_activity')
        .delete()
        .gte('trade_date', startDate)
        .lt('trade_date', endDate);
      
      if (error) throw error;
      await load();
      alert(`Deleted all trade data for ${month}`);
    } catch (e) {
      alert(e.message || 'Failed to delete trade data');
    }
  };

  const formatMonth = (monthStr) => {
    try {
      const date = new Date(monthStr + 'T00:00:00Z');
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    } catch {
      return monthStr;
    }
  };

  return (
    <div className="card" style={{ padding: 16, marginTop: 16 }}>
      <div className="card-header">
        <h3 className="card-title">Trade Data Manager</h3>
        <p className="card-subtitle">Manage monthly trade data present in trade_activity table</p>
      </div>
      {loading ? (
        <div>Loading trade data...</div>
      ) : error ? (
        <div className="alert alert-error">{error}</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Month</th>
                <th style={{ textAlign: 'left' }}>Trade Rows</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(tradeData || []).map((t) => (
                <tr key={t.month}>
                  <td>
                    <span style={{ fontWeight: '500' }}>
                      {formatMonth(t.month)}
                    </span>
                    <span style={{ marginLeft: 8, fontSize: 12, color: '#6b7280' }}>
                      ({t.month})
                    </span>
                  </td>
                  <td>
                    <span style={{ 
                      color: t.tradeRows > 0 ? '#166534' : '#6b7280',
                      fontWeight: t.tradeRows > 0 ? '500' : 'normal'
                    }}>
                      {t.tradeRows.toLocaleString()}
                    </span>
                  </td>
                  <td style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button 
                      className="btn btn-danger" 
                      onClick={() => handleDelete(t.month)}
                      style={{ fontSize: 12 }}
                    >
                      Delete Month
                    </button>
                  </td>
                </tr>
              ))}
              {tradeData.length === 0 && (
                <tr><td colSpan={3} style={{ color: '#6b7280' }}>No trade data found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}