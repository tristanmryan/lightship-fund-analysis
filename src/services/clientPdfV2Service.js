/**
 * Client-side Professional PDF Generation (Development Mode)
 * Uses enhanced jsPDF with professional styling for development environment
 * Production will use server-side Puppeteer rendering
 */

import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { shapeReportData } from '../reports/monthly/data/shapeData.js';
import { getReportTheme } from '../reports/monthly/theme/tokens.js';

/**
 * Generate professional PDF using client-side rendering (development fallback)
 * @param {Object} data - Report data
 * @param {Object} options - PDF generation options
 * @returns {Blob} PDF blob
 */
export async function generateClientSideProfessionalPDF(data, options = {}) {
  console.log('🎨 Generating professional PDF client-side...');
  
  // Shape the data using the same service as server-side
  const payload = {
    asOf: data.metadata?.asOf || window.__AS_OF_MONTH__ || null,
    selection: {
      scope: options.scope || 'all',
      tickers: options.tickers || null
    },
    options: {
      columns: options.columns || [
        'ticker', 'name', 'asset_class', 'ytd_return', 'one_year_return',
        'three_year_return', 'five_year_return', 'expense_ratio', 'sharpe_ratio',
        'standard_deviation_3y', 'standard_deviation_5y', 'manager_tenure', 'is_recommended'
      ],
      brand: 'RJ',
      locale: 'en-US',
      landscape: options.landscape !== false,
      includeTOC: options.includeTOC !== false
    }
  };

  try {
    // Use the same data shaping logic
    const shapedData = await shapeReportData(payload);
    const theme = getReportTheme();
    
    console.log('📋 Shaped data:', shapedData);
    console.log('🎨 Using theme:', theme);

    // Create professional PDF
    const pdf = await createProfessionalPDF(shapedData, theme, options);
    
    // Convert to blob
    const pdfBlob = pdf.output('blob');
    console.log(`✅ Professional PDF generated client-side: ${pdfBlob.size} bytes`);
    
    return pdfBlob;
  } catch (error) {
    console.error('❌ Error generating professional PDF:', error);
    
    // Fallback to basic table if professional generation fails
    console.log('🔄 Falling back to basic table PDF...');
    return await generateBasicTablePDF(data, options);
  }
}

/**
 * Create professional PDF with Raymond James branding
 * @param {Object} shapedData - Shaped report data
 * @param {Object} theme - Theme configuration
 * @param {Object} options - PDF options
 * @returns {jsPDF} PDF document
 */
async function createProfessionalPDF(shapedData, theme, options = {}) {
  const { landscape = true } = options;
  
  // Create PDF with professional settings
  const pdf = new jsPDF({
    orientation: landscape ? 'landscape' : 'portrait',
    unit: 'pt',
    format: 'letter',
    putOnlyUsedFonts: true,
    compress: true
  });

  // Set document properties
  pdf.setProperties({
    title: 'Raymond James Monthly Fund Analysis',
    subject: `Fund Performance Report - ${shapedData.asOf || 'Latest'}`,
    author: 'Raymond James',
    keywords: 'fund analysis, performance, investment',
    creator: 'Lightship Fund Analysis'
  });

  let currentY = 50;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const marginLeft = 40;
  const marginRight = 40;
  const contentWidth = pageWidth - marginLeft - marginRight;

  // Add cover page
  currentY = addCoverPage(pdf, shapedData, theme, currentY, pageWidth, pageHeight);

  // Add table of contents (if enabled)
  if (options.includeTOC) {
    pdf.addPage();
    currentY = 50;
    currentY = addTableOfContents(pdf, shapedData, theme, currentY, marginLeft, contentWidth);
  }

  // Add executive summary
  pdf.addPage();
  currentY = 50;
  currentY = addExecutiveSummary(pdf, shapedData, theme, currentY, marginLeft, contentWidth);

  // Add asset class sections
  for (const section of shapedData.sections) {
    pdf.addPage();
    currentY = 50;
    currentY = await addAssetClassSection(pdf, section, theme, currentY, marginLeft, contentWidth, pageHeight);
  }

  return pdf;
}

/**
 * Add professional cover page
 */
