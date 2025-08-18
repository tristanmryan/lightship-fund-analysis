//PDF Report Research 2

--------------------------------
//ASK Request #1



> I want you to do a deep dive into the codebase to investigate an older PDF report feature that I believe still exists in the code, but is no longer in active use. From memory, this was implemented as a monthly PDF export button and the code should still be in the `/src/services/` folder — possibly in a file named something like `exportService.js` or `pdfReportService.js`.
>
> This report generated tables grouped by asset class with the benchmark listed at the bottom of each table. I remember liking the way the data was organized in that version, but the look and feel were basic and could be much more professional. The reliability and polish of the generated reports also need to be greatly improved.
>
> Your mission is to:
>
> 1. Locate all files, components, and functions related to the old PDF report feature.
> 2. Summarize exactly how it worked — including which components triggered it, how the data was fetched and shaped, and how asset classes and benchmarks were grouped in the final output.
> 3. Identify all dependencies, helper functions, or templates tied to this feature.
> 4. Evaluate the strengths and weaknesses of the original implementation, especially the data organization logic.
> 5. Suggest how we could rebuild this from scratch as a modern, professional, and reliable monthly PDF report generator — preserving the good parts of the old grouping logic but significantly enhancing:
>
>    * **Look and feel** (layout, typography, branding, visual appeal).
>    * **Reliability** (consistent formatting, error handling, scalable for large datasets).
>    * **Professional polish** (branded headers/footers, clear sectioning, callouts).
>    * **Flexibility** (easy to adjust layouts, add/remove metrics, change grouping rules).
>
> Please provide:
>
> * A full inventory of the old PDF report code and where it lives in the repo.
> * A clear explanation of the old report’s data flow and table/benchmark grouping logic.
> * A technical proposal for a new and improved PDF report feature, with 2–3 potential design/architecture options.
> * Recommendations for libraries, templates, or techniques that could significantly elevate the professionalism and maintainability of the reports.
>
> The goal is to first understand the existing code enough to learn from it, and then use that knowledge to design a much better replacement from the ground up.



--------------------------------

//Response #1 from Cursor:

I'll start by scanning the codebase to find all references to the old PDF report feature and identify the triggering components and services. Then I'll open the most relevant files to analyze their data flow and grouping logic.
Search files...
Search files...
Search files...
Ran tool
Ran tool
Ran tool

Scanning relevant files and usages to fully map the legacy PDF feature and its data flow. Pulling code for the PDF service, export service, and UI triggers, and searching for benchmark/table logic and autotable usage.
Read file: src/services/pdfReportService.js
Read file: src/services/exportService.js
Read file: src/components/Reports/MonthlyReportButton.jsx
Read file: src/components/Dashboard/EnhancedPerformanceDashboard.jsx
Read file: src/components/Admin/AdminOverview.jsx
Ran tool

Ran tool

Ran tool

Ran tool

Ran tool

Gathering more context: inspecting benchmark resolver and supabase tables for benchmark mapping; reviewing export helpers for filename and downloading; and checking if the PDF plugin is actually imported anywhere.
Read file: src/services/resolvers/benchmarkResolverClient.js
Read file: src/services/supabase.js
Ran tool
Ran tool
Read file: src/services/exportService.js

Ran tool

Ran tool

Read file: src/assets/theme.js
Ran tool

Ran tool

Read file: package.json

Read file: src/hooks/useFundData.js

### What I found (full inventory)

- Services (core of the old feature)
  - `src/services/exportService.js`
    - `generatePDFReport(data)` → shapes metadata, lazy-loads the PDF generator, and returns a jsPDF instance.
```170:196:src/services/exportService.js
/**
 * Generate PDF report
 * @param {Object} data - Report data
 * @returns {jsPDF} PDF document
 */
export function generatePDFReport(data) {
  const { funds, metadata } = data;
  ...
  const { generateMonthlyReport } = require('./pdfReportService');
  return generateMonthlyReport({ funds, metadata: pdfMetadata });
}
```
  - `src/services/pdfReportService.js`
    - `generateMonthlyReport({ funds, metadata })` → builds the PDF, adds a cover page, groups funds by asset class, renders a table per asset class, then adds page numbers.
    - Helpers: `groupFundsByAssetClass`, `addAssetClassTable`, `prepareRowData`, `getColumnStyles`, `formatPercent`, `formatNumber`, `addPageNumbers`; constants `REPORT_CONFIG`, `TABLE_COLUMNS`.
```68:104:src/services/pdfReportService.js
export function generateMonthlyReport(data) {
  const { funds, metadata } = data;
  const doc = new jsPDF({ orientation: REPORT_CONFIG.orientation, unit: REPORT_CONFIG.unit, format: REPORT_CONFIG.format });
  doc.addFileToVFS('DejaVuSans.ttf', DejaVuSans);
  doc.addFont('DejaVuSans.ttf', 'DejaVuSans', 'normal');
  doc.setFont('helvetica');
  addCoverPage(doc, metadata);
  doc.addPage();
  const fundsByClass = groupFundsByAssetClass(funds);
  Object.entries(fundsByClass).forEach(([assetClass, classFunds]) => {
    if (classFunds.length === 0) return;
    addAssetClassTable(doc, assetClass, classFunds);
  });
  addPageNumbers(doc, doc.getNumberOfPages());
  return doc;
}
```
```158:173:src/services/pdfReportService.js
function groupFundsByAssetClass(funds) {
  const grouped = {};
  funds.forEach(fund => {
    const assetClass = fund.asset_class || 'Unassigned';
    if (!grouped[assetClass]) grouped[assetClass] = [];
    grouped[assetClass].push(fund);
  });
  return grouped;
}
```
```178:205:src/services/pdfReportService.js
function addAssetClassTable(doc, assetClass, funds) {
  let startY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 20 : REPORT_CONFIG.margins.top;
  const tableData = funds.map(fund => prepareRowData(fund));
  ...
  doc.setFontSize(REPORT_CONFIG.fontSize.heading);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(...REPORT_CONFIG.colors.primary);
  doc.text(assetClass, REPORT_CONFIG.margins.left, startY);
  doc.autoTable({
    startY: startY + 15,
    head: [TABLE_COLUMNS.map(col => col.header)],
    body: tableData,
    columns: TABLE_COLUMNS,
    ...
```
```252:270:src/services/pdfReportService.js
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
```
  - Assets used
    - `src/assets/DejaVuSans.js` (embedded font registered in the PDF, though not actually used afterward)
    - `src/assets/theme.js` (not referenced by PDF generation, but gives brand colors)

- UI triggers (where it’s invoked)
  - `src/components/Dashboard/EnhancedPerformanceDashboard.jsx` → export menu items for “PDF (all)” and “PDF — Recommended”
