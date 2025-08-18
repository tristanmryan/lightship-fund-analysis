/**
 * CSS Styles for Professional PDF Reports
 * Generates print-optimized CSS with embedded fonts and Raymond James branding
 */

/**
 * Generate complete CSS for the monthly report
 * @param {Object} theme - Theme configuration
 * @returns {string} Complete CSS string
 */
function getReportCSS(theme) {
  return `
/* Reset and Base Styles */
${getResetStyles()}

/* Font Embedding */
${getFontStyles()}

/* Page and Print Styles */
${getPageStyles(theme)}

/* Layout Components */
${getLayoutStyles(theme)}

/* Typography */
${getTypographyStyles(theme)}

/* Table Styles */
${getTableStyles(theme)}

/* Component Styles */
${getComponentStyles(theme)}

/* Utility Classes */
${getUtilityStyles(theme)}
`;
}

/**
 * CSS Reset and base styles
 */
function getResetStyles() {
  return `
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  height: 100%;
  margin: 0;
  padding: 0;
}

body {
  font-family: "Raymond James Sans", "Segoe UI", system-ui, sans-serif;
  font-size: 10pt;
  line-height: 1.4;
  color: #1F2937;
  background: white;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

/* Ensure proper text rendering */
* {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
`;
}

/**
 * Font embedding styles
 */
function getFontStyles() {
  return `
/* Raymond James brand font fallbacks */
@font-face {
  font-family: "Raymond James Sans";
  src: local("Segoe UI"), local("Arial");
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: "Raymond James Sans";
  src: local("Segoe UI Bold"), local("Arial Bold");
  font-weight: bold;
  font-style: normal;
  font-display: swap;
}

/* Monospace font for numbers */
@font-face {
  font-family: "Report Mono";
  src: local("SF Mono"), local("Monaco"), local("Consolas");
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}
`;
}

/**
 * Page and print configuration
 */
function getPageStyles(theme) {
  return `
@page {
  size: Letter landscape;
  margin: 16mm 14mm;
  
  @top-center {
    content: "Raymond James | Monthly Fund Analysis";
    font-size: 9pt;
    color: #6B7280;
  }
  
  @bottom-left {
    content: "Raymond James & Associates | Confidential";
    font-size: 8pt;
    color: #9CA3AF;
  }
  
  @bottom-center {
    content: "Page " counter(page) " of " counter(pages);
    font-size: 8pt;
    color: #9CA3AF;
  }
  
  @bottom-right {
    content: attr(data-generated-date);
    font-size: 8pt;
    color: #9CA3AF;
  }
}

/* Page break utilities */
.page-break-before {
  page-break-before: always;
  break-before: page;
}

.page-break-after {
  page-break-after: always;
  break-after: page;
}

.avoid-break {
  page-break-inside: avoid;
  break-inside: avoid;
}

.avoid-break-before {
  page-break-before: avoid;
  break-before: avoid;
}

.avoid-break-after {
  page-break-after: avoid;
  break-after: avoid;
}
`;
}

/**
 * Layout component styles
 */
