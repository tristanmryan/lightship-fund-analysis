// src/services/pdfReportService.js
import jsPDF from 'jspdf';
import DejaVuSans from '../assets/DejaVuSans.js';

/**
 * PDF Report Generation Service
 * Generates professional fund performance reports with Raymond James branding
 */

// Report configuration with Raymond James branding
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
    // Raymond James brand colors
    primary: [0, 47, 108], // Raymond James Blue
    secondary: [255, 255, 255], // White
    accent: [255, 194, 0], // Raymond James Gold
    headerBg: [0, 47, 108], // Raymond James Blue
    headerText: [255, 255, 255], // White text
    benchmarkBg: [255, 194, 0], // Raymond James Gold
    benchmarkText: [0, 0, 0], // Black text
    alternateRow: [249, 250, 251], // Light gray
    // Performance colors for rank cells
    rankColors: {
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

// Column definitions for the API-driven data structure (Phase 3 parity)
const TABLE_COLUMNS = [
  { header: 'Ticker', dataKey: 'ticker', width: 40 },
  { header: 'Fund Name', dataKey: 'name', width: 135 },
  { header: 'Asset Class', dataKey: 'asset_class', width: 70 },
  { header: 'YTD Return', dataKey: 'ytd_return', width: 50 },
  { header: '1Y Return', dataKey: 'one_year_return', width: 50 },
  { header: '3Y Return', dataKey: 'three_year_return', width: 50 },
  { header: '5Y Return', dataKey: 'five_year_return', width: 50 },
  { header: 'Expense Ratio', dataKey: 'expense_ratio', width: 52 },
  { header: 'Sharpe Ratio', dataKey: 'sharpe_ratio', width: 48 },
  { header: 'Std Dev (3Y)', dataKey: 'standard_deviation_3y', width: 58 },
  { header: 'Std Dev (5Y)', dataKey: 'standard_deviation_5y', width: 58 },
  { header: 'Recommended', dataKey: 'is_recommended', width: 60 }
];

/**
 * Main export function - Generate monthly performance report PDF
 */
export function generateMonthlyReport(data) {
  const { funds, metadata } = data;
  
  // Create new PDF document
  const doc = new jsPDF({
    orientation: REPORT_CONFIG.orientation,
    unit: REPORT_CONFIG.unit,
    format: REPORT_CONFIG.format
  });

  // Register font for special characters
  doc.addFileToVFS('DejaVuSans.ttf', DejaVuSans);
  doc.addFont('DejaVuSans.ttf', 'DejaVuSans', 'normal');
  doc.setFont('helvetica');

  // Add cover page
  addCoverPage(doc, metadata);

  // Start a new page for report tables
  doc.addPage();

  // Group funds by asset class
  const fundsByClass = groupFundsByAssetClass(funds);

  // Add each asset class section
  Object.entries(fundsByClass).forEach(([assetClass, classFunds]) => {
    if (classFunds.length === 0) return;

    // Add asset class table
    addAssetClassTable(doc, assetClass, classFunds);
  });

  // Add page numbers
  addPageNumbers(doc, doc.getNumberOfPages());
  
  return doc;
}

/**
 * Add cover page to PDF with Raymond James branding
 */
function addCoverPage(doc, metadata) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Raymond James branding
  doc.setFontSize(24);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(...REPORT_CONFIG.colors.primary);
  doc.text('Raymond James', pageWidth / 2, 120, { align: 'center' });
  
  doc.setFontSize(20);
  doc.setFont(undefined, 'normal');
  doc.text('Lightship Fund Analysis', pageWidth / 2, 150, { align: 'center' });
  
  doc.setFontSize(16);
  doc.text('Performance Report', pageWidth / 2, 170, { align: 'center' });
  
  // Date
  doc.setFontSize(14);
  doc.setTextColor(100, 100, 100);
  const reportDate = metadata?.date || new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric', 
    year: 'numeric'
  });
  doc.text(`As of ${reportDate}`, pageWidth / 2, 200, { align: 'center' });
  
  // Summary box
  doc.setDrawColor(200);
  doc.setFillColor(250, 250, 250);
  doc.roundedRect(pageWidth / 2 - 150, 240, 300, 140, 5, 5, 'FD');
  
  // Summary content
  doc.setFontSize(12);
  doc.setTextColor(50, 50, 50);
  const summaryY = 270;
  const lineHeight = 25;
  
  doc.text(`Total Funds Analyzed: ${metadata?.totalFunds || 0}`, pageWidth / 2, summaryY, { align: 'center' });
  doc.text(`Recommended Funds: ${metadata?.recommendedFunds || 0}`, pageWidth / 2, summaryY + lineHeight, { align: 'center' });
  doc.text(`Asset Classes: ${metadata?.assetClassCount || 0}`, pageWidth / 2, summaryY + lineHeight * 2, { align: 'center' });
  doc.text(`Average Performance: ${metadata?.averagePerformance || 'N/A'}`, pageWidth / 2, summaryY + lineHeight * 3, { align: 'center' });
  
  // Footer
  doc.setFontSize(10);
  doc.setTextColor(150, 150, 150);
  doc.text('This report is for internal use only', pageWidth / 2, pageHeight - 40, { align: 'center' });
}