```694:732:src/components/Dashboard/EnhancedPerformanceDashboard.jsx
<button ... onClick={() => {
  try {
    const metadata = { date: ..., totalFunds: ..., recommendedFunds: ..., assetClassCount: ..., averagePerformance: ... };
    const pdf = generatePDFReport({ funds: filteredFunds, metadata });
    const name = formatExportFilename({ scope: 'pdf_all', asOf: (asOfMonthProp || window.__AS_OF_MONTH__ || null), ext: 'pdf' });
    pdf.save(name);
  } catch (e) { console.error('PDF export failed', e); }
}}>
  PDF (all)
</button>
<button ... disabled={(filteredFunds.filter(f => f.is_recommended || f.recommended).length === 0)} onClick={() => {
  const rec = (filteredFunds || []).filter(f => f.is_recommended || f.recommended);
  ...
  const pdf = generatePDFReport({ funds: rec, metadata });
  const name = formatExportFilename({ scope: 'pdf_recommended', asOf: (asOfMonthProp || window.__AS_OF_MONTH__ || null), ext: 'pdf' });
  pdf.save(name);
}}>
  PDF — Recommended
</button>
```
  - `src/components/Admin/AdminOverview.jsx` → admin “All funds (PDF)” quick export
```141:160:src/components/Admin/AdminOverview.jsx
<button role="menuitem" ... onClick={async () => {
  try {
    const { supabase, TABLES } = await import('../../services/supabase');
    const { data: funds } = await supabase.from(TABLES.FUNDS).select('*').order('ticker');
    const metadata = { date: ..., totalFunds: ..., ... };
    const pdf = generatePDFReport({ funds: funds || [], metadata });
    const { formatExportFilename } = await import('../../services/exportService');
    const name = formatExportFilename({ scope: 'admin_pdf_all', ext: 'pdf' });
    pdf.save(name);
  } catch (e) { console.error('PDF export failed', e); }
}}>All funds (PDF)</button>
```
  - `src/components/Reports/MonthlyReportButton.jsx` exists but appears unused (no imports reference it). It is a simple wrapper around `generatePDFReport`, `exportToExcel`, `exportToCSV`.

- Related helpers and data sources
  - `src/services/exportService.js`: `formatExportFilename`, `downloadFile`, Excel/CSV exports.
  - `src/hooks/useFundData.js`: primary source of normalized fund data for most UI exports.
  - `src/services/resolvers/benchmarkResolverClient.js`: resolver for primary benchmarks per asset class (not referenced by the current PDF generator).
  - `src/services/supabase.js`: `TABLES` includes `BENCHMARKS`, `ASSET_CLASS_BENCHMARKS`, `BENCHMARK_PERFORMANCE` (available but not used in the current PDF).

### How it worked

- Trigger
  - From dashboard exports (“PDF (all)” or “PDF — Recommended”) and Admin “All funds (PDF)”, the UI gathers a fund list and minimal metadata, then calls `generatePDFReport` which delegates to `pdfReportService.generateMonthlyReport`.

- Data fetching and shaping
  - Funds are generally loaded via `useFundData()` (database through `fundService`, with optional runtime scoring). Admin export pulls funds directly from Supabase.
  - `exportService.generatePDFReport` augments metadata (counts, average performance) and passes `{ funds, metadata }` to the PDF service.
  - In the PDF builder:
    - Funds are grouped by `asset_class` → `groupFundsByAssetClass`.
    - Each group is rendered as a separate `autoTable` with a brand-colored header row.
    - Each fund row is shaped by `prepareRowData` with percent/number formatting and “Recommended” marked as “Yes/No”.
    - A cover page with RJ branding and a summary box appears first; page numbers are added to all pages at the end.

- Asset class and benchmark grouping in the final output
  - Asset classes: yes, one table per asset class, labeled with the class name.
  - Benchmarks: despite color constants for “benchmark” in the config, there is no benchmark row rendered at the bottom of each table in this version. The resolver and benchmark tables exist in the codebase but are not used by the PDF service.

### Dependencies, helpers, templates tied to this feature

- Direct
  - `jspdf` (client-side PDF engine)
  - `jspdf-autotable` (table plugin) — installed but not imported anywhere; `doc.autoTable` is called, so this is a reliability risk.
  - `src/assets/DejaVuSans.js` (font) — registered in VFS but not used after `setFont('helvetica')`.
- Indirect/Adjacent
  - `html2canvas` (for PNG export elsewhere; not used in PDF).
  - Supabase tables (`FUNDS`, `ASSET_CLASS_BENCHMARKS`, `BENCHMARKS`, `BENCHMARK_PERFORMANCE`) and resolver (`benchmarkResolverClient`) could support a benchmark row but aren’t wired in.

### Strengths and weaknesses

- Strengths
  - Clear separation: UI triggers → `exportService.generatePDFReport` → `pdfReportService` renderer.
  - Reasonable data shaping with central formatting (`prepareRowData`, `formatPercent`, `formatNumber`).
  - Asset-class grouping is straightforward and readable.
  - Cover page + page numbers add baseline professionalism.
  - Lazy-load of the PDF generator prevents test-time crashes.

- Weaknesses / risks
  - Missing import for `jspdf-autotable` → `doc.autoTable` may be undefined at runtime.
  - No benchmark row integration (despite tables/resolver existing).
  - Font setup is inconsistent: DejaVuSans is embedded but not used; default is Helvetica.
  - Limited polish: no repeated branded headers/footers per page; basic table styling; unbalanced column widths; no long-name wrapping rules; small body font.
  - No explicit sorting within asset classes; output order depends on input list.
  - No robust error handling or progress feedback for large exports.
  - Potential page-break artifacts from manual `startY` checking plus `autoTable` internal pagination.

### Proposal: rebuild as a professional, reliable monthly PDF

Option 1: Modernize the current jsPDF + AutoTable pipeline (client-only)
- What to keep
  - Client-only generation for instant downloads; asset-class grouping; basic metadata summary.
- Key improvements
  - Reliability
    - Explicitly import the plugin at the top of `pdfReportService.js`:
```javascript
import jsPDF from 'jspdf';
import 'jspdf-autotable';
```
  - Architecture
    - Extract a reusable “report schema” for columns: label, key, width, align, formatter, visibility.
    - Centralize theming (colors, fonts, spacing) and register a real brand font (e.g., RJ-approved serif/sans).
    - Add per-page header/footer using `autoTable` hooks (`didDrawPage`) for logos, as-of date, and page numbers.
  - Benchmarks
    - For each asset class: resolve primary benchmark via `benchmarkResolverClient` and fetch its metrics for the active as-of month (from `TABLES.BENCHMARK_PERFORMANCE`). Append a bold, highlighted “Benchmark” row at the bottom of each table; align its columns and metric formatters identically.
  - Look & feel
    - Larger body font (9–10pt), better column widths, right-align numeric cells; wrap long names; alternating row colors with lighter contrast; strong section titles with a top rule.
    - Use cell styling hooks (`didParseCell`) to:
      - Shade the benchmark row (brand gold background, dark text).
      - Bold recommended funds or add a left indicator.
      - Color negative returns subtly red, positive green.
  - Flexibility
    - Single config file to toggle metrics, grouping rules, and column order; easy to add/remove metrics.
  - Scale
    - For large datasets: chunk asset classes or limit rows per table; add a “continued” label automatically; show a progress indicator while generating.

