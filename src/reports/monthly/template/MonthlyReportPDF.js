/**
 * React-PDF Monthly Report Component (Node.js Compatible)
 * Professional Investment Committee PDF Reports with Raymond James Branding
 * Uses React.createElement syntax for Node.js compatibility
 */

import React from 'react';
import { 
  Document, 
  Page, 
  View, 
  Text, 
  StyleSheet,
  Font
} from '@react-pdf/renderer';

// Raymond James Professional Color Scheme and Typography
const styles = StyleSheet.create({
  // APPLE KEYNOTE: Full-width professional layout with sophisticated typography
  page: {
    size: 'LETTER',
    orientation: 'landscape',
    paddingTop: 40,
    paddingRight: 40,
    paddingBottom: 40,
    paddingLeft: 40,
    fontFamily: 'Helvetica',
    fontSize: 8,
    lineHeight: 1.2,
    color: '#1A1A1A'
  },

  // Raymond James Branding
  coverPage: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    textAlign: 'center'
  },

  brandBar: {
    width: 200,
    height: 4,
    backgroundColor: '#002F6C',
    marginBottom: 20
  },

  mainTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#002F6C',
    marginBottom: 8,
    letterSpacing: -0.5
  },

  subtitle: {
    fontSize: 20,
    fontWeight: 500,
    color: '#1F2937',
    marginBottom: 6
  },

  reportType: {
    fontSize: 16,
    fontWeight: 'normal',
    color: '#6B7280'
  },

  reportMeta: {
    marginTop: 30,
    marginBottom: 30,
    display: 'flex',
    flexDirection: 'row',
    gap: 40,
    justifyContent: 'center'
  },

  metaItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4
  },

  metaLabel: {
    fontWeight: 600,
    color: '#6B7280',
    fontSize: 9
  },

  metaValue: {
    fontWeight: 500,
    color: '#1F2937',
    fontSize: 10
  },

  summaryBox: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 24,
    marginTop: 30,
    maxWidth: 400
  },

  summaryGrid: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 16,
    justifyContent: 'space-between'
  },

  summaryItem: {
    textAlign: 'center',
    flex: '0 0 45%'
  },

  metricValue: {
    display: 'block',
    fontSize: 24,
    fontWeight: 'bold',
    color: '#002F6C',
    lineHeight: 1.2
  },

  metricLabel: {
    display: 'block',
    fontSize: 9,
    color: '#6B7280',
    marginTop: 4
  },

  // TRANSFORMED: Professional asset class section styling
  assetClassSection: {
    marginBottom: 24,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 16
  },
  
  // Compact mode for multi-section pages
  assetClassSectionCompact: {
    marginBottom: 16,
    paddingBottom: 12,
    paddingTop: 12
  },

  // APPLE KEYNOTE: Sophisticated section header with modern typography
  sectionHeader: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 24,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8'
  },
  
  // Compact mode for multi-section pages
  sectionHeaderCompact: {
    marginBottom: 18,
    paddingBottom: 8
  },

  // APPLE KEYNOTE: Sophisticated asset class title with modern typography
  assetClassTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    letterSpacing: -0.3
  },

  // APPLE KEYNOTE: Sophisticated section meta styling with modern typography
  sectionMeta: {
    fontSize: 9,
    color: '#6B7280'
  },
  
  sectionMetaText: {
    fontSize: 9,
    color: '#6B7280',
    fontWeight: '500',
    letterSpacing: 0.1
  },

  recommendedCount: {
    color: '#FFC200',
    fontWeight: 500
  },

  // APPLE KEYNOTE: Sophisticated fund table with modern depth and styling
  fundTable: {
    marginTop: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2
  },

  // APPLE KEYNOTE: Sophisticated table header with modern design
  tableHeader: {
    display: 'flex',
    flexDirection: 'row',
    backgroundColor: '#2C3E50',
    borderBottomWidth: 1,
    borderBottomColor: '#34495E',
    borderRadius: 4
  },

  tableHeaderCell: {
    color: '#FFFFFF',
    padding: 10,
    fontWeight: '600',
    fontSize: 8,
    textAlign: 'center',
    borderRightWidth: 0.5,
    borderRightColor: '#34495E',
    letterSpacing: 0.3
  },

  // APPLE KEYNOTE: Modern table row styling with subtle borders
  tableRow: {
    display: 'flex',
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E8E8E8',
    minHeight: 24
  },

  // APPLE KEYNOTE: Sophisticated alternating row colors with subtle depth
  tableRowAlternate: {
    backgroundColor: '#F8F9FA'
  },

  // APPLE KEYNOTE: Sophisticated recommended row styling with elegant accent
  tableRowRecommended: {
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
    backgroundColor: '#F1F8E9'
  },

  // APPLE KEYNOTE: Sophisticated benchmark highlighting with elegant gold styling
  benchmarkRow: {
    backgroundColor: '#FFF8E1',
    borderTopWidth: 1,
    borderTopColor: '#FFD54F',
    borderBottomWidth: 1,
    borderBottomColor: '#FFD54F',
    borderLeftWidth: 3,
    borderLeftColor: '#FFB300'
  },

  // APPLE KEYNOTE: Sophisticated table cell styling with modern design
  tableCell: {
    padding: 8,
    fontSize: 8,
    borderRightWidth: 0.5,
    borderRightColor: '#E8E8E8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    minHeight: 24
  },

  // APPLE KEYNOTE: Sophisticated benchmark cell styling with modern design
  tableCellBenchmark: {
    fontWeight: '600',
    borderRightColor: '#FFD54F',
    color: '#8D6E63'
  },

  // APPLE KEYNOTE: Full-width professional column layout optimized for landscape letter
  colTicker: { width: 45, textAlign: 'center' },
  colName: { width: 180, textAlign: 'left' },
  colYtd: { width: 55, textAlign: 'right' },
  col1y: { width: 55, textAlign: 'right' },
  col3y: { width: 55, textAlign: 'right' },
  col5y: { width: 55, textAlign: 'right' },
  colSharpe: { width: 55, textAlign: 'right' },
  colStdDev3y: { width: 55, textAlign: 'right' },
  colStdDev5y: { width: 55, textAlign: 'right' },
  colExpense: { width: 55, textAlign: 'right' },
  colTenure: { width: 55, textAlign: 'right' },
  colScore: { width: 45, textAlign: 'right' },
  colRec: { width: 35, textAlign: 'center' },

  // APPLE KEYNOTE: Sophisticated performance color coding with modern palette
  rankExcellent: { backgroundColor: '#E8F5E8' },
  rankGood: { backgroundColor: '#FFF8E1' },
  rankAverage: { backgroundColor: '#FFF3E0' },
  rankBelowAverage: { backgroundColor: '#FFEBEE' },
  rankPoor: { backgroundColor: '#FFEBEE' },

  // APPLE KEYNOTE: Sophisticated numeric text styling with modern typography
  numericText: {
    fontFamily: 'Helvetica',
    fontVariant: 'tabular-nums',
    fontWeight: '500',
    color: '#1A1A1A'
  },

  // APPLE KEYNOTE: Sophisticated return color coding with modern palette
  positiveReturn: { color: '#2E7D32' },
  negativeReturn: { color: '#C62828' },
  neutralReturn: { color: '#5A5A5A' },

  // APPLE KEYNOTE: Sophisticated recommendation checkmark with modern styling
  recommendedCheck: {
    color: '#4CAF50',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center'
  },
  
  // APPLE KEYNOTE: Sophisticated fund name styling with modern typography
  fundNameText: {
    fontSize: 8,
    fontWeight: '500',
    color: '#1A1A1A',
    lineHeight: 1.3
  },

  // APPLE KEYNOTE: Sophisticated page footer with modern design
  pageFooter: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    fontSize: 8,
    color: '#8A8A8A',
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
    paddingTop: 8,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },

  footerLeft: {
    display: 'flex',
    flexDirection: 'column',
    lineHeight: 1.3
  },

  footerCenter: {
    textAlign: 'center'
  },

  footerRight: {
    textAlign: 'right',
    display: 'flex',
    flexDirection: 'column',
    lineHeight: 1.3
  },

  // APPLE KEYNOTE: Sophisticated page header with modern design
  pageHeader: {
    position: 'absolute',
    top: 15,
    left: 40,
    right: 40,
    fontSize: 9,
    color: '#5A5A5A',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
    paddingBottom: 8,
    marginBottom: 8,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },

  headerTitle: {
    fontWeight: 500,
    color: '#002F6C'
  },

  headerDate: {
    fontSize: 8,
    color: '#9CA3AF'
  },

  // Disclaimer
  disclaimerSection: {
    marginTop: 40,
    padding: 24,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 4
  },

  disclaimerContent: {
    lineHeight: 1.5,
    marginBottom: 12
  },

  disclaimerFooter: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#D1D5DB',
    textAlign: 'center',
    fontSize: 8,
    color: '#9CA3AF'
  }
});

