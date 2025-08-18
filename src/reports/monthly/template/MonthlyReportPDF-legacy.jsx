/**
 * React-PDF Monthly Report Component (Legacy JSX version)
 * This is the JSX version - use the .js version for Node.js compatibility
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
  // Page layout
  page: {
    size: 'LETTER',
    orientation: 'landscape',
    paddingTop: 45,
    paddingRight: 40,
    paddingBottom: 45,
    paddingLeft: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    lineHeight: 1.4,
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
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#002F6C'
  },

  assetClassTitle: {
    fontSize: 16,
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
    marginTop: 16,
    marginBottom: 16,
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
    padding: 8,
    fontWeight: 'bold',
    fontSize: 9,
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
    padding: 6,
    fontSize: 9,
    borderRightWidth: 0.5,
    borderRightColor: '#D1D5DB',
    display: 'flex',
    alignItems: 'center'
  },

  tableCellBenchmark: {
    fontWeight: 'bold',
    borderRightColor: '#FFE69C'
  },

  // Column widths (based on current system)
  colTicker: { width: 38, textAlign: 'center' },
  colName: { width: 100, textAlign: 'left' },
  colYtd: { width: 30, textAlign: 'right' },
  col1y: { width: 30, textAlign: 'right' },
  col3y: { width: 30, textAlign: 'right' },
  col5y: { width: 30, textAlign: 'right' },
  colExpense: { width: 30, textAlign: 'right' },
  colSharpe: { width: 35, textAlign: 'right' },
  colScore: { width: 30, textAlign: 'right' },
  colRank: { width: 30, textAlign: 'center' },
  colTenure: { width: 35, textAlign: 'right' },
  colRec: { width: 22, textAlign: 'center' },

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
    fontSize: 12,
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
  
  return (
    <Document>
      {/* Cover Page */}
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        <CoverPage 
          data={data}
          options={options}
        />
      </Page>

      {/* Asset Class Sections */}
      {sections.map((section, index) => (
        <Page key={section.assetClass} size="LETTER" orientation="landscape" style={styles.page}>
          <PageHeader asOf={asOf} />
          <AssetClassSection 
            section={section}
            sectionNumber={index + 1}
            isLastSection={index === sections.length - 1}
          />
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
 * Fund Table Component
 */
function FundTable({ rows, benchmark, assetClass }) {
  const columns = [
    { header: 'Ticker', dataKey: 'ticker', style: styles.colTicker },
    { header: 'Fund Name', dataKey: 'name', style: styles.colName },
    { header: 'YTD', dataKey: 'ytdReturn', style: styles.colYtd },
    { header: '1Y', dataKey: 'oneYearReturn', style: styles.col1y },
    { header: '3Y', dataKey: 'threeYearReturn', style: styles.col3y },
    { header: '5Y', dataKey: 'fiveYearReturn', style: styles.col5y },
    { header: 'Expense', dataKey: 'expenseRatio', style: styles.colExpense },
    { header: 'Sharpe', dataKey: 'sharpeRatio', style: styles.colSharpe },
    { header: 'Score', dataKey: 'score', style: styles.colScore },
    { header: 'Rank', dataKey: 'rank', style: styles.colRank },
    { header: 'Tenure', dataKey: 'managerTenure', style: styles.colTenure },
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
 * Individual Fund Row Component
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
          cellValue = isRecommended ? '★' : '';
        }
        
        // Special handling for rank column with color coding
        let cellStyles = [styles.tableCell, col.style];
        if (col.dataKey === 'rank' && row.rank) {
          cellStyles.push(getRankColor(row.rank));
        }
        
        // Last column - remove right border
        if (colIndex === columns.length - 1) {
          cellStyles.push({ borderRightWidth: 0 });
        }

        return (
          <View key={col.dataKey} style={cellStyles}>
            <Text style={[
              col.style.textAlign === 'right' && styles.numericText,
              col.dataKey === 'isRecommended' && isRecommended && styles.recommendedStar
            ]}>
              {cellValue || ''}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/**
 * Benchmark Row Component
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
  return formatPercentDisplay(value, decimals, true);
}

function formatNumber(value, decimals = 2) {
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

function getRankColor(rankStr) {
  const rankMatch = rankStr.match(/^(\d+)\/(\d+)$/);
  if (!rankMatch) return {};
  
  const rank = parseInt(rankMatch[1]);
  const totalFunds = parseInt(rankMatch[2]);
  if (rank <= 0 || totalFunds <= 0) return {};
  
  const percentile = rank / totalFunds;
  
  if (percentile <= 0.2) return styles.rankExcellent;
  if (percentile <= 0.4) return styles.rankGood;
  if (percentile <= 0.6) return styles.rankAverage;
  if (percentile <= 0.8) return styles.rankBelowAverage;
  return styles.rankPoor;
}

export default MonthlyReportPDF;