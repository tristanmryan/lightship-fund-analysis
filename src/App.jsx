// App.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, Settings, Trash2, LayoutGrid, AlertCircle, TrendingUp, Award, Clock, Database, Calendar, Download, BarChart3, Activity, Info } from 'lucide-react';
import * as XLSX from 'xlsx';
import FundAdmin from './components/Admin/FundAdmin';
import {
  recommendedFunds as defaultRecommendedFunds,
  assetClassBenchmarks as defaultBenchmarks
} from './data/config';
import { 
  calculateScores, 
  generateClassSummary, 
  identifyReviewCandidates,
  getScoreColor,
  getScoreLabel,
  METRICS_CONFIG,
  METRIC_ORDER,
  loadMetricWeights
} from './services/scoring';
import {
  saveSnapshot,
  deleteSnapshot
} from './services/dataStore';
import {
  getAllCombinedSnapshots,
  getDataSummary,
  compareCombinedSnapshots as compareSnapshotsAPI
} from './services/enhancedDataStore';
import fundRegistry from './services/fundRegistry';
import PerformanceHeatmap from './components/Dashboard/PerformanceHeatmap';
import TopBottomPerformers from './components/Dashboard/TopBottomPerformers';
import AssetClassOverview from './components/Dashboard/AssetClassOverview';
import FundTimeline from './components/Trends/FundTimeline';
import TagManager from './components/Tags/TagManager';
import CorrelationMatrix from './components/Analytics/CorrelationMatrix';
import RiskReturnScatter from './components/Analytics/RiskReturnScatter';
import FundDetailsModal from './components/FundDetailsModal';
import MonthlyReportButton from './components/Reports/MonthlyReportButton';
import { 
  exportToExcel, 
  generateHTMLReport, 
  exportToCSV, 
  generateExecutiveSummary,
  downloadFile 
} from './services/exportService';
import {
  calculateDiversification,
  identifyOutliers,
  performAttribution
} from './services/analytics';
import { processRawFunds } from './services/fundProcessor';
import assetClassGroups from './data/assetClassGroups';

// Score badge component for visual display
export const ScoreBadge = ({ score, size = 'normal' }) => {
  const color = getScoreColor(score);
  const label = getScoreLabel(score);

  const sizeStyles = {
    small: { fontSize: '0.75rem', padding: '0.125rem 0.375rem' },
    normal: { fontSize: '0.875rem', padding: '0.25rem 0.5rem' },
    large: { fontSize: '1rem', padding: '0.375rem 0.75rem' }
  };

  return (
    <span
      title={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '9999px',
        fontWeight: '600',
        color: '#fff',
        backgroundColor: color,
        ...sizeStyles[size]
      }}
    >
      {score}
    </span>
  );
};

