// src/layout/Layout.jsx
import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Home as HomeIcon, BarChart3 as BarChartIcon, Settings, Download, RefreshCw, HelpCircle, Info, TrendingUp as TrendingUpIcon, Briefcase as BriefcaseIcon, Sliders as SlidersIcon } from 'lucide-react';
import MethodologyDrawer from '../components/Dashboard/MethodologyDrawer';
import { isSupabaseStubbed } from '../services/supabase';

export default function Layout({
  activeTab,
  setActiveTab,
  navigate,
  currentUser,
  handleLogout,
  asOfMonth,
  setAsOfMonth,
  availableMonths = [],
  refreshData,
  handleExport,
  children,
}) {
  const [showHelp, setShowHelp] = useState(false);
  useEffect(() => {
    const open = () => setShowHelp(true);
    window.addEventListener('OPEN_HELP', open);
    return () => window.removeEventListener('OPEN_HELP', open);
  }, []);

  return (
    <div className="app-container">
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

      <aside className="sidebar">
        <div className="sidebar-logo">Raymond James</div>
        <nav className="sidebar-nav">
          <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'active' : ''}>
            <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
              <HomeIcon size={16} aria-hidden />
              <span>Dashboard</span>
            </span>
          </NavLink>
          <NavLink to="/recommended" className={({ isActive }) => isActive ? 'active' : ''}>
            <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
              <BarChartIcon size={16} aria-hidden />
              <span>Recommended</span>
            </span>
          </NavLink>
          <NavLink to="/portfolios" className={({ isActive }) => isActive ? 'active' : ''}>
            <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
              <BriefcaseIcon size={16} aria-hidden />
              <span>Portfolios</span>
            </span>
          </NavLink>
          <NavLink to="/trading" className={({ isActive }) => isActive ? 'active' : ''}>
            <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
              <TrendingUpIcon size={16} aria-hidden />
              <span>Trading</span>
            </span>
          </NavLink>
          <NavLink to="/scoring" className={({ isActive }) => isActive ? 'active' : ''}>
            <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
              <SlidersIcon size={16} aria-hidden />
              <span>Scoring</span>
            </span>
          </NavLink>
          <NavLink to="/reports" className={({ isActive }) => isActive ? 'active' : ''}>
            <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
              <Download size={16} aria-hidden />
              <span>Reports</span>
            </span>
          </NavLink>
          {currentUser?.role === 'admin' && (
            <NavLink to="/admin" className={({ isActive }) => isActive ? 'active' : ''}>
              <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                <Settings size={16} aria-hidden />
                <span>Admin</span>
              </span>
            </NavLink>
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

      <main className="main-content">
        <div className="header">
          <div>
            <h1 className="page-title">Lightship Fund Analysis</h1>
            <p className="page-subtitle">Monthly fund performance analysis with Z-score ranking system</p>
          </div>
          <div className="header-actions">
            <div className="asof-control">
              <label className="label-muted">As of</label>
              <select
                value={asOfMonth || ''}
                onChange={(e) => setAsOfMonth(e.target.value || null)}
                className="select-control"
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
              <RefreshCw size={16} aria-hidden />
              <span>Refresh</span>
            </button>
            <button 
              onClick={handleExport}
              className="btn"
              title="Export (Ctrl+E)"
            >
              <Download size={16} aria-hidden />
              <span>Export</span>
            </button>
            <button 
              onClick={() => setShowHelp(true)}
              className="btn"
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
            >
              <Info size={16} aria-hidden />
              <span>Methodology</span>
            </button>
          </div>
        </div>

        {children}
      </main>

      {/* Help Modal */}
      {showHelp && (
        <div className="help-modal-overlay" onClick={() => setShowHelp(false)}>
          <div className="help-modal-content" role="dialog" aria-modal="true" aria-labelledby="help-modal-title" onClick={(e) => e.stopPropagation()}>
            <h2 id="help-modal-title" className="page-title help-title">
              Lightship Fund Analysis - Help Guide
            </h2>

            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Quick Start</h3>
              <ol style={{ marginLeft: '1.5rem', fontSize: '0.875rem', color: '#374151' }}>
                <li>Go to Admin tab to add funds by entering ticker symbols (e.g., VTSAX, SPY)</li>
                <li>Assign asset classes to each fund (Large Cap Growth, etc.)</li>
                <li>The system automatically fetches performance data from Ycharts API</li>
                <li>View real-time performance data in the Dashboard and Reports tabs</li>
              </ol>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Scoring Methodology</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem', backgroundColor: '#f9fafb', padding: '1rem', borderRadius: '0.375rem' }}>
                <div>- YTD Return (2.5%)</div>
                <div>- 1-Year Return (5%)</div>
                <div>- 3-Year Return (10%)</div>
                <div>- 5-Year Return (20%)</div>
                <div>- 10-Year Return (10%)</div>
                <div>- 3Y Sharpe Ratio (15%)</div>
                <div>- 3Y Std Deviation (-10%)</div>
                <div>- 5Y Std Deviation (-15%)</div>
                <div>- Up Capture Ratio (7.5%)</div>
                <div>- Down Capture Ratio (-10%)</div>
                <div>- 5Y Alpha (5%)</div>
                <div>- Expense Ratio (-2.5%)</div>
                <div>- Manager Tenure (2.5%)</div>
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Keyboard Shortcuts</h3>
              <div style={{ fontSize: '0.875rem', color: '#374151' }}>
                <div style={{ marginBottom: '0.25rem' }}><kbd>Ctrl+H</kbd> - Open this help dialog</div>
                <div style={{ marginBottom: '0.25rem' }}><kbd>Ctrl+E</kbd> - Export to Excel</div>
                <div style={{ marginBottom: '0.25rem' }}><kbd>1-5</kbd> - Quick navigation between tabs</div>
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Tab Overview</h3>
              <div style={{ fontSize: '0.875rem', color: '#374151' }}>
                <div style={{ marginBottom: '0.5rem' }}>
                  <strong>Dashboard:</strong> Visual overview with fund performance analysis and key metrics
                </div>
                <div style={{ marginBottom: '0.5rem' }}>
                  <strong>Scoring:</strong> Configure metric weights and see real-time scoring impact
                </div>
                <div style={{ marginBottom: '0.5rem' }}>
                  <strong>Reports:</strong> Professional export options for presentations and analysis
                </div>
                <div style={{ marginBottom: '0.5rem' }}>
                  <strong>Admin:</strong> Fund management and data import (admin access required)
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'right', marginTop: '2rem' }}>
              <button onClick={() => setShowHelp(false)} className="btn">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <MethodologyDrawer />
      <footer className="footer">
        &copy; {new Date().getFullYear()} Raymond James (Demo) | Lightship Fund Analysis
      </footer>
    </div>
  );
}
