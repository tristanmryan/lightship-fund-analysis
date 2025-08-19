/**
 * React-PDF Monthly Report Component
 * Professional Investment Committee PDF Reports with Raymond James Branding
 * Optimized for Excel-like density and professional presentation
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
import { 
  formatPercentDisplay, 
  formatNumberDisplay 
} from '../shared/format.js';
import assetClassGroups from '../../../data/assetClassGroups.js';

// Register fonts for consistent rendering
Font.register({
  family: 'Helvetica',
  fonts: [
    { src: 'Helvetica' },
    { src: 'Helvetica-Bold', fontWeight: 'bold' },
    { src: 'Helvetica-Light', fontWeight: 'light' }
  ]
});

// Raymond James Professional Color Scheme and Typography
const styles = StyleSheet.create({
  // Page layout - optimized for density
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
    color: '#374151',
    fontSize: 12
  },

  metaValue: {
    color: '#6B7280',
    fontSize: 11
  },

  // Asset Class Section - compact layout
  assetClassSection: {
    marginBottom: 20
  },

  sectionHeader: {
    marginBottom: 12,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB'
  },

  assetClassTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#002F6C',
    marginBottom: 4
  },

  sectionMeta: {
    fontSize: 8,
    color: '#6B7280'
  },

  recommendedCount: {
    color: '#FFC200',
    fontWeight: '600'
  },

  // Fund Table - Excel-like density
  fundTable: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 2
  },

  tableHeader: {
    display: 'flex',
    flexDirection: 'row',
    backgroundColor: '#1F2937',
    borderBottomWidth: 1,
    borderBottomColor: '#D1D5DB'
  },

  tableHeaderCell: {
    padding: 4,
    fontWeight: 'bold',
    fontSize: 7,
    textAlign: 'center',
    borderRightWidth: 1,
    borderRightColor: '#D1D5DB',
    color: '#FFFFFF'
  },

  tableRow: {
    display: 'flex',
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#D1D5DB',
    minHeight: 16
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
    borderBottomColor: '#FFE69C',
    fontWeight: 'bold'
  },

  tableCell: {
    padding: 3,
    fontSize: 7,
    borderRightWidth: 0.5,
    borderRightColor: '#D1D5DB',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },

  tableCellBenchmark: {
    fontWeight: 'bold',
    borderRightColor: '#FFE69C'
  },

  // Column widths - optimized for density and readability
  colTicker: { width: 32, textAlign: 'center' },
  colName: { width: 85, textAlign: 'left', justifyContent: 'flex-start' },
  colYtd: { width: 28, textAlign: 'right' },
  col1y: { width: 28, textAlign: 'right' },
  col3y: { width: 28, textAlign: 'right' },
  col5y: { width: 28, textAlign: 'right' },
  colSharpe: { width: 30, textAlign: 'right' },
  colStdDev3y: { width: 32, textAlign: 'right' },
  colStdDev5y: { width: 32, textAlign: 'right' },
  colExpense: { width: 30, textAlign: 'right' },
  colTenure: { width: 30, textAlign: 'right' },
  colScore: { width: 28, textAlign: 'right' },
  colRec: { width: 20, textAlign: 'center' },

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

  recommendedStar: {
    color: '#FFC200',
    fontSize: 10,
    fontWeight: 'bold'
  },

  // Footer
  pageFooter: {
    position: 'absolute',
    bottom: 15,
    left: 30,
    right: 30,
    fontSize: 7,
    color: '#9CA3AF',
    borderTopWidth: 0.5,
    borderTopColor: '#E5E7EB',
    paddingTop: 6,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },

  footerLeft: {
    display: 'flex',
    flexDirection: 'column',
    lineHeight: 1.2
  },

  footerCenter: {
    textAlign: 'center'
  },

  footerRight: {
    textAlign: 'right',
    display: 'flex',
    flexDirection: 'column',
    lineHeight: 1.2
  },

  // Header
  pageHeader: {
    position: 'absolute',
    top: 12,
    left: 30,
    right: 30,
    fontSize: 8,
    color: '#6B7280',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 3,
    marginBottom: 6,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },

  headerTitle: {
    fontWeight: '500',
    color: '#002F6C'
  },

  headerDate: {
    fontSize: 7,
    color: '#9CA3AF'
  },

  // Disclaimer
  disclaimerSection: {
    marginTop: 30,
    padding: 20,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 4
  },

  disclaimerContent: {
    lineHeight: 1.4,
    marginBottom: 10
  },

  disclaimerFooter: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#D1D5DB',
    textAlign: 'center',
    fontSize: 7,
    color: '#9CA3AF'
  }
});

/**
 * Main Monthly Report Document
 */
