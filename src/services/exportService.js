// src/services/exportService.js
import * as XLSX from 'xlsx';

/**
 * Export Service
 * Handles generation of Excel, PDF, and other report formats
 */

/**
 * Export data to Excel with multiple sheets
 * @param {Object} data - Data to export
 * @returns {Blob} Excel file blob
 */
export function exportToExcel(data) {
  const {
    funds = [],
    classSummaries = {},
    reviewCandidates = [],
    metadata = {},
    tagStats = null
  } = data;

  // Create workbook
  const wb = XLSX.utils.book_new();

  // Sheet 1: Overview
  const overviewData = [
    ['Lightship Fund Analysis Report'],
    ['Generated:', new Date().toLocaleString()],
    [''],
    ['Summary Statistics'],
    ['Total Funds:', funds.length],
    ['Recommended Funds:', funds.filter(f => f.isRecommended).length],
    ['Average Score:', calculateAverage(funds.map(f => f.scores?.final).filter(s => s != null))],
    ['Funds Needing Review:', reviewCandidates.length],
    [''],
    ['Asset Class Distribution']
  ];

  // Add asset class summary
  Object.entries(classSummaries).forEach(([className, summary]) => {
    overviewData.push([
      className,
      `${summary.fundCount} funds`,
      `Avg Score: ${summary.averageScore || 'N/A'}`
    ]);
  });

  const ws_overview = XLSX.utils.aoa_to_sheet(overviewData);
  XLSX.utils.book_append_sheet(wb, ws_overview, 'Overview');

  // Sheet 2: All Funds with Scores
  const fundHeaders = [
    'Symbol',
    'Fund Name',
    'Asset Class',
    'Score',
    'Percentile',
    'YTD %',
    '1 Year %',
    '3 Year %',
    '5 Year %',
    '10 Year %',
    'Sharpe Ratio',
    'Std Dev 3Y',
    'Std Dev 5Y',
    'Expense Ratio %',
    'Manager Tenure',
    'Is Recommended',
    'Is Benchmark',
    'Tags'
  ];

  const fundRows = funds.map(fund => [
    fund.Symbol,
    fund['Fund Name'],
    fund['Asset Class'],
    fund.scores?.final || '',
    fund.scores?.percentile || '',
    fund.YTD || '',
    fund['1 Year'] || '',
    fund['3 Year'] || '',
    fund['5 Year'] || '',
    fund['10 Year'] || '',
    fund['Sharpe Ratio'] || '',
    fund['StdDev3Y'] || '',
    fund['StdDev5Y'] || '',
    fund['Net Expense Ratio'] || '',
    fund['Manager Tenure'] || '',
    fund.isRecommended ? 'Yes' : 'No',
    fund.isBenchmark ? 'Yes' : 'No',
    (fund.autoTags || []).map(t => t.name).join(', ')
  ]);

  const ws_funds = XLSX.utils.aoa_to_sheet([fundHeaders, ...fundRows]);
  
  // Apply column widths
  ws_funds['!cols'] = [
    { wch: 10 }, // Symbol
    { wch: 40 }, // Fund Name
    { wch: 25 }, // Asset Class
    { wch: 8 },  // Score
    { wch: 10 }, // Percentile
    { wch: 8 },  // YTD
    { wch: 8 },  // 1Y
    { wch: 8 },  // 3Y
    { wch: 8 },  // 5Y
    { wch: 8 },  // 10Y
    { wch: 12 }, // Sharpe
    { wch: 10 }, // Std Dev 3Y
    { wch: 10 }, // Std Dev 5Y
    { wch: 12 }, // Expense
    { wch: 12 }, // Tenure
    { wch: 12 }, // Recommended
    { wch: 12 }, // Benchmark
    { wch: 30 }  // Tags
  ];

  XLSX.utils.book_append_sheet(wb, ws_funds, 'All Funds');

  // Sheet 3: Review Candidates
  if (reviewCandidates.length > 0) {
    const reviewHeaders = [
      'Symbol',
      'Fund Name',
      'Asset Class',
      'Score',
      'Review Reasons',
      '1 Year %',
      'Sharpe Ratio',
      'Expense Ratio %',
      'Is Recommended'
    ];

    const reviewRows = reviewCandidates.map(fund => [
      fund.Symbol,
      fund['Fund Name'],
      fund['Asset Class'],
      fund.scores?.final || '',
      fund.reviewReasons.join('; '),
      fund['1 Year'] || '',
      fund['Sharpe Ratio'] || '',
      fund['Net Expense Ratio'] || '',
      fund.isRecommended ? 'Yes' : 'No'
    ]);

    const ws_review = XLSX.utils.aoa_to_sheet([reviewHeaders, ...reviewRows]);
    ws_review['!cols'] = [
      { wch: 10 }, // Symbol
      { wch: 40 }, // Fund Name
      { wch: 25 }, // Asset Class
      { wch: 8 },  // Score
      { wch: 50 }, // Review Reasons
      { wch: 8 },  // 1Y
      { wch: 12 }, // Sharpe
      { wch: 12 }, // Expense
      { wch: 12 }  // Recommended
    ];
    
    XLSX.utils.book_append_sheet(wb, ws_review, 'Review Candidates');
  }

  // Sheet 4: Asset Class Analysis
  const classHeaders = [
    'Asset Class',
    'Fund Count',
    'Avg Score',
    'Median Score',
    'Benchmark Score',
    'Top Performer',
    'Top Score',
    'Bottom Performer',
    'Bottom Score',
    'Excellent (70+)',
    'Good (50-70)',
    'Poor (<50)'
  ];

  const classRows = Object.entries(classSummaries).map(([className, summary]) => [
    className,
    summary.fundCount,
    summary.averageScore || '',
    summary.medianScore || '',
    summary.benchmarkScore || '',
    summary.topPerformer?.Symbol || '',
    summary.topPerformer?.scores?.final || '',
    summary.bottomPerformer?.Symbol || '',
    summary.bottomPerformer?.scores?.final || '',
    summary.distribution?.excellent || 0,
    summary.distribution?.good || 0,
    summary.distribution?.poor || 0
  ]);

  const ws_classes = XLSX.utils.aoa_to_sheet([classHeaders, ...classRows]);
  ws_classes['!cols'] = [
    { wch: 30 }, // Asset Class
    { wch: 12 }, // Count
    { wch: 10 }, // Avg Score
    { wch: 12 }, // Median
    { wch: 15 }, // Benchmark
    { wch: 15 }, // Top Fund
    { wch: 10 }, // Top Score
    { wch: 15 }, // Bottom Fund
    { wch: 12 }, // Bottom Score
    { wch: 12 }, // Excellent
    { wch: 10 }, // Good
    { wch: 10 }  // Poor
  ];
  
  XLSX.utils.book_append_sheet(wb, ws_classes, 'Asset Class Analysis');

  // Sheet 5: Score Breakdown (for recommended funds)
  const recommendedFunds = funds.filter(f => f.isRecommended && f.scores?.breakdown);
  if (recommendedFunds.length > 0) {
    const breakdownHeaders = [
      'Symbol',
      'Fund Name',
      'Final Score',
      'YTD Z-Score',
      '1Y Z-Score',
      '3Y Z-Score',
      '5Y Z-Score',
      '10Y Z-Score',
      'Sharpe Z-Score',
      'Std Dev Z-Score',
      'Expense Z-Score',
      'Metrics Used'
    ];

    const breakdownRows = recommendedFunds.map(fund => {
      const b = fund.scores.breakdown;
      return [
        fund.Symbol,
        fund['Fund Name'],
        fund.scores.final,
        b.ytd?.zScore?.toFixed(2) || '',
        b.oneYear?.zScore?.toFixed(2) || '',
        b.threeYear?.zScore?.toFixed(2) || '',
        b.fiveYear?.zScore?.toFixed(2) || '',
        b.tenYear?.zScore?.toFixed(2) || '',
        b.sharpeRatio3Y?.zScore?.toFixed(2) || '',
        b.stdDev3Y?.zScore?.toFixed(2) || '',
        b.expenseRatio?.zScore?.toFixed(2) || '',
        `${fund.scores.metricsUsed}/${fund.scores.totalPossibleMetrics}`
      ];
    });

    const ws_breakdown = XLSX.utils.aoa_to_sheet([breakdownHeaders, ...breakdownRows]);
    XLSX.utils.book_append_sheet(wb, ws_breakdown, 'Score Breakdown');
  }

  // Generate Excel file
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/octet-stream' });
}

