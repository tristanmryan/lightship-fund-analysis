// App.jsx
import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy } from 'react';

import { useLocation, useNavigate, Routes, Route, Navigate } from 'react-router-dom';
import './App.css'; // Import the CSS file
import './styles/professional.css';
import LoginModal from './components/Auth/LoginModal';
import fundService from './services/fundService';

import Dashboard from './components/Dashboard/Dashboard';
import Layout from './layout/Layout.jsx';
// Lazy-load heavy Admin screen
// Removed AssetClass and Compare views in v3 streamline
import MonthlyReportButton from './components/Reports/MonthlyReportButton';
import Portfolios from './components/Portfolios/Portfolios.jsx';
import Trading from './components/Trading/Trading.jsx';
// Command Center removed in v3 streamline
import RecommendedList from './components/Recommended/RecommendedList.jsx';
import ScoringTab from './components/Scoring/ScoringTab.jsx';
import { exportToExcel, downloadFile } from './services/exportService.js';

// Import new services
import authService from './services/authService';
import migrationService from './services/migrationService';
import { useFundData } from './hooks/useFundData';
import { prefetchBenchmarkMappings } from './services/resolvers/benchmarkResolverClient';
const PDFPreview = lazy(() => import('./components/Reports/PDFPreview.jsx'));
const Admin = lazy(() => import('./components/Admin/FundManagement.jsx'));