function addCoverPage(pdf, data, theme, startY, pageWidth, pageHeight) {
  const centerX = pageWidth / 2;
  
  // Raymond James header
  pdf.setFillColor(0, 47, 108); // Raymond James Blue
  pdf.rect(0, 0, pageWidth, 80, 'F');
  
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(28);
  pdf.setFont('helvetica', 'bold');
  pdf.text('RAYMOND JAMES', centerX, 35, { align: 'center' });
  
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Monthly Fund Analysis Report', centerX, 55, { align: 'center' });

  // Report title and date
  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(24);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Fund Performance Analysis', centerX, 150, { align: 'center' });
  
  if (data.asOf) {
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`As of ${new Date(data.asOf).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })}`, centerX, 175, { align: 'center' });
  }

  // Summary statistics
  const statsY = 220;
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Report Summary', centerX, statsY, { align: 'center' });

  const stats = [
    ['Total Funds Analyzed', data.totalFunds?.toString() || 'N/A'],
    ['Recommended Funds', data.recommendedFunds?.toString() || 'N/A'],
    ['Asset Classes', data.sections?.length?.toString() || 'N/A'],
    ['Report Generated', new Date().toLocaleDateString('en-US')]
  ];

  pdf.autoTable({
    startY: statsY + 30,
    body: stats,
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 150 },
      1: { cellWidth: 100 }
    },
    styles: {
      fontSize: 12,
      cellPadding: 8,
      halign: 'center'
    },
    margin: { left: centerX - 125, right: centerX - 125 }
  });

  // Footer disclaimer
  pdf.setFontSize(8);
  pdf.setTextColor(100, 100, 100);
  pdf.text('This report is for informational purposes only and does not constitute investment advice.', 
    centerX, pageHeight - 30, { align: 'center' });

  return pageHeight;
}

/**
 * Add table of contents
 */
function addTableOfContents(pdf, data, theme, startY, marginLeft, contentWidth) {
  let currentY = startY;
  
  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(0, 47, 108);
  pdf.text('Table of Contents', marginLeft, currentY);
  currentY += 40;

  const tocItems = [
    ['Executive Summary', '3'],
    ...data.sections.map((section, index) => [
      `${section.assetClass} (${section.funds.length} funds)`,
      (4 + index).toString()
    ])
  ];

  pdf.autoTable({
    startY: currentY,
    body: tocItems,
    columnStyles: {
      0: { cellWidth: contentWidth - 60 },
      1: { cellWidth: 60, halign: 'right' }
    },
    styles: {
      fontSize: 12,
      cellPadding: 12
    },
    margin: { left: marginLeft, right: marginLeft }
  });

  return pdf.lastAutoTable.finalY + 20;
}

/**
 * Add executive summary
 */
