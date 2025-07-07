// src/services/pdfReportService.js
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * PDF Report Generation Service
 * Generates professional fund performance reports matching Excel format
 */

// Report configuration matching your Excel format
const REPORT_CONFIG = {
  orientation: 'landscape',
  unit: 'pt',
  format: 'letter',
  margins: {
    top: 40,
    right: 30,
    bottom: 40,
    left: 30
  },
  colors: {
    headerBg: [30, 58, 138], // Blue header (RGB)
    headerText: [255, 255, 255], // White text
    benchmarkBg: [251, 191, 36], // Yellow benchmark row
    benchmarkText: [0, 0, 0], // Black text
    alternateRow: [249, 250, 251], // Light gray
    // Performance colors (matching your Excel)
    performance: {
      excellent: '#22c55e', // Green
      good: '#84cc16',
      average: '#facc15', // Yellow
      belowAverage: '#fb923c', // Orange
      poor: '#ef4444' // Red
    }
  },
  fontSize: {
    title: 16,
    heading: 12,
    body: 9,
    footer: 8
  }
};

// Column definitions for fund tables
const TABLE_COLUMNS = [
  { header: 'Ticker', dataKey: 'Symbol', width: 50 },
  { header: 'Fund Name', dataKey: 'Fund Name', width: 200 },
  { header: 'Rating', dataKey: 'starRating', width: 45 },
  { header: 'YTD Return', dataKey: 'YTD', width: 55 },
  { header: 'YTD Rank', dataKey: 'YTD Rank', width: 45 },
  { header: '1Y Return', dataKey: '1 Year', width: 55 },
  { header: '1Y Rank', dataKey: '1Y Rank', width: 45 },
  { header: '3Y Return', dataKey: '3 Year', width: 55 },
  { header: '3Y Rank', dataKey: '3Y Rank', width: 45 },
  { header: '5Y Return', dataKey: '5 Year', width: 55 },
  { header: '5Y Rank', dataKey: '5Y Rank', width: 45 },
  { header: 'Yield', dataKey: 'Yield', width: 40 },
  { header: '3Y Std Dev', dataKey: 'StdDev3Y', width: 50 },
  { header: 'Expense Ratio', dataKey: 'Net Expense Ratio', width: 55 },
  { header: 'Manager Tenure', dataKey: 'Manager Tenure', width: 60 },
  { header: 'Score', dataKey: 'scores.final', width: 45 }
];

// Benchmark name mappings
const BENCHMARK_NAMES = {
  'AOM': 'Morningstar Moderate Target Risk Index',
  'CWB': 'Bloomberg Convertible Index',
  'ACWX': 'MSCI All Country World ex U.S.',
  'BNDW': 'Vanguard Total World Bond Index',
  'QAI': 'IQ Hedge Multi-Strat Index',
  'HYD': 'VanEck High Yield Muni Index',
  'ITM': 'VanEck Intermediate Muni Index',
  'SUB': 'iShares Short-Term Muni Index',
  'SCZ': 'MSCI EAFE Small-Cap Index',
  'EFA': 'MSCI EAFE Index',
  'AGG': 'U.S. Aggregate Bond Index',
  'IWB': 'Russell 1000',
  'IWD': 'Russell 1000 Value',
  'IWF': 'Russell 1000 Growth',
  'IWR': 'Russell Midcap Index',
  'IWS': 'Russell Midcap Value Index',
  'IWP': 'Russell Midcap Growth Index',
  'VTWO': 'Russell 2000',
  'IWN': 'Russell 2000 Value',
  'IWO': 'Russell 2000 Growth',
  'IWM': 'iShares TR Russell 2000 ETF',
  'BIL': 'Bloomberg 1-3 Month T-Bill Index',
  'BSV': 'Vanguard Short-Term Bond Index',
  'PGX': 'Invesco Preferred Index',
  'RWO': 'Dow Jones Global Real Estate Index',
  'SPY': 'S&P 500 Index'
};

/**
 * Generate monthly performance report PDF
 * @param {Object} data - Report data including funds, benchmarks, metadata
 * @returns {jsPDF} PDF document
 */
