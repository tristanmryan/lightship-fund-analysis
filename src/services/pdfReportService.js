// src/services/pdfReportService.js
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getAllAssetClasses, getGroupForAssetClass } from '../data/assetClassGroups.js';
import fundRegistry from './fundRegistry.js';
import { assetClassBenchmarks } from '../data/config.js';
import { supabase } from './supabase.js';

/**
 * PDF Report Generation Service
 * Generates professional fund performance reports with Raymond James branding
 * TRANSFORMED: Professional Excel-density layout with compact tables
 */

// Report configuration with Raymond James branding - Enhanced for professional look
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
    headerBg: [68, 114, 196], // Professional blue header
    headerText: [255, 255, 255], // White text
    benchmarkBg: [255, 235, 156], // Light gold for benchmarks
    benchmarkText: [0, 0, 0], // Black text
    alternateRow: [248, 248, 248], // Very light gray
    borderColor: [217, 217, 217], // Light border
    // Performance colors for rank cells
    rankColors: {
      excellent: [198, 239, 206], // Light green - top 20%
      good: [255, 255, 199], // Light yellow - 20-40%
      average: [255, 235, 156], // Light gold - 40-60%
      belowAverage: [255, 199, 206], // Light orange - 60-80%
      poor: [255, 199, 206] // Light red - bottom 20%
    }
  },
  fontSize: {
    title: 20,
    subtitle: 16,
    heading: 12,
    sectionHeader: 11,
    body: 8,
    footer: 8
  }
};

// TRANSFORMED: Column definitions optimized for Excel-density layout
// Using ONLY available data fields with compact widths
const TABLE_COLUMNS = [
  { header: 'Ticker', dataKey: 'ticker', width: 35 },
  { header: 'Fund Name', dataKey: 'name', width: 120 },
  { header: 'YTD Return', dataKey: 'ytd_return', width: 45 },
  { header: '1Y Return', dataKey: 'one_year_return', width: 45 },
  { header: '3Y Return', dataKey: 'three_year_return', width: 45 },
  { header: '5Y Return', dataKey: 'five_year_return', width: 45 },
  { header: 'Sharpe Ratio', dataKey: 'sharpe_ratio', width: 45 },
  { header: '3Y Std Dev', dataKey: 'standard_deviation_3y', width: 45 },
  { header: '5Y Std Dev', dataKey: 'standard_deviation_5y', width: 45 },
  { header: 'Expense Ratio', dataKey: 'expense_ratio', width: 45 },
  { header: 'Manager Tenure', dataKey: 'manager_tenure', width: 45 },
  { header: 'Score', dataKey: 'score', width: 35 },
  { header: 'Rec', dataKey: 'is_recommended', width: 25 }
];

// Total width: ~580pt (fits landscape letter page with margins)

/**
 * Main export function - Generate monthly performance report PDF
 */
