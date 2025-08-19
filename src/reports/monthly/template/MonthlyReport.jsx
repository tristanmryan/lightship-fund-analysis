/**
 * React HTML Template for Monthly PDF Reports
 * Renders professional-quality HTML for server-side PDF generation
 */

import React from 'react';

/**
 * Main Monthly Report Component
 * @param {Object} props - Component props
 * @param {Object} props.data - Shaped report data
 * @param {Object} props.options - Report options
 * @param {Object} props.theme - Theme configuration
 */
function MonthlyReport({ data, options = {}, theme }) {
  const { sections, asOf, totalFunds, recommendedFunds } = data;
  const { landscape = true, includeTOC = true } = options;

  return (
    <div className="monthly-report">
      {/* Cover Page */}
      <CoverPage 
        data={data}
        options={options}
        theme={theme}
      />
      
      {/* Table of Contents */}
      {includeTOC && (
        <TableOfContents 
          sections={sections}
          theme={theme}
        />
      )}
      
      {/* Executive Summary */}
      <ExecutiveSummary 
        data={data}
        theme={theme}
      />
      
      {/* Asset Class Sections */}
      {sections.map((section, index) => (
        <AssetClassSection
          key={section.assetClass}
          section={section}
          sectionNumber={index + 1}
          theme={theme}
          isLastSection={index === sections.length - 1}
        />
      ))}
      
      {/* Footer/Disclaimer */}
      <DisclaimerSection theme={theme} />
    </div>
  );
}

/**
 * Cover Page Component
 */
function CoverPage({ data, options, theme }) {
  const { asOf, totalFunds, recommendedFunds } = data;
  
  return (
    <div className="cover-page page-break-after">
      <div className="header-brand">
        <div className="brand-bar"></div>
        <h1 className="main-title">Raymond James</h1>
        <h2 className="subtitle">Lightship Fund Analysis</h2>
        <h3 className="report-type">Monthly Performance Report</h3>
      </div>
      
      <div className="report-meta">
        <div className="date-info">
          <span className="label">Report Date:</span>
          <span className="value">{formatDate(asOf)}</span>
        </div>
        <div className="generation-info">
          <span className="label">Generated:</span>
          <span className="value">{formatDate(new Date().toISOString())}</span>
        </div>
      </div>
      
      <div className="summary-box">
        <h4>Portfolio Summary</h4>
        <div className="summary-grid">
          <div className="summary-item">
            <span className="metric-value">{totalFunds}</span>
            <span className="metric-label">Total Funds</span>
          </div>
          <div className="summary-item">
            <span className="metric-value">{recommendedFunds}</span>
            <span className="metric-label">Recommended</span>
          </div>
          <div className="summary-item">
            <span className="metric-value">{data.sections.length}</span>
            <span className="metric-label">Asset Classes</span>
          </div>
          <div className="summary-item">
            <span className="metric-value">
              {Math.round((recommendedFunds / totalFunds) * 100)}%
            </span>
            <span className="metric-label">Recommended %</span>
          </div>
        </div>
      </div>
      
      <div className="cover-footer">
        <p className="confidential-notice">
          This report contains confidential and proprietary information. 
          For authorized recipients only.
        </p>
      </div>
    </div>
  );
}

/**
 * Table of Contents Component
 */