export function generateMonthlyReport(data) {
  const { funds, benchmarks, assetClassGroups, metadata } = data;
  
  // Create new PDF document
  const doc = new jsPDF({
    orientation: REPORT_CONFIG.orientation,
    unit: REPORT_CONFIG.unit,
    format: REPORT_CONFIG.format
  });

  // Add cover page
  addCoverPage(doc, metadata);
  
  // Group funds by asset class
  const fundsByClass = groupFundsByAssetClass(funds);
  
  // Process each asset class group
  let pageNumber = 2;
  assetClassGroups.forEach((group, groupIndex) => {
    if (groupIndex > 0) {
      doc.addPage();
      pageNumber++;
    }
    
    group.classes.forEach((assetClass, classIndex) => {
      if (classIndex > 0) {
        // Check if we need a new page
        const currentY = doc.lastAutoTable?.finalY || REPORT_CONFIG.margins.top;
        if (currentY > 400) {
          doc.addPage();
          pageNumber++;
        }
      }
      
      // Add asset class table
      addAssetClassTable(doc, assetClass, fundsByClass[assetClass] || [], benchmarks[assetClass]);
    });
  });
  
  // Add page numbers
  addPageNumbers(doc);
  
  return doc;
}

/**
 * Add cover page to PDF
 */
function addCoverPage(doc, metadata) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Title
  doc.setFontSize(24);
  doc.setTextColor(30, 58, 138); // Blue color
  doc.text('Lightship Wealth Strategies', pageWidth / 2, 100, { align: 'center' });
  
  doc.setFontSize(20);
  doc.text('Recommended List Performance', pageWidth / 2, 130, { align: 'center' });
  
  // Date
  doc.setFontSize(14);
  doc.setTextColor(100, 100, 100); // Gray color
  const reportDate = metadata.date || new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric', 
    year: 'numeric'
  });
  doc.text(`As of ${reportDate}`, pageWidth / 2, 160, { align: 'center' });
  
  // Summary box
  doc.setDrawColor(200);
  doc.setFillColor(250, 250, 250);
  doc.roundedRect(pageWidth / 2 - 150, 200, 300, 120, 5, 5, 'FD');
  
  // Summary content
  doc.setFontSize(12);
  doc.setTextColor(50, 50, 50); // Dark gray color
  const summaryY = 230;
  const lineHeight = 20;
  
  doc.text(`Total Funds Analyzed: ${metadata.totalFunds || 0}`, pageWidth / 2, summaryY, { align: 'center' });
  doc.text(`Recommended Funds: ${metadata.recommendedFunds || 0}`, pageWidth / 2, summaryY + lineHeight, { align: 'center' });
  doc.text(`Asset Classes: ${metadata.assetClassCount || 0}`, pageWidth / 2, summaryY + lineHeight * 2, { align: 'center' });
  doc.text(`Average Score: ${metadata.averageScore || 'N/A'}`, pageWidth / 2, summaryY + lineHeight * 3, { align: 'center' });
}

/**
 * Add asset class table to PDF
 */
function addAssetClassTable(doc, assetClass, funds, benchmark) {
  const startY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 20 : REPORT_CONFIG.margins.top;
  
  // Asset class header
  doc.setFontSize(REPORT_CONFIG.fontSize.heading);
  doc.setTextColor(0, 0, 0); // Black text
  doc.text(assetClass, REPORT_CONFIG.margins.left, startY);
  
  // Prepare table data
  const tableData = funds.map(fund => {
    const row = {};
    TABLE_COLUMNS.forEach(col => {
      if (col.dataKey === 'starRating') {
        row[col.dataKey] = getStarRating(fund['Morningstar Star Rating']);
      } else if (col.dataKey === 'scores.final') {
        row[col.dataKey] = fund.scores?.final || '';
      } else if (col.dataKey.includes('Rank')) {
        row[col.dataKey] = fund[col.dataKey] || '';
      } else if (typeof fund[col.dataKey] === 'number') {
        row[col.dataKey] = formatNumber(fund[col.dataKey], col.dataKey);
      } else {
        row[col.dataKey] = fund[col.dataKey] || '';
      }
    });
    return row;
  });
  
  // Add benchmark row if exists
  if (benchmark) {
    const benchmarkRow = {
      Symbol: benchmark.ticker,
      'Fund Name': BENCHMARK_NAMES[benchmark.ticker] || benchmark.name,
      // Only include performance metrics for benchmark
      'YTD': formatNumber(benchmark.YTD, 'YTD'),
      '1 Year': formatNumber(benchmark['1 Year'], '1 Year'),
      '3 Year': formatNumber(benchmark['3 Year'], '3 Year'),
      '5 Year': formatNumber(benchmark['5 Year'], '5 Year'),
      'Yield': formatNumber(benchmark.Yield, 'Yield'),
      'StdDev3Y': formatNumber(benchmark.StdDev3Y, 'StdDev3Y')
    };
    tableData.push(benchmarkRow);
  }
  
  // Generate table
  doc.autoTable({
    startY: startY + 10,
    head: [TABLE_COLUMNS.map(col => col.header)],
    body: tableData.map(row => TABLE_COLUMNS.map(col => row[col.dataKey] || '')),
    headStyles: {
      fillColor: REPORT_CONFIG.colors.headerBg,
      textColor: REPORT_CONFIG.colors.headerText,
      fontSize: REPORT_CONFIG.fontSize.body,
      fontStyle: 'bold'
    },
    bodyStyles: {
      fontSize: REPORT_CONFIG.fontSize.body,
      cellPadding: 3
    },
    alternateRowStyles: {
      fillColor: REPORT_CONFIG.colors.alternateRow
    },
    columnStyles: getColumnStyles(),
    didParseCell: function(data) {
      // Highlight benchmark row
      if (benchmark && data.row.index === tableData.length - 1) {
        data.cell.styles.fillColor = REPORT_CONFIG.colors.benchmarkBg;
        data.cell.styles.textColor = REPORT_CONFIG.colors.benchmarkText;
        data.cell.styles.fontStyle = 'bold';
      }
      
      // Color code performance cells
      if (data.column.dataKey && data.column.dataKey.includes('Rank')) {
        const rank = parseInt(data.cell.text);
        if (!isNaN(rank)) {
          data.cell.styles.textColor = getPerformanceColor(rank);
        }
      }
    },
    margin: { 
      left: REPORT_CONFIG.margins.left, 
      right: REPORT_CONFIG.margins.right 
    }
  });
}

