// App.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { RefreshCw, Settings, Trash2, LayoutGrid, AlertCircle, TrendingUp, Award, Clock, Database, Calendar, Download, BarChart3, Activity, Info, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import './App.css'; // Import the CSS file
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
  downloadFile,
  generatePDFReport
} from './services/exportService';
import {
  calculateDiversification,
  identifyOutliers,
  performAttribution
} from './services/analytics';
import { processRawFunds } from './services/fundProcessor';
import assetClassGroups from './data/assetClassGroups';
import stringSimilarity from 'string-similarity';

// Enhanced column matching with intelligent fallbacks
const COLUMN_SYNONYMS = {
  'Symbol': ['symbol', 'cusip', 'ticker', 'fund id', 'fundid', 'fund_id', 'fund identifier', 'symbolcusip', 'symbol/cusip', 'cusip/symbol', 'identifier', 'symbolcusip'],
  'Fund Name': ['fund name', 'product name', 'name', 'fundname', 'fund_name', 'product', 'fund', 'security name'],
  'YTD': ['ytd', 'total return - ytd', 'ytd return', 'year to date', 'year-to-date', 'ytd total return', 'total return ytd'],
  '1 Year': ['1 year', '1y', 'total return - 1 year', '1 year return', '1-year', '1yr', 'one year', 'total return 1 year'],
  '3 Year': ['3 year', '3y', 'annualized total return - 3 year', '3 year return', '3-year', '3yr', 'three year', 'total return 3 year'],
  '5 Year': ['5 year', '5y', 'annualized total return - 5 year', '5 year return', '5-year', '5yr', 'five year', 'total return 5 year'],
  '10 Year': ['10 year', '10y', 'annualized total return - 10 year', '10 year return', '10-year', '10yr', 'ten year', 'total return 10 year'],
  'Alpha': ['alpha', 'alpha (asset class) - 5 year', 'alpha asset class', 'alpha 5 year'],
  'Sharpe Ratio': ['sharpe', 'sharpe ratio', 'sharpe ratio - 3 year', 'sharpe 3 year'],
  'Standard Deviation': ['standard deviation', 'std dev', 'volatility', 'standard deviation - 3 year', 'standard deviation - 5 year'],
  'Net Expense Ratio': ['net expense ratio', 'expense ratio', 'net exp ratio', 'exp ratio', 'expense'],
  'Asset Class': ['asset class', 'category', 'fund category', 'investment category', 'class']
};