function getLayoutStyles(theme) {
  return `
.monthly-report {
  width: 100%;
  background: white;
}

/* Cover Page */
.cover-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  position: relative;
}

.header-brand {
  margin-bottom: 40pt;
}

.brand-bar {
  width: 200pt;
  height: 4pt;
  background: linear-gradient(90deg, ${theme.colors.brand.primary} 0%, ${theme.colors.brand.accent} 100%);
  margin: 0 auto 20pt auto;
}

.report-meta {
  margin: 30pt 0;
  display: flex;
  gap: 40pt;
  justify-content: center;
}

.report-meta > div {
  display: flex;
  flex-direction: column;
  gap: 4pt;
}

.summary-box {
  background: ${theme.colors.background.secondary};
  border: 1pt solid ${theme.colors.table.border};
  border-radius: 8pt;
  padding: 24pt;
  margin: 30pt 0;
  max-width: 400pt;
}

.summary-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16pt;
  margin-top: 16pt;
}

.summary-item {
  text-align: center;
}

.metric-value {
  display: block;
  font-size: 24pt;
  font-weight: bold;
  color: ${theme.colors.brand.primary};
  line-height: 1.2;
}

.metric-label {
  display: block;
  font-size: 9pt;
  color: ${theme.colors.text.secondary};
  margin-top: 4pt;
}

.cover-footer {
  position: absolute;
  bottom: 40pt;
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
}

/* Table of Contents */
.toc-page {
  padding: 40pt 0;
}

.toc-list {
  margin-top: 24pt;
}

.toc-item {
  display: flex;
  align-items: baseline;
  padding: 8pt 0;
  border-bottom: 0.5pt solid ${theme.colors.table.border};
}

.toc-title {
  font-weight: 500;
}

.toc-dots {
  flex: 1;
  border-bottom: 1pt dotted ${theme.colors.text.muted};
  margin: 0 12pt 4pt 12pt;
  height: 1pt;
}

.toc-page-num {
  font-family: "Report Mono", monospace;
  font-weight: bold;
  color: ${theme.colors.brand.primary};
}

/* Summary Page */
.summary-page {
  padding: 40pt 0;
}

.summary-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 32pt;
  margin-top: 24pt;
}

.summary-stats-table {
  width: 100%;
  margin-top: 16pt;
}

.summary-notes ul {
  margin-top: 12pt;
  padding-left: 16pt;
}

.summary-notes li {
  margin-bottom: 8pt;
  line-height: 1.5;
}

/* Asset Class Sections */
.asset-class-section {
  margin-bottom: 32pt;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 16pt;
  padding-bottom: 8pt;
  border-bottom: 2pt solid ${theme.colors.brand.primary};
}

.section-meta {
  font-size: 9pt;
  color: ${theme.colors.text.secondary};
}

.recommended-count {
  color: ${theme.colors.brand.accent};
  font-weight: 500;
}

/* Disclaimer Section */
.disclaimer-section {
  margin-top: 40pt;
  padding: 24pt;
  background: ${theme.colors.background.secondary};
  border: 1pt solid ${theme.colors.table.border};
  border-radius: 4pt;
}

.disclaimer-content p {
  margin-bottom: 12pt;
  line-height: 1.5;
}

.disclaimer-footer {
  margin-top: 20pt;
  padding-top: 16pt;
  border-top: 1pt solid ${theme.colors.table.border};
  text-align: center;
  font-size: 8pt;
  color: ${theme.colors.text.muted};
}
`;
}

/**
 * Typography styles
 */
function getTypographyStyles(theme) {
  return `
/* Headings */
.main-title {
  font-size: 28pt;
  font-weight: bold;
  color: ${theme.colors.brand.primary};
  margin-bottom: 8pt;
  letter-spacing: -0.5pt;
}

.subtitle {
  font-size: 20pt;
  font-weight: 500;
  color: ${theme.colors.text.primary};
  margin-bottom: 6pt;
}

.report-type {
  font-size: 16pt;
  font-weight: normal;
  color: ${theme.colors.text.secondary};
}

.section-title {
  font-size: 20pt;
  font-weight: bold;
  color: ${theme.colors.brand.primary};
  margin-bottom: 16pt;
}

.asset-class-title {
  font-size: 16pt;
  font-weight: bold;
  color: ${theme.colors.brand.primary};
  margin: 0;
}

h3 {
  font-size: 14pt;
  font-weight: 600;
  color: ${theme.colors.text.primary};
  margin-bottom: 12pt;
}

h4 {
  font-size: 12pt;
  font-weight: 600;
  color: ${theme.colors.text.primary};
  margin-bottom: 8pt;
}

/* Text elements */
p {
  margin-bottom: 8pt;
  line-height: 1.5;
}

.label {
  font-weight: 600;
  color: ${theme.colors.text.secondary};
  font-size: 9pt;
}

.value {
  font-weight: 500;
  color: ${theme.colors.text.primary};
  font-size: 10pt;
}

.confidential-notice {
  font-size: 9pt;
  color: ${theme.colors.text.muted};
  font-style: italic;
  max-width: 300pt;
  line-height: 1.4;
}

/* Emphasis */
strong {
  font-weight: 600;
  color: ${theme.colors.text.primary};
}

em {
  font-style: italic;
  color: ${theme.colors.text.secondary};
}
`;
}