Option 2: Server-rendered HTML-to-PDF (highest fidelity)
- What
  - Render a dedicated branded HTML/React template (full CSS control), then generate PDF via a serverless function using `puppeteer-core` + `chrome-aws-lambda` (Vercel-friendly).
- Why
  - Pixel-perfect typography, CSS layout, real headers/footers, automatic page breaks and widows/orphans control, better charts and logos.
- How
  - Add an API route (e.g., `/api/reports/monthly`) that:
    - Accepts dataset and “as-of month,” resolves benchmarks, renders a React HTML template, and prints to PDF server-side.
  - Reuse app theme tokens (`src/assets/theme.js`) in CSS.
- Tradeoffs
  - Requires serverless infra; slightly heavier devops; but most professional and consistent output.

Option 3: Componentized PDF via `react-pdf` (pdfkit)
- What
  - Build a `Report` component hierarchy (`Header`, `Footer`, `AssetClassSection`, `DataTable`, `BenchmarkRow`) with a declarative API and shared styles.
- Pros/Cons
  - Strong maintainability and theming; good for programmatic layouts; less CSS fidelity than HTML/Puppeteer; table pagination needs careful handling.

Recommended stack choice
- Short term: Option 1 (client, quick win, minimal infra changes).
- Medium term: Option 2 for executive-ready PDFs (if you want consistent brand fidelity and richer layout, especially when adding charts).

### Specific recommendations to elevate quality

- Libraries
  - Tables: `jspdf-autotable` (ensure explicit import), or switch to `pdfmake` if you want JSON-defined styles and consistent pagination.
  - Server PDF: `puppeteer-core` + `chrome-aws-lambda` on Vercel; or use a managed HTML-to-PDF API if you prefer zero-maintenance infra.
  - Component PDF: `@react-pdf/renderer` for a component-first approach.
- Fonts and branding
  - Use an approved brand font; embed WOFF/TTF once; set as default for body and headings.
  - Build a `reportTheme` JS module mirroring `src/assets/theme.js` for consistent colors and spacing.
- Table UX
  - Right-align numeric cells; fixed decimal precision; contextual colors for positive/negative values; text-wrap with measured widths; wide columns for names; freeze header row, repeat per page.
- Benchmarks
  - Add a bottom “Benchmark” row in each asset-class table:
    - Resolve via `benchmarkResolverClient.getPrimaryBenchmark` and read metrics from `TABLES.BENCHMARK_PERFORMANCE` for the active month.
    - Style with a distinct background and bold font; ensure its row is excluded from fund counts where needed.
- Reliability
  - Guard nulls and NaNs centrally; pre-validate the dataset and give a clean error if no rows.
  - Add a progress spinner overlay and cancellation for long reports.
  - Unit-test the column formatter set and the group/benchmark resolver.

### Clarification about the benchmark row
- The current implementation does not add a benchmark row to each table. The resolver and benchmark tables are present and can support it, but the PDF builder doesn’t call them. If you saw benchmark rows previously, that was likely an older iteration that was removed or not migrated into this version.

If you want, I can draft a minimal edit to:
- Import `jspdf-autotable` correctly in `pdfReportService.js`.
- Switch the font to the embedded DejaVuSans (or another approved brand font).
- Add a benchmark row per asset class using the existing resolver and `BENCHMARK_PERFORMANCE`.

Summary
- Found the full chain: UI triggers (Dashboard/Admin/unused MonthlyReportButton) → `exportService.generatePDFReport` → `pdfReportService.generateMonthlyReport`.
- Current PDF groups by asset class but does not include a benchmark row; it also doesn’t import the table plugin, which risks runtime errors.
- Proposed two primary rebuild options (client-only modernized vs. server-rendered HTML-to-PDF) and a third componentized approach, plus concrete styling, reliability, and flexibility improvements.


--------------------------------
//ASK Request #2

> **Goal:** Ship a reliable MVP PDF now using the existing `pdfReportService` path, while documenting the exact code deltas and tests. Benchmarks must appear at the bottom of each asset class table.
>
> Please produce a surgical plan that includes:
>
> 1. **Exact code edits** with file paths and line anchors for:
>
>    * Explicit `jspdf-autotable` import and initialization in `src/services/pdfReportService.js`.
>    * Font embedding that is actually used in tables.
>    * A new helper `appendBenchmarkRow({ doc, assetClass, asOf })` called from `addAssetClassTable`, with clear styling and a guard for missing data.
>    * Centralized number formatting reused from `exportService` so CSV, Excel, and PDF align.
> 2. **Benchmark data contract** you will follow:
>
>    * Source tables and fields for class→benchmark mapping, and where monthly benchmark performance is read.
>    * The exact as-of handling rule, including EOM conversion if the snapshot is not EOM.
>    * Fallback behavior when benchmark data is missing.
> 3. **Performance and UX protections** for client generation:
>
>    * Add a Web Worker plan or chunked rendering approach to avoid blocking the UI if the fund count is large.
>    * Timeouts and user-visible errors for empty sets or missing required fields.
> 4. **Test plan and fixtures:**
>
>    * Provide a small JSON fixture of funds across 2 asset classes with one benchmark missing, plus the expected benchmark row values for the present one.
>    * Propose unit tests for `groupFundsByAssetClass`, `prepareRowData`, and your new `appendBenchmarkRow`.
>    * Propose a light visual assertion strategy that checks table header names, row counts per class, and presence of a single benchmark row.
> 5. **Acceptance checklist** for me to verify manually after implementation:
>
>    * Files edited, buttons still work in Dashboard and Admin, benchmark row appears once per class with correct numbers, fonts consistent, file name format consistent, generation completes within a reasonable time on 500+ rows.
>
> Keep this limited to the MVP path. No code changes now. I want a precise edit list, test list, and sample data I can hand to an AGENT request.



--------------------------------

//Response #2 from Cursor:

Read file: src/services/asOfStore.js

Read file: src/utils/formatters.js

Read file: supabase/migrations/20250813_benchmark_performance.sql
Read file: supabase-schema.sql

I’m going to lay out an exact, surgical MVP plan to make the existing path reliable and add a benchmark row at the bottom of each asset-class table. This includes precise edit anchors, a data contract, perf/UX protections, a test plan with fixtures, and an acceptance checklist. No code changes yet—this is the spec you can hand off.

