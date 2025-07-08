// src/services/pdfReportService.js
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import assetClassGroups from '../data/assetClassGroups';

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
    benchmarkBg: [255, 220, 100], // Yellow benchmark row - adjusted to match your Excel
    benchmarkText: [0, 0, 0], // Black text
    alternateRow: [249, 250, 251], // Light gray
    // Performance colors for rank cells
    rankColors: {
      // Softer palette for easier viewing
      excellent: [200, 230, 201], // Pale green - top 20%
      good: [220, 237, 193], // Light yellow-green - 20-40%
      average: [255, 243, 205], // Pale yellow - 40-60%
      belowAverage: [255, 224, 178], // Light orange - 60-80%
      poor: [255, 205, 210] // Light red - bottom 20%
    }
  },
  fontSize: {
    title: 20,
    subtitle: 16,
    heading: 10,
    body: 7.5,
    footer: 8
  }
};

// Column definitions matching your Excel format exactly
const TABLE_COLUMNS = [
  { header: 'Ticker', dataKey: 'ticker', width: 40 },
  { header: 'Fund Name', dataKey: 'name', width: 135 },
  { header: 'Rating', dataKey: 'rating', width: 40 },
  { header: 'YTD Return', dataKey: 'ytd', width: 44 },
  { header: 'YTD Rank', dataKey: 'ytdRank', width: 36 },
  { header: '1Y Return', dataKey: 'oneYear', width: 44 },
  { header: '1Y Rank', dataKey: 'oneYearRank', width: 36 },
  { header: '3Y Return', dataKey: 'threeYear', width: 44 },
  { header: '3Y Rank', dataKey: 'threeYearRank', width: 36 },
  { header: '5Y Return', dataKey: 'fiveYear', width: 44 },
  { header: '5Y Rank', dataKey: 'fiveYearRank', width: 36 },
  { header: 'Yield', dataKey: 'yield', width: 34 },
  { header: '3Y Std Dev', dataKey: 'stdDev', width: 40 },
  { header: 'Expense Ratio', dataKey: 'expense', width: 40 },
  { header: 'Manager Tenure', dataKey: 'tenure', width: 45 },
  { header: 'Score', dataKey: 'score', width: 33 }
];

// Benchmark name mappings (matching your Excel)
const BENCHMARK_NAMES = {
  'IWF': 'Russell 1000 Growth',
  'IWB': 'Russell 1000',
  'IWD': 'Russell 1000 Value',
  'IWP': 'Russell Midcap Growth Index',
  'IWR': 'Russell Midcap Index',
  'IWS': 'Russell Midcap Value Index',
  'IWO': 'Russell 2000 Growth',
  'VTWO': 'Russell 2000',
  'IWN': 'Russell 2000 Value',
  'EFA': 'MSCI EAFE Index',
  'SCZ': 'MSCI EAFE Small-Cap Index',
  'ACWX': 'MSCI All Country World ex U.S.',
  'BIL': 'Bloomberg 1-3 Month T-Bill Index',
  'SUB': 'iShares Short-Term Muni Index',
  'ITM': 'VanEck Intermediate Muni Index',
  'HYD': 'VanEck High Yield Muni Index',
  'BSV': 'Vanguard Short-Term Bond Index',
  'AGG': 'U.S. Aggregate Bond Index',
  'BNDW': 'Vanguard Total World Bond Index',
  'CWB': 'Bloomberg Convertible Index',
  'AOM': 'Morningstar Moderate Target Risk Index',
  'PGX': 'Invesco Preferred Index',
  'QAI': 'IQ Hedge Multi-Strat Index',
  'RWO': 'Dow Jones Global Real Estate Index',
  'AOR': 'iShares Core Growth Allocation ETF',
  'SPY': 'S&P 500 Index'
};

/**
 * Main export function - Generate monthly performance report PDF
 */