/**
 * Table styles
 */
function getTableStyles(theme) {
  return `
.fund-table-container {
  margin: 16pt 0;
  overflow: visible;
}

.fund-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 9pt;
  border: 1pt solid ${theme.colors.table.border};
}

/* Table Headers */
.fund-table thead th {
  background: ${theme.colors.table.header.background};
  color: ${theme.colors.table.header.text};
  padding: 8pt 6pt;
  font-weight: bold;
  font-size: 9pt;
  text-align: center;
  border: 1pt solid ${theme.colors.table.border};
  border-bottom: 2pt solid ${theme.colors.brand.primary};
}

/* Table Body */
.fund-table tbody td {
  padding: 6pt 4pt;
  border: 0.5pt solid ${theme.colors.table.border};
  font-size: 9pt;
  vertical-align: middle;
}

/* Column Widths */
.col-ticker { width: 60pt; text-align: center; }
.col-name { width: 140pt; text-align: left; }
.col-ytd { width: 45pt; }
.col-1y { width: 45pt; }
.col-3y { width: 45pt; }
.col-5y { width: 45pt; }
.col-expense { width: 50pt; }
.col-sharpe { width: 50pt; }
.col-score { width: 40pt; }
.col-rank { width: 50pt; }
.col-tenure { width: 50pt; }
.col-rec { width: 30pt; }

/* Row Styling */
.fund-row:nth-child(even) {
  background: ${theme.colors.table.alternateRow};
}

.fund-row.recommended {
  border-left: 3pt solid ${theme.colors.status.recommended};
}

.benchmark-row {
  background: ${theme.colors.benchmark.background} !important;
  border-top: 2pt solid ${theme.colors.benchmark.border};
  border-bottom: 2pt solid ${theme.colors.benchmark.border};
  font-weight: bold;
}

.benchmark-row td {
  border-color: ${theme.colors.benchmark.border};
  font-weight: bold;
}

/* Cell Alignment */
.numeric {
  text-align: right;
  font-family: "Report Mono", monospace;
  font-variant-numeric: tabular-nums;
}

.center {
  text-align: center;
}

/* Summary table */
.summary-stats-table {
  border-collapse: collapse;
  font-size: 9pt;
}

.summary-stats-table th,
.summary-stats-table td {
  padding: 8pt 12pt;
  border: 1pt solid ${theme.colors.table.border};
  text-align: left;
}

.summary-stats-table th {
  background: ${theme.colors.table.header.background};
  color: ${theme.colors.table.header.text};
  font-weight: bold;
}

.summary-stats-table tbody tr:nth-child(even) {
  background: ${theme.colors.table.alternateRow};
}

/* Ensure tables don't break across pages poorly */
.fund-table {
  page-break-inside: auto;
}

.fund-table thead {
  display: table-header-group;
}

.fund-table tbody tr {
  page-break-inside: avoid;
  break-inside: avoid;
}
`;
}

/**
 * Component-specific styles
 */