### 1) Exact code edits (with file paths and line anchors)

- Explicit `jspdf-autotable` import and use embedded font

  - File: `src/services/pdfReportService.js`
    - Add the plugin import (side-effect import so `doc.autoTable` is always defined).
```1:4:src/services/pdfReportService.js
// src/services/pdfReportService.js
import jsPDF from 'jspdf';
import DejaVuSans from '../assets/DejaVuSans.js';
import 'jspdf-autotable';
```
    - Replace the default font to actually use the embedded font and enforce it in table styles.
```78:83:src/services/pdfReportService.js
// Register font for special characters
doc.addFileToVFS('DejaVuSans.ttf', DejaVuSans);
doc.addFont('DejaVuSans.ttf', 'DejaVuSans', 'normal');
doc.setFont('DejaVuSans', 'normal');
```
```205:214:src/services/pdfReportService.js
styles: {
  font: 'DejaVuSans',
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
```

- Centralized number formatting reused from `exportService`

  - File: `src/services/exportService.js`
    - Add display-oriented formatters for PDF/HTML (CSV/Excel can keep raw numerics). Export them for reuse.
```719:740:src/services/exportService.js
/**
 * Display-oriented formatters for PDF/HTML so all displays align.
 * CSV/Excel exports keep raw numerics intentionally.
 */
export function formatNumberDisplay(value, decimals = 2) {
  if (value == null || Number.isNaN(Number(value))) return 'N/A';
  return Number(value).toFixed(decimals);
}

export function formatPercentDisplay(value, decimals = 2, withSign = true) {
  if (value == null || Number.isNaN(Number(value))) return 'N/A';
  const n = Number(value);
  const sign = withSign && n > 0 ? '+' : '';
  return `${sign}${n.toFixed(decimals)}%`;
}

/**
 * Normalize a YYYY-MM-DD to the end-of-month date in the same UTC month.
 */
export function toEomDate(dateStr) {
  if (!dateStr) return null;
  try {
    const d = new Date(`${dateStr}T00:00:00Z`);
    const eom = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
    return `${eom.getUTCFullYear()}-${String(eom.getUTCMonth() + 1).padStart(2, '0')}-${String(eom.getUTCDate()).padStart(2, '0')}`;
  } catch {
    return null;
  }
}
```
  - File: `src/services/pdfReportService.js`
    - Import and use these shared formatters.
```1:6:src/services/pdfReportService.js
import jsPDF from 'jspdf';
import DejaVuSans from '../assets/DejaVuSans.js';
import 'jspdf-autotable';
import { formatNumberDisplay, formatPercentDisplay } from './exportService';
```
    - Replace local formatters with shared ones:
```288:305:src/services/pdfReportService.js
// REMOVE local formatPercent/formatNumber helpers entirely.
// All formatting calls below should instead use formatPercentDisplay/formatNumberDisplay.
```
    - Update `prepareRowData` to use shared functions:
```255:269:src/services/pdfReportService.js
function prepareRowData(fund) {
  return {
    ticker: fund.ticker || '',
    name: fund.name || '',
    asset_class: fund.asset_class_name || fund.asset_class || 'Unassigned',
    ytd_return: formatPercentDisplay(fund.ytd_return),
    one_year_return: formatPercentDisplay(fund.one_year_return),
    three_year_return: formatPercentDisplay(fund.three_year_return),
    five_year_return: formatPercentDisplay(fund.five_year_return),
    expense_ratio: formatPercentDisplay(fund.expense_ratio),
    sharpe_ratio: formatNumberDisplay(fund.sharpe_ratio, 2),
    standard_deviation_3y: formatPercentDisplay(fund.standard_deviation_3y ?? fund.standard_deviation),
    standard_deviation_5y: formatPercentDisplay(fund.standard_deviation_5y),
    is_recommended: fund.is_recommended ? 'Yes' : 'No'
  };
}
```

- New helper `appendBenchmarkRow({ doc, assetClass, asOf })` and call from `addAssetClassTable`

  - File: `src/services/pdfReportService.js`
    - Add required imports for data access and mapping fallback.
```6:12:src/services/pdfReportService.js
import { supabase, TABLES } from './supabase';
import { getPrimaryBenchmarkSyncByLabel } from './resolvers/benchmarkResolverClient';
```
    - Make the PDF generator async so we can resolve the benchmark row.
```65:71:src/services/pdfReportService.js
/**
 * Main export function - Generate monthly performance report PDF
 */
export async function generateMonthlyReport(data) {
```
    - Thread `asOf` from metadata and yield between classes to avoid UI jank.
```89:104:src/services/pdfReportService.js
// Add each asset class section
const asOf = data?.metadata?.asOf || null;
for (const [assetClass, classFunds] of Object.entries(fundsByClass)) {
  if (classFunds.length === 0) continue;
  await addAssetClassTable(doc, assetClass, classFunds, asOf);
  // Cooperative yield to keep UI responsive on large sets
  await yieldToMainThread();
}
```
    - Update `addAssetClassTable` signature and call `appendBenchmarkRow` after the fund table.
```175:250:src/services/pdfReportService.js
/**
 * Add asset class table to PDF
 */
async function addAssetClassTable(doc, assetClass, funds, asOf) {
  let startY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 20 : REPORT_CONFIG.margins.top;

  const tableData = funds.map(fund => prepareRowData(fund));

  // Page break guard
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

  // Funds table
  doc.autoTable({
    startY: startY + 15,
    head: [TABLE_COLUMNS.map(col => col.header)],
    body: tableData,
    columns: TABLE_COLUMNS,
    styles: {
      font: 'DejaVuSans',
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

  // Append a single benchmark row for this asset class (guarded)
  await appendBenchmarkRow({ doc, assetClass, asOf });
}
```
    - Add the new helper and a tiny yield helper.
