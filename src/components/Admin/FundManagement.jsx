import React, { useState } from 'react';
import { Plus, Search, Trash2, CheckCircle, AlertCircle } from 'lucide-react';
import { useFundData } from '../../hooks/useFundData';
import DictionaryAdmin from './DictionaryAdmin';

const FundManagement = () => {
  const { 
    funds, 
    loading, 
    error, 
    addFund, 
    removeFund, 
    updateFundRecommendation,
    refreshData 
  } = useFundData();

  const [newTicker, setNewTicker] = useState('');
  const [selectedAssetClass, setSelectedAssetClass] = useState('');
  const [isAddingFund, setIsAddingFund] = useState(false);
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');

  // Available asset classes
  const assetClasses = [
    'Large Cap Growth',
    'Large Cap Value', 
    'Mid Cap Growth',
    'Mid Cap Value',
    'Small Cap Growth',
    'Small Cap Value',
    'International',
    'Emerging Markets',
    'Bonds',
    'Real Estate',
    'Commodities',
    'Other'
  ];

  // Handle adding a new fund
  const handleAddFund = async () => {
    if (!newTicker.trim()) {
      setAddError('Please enter a ticker symbol');
      return;
    }

    if (!selectedAssetClass) {
      setAddError('Please select an asset class');
      return;
    }

    setIsAddingFund(true);
    setAddError('');
    setAddSuccess('');

    try {
      // Add the fund with the selected asset class
      const success = await addFund(newTicker.trim().toUpperCase(), selectedAssetClass);
      
      if (success) {
        setAddSuccess(`Successfully added ${newTicker.toUpperCase()} to your fund list`);
        setNewTicker('');
        setSelectedAssetClass('');
      } else {
        setAddError('Failed to add fund. Please check the ticker and try again.');
      }
    } catch (error) {
      setAddError(`Error adding fund: ${error.message}`);
    } finally {
      setIsAddingFund(false);
    }
  };

  // Handle removing a fund
  const handleRemoveFund = async (ticker) => {
    if (window.confirm(`Are you sure you want to remove ${ticker} from your fund list?`)) {
      try {
        await removeFund(ticker);
      } catch (error) {
        console.error('Failed to remove fund:', error);
      }
    }
  };

  // Handle updating recommendation status
  const handleToggleRecommendation = async (ticker, currentStatus) => {
    try {
      await updateFundRecommendation(ticker, !currentStatus);
    } catch (error) {
      console.error('Failed to update recommendation:', error);
    }
  };

  // Handle manual refresh
  const handleRefreshData = async () => {
    try {
      await refreshData();
    } catch (error) {
      console.error('Failed to refresh data:', error);
    }
  };

  return (
    <div className="fund-management">
      <div className="management-header">
        <h2>Fund Management</h2>
        <p className="subtitle">
          Manage your recommended fund list and automatically fetch performance data
        </p>
      </div>

      {/* Add New Fund Section */}
      <div className="add-fund-section">
        <h3>Add New Fund</h3>
        <div className="add-fund-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="ticker">Ticker Symbol *</label>
              <input
                id="ticker"
                type="text"
                value={newTicker}
                onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
                placeholder="e.g., VTSAX, SPY, IWF"
                className="input-field"
                disabled={isAddingFund}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="assetClass">Asset Class *</label>
              <select
                id="assetClass"
                value={selectedAssetClass}
                onChange={(e) => setSelectedAssetClass(e.target.value)}
                className="select-field"
                disabled={isAddingFund}
              >
                <option value="">Select Asset Class</option>
                {assetClasses.map(ac => (
                  <option key={ac} value={ac}>{ac}</option>
                ))}
              </select>
            </div>
            
            <button
              onClick={handleAddFund}
              disabled={isAddingFund || !newTicker.trim() || !selectedAssetClass}
              className="btn btn-primary"
            >
              {isAddingFund ? (
                <>
                  <div className="loading-spinner small"></div>
                  Adding Fund...
                </>
              ) : (
                <>
                  <Plus size={16} />
                  Add Fund
                </>
              )}
            </button>
          </div>

          {addError && (
            <div className="alert alert-error">
              <AlertCircle size={16} />
              {addError}
            </div>
          )}

          {addSuccess && (
            <div className="alert alert-success">
              <CheckCircle size={16} />
              {addSuccess}
            </div>
          )}
        </div>
      </div>

      {/* Dictionary Admin (MVP) */}
      <div className="dictionary-admin" style={{ marginTop: '2rem' }}>
        <DictionaryAdmin />
      </div>

      {/* Fund List Section */}
      <div className="fund-list-section">
        <div className="section-header">
          <h3>Your Fund List ({funds.length} funds)</h3>
          <button onClick={handleRefreshData} className="btn btn-secondary">
            <Search size={16} />
            Refresh Data
          </button>
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading fund data...</p>
          </div>
        ) : error ? (
          <div className="error-state">
            <AlertCircle size={24} />
            <p>Error loading funds: {error}</p>
          </div>
        ) : funds.length === 0 ? (
          <div className="empty-state">
            <p>No funds in your list yet. Add your first fund above!</p>
          </div>
        ) : (
          <div className="funds-table">
            <table>
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th>Fund Name</th>
                  <th>Asset Class</th>
                  <th>YTD Return</th>
                  <th>1 Year</th>
                  <th>Expense Ratio</th>
                  <th>Recommended</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {funds.map(fund => (
                  <tr key={fund.ticker}>
                    <td>
                      <strong>{fund.ticker}</strong>
                    </td>
                    <td>{fund.name || 'Loading...'}</td>
                    <td>{fund.asset_class || 'Unassigned'}</td>
                    <td>
                      {fund.ytd_return !== null && fund.ytd_return !== undefined 
                        ? `${fund.ytd_return > 0 ? '+' : ''}${fund.ytd_return.toFixed(2)}%`
                        : 'N/A'
                      }
                    </td>
                    <td>
                      {fund.one_year_return !== null && fund.one_year_return !== undefined
                        ? `${fund.one_year_return > 0 ? '+' : ''}${fund.one_year_return.toFixed(2)}%`
                        : 'N/A'
                      }
                    </td>
                    <td>
                      {fund.expense_ratio !== null && fund.expense_ratio !== undefined
                        ? `${fund.expense_ratio.toFixed(2)}%`
                        : 'N/A'
                      }
                    </td>
                    <td>
                      <button
                        onClick={() => handleToggleRecommendation(fund.ticker, fund.is_recommended)}
                        className={`recommendation-toggle ${fund.is_recommended ? 'recommended' : 'not-recommended'}`}
                        title={fund.is_recommended ? 'Remove from recommended' : 'Add to recommended'}
                      >
                        {fund.is_recommended ? '✓' : '○'}
                      </button>
                    </td>
                    <td>
                      <button
                        onClick={() => handleRemoveFund(fund.ticker)}
                        className="btn btn-danger small"
                        title="Remove fund"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="instructions-section">
        <h3>How It Works</h3>
        <ol>
          <li><strong>Add Funds:</strong> Enter a ticker symbol (e.g., VTSAX, SPY) and select an asset class</li>
          <li><strong>Auto-Fetch Data:</strong> The app automatically fetches fund details from Ycharts API</li>
          <li><strong>Manage Recommendations:</strong> Toggle the recommendation status for each fund</li>
          <li><strong>View Performance:</strong> Check the Performance tab to see your funds' data</li>
        </ol>
      </div>
    </div>
  );
};

export default FundManagement; 