export function generateMonthlyReport(data) {
  const { funds, benchmarks, metadata } = data;
  
  // Create new PDF document
  const doc = new jsPDF({
    orientation: REPORT_CONFIG.orientation,
    unit: REPORT_CONFIG.unit,
    format: REPORT_CONFIG.format
  });

  // Add cover page
  addCoverPage(doc, metadata);

  // Start a new page for report tables
  doc.addPage();

  // Group funds by asset class and filter out benchmarks from main list
  const fundsByClass = groupAndFilterFunds(funds, benchmarks);

  // Add each asset class section
  assetClassGroups.forEach(group => {
    group.classes.forEach(assetClass => {
      const classFunds = fundsByClass[assetClass] || [];
      const benchmark = benchmarks[assetClass];

      // Skip empty asset classes
      if (classFunds.length === 0 && !benchmark) return;

      // Add asset class table
      addAssetClassTable(doc, assetClass, classFunds, benchmark);
    });
  });

  // Add page numbers
  addPageNumbers(doc, doc.getNumberOfPages());
  
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
  doc.setFont(undefined, 'bold');
  doc.setTextColor(30, 58, 138); // Blue color
  doc.text('Lightship Wealth Strategies', pageWidth / 2, 120, { align: 'center' });
  
  doc.setFontSize(20);
  doc.setFont(undefined, 'normal');
  doc.text('Recommended List Performance', pageWidth / 2, 150, { align: 'center' });
  
  // Date
  doc.setFontSize(14);
  doc.setTextColor(100, 100, 100); // Gray color
  const reportDate = metadata.date || new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric', 
    year: 'numeric'
  });
  doc.text(`As of ${reportDate}`, pageWidth / 2, 180, { align: 'center' });
  
  // Summary box
  doc.setDrawColor(200);
  doc.setFillColor(250, 250, 250);
  doc.roundedRect(pageWidth / 2 - 150, 220, 300, 140, 5, 5, 'FD');
  
  // Summary content
  doc.setFontSize(12);
  doc.setTextColor(50, 50, 50);
  const summaryY = 250;
  const lineHeight = 25;
  
  doc.text(`Total Funds Analyzed: ${metadata.totalFunds || 0}`, pageWidth / 2, summaryY, { align: 'center' });
  doc.text(`Recommended Funds: ${metadata.recommendedFunds || 0}`, pageWidth / 2, summaryY + lineHeight, { align: 'center' });
  doc.text(`Asset Classes: ${metadata.assetClassCount || 0}`, pageWidth / 2, summaryY + lineHeight * 2, { align: 'center' });
  doc.text(`Average Score: ${metadata.averageScore || 'N/A'}`, pageWidth / 2, summaryY + lineHeight * 3, { align: 'center' });
  
  // Footer
  doc.setFontSize(10);
  doc.setTextColor(150, 150, 150);
  doc.text('This report is for internal use only', pageWidth / 2, pageHeight - 40, { align: 'center' });
}

/**
 * Group funds by asset class and filter out benchmarks
 */
function groupAndFilterFunds(funds, benchmarks) {
  const grouped = {};
  
  // Get all benchmark tickers for filtering
  const benchmarkTickers = new Set();
  Object.values(benchmarks).forEach(b => {
    if (b.ticker) benchmarkTickers.add(b.ticker);
  });
  
  funds.forEach(fund => {
    // Skip if this is a benchmark fund
    if (benchmarkTickers.has(fund.Symbol)) return;
    
    const assetClass = fund['Asset Class'];
    if (!assetClass) return;
    
    if (!grouped[assetClass]) {
      grouped[assetClass] = [];
    }
    grouped[assetClass].push(fund);
  });
  
  // Sort funds within each class by score (descending)
  Object.keys(grouped).forEach(assetClass => {
    grouped[assetClass].sort((a, b) => {
      const scoreA = a.scores?.final || 0;
      const scoreB = b.scores?.final || 0;
      return scoreB - scoreA;
    });
  });
  
  return grouped;
}

/**
 * Add asset class table to PDF
 */
