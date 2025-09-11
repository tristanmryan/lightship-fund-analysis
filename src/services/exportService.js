// src/services/exportService.js
import * as XLSX from 'xlsx';
import { toISODateTime } from '../utils/formatters.js';
import { supabase, TABLES } from './supabase.js';

/**
 * Export Service
 * Handles generation of Excel, CSV, HTML, and image exports
 * (All PDF generation moved to src/services/pdfService.js)
 * Enhanced with visual refresh formatting and improved data presentation
 */

// Enhanced formatting utilities
const ENABLE_VISUAL_REFRESH = (process.env.REACT_APP_ENABLE_VISUAL_REFRESH || 'false') === 'true';

/**
 * Enhanced formatting functions for visual refresh
 */
function formatCurrency(value, options = {}) {
  if (value == null || isNaN(value)) return options.emptyValue || '';
  const { symbol = '$', decimals = 2, includeSymbol = ENABLE_VISUAL_REFRESH } = options;
  const formatted = Number(value).toFixed(decimals);
  return includeSymbol ? `${symbol}${formatted}` : formatted;
}

function formatPercentage(value, options = {}) {
  if (value == null || isNaN(value)) return options.emptyValue || '';
  const { decimals = 2, includeSymbol = ENABLE_VISUAL_REFRESH, multiplier = 1 } = options;
  const adjusted = Number(value) * multiplier;
  const formatted = adjusted.toFixed(decimals);
  return includeSymbol ? `${formatted}%` : formatted;
}

function formatDate(date, options = {}) {
  if (!date) return options.emptyValue || '';
  const { format = 'short', includeTime = false } = options;
  
  try {
    const d = date instanceof Date ? date : new Date(date);
    if (format === 'iso') return d.toISOString();
    if (format === 'short') return d.toLocaleDateString();
    if (format === 'long') return d.toLocaleDateString('en-US', { 
      year: 'numeric', month: 'long', day: 'numeric' 
    });
    if (includeTime) return d.toLocaleString();
    return d.toLocaleDateString();
  } catch {
    return options.emptyValue || '';
  }
}

function enhancedColumnHeader(key, label, options = {}) {
  if (!ENABLE_VISUAL_REFRESH) return label;
  
  const enhancements = {
    expenseRatio: 'Expense Ratio (%)',
    ytdReturn: 'YTD Return (%)',
    oneYearReturn: '1-Year Return (%)',
    threeYearReturn: '3-Year Return (%)',
    fiveYearReturn: '5-Year Return (%)',
    sharpeRatio: 'Sharpe Ratio (3Y)',
    standardDeviation: 'Standard Deviation (%)',
    beta: 'Beta (vs Benchmark)',
    alpha: 'Alpha (vs Benchmark)',
    managerTenure: 'Manager Tenure (Years)'
  };
  
  return enhancements[key] || label;
}

/**
 * Export data to Excel with multiple sheets and enhanced formatting
 * @param {Object} data - Data to export
 * @param {Object} options - Export options including preset info
 * @returns {Blob} Excel file blob
 */