// Intelligent column detection with multiple strategies
function intelligentColumnMapping(headers) {
  const normalizedHeaders = headers.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const columnMap = {};
  const unmappedHeaders = [...headers];
  
  console.log('Headers to match:', headers);
  console.log('Normalized headers:', normalizedHeaders);

  // Strategy 1: Direct synonym matching
  Object.entries(COLUMN_SYNONYMS).forEach(([targetColumn, synonyms]) => {
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i].toLowerCase();
      const normalizedHeader = normalizedHeaders[i];
      
      // Check exact matches and synonyms
      if (synonyms.some(synonym => 
        header.includes(synonym) || 
        normalizedHeader.includes(synonym.replace(/[^a-z0-9]/g, ''))
      )) {
        columnMap[targetColumn] = i;
        unmappedHeaders[i] = null; // Mark as mapped
        console.log(`Matched "${headers[i]}" to "${targetColumn}"`);
        break;
      }
    }
  });

  // Special handling for Symbol/CUSIP format - check this before other fallbacks
  if (!columnMap.Symbol) {
    for (let i = 0; i < headers.length; i++) {
      if (unmappedHeaders[i] !== null) {
        const header = headers[i].toLowerCase();
        // Check for "symbol/cusip" or "symbolcusip" patterns
        if (header.includes('symbol') && header.includes('cusip')) {
          columnMap.Symbol = i;
          unmappedHeaders[i] = null;
          console.log(`Special Symbol/CUSIP match: "${headers[i]}" to Symbol`);
          break;
        }
      }
    }
  }

  // Strategy 2: Smart fallback detection
  if (!columnMap.Symbol) {
    // Look for any column that might be a symbol (contains letters/numbers, not too long)
    for (let i = 0; i < headers.length; i++) {
      if (unmappedHeaders[i] !== null && headers[i].length <= 15 && /[A-Z]/i.test(headers[i])) {
        columnMap.Symbol = i;
        unmappedHeaders[i] = null;
        console.log(`Fallback: Matched "${headers[i]}" to Symbol`);
        break;
      }
    }
  }



  if (!columnMap['Fund Name']) {
    // Look for any column that might be a fund name (longer text, contains "fund" or "name")
    for (let i = 0; i < headers.length; i++) {
      if (unmappedHeaders[i] !== null && headers[i].length > 10 && 
          (headers[i].toLowerCase().includes('fund') || headers[i].toLowerCase().includes('name'))) {
        columnMap['Fund Name'] = i;
        unmappedHeaders[i] = null;
        console.log(`Fallback: Matched "${headers[i]}" to Fund Name`);
        break;
      }
    }
  }

  // Strategy 3: Pattern-based detection for performance metrics
  const performancePatterns = [
    { target: 'YTD', patterns: ['ytd', 'year to date', 'total return.*ytd'] },
    { target: '1 Year', patterns: ['1.*year', 'one.*year', 'total return.*1'] },
    { target: '3 Year', patterns: ['3.*year', 'three.*year', 'total return.*3'] },
    { target: '5 Year', patterns: ['5.*year', 'five.*year', 'total return.*5'] },
    { target: '10 Year', patterns: ['10.*year', 'ten.*year', 'total return.*10'] }
  ];

  performancePatterns.forEach(({ target, patterns }) => {
    if (!columnMap[target]) {
      for (let i = 0; i < headers.length; i++) {
        if (unmappedHeaders[i] !== null) {
          const header = headers[i].toLowerCase();
          if (patterns.some(pattern => new RegExp(pattern).test(header))) {
            columnMap[target] = i;
            unmappedHeaders[i] = null;
            console.log(`Pattern match: "${headers[i]}" to "${target}"`);
            break;
          }
        }
      }
    }
  });

  // Strategy 4: Numeric column detection for ratios
  if (!columnMap['Sharpe Ratio']) {
    for (let i = 0; i < headers.length; i++) {
      if (unmappedHeaders[i] !== null && headers[i].toLowerCase().includes('sharpe')) {
        columnMap['Sharpe Ratio'] = i;
        unmappedHeaders[i] = null;
        console.log(`Numeric match: "${headers[i]}" to Sharpe Ratio`);
        break;
      }
    }
  }

  if (!columnMap['Net Expense Ratio']) {
    for (let i = 0; i < headers.length; i++) {
      if (unmappedHeaders[i] !== null && headers[i].toLowerCase().includes('expense')) {
        columnMap['Net Expense Ratio'] = i;
        unmappedHeaders[i] = null;
        console.log(`Numeric match: "${headers[i]}" to Net Expense Ratio`);
        break;
      }
    }
  }

  return {
    columnMap,
    unmappedHeaders: unmappedHeaders.filter(h => h !== null)
  };
}

const FUZZY_MATCH_THRESHOLD = 0.4; // Lowered from 0.7 to be more permissive

