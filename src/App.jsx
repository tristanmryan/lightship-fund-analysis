// App.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Home as HomeIcon, BarChart3 as BarChartIcon, Settings, Download, RefreshCw, HelpCircle, Info, TrendingUp as CompareIcon, Users as AdvisorsIcon, Activity as FlowsIcon, Bell as BellIcon } from 'lucide-react';
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

import fundRegistry from './services/fundRegistry';
import Home from './components/Dashboard/Home';
import MethodologyDrawer from './components/Dashboard/MethodologyDrawer';
import FundManagement from './components/Admin/FundManagement';
import AssetClassTable from './components/Dashboard/AssetClassTable';
import ComparisonPanel from './components/Dashboard/ComparisonPanel';
import MonthlyReportButton from './components/Reports/MonthlyReportButton';
import PortfolioDashboard from './components/Advisor/PortfolioDashboard.jsx';
import TradeFlowDashboard from './components/Analytics/TradeFlowDashboard.jsx';
import CommandCenter from './components/CommandCenter/CommandCenter.jsx';
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

  // Navigation and UI state
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedClass, setSelectedClass] = useState('');

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

  // Find the selected asset class ID from fund data
  const selectedAssetClassData = useMemo(() => {
    if (!selectedClass || !funds || funds.length === 0) return null;
    
    // Find a fund with matching asset class name to get the ID
    const matchingFund = funds.find(fund => 
      fund.asset_class_name === selectedClass || 
      fund.asset_class === selectedClass ||
      fund['Asset Class'] === selectedClass
    );
    
    return matchingFund ? {
      id: matchingFund.asset_class_id,
      name: matchingFund.asset_class_name || matchingFund.asset_class || selectedClass
    } : { id: null, name: selectedClass };
  }, [selectedClass, funds]);





  // Help modal state
  const [showHelp, setShowHelp] = useState(false);

  // Router integration: sync activeTab with URL
  const location = useLocation();
  const navigate = useNavigate();

  const tabToPath = {
    dashboard: '/dashboard',
    assetclasses: '/assetclasses',
    compare: '/compare',
    reports: '/reports',
    flows: '/flows',
    advisors: '/advisors',
    command: '/command',
    admin: '/admin'
  };
  const pathToTab = (pathname) => {
    if (pathname.startsWith('/assetclasses')) return 'assetclasses';
    if (pathname.startsWith('/compare')) return 'compare';
    if (pathname.startsWith('/reports')) return 'reports';
    if (pathname.startsWith('/flows')) return 'flows';
    if (pathname.startsWith('/advisors')) return 'advisors';
    if (pathname.startsWith('/command')) return 'command';
    if (pathname.startsWith('/admin')) return 'admin';
    return 'dashboard';
  };

  // Redirect root to /dashboard on first load
  useEffect(() => {
    // Alias redirects for old URLs
    const aliasMap = {
      '/funds': '/dashboard',
      '/scores': '/dashboard',
      '/performance': '/dashboard',
      '/class': '/assetclasses',
      '/analysis': '/dashboard',
      '/analytics': '/dashboard',
      '/history': '/dashboard',
      '/health': '/dashboard'
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
        handleExport();
      }
      // Number keys for tab navigation
      if (e.key >= '1' && e.key <= '5' && !e.ctrlKey && !e.metaKey) {
        const tabs = ['dashboard', 'assetclasses', 'compare', 'reports', 'admin'];
        const tabIndex = parseInt(e.key) - 1;
        if (tabIndex < tabs.length) {
          const t = tabs[tabIndex];
          // Check admin access for tab 5
          if (t === 'admin' && currentUser?.role !== 'admin') return;
          setActiveTab(t);
          const to = tabToPath[t] || '/dashboard';
          navigate(to);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [funds, navigate, currentUser]);

  const handleExport = () => {
    if ((funds?.length || 0) === 0) return;
    const data = {
      funds,
      metadata: { date: asOfMonth || new Date().toISOString().split('T')[0] }
    };
    const blob = exportToExcel(data);
    downloadFile(blob, `fund_analysis_${new Date().toISOString().split('T')[0]}.xlsx`);
  };





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
          <button className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => { setActiveTab('dashboard'); navigate('/dashboard'); }}>
            <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
              <HomeIcon size={16} aria-hidden />
              <span>Dashboard</span>
            </span>
          </button>
            <button className={activeTab === 'command' ? 'active' : ''} onClick={() => { setActiveTab('command'); navigate('/command'); }}>
              <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                <BellIcon size={16} aria-hidden />
                <span>Command Center</span>
              </span>
            </button>
            <button className={activeTab === 'advisors' ? 'active' : ''} onClick={() => { setActiveTab('advisors'); navigate('/advisors'); }}>
              <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                <AdvisorsIcon size={16} aria-hidden />
                <span>Advisors</span>
              </span>
            </button>
          <button className={activeTab === 'assetclasses' ? 'active' : ''} onClick={() => { setActiveTab('assetclasses'); navigate('/assetclasses'); }}>
            <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
              <BarChartIcon size={16} aria-hidden />
              <span>Asset Classes</span>
            </span>
          </button>
            <button className={activeTab === 'compare' ? 'active' : ''} onClick={() => { setActiveTab('compare'); navigate('/compare'); }}>
              <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                <CompareIcon size={16} aria-hidden />
                <span>Compare</span>
              </span>
            </button>
            <button className={activeTab === 'flows' ? 'active' : ''} onClick={() => { setActiveTab('flows'); navigate('/flows'); }}>
              <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                <FlowsIcon size={16} aria-hidden />
                <span>Flows</span>
              </span>
            </button>
            <button className={activeTab === 'reports' ? 'active' : ''} onClick={() => { setActiveTab('reports'); navigate('/reports'); }}>
              <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                <Download size={16} aria-hidden />
                <span>Reports</span>
              </span>
            </button>
          {currentUser?.role === 'admin' && (
            <button className={activeTab === 'admin' ? 'active' : ''} onClick={() => { setActiveTab('admin'); navigate('/admin'); }}>
              <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                <Settings size={16} aria-hidden />
                <span>Admin</span>
              </span>
            </button>
          )}
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
              style={{ display:'inline-flex', alignItems:'center', gap:6 }}
            >
              <RefreshCw size={16} aria-hidden />
              <span>Refresh</span>
            </button>
            <button 
              onClick={handleExport}
              className="btn"
              title="Export (Ctrl+E)"
              style={{ display:'inline-flex', alignItems:'center', gap:6 }}
            >
              <Download size={16} aria-hidden />
              <span>Export</span>
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
              <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                <HelpCircle size={16} aria-hidden />
                <span>Help</span>
              </span>
            </button>
            <button
              onClick={() => { try { window.dispatchEvent(new CustomEvent('OPEN_METHODOLOGY')); } catch {} }}
              className="btn btn-secondary"
              title="Open methodology"
              style={{ display:'inline-flex', alignItems:'center', gap:6 }}
            >
              <Info size={16} aria-hidden />
              <span>Methodology</span>
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

      {/* Asset Classes Tab */}
      {activeTab === 'assetclasses' && (
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

              {selectedClass && selectedAssetClassData && (
                <AssetClassTable 
                  assetClassId={selectedAssetClassData.id}
                  assetClassName={selectedAssetClassData.name}
                />
              )}
                    </div>
          )}

      {/* Compare View Tab */}
      {activeTab === 'compare' && (
        <div>
          <div className="card-header">
            <h2 className="card-title">Fund Comparison</h2>
            <p className="card-subtitle">Compare up to 4 funds and benchmarks side-by-side</p>
          </div>
          
          <ComparisonPanel 
            funds={funds || []}
          />
        </div>
      )}

      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <div>
          <div className="card-header">
            <h2 className="card-title">Reports</h2>
            <p className="card-subtitle">Generate and download professional fund analysis reports</p>
          </div>
          
          {/* Enhanced Reports Section with PDF Export */}
          <MonthlyReportButton />
          
          {/* Legacy Excel Export Option */}
          <div className="card" style={{ marginTop: '1.5rem' }}>
            <div className="card-header">
              <h3 className="card-title">Legacy Export Options</h3>
              <p className="card-subtitle">Additional export formats for compatibility</p>
            </div>
            
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div style={{ 
                padding: '1.5rem', 
                border: '1px solid #e5e7eb', 
                borderRadius: '0.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <h4 style={{ margin: 0, fontWeight: '600' }}>Excel Export</h4>
                  <p style={{ margin: '0.25rem 0 0 0', color: '#6b7280', fontSize: '0.875rem' }}>
                    Complete fund analysis with scores, metrics, and recommendations
                  </p>
                </div>
                <button 
                  onClick={handleExport}
                  className="btn"
                  disabled={(funds?.length || 0) === 0}
                  style={{ display:'inline-flex', alignItems:'center', gap:6 }}
                >
                  <Download size={16} aria-hidden />
                  <span>Download</span>
                </button>
              </div>
              
              {(funds?.length || 0) === 0 && (
                <div className="alert alert-info">
                  <strong>No data available.</strong> Import fund data to generate reports.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Advisors Tab */}
      {activeTab === 'advisors' && (
        <div>
          <div className="card-header">
            <h2 className="card-title">Advisor Portfolios</h2>
            <p className="card-subtitle">Holdings intelligence by advisor and snapshot</p>
          </div>
          <PortfolioDashboard />
        </div>
      )}

      {/* Flows Tab */}
      {activeTab === 'flows' && (
        <div>
          <div className="card-header">
            <h2 className="card-title">Trade Flows</h2>
            <p className="card-subtitle">Firm-wide fund flow intelligence</p>
          </div>
          <TradeFlowDashboard />
        </div>
      )}

      {/* Command Center Tab */}
      {activeTab === 'command' && (
        <div>
          <div className="card-header">
            <h2 className="card-title">Alerts Command Center</h2>
            <p className="card-subtitle">Prioritized queues, filters, drill-through, and actions</p>
          </div>
          <CommandCenter />
        </div>
      )}

      {/* Admin Tab - Role-based access */}
      {activeTab === 'admin' && currentUser?.role === 'admin' && (
        <div>
          <FundManagement />
        </div>
      )}

      {/* Access denied for non-admin users */}
      {activeTab === 'admin' && currentUser?.role !== 'admin' && (
        <div>
          <div className="card-header">
            <h2 className="card-title">Access Denied</h2>
            <p className="card-subtitle">Administrative privileges required</p>
          </div>
          
          <div className="alert alert-warning">
            <strong>Restricted Access:</strong> You need administrative privileges to access this section.
            Contact your system administrator for access.
          </div>
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
                <div style={{ marginBottom: '0.25rem' }}><kbd>1-5</kbd> - Quick navigation between tabs</div>
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Tab Overview</h3>
              <div style={{ fontSize: '0.875rem', color: '#374151' }}>
                <div style={{ marginBottom: '0.5rem' }}>
                  <strong>Dashboard:</strong> Visual overview with fund performance analysis and key metrics
                </div>
                <div style={{ marginBottom: '0.5rem' }}>
                  <strong>Asset Classes:</strong> Performance analysis by asset class with benchmark comparisons
                </div>
                <div style={{ marginBottom: '0.5rem' }}>
                  <strong>Compare:</strong> Side-by-side comparison of up to 4 funds and benchmarks
                </div>
                <div style={{ marginBottom: '0.5rem' }}>
                  <strong>Reports:</strong> Professional export options for presentations and analysis
                </div>
                <div style={{ marginBottom: '0.5rem' }}>
                  <strong>Admin:</strong> Fund management and data import (admin access required)
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