/**
 * Smart layout function to group multiple asset classes per page
 * Calculates optimal section heights and groups for professional appearance
 */
function renderAssetClassPages(sections, asOf) {
  // APPLE KEYNOTE: Defensive programming with comprehensive data validation
  if (!sections || !Array.isArray(sections) || sections.length === 0) {
    console.warn('Invalid sections data:', sections);
    return []; // Return empty array if no valid sections
  }
  
  const pages = [];
  let currentPage = [];
  let currentPageHeight = 0;
  
  // APPLE KEYNOTE: Sophisticated layout constants optimized for full-width design
  const PAGE_HEIGHT = 612; // Letter landscape height in points
  const HEADER_HEIGHT = 60; // Apple-quality page header height
  const FOOTER_HEIGHT = 45; // Apple-quality page footer height
  const SECTION_HEADER_HEIGHT = 28; // Apple-quality asset class header height
  const TABLE_HEADER_HEIGHT = 22; // Apple-quality table header height
  const ROW_HEIGHT = 24; // Apple-quality fund row height
  const SECTION_SPACING = 16; // Apple-quality spacing between sections
  const AVAILABLE_HEIGHT = PAGE_HEIGHT - HEADER_HEIGHT - FOOTER_HEIGHT - 80; // Apple-quality page margins
  
  sections.forEach((section, index) => {
    // APPLE KEYNOTE: Defensive programming with proper null/undefined checks
    if (!section || !section.rows) {
      console.warn('Invalid section data at index', index, section);
      return; // Skip invalid sections
    }
    
    // Calculate section height using correct property names
    const fundCount = section.rows.length;
    const benchmarkHeight = section.benchmark ? ROW_HEIGHT : 0;
    const tableHeight = TABLE_HEADER_HEIGHT + (fundCount * ROW_HEIGHT) + benchmarkHeight;
    const totalSectionHeight = SECTION_HEADER_HEIGHT + tableHeight + SECTION_SPACING;
    
    // Check if this section fits on current page
    if (currentPageHeight + totalSectionHeight <= AVAILABLE_HEIGHT && currentPage.length < 4) {
      // Add to current page
      currentPage.push(section);
      currentPageHeight += totalSectionHeight;
    } else {
      // Create new page with current sections
      if (currentPage.length > 0) {
        pages.push(createAssetClassPage(currentPage, asOf, pages.length + 1));
      }
      
      // Start new page with this section
      currentPage = [section];
      currentPageHeight = totalSectionHeight;
    }
  });
  
  // Add final page
  if (currentPage.length > 0) {
    pages.push(createAssetClassPage(currentPage, asOf, pages.length + 1));
  }
  
  return pages;
}