export async function generateMonthlyReport(data) {
  const { funds, metadata } = data;
  
  // Create new PDF document with proper autoTable plugin initialization
  const doc = new jsPDF({
    orientation: REPORT_CONFIG.orientation,
    unit: REPORT_CONFIG.unit,
    format: REPORT_CONFIG.format
  });

  // Note: autoTable plugin auto-attaches to jsPDF instances when imported

  // Use standard jsPDF fonts for reliable rendering
  doc.setFont('helvetica');

  console.log(`\n🔧 PDF Report Generation Starting...`);
  console.log(`📊 Processing ${funds.length} total funds`);
  console.log(`🎯 Professional styling enabled`);

  // Get benchmarks configuration
  let benchmarks = {};
  try {
    benchmarks = await fundRegistry.getBenchmarksByAssetClass();
    console.log(`📈 Loaded ${Object.keys(benchmarks).length} benchmarks from registry`);
  } catch (error) {
    console.log('⚠️  Registry failed, using fallback benchmarks from config');
    // Fallback to config benchmarks
    benchmarks = Object.keys(assetClassBenchmarks).reduce((acc, assetClass) => {
      acc[assetClass] = assetClassBenchmarks[assetClass];
      return acc;
    }, {});
    console.log(`📈 Using ${Object.keys(benchmarks).length} fallback benchmarks`);
  }

  // Retrieve benchmark performance data from separate table
  const benchmarkPerformanceData = await getBenchmarkPerformanceData();

  // Debug: List all available benchmarks
  console.log('\n📋 Available Benchmarks:');
  Object.entries(benchmarks).forEach(([assetClass, benchmark]) => {
    console.log(`  ${assetClass}: ${benchmark.ticker} (${benchmark.name})`);
  });

  // Add cover page
  addCoverPage(doc, metadata);

  // Start a new page for report tables
  doc.addPage();

  // Filter funds to only include those with meaningful performance data
  const fundsWithData = funds.filter(fund => {
    // Must have at least one key performance metric
    return fund.ytd_return != null || 
           fund.one_year_return != null || 
           fund.three_year_return != null || 
           fund.five_year_return != null;
  });

  console.log(`📊 Filtered ${funds.length} funds down to ${fundsWithData.length} with performance data`);

  // Add missing benchmark ETFs with real performance data
  const enhancedFundsWithBenchmarks = addMissingBenchmarks(fundsWithData, benchmarks, benchmarkPerformanceData);
  console.log(`📈 Enhanced dataset: ${enhancedFundsWithBenchmarks.length} funds (includes real benchmarks)`);

  // Group funds by asset class using predefined order  
  const fundsByClass = groupFundsByAssetClassOrdered(enhancedFundsWithBenchmarks);

  // Add each asset class section with enhanced benchmark detection
  for (const [assetClass, classFunds] of Object.entries(fundsByClass)) {
    if (classFunds.length === 0) continue;

    // Enhanced benchmark detection logic
    const { enhancedFunds, benchmarkFund } = findAndMarkBenchmarks(classFunds, assetClass, benchmarks);
    
    if (benchmarkFund) {
      console.log(`✅ ${assetClass}: Found benchmark ${benchmarkFund.ticker}`);
    }

    // Add asset class table with enhanced fund data
    await addAssetClassTable(doc, assetClass, enhancedFunds, benchmarkFund);
  }

  // Add page numbers and professional footer
  addPageNumbers(doc, doc.getNumberOfPages());
  
  return doc;
}

/**
 * Retrieve benchmark performance data from separate benchmark_performance table
 */
async function getBenchmarkPerformanceData() {
  try {
    const { data, error } = await supabase
      .from('benchmark_performance')
      .select('*')
      .order('date', { ascending: false });

    if (error) {
      console.warn('Failed to retrieve benchmark performance data:', error);
      return {};
    }

    // Group by ticker and get most recent entry for each
    const benchmarkData = {};
    data?.forEach(record => {
      const ticker = record.benchmark_ticker;
      if (!benchmarkData[ticker] || new Date(record.date) > new Date(benchmarkData[ticker].date)) {
        benchmarkData[ticker] = record;
      }
    });

    console.log(`💾 Retrieved performance data for ${Object.keys(benchmarkData).length} benchmark tickers`);
    return benchmarkData;
  } catch (error) {
    console.warn('Error retrieving benchmark performance data:', error);
    return {};
  }
}

/**
 * Add missing benchmark ETFs with real performance data from separate table
 */
