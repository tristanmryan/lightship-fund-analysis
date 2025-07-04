// src/utils/dataFormatting.js
import { getScoreLabel } from '../services/scoring';

/**
 * Utility functions for consistent data formatting and display
 */

/**
 * Format a percentage value for display
 * @param {number|null|undefined} value - The value to format
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} Formatted percentage or '-'
 */
export function formatPercent(value, decimals = 2) {
    if (value == null || isNaN(value)) return '-';
    return `${value.toFixed(decimals)}%`;
  }
  
  /**
   * Format a number for display
   * @param {number|null|undefined} value - The value to format
   * @param {number} decimals - Number of decimal places (default: 2)
   * @returns {string} Formatted number or '-'
   */
  export function formatNumber(value, decimals = 2) {
    if (value == null || isNaN(value)) return '-';
    return value.toFixed(decimals);
  }
  
  /**
   * Format currency for display
   * @param {number|null|undefined} value - The value to format
   * @returns {string} Formatted currency or '-'
   */
  export function formatCurrency(value) {
    if (value == null || isNaN(value)) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }
  
  /**
   * Safely get a fund metric value
   * @param {Object} fund - The fund object
   * @param {string} metric - The metric name
   * @returns {number|null} The metric value or null
   */
  export function getFundMetric(fund, metric) {
    if (!fund) return null;
    
    // Map common metric names to actual field names
    const metricMap = {
      'return1Y': '1 Year',
      'return3Y': '3 Year',
      'return5Y': '5 Year',
      'return10Y': '10 Year',
      'sharpe': 'Sharpe Ratio',
      'stdDev': 'Standard Deviation',
      'stdDev3Y': 'StdDev3Y',
      'stdDev5Y': 'StdDev5Y',
      'expense': 'Net Expense Ratio',
      'alpha': 'Alpha',
      'upCapture': 'Up Capture Ratio',
      'downCapture': 'Down Capture Ratio',
      'tenure': 'Manager Tenure'
    };
    
    const fieldName = metricMap[metric] || metric;
    const value = fund[fieldName];
    
    return (value != null && !isNaN(value)) ? value : null;
  }
  
  /**
   * Get display name for a metric
   * @param {string} metric - The metric field name
   * @returns {string} Display-friendly name
   */
  export function getMetricDisplayName(metric) {
    const displayNames = {
      'YTD': 'YTD',
      '1 Year': '1Y Return',
      '3 Year': '3Y Return',
      '5 Year': '5Y Return',
      '10 Year': '10Y Return',
      'Sharpe Ratio': 'Sharpe Ratio',
      'StdDev3Y': '3Y Std Dev',
      'StdDev5Y': '5Y Std Dev',
      'Standard Deviation': 'Std Dev',
      'Net Expense Ratio': 'Expense Ratio',
      'Alpha': 'Alpha (5Y)',
      'Up Capture Ratio': 'Up Capture',
      'Down Capture Ratio': 'Down Capture',
      'Manager Tenure': 'Manager Tenure'
    };
    
    return displayNames[metric] || metric;
  }
  
  /**
   * Format a fund row for display in tables
   * @param {Object} fund - The fund object
   * @returns {Object} Formatted fund data
   */
  export function formatFundForDisplay(fund) {
    if (!fund) return {};
    
    return {
      symbol: fund.Symbol || '-',
      name: fund['Fund Name'] || '-',
      assetClass: fund['Asset Class'] || 'Unknown',
      score: fund.scores?.final || null,
      scoreLabel: fund.scores?.final ? `${fund.scores.final} - ${getScoreLabel(fund.scores.final)}` : '-',
      percentile: fund.scores?.percentile || null,
      ytd: formatPercent(fund['YTD']),
      return1Y: formatPercent(fund['1 Year']),
      return3Y: formatPercent(fund['3 Year']),
      return5Y: formatPercent(fund['5 Year']),
      return10Y: formatPercent(fund['10 Year']),
      sharpe: formatNumber(fund['Sharpe Ratio']),
      stdDev3Y: formatPercent(fund['StdDev3Y']),
      stdDev5Y: formatPercent(fund['StdDev5Y']),
      expense: formatPercent(fund['Net Expense Ratio']),
      alpha: formatNumber(fund['Alpha']),
      upCapture: formatPercent(fund['Up Capture Ratio']),
      downCapture: formatPercent(fund['Down Capture Ratio']),
      tenure: formatNumber(fund['Manager Tenure'], 1),
      isRecommended: fund.isRecommended || false,
      isBenchmark: fund.isBenchmark || false
    };
  }
  
  /**
   * Sort funds by a specific metric
   * @param {Array} funds - Array of funds
   * @param {string} metric - Metric to sort by
   * @param {string} direction - 'asc' or 'desc'
   * @returns {Array} Sorted funds
   */
  export function sortFundsByMetric(funds, metric, direction = 'desc') {
    const sorted = [...funds].sort((a, b) => {
      const aValue = getFundMetric(a, metric);
      const bValue = getFundMetric(b, metric);
      
      // Handle null values
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;
      
      // Sort
      if (direction === 'asc') {
        return aValue - bValue;
      } else {
        return bValue - aValue;
      }
    });
    
    return sorted;
  }
  
  /**
   * Filter funds by asset class
   * @param {Array} funds - Array of funds
   * @param {string} assetClass - Asset class to filter by
   * @returns {Array} Filtered funds
   */
  export function filterFundsByAssetClass(funds, assetClass) {
    if (!assetClass || assetClass === 'all') return funds;
    return funds.filter(f => f['Asset Class'] === assetClass);
  }
  
  /**
   * Get unique asset classes from funds
   * @param {Array} funds - Array of funds
   * @returns {Array} Sorted array of unique asset classes
   */
export function getUniqueAssetClasses(funds) {
  const classes = new Set(funds.map(f => f['Asset Class'] || 'Unknown'));
  return Array.from(classes).sort();
}
