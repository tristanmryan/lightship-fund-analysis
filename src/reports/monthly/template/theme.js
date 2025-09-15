// src/reports/monthly/template/theme.js

// Central theme tokens for the Monthly PDF design
const theme = {
  // Typography
  fonts: { base: 'Carlito' },
  fontSizes: {
    base: 8,
    header: 9,
    footer: 8,
    title: 18,
    coverMain: 32,
    coverSubtitle: 18,
    coverReportType: 14,
    tableHeader: 7,
    tableCell: 6,
    fundName: 7,
  },

  // Colors
  colors: {
    text: '#1A1A1A',
    subtleText: '#6B7280',
    title: '#111827',
    brand: '#1E40AF',
    headerDivider: '#E8E8E8',
    footerDivider: '#E8E8E8',
    headerText: '#002F6C',
    number: '#0F172A',
  },

  // Table styling
  table: {
    headerBg: '#1F4E79',
    headerBorder: '#9CA3AF',
    rowBorder: '#F9FAFB',
    cellBorder: '#F3F4F6',
    rowAltBg: '#FCFCFC',
    recommendedAccent: '#34D399',
    recommendedBg: '#F0FDF4',
    benchmarkBg: '#FFD699',
    benchmarkAccent: '#F59E0B',

    // Score background rank colors
    score: {
      excellent: '#E8F5E8',
      good: '#FFF8E1',
      average: '#FFF3E0',
      belowAverage: '#FFEBEE',
      poor: '#FFEBEE',
    },

    // Column widths (points)
    columnWidths: {
      ticker: 50,
      name: 140,
      ytd: 60,
      oneY: 60,
      threeY: 60,
      fiveY: 60,
      sharpe: 60,
      std3y: 60,
      std5y: 60,
      expense: 60,
      tenure: 60,
      score: 50,
    },

    cellPadding: 4,
  },

  layout: {
    pagePadding: 40,
    rowMinHeight: 20,
    sectionSpacing: 20,
    headerHeight: 70,
    footerHeight: 50,
    sectionHeaderHeight: 30,
    tableHeaderHeight: 20,
  },
};

export default theme;