function addMissingBenchmarks(funds, benchmarks, benchmarkPerformanceData) {
  const existingTickers = new Set(funds.map(f => f.ticker?.toUpperCase()));
  const realBenchmarks = [];
  
  // Check each configured benchmark
  Object.entries(benchmarks).forEach(([assetClass, benchmark]) => {
    if (!benchmark?.ticker) return;
    
    const benchmarkTicker = benchmark.ticker.toUpperCase();
    
    // If benchmark ETF is missing from the dataset, add real performance data
    if (!existingTickers.has(benchmarkTicker)) {
      const performanceData = benchmarkPerformanceData[benchmarkTicker];
      
      if (performanceData) {
        console.log(`📈 Adding benchmark with real data: ${benchmarkTicker} for ${assetClass}`);
        
        const realBenchmark = {
          ticker: benchmarkTicker,
          name: `${benchmark.name} (Benchmark)`,
          asset_class: assetClass,
          asset_class_name: assetClass,
          // Use real performance data from benchmark_performance table
          ytd_return: performanceData.ytd_return,
          one_year_return: performanceData.one_year_return,
          three_year_return: performanceData.three_year_return,
          five_year_return: performanceData.five_year_return,
          ten_year_return: performanceData.ten_year_return,
          expense_ratio: performanceData.expense_ratio,
          sharpe_ratio: performanceData.sharpe_ratio,
          alpha: performanceData.alpha,
          beta: performanceData.beta,
          standard_deviation_3y: performanceData.standard_deviation_3y,
          standard_deviation_5y: performanceData.standard_deviation_5y,
          up_capture_ratio: performanceData.up_capture_ratio,
          down_capture_ratio: performanceData.down_capture_ratio,
          date: performanceData.date,
          score: null, // Benchmarks don't get scores
          scores: { final: null },
          manager_tenure: null,
          is_recommended: false,
          is_benchmark: true,
          real_benchmark_data: true
        };
        
        realBenchmarks.push(realBenchmark);
        existingTickers.add(benchmarkTicker);
      } else {
        console.log(`⚠️  No performance data found for benchmark: ${benchmarkTicker}`);
      }
    }
  });
  
  console.log(`📈 Added ${realBenchmarks.length} benchmarks with real performance data`);
  
  // Return combined dataset
  return [...funds, ...realBenchmarks];
}

/**
 * Enhanced benchmark detection and marking logic
 */
function findAndMarkBenchmarks(classFunds, assetClass, benchmarks) {
  const benchmark = benchmarks[assetClass];
  let benchmarkFund = null;
  
  if (!benchmark) {
    return {
      enhancedFunds: classFunds.map(f => ({ ...f, is_benchmark: false })),
      benchmarkFund: null
    };
  }

  // Create enhanced benchmark detection criteria
  const benchmarkTickers = new Set([
    benchmark.ticker?.toUpperCase(),
    benchmark.ticker?.toUpperCase().replace(/\s/g, ''), // Remove spaces
  ].filter(Boolean));

  // Enhanced name matching - multiple strategies
  const nameMatches = [
    benchmark.name?.toLowerCase(),
    benchmark.name?.toLowerCase().split(' ')[0], // First word
    benchmark.ticker?.toLowerCase()
  ].filter(Boolean);

  const enhancedFunds = classFunds.map(fund => {
    // Exact ticker match (primary)
    let isActualBenchmark = benchmarkTickers.has(fund.ticker?.toUpperCase());
    
    // Enhanced name matching (secondary)
    if (!isActualBenchmark && fund.name && nameMatches.length > 0) {
      const fundNameLower = fund.name.toLowerCase();
      isActualBenchmark = nameMatches.some(matchName => {
        return (matchName.length >= 4 && fundNameLower.includes(matchName)) ||
               (fund.ticker?.toLowerCase() === matchName);
      });
    }

    // Special case for ETF benchmarks - often the fund IS the benchmark
    if (!isActualBenchmark && fund.ticker === benchmark.ticker) {
      isActualBenchmark = true;
    }

    if (isActualBenchmark && !benchmarkFund) {
      benchmarkFund = { ...fund, is_benchmark: true };
    }
    
    return { ...fund, is_benchmark: isActualBenchmark };
  });

  return { enhancedFunds, benchmarkFund };
}

/**
 * Add cover page to PDF with Raymond James branding
 */