function fuzzyMapHeaders(headers) {
  const columnMap = {};
  const usedIndexes = new Set();

  // Special fallback for Symbol: match any header containing both 'symbol' and 'cusip' (ignoring punctuation)
  headers.forEach((header, idx) => {
    if (!header || typeof header !== 'string') return;
    const norm = header.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (norm.includes('symbol') && norm.includes('cusip')) {
      columnMap['Symbol'] = idx;
      usedIndexes.add(idx);
    }
  });

  Object.entries(COLUMN_SYNONYMS).forEach(([canonical, synonyms]) => {
    // Skip if already matched by fallback
    if (columnMap[canonical] !== undefined) return;
    let bestMatch = { rating: 0, index: -1 };
    headers.forEach((header, idx) => {
      if (usedIndexes.has(idx)) return;
      if (!header || typeof header !== 'string') return;
      const headerNorm = header.toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const synonym of synonyms) {
        const synonymNorm = synonym.toLowerCase().replace(/[^a-z0-9]/g, '');
        const rating = stringSimilarity.compareTwoStrings(headerNorm, synonymNorm);
        if (rating > bestMatch.rating) {
          bestMatch = { rating, index: idx };
        }
      }
    });
    if (bestMatch.rating >= FUZZY_MATCH_THRESHOLD) {
      columnMap[canonical] = bestMatch.index;
      usedIndexes.add(bestMatch.index);
    }
  });
  return columnMap;
}

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
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAssetClass, setFilterAssetClass] = useState('all');
  const [sortBy, setSortBy] = useState('score');
  const [sortDirection, setSortDirection] = useState('desc');

  // Historical data states
  const [snapshots, setSnapshots] = useState([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState(null);
  const [compareSnapshot, setCompareSnapshot] = useState(null);
  const [snapshotComparison, setSnapshotComparison] = useState(null);

  const [recommendedFunds, setRecommendedFunds] = useState([]);
  const [assetClassBenchmarks, setAssetClassBenchmarks] = useState({});

  const [uploadPreview, setUploadPreview] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [manualColumnMapping, setManualColumnMapping] = useState(false);
  const [editableColumnMap, setEditableColumnMap] = useState({});
  const [availableHeaders, setAvailableHeaders] = useState([]);

  // Memoize expensive calculations
  const memoizedAssetClasses = useMemo(() => {
    const classes = new Set(Object.keys(assetClassBenchmarks));
    scoredFundData.forEach(f => {
      if (f['Asset Class']) classes.add(f['Asset Class']);
    });
    return Array.from(classes).sort();
  }, [assetClassBenchmarks, scoredFundData]);

  // Memoize review candidates calculation
  const reviewCandidates = useMemo(() => {
    return identifyReviewCandidates(scoredFundData);
  }, [scoredFundData]);

  // Memoize registry name map
  const registryNameMap = useMemo(() => {
    const clean = (s) => s?.toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
    const map = {};
    recommendedFunds.forEach(f => {
      map[clean(f.symbol)] = f.name;
    });
    return map;
  }, [recommendedFunds]);

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
    setError(null);
    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        console.log('Raw Excel data:', jsonData);
        
        // Find header row (first row with at least 2 string cells)
        let headerRowIndex = jsonData.findIndex(row => 
          row.filter(cell => typeof cell === 'string' && cell.trim().length > 0).length >= 2
        );
        
        if (headerRowIndex === -1) {
          setError('Could not find header row in the file. Please ensure the first row contains column names.');
          setLoading(false);
          return;
        }
        
        const headers = jsonData[headerRowIndex].map(h => String(h || '').trim());
        const dataRows = jsonData.slice(headerRowIndex + 1).filter(row => 
          row.some(cell => cell !== null && cell !== undefined && cell !== '')
        );
        
        console.log('Headers found:', headers);
        console.log('Data rows:', dataRows.length);
        
        // Use intelligent column mapping
        const { columnMap, unmappedHeaders } = intelligentColumnMapping(headers);
        
        console.log('Column mapping result:', columnMap);
        console.log('Unmapped headers:', unmappedHeaders);
        
        // Check if we have essential columns
        if (!columnMap.Symbol) {
          setError('Could not automatically identify a Symbol/Ticker column. Please check your file headers or use manual mapping.');
          setLoading(false);
          return;
        }
        
        // Parse the data using the column mapping
        const parsed = dataRows.map(row => {
          const fund = {};
          Object.entries(columnMap).forEach(([targetField, sourceIndex]) => {
            const value = row[sourceIndex];
            if (value !== null && value !== undefined && value !== '') {
              fund[targetField] = value;
            }
          });
          return fund;
        }).filter(fund => Object.keys(fund).length > 0);
        
        console.log('Parsed funds:', parsed.length);
        console.log('Sample parsed fund:', parsed[0]);
        
        // Set up preview data
        setUploadPreview({
          parsed,
          columnMap,
          unmappedHeaders,
          headers,
          dataRows: dataRows.slice(0, 5) // Show first 5 rows as preview
        });
        setEditableColumnMap({ ...columnMap });
        setAvailableHeaders(headers);
        setShowPreviewModal(true);
        setLoading(false);
        
      } catch (error) {
        console.error('Error processing file:', error);
        setError(`Error processing file: ${error.message}`);
        setLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  function handleConfirmImport() {
    if (!uploadPreview) return;
    setShowPreviewModal(false);
    setLoading(true);
    setTimeout(() => {
      try {
        const { parsed, columnMap } = uploadPreview;
        // Check for essential columns
        if (!columnMap.Symbol) {
          setError('Import failed: Could not find a column for Symbol (Ticker/CUSIP). Please check your file headers.');
          setLoading(false);
          setUploadPreview(null);
          return;
        }
        if (!parsed || parsed.length === 0) {
          setError('Import failed: No valid rows found in the file. Please check your data.');
          setLoading(false);
          setUploadPreview(null);
          return;
        }
        const { scoredFunds, classSummaries, benchmarks } = processRawFunds(parsed, {
          recommendedFunds,
          benchmarks: assetClassBenchmarks
        });
        setScoredFundData(Array.isArray(scoredFunds) ? scoredFunds : []);
        setBenchmarkData(benchmarks || {});
        setClassSummaries(classSummaries || {});
        setCurrentSnapshotDate(new Date().toISOString().split('T')[0]);
        setError(null);
      } catch (err) {
        setError('Error processing imported data: ' + err.message);
      } finally {
        setLoading(false);
        setUploadPreview(null);
      }
    }, 100);
  }

  function handleCancelImport() {
    setShowPreviewModal(false);
    setUploadPreview(null);
  }

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

  // Filtered and sorted funds
  const filteredAndSortedFunds = useMemo(() => {
    let filtered = scoredFundData;
    
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
  }, [scoredFundData, searchTerm, filterAssetClass, sortBy, sortDirection]);

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">Raymond James</div>
        <nav className="sidebar-nav">
          <button className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => setActiveTab('dashboard')}>Dashboard</button>
          <button className={activeTab === 'funds' ? 'active' : ''} onClick={() => setActiveTab('funds')}>Fund Scores</button>
          <button className={activeTab === 'class' ? 'active' : ''} onClick={() => setActiveTab('class')}>Class View</button>
          <button className={activeTab === 'analysis' ? 'active' : ''} onClick={() => setActiveTab('analysis')}>Analysis</button>
          <button className={activeTab === 'analytics' ? 'active' : ''} onClick={() => setActiveTab('analytics')}>Analytics</button>
          <button className={activeTab === 'history' ? 'active' : ''} onClick={() => setActiveTab('history')}>History</button>
          <button className={activeTab === 'admin' ? 'active' : ''} onClick={() => setActiveTab('admin')}>Admin</button>
        </nav>
      </aside>
      {/* Main Content */}
      <main className="main-content">
        {/* Header */}
        <div className="header">
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 600, color: 'var(--color-primary)' }}>Lightship Fund Analysis</h1>
            <p style={{ color: 'var(--color-primary-light)' }}>Monthly fund performance analysis with Z-score ranking system</p>
          </div>
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
        </div>
        {/* Card-based main content */}
        <div className="card">
          {/* --- All previous tab content, upload, etc. goes here --- */}
          {/* ...existing app content... */}
      {/* File Upload Section - Show on all tabs except admin and history */}
      {activeTab !== 'admin' && activeTab !== 'history' && (
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Upload Fund Data</h3>
                <p className="card-subtitle">Upload your fund performance data file (.xlsx, .xls, or .csv)</p>
              </div>
              <div className="input-group">
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
                  className="input-field"
                  style={{ marginBottom: 'var(--spacing-sm)' }}
          />
          {loading && (
                  <div className="loading-spinner">
                    <RefreshCw size={16} />
              Processing and calculating scores...
                  </div>
                )}
                {error && (
                  <div className="alert alert-error">
                    <strong>Error:</strong> {error}
                  </div>
                )}
                {uploadedFileName && (
                  <div className="alert alert-success">
                    <strong>Success:</strong> Loaded {uploadedFileName} with {scoredFundData.length} funds
            </div>
          )}
              </div>
        </div>
      )}

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div>
              <div className="card-header">
                <h2 className="card-title">Fund Analysis Dashboard</h2>
                <p className="card-subtitle">Comprehensive overview of fund performance and analysis</p>
              </div>
              
          {scoredFundData.length > 0 ? (
                <div>
                  {/* Summary Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 'var(--spacing-lg)', marginBottom: 'var(--spacing-lg)' }}>
                    <div className="card">
                      <div className="card-header">
                        <h3 className="card-title">Total Funds</h3>
                      </div>
                      <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>
                        {scoredFundData.length}
                      </div>
                </div>
                
                    <div className="card">
                      <div className="card-header">
                        <h3 className="card-title">Asset Classes</h3>
                      </div>
                      <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>
                        {memoizedAssetClasses.length}
                      </div>
                    </div>
                    
                    <div className="card">
                      <div className="card-header">
                        <h3 className="card-title">Top Performers</h3>
                      </div>
                      <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-success)' }}>
                        {scoredFundData.filter(f => f.score >= 0.7).length}
                      </div>
                    </div>
                    
                    <div className="card">
                      <div className="card-header">
                        <h3 className="card-title">Review Candidates</h3>
                      </div>
                      <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-error)' }}>
                        {reviewCandidates.length}
                      </div>
                    </div>
                  </div>

                  {/* Performance Heatmap */}
                  <div className="card">
                    <div className="card-header">
                      <h3 className="card-title">Performance Heatmap</h3>
                      <p className="card-subtitle">Visual representation of fund performance across asset classes</p>
                    </div>
                    <PerformanceHeatmap data={scoredFundData} />
                  </div>

                  {/* Top/Bottom Performers */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-lg)' }}>
                    <div className="card">
                      <div className="card-header">
                        <h3 className="card-title">Top Performers</h3>
                </div>
                      <TopBottomPerformers data={scoredFundData} type="top" />
              </div>
              
                    <div className="card">
                      <div className="card-header">
                        <h3 className="card-title">Bottom Performers</h3>
                      </div>
                      <TopBottomPerformers data={scoredFundData} type="bottom" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="card">
                  <div className="card-header">
                    <h3 className="card-title">No Data Available</h3>
                    <p className="card-subtitle">Upload fund data to see the dashboard</p>
                  </div>
            </div>
          )}
        </div>
      )}

      {/* Fund Scores Tab */}
{activeTab === 'funds' && (
  <div>
    {scoredFundData.length > 0 ? (
      <div>
                  <div className="card-header">
                    <h2 className="card-title">All Funds with Scores</h2>
                    <p className="card-subtitle">Scores calculated using weighted Z-score methodology within each asset class</p>
        </div>
        
                  {/* Search and Filter Controls */}
                  <div className="controls-container">
                    <div className="input-group" style={{ margin: 0, flex: 1 }}>
                      <input
                        type="text"
                        placeholder="Search funds..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                      />
                    </div>
                    <div className="input-group" style={{ margin: 0 }}>
                      <select
                        value={filterAssetClass}
                        onChange={(e) => setFilterAssetClass(e.target.value)}
                        className="select-field"
                      >
                        <option value="all">All Asset Classes</option>
                        {memoizedAssetClasses.map(cls => (
                          <option key={cls} value={cls}>{cls}</option>
                        ))}
                      </select>
                    </div>
                    <div className="input-group" style={{ margin: 0 }}>
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="select-field"
                      >
                        <option value="score">Sort by Score</option>
                        <option value="symbol">Sort by Symbol</option>
                        <option value="name">Sort by Name</option>
                        <option value="assetClass">Sort by Asset Class</option>
                      </select>
                    </div>
                    <button
                      onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                      className="btn btn-secondary"
                    >
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </button>
                  </div>

                  {/* Results Summary */}
                  <div style={{ marginBottom: 'var(--spacing-md)', color: '#6b7280', fontSize: '0.875rem' }}>
                    Showing {filteredAndSortedFunds.length} of {scoredFundData.length} funds
                  </div>

                  {/* Fund Scores Table */}
                  <div className="table-container">
                    <table>
            <thead>
                        <tr>
                          <th>Symbol</th>
                          <th>Fund Name</th>
                          <th>Asset Class</th>
                          <th>Score</th>
                          <th>YTD</th>
                          <th>1 Year</th>
                          <th>3 Year</th>
                          <th>5 Year</th>
                          <th>10 Year</th>
                          <th>Sharpe</th>
                          <th>Alpha</th>
                          <th>Actions</th>
              </tr>
            </thead>
            <tbody>
                        {filteredAndSortedFunds.map((fund, index) => (
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
                            <td>{fund.YTD?.toFixed(2)}%</td>
                            <td>{fund['1 Year']?.toFixed(2)}%</td>
                            <td>{fund['3 Year']?.toFixed(2)}%</td>
                            <td>{fund['5 Year']?.toFixed(2)}%</td>
                            <td>{fund['10 Year']?.toFixed(2)}%</td>
                            <td>{fund['Sharpe Ratio']?.toFixed(2)}</td>
                            <td>{fund.Alpha?.toFixed(2)}</td>
                            <td>
                              <button
                                onClick={() => setSelectedFundForDetails(fund)}
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
            </div>
          ) : (
                <div className="card">
                  <div className="card-header">
                    <h3 className="card-title">No Fund Data Available</h3>
                    <p className="card-subtitle">Upload a fund performance file to get started</p>
                  </div>
            </div>
          )}
        </div>
      )}

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
                                    onClick={() => setSelectedFundForDetails(fund)}
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
                <div className="card">
                  <div className="card-header">
                    <h3 className="card-title">No Data Available</h3>
                    <p className="card-subtitle">Upload fund data to see analysis</p>
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
              <div className="card-header">
                <h2 className="card-title">Administration</h2>
                <p className="card-subtitle">Manage fund registry and system settings</p>
              </div>
              
              <FundAdmin 
                recommendedFunds={recommendedFunds}
                setRecommendedFunds={setRecommendedFunds}
                assetClassBenchmarks={assetClassBenchmarks}
                setAssetClassBenchmarks={setAssetClassBenchmarks}
              />
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

          {showPreviewModal && uploadPreview && (
            <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <div style={{ background: 'white', borderRadius: '0.5rem', padding: '2rem', maxWidth: '90vw', maxHeight: '80vh', overflow: 'auto' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>Preview Import: {uploadPreview.fileName}</h3>
                <div style={{ marginBottom: '1rem', color: '#6b7280', fontSize: '0.9rem' }}>
                  <strong>Mapped columns:</strong> {Object.keys(uploadPreview.columnMap).join(', ')}<br/>
                  {uploadPreview.unmappedHeaders.length > 0 && (
                    <span style={{ color: '#dc2626' }}>
                      Unmapped columns: {uploadPreview.unmappedHeaders.join(', ')} (will be ignored)
                    </span>
                  )}
                </div>
                <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <thead>
                      <tr>
                        {Object.keys(uploadPreview.columnMap).map(col => (
                          <th key={col} style={{ padding: '0.5rem', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {uploadPreview.parsed.slice(0, 10).map((row, i) => (
                        <tr key={i}>
                          {Object.keys(uploadPreview.columnMap).map(col => (
                            <td key={col} style={{ padding: '0.5rem', borderBottom: '1px solid #f3f4f6' }}>{row[col]}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ color: '#6b7280', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                    Showing first 10 rows. {uploadPreview.parsed.length} total rows will be imported.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                  <button onClick={handleCancelImport} style={{ padding: '0.5rem 1.5rem', background: '#e5e7eb', border: 'none', borderRadius: '0.375rem', cursor: 'pointer' }}>Cancel</button>
                  <button 
                    onClick={() => setManualColumnMapping(true)} 
                    style={{ padding: '0.5rem 1.5rem', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '0.375rem', cursor: 'pointer' }}
                  >
                    Edit Mapping
                  </button>
                  <button onClick={handleConfirmImport} style={{ padding: '0.5rem 1.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: 'bold' }}>Import</button>
                </div>
              </div>
            </div>
          )}

          {/* Manual Column Mapping Modal */}
          {showPreviewModal && manualColumnMapping && (
            <div className="modal-overlay">
              <div className="modal-content card">
                <div className="modal-header">
                  <h3>Manual Column Mapping</h3>
                  <button onClick={() => setManualColumnMapping(false)} className="btn-close">×</button>
                </div>
                <div className="modal-body">
                  <p>Map your file columns to the required fields. Required fields are marked with *.</p>
                  
                  <div className="mapping-grid">
                    {Object.entries(COLUMN_SYNONYMS).map(([targetField, synonyms]) => (
                      <div key={targetField} className="mapping-row">
                        <label className="mapping-label">
                          {targetField} {targetField === 'Symbol' && '*'}
                        </label>
                        <select
                          value={editableColumnMap[targetField] !== undefined ? editableColumnMap[targetField].toString() : ''}
                          onChange={(e) => {
                            const newMap = { ...editableColumnMap };
                            if (e.target.value) {
                              newMap[targetField] = parseInt(e.target.value);
                            } else {
                              delete newMap[targetField];
                            }
                            setEditableColumnMap(newMap);
                          }}
                          className="mapping-select"
                        >
                          <option value="">-- Select Column --</option>
                          {availableHeaders.map((header, index) => (
                            <option key={index} value={index}>
                              {header}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                  
                  <div className="modal-actions">
                    <button 
                      onClick={() => setManualColumnMapping(false)} 
                      className="btn btn-secondary"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={() => {
                        setUploadPreview(prev => ({
                          ...prev,
                          columnMap: editableColumnMap
                        }));
                        setManualColumnMapping(false);
                      }}
                      className="btn btn-primary"
                      disabled={!editableColumnMap.Symbol}
                    >
                      Confirm Mapping
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      {/* Footer */}
      <footer className="footer">
        &copy; {new Date().getFullYear()} Raymond James (Demo) | Lightship Fund Analysis
      </footer>
    </div>
  );
};

export default App;