```326:326:src/services/pdfReportService.js
// Append after the last line of the file
```
```javascript
// New: cooperative yield to keep UI responsive while generating
async function yieldToMainThread() {
  await new Promise((resolve) => {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => resolve());
    } else {
      setTimeout(resolve, 0);
    }
  });
}

/**
 * Append a single benchmark row below the current table for the given asset class.
 * Uses Supabase-first lookup, falls back to config mapping by label if necessary.
 * If no mapping or no performance row exists for asOf (EOM), no row is appended.
 */
async function appendBenchmarkRow({ doc, assetClass, asOf }) {
  try {
    const eom = asOf || null;
    // Resolve primary benchmark (Supabase by asset_class name -> id -> mapping -> benchmark)
    let benchTicker = null;
    let benchName = null;

    // Attempt Supabase-first mapping by asset class name
    if (assetClass) {
      const { data: ac } = await supabase
        .from(TABLES.ASSET_CLASSES)
        .select('id,name')
        .eq('name', assetClass)
        .maybeSingle();
      if (ac?.id) {
        const { data: mapRows } = await supabase
          .from(TABLES.ASSET_CLASS_BENCHMARKS)
          .select('benchmark_id,kind,rank')
          .eq('asset_class_id', ac.id)
          .order('rank', { ascending: true });
        const primary = (mapRows || []).find(m => m?.kind === 'primary') || (mapRows || [])[0] || null;
        if (primary?.benchmark_id) {
          const { data: bm } = await supabase
            .from(TABLES.BENCHMARKS)
            .select('ticker,name')
            .eq('id', primary.benchmark_id)
            .maybeSingle();
          benchTicker = bm?.ticker || null;
          benchName = bm?.name || null;
        }
      }
    }

    // Fallback to config-based resolver by label
    if (!benchTicker) {
      const fb = getPrimaryBenchmarkSyncByLabel(assetClass);
      if (fb?.ticker) {
        benchTicker = fb.ticker;
        benchName = fb.name || fb.ticker;
      }
    }

    if (!benchTicker) return; // Guard: no mapping → no row

    // Pull benchmark performance for EOM; if missing, take latest <= EOM
    let perf = null;
    if (eom) {
      const { data: exact } = await supabase
        .from(TABLES.BENCHMARK_PERFORMANCE)
        .select('ytd_return,one_year_return,three_year_return,five_year_return,expense_ratio,sharpe_ratio,standard_deviation_3y,standard_deviation_5y')
        .eq('benchmark_ticker', benchTicker)
        .eq('date', eom)
        .maybeSingle();
      perf = exact || null;

      if (!perf) {
        const { data: latest } = await supabase
          .from(TABLES.BENCHMARK_PERFORMANCE)
          .select('ytd_return,one_year_return,three_year_return,five_year_return,expense_ratio,sharpe_ratio,standard_deviation_3y,standard_deviation_5y,date')
          .eq('benchmark_ticker', benchTicker)
          .lte('date', eom)
          .order('date', { ascending: false })
          .limit(1);
        perf = (latest && latest[0]) || null;
      }
    }

    if (!perf) return; // Guard: no perf row → no benchmark row

    // Build a single benchmark row aligned to TABLE_COLUMNS
    const row = {
      ticker: benchTicker,
      name: benchName || benchTicker,
      asset_class: assetClass,
      ytd_return: formatPercentDisplay(perf.ytd_return),
      one_year_return: formatPercentDisplay(perf.one_year_return),
      three_year_return: formatPercentDisplay(perf.three_year_return),
      five_year_return: formatPercentDisplay(perf.five_year_return),
      expense_ratio: formatPercentDisplay(perf.expense_ratio),
      sharpe_ratio: formatNumberDisplay(perf.sharpe_ratio, 2),
      standard_deviation_3y: formatPercentDisplay(perf.standard_deviation_3y),
      standard_deviation_5y: formatPercentDisplay(perf.standard_deviation_5y),
      is_recommended: '—',
      _isBenchmark: true
    };

    const startY = (doc.lastAutoTable?.finalY || REPORT_CONFIG.margins.top) + 2;

    // Render a single-row table with distinct background for emphasis
    doc.autoTable({
      startY,
      head: undefined,
      body: [row],
      columns: TABLE_COLUMNS,
      styles: {
        font: 'DejaVuSans',
        fontSize: REPORT_CONFIG.fontSize.body,
        cellPadding: 2
      },
      bodyStyles: {
        fillColor: REPORT_CONFIG.colors.benchmarkBg,
        textColor: REPORT_CONFIG.colors.benchmarkText,
        fontStyle: 'bold'
      },
      columnStyles: getColumnStyles(),
      margin: {
        left: REPORT_CONFIG.margins.left,
        right: REPORT_CONFIG.margins.right
      }
    });
  } catch (e) {
    // Guard: never block PDF generation if benchmark lookups fail
    try { console.warn('Benchmark row append skipped:', e?.message || e); } catch {}
  }
}
```

- Pass a proper `asOf` value and make the export entry async

  - File: `src/services/exportService.js`
    - Import `asOfStore`.
```1:6:src/services/exportService.js
// src/services/exportService.js
import * as XLSX from 'xlsx';
import { toISODateTime } from '../utils/formatters';
import { supabase, TABLES } from './supabase';
// Avoid importing jsPDF/pdf generation in test/node by lazy-loading pdfReportService inside the function
import asOfStore from './asOfStore';
```
    - Make `generatePDFReport` async, add EOM as-of resolution (uses `toEomDate`) and pass through metadata.
```169:196:src/services/exportService.js
/**
 * Generate PDF report
 * @param {Object} data - Report data
 * @returns {Promise<jsPDF>} PDF document
 */
export async function generatePDFReport(data) {
  const { funds, metadata } = data;

  // Prepare metadata for PDF
  const pdfMetadata = {
    ...metadata,
    date: metadata?.date || new Date().toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    }),
    totalFunds: funds.length,
    recommendedFunds: funds.filter(f => f.is_recommended).length,
    assetClassCount: new Set(funds.map(f => f.asset_class).filter(Boolean)).size,
    averagePerformance: calculateAverage(funds.map(f => f.ytd_return).filter(v => v != null))
  };

  // Resolve asOf → EOM, prefer explicit metadata.asOf, else store/window
  const explicitAsOf = metadata?.asOf || null;
  const fallbackAsOf = (typeof window !== 'undefined' && window.__AS_OF_MONTH__) || asOfStore.getActiveMonth?.() || null;
  const { toEomDate } = require('./exportService'); // self-import safe at runtime
  const asOf = toEomDate(explicitAsOf || fallbackAsOf);

  // Lazy require to prevent jsdom canvas errors during tests
  const { generateMonthlyReport } = require('./pdfReportService');
  return await generateMonthlyReport({ funds, metadata: { ...pdfMetadata, asOf } });
}
```

- Update UI call sites to await the now-async `generatePDFReport`

  - File: `src/components/Dashboard/EnhancedPerformanceDashboard.jsx` (two locations)
```694:709:src/components/Dashboard/EnhancedPerformanceDashboard.jsx
<button role="menuitem" ... onClick={async () => {
  try {
    const metadata = { ... };
    const pdf = await generatePDFReport({ funds: filteredFunds, metadata });
    const name = formatExportFilename({ scope: 'pdf_all', asOf: (asOfMonthProp || window.__AS_OF_MONTH__ || null), ext: 'pdf' });
    pdf.save(name);
  } catch (e) { /* eslint-disable no-console */ console.error('PDF export failed', e); }
}}>
  PDF (all)
</button>
```
```713:732:src/components/Dashboard/EnhancedPerformanceDashboard.jsx
<button role="menuitem" ... onClick={async () => {
  const rec = (filteredFunds || []).filter(f => f.is_recommended || f.recommended);
  if (rec.length === 0) return;
  try {
    const metadata = { ... };
    const pdf = await generatePDFReport({ funds: rec, metadata });
    const name = formatExportFilename({ scope: 'pdf_recommended', asOf: (asOfMonthProp || window.__AS_OF_MONTH__ || null), ext: 'pdf' });
    pdf.save(name);
  } catch (e) { /* eslint-disable no-console */ console.error('PDF export failed', e); }
}}>
  PDF — Recommended
</button>
```
  - File: `src/components/Admin/AdminOverview.jsx`