/**
 * Create a page with multiple asset class sections
 */
function createAssetClassPage(sections, asOf, pageNumber) {
  return React.createElement(Page, { 
    key: `page-${pageNumber}`,
    size: "LETTER", 
    orientation: "landscape", 
    style: styles.page 
  },
    React.createElement(PageHeader, { asOf: asOf }),
    ...sections.map((section, index) => 
      React.createElement(AssetClassSection, {
        key: section.assetClass,
        section: section,
        sectionNumber: index + 1,
        isLastSection: index === sections.length - 1,
        isCompact: sections.length > 1 // Enable compact mode for multi-section pages
      })
    ),
    React.createElement(PageFooter)
  );
}

/**
 * Main Monthly Report Document
 */
function MonthlyReportPDF({ data, options = {} }) {
  // APPLE KEYNOTE: Defensive programming with comprehensive data validation
  if (!data || !data.sections) {
    console.error('Invalid data structure:', data);
    return React.createElement(Document, null,
      React.createElement(Page, { size: "LETTER", orientation: "landscape", style: styles.page },
        React.createElement(Text, { style: { color: '#DC2626', fontSize: 16, textAlign: 'center', marginTop: 200 } },
          "Error: Invalid data structure provided"
        )
      )
    );
  }
  
  const { sections, asOf, totalFunds, recommendedFunds } = data;
  
  return React.createElement(Document, null,
    // Cover Page
    React.createElement(Page, { 
      size: "LETTER", 
      orientation: "landscape", 
      style: styles.page 
    },
      React.createElement(CoverPage, {
        data: data,
        options: options
      })
    ),

    // TRANSFORMED: Smart multi-table layout - group multiple asset classes per page
    ...renderAssetClassPages(sections, asOf),
    
    // Disclaimer Page
    React.createElement(Page, { 
      size: "LETTER", 
      orientation: "landscape", 
      style: styles.page 
    },
      React.createElement(PageHeader, { asOf: asOf }),
      React.createElement(DisclaimerSection),
      React.createElement(PageFooter)
    )
  );
}