function addCoverPage(doc, metadata) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Raymond James branding
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...REPORT_CONFIG.colors.primary);
  doc.text('Raymond James', pageWidth / 2, 120, { align: 'center' });
  
  doc.setFontSize(20);
  doc.setFont('helvetica', 'normal');
  doc.text('Lightship Wealth Strategies', pageWidth / 2, 150, { align: 'center' });
  
  doc.setFontSize(16);
  doc.text('Recommended List Performance', pageWidth / 2, 170, { align: 'center' });
  
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
  
  // TRANSFORMED: Summary content for professional Excel-density format
  doc.setFontSize(12);
  doc.setTextColor(50, 50, 50);
  const summaryY = 270;
  const lineHeight = 25;
  
  doc.text(`Total Funds: ${metadata?.totalFunds || 0}`, pageWidth / 2, summaryY, { align: 'center' });
  doc.text(`Recommended: ${metadata?.recommendedFunds || 0}`, pageWidth / 2, summaryY + lineHeight, { align: 'center' });
  doc.text(`Asset Classes: ${metadata?.assetClassCount || 0}`, pageWidth / 2, summaryY + lineHeight * 2, { align: 'center' });
  doc.text(`Report Date: ${metadata?.date || 'N/A'}`, pageWidth / 2, summaryY + lineHeight * 3, { align: 'center' });
  
  // Footer
  doc.setFontSize(10);
  doc.setTextColor(150, 150, 150);
  doc.text('This report is for internal use only', pageWidth / 2, pageHeight - 40, { align: 'center' });
}

/**
 * Group funds by asset class in predefined order
 */
function groupFundsByAssetClassOrdered(funds) {
  const grouped = {};
  
  // Initialize all asset classes from config
  const allAssetClasses = getAllAssetClasses();
  allAssetClasses.forEach(assetClass => {
    grouped[assetClass] = [];
  });
  
  // Group funds by asset class
  funds.forEach(fund => {
    const assetClass = fund.asset_class || fund.asset_class_name || 'Unassigned';
    if (!grouped[assetClass]) {
      grouped[assetClass] = [];
    }
    grouped[assetClass].push(fund);
  });
  
  // Sort funds within each asset class by score (highest first), then by name
  Object.keys(grouped).forEach(assetClass => {
    grouped[assetClass].sort((a, b) => {
      // Sort by score first (highest first)
      if (a.score !== b.score) {
        return (b.score || 0) - (a.score || 0);
      }
      // Then by name
      return (a.name || '').localeCompare(b.name || '');
    });
  });
  
  return grouped;
}

/**
 * Add asset class table to PDF with benchmark integration
 */