```141:160:src/components/Admin/AdminOverview.jsx
<button role="menuitem" className="btn btn-link" ... onClick={async () => {
  try {
    const { supabase, TABLES } = await import('../../services/supabase');
    const { data: funds } = await supabase.from(TABLES.FUNDS).select('*').order('ticker');
    const metadata = { ... };
    const pdf = await generatePDFReport({ funds: funds || [], metadata });
    const { formatExportFilename } = await import('../../services/exportService');
    const name = formatExportFilename({ scope: 'admin_pdf_all', ext: 'pdf' });
    pdf.save(name);
  } catch (e) { console.error('PDF export failed', e); }
}}>All funds (PDF)</button>
```
  - File: `src/components/Reports/MonthlyReportButton.jsx` (if you re-enable it)
```37:43:src/components/Reports/MonthlyReportButton.jsx
case 'pdf':
  const pdf = await generatePDFReport(reportData);
  const pdfFileName = `Raymond_James_Lightship_Report_${dateStr}.pdf`;
  pdf.save(pdfFileName);
  break;
```

### 2) Benchmark data contract

- Mapping source and fields
  - `TABLES.ASSET_CLASSES` → `id`, `name`
  - `TABLES.ASSET_CLASS_BENCHMARKS` → `asset_class_id`, `benchmark_id`, `kind`, `rank` (choose `kind='primary'` else lowest `rank`)
  - `TABLES.BENCHMARKS` → `id`, `ticker`, `name`
  - Fallback (if mapping not found or Supabase stubbed): `getPrimaryBenchmarkSyncByLabel(label)` from `src/services/resolvers/benchmarkResolverClient.js`

- Monthly benchmark performance source
  - `TABLES.BENCHMARK_PERFORMANCE`:
    - Keys: `benchmark_ticker`, `date`
    - Metrics: `ytd_return`, `one_year_return`, `three_year_return`, `five_year_return`, `expense_ratio`, `sharpe_ratio`, `standard_deviation_3y`, `standard_deviation_5y`

- As-of handling
  - Effective `asOf` = `metadata.asOf` if provided; else `window.__AS_OF_MONTH__` or `asOfStore.getActiveMonth()`.
  - Convert to end-of-month via `toEomDate(YYYY-MM-DD)`.
  - Read `benchmark_performance` where `date = EOM`. If absent, fallback to latest row with `date <= EOM`.

- Fallback behavior
  - If no benchmark mapping or no performance row after fallback: skip appending the benchmark row (do not error), proceed with the rest of the report.

### 3) Performance and UX protections (client generation)

- Chunked rendering/yielding
  - The PDF creation loop yields to the main thread after each asset-class section using `yieldToMainThread()` to keep the UI responsive.
  - This avoids long blocking on large datasets without introducing Worker complexity for MVP.

- Optional Worker plan (follow-up)
  - Add `src/services/pdf.worker.js` to offload jsPDF operations; call through a wrapper that posts funds, metadata, and receives a Blob/PDF. Gate behind a feature flag.

- Timeouts and user-visible errors
  - In `exportService.generatePDFReport`: if `!funds || funds.length === 0`, throw `new Error('No fund data to export')` (existing callers already surface alerts).
  - If a required field is missing for a benchmark row, we skip silently and continue (warn in console), ensuring report generation always completes.

### 4) Test plan and fixtures

- Fixture (add `src/__tests__/__fixtures__/pdfFunds.mini.json`)
```json
{
  "asOf": "2025-03-15",
  "funds": [
    { "ticker": "AAA", "name": "Alpha US Fund", "asset_class": "US Equity", "ytd_return": 5.1234, "one_year_return": 12.5, "three_year_return": 7.1, "five_year_return": 9.2, "expense_ratio": 0.45, "sharpe_ratio": 0.88, "standard_deviation_3y": 14.3, "standard_deviation_5y": 13.1, "is_recommended": true },
    { "ticker": "BBB", "name": "Beta US Fund", "asset_class": "US Equity", "ytd_return": -1.2, "one_year_return": 3.0, "three_year_return": 4.7, "five_year_return": 6.0, "expense_ratio": 0.30, "sharpe_ratio": 0.65, "standard_deviation_3y": 12.0, "standard_deviation_5y": 11.4, "is_recommended": false },
    { "ticker": "INTL1", "name": "Global Ex-US", "asset_class": "International Equity", "ytd_return": 2.0, "one_year_return": 8.1, "three_year_return": 3.3, "five_year_return": 4.2, "expense_ratio": 0.55, "sharpe_ratio": 0.51, "standard_deviation_3y": 15.8, "standard_deviation_5y": 14.9, "is_recommended": false }
  ],
  "expectedBenchmark": {
    "class": "US Equity",
    "ticker": "SPY",
    "name": "S&P 500",
    "ytd_return": 6.00,
    "one_year_return": 14.00,
    "three_year_return": 8.00,
    "five_year_return": 10.00,
    "expense_ratio": 0.09,
    "sharpe_ratio": 1.10,
    "standard_deviation_3y": 13.50,
    "standard_deviation_5y": 12.40
  },
  "missingBenchmarkClass": "International Equity"
}
```

- Unit tests (new file `src/services/__tests__/pdfReportService.mvp.test.js`)
  - `groupFundsByAssetClass`:
    - Groups by `asset_class`; undefined → `Unassigned`.
  - `prepareRowData`:
    - Uses `formatPercentDisplay`/`formatNumberDisplay` from `exportService`.
    - Positive percent gets plus sign; nulls become `N/A`.
  - `appendBenchmarkRow`:
    - Mock Supabase module to return:
      - US Equity → mapping + performance present: verify one extra `autoTable` call with a single body row and correct formatted values.
      - International Equity → no mapping/perf: benchmark `autoTable` not called.
    - Strategy: spy on `doc.autoTable` to count calls and inspect the second call’s `body` for the benchmark row.

- Light visual assertion strategy
  - Validate `autoTable` head for the first table equals `TABLE_COLUMNS.map(c => c.header)`.
  - Assert per asset class:
    - First call: `body.length === fundsInClass`.
    - Second call: `body.length === 1` (benchmark row).
  - Optionally inspect the last `autoTable` call’s `styles/bodyStyles` include the benchmark background color.

### 5) Acceptance checklist