/**
 * Get column styles for table
 */
function getColumnStyles() {
  const styles = {};
  TABLE_COLUMNS.forEach((col, index) => {
    styles[index] = { 
      cellWidth: col.width,
      halign: col.dataKey === 'Fund Name' ? 'left' : 'center'
    };
  });
  return styles;
}

/**
 * Get star rating display
 */
function getStarRating(rating) {
  if (!rating) return '';
  const stars = parseInt(rating);
  if (isNaN(stars)) return '';
  return '★'.repeat(stars) + '☆'.repeat(5 - stars);
}

/**
 * Format number for display
 */
function formatNumber(value, metric) {
  if (value == null || value === '') return '';
  
  // Percentage fields
  if (['YTD', '1 Year', '3 Year', '5 Year', '10 Year', 'Yield', 'Net Expense Ratio'].includes(metric)) {
    return `${value.toFixed(2)}%`;
  }
  
  // Standard deviation and other decimals
  if (['StdDev3Y', 'StdDev5Y', 'Sharpe Ratio', 'Manager Tenure'].includes(metric)) {
    return value.toFixed(2);
  }
  
  // Score
  if (metric === 'scores.final') {
    return value.toFixed(1);
  }
  
  return value.toString();
}

/**
 * Get performance color based on rank
 */
function getPerformanceColor(rank) {
  if (rank <= 20) return [34, 197, 94]; // Green
  if (rank <= 40) return [132, 204, 22]; // Light green
  if (rank <= 60) return [250, 204, 21]; // Yellow
  if (rank <= 80) return [251, 146, 60]; // Orange
  return [239, 68, 68]; // Red
}

/**
 * Group funds by asset class
 */
function groupFundsByAssetClass(funds) {
  const grouped = {};
  funds.forEach(fund => {
    const assetClass = fund['Asset Class'];
    if (!grouped[assetClass]) {
      grouped[assetClass] = [];
    }
    grouped[assetClass].push(fund);
  });
  
  // Sort funds within each class by score
  Object.keys(grouped).forEach(assetClass => {
    grouped[assetClass].sort((a, b) => (b.scores?.final || 0) - (a.scores?.final || 0));
  });
  
  return grouped;
}

/**
 * Add page numbers to all pages
 */
function addPageNumbers(doc) {
  const pageCount = doc.internal.getNumberOfPages();
  
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(REPORT_CONFIG.fontSize.footer);
    doc.setTextColor(150, 150, 150); // Light gray
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    doc.text(
      `Page ${i} of ${pageCount}`, 
      pageWidth / 2, 
      pageHeight - 20, 
      { align: 'center' }
    );
  }
}

// Export functions
export default {
  generateMonthlyReport,
  REPORT_CONFIG,
  BENCHMARK_NAMES
};