function addExecutiveSummary(pdf, data, theme, startY, marginLeft, contentWidth) {
  let currentY = startY;
  
  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(0, 47, 108);
  pdf.text('Executive Summary', marginLeft, currentY);
  currentY += 30;

  // Summary text
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(0, 0, 0);
  
  const summaryText = `This report analyzes ${data.totalFunds || 'N/A'} mutual funds across ${data.sections?.length || 'N/A'} asset classes. ` +
    `Performance data is as of ${data.asOf ? new Date(data.asOf).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : 'the latest available date'}. ` +
    `${data.recommendedFunds || 'N/A'} funds are currently recommended based on our proprietary analysis.`;

  const splitText = pdf.splitTextToSize(summaryText, contentWidth);
  pdf.text(splitText, marginLeft, currentY);
  currentY += splitText.length * 14 + 20;

  // Performance overview table
  if (data.sections && data.sections.length > 0) {
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Asset Class Overview', marginLeft, currentY);
    currentY += 20;

    const overviewData = data.sections.map(section => [
      section.assetClass,
      section.funds.length.toString(),
      section.benchmark?.name || 'N/A',
      section.benchmark?.ytdReturn ? `${(section.benchmark.ytdReturn * 100).toFixed(2)}%` : 'N/A'
    ]);

    pdf.autoTable({
      startY: currentY,
      head: [['Asset Class', 'Funds', 'Benchmark', 'Benchmark YTD']],
      body: overviewData,
      headStyles: {
        fillColor: [68, 114, 196],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      styles: {
        fontSize: 10,
        cellPadding: 8
      },
      margin: { left: marginLeft, right: marginLeft }
    });

    currentY = pdf.lastAutoTable.finalY + 20;
  }

  return currentY;
}

/**
 * Add asset class section with funds table and benchmark
 */
async function addAssetClassSection(pdf, section, theme, startY, marginLeft, contentWidth, pageHeight) {
  let currentY = startY;
  
  // Section header
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(0, 47, 108);
  pdf.text(`${section.assetClass}`, marginLeft, currentY);
  currentY += 10;
  
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`${section.funds.length} funds analyzed`, marginLeft, currentY);
  currentY += 30;

  // Prepare table data
  const tableHeaders = [
    'Fund Name', 'Ticker', 'YTD Return', '1-Year', '3-Year', '5-Year', 
    'Expense Ratio', 'Sharpe Ratio', 'Recommended'
  ];

  const tableData = section.funds.map(fund => [
    truncateText(fund.name || '', 25),
    fund.ticker || '',
    fund.ytdReturn != null ? `${(fund.ytdReturn * 100).toFixed(2)}%` : 'N/A',
    fund.oneYearReturn != null ? `${(fund.oneYearReturn * 100).toFixed(2)}%` : 'N/A',
    fund.threeYearReturn != null ? `${(fund.threeYearReturn * 100).toFixed(2)}%` : 'N/A',
    fund.fiveYearReturn != null ? `${(fund.fiveYearReturn * 100).toFixed(2)}%` : 'N/A',
    fund.expenseRatio != null ? `${(fund.expenseRatio * 100).toFixed(2)}%` : 'N/A',
    fund.sharpeRatio != null ? fund.sharpeRatio.toFixed(2) : 'N/A',
    fund.isRecommended ? '★' : ''
  ]);

  // Add benchmark row if available
  if (section.benchmark) {
    const benchmarkRow = [
      `BENCHMARK: ${truncateText(section.benchmark.name || section.benchmark.ticker || '', 25)}`,
      section.benchmark.ticker || '',
      section.benchmark.ytdReturn != null ? `${(section.benchmark.ytdReturn * 100).toFixed(2)}%` : 'N/A',
      section.benchmark.oneYearReturn != null ? `${(section.benchmark.oneYearReturn * 100).toFixed(2)}%` : 'N/A',
      section.benchmark.threeYearReturn != null ? `${(section.benchmark.threeYearReturn * 100).toFixed(2)}%` : 'N/A',
      section.benchmark.fiveYearReturn != null ? `${(section.benchmark.fiveYearReturn * 100).toFixed(2)}%` : 'N/A',
      'N/A', // Expense ratio not applicable for benchmarks
      'N/A', // Sharpe ratio not applicable for benchmarks
      '' // Recommended not applicable for benchmarks
    ];
    tableData.push(benchmarkRow);
  }

  // Create table
  pdf.autoTable({
    startY: currentY,
    head: [tableHeaders],
    body: tableData,
    headStyles: {
      fillColor: [68, 114, 196],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9
    },
    bodyStyles: {
      fontSize: 8
    },
    alternateRowStyles: {
      fillColor: [248, 249, 250]
    },
    columnStyles: {
      0: { cellWidth: 80 }, // Fund Name
      1: { cellWidth: 40 }, // Ticker
      2: { cellWidth: 35, halign: 'right' }, // YTD
      3: { cellWidth: 35, halign: 'right' }, // 1-Year
      4: { cellWidth: 35, halign: 'right' }, // 3-Year
      5: { cellWidth: 35, halign: 'right' }, // 5-Year
      6: { cellWidth: 35, halign: 'right' }, // Expense Ratio
      7: { cellWidth: 35, halign: 'right' }, // Sharpe Ratio
      8: { cellWidth: 30, halign: 'center' } // Recommended
    },
    margin: { left: marginLeft, right: marginLeft },
    didParseCell: function(data) {
      // Highlight benchmark row
      if (section.benchmark && data.row.index === tableData.length - 1) {
        data.cell.styles.fillColor = [255, 243, 205]; // Light gold
        data.cell.styles.fontStyle = 'bold';
      }
      
      // Highlight recommended funds
      if (data.cell.text[0] === '★') {
        data.cell.styles.textColor = [255, 194, 0]; // Gold color
        data.cell.styles.fontStyle = 'bold';
      }
    }
  });

  return pdf.lastAutoTable.finalY + 30;
}

/**
 * Fallback to basic table PDF if professional generation fails
 */
async function generateBasicTablePDF(data, options = {}) {
  console.log('📄 Generating basic table PDF as fallback...');
  
  const { funds } = data;
  const { landscape = true } = options;
  
  const pdf = new jsPDF({
    orientation: landscape ? 'landscape' : 'portrait',
    unit: 'pt',
    format: 'letter'
  });

  // Simple header
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Fund Analysis Report', 40, 40);
  
  if (data.metadata?.asOf) {
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`As of: ${data.metadata.asOf}`, 40, 60);
  }

  // Simple table
  const tableData = funds.map(fund => [
    fund.ticker || '',
    truncateText(fund.name || '', 30),
    fund.asset_class || '',
    fund.ytd_return != null ? `${(fund.ytd_return * 100).toFixed(2)}%` : 'N/A',
    fund.one_year_return != null ? `${(fund.one_year_return * 100).toFixed(2)}%` : 'N/A',
    fund.expense_ratio != null ? `${(fund.expense_ratio * 100).toFixed(2)}%` : 'N/A'
  ]);

  pdf.autoTable({
    startY: 80,
    head: [['Ticker', 'Fund Name', 'Asset Class', 'YTD Return', '1-Year Return', 'Expense Ratio']],
    body: tableData,
    styles: {
      fontSize: 8,
      cellPadding: 4
    }
  });

  const pdfBlob = pdf.output('blob');
  console.log(`✅ Basic PDF generated: ${pdfBlob.size} bytes`);
  
  return pdfBlob;
}

/**
 * Truncate text to specified length
 */
function truncateText(text, maxLength) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}