/**
 * Generate HTML report for preview or email
 * @param {Object} data - Report data
 * @returns {string} HTML string
 */
export function generateHTMLReport(data) {
  const {
    funds = [],
    classSummaries = {},
    reviewCandidates = [],
    metadata = {}
  } = data;

  const avgScore = calculateAverage(funds.map(f => f.scores?.final).filter(s => s != null));
  const recommendedCount = funds.filter(f => f.isRecommended).length;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Lightship Fund Analysis Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .header {
      background-color: #1e3a8a;
      color: white;
      padding: 30px;
      border-radius: 8px;
      margin-bottom: 30px;
    }
    .header h1 {
      margin: 0 0 10px 0;
      font-size: 2.5em;
    }
    .header p {
      margin: 0;
      opacity: 0.9;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .summary-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .summary-card h3 {
      margin: 0 0 10px 0;
      color: #1e3a8a;
      font-size: 0.9em;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .summary-card .value {
      font-size: 2em;
      font-weight: bold;
      color: #111;
    }
    .summary-card .subtitle {
      font-size: 0.9em;
      color: #666;
    }
    .section {
      background: white;
      padding: 30px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .section h2 {
      margin: 0 0 20px 0;
      color: #1e3a8a;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 10px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #e5e7eb;
    }
    th {
      background-color: #f9fafb;
      font-weight: 600;
      color: #374151;
    }
    tr:hover {
      background-color: #f9fafb;
    }
    .score-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 999px;
      font-weight: 600;
      font-size: 0.95em;
      border: 1px solid currentColor;
    }
    .score-excellent { background: #d1fae5; color: #065f46; }
    .score-good { background: #fef3c7; color: #78350f; }
    .score-poor { background: #fee2e2; color: #991b1b; }
    .alert {
      background: #fef3c7;
      border: 1px solid #fbbf24;
      padding: 15px;
      border-radius: 6px;
      margin-bottom: 20px;
    }
    .footer {
      text-align: center;
      color: #666;
      font-size: 0.9em;
      margin-top: 40px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Lightship Fund Analysis Report</h1>
    <p>Generated on ${new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })}</p>
  </div>

  <div class="summary-grid">
    <div class="summary-card">
      <h3>Total Funds Analyzed</h3>
      <div class="value">${funds.length}</div>
      <div class="subtitle">${recommendedCount} recommended</div>
    </div>
    <div class="summary-card">
      <h3>Average Score</h3>
      <div class="value">${avgScore.toFixed(1)}</div>
      <div class="subtitle">Out of 100</div>
    </div>
    <div class="summary-card">
      <h3>Funds Needing Review</h3>
      <div class="value">${reviewCandidates.length}</div>
      <div class="subtitle">Flagged for attention</div>
    </div>
    <div class="summary-card">
      <h3>Asset Classes</h3>
      <div class="value">${Object.keys(classSummaries).length}</div>
      <div class="subtitle">Diversified portfolio</div>
    </div>
  </div>

  ${reviewCandidates.length > 0 ? `
  <div class="section">
    <h2>⚠️ Funds Requiring Review</h2>
    <div class="alert">
      <strong>${reviewCandidates.length} funds</strong> have been flagged for review based on performance metrics.
    </div>
    <table>
      <thead>
        <tr>
          <th>Fund</th>
          <th>Score</th>
          <th>Review Reasons</th>
          <th>Key Metrics</th>
        </tr>
      </thead>
      <tbody>
        ${reviewCandidates.slice(0, 10).map(fund => `
        <tr>
          <td>
            <strong>${fund.Symbol}</strong><br>
            <small>${fund['Fund Name']}</small><br>
            <small style="color: #666">${fund['Asset Class']}</small>
          </td>
          <td>
            <span class="score-badge ${getScoreClass(fund.scores?.final || 0)}" title="${getScoreLabel(fund.scores?.final || 0)}">
              ${fund.scores?.final || 'N/A'}
            </span>
          </td>
          <td>
            ${fund.reviewReasons.map(r => `• ${r}`).join('<br>')}
          </td>
          <td>
            1Y: ${fund['1 Year']?.toFixed(2) || 'N/A'}%<br>
            Sharpe: ${fund['Sharpe Ratio']?.toFixed(2) || 'N/A'}<br>
            Expense: ${fund['Net Expense Ratio']?.toFixed(2) || 'N/A'}%
          </td>
        </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  ` : ''}

  <div class="section">
    <h2>📊 Asset Class Performance</h2>
    <table>
      <thead>
        <tr>
          <th>Asset Class</th>
          <th>Funds</th>
          <th>Avg Score</th>
          <th>Distribution</th>
          <th>Top Performer</th>
        </tr>
      </thead>
      <tbody>
        ${Object.entries(classSummaries).map(([className, summary]) => `
        <tr>
          <td><strong>${className}</strong></td>
          <td>${summary.fundCount}</td>
          <td>${summary.averageScore || 'N/A'}</td>
          <td>
            <span style="color: #059669">●</span> ${summary.distribution?.excellent || 0}
            <span style="color: #eab308">●</span> ${summary.distribution?.good || 0}
            <span style="color: #dc2626">●</span> ${summary.distribution?.poor || 0}
          </td>
          <td>${summary.topPerformer?.Symbol || 'N/A'} (${summary.topPerformer?.scores?.final || 'N/A'})</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>🏆 Top Performers</h2>
    <table>
      <thead>
        <tr>
          <th>Rank</th>
          <th>Fund</th>
          <th>Score</th>
          <th>1Y Return</th>
          <th>Sharpe Ratio</th>
        </tr>
      </thead>
      <tbody>
        ${funds
          .sort((a, b) => (b.scores?.final || 0) - (a.scores?.final || 0))
          .slice(0, 10)
          .map((fund, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>
            <strong>${fund.Symbol}</strong><br>
            <small>${fund['Fund Name']}</small>
          </td>
          <td>
            <span class="score-badge ${getScoreClass(fund.scores?.final || 0)}" title="${getScoreLabel(fund.scores?.final || 0)}">
              ${fund.scores?.final || 'N/A'}
            </span>
          </td>
          <td>${fund['1 Year']?.toFixed(2) || 'N/A'}%</td>
          <td>${fund['Sharpe Ratio']?.toFixed(2) || 'N/A'}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <div class="footer">
    <p>This report is for internal use only. Generated by Lightship Fund Analysis System.</p>
  </div>
</body>
</html>
  `;

  return html;
}

/**
 * Generate CSV export
 * @param {Array<Object>} funds - Fund data
 * @returns {string} CSV string
 */
export function exportToCSV(funds) {
  const headers = [
    'Symbol',
    'Fund Name',
    'Asset Class',
    'Score',
    'Percentile',
    'YTD %',
    '1 Year %',
    '3 Year %',
    '5 Year %',
    'Sharpe Ratio',
    'Expense Ratio %',
    'Is Recommended',
    'Tags'
  ];

  const rows = funds.map(fund => [
    fund.Symbol,
    `"${fund['Fund Name']}"`,
    `"${fund['Asset Class']}"`,
    fund.scores?.final || '',
    fund.scores?.percentile || '',
    fund.YTD || '',
    fund['1 Year'] || '',
    fund['3 Year'] || '',
    fund['5 Year'] || '',
    fund['Sharpe Ratio'] || '',
    fund['Net Expense Ratio'] || '',
    fund.isRecommended ? 'Yes' : 'No',
    `"${(fund.autoTags || []).map(t => t.name).join(', ')}"`
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  return csvContent;
}

/**
 * Generate executive summary text
 * @param {Object} data - Report data
 * @returns {string} Summary text
 */
export function generateExecutiveSummary(data) {
  const {
    funds = [],
    classSummaries = {},
    reviewCandidates = [],
    metadata = {}
  } = data;

  const avgScore = calculateAverage(funds.map(f => f.scores?.final).filter(s => s != null));
  const recommendedFunds = funds.filter(f => f.isRecommended);
  const recommendedAvgScore = calculateAverage(recommendedFunds.map(f => f.scores?.final).filter(s => s != null));

  const summary = `
EXECUTIVE SUMMARY
Lightship Fund Analysis - ${new Date().toLocaleDateString()}

PORTFOLIO OVERVIEW:
• Total funds analyzed: ${funds.length}
• Recommended funds: ${recommendedFunds.length}
• Average portfolio score: ${avgScore.toFixed(1)}/100
• Recommended funds average: ${recommendedAvgScore.toFixed(1)}/100

KEY FINDINGS:
${reviewCandidates.length > 0 ? `• ${reviewCandidates.length} funds require immediate review` : '• All funds performing within acceptable parameters'}
${reviewCandidates.filter(f => f.isRecommended).length > 0 ? `• ${reviewCandidates.filter(f => f.isRecommended).length} recommended funds are underperforming` : ''}

TOP PERFORMERS:
${funds
  .sort((a, b) => (b.scores?.final || 0) - (a.scores?.final || 0))
  .slice(0, 5)
  .map((f, i) => `${i + 1}. ${f.Symbol} - ${f['Fund Name']} (Score: ${f.scores?.final || 'N/A'})`)
  .join('\n')}

BOTTOM PERFORMERS:
${funds
  .sort((a, b) => (a.scores?.final || 999) - (b.scores?.final || 999))
  .slice(0, 5)
  .map((f, i) => `${i + 1}. ${f.Symbol} - ${f['Fund Name']} (Score: ${f.scores?.final || 'N/A'})`)
  .join('\n')}

ASSET CLASS SUMMARY:
${Object.entries(classSummaries)
  .map(([className, summary]) => 
    `• ${className}: ${summary.fundCount} funds, Avg Score: ${summary.averageScore || 'N/A'}`
  )
  .join('\n')}

RECOMMENDED ACTIONS:
${reviewCandidates.length > 0 ? '1. Review underperforming funds at next investment committee meeting' : '1. Continue monitoring all funds'}
${reviewCandidates.filter(f => f.isRecommended).length > 0 ? '2. Consider replacements for underperforming recommended funds' : ''}
${funds.filter(f => f.autoTags?.some(t => t.id === 'expensive')).length > 0 ? '3. Evaluate high-expense funds for lower-cost alternatives' : ''}

Generated by Lightship Fund Analysis System
  `;

  return summary.trim();
}

// Helper functions
function calculateAverage(numbers) {
  if (numbers.length === 0) return 0;
  return numbers.reduce((a, b) => a + b, 0) / numbers.length;
}

function getScoreClass(score) {
  if (score >= 70) return 'score-excellent';
  if (score >= 50) return 'score-good';
  return 'score-poor';
}

/**
 * Download file helper
 * @param {Blob|string} content - File content
 * @param {string} filename - File name
 * @param {string} type - MIME type
 */
export function downloadFile(content, filename, type = 'application/octet-stream') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default {
  exportToExcel,
  generateHTMLReport,
  exportToCSV,
  generateExecutiveSummary,
  downloadFile
};