/**
 * Cover Page Component
 */
function CoverPage({ data, options }) {
  const { asOf, totalFunds, recommendedFunds } = data;
  
  return React.createElement(View, { style: styles.coverPage },
    React.createElement(View, { style: styles.brandBar }),
    
    React.createElement(Text, { style: styles.mainTitle }, "Raymond James"),
    React.createElement(Text, { style: styles.subtitle }, "Lightship Fund Analysis"),
    React.createElement(Text, { style: styles.reportType }, "Monthly Performance Report"),
    
    React.createElement(View, { style: styles.reportMeta },
      React.createElement(View, { style: styles.metaItem },
        React.createElement(Text, { style: styles.metaLabel }, "Report Date:"),
        React.createElement(Text, { style: styles.metaValue }, formatDate(asOf))
      ),
      React.createElement(View, { style: styles.metaItem },
        React.createElement(Text, { style: styles.metaLabel }, "Generated:"),
        React.createElement(Text, { style: styles.metaValue }, formatDate(new Date().toISOString()))
      )
    ),
    
    React.createElement(View, { style: styles.summaryBox },
      React.createElement(Text, { 
        style: [styles.assetClassTitle, { textAlign: 'center', marginBottom: 16 }] 
      }, "Portfolio Summary"),
      React.createElement(View, { style: styles.summaryGrid },
        React.createElement(View, { style: styles.summaryItem },
          React.createElement(Text, { style: styles.metricValue }, totalFunds),
          React.createElement(Text, { style: styles.metricLabel }, "Total Funds")
        ),
        React.createElement(View, { style: styles.summaryItem },
          React.createElement(Text, { style: styles.metricValue }, recommendedFunds),
          React.createElement(Text, { style: styles.metricLabel }, "Recommended")
        ),
        React.createElement(View, { style: styles.summaryItem },
          React.createElement(Text, { style: styles.metricValue }, data.sections.length),
          React.createElement(Text, { style: styles.metricLabel }, "Asset Classes")
        ),
        React.createElement(View, { style: styles.summaryItem },
          React.createElement(Text, { style: styles.metricValue }, 
            Math.round((recommendedFunds / totalFunds) * 100) + "%"
          ),
          React.createElement(Text, { style: styles.metricLabel }, "Recommended %")
        )
      )
    )
  );
}

/**
 * Page Header Component
 */