const App = () => {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Fund data management using useFundData hook
  const {
    funds,
    // loading,
    // error,
    refreshData,
    asOfMonth,
    setAsOfMonth
  } = useFundData();

  // Navigation and UI state
  const [activeTab, setActiveTab] = useState('dashboard');

  const [availableMonths, setAvailableMonths] = useState([]);








  // Help modal state

  // Router integration: sync activeTab with URL
  const location = useLocation();
  const navigate = useNavigate();

  const tabToPath = useMemo(() => ({
    dashboard: '/dashboard',
    recommended: '/recommended',
    portfolios: '/portfolios',
    trading: '/trading',
    scoring: '/scoring',
    reports: '/reports',
    admin: '/admin',
    pdfpreview: '/pdf-preview'
  }), []);
  const pathToTab = (pathname) => {
    if (pathname.startsWith('/recommended')) return 'recommended';
    if (pathname.startsWith('/portfolios')) return 'portfolios';
    if (pathname.startsWith('/trading')) return 'trading';
    if (pathname.startsWith('/scoring')) return 'scoring';
    if (pathname.startsWith('/reports')) return 'reports';
    if (pathname.startsWith('/pdf-preview')) return 'pdfpreview';
    // if (pathname.startsWith('/command')) return 'command';
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
        console.log('Ãƒ°Ã…¸Ã¢â‚¬Ã‚ Checking authentication...');
        console.log('Ãƒ°Ã…¸Ã¢â‚¬Ã‚§ Environment check:', {
          supabaseUrl: process.env.REACT_APP_SUPABASE_URL ? 'Ãƒ¢Ã…â€œÃ¢â‚¬¦ Set' : 'Ãƒ¢Ã‚Ã…â€™ Missing',
          supabaseKey: process.env.REACT_APP_SUPABASE_ANON_KEY ? 'Ãƒ¢Ã…â€œÃ¢â‚¬¦ Set' : 'Ãƒ¢Ã‚Ã…â€™ Missing',
          ychartsKey: process.env.REACT_APP_YCHARTS_API_KEY ? 'Ãƒ¢Ã…â€œÃ¢â‚¬¦ Set' : 'Ãƒ¢Ã‚Ã…â€™ Missing',
          appPassword: process.env.REACT_APP_APP_PASSWORD ? 'Ãƒ¢Ã…â€œÃ¢â‚¬¦ Set' : 'Ãƒ¢Ã‚Ã…â€™ Missing'
        });
        
        setAuthLoading(true);
        const authResult = await authService.checkAuth();
        
        console.log('Ãƒ°Ã…¸Ã¢â‚¬Ã‚ Auth result:', authResult);
        
        if (authResult.success) {
          console.log('Ãƒ¢Ã…â€œÃ¢â‚¬¦ User is authenticated');
          setIsAuthenticated(true);
          setCurrentUser(authResult.user);
        } else {
          console.log('Ãƒ¢Ã‚Ã…â€™ User is not authenticated, showing login modal');
          setIsAuthenticated(false);
          setCurrentUser(null);
          setShowLoginModal(true);
        }
      } catch (error) {
        console.error('Ãƒ¢Ã‚Ã…â€™ Authentication check failed:', error);
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
          console.log('Ãƒ°Ã…¸Ã¢â‚¬Ã‚ Checking migration status...');
          const migrationStatus = await migrationService.checkMigrationStatus();
          console.log('Ãƒ°Ã…¸Ã¢â‚¬Å“Ã…  Migration status:', migrationStatus);
          
          if (migrationStatus.needsMigration) {
            console.log('Ãƒ°Ã…¸Ã¢â‚¬Ã¢â‚¬Å¾ Migration needed. Starting migration from IndexedDB to Supabase...');
            const migrationResult = await migrationService.migrateFromIndexedDB();
            console.log('Ãƒ¢Ã…â€œÃ¢â‚¬¦ Migration completed:', migrationResult);
          } else {
            console.log('Ãƒ¢Ã…â€œÃ¢â‚¬¦ No migration needed. Supabase data is up to date.');
          }
        } catch (error) {
          console.error('Ãƒ¢Ã‚Ã…â€™ Migration check failed:', error);
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
  }, [navigate, tabToPath]);

  

  const handleExport = useCallback(() => {
    if ((funds?.length || 0) === 0) return;
    const data = {
      funds,
      metadata: { date: asOfMonth || new Date().toISOString().split('T')[0] }
    };
    const blob = exportToExcel(data);
    downloadFile(blob, `fund_analysis_${new Date().toISOString().split('T')[0]}.xlsx`);
  }, [funds, asOfMonth]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Ctrl/Cmd + H for help
      if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
        e.preventDefault();
        try { window.dispatchEvent(new CustomEvent('OPEN_HELP')); } catch {}
      }
      // Ctrl/Cmd + E for export
      if ((e.ctrlKey || e.metaKey) && e.key === 'e' && (funds?.length || 0) > 0) {
        e.preventDefault();
        handleExport();
      }
      // Number keys for tab navigation
      if (e.key >= '1' && e.key <= '5' && !e.ctrlKey && !e.metaKey) {
        const tabs = ['dashboard', 'recommended', 'portfolios', 'trading', 'scoring', 'reports'];
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
  }, [funds, navigate, currentUser, tabToPath, handleExport]);

  





  // Handle login
  const handleLogin = (user) => {
    console.log('Ãƒ¢Ã…â€œÃ¢â‚¬¦ Login successful:', user);
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
    <Layout
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      navigate={navigate}
      currentUser={currentUser}
      handleLogout={handleLogout}
      asOfMonth={asOfMonth}
      setAsOfMonth={setAsOfMonth}
      availableMonths={availableMonths}
      refreshData={refreshData}
      handleExport={handleExport}
    >
      <div className="card">
          {/* --- All previous tab content, upload, etc. goes here --- */}
          {/* ...existing app content... */}

          {/* Route-based content */}
          <Routes>
            <Route
              path="/"
              element={<Navigate to={tabToPath[localStorage.getItem('lastTab')] || '/dashboard'} replace />}
            />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/recommended" element={(
              <div>
                <div className="card-header">
                  <h2 className="card-title">Recommended Funds</h2>
                  <p className="card-subtitle">Recommended list grouped by asset class with ownership metrics</p>
                </div>
                <RecommendedList asOfMonth={asOfMonth} />
              </div>
            )} />
            <Route path="/portfolios" element={(
              <div>
                <div className="card-header">
                  <h2 className="card-title">Portfolios</h2>
                  <p className="card-subtitle">Holdings analysis by advisor or by fund, plus gap analysis</p>
                </div>
                <Portfolios />
              </div>
            )} />
            <Route path="/trading" element={(
              <div>
                <div className="card-header">
                  <h2 className="card-title">Trading</h2>
                  <p className="card-subtitle">Monthly net flows and top movers</p>
                </div>
                <Trading />
              </div>
            )} />
            <Route path="/scoring" element={<ScoringTab />} />
            <Route path="/reports" element={(
              <div>
                <div className="card-header">
                  <h2 className="card-title">Reports</h2>
                  <p className="card-subtitle">Generate and download professional fund analysis reports</p>
                </div>
                <MonthlyReportButton />
                <div className="card" style={{ marginTop: '1.5rem' }}>
                  <div className="card-header">
                    <h3 className="card-title">Monthly PDF â€” Live Preview</h3>
                    <p className="card-subtitle">Open a live preview to fine-tune layout and styles</p>
                  </div>
                  <div>
                    <button className="btn" onClick={() => navigate('/pdf-preview')}>
                      Open Preview
                    </button>
                  </div>
                </div>
              </div>
            )} />
            <Route path="/pdf-preview" element={(
              <div>
                <div className="card-header">
                  <h2 className="card-title">Monthly PDF â€” Live Preview</h2>
                  <p className="card-subtitle">Edit theme tokens and refresh to see changes instantly</p>
                </div>
                <Suspense fallback={<div>Loading previewâ€¦</div>}>
                  <PDFPreview />
                </Suspense>
              </div>
            )} />
            <Route path="/admin" element={(
              currentUser?.role === 'admin' ? (
                <Suspense fallback={<div>Loading adminâ€¦</div>}>
                  <Admin />
                </Suspense>
              ) : (
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
              )
            )} />
            {/* Legacy alias redirects */}
            <Route path="/funds" element={<Navigate to="/dashboard" replace />} />
            <Route path="/scores" element={<Navigate to="/dashboard" replace />} />
            <Route path="/performance" element={<Navigate to="/dashboard" replace />} />
            <Route path="/class" element={<Navigate to="/dashboard" replace />} />
            <Route path="/analysis" element={<Navigate to="/dashboard" replace />} />
            <Route path="/analytics" element={<Navigate to="/dashboard" replace />} />
            <Route path="/history" element={<Navigate to="/dashboard" replace />} />
            <Route path="/health" element={<Navigate to="/dashboard" replace />} />
          </Routes>


      </div>
    </Layout>
  );
};

export default App;