async function addAssetClassTable(doc, assetClass, funds, benchmarkFund) {
  let startY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 20 : REPORT_CONFIG.margins.top; // TRANSFORMED: Reduced spacing between asset classes

  // Prepare fund data (exclude funds that are marked as benchmarks from regular list)
  const regularFunds = funds.filter(f => !f.is_benchmark);
  const tableData = regularFunds.map((fund, index) => prepareRowData(fund, index + 1, regularFunds.length));

  // Add benchmark row at the bottom (only if we found one)
  if (benchmarkFund) {
    const benchmarkRow = prepareBenchmarkRowData(benchmarkFund);
    tableData.push(benchmarkRow);
  }

  // TRANSFORMED: Enhanced page break logic for Excel-density layout
  // Fit 3-4 asset class sections per page with compact spacing
  const pageHeight = doc.internal.pageSize.getHeight();
  const remainingSpace = pageHeight - REPORT_CONFIG.margins.bottom - startY;
  const estimatedTableHeight = (tableData.length + 1) * 10 + 20; // Further reduced spacing for density
  
  // More aggressive page breaks to fit multiple asset classes per page
  if (remainingSpace < estimatedTableHeight && remainingSpace < 80) {
    doc.addPage();
    startY = REPORT_CONFIG.margins.top;
  }

  // Asset class header with enhanced professional styling
  const groupName = getGroupForAssetClass(assetClass);
  const fundCount = regularFunds.length;
  const benchmarkCount = benchmarkFund ? 1 : 0;
  
  // TRANSFORMED: Compact professional header box for Excel-density layout
  const pageWidth = doc.internal.pageSize.getWidth();
  const headerHeight = 16; // Reduced height for density
  const headerWidth = pageWidth - REPORT_CONFIG.margins.left - REPORT_CONFIG.margins.right;
  
  // Header background
  doc.setFillColor(...REPORT_CONFIG.colors.headerBg);
  doc.rect(REPORT_CONFIG.margins.left, startY - 2, headerWidth, headerHeight, 'F');
  
  // Asset class title
  doc.setFontSize(REPORT_CONFIG.fontSize.sectionHeader);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...REPORT_CONFIG.colors.headerText);
  doc.text(`${assetClass}`, REPORT_CONFIG.margins.left + 5, startY + 10);
  
  // Fund count information on the right
  const infoText = `${fundCount} fund${fundCount !== 1 ? 's' : ''}${benchmarkCount > 0 ? ' + benchmark' : ''}`;
  const infoWidth = doc.getTextWidth(infoText);
  doc.setFontSize(REPORT_CONFIG.fontSize.body);
  doc.text(infoText, pageWidth - REPORT_CONFIG.margins.right - infoWidth - 5, startY + 10);
  
  // Update startY to account for header
  startY += headerHeight + 3; // Reduced spacing for density
  
  // Generate table with enhanced styling and improved error handling
  try {
    // Check if autoTable is available
    if (!doc.autoTable || typeof doc.autoTable !== 'function') {
      throw new Error('autoTable plugin not available');
    }
    
    // Ensure table data is properly formatted
    const formattedTableData = tableData.map(row => {
      const formattedRow = {};
      TABLE_COLUMNS.forEach(col => {
        formattedRow[col.dataKey] = String(row[col.dataKey] || '');
      });
      formattedRow.is_benchmark = row.is_benchmark || false;
      return formattedRow;
    });
    
    doc.autoTable({
      startY: startY,
      head: [TABLE_COLUMNS.map(col => col.header)],
      body: formattedTableData.map(row => TABLE_COLUMNS.map(col => row[col.dataKey])),
      styles: {
        font: 'helvetica',
        fontSize: REPORT_CONFIG.fontSize.body,
        cellPadding: 2, // TRANSFORMED: Reduced padding for density
        lineColor: REPORT_CONFIG.colors.borderColor,
        lineWidth: 0.5,
        overflow: 'linebreak',
        minCellHeight: 10, // TRANSFORMED: Reduced cell height for density
        textColor: [0, 0, 0]
      },
      headStyles: {
        fillColor: REPORT_CONFIG.colors.headerBg,
        textColor: REPORT_CONFIG.colors.headerText,
        fontSize: REPORT_CONFIG.fontSize.body,
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle',
        cellPadding: 3, // TRANSFORMED: Reduced header padding for density
        minCellHeight: 12 // TRANSFORMED: Reduced header height for density
      },
      bodyStyles: {
        fontSize: REPORT_CONFIG.fontSize.body,
        cellPadding: 2, // TRANSFORMED: Reduced padding for density
        valign: 'middle',
        lineColor: REPORT_CONFIG.colors.borderColor,
        lineWidth: 0.5
      },
      alternateRowStyles: {
        fillColor: REPORT_CONFIG.colors.alternateRow
      },
      columnStyles: {
        0: { cellWidth: 35, halign: 'center' },      // Ticker
        1: { cellWidth: 120, halign: 'left' },       // Fund Name
        2: { cellWidth: 45, halign: 'right' },       // YTD Return
        3: { cellWidth: 45, halign: 'right' },       // 1Y Return
        4: { cellWidth: 45, halign: 'right' },       // 3Y Return
        5: { cellWidth: 45, halign: 'right' },       // 5Y Return
        6: { cellWidth: 45, halign: 'right' },       // Sharpe Ratio
        7: { cellWidth: 45, halign: 'right' },       // 3Y Std Dev
        8: { cellWidth: 45, halign: 'right' },       // 5Y Std Dev
        9: { cellWidth: 45, halign: 'right' },       // Expense Ratio
        10: { cellWidth: 45, halign: 'right' },      // Manager Tenure
        11: { cellWidth: 35, halign: 'right' },      // Score
        12: { cellWidth: 25, halign: 'center' }      // Rec
      },
      showHead: 'everyPage',
      willDrawPage: function(data) {
        if (data.pageNumber > 1 && data.pageCount > 1) {
          doc.setFontSize(REPORT_CONFIG.fontSize.heading);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...REPORT_CONFIG.colors.primary);
          doc.text(assetClass + ' (continued)', REPORT_CONFIG.margins.left, REPORT_CONFIG.margins.top - 10);
        }
      },
      didDrawCell: function(data) {
        if (data.section !== 'body') return;
        
        const rowIndex = data.row.index;
        const rowData = formattedTableData[rowIndex];
        
        // Professional benchmark row highlighting - more subtle than before
        if (rowData && rowData.is_benchmark) {
          data.cell.styles.fillColor = REPORT_CONFIG.colors.benchmarkBg;
          data.cell.styles.textColor = [0, 0, 0];
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.lineColor = REPORT_CONFIG.colors.borderColor;
          data.cell.styles.lineWidth = 1; // Slightly thicker border for benchmarks
          return; // Don't apply other styling to benchmark rows
        }
        
        // Clean styling for recommended funds (column 12 = 'is_recommended')
        if (data.column.index === 12) {
          const cellValue = data.cell.text[0];
          if (cellValue === '✓') {
            data.cell.styles.fillColor = REPORT_CONFIG.colors.rankColors.excellent;
            data.cell.styles.textColor = [0, 128, 0]; // Green checkmark
            data.cell.styles.fontStyle = 'bold';
          }
        }
        
        // Subtle performance ranking colors (column 11 = 'score')
        if (data.column.index === 11) {
          const scoreStr = data.cell.text[0] || '';
          const score = parseFloat(scoreStr);
          
          if (!isNaN(score)) {
            if (score >= 70) {
              data.cell.styles.fillColor = REPORT_CONFIG.colors.rankColors.excellent;
            } else if (score >= 60) {
              data.cell.styles.fillColor = REPORT_CONFIG.colors.rankColors.good;
            } else if (score >= 50) {
              data.cell.styles.fillColor = REPORT_CONFIG.colors.rankColors.average;
            } else if (score >= 40) {
              data.cell.styles.fillColor = REPORT_CONFIG.colors.rankColors.belowAverage;
            } else {
              data.cell.styles.fillColor = REPORT_CONFIG.colors.rankColors.poor;
            }
            
            data.cell.styles.textColor = [0, 0, 0];
          }
        }
      },
      margin: { 
        left: REPORT_CONFIG.margins.left, 
        right: REPORT_CONFIG.margins.right 
      }
    });
  } catch (error) {
    console.warn(`AutoTable failed for ${assetClass}, using fallback:`, error.message);
    // Fallback: create a simple text-based table
    createFallbackTable(doc, assetClass, tableData, startY + 18);
  }
}

