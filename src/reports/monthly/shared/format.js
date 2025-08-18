/**
 * Shared formatting functions for consistent display across PDF, CSV, and Excel exports
 * Ensures number formatting alignment between all export formats
 */

/**
 * Format numbers for display with consistent decimal places
 * @param {number|string} value - The value to format
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} Formatted number or 'N/A' for invalid values
 */
export function formatNumberDisplay(value, decimals = 2) {
  if (value == null || Number.isNaN(Number(value))) {
    return 'N/A';
  }
  
  const num = Number(value);
  return num.toFixed(decimals);
}

/**
 * Format percentages for display with consistent formatting
 * @param {number|string} value - The percentage value (as decimal, e.g., 0.05 for 5%)
 * @param {number} decimals - Number of decimal places (default: 2)  
 * @param {boolean} withSign - Include + sign for positive values (default: true)
 * @returns {string} Formatted percentage or 'N/A' for invalid values
 */
export function formatPercentDisplay(value, decimals = 2, withSign = true) {
  if (value == null || Number.isNaN(Number(value))) {
    return 'N/A';
  }
  
  const num = Number(value);
  const sign = withSign && num > 0 ? '+' : '';
  return `${sign}${num.toFixed(decimals)}%`;
}

/**
 * Format currency values for display
 * @param {number|string} value - The currency value
 * @param {string} currency - Currency code (default: 'USD')
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} Formatted currency or 'N/A' for invalid values
 */
export function formatCurrencyDisplay(value, currency = 'USD', decimals = 2) {
  if (value == null || Number.isNaN(Number(value))) {
    return 'N/A';
  }
  
  const num = Number(value);
  
  // Use Intl.NumberFormat for proper currency formatting
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(num);
  } catch (error) {
    // Fallback for unsupported currencies
    return `$${num.toFixed(decimals)}`;
  }
}

/**
 * Normalize a YYYY-MM-DD date to the end-of-month date in the same UTC month
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {string|null} End-of-month date string or null for invalid input
 */
export function toEomDate(dateStr) {
  if (!dateStr) return null;
  
  try {
    const d = new Date(`${dateStr}T00:00:00Z`);
    const eom = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
    
    const year = eom.getUTCFullYear();
    const month = String(eom.getUTCMonth() + 1).padStart(2, '0');
    const day = String(eom.getUTCDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch {
    return null;
  }
}

/**
 * Format date for display in reports
 * @param {string|Date} date - Date to format
 * @param {string} locale - Locale for formatting (default: 'en-US')
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
export function formatDateDisplay(date, locale = 'en-US', options = {}) {
  if (!date) return 'N/A';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    return 'Invalid Date';
  }
  
  const defaultOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  };
  
  return dateObj.toLocaleDateString(locale, { ...defaultOptions, ...options });
}

/**
 * Format large numbers with appropriate units (K, M, B)
 * @param {number|string} value - The value to format
 * @param {number} decimals - Number of decimal places (default: 1)
 * @returns {string} Formatted number with units or 'N/A' for invalid values
 */
export function formatLargeNumber(value, decimals = 1) {
  if (value == null || Number.isNaN(Number(value))) {
    return 'N/A';
  }
  
  const num = Number(value);
  const absNum = Math.abs(num);
  
  if (absNum >= 1e9) {
    return `${(num / 1e9).toFixed(decimals)}B`;
  } else if (absNum >= 1e6) {
    return `${(num / 1e6).toFixed(decimals)}M`;
  } else if (absNum >= 1e3) {
    return `${(num / 1e3).toFixed(decimals)}K`;
  } else {
    return num.toFixed(decimals);
  }
}

/**
 * Clean and normalize text for consistent display
 * @param {string} text - Text to clean
 * @param {number} maxLength - Maximum length (default: no limit)
 * @returns {string} Cleaned text
 */
export function cleanText(text, maxLength = null) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  // Normalize whitespace and trim
  let cleaned = text.replace(/\s+/g, ' ').trim();
  
  // Truncate if needed
  if (maxLength && cleaned.length > maxLength) {
    cleaned = cleaned.substring(0, maxLength - 3) + '...';
  }
  
  return cleaned;
}

/**
 * Format basis points for display
 * @param {number|string} value - Value in basis points
 * @param {boolean} includeLabel - Include 'bps' label (default: true)
 * @returns {string} Formatted basis points
 */
export function formatBasisPoints(value, includeLabel = true) {
  if (value == null || Number.isNaN(Number(value))) {
    return 'N/A';
  }
  
  const num = Number(value);
  const label = includeLabel ? ' bps' : '';
  
  return `${num.toFixed(0)}${label}`;
}

/**
 * Validate and sanitize numeric input
 * @param {any} value - Value to validate
 * @returns {number|null} Validated number or null if invalid
 */
export function validateNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  
  // Handle string inputs (remove common formatting)
  if (typeof value === 'string') {
    const cleaned = value.replace(/[,%$]/g, '').trim();
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }
  
  const num = Number(value);
  return isNaN(num) ? null : num;
}

/**
 * Format ranking (e.g., "1st", "2nd", "3rd", "4th")
 * @param {number} rank - The ranking number
 * @returns {string} Formatted ranking
 */
export function formatRanking(rank) {
  if (!rank || isNaN(rank)) return 'N/A';
  
  const num = parseInt(rank);
  const lastDigit = num % 10;
  const lastTwoDigits = num % 100;
  
  let suffix = 'th';
  
  if (lastTwoDigits < 11 || lastTwoDigits > 13) {
    switch (lastDigit) {
      case 1: suffix = 'st'; break;
      case 2: suffix = 'nd'; break;
      case 3: suffix = 'rd'; break;
    }
  }
  
  return `${num}${suffix}`;
}

/**
 * Format time periods consistently
 * @param {number} years - Number of years
 * @param {string} format - Format type: 'short', 'long' (default: 'short')
 * @returns {string} Formatted time period
 */
export function formatTimePeriod(years, format = 'short') {
  if (!years || isNaN(years)) return 'N/A';
  
  const num = Number(years);
  
  if (format === 'long') {
    if (num === 1) return '1 year';
    return `${num} years`;
  }
  
  // Short format
  return `${num}Y`;
}

// All functions are exported above using ES6 syntax