- Files edited:
  - `src/services/pdfReportService.js`, `src/services/exportService.js`, and three UI call sites.
- Buttons still work:
  - Dashboard “PDF (all)” and “PDF — Recommended” generate files without errors.
  - Admin “All funds (PDF)” works.
- Benchmark row:
  - Exactly one benchmark row appears per asset class, styled with the gold background, correct ticker/name, and formatted metrics.
- Fonts:
  - All tables render with embedded DejaVuSans; headings bold; cover page typography consistent.
- Filenames:
  - `formatExportFilename` continues to produce `lightship_pdf_*` names.
- Performance:
  - Report generation completes for 500+ rows within a reasonable time; UI remains responsive (no “frozen” feel) thanks to cooperative yields.
- Error paths:
  - Empty dataset: user-visible error from existing handlers.
  - Missing benchmark mapping/performance: PDF still completes; no crash; row simply omitted.

Summary
- Add explicit `jspdf-autotable` import; switch the font to the embedded one.
- Make PDF build async; pass `asOf` (EOM) and append a benchmark row per asset class with Supabase-first mapping and fallback.
- Centralize display formatters in `exportService` and reuse in PDF.
- Add cooperative yielding for responsiveness, simple guards for empty/missing data.
- Provide fixtures and tests for grouping, row shaping, and benchmark appending; include a minimal visual assertion strategy.


--------------------------------
//ASK Request #3



> **Goal:** Define the long-term HTML→PDF pipeline with an exact deployment recipe on Vercel, so we can migrate cleanly after the MVP ships.
>
> Please deliver a concrete blueprint that covers:
>
> 1. **Architecture and files** you recommend creating:
>
>    * `src/reports/monthly/` module split into pure data shaping, React template, and theme tokens.
>    * API route path and file for serverless rendering.
>    * The client trigger and download flow, behind a feature flag name you propose.
> 2. **Vercel-ready rendering stack** with versions:
>
>    * Choose Playwright or Puppeteer Core compatible with Vercel. List exact npm packages and versions, and how you will bundle Chromium or rely on a prebuilt binary.
>    * Note cold start expectations, memory limits, and any special `vercel.json` settings.
> 3. **Fonts and branding**:
>
>    * How you will embed brand fonts with subsetting. Include a fallback for full glyph coverage.
>    * Theme tokens file that centralizes colors, spacing, borders, and number formatting rules shared with CSV and Excel.
> 4. **Template composition**:
>
>    * Cover, table of contents, summary, per-asset-class section with benchmark row, appendix for footnotes.
>    * Pagination, sticky headers, page footers with disclaimers.
>    * Guidance for stable page breaks using print CSS.
> 5. **Contract and migration**:
>
>    * API payload shape `{ asOf, selection, options }` and the JSON schema for shaped rows coming from the data layer.
>    * A migration plan from current client PDF to HTML→PDF that can be rolled out behind `REACT_APP_ENABLE_PDF_V2`.
>    * Rollback plan if the serverless route fails, including a user-visible message and fallback to the client PDF path.
> 6. **Testing and CI**:
>
>    * Deterministic number formatting across exports.
>    * PDF smoke test in CI that renders a 2-page sample and asserts page count, section titles, and presence of benchmark rows.
>    * Strategy for light image diff tests on key pages without heavy flakiness.
>
> No code changes now. I want a complete, Vercel-specific recipe, file tree, and a migration plan I can hand to an AGENT request.



--------------------------------

//Response #3 from Cursor:

Read file: vercel.json

### Architecture and files

- File tree (new)
```
src/reports/monthly/
  data/
    shapeData.js            // fetch+normalize funds; attach benchmarks for asOf EOM
    schema.js               // zod/JSON Schema for payloads and shaped rows
  template/
    MonthlyReport.jsx       // React HTML template composition
    styles.css              // print CSS (page size, headers/footers, table rules)
    headerFooter.js         // header/footer HTML templates for Puppeteer
  theme/
    tokens.js               // colors, spacing, typography, borders, number formatting policy
  shared/
    format.js               // formatNumberDisplay/formatPercentDisplay; reused in server/client
  fonts/
    BrandSans-Regular.woff2
    BrandSans-Bold.woff2
    FallbackSans-Regular.woff2  // e.g., DejaVuSans subset for full glyph coverage
api/reports/monthly.js        // Vercel serverless route: POST → PDF
```

- API route
  - Path: `api/reports/monthly.js`
  - Method: POST
  - Input: JSON payload `{ asOf, selection, options }` (see Contract)
  - Output: `application/pdf` buffer

- Client trigger and download (behind flag)
  - Feature flag: `REACT_APP_ENABLE_PDF_V2`
  - New client function: `generateMonthlyReportV2({ asOf, selection, options })` in `src/services/exportService.js` that:
    - POSTs payload to `/api/reports/monthly`
    - Returns a `Blob` (`application/pdf`)
  - Call sites: If flag true, use V2; on failure or flag off, fall back to current client PDF.

### Vercel-ready rendering stack

- Packages (pin versions)
  - Serverless PDF:
    - `puppeteer-core@22.5.0`
    - `@sparticuz/chromium@123.0.1`  (Lambda-compatible Chromium for Vercel)
  - SSR/template:
    - `react@19.1.0` (already present)
    - `react-dom@19.1.0` (already present)
  - Validation:
    - `zod@3.23.8` (or keep JSON Schema only)
- Chromium bundling
  - Use `@sparticuz/chromium` for `executablePath`, `args`, `headless: true`.
  - Do not ship a full Chromium binary; rely on the package’s Lambda-compatible build.
- vercel.json
```json
{
  "functions": {
    "api/ycharts.js": { "maxDuration": 30 },
    "api/reports/monthly.js": {
      "memory": 1024,
      "maxDuration": 60,
      "includeFiles": "src/reports/fonts/**"
    }
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Access-Control-Allow-Origin", "value": "*" },
        { "key": "Access-Control-Allow-Methods", "value": "GET, POST, PUT, DELETE, OPTIONS" },
        { "key": "Access-Control-Allow-Headers", "value": "Content-Type, Authorization, X-Requested-With" }
      ]
    }
  ]
}
```
- Cold start and limits
  - Cold start: ~1–2s typical; first request per region slower due to Chromium boot.
  - Memory: 1024 MB sufficient for 5–10 page reports with tables; bump to 1536 MB if charts/images are added later.
  - Duration: 60s headroom for large sets; typical render < 5s.

### Fonts and branding

- Embedding strategy
  - Store pre-subset WOFF2 in `src/reports/fonts/`.
  - In API route, read fonts and embed via data URLs in a `<style>` block:
    - `@font-face` with `src: url(data:font/woff2;base64,...) format('woff2')`
    - `font-display: swap`
  - Fallback font: `FallbackSans-Regular.woff2` (DejaVuSans subset) for glyph coverage.
