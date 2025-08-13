// App.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './App.css'; // Import the CSS file
import LoginModal from './components/Auth/LoginModal';
import {
  recommendedFunds as defaultRecommendedFunds,
  assetClassBenchmarks as defaultBenchmarks
} from './data/config';
import {
  identifyReviewCandidates,
  loadMetricWeights
} from './services/scoring';
import fundService from './services/fundService';
import { isSupabaseStubbed } from './services/supabase';
import {
  getAllCombinedSnapshots,
  getDataSummary
} from './services/enhancedDataStore';
import fundRegistry from './services/fundRegistry';
import PerformanceHeatmap from './components/Dashboard/PerformanceHeatmap';
import TopBottomPerformers from './components/Dashboard/TopBottomPerformers';
import AssetClassOverview from './components/Dashboard/AssetClassOverview';
import Home from './components/Dashboard/Home';
import CorrelationMatrix from './components/Analytics/CorrelationMatrix';
import RiskReturnScatter from './components/Analytics/RiskReturnScatter';
import EnhancedPerformanceDashboard from './components/Dashboard/EnhancedPerformanceDashboard';
import MethodologyDrawer from './components/Dashboard/MethodologyDrawer';
import FundManagement from './components/Admin/FundManagement';
import HealthCheck from './components/Dashboard/HealthCheck';
import { 
  exportToExcel, 
  downloadFile
} from './services/exportService';

// Import new services
import authService from './services/authService';
import migrationService from './services/migrationService';
import { useFundData } from './hooks/useFundData';
import { prefetchBenchmarkMappings } from './services/resolvers/benchmarkResolverClient';