function PageHeader({ asOf }) {
  return React.createElement(View, { style: styles.pageHeader, fixed: true },
    React.createElement(Text, { style: styles.headerTitle },
      "Raymond James | Monthly Fund Analysis"
    ),
    React.createElement(Text, { style: styles.headerDate },
      "As of " + formatDate(asOf)
    )
  );
}

/**
 * Page Footer Component
 */
function PageFooter() {
  const generatedDate = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return React.createElement(View, { style: styles.pageFooter, fixed: true },
    React.createElement(View, { style: styles.footerLeft },
      React.createElement(Text, { style: { fontWeight: 500, color: '#6B7280' } },
        "Raymond James & Associates | Confidential"
      ),
      React.createElement(Text, { style: { fontSize: 7, marginTop: 2 } },
        "Member FINRA/SIPC"
      )
    ),
    
    React.createElement(View, { style: styles.footerCenter },
      React.createElement(Text, { style: { fontWeight: 500, color: '#374151' } },
        "Page " + "1" // Note: React-PDF page numbers need special handling
      )
    ),
    
    React.createElement(View, { style: styles.footerRight },
      React.createElement(Text, null, "Generated: " + generatedDate),
      React.createElement(Text, { style: { fontSize: 7, marginTop: 2 } },
        "For authorized use only"
      )
    )
  );
}

/**
 * Asset Class Section Component
 */
function AssetClassSection({ section, sectionNumber, isLastSection, isCompact = false }) {
  // APPLE KEYNOTE: Defensive programming with property validation
  if (!section) {
    console.warn('AssetClassSection: Invalid section data');
    return null;
  }
  
  const { assetClass, fundCount, recommendedCount, rows, benchmark } = section;
  
  // Validate required properties
  if (!assetClass || !rows || !Array.isArray(rows)) {
    console.warn('AssetClassSection: Missing required properties:', { assetClass, rows });
    return null;
  }
  
  // TRANSFORMED: Professional section styling with compact mode support
  const sectionStyles = [
    styles.assetClassSection,
    isCompact && styles.assetClassSectionCompact
  ].filter(Boolean);
  
  const headerStyles = [
    styles.sectionHeader,
    isCompact && styles.sectionHeaderCompact
  ].filter(Boolean);
  
  return React.createElement(View, { style: sectionStyles },
    React.createElement(View, { style: headerStyles },
      React.createElement(Text, { style: styles.assetClassTitle }, assetClass || 'Unknown Asset Class'),
      React.createElement(View, { style: styles.sectionMeta },
        React.createElement(Text, { style: styles.sectionMetaText }, null,
          (fundCount || rows.length) + " fund" + ((fundCount || rows.length) !== 1 ? 's' : '') +
          ((recommendedCount || 0) > 0 ? " • " + (recommendedCount || 0) + " recommended" : '')
        )
      )
    ),
    
    React.createElement(FundTable, {
      rows: rows,
      benchmark: benchmark,
      assetClass: assetClass,
      isCompact: isCompact
    })
  );
}

/**
 * Fund Table Component
 */