- Subsetting
  - Pre-generate subsets (Latin) offline and commit them (keeps serverless smaller).
  - Optionally add a script with `subset-font` to regenerate if branding changes.
- Theme tokens (single source of truth)
  - File: `src/reports/theme/tokens.js`
  - Expose:
    - `colors`: primary, text, border, table row alt, benchmark row bg/fg
    - `spacing`: unit scale
    - `typography`: family names (brand + fallback), sizes, weights
    - `borders`: radius, rules
    - `format`: re-export from `src/reports/shared/format.js` to ensure CSV/Excel/PDF parity

### Template composition (HTML)

- Composition
  - Cover
    - Title, subtitle, as-of date, brief KPIs
  - Table of contents
    - Section list with page numbers generated after render; or inline anchors only if page numbers are not essential at v1
  - Summary
    - Overall counts, asset class distribution, recommended counts
  - Per-asset-class sections
    - H2 section heading
    - Table with sticky header (print-repeatable header), rows for funds
    - Single benchmark row at bottom (distinct style)
  - Appendix
    - Footnotes, methodology, disclaimer
- Pagination and print CSS
  - Page size: Letter, landscape if required (or portrait if better density)
  - Use:
    - `@page { size: Letter; margin: 16mm 14mm; }`
    - `thead { display: table-header-group; }`
    - `tfoot { display: table-footer-group; }`
    - `tr, td, th { page-break-inside: avoid; }`
    - Utility classes: `.page-break-before { break-before: page; }`, `.avoid-break { break-inside: avoid; }`
- Headers/footers (Puppeteer)
  - Use `displayHeaderFooter: true` with templates from `template/headerFooter.js`:
    - Header: report title + as-of date + brand bar
    - Footer: page number `Page <span class="pageNumber"></span> of <span class="totalPages"></span>` and disclaimer
  - `margin` in `page.pdf()` large enough for header/footer content

### Contract and migration

- API payload shape
```json
{
  "asOf": "YYYY-MM-DD",
  "selection": {
    "scope": "all | recommended | tickers",
    "tickers": ["AAA","BBB"]    // required when scope = "tickers"
  },
  "options": {
    "columns": ["ticker","name","asset_class","ytd_return","one_year_return","three_year_return","five_year_return","expense_ratio","sharpe_ratio","standard_deviation_3y","standard_deviation_5y","is_recommended"],
    "brand": "RJ",
    "locale": "en-US",
    "landscape": true,
    "includeTOC": true
  }
}
```
- Shaped rows (server builds this from Supabase and options)
```json
{
  "asOf": "YYYY-MM-DD (EOM-resolved)",
  "sections": [
    {
      "assetClass": "US Equity",
      "rows": [
        { "ticker":"AAA", "name":"Alpha US Fund", "asset_class":"US Equity", "ytd_return":5.12, "one_year_return":12.5, "three_year_return":7.1, "five_year_return":9.2, "expense_ratio":0.45, "sharpe_ratio":0.88, "standard_deviation_3y":14.3, "standard_deviation_5y":13.1, "is_recommended": true }
      ],
      "benchmark": {
        "ticker":"SPY", "name":"S&P 500",
        "ytd_return":6.0, "one_year_return":14.0, "three_year_return":8.0, "five_year_return":10.0,
        "expense_ratio":0.09, "sharpe_ratio":1.10, "standard_deviation_3y":13.5, "standard_deviation_5y":12.4
      }
    }
  ]
}
```
- As-of rule
  - Server converts `asOf` to EOM; if no exact benchmark row on EOM, uses latest row ≤ EOM.
- Migration plan
  - Add `REACT_APP_ENABLE_PDF_V2` (default false).
  - Client:
    - If flag true, call `generateMonthlyReportV2`: POST to `/api/reports/monthly`, download PDF blob.
    - Else, use current client `generatePDFReport`.
  - Server:
    - Implement `api/reports/monthly.js` with SSR→HTML→PDF.
- Rollback plan
  - If API returns non-200 or throws, catch in client and fall back to `generatePDFReport` (client).
  - Show user message: “New PDF pipeline unavailable; falling back to legacy PDF.”

### Testing and CI

- Deterministic number formatting
  - Use `src/reports/shared/format.js` from both server and client (exported also from `src/services/exportService.js` or re-exported).
  - Unit tests to assert display format for edge cases (null/NaN/plus signs/decimals).
- PDF smoke test (CI)
  - Node test imports `api/reports/monthly.js` handler and calls it with a 2-class sample payload.
  - Use `pdf-parse@1.1.1` to assert:
    - Page count ≥ 2 (when seeded to exceed one page)
    - Contains section titles (“US Equity”, “International Equity”)
    - Contains benchmark tickers (“SPY”, etc.)
- Light image diffs (non-flaky)
  - During the same test, render the HTML string (the API can optionally return HTML for debug under a flag).
  - Use `puppeteer-core` locally to screenshot only the cover header and one table header region with a fixed viewport.
  - Compare with committed baselines via `pixelmatch@5.3.0` + `pngjs@7.0.0` using a small threshold.
  - Keep the baseline assets minimal and stable (no dynamic timestamps in the header area).

### Implementation notes (concise)

- `api/reports/monthly.js`
  - Validate payload with zod (or simple guards).
  - Resolve `asOf` → EOM.
  - If `selection.scope !== 'tickers'`, query funds from Supabase based on scope; else fetch by tickers.
  - Resolve per-asset-class primary benchmark (Supabase-first, fallback to config).
  - Fetch `benchmark_performance` for each benchmark (EOM exact else ≤ EOM latest).
  - Build shaped JSON via `src/reports/monthly/data/shapeData.js`.
  - Render React template with `renderToStaticMarkup`, inject fonts + styles.
  - Launch Chromium:
    - `const chromium = require('@sparticuz/chromium');`
    - `const puppeteer = require('puppeteer-core');`
    - `const browser = await puppeteer.launch({ args: chromium.args, defaultViewport: chromium.defaultViewport, executablePath: await chromium.executablePath(), headless: true });`
  - `page.setContent(html, { waitUntil: 'networkidle0' })`
  - `page.pdf({ format: 'Letter', landscape: options.landscape, printBackground: true, margin: { top:'16mm', right:'14mm', bottom:'16mm', left:'14mm' }, displayHeaderFooter: true, headerTemplate, footerTemplate })`
  - Return `Buffer` with `Content-Type: application/pdf`.

- Client `generateMonthlyReportV2`
  - POST JSON, `await response.arrayBuffer()`, `new Blob([buffer], { type: 'application/pdf' })`.

- Environment
  - Set `REACT_APP_ENABLE_PDF_V2` in Vercel Project Settings for Preview/Production once verified.

This blueprint is ready to hand to an AGENT for implementation with minimal ambiguity.


--------------------------------