// src/components/Admin/FundAdmin.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Trash2, Edit3, History, Download, Upload, Search, 
  Filter, RefreshCw, Save, X, Check, AlertCircle, Clock,
  GitBranch, Archive, Eye, EyeOff
} from 'lucide-react';
import fundRegistry from '../../services/fundRegistry';
import { migrateFundRegistry, isMigrationNeeded } from '../../utils/migrateFundRegistry';

const FundAdmin = () => {
  // State management
  const [funds, setFunds] = useState([]);
  const [benchmarks, setBenchmarks] = useState([]);
  const [fundHistory, setFundHistory] = useState([]);
  const [versions, setVersions] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('funds');
  
  // UI states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAssetClass, setFilterAssetClass] = useState('all');
  const [filterStatus, setFilterStatus] = useState('active');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedFund, setSelectedFund] = useState(null);
  const [editingBenchmark, setEditingBenchmark] = useState(null);
  const [showRemoved, setShowRemoved] = useState(false);
  
  // Form states
  const [newFund, setNewFund] = useState({
    symbol: '',
    name: '',
    assetClass: '',
    reason: '',
    tags: []
  });

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Check if migration is needed
      const needsMigration = await isMigrationNeeded();
      if (needsMigration) {
        console.log('Running fund registry migration...');
        await migrateFundRegistry();
      }

      // Load all data
      const [allFunds, allBenchmarks, stats, versionList] = await Promise.all([
        fundRegistry.searchFunds({ status: showRemoved ? undefined : 'active' }),
        fundRegistry.getBenchmarksByTicker(),
        fundRegistry.getStatistics(),
        fundRegistry.getVersionHistory(10)
      ]);

      setFunds(allFunds);
      setBenchmarks(Object.values(allBenchmarks));
      setStatistics(stats);
      setVersions(versionList);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load fund history
  const loadFundHistory = async (symbol = null) => {
    try {
      const history = await fundRegistry.getFundHistory(symbol, { limit: 50 });
      setFundHistory(history);
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  // Filtered funds based on search and filters
  const filteredFunds = useMemo(() => {
    return funds.filter(fund => {
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (!fund.symbol.toLowerCase().includes(search) && 
            !fund.name.toLowerCase().includes(search)) {
          return false;
        }
      }

      // Asset class filter
      if (filterAssetClass !== 'all' && fund.assetClass !== filterAssetClass) {
        return false;
      }

      // Status filter
      if (filterStatus !== 'all' && fund.status !== filterStatus) {
        return false;
      }

      return true;
    });
  }, [funds, searchTerm, filterAssetClass, filterStatus]);

  // Get unique asset classes
  const assetClasses = useMemo(() => {
    const classes = new Set(funds.map(f => f.assetClass));
    return Array.from(classes).sort();
  }, [funds]);

  // Handlers
  const handleAddFund = async () => {
    if (!newFund.symbol || !newFund.name || !newFund.assetClass || !newFund.reason) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      await fundRegistry.addFund(
        {
          symbol: newFund.symbol,
          name: newFund.name,
          assetClass: newFund.assetClass,
          tags: newFund.tags
        },
        newFund.reason,
        'admin' // TODO: Get actual user
      );

      // Reset form and reload
      setNewFund({ symbol: '', name: '', assetClass: '', reason: '', tags: [] });
      setShowAddModal(false);
      await loadData();
    } catch (error) {
      alert(`Error adding fund: ${error.message}`);
    }
  };

  const handleRemoveFund = async (fund) => {
    const reason = prompt(`Why are you removing ${fund.symbol} - ${fund.name}?`);
    if (!reason) return;

    try {
      await fundRegistry.removeFund(fund.symbol, reason, 'admin'); // TODO: Get actual user
      await loadData();
    } catch (error) {
      alert(`Error removing fund: ${error.message}`);
    }
  };

  const handleUpdateBenchmark = async (benchmark) => {
    try {
      await fundRegistry.updateBenchmark(
        benchmark.assetClass,
        benchmark.ticker,
        benchmark.name,
        'admin' // TODO: Get actual user
      );
      setEditingBenchmark(null);
      await loadData();
    } catch (error) {
      alert(`Error updating benchmark: ${error.message}`);
    }
  };

  const handleCreateVersion = async () => {
    const message = prompt('Enter a description for this version:');
    if (!message) return;

    try {
      await fundRegistry.createVersion(message, 'admin'); // TODO: Get actual user
      await loadData();
      alert('Version created successfully');
    } catch (error) {
      alert(`Error creating version: ${error.message}`);
    }
  };

  const handleExport = async () => {
    try {
      const exportData = await fundRegistry.exportFundList(true);
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `fund_registry_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      alert(`Error exporting: ${error.message}`);
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          Fund Registry Administration
        </h2>
        <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
          Manage recommended funds, benchmarks, and track changes over time
        </p>
      </div>

      {/* Statistics Summary */}
      {statistics && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}>
          <div style={{
            padding: '1rem',
            backgroundColor: '#f0f9ff',
            border: '1px solid #bfdbfe',
            borderRadius: '0.5rem'
          }}>
            <div style={{ fontSize: '0.75rem', color: '#1e40af' }}>Active Funds</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{statistics.activeFunds}</div>
          </div>
          <div style={{
            padding: '1rem',
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '0.5rem'
          }}>
            <div style={{ fontSize: '0.75rem', color: '#16a34a' }}>Asset Classes</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{statistics.assetClasses}</div>
          </div>
          <div style={{
            padding: '1rem',
            backgroundColor: '#fef3c7',
            border: '1px solid #fcd34d',
            borderRadius: '0.5rem'
          }}>
            <div style={{ fontSize: '0.75rem', color: '#78350f' }}>Recent Changes</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{statistics.recentChanges}</div>
          </div>
          <div style={{
            padding: '1rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '0.5rem'
          }}>
            <div style={{ fontSize: '0.75rem', color: '#dc2626' }}>Removed Funds</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{statistics.removedFunds}</div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div style={{ 
        display: 'flex', 
        gap: '1rem', 
        marginBottom: '1.5rem',
        borderBottom: '2px solid #e5e7eb'
      }}>
        {['funds', 'benchmarks', 'history', 'versions'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid #3b82f6' : 'none',
              color: activeTab === tab ? '#3b82f6' : '#6b7280',
              fontWeight: activeTab === tab ? '600' : '400',
              cursor: 'pointer',
              textTransform: 'capitalize'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Funds Tab */}
      {activeTab === 'funds' && (
        <>
          {/* Controls */}
          <div style={{ 
            display: 'flex', 
            gap: '1rem', 
            marginBottom: '1rem',
            flexWrap: 'wrap',
            alignItems: 'center'
          }}>
            <button
              onClick={() => setShowAddModal(true)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <Plus size={16} />
              Add Fund
            </button>

            <button
              onClick={handleCreateVersion}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#16a34a',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <GitBranch size={16} />
              Create Version
            </button>

            <button
              onClick={handleExport}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#8b5cf6',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <Download size={16} />
              Export
            </button>

            <div style={{ flex: 1 }} />

            {/* Search */}
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ 
                position: 'absolute', 
                left: '0.5rem', 
                top: '50%', 
                transform: 'translateY(-50%)',
                color: '#6b7280'
              }} />
              <input
                type="text"
                placeholder="Search funds..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  padding: '0.5rem 0.5rem 0.5rem 2rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.375rem',
                  width: '200px'
                }}
              />
            </div>

            {/* Filters */}
            <select
              value={filterAssetClass}
              onChange={(e) => setFilterAssetClass(e.target.value)}
              style={{
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem'
              }}
            >
              <option value="all">All Classes</option>
              {assetClasses.map(ac => (
                <option key={ac} value={ac}>{ac}</option>
              ))}
            </select>

            <button
              onClick={() => setShowRemoved(!showRemoved)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: showRemoved ? '#dc2626' : '#e5e7eb',
                color: showRemoved ? 'white' : '#374151',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              {showRemoved ? <Eye size={16} /> : <EyeOff size={16} />}
              {showRemoved ? 'Showing Removed' : 'Hide Removed'}
            </button>
          </div>

          {/* Funds Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Symbol</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Fund Name</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Asset Class</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Added</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Added By</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFunds.map(fund => (
                  <tr 
                    key={fund.symbol}
                    style={{ 
                      borderBottom: '1px solid #f3f4f6',
                      backgroundColor: fund.status === 'removed' ? '#fef2f2' : 'white'
                    }}
                  >
                    <td style={{ padding: '0.75rem', fontWeight: '600' }}>{fund.symbol}</td>
                    <td style={{ padding: '0.75rem' }}>{fund.name}</td>
                    <td style={{ padding: '0.75rem' }}>{fund.assetClass}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <span style={{
                        padding: '0.25rem 0.75rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        backgroundColor: fund.status === 'active' ? '#d1fae5' : '#fee2e2',
                        color: fund.status === 'active' ? '#065f46' : '#991b1b'
                      }}>
                        {fund.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>
                      {new Date(fund.addedDate).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>{fund.addedBy}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                        <button
                          onClick={() => {
                            setSelectedFund(fund);
                            loadFundHistory(fund.symbol);
                            setShowHistoryModal(true);
                          }}
                          style={{
                            padding: '0.25rem',
                            backgroundColor: '#e5e7eb',
                            border: 'none',
                            borderRadius: '0.25rem',
                            cursor: 'pointer'
                          }}
                          title="View History"
                        >
                          <History size={14} />
                        </button>
                        {fund.status === 'active' && (
                          <button
                            onClick={() => handleRemoveFund(fund)}
                            style={{
                              padding: '0.25rem',
                              backgroundColor: '#fee2e2',
                              border: 'none',
                              borderRadius: '0.25rem',
                              cursor: 'pointer'
                            }}
                            title="Remove Fund"
                          >
                            <Trash2 size={14} color="#dc2626" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Benchmarks Tab */}
      {activeTab === 'benchmarks' && (
        <div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Asset Class</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Benchmark Ticker</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Benchmark Name</th>
                <th style={{ padding: '0.75rem', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {benchmarks.map(benchmark => (
                <tr key={benchmark.assetClass} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '0.75rem', fontWeight: '600' }}>{benchmark.assetClass}</td>
                  <td style={{ padding: '0.75rem' }}>
                    {editingBenchmark?.assetClass === benchmark.assetClass ? (
                      <input
                        value={editingBenchmark.ticker}
                        onChange={(e) => setEditingBenchmark({
                          ...editingBenchmark,
                          ticker: e.target.value
                        })}
                        style={{
                          padding: '0.25rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '0.25rem'
                        }}
                      />
                    ) : (
                      benchmark.ticker
                    )}
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    {editingBenchmark?.assetClass === benchmark.assetClass ? (
                      <input
                        value={editingBenchmark.name}
                        onChange={(e) => setEditingBenchmark({
                          ...editingBenchmark,
                          name: e.target.value
                        })}
                        style={{
                          padding: '0.25rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '0.25rem',
                          width: '100%'
                        }}
                      />
                    ) : (
                      benchmark.name
                    )}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                    {editingBenchmark?.assetClass === benchmark.assetClass ? (
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                        <button
                          onClick={() => handleUpdateBenchmark(editingBenchmark)}
                          style={{
                            padding: '0.25rem',
                            backgroundColor: '#d1fae5',
                            border: 'none',
                            borderRadius: '0.25rem',
                            cursor: 'pointer'
                          }}
                        >
                          <Check size={14} color="#16a34a" />
                        </button>
                        <button
                          onClick={() => setEditingBenchmark(null)}
                          style={{
                            padding: '0.25rem',
                            backgroundColor: '#fee2e2',
                            border: 'none',
                            borderRadius: '0.25rem',
                            cursor: 'pointer'
                          }}
                        >
                          <X size={14} color="#dc2626" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingBenchmark(benchmark)}
                        style={{
                          padding: '0.25rem',
                          backgroundColor: '#e5e7eb',
                          border: 'none',
                          borderRadius: '0.25rem',
                          cursor: 'pointer'
                        }}
                      >
                        <Edit3 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div>
          <div style={{ marginBottom: '1rem' }}>
            <button
              onClick={() => loadFundHistory(null)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <RefreshCw size={16} />
              Load All History
            </button>
          </div>

          {fundHistory.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Date</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Symbol</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Action</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Reason</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Changed By</th>
                  </tr>
                </thead>
                <tbody>
                  {fundHistory.map(entry => (
                    <tr key={entry.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>
                        {new Date(entry.timestamp).toLocaleString()}
                      </td>
                      <td style={{ padding: '0.75rem', fontWeight: '600' }}>{entry.symbol}</td>
                      <td style={{ padding: '0.75rem' }}>
                        <span style={{
                          padding: '0.25rem 0.5rem',
                          borderRadius: '0.25rem',
                          fontSize: '0.75rem',
                          backgroundColor: 
                            entry.action === 'added' ? '#d1fae5' :
                            entry.action === 'removed' ? '#fee2e2' :
                            entry.action === 'modified' ? '#fef3c7' : '#e5e7eb',
                          color:
                            entry.action === 'added' ? '#065f46' :
                            entry.action === 'removed' ? '#991b1b' :
                            entry.action === 'modified' ? '#78350f' : '#374151'
                        }}>
                          {entry.action}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>{entry.reason}</td>
                      <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>{entry.changedBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{
              padding: '3rem',
              textAlign: 'center',
              backgroundColor: '#f9fafb',
              borderRadius: '0.5rem',
              color: '#6b7280'
            }}>
              <Clock size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
              <p>No history loaded. Click "Load All History" to view changes.</p>
            </div>
          )}
        </div>
      )}

      {/* Versions Tab */}
      {activeTab === 'versions' && (
        <div>
          {versions.length > 0 ? (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {versions.map(version => (
                <div
                  key={version.id}
                  style={{
                    padding: '1rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.5rem',
                    backgroundColor: 'white'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div>
                      <h4 style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
                        {version.message}
                      </h4>
                      <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                        {new Date(version.timestamp).toLocaleString()} by {version.author}
                      </p>
                      <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                        {version.fundCount} funds ({version.activeFundCount} active)
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        if (window.confirm('Restore to this version? Current changes will be saved as a new version.')) {
                          fundRegistry.restoreVersion(version.id, 'admin');
                          loadData();
                        }
                      }}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: '#e5e7eb',
                        border: 'none',
                        borderRadius: '0.375rem',
                        cursor: 'pointer',
                        fontSize: '0.875rem'
                      }}
                    >
                      Restore
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              padding: '3rem',
              textAlign: 'center',
              backgroundColor: '#f9fafb',
              borderRadius: '0.5rem',
              color: '#6b7280'
            }}>
              <GitBranch size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
              <p>No versions created yet.</p>
            </div>
          )}
        </div>
      )}

      {/* Add Fund Modal */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }} onClick={() => setShowAddModal(false)}>
          <div style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '0.5rem',
            maxWidth: '500px',
            width: '90%'
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
              Add New Fund
            </h3>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                Symbol *
              </label>
              <input
                type="text"
                value={newFund.symbol}
                onChange={(e) => setNewFund({ ...newFund, symbol: e.target.value.toUpperCase() })}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.375rem'
                }}
                placeholder="e.g. PRWCX"
              />
            </div>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                Fund Name *
              </label>
              <input
                type="text"
                value={newFund.name}
                onChange={(e) => setNewFund({ ...newFund, name: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.375rem'
                }}
                placeholder="e.g. T. Rowe Price Capital Appreciation"
              />
            </div>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                Asset Class *
              </label>
              <select
                value={newFund.assetClass}
                onChange={(e) => setNewFund({ ...newFund, assetClass: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.375rem'
                }}
              >
                <option value="">Select asset class...</option>
                {assetClasses.map(ac => (
                  <option key={ac} value={ac}>{ac}</option>
                ))}
              </select>
            </div>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                Reason for Adding *
              </label>
              <textarea
                value={newFund.reason}
                onChange={(e) => setNewFund({ ...newFund, reason: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.375rem',
                  minHeight: '80px'
                }}
                placeholder="e.g. Strong 5-year performance, low volatility, committee approved"
              />
            </div>
            
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setNewFund({ symbol: '', name: '', assetClass: '', reason: '', tags: [] });
                  setShowAddModal(false);
                }}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#e5e7eb',
                  border: 'none',
                  borderRadius: '0.375rem',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleAddFund}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.375rem',
                  cursor: 'pointer'
                }}
              >
                Add Fund
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && selectedFund && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }} onClick={() => setShowHistoryModal(false)}>
          <div style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '0.5rem',
            maxWidth: '700px',
            maxHeight: '80vh',
            overflow: 'auto',
            width: '90%'
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
              History: {selectedFund.symbol} - {selectedFund.name}
            </h3>
            
            {fundHistory.length > 0 ? (
              <div style={{ marginBottom: '1rem' }}>
                {fundHistory.map(entry => (
                  <div
                    key={entry.id}
                    style={{
                      padding: '1rem',
                      borderBottom: '1px solid #e5e7eb'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{
                        fontWeight: '600',
                        color: 
                          entry.action === 'added' ? '#16a34a' :
                          entry.action === 'removed' ? '#dc2626' :
                          entry.action === 'modified' ? '#f59e0b' : '#374151'
                      }}>
                        {entry.action.charAt(0).toUpperCase() + entry.action.slice(1)}
                      </span>
                      <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                        {new Date(entry.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                      <strong>By:</strong> {entry.changedBy}
                    </p>
                    {entry.reason && (
                      <p style={{ fontSize: '0.875rem' }}>
                        <strong>Reason:</strong> {entry.reason}
                      </p>
                    )}
                    {entry.changes && Object.keys(entry.changes).length > 0 && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#6b7280' }}>
                        <strong>Changes:</strong>
                        <ul style={{ marginLeft: '1rem', marginTop: '0.25rem' }}>
                          {Object.entries(entry.changes).map(([field, change]) => (
                            <li key={field}>
                              {field}: {change.from} → {change.to}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: '#6b7280' }}>No history found for this fund.</p>
            )}
            
            <div style={{ textAlign: 'right' }}>
              <button
                onClick={() => setShowHistoryModal(false)}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#e5e7eb',
                  border: 'none',
                  borderRadius: '0.375rem',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FundAdmin;