function FundTable({ rows, benchmark, assetClass, isCompact = false }) {
  // APPLE KEYNOTE: Defensive programming with data validation
  if (!rows || !Array.isArray(rows)) {
    console.warn('FundTable: Invalid rows data:', rows);
    return React.createElement(View, { style: styles.fundTable },
      React.createElement(Text, { style: { color: '#DC2626', textAlign: 'center', padding: 20 } },
        "Error: Invalid fund data"
      )
    );
  }
  
  // TRANSFORMED: Updated to match new Excel-density 13-column layout
  const columns = [
    { header: 'Ticker', dataKey: 'ticker', style: styles.colTicker },
    { header: 'Fund Name', dataKey: 'name', style: styles.colName },
    { header: 'YTD', dataKey: 'ytdReturn', style: styles.colYtd },
    { header: '1Y', dataKey: 'oneYearReturn', style: styles.col1y },
    { header: '3Y', dataKey: 'threeYearReturn', style: styles.col3y },
    { header: '5Y', dataKey: 'fiveYearReturn', style: styles.col5y },
    { header: 'Sharpe', dataKey: 'sharpeRatio', style: styles.colSharpe },
    { header: '3Y Std', dataKey: 'standardDeviation3y', style: styles.colStdDev3y },
    { header: '5Y Std', dataKey: 'standardDeviation5y', style: styles.colStdDev5y },
    { header: 'Expense', dataKey: 'expenseRatio', style: styles.colExpense },
    { header: 'Tenure', dataKey: 'managerTenure', style: styles.colTenure },
    { header: 'Score', dataKey: 'score', style: styles.colScore },
    { header: 'Rec', dataKey: 'isRecommended', style: styles.colRec }
  ];

  return React.createElement(View, { style: styles.fundTable },
    // Table Header
    React.createElement(View, { style: styles.tableHeader },
      ...columns.map((col, index) => 
        React.createElement(View, {
          key: col.dataKey,
          style: [
            styles.tableHeaderCell, 
            col.style,
            index === columns.length - 1 && { borderRightWidth: 0 }
          ]
        },
          React.createElement(Text, null, col.header)
        )
      )
    ),

    // Fund Rows
    ...rows.map((row, index) => 
      React.createElement(FundRow, {
        key: row.ticker,
        row: row,
        index: index,
        columns: columns
      })
    ),
    
    // Benchmark Row
    benchmark && React.createElement(BenchmarkRow, {
      benchmark: benchmark,
      columns: columns
    })
  );
}

/**
 * Individual Fund Row Component
 */
function FundRow({ row, index, columns }) {
  // APPLE KEYNOTE: Defensive programming with row validation
  if (!row || !columns || !Array.isArray(columns)) {
    console.warn('FundRow: Invalid row or columns data:', { row, columns });
    return null;
  }
  
  const isRecommended = row.isRecommended;
  const isAlternate = index % 2 === 1;
  
  const rowStyles = [
    styles.tableRow,
    isAlternate && styles.tableRowAlternate,
    isRecommended && styles.tableRowRecommended
  ].filter(Boolean);

  return React.createElement(View, { style: rowStyles },
    ...columns.map((col, colIndex) => {
      let cellValue = row[col.dataKey];
      
      // Special handling for recommendation column
      if (col.dataKey === 'isRecommended') {
        cellValue = isRecommended ? '✓' : '';
      }
      
      // Special handling for score column with color coding
      let cellStyles = [styles.tableCell, col.style];
      if (col.dataKey === 'score' && row.score) {
        const score = parseFloat(row.score);
        if (!isNaN(score)) {
          if (score >= 70) cellStyles.push(styles.rankExcellent);
          else if (score >= 60) cellStyles.push(styles.rankGood);
          else if (score >= 50) cellStyles.push(styles.rankAverage);
          else if (score >= 40) cellStyles.push(styles.rankBelowAverage);
          else cellStyles.push(styles.rankPoor);
        }
      }
      
      // Last column - remove right border
      if (colIndex === columns.length - 1) {
        cellStyles.push({ borderRightWidth: 0 });
      }

      // TRANSFORMED: Professional text styling with proper alignment
      const textStyles = [
        col.style.textAlign === 'right' && styles.numericText,
        col.dataKey === 'isRecommended' && isRecommended && styles.recommendedCheck,
        col.dataKey === 'name' && styles.fundNameText // Special styling for fund names
      ].filter(Boolean);

      return React.createElement(View, { key: col.dataKey, style: cellStyles },
        React.createElement(Text, { style: textStyles }, cellValue || '')
      );
    })
  );
}

/**
 * Benchmark Row Component
 */
