// src/services/exportService.js
import * as XLSX from 'xlsx';
import { generateMonthlyReport } from './pdfReportService';

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

  return generateMonthlyReport({
    funds,
    metadata: pdfMetadata
  });
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