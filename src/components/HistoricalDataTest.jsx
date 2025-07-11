// src/components/HistoricalDataTest.jsx
import React, { useState, useEffect } from 'react';
import { 
  getAllCombinedSnapshots, 
  getDataSummary, 
  hasHistoricalData 
} from '../services/enhancedDataStore';

const HistoricalDataTest = () => {
  const [snapshots, setSnapshots] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        console.log('🔄 Loading historical data...');
        
        // Check if historical data is available
        const hasHistorical = hasHistoricalData();
        console.log('📊 Historical data available:', hasHistorical);
        
        // Get all snapshots (historical + user)
        const allSnapshots = await getAllCombinedSnapshots();
        setSnapshots(allSnapshots);
        
        // Get summary
        const dataSummary = await getDataSummary();
        setSummary(dataSummary);
        
        console.log('✅ Data loaded successfully!');
        console.log('📊 Total snapshots:', allSnapshots.length);
        console.log('📈 Data summary:', dataSummary);
        
      } catch (error) {
        console.error('❌ Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) {
    return (
      <div style={{ 
        padding: '20px', 
        border: '2px solid #007cba', 
        borderRadius: '8px',
        margin: '20px 0',
        backgroundColor: '#f0f8ff'
      }}>
        <h3>🔄 Loading Historical Data...</h3>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: '20px', 
      border: '2px solid #28a745', 
      borderRadius: '8px',
      margin: '20px 0',
      backgroundColor: '#f8fff8'
    }}>
      <h3>🎉 Historical Data Integration Test</h3>
      
      {summary && (
        <div style={{ marginBottom: '20px' }}>
          <h4>📊 Data Summary:</h4>
          <ul>
            <li><strong>📈 Historical Snapshots:</strong> {summary.historical.count}</li>
            <li><strong>👤 User Snapshots:</strong> {summary.user.count}</li>
            <li><strong>🎯 Total Available:</strong> {summary.combined.total}</li>
            {summary.combined.dateRange && (
              <li><strong>📅 Date Range:</strong> {' '}
                {new Date(summary.combined.dateRange.earliest).toLocaleDateString()} to {' '}
                {new Date(summary.combined.dateRange.latest).toLocaleDateString()}
              </li>
            )}
          </ul>
        </div>
      )}

      <h4>📋 Available Snapshots:</h4>
      <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
        {snapshots.map(snapshot => (
          <div key={snapshot.id} style={{
            padding: '10px',
            margin: '5px 0',
            backgroundColor: snapshot.metadata.source === 'historical_data' ? '#e3f2fd' : '#fff3e0',
            border: '1px solid #ddd',
            borderRadius: '4px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>{snapshot.id}</strong>
                <br />
                <small>📅 {new Date(snapshot.date).toLocaleDateString()}</small>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div>📊 {snapshot.metadata.totalFunds} funds</div>
                <div style={{ 
                  fontSize: '12px', 
                  color: snapshot.metadata.source === 'historical_data' ? '#1976d2' : '#f57c00'
                }}>
                  {snapshot.metadata.source === 'historical_data' ? '📈 Historical' : '👤 User Data'}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {snapshots.length === 0 && (
        <p style={{ color: '#d32f2f' }}>❌ No snapshots found</p>
      )}
    </div>
  );
};

export default HistoricalDataTest;