function MonthlyReportPDF({ data, options = {} }) {
  const { sections, asOf, totalFunds, recommendedFunds } = data;
  
  // Sort sections by asset class order
  const orderedSections = sortSectionsByAssetClassOrder(sections);
  
  return (
    <Document>
      {/* Cover Page */}
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        <CoverPage 
          data={data}
          options={options}
        />
      </Page>

      {/* Asset Class Sections - Multiple per page for density */}
      {groupSectionsForPages(orderedSections).map((pageSections, pageIndex) => (
        <Page key={pageIndex} size="LETTER" orientation="landscape" style={styles.page}>
          <PageHeader asOf={asOf} />
          {pageSections.map((section, sectionIndex) => (
            <AssetClassSection 
              key={section.assetClass}
              section={section}
              sectionNumber={pageIndex * 3 + sectionIndex + 1}
              isLastSection={pageIndex === groupSectionsForPages(orderedSections).length - 1 && sectionIndex === pageSections.length - 1}
            />
          ))}
          <PageFooter />
        </Page>
      ))}
      
      {/* Disclaimer Page */}
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        <PageHeader asOf={asOf} />
        <DisclaimerSection />
        <PageFooter />
      </Page>
    </Document>
  );
}

/**
 * Group sections for multiple asset classes per page
 */
function groupSectionsForPages(sections) {
  const sectionsPerPage = 3; // Target 3 asset classes per page
  const pages = [];
  
  for (let i = 0; i < sections.length; i += sectionsPerPage) {
    pages.push(sections.slice(i, i + sectionsPerPage));
  }
  
  return pages;
}

/**
 * Sort sections by predefined asset class order
 */
function sortSectionsByAssetClassOrder(sections) {
  const allAssetClasses = assetClassGroups.reduce((all, group) => {
    return [...all, ...group.classes];
  }, []);
  
  return sections.sort((a, b) => {
    const aIndex = allAssetClasses.indexOf(a.assetClass);
    const bIndex = allAssetClasses.indexOf(b.assetClass);
    
    if (aIndex === -1 && bIndex === -1) return 0;
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    
    return aIndex - bIndex;
  });
}

/**
 * Cover Page Component
 */
function CoverPage({ data, options }) {
  const { asOf, totalFunds, recommendedFunds } = data;
  
  return (
    <View style={styles.coverPage}>
      <View style={styles.brandBar} />
      
      <Text style={styles.mainTitle}>Raymond James</Text>
      <Text style={styles.subtitle}>Lightship Fund Analysis</Text>
      <Text style={styles.reportType}>Monthly Performance Report</Text>
      
      <View style={styles.reportMeta}>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Report Date:</Text>
          <Text style={styles.metaValue}>{formatDate(asOf)}</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Generated:</Text>
          <Text style={styles.metaValue}>{formatDate(new Date().toISOString())}</Text>
        </View>
      </View>
      
      <View style={styles.summaryBox}>
        <Text style={[styles.assetClassTitle, { textAlign: 'center', marginBottom: 16 }]}>
          Portfolio Summary
        </Text>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Text style={styles.metricValue}>{totalFunds}</Text>
            <Text style={styles.metricLabel}>Total Funds</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.metricValue}>{recommendedFunds}</Text>
            <Text style={styles.metricLabel}>Recommended</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.metricValue}>{data.sections.length}</Text>
            <Text style={styles.metricLabel}>Asset Classes</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.metricValue}>
              {Math.round((recommendedFunds / totalFunds) * 100)}%
            </Text>
            <Text style={styles.metricLabel}>Recommended %</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

/**
 * Page Header Component
 */
