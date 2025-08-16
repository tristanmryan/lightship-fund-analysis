// src/components/Admin/MonthlySnapshotUpload.jsx
import React, { useState, useEffect, useCallback } from 'react';
import Papa from 'papaparse';
import fundService from '../../services/fundService';
import asOfStore from '../../services/asOfStore';
import { dbUtils, supabase } from '../../services/supabase';
import { createMonthlyTemplateCSV, createLegacyMonthlyTemplateCSV } from '../../services/csvTemplate';
import uploadValidator from '../../utils/uploadValidator';

const FLAG_ENABLE_IMPORT = (process.env.REACT_APP_ENABLE_IMPORT || (process.env.NODE_ENV !== 'production' ? 'true' : 'false')) === 'true';

function isValidDateOnly(str) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(str || '').trim());
}

function isEndOfMonth(dateStr) {
  try {
    const d = new Date(dateStr + 'T00:00:00Z');
    const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
    return d.getUTCDate() === next.getUTCDate();
  } catch {
    return false;
  }
}

function PreviewTable({ rows }) {
  const shown = rows.slice(0, 20);
  return (
    <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 6 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ padding: 8, borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>Ticker</th>
            <th style={{ padding: 8, borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>AsOfMonth</th>
            <th style={{ padding: 8, borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>Type</th>
            <th style={{ padding: 8, borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>EOM</th>
            <th style={{ padding: 8, borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>Action</th>
            <th style={{ padding: 8, borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>Reason</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r, i) => (
            <tr key={i}>
              <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{r.ticker}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{r.asOf}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{r.kind}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{r.eom ? 'Yes' : 'Warn'}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{r.willImport ? 'Import' : 'Skip'}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6', color: '#6b7280' }}>{r.reason || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > shown.length && (
        <div style={{ padding: 8, color: '#6b7280' }}>Showing first {shown.length} of {rows.length} rows…</div>
      )}
    </div>
  );
}

export default function MonthlySnapshotUpload() {
  // Dual file upload state
  const [fundFile, setFundFile] = useState(null);
  const [benchmarkFile, setBenchmarkFile] = useState(null);
  const [fundValidation, setFundValidation] = useState(null);
  const [benchmarkValidation, setBenchmarkValidation] = useState(null);
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [toast, setToast] = useState(null);
  const [month, setMonth] = useState(''); // 1-12 as string
  const [year, setYear] = useState(''); // YYYY as string
  const [showConfirm, setShowConfirm] = useState(false);
  const [knownTickers, setKnownTickers] = useState(new Set());
  const [benchmarkMap, setBenchmarkMap] = useState(new Map());
  const [uploadProgress, setUploadProgress] = useState({ stage: '', progress: 0 });
  const [activityLog, setActivityLog] = useState([]);
  
  // Legacy state variables (needed for backward compatibility)
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [counts, setCounts] = useState({ parsed: 0, willImport: 0, skipped: 0, eomWarnings: 0 });
  const [monthsInFile, setMonthsInFile] = useState([]);
  const [parsedRows, setParsedRows] = useState([]);
  const [mode, setMode] = useState('picker');
  const [hasAsOfColumn, setHasAsOfColumn] = useState(false);
  const [headerMap, setHeaderMap] = useState({ recognizedPairs: [], unrecognized: [] });
  const [coverage, setCoverage] = useState({});
  const [blockers, setBlockers] = useState([]);
  const [skipReasons, setSkipReasons] = useState({});
  const [missingTickers, setMissingTickers] = useState([]);
  const [customMap, setCustomMap] = useState({});
  const [parsing, setParsing] = useState(false);
  
  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);
  const [dragTarget, setDragTarget] = useState(null); // 'fund' | 'benchmark'

  useEffect(() => {
    let mounted = true;
    (async () => {
      const fundTickers = await fundService.listFundTickers();
      const benchList = await fundService.listBenchmarkTickers();
      if (!mounted) return;
      setKnownTickers(new Set(fundTickers.map((t) => String(t || '').toUpperCase())));
      const bm = new Map();
      (benchList || []).forEach(({ ticker, name }) => {
        bm.set(String(ticker || '').toUpperCase(), name || '');
      });
      setBenchmarkMap(bm);
    })();
    return () => { mounted = false; };
  }, []);

  // Validate uploaded files using the new validator
  const validateFile = useCallback(async (file, fileType) => {
    if (!file) return null;
    
    setValidating(true);
    try {
      const validation = await uploadValidator.validateCSVUpload(file, knownTickers, {
        requireEOM: true,
        allowMixed: false
      });
      
      if (fileType === 'fund') {
        setFundValidation(validation);
      } else {
        setBenchmarkValidation(validation);
      }
      
      return validation;
    } catch (error) {
      const errorValidation = {
        isValid: false,
        errors: [error.message],
        warnings: [],
        data: null,
        uploadType: null
      };
      
      if (fileType === 'fund') {
        setFundValidation(errorValidation);
      } else {
        setBenchmarkValidation(errorValidation);
      }
      
      return errorValidation;
    } finally {
      setValidating(false);
    }
  }, [knownTickers]);

  // Legacy CSV parsing function
  const parseCsv = useCallback(async () => {
    if (!file) return;
    
    setParsing(true);
    try {
      const text = await file.text();
      const result = Papa.parse(text, { header: true, skipEmptyLines: true });
      
      if (result.errors.length > 0) {
        console.warn('CSV parsing warnings:', result.errors);
      }
      
      const rows = result.data || [];
      setParsedRows(rows);
      
      // Detect if AsOfMonth column exists
      const hasAsOf = rows.length > 0 && rows[0].hasOwnProperty('AsOfMonth');
      setHasAsOfColumn(hasAsOf);
      
      // Basic header mapping
      const recognized = [];
      const unrecognized = [];
      const firstRow = rows[0] || {};
      
      Object.keys(firstRow).forEach(header => {
        const normalized = header.toLowerCase().trim();
        if (['ticker', 'asofmonth', 'type'].includes(normalized)) {
          recognized.push({ header, key: normalized });
        } else {
          unrecognized.push(header);
        }
      });
      
      setHeaderMap({ recognizedPairs: recognized, unrecognized });
      
    } catch (error) {
      console.error('Failed to parse CSV:', error);
      alert('Failed to parse CSV file. Please check the file format.');
    } finally {
      setParsing(false);
    }
  }, [file]);

  // Legacy file change handler
  const handleFileChange = useCallback((e) => {
    const selectedFile = e.target.files?.[0] || null;
    setFile(selectedFile);
    setParsedRows([]);
    setPreview([]);
    setCounts({ parsed: 0, willImport: 0, skipped: 0, eomWarnings: 0 });
    setMonthsInFile([]);
    setMode('picker');
    setHasAsOfColumn(false);
    setHeaderMap({ recognizedPairs: [], unrecognized: [] });
    setCoverage({});
    setBlockers([]);
    setSkipReasons({});
    setMissingTickers([]);
    setCustomMap({});
  }, []);

  // Legacy template download handlers
  const handleDownloadTemplate = useCallback(() => {
    try {
      const blob = createMonthlyTemplateCSV();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'monthly_template.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download template:', error);
    }
  }, []);

  const handleDownloadLegacyTemplate = useCallback(() => {
    try {
      const blob = createLegacyMonthlyTemplateCSV();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'legacy_monthly_template.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download legacy template:', error);
    }
  }, []);

  // Helper: load sample CSV
  const loadSampleData = useCallback(async () => {
    try {
      const res = await fetch('/sample-data/monthly_example.csv');
      const text = await res.text();
      const blob = new Blob([text], { type: 'text/csv' });
      const sampleFile = new File([blob], 'monthly_example.csv', { type: 'text/csv' });
      setFile(sampleFile);
      // Auto-pick a recent EOM month if empty
      if (!year || !month) {
        const now = new Date();
        const y = now.getUTCFullYear();
        const m = String(now.getUTCMonth() + 1).padStart(2, '0');
        setYear(String(y));
        setMonth(m);
      }
      setTimeout(() => parseCsv(), 0);
    } catch (e) {
      console.error('Failed to load sample data', e);
      alert('Could not load sample CSV.');
    }
  }, [month, parseCsv, year]);

  // Handle global request to load sample data (from Dashboard empty state CTA)
  useEffect(() => {
    const handler = async () => {
      await loadSampleData();
    };
    window.addEventListener('LOAD_SAMPLE_DATA', handler);
    return () => window.removeEventListener('LOAD_SAMPLE_DATA', handler);
  }, [loadSampleData]);

  // Handle fund file selection
  const handleFundFileChange = (e) => {
    const file = e.target.files?.[0] || null;
    setFundFile(file);
    setFundValidation(null);
    if (file) {
      validateFile(file, 'fund');
    }
  };

  // Handle benchmark file selection
  const handleBenchmarkFileChange = (e) => {
    const file = e.target.files?.[0] || null;
    setBenchmarkFile(file);
    setBenchmarkValidation(null);
    if (file) {
      validateFile(file, 'benchmark');
    }
  };

  // Enhanced drag and drop with target detection
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const f = e.dataTransfer?.files?.[0];
    if (f && dragTarget) {
      if (dragTarget === 'fund') {
        setFundFile(f);
        setFundValidation(null);
        validateFile(f, 'fund');
      } else if (dragTarget === 'benchmark') {
        setBenchmarkFile(f);
        setBenchmarkValidation(null);
        validateFile(f, 'benchmark');
      }
    }
    setDragTarget(null);
  };

  const handleDragOver = (e, target) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setDragTarget(target);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setDragTarget(null);
  };

  // Download fund performance template
  const handleDownloadFundTemplate = useCallback(() => {
    try {
      const blob = createMonthlyTemplateCSV();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'fund_performance_template.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download fund template:', error);
    }
  }, []);

  // Download benchmark performance template
  const handleDownloadBenchmarkTemplate = useCallback(() => {
    try {
      const csvContent = [
        'benchmark_ticker,date,ytd_return,one_year_return,three_year_return,five_year_return,ten_year_return,sharpe_ratio,standard_deviation_3y,standard_deviation_5y,expense_ratio,alpha,beta,up_capture_ratio,down_capture_ratio',
        'IWF,2025-01-31,9.15,15.23,11.45,11.87,10.23,1.28,16.12,15.34,0.19,0.00,1.00,100.0,100.0',
        'EFA,2025-01-31,4.23,8.67,6.34,7.12,5.89,0.78,18.23,17.45,0.32,0.00,1.00,100.0,100.0'
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'benchmark_performance_template.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download benchmark template:', error);
    }
  }, []);

  // Download error report
  const handleDownloadErrorReport = useCallback((validation) => {
    try {
      const report = uploadValidator.generateErrorReport(validation);
      if (report) {
        const blob = new Blob([report], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'upload_validation_report.txt';
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Failed to download error report:', error);
    }
  }, []);


  // Process parsed rows and update preview
  useEffect(() => {
    if (!parsedRows || parsedRows.length === 0) {
      setPreview([]);
      setCounts({ parsed: 0, willImport: 0, skipped: 0, eomWarnings: 0 });
      setMonthsInFile([]);
      return;
    }
    
    const seenMonths = new Set();
    const pickerDate = computePickerDate();
    // Picker always wins if present
    const activeMode = pickerDate ? 'picker' : (hasAsOfColumn ? 'csv' : 'picker');
    setMode(activeMode);
    
    const rows = parsedRows.map((r) => {
      const ticker = r.__ticker || r.ticker;
      const asOf = activeMode === 'picker' ? pickerDate : r.__asOf || r.AsOfMonth;
      let reason = '';
      let willImport = true;
      
      if (!ticker) { 
        willImport = false; 
        reason = 'Missing Ticker'; 
      }
      if (!asOf || !isValidDateOnly(asOf)) { 
        willImport = false; 
        reason = reason ? reason + '; invalid AsOfMonth' : 'Invalid AsOfMonth'; 
      }
      
      let eom = false;
      if (asOf && isValidDateOnly(asOf)) {
        eom = isEndOfMonth(asOf);
        seenMonths.add(asOf);
      }
      
      const isBenchmark = ticker && benchmarkMap.has(ticker);
      const isKnownFund = ticker && knownTickers.has(ticker);
      // CSV explicit Type column can request Benchmark; allow only when not a known fund
      const explicitType = String(r.Type || r.type || '').trim().toLowerCase();
      const explicitBenchmark = explicitType === 'benchmark';

      // Only import if ticker exists in funds (FK). Benchmarks are labeled but stored separately when not known fund.
      if (ticker && (isBenchmark || explicitBenchmark) && !isKnownFund) {
        // Explicitly mark as benchmark-only row (skipped for now)
        willImport = false;
        reason = reason ? reason + '; benchmark row (stored separately)' : 'Benchmark row (stored separately)';
      }
      if (ticker && !isKnownFund && !isBenchmark && !explicitBenchmark) { 
        willImport = false; 
        reason = reason ? reason + '; unknown ticker' : 'Unknown ticker'; 
      }
      
      // Harden kind: prefer fund on collision
      const kind = (isBenchmark && !isKnownFund) || (explicitBenchmark && !isKnownFund) ? 'benchmark' : 'fund';
      return { ticker, asOf, kind, willImport, reason, eom };
    });
    
    const parsed = rows.length;
    const willImport = rows.filter(r => r.willImport).length;
    const skipped = parsed - willImport;
    const eomWarnings = rows.filter(r => r.willImport && !r.eom).length;
    
    setMonthsInFile(Array.from(seenMonths).sort((a,b) => b.localeCompare(a)));
    setPreview(rows);
    setCounts({ parsed, willImport, skipped, eomWarnings });

    // Track missing tickers for seeding action
    try {
      const missing = Array.from(new Set(rows
        .filter(r => r.ticker && !r.willImport && (r.reason || '').toLowerCase().includes('unknown ticker'))
        .map(r => r.ticker)));
      setMissingTickers(missing);
    } catch {}

    // Build skip reasons map (diagnostic)
    const byReason = new Map();
    for (const r of rows) {
      if (!r.willImport) {
        const key = r.reason || 'Unknown reason';
        const entry = byReason.get(key) || { count: 0, tickers: [] };
        entry.count += 1;
        if (r.ticker && entry.tickers.length < 10) entry.tickers.push(r.ticker);
        byReason.set(key, entry);
      }
    }
    const reasonObj = {};
    for (const [k, v] of byReason.entries()) {
      reasonObj[k] = v;
    }
    setSkipReasons(reasonObj);
    
    // Mirror to console for diagnostics
    try {
      console.log('[Importer] Skipped rows by reason:', reasonObj);
    } catch {}

    // Compute metric coverage and blockers using parseMetricNumber
    const pmn = dbUtils.parseMetricNumber;
    const metrics = [
      { key: 'ytd_return', aliases: ['YTD'] },
      { key: 'one_year_return', aliases: ['1 Year'] },
      { key: 'three_year_return', aliases: ['3 Year'] },
      { key: 'five_year_return', aliases: ['5 Year'] },
      { key: 'ten_year_return', aliases: ['10 Year'] },
      { key: 'sharpe_ratio', aliases: ['Sharpe Ratio'] },
      { key: 'standard_deviation_3y', aliases: ['standard_deviation_3y','Standard Deviation 3Y','standard_deviation','Standard Deviation'] },
      { key: 'standard_deviation_5y', aliases: ['standard_deviation_5y','Standard Deviation 5Y'] },
      { key: 'expense_ratio', aliases: ['Net Expense Ratio'] },
      { key: 'alpha', aliases: ['Alpha','alpha_5y'] },
      { key: 'beta', aliases: ['Beta','beta_3y'] },
      { key: 'manager_tenure', aliases: ['Manager Tenure'] },
      { key: 'up_capture_ratio', aliases: ['Up Capture Ratio','up_capture_ratio_3y','Up Capture Ratio (Morningstar Standard) - 3 Year'] },
      { key: 'down_capture_ratio', aliases: ['Down Capture Ratio','down_capture_ratio_3y','Down Capture Ratio (Morningstar Standard) - 3 Year'] },
    ];
    
    const cov = {};
    const blockList = [];
    for (const m of metrics) {
      let nonNull = 0;
      let total = 0;
      for (const r of parsedRows) {
        const raw = r[m.key] ?? m.aliases.reduce((acc, a) => acc ?? r[a], undefined);
        // Only count rows marked willImport for coverage
        const prev = rows.find(x => x.ticker === (r.__ticker || r.ticker) && (x.asOf === (computePickerDate() || r.__asOf || r.AsOfMonth)));
        if (!prev || !prev.willImport) continue;
        total += 1;
        if (pmn(raw) != null) nonNull += 1;
      }
      cov[m.key] = { nonNull, total };
      if (total > 0 && nonNull === 0) {
        // Hard block if a required metric would be entirely null
        blockList.push({ key: m.key, reason: 'All values null after parsing' });
      }
    }
    setCoverage(cov);
    setBlockers(blockList);
  }, [parsedRows, knownTickers, benchmarkMap, hasAsOfColumn, year, month]);

  function computePickerDate() {
    if (!year || !month) return null;
    const y = Number(String(year).trim());
    const m = Number(String(month).trim());
    if (!y || !m || m < 1 || m > 12) return null;
    // Compute end-of-month in UTC
    const eom = new Date(Date.UTC(y, m, 0));
    return eom.toISOString().slice(0, 10);
  }



  // Enhanced import function using new RPCs
  const performImport = async () => {
    const pickerDate = computePickerDate();
    if (!pickerDate) {
      alert('Please select Month and Year. The picker date is required.');
      return;
    }

    // Check that at least one file is valid
    const hasFunds = fundValidation?.isValid && fundValidation?.data?.length > 0;
    const hasBenchmarks = benchmarkValidation?.isValid && benchmarkValidation?.data?.length > 0;
    
    if (!hasFunds && !hasBenchmarks) {
      alert('Please upload and validate at least one file (fund or benchmark performance).');
      return;
    }

    setImporting(true);
    setResult(null);
    setUploadProgress({ stage: 'Starting upload...', progress: 10 });

    try {
      const results = { funds: null, benchmarks: null };
      let totalSuccess = 0;
      let totalFailed = 0;

      // Import fund data if available
      if (hasFunds) {
        setUploadProgress({ stage: 'Uploading fund performance data...', progress: 30 });
        
        const fundData = fundValidation.data.map(row => ({
          fund_ticker: row._normalizedTicker,
          date: pickerDate, // Override with picker date
          ytd_return: dbUtils.parseMetricNumber(row.ytd_return),
          one_year_return: dbUtils.parseMetricNumber(row.one_year_return),
          three_year_return: dbUtils.parseMetricNumber(row.three_year_return),
          five_year_return: dbUtils.parseMetricNumber(row.five_year_return),
          ten_year_return: dbUtils.parseMetricNumber(row.ten_year_return),
          sharpe_ratio: dbUtils.parseMetricNumber(row.sharpe_ratio),
          standard_deviation_3y: dbUtils.parseMetricNumber(row.standard_deviation_3y),
          standard_deviation_5y: dbUtils.parseMetricNumber(row.standard_deviation_5y),
          expense_ratio: dbUtils.parseMetricNumber(row.expense_ratio),
          alpha: dbUtils.parseMetricNumber(row.alpha),
          beta: dbUtils.parseMetricNumber(row.beta),
          manager_tenure: dbUtils.parseMetricNumber(row.manager_tenure),
          up_capture_ratio: dbUtils.parseMetricNumber(row.up_capture_ratio),
          down_capture_ratio: dbUtils.parseMetricNumber(row.down_capture_ratio)
        }));

        const { data: fundResult, error: fundError } = await supabase.rpc('upsert_fund_performance', { 
          csv_data: fundData 
        });

        if (fundError) throw fundError;
        results.funds = fundResult;
        totalSuccess += fundResult.inserted + fundResult.updated;
        totalFailed += fundResult.errors;
      }

      // Import benchmark data if available
      if (hasBenchmarks) {
        setUploadProgress({ stage: 'Uploading benchmark performance data...', progress: 60 });
        
        const benchmarkData = benchmarkValidation.data.map(row => ({
          benchmark_ticker: row._normalizedTicker,
          date: pickerDate, // Override with picker date
          ytd_return: dbUtils.parseMetricNumber(row.ytd_return),
          one_year_return: dbUtils.parseMetricNumber(row.one_year_return),
          three_year_return: dbUtils.parseMetricNumber(row.three_year_return),
          five_year_return: dbUtils.parseMetricNumber(row.five_year_return),
          ten_year_return: dbUtils.parseMetricNumber(row.ten_year_return),
          sharpe_ratio: dbUtils.parseMetricNumber(row.sharpe_ratio),
          standard_deviation_3y: dbUtils.parseMetricNumber(row.standard_deviation_3y),
          standard_deviation_5y: dbUtils.parseMetricNumber(row.standard_deviation_5y),
          expense_ratio: dbUtils.parseMetricNumber(row.expense_ratio),
          alpha: dbUtils.parseMetricNumber(row.alpha),
          beta: dbUtils.parseMetricNumber(row.beta),
          up_capture_ratio: dbUtils.parseMetricNumber(row.up_capture_ratio),
          down_capture_ratio: dbUtils.parseMetricNumber(row.down_capture_ratio)
        }));

        const { data: benchResult, error: benchError } = await supabase.rpc('upsert_benchmark_performance', { 
          csv_data: benchmarkData 
        });

        if (benchError) throw benchError;
        results.benchmarks = benchResult;
        totalSuccess += benchResult.inserted + benchResult.updated;
        totalFailed += benchResult.errors;
      }

      setUploadProgress({ stage: 'Logging activity...', progress: 80 });

      // Log activity
      try {
        await supabase.rpc('log_activity', {
          user_info: {
            user_id: null, // Will be populated when auth is implemented
            ip_address: null,
            user_agent: navigator.userAgent
          },
          action: 'csv_upload',
          details: {
            upload_date: pickerDate,
            funds_processed: results.funds?.records_processed || 0,
            benchmarks_processed: results.benchmarks?.records_processed || 0,
            total_success: totalSuccess,
            total_failed: totalFailed,
            files: {
              fund_file: fundFile?.name || null,
              benchmark_file: benchmarkFile?.name || null
            }
          }
        });
      } catch (logError) {
        console.warn('Failed to log activity:', logError);
      }

      setUploadProgress({ stage: 'Finalizing...', progress: 90 });

      // Update active month and sync
      try {
        await asOfStore.syncWithDb();
        asOfStore.setActiveMonth(pickerDate);
        
        const msg = `Upload successful! Processed ${totalSuccess} records. Active month set to ${new Date(pickerDate).toLocaleString('en-US', { month: 'short', year: 'numeric' })}`;
        setToast(msg);
        setTimeout(() => setToast(null), 5000);
      } catch (syncError) {
        console.warn('Failed to sync after upload:', syncError);
      }

      setUploadProgress({ stage: 'Complete', progress: 100 });
      setResult({ 
        success: true, 
        results, 
        totalSuccess, 
        totalFailed, 
        uploadDate: pickerDate 
      });

    } catch (error) {
      console.error('[Import] Error:', error);
      setResult({ 
        success: false, 
        error: error.message || String(error) 
      });
      setUploadProgress({ stage: 'Error', progress: 0 });
    } finally {
      setImporting(false);
      setTimeout(() => setUploadProgress({ stage: '', progress: 0 }), 2000);
    }
  };

  const handleImportClick = () => {
    const hasFunds = fundValidation?.isValid && fundValidation?.data?.length > 0;
    const hasBenchmarks = benchmarkValidation?.isValid && benchmarkValidation?.data?.length > 0;
    
    if (!hasFunds && !hasBenchmarks) return;
    setShowConfirm(true);
  };

  if (!FLAG_ENABLE_IMPORT) {
    return null;
  }

  return (
    <div className="card" style={{ padding: 16, marginTop: 16 }}>
      {/* Enhanced Stepper */}
      <div style={{ display:'flex', gap:8, marginBottom:16, alignItems:'center', flexWrap:'wrap' }}>
        {[
          { idx: 1, label: 'Date & Templates' },
          { idx: 2, label: 'Upload & Validate' },
          { idx: 3, label: 'Import' }
        ].map((s) => {
          const hasValidFund = fundValidation?.isValid;
          const hasValidBenchmark = benchmarkValidation?.isValid;
          const hasAnyValid = hasValidFund || hasValidBenchmark;
          
          const active = (s.idx === 1 && (!month || !year)) || 
                         (s.idx === 2 && month && year && !hasAnyValid) || 
                         (s.idx === 3 && hasAnyValid);
          
          return (
            <div key={s.idx} style={{ display:'flex', alignItems:'center', gap:6 }}>
              <div style={{ 
                width:24, height:24, borderRadius:12, 
                background: active ? '#005EB8' : '#E5E7EB', 
                color: active ? '#fff' : '#374151', 
                display:'flex', alignItems:'center', justifyContent:'center', 
                fontSize:12, fontWeight:600 
              }}>{s.idx}</div>
              <div style={{ fontWeight: active ? 600 : 500, color: active ? '#005EB8' : '#374151' }}>{s.label}</div>
            </div>
          );
        })}
      </div>
      {toast && (
        <div style={{
          marginBottom: 12,
          padding: 10,
          background: '#ecfdf5',
          border: '1px solid #a7f3d0',
          color: '#065f46',
          borderRadius: 6,
          fontSize: 14
        }}>
          {toast}
        </div>
      )}
      
      <h3 style={{ marginTop: 0, marginBottom: 8 }}>Monthly Performance Upload</h3>
      <p style={{ color: '#6b7280', marginTop: 4, marginBottom: 16 }}>
        Upload fund and/or benchmark performance data. Supports dual file upload with enhanced validation.
      </p>

      {/* Progress indicator */}
      {uploadProgress.stage && (
        <div style={{ marginBottom: 16, padding: 12, background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 6 }}>
          <div style={{ fontSize: 14, color: '#0c4a6e', marginBottom: 8 }}>{uploadProgress.stage}</div>
          <div style={{ width: '100%', height: 6, background: '#e0e7ff', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ 
              width: `${uploadProgress.progress}%`, 
              height: '100%', 
              background: '#3b82f6', 
              transition: 'width 0.3s ease' 
            }} />
          </div>
        </div>
      )}

      {/* Step 1: Date & Templates */}
      <div style={{ marginTop: 8, borderTop: '1px solid #e5e7eb', paddingTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 16 }}>1. Date & Templates</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleDownloadFundTemplate} className="btn btn-secondary" style={{ fontSize: 12 }}>
              📊 Fund Template
            </button>
            <button onClick={handleDownloadBenchmarkTemplate} className="btn btn-secondary" style={{ fontSize: 12 }}>
              📈 Benchmark Template
            </button>
          </div>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'auto auto 1fr', gap: 12, alignItems: 'end', marginBottom: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Month *</label>
            <select 
              value={month} 
              onChange={(e) => setMonth(e.target.value)}
              style={{ padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 4 }}
            >
              <option value="">Select month</option>
              {Array.from({ length: 12 }, (_, i) => {
                const monthNum = String(i + 1).padStart(2, '0');
                const monthName = new Date(2000, i, 1).toLocaleString('default', { month: 'long' });
                return <option key={monthNum} value={monthNum}>{monthNum} - {monthName}</option>;
              })}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Year *</label>
            <input 
              value={year} 
              onChange={(e) => setYear(e.target.value)} 
              placeholder="YYYY" 
              style={{ width: 100, padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 4 }} 
            />
          </div>
          <div style={{ color: '#6b7280', fontSize: 12, paddingBottom: 8 }}>
            Upload date: <strong>{computePickerDate() || 'Not set'}</strong>
          </div>
        </div>
      </div>

      {/* Step 2 */}
      <div style={{ marginTop: 8, borderTop: '1px solid #e5e7eb', paddingTop: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 8, display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
          <span>2. Upload & preview</span>
          <details>
            <summary style={{ cursor:'pointer', color:'#1e40af' }}>Required/recommended columns</summary>
            <div style={{ background:'#f8fafc', border:'1px solid #e5e7eb', borderRadius:6, padding:8, marginTop:8, fontSize:12 }}>
              <div style={{ fontWeight:600, marginBottom:4 }}>Minimum</div>
              <ul style={{ margin:0, paddingLeft:16 }}>
                <li>Ticker</li>
                <li>AsOfMonth is optional; Month/Year picker overrides dates</li>
              </ul>
              <div style={{ fontWeight:600, margin:'8px 0 4px' }}>Recommended metrics</div>
              <ul style={{ margin:0, paddingLeft:16 }}>
                <li>YTD, 1 Year, 3 Year, 5 Year (returns %)</li>
                <li>Sharpe Ratio, Standard Deviation 3Y (risk)</li>
                <li>Net Expense Ratio, Manager Tenure</li>
              </ul>
            </div>
          </details>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <button onClick={handleDownloadTemplate} className="btn btn-secondary" title="Download a blank monthly snapshot CSV template">
          Download CSV Template
        </button>
        <button onClick={handleDownloadLegacyTemplate} className="btn btn-link" title="Download legacy CSV template that includes AsOfMonth">
          Legacy template (includes AsOfMonth)
        </button>
        <input type="file" accept=".csv,text/csv" onChange={handleFileChange} />
        <button onClick={parseCsv} disabled={!file || parsing} className="btn btn-primary">
          {parsing ? 'Parsing…' : 'Parse CSV'}
        </button>
        <button
          onClick={async () => {
            await loadSampleData();
          }}
          className="btn btn-secondary"
          title="Load a small sample CSV to try the importer quickly"
        >
          Use sample data
        </button>
        {missingTickers.length > 0 && (
          <button
            onClick={async () => {
              try {
                const toSeed = missingTickers.slice(0);
                if (toSeed.length === 0) return;
                const res = await fundService.upsertMinimalFunds(toSeed);
                console.log(`[Importer] Seeded ${res.count} funds.`);
                // Refresh known tickers
                const fundTickers = await fundService.listFundTickers();
                setKnownTickers(new Set(fundTickers.map((t) => String(t || '').toUpperCase())));
                // Recompute preview after seeding
                setTimeout(() => {
                  // re-trigger effect by nudging parsedRows
                  setParsedRows(prev => prev.slice());
                }, 0);
              } catch (e) {
                console.error('Seeding failed', e);
                alert('Failed to seed missing funds. See console for details.');
              }
            }}
            className="btn btn-secondary"
            title={`Seed ${missingTickers.length} missing funds, then re-parse/import`}
          >
            Seed missing funds ({missingTickers.length})
          </button>
        )}
        </div>

        {/* Drag & drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          style={{
            marginTop: 8,
            padding: '16px',
            border: '2px dashed ' + (isDragging ? '#005EB8' : '#CBD5E1'),
            background: isDragging ? '#EFF6FF' : '#F8FAFC',
            borderRadius: 8,
            color: '#334155',
            textAlign: 'center'
          }}
        >
          Drag & drop a CSV here, or use the file picker above
          {file && (
            <div style={{ marginTop: 6, fontSize: 12, color:'#64748b' }}>Selected: {file.name}</div>
          )}
        </div>
      </div>

      {/* Step 3 */}
      <div style={{ marginTop: 8, borderTop: '1px solid #e5e7eb', paddingTop: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>3. Import</div>
        {preview.length > 0 && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
            <div style={{ background:'#f3f4f6', border:'1px solid #e5e7eb', padding:'2px 6px', borderRadius:12 }}>
              Mode: {mode === 'picker' ? `Picker (${String(month).padStart(2,'0')}/${year})` : 'CSV date'}
            </div>
            {preview.length > 0 && (
              <div style={{ background:'#eef2ff', border:'1px solid #c7d2fe', padding:'2px 6px', borderRadius:12 }}>
                Funds to import: {preview.filter(r => r.willImport && r.kind === 'fund').length}
              </div>
            )}
            {preview.length > 0 && (
              <div style={{ background:'#ecfeff', border:'1px solid #a5f3fc', padding:'2px 6px', borderRadius:12 }}>
                Benchmarks to import: {preview.filter(r => r.kind === 'benchmark').length}
              </div>
            )}
          </div>
        )}
      </div>

      {preview.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
            <div>Parsed: {counts.parsed}</div>
            <div><strong>Funds to import:</strong> {preview.filter(r => r.willImport && r.kind === 'fund').length}</div>
            <div><strong>Benchmarks to import:</strong> {preview.filter(r => r.kind === 'benchmark').length}</div>
            <div>Unknown tickers: {preview.filter(r => !r.willImport && (r.reason||'').toLowerCase().includes('unknown ticker')).length}</div>
            <div title="Rows with non end-of-month AsOfMonth; you can proceed but recommended to fix."><strong>EOM warnings:</strong> {counts.eomWarnings}</div>
            <div><strong>AsOfMonth column detected:</strong> {hasAsOfColumn ? 'Yes' : 'No'}</div>
            <div><strong>Active mode:</strong> {mode === 'picker' ? 'Picker (CSV AsOfMonth ignored)' : 'CSV'}</div>
            <div><strong>AsOfMonth in file:</strong> {monthsInFile.length === 1 ? monthsInFile[0] : monthsInFile.join(', ')}</div>
            <div style={{ color: '#2563eb', textDecoration: 'underline', cursor: 'pointer' }} onClick={() => {
              const el = document.getElementById('skip-reasons-box');
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}>Why skipped?</div>
          </div>
          {/* Header recognition and manual mapping (collapsed by default) */}
          <details style={{ marginBottom: 8 }}>
            <summary style={{ cursor: 'pointer' }}>Header mapping</summary>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
              <div style={{ padding: 8, background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 6 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Recognized headers → column</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb', padding: '4px 6px' }}>Header</th>
                      <th style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb', padding: '4px 6px' }}>Column</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(headerMap.recognizedPairs || []).map(({ header, key }) => (
                      <tr key={header}>
                        <td style={{ padding: '2px 6px' }}>{header}</td>
                        <td style={{ padding: '2px 6px', color: '#1e40af' }}>{key}</td>
                      </tr>
                    ))}
                    {(!headerMap.recognizedPairs || headerMap.recognizedPairs.length === 0) && (
                      <tr><td colSpan={2} style={{ color: '#6b7280', padding: '4px 6px' }}>None</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: 8, background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 6 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Unrecognized headers — map manually</div>
                {(headerMap.unrecognized || []).length === 0 ? (
                  <div style={{ color: '#6b7280', fontSize: 12 }}>None</div>
                ) : (
                  <div style={{ display:'grid', gap:8 }}>
                    {(headerMap.unrecognized || []).map((h) => (
                      <div key={h} style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, alignItems:'center' }}>
                        <span style={{ fontSize: 12, background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', borderRadius: 9999, padding: '2px 6px', justifySelf:'start' }}>{h}</span>
                        <select
                          value={customMap[h] || ''}
                          onChange={(e) => setCustomMap((prev) => ({ ...prev, [h]: e.target.value }))}
                          className="select-field"
                        >
                          <option value="">Ignore</option>
                          {['ytd_return','one_year_return','three_year_return','five_year_return','ten_year_return','sharpe_ratio','standard_deviation','standard_deviation_3y','standard_deviation_5y','expense_ratio','alpha','beta','manager_tenure','up_capture_ratio','down_capture_ratio'].map((k) => (
                            <option key={k} value={k}>{k}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ gridColumn: '1 / -1', padding: 8, background: '#ecfeff', border: '1px solid #a5f3fc', borderRadius: 6 }}>
                <div style={{ fontSize:12, color:'#0c4a6e' }}>Manual mappings are applied during import and override auto-recognized headers.</div>
              </div>
            </div>
          </details>

          {/* Coverage warnings and blockers (collapsed by default) */}
          {(() => {
            const entries = Object.entries(coverage || {});
            const warn = entries.filter(([, v]) => v.total > 0 && v.nonNull / v.total < 0.2);
            const hasBlock = (blockers || []).length > 0;
            const sampleFor = (metricKey) => {
              const aliasesByKey = {
                ytd_return: ['YTD'],
                one_year_return: ['1 Year'],
                three_year_return: ['3 Year'],
                five_year_return: ['5 Year'],
                ten_year_return: ['10 Year'],
                sharpe_ratio: ['Sharpe Ratio'],
                standard_deviation_3y: ['standard_deviation_3y','Standard Deviation 3Y','standard_deviation','Standard Deviation'],
                standard_deviation_5y: ['standard_deviation_5y','Standard Deviation 5Y'],
                expense_ratio: ['Net Expense Ratio'],
                alpha: ['Alpha','alpha_5y'],
                beta: ['Beta','beta_3y'],
                manager_tenure: ['Manager Tenure'],
                up_capture_ratio: ['Up Capture Ratio','up_capture_ratio_3y','Up Capture Ratio (Morningstar Standard) - 3 Year'],
                down_capture_ratio: ['Down Capture Ratio','down_capture_ratio_3y','Down Capture Ratio (Morningstar Standard) - 3 Year']
              };
              const aliases = aliasesByKey[metricKey] || [];
              const vals = [];
              for (const r of parsedRows) {
                const raw = r[metricKey] ?? aliases.reduce((acc, a) => acc ?? r[a], undefined);
                if (raw !== undefined) vals.push(raw);
                if (vals.length >= 3) break;
              }
              return vals;
            };
            return (
              <details style={{ marginBottom: 8 }}>
                <summary style={{ cursor: 'pointer' }}>Warnings & blockers</summary>
                <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                  {warn.length > 0 && (
                    <div style={{ padding: 8, background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', borderRadius: 6 }}>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>Low coverage warnings (&lt; 20%)</div>
                      <ul style={{ margin: 0, paddingLeft: 16 }}>
                        {warn.map(([k, v]) => (
                          <li key={k}>{k}: {(v.nonNull)}/{v.total} ({Math.round((v.nonNull / (v.total || 1)) * 100)}%)</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {hasBlock && (
                    <div style={{ padding: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#7f1d1d', borderRadius: 6 }}>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>Import blocked</div>
                      <div>One or more required metrics would be all null after parsing. Review samples below:</div>
                      <ul style={{ margin: 0, paddingLeft: 16 }}>
                        {blockers.map((b) => (
                          <li key={b.key}>
                            {b.key}: samples {JSON.stringify(sampleFor(b.key))}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </details>
            );
          })()}
          {/* Skipped rows by reason (diagnostic). Note: Benchmarks will be written to benchmark_performance. */}
          <details id="skip-reasons-box" style={{ padding: 8, background: '#f1f5f9', border: '1px solid #e5e7eb', borderRadius: 6, margin: '8px 0' }}>
            <summary style={{ cursor: 'pointer' }}>Why skipped?</summary>
            <div style={{ marginTop: 8 }}>
              {Object.keys(skipReasons || {}).length === 0 ? (
                <div style={{ color: '#6b7280' }}>None</div>
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  {Object.entries(skipReasons).map(([reason, info]) => (
                    <div key={reason} style={{ padding: 6, background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 6 }}>
                      <div><strong>{reason}</strong> — {info.count}</div>
                      {info.tickers?.length > 0 && (
                        <div style={{ marginTop: 4, color: '#1f2937', fontSize: 12 }}>
                          First 10 tickers: {info.tickers.join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </details>
          {counts.eomWarnings > 0 && (
            <div style={{ padding: 8, background: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412', borderRadius: 6, marginBottom: 8 }}>
              Some CSV rows are not end-of-month. The picker will auto-correct to end-of-month.
            </div>
          )}
          <PreviewTable rows={preview} />
          <div style={{ marginTop: 12 }}>
            <button onClick={handleImportClick} disabled={importing || counts.willImport === 0} className="btn btn-primary">
              {importing ? 'Importing…' : 'Import'}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div style={{ marginTop: 12 }}>
          {result.error ? (
            <div style={{ padding: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#7f1d1d', borderRadius: 6 }}>
              <div style={{ marginBottom: 6 }}>Import failed: {result.error}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    try {
                      navigator.clipboard?.writeText(String(result.error));
                    } catch {}
                  }}
                  title="Copy error details"
                >Copy details</button>
              </div>
            </div>
          ) : (
            <div style={{ padding: 8, background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', borderRadius: 6 }}>
              <div style={{ marginBottom: 6 }}>
                Imported: {result.success}, Failed: {result.failed}. AsOfMonth: {result.months?.length === 1 ? result.months[0] : (result.months || []).join(', ')}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  className="btn btn-secondary"
                  onClick={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent('NAVIGATE_APP', { detail: { tab: 'performance' } })); }}
                  title="Go to Funds table"
                >View in Funds</button>
                <button
                  className="btn btn-secondary"
                  onClick={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent('NAVIGATE_APP', { detail: { tab: 'health' } })); }}
                  title="Open Data Health"
                >Open Data Health</button>
              </div>
            </div>
          )}
        </div>
      )}

      {showConfirm && (
        <div className="modal-overlay" onClick={() => setShowConfirm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Confirm Import</h3>
              <button className="btn-close" onClick={() => setShowConfirm(false)} aria-label="Close">×</button>
            </div>
            <div className="modal-body">
              <div style={{ display:'grid', gap:8 }}>
                <div><strong>Funds to import:</strong> {preview.filter(r => r.willImport && r.kind === 'fund').length}</div>
                <div><strong>Benchmarks to import:</strong> {preview.filter(r => r.kind === 'benchmark').length}</div>
                <div><strong>Unknown tickers:</strong> {preview.filter(r => !r.willImport && (r.reason||'').toLowerCase().includes('unknown ticker')).length}</div>
                <div><strong>EOM warnings:</strong> {counts.eomWarnings}</div>
                <div><strong>AsOfMonth:</strong> {computePickerDate() || '(not set)'}</div>
                {monthsInFile.length > 0 && (
                  <div><strong>AsOfMonth in file:</strong> {monthsInFile.length === 1 ? monthsInFile[0] : monthsInFile.join(', ')}</div>
                )}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowConfirm(false)}>Cancel</button>
              <button className="btn" onClick={async () => { setShowConfirm(false); await performImport(); }}>Confirm Import</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