// Metric breakdown tooltip component
export const MetricBreakdown = ({ breakdown }) => {
  if (!breakdown || Object.keys(breakdown).length === 0) return null;

  return (
    <div className="metric-breakdown" style={{
      fontSize: '0.75rem',
      marginTop: '0.5rem',
      padding: '0.5rem',
      backgroundColor: '#f3f4f6',
      borderRadius: '0.25rem'
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>Score Breakdown:</div>
      {METRIC_ORDER.filter(m => breakdown[m]).map(metric => {
        const data = breakdown[metric];
        return (
          <div key={metric} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.125rem' }}>
            <span>{METRICS_CONFIG.labels[metric]}:</span>
            <span style={{ color: data.weightedZScore >= 0 ? '#16a34a' : '#dc2626' }}>
              {data.weightedZScore >= 0 ? '+' : ''}{data.weightedZScore.toFixed(3)}
            </span>
          </div>
        );
      })}
    </div>
  );
};

const App = () => {
  const [scoredFundData, setScoredFundData] = useState([]);
  const [benchmarkData, setBenchmarkData] = useState({});
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedFundForDetails, setSelectedFundForDetails] = useState(null);
  const [classSummaries, setClassSummaries] = useState({});
  const [currentSnapshotDate, setCurrentSnapshotDate] = useState(null);
  const [uploadedFileName, setUploadedFileName] = useState('');

  // Historical data states
  const [snapshots, setSnapshots] = useState([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState(null);
  const [compareSnapshot, setCompareSnapshot] = useState(null);
  const [snapshotComparison, setSnapshotComparison] = useState(null);

  const [recommendedFunds, setRecommendedFunds] = useState([]);
  const [assetClassBenchmarks, setAssetClassBenchmarks] = useState({});

  // Map of symbol -> cleaned fund name from registry
  const registryNameMap = useMemo(() => {
    const clean = (s) => s?.toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
    const map = {};
    recommendedFunds.forEach(f => {
      map[clean(f.symbol)] = f.name;
    });
    return map;
  }, [recommendedFunds]);

  // List of available asset classes from benchmarks and loaded funds
  const assetClasses = useMemo(() => {
    const classes = new Set(Object.keys(assetClassBenchmarks));
    scoredFundData.forEach(f => {
      if (f['Asset Class']) classes.add(f['Asset Class']);
    });
    return Array.from(classes).sort();
  }, [assetClassBenchmarks, scoredFundData]);

  // Help modal state
  const [showHelp, setShowHelp] = useState(false);

  // Initialize fund registry and load data
  useEffect(() => {
    const initializeRegistry = async () => {
      await loadMetricWeights();
      await fundRegistry.initialize(defaultRecommendedFunds, defaultBenchmarks);
      const [funds, benchmarkMap] = await Promise.all([
        fundRegistry.getActiveFunds(),
        fundRegistry.getBenchmarksByAssetClass()
      ]);

      setRecommendedFunds(funds);
      setAssetClassBenchmarks(benchmarkMap);
    };

    initializeRegistry();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Ctrl/Cmd + H for help
      if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
        e.preventDefault();
        setShowHelp(true);
      }
      // Ctrl/Cmd + E for export
      if ((e.ctrlKey || e.metaKey) && e.key === 'e' && scoredFundData.length > 0) {
        e.preventDefault();
        const data = {
          funds: scoredFundData,
          classSummaries,
          reviewCandidates: identifyReviewCandidates(scoredFundData),
          metadata: { date: currentSnapshotDate, fileName: uploadedFileName }
        };
        const blob = exportToExcel(data);
        downloadFile(blob, `fund_analysis_${new Date().toISOString().split('T')[0]}.xlsx`);
      }
      // Number keys for tab navigation
      if (e.key >= '1' && e.key <= '6' && !e.ctrlKey && !e.metaKey) {
        const tabs = ['dashboard', 'funds', 'class', 'analysis', 'analytics', 'history'];
        const tabIndex = parseInt(e.key) - 1;
        if (tabIndex < tabs.length) {
          setActiveTab(tabs[tabIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [scoredFundData, classSummaries, currentSnapshotDate, uploadedFileName]);



  // Load snapshots when history tab is selected
  useEffect(() => {
    if (activeTab === 'history') {
      loadSnapshots();
    }
  }, [activeTab]);

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

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setLoading(true);
    setUploadedFileName(file.name);
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        // Find header row (looking for Symbol/CUSIP)
        let headerRowIndex = jsonData.findIndex(row => 
          row.some(cell => typeof cell === 'string' && cell.includes('Symbol'))
        );
        
        if (headerRowIndex === -1) {
          throw new Error('Could not find header row with Symbol column');
        }

        const headers = jsonData[headerRowIndex];
        const dataRows = jsonData.slice(headerRowIndex + 1);

                // Enhanced column mapping to handle your specific CSV format
                const columnMap = {};
                headers.forEach((header, index) => {
                  if (typeof header === 'string') {
                    const headerLower = header.toLowerCase().trim();
                    const headerClean = header.trim();
                    
                    // Basic fields - use exact matching where possible
                    if (headerLower.includes('symbol') || headerLower.includes('cusip')) {
                      columnMap['Symbol'] = index;
                    }
                    if (headerLower.includes('product name') || headerLower === 'name') {
                      columnMap['Fund Name'] = index;
                    }
                    
                    // Morningstar Star Rating
                    if (headerLower.includes('morningstar star rating')) {
                      columnMap['Morningstar Star Rating'] = index;
                    }
                    
                    // YTD fields
                    if (headerClean === 'Total Return - YTD (%)') {
                      columnMap['YTD'] = index;
                    }
                    if (
                      headerClean === 'Category Rank (%) Total Return – YTD' ||
                      headerClean === 'Category Rank (%) Total Return - YTD' ||
                      (headerLower.includes('category rank') &&
                        headerLower.includes('total return') &&
                        headerLower.includes('ytd'))
                    ) {
                      columnMap['YTD Rank'] = index;
                    }
                    
                    // 1 Year fields
                    if (headerClean === 'Total Return - 1 Year (%)') {
                      columnMap['1 Year'] = index;
                    }
                    if (
                      headerClean === 'Category Rank (%) Total Return – 1Y' ||
                      headerClean === 'Category Rank (%) Total Return - 1Y' ||
                      (headerLower.includes('category rank') &&
                        headerLower.includes('total return') &&
                        (headerLower.includes('1y') || headerLower.includes('1 year')) &&
                        !headerLower.includes('10y') &&
                        !headerLower.includes('10 year'))
                    ) {
                      columnMap['1Y Rank'] = index;
                    }
                    
                    // 3 Year fields
                    if (headerClean === 'Annualized Total Return - 3 Year (%)') {
                      columnMap['3 Year'] = index;
                    }
                    if (
                      headerClean === 'Category Rank (%) Ann. Total Return – 3Y' ||
                      headerClean === 'Category Rank (%) Ann. Total Return - 3Y' ||
                      (headerLower.includes('category rank') &&
                        headerLower.includes('total return') &&
                        (headerLower.includes('3y') || headerLower.includes('3 year')))
                    ) {
                      columnMap['3Y Rank'] = index;
                    }
                    
                    // 5 Year fields
                    if (headerClean === 'Annualized Total Return - 5 Year (%)') {
                      columnMap['5 Year'] = index;
                    }
                    if (
                      headerClean === 'Category Rank (%) Ann. Total Return – 5Y' ||
                      headerClean === 'Category Rank (%) Ann. Total Return - 5Y' ||
                      (headerLower.includes('category rank') &&
                        headerLower.includes('total return') &&
                        (headerLower.includes('5y') || headerLower.includes('5 year')))
                    ) {
                      columnMap['5Y Rank'] = index;
                    }
                    
                    // 10 Year fields
                    if (headerClean === 'Annualized Total Return - 10 Year (%)') {
                      columnMap['10 Year'] = index;
                    }
                    if (
                      headerClean === 'Category Rank (%) Ann. Total Return – 10Y' ||
                      headerClean === 'Category Rank (%) Ann. Total Return - 10Y' ||
                      (headerLower.includes('category rank') &&
                        headerLower.includes('total return') &&
                        (headerLower.includes('10y') || headerLower.includes('10 year')))
                    ) {
                      columnMap['10Y Rank'] = index;
                    }
                    
                    // Risk and performance metrics
                    if (headerClean === 'Alpha (Asset Class) - 5 Year') {
                      columnMap['Alpha'] = index;
                    }
                    if (headerClean === 'Sharpe Ratio - 3 Year') {
                      columnMap['Sharpe Ratio'] = index;
                    }
                    if (headerClean === 'Standard Deviation - 3 Year') {
                      columnMap['StdDev3Y'] = index;
                    }
                    if (headerClean === 'Standard Deviation - 5 Year') {
                      columnMap['StdDev5Y'] = index;
                    }
                    
                    // Capture ratios
                    if (headerClean === 'Up Capture Ratio (Morningstar Standard) - 3 Year') {
                      columnMap['Up Capture Ratio'] = index;
                    }
                    if (headerClean === 'Down Capture Ratio (Morningstar Standard) - 3 Year') {
                      columnMap['Down Capture Ratio'] = index;
                    }
                    
                    // Other fields
                    if (headerClean === 'SEC Yield (%)') {
                      columnMap['Yield'] = index;
                    }
                    if (headerClean === 'Net Exp Ratio (%)') {
                      columnMap['Net Expense Ratio'] = index;
                    }
                    if (headerClean === 'Longest Manager Tenure (Years)') {
                      columnMap['Manager Tenure'] = index;
                    }
                    
                    // Fallback mappings for alternative formats
                    if (!columnMap['YTD'] && headerLower.includes('ytd') && headerLower.includes('return') && !headerLower.includes('rank')) {
                      columnMap['YTD'] = index;
                    }
                    if (!columnMap['1 Year'] && headerLower.includes('1 year') && headerLower.includes('return') && !headerLower.includes('rank')) {
                      columnMap['1 Year'] = index;
                    }
                    if (!columnMap['3 Year'] && headerLower.includes('3 year') && headerLower.includes('return') && !headerLower.includes('rank')) {
                      columnMap['3 Year'] = index;
                    }
                    if (!columnMap['5 Year'] && headerLower.includes('5 year') && headerLower.includes('return') && !headerLower.includes('rank')) {
                      columnMap['5 Year'] = index;
                    }
                    if (!columnMap['10 Year'] && headerLower.includes('10 year') && headerLower.includes('return') && !headerLower.includes('rank')) {
                      columnMap['10 Year'] = index;
                    }
                  }
                });
        
                // Log column mappings for debugging
                console.log('Column mappings:', columnMap);
                console.log('Headers found:', headers);

        // Parse the data rows
        const parsed = dataRows.map(row => {
          const fund = {};
          Object.entries(columnMap).forEach(([key, idx]) => {
            let val = row[idx];
            
            // Handle various data formats
            if (val === undefined || val === null || val === '') {
              fund[key] = null;
            } else if (typeof val === 'string') {
              // Remove % signs, commas, and extra spaces
              val = val.replace(/[%,]/g, '').trim();
              
              // Check for special values
              if (val === 'N/A' || val === 'NA' || val === '-' || val === '--') {
                fund[key] = null;
              } else {
                // Try to parse as number
                const parsed = parseFloat(val);
                fund[key] = isNaN(parsed) ? val : parsed;
              }
            } else if (typeof val === 'number') {
              fund[key] = val;
            } else {
              fund[key] = val;
            }
          });
          
          // FIXED: Ensure we have StdDev3Y and StdDev5Y if only general Standard Deviation exists
          if (fund['Standard Deviation'] != null) {
            if (fund['StdDev3Y'] == null) fund['StdDev3Y'] = fund['Standard Deviation'];
            if (fund['StdDev5Y'] == null) fund['StdDev5Y'] = fund['Standard Deviation'];
          }
          
          return fund;
        }).filter(f => f.Symbol && f.Symbol !== ''); // Filter out empty rows

        console.log('Sample parsed fund:', parsed[0]); // Debug first fund

        const { scoredFunds, classSummaries, benchmarks } = processRawFunds(parsed, {
          recommendedFunds,
          benchmarks: assetClassBenchmarks
        });

        const reviewCandidates = identifyReviewCandidates(scoredFunds);

        // Ask user for snapshot date
        const dateStr = prompt('Enter the date for this snapshot (YYYY-MM-DD):', 
          new Date().toISOString().split('T')[0]);
        
        if (dateStr) {
          // Save snapshot to IndexedDB
          await saveSnapshot({
            date: new Date(dateStr).toISOString(),
            funds: scoredFunds,
            classSummaries,
            reviewCandidates: reviewCandidates,
            fileName: file.name,
            uploadedBy: 'user'
          });
          
          setCurrentSnapshotDate(dateStr);
        }

        setScoredFundData(scoredFunds);
        setBenchmarkData(benchmarks);
        setClassSummaries(classSummaries);
        
        console.log('Successfully loaded and scored', scoredFunds.length, 'funds');
      } catch (err) {
        console.error('Error parsing performance file:', err);
        alert('Error parsing file: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const loadSnapshot = async (snapshot) => {
    setSelectedSnapshot(snapshot);
    const fundsWithGroup = snapshot.funds.map(f => ({
      ...f,
      assetGroup: f.assetGroup || assetClassGroups[f['Asset Class']] || 'Other',
      displayName: registryNameMap[f.cleanSymbol] || f.displayName || f['Fund Name']
    }));
    setScoredFundData(fundsWithGroup);
    setClassSummaries(snapshot.classSummaries || {});
    setCurrentSnapshotDate(new Date(snapshot.date).toLocaleDateString());
    setUploadedFileName(snapshot.metadata?.fileName || 'Historical snapshot');
    
    // Extract benchmark data
    const benchmarks = {};
    Object.entries(assetClassBenchmarks).forEach(([assetClass, { ticker, name }]) => {
      const clean = (s) => s?.toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
      const match = snapshot.funds.find(f => f.cleanSymbol === clean(ticker));
      if (match) {
        benchmarks[assetClass] = { ...match, name };
      }
    });
    setBenchmarkData(benchmarks);
  };

  const handleCompareSnapshots = async () => {
    if (!selectedSnapshot || !compareSnapshot) return;

    try {
      const comparison = await compareSnapshotsAPI(selectedSnapshot.id, compareSnapshot.id);
      setSnapshotComparison(comparison);
    } catch (error) {
      console.error('Error comparing snapshots:', error);
      alert('Error comparing snapshots');
    }
  };


  // Get review candidates
  const reviewCandidates = identifyReviewCandidates(scoredFundData);

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              Lightship Fund Analysis
            </h1>
            <p style={{ color: '#6b7280' }}>
              Monthly fund performance analysis with Z-score ranking system
            </p>
          </div>
          <button
            onClick={() => setShowHelp(true)}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#e5e7eb',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.875rem'
            }}
            title="Help (Ctrl+H)"
          >
            <Info size={16} />
            Help
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button 
          onClick={() => setActiveTab('dashboard')} 
          style={{ 
            padding: '0.5rem 1rem',
            backgroundColor: activeTab === 'dashboard' ? '#3b82f6' : '#e5e7eb',
            color: activeTab === 'dashboard' ? 'white' : '#374151',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <BarChart3 size={16} />
          Dashboard
        </button>
        
        <button 
          onClick={() => setActiveTab('funds')} 
          style={{ 
            padding: '0.5rem 1rem',
            backgroundColor: activeTab === 'funds' ? '#3b82f6' : '#e5e7eb',
            color: activeTab === 'funds' ? 'white' : '#374151',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <Award size={16} />
          Fund Scores
        </button>
        
        <button 
          onClick={() => setActiveTab('class')} 
          style={{ 
            padding: '0.5rem 1rem',
            backgroundColor: activeTab === 'class' ? '#3b82f6' : '#e5e7eb',
            color: activeTab === 'class' ? 'white' : '#374151',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <LayoutGrid size={16} />
          Class View
        </button>
        
        <button 
          onClick={() => setActiveTab('analysis')} 
          style={{ 
            padding: '0.5rem 1rem',
            backgroundColor: activeTab === 'analysis' ? '#3b82f6' : '#e5e7eb',
            color: activeTab === 'analysis' ? 'white' : '#374151',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            position: 'relative'
          }}
        >
          <AlertCircle size={16} />
          Analysis
          {reviewCandidates.length > 0 && (
            <span style={{
              position: 'absolute',
              top: '-0.5rem',
              right: '-0.5rem',
              backgroundColor: '#dc2626',
              color: 'white',
              borderRadius: '9999px',
              width: '1.25rem',
              height: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: 'bold'
            }}>
              {reviewCandidates.length}
            </span>
          )}
        </button>
        
        <button 
          onClick={() => setActiveTab('analytics')} 
          style={{ 
            padding: '0.5rem 1rem',
            backgroundColor: activeTab === 'analytics' ? '#3b82f6' : '#e5e7eb',
            color: activeTab === 'analytics' ? 'white' : '#374151',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <Activity size={16} />
          Analytics
        </button>
        
        <button 
          onClick={() => setActiveTab('history')} 
          style={{ 
            padding: '0.5rem 1rem',
            backgroundColor: activeTab === 'history' ? '#3b82f6' : '#e5e7eb',
            color: activeTab === 'history' ? 'white' : '#374151',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <Clock size={16} />
          History
        </button>
        
        <button 
          onClick={() => setActiveTab('admin')}
          style={{ 
            padding: '0.5rem 1rem',
            backgroundColor: activeTab === 'admin' ? '#3b82f6' : '#e5e7eb',
            color: activeTab === 'admin' ? 'white' : '#374151',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <Settings size={16} />
          Admin
        </button>
      </div>

      {/* File Upload Section - Show on all tabs except admin and history */}
      {activeTab !== 'admin' && activeTab !== 'history' && (
        <div style={{ 
          marginBottom: '1.5rem', 
          padding: '1rem', 
          backgroundColor: '#f3f4f6', 
          borderRadius: '0.5rem' 
        }}>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            style={{ marginRight: '1rem' }}
          />
          {loading && (
            <span style={{ display: 'inline-flex', alignItems: 'center', color: '#3b82f6' }}>
              <RefreshCw size={16} style={{ marginRight: '0.25rem', animation: 'spin 1s linear infinite' }} />
              Processing and calculating scores...
            </span>
          )}
          {scoredFundData.length > 0 && !loading && (
            <div style={{ marginTop: '0.5rem' }}>
              <span style={{ color: '#059669' }}>
                ✓ {scoredFundData.length} funds loaded and scored
              </span>
              {currentSnapshotDate && (
                <span style={{ marginLeft: '1rem', color: '#6b7280' }}>
                  | Date: {currentSnapshotDate} | File: {uploadedFileName}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div>
          {scoredFundData.length > 0 ? (
            <>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '2rem' 
              }}>
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                    Fund Performance Dashboard
                  </h2>
                  <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                    Visual overview of fund performance across all asset classes
                  </p>
                </div>
                
                {/* Export Menu */}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => {
                      const data = {
                        funds: scoredFundData,
                        classSummaries,
                        reviewCandidates: identifyReviewCandidates(scoredFundData),
                        metadata: {
                          date: currentSnapshotDate,
                          fileName: uploadedFileName
                        }
                      };
                      const blob = exportToExcel(data);
                      downloadFile(blob, `fund_analysis_${new Date().toISOString().split('T')[0]}.xlsx`);
                    }}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#16a34a',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '0.875rem'
                    }}
                  >
                    <Download size={16} />
                    Export Excel
                  </button>
                  
                  <button
                    onClick={() => {
                      const csv = exportToCSV(scoredFundData);
                      downloadFile(csv, `fund_scores_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
                    }}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '0.875rem'
                    }}
                  >
                    <Download size={16} />
                    Export CSV
                  </button>
                  
                  <button
                    onClick={() => {
                      const data = {
                        funds: scoredFundData,
                        classSummaries,
                        reviewCandidates: identifyReviewCandidates(scoredFundData)
                      };
                      const html = generateHTMLReport(data);
                      const newWindow = window.open('', '_blank');
                      newWindow.document.write(html);
                      newWindow.document.close();
                    }}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#8b5cf6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '0.875rem'
                    }}
                  >
                    <TrendingUp size={16} />
                    View Report
                  </button>

                  <MonthlyReportButton 
                    fundData={scoredFundData}
                    benchmarkData={benchmarkData}
                    metadata={{
                      date: currentSnapshotDate || new Date().toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric'
                      }),
                      fileName: uploadedFileName
                    }}
                    assetClassBenchmarks={assetClassBenchmarks}
                  />
                  
                  <button
                    onClick={() => {
                      const data = {
                        funds: scoredFundData,
                        classSummaries,
                        reviewCandidates: identifyReviewCandidates(scoredFundData)
                      };
                      const summary = generateExecutiveSummary(data);
                      downloadFile(summary, `executive_summary_${new Date().toISOString().split('T')[0]}.txt`, 'text/plain');
                    }}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#f59e0b',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '0.875rem'
                    }}
                  >
                    <AlertCircle size={16} />
                    Summary
                  </button>
                </div>
              </div>
              
              <TopBottomPerformers
                funds={scoredFundData}
              />

              <AssetClassOverview
                funds={scoredFundData}
                classSummaries={classSummaries}
                benchmarkData={benchmarkData}
              />

              <PerformanceHeatmap
                funds={scoredFundData}
                assetClassBenchmarks={assetClassBenchmarks}
              />
            </>
          ) : (
            <div style={{ 
              textAlign: 'center', 
              padding: '3rem', 
              backgroundColor: '#f9fafb', 
              borderRadius: '0.5rem',
              color: '#6b7280' 
            }}>
              <BarChart3 size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
              <p>Upload fund performance data to see the dashboard</p>
            </div>
          )}
        </div>
      )}

      {/* Fund Scores Tab */}
{activeTab === 'funds' && (
  <div>
    {scoredFundData.length > 0 ? (
      <div>
        <div style={{ marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>All Funds with Scores</h2>
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
            Scores calculated using weighted Z-score methodology within each asset class
          </p>
        </div>
        
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ textAlign: 'left', padding: '0.75rem', fontWeight: '600' }}>Symbol</th>
                <th style={{ textAlign: 'left', padding: '0.75rem', fontWeight: '600' }}>Fund Name</th>
                <th style={{ textAlign: 'left', padding: '0.75rem', fontWeight: '600' }}>Asset Class</th>
                <th style={{ textAlign: 'center', padding: '0.75rem', fontWeight: '600' }}>Score</th>
                <th style={{ textAlign: 'right', padding: '0.75rem', fontWeight: '600' }}>YTD</th>
                <th style={{ textAlign: 'right', padding: '0.75rem', fontWeight: '600' }}>1Y Return</th>
                <th style={{ textAlign: 'right', padding: '0.75rem', fontWeight: '600' }}>3Y Return</th>
                <th style={{ textAlign: 'right', padding: '0.75rem', fontWeight: '600' }}>5Y Return</th>
                <th style={{ textAlign: 'right', padding: '0.75rem', fontWeight: '600' }}>Sharpe</th>
                <th style={{ textAlign: 'right', padding: '0.75rem', fontWeight: '600' }}>Std Dev (3Y)</th>
                <th style={{ textAlign: 'right', padding: '0.75rem', fontWeight: '600' }}>Expense</th>
                <th style={{ textAlign: 'center', padding: '0.75rem', fontWeight: '600' }}>Type</th>
              </tr>
            </thead>
            <tbody>
              {scoredFundData
                .sort((a, b) => (b.scores?.final || 0) - (a.scores?.final || 0))
                .map((fund, i) => (
                  <tr 
                    key={i} 
                    style={{ 
                      borderBottom: '1px solid #f3f4f6',
                      backgroundColor: fund.isRecommended ? '#eff6ff' : 'white',
                      cursor: 'pointer'
                    }}
                    onClick={() => setSelectedFundForDetails(fund)}
                  >
                    <td style={{ padding: '0.75rem', fontWeight: fund.isBenchmark ? 'bold' : 'normal' }}>
                      {fund.Symbol}
                    </td>
                    <td style={{ padding: '0.75rem' }}>{fund.displayName}</td>
                    <td style={{ padding: '0.75rem' }}>{fund['Asset Class']}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      {fund.scores ? (
                        <ScoreBadge score={fund.scores.final} />
                      ) : (
                        <span style={{ color: '#9ca3af' }}>-</span>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                      {fund['YTD'] != null ? `${fund['YTD'].toFixed(2)}%` : '-'}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                      {fund['1 Year'] != null ? `${fund['1 Year'].toFixed(2)}%` : '-'}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                      {fund['3 Year'] != null ? `${fund['3 Year'].toFixed(2)}%` : '-'}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                      {fund['5 Year'] != null ? `${fund['5 Year'].toFixed(2)}%` : '-'}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                      {fund['Sharpe Ratio'] != null ? fund['Sharpe Ratio'].toFixed(2) : '-'}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                      {fund['StdDev3Y'] != null ? `${fund['StdDev3Y'].toFixed(2)}%` : '-'}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                      {fund['Net Expense Ratio'] != null ? `${fund['Net Expense Ratio'].toFixed(2)}%` : '-'}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      {fund.isBenchmark && (
                        <span style={{ 
                          backgroundColor: '#fbbf24', 
                          color: '#78350f',
                          padding: '0.125rem 0.5rem',
                          borderRadius: '0.25rem',
                          fontSize: '0.75rem',
                          fontWeight: '500'
                        }}>
                          Benchmark
                        </span>
                      )}
                      {fund.isRecommended && !fund.isBenchmark && (
                        <span style={{ 
                          backgroundColor: '#34d399', 
                          color: '#064e3b',
                          padding: '0.125rem 0.5rem',
                          borderRadius: '0.25rem',
                          fontSize: '0.75rem',
                          fontWeight: '500'
                        }}>
                          Recommended
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

              {/* Fund Details Modal */}
              {selectedFundForDetails && (
                <FundDetailsModal
                  fund={selectedFundForDetails}
                  onClose={() => setSelectedFundForDetails(null)}
                />
              )}
            </div>
          ) : (
            <div style={{ 
              textAlign: 'center', 
              padding: '3rem', 
              backgroundColor: '#f9fafb', 
              borderRadius: '0.5rem',
              color: '#6b7280' 
            }}>
              <TrendingUp size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
              <p>Upload a fund performance file to see scores</p>
            </div>
          )}
        </div>
      )}

      {/* Asset Class View Tab */}
      {activeTab === 'class' && (
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
            Asset Class Comparison
          </h2>
          
          <select
            value={selectedClass}
            onChange={e => setSelectedClass(e.target.value)}
            style={{ 
              padding: '0.5rem', 
              marginBottom: '1rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.375rem',
              fontSize: '1rem'
            }}
          >
            <option value="">-- Choose an asset class --</option>
            {assetClasses.map(ac => (
              <option key={ac} value={ac}>{ac}</option>
            ))}
          </select>
          
          {selectedClass && (
            <>
              {classSummaries[selectedClass] && (
                <div style={{ 
                  marginBottom: '1.5rem', 
                  padding: '1rem', 
                  backgroundColor: '#f3f4f6', 
                  borderRadius: '0.5rem' 
                }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                    {selectedClass} Summary
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                    <div>
                      <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>Fund Count</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                        {classSummaries[selectedClass].fundCount}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>Average Score</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                        {classSummaries[selectedClass].averageScore}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>Benchmark Score</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                        {classSummaries[selectedClass].benchmarkScore || '-'}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>Distribution</div>
                      <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.875rem' }}>
                        <span style={{ color: '#16a34a' }}>
                          {classSummaries[selectedClass].distribution.excellent} excellent
                        </span>
                        <span style={{ color: '#eab308' }}>
                          {classSummaries[selectedClass].distribution.good} good
                        </span>
                        <span style={{ color: '#dc2626' }}>
                          {classSummaries[selectedClass].distribution.poor} poor
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Symbol</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Name</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Score</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>YTD</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>1Y</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>3Y</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>5Y</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Sharpe</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Std Dev (3Y)</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Std Dev (5Y)</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Expense</th>
                  </tr>
                </thead>
                <tbody>
                  {benchmarkData[selectedClass] && (
                    <tr style={{ backgroundColor: '#fef3c7', fontWeight: '600' }}>
                      <td style={{ padding: '0.75rem' }}>
                        {benchmarkData[selectedClass].Symbol}
                        <span style={{ 
                          marginLeft: '0.5rem',
                          backgroundColor: '#fbbf24', 
                          color: '#78350f',
                          padding: '0.125rem 0.5rem',
                          borderRadius: '0.25rem',
                          fontSize: '0.75rem',
                          fontWeight: '500'
                        }}>
                          Benchmark
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        {benchmarkData[selectedClass].displayName || benchmarkData[selectedClass]['Fund Name'] || benchmarkData[selectedClass].name}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                        {benchmarkData[selectedClass].scores ? (
                          <ScoreBadge score={benchmarkData[selectedClass].scores.final} />
                        ) : '-'}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        {benchmarkData[selectedClass]['YTD']?.toFixed(2) ?? '-'}%
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        {benchmarkData[selectedClass]['1 Year']?.toFixed(2) ?? '-'}%
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        {benchmarkData[selectedClass]['3 Year']?.toFixed(2) ?? '-'}%
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        {benchmarkData[selectedClass]['5 Year']?.toFixed(2) ?? '-'}%
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        {benchmarkData[selectedClass]['Sharpe Ratio']?.toFixed(2) ?? '-'}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        {benchmarkData[selectedClass]['StdDev3Y']?.toFixed(2) ?? '-'}%
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        {benchmarkData[selectedClass]['StdDev5Y']?.toFixed(2) ?? '-'}%
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        {benchmarkData[selectedClass]['Net Expense Ratio']?.toFixed(2) ?? '-'}%
                      </td>
                    </tr>
                  )}
                  {scoredFundData
                    .filter(f => f['Asset Class'] === selectedClass && !f.isBenchmark)
                    .sort((a, b) => (b.scores?.final || 0) - (a.scores?.final || 0))
                    .map((fund, idx) => (
                      <tr 
                        key={idx} 
                        style={{ 
                          borderBottom: '1px solid #f3f4f6',
                          backgroundColor: fund.isRecommended ? '#eff6ff' : 'white'
                        }}
                      >
                        <td style={{ padding: '0.75rem' }}>
                          {fund.Symbol}
                          {fund.isRecommended && (
                            <span style={{ 
                              marginLeft: '0.5rem',
                              backgroundColor: '#34d399', 
                              color: '#064e3b',
                              padding: '0.125rem 0.5rem',
                              borderRadius: '0.25rem',
                              fontSize: '0.75rem',
                              fontWeight: '500'
                            }}>
                              Rec
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem' }}>{fund.displayName}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                          {fund.scores ? (
                            <ScoreBadge score={fund.scores.final} />
                          ) : '-'}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                          {fund['YTD']?.toFixed(2) ?? '-'}%
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                          {fund['1 Year']?.toFixed(2) ?? '-'}%
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                          {fund['3 Year']?.toFixed(2) ?? '-'}%
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                          {fund['5 Year']?.toFixed(2) ?? '-'}%
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                          {fund['Sharpe Ratio']?.toFixed(2) ?? '-'}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                          {fund['StdDev3Y']?.toFixed(2) ?? '-'}%
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                          {fund['StdDev5Y']?.toFixed(2) ?? '-'}%
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                          {fund['Net Expense Ratio']?.toFixed(2) ?? '-'}%
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {/* Analysis Tab */}
      {activeTab === 'analysis' && (
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
            Fund Analysis & Insights
          </h2>
          
          {scoredFundData.length > 0 ? (
            <>
              {/* Tag Manager Section */}
              <TagManager 
                funds={scoredFundData}
                benchmarkData={benchmarkData}
              />
              
              {/* Review Candidates Section */}
              <div style={{ marginTop: '3rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
                  Review Candidates
                </h3>
                
                {reviewCandidates.length > 0 ? (
                  <>
                    <div style={{ 
                      marginBottom: '1rem', 
                      padding: '1rem', 
                      backgroundColor: '#fef3c7', 
                      borderRadius: '0.5rem',
                      border: '1px solid #fbbf24'
                    }}>
                      <p style={{ fontWeight: '500' }}>
                        <AlertCircle size={20} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '0.5rem' }} />
                        {reviewCandidates.length} funds flagged for review based on scoring criteria
                      </p>
                    </div>
                    
                    <div style={{ display: 'grid', gap: '1rem' }}>
                      {reviewCandidates.map((fund, i) => (
                        <div 
                          key={i} 
                          style={{ 
                            padding: '1rem', 
                            border: '1px solid #e5e7eb',
                            borderRadius: '0.5rem',
                            backgroundColor: fund.isRecommended ? '#fef2f2' : 'white'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                            <div>
                              <h3 style={{ fontWeight: 'bold', fontSize: '1.125rem' }}>
                                {fund.displayName}
                              </h3>
                              <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                                {fund.Symbol} | {fund['Asset Class']}
                                {fund.isRecommended && (
                                  <span style={{ 
                                    marginLeft: '0.5rem',
                                    color: '#dc2626',
                                    fontWeight: 'bold'
                                  }}>
                                    (Recommended Fund)
                                  </span>
                                )}
                              </p>
                            </div>
                            <ScoreBadge score={fund.scores?.final || 0} size="large" />
                          </div>
                          
                          <div style={{ marginTop: '0.75rem' }}>
                            <strong style={{ fontSize: '0.875rem' }}>Review Reasons:</strong>
                            <ul style={{ marginTop: '0.25rem', marginLeft: '1.5rem', fontSize: '0.875rem', color: '#dc2626' }}>
                              {fund.reviewReasons.map((reason, j) => (
                                <li key={j}>{reason}</li>
                              ))}
                            </ul>
                          </div>
                          
                          <div style={{ 
                            marginTop: '0.75rem', 
                            display: 'grid', 
                            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                            gap: '0.5rem',
                            fontSize: '0.875rem'
                          }}>
                            <div>
                              <span style={{ color: '#6b7280' }}>1Y Return:</span>{' '}
                              <strong>{fund['1 Year']?.toFixed(2) ?? '-'}%</strong>
                            </div>
                            <div>
                              <span style={{ color: '#6b7280' }}>Sharpe:</span>{' '}
                              <strong>{fund['Sharpe Ratio']?.toFixed(2) ?? '-'}</strong>
                            </div>
                            <div>
                              <span style={{ color: '#6b7280' }}>Expense:</span>{' '}
                              <strong>{fund['Net Expense Ratio']?.toFixed(2) ?? '-'}%</strong>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '3rem', 
                    backgroundColor: '#f0fdf4', 
                    borderRadius: '0.5rem',
                    color: '#16a34a' 
                  }}>
                    <Award size={48} style={{ margin: '0 auto 1rem' }} />
                    <p style={{ fontSize: '1.125rem', fontWeight: '500' }}>
                      All funds are performing within acceptable parameters!
                    </p>
                    <p style={{ color: '#6b7280', marginTop: '0.5rem' }}>
                      No funds currently flagged for review based on scoring criteria.
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ 
              textAlign: 'center', 
              padding: '3rem', 
              backgroundColor: '#f9fafb', 
              borderRadius: '0.5rem',
              color: '#6b7280' 
            }}>
              <AlertCircle size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
              <p>Upload fund performance data to see analysis</p>
            </div>
          )}
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
            Advanced Analytics
          </h2>
          
          {scoredFundData.length > 0 ? (
            <>
              {/* Portfolio Analytics Summary */}
              <div style={{
                marginBottom: '2rem',
                padding: '1.5rem',
                backgroundColor: '#f0f9ff',
                border: '1px solid #bfdbfe',
                borderRadius: '0.5rem'
              }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '1rem' }}>
                  Portfolio Analytics Summary
                </h3>
                
                {(() => {
                  const diversification = calculateDiversification(scoredFundData);
                  const outliers = identifyOutliers(scoredFundData);
                  
                  return (
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '1.5rem'
                    }}>
                      <div>
                        <h4 style={{ fontSize: '0.875rem', color: '#1e40af', marginBottom: '0.5rem' }}>
                          Diversification
                        </h4>
                        <div style={{ fontSize: '0.875rem' }}>
                          <div>Asset Classes: <strong>{diversification.assetClassCount}</strong></div>
                          <div>Effective Classes: <strong>{diversification.effectiveAssetClasses}</strong></div>
                          <div>Concentration Risk: <strong style={{
                            color: diversification.concentrationRisk === 'High' ? '#dc2626' :
                                  diversification.concentrationRisk === 'Medium' ? '#f59e0b' : '#16a34a'
                          }}>{diversification.concentrationRisk}</strong></div>
                        </div>
                      </div>
                      
                      <div>
                        <h4 style={{ fontSize: '0.875rem', color: '#1e40af', marginBottom: '0.5rem' }}>
                          Score Distribution
                        </h4>
                        <div style={{ fontSize: '0.875rem' }}>
                          <div>Excellent (70+): <strong style={{ color: '#16a34a' }}>{diversification.scoreDistribution.excellent}</strong></div>
                          <div>Good (50-70): <strong style={{ color: '#eab308' }}>{diversification.scoreDistribution.good}</strong></div>
                          <div>Poor (&lt;50): <strong style={{ color: '#dc2626' }}>{diversification.scoreDistribution.poor}</strong></div>
                        </div>
                      </div>
                      
                      <div>
                        <h4 style={{ fontSize: '0.875rem', color: '#1e40af', marginBottom: '0.5rem' }}>
                          Outliers Detected
                        </h4>
                        <div style={{ fontSize: '0.875rem' }}>
                          <div>Performance: <strong>{outliers.performance.length}</strong></div>
                          <div>Risk: <strong>{outliers.risk.length}</strong></div>
                          <div>Expense: <strong>{outliers.expense.length}</strong></div>
                        </div>
                      </div>
                      
                      <div>
                        <h4 style={{ fontSize: '0.875rem', color: '#1e40af', marginBottom: '0.5rem' }}>
                          Geographic Mix
                        </h4>
                        <div style={{ fontSize: '0.875rem' }}>
                          <div>Domestic: <strong>{diversification.geographicDiversity.domestic}</strong></div>
                          <div>International: <strong>{diversification.geographicDiversity.international}</strong></div>
                          <div>Emerging: <strong>{diversification.geographicDiversity.emerging}</strong></div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
              
              {/* Risk-Return Analysis */}
              <RiskReturnScatter funds={scoredFundData} />
              
              {/* Correlation Matrix */}
              <CorrelationMatrix funds={scoredFundData} />
              
              {/* Attribution Analysis */}
              <div style={{
                marginBottom: '2rem',
                padding: '1.5rem',
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '0.5rem'
              }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
                  Performance Attribution by Asset Class
                </h3>
                
                {(() => {
                  const attribution = performAttribution(scoredFundData);
                  
                  return (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                            <th style={{ padding: '0.75rem', textAlign: 'left' }}>Asset Class</th>
                            <th style={{ padding: '0.75rem', textAlign: 'center' }}>Funds</th>
                            <th style={{ padding: '0.75rem', textAlign: 'right' }}>Weight</th>
                            <th style={{ padding: '0.75rem', textAlign: 'right' }}>Avg Return</th>
                            <th style={{ padding: '0.75rem', textAlign: 'right' }}>Contribution</th>
                            <th style={{ padding: '0.75rem', textAlign: 'right' }}>Avg Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(attribution.groups)
                            .sort((a, b) => b[1].contribution - a[1].contribution)
                            .map(([className, data]) => (
                              <tr key={className} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                <td style={{ padding: '0.75rem', fontWeight: '500' }}>{className}</td>
                                <td style={{ padding: '0.75rem', textAlign: 'center' }}>{data.fundCount}</td>
                                <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                                  {(data.weight * 100).toFixed(1)}%
                                </td>
                                <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                                  {data.avgReturn.toFixed(2)}%
                                </td>
                                <td style={{ 
                                  padding: '0.75rem', 
                                  textAlign: 'right',
                                  color: data.contribution >= 0 ? '#16a34a' : '#dc2626',
                                  fontWeight: '600'
                                }}>
                                  {data.contribution >= 0 ? '+' : ''}{data.contribution.toFixed(2)}%
                                </td>
                                <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                                  <span style={{ 
                                    padding: '0.25rem 0.5rem',
                                    borderRadius: '0.25rem',
                                    backgroundColor: getScoreColor(data.avgScore) + '20',
                                    color: getScoreColor(data.avgScore)
                                  }}>
                                    {data.avgScore.toFixed(0)}
                                  </span>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ borderTop: '2px solid #e5e7eb', fontWeight: '600' }}>
                            <td style={{ padding: '0.75rem' }}>Total Portfolio</td>
                            <td style={{ padding: '0.75rem', textAlign: 'center' }}>{attribution.totalFunds}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'right' }}>100.0%</td>
                            <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                              {attribution.portfolioReturn.toFixed(2)}%
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'right' }}>-</td>
                            <td style={{ padding: '0.75rem', textAlign: 'right' }}>-</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  );
                })()}
              </div>
            </>
          ) : (
            <div style={{ 
              textAlign: 'center', 
              padding: '3rem', 
              backgroundColor: '#f9fafb', 
              borderRadius: '0.5rem',
              color: '#6b7280' 
            }}>
              <TrendingUp size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
              <p>Upload a fund performance file to see scores</p>
            </div>
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
            Historical Analysis
          </h2>
          
          {/* Fund Timeline Component */}
          <FundTimeline 
            snapshots={snapshots}
            currentFunds={scoredFundData}
          />
          
          <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem', marginTop: '2rem' }}>
            Saved Snapshots
          </h3>
          
          {snapshots.length > 0 ? (
            <>
              <div style={{ marginBottom: '1.5rem' }}>
                <button
                  onClick={loadSnapshots}
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
                  Refresh
                </button>
              </div>

              {/* Comparison Section */}
              {selectedSnapshot && (
                <div style={{
                  marginBottom: '1.5rem',
                  padding: '1rem',
                  backgroundColor: '#f3f4f6',
                  borderRadius: '0.5rem'
                }}>
                  <h3 style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Compare Snapshots</h3>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div>
                      <label style={{ fontSize: '0.875rem', color: '#6b7280' }}>Base:</label>
                      <div style={{ fontWeight: '500' }}>
                        {new Date(selectedSnapshot.date).toLocaleDateString()}
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.875rem', color: '#6b7280' }}>Compare to:</label>
                      <select
                        value={compareSnapshot?.id || ''}
                        onChange={(e) => {
                          const snapshot = snapshots.find(s => s.id === e.target.value);
                          setCompareSnapshot(snapshot);
                        }}
                        style={{
                          padding: '0.25rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '0.25rem'
                        }}
                      >
                        <option value="">Select snapshot</option>
                        {snapshots
                          .filter(s => s.id !== selectedSnapshot.id)
                          .map(s => (
                            <option key={s.id} value={s.id}>
                              {new Date(s.date).toLocaleDateString()}
                            </option>
                          ))}
                      </select>
                    </div>
                    {compareSnapshot && (
                      <button
                        onClick={handleCompareSnapshots}
                        style={{
                          padding: '0.5rem 1rem',
                          backgroundColor: '#10b981',
                          color: 'white',
                          border: 'none',
                          borderRadius: '0.375rem',
                          cursor: 'pointer'
                        }}
                      >
                        Compare
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Comparison Results */}
              {snapshotComparison && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
                    Score Changes: {new Date(snapshotComparison.snapshot1.date).toLocaleDateString()} → {new Date(snapshotComparison.snapshot2.date).toLocaleDateString()}
                  </h3>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                          <th style={{ padding: '0.5rem', textAlign: 'left' }}>Symbol</th>
                          <th style={{ padding: '0.5rem', textAlign: 'left' }}>Fund Name</th>
                          <th style={{ padding: '0.5rem', textAlign: 'center' }}>Old Score</th>
                          <th style={{ padding: '0.5rem', textAlign: 'center' }}>New Score</th>
                          <th style={{ padding: '0.5rem', textAlign: 'center' }}>Change</th>
                        </tr>
                      </thead>
                      <tbody>
                        {snapshotComparison.changes.map((change, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '0.5rem' }}>{change.symbol}</td>
                            <td style={{ padding: '0.5rem' }}>{change.fundName}</td>
                            <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                              {change.type === 'new' ? '-' : change.oldScore}
                            </td>
                            <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                              {change.type === 'removed' ? '-' : change.newScore}
                            </td>
                            <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                              {change.type === 'new' ? (
                                <span style={{ color: '#059669' }}>NEW</span>
                              ) : change.type === 'removed' ? (
                                <span style={{ color: '#dc2626' }}>REMOVED</span>
                              ) : (
                                <span style={{ 
                                  color: change.change > 0 ? '#059669' : '#dc2626',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '0.25rem'
                                }}>
                                  {change.change > 0 ? '↑' : '↓'}
                                  {Math.abs(change.change)}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Snapshots List */}
              <div style={{ display: 'grid', gap: '1rem' }}>
                {snapshots.map((snapshot) => (
                  <div
                    key={snapshot.id}
                    style={{
                      padding: '1rem',
                      border: '1px solid #e5e7eb',
                      borderRadius: '0.5rem',
                      backgroundColor: selectedSnapshot?.id === snapshot.id ? '#eff6ff' : 'white',
                      cursor: 'pointer'
                    }}
                    onClick={() => loadSnapshot(snapshot)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div>
                        <h3 style={{ fontWeight: 'bold', fontSize: '1.125rem' }}>
                          <Calendar size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
                          {new Date(snapshot.date).toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                        </h3>
                        <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
                          {snapshot.metadata.totalFunds} funds • 
                          {snapshot.metadata.recommendedFunds} recommended • 
                          Uploaded {new Date(snapshot.metadata.uploadDate).toLocaleDateString()}
                        </p>
                        {snapshot.metadata.fileName && (
                          <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.125rem' }}>
                            File: {snapshot.metadata.fileName}
                          </p>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {selectedSnapshot?.id === snapshot.id && (
                          <span style={{
                            padding: '0.25rem 0.75rem',
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            borderRadius: '0.25rem',
                            fontSize: '0.75rem',
                            fontWeight: '500'
                          }}>
                            Active
                          </span>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm('Delete this snapshot?')) {
                              deleteSnapshot(snapshot.id).then(() => {
                                loadSnapshots();
                              });
                            }
                          }}
                          style={{
                            padding: '0.25rem 0.5rem',
                            backgroundColor: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '0.25rem',
                            cursor: 'pointer'
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{
              textAlign: 'center',
              padding: '3rem',
              backgroundColor: '#f9fafb',
              borderRadius: '0.5rem',
              color: '#6b7280'
            }}>
              <Database size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
              <p>No historical snapshots found</p>
              <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                Upload fund data and it will be saved automatically
              </p>
            </div>
          )}
        </div>
      )}

      {/* Admin Tab */}
      {activeTab === 'admin' && <FundAdmin />}

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
                <li>Upload your monthly fund performance Excel file</li>
                <li>The system will automatically calculate Z-scores for each fund within its asset class</li>
                <li>Navigate tabs to view different analyses and insights</li>
                <li>Export reports for investment committee meetings</li>
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
                  <strong>Admin:</strong> Manage recommended funds and benchmark mappings
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
  );
};

export default App;