function BenchmarkRow({ benchmark, columns }) {
  // APPLE KEYNOTE: Defensive programming with benchmark validation
  if (!benchmark || !columns || !Array.isArray(columns)) {
    console.warn('BenchmarkRow: Invalid benchmark or columns data:', { benchmark, columns });
    return null;
  }
  
  return React.createElement(View, { style: [styles.tableRow, styles.benchmarkRow] },
    ...columns.map((col, colIndex) => {
      let cellValue = '';
      
      switch (col.dataKey) {
        case 'ticker':
          cellValue = benchmark.ticker || '';
          break;
        case 'name':
          cellValue = truncateText(benchmark.name || benchmark.ticker, 30);
          break;
        case 'ytdReturn':
          cellValue = benchmark.ytd_return ? formatPercent(benchmark.ytd_return) : 'N/A';
          break;
        case 'oneYearReturn':
          cellValue = benchmark.one_year_return ? formatPercent(benchmark.one_year_return) : 'N/A';
          break;
        case 'threeYearReturn':
          cellValue = benchmark.three_year_return ? formatPercent(benchmark.three_year_return) : 'N/A';
          break;
        case 'fiveYearReturn':
          cellValue = benchmark.five_year_return ? formatPercent(benchmark.five_year_return) : 'N/A';
          break;
        case 'expenseRatio':
          cellValue = benchmark.expense_ratio ? formatPercent(benchmark.expense_ratio) : 'N/A';
          break;
        case 'sharpeRatio':
          cellValue = benchmark.sharpe_ratio ? formatNumber(benchmark.sharpe_ratio, 2) : 'N/A';
          break;
        case 'score':
        case 'rank':
        case 'managerTenure':
        case 'isRecommended':
          cellValue = '—';
          break;
        default:
          cellValue = '';
      }

      const cellStyles = [
        styles.tableCell, 
        styles.tableCellBenchmark, 
        col.style,
        colIndex === columns.length - 1 && { borderRightWidth: 0 }
      ].filter(Boolean);

      return React.createElement(View, { key: col.dataKey, style: cellStyles },
        React.createElement(Text, {
          style: [
            col.style.textAlign === 'right' && styles.numericText
          ].filter(Boolean)
        }, cellValue)
      );
    })
  );
}

/**
 * Disclaimer Section Component
 */
function DisclaimerSection() {
  return React.createElement(View, { style: styles.disclaimerSection },
    React.createElement(Text, { 
      style: [styles.assetClassTitle, { textAlign: 'center', marginBottom: 16 }] 
    }, "Important Disclosures"),
    
    React.createElement(View, { style: styles.disclaimerContent },
      React.createElement(Text, { style: { marginBottom: 12 } },
        "Performance Disclosure: Past performance is not indicative of future results. " +
        "Investment returns and principal value will fluctuate, so shares may be worth more or less " +
        "than their original cost when redeemed."
      ),
      
      React.createElement(Text, { style: { marginBottom: 12 } },
        "Risk Disclosure: All investments involve risk, including potential loss of principal. " +
        "Different investment strategies carry different risk profiles and may not be suitable for all investors."
      ),
      
      React.createElement(Text, { style: { marginBottom: 12 } },
        "Data Sources: Performance data is sourced from fund companies and third-party " +
        "data providers. While we believe this information to be reliable, we cannot guarantee its accuracy."
      ),
      
      React.createElement(Text, null,
        "Advisory Disclosure: This report is for informational purposes only and does not " +
        "constitute investment advice. Please consult with your financial advisor before making investment decisions."
      )
    ),
    
    React.createElement(View, { style: styles.disclaimerFooter },
      React.createElement(Text, null,
        "Raymond James & Associates, Inc. Member FINRA/SIPC\n" +
        "© " + new Date().getFullYear() + " Raymond James & Associates, Inc. All rights reserved."
      )
    )
  );
}

// Utility Functions

function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 'N/A';
  
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function formatPercent(value, decimals = 2) {
  if (value == null || isNaN(value)) return 'N/A';
  const num = Number(value);
  const sign = num > 0 ? '+' : '';
  return `${sign}${num.toFixed(decimals)}%`;
}

function formatNumber(value, decimals = 2) {
  if (value == null || isNaN(value)) return 'N/A';
  return Number(value).toFixed(decimals);
}

function formatTenure(value) {
  if (value === null || value === undefined || isNaN(value)) {
    return 'N/A';
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

function truncateText(text, maxLength) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

// TRANSFORMED: Removed getRankColor function - no longer needed with new column structure

export default MonthlyReportPDF;