/**
 * Create a fallback table when autoTable is not available
 */
function createFallbackTable(doc, assetClass, tableData, startY) {
  
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = REPORT_CONFIG.margins.left;
  const tableWidth = pageWidth - margin - REPORT_CONFIG.margins.right;
  const colWidth = tableWidth / TABLE_COLUMNS.length;
  const rowHeight = 10; // TRANSFORMED: Reduced row height for density
  
  // Draw header
  doc.setFillColor(...REPORT_CONFIG.colors.headerBg);
  doc.setTextColor(...REPORT_CONFIG.colors.headerText);
  doc.setFontSize(REPORT_CONFIG.fontSize.body);
  doc.setFont('helvetica', 'bold');
  
  let currentY = startY;
  
  // Draw header row background
  doc.rect(margin, currentY, tableWidth, rowHeight, 'F');
  
  // Draw header row borders and text
  TABLE_COLUMNS.forEach((col, index) => {
    const x = margin + (index * colWidth);
    doc.setDrawColor(200, 200, 200);
    doc.rect(x, currentY, colWidth, rowHeight, 'S');
    
    // Truncate header text to fit column
    let headerText = col.header;
    if (doc.getTextWidth(headerText) > colWidth - 4) {
      while (doc.getTextWidth(headerText + '...') > colWidth - 4 && headerText.length > 0) {
        headerText = headerText.slice(0, -1);
      }
      headerText += '...';
    }
    
    doc.text(headerText, x + 2, currentY + 6);
  });
  
  currentY += rowHeight;
  
  // Draw data rows
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  
  tableData.forEach((row, rowIndex) => {
    // Check if we need a new page
    if (currentY > doc.internal.pageSize.getHeight() - 60) {
      doc.addPage();
      currentY = REPORT_CONFIG.margins.top;
      
      // Redraw header on new page
      doc.setFillColor(...REPORT_CONFIG.colors.headerBg);
      doc.setTextColor(...REPORT_CONFIG.colors.headerText);
      doc.setFont('helvetica', 'bold');
      doc.rect(margin, currentY, tableWidth, rowHeight, 'F');
      
      TABLE_COLUMNS.forEach((col, index) => {
        const x = margin + (index * colWidth);
        doc.setDrawColor(200, 200, 200);
        doc.rect(x, currentY, colWidth, rowHeight, 'S');
        doc.text(col.header, x + 2, currentY + 8);
      });
      
      currentY += rowHeight;
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
    }
    
    // Alternate row colors
    if (rowIndex % 2 === 1) {
      doc.setFillColor(...REPORT_CONFIG.colors.alternateRow);
      doc.rect(margin, currentY, tableWidth, rowHeight, 'F');
    }
    
    // Highlight benchmark rows
    if (row.is_benchmark) {
      doc.setFillColor(...REPORT_CONFIG.colors.benchmarkBg);
      doc.rect(margin, currentY, tableWidth, rowHeight, 'F');
      doc.setFont('helvetica', 'bold');
    }
    
    // TRANSFORMED: Draw row data with borders and text truncation for new column structure
    TABLE_COLUMNS.forEach((col, colIndex) => {
      const x = margin + (colIndex * colWidth);
      
      // Draw cell border
      doc.setDrawColor(200, 200, 200);
      doc.rect(x, currentY, colWidth, rowHeight, 'S');
      
      // Get and truncate cell value
      let cellValue = String(row[col.dataKey] || '');
      if (doc.getTextWidth(cellValue) > colWidth - 4) {
        while (doc.getTextWidth(cellValue + '...') > colWidth - 4 && cellValue.length > 0) {
          cellValue = cellValue.slice(0, -1);
        }
        cellValue += '...';
      }
      
      // Adjust text position for reduced row height
      doc.text(cellValue, x + 2, currentY + 6);
    });
    
    // Reset font weight after benchmark rows
    if (row.is_benchmark) {
      doc.setFont('helvetica', 'normal');
    }
    
    currentY += rowHeight;
  });
  
  // Update lastAutoTable position for next table
  doc.lastAutoTable = { finalY: currentY };
}

