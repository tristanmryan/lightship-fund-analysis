// src/services/pdfService.js
// Unified PDF generation service
// - Monthly PDF: server-rendered via /api/reports/monthly (React-PDF)
// - Advisor & Trade Flows PDFs: server-rendered via /api/reports/advisor and /api/reports/tradeflows (React-PDF)

/**
 * Generate Monthly PDF (single implementation)
 * Calls the serverless API that renders React-PDF and returns a Blob
 * @param {Object} data - Optional data bag (reads metadata.asOf if present)
 * @param {Object} options - { scope, tickers, columns, landscape, includeTOC, brand, locale }
 * @returns {Promise<Blob>} PDF blob
 */
export async function generateMonthlyPDF(data = {}, options = {}) {
  const { metadata } = data || {};
  const payload = {
    asOf:
      (metadata && metadata.asOf) ||
      (typeof window !== 'undefined' ? window.__AS_OF_MONTH__ || null : null),
    selection: {
      scope: options.scope || 'all',
      tickers: options.tickers || null,
    },
    options: {
      columns:
        options.columns || [
          'ticker',
          'name',
          'asset_class',
          'ytd_return',
          'one_year_return',
          'three_year_return',
          'five_year_return',
          'expense_ratio',
          'sharpe_ratio',
          'standard_deviation_3y',
          'standard_deviation_5y',
          'manager_tenure',
          'is_recommended',
        ],
      brand: options.brand || 'RJ',
      locale: options.locale || 'en-US',
      landscape: options.landscape !== false, // default true
      includeTOC: options.includeTOC !== false, // default true
    },
  };

  const base = (process.env.REACT_APP_REPORTS_API_BASE || '').replace(/\/$/, '');
  const url = base ? `${base}/api/reports/monthly` : '/api/reports/monthly';
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(
      `Monthly PDF API failed: ${response.status} - ${
        errorData.error || errorData.message || 'Unknown error'
      } (url: ${url})`
    );
  }

  return await response.blob();
}

/**
 * Download a PDF Blob with a given filename
 */
export function downloadPDF(pdfBlob, filename) {
  if (!(pdfBlob instanceof Blob)) {
    throw new Error('No PDF blob provided');
  }
  const url = URL.createObjectURL(pdfBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Advisor Portfolio PDF (jsPDF)
 */
export async function generateAdvisorPortfolioPDF({ snapshotDate, advisorId, summary = {}, portfolio = {} }) {
  const payload = { snapshotDate, advisorId, summary, portfolio };
  const base = (process.env.REACT_APP_REPORTS_API_BASE || '').replace(/\/$/, '');
  const url = base ? `${base}/api/reports/advisor` : '/api/reports/advisor';
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Advisor PDF API failed: ${response.status} - ${err.error || err.message || 'Unknown error'} (url: ${url})`);
  }
  return await response.blob();
}

/**
 * Trade Flows PDF (jsPDF)
 */
export async function generateTradeFlowsPDF({ month, assetClass = null, ticker = null, topInflows = [], topOutflows = [], heatmap = [], trend = [], sentiment = {} }) {
  const payload = { month, assetClass, ticker, topInflows, topOutflows, heatmap, trend, sentiment };
  const base = (process.env.REACT_APP_REPORTS_API_BASE || '').replace(/\/$/, '');
  const url = base ? `${base}/api/reports/tradeflows` : '/api/reports/tradeflows';
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Trade Flows PDF API failed: ${response.status} - ${err.error || err.message || 'Unknown error'} (url: ${url})`);
  }
  return await response.blob();
}

export default {
  generateMonthlyPDF,
  downloadPDF,
  generateAdvisorPortfolioPDF,
  generateTradeFlowsPDF,
};
