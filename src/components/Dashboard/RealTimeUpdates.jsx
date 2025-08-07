import React, { useState, useEffect } from 'react';
import { RefreshCw, Clock, CheckCircle, AlertCircle, Wifi, WifiOff } from 'lucide-react';

const RealTimeUpdates = ({ onRefresh, lastUpdated, isConnected, isLoading }) => {
  const [timeSinceUpdate, setTimeSinceUpdate] = useState('');

  // Calculate time since last update
  useEffect(() => {
    const updateTimeSince = () => {
      if (!lastUpdated) {
        setTimeSinceUpdate('Never');
        return;
      }

      const now = new Date();
      const lastUpdate = new Date(lastUpdated);
      const diffInSeconds = Math.floor((now - lastUpdate) / 1000);

      if (diffInSeconds < 60) {
        setTimeSinceUpdate(`${diffInSeconds}s ago`);
      } else if (diffInSeconds < 3600) {
        const minutes = Math.floor(diffInSeconds / 60);
        setTimeSinceUpdate(`${minutes}m ago`);
      } else {
        const hours = Math.floor(diffInSeconds / 3600);
        setTimeSinceUpdate(`${hours}h ago`);
      }
    };

    updateTimeSince();
    const interval = setInterval(updateTimeSince, 1000);

    return () => clearInterval(interval);
  }, [lastUpdated]);

  return (
    <div className="real-time-updates">
      <div className="status-header">
        <h3>Real-Time Data Status</h3>
        <div className="status-indicators">
          <div className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? <Wifi size={16} /> : <WifiOff size={16} />}
            <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
          <div className={`status-indicator ${isLoading ? 'loading' : 'idle'}`}>
            {isLoading ? <RefreshCw size={16} className="spinning" /> : <CheckCircle size={16} />}
            <span>{isLoading ? 'Updating...' : 'Ready'}</span>
          </div>
        </div>
      </div>

      <div className="update-info">
        <div className="info-row">
          <Clock size={16} />
          <span>Last Updated: {lastUpdated ? new Date(lastUpdated).toLocaleString() : 'Never'}</span>
        </div>
        <div className="info-row">
          <RefreshCw size={16} />
          <span>Time Since Update: {timeSinceUpdate}</span>
        </div>
      </div>

      <div className="update-actions">
        <button 
          onClick={onRefresh}
          disabled={isLoading}
          className={`btn btn-primary ${isLoading ? 'loading' : ''}`}
        >
          {isLoading ? (
            <>
              <RefreshCw size={16} className="spinning" />
              Updating...
            </>
          ) : (
            <>
              <RefreshCw size={16} />
              Refresh Data
            </>
          )}
        </button>
        
        <div className="auto-refresh-info">
          <AlertCircle size={14} />
          <span>Auto-refresh every hour</span>
        </div>
      </div>

      {!isConnected && (
        <div className="connection-warning">
          <AlertCircle size={16} />
          <span>No internet connection. Data may be outdated.</span>
        </div>
      )}
    </div>
  );
};

export default RealTimeUpdates; 