function addAssetClassTable(doc, assetClass, funds, benchmark) {
  let startY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 20 : REPORT_CONFIG.margins.top;

  const tableData = funds.map(fund => prepareRowData(fund));

  if (benchmark && benchmark.ticker) {
    const benchmarkRow = prepareBenchmarkRow(benchmark);
    tableData.push(benchmarkRow);
  }
  
  // Generate table
  doc.autoTable({
    startY: startY + 15,
    head: [TABLE_COLUMNS.map(col => col.header)],
    body: tableData.map(row => TABLE_COLUMNS.map(col => row[col.dataKey] || '')),
    columns: TABLE_COLUMNS,
    headStyles: {
      fillColor: REPORT_CONFIG.colors.headerBg,
      textColor: REPORT_CONFIG.colors.headerText,
      fontSize: REPORT_CONFIG.fontSize.body,
      fontStyle: 'bold',
      halign: 'center'
    },
    bodyStyles: {
      fontSize: REPORT_CONFIG.fontSize.body,
      cellPadding: 2
    },
    alternateRowStyles: {
      fillColor: REPORT_CONFIG.colors.alternateRow
    },
    columnStyles: getColumnStyles(),
    pageBreak: 'avoid',
    willDrawPage: function(data) {
      if (data.pageNumber === 1) {
        doc.setFontSize(REPORT_CONFIG.fontSize.heading);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(assetClass, REPORT_CONFIG.margins.left, data.cursor.y - 15);
      }
    },
    didParseCell: function(data) {
      // Highlight benchmark row
      if (benchmark && data.row.index === tableData.length - 1) {
        data.cell.styles.fillColor = REPORT_CONFIG.colors.benchmarkBg;
        data.cell.styles.textColor = REPORT_CONFIG.colors.benchmarkText;
        data.cell.styles.fontStyle = 'bold';
      }
    },
    didDrawCell: function(data) {
      // Custom rendering for rank cells with color coding
      // Apply only to body cells so header cells remain unstyled
      if (
        data.section === 'body' &&
        data.column.dataKey &&
        data.column.dataKey.includes('Rank') &&
        data.row.index < tableData.length - 1
      ) {
        const rankValue = parseInt(data.cell.text);
        if (!isNaN(rankValue)) {
          // Clear the default text
          doc.setFillColor(...getRankColor(rankValue));
          const padding = 2;
          doc.rect(
            data.cell.x + padding,
            data.cell.y + padding,
            data.cell.width - (padding * 2),
            data.cell.height - (padding * 2),
            'F'
          );
          
          // Determine appropriate text color based on background brightness
          const bgColor = getRankColor(rankValue);
          const textColor = getTextColorForBackground(bgColor);

          // Redraw the text in contrasting color
          doc.setTextColor(...textColor);
          doc.setFontSize(REPORT_CONFIG.fontSize.body);
          doc.text(
            data.cell.text,
            data.cell.x + data.cell.width / 2,
            data.cell.y + data.cell.height / 2 + 1,
            { align: 'center', baseline: 'middle' }
          );
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
 * Format rank values (removes decimals)
 */
function formatRank(value) {
  if (value == null || value === '') return '';
  
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '';
  
  return Math.round(num).toString();
}

/**
 * Prepare row data for a fund
 */
function prepareRowData(fund) {
  return {
    ticker: fund.Symbol || fund['Symbol/CUSIP'] || '',
    name: fund.displayName || fund['Fund Name'] || fund['Product Name'] || '',
    rating: getStarRating(fund['Morningstar Star Rating'] || fund['Rating'] || fund['Star Rating']),
    ytd: formatPercent(fund['YTD'] || fund['Total Return - YTD (%)']),
    ytdRank: formatRank(fund['YTD Rank'] || fund['Category Rank (%) Total Return – YTD'] || fund['YTD Cat Rank']),
    oneYear: formatPercent(fund['1 Year'] || fund['Total Return - 1 Year (%)']),
    oneYearRank: formatRank(fund['1Y Rank'] || fund['Category Rank (%) Total Return – 1Y'] || fund['1Y Cat Rank']),
    threeYear: formatPercent(fund['3 Year'] || fund['Annualized Total Return - 3 Year (%)']),
    threeYearRank: formatRank(fund['3Y Rank'] || fund['Category Rank (%) Ann. Total Return – 3Y'] || fund['3Y Cat Rank']),
    fiveYear: formatPercent(fund['5 Year'] || fund['Annualized Total Return - 5 Year (%)']),
    fiveYearRank: formatRank(fund['5Y Rank'] || fund['Category Rank (%) Ann. Total Return – 5Y'] || fund['5Y Cat Rank']),
    yield: formatPercent(fund['Yield'] || fund['SEC Yield'] || fund['SEC Yield (%)']),
    stdDev: formatNumber(fund['StdDev3Y'] || fund['Standard Deviation - 3 Year'] || fund['Standard Deviation'] || fund['3Y Std Dev']),
    expense: formatPercent(fund['Net Expense Ratio'] || fund['Net Exp Ratio (%)'] || fund['Expense Ratio']),
    tenure: formatNumber(fund['Manager Tenure'] || fund['Longest Manager Tenure (Years)']),
    score: formatScore(fund.scores?.final)
  };
}

/**
 * Prepare benchmark row data
 */
function prepareBenchmarkRow(benchmark) {
  return {
    ticker: '',  // Empty ticker for benchmark
    name: BENCHMARK_NAMES[benchmark.ticker] || benchmark.name || benchmark.ticker,
    rating: '',  // No rating for benchmark
    ytd: formatPercent(benchmark['YTD'] || benchmark['Total Return - YTD (%)']),
    ytdRank: '', // No rank for benchmark
    oneYear: formatPercent(benchmark['1 Year'] || benchmark['Total Return - 1 Year (%)']),
    oneYearRank: '',
    threeYear: formatPercent(benchmark['3 Year'] || benchmark['Annualized Total Return - 3 Year (%)']),
    threeYearRank: '',
    fiveYear: formatPercent(benchmark['5 Year'] || benchmark['Annualized Total Return - 5 Year (%)']),
    fiveYearRank: '',
    yield: formatPercent(benchmark['Yield'] || benchmark['SEC Yield'] || benchmark['SEC Yield (%)']),
    stdDev: formatNumber(benchmark['StdDev3Y'] || benchmark['Standard Deviation - 3 Year'] || benchmark['Standard Deviation'] || benchmark['3Y Std Dev']),
    expense: '', // No expense ratio for benchmark
    tenure: '',  // No manager tenure for benchmark
    score: ''    // No score for benchmark
  };
}

/**
 * Get column styles for table
 */
function getColumnStyles() {
  const styles = {};
  TABLE_COLUMNS.forEach((col, index) => {
    styles[index] = { 
      cellWidth: col.width,
      halign: ['name'].includes(col.dataKey) ? 'left' : 'center',
      valign: 'middle'
    };
  });
  return styles;
}

/**
 * Get star rating display
 */
function getStarRating(rating) {
  if (!rating) return '';
  
  // Handle different rating formats
  let stars = 0;
  if (typeof rating === 'number') {
    stars = Math.round(rating);
  } else if (typeof rating === 'string') {
    // Try to parse number from string
    const parsed = parseInt(rating);
    if (!isNaN(parsed)) {
      stars = parsed;
    } else if (rating.includes('★') || rating.includes('☆')) {
      // Already formatted
      return rating;
    }
  }
  
  if (stars < 1 || stars > 5) return '';
  
  return '★'.repeat(stars) + '☆'.repeat(5 - stars);
}

/**
 * Format percentage values
 */
function formatPercent(value) {
  if (value == null || value === '') return '';
  
  // Handle string percentages
  if (typeof value === 'string') {
    // If already has %, just return it
    if (value.includes('%')) return value;
    // Try to parse
    const parsed = parseFloat(value);
    if (!isNaN(parsed)) {
      return `${parsed.toFixed(2)}%`;
    }
    return value;
  }
  
  // Handle numeric values
  if (typeof value === 'number') {
    return `${value.toFixed(2)}%`;
  }
  
  return '';
}

/**
 * Format numeric values
 */
function formatNumber(value, decimals = 1) {
  if (value == null || value === '') return '';
  
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '';
  
  return num.toFixed(decimals);
}

/**
 * Format score values
 */
function formatScore(score) {
  if (score == null) return '';
  return Math.round(score).toString();
}

/**
 * Get color for rank cell based on percentile
 */
function getRankColor(rank) {
  if (rank <= 20) return REPORT_CONFIG.colors.rankColors.excellent;
  if (rank <= 40) return REPORT_CONFIG.colors.rankColors.good;
  if (rank <= 60) return REPORT_CONFIG.colors.rankColors.average;
  if (rank <= 80) return REPORT_CONFIG.colors.rankColors.belowAverage;
  return REPORT_CONFIG.colors.rankColors.poor;
}

/**
 * Determine black vs white text color based on background brightness
 */
function getTextColorForBackground(rgb) {
  const [r, g, b] = rgb;
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 150 ? [0, 0, 0] : [255, 255, 255];
}

/**
 * Add page numbers to all pages
 */
function addPageNumbers(doc, totalPages) {
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(REPORT_CONFIG.fontSize.footer);
    doc.setTextColor(150, 150, 150);
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    doc.text(
      `Page ${i} of ${totalPages}`, 
      pageWidth / 2, 
      pageHeight - 20, 
      { align: 'center' }
    );
  }
}

// Export the main function as default and named export
export default { generateMonthlyReport };