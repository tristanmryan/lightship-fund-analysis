// src/services/exportService.js
import * as XLSX from 'xlsx';
import { toISODateTime } from '../utils/formatters';
import { supabase, TABLES } from './supabase';
// Avoid importing jsPDF/pdf generation in test/node by lazy-loading pdfReportService inside the function

/**
 * Export Service
 * Handles generation of Excel, PDF, and other report formats for the API-driven approach
 */

/**
 * Export data to Excel with multiple sheets
 * @param {Object} data - Data to export
 * @returns {Blob} Excel file blob
 */
export function exportToExcel(data) {
  const {
    funds = []
  } = data;

  // Create workbook
  const wb = XLSX.utils.book_new();

  // Sheet 1: Overview
  const overviewData = [
    ['Raymond James - Lightship Fund Analysis Report'],
    ['Generated:', new Date().toLocaleString()],
    [''],
    ['Summary Statistics'],
    ['Total Funds:', funds.length],
    ['Recommended Funds:', funds.filter(f => f.is_recommended).length],
    ['Asset Classes:', new Set(funds.map(f => f.asset_class).filter(Boolean)).size],
    ['Average YTD Return:', calculateAverage(funds.map(f => f.ytd_return).filter(v => v != null))],
    [''],
    ['Asset Class Distribution']
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
  XLSX.utils.book_append_sheet(wb, ws_overview, 'Overview');

  // Sheet 2: All Funds
  const fundHeaders = [
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

  const fundRows = funds.map(fund => [
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
  ]);

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

/**
 * Generate PDF report
 * @param {Object} data - Report data
 * @returns {jsPDF} PDF document
 */
export function generatePDFReport(data) {
  const { funds, metadata } = data;
  
  // Prepare metadata for PDF
  const pdfMetadata = {
    ...metadata,
    date: metadata?.date || new Date().toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    }),
    totalFunds: funds.length,
    recommendedFunds: funds.filter(f => f.is_recommended).length,
    assetClassCount: new Set(funds.map(f => f.asset_class).filter(Boolean)).size,
    averagePerformance: calculateAverage(funds.map(f => f.ytd_return).filter(v => v != null))
  };

  // Lazy require to prevent jsdom canvas errors during tests
  // eslint-disable-next-line global-require
  const { generateMonthlyReport } = require('./pdfReportService');
  return generateMonthlyReport({ funds, metadata: pdfMetadata });
}

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
 * Export the currently visible table as CSV.
 * Expect funds to already be sorted in UI order.
 * columns: [{ key, label, isPercent?: boolean, valueGetter: (fund) => any }]
 * sortConfig is used to render a human description only.
 */
export function exportTableCSV({ funds = [], columns = [], sortConfig = [], metadata = {} }) {
  const visibleColumnLabels = columns.map(c => c.label);

  const metaRows = [
    ['Exported at', toISODateTime(metadata.exportedAt || new Date())],
    ['Chart period', metadata.chartPeriod || ''],
    ['Visible columns', visibleColumnLabels.join(', ')],
    ['Sort description', (sortConfig || []).map(s => `${s.label || s.key} (${s.direction})`).join(', ')],
    ['Row count', funds.length],
    ['Note', 'Percent columns are decimals (e.g., 0.1234 = 12.34%).']
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
 * funds: array of fund-like objects; may include precomputed fields:
 *   exportDelta1y, exportBenchTicker, exportBenchName
 */
export function exportCompareCSV({ funds = [], metadata = {} }) {
  const headers = [
    'Ticker', 'Name', 'Asset Class', 'Score',
    'YTD', '1Y', '3Y', '5Y',
    'Sharpe', 'Expense Ratio', 'Beta', 'Std Dev (3Y)', 'Std Dev (5Y)',
    'Up Capture (3Y)', 'Down Capture (3Y)',
    '1Y vs Benchmark (delta)', 'Benchmark Ticker', 'Benchmark Name'
  ];

  const percentKeys = new Set(['YTD', '1Y', '3Y', '5Y', 'Expense Ratio', 'Up Capture (3Y)', 'Down Capture (3Y)', '1Y vs Benchmark (delta)']);

  const get = (f, ...alts) => {
    for (const k of alts) {
      const v = f?.[k];
      if (v !== undefined) return v;
    }
    return undefined;
  };

  const metaRows = [
    ['Exported at', toISODateTime(metadata.exportedAt || new Date())],
    ['Selected fund count', funds.length]
  ];

  const dataRows = funds.map(f => {
    const rowMap = {
      'Ticker': get(f, 'Symbol', 'ticker', 'symbol') || '',
      'Name': get(f, 'Fund Name', 'name') || '',
      'Asset Class': get(f, 'asset_class_name', 'asset_class', 'Asset Class') || '',
      'Score': get(f, 'scores')?.final ?? get(f, 'score') ?? '',
      'YTD': get(f, 'ytd_return'),
      '1Y': get(f, 'one_year_return', 'Total Return - 1 Year (%)'),
      '3Y': get(f, 'three_year_return', 'Annualized Total Return - 3 Year (%)'),
      '5Y': get(f, 'five_year_return', 'Annualized Total Return - 5 Year (%)'),
      'Sharpe': get(f, 'sharpe_ratio', 'Sharpe Ratio - 3 Year'),
      'Expense Ratio': get(f, 'expense_ratio', 'Net Exp Ratio (%)'),
      'Beta': get(f, 'beta', 'Beta - 5 Year'),
      'Std Dev (3Y)': get(f, 'standard_deviation_3y'),
      'Std Dev (5Y)': get(f, 'standard_deviation_5y'),
      'Up Capture (3Y)': get(f, 'up_capture_ratio', 'Up Capture Ratio (Morningstar Standard) - 3 Year'),
      'Down Capture (3Y)': get(f, 'down_capture_ratio', 'Down Capture Ratio (Morningstar Standard) - 3 Year'),
      '1Y vs Benchmark (delta)': get(f, 'exportDelta1y'),
      'Benchmark Ticker': get(f, 'exportBenchTicker'),
      'Benchmark Name': get(f, 'exportBenchName')
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