/**
 * Prepare row data for a fund
 * TRANSFORMED: Updated to match new Excel-density column structure
 */
function prepareRowData(fund, rank, totalInClass) {
  return {
    ticker: fund.ticker || fund.Symbol || '',
    name: truncateName(fund.name || fund['Fund Name'] || ''),
    ytd_return: formatPercent(fund.ytd_return || fund['YTD']),
    one_year_return: formatPercent(fund.one_year_return || fund['1 Year']),
    three_year_return: formatPercent(fund.three_year_return || fund['3 Year']),
    five_year_return: formatPercent(fund.five_year_return || fund['5 Year']),
    sharpe_ratio: formatNumber(fund.sharpe_ratio || fund['Sharpe Ratio'], 2),
    standard_deviation_3y: formatPercent(fund.standard_deviation_3y || fund['StdDev3Y']),
    standard_deviation_5y: formatPercent(fund.standard_deviation_5y || fund['StdDev5Y']),
    expense_ratio: formatPercent(fund.expense_ratio || fund['Net Expense Ratio']),
    manager_tenure: formatTenure(fund.manager_tenure || fund['Manager Tenure']),
    score: formatScore(fund.scores?.final || fund.score),
    is_recommended: fund.is_recommended ? '✓' : '',
    is_benchmark: fund.is_benchmark || false
  };
}