/**
 * Group funds by asset class
 */
function groupFundsByAssetClass(funds) {
  const grouped = {};
  
  funds.forEach(fund => {
    const assetClass = fund.asset_class || 'Unassigned';
    if (!grouped[assetClass]) {
      grouped[assetClass] = [];
    }
    grouped[assetClass].push(fund);
  });
  
  return grouped;
}

/**
 * Add asset class table to PDF
 */
function addAssetClassTable(doc, assetClass, funds) {
  let startY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 20 : REPORT_CONFIG.margins.top;

  const tableData = funds.map(fund => prepareRowData(fund));

  // Check if we need a new page
  const pageHeight = doc.internal.pageSize.getHeight();
  const remainingSpace = pageHeight - REPORT_CONFIG.margins.bottom - startY;
  const minSpaceNeeded = 80;

  if (remainingSpace < minSpaceNeeded) {
    doc.addPage();
    startY = REPORT_CONFIG.margins.top;
  }

  // Asset class header
  doc.setFontSize(REPORT_CONFIG.fontSize.heading);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(...REPORT_CONFIG.colors.primary);
  doc.text(assetClass, REPORT_CONFIG.margins.left, startY);
  
  // Generate table
  doc.autoTable({
    startY: startY + 15,
    head: [TABLE_COLUMNS.map(col => col.header)],
    body: tableData,
    columns: TABLE_COLUMNS,
    styles: {
      font: 'helvetica',
      fontSize: REPORT_CONFIG.fontSize.body,
      cellPadding: 2
    },
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
    showHead: 'everyPage',
    willDrawPage: function(data) {
      if (data.pageNumber > 1 && data.pageCount > 1) {
        doc.setFontSize(REPORT_CONFIG.fontSize.heading);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(...REPORT_CONFIG.colors.primary);
        doc.text(assetClass + ' (continued)', REPORT_CONFIG.margins.left, REPORT_CONFIG.margins.top - 10);
      }
    },
    didDrawCell: function(data) {
      // Highlight recommended funds
      if (data.section === 'body' && data.column.dataKey === 'is_recommended') {
        const isRecommended = data.row.raw.is_recommended;
        if (isRecommended) {
          data.cell.styles.fillColor = REPORT_CONFIG.colors.accent;
          data.cell.styles.textColor = [0, 0, 0];
          data.cell.styles.fontStyle = 'bold';
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
 * Prepare row data for a fund
 */
function prepareRowData(fund) {
  return {
    ticker: fund.ticker || '',
    name: fund.name || '',
    asset_class: fund.asset_class_name || fund.asset_class || 'Unassigned',
    ytd_return: formatPercent(fund.ytd_return),
    one_year_return: formatPercent(fund.one_year_return),
    three_year_return: formatPercent(fund.three_year_return),
    five_year_return: formatPercent(fund.five_year_return),
    expense_ratio: formatPercent(fund.expense_ratio),
    sharpe_ratio: formatNumber(fund.sharpe_ratio, 2),
    standard_deviation_3y: formatPercent(fund.standard_deviation_3y ?? fund.standard_deviation),
    standard_deviation_5y: formatPercent(fund.standard_deviation_5y),
    is_recommended: fund.is_recommended ? 'Yes' : 'No'
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
      halign: ['name', 'asset_class'].includes(col.dataKey) ? 'left' : 'center',
      valign: 'middle'
    };
  });
  return styles;
}

/**
 * Format percentage values
 */
function formatPercent(value) {
  if (value === null || value === undefined || isNaN(value)) {
    return 'N/A';
  }
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
}

/**
 * Format number values
 */
function formatNumber(value, decimals = 1) {
  if (value === null || value === undefined || isNaN(value)) {
    return 'N/A';
  }
  return value.toFixed(decimals);
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

/**
 * Generate PDF report for fund comparison
 * Enhanced for mixed fund/benchmark comparison
 */
export function generateComparePDF(data) {
  const { funds, metadata } = data;
  
  // Create new PDF document in portrait for comparison table
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: REPORT_CONFIG.unit,
    format: REPORT_CONFIG.format
  });

  // Register font for special characters
  doc.addFileToVFS('DejaVuSans.ttf', DejaVuSans);
  doc.addFont('DejaVuSans.ttf', 'DejaVuSans', 'normal');
  doc.setFont('helvetica');

  const pageWidth = doc.internal.pageSize.getWidth();
  let yPosition = REPORT_CONFIG.margins.top;

  // Header section
  doc.setFillColor(...REPORT_CONFIG.colors.primary);
  doc.rect(0, 0, pageWidth, 70, 'F');
  
  doc.setTextColor(...REPORT_CONFIG.colors.secondary);
  doc.setFontSize(REPORT_CONFIG.fontSize.title);
  doc.text('Raymond James', REPORT_CONFIG.margins.left, 30);
  
  doc.setFontSize(REPORT_CONFIG.fontSize.subtitle);
  doc.text(metadata.title || 'Fund Comparison Report', REPORT_CONFIG.margins.left, 55);

  yPosition = 90;

  // Report metadata
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(REPORT_CONFIG.fontSize.body);
  doc.text(`${metadata.subtitle || ''}`, REPORT_CONFIG.margins.left, yPosition);
  yPosition += 15;
  doc.text(`As of: ${metadata.asOfDate}`, REPORT_CONFIG.margins.left, yPosition);
  yPosition += 15;
  doc.text(`${metadata.benchmarkInfo || ''}`, REPORT_CONFIG.margins.left, yPosition);
  yPosition += 15;
  doc.text(`Items compared: ${funds.length}`, REPORT_CONFIG.margins.left, yPosition);
  yPosition += 25;

  // Comparison table
  const tableData = funds.map(fund => ({
    ticker: fund.ticker || '',
    name: (fund.name || '').substring(0, 25) + ((fund.name || '').length > 25 ? '...' : ''),
    type: fund.is_benchmark ? 'Benchmark' : 'Fund',
    asset_class: (fund.asset_class || '').substring(0, 15),
    ytd_return: formatPercent(fund.ytd_return),
    one_year_return: formatPercent(fund.one_year_return),
    three_year_return: formatPercent(fund.three_year_return),
    five_year_return: formatPercent(fund.five_year_return),
    sharpe_ratio: formatNumber(fund.sharpe_ratio, 2),
    expense_ratio: formatPercent(fund.expense_ratio, 2),
    delta_ytd: fund.is_benchmark ? '' : formatDeltaPercent(fund.delta_ytd),
    delta_1y: fund.is_benchmark ? '' : formatDeltaPercent(fund.delta_1y),
    delta_3y: fund.is_benchmark ? '' : formatDeltaPercent(fund.delta_3y),
    delta_5y: fund.is_benchmark ? '' : formatDeltaPercent(fund.delta_5y)
  }));

  // Table columns for comparison report
  const compareColumns = [
    { header: 'Ticker', dataKey: 'ticker', width: 35 },
    { header: 'Name', dataKey: 'name', width: 85 },
    { header: 'Type', dataKey: 'type', width: 30 },
    { header: 'Asset Class', dataKey: 'asset_class', width: 50 },
    { header: 'YTD', dataKey: 'ytd_return', width: 30 },
    { header: '1Y', dataKey: 'one_year_return', width: 30 },
    { header: '3Y', dataKey: 'three_year_return', width: 30 },
    { header: '5Y', dataKey: 'five_year_return', width: 30 },
    { header: 'Sharpe', dataKey: 'sharpe_ratio', width: 30 },
    { header: 'ER', dataKey: 'expense_ratio', width: 25 },
    { header: 'Δ YTD', dataKey: 'delta_ytd', width: 30 },
    { header: 'Δ 1Y', dataKey: 'delta_1y', width: 30 },
    { header: 'Δ 3Y', dataKey: 'delta_3y', width: 30 },
    { header: 'Δ 5Y', dataKey: 'delta_5y', width: 30 }
  ];

  // Draw table header
  doc.setFillColor(...REPORT_CONFIG.colors.headerBg);
  doc.rect(REPORT_CONFIG.margins.left, yPosition, pageWidth - REPORT_CONFIG.margins.left - REPORT_CONFIG.margins.right, 15, 'F');
  
  doc.setTextColor(...REPORT_CONFIG.colors.headerText);
  doc.setFontSize(REPORT_CONFIG.fontSize.heading);
  
  let xPosition = REPORT_CONFIG.margins.left + 2;
  compareColumns.forEach(col => {
    doc.text(col.header, xPosition, yPosition + 10);
    xPosition += col.width;
  });

  yPosition += 15;

  // Draw table rows
  tableData.forEach((row, index) => {
    // Alternate row colors
    if (index % 2 === 1) {
      doc.setFillColor(...REPORT_CONFIG.colors.alternateRow);
      doc.rect(REPORT_CONFIG.margins.left, yPosition, pageWidth - REPORT_CONFIG.margins.left - REPORT_CONFIG.margins.right, 12, 'F');
    }

    // Highlight benchmark rows
    if (row.type === 'Benchmark') {
      doc.setFillColor(...REPORT_CONFIG.colors.benchmarkBg);
      doc.rect(REPORT_CONFIG.margins.left, yPosition, pageWidth - REPORT_CONFIG.margins.left - REPORT_CONFIG.margins.right, 12, 'F');
    }

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(REPORT_CONFIG.fontSize.body);

    xPosition = REPORT_CONFIG.margins.left + 2;
    compareColumns.forEach(col => {
      const value = row[col.dataKey] || '';
      doc.text(String(value), xPosition, yPosition + 9);
      xPosition += col.width;
    });

    yPosition += 12;

    // Add new page if needed
    if (yPosition > doc.internal.pageSize.getHeight() - 60) {
      doc.addPage();
      yPosition = REPORT_CONFIG.margins.top;
    }
  });

  // Add footer with delta legend
  yPosition += 20;
  doc.setFontSize(REPORT_CONFIG.fontSize.body);
  doc.setTextColor(100, 100, 100);
  doc.text('Δ = Delta vs benchmark (outperformance/underperformance)', REPORT_CONFIG.margins.left, yPosition);
  doc.text('ER = Expense Ratio', REPORT_CONFIG.margins.left, yPosition + 12);
  doc.text('All returns shown as percentages. Deltas show fund performance minus benchmark performance.', REPORT_CONFIG.margins.left, yPosition + 24);

  // Add timestamp
  const timestamp = new Date().toLocaleString();
  doc.text(`Generated: ${timestamp}`, REPORT_CONFIG.margins.left, doc.internal.pageSize.getHeight() - 20);

  return doc.output('blob');
}

// Helper function for formatting delta percentages with +/- signs
function formatDeltaPercent(value) {
  if (value === null || value === undefined || isNaN(value)) {
    return '';
  }
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}