const App = () => {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Fund data management using useFundData hook
  const {
    funds,
    loading: fundsLoading,
    // error: fundsError,
    refreshData,
    assetClasses,
    asOfMonth,
    setAsOfMonth
  } = useFundData();

  // Legacy state for backwards compatibility
  const [scoredFundData] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedClass, setSelectedClass] = useState('');
  const [classSummaries] = useState({});
  const [currentSnapshotDate] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAssetClass, setFilterAssetClass] = useState('all');
  const [sortBy, setSortBy] = useState('score');
  const [sortDirection, setSortDirection] = useState('desc');

  // Historical data states
  const [snapshots, setSnapshots] = useState([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState(null);
  const [compareSnapshot, setCompareSnapshot] = useState(null);
  const [snapshotComparison] = useState(null);

  const [assetClassBenchmarks, setAssetClassBenchmarks] = useState({});
  const [availableMonths, setAvailableMonths] = useState([]);



  // Memoize expensive calculations
  const memoizedAssetClasses = useMemo(() => {
    const classes = new Set(Object.keys(assetClassBenchmarks || {}));
    (funds || []).forEach(f => {
      const cls = f['Asset Class'] || f.asset_class;
      if (cls) classes.add(cls);
    });
    return Array.from(classes).sort();
  }, [assetClassBenchmarks, funds]);

  // Memoize review candidates calculation
  const reviewCandidates = useMemo(() => {
    return identifyReviewCandidates(funds || []);
  }, [funds]);



  // Help modal state
  const [showHelp, setShowHelp] = useState(false);

  // Router integration: sync activeTab with URL
  const location = useLocation();
  const navigate = useNavigate();

  const tabToPath = {
    dashboard: '/dashboard',
    performance: '/performance',
    class: '/class',
    analysis: '/analysis',
    analytics: '/analytics',
    history: '/history',
    admin: '/admin',
    health: '/health'
  };
  const pathToTab = (pathname) => {
    if (pathname.startsWith('/performance')) return 'performance';
    if (pathname.startsWith('/class')) return 'class';
    if (pathname.startsWith('/analysis')) return 'analysis';
    if (pathname.startsWith('/analytics')) return 'analytics';
    if (pathname.startsWith('/history')) return 'history';
    if (pathname.startsWith('/admin')) return 'admin';
    if (pathname.startsWith('/health')) return 'health';
    return 'dashboard';
  };

  // Redirect root to /dashboard on first load
  useEffect(() => {
    // Alias redirects
    const aliasMap = {
      '/funds': '/performance',
      '/scores': '/performance'
    };
    if (aliasMap[location.pathname]) {
      navigate(aliasMap[location.pathname], { replace: true });
      return;
    }
    if (location.pathname === '/') {
      const last = localStorage.getItem('lastTab');
      const target = tabToPath[last] || '/dashboard';
      navigate(target, { replace: true });
    }
    setActiveTab(pathToTab(location.pathname));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Persist last tab
  useEffect(() => {
    if (activeTab) {
      localStorage.setItem('lastTab', activeTab);
    }
  }, [activeTab]);

  // Check authentication on app load
  useEffect(() => {
    // In test environment, bypass auth to simplify rendering in unit tests
    if (process.env.NODE_ENV === 'test') {
      setIsAuthenticated(true);
      setCurrentUser({ id: 'test', name: 'Test User', role: 'admin' });
      setAuthLoading(false);
      return;
    }

    const checkAuth = async () => {
      try {
        console.log('🔐 Checking authentication...');
        console.log('🔧 Environment check:', {
          supabaseUrl: process.env.REACT_APP_SUPABASE_URL ? '✅ Set' : '❌ Missing',
          supabaseKey: process.env.REACT_APP_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing',
          ychartsKey: process.env.REACT_APP_YCHARTS_API_KEY ? '✅ Set' : '❌ Missing',
          appPassword: process.env.REACT_APP_APP_PASSWORD ? '✅ Set' : '❌ Missing'
        });
        
        setAuthLoading(true);
        const authResult = await authService.checkAuth();
        
        console.log('🔐 Auth result:', authResult);
        
        if (authResult.success) {
          console.log('✅ User is authenticated');
          setIsAuthenticated(true);
          setCurrentUser(authResult.user);
        } else {
          console.log('❌ User is not authenticated, showing login modal');
          setIsAuthenticated(false);
          setCurrentUser(null);
          setShowLoginModal(true);
        }
      } catch (error) {
        console.error('❌ Authentication check failed:', error);
        setIsAuthenticated(false);
        setCurrentUser(null);
        setShowLoginModal(true);
      } finally {
        setAuthLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Check for migration when authenticated
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      const checkMigration = async () => {
        try {
          console.log('🔍 Checking migration status...');
          const migrationStatus = await migrationService.checkMigrationStatus();
          console.log('📊 Migration status:', migrationStatus);
          
          if (migrationStatus.needsMigration) {
            console.log('🔄 Migration needed. Starting migration from IndexedDB to Supabase...');
            const migrationResult = await migrationService.migrateFromIndexedDB();
            console.log('✅ Migration completed:', migrationResult);
          } else {
            console.log('✅ No migration needed. Supabase data is up to date.');
          }
        } catch (error) {
          console.error('❌ Migration check failed:', error);
        }
      };

      checkMigration();
    }
  }, [isAuthenticated, authLoading]);

  // Prefetch benchmark mappings after funds load (Supabase-first cache)
  useEffect(() => {
    if ((funds || []).length > 0) {
      prefetchBenchmarkMappings();
    }
  }, [funds]);

  // Load snapshot months for global As-of selector
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const months = await fundService.listSnapshotMonths();
        if (!cancelled) setAvailableMonths(months || []);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  // Global navigation events (from deep links like Data Health quick actions)
  useEffect(() => {
    const onNav = (ev) => {
      try {
        const tab = ev?.detail?.tab;
        if (typeof tab === 'string') {
          setActiveTab(tab);
          const to = tabToPath[tab] || '/dashboard';
          navigate(to);
        }
      } catch {}
    };
    window.addEventListener('NAVIGATE_APP', onNav);
    return () => window.removeEventListener('NAVIGATE_APP', onNav);
  }, [navigate]);

  // Initialize fund registry and load data (legacy - will be replaced)
  useEffect(() => {
    if (!isAuthenticated) return; // Only load legacy data if not using new system
    if (process.env.NODE_ENV === 'test') return; // Skip IndexedDB interactions in tests
    
    const initializeRegistry = async () => {
      await loadMetricWeights();
      await fundRegistry.initialize(defaultRecommendedFunds, defaultBenchmarks);
      const [, benchmarkMap] = await Promise.all([
        fundRegistry.getActiveFunds(),
        fundRegistry.getBenchmarksByAssetClass()
      ]);

      setAssetClassBenchmarks(benchmarkMap);
    };

    initializeRegistry();
  }, [isAuthenticated]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Ctrl/Cmd + H for help
      if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
        e.preventDefault();
        setShowHelp(true);
      }
      // Ctrl/Cmd + E for export
      if ((e.ctrlKey || e.metaKey) && e.key === 'e' && (funds?.length || 0) > 0) {
        e.preventDefault();
        const data = {
          funds,
          classSummaries,
          reviewCandidates: identifyReviewCandidates(funds || []),
          metadata: { date: currentSnapshotDate }
        };
        const blob = exportToExcel(data);
        downloadFile(blob, `fund_analysis_${new Date().toISOString().split('T')[0]}.xlsx`);
      }
      // Number keys for tab navigation
      if (e.key >= '1' && e.key <= '6' && !e.ctrlKey && !e.metaKey) {
        const tabs = ['dashboard', 'performance', 'class', 'analysis', 'analytics', 'history'];
        const tabIndex = parseInt(e.key) - 1;
        if (tabIndex < tabs.length) {
          const t = tabs[tabIndex];
          setActiveTab(t);
          const to = tabToPath[t] || '/dashboard';
          navigate(to);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [funds, classSummaries, currentSnapshotDate, navigate]);

  const handleExport = () => {
    if ((funds?.length || 0) === 0) return;
    const data = {
      funds,
      classSummaries,
      reviewCandidates: identifyReviewCandidates(funds || []),
      metadata: { date: currentSnapshotDate }
    };
    const blob = exportToExcel(data);
    downloadFile(blob, `fund_analysis_${new Date().toISOString().split('T')[0]}.xlsx`);
  };



  // Load snapshots when history tab is selected
  useEffect(() => {
    if (activeTab === 'history') {
      loadSnapshots();
    }
  }, [activeTab]);

  // Handle login
  const handleLogin = (user) => {
    console.log('✅ Login successful:', user);
    setIsAuthenticated(true);
    setCurrentUser(user);
    setShowLoginModal(false);
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      await authService.logout();
      setIsAuthenticated(false);
      setCurrentUser(null);
      setShowLoginModal(true);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const loadSnapshots = async () => {
    try {
      const allSnapshots = await getAllCombinedSnapshots();
      const summary = await getDataSummary();
      console.log(
        '📊 Historical data integration active:',
        summary.combined.total,
        'total snapshots available',
        `(${summary.historical.count} historical, ${summary.user.count} user)`
      );
      setSnapshots(allSnapshots);
    } catch (error) {
      console.error('Error loading snapshots:', error);
    }
  };







  // Filtered and sorted funds
  const filteredAndSortedFunds = useMemo(() => {
    let filtered = funds || [];
    
    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(fund => 
        fund.Symbol?.toLowerCase().includes(term) ||
        fund.displayName?.toLowerCase().includes(term) ||
        fund['Asset Class']?.toLowerCase().includes(term)
      );
    }
    
    // Apply asset class filter
    if (filterAssetClass !== 'all') {
      filtered = filtered.filter(fund => fund['Asset Class'] === filterAssetClass);
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'score':
          aValue = a.scores?.final || 0;
          bValue = b.scores?.final || 0;
          break;
        case 'symbol':
          aValue = a.Symbol || '';
          bValue = b.Symbol || '';
          break;
        case 'name':
          aValue = a.displayName || '';
          bValue = b.displayName || '';
          break;
        case 'ytd':
          aValue = a['YTD'] || 0;
          bValue = b['YTD'] || 0;
          break;
        case '1year':
          aValue = a['1 Year'] || 0;
          bValue = b['1 Year'] || 0;
          break;
        case 'sharpe':
          aValue = a['Sharpe Ratio'] || 0;
          bValue = b['Sharpe Ratio'] || 0;
          break;
        case 'expense':
          aValue = a['Net Expense Ratio'] || 0;
          bValue = b['Net Expense Ratio'] || 0;
          break;
        default:
          aValue = a.scores?.final || 0;
          bValue = b.scores?.final || 0;
      }
      
      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
    
    return filtered;
  }, [funds, searchTerm, filterAssetClass, sortBy, sortDirection]);

  // Show loading screen while checking authentication
  if (authLoading) {
    return (
      <div className="app-container">
        <div className="loading-screen">
          <div className="loading-spinner large"></div>
          <p>Loading Lightship Fund Analysis...</p>
        </div>
      </div>
    );
  }

  // Show login modal if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="app-container">
        <LoginModal 
          isOpen={showLoginModal}
          onLogin={handleLogin}
          onClose={() => setShowLoginModal(false)}
        />
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Setup guard if Supabase env missing */}
      {isSupabaseStubbed && process.env.NODE_ENV !== 'test' && (
        <div style={{ padding:'2rem', maxWidth:740, margin:'2rem auto', border:'1px solid #fecaca', background:'#fef2f2', borderRadius:8 }}>
          <h2 style={{ marginTop:0, color:'#7f1d1d' }}>Setup required: Supabase environment variables</h2>
          <p style={{ color:'#7f1d1d' }}>The app is running without a live database connection. Set the following variables and restart:</p>
          <ul style={{ color:'#7f1d1d' }}>
            <li>REACT_APP_SUPABASE_URL</li>
            <li>REACT_APP_SUPABASE_ANON_KEY</li>
          </ul>
          <p style={{ color:'#7f1d1d' }}>In development, add them to <code>.env.local</code>. In preview/production, set them in your hosting provider.</p>
        </div>
      )}
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">Raymond James</div>
        <nav className="sidebar-nav">
          <button className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => { setActiveTab('dashboard'); navigate('/dashboard'); }}>Home</button>
          <button className={activeTab === 'performance' ? 'active' : ''} onClick={() => { setActiveTab('performance'); navigate('/performance'); }}>Funds</button>
          <button className={activeTab === 'class' ? 'active' : ''} onClick={() => { setActiveTab('class'); navigate('/class'); }}>Asset Classes</button>
          <button className={activeTab === 'health' ? 'active' : ''} onClick={() => { setActiveTab('health'); navigate('/health'); }}>
            Data Health
            {(() => {
              try {
                const total = (funds || []).length;
                const nz = (arr) => arr.filter(v => v != null && !Number.isNaN(v)).length;
                const ytdOk = nz((funds || []).map(f => f.ytd_return));
                const oneYOk = nz((funds || []).map(f => f.one_year_return));
                const sharpeOk = nz((funds || []).map(f => f.sharpe_ratio));
                const sd3Ok = nz((funds || []).map(f => (f.standard_deviation_3y ?? f.standard_deviation)));
                const covs = [ytdOk, oneYOk, sharpeOk, sd3Ok].map(n => total ? Math.round((n / total) * 100) : 0);
                const minCov = covs.length ? Math.min(...covs) : 0;
                const color = minCov >= 80 ? '#16a34a' : minCov >= 50 ? '#f59e0b' : '#dc2626';
                return <span style={{ marginLeft: 8, background: color, width: 10, height: 10, display:'inline-block', borderRadius: 9999 }} title={`Minimum coverage: ${minCov}%`} />;
              } catch { return null; }
            })()}
          </button>
          <button className={activeTab === 'admin' ? 'active' : ''} onClick={() => { setActiveTab('admin'); navigate('/admin'); }}>Admin</button>
        </nav>
        <div className="sidebar-footer">
          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.85)', marginBottom: '0.75rem' }}>Tip: Press Ctrl+H for help</div>
          <div className="user-info">
            <span>Welcome, {currentUser?.name || 'User'}</span>
          </div>
          <button onClick={handleLogout} className="btn btn-secondary">
            Logout
          </button>
        </div>
      </aside>
      {/* Main Content */}
      <main className="main-content">
        {/* Header */}
        <div className="header">
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 600, color: 'var(--color-primary)' }}>Lightship Fund Analysis</h1>
            <p style={{ color: 'var(--color-primary-light)' }}>Monthly fund performance analysis with Z-score ranking system</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <label style={{ fontSize: '0.875rem', color: '#6b7280' }}>As of</label>
              <select
                value={asOfMonth || ''}
                onChange={(e) => setAsOfMonth(e.target.value || null)}
                style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 6 }}
                title="Switch dataset to a specific month snapshot"
              >
                <option value="">Latest</option>
                {(availableMonths || []).map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <button 
              onClick={() => refreshData()}
              className="btn btn-secondary"
              title="Refresh data"
            >
              Refresh
            </button>
            <button 
              onClick={handleExport}
              className="btn"
              title="Export (Ctrl+E)"
            >
              Export
            </button>
            <button 
              onClick={() => setShowHelp(true)}
              style={{ 
                padding: '0.5rem 1rem',
                backgroundColor: 'var(--color-primary-light)',
                color: 'var(--color-white)',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontWeight: 600
              }}
              title="Help (Ctrl+H)"
            >
              Help
            </button>
            <button
              onClick={() => { try { window.dispatchEvent(new CustomEvent('OPEN_METHODOLOGY')); } catch {} }}
              className="btn btn-secondary"
              title="Open methodology"
            >
              Methodology
            </button>
          </div>
      </div>
        {/* Card-based main content */}
        <div className="card">
          {/* --- All previous tab content, upload, etc. goes here --- */}
          {/* ...existing app content... */}


      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <Home />
      )}

      {/* Funds Tab */}
      {activeTab === 'performance' && (
        <div>
          <EnhancedPerformanceDashboard 
            funds={funds}
            onRefresh={refreshData}
            isLoading={fundsLoading}
            asOfMonth={asOfMonth}
            onAsOfMonthChange={(val) => setAsOfMonth(val)}
          />
        </div>
      )}

      {/* Removed legacy Fund Scores tab in favor of Enhanced Performance */}

      {/* Asset Class View Tab */}
      {activeTab === 'class' && (
        <div>
              <div className="card-header">
                <h2 className="card-title">Asset Class Analysis</h2>
                <p className="card-subtitle">Performance analysis by asset class with benchmarks</p>
              </div>
              
              <div className="input-group">
                <label className="input-label">Select Asset Class:</label>
          <select
            value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="select-field"
                >
                  <option value="">Choose an asset class...</option>
                  {memoizedAssetClasses.map(cls => (
                    <option key={cls} value={cls}>{cls}</option>
            ))}
          </select>
              </div>

              {selectedClass && classSummaries[selectedClass] && (
                <div className="card">
                  <div className="card-header">
                    <h3 className="card-title">{selectedClass} Analysis</h3>
                    <p className="card-subtitle">
                      {classSummaries[selectedClass].fundCount} funds analyzed
                    </p>
                      </div>
                  
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Metric</th>
                          <th>Average</th>
                          <th>Median</th>
                          <th>Top 25%</th>
                          <th>Bottom 25%</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td><strong>YTD Return</strong></td>
                          <td>{classSummaries[selectedClass].avgYTD?.toFixed(2)}%</td>
                          <td>{classSummaries[selectedClass].medianYTD?.toFixed(2)}%</td>
                          <td>{classSummaries[selectedClass].top25YTD?.toFixed(2)}%</td>
                          <td>{classSummaries[selectedClass].bottom25YTD?.toFixed(2)}%</td>
                        </tr>
                        <tr>
                          <td><strong>1 Year Return</strong></td>
                          <td>{classSummaries[selectedClass].avg1Y?.toFixed(2)}%</td>
                          <td>{classSummaries[selectedClass].median1Y?.toFixed(2)}%</td>
                          <td>{classSummaries[selectedClass].top251Y?.toFixed(2)}%</td>
                          <td>{classSummaries[selectedClass].bottom251Y?.toFixed(2)}%</td>
                        </tr>
                        <tr>
                          <td><strong>3 Year Return</strong></td>
                          <td>{classSummaries[selectedClass].avg3Y?.toFixed(2)}%</td>
                          <td>{classSummaries[selectedClass].median3Y?.toFixed(2)}%</td>
                          <td>{classSummaries[selectedClass].top253Y?.toFixed(2)}%</td>
                          <td>{classSummaries[selectedClass].bottom253Y?.toFixed(2)}%</td>
                        </tr>
                        <tr>
                          <td><strong>Sharpe Ratio</strong></td>
                          <td>{classSummaries[selectedClass].avgSharpe?.toFixed(2)}</td>
                          <td>{classSummaries[selectedClass].medianSharpe?.toFixed(2)}</td>
                          <td>{classSummaries[selectedClass].top25Sharpe?.toFixed(2)}</td>
                          <td>{classSummaries[selectedClass].bottom25Sharpe?.toFixed(2)}</td>
                        </tr>
                      </tbody>
                    </table>
                    </div>
                      </div>
              )}
                    </div>
          )}

          {/* Analysis Tab */}
          {activeTab === 'analysis' && (
                    <div>
              <div className="card-header">
                <h2 className="card-title">Fund Analysis</h2>
                <p className="card-subtitle">Detailed analysis and insights for fund performance</p>
                      </div>
              
              {scoredFundData.length > 0 ? (
                    <div>
                  {/* Review Candidates */}
                  <div className="card">
                    <div className="card-header">
                      <h3 className="card-title">Review Candidates</h3>
                      <p className="card-subtitle">Funds that may need attention based on performance metrics</p>
                      </div>
                    {reviewCandidates.length > 0 ? (
                      <div className="table-container">
                        <table>
                <thead>
                            <tr>
                              <th>Symbol</th>
                              <th>Fund Name</th>
                              <th>Asset Class</th>
                              <th>Score</th>
                              <th>Issues</th>
                              <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                            {reviewCandidates.map((fund, index) => (
                              <tr key={fund.Symbol || index}>
                                <td><strong>{fund.Symbol}</strong></td>
                                <td>{fund['Fund Name']}</td>
                                <td>{fund['Asset Class']}</td>
                                <td>
                                  <span className="score-badge" style={{
                                    backgroundColor: fund.score >= 0.7 ? '#059669' : 
                                                  fund.score >= 0.5 ? '#3B82F6' : 
                                                  fund.score >= 0.3 ? '#F59E0B' : '#DC2626',
                                    padding: 'var(--spacing-xs) var(--spacing-sm)',
                                    borderRadius: 'var(--border-radius)',
                                    color: 'white',
                                    fontWeight: '600',
                                    fontSize: '0.875rem'
                                  }}>
                                    {fund.score?.toFixed(3)}
                        </span>
                      </td>
                                <td>
                                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                                    {fund.issues?.join(', ') || 'Low performance'}
                                  </div>
                      </td>
                                <td>
                                  <button
                                    className="btn btn-secondary"
                                    style={{ padding: 'var(--spacing-xs) var(--spacing-sm)', fontSize: '0.75rem' }}
                                  >
                                    Details
                                  </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
        </div>
                    ) : (
                      <div className="alert alert-success">
                        <strong>Great news!</strong> No funds require immediate review.
                    </div>
                    )}
                          </div>
                          
                  {/* Asset Class Performance */}
                  <div className="card">
                    <div className="card-header">
                      <h3 className="card-title">Asset Class Performance Summary</h3>
                      <p className="card-subtitle">Performance metrics by asset class</p>
                          </div>
                    <div className="table-container">
                      <table>
                        <thead>
                          <tr>
                            <th>Asset Class</th>
                            <th>Fund Count</th>
                            <th>Avg Score</th>
                            <th>Avg YTD</th>
                            <th>Avg 1Y</th>
                            <th>Avg 3Y</th>
                            <th>Avg Sharpe</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(classSummaries).map(([className, summary]) => (
                            <tr key={className}>
                              <td><strong>{className}</strong></td>
                              <td>{summary.fundCount}</td>
                              <td>{summary.averageScore?.toFixed(3)}</td>
                              <td>{summary.avgYTD?.toFixed(2)}%</td>
                              <td>{summary.avg1Y?.toFixed(2)}%</td>
                              <td>{summary.avg3Y?.toFixed(2)}%</td>
                              <td>{summary.avgSharpe?.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
              </div>
              ) : (
                <div className="card" style={{ display:'grid', gap:12 }}>
                  <div className="card-header">
                    <h3 className="card-title">No Data Yet</h3>
                    <p className="card-subtitle">Import a monthly CSV or try sample data to explore this analysis.</p>
                  </div>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    <button className="btn" onClick={() => { setActiveTab('admin'); navigate('/admin'); window.dispatchEvent(new CustomEvent('NAVIGATE_ADMIN', { detail: { subtab: 'data' } })); }}>Go to Importer</button>
                    <button className="btn btn-secondary" onClick={() => { setActiveTab('admin'); navigate('/admin'); window.dispatchEvent(new CustomEvent('NAVIGATE_ADMIN', { detail: { subtab: 'data' } })); setTimeout(()=>{ try { window.dispatchEvent(new CustomEvent('LOAD_SAMPLE_DATA')); } catch {} }, 300); }}>Use sample data</button>
                  </div>
                </div>
              )}
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div>
              <div className="card-header">
                <h2 className="card-title">Advanced Analytics</h2>
                <p className="card-subtitle">Correlation analysis and risk-return insights</p>
              </div>
          
          {scoredFundData.length > 0 ? (
                      <div>
                  <div className="card">
                    <div className="card-header">
                      <h3 className="card-title">Correlation Matrix</h3>
                      <p className="card-subtitle">Fund performance correlations across asset classes</p>
                        </div>
                    <CorrelationMatrix data={scoredFundData} />
                      </div>
                      
                  <div className="card">
                    <div className="card-header">
                      <h3 className="card-title">Risk-Return Analysis</h3>
                      <p className="card-subtitle">Risk-adjusted performance scatter plot</p>
                        </div>
                    <RiskReturnScatter data={scoredFundData} />
                      </div>
                        </div>
              ) : (
                <div className="card">
                  <div className="card-header">
                    <h3 className="card-title">No Data Available</h3>
                    <p className="card-subtitle">Upload fund data to see analytics</p>
                  </div>
            </div>
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div>
              <div className="card-header">
                <h2 className="card-title">Historical Data</h2>
                <p className="card-subtitle">Compare fund performance over time</p>
              </div>
              
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Available Snapshots</h3>
                  <p className="card-subtitle">Select snapshots to compare historical performance</p>
                </div>
                
                <div className="input-group">
                  <label className="input-label">Current Snapshot:</label>
                  <select
                    value={selectedSnapshot || ''}
                    onChange={(e) => setSelectedSnapshot(e.target.value)}
                    className="select-field"
                  >
                    <option value="">Select a snapshot...</option>
                    {snapshots.map(snapshot => (
                      <option key={snapshot.date} value={snapshot.date}>
                        {snapshot.date} ({snapshot.fundCount} funds)
                      </option>
                    ))}
                  </select>
              </div>

                <div className="input-group">
                  <label className="input-label">Compare With:</label>
                      <select
                    value={compareSnapshot || ''}
                    onChange={(e) => setCompareSnapshot(e.target.value)}
                    className="select-field"
                  >
                    <option value="">Select comparison snapshot...</option>
                    {snapshots.filter(s => s.date !== selectedSnapshot).map(snapshot => (
                      <option key={snapshot.date} value={snapshot.date}>
                        {snapshot.date} ({snapshot.fundCount} funds)
                            </option>
                          ))}
                      </select>
                    </div>

                {selectedSnapshot && compareSnapshot && snapshotComparison && (
                  <div className="card">
                    <div className="card-header">
                      <h3 className="card-title">Comparison Results</h3>
                      <p className="card-subtitle">
                        {selectedSnapshot} vs {compareSnapshot}
                      </p>
                    </div>
                    <div className="table-container">
                      <table>
                      <thead>
                          <tr>
                            <th>Metric</th>
                            <th>{selectedSnapshot}</th>
                            <th>{compareSnapshot}</th>
                            <th>Change</th>
                        </tr>
                      </thead>
                      <tbody>
                          <tr>
                            <td><strong>Total Funds</strong></td>
                            <td>{snapshotComparison.current.fundCount}</td>
                            <td>{snapshotComparison.previous.fundCount}</td>
                            <td style={{ color: snapshotComparison.fundCountChange >= 0 ? '#059669' : '#DC2626' }}>
                              {snapshotComparison.fundCountChange > 0 ? '+' : ''}{snapshotComparison.fundCountChange}
                            </td>
                          </tr>
                          <tr>
                            <td><strong>Average Score</strong></td>
                            <td>{snapshotComparison.current.avgScore?.toFixed(3)}</td>
                            <td>{snapshotComparison.previous.avgScore?.toFixed(3)}</td>
                            <td style={{ color: snapshotComparison.scoreChange >= 0 ? '#059669' : '#DC2626' }}>
                              {snapshotComparison.scoreChange > 0 ? '+' : ''}{snapshotComparison.scoreChange?.toFixed(3)}
                            </td>
                          </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                        )}
                      </div>
        </div>
      )}

      {/* Admin Tab */}
      {activeTab === 'admin' && (
        <div>
          <FundManagement />
        </div>
      )}

      {/* Health Tab */}
      {activeTab === 'health' && (
        <div>
          <HealthCheck />
        </div>
      )}

      {/* Help Modal */}
      {showHelp && (
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
          zIndex: 2000
        }} onClick={() => setShowHelp(false)}>
          <div style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '0.5rem',
            maxWidth: '800px',
            maxHeight: '80vh',
            overflow: 'auto',
            width: '90%'
          }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
              Lightship Fund Analysis - Help Guide
            </h2>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Quick Start</h3>
              <ol style={{ marginLeft: '1.5rem', fontSize: '0.875rem', color: '#374151' }}>
                <li>Go to Admin tab to add funds by entering ticker symbols (e.g., VTSAX, SPY)</li>
                <li>Assign asset classes to each fund (Large Cap Growth, etc.)</li>
                <li>The system automatically fetches performance data from Ycharts API</li>
                <li>View real-time performance data in the Performance tab</li>
              </ol>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Scoring Methodology</h3>
              <p style={{ fontSize: '0.875rem', color: '#374151', marginBottom: '0.5rem' }}>
                Each fund receives a 0-100 score based on weighted Z-scores across 13 metrics:
              </p>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr',
                gap: '0.5rem',
                fontSize: '0.75rem',
                backgroundColor: '#f9fafb',
                padding: '1rem',
                borderRadius: '0.375rem'
              }}>
                <div>• YTD Return (2.5%)</div>
                <div>• 1-Year Return (5%)</div>
                <div>• 3-Year Return (10%)</div>
                <div>• 5-Year Return (20%)</div>
                <div>• 10-Year Return (10%)</div>
                <div>• 3Y Sharpe Ratio (15%)</div>
                <div>• 3Y Std Deviation (-10%)</div>
                <div>• 5Y Std Deviation (-15%)</div>
                <div>• Up Capture Ratio (7.5%)</div>
                <div>• Down Capture Ratio (-10%)</div>
                <div>• 5Y Alpha (5%)</div>
                <div>• Expense Ratio (-2.5%)</div>
                <div>• Manager Tenure (2.5%)</div>
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Keyboard Shortcuts</h3>
              <div style={{ fontSize: '0.875rem', color: '#374151' }}>
                <div style={{ marginBottom: '0.25rem' }}><kbd>Ctrl+H</kbd> - Open this help dialog</div>
                <div style={{ marginBottom: '0.25rem' }}><kbd>Ctrl+E</kbd> - Export to Excel</div>
                <div style={{ marginBottom: '0.25rem' }}><kbd>1-6</kbd> - Quick navigation between tabs</div>
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Tab Overview</h3>
              <div style={{ fontSize: '0.875rem', color: '#374151' }}>
                <div style={{ marginBottom: '0.5rem' }}>
                  <strong>Dashboard:</strong> Visual overview with heatmaps and top/bottom performers
                </div>
                <div style={{ marginBottom: '0.5rem' }}>
                  <strong>Performance:</strong> Real-time fund performance analysis with filtering
                </div>
                <div style={{ marginBottom: '0.5rem' }}>
                  <strong>Fund Scores:</strong> Detailed table of all funds with scores and metrics
                </div>
                <div style={{ marginBottom: '0.5rem' }}>
                  <strong>Class View:</strong> Compare funds within specific asset classes
                </div>
                <div style={{ marginBottom: '0.5rem' }}>
                  <strong>Analysis:</strong> Smart tags and funds requiring review
                </div>
                <div style={{ marginBottom: '0.5rem' }}>
                  <strong>Analytics:</strong> Advanced visualizations including risk-return and correlations
                </div>
                <div style={{ marginBottom: '0.5rem' }}>
                  <strong>History:</strong> Track performance over time and compare snapshots
                </div>
                <div style={{ marginBottom: '0.5rem' }}>
                  <strong>Admin:</strong> Add and manage funds with automatic API data fetching
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Score Interpretation</h3>
              <div style={{ fontSize: '0.875rem', color: '#374151' }}>
                <div style={{ marginBottom: '0.25rem' }}>
                  <span style={{ color: '#16a34a', fontWeight: '600' }}>70-100:</span> Excellent - Strong risk-adjusted returns and efficiency
                </div>
                <div style={{ marginBottom: '0.25rem' }}>
                  <span style={{ color: '#eab308', fontWeight: '600' }}>50-70:</span> Good - Average performance, monitor for trends
                </div>
                <div style={{ marginBottom: '0.25rem' }}>
                  <span style={{ color: '#dc2626', fontWeight: '600' }}>Below 50:</span> Poor - Consider for replacement or further analysis
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'right', marginTop: '2rem' }}>
              <button
                onClick={() => setShowHelp(false)}
                style={{
                  padding: '0.5rem 1.5rem',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
          )}


        </div>
      </main>
      <MethodologyDrawer />
      {/* Footer */}
      <footer className="footer">
        &copy; {new Date().getFullYear()} Raymond James (Demo) | Lightship Fund Analysis
      </footer>
    </div>
  );
};

export default App;