/**
 * Prepare benchmark row data
 * TRANSFORMED: Updated to match new Excel-density column structure
 */
function prepareBenchmarkRowData(benchmarkFund) {
  const hasRealData = benchmarkFund.real_benchmark_data;
  
  return {
    ticker: benchmarkFund.ticker || '',
    name: `${truncateName(benchmarkFund.name || '')}`,
    ytd_return: hasRealData ? formatPercent(benchmarkFund.ytd_return) : '--',
    one_year_return: hasRealData ? formatPercent(benchmarkFund.one_year_return) : '--',
    three_year_return: hasRealData ? formatPercent(benchmarkFund.three_year_return) : '--',
    five_year_return: hasRealData ? formatPercent(benchmarkFund.five_year_return) : '--',
    sharpe_ratio: hasRealData ? formatNumber(benchmarkFund.sharpe_ratio, 2) : '--',
    standard_deviation_3y: hasRealData ? formatPercent(benchmarkFund.standard_deviation_3y) : '--',
    standard_deviation_5y: hasRealData ? formatPercent(benchmarkFund.standard_deviation_5y) : '--',
    expense_ratio: hasRealData ? formatPercent(benchmarkFund.expense_ratio) : '--',
    manager_tenure: '--',
    score: '--',
    is_recommended: '',
    is_benchmark: true
  };
}



/**
 * Format percentage values
 */
function formatPercent(value) {
  if (value === null || value === undefined || isNaN(value)) {
    return '--';
  }
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
}

/**
 * Format number values
 */
function formatNumber(value, decimals = 1) {
  if (value === null || value === undefined || isNaN(value)) {
    return '--';
  }
  return value.toFixed(decimals);
}

/**
 * Format score values
 */
function formatScore(value) {
  if (value === null || value === undefined || isNaN(value)) {
    return '--';
  }
  return value.toFixed(1);
}

/**
 * Format manager tenure
 */
function formatTenure(value) {
  if (value === null || value === undefined || isNaN(value)) {
    return '--';
  }
  const years = Math.floor(value);
  const months = Math.round((value - years) * 12);
  if (years === 0) {
    return `${months}m`;
  } else if (months === 0) {
    return `${years}y`;
  } else {
    return `${years}y ${months}m`;
  }
}

/**
 * Truncate fund names for better display
 */
function truncateName(name, maxLength = 35) {
  if (!name || name.length <= maxLength) {
    return name;
  }
  return name.substring(0, maxLength - 3) + '...';
}

/**
 * Add professional page numbers and footers to all pages
 */
function addPageNumbers(doc, totalPages) {
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // Skip footer on cover page
    if (i === 1) continue;
    
    // Professional footer
    doc.setFontSize(REPORT_CONFIG.fontSize.footer);
    doc.setTextColor(100, 100, 100);
    
    // Left side - Report identifier
    doc.text('Raymond James | Lightship Wealth Strategies', REPORT_CONFIG.margins.left, pageHeight - 20);
    
    // Center - Page numbers
    doc.text(
      `Page ${i - 1} of ${totalPages - 1}`, // Subtract 1 to exclude cover page
      pageWidth / 2, 
      pageHeight - 20, 
      { align: 'center' }
    );
    
    // Right side - Generation timestamp
    const timestamp = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    doc.text(timestamp, pageWidth - REPORT_CONFIG.margins.right, pageHeight - 20, { align: 'right' });
    
    // Footer line
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(
      REPORT_CONFIG.margins.left, 
      pageHeight - 30, 
      pageWidth - REPORT_CONFIG.margins.right, 
      pageHeight - 30
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

  // Note: autoTable plugin auto-attaches to jsPDF instances when imported

  // Use standard jsPDF fonts for reliable rendering
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