export function exportToExcel(data, options = {}) {
  const {
    funds = []
  } = data;
  
  const {
    selectedPreset = null,
    activeFilters = {},
    visibleColumns = [],
    metadata = {}
  } = options;

  // Create workbook
  const wb = XLSX.utils.book_new();

  // Sheet 1: Enhanced Summary with preset and filter info
  const presetInfo = selectedPreset ? {
    core: '7 essential columns (Symbol, Name, Asset Class, Score, YTD Return, Expense Ratio, Recommended)',
    extended: '12 key columns (Core + 1Y/3Y Returns, Sharpe Ratio, Beta, Sparkline)',
    all: 'All available columns from the dataset'
  }[selectedPreset] || 'Custom column selection' : 'Standard export';

  const filterSummary = Object.entries(activeFilters)
    .filter(([key, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      if (value && typeof value === 'object') return Object.values(value).some(v => v !== '' && v !== 'all');
      return value !== '' && value !== 'all' && value != null;
    })
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : JSON.stringify(value)}`)
    .join('; ');

  const overviewData = [
    ['Raymond James - Lightship Fund Analysis Report'],
    ['Generated:', formatDate(new Date(), { includeTime: true })],
    ['Visual Refresh:', ENABLE_VISUAL_REFRESH ? 'Enabled (Enhanced Formatting)' : 'Disabled'],
    ['As of Date:', metadata.asOf || window.__AS_OF_MONTH__ || 'Latest'],
    [''],
    ['EXPORT CONFIGURATION'],
    ['Column Preset:', selectedPreset ? selectedPreset.toUpperCase() : 'Standard'],
    ['Preset Description:', presetInfo],
    ['Active Filters:', filterSummary || 'None applied'],
    ['Visible Columns:', visibleColumns.length ? visibleColumns.map(c => c.label || c.key).join(', ') : 'All columns'],
    [''],
    ['SUMMARY STATISTICS'],
    ['Total Funds:', funds.length],
    ['Recommended Funds:', funds.filter(f => f.is_recommended).length],
    ['Asset Classes:', new Set(funds.map(f => f.asset_class).filter(Boolean)).size],
    ['Average YTD Return:', formatPercentage(calculateAverage(funds.map(f => f.ytd_return).filter(v => v != null)), { includeSymbol: true, decimals: 2 })],
    ['Average Expense Ratio:', formatPercentage(calculateAverage(funds.map(f => f.expense_ratio).filter(v => v != null)), { includeSymbol: true, decimals: 3 })],
    [''],
    ['ASSET CLASS DISTRIBUTION']
  ];

  // Add asset class summary
  const assetClassSummary = getAssetClassSummary(funds);
  Object.entries(assetClassSummary).forEach(([className, summary]) => {
    overviewData.push([
      className,
      `${summary.fundCount} funds`,
      `Avg YTD: ${summary.averageYTD || 'N/A'}`,
      `Recommended: ${summary.recommendedCount}`
    ]);
  });

  const ws_overview = XLSX.utils.aoa_to_sheet(overviewData);
  XLSX.utils.book_append_sheet(wb, ws_overview, 'Summary');

  // Sheet 2: Enhanced All Funds with improved headers
  const fundHeaders = ENABLE_VISUAL_REFRESH ? [
    'Ticker Symbol',
    'Fund Name',
    'Asset Class',
    'YTD Return (%)',
    '1-Year Return (%)',
    '3-Year Return (%)',
    '5-Year Return (%)',
    'Expense Ratio (%)',
    'Sharpe Ratio (3Y)',
    'Standard Deviation (%)',
    'Alpha (vs Benchmark)',
    'Beta (vs Benchmark)',
    'Manager Tenure (Years)',
    'Recommended Status',
    'Data Last Updated'
  ] : [
    'Ticker',
    'Fund Name',
    'Asset Class',
    'YTD Return',
    '1 Year Return',
    '3 Year Return',
    '5 Year Return',
    'Expense Ratio',
    'Sharpe Ratio',
    'Standard Deviation',
    'Alpha',
    'Beta',
    'Manager Tenure',
    'Is Recommended',
    'Last Updated'
  ];

  const fundRows = funds.map(fund => {
    if (ENABLE_VISUAL_REFRESH) {
      return [
        fund.ticker || '',
        fund.name || '',
        fund.asset_class || 'Unassigned',
        formatPercentage(fund.ytd_return, { includeSymbol: false }), // Keep numeric for Excel
        formatPercentage(fund.one_year_return, { includeSymbol: false }),
        formatPercentage(fund.three_year_return, { includeSymbol: false }),
        formatPercentage(fund.five_year_return, { includeSymbol: false }),
        formatPercentage(fund.expense_ratio, { includeSymbol: false, decimals: 3 }),
        fund.sharpe_ratio != null ? Number(fund.sharpe_ratio).toFixed(2) : '',
        formatPercentage(fund.standard_deviation, { includeSymbol: false }),
        fund.alpha != null ? Number(fund.alpha).toFixed(2) : '',
        fund.beta != null ? Number(fund.beta).toFixed(2) : '',
        fund.manager_tenure != null ? Number(fund.manager_tenure).toFixed(1) : '',
        fund.is_recommended ? 'Recommended' : 'Not Recommended',
        formatDate(fund.last_updated || new Date(), { format: 'short' })
      ];
    } else {
      return [
        fund.ticker,
        fund.name,
        fund.asset_class,
        fund.ytd_return,
        fund.one_year_return,
        fund.three_year_return,
        fund.five_year_return,
        fund.expense_ratio,
        fund.sharpe_ratio,
        fund.standard_deviation,
        fund.alpha,
        fund.beta,
        fund.manager_tenure,
        fund.is_recommended ? 'Yes' : 'No',
        fund.last_updated || new Date().toLocaleDateString()
      ];
    }
  });

  const ws_funds = XLSX.utils.aoa_to_sheet([fundHeaders, ...fundRows]);
  
  // Apply column widths
  ws_funds['!cols'] = [
    { wch: 10 }, // Ticker
    { wch: 40 }, // Fund Name
    { wch: 20 }, // Asset Class
    { wch: 12 }, // YTD Return
    { wch: 12 }, // 1 Year Return
    { wch: 12 }, // 3 Year Return
    { wch: 12 }, // 5 Year Return
    { wch: 12 }, // Expense Ratio
    { wch: 12 }, // Sharpe Ratio
    { wch: 15 }, // Standard Deviation
    { wch: 10 }, // Alpha
    { wch: 10 }, // Beta
    { wch: 15 }, // Manager Tenure
    { wch: 12 }, // Is Recommended
    { wch: 15 }  // Last Updated
  ];

  XLSX.utils.book_append_sheet(wb, ws_funds, 'All Funds');

  // Sheet 3: Recommended Funds Only
  const recommendedFunds = funds.filter(f => f.is_recommended);
  if (recommendedFunds.length > 0) {
    const recommendedRows = recommendedFunds.map(fund => [
      fund.ticker,
      fund.name,
      fund.asset_class,
      fund.ytd_return,
      fund.one_year_return,
      fund.three_year_return,
      fund.five_year_return,
      fund.expense_ratio,
      fund.sharpe_ratio,
      fund.standard_deviation
    ]);

    const ws_recommended = XLSX.utils.aoa_to_sheet([fundHeaders.slice(0, 10), ...recommendedRows]);
    ws_recommended['!cols'] = ws_funds['!cols'].slice(0, 10);
    XLSX.utils.book_append_sheet(wb, ws_recommended, 'Recommended Funds');
  }

  // Sheet 4: Performance Summary by Asset Class
  const performanceData = [
    ['Asset Class', 'Fund Count', 'Avg YTD Return', 'Avg 1Y Return', 'Avg 3Y Return', 'Avg 5Y Return', 'Recommended Count']
  ];

  Object.entries(assetClassSummary).forEach(([className, summary]) => {
    performanceData.push([
      className,
      summary.fundCount,
      summary.averageYTD || 'N/A',
      summary.average1Y || 'N/A',
      summary.average3Y || 'N/A',
      summary.average5Y || 'N/A',
      summary.recommendedCount
    ]);
  });

  const ws_performance = XLSX.utils.aoa_to_sheet(performanceData);
  ws_performance['!cols'] = [
    { wch: 25 }, // Asset Class
    { wch: 12 }, // Fund Count
    { wch: 15 }, // Avg YTD Return
    { wch: 15 }, // Avg 1Y Return
    { wch: 15 }, // Avg 3Y Return
    { wch: 15 }, // Avg 5Y Return
    { wch: 15 }  // Recommended Count
  ];

  XLSX.utils.book_append_sheet(wb, ws_performance, 'Performance Summary');

  // Generate Excel file
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// PDF report-related code has been moved to src/services/pdfService.js

/**
 * Export data to CSV
 * @param {Array} funds - Fund data
 * @returns {Blob} CSV file blob
 */
export function exportToCSV(funds) {
  const headers = [
    'Ticker',
    'Fund Name',
    'Asset Class',
    'YTD Return',
    '1 Year Return',
    '3 Year Return',
    '5 Year Return',
    'Expense Ratio',
    'Sharpe Ratio',
    'Standard Deviation',
    'Is Recommended'
  ];

  const csvData = funds.map(fund => [
    fund.ticker,
    fund.name,
    fund.asset_class,
    fund.ytd_return,
    fund.one_year_return,
    fund.three_year_return,
    fund.five_year_return,
    fund.expense_ratio,
    fund.sharpe_ratio,
    fund.standard_deviation,
    fund.is_recommended ? 'Yes' : 'No'
  ]);

  const csvContent = [headers, ...csvData]
    .map(row => row.map(cell => `"${cell || ''}"`).join(','))
    .join('\n');

  return new Blob([csvContent], { type: 'text/csv' });
}

/**
 * Generate HTML report for preview or email
 * @param {Object} data - Report data
 * @returns {string} HTML string
 */
export function generateHTMLReport(data) {
  const { funds = [] } = data;

  const assetClassSummary = getAssetClassSummary(funds);
  const recommendedCount = funds.filter(f => f.is_recommended).length;
  const avgYTD = calculateAverage(funds.map(f => f.ytd_return).filter(v => v != null));

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Raymond James - Lightship Fund Analysis Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .header {
      background-color: #002f6c;
      color: white;
      padding: 30px;
      border-radius: 8px;
      margin-bottom: 30px;
    }
    .header h1 {
      margin: 0 0 10px 0;
      font-size: 2.5em;
    }
    .header p {
      margin: 0;
      opacity: 0.9;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .summary-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .summary-card h3 {
      margin: 0 0 10px 0;
      color: #002f6c;
      font-size: 0.9em;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .summary-card .value {
      font-size: 2em;
      font-weight: bold;
      color: #111;
    }
    .summary-card .subtitle {
      font-size: 0.9em;
      color: #666;
    }
    .section {
      background: white;
      padding: 30px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .section h2 {
      margin: 0 0 20px 0;
      color: #002f6c;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 10px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #e5e7eb;
    }
    th {
      background-color: #f9fafb;
      font-weight: 600;
      color: #374151;
    }
    tr:hover {
      background-color: #f9fafb;
    }
    .recommended {
      background-color: #fef3c7;
      font-weight: 600;
    }
    .footer {
      text-align: center;
      color: #666;
      font-size: 0.9em;
      margin-top: 40px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Raymond James</h1>
    <p>Lightship Fund Analysis Report - Generated on ${new Date().toLocaleDateString()}</p>
  </div>

  <div class="summary-grid">
    <div class="summary-card">
      <h3>Total Funds</h3>
      <div class="value">${funds.length}</div>
      <div class="subtitle">Funds analyzed</div>
    </div>
    <div class="summary-card">
      <h3>Recommended</h3>
      <div class="value">${recommendedCount}</div>
      <div class="subtitle">Recommended funds</div>
    </div>
    <div class="summary-card">
      <h3>Asset Classes</h3>
      <div class="value">${Object.keys(assetClassSummary).length}</div>
      <div class="subtitle">Different asset classes</div>
    </div>
    <div class="summary-card">
      <h3>Avg YTD Return</h3>
      <div class="value">${avgYTD ? avgYTD.toFixed(2) + '%' : 'N/A'}</div>
      <div class="subtitle">Average year-to-date return</div>
    </div>
  </div>

  <div class="section">
    <h2>Fund Performance Summary</h2>
    <table>
      <thead>
        <tr>
          <th>Ticker</th>
          <th>Fund Name</th>
          <th>Asset Class</th>
          <th>YTD Return</th>
          <th>1Y Return</th>
          <th>3Y Return</th>
          <th>Expense Ratio</th>
          <th>Recommended</th>
        </tr>
      </thead>
      <tbody>
        ${funds.map(fund => `
          <tr class="${fund.is_recommended ? 'recommended' : ''}">
            <td><strong>${fund.ticker}</strong></td>
            <td>${fund.name}</td>
            <td>${fund.asset_class || 'Unassigned'}</td>
            <td>${formatPercent(fund.ytd_return)}</td>
            <td>${formatPercent(fund.one_year_return)}</td>
            <td>${formatPercent(fund.three_year_return)}</td>
            <td>${formatPercent(fund.expense_ratio)}</td>
            <td>${fund.is_recommended ? 'Yes' : 'No'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <div class="footer">
    <p>This report is for internal use only. Generated by Lightship Fund Analysis System.</p>
  </div>
</body>
</html>`;

  return html;
}

/**
 * Capture a DOM element to PNG using html2canvas
 * @param {HTMLElement} node
 * @param {string} filename
 */
export async function exportElementToPNG(node, filename = 'chart.png') {
  if (!node) return;
  const html2canvas = (await import('html2canvas')).default;
  const canvas = await html2canvas(node, { backgroundColor: '#ffffff', scale: 2, useCORS: true });
  const dataUrl = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

/**
 * Copy a DOM element as PNG to clipboard (best-effort)
 * Requires ClipboardItem support and secure context
 * @param {HTMLElement} node
 */
export async function copyElementPNGToClipboard(node) {
  if (!node) return false;
  try {
    const html2canvas = (await import('html2canvas')).default;
    const canvas = await html2canvas(node, { backgroundColor: '#ffffff', scale: 2, useCORS: true });
    return new Promise((resolve, reject) => {
      canvas.toBlob(async (blob) => {
        try {
          if (!blob || !navigator.clipboard || typeof window.ClipboardItem !== 'function') {
            resolve(false);
            return;
          }
          const item = new window.ClipboardItem({ 'image/png': blob });
          await navigator.clipboard.write([item]);
          resolve(true);
        } catch (e) {
          resolve(false);
        }
      }, 'image/png');
    });
  } catch (e) {
    return false;
  }
}

/**
 * Generate a standardized filename for exports
 * Example: lightship_table_20250131_142530.csv or lightship_pdf_all_latest_20250131_142530.pdf
 */
export function formatExportFilename({ scope = 'export', asOf = null, ext = 'csv' }) {
  const pad = (n) => String(n).padStart(2, '0');
  const now = new Date();
  const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const asOfPart = (typeof asOf === 'string' && asOf.trim()) ? asOf.replace(/-/g, '') : 'latest';
  return `lightship_${scope}_${asOfPart}_${ts}.${ext}`;
}

/**
 * Build CSV content string with BOM, CRLF line endings, and all fields quoted
 * Rows is an array of arrays of primitive values (string | number | null | undefined)
 * Returns a string starting with BOM for Excel compatibility
 */
export function buildCSV(rows) {
  const BOM = '\uFEFF';
  const escapeCell = (val) => {
    if (val === null || val === undefined) return '';
    // Ensure raw numerics remain plain (no thousands separators or symbols)
    const str = typeof val === 'number' ? String(val) : String(val);
    // Escape quotes by doubling them
    const escaped = str.replace(/"/g, '""');
    return `"${escaped}"`;
  };
  const content = rows.map(row => row.map(escapeCell).join(',')).join('\r\n');
  return `${BOM}${content}`;
}

/**
 * Export Recommended Funds as CSV
 * Headers: "Ticker","Name","Asset Class","Asset Class ID"
 */
export async function exportRecommendedFundsCSV() {
  const { data: funds } = await supabase
    .from(TABLES.FUNDS)
    .select('ticker,name,asset_class_id,asset_class')
    .eq('is_recommended', true)
    .order('ticker');
  const acIds = Array.from(new Set((funds || []).map(f => f.asset_class_id).filter(Boolean)));
  const acMap = new Map();
  if (acIds.length > 0) {
    const { data: acList } = await supabase
      .from(TABLES.ASSET_CLASSES)
      .select('id,name')
      .in('id', acIds);
    for (const ac of acList || []) acMap.set(ac.id, ac.name);
  }
  const rows = [
    ['Ticker','Name','Asset Class','Asset Class ID'],
    ...((funds || []).map(f => [
      f.ticker || '',
      f.name || '',
      acMap.get(f.asset_class_id) || f.asset_class || '',
      f.asset_class_id || ''
    ]))
  ];
  const csv = buildCSV(rows);
  const filename = formatExportFilename({ scope: 'recommended_funds', ext: 'csv' });
  return downloadBlob(csv, filename);
}

/**
 * Export Asset Class -> Primary Benchmark mapping as CSV
 * Headers: "Asset Class Code","Asset Class Name","Primary Benchmark Ticker"
 */
export async function exportPrimaryBenchmarkMappingCSV() {
  const { data: acs } = await supabase
    .from(TABLES.ASSET_CLASSES)
    .select('id,code,name');
  const { data: maps } = await supabase
    .from(TABLES.ASSET_CLASS_BENCHMARKS)
    .select('asset_class_id,benchmark_id,kind,rank');
  const primaryByAc = new Map();
  for (const m of maps || []) {
    if (m?.kind === 'primary' || m?.rank === 1) primaryByAc.set(m.asset_class_id, m.benchmark_id);
  }
  const bmIds = Array.from(new Set(Array.from(primaryByAc.values()).filter(Boolean)));
  const { data: bms } = await supabase
    .from(TABLES.BENCHMARKS)
    .select('id,ticker');
  const bmTicker = new Map((bms || []).map(b => [b.id, b.ticker]));
  const rows = [
    ['Asset Class Code','Asset Class Name','Primary Benchmark Ticker'],
    ...((acs || []).map(ac => [
      ac.code || '',
      ac.name || '',
      bmTicker.get(primaryByAc.get(ac.id)) || ''
    ]))
  ];
  const csv = buildCSV(rows);
  const filename = formatExportFilename({ scope: 'primary_benchmark_mapping', ext: 'csv' });
  return downloadBlob(csv, filename);
}

function downloadBlob(csvString, filename) {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export the currently visible table as CSV with enhanced formatting.
 * Expect funds to already be sorted in UI order.
 * columns: [{ key, label, isPercent?: boolean, valueGetter: (fund) => any }]
 * sortConfig is used to render a human description only.
 */
export function exportTableCSV({ funds = [], columns = [], sortConfig = [], metadata = {} }) {
  const visibleColumnLabels = columns.map(c => ENABLE_VISUAL_REFRESH ? 
    enhancedColumnHeader(c.key, c.label) : c.label
  );

  // Enhanced metadata with preset and filter information
  const metaRows = [
    ['Lightship Fund Analysis - Table Export'],
    ['Exported at', formatDate(metadata.exportedAt || new Date(), { includeTime: true })],
    ['Visual Refresh', ENABLE_VISUAL_REFRESH ? 'Enabled (Enhanced Formatting)' : 'Disabled'],
    ['Chart period', metadata.chartPeriod || 'Not specified'],
    ['Selected preset', metadata.selectedPreset || 'Standard'],
    ['Active filters', metadata.filterSummary || 'None applied'],
    ['Visible columns', visibleColumnLabels.join(', ')],
    ['Sort order', (sortConfig || []).map(s => `${s.label || s.key} (${s.direction})`).join(', ') || 'Default'],
    ['Row count', funds.length],
    ['As of date', metadata.asOf || window.__AS_OF_MONTH__ || 'Latest'],
    ['Export type', metadata.kind || 'Table data'],
    ['Note', 'Percentage values are displayed as decimals (e.g., 0.1234 = 12.34%)'],
    ['Formatting', ENABLE_VISUAL_REFRESH ? 'Enhanced headers and data presentation' : 'Standard formatting']
  ];

  // Always include Std Dev horizons at the end of the export, even if hidden on screen
  const headerRow = [...visibleColumnLabels, 'Std Dev (3Y)', 'Std Dev (5Y)'];
  const dataRows = funds.map(fund => {
    const row = columns.map(col => {
      const raw = typeof col.valueGetter === 'function' ? col.valueGetter(fund) : null;
      if (raw === null || raw === undefined || raw === '') return '';
      if (typeof raw === 'number') {
        return col.isPercent ? raw / 100 : raw;
      }
      // Attempt to preserve numerics passed as strings
      const asNum = Number(raw);
      if (!Number.isNaN(asNum) && raw !== true && raw !== false && String(raw).trim() !== '') {
        return col.isPercent ? asNum / 100 : asNum;
      }
      return String(raw);
    });
    // Append std dev horizons
    const s3 = fund.standard_deviation_3y;
    const s5 = fund.standard_deviation_5y;
    row.push(s3 == null ? '' : s3 / 100);
    row.push(s5 == null ? '' : s5 / 100);
    return row;
  });

  const rows = [...metaRows, [''], headerRow, ...dataRows];
  const csv = buildCSV(rows);
  return new Blob([csv], { type: 'text/csv;charset=utf-8' });
}

/**
 * Export the compare selection as CSV.
 * Enhanced version supporting mixed fund/benchmark selection and multiple delta calculations
 * funds: array of fund-like objects from get_compare_dataset RPC
 */
export function exportCompareCSV({ funds = [], metadata = {} }) {
  const headers = [
    'Ticker', 'Name', 'Type', 'Asset Class', 'Score', 'Percentile',
    'YTD Return (%)', '1Y Return (%)', '3Y Return (%)', '5Y Return (%)', '10Y Return (%)',
    'Sharpe Ratio', 'Expense Ratio (%)', 'Alpha', 'Beta', 
    'Std Dev 3Y (%)', 'Std Dev 5Y (%)',
    'Up Capture (%)', 'Down Capture (%)', 'Manager Tenure',
    'YTD vs Benchmark (%)', '1Y vs Benchmark (%)', '3Y vs Benchmark (%)', '5Y vs Benchmark (%)',
    'Benchmark Ticker', 'Benchmark Name', 'Peer Count'
  ];

  const percentKeys = new Set([
    'YTD Return (%)', '1Y Return (%)', '3Y Return (%)', '5Y Return (%)', '10Y Return (%)',
    'Expense Ratio (%)', 'Std Dev 3Y (%)', 'Std Dev 5Y (%)', 'Up Capture (%)', 'Down Capture (%)',
    'YTD vs Benchmark (%)', '1Y vs Benchmark (%)', '3Y vs Benchmark (%)', '5Y vs Benchmark (%)'
  ]);

  const get = (f, ...alts) => {
    for (const k of alts) {
      const v = f?.[k];
      if (v !== undefined) return v;
    }
    return undefined;
  };

  const metaRows = [
    ['Fund Comparison Report'],
    ['Exported at', toISODateTime(metadata.exportedAt || new Date())],
    ['Selected items count', funds.length],
    ['As of date', metadata.asOfDate || 'Latest'],
    ['Benchmark comparison', metadata.benchmarkTicker || 'Asset class primary']
  ];

  const dataRows = funds.map(f => {
    const rowMap = {
      'Ticker': get(f, 'ticker', 'Symbol', 'symbol') || '',
      'Name': get(f, 'name', 'Fund Name') || '',
      'Type': f.is_benchmark ? 'Benchmark' : 'Fund',
      'Asset Class': get(f, 'asset_class', 'asset_class_name', 'Asset Class') || '',
      'Score': !f.is_benchmark ? get(f, 'score_final', 'scores')?.final ?? get(f, 'score') : '',
      'Percentile': !f.is_benchmark ? get(f, 'percentile') : '',
      'YTD Return (%)': get(f, 'ytd_return'),
      '1Y Return (%)': get(f, 'one_year_return', 'Total Return - 1 Year (%)'),
      '3Y Return (%)': get(f, 'three_year_return', 'Annualized Total Return - 3 Year (%)'),
      '5Y Return (%)': get(f, 'five_year_return', 'Annualized Total Return - 5 Year (%)'),
      '10Y Return (%)': get(f, 'ten_year_return'),
      'Sharpe Ratio': get(f, 'sharpe_ratio', 'Sharpe Ratio - 3 Year'),
      'Expense Ratio (%)': get(f, 'expense_ratio', 'Net Exp Ratio (%)'),
      'Alpha': get(f, 'alpha'),
      'Beta': get(f, 'beta', 'Beta - 5 Year'),
      'Std Dev 3Y (%)': get(f, 'standard_deviation_3y'),
      'Std Dev 5Y (%)': get(f, 'standard_deviation_5y'),
      'Up Capture (%)': get(f, 'up_capture_ratio', 'Up Capture Ratio (Morningstar Standard) - 3 Year'),
      'Down Capture (%)': get(f, 'down_capture_ratio', 'Down Capture Ratio (Morningstar Standard) - 3 Year'),
      'Manager Tenure': get(f, 'manager_tenure'),
      'YTD vs Benchmark (%)': !f.is_benchmark ? get(f, 'delta_ytd') : '',
      '1Y vs Benchmark (%)': !f.is_benchmark ? get(f, 'delta_1y', 'exportDelta1y') : '',
      '3Y vs Benchmark (%)': !f.is_benchmark ? get(f, 'delta_3y') : '',
      '5Y vs Benchmark (%)': !f.is_benchmark ? get(f, 'delta_5y') : '',
      'Benchmark Ticker': get(f, 'benchmark_ticker', 'exportBenchTicker'),
      'Benchmark Name': get(f, 'benchmark_name', 'exportBenchName'),
      'Peer Count': get(f, 'peer_count')
    };

    return headers.map(h => {
      const raw = rowMap[h];
      if (raw === null || raw === undefined || raw === '') return '';
      if (typeof raw === 'number') return percentKeys.has(h) ? raw / 100 : raw;
      const asNum = Number(raw);
      if (!Number.isNaN(asNum) && String(raw).trim() !== '') return percentKeys.has(h) ? asNum / 100 : asNum;
      return String(raw);
    });
  });

  const rows = [
    ...metaRows,
    [''],
    headers,
    ...dataRows
  ];
  const csv = buildCSV(rows);
  return new Blob([csv], { type: 'text/csv;charset=utf-8' });
}

/**
 * Export compare data as PDF report
 * Enhanced for mixed fund/benchmark comparison with professional formatting
 */
// exportComparePDF removed in minimal system

/**
 * Helper to centralize large export confirmation threshold
 */
export function shouldConfirmLargeExport(rowCount) {
  return Number(rowCount) > 50000;
}

/**
 * Download file with proper filename
 * @param {Blob|string} content - File content
 * @param {string} filename - Filename
 * @param {string} type - MIME type
 */
export function downloadFile(content, filename, type = 'application/octet-stream') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Download PDF with support for both v1 (jsPDF) and v2 (Blob) formats
 * @param {jsPDF|Blob} pdfResult - PDF result from either legacy or v2 system
 * @param {string} filename - File name
 */
// (downloadPDF moved to pdfService.js)

// --- Advisor Portfolio Exports (Phase 2) ---

export function exportAdvisorPortfolioCSV({ snapshotDate, advisorId, summary = {}, portfolio = {} }) {
  const rows = [];
  rows.push([`Advisor Portfolio Export`]);
  rows.push([`Snapshot Date`, snapshotDate || '']);
  rows.push([`Advisor ID`, advisorId || '']);
  rows.push([`Clients`, summary?.client_count ?? '']);
  rows.push([`Unique Holdings`, portfolio?.uniqueHoldings ?? '']);
  rows.push([`Total AUM (USD)`, Number(portfolio?.totalAum || 0)]);
  const adoption = (portfolio?.totalAum || 0) > 0 ? (portfolio?.recommendedAum || 0) / (portfolio.totalAum || 1) : 0;
  rows.push([`% In Recommended`, Number((adoption * 100).toFixed(2))]);
  rows.push(['']);

  // Allocation section
  rows.push([`Allocation by Asset Class`]);
  rows.push(['Asset Class', 'Amount (USD)', '% of AUM']);
  (portfolio?.allocation || []).forEach(a => {
    rows.push([
      a.asset_class || 'Unclassified',
      Number(a.amount || 0),
      Number(((a.pct || 0) * 100).toFixed(2))
    ]);
  });

  rows.push(['']);
  rows.push([`Top Positions`]);
  rows.push(['Ticker', 'Amount (USD)', '% of AUM', 'Recommended']);
  (portfolio?.positions || []).forEach(p => {
    rows.push([
      p.ticker || '',
      Number(p.amount || 0),
      Number(((p.pct || 0) * 100).toFixed(2)),
      p.is_recommended ? 'Yes' : 'No'
    ]);
  });

  const csv = buildCSV(rows);
  return new Blob([csv], { type: 'text/csv;charset=utf-8' });
}

// (generateAdvisorPortfolioPDF moved to pdfService.js)

// Export current fund utilization view to CSV
export function exportUtilizationCSV({ snapshotDate, assetClass = null, rows = [] }) {
  const header = ['Ticker', 'Asset Class', 'Total AUM (USD)', 'Advisors Using', 'Clients Using', 'Avg Position (USD)'];
  const body = (rows || []).map(r => [
    r.ticker || '',
    r.asset_class || '',
    Number(r.total_aum || 0),
    Number(r.advisors_using || 0),
    Number(r.clients_using || 0),
    Number(r.avg_position_usd || 0)
  ]);
  const csv = buildCSV([header, ...body]);
  return new Blob([csv], { type: 'text/csv;charset=utf-8' });
}

/**
 * Export Trade Flows CSV
 */
export function exportTradeFlowsCSV({ month, assetClass = null, ticker = null, topInflows = [], topOutflows = [], heatmap = [], trend = [], sentiment = {} }) {
  const metaRows = [
    ['Lightship - Trade Flow Dashboard Export'],
    ['Generated:', (new Date()).toISOString()],
    ['Month:', month || 'Latest'],
    ['Asset Class Filter:', assetClass || 'All'],
    ['Ticker Filter:', ticker || 'None'],
    []
  ];

  const section = (title) => [[title], []];

  const trendRows = [
    ['Month', 'Net Flow (USD)'],
    ...((trend || []).map(r => [r.month, Number(r.net_flow || 0)]))
  ];

  const sentimentRows = [
    ['Sentiment'],
    ['Advisors Buying', Number(sentiment.advisors_buying || 0)],
    ['Advisors Selling', Number(sentiment.advisors_selling || 0)],
    ['Advisors Neutral', Number(sentiment.advisors_neutral || 0)],
    ['Advisors Total', Number(sentiment.advisors_total || 0)]
  ];

  const hasDeltaIn = (topInflows || []).some(r => Object.prototype.hasOwnProperty.call(r || {}, 'delta_net'));
  const inflowRows = [
    ['Top Inflows'],
    hasDeltaIn ? ['Ticker','Inflows','Outflows','Net','Delta Net vs Prior','Advisors'] : ['Ticker','Inflows','Outflows','Net','Advisors'],
    ...((topInflows || []).map(r => hasDeltaIn ? [r.ticker, Number(r.inflows||0), Number(r.outflows||0), Number(r.net_flow||0), Number(r.delta_net||0), Number(r.advisors_trading||0)] : [r.ticker, Number(r.inflows||0), Number(r.outflows||0), Number(r.net_flow||0), Number(r.advisors_trading||0)]))
  ];
  const hasDeltaOut = (topOutflows || []).some(r => Object.prototype.hasOwnProperty.call(r || {}, 'delta_net'));
  const outflowRows = [
    ['Top Outflows'],
    hasDeltaOut ? ['Ticker','Inflows','Outflows','Net','Delta Net vs Prior','Advisors'] : ['Ticker','Inflows','Outflows','Net','Advisors'],
    ...((topOutflows || []).map(r => hasDeltaOut ? [r.ticker, Number(r.inflows||0), Number(r.outflows||0), Number(r.net_flow||0), Number(r.delta_net||0), Number(r.advisors_trading||0)] : [r.ticker, Number(r.inflows||0), Number(r.outflows||0), Number(r.net_flow||0), Number(r.advisors_trading||0)]))
  ];

  const heatmapRows = [
    ['Asset Class Heatmap'],
    ['Asset Class', 'Inflows', 'Outflows', 'Net', 'Funds Traded', 'Advisors Trading (sum)'],
    ...((heatmap || []).map(r => [r.asset_class, Number(r.inflows || 0), Number(r.outflows || 0), Number(r.net_flow || 0), Number(r.funds_traded || 0), Number(r.advisors_trading || 0)]))
  ];

  const rows = [
    ...metaRows,
    ...section('Net Flow Trend'),
    ...trendRows,
    ...section('Advisor Participation'),
    ...sentimentRows,
    ...section('Top Movers - Inflows'),
    ...inflowRows,
    ...section('Top Movers - Outflows'),
    ...outflowRows,
    ...section('Flow Heatmap by Asset Class'),
    ...heatmapRows
  ];
  const csv = buildCSV(rows);
  return new Blob([csv], { type: 'text/csv;charset=utf-8' });
}

export function exportTickerAdvisorBreakdownCSV({ ticker, rows = [] }) {
  const header = ['Advisor', 'Buy Trades', 'Sell Trades', 'Net Principal (USD)'];
  const body = (rows || []).map(r => [
    r.advisor_id || '',
    Number(r.buy_trades || 0),
    Number(r.sell_trades || 0),
    Number(r.net_principal || 0)
  ]);
  const csv = buildCSV([['Advisor Breakdown', ticker || ''], [], header, ...body]);
  return new Blob([csv], { type: 'text/csv;charset=utf-8' });
}

// (generateTradeFlowsPDF moved to pdfService.js)

// Excel export for Advisor Portfolio
export function exportAdvisorPortfolioExcel({ snapshotDate, advisorId, summary = {}, portfolio = {} }) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Summary
  const adoption = (portfolio?.totalAum || 0) > 0 ? (portfolio?.recommendedAum || 0) / (portfolio.totalAum || 1) : 0;
  const summaryRows = [
    ['Advisor Portfolio Summary'],
    ['Snapshot Date', snapshotDate || ''],
    ['Advisor ID', advisorId || ''],
    ['Clients', summary?.client_count ?? ''],
    ['Unique Holdings', portfolio?.uniqueHoldings ?? ''],
    ['Total AUM (USD)', Number(portfolio?.totalAum || 0)],
    ['% In Recommended', Number((adoption * 100).toFixed(2))]
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  // Sheet 2: Allocation
  const allocRows = [['Asset Class', 'Amount (USD)', '% of AUM']];
  (portfolio?.allocation || []).forEach(a => {
    allocRows.push([
      a.asset_class || 'Unclassified',
      Number(a.amount || 0),
      Number(((a.pct || 0) * 100).toFixed(2))
    ]);
  });
  const wsAlloc = XLSX.utils.aoa_to_sheet(allocRows);
  XLSX.utils.book_append_sheet(wb, wsAlloc, 'Allocation');

  // Sheet 3: Positions
  const posRows = [['Ticker', 'Amount (USD)', '% of AUM', 'Recommended']];
  (portfolio?.positions || []).forEach(p => {
    posRows.push([
      p.ticker || '',
      Number(p.amount || 0),
      Number(((p.pct || 0) * 100).toFixed(2)),
      p.is_recommended ? 'Yes' : 'No'
    ]);
  });
  const wsPos = XLSX.utils.aoa_to_sheet(posRows);
  XLSX.utils.book_append_sheet(wb, wsPos, 'Positions');

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/**
 * Calculate average of numbers
 * @param {Array} numbers - Array of numbers
 * @returns {number|null} Average or null if no valid numbers
 */
function calculateAverage(numbers) {
  const validNumbers = numbers.filter(n => n != null && !isNaN(n));
  if (validNumbers.length === 0) return null;
  return validNumbers.reduce((sum, num) => sum + num, 0) / validNumbers.length;
}

/**
 * Get asset class summary
 * @param {Array} funds - Fund data
 * @returns {Object} Asset class summary
 */
function getAssetClassSummary(funds) {
  const summary = {};
  
  funds.forEach(fund => {
    const assetClass = fund.asset_class || 'Unassigned';
    if (!summary[assetClass]) {
      summary[assetClass] = {
        fundCount: 0,
        recommendedCount: 0,
        ytdReturns: [],
        oneYearReturns: [],
        threeYearReturns: [],
        fiveYearReturns: []
      };
    }
    
    summary[assetClass].fundCount++;
    if (fund.is_recommended) {
      summary[assetClass].recommendedCount++;
    }
    
    if (fund.ytd_return != null) summary[assetClass].ytdReturns.push(fund.ytd_return);
    if (fund.one_year_return != null) summary[assetClass].oneYearReturns.push(fund.one_year_return);
    if (fund.three_year_return != null) summary[assetClass].threeYearReturns.push(fund.three_year_return);
    if (fund.five_year_return != null) summary[assetClass].fiveYearReturns.push(fund.five_year_return);
  });
  
  // Calculate averages
  Object.keys(summary).forEach(assetClass => {
    const data = summary[assetClass];
    data.averageYTD = calculateAverage(data.ytdReturns);
    data.average1Y = calculateAverage(data.oneYearReturns);
    data.average3Y = calculateAverage(data.threeYearReturns);
    data.average5Y = calculateAverage(data.fiveYearReturns);
  });
  
  return summary;
}

/**
 * Export Asset Class table data to CSV
 * @param {Array} data - Asset class table data (funds + benchmark)
 * @param {string} assetClassName - Name of the asset class
 * @param {string} asOfDate - As of date for the data
 */
export function exportAssetClassTableCSV(data, assetClassName = 'Asset Class', asOfDate = null) {
  try {
    if (!data || !Array.isArray(data) || data.length === 0) {
      throw new Error('No data available to export');
    }

    // CSV headers
    const headers = [
      'Ticker',
      'Name',
      'Type',
      'Score',
      'Percentile',
      'YTD Return (%)',
      '1Y Return (%)',
      '3Y Return (%)',
      '5Y Return (%)',
      '10Y Return (%)',
      'Sharpe Ratio',
      'Std Dev 3Y (%)',
      'Std Dev 5Y (%)',
      'Expense Ratio (%)',
      'Alpha',
      'Beta',
      'Up Capture (%)',
      'Down Capture (%)',
      'Manager Tenure',
      'Recommended'
    ];

    // Convert data to CSV rows
    const csvRows = data.map(row => [
      row.ticker || '',
      row.name || '',
      row.is_benchmark ? 'Benchmark' : 'Fund',
      row.score_final != null && !row.is_benchmark ? row.score_final.toFixed(1) : '',
      row.percentile != null && !row.is_benchmark ? row.percentile : '',
      formatPercentForCSV(row.ytd_return),
      formatPercentForCSV(row.one_year_return),
      formatPercentForCSV(row.three_year_return),
      formatPercentForCSV(row.five_year_return),
      formatPercentForCSV(row.ten_year_return),
      formatNumberForCSV(row.sharpe_ratio),
      formatPercentForCSV(row.standard_deviation_3y),
      formatPercentForCSV(row.standard_deviation_5y),
      formatPercentForCSV(row.expense_ratio),
      formatNumberForCSV(row.alpha),
      formatNumberForCSV(row.beta),
      formatPercentForCSV(row.up_capture_ratio),
      formatPercentForCSV(row.down_capture_ratio),
      formatNumberForCSV(row.manager_tenure),
      row.is_recommended && !row.is_benchmark ? 'Yes' : 'No'
    ]);

    // Create CSV content
    const csvContent = [
      // Title row
      [`${assetClassName} Performance Report`],
      [`Generated: ${new Date().toLocaleString()}`],
      [`As of: ${asOfDate || 'Latest'}`],
      [], // Empty row
      headers,
      ...csvRows
    ].map(row => row.map(cell => 
      // Escape quotes and wrap in quotes if contains comma or quote
      typeof cell === 'string' && (cell.includes(',') || cell.includes('"')) 
        ? `"${cell.replace(/"/g, '""')}"` 
        : cell
    ).join(',')).join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const filename = `${assetClassName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
    downloadFile(blob, filename);

  } catch (error) {
    console.error('Error exporting asset class table CSV:', error);
    throw new Error('Failed to export CSV data');
  }
}

/**
 * Format number for CSV export (return empty string for null/undefined)
 */
function formatNumberForCSV(value, decimals = 2) {
  if (value == null || isNaN(value)) return '';
  return Number(value).toFixed(decimals);
}

/**
 * Format percentage for CSV export (return empty string for null/undefined)
 */
function formatPercentForCSV(value, decimals = 2) {
  if (value == null || isNaN(value)) return '';
  return Number(value).toFixed(decimals);
}

/**
 * Export NotesPanel filtered/searched data to CSV
 * @param {Object} options - Export options
 * @param {Array} options.notes - Filtered notes data
 * @param {string} options.fundTicker - Fund ticker
 * @param {string} options.searchTerm - Applied search term
 * @param {string} options.selectedPriority - Applied priority filter
 * @param {Object} options.metadata - Export metadata
 * @returns {Blob} CSV blob
 */
export function exportNotesCSV({ notes = [], fundTicker = '', searchTerm = '', selectedPriority = 'all', metadata = {} }) {
  const headers = [
    'Created Date',
    'Fund Ticker',
    'Decision',
    'Priority',
    'Note Content',
    'Created By',
    'Override Linked',
    'Character Count'
  ];

  // Enhanced metadata rows
  const metaRows = [
    ['Research Notes Export'],
    ['Generated:', formatDate(new Date(), { includeTime: true })],
    ['Fund Ticker:', fundTicker || 'All Funds'],
    ['Total Notes:', notes.length],
    ['Search Term:', searchTerm || 'None'],
    ['Priority Filter:', selectedPriority === 'all' ? 'All Priorities' : `${selectedPriority} priority`],
    ['Export Type:', metadata.exportType || 'Filtered Notes'],
    ['Feature Flags:', `Visual Refresh: ${ENABLE_VISUAL_REFRESH ? 'Enabled' : 'Disabled'}`],
    [] // Empty row
  ];

  // Convert notes to CSV rows with enhanced formatting
  const dataRows = notes.map(note => {
    const priority = getPriorityFromDecision(note.decision || '');
    return [
      formatDate(note.created_at, { format: 'long' }),
      fundTicker || note.fund_ticker || '',
      note.decision ? `${getDecisionSymbol(note.decision)} ${note.decision}` : '',
      `${priority.toUpperCase()} PRIORITY`,
      (note.body || '').replace(/[\r\n]+/g, ' ').trim(), // Clean line breaks
      note.created_by || '',
      note.override_id ? 'Yes' : 'No',
      (note.body || '').length
    ];
  });

  const rows = [...metaRows, headers, ...dataRows];
  const csv = buildCSV(rows);
  return new Blob([csv], { type: 'text/csv;charset=utf-8' });
}

/**
 * Export Current View with preset and filter information
 * @param {Object} options - Export options
 * @returns {Blob} Enhanced CSV with current view state
 */
export function exportCurrentView(options = {}) {
  const {
    funds = [],
    columns = [],
    sortConfig = [],
    selectedPreset = 'core',
    activeFilters = {},
    metadata = {}
  } = options;

  // Enhanced metadata with preset and filter info
  const presetInfo = {
    core: '7 essential columns',
    extended: '12 key columns', 
    all: 'All available columns'
  };

  const filterSummary = Object.entries(activeFilters)
    .filter(([key, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      if (value && typeof value === 'object') return Object.values(value).some(v => v !== '' && v !== 'all');
      return value !== '' && value !== 'all' && value != null;
    })
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join(', ');

  const enhancedMetaRows = [
    ['Lightship Fund Analysis - Current View Export'],
    ['Generated:', formatDate(new Date(), { includeTime: true })],
    ['Visual Refresh:', ENABLE_VISUAL_REFRESH ? 'Enabled' : 'Disabled'],
    [''],
    ['VIEW CONFIGURATION'],
    ['Selected Preset:', `${selectedPreset.toUpperCase()} (${presetInfo[selectedPreset] || 'Custom'})`],
    ['Visible Columns:', columns.map(c => enhancedColumnHeader(c.key, c.label)).join(', ')],
    ['Applied Filters:', filterSummary || 'None'],
    ['Sort Order:', (sortConfig || []).map(s => `${s.label || s.key} (${s.direction})`).join(', ') || 'Default'],
    ['Total Rows:', funds.length],
    ['As of Date:', metadata.asOf || window.__AS_OF_MONTH__ || 'Latest'],
    [''],
    ['EXPORT DETAILS'],
    ['Data Structure:', 'Same as standard export with enhanced formatting'],
    ['Percentage Values:', 'Displayed as decimals (e.g., 0.1234 = 12.34%)'],
    ['Currency Values:', ENABLE_VISUAL_REFRESH ? 'Include symbols when applicable' : 'Numeric only'],
    ['Date Format:', 'ISO standard for data integrity'],
    ['']
  ];

  // Enhanced headers with visual refresh formatting
  const enhancedHeaders = columns.map(col => 
    enhancedColumnHeader(col.key, col.label, { preset: selectedPreset })
  );

  // Enhanced data formatting
  const enhancedDataRows = funds.map(fund => {
    return columns.map(col => {
      const rawValue = typeof col.valueGetter === 'function' ? col.valueGetter(fund) : null;
      
      if (rawValue === null || rawValue === undefined || rawValue === '') return '';
      
      // Apply enhanced formatting based on column type
      const percentColumns = ['ytdReturn', 'oneYearReturn', 'threeYearReturn', 'fiveYearReturn', 'expenseRatio', 'standardDeviation'];
      const currencyColumns = ['expenseRatio']; // Expense ratios can be treated as currency in some contexts
      
      if (percentColumns.includes(col.key)) {
        return formatPercentage(rawValue, { 
          includeSymbol: false, // Keep numeric for CSV compatibility
          multiplier: col.isPercent ? 1 : 100 
        });
      }
      
      if (typeof rawValue === 'number') {
        return rawValue;
      }
      
      return String(rawValue);
    });
  });

  const rows = [...enhancedMetaRows, enhancedHeaders, ...enhancedDataRows];
  const csv = buildCSV(rows);
  return new Blob([csv], { type: 'text/csv;charset=utf-8' });
}

// Helper functions for notes export
function getPriorityFromDecision(decision) {
  switch (decision) {
    case 'reject': return 'high';
    case 'monitor': return 'medium';
    case 'approve': 
    case 'hold': return 'low';
    default: return 'medium';
  }
}

function getDecisionSymbol(decision) {
  const symbols = {
    approve: 'Approve',
    reject: 'Reject',
    monitor: 'Monitor',
    hold: 'Hold'
  };
  return ENABLE_VISUAL_REFRESH ? (symbols[decision] || '') : '';
}

/**
 * Format percentage for display
 * @param {number} value - Percentage value
 * @returns {string} Formatted percentage
 */
function formatPercent(value) {
  if (value === null || value === undefined || isNaN(value)) {
    return 'N/A';
  }
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
}







