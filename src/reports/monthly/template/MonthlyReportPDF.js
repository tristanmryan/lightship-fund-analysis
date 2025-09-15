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
  StyleSheet
} from '@react-pdf/renderer';
import theme from './theme.js';
import { getScoreColor } from '../../../services/scoringPolicy.js';

// Use built-in Helvetica for Node/serverless compatibility.
// Avoid bundling TTF assets in server functions to prevent import errors.
let BASE_FONT = 'Helvetica';

// Raymond James Professional Color Scheme and Typography
const styles = StyleSheet.create({
  // APPLE KEYNOTE: Full-width professional layout with sophisticated typography
  page: {
    size: 'LETTER',
    orientation: 'landscape',
    paddingTop: theme.layout.pagePadding,
    paddingRight: theme.layout.pagePadding,
    paddingBottom: theme.layout.pagePadding,
    paddingLeft: theme.layout.pagePadding,
    fontFamily: BASE_FONT,
    fontSize: theme.fontSizes.base,
    lineHeight: 1.2,
    color: theme.colors.text
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

  // INVESTMENT COMMITTEE: Clean, modern brand bar
  brandBar: {
    width: 120, // Smaller, more elegant
    height: 2, // Thinner, more refined
    backgroundColor: theme.colors.brand, // Match title color
    marginBottom: 24,
    borderRadius: 1 // Subtle rounded corners
  },

  // INVESTMENT COMMITTEE: Clean, sharp cover page title design
  mainTitle: {
    fontSize: theme.fontSizes.coverMain,
    fontWeight: '600', // Cleaner weight
    color: theme.colors.brand, // Modern blue
    marginBottom: 12,
    letterSpacing: -0.3,
    textAlign: 'center'
  },

  subtitle: {
    fontSize: theme.fontSizes.coverSubtitle,
    fontWeight: '500',
    color: '#374151', // Clean gray
    marginBottom: 8,
    letterSpacing: -0.1,
    textAlign: 'center'
  },

  reportType: {
    fontSize: theme.fontSizes.coverReportType,
    fontWeight: '400',
    color: '#6B7280',
    textAlign: 'center',
    letterSpacing: 0.1
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

  // INVESTMENT COMMITTEE: Clean, minimal summary box
  summaryBox: {
    backgroundColor: '#FFFFFF', // Clean white background
    borderWidth: 0.5, // Thinner border
    borderColor: '#E5E7EB', // Lighter border
    borderRadius: 6, // Smaller radius
    padding: 20, // Reduced padding
    marginTop: 32,
    maxWidth: 380 // Slightly smaller
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

  // INVESTMENT COMMITTEE: Clean metric styling
  metricValue: {
    display: 'block',
    fontSize: 22, // Slightly smaller
    fontWeight: '600', // Cleaner weight
    color: theme.colors.brand, // Match title color
    lineHeight: 1.1
  },

  metricLabel: {
    display: 'block',
    fontSize: 8, // Smaller for cleaner look
    color: '#6B7280',
    marginTop: 3,
    fontWeight: '500'
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

  // INVESTMENT COMMITTEE: Clean section header with minimal styling
  sectionHeader: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 20,
    paddingBottom: 8,
    borderBottomWidth: 0.5, // Thinner border
    borderBottomColor: '#E5E7EB' // Lighter border color
  },
  
  // Compact mode for multi-section pages
  sectionHeaderCompact: {
    marginBottom: 18,
    paddingBottom: 8
  },

  // INVESTMENT COMMITTEE: Clean asset class title with sharp typography
  assetClassTitle: {
    fontSize: theme.fontSizes.title, // Slightly smaller for cleaner hierarchy
    fontWeight: '600', // Balanced weight for clean appearance
    color: theme.colors.title, // Clean, readable color
    letterSpacing: -0.2
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

  // INVESTMENT COMMITTEE: Ultra-minimal fund table design
  fundTable: {
    marginTop: 8, // Reduced margins
    marginBottom: 8,
    borderWidth: 0.25, // Ultra-thin border
    borderColor: '#E5E7EB', // Light border
    borderRadius: 2, // Minimal radius for sharp look
    backgroundColor: '#FFFFFF'
    // Ultra-clean, no shadows
  },

  // INVESTMENT COMMITTEE: Ultra-clean, minimal table header design
  tableHeader: {
    display: 'flex',
    flexDirection: 'row',
    backgroundColor: theme.table.headerBg,
    borderBottomWidth: 0.25,
    borderBottomColor: theme.table.headerBorder,
    borderRadius: 2 // Minimal radius for sharp look
  },

  tableHeaderCell: {
    color: '#FFFFFF',
    padding: 6, // Minimal padding for clean density
    fontWeight: '700',
    fontSize: theme.fontSizes.tableHeader,
    textAlign: 'center',
    borderRightWidth: 0.125,
    borderRightColor: theme.table.headerBorder,
    letterSpacing: 0.05, // Minimal letter spacing
    textTransform: 'uppercase'
  },

  // INVESTMENT COMMITTEE: Ultra-minimal table row styling
  tableRow: {
    display: 'flex',
    flexDirection: 'row',
    borderBottomWidth: 0.125,
    borderBottomColor: theme.table.rowBorder,
    minHeight: theme.layout.rowMinHeight
  },

  // INVESTMENT COMMITTEE: Ultra-subtle alternating row colors
  tableRowAlternate: {
    backgroundColor: theme.table.rowAltBg
  },

  // INVESTMENT COMMITTEE: Ultra-subtle recommended row styling
  tableRowRecommended: {
    borderLeftWidth: 1,
    borderLeftColor: theme.table.recommendedAccent,
    backgroundColor: theme.table.recommendedBg
  },

  // INVESTMENT COMMITTEE: Ultra-subtle benchmark highlighting
  benchmarkRow: {
    backgroundColor: theme.table.benchmarkBg,
    borderTopWidth: 0.25,
    borderTopColor: theme.table.benchmarkAccent,
    borderBottomWidth: 0.25,
    borderBottomColor: theme.table.benchmarkAccent,
    borderLeftWidth: 1,
    borderLeftColor: theme.table.benchmarkAccent
  },

  // INVESTMENT COMMITTEE: Ultra-minimal cell styling for clean tables
  tableCell: {
    padding: theme.table.cellPadding,
    fontSize: theme.fontSizes.tableCell,
    borderRightWidth: 0.125,
    borderRightColor: theme.table.cellBorder,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: theme.layout.rowMinHeight
  },

  // APPLE KEYNOTE: Sophisticated benchmark cell styling with modern design
  tableCellBenchmark: {
    fontWeight: '600',
    borderRightColor: '#FFD54F',
    color: '#8D6E63'
  },

  // INVESTMENT COMMITTEE: Perfectly balanced column proportions with centered performance data
  colTicker: { width: theme.table.columnWidths.ticker, textAlign: 'center' },
  colName: { width: theme.table.columnWidths.name, textAlign: 'left' },
  colYtd: { width: theme.table.columnWidths.ytd, textAlign: 'center' },
  col1y: { width: theme.table.columnWidths.oneY, textAlign: 'center' },
  col3y: { width: theme.table.columnWidths.threeY, textAlign: 'center' },
  col5y: { width: theme.table.columnWidths.fiveY, textAlign: 'center' },
  colSharpe: { width: theme.table.columnWidths.sharpe, textAlign: 'center' },
  colStdDev3y: { width: theme.table.columnWidths.std3y, textAlign: 'center' },
  colStdDev5y: { width: theme.table.columnWidths.std5y, textAlign: 'center' },
  colExpense: { width: theme.table.columnWidths.expense, textAlign: 'center' },
  colTenure: { width: theme.table.columnWidths.tenure, textAlign: 'center' },
  colScore: { width: theme.table.columnWidths.score, textAlign: 'center' },

  // APPLE KEYNOTE: Sophisticated performance color coding with modern palette
  rankExcellent: { backgroundColor: theme.table.score.excellent },
  rankGood: { backgroundColor: theme.table.score.good },
  rankAverage: { backgroundColor: theme.table.score.average },
  rankBelowAverage: { backgroundColor: theme.table.score.belowAverage },
  rankPoor: { backgroundColor: theme.table.score.poor },

  // INVESTMENT COMMITTEE: Clean numeric text styling optimized for centered alignment
  numericText: {
    fontFamily: BASE_FONT,
    fontVariant: 'tabular-nums',
    fontWeight: '500', // Balanced weight for clean appearance
    color: theme.colors.number,
    textAlign: 'center'
  },

  // APPLE KEYNOTE: Sophisticated return color coding with modern palette
  positiveReturn: { color: '#2E7D32' },
  negativeReturn: { color: '#C62828' },
  neutralReturn: { color: '#5A5A5A' },
  
  // Bold text for benchmark row values
  benchmarkText: {
    fontWeight: '700'
  },

  // Recommendation checkmark column removed; row highlighting retained
  
  // INVESTMENT COMMITTEE: Clean fund name styling with professional typography
  fundNameText: {
    fontFamily: BASE_FONT,
    fontSize: theme.fontSizes.fundName,
    fontWeight: '500',
    color: theme.colors.number,
    lineHeight: 1.2,
    textAlign: 'left'
  },

  // APPLE KEYNOTE: Sophisticated page footer with modern design
  pageFooter: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    fontSize: theme.fontSizes.footer,
    color: '#8A8A8A',
    borderTopWidth: 1,
    borderTopColor: theme.colors.footerDivider,
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
    fontSize: theme.fontSizes.header,
    color: '#5A5A5A',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.headerDivider,
    paddingBottom: 8,
    marginBottom: 8,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },

  headerTitle: {
    fontWeight: 500,
    color: theme.colors.headerText
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
function renderAssetClassPages(sections, asOf, options = {}) {
  // APPLE KEYNOTE: Defensive programming with comprehensive data validation
  if (!sections || !Array.isArray(sections) || sections.length === 0) {
    console.warn('Invalid sections data:', sections);
    return []; // Return empty array if no valid sections
  }
  
  const pages = [];
  let currentPage = [];
  let currentPageHeight = 0;
  
  // INVESTMENT COMMITTEE: Ultra-clean layout constants for minimal tables
  const PAGE_HEIGHT = 612; // Letter landscape height in points
  const HEADER_HEIGHT = options.headerHeight ?? theme.layout.headerHeight ?? 70;
  const FOOTER_HEIGHT = options.footerHeight ?? theme.layout.footerHeight ?? 50;
  const SECTION_HEADER_HEIGHT = options.sectionHeaderHeight ?? theme.layout.sectionHeaderHeight ?? 30;
  const TABLE_HEADER_HEIGHT = options.tableHeaderHeight ?? theme.layout.tableHeaderHeight ?? 20;
  const ROW_HEIGHT = options.rowMinHeight ?? theme.layout.rowMinHeight ?? 20;
  const SECTION_SPACING = options.sectionSpacing ?? theme.layout.sectionSpacing ?? 20;
  const SAFETY_MARGIN = 40; // Safety margin to prevent cutoff
  const AVAILABLE_HEIGHT = PAGE_HEIGHT - HEADER_HEIGHT - FOOTER_HEIGHT - SAFETY_MARGIN;
  
  sections.forEach((section, index) => {
    // INVESTMENT COMMITTEE: Defensive programming with proper null/undefined checks
    if (!section || !section.rows) {
      console.warn('Invalid section data at index', index, section);
      return; // Skip invalid sections
    }
    
    // Calculate section height using correct property names
    const fundCount = section.rows.length;
    const benchmarkHeight = section.benchmark ? ROW_HEIGHT : 0;
    const tableHeight = TABLE_HEADER_HEIGHT + (fundCount * ROW_HEIGHT) + benchmarkHeight;
    const totalSectionHeight = SECTION_HEADER_HEIGHT + tableHeight + SECTION_SPACING;
    
    // INVESTMENT COMMITTEE: Ultra-conservative layout logic - never cut off tables
    // Use 90% of available height to ensure plenty of breathing room
    const SAFE_HEIGHT = AVAILABLE_HEIGHT * 0.9;
    
    if (currentPageHeight + totalSectionHeight > SAFE_HEIGHT) {
      // Create new page with current sections
      if (currentPage.length > 0) {
        pages.push(createAssetClassPage(currentPage, asOf, pages.length + 1, options));
      }
      
      // Start new page with this section
      currentPage = [section];
      currentPageHeight = totalSectionHeight;
    } else {
      // Add to current page if it fits with plenty of room
      currentPage.push(section);
      currentPageHeight += totalSectionHeight;
    }
  });
  
  // Add final page
  if (currentPage.length > 0) {
    pages.push(createAssetClassPage(currentPage, asOf, pages.length + 1, options));
  }
  
  return pages;
}

/**
 * Create a page with multiple asset class sections
 */
function createAssetClassPage(sections, asOf, pageNumber, options = {}) {
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
        isCompact: sections.length > 1, // Enable compact mode for multi-section pages
        options: options
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
  // Disable recommended highlighting when all rows are recommended (recommended-only reports)
  const computedOptions = {
    ...options,
    highlightRecommended: options.highlightRecommended !== false && !(Number(totalFunds) === Number(recommendedFunds))
  };

  const hasAlerts = Array.isArray(data?.alerts?.topAlerts) && data.alerts.topAlerts.length > 0;

  return React.createElement(Document, null,
    // Cover Page
    React.createElement(Page, { 
      size: "LETTER", 
      orientation: "landscape", 
      style: styles.page 
    },
      React.createElement(CoverPage, { data: data, options: computedOptions })
    ),

    // Alerts Summary Page (optional)
    (hasAlerts && React.createElement(Page, { size: "LETTER", orientation: "landscape", style: styles.page },
      React.createElement(PageHeader, { asOf: asOf }),
      React.createElement(View, { style: { marginTop: 28 } },
        React.createElement(View, { style: styles.sectionHeader },
          React.createElement(Text, { style: styles.assetClassTitle }, 'Alerts Summary'),
          React.createElement(Text, { style: styles.sectionMetaText }, `Top by priority; Count: ${data.alerts.topAlerts.length}`)
        ),
        React.createElement(View, { style: [styles.tableHeader, { marginBottom: 0 }] },
          React.createElement(Text, { style: [styles.tableHeaderCell, { width: 40 }] }, 'Prio'),
          React.createElement(Text, { style: [styles.tableHeaderCell, { width: 70 }] }, 'Severity'),
          React.createElement(Text, { style: [styles.tableHeaderCell, { width: 70 }] }, 'Month'),
          React.createElement(Text, { style: [styles.tableHeaderCell, { width: 60 }] }, 'Ticker'),
          React.createElement(Text, { style: [styles.tableHeaderCell, { width: 140, textAlign: 'left' }] }, 'Asset Class'),
          React.createElement(Text, { style: [styles.tableHeaderCell, { flex: 1, textAlign: 'left' }] }, 'Title')
        ),
        ...(data.alerts.topAlerts || []).slice(0, 30).map((a, idx) => (
          React.createElement(View, { key: String(a.id || idx), style: styles.tableRow },
            React.createElement(Text, { style: [styles.tableCell, { width: 40 }] }, String(a.priority ?? '')),
            React.createElement(Text, { style: [styles.tableCell, { width: 70 }] }, String(a.severity || '')),
            React.createElement(Text, { style: [styles.tableCell, { width: 70 }] }, String(a.month || '')),
            React.createElement(Text, { style: [styles.tableCell, { width: 60 }] }, String(a.ticker || '')),
            React.createElement(Text, { style: [styles.tableCell, { width: 140, justifyContent: 'flex-start' }] }, String(a.assetClass || 'Unclassified')),
            React.createElement(Text, { style: [styles.tableCell, { flex: 1, textAlign: 'left', justifyContent: 'flex-start' }] }, String(a.title || ''))
          )
        )),
        React.createElement(View, { style: [styles.sectionHeader, { marginTop: 16 }] },
          React.createElement(Text, { style: styles.assetClassTitle }, 'Alerts by Severity')
        ),
        React.createElement(View, { style: { display: 'flex', flexDirection: 'row', gap: 12 } },
          ...['critical','warning','info'].map(s => (
            React.createElement(View, { key: s, style: { borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 6, padding: 8, width: 120 } },
              React.createElement(Text, { style: { fontSize: 9, color: '#6B7280' } }, s.toUpperCase()),
              React.createElement(Text, { style: { fontSize: 16, fontWeight: 700, color: '#111827', textAlign: 'center' } }, String(data?.alerts?.countsBySeverity?.[s] || 0))
            )
          ))
        ),
        React.createElement(View, { style: [styles.sectionHeader, { marginTop: 16 }] },
          React.createElement(Text, { style: styles.assetClassTitle }, 'Top Asset Classes (by alerts)')
        ),
        React.createElement(View, { style: [styles.tableHeader, { marginBottom: 0 }] },
          React.createElement(Text, { style: [styles.tableHeaderCell, { flex: 1, textAlign: 'left' }] }, 'Asset Class'),
          React.createElement(Text, { style: [styles.tableHeaderCell, { width: 80 }] }, 'Count')
        ),
        ...(data.alerts.topAssetClasses || []).map((r, i) => (
          React.createElement(View, { key: String(i), style: styles.tableRow },
            React.createElement(Text, { style: [styles.tableCell, { flex: 1, textAlign: 'left', justifyContent: 'flex-start' }] }, String(r.assetClass || 'Unclassified')),
            React.createElement(Text, { style: [styles.tableCell, { width: 80 }] }, String(r.count || 0))
          )
        ))
      ),
      React.createElement(PageFooter)
    )),

    // TRANSFORMED: Smart multi-table layout - group multiple asset classes per page
    ...renderAssetClassPages(sections, asOf, computedOptions),
    
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
            (totalFunds > 0 ? Math.round((recommendedFunds / totalFunds) * 100) : 0) + "%"
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
      React.createElement(Text, {
        style: { fontWeight: 500, color: '#374151' },
        render: ({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`
      })
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
function AssetClassSection({ section, sectionNumber, isLastSection, isCompact = false, options = {} }) {
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
          ((recommendedCount || 0) > 0 ? " â€¢ " + (recommendedCount || 0) + " recommended" : '')
        )
      )
    ),
    
    React.createElement(FundTable, {
      rows: rows,
      benchmark: benchmark,
      assetClass: assetClass,
      isCompact: isCompact,
      options: options
    })
  );
}

/**
 * Fund Table Component
 */
function FundTable({ rows, benchmark, assetClass, isCompact = false, options = {} }) {
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
  const colWidths = options.colWidths || {};
  const columns = [
    { header: 'Ticker', dataKey: 'ticker', style: [styles.colTicker, colWidths.ticker && { width: colWidths.ticker }] },
    { header: 'Fund Name', dataKey: 'name', style: [styles.colName, colWidths.name && { width: colWidths.name }] },
    { header: 'YTD', dataKey: 'ytdReturn', style: [styles.colYtd, colWidths.ytd && { width: colWidths.ytd }] },
    { header: '1Y', dataKey: 'oneYearReturn', style: [styles.col1y, colWidths.oneY && { width: colWidths.oneY }] },
    { header: '3Y', dataKey: 'threeYearReturn', style: [styles.col3y, colWidths.threeY && { width: colWidths.threeY }] },
    { header: '5Y', dataKey: 'fiveYearReturn', style: [styles.col5y, colWidths.fiveY && { width: colWidths.fiveY }] },
    { header: 'Sharpe', dataKey: 'sharpeRatio', style: [styles.colSharpe, colWidths.sharpe && { width: colWidths.sharpe }] },
    { header: '3Y Std', dataKey: 'standardDeviation3y', style: [styles.colStdDev3y, colWidths.std3y && { width: colWidths.std3y }] },
    { header: '5Y Std', dataKey: 'standardDeviation5y', style: [styles.colStdDev5y, colWidths.std5y && { width: colWidths.std5y }] },
    { header: 'Expense', dataKey: 'expenseRatio', style: [styles.colExpense, colWidths.expense && { width: colWidths.expense }] },
    { header: 'Tenure', dataKey: 'managerTenure', style: [styles.colTenure, colWidths.tenure && { width: colWidths.tenure }] },
    { header: 'Score', dataKey: 'score', style: [styles.colScore, colWidths.score && { width: colWidths.score }] }
  ];

  return React.createElement(View, { style: styles.fundTable },
    // Table Header
    React.createElement(View, { style: [styles.tableHeader, options.headerBg && { backgroundColor: options.headerBg }].filter(Boolean) },
      ...columns.map((col, index) => 
        React.createElement(View, {
          key: col.dataKey,
          style: [
            styles.tableHeaderCell,
            ...(Array.isArray(col.style) ? col.style : [col.style]),
            options.headerFontSize && { fontSize: options.headerFontSize },
            index === columns.length - 1 && { borderRightWidth: 0 }
          ].filter(Boolean)
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
        columns: columns,
        options: options
      })
    ),
    
    // Benchmark Row
    benchmark && React.createElement(BenchmarkRow, {
      benchmark: benchmark,
      columns: columns,
      options: options
    })
  );
}

/**
 * Individual Fund Row Component
 */
function FundRow({ row, index, columns, options = {} }) {
  // APPLE KEYNOTE: Defensive programming with row validation
  if (!row || !columns || !Array.isArray(columns)) {
    console.warn('FundRow: Invalid row or columns data:', { row, columns });
    return null;
  }
  
  const highlightRecommended = options.highlightRecommended !== false;
  const isRecommended = highlightRecommended && row.isRecommended;
  const isAlternate = index % 2 === 1;
  
  const rowStyles = [
    styles.tableRow,
    isAlternate && styles.tableRowAlternate,
    isRecommended && styles.tableRowRecommended,
    options.rowMinHeight && { minHeight: options.rowMinHeight },
    (isRecommended && (options.recBg || options.recAccent)) && {
      backgroundColor: options.recBg || undefined,
      borderLeftColor: options.recAccent || undefined,
    }
  ].filter(Boolean);

  return React.createElement(View, { style: rowStyles },
    ...columns.map((col, colIndex) => {
      let cellValue = row[col.dataKey];
      
      // Special handling for recommendation column
      // No explicit recommended column; rows are highlighted when recommended
      
      // Special handling for score column with color coding
      let cellStyles = [styles.tableCell, ...(Array.isArray(col.style) ? col.style : [col.style])];
      if (options.cellFontSize) cellStyles.push({ fontSize: options.cellFontSize });
      cellStyles = cellStyles.filter(Boolean);
      if (col.dataKey === 'score' && row.score) {
        const score = parseFloat(row.score);
        if (!isNaN(score)) {
          // Centralized scoring color (matches Scoring tab)
          const bg = getScoreColor(score);
          cellStyles.push({ backgroundColor: bg });
        }
      }
      
      // Last column - remove right border
      if (colIndex === columns.length - 1) {
        cellStyles.push({ borderRightWidth: 0 });
      }

      // INVESTMENT COMMITTEE: Clean text styling with proper alignment
      const textStyles = [
        
        col.dataKey === 'name' && styles.fundNameText, // Special styling for fund names
        // All other columns use centered alignment with numeric styling
        col.dataKey !== 'name' && styles.numericText
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
function BenchmarkRow({ benchmark, columns, options = {} }) {
  // APPLE KEYNOTE: Defensive programming with benchmark validation
  if (!benchmark || !columns || !Array.isArray(columns)) {
    console.warn('BenchmarkRow: Invalid benchmark or columns data:', { benchmark, columns });
    return null;
  }
  
  const benchStyleOverride = {
    backgroundColor: options.bmkBg || undefined,
    borderTopColor: options.bmkAccent || undefined,
    borderBottomColor: options.bmkAccent || undefined,
    borderLeftColor: options.bmkAccent || undefined,
  };
  return React.createElement(View, { style: [styles.tableRow, styles.benchmarkRow, benchStyleOverride] },
    ...columns.map((col, colIndex) => {
      let cellValue = '';
      
      switch (col.dataKey) {
        case 'ticker':
          // Hide benchmark ticker for presentation
          cellValue = '';
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
          cellValue = 'â€”';
          break;
        default:
          cellValue = '';
      }

      // Provide default placeholders for certain benchmark-only columns
      if ((col.dataKey === 'rank' || col.dataKey === 'managerTenure') && (cellValue === '' || cellValue == null)) {
        cellValue = 'N/A';
      }

      // Ensure Std Dev columns render from benchmark if not handled above
      if (col.dataKey === 'standardDeviation3y' && (cellValue === '' || cellValue == null)) {
        cellValue = benchmark.standard_deviation_3y ? formatPercent(benchmark.standard_deviation_3y, 1) : 'N/A';
      }
      if (col.dataKey === 'standardDeviation5y' && (cellValue === '' || cellValue == null)) {
        cellValue = benchmark.standard_deviation_5y ? formatPercent(benchmark.standard_deviation_5y, 1) : 'N/A';
      }
      // Normalize placeholders\n      if (cellValue && typeof cellValue === 'string' && /[^\x20-\x7E]/.test(cellValue)) {\n        cellValue = 'N/A';\n      }\n      if (col.dataKey === 'managerTenure' && (cellValue === '' || cellValue == null)) {\n        cellValue = 'N/A';\n      }\n
      const cellStyles = [
        styles.tableCell, 
        styles.tableCellBenchmark, 
        ...(Array.isArray(col.style) ? col.style : [col.style]),
        options && options.cellFontSize && { fontSize: options.cellFontSize },
        colIndex === columns.length - 1 && { borderRightWidth: 0 }
      ].filter(Boolean);

      // Ensure benchmark score appears even if default case handled earlier
      if (col.dataKey === 'score') {
        cellValue = benchmark.score != null ? formatNumber(benchmark.score, 1) : 'N/A';
      }

      return React.createElement(View, { key: col.dataKey, style: cellStyles },
        React.createElement(Text, {
          style: [
            col.dataKey === 'name' ? null : styles.numericText, // Center all non-name columns
            styles.benchmarkText
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
  const sign = num < 0 ? '-' : '';
  const abs = Math.abs(num).toFixed(decimals);
  return `${sign}${abs}%`;
}

function formatNumber(value, decimals = 2) {
  if (value == null || isNaN(value)) return 'N/A';
  return Number(value).toFixed(decimals);
}

// Note: tenure formatting is handled upstream; removing unused formatter

function truncateText(text, maxLength) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

  // TRANSFORMED: Removed getRankColor function - no longer needed with new column structure

export default MonthlyReportPDF;
