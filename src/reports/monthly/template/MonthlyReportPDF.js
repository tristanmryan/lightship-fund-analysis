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
  // TRANSFORMED: Page layout optimized for Excel-density
  page: {
    size: 'LETTER',
    orientation: 'landscape',
    paddingTop: 35,
    paddingRight: 30,
    paddingBottom: 35,
    paddingLeft: 30,
    fontFamily: 'Helvetica',
    fontSize: 8,
    lineHeight: 1.2,
    color: '#1F2937'
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

  // Asset Class Sections
  assetClassSection: {
    marginBottom: 32
  },

  sectionHeader: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 12, // TRANSFORMED: Reduced margins for density
    paddingBottom: 6, // TRANSFORMED: Reduced padding for density
    borderBottomWidth: 2,
    borderBottomColor: '#002F6C'
  },

  assetClassTitle: {
    fontSize: 14, // TRANSFORMED: Reduced font size for density
    fontWeight: 'bold',
    color: '#002F6C'
  },

  sectionMeta: {
    fontSize: 9,
    color: '#6B7280'
  },

  recommendedCount: {
    color: '#FFC200',
    fontWeight: 500
  },

  // Fund Tables
  fundTable: {
    marginTop: 12, // TRANSFORMED: Reduced margins for density
    marginBottom: 12, // TRANSFORMED: Reduced margins for density
    borderWidth: 1,
    borderColor: '#D1D5DB'
  },

  tableHeader: {
    display: 'flex',
    flexDirection: 'row',
    backgroundColor: '#4472C4',
    borderBottomWidth: 2,
    borderBottomColor: '#002F6C'
  },

  tableHeaderCell: {
    color: '#FFFFFF',
    padding: 4, // TRANSFORMED: Reduced padding for density
    fontWeight: 'bold',
    fontSize: 8, // TRANSFORMED: Reduced font size for density
    textAlign: 'center',
    borderRightWidth: 1,
    borderRightColor: '#D1D5DB'
  },

  tableRow: {
    display: 'flex',
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#D1D5DB'
  },

  tableRowAlternate: {
    backgroundColor: '#F8F9FA'
  },

  tableRowRecommended: {
    borderLeftWidth: 3,
    borderLeftColor: '#FFC200'
  },

  benchmarkRow: {
    backgroundColor: '#FFF3CD',
    borderTopWidth: 2,
    borderTopColor: '#FFE69C',
    borderBottomWidth: 2,
    borderBottomColor: '#FFE69C'
  },

  tableCell: {
    padding: 3, // TRANSFORMED: Reduced padding for density
    fontSize: 8, // TRANSFORMED: Reduced font size for density
    borderRightWidth: 0.5,
    borderRightColor: '#D1D5DB',
    display: 'flex',
    alignItems: 'center'
  },

  tableCellBenchmark: {
    fontWeight: 'bold',
    borderRightColor: '#FFE69C'
  },

  // TRANSFORMED: Column widths optimized for Excel-density layout (13 columns)
  colTicker: { width: 35, textAlign: 'center' },
  colName: { width: 120, textAlign: 'left' },
  colYtd: { width: 45, textAlign: 'right' },
  col1y: { width: 45, textAlign: 'right' },
  col3y: { width: 45, textAlign: 'right' },
  col5y: { width: 45, textAlign: 'right' },
  colSharpe: { width: 45, textAlign: 'right' },
  colStdDev3y: { width: 45, textAlign: 'right' },
  colStdDev5y: { width: 45, textAlign: 'right' },
  colExpense: { width: 45, textAlign: 'right' },
  colTenure: { width: 45, textAlign: 'right' },
  colScore: { width: 35, textAlign: 'right' },
  colRec: { width: 25, textAlign: 'center' },

  // Performance color coding
  rankExcellent: { backgroundColor: '#C6EFCE' },
  rankGood: { backgroundColor: '#FFFF99' },
  rankAverage: { backgroundColor: '#FFEB9C' },
  rankBelowAverage: { backgroundColor: '#FFC7CE' },
  rankPoor: { backgroundColor: '#FFC7CE' },

  // Text formatting
  numericText: {
    fontFamily: 'Helvetica',
    fontVariant: 'tabular-nums'
  },

  positiveReturn: { color: '#059669' },
  negativeReturn: { color: '#DC2626' },
  neutralReturn: { color: '#6B7280' },

  recommendedCheck: {
    color: '#059669', // Green checkmark
    fontSize: 10,
    fontWeight: 'bold'
  },

  // Footer
  pageFooter: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    fontSize: 8,
    color: '#9CA3AF',
    borderTopWidth: 0.5,
    borderTopColor: '#E5E7EB',
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

  // Header
  pageHeader: {
    position: 'absolute',
    top: 16,
    left: 40,
    right: 40,
    fontSize: 9,
    color: '#6B7280',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 4,
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
 * Main Monthly Report Document
 */
function MonthlyReportPDF({ data, options = {} }) {
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

    // Asset Class Sections
    ...sections.map((section, index) => 
      React.createElement(Page, { 
        key: section.assetClass, 
        size: "LETTER", 
        orientation: "landscape", 
        style: styles.page 
      },
        React.createElement(PageHeader, { asOf: asOf }),
        React.createElement(AssetClassSection, {
          section: section,
          sectionNumber: index + 1,
          isLastSection: index === sections.length - 1
        }),
        React.createElement(PageFooter)
      )
    ),
    
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
        "Page " 
        // Note: React-PDF page numbers need special handling
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
function AssetClassSection({ section, sectionNumber, isLastSection }) {
  const { assetClass, fundCount, recommendedCount, rows, benchmark } = section;
  
  return React.createElement(View, { style: styles.assetClassSection },
    React.createElement(View, { style: styles.sectionHeader },
      React.createElement(Text, { style: styles.assetClassTitle }, assetClass),
      React.createElement(View, { style: styles.sectionMeta },
        React.createElement(Text, null,
          fundCount + " fund" + (fundCount !== 1 ? 's' : '') +
          (recommendedCount > 0 ? " • " + recommendedCount + " recommended" : '')
        )
      )
    ),
    
    React.createElement(FundTable, {
      rows: rows,
      benchmark: benchmark,
      assetClass: assetClass
    })
  );
}

/**
 * Fund Table Component
 */
function FundTable({ rows, benchmark, assetClass }) {
  // TRANSFORMED: Updated to match new Excel-density 13-column layout
  const columns = [
    { header: 'Ticker', dataKey: 'ticker', style: styles.colTicker },
    { header: 'Fund Name', dataKey: 'name', style: styles.colName },
    { header: 'YTD Return', dataKey: 'ytdReturn', style: styles.colYtd },
    { header: '1Y Return', dataKey: 'oneYearReturn', style: styles.col1y },
    { header: '3Y Return', dataKey: 'threeYearReturn', style: styles.col3y },
    { header: '5Y Return', dataKey: 'fiveYearReturn', style: styles.col5y },
    { header: 'Sharpe Ratio', dataKey: 'sharpeRatio', style: styles.colSharpe },
    { header: '3Y Std Dev', dataKey: 'standardDeviation3y', style: styles.colStdDev3y },
    { header: '5Y Std Dev', dataKey: 'standardDeviation5y', style: styles.colStdDev5y },
    { header: 'Expense Ratio', dataKey: 'expenseRatio', style: styles.colExpense },
    { header: 'Manager Tenure', dataKey: 'managerTenure', style: styles.colTenure },
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

      return React.createElement(View, { key: col.dataKey, style: cellStyles },
        React.createElement(Text, {
          style: [
            col.style.textAlign === 'right' && styles.numericText,
            col.dataKey === 'isRecommended' && isRecommended && styles.recommendedCheck
          ].filter(Boolean)
        }, cellValue || '')
      );
    })
  );
}

/**
 * Benchmark Row Component
 */
function BenchmarkRow({ benchmark, columns }) {
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