function getComponentStyles(theme) {
  return `
/* Performance indicators */
.performance-positive {
  color: ${theme.colors.status.positive};
}

.performance-negative {
  color: ${theme.colors.status.negative};
}

.performance-neutral {
  color: ${theme.colors.status.neutral};
}

/* Recommended indicator */
.recommended-star {
  color: ${theme.colors.status.recommended};
  font-size: 12pt;
  font-weight: bold;
}

/* Rankings with color coding */
.rank-excellent { background: ${theme.colors.performance.excellent}; }
.rank-good { background: ${theme.colors.performance.good}; }
.rank-average { background: ${theme.colors.performance.average}; }
.rank-below-average { background: ${theme.colors.performance.belowAverage}; }
.rank-poor { background: ${theme.colors.performance.poor}; }

/* Status badges */
.badge {
  display: inline-block;
  padding: 2pt 6pt;
  border-radius: 3pt;
  font-size: 8pt;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5pt;
}

.badge-recommended {
  background: ${theme.colors.status.recommended};
  color: white;
}

.badge-neutral {
  background: ${theme.colors.background.accent};
  color: ${theme.colors.text.secondary};
}

/* Callout boxes */
.callout {
  padding: 12pt;
  margin: 16pt 0;
  border-radius: 4pt;
  border-left: 3pt solid;
}

.callout-info {
  background: ${theme.colors.background.secondary};
  border-color: ${theme.colors.semantic.info};
}

.callout-warning {
  background: #FEF3CD;
  border-color: ${theme.colors.semantic.warning};
}

.callout-success {
  background: #D1FAE5;
  border-color: ${theme.colors.semantic.success};
}
`;
}

/**
 * Utility classes
 */
function getUtilityStyles(theme) {
  return `
/* Text utilities */
.text-left { text-align: left; }
.text-center { text-align: center; }
.text-right { text-align: right; }

.text-small { font-size: 8pt; }
.text-body { font-size: 10pt; }
.text-large { font-size: 12pt; }

.font-normal { font-weight: 400; }
.font-medium { font-weight: 500; }
.font-semibold { font-weight: 600; }
.font-bold { font-weight: 700; }

/* Color utilities */
.text-primary { color: ${theme.colors.text.primary}; }
.text-secondary { color: ${theme.colors.text.secondary}; }
.text-muted { color: ${theme.colors.text.muted}; }
.text-brand { color: ${theme.colors.brand.primary}; }
.text-accent { color: ${theme.colors.brand.accent}; }

/* Background utilities */
.bg-white { background: white; }
.bg-gray { background: ${theme.colors.background.secondary}; }
.bg-accent { background: ${theme.colors.background.accent}; }

/* Spacing utilities */
.m-0 { margin: 0; }
.mt-1 { margin-top: 4pt; }
.mt-2 { margin-top: 8pt; }
.mt-3 { margin-top: 12pt; }
.mt-4 { margin-top: 16pt; }

.mb-1 { margin-bottom: 4pt; }
.mb-2 { margin-bottom: 8pt; }
.mb-3 { margin-bottom: 12pt; }
.mb-4 { margin-bottom: 16pt; }

.p-0 { padding: 0; }
.p-1 { padding: 4pt; }
.p-2 { padding: 8pt; }
.p-3 { padding: 12pt; }
.p-4 { padding: 16pt; }

/* Border utilities */
.border { border: 1pt solid ${theme.colors.table.border}; }
.border-top { border-top: 1pt solid ${theme.colors.table.border}; }
.border-bottom { border-bottom: 1pt solid ${theme.colors.table.border}; }

/* Display utilities */
.hidden { display: none; }
.block { display: block; }
.inline { display: inline; }
.inline-block { display: inline-block; }
.flex { display: flex; }
.grid { display: grid; }

/* Flexbox utilities */
.justify-start { justify-content: flex-start; }
.justify-center { justify-content: center; }
.justify-end { justify-content: flex-end; }
.justify-between { justify-content: space-between; }

.items-start { align-items: flex-start; }
.items-center { align-items: center; }
.items-end { align-items: flex-end; }

/* Print utilities */
@media print {
  .print-hidden { display: none !important; }
  .print-block { display: block !important; }
}
`;
}

// Export for CommonJS
module.exports = { getReportCSS };