function PageHeader({ asOf }) {
  return (
    <View style={styles.pageHeader} fixed>
      <Text style={styles.headerTitle}>
        Raymond James | Monthly Fund Analysis
      </Text>
      <Text style={styles.headerDate}>
        As of {formatDate(asOf)}
      </Text>
    </View>
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

  return (
    <View style={styles.pageFooter} fixed>
      <View style={styles.footerLeft}>
        <Text style={{ fontWeight: 500, color: '#6B7280' }}>
          Raymond James & Associates | Confidential
        </Text>
        <Text style={{ fontSize: 7, marginTop: 2 }}>
          Member FINRA/SIPC
        </Text>
      </View>
      
      <View style={styles.footerCenter}>
        <Text style={{ fontWeight: 500, color: '#374151' }}>
          Page <Text render={({ pageNumber, totalPages }) => `${pageNumber} of ${totalPages}`} />
        </Text>
      </View>
      
      <View style={styles.footerRight}>
        <Text>Generated: {generatedDate}</Text>
        <Text style={{ fontSize: 7, marginTop: 2 }}>
          For authorized use only
        </Text>
      </View>
    </View>
  );
}

/**
 * Asset Class Section Component
 */
function AssetClassSection({ section, sectionNumber, isLastSection }) {
  const { assetClass, fundCount, recommendedCount, rows, benchmark } = section;
  
  return (
    <View style={styles.assetClassSection}>
      <View style={styles.sectionHeader}>
        <Text style={styles.assetClassTitle}>{assetClass}</Text>
        <View style={styles.sectionMeta}>
          <Text>
            {fundCount} fund{fundCount !== 1 ? 's' : ''}
            {recommendedCount > 0 && (
              <Text style={styles.recommendedCount}>
                {' '}• {recommendedCount} recommended
              </Text>
            )}
          </Text>
        </View>
      </View>
      
      <FundTable 
        rows={rows}
        benchmark={benchmark}
        assetClass={assetClass}
      />
    </View>
  );
}

/**
 * Fund Table Component - Excel-like density with available data fields
 */
function FundTable({ rows, benchmark, assetClass }) {
  const columns = [
    { header: 'Ticker', dataKey: 'ticker', style: styles.colTicker },
    { header: 'Fund Name', dataKey: 'name', style: styles.colName },
    { header: 'YTD', dataKey: 'ytdReturn', style: styles.colYtd },
    { header: '1Y', dataKey: 'oneYearReturn', style: styles.col1y },
    { header: '3Y', dataKey: 'threeYearReturn', style: styles.col3y },
    { header: '5Y', dataKey: 'fiveYearReturn', style: styles.col5y },
    { header: 'Sharpe', dataKey: 'sharpeRatio', style: styles.colSharpe },
    { header: '3Y Std Dev', dataKey: 'standardDeviation3y', style: styles.colStdDev3y },
    { header: '5Y Std Dev', dataKey: 'standardDeviation5y', style: styles.colStdDev5y },
    { header: 'Expense', dataKey: 'expenseRatio', style: styles.colExpense },
    { header: 'Tenure', dataKey: 'managerTenure', style: styles.colTenure },
    { header: 'Score', dataKey: 'score', style: styles.colScore },
    { header: 'Rec', dataKey: 'isRecommended', style: styles.colRec }
  ];

  return (
    <View style={styles.fundTable}>
      {/* Table Header */}
      <View style={styles.tableHeader}>
        {columns.map((col, index) => (
          <View 
            key={col.dataKey} 
            style={[
              styles.tableHeaderCell, 
              col.style,
              index === columns.length - 1 && { borderRightWidth: 0 }
            ]}
          >
            <Text>{col.header}</Text>
          </View>
        ))}
      </View>

      {/* Fund Rows */}
      {rows.map((row, index) => (
        <FundRow 
          key={row.ticker}
          row={row}
          index={index}
          columns={columns}
        />
      ))}
      
      {/* Benchmark Row */}
      {benchmark && (
        <BenchmarkRow 
          benchmark={benchmark}
          columns={columns}
        />
      )}
    </View>
  );
}

/**
 * Individual Fund Row Component - Compact layout
 */
function FundRow({ row, index, columns }) {
  const isRecommended = row.isRecommended;
  const isAlternate = index % 2 === 1;
  
  const rowStyles = [
    styles.tableRow,
    isAlternate && styles.tableRowAlternate,
    isRecommended && styles.tableRowRecommended
  ];

  return (
    <View style={rowStyles}>
      {columns.map((col, colIndex) => {
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
            if (score >= 60) cellStyles.push(styles.rankExcellent);
            else if (score >= 50) cellStyles.push(styles.rankGood);
            else if (score >= 40) cellStyles.push(styles.rankAverage);
            else if (score >= 30) cellStyles.push(styles.rankBelowAverage);
            else cellStyles.push(styles.rankPoor);
          }
        }
        
        // Last column - remove right border
        if (colIndex === columns.length - 1) {
          cellStyles.push({ borderRightWidth: 0 });
        }

        return (
          <View key={col.dataKey} style={cellStyles}>
            <Text style={[
              col.style.textAlign === 'right' && styles.numericText,
              col.dataKey === 'isRecommended' && isRecommended && styles.recommendedStar,
              col.dataKey === 'ytdReturn' || col.dataKey === 'oneYearReturn' || 
              col.dataKey === 'threeYearReturn' || col.dataKey === 'fiveYearReturn' ? 
                getReturnColor(cellValue) : {}
            ]}>
              {formatCellValue(cellValue, col.dataKey)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/**
 * Benchmark Row Component - Professional highlighting
 */
function BenchmarkRow({ benchmark, columns }) {
  return (
    <View style={[styles.tableRow, styles.benchmarkRow]}>
      {columns.map((col, colIndex) => {
        let cellValue = '';
        
        switch (col.dataKey) {
          case 'ticker':
            cellValue = benchmark.ticker || '';
            break;
          case 'name':
            cellValue = truncateText(benchmark.name || benchmark.ticker, 25);
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
          case 'standardDeviation3y':
            cellValue = benchmark.standard_deviation_3y ? formatPercent(benchmark.standard_deviation_3y) : 'N/A';
            break;
          case 'standardDeviation5y':
            cellValue = benchmark.standard_deviation_5y ? formatPercent(benchmark.standard_deviation_5y) : 'N/A';
            break;
          case 'score':
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
        ];

        return (
          <View key={col.dataKey} style={cellStyles}>
            <Text style={[
              col.style.textAlign === 'right' && styles.numericText
            ]}>
              {cellValue}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/**
 * Disclaimer Section Component
 */
function DisclaimerSection() {
  return (
    <View style={styles.disclaimerSection}>
      <Text style={[styles.assetClassTitle, { textAlign: 'center', marginBottom: 16 }]}>
        Important Disclosures
      </Text>
      
      <View style={styles.disclaimerContent}>
        <Text style={{ marginBottom: 12 }}>
          <Text style={{ fontWeight: 'bold' }}>Performance Disclosure:</Text> Past performance is not indicative of future results. 
          Investment returns and principal value will fluctuate, so shares may be worth more or less 
          than their original cost when redeemed.
        </Text>
        
        <Text style={{ marginBottom: 12 }}>
          <Text style={{ fontWeight: 'bold' }}>Risk Disclosure:</Text> All investments involve risk, including potential loss of principal. 
          Different investment strategies carry different risk profiles and may not be suitable for all investors.
        </Text>
        
        <Text style={{ marginBottom: 12 }}>
          <Text style={{ fontWeight: 'bold' }}>Data Sources:</Text> Performance data is sourced from fund companies and third-party 
          data providers. While we believe this information to be reliable, we cannot guarantee its accuracy.
        </Text>
        
        <Text>
          <Text style={{ fontWeight: 'bold' }}>Advisory Disclosure:</Text> This report is for informational purposes only and does not 
          constitute investment advice. Please consult with your financial advisor before making investment decisions.
        </Text>
      </View>
      
      <View style={styles.disclaimerFooter}>
        <Text>
          Raymond James & Associates, Inc. Member FINRA/SIPC{'\n'}
          © {new Date().getFullYear()} Raymond James & Associates, Inc. All rights reserved.
        </Text>
      </View>
    </View>
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
  if (value === null || value === undefined || isNaN(value)) {
    return 'N/A';
  }
  
  // Handle percentage values that might already be formatted
  let numValue = value;
  if (typeof value === 'string') {
    numValue = parseFloat(value.replace('%', ''));
    if (isNaN(numValue)) return 'N/A';
  }
  
  return formatPercentDisplay(numValue, decimals, true);
}

function formatNumber(value, decimals = 2) {
  if (value === null || value === undefined || isNaN(value)) {
    return 'N/A';
  }
  
  return formatNumberDisplay(value, decimals);
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

function getReturnColor(value) {
  if (value === null || value === undefined || isNaN(value)) {
    return {};
  }
  
  // Handle percentage values that might already be formatted
  let numValue = value;
  if (typeof value === 'string') {
    numValue = parseFloat(value.replace('%', ''));
    if (isNaN(numValue)) return {};
  }
  
  if (numValue > 0) {
    return styles.positiveReturn;
  } else if (numValue < 0) {
    return styles.negativeReturn;
  } else {
    return styles.neutralReturn;
  }
}

function formatCellValue(value, dataKey) {
  if (!value && value !== 0) return '';
  
  if (dataKey === 'ytdReturn' || dataKey === 'oneYearReturn' || 
      dataKey === 'threeYearReturn' || dataKey === 'fiveYearReturn') {
    return formatPercent(value);
  } else if (dataKey === 'expenseRatio' || dataKey === 'standardDeviation3y' || 
             dataKey === 'standardDeviation5y') {
    return formatPercent(value);
  } else if (dataKey === 'sharpeRatio' || dataKey === 'score') {
    return formatNumber(value);
  } else if (dataKey === 'managerTenure') {
    return formatTenure(value);
  } else {
    return value;
  }
}

export default MonthlyReportPDF;