function TableOfContents({ sections, theme }) {
  return (
    <div className="toc-page page-break-after">
      <h2 className="section-title">Table of Contents</h2>
      
      <div className="toc-list">
        <div className="toc-item">
          <span className="toc-title">Executive Summary</span>
          <span className="toc-dots"></span>
          <span className="toc-page-num">3</span>
        </div>
        
        {sections.map((section, index) => (
          <div key={section.assetClass} className="toc-item">
            <span className="toc-title">{section.assetClass}</span>
            <span className="toc-dots"></span>
            <span className="toc-page-num">{4 + index}</span>
          </div>
        ))}
        
        <div className="toc-item">
          <span className="toc-title">Important Disclosures</span>
          <span className="toc-dots"></span>
          <span className="toc-page-num">{4 + sections.length}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Executive Summary Component
 */
function ExecutiveSummary({ data, theme }) {
  const { sections, totalFunds, recommendedFunds } = data;
  
  // Calculate summary statistics
  const totalRecommendedByClass = sections.map(section => ({
    assetClass: section.assetClass,
    total: section.fundCount,
    recommended: section.recommendedCount,
    percentage: Math.round((section.recommendedCount / section.fundCount) * 100)
  }));
  
  return (
    <div className="summary-page page-break-after">
      <h2 className="section-title">Executive Summary</h2>
      
      <div className="summary-content">
        <div className="summary-stats">
          <h3>Portfolio Overview</h3>
          <p>
            This report analyzes <strong>{totalFunds} funds</strong> across{' '}
            <strong>{sections.length} asset classes</strong> as of{' '}
            <strong>{formatDate(data.asOf)}</strong>. Of these,{' '}
            <strong>{recommendedFunds} funds ({Math.round((recommendedFunds / totalFunds) * 100)}%)</strong>{' '}
            are currently recommended.
          </p>
        </div>
        
        <div className="summary-table">
          <h3>Asset Class Breakdown</h3>
          <table className="summary-stats-table">
            <thead>
              <tr>
                <th>Asset Class</th>
                <th>Total Funds</th>
                <th>Recommended</th>
                <th>% Recommended</th>
              </tr>
            </thead>
            <tbody>
              {totalRecommendedByClass.map(item => (
                <tr key={item.assetClass}>
                  <td>{item.assetClass}</td>
                  <td>{item.total}</td>
                  <td>{item.recommended}</td>
                  <td>{item.percentage}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="summary-notes">
          <h3>Key Observations</h3>
          <ul>
            <li>Performance data reflects returns as of {formatDate(data.asOf)}</li>
            <li>Rankings are calculated within each asset class</li>
            <li>Benchmark data is sourced from primary index providers</li>
            <li>Recommended funds meet our current selection criteria</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/**
 * Asset Class Section Component
 */
function AssetClassSection({ section, sectionNumber, theme, isLastSection }) {
  const { assetClass, fundCount, recommendedCount, rows, benchmark } = section;
  
  return (
    <div className={`asset-class-section ${!isLastSection ? 'page-break-after' : ''}`}>
      <div className="section-header">
        <h2 className="asset-class-title">{assetClass}</h2>
        <div className="section-meta">
          <span className="fund-count">
            {fundCount} fund{fundCount !== 1 ? 's' : ''}
            {recommendedCount > 0 && (
              <span className="recommended-count">
                {' '}• {recommendedCount} recommended
              </span>
            )}
          </span>
        </div>
      </div>
      
      <FundTable 
        rows={rows}
        benchmark={benchmark}
        assetClass={assetClass}
        theme={theme}
      />
    </div>
  );
}

/**
 * Fund Table Component
 */
function FundTable({ rows, benchmark, assetClass, theme }) {
  return (
    <div className="fund-table-container">
      <table className="fund-table">
        <thead>
          <tr>
            <th className="col-ticker">Ticker</th>
            <th className="col-name">Fund Name</th>
            <th className="col-ytd">YTD</th>
            <th className="col-1y">1Y</th>
            <th className="col-3y">3Y</th>
            <th className="col-5y">5Y</th>
            <th className="col-expense">Expense</th>
            <th className="col-sharpe">Sharpe</th>
            <th className="col-score">Score</th>
            <th className="col-rank">Rank</th>
            <th className="col-tenure">Tenure</th>
            <th className="col-rec">Rec</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <FundRow 
              key={row.ticker}
              row={row}
              index={index}
              theme={theme}
            />
          ))}
          
          {/* Benchmark Row */}
          {benchmark && (
            <BenchmarkRow 
              benchmark={benchmark}
              theme={theme}
            />
          )}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Individual Fund Row Component
 */
function FundRow({ row, index, theme }) {
  const isRecommended = row.isRecommended;
  const rowClass = `fund-row ${index % 2 === 1 ? 'alternate' : ''} ${isRecommended ? 'recommended' : ''}`;
  
  return (
    <tr className={rowClass}>
      <td className="col-ticker">{row.ticker}</td>
      <td className="col-name">{truncateText(row.name, 30)}</td>
      <td className="col-ytd numeric">{row.ytdReturn}</td>
      <td className="col-1y numeric">{row.oneYearReturn}</td>
      <td className="col-3y numeric">{row.threeYearReturn}</td>
      <td className="col-5y numeric">{row.fiveYearReturn}</td>
      <td className="col-expense numeric">{row.expenseRatio}</td>
      <td className="col-sharpe numeric">{row.sharpeRatio}</td>
      <td className="col-score numeric">{row.score}</td>
      <td className="col-rank center">{row.rank}</td>
      <td className="col-tenure center">{row.managerTenure}</td>
      <td className="col-rec center">{isRecommended ? '★' : ''}</td>
    </tr>
  );
}

/**
 * Benchmark Row Component
 */
function BenchmarkRow({ benchmark, theme }) {
  return (
    <tr className="benchmark-row">
      <td className="col-ticker">{benchmark.ticker}</td>
      <td className="col-name">{truncateText(benchmark.name || benchmark.ticker, 30)}</td>
      <td className="col-ytd numeric">{benchmark.ytd_return ? formatPercent(benchmark.ytd_return) : 'N/A'}</td>
      <td className="col-1y numeric">{benchmark.one_year_return ? formatPercent(benchmark.one_year_return) : 'N/A'}</td>
      <td className="col-3y numeric">{benchmark.three_year_return ? formatPercent(benchmark.three_year_return) : 'N/A'}</td>
      <td className="col-5y numeric">{benchmark.five_year_return ? formatPercent(benchmark.five_year_return) : 'N/A'}</td>
      <td className="col-expense numeric">{benchmark.expense_ratio ? formatPercent(benchmark.expense_ratio) : 'N/A'}</td>
      <td className="col-sharpe numeric">{benchmark.sharpe_ratio ? formatNumber(benchmark.sharpe_ratio, 2) : 'N/A'}</td>
      <td className="col-score center">—</td>
      <td className="col-rank center">—</td>
      <td className="col-tenure center">—</td>
      <td className="col-rec center">—</td>
    </tr>
  );
}

/**
 * Disclaimer Section Component
 */
function DisclaimerSection({ theme }) {
  return (
    <div className="disclaimer-section">
      <h3>Important Disclosures</h3>
      <div className="disclaimer-content">
        <p>
          <strong>Performance Disclosure:</strong> Past performance is not indicative of future results. 
          Investment returns and principal value will fluctuate, so shares may be worth more or less 
          than their original cost when redeemed.
        </p>
        
        <p>
          <strong>Risk Disclosure:</strong> All investments involve risk, including potential loss of principal. 
          Different investment strategies carry different risk profiles and may not be suitable for all investors.
        </p>
        
        <p>
          <strong>Data Sources:</strong> Performance data is sourced from fund companies and third-party 
          data providers. While we believe this information to be reliable, we cannot guarantee its accuracy.
        </p>
        
        <p>
          <strong>Advisory Disclosure:</strong> This report is for informational purposes only and does not 
          constitute investment advice. Please consult with your financial advisor before making investment decisions.
        </p>
        
        <div className="disclaimer-footer">
          <p>
            Raymond James & Associates, Inc. Member FINRA/SIPC<br/>
            © {new Date().getFullYear()} Raymond James & Associates, Inc. All rights reserved.
          </p>
        </div>
      </div>
    </div>
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

function truncateText(text, maxLength) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

// Export for ES